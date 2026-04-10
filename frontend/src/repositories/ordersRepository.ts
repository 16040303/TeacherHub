import {
  Lesson,
  Order,
  PaymentResultSnapshot,
  PaymentStatus,
} from '../types';
import { apiRequest } from '../services/apiClient';
import { parseApiError } from '../utils/api-error';
import { mapBackendOrderStatus, mapBackendPaymentStatus } from '../utils/mappers';
import { toSafeDate, toSafeNumber, toTrimmedString } from '../utils/normalizers';

export interface CheckoutContext {
  lesson: Lesson;
  existingPaidOrder: Order | null;
  pendingOrder: Order | null;
}

interface BackendOrderLessonDto {
  id: number;
  title?: string;
  authorId: number;
  price?: number;
  isPublished?: boolean;
  lifecycleStatus?: 'draft' | 'published' | 'archived';
  thumbnailUrl?: string | null;
}

interface BackendOrderDto {
  id: number;
  userId: number;
  lessonId: number;
  lessonAuthorId: number;
  amount: number;
  currency?: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentRef?: string | null;
  orderReference?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  entitlementGrantedAt?: string | null;
  entitlementSource?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  lesson?: BackendOrderLessonDto | null;
}

interface BackendPaymentResultDto {
  order: BackendOrderDto;
  lesson?: BackendOrderLessonDto | null;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  orderStatus: 'pending' | 'paid' | 'failed' | 'cancelled';
  accessState: 'unlocked' | 'processing' | 'locked';
  paymentRef: string;
  message: string;
  statusHint: string;
  canRetry: boolean;
  nextActionLabel: string;
  processedAt: string;
}

interface BackendLessonEntitlementDto {
  lessonId: number;
  userId: number;
  hasAccess: boolean;
  accessState: 'owner' | 'free_unlocked' | 'purchased' | 'locked';
}

const toId = (value: number | string | undefined | null, fallback: string): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  const normalized = toTrimmedString(value);
  return normalized || fallback;
};

const normalizePaymentMethod = (
  value: string | null | undefined,
  amount: number,
  status: Order['status'],
): NonNullable<Order['paymentMethod']> => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'bank' || normalized === 'vnpay' || normalized === 'momo') {
    return normalized;
  }

  if (normalized === 'wallet') {
    return 'wallet';
  }

  if (normalized === 'promo') {
    return 'promo';
  }

  if (status === 'paid' && amount <= 0) {
    return 'promo';
  }

  return 'unknown';
};

const normalizeEntitlementSource = (
  value: string | null | undefined,
  amount: number,
  status: Order['status'],
): Order['entitlementSource'] => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (
    normalized === 'payment_confirmed' ||
    normalized === 'free_lesson' ||
    normalized === 'manual' ||
    normalized === 'unknown'
  ) {
    return normalized;
  }

  if (status === 'paid') {
    return amount <= 0 ? 'free_lesson' : 'payment_confirmed';
  }

  return undefined;
};

const toPaymentStatusFromOrderStatus = (status: Order['status']): PaymentStatus => {
  if (status === 'paid') {
    return 'success';
  }

  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  return 'pending';
};

