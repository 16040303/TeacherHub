import {
  LessonLifecycleStatus,
  NotificationType,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import prisma from "../config/prisma";
import * as orderRepository from "../repositories/order.repository";
import * as paymentRepository from "../repositories/payment.repository";
import { HttpError } from "../utils/http-error";
import { createNotificationSafely } from "./notification.service";
import {
  CreateOrderInput,
  ProcessOrderPaymentInput,
} from "../validators/order.validator";

type LifecycleStatus = "pending" | "paid" | "failed" | "cancelled";
type PaymentResultAccessState = "unlocked" | "processing" | "locked";

interface OrderLessonSummary {
  id: number;
  title: string;
  authorId: number;
  price: number;
  isPublished: boolean;
  lifecycleStatus: "draft" | "published" | "archived";
  thumbnailUrl: string | null;
}

export interface OrderView {
  id: number;
  userId: number;
  lessonId: number;
  lessonAuthorId: number;
  amount: number;
  currency: string;
  status: LifecycleStatus;
  paymentStatus: LifecycleStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentRef: string | null;
  orderReference: string | null;
  paidAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  entitlementGrantedAt: Date | null;
  entitlementSource: string | null;
  createdAt: Date;
  updatedAt: Date;
  lesson: OrderLessonSummary;
}

export interface PaymentResultSnapshot {
  order: OrderView;
  lesson: OrderLessonSummary | null;
  status: LifecycleStatus;
  orderStatus: LifecycleStatus;
  accessState: PaymentResultAccessState;
  paymentRef: string;
  message: string;
  statusHint: string;
  canRetry: boolean;
  nextActionLabel: string;
  processedAt: Date;
}

export interface LessonEntitlementView {
  lessonId: number;
  userId: number;
  hasAccess: boolean;
  accessState: "owner" | "free_unlocked" | "purchased" | "locked";
  reason:
    | "OWN_LESSON"
    | "FREE_LESSON"
    | "PAID_ORDER"
    | "PENDING_ORDER"
    | "FAILED_ORDER"
    | "CANCELLED_ORDER"
    | "NOT_PURCHASED";
  orderId: number | null;
  orderStatus: LifecycleStatus | null;
  entitlementGrantedAt: Date | null;
}

const ORDER_TRANSITIONS: Record<OrderStatus, Set<OrderStatus>> = {
  [OrderStatus.PENDING]: new Set([
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.PAID]: new Set([OrderStatus.PAID]),
  [OrderStatus.FAILED]: new Set([
    OrderStatus.FAILED,
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.CANCELLED]: new Set([OrderStatus.CANCELLED]),
};

const toLifecycleStatus = (status: OrderStatus | PaymentStatus): LifecycleStatus => {
  switch (status) {
    case OrderStatus.PENDING:
      return "pending";
    case OrderStatus.PAID:
      return "paid";
    case OrderStatus.FAILED:
      return "failed";
    case OrderStatus.CANCELLED:
      return "cancelled";
    default:
      return "pending";
  }
};

const toLessonLifecycleStatus = (
  status: LessonLifecycleStatus
): "draft" | "published" | "archived" => {
  switch (status) {
    case LessonLifecycleStatus.PUBLISHED:
      return "published";
    case LessonLifecycleStatus.ARCHIVED:
      return "archived";
    case LessonLifecycleStatus.DRAFT:
    default:
      return "draft";
  }
};

const toPaymentReference = (order: orderRepository.OrderWithRelations): string => {
  return (
    order.payment?.reference ??
    order.referenceCode ??
    `PAY-${order.id}-${Math.floor(order.updatedAt.getTime() / 1000)}`
  );
};

const normalizePaymentMethod = (method: string | null | undefined): string | null => {
  if (!method) {
    return null;
  }

  return method.trim().toLowerCase();
};

const mapOrder = (order: orderRepository.OrderWithRelations): OrderView => {
  const paymentStatus = order.payment?.status ?? (order.status as unknown as PaymentStatus);
  const paymentReference = order.payment?.reference ?? null;

  return {
    id: order.id,
    userId: order.buyerId,
    lessonId: order.lessonId,
    lessonAuthorId: order.lesson.authorId,
    amount: Number(order.amount),
    currency: order.currency,
    status: toLifecycleStatus(order.status),
    paymentStatus: toLifecycleStatus(paymentStatus),
    paymentMethod: normalizePaymentMethod(order.payment?.method),
    paymentReference,
    paymentRef: paymentReference,
    orderReference: order.referenceCode,
    paidAt: order.paidAt,
    failedAt: order.failedAt,
    cancelledAt: order.cancelledAt,
    entitlementGrantedAt: order.entitlementGrantedAt,
    entitlementSource: order.entitlementSource,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lesson: {
      id: order.lesson.id,
      title: order.lesson.title,
      authorId: order.lesson.authorId,
      price: Number(order.lesson.price),
      isPublished: order.lesson.isPublished,
      lifecycleStatus: toLessonLifecycleStatus(order.lesson.status),
      thumbnailUrl: order.lesson.thumbnailUrl,
    },
  };
};

const toOrderReference = (): string => {
  return `ORD-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;
};

const toGeneratedPaymentReference = (orderId: number): string => {
  return `PAY-${orderId}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
};

const assertOrderStatusTransition = (
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): void => {
  const allowedTargets = ORDER_TRANSITIONS[currentStatus];

  if (!allowedTargets?.has(targetStatus)) {
    throw new HttpError(
      409,
      `Cannot transition order from ${currentStatus.toLowerCase()} to ${targetStatus.toLowerCase()}`
    );
  }
};

const toOrderStatus = (paymentStatus: PaymentStatus): OrderStatus => {
  switch (paymentStatus) {
    case PaymentStatus.PAID:
      return OrderStatus.PAID;
    case PaymentStatus.FAILED:
      return OrderStatus.FAILED;
    case PaymentStatus.CANCELLED:
      return OrderStatus.CANCELLED;
    case PaymentStatus.PENDING:
    default:
      return OrderStatus.PENDING;
  }
};

const buildOrderLifecyclePatch = (
  currentOrder: orderRepository.OrderWithRelations,
  targetStatus: OrderStatus,
  now: Date
): Prisma.OrderUncheckedUpdateInput => {
  if (targetStatus === OrderStatus.PAID) {
    const paidAt = currentOrder.paidAt ?? now;
    const entitlementSource =
      currentOrder.entitlementSource ??
      (Number(currentOrder.amount) <= 0 ? "free_lesson" : "payment_confirmed");

    return {
      status: OrderStatus.PAID,
      paidAt,
      failedAt: null,
      cancelledAt: null,
      entitlementGrantedAt: currentOrder.entitlementGrantedAt ?? paidAt,
      entitlementSource,
    };
  }

  if (targetStatus === OrderStatus.FAILED) {
    return {
      status: OrderStatus.FAILED,
      paidAt: null,
      failedAt: currentOrder.failedAt ?? now,
      cancelledAt: null,
      entitlementGrantedAt: null,
      entitlementSource: null,
    };
  }

  if (targetStatus === OrderStatus.CANCELLED) {
    return {
      status: OrderStatus.CANCELLED,
      paidAt: null,
      failedAt: null,
      cancelledAt: currentOrder.cancelledAt ?? now,
      entitlementGrantedAt: null,
      entitlementSource: null,
    };
  }

  return {
    status: OrderStatus.PENDING,
    paidAt: null,
    failedAt: null,
    cancelledAt: null,
    entitlementGrantedAt: null,
    entitlementSource: null,
  };
};

const buildPaymentLifecyclePatch = (
  currentPayment: paymentRepository.PaymentWithOrder | null,
  targetStatus: PaymentStatus,
  now: Date,
  method: string,
  reference: string | null
): Prisma.PaymentUncheckedUpdateInput => {
  if (targetStatus === PaymentStatus.PAID) {
    return {
      status: PaymentStatus.PAID,
      method,
      reference,
      paidAt: currentPayment?.paidAt ?? now,
      failedAt: null,
      cancelledAt: null,
    };
  }

  if (targetStatus === PaymentStatus.FAILED) {
    return {
      status: PaymentStatus.FAILED,
      method,
      reference,
      paidAt: null,
      failedAt: currentPayment?.failedAt ?? now,
      cancelledAt: null,
    };
  }

  if (targetStatus === PaymentStatus.CANCELLED) {
    return {
      status: PaymentStatus.CANCELLED,
      method,
      reference,
      paidAt: null,
      failedAt: null,
      cancelledAt: currentPayment?.cancelledAt ?? now,
    };
  }

  return {
    status: PaymentStatus.PENDING,
    method,
    reference,
    paidAt: null,
    failedAt: null,
    cancelledAt: null,
  };
};

const ensureOrderAccessibleForBuyer = async (
  userId: number,
  orderId: number,
  tx?: orderRepository.DbClient
): Promise<orderRepository.OrderWithRelations> => {
  const order = await orderRepository.findOrderById(orderId, tx);

  if (!order) {
    throw new HttpError(404, "Order not found");
  }

  if (order.buyerId !== userId) {
    throw new HttpError(403, "You are not allowed to access this order");
  }

  return order;
};

const ensurePurchasableLesson = async (lessonId: number, userId: number) => {
  const lesson = await orderRepository.findLessonForOrder(lessonId);

  if (!lesson) {
    throw new HttpError(404, "Lesson not found");
  }

  if (lesson.authorId === userId) {
    throw new HttpError(403, "You cannot purchase your own lesson");
  }

  const isPublished =
    lesson.isPublished || lesson.status === LessonLifecycleStatus.PUBLISHED;

  if (!isPublished) {
    throw new HttpError(400, "Only published lessons can be purchased");
  }

  return lesson;
};

export const createOrder = async (
  userId: number,
  payload: CreateOrderInput
): Promise<OrderView> => {
  const lesson = await ensurePurchasableLesson(payload.lessonId, userId);

  const existingOrder = await orderRepository.findOrderByBuyerAndLesson(
    userId,
    lesson.id
  );

  if (existingOrder?.status === OrderStatus.PAID) {
    return mapOrder(existingOrder);
  }

  if (existingOrder?.status === OrderStatus.PENDING) {
    return mapOrder(existingOrder);
  }

  if (existingOrder &&
    (existingOrder.status === OrderStatus.FAILED ||
      existingOrder.status === OrderStatus.CANCELLED)
  ) {
    const reopenedOrder = await prisma.$transaction(async (tx) => {
      const reopened = await orderRepository.updateOrderById(
        existingOrder.id,
        {
          status: OrderStatus.PENDING,
          paidAt: null,
          failedAt: null,
          cancelledAt: null,
          entitlementGrantedAt: null,
          entitlementSource: null,
        },
        tx
      );

      const existingPayment = await paymentRepository.findPaymentByOrderId(
        reopened.id,
        tx
      );

      if (existingPayment) {
        await paymentRepository.updatePaymentById(
          existingPayment.id,
          {
            status: PaymentStatus.PENDING,
            paidAt: null,
            failedAt: null,
            cancelledAt: null,
          },
          tx
        );
      }

      const refreshed = await orderRepository.findOrderByIdForBuyer(
        reopened.id,
        userId,
        tx
      );

      if (!refreshed) {
        throw new HttpError(500, "Failed to reopen existing order");
      }

      return refreshed;
    });

    return mapOrder(reopenedOrder);
  }

  const now = new Date();
  const amount = Number(lesson.price);
  const isFreeLesson = amount <= 0;
  const orderStatus = isFreeLesson ? OrderStatus.PAID : OrderStatus.PENDING;

  const createdOrder = await prisma.$transaction(async (tx) => {
    const order = await orderRepository.createOrder(
      {
        buyerId: userId,
        lessonId: lesson.id,
        amount: lesson.price,
        status: orderStatus,
        currency: "VND",
        referenceCode: toOrderReference(),
        paidAt: isFreeLesson ? now : null,
        failedAt: null,
        cancelledAt: null,
        entitlementGrantedAt: isFreeLesson ? now : null,
        entitlementSource: isFreeLesson ? "free_lesson" : null,
      },
      tx
    );

    await paymentRepository.createPayment(
      {
        orderId: order.id,
        userId,
        amount: order.amount,
        status: isFreeLesson ? PaymentStatus.PAID : PaymentStatus.PENDING,
        method: isFreeLesson ? "PROMO" : "UNKNOWN",
        reference: isFreeLesson ? toGeneratedPaymentReference(order.id) : null,
        paidAt: isFreeLesson ? now : null,
        failedAt: null,
        cancelledAt: null,
      },
      tx
    );

    const refreshed = await orderRepository.findOrderByIdForBuyer(order.id, userId, tx);

    if (!refreshed) {
      throw new HttpError(500, "Failed to create order");
    }

    return refreshed;
  });

  return mapOrder(createdOrder);
};

export const listMyOrders = async (userId: number): Promise<OrderView[]> => {
  const orders = await orderRepository.listOrdersByBuyer(userId);
  return orders.map(mapOrder);
};

export const getMyOrderDetail = async (
  userId: number,
  orderId: number
): Promise<OrderView> => {
  const order = await ensureOrderAccessibleForBuyer(userId, orderId);
  return mapOrder(order);
};

export const cancelMyOrder = async (
  userId: number,
  orderId: number
): Promise<OrderView> => {
  const order = await ensureOrderAccessibleForBuyer(userId, orderId);

  if (order.status === OrderStatus.CANCELLED) {
    return mapOrder(order);
  }

  if (order.status !== OrderStatus.PENDING) {
    throw new HttpError(409, "Only pending orders can be cancelled");
  }

  const cancelledOrder = await prisma.$transaction(async (tx) => {
    const now = new Date();

    await orderRepository.updateOrderById(
      order.id,
      {
        status: OrderStatus.CANCELLED,
        cancelledAt: now,
        failedAt: null,
        paidAt: null,
        entitlementGrantedAt: null,
        entitlementSource: null,
      },
      tx
    );

    const payment = await paymentRepository.findPaymentByOrderId(order.id, tx);

    if (payment) {
      await paymentRepository.updatePaymentById(
        payment.id,
        {
          status: PaymentStatus.CANCELLED,
          cancelledAt: payment.cancelledAt ?? now,
          failedAt: null,
          paidAt: null,
        },
        tx
      );
    }

    const refreshed = await orderRepository.findOrderByIdForBuyer(order.id, userId, tx);

    if (!refreshed) {
      throw new HttpError(500, "Failed to cancel order");
    }

    return refreshed;
  });

  return mapOrder(cancelledOrder);
};

export const upsertOrderPayment = async (
  userId: number,
  orderId: number,
  payload: ProcessOrderPaymentInput
): Promise<OrderView> => {
  const currentOrder = await ensureOrderAccessibleForBuyer(userId, orderId);
  const targetOrderStatus = toOrderStatus(payload.status);

  assertOrderStatusTransition(currentOrder.status, targetOrderStatus);

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const freshOrder = await ensureOrderAccessibleForBuyer(userId, orderId, tx);
    const now = new Date();

    assertOrderStatusTransition(freshOrder.status, targetOrderStatus);

    const existingPayment = await paymentRepository.findPaymentByOrderId(
      freshOrder.id,
      tx
    );

    const paymentReference =
      payload.reference?.trim() ||
      existingPayment?.reference ||
      toGeneratedPaymentReference(freshOrder.id);

    const paymentPatch = buildPaymentLifecyclePatch(
      existingPayment,
      payload.status,
      now,
      payload.method,
      paymentReference
    );

    const shouldSetPaidAt = payload.status === PaymentStatus.PAID;
    const shouldSetFailedAt = payload.status === PaymentStatus.FAILED;
    const shouldSetCancelledAt = payload.status === PaymentStatus.CANCELLED;

    if (!existingPayment) {
      await paymentRepository.createPayment(
        {
          orderId: freshOrder.id,
          userId,
          amount: freshOrder.amount,
          status: payload.status,
          method: payload.method,
          reference: paymentReference,
          paidAt: shouldSetPaidAt ? now : null,
          failedAt: shouldSetFailedAt ? now : null,
          cancelledAt: shouldSetCancelledAt ? now : null,
        },
        tx
      );
    } else {
      await paymentRepository.updatePaymentById(existingPayment.id, paymentPatch, tx);
    }

    const orderPatch = buildOrderLifecyclePatch(freshOrder, targetOrderStatus, now);

    await orderRepository.updateOrderById(
      freshOrder.id,
      {
        ...orderPatch,
      },
      tx
    );

    const refreshed = await orderRepository.findOrderByIdForBuyer(
      freshOrder.id,
      userId,
      tx
    );

    if (!refreshed) {
      throw new HttpError(500, "Failed to update order payment state");
    }

    return refreshed;
  });

  if (
    targetOrderStatus === OrderStatus.PAID &&
    currentOrder.status !== OrderStatus.PAID
  ) {
    const lessonId = updatedOrder.lesson.id;

    await Promise.all([
      createNotificationSafely({
        userId,
        actorId: updatedOrder.lesson.authorId,
        type: NotificationType.PAYMENT,
        title: "Payment successful",
        content: `Your order for \"${updatedOrder.lesson.title}\" is now paid and unlocked.`,
        actionUrl: `/orders/${updatedOrder.id}/payment-result`,
        actionLabel: "View payment result",
        entityType: "order",
        entityId: updatedOrder.id,
        metadata: {
          source: "order_payment",
          lessonId,
        },
      }),
      createNotificationSafely({
        userId: updatedOrder.lesson.authorId,
        actorId: userId,
        type: NotificationType.ORDER,
        title: "New paid order received",
        content: `A learner completed payment for \"${updatedOrder.lesson.title}\".`,
        actionUrl: "/dashboard",
        actionLabel: "Open dashboard",
        entityType: "order",
        entityId: updatedOrder.id,
        metadata: {
          source: "order_payment",
          lessonId,
          buyerId: userId,
        },
      }),
    ]);
  }

  return mapOrder(updatedOrder);
};

const toAccessState = (status: LifecycleStatus): PaymentResultAccessState => {
  if (status === "paid") {
    return "unlocked";
  }

  if (status === "pending") {
    return "processing";
  }

  return "locked";
};

const toStatusHint = (status: LifecycleStatus): string => {
  if (status === "paid") {
    return "Lesson unlocked";
  }

  if (status === "failed") {
    return "Payment retry recommended";
  }

  if (status === "cancelled") {
    return "Order cancelled";
  }

  return "Settlement in progress";
};

const toResultMessage = (status: LifecycleStatus, amount: number): string => {
  if (status === "paid") {
    return amount > 0
      ? "Payment completed. Your lesson is now unlocked and ready to download."
      : "This free lesson was unlocked successfully.";
  }

  if (status === "failed") {
    return "Payment failed. Please retry with a valid payment method.";
  }

  if (status === "cancelled") {
    return "This order was cancelled before payment completion.";
  }

  return "Payment is still pending confirmation. Please check again shortly.";
};

export const getPaymentResult = async (
  userId: number,
  orderId: number
): Promise<PaymentResultSnapshot> => {
  const order = await ensureOrderAccessibleForBuyer(userId, orderId);
  const mappedOrder = mapOrder(order);

  const status = mappedOrder.status;
  const accessState = toAccessState(status);

  return {
    order: mappedOrder,
    lesson: mappedOrder.lesson,
    status,
    orderStatus: status,
    accessState,
    paymentRef: toPaymentReference(order),
    message: toResultMessage(status, mappedOrder.amount),
    statusHint: toStatusHint(status),
    canRetry: status === "failed",
    nextActionLabel:
      status === "paid"
        ? "Open lesson"
        : status === "failed"
          ? "Retry payment"
          : status === "cancelled"
            ? "Create new order"
            : "Refresh status",
    processedAt: mappedOrder.updatedAt,
  };
};

export const getLessonEntitlement = async (
  userId: number,
  lessonId: number
): Promise<LessonEntitlementView> => {
  const lesson = await orderRepository.findLessonForOrder(lessonId);

  if (!lesson) {
    throw new HttpError(404, "Lesson not found");
  }

  if (lesson.authorId === userId) {
    return {
      lessonId,
      userId,
      hasAccess: true,
      accessState: "owner",
      reason: "OWN_LESSON",
      orderId: null,
      orderStatus: null,
      entitlementGrantedAt: null,
    };
  }

  if (Number(lesson.price) <= 0) {
    return {
      lessonId,
      userId,
      hasAccess: true,
      accessState: "free_unlocked",
      reason: "FREE_LESSON",
      orderId: null,
      orderStatus: null,
      entitlementGrantedAt: null,
    };
  }

  const paidOrder = await orderRepository.findPaidOrderForEntitlement(userId, lessonId);

  if (paidOrder) {
    return {
      lessonId,
      userId,
      hasAccess: true,
      accessState: "purchased",
      reason: "PAID_ORDER",
      orderId: paidOrder.id,
      orderStatus: toLifecycleStatus(paidOrder.status),
      entitlementGrantedAt: paidOrder.entitlementGrantedAt,
    };
  }

  const latestOrder = await orderRepository.findOrderByBuyerAndLesson(userId, lessonId);

  if (!latestOrder) {
    return {
      lessonId,
      userId,
      hasAccess: false,
      accessState: "locked",
      reason: "NOT_PURCHASED",
      orderId: null,
      orderStatus: null,
      entitlementGrantedAt: null,
    };
  }

  const latestStatus = toLifecycleStatus(latestOrder.status);

  return {
    lessonId,
    userId,
    hasAccess: false,
    accessState: "locked",
    reason:
      latestStatus === "pending"
        ? "PENDING_ORDER"
        : latestStatus === "failed"
          ? "FAILED_ORDER"
          : latestStatus === "cancelled"
            ? "CANCELLED_ORDER"
            : "NOT_PURCHASED",
    orderId: latestOrder.id,
    orderStatus: latestStatus,
    entitlementGrantedAt: latestOrder.entitlementGrantedAt,
  };
};
