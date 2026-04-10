import { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import prisma from "../config/prisma";

export type DbClient = Prisma.TransactionClient | PrismaClient;

const lessonForOrderSelect = {
  id: true,
  title: true,
  authorId: true,
  price: true,
  isPublished: true,
  status: true,
} satisfies Prisma.LessonSelect;

export const orderInclude = {
  lesson: {
    select: {
      id: true,
      title: true,
      authorId: true,
      price: true,
      isPublished: true,
      status: true,
      thumbnailUrl: true,
    },
  },
  payment: true,
} satisfies Prisma.OrderInclude;

export type LessonForOrder = Prisma.LessonGetPayload<{
  select: typeof lessonForOrderSelect;
}>;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export const findLessonForOrder = async (
  lessonId: number,
  db: DbClient = prisma
): Promise<LessonForOrder | null> => {
  return db.lesson.findUnique({
    where: { id: lessonId },
    select: lessonForOrderSelect,
  });
};

export const findOrderByBuyerAndLesson = async (
  buyerId: number,
  lessonId: number,
  db: DbClient = prisma
): Promise<OrderWithRelations | null> => {
  return db.order.findUnique({
    where: {
      buyerId_lessonId: {
        buyerId,
        lessonId,
      },
    },
    include: orderInclude,
  });
};

export const findOrderByIdForBuyer = async (
  orderId: number,
  buyerId: number,
  db: DbClient = prisma
): Promise<OrderWithRelations | null> => {
  return db.order.findFirst({
    where: {
      id: orderId,
      buyerId,
    },
    include: orderInclude,
  });
};

export const listOrdersByBuyer = async (
  buyerId: number,
  db: DbClient = prisma
): Promise<OrderWithRelations[]> => {
  return db.order.findMany({
    where: { buyerId },
    include: orderInclude,
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const createOrder = async (
  data: Prisma.OrderUncheckedCreateInput,
  db: DbClient = prisma
): Promise<OrderWithRelations> => {
  return db.order.create({
    data,
    include: orderInclude,
  });
};

export const updateOrderById = async (
  orderId: number,
  data: Prisma.OrderUncheckedUpdateInput,
  db: DbClient = prisma
): Promise<OrderWithRelations> => {
  return db.order.update({
    where: { id: orderId },
    data,
    include: orderInclude,
  });
};

export const findPaidOrderForEntitlement = async (
  buyerId: number,
  lessonId: number,
  db: DbClient = prisma
): Promise<OrderWithRelations | null> => {
  return db.order.findFirst({
    where: {
      buyerId,
      lessonId,
      status: OrderStatus.PAID,
    },
    include: orderInclude,
  });
};
