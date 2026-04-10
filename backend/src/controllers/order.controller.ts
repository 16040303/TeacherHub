import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as orderService from "../services/order.service";
import { handleControllerError } from "../utils/controller-error";
import {
  createOrderSchema,
  entitlementLessonParamSchema,
  orderIdParamSchema,
  processOrderPaymentSchema,
} from "../validators/order.validator";

const getUserId = (req: Request): number => {
  return (req as AuthRequest).user.userId;
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = createOrderSchema.parse(req.body);
    const order = await orderService.createOrder(getUserId(req), payload);

    res.status(201).json({
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await orderService.listMyOrders(getUserId(req));

    res.status(200).json({
      message: "Orders retrieved successfully",
      data: orders,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getMyOrderDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = orderIdParamSchema.parse(req.params);
    const order = await orderService.getMyOrderDetail(getUserId(req), id);

    res.status(200).json({
      message: "Order retrieved successfully",
      data: order,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const cancelMyOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = orderIdParamSchema.parse(req.params);
    const order = await orderService.cancelMyOrder(getUserId(req), id);

    res.status(200).json({
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const processOrderPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = orderIdParamSchema.parse(req.params);
    const payload = processOrderPaymentSchema.parse(req.body);
    const order = await orderService.upsertOrderPayment(getUserId(req), id, payload);

    res.status(200).json({
      message: "Order payment updated successfully",
      data: order,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getPaymentResult = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = orderIdParamSchema.parse(req.params);
    const snapshot = await orderService.getPaymentResult(getUserId(req), id);

    res.status(200).json({
      message: "Payment result retrieved successfully",
      data: snapshot,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getLessonEntitlement = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { lessonId } = entitlementLessonParamSchema.parse(req.params);
    const entitlement = await orderService.getLessonEntitlement(
      getUserId(req),
      lessonId
    );

    res.status(200).json({
      message: "Lesson entitlement retrieved successfully",
      data: entitlement,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
