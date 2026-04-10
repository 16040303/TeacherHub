import { Request, Response } from "express";
import { handleControllerError } from "../utils/controller-error";
import { loginSchema, registerSchema } from "../validators/auth.validator";
import * as authService from "../services/auth.service";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await authService.register(payload);

    res.status(201).json({
      message: "Register successful",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await authService.login(payload);

    res.status(200).json({
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