const toPaymentRef = (order: Order): string => {
  const direct = toTrimmedString(order.paymentRef);
  if (direct) {
    return direct;
  }

  const seed = toTrimmedString(order.id) || 'UNKNOWN';
  return `PAY-${seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
};

const mapOrder = (dto: BackendOrderDto): Order => {
  const amount = Math.max(0, Math.floor(toSafeNumber(dto.amount, 0)));
  const status = mapBackendOrderStatus(dto.status);
  const fallbackPaymentStatus = toPaymentStatusFromOrderStatus(status);
  const paymentStatus = dto.paymentStatus
    ? mapBackendPaymentStatus(dto.paymentStatus)
    : fallbackPaymentStatus;

  const createdAt = toSafeDate(dto.createdAt);
  const updatedAt = toSafeDate(dto.updatedAt ?? dto.createdAt, createdAt);
  const paymentRef =
    toTrimmedString(dto.paymentRef) ||
    toTrimmedString(dto.paymentReference) ||
    toTrimmedString(dto.orderReference) ||
    undefined;

  return {
    id: toId(dto.id, 'order-unknown'),
    userId: toId(dto.userId, 'unknown-user'),
    lessonId: toId(dto.lessonId, 'unknown-lesson'),
    lessonAuthorId: toId(dto.lessonAuthorId, 'unknown-author'),
    amount,
    status,
    paymentStatus,
    createdAt,
    updatedAt,
    paidAt: dto.paidAt ? toSafeDate(dto.paidAt, updatedAt) : undefined,
    failedAt: dto.failedAt ? toSafeDate(dto.failedAt, updatedAt) : undefined,
    cancelledAt: dto.cancelledAt ? toSafeDate(dto.cancelledAt, updatedAt) : undefined,
    paymentRef,
    paymentMethod: normalizePaymentMethod(dto.paymentMethod, amount, status),
    entitlementGrantedAt: dto.entitlementGrantedAt
      ? toSafeDate(dto.entitlementGrantedAt, updatedAt)
      : undefined,
    entitlementSource: normalizeEntitlementSource(dto.entitlementSource, amount, status),
  };
};

const mapLessonSummary = (
  lesson: BackendOrderLessonDto | null | undefined,
  fallbackOrder: Order,
): Lesson | null => {
  if (!lesson) {
    return null;
  }

  const lessonId = toId(lesson.id, fallbackOrder.lessonId);
  const authorId = toId(lesson.authorId, fallbackOrder.lessonAuthorId);
  const price = Math.max(0, Math.floor(toSafeNumber(lesson.price, fallbackOrder.amount)));
  const now = new Date().toISOString();

  return {
    id: lessonId,
    authorId,
    title: toTrimmedString(lesson.title) || 'Untitled lesson',
    description: '',
    subject: 'Math',
    gradeLevel: 'High School',
    format: 'PDF',
    downloads: 0,
    rating: 0,
    reviewCount: 0,
    thumbnail:
      toTrimmedString(lesson.thumbnailUrl) ||
      `https://picsum.photos/seed/${encodeURIComponent(lessonId)}/640/420`,
    price,
    status:
      lesson.lifecycleStatus === 'draft'
        ? 'draft'
        : lesson.lifecycleStatus === 'archived'
        ? 'hidden'
        : lesson.isPublished === false
        ? 'hidden'
        : 'published',
    createdAt: now,
    updatedAt: now,
    tags: [],
  };
};

const toResultStatus = (status: Order['status']): PaymentResultSnapshot['status'] => {
  if (status === 'paid') {
    return 'paid';
  }

  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  return 'pending';
};

const toAccessState = (status: PaymentResultSnapshot['status']): PaymentResultSnapshot['accessState'] => {
  if (status === 'paid') {
    return 'unlocked';
  }

  if (status === 'pending') {
    return 'processing';
  }

  return 'locked';
};

const toStatusHint = (status: Order['status']): string => {
  if (status === 'paid') {
    return 'Lesson unlocked';
  }

  if (status === 'failed') {
    return 'Payment retry recommended';
  }

  if (status === 'cancelled') {
    return 'Order cancelled';
  }

  return 'Settlement in progress';
};

const toResultMessage = (status: Order['status'], amount: number): string => {
  if (status === 'paid') {
    return amount > 0
      ? 'Payment completed. Your lesson is now unlocked and ready to download.'
      : 'This free lesson was unlocked successfully.';
  }

  if (status === 'failed') {
    return 'Payment failed. Please retry with a valid payment method.';
  }

  if (status === 'cancelled') {
    return 'This order was cancelled before payment completed. Start a new checkout if needed.';
  }

  return 'Payment is still pending confirmation. Check back shortly for the final status.';
};

const mapPaymentResultSnapshot = (dto: BackendPaymentResultDto): PaymentResultSnapshot => {
  const order = mapOrder(dto.order);
  const lesson = mapLessonSummary(dto.lesson ?? dto.order.lesson ?? null, order);
  const status = toResultStatus(order.status);

  return {
    order,
    lesson,
    status,
    orderStatus: status,
    accessState: toAccessState(status),
    paymentRef: toTrimmedString(dto.paymentRef) || toPaymentRef(order),
    message: toTrimmedString(dto.message) || toResultMessage(order.status, order.amount),
    statusHint: toTrimmedString(dto.statusHint) || toStatusHint(order.status),
    canRetry: typeof dto.canRetry === 'boolean' ? dto.canRetry : order.status === 'failed',
    nextActionLabel:
      toTrimmedString(dto.nextActionLabel) ||
      (order.status === 'paid'
        ? 'Open lesson'
        : order.status === 'failed'
        ? 'Retry payment'
        : order.status === 'cancelled'
        ? 'Create new order'
        : 'Refresh status'),
    processedAt: toSafeDate(dto.processedAt, order.updatedAt ?? order.createdAt),
  };
};

const isFallbackEligibleError = (error: unknown): boolean => {
  const parsed = parseApiError(error);
  return (
    parsed.statusCode === 404 ||
    parsed.statusCode === 501 ||
    /failed to fetch|networkerror|network error|request failed/i.test(parsed.message)
  );
};

