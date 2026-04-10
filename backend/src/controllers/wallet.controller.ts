import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as walletService from "../services/wallet.service";
import { handleControllerError } from "../utils/controller-error";
import {
  createWithdrawalSchema,
  listWalletTransactionsQuerySchema,
  payoutAccountIdParamSchema,
  transactionIdParamSchema,
  upsertPayoutAccountSchema,
  verifyPayoutAccountSchema,
} from "../validators/wallet.validator";

const getUserId = (req: Request): number => {
  return (req as AuthRequest).user.userId;
};

export const getMyWalletOverview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const wallet = await walletService.getWalletOverview(getUserId(req));

    res.status(200).json({
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

    res.status(200).json({
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

    res.status(200).json({
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

    res.status(200).json({
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

    res.status(200).json({
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

    res.status(200).json({
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

    res.status(200).json({
      message: "Default payout account updated successfully",
      data: account,
    });
  } catch (error) {
    handleControllerError(res, error);
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

    res.status(201).json({
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

    res.status(200).json({
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

    res.status(200).json({
      message: "Withdrawal retried successfully",
      data: transaction,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
