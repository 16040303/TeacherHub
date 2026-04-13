import { Router } from "express";
import {
  cancelMyPendingWithdrawal,
  createMyTopup,
  createMyWithdrawalRequest,
  deleteMyLinkedPayoutAccount,
  getMyTopupStatus,
  getMyWalletOverview,
  handleVnpayIpnCallback,
  listMyLinkedPayoutAccounts,
  listMyWalletTransactions,
  retryMyFailedWithdrawal,
  setMyDefaultLinkedPayoutAccount,
  upsertMyLinkedPayoutAccount,
  verifyPayoutAccount,
} from "../controllers/wallet.controller";
import { authenticate } from "../middlewares/auth.middleware";

const walletRouter = Router();

walletRouter.get("/topups/vnpay/ipn", handleVnpayIpnCallback);

walletRouter.use(authenticate);

walletRouter.get("/", getMyWalletOverview);
walletRouter.get("/transactions", listMyWalletTransactions);
walletRouter.post("/topups", createMyTopup);
walletRouter.get("/topups/:id", getMyTopupStatus);
walletRouter.post("/withdrawals", createMyWithdrawalRequest);
walletRouter.post("/withdrawals/:id/cancel", cancelMyPendingWithdrawal);
walletRouter.post("/withdrawals/:id/retry", retryMyFailedWithdrawal);

walletRouter.get("/payout-accounts", listMyLinkedPayoutAccounts);
walletRouter.post("/payout-accounts", upsertMyLinkedPayoutAccount);
walletRouter.delete("/payout-accounts/:id", deleteMyLinkedPayoutAccount);
walletRouter.post("/payout-accounts/:id/default", setMyDefaultLinkedPayoutAccount);
walletRouter.post("/payout-accounts/verify", verifyPayoutAccount);

export default walletRouter;
