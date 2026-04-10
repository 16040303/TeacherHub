import { Router } from "express";
import {
  cancelMyOrder,
  createOrder,
  getLessonEntitlement,
  getMyOrderDetail,
  getPaymentResult,
  listMyOrders,
  processOrderPayment,
} from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";

const orderRouter = Router();

orderRouter.use(authenticate);

orderRouter.post("/", createOrder);
orderRouter.get("/", listMyOrders);
orderRouter.get("/entitlements/:lessonId", getLessonEntitlement);
orderRouter.get("/:id", getMyOrderDetail);
orderRouter.post("/:id/cancel", cancelMyOrder);
orderRouter.post("/:id/payment", processOrderPayment);
orderRouter.get("/:id/payment-result", getPaymentResult);

export default orderRouter;