export const getCheckoutContext = async (
  userId: string,
  lessonId: string,
): Promise<CheckoutContext> => {
  try {
    const orderRows = await apiRequest<BackendOrderDto[]>('/api/orders');
    const lessonEntitlement = await apiRequest<BackendLessonEntitlementDto>(
      `/api/orders/entitlements/${encodeURIComponent(lessonId)}`,
    );

    const mappedOrders = orderRows.map(mapOrder);

    const existingPaidOrder =
      mappedOrders.find((order) => order.lessonId === lessonId && order.status === 'paid') ?? null;

    const pendingOrder =
      mappedOrders.find((order) => order.lessonId === lessonId && order.status === 'pending') ?? null;

    const fallbackLesson: Lesson = {
      id: lessonId,
      authorId: existingPaidOrder?.lessonAuthorId ?? pendingOrder?.lessonAuthorId ?? 'unknown-author',
      title: 'Lesson checkout',
      description: '',
      subject: 'Math',
      gradeLevel: 'High School',
      format: 'PDF',
      downloads: 0,
      rating: 0,
      reviewCount: 0,
      thumbnail: `https://picsum.photos/seed/${encodeURIComponent(lessonId)}/640/420`,
      price: existingPaidOrder?.amount ?? pendingOrder?.amount ?? 0,
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    };

    if (lessonEntitlement?.accessState === 'owner') {
      throw parseApiError({
        message: 'You cannot checkout your own lesson',
        statusCode: 403,
      });
    }

    return {
      lesson: fallbackLesson,
      existingPaidOrder,
      pendingOrder,
    };
  } catch (error) {
    throw parseApiError(error);
  }
};

export const createPendingOrder = async (
  _userId: string,
  lessonId: string,
): Promise<Order> => {
  try {
    const created = await apiRequest<BackendOrderDto>('/api/orders', {
      method: 'POST',
      body: {
        lessonId: Number(lessonId),
      },
    });

    return mapOrder(created);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const processOrderPayment = async (
  orderId: string,
  paymentStatus: PaymentStatus,
): Promise<Order> => {
  const statusByPayment: Record<PaymentStatus, 'pending' | 'paid' | 'failed' | 'cancelled'> = {
    success: 'paid',
    pending: 'pending',
    failed: 'failed',
    cancelled: 'cancelled',
  };

  try {
    const updated = await apiRequest<BackendOrderDto>(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
      method: 'POST',
      body: {
        status: statusByPayment[paymentStatus],
        method: 'WALLET',
      },
    });

    return mapOrder(updated);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const order = await apiRequest<BackendOrderDto>(`/api/orders/${encodeURIComponent(orderId)}`);
    return mapOrder(order);
  } catch (error) {
    const parsed = parseApiError(error);
    if (parsed.statusCode === 404) {
      return null;
    }

    throw parsed;
  }
};

export const getPaymentResultSnapshot = async (
  orderId: string,
): Promise<PaymentResultSnapshot | null> => {
  try {
    const snapshot = await apiRequest<BackendPaymentResultDto>(
      `/api/orders/${encodeURIComponent(orderId)}/payment-result`,
    );

    return mapPaymentResultSnapshot(snapshot);
  } catch (error) {
    const parsed = parseApiError(error);
    if (parsed.statusCode === 404) {
      return null;
    }

    throw parsed;
  }
};

export const listOrdersByUser = async (_userId: string): Promise<Order[]> => {
  try {
    const orders = await apiRequest<BackendOrderDto[]>('/api/orders');

    return orders
      .map(mapOrder)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
  } catch (error) {
    throw parseApiError(error);
  }
};

export const hasPurchasedLesson = async (
  _userId: string,
  lessonId: string,
): Promise<boolean> => {
  try {
    const entitlement = await apiRequest<BackendLessonEntitlementDto>(
      `/api/orders/entitlements/${encodeURIComponent(lessonId)}`,
    );

    return Boolean(entitlement.hasAccess);
  } catch (error) {
    if (isFallbackEligibleError(error)) {
      return false;
    }

    throw parseApiError(error);
  }
};

export const listPurchasedLessonIds = async (_userId: string): Promise<string[]> => {
  try {
    const orders = await apiRequest<BackendOrderDto[]>('/api/orders');

    return Array.from(
      new Set(
        orders
          .map(mapOrder)
          .filter((order) => order.status === 'paid')
          .map((order) => order.lessonId),
      ),
    );
  } catch (error) {
    if (isFallbackEligibleError(error)) {
      return [];
    }

    throw parseApiError(error);
  }
};

export const cancelOrder = async (
  orderId: string,
  _userId: string,
): Promise<Order> => {
  try {
    const order = await apiRequest<BackendOrderDto>(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
    });

    return mapOrder(order);
  } catch (error) {
    throw parseApiError(error);
  }
};
