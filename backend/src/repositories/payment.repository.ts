import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../config/prisma";

export type DbClient = Prisma.TransactionClient | PrismaClient;

export const paymentInclude = {
  order: {
    select: {
      id: true,
      buyerId: true,
      lessonId: true,
      amount: true,
      status: true,
    },
  },
} satisfies Prisma.PaymentInclude;

export type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

export const findPaymentByOrderId = async (
  orderId: number,
  db: DbClient = prisma
): Promise<PaymentWithOrder | null> => {
  return db.payment.findUnique({
    where: { orderId },
    include: paymentInclude,
  });
};

export const createPayment = async (
  data: Prisma.PaymentUncheckedCreateInput,
  db: DbClient = prisma
): Promise<PaymentWithOrder> => {
  return db.payment.create({
    data,
    include: paymentInclude,
  });
};

export const updatePaymentById = async (
  paymentId: number,
  data: Prisma.PaymentUncheckedUpdateInput,
  db: DbClient = prisma
): Promise<PaymentWithOrder> => {
  return db.payment.update({
    where: { id: paymentId },
    data,
    include: paymentInclude,
  });
};
