import {
  cancelOrder,
  createPendingOrder,
  getCheckoutContext,
  getOrderById,
  getPaymentResultSnapshot,
  hasPurchasedLesson,
  listOrdersByUser,
  listPurchasedLessonIds,
  processOrderPayment,
} from '../repositories/ordersRepository';

export const ordersService = {
  getCheckoutContext,
  createPendingOrder,
  processOrderPayment,
  cancelOrder,
  getOrderById,
  getPaymentResultSnapshot,
  listOrdersByUser,
  hasPurchasedLesson,
  listPurchasedLessonIds,
};
