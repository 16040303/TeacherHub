import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as walletService from "../services/wallet.service";
import { handleControllerError } from "../utils/controller-error";
import { sendSuccess } from "../utils/response";
import {
  createTopupSchema,
  createWithdrawalSchema,
  listWalletTransactionsQuerySchema,
  payoutAccountIdParamSchema,
  topupStatusParamSchema,
  transactionIdParamSchema,
  upsertPayoutAccountSchema,
  verifyPayoutAccountSchema,
  vnpayIpnQuerySchema,
} from "../validators/wallet.validator";

const getUserId = (req: Request): number => {
  return (req as AuthRequest).user.userId;
};

const VNPAY_IPN_INVALID_REQUEST_RESPONSE = {
  RspCode: "99",
  Message: "Invalid request",
};

export const getMyWalletOverview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const wallet = await walletService.getWalletOverview(getUserId(req));

    sendSuccess(res, {
      message: "Wallet retrieved successfully",
      data: wallet,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listMyWalletTransactions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = listWalletTransactionsQuerySchema.parse(req.query);
    const result = await walletService.listWalletTransactions(getUserId(req), query);

    sendSuccess(res, {
      message: "Wallet transactions retrieved successfully",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listMyLinkedPayoutAccounts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const accounts = await walletService.listLinkedPayoutAccounts(getUserId(req));

    sendSuccess(res, {
      message: "Linked payout accounts retrieved successfully",
      data: accounts,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const verifyPayoutAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const payload = verifyPayoutAccountSchema.parse(req.body);
    const result = await walletService.verifyPayoutAccount(payload);

    sendSuccess(res, {
      message: "Payout account verification completed",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const upsertMyLinkedPayoutAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const payload = upsertPayoutAccountSchema.parse(req.body);
    const account = await walletService.upsertLinkedPayoutAccount(getUserId(req), payload);

    sendSuccess(res, {
      message: "Linked payout account saved successfully",
      data: account,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const deleteMyLinkedPayoutAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = payoutAccountIdParamSchema.parse(req.params);
    await walletService.deleteLinkedPayoutAccount(getUserId(req), id);

    sendSuccess(res, {
      message: "Linked payout account deleted successfully",
      data: null,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const setMyDefaultLinkedPayoutAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = payoutAccountIdParamSchema.parse(req.params);
    const account = await walletService.setDefaultLinkedPayoutAccount(getUserId(req), id);

    sendSuccess(res, {
      message: "Default payout account updated successfully",
      data: account,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const createMyTopup = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = createTopupSchema.parse(req.body);
    const forwardedFor = req.headers["x-forwarded-for"];
    const clientIp =
      typeof forwardedFor === "string"
        ? forwardedFor
        : Array.isArray(forwardedFor)
          ? forwardedFor[0]
          : req.socket.remoteAddress;

    const snapshot = await walletService.createTopup(getUserId(req), payload, {
      clientIp,
      userAgent: req.get("user-agent") ?? undefined,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Top-up session initialized successfully",
      data: snapshot,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getMyTopupStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = topupStatusParamSchema.parse(req.params);
    const snapshot = await walletService.getTopupStatus(getUserId(req), id);

    sendSuccess(res, {
      message: "Top-up status retrieved successfully",
      data: snapshot,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const handleVnpayIpnCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = vnpayIpnQuerySchema.parse(req.query);
    const response = await walletService.handleVnpayIpn(query);

    res.status(200).json(response);
  } catch {
    res.status(200).json(VNPAY_IPN_INVALID_REQUEST_RESPONSE);
  }
};

export const createMyWithdrawalRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const payload = createWithdrawalSchema.parse(req.body);
    const transaction = await walletService.createWithdrawalRequest(
      getUserId(req),
      payload
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Withdrawal request created successfully",
      data: transaction,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const cancelMyPendingWithdrawal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = transactionIdParamSchema.parse(req.params);
    const transaction = await walletService.cancelPendingWithdrawal(getUserId(req), id);

    sendSuccess(res, {
      message: "Withdrawal cancelled successfully",
      data: transaction,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const retryMyFailedWithdrawal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = transactionIdParamSchema.parse(req.params);
    const transaction = await walletService.retryFailedWithdrawal(getUserId(req), id);

    sendSuccess(res, {
      message: "Withdrawal retried successfully",
      data: transaction,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
