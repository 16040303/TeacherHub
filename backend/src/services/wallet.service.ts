import {
  PayoutTargetType,
  PayoutVerificationStatus,
  Prisma,
  WalletTransactionStatus,
} from "@prisma/client";
import { createHmac } from "crypto";
import { env } from "../config/env";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import {
  CreateTopupInput,
  CreateWithdrawalInput,
  ListWalletTransactionsQueryInput,
  UpsertPayoutAccountInput,
  VerifyPayoutAccountInput,
  VnpayIpnQueryInput,
} from "../validators/wallet.validator";

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface WalletOverview {
  userId: number;
  balance: number;
  pendingWithdrawalAmount: number;
  totalInflow: number;
  totalOutflow: number;
  currency: string;
  updatedAt: Date;
}

type WalletTransactionType =
  | "sale"
  | "withdrawal"
  | "purchase"
  | "bonus"
  | "topup"
  | "refund";

type WalletTransactionStatusView = "completed" | "pending" | "failed" | "cancelled";

interface WalletTransactionView {
  id: number;
  userId: number;
  date: Date;
  description: string;
  type: WalletTransactionType;
  amount: number;
  status: WalletTransactionStatusView;
  contextTitle?: string;
  contextId?: string;
  contextType?: "lesson" | "order" | "wallet" | "system";
  target?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

type WithdrawPayoutTargetType = "bank" | "momo" | "paypal";

interface LinkedPayoutAccountView {
  id: number;
  userId: number;
  targetType: WithdrawPayoutTargetType;
  providerName: string;
  accountIdentifier: string;
  accountOwnerName: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PayoutAccountVerificationResult {
  status: "success" | "error";
  ownerName?: string;
  message: string;
  verifiedAt: Date;
}

type TopupPaymentMethod = "vnpay";
type TopupPaymentStatus = "success" | "failed" | "pending";

interface TopupPaymentSnapshotView {
  transactionId: number;
  status: TopupPaymentStatus;
  message: string;
  amountVnd: number;
  coins: number;
  paymentMethod: TopupPaymentMethod;
  paymentRef: string;
  paymentUrl?: string;
  qrPayload?: string;
  expiresAt?: Date;
  pollIntervalMs?: number;
  transaction: WalletTransactionView;
}

interface VnpayIpnResponse {
  RspCode: string;
  Message: string;
}

const TOPUP_MIN_VND = 10_000;
const TOPUP_MAX_VND = 20_000_000;
const TOPUP_COIN_DIVISOR = 100;
const VNPAY_STATUS_POLL_INTERVAL_MS = 5_000;
const VNPAY_EXPIRE_MINUTES = 15;
const VNPAY_VERSION = "2.1.0";
const VNPAY_COMMAND = "pay";
const VNPAY_CURRENCY = "VND";
const VNPAY_LOCALE = "vn";
const VNPAY_ORDER_TYPE = "other";
const VNPAY_SUCCESS_CODE = "00";
const VNPAY_CANCELLED_CODE = "24";
const TOPUP_METHOD_NOT_SUPPORTED_MESSAGE =
  "Only VNPAY top-up is currently supported in this phase.";
const TOPUP_PENDING_MESSAGE =
  "Payment session initialized. Complete payment in VNPAY to finish wallet top-up.";
const TOPUP_SUCCESS_MESSAGE =
  "Payment completed. Coins have been added to your wallet balance.";
const TOPUP_FAILED_MESSAGE =
  "Payment failed. Please retry with another VNPAY attempt.";
const TOPUP_CANCELLED_MESSAGE =
  "Payment was cancelled before completion.";
const VNPAY_IPN_RESPONSE_SUCCESS_CODE = "00";
const VNPAY_IPN_RESPONSE_ORDER_NOT_FOUND_CODE = "01";
const VNPAY_IPN_RESPONSE_ALREADY_CONFIRMED_CODE = "02";
const VNPAY_IPN_RESPONSE_INVALID_AMOUNT_CODE = "04";
const VNPAY_IPN_RESPONSE_INVALID_CHECKSUM_CODE = "97";

const DEFAULT_PROVIDER_BY_TARGET: Record<WithdrawPayoutTargetType, string> = {
  bank: "Vietcombank",
  momo: "MoMo Wallet",
  paypal: "PayPal",
};

const BANK_ACCOUNT_REGEX = /^\d{8,20}$/;
const MOMO_PHONE_REGEX = /^\d{9,12}$/;
const MOMO_WALLET_ID_REGEX = /^[a-zA-Z0-9._-]{6,32}$/;
const PAYPAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toTopupCoins = (amountVnd: number): number => {
  return Math.floor(amountVnd / TOPUP_COIN_DIVISOR);
};

const resolveTopupAmountVnd = (
  metadata: Record<string, unknown>,
  transactionAmountCoins: number
): number => {
  const rawMetadataAmount = metadata.amountVnd;

  if (typeof rawMetadataAmount === "number" && Number.isFinite(rawMetadataAmount)) {
    return Math.max(0, Math.floor(rawMetadataAmount));
  }

  return Math.max(0, Math.floor(transactionAmountCoins * TOPUP_COIN_DIVISOR));
};

const toTopupStatus = (status: WalletTransactionStatus): TopupPaymentStatus => {
  switch (status) {
    case WalletTransactionStatus.COMPLETED:
      return "success";
    case WalletTransactionStatus.PENDING:
      return "pending";
    case WalletTransactionStatus.FAILED:
    case WalletTransactionStatus.CANCELLED:
    default:
      return "failed";
  }
};

const toJsonObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const toStringRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const mergeRecord = (
  current: unknown,
  patch: Record<string, unknown>
): Prisma.InputJsonObject => {
  return {
    ...toStringRecord(current),
    ...patch,
  } as Prisma.InputJsonObject;
};

const padVnpDatePart = (value: number): string => value.toString().padStart(2, "0");

const toVnpDate = (value: Date): string => {
  const utcTime = value.getTime() + value.getTimezoneOffset() * 60_000;
  const vietnamTime = new Date(utcTime + 7 * 60 * 60 * 1_000);

  return [
    vietnamTime.getFullYear(),
    padVnpDatePart(vietnamTime.getMonth() + 1),
    padVnpDatePart(vietnamTime.getDate()),
    padVnpDatePart(vietnamTime.getHours()),
    padVnpDatePart(vietnamTime.getMinutes()),
    padVnpDatePart(vietnamTime.getSeconds()),
  ].join("");
};

const encodeVnpValue = (value: string): string =>
  encodeURIComponent(value).replace(/%20/g, "+");

const toVnpaySignData = (params: Record<string, string>): string => {
  const sortedKeys = Object.keys(params).sort((left, right) => left.localeCompare(right));

  return sortedKeys
    .map((key) => `${key}=${encodeVnpValue(params[key])}`)
    .join("&");
};

const signVnpayParams = (params: Record<string, string>): string => {
  const signData = toVnpaySignData(params);

  return createHmac("sha512", env.VNPAY_HASH_SECRET)
    .update(signData, "utf8")
    .digest("hex");
};

const appendQueryToUrl = (baseUrl: string, query: string): string => {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${query}`;
};

const normalizeClientIp = (value?: string): string => {
  const normalized = (value || "").trim();

  if (!normalized) {
    return "127.0.0.1";
  }

  if (normalized.includes(",")) {
    return normalizeClientIp(normalized.split(",")[0]);
  }

  if (normalized === "::1") {
    return "127.0.0.1";
  }

  if (normalized.startsWith("::ffff:")) {
    return normalized.slice(7);
  }

  return normalized;
};

const ensureTopupAmount = (amountVnd: number): number => {
  const normalized = Math.floor(Number(amountVnd));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new HttpError(400, "Top-up amount must be greater than zero");
  }

  if (normalized < TOPUP_MIN_VND) {
    throw new HttpError(400, `Top-up amount must be at least ${TOPUP_MIN_VND} VND`);
  }

  if (normalized > TOPUP_MAX_VND) {
    throw new HttpError(400, `Top-up amount cannot exceed ${TOPUP_MAX_VND} VND`);
  }

  if (toTopupCoins(normalized) <= 0) {
    throw new HttpError(400, "Top-up amount is too low to convert into coins");
  }

  return normalized;
};

const toTopupLifecycleMessage = (
  transactionStatus: WalletTransactionStatus,
  metadata: Record<string, unknown>
): string => {
  if (typeof metadata.latestMessage === "string" && metadata.latestMessage.trim()) {
    return metadata.latestMessage.trim();
  }

  if (transactionStatus === WalletTransactionStatus.COMPLETED) {
    return TOPUP_SUCCESS_MESSAGE;
  }

  if (transactionStatus === WalletTransactionStatus.PENDING) {
    return TOPUP_PENDING_MESSAGE;
  }

  if (transactionStatus === WalletTransactionStatus.CANCELLED) {
    return TOPUP_CANCELLED_MESSAGE;
  }

  return TOPUP_FAILED_MESSAGE;
};

const mapTopupSnapshot = (
  transaction: {
    id: number;
    walletId: number;
    amount: Prisma.Decimal;
    type: string;
    status: WalletTransactionStatus;
    note: string | null;
    reference: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  },
  walletUserId: number
): TopupPaymentSnapshotView => {
  const metadata = toJsonObject(transaction.metadata);
  const amountCoins = Number(transaction.amount);
  const amountVnd = resolveTopupAmountVnd(metadata, amountCoins);
  const paymentRef =
    transaction.reference ||
    (typeof metadata.paymentRef === "string" && metadata.paymentRef.trim()
      ? metadata.paymentRef.trim()
      : `TOPUP-${transaction.id}`);
  const paymentUrl =
    typeof metadata.paymentUrl === "string" && metadata.paymentUrl.trim()
      ? metadata.paymentUrl.trim()
      : undefined;
  const qrPayload =
    typeof metadata.qrPayload === "string" && metadata.qrPayload.trim()
      ? metadata.qrPayload.trim()
      : paymentUrl;
  const expiresAtRaw =
    typeof metadata.expiresAt === "string" && metadata.expiresAt.trim()
      ? new Date(metadata.expiresAt)
      : undefined;
  const expiresAt =
    expiresAtRaw && !Number.isNaN(expiresAtRaw.getTime()) ? expiresAtRaw : undefined;
  const pollIntervalMs =
    typeof metadata.pollIntervalMs === "number" && Number.isFinite(metadata.pollIntervalMs)
      ? Math.max(1_000, Math.floor(metadata.pollIntervalMs))
      : undefined;

  return {
    transactionId: transaction.id,
    status: toTopupStatus(transaction.status),
    message: toTopupLifecycleMessage(transaction.status, metadata),
    amountVnd,
    coins: amountCoins,
    paymentMethod: "vnpay",
    paymentRef,
    paymentUrl,
    qrPayload,
    expiresAt,
    pollIntervalMs,
    transaction: mapTransaction(transaction, walletUserId),
  };
};

const toVnpaySignableParams = (query: Record<string, unknown>): Record<string, string> => {
  const params: Record<string, string> = {};

  Object.entries(query).forEach(([key, value]) => {
    if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") {
      return;
    }

    if (typeof value !== "string") {
      return;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    params[key] = trimmedValue;
  });

  return params;
};

const isVnpayIpnSignatureValid = (query: VnpayIpnQueryInput): boolean => {
  const params = toVnpaySignableParams(query as unknown as Record<string, unknown>);
  const expectedSignature = signVnpayParams(params);

  return expectedSignature.toLowerCase() === query.vnp_SecureHash.toLowerCase();
};

const isVnpayTopupSuccess = (
  responseCode: string,
  transactionStatus?: string
): boolean => {
  return (
    responseCode === VNPAY_SUCCESS_CODE &&
    (!transactionStatus || transactionStatus === VNPAY_SUCCESS_CODE)
  );
};

const toVnpayFailureStatus = (responseCode: string): WalletTransactionStatus => {
  if (responseCode === VNPAY_CANCELLED_CODE) {
    return WalletTransactionStatus.CANCELLED;
  }

  return WalletTransactionStatus.FAILED;
};

const toVnpayFailureMessage = (responseCode: string): string => {
  if (responseCode === VNPAY_CANCELLED_CODE) {
    return TOPUP_CANCELLED_MESSAGE;
  }

  return TOPUP_FAILED_MESSAGE;
};

const toTopupReference = (userId: number): string => {
  const random = Math.floor(100_000 + Math.random() * 900_000);
  return `TOPUP-${userId}-${Date.now()}-${random}`;
};

const parseContextType = (
  value: unknown
): "lesson" | "order" | "wallet" | "system" | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "lesson" ||
    normalized === "order" ||
    normalized === "wallet" ||
    normalized === "system"
  ) {
    return normalized;
  }

  return undefined;
};

const toTargetType = (targetType: WithdrawPayoutTargetType): PayoutTargetType => {
  switch (targetType) {
    case "bank":
      return PayoutTargetType.BANK;
    case "momo":
      return PayoutTargetType.MOMO;
    case "paypal":
      return PayoutTargetType.PAYPAL;
    default:
      return PayoutTargetType.BANK;
  }
};

const fromTargetType = (targetType: PayoutTargetType): WithdrawPayoutTargetType => {
  switch (targetType) {
    case PayoutTargetType.MOMO:
      return "momo";
    case PayoutTargetType.PAYPAL:
      return "paypal";
    case PayoutTargetType.BANK:
    default:
      return "bank";
  }
};

const toVerificationStatus = (
  status?: "success" | "error" | "pending"
): PayoutVerificationStatus => {
  switch (status) {
    case "success":
      return PayoutVerificationStatus.SUCCESS;
    case "error":
      return PayoutVerificationStatus.ERROR;
    case "pending":
    default:
      return PayoutVerificationStatus.PENDING;
  }
};

const toTransactionStatus = (
  status: WalletTransactionStatus
): WalletTransactionStatusView => {
  switch (status) {
    case WalletTransactionStatus.PENDING:
      return "pending";
    case WalletTransactionStatus.FAILED:
      return "failed";
    case WalletTransactionStatus.CANCELLED:
      return "cancelled";
    case WalletTransactionStatus.COMPLETED:
    default:
      return "completed";
  }
};

const toPrismaTransactionStatus = (
  status: WalletTransactionStatusView
): WalletTransactionStatus => {
  switch (status) {
    case "pending":
      return WalletTransactionStatus.PENDING;
    case "failed":
      return WalletTransactionStatus.FAILED;
    case "cancelled":
      return WalletTransactionStatus.CANCELLED;
    case "completed":
    default:
      return WalletTransactionStatus.COMPLETED;
  }
};

const toTransactionType = (type: string): WalletTransactionType => {
  const normalized = type.trim().toLowerCase();

  if (
    normalized === "sale" ||
    normalized === "withdrawal" ||
    normalized === "purchase" ||
    normalized === "bonus" ||
    normalized === "topup" ||
    normalized === "refund"
  ) {
    return normalized;
  }

  return "bonus";
};

const getPayoutIdentifierValidationError = (
  targetType: WithdrawPayoutTargetType,
  accountIdentifier: string
): string | null => {
  if (!accountIdentifier) {
    return "Account identifier is required";
  }

  if (targetType === "bank" && !BANK_ACCOUNT_REGEX.test(accountIdentifier)) {
    return "Bank account: 8-20 digits required";
  }

  if (
    targetType === "momo" &&
    !MOMO_PHONE_REGEX.test(accountIdentifier) &&
    !MOMO_WALLET_ID_REGEX.test(accountIdentifier)
  ) {
    return "Enter a valid MoMo phone number or wallet ID";
  }

  if (targetType === "paypal" && !PAYPAL_EMAIL_REGEX.test(accountIdentifier)) {
    return "Enter a valid PayPal email address";
  }

  return null;
};

const deriveOwnerName = (
  targetType: WithdrawPayoutTargetType,
  accountIdentifier: string
): string => {
  if (targetType === "bank") {
    return `Bank Holder ${accountIdentifier.slice(-4)}`;
  }

  if (targetType === "momo") {
    return `MoMo User ${accountIdentifier.slice(-4)}`;
  }

  if (accountIdentifier.includes("@")) {
    return accountIdentifier.split("@")[0] || "PayPal Owner";
  }

  return "Payout Account Owner";
};

const ensureWallet = async (
  userId: number,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) => {
  const existing = await tx.wallet.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return tx.wallet.create({
    data: {
      userId,
      balance: 0,
      currency: "VND",
    },
  });
};

const mapTransaction = (
  transaction: {
    id: number;
    walletId: number;
    amount: Prisma.Decimal;
    type: string;
    status: WalletTransactionStatus;
    note: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  },
  walletUserId: number
): WalletTransactionView => {
  const meta =
    transaction.metadata && typeof transaction.metadata === "object"
      ? (transaction.metadata as Record<string, unknown>)
      : undefined;

  return {
    id: transaction.id,
    userId: walletUserId,
    date: transaction.createdAt,
    description: `Wallet ${toTransactionType(transaction.type)}`,
    type: toTransactionType(transaction.type),
    amount: Number(transaction.amount),
    status: toTransactionStatus(transaction.status),
    contextTitle: typeof meta?.contextTitle === "string" ? meta.contextTitle : undefined,
    contextId: typeof meta?.contextId === "string" ? meta.contextId : undefined,
    contextType: parseContextType(meta?.contextType),
    target: typeof meta?.target === "string" ? meta.target : undefined,
    note:
      typeof meta?.note === "string"
        ? meta.note
        : transaction.note ?? undefined,
    metadata: meta,
  };
};

const ensureTransactionOwnership = async (
  transactionId: number,
  userId: number,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) => {
  const wallet = await ensureWallet(userId, tx);

  const transaction = await tx.walletTransaction.findFirst({
    where: {
      id: transactionId,
      walletId: wallet.id,
    },
  });

  if (!transaction) {
    throw new HttpError(404, "Transaction not found");
  }

  return {
    wallet,
    transaction,
  };
};

export const createTopup = async (
  userId: number,
  payload: CreateTopupInput,
  context: { clientIp?: string; userAgent?: string } = {}
): Promise<TopupPaymentSnapshotView> => {
  const paymentMethod = payload.paymentMethod.trim().toLowerCase();

  if (paymentMethod !== "vnpay") {
    throw new HttpError(400, TOPUP_METHOD_NOT_SUPPORTED_MESSAGE);
  }

  const amountVnd = ensureTopupAmount(payload.amountVnd);
  const coins = toTopupCoins(amountVnd);
  const paymentRef = toTopupReference(userId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VNPAY_EXPIRE_MINUTES * 60_000);
  const clientIp = normalizeClientIp(context.clientIp);
  const orderInfo = `TeacherHub top-up ${paymentRef}`;

  const vnpayParams: Record<string, string> = {
    vnp_Version: VNPAY_VERSION,
    vnp_Command: VNPAY_COMMAND,
    vnp_TmnCode: env.VNPAY_TMN_CODE,
    vnp_Amount: String(amountVnd * 100),
    vnp_CreateDate: toVnpDate(now),
    vnp_CurrCode: VNPAY_CURRENCY,
    vnp_IpAddr: clientIp,
    vnp_Locale: VNPAY_LOCALE,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: VNPAY_ORDER_TYPE,
    vnp_ReturnUrl: env.VNPAY_RETURN_URL,
    vnp_TxnRef: paymentRef,
    vnp_ExpireDate: toVnpDate(expiresAt),
  };

  const secureHash = signVnpayParams(vnpayParams);
  const paymentQuery = toVnpaySignData({
    ...vnpayParams,
    vnp_SecureHash: secureHash,
  });
  const paymentUrl = appendQueryToUrl(env.VNPAY_URL, paymentQuery);
  const note = payload.note?.trim();

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(userId, tx);

    const metadata: Prisma.InputJsonObject = {
      contextType: "wallet",
      contextTitle: `Top-up ${amountVnd.toLocaleString("vi-VN")}đ`,
      target: `VNPAY • ${paymentRef}`,
      amountVnd,
      coins,
      paymentMethod: "vnpay",
      paymentRef,
      paymentUrl,
      qrPayload: paymentUrl,
      expiresAt: expiresAt.toISOString(),
      pollIntervalMs: VNPAY_STATUS_POLL_INTERVAL_MS,
      latestMessage: TOPUP_PENDING_MESSAGE,
      vnpVersion: VNPAY_VERSION,
      vnpCommand: VNPAY_COMMAND,
      vnpTxnRef: paymentRef,
      vnpOrderInfo: orderInfo,
      vnpCreateDate: vnpayParams.vnp_CreateDate,
      vnpExpireDate: vnpayParams.vnp_ExpireDate,
      ipnUrl: env.VNPAY_IPN_URL,
      clientIp,
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
      ...(note ? { note } : {}),
    };

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        actorId: userId,
        amount: coins,
        type: "topup",
        status: WalletTransactionStatus.PENDING,
        note,
        reference: paymentRef,
        metadata,
      },
    });

    return mapTopupSnapshot(transaction, wallet.userId);
  });
};

export const getTopupStatus = async (
  userId: number,
  transactionId: number
): Promise<TopupPaymentSnapshotView> => {
  const { wallet, transaction } = await ensureTransactionOwnership(transactionId, userId);

  if (toTransactionType(transaction.type) !== "topup") {
    throw new HttpError(404, "Top-up transaction not found");
  }

  return mapTopupSnapshot(transaction, wallet.userId);
};

export const handleVnpayIpn = async (
  query: VnpayIpnQueryInput
): Promise<VnpayIpnResponse> => {
  if (!isVnpayIpnSignatureValid(query)) {
    return {
      RspCode: VNPAY_IPN_RESPONSE_INVALID_CHECKSUM_CODE,
      Message: "Invalid checksum",
    };
  }

  const paymentRef = query.vnp_TxnRef.trim();
  const topupTransaction = await prisma.walletTransaction.findFirst({
    where: {
      reference: paymentRef,
      type: "topup",
    },
  });

  if (!topupTransaction) {
    return {
      RspCode: VNPAY_IPN_RESPONSE_ORDER_NOT_FOUND_CODE,
      Message: "Order not found",
    };
  }

  const topupMetadata = toJsonObject(topupTransaction.metadata);
  const expectedVnpAmount =
    resolveTopupAmountVnd(topupMetadata, Number(topupTransaction.amount)) * 100;
  const callbackAmount = Number.parseInt(query.vnp_Amount, 10);

  if (!Number.isFinite(callbackAmount) || callbackAmount !== expectedVnpAmount) {
    return {
      RspCode: VNPAY_IPN_RESPONSE_INVALID_AMOUNT_CODE,
      Message: "Invalid amount",
    };
  }

  const callbackMetadataPatch: Record<string, unknown> = {
    vnpAmount: callbackAmount,
    vnpResponseCode: query.vnp_ResponseCode,
    vnpTransactionStatus: query.vnp_TransactionStatus,
    vnpTransactionNo: query.vnp_TransactionNo,
    vnpPayDate: query.vnp_PayDate,
    vnpBankCode: query.vnp_BankCode,
    vnpBankTranNo: query.vnp_BankTranNo,
    vnpOrderInfo: query.vnp_OrderInfo,
    lastIpnAt: new Date().toISOString(),
  };

  const isSuccess = isVnpayTopupSuccess(
    query.vnp_ResponseCode,
    query.vnp_TransactionStatus
  );

  const transitionCode = await prisma.$transaction(async (tx) => {
    const latest = await tx.walletTransaction.findUnique({
      where: {
        id: topupTransaction.id,
      },
    });

    if (!latest) {
      return VNPAY_IPN_RESPONSE_ORDER_NOT_FOUND_CODE;
    }

    if (latest.status !== WalletTransactionStatus.PENDING) {
      const latestMetadata = toJsonObject(latest.metadata);
      await tx.walletTransaction.update({
        where: {
          id: latest.id,
        },
        data: {
          metadata: mergeRecord(latestMetadata, {
            ...callbackMetadataPatch,
            latestMessage: toTopupLifecycleMessage(latest.status, latestMetadata),
          }),
        },
      });

      return VNPAY_IPN_RESPONSE_ALREADY_CONFIRMED_CODE;
    }

    const nextStatus = isSuccess
      ? WalletTransactionStatus.COMPLETED
      : toVnpayFailureStatus(query.vnp_ResponseCode);
    const nextMessage = isSuccess
      ? TOPUP_SUCCESS_MESSAGE
      : toVnpayFailureMessage(query.vnp_ResponseCode);

    await tx.walletTransaction.update({
      where: {
        id: latest.id,
      },
      data: {
        status: nextStatus,
        metadata: mergeRecord(latest.metadata, {
          ...callbackMetadataPatch,
          latestMessage: nextMessage,
        }),
      },
    });

    if (isSuccess) {
      await tx.wallet.update({
        where: {
          id: latest.walletId,
        },
        data: {
          balance: {
            increment: Number(latest.amount),
          },
        },
      });
    }

    return VNPAY_IPN_RESPONSE_SUCCESS_CODE;
  });

  if (transitionCode === VNPAY_IPN_RESPONSE_ORDER_NOT_FOUND_CODE) {
    return {
      RspCode: VNPAY_IPN_RESPONSE_ORDER_NOT_FOUND_CODE,
      Message: "Order not found",
    };
  }

  if (transitionCode === VNPAY_IPN_RESPONSE_ALREADY_CONFIRMED_CODE) {
    return {
      RspCode: VNPAY_IPN_RESPONSE_ALREADY_CONFIRMED_CODE,
      Message: "Order already confirmed",
    };
  }

  return {
    RspCode: VNPAY_IPN_RESPONSE_SUCCESS_CODE,
    Message: "Confirm Success",
  };
};

export const getWalletOverview = async (userId: number): Promise<WalletOverview> => {
  const wallet = await ensureWallet(userId);

  const [pendingWithdrawalsAggregate, inflowAggregate, outflowAggregate] =
    await prisma.$transaction([
      prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          type: "withdrawal",
          status: WalletTransactionStatus.PENDING,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          amount: {
            gt: 0,
          },
          status: WalletTransactionStatus.COMPLETED,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          amount: {
            lt: 0,
          },
          status: {
            in: [WalletTransactionStatus.COMPLETED, WalletTransactionStatus.PENDING],
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

  const pendingWithdrawalAmount = Math.abs(
    Number(pendingWithdrawalsAggregate._sum.amount ?? 0)
  );

  return {
    userId,
    balance: Number(wallet.balance),
    pendingWithdrawalAmount,
    totalInflow: Number(inflowAggregate._sum.amount ?? 0),
    totalOutflow: Math.abs(Number(outflowAggregate._sum.amount ?? 0)),
    currency: wallet.currency,
    updatedAt: wallet.updatedAt,
  };
};

export const listWalletTransactions = async (
  userId: number,
  query: ListWalletTransactionsQueryInput
): Promise<PaginatedResult<WalletTransactionView>> => {
  const wallet = await ensureWallet(userId);

  const where: Prisma.WalletTransactionWhereInput = {
    walletId: wallet.id,
  };

  if (query.type) {
    where.type = query.type;
  }

  if (query.status) {
    where.status = toPrismaTransactionStatus(query.status);
  }

  const [total, transactions] = await prisma.$transaction([
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    data: transactions.map((transaction) => mapTransaction(transaction, wallet.userId)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
};

export const listLinkedPayoutAccounts = async (
  userId: number
): Promise<LinkedPayoutAccountView[]> => {
  const accounts = await prisma.payoutAccount.findMany({
    where: { userId },
    orderBy: [{ targetType: "asc" }, { isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return accounts.map((account) => ({
    id: account.id,
    userId: account.userId,
    targetType: fromTargetType(account.targetType),
    providerName: account.providerName,
    accountIdentifier: account.accountIdentifier,
    accountOwnerName: account.accountOwnerName,
    isDefault: account.isDefault,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }));
};

export const verifyPayoutAccount = async (
  input: VerifyPayoutAccountInput
): Promise<PayoutAccountVerificationResult> => {
  const targetType = input.targetType;
  const providerName =
    input.providerName?.trim() || DEFAULT_PROVIDER_BY_TARGET[targetType];
  const accountIdentifier = input.accountIdentifier.trim();
  const verifiedAt = new Date();

  const identifierError = getPayoutIdentifierValidationError(
    targetType,
    accountIdentifier
  );

  if (identifierError || /fail|invalid|error/i.test(accountIdentifier)) {
    return {
      status: "error",
      message: "Unable to verify this account",
      verifiedAt,
    };
  }

  const linkedMatch = await prisma.payoutAccount.findFirst({
    where: {
      targetType: toTargetType(targetType),
      accountIdentifier,
      ...(targetType === "bank"
        ? {
            providerName,
          }
        : {}),
    },
    select: {
      accountOwnerName: true,
    },
  });

  return {
    status: "success",
    ownerName:
      linkedMatch?.accountOwnerName || deriveOwnerName(targetType, accountIdentifier),
    message: "Account verification completed successfully.",
    verifiedAt,
  };
};

export const upsertLinkedPayoutAccount = async (
  userId: number,
  payload: UpsertPayoutAccountInput
): Promise<LinkedPayoutAccountView> => {
  const targetType = payload.targetType;
  const providerName =
    payload.providerName?.trim() || DEFAULT_PROVIDER_BY_TARGET[targetType];
  const accountIdentifier = payload.accountIdentifier.trim();

  const identifierError = getPayoutIdentifierValidationError(
    targetType,
    accountIdentifier
  );

  if (identifierError) {
    throw new HttpError(400, identifierError);
  }

  const accountOwnerName =
    payload.accountOwnerName?.trim() || deriveOwnerName(targetType, accountIdentifier);

  return prisma.$transaction(async (tx) => {
    if (payload.setAsDefault) {
      await tx.payoutAccount.updateMany({
        where: {
          userId,
          targetType: toTargetType(targetType),
        },
        data: {
          isDefault: false,
        },
      });
    }

    const existing = await tx.payoutAccount.findUnique({
      where: {
        userId_targetType_accountIdentifier: {
          userId,
          targetType: toTargetType(targetType),
          accountIdentifier,
        },
      },
    });

    const account = existing
      ? await tx.payoutAccount.update({
          where: { id: existing.id },
          data: {
            providerName,
            accountOwnerName,
            isDefault: payload.setAsDefault ? true : existing.isDefault,
            isVerified: true,
            verificationStatus: PayoutVerificationStatus.SUCCESS,
            verificationMessage: "Verified by user flow",
            verifiedAt: new Date(),
          },
        })
      : await tx.payoutAccount.create({
          data: {
            userId,
            targetType: toTargetType(targetType),
            providerName,
            accountIdentifier,
            accountOwnerName,
            isDefault: payload.setAsDefault ?? false,
            isVerified: true,
            verificationStatus: PayoutVerificationStatus.SUCCESS,
            verificationMessage: "Verified by user flow",
            verifiedAt: new Date(),
          },
        });

    if (!payload.setAsDefault) {
      const sameTargetCount = await tx.payoutAccount.count({
        where: {
          userId,
          targetType: toTargetType(targetType),
        },
      });

      if (sameTargetCount === 1 && !account.isDefault) {
        await tx.payoutAccount.update({
          where: { id: account.id },
          data: {
            isDefault: true,
          },
        });

        account.isDefault = true;
      }
    }

    return {
      id: account.id,
      userId: account.userId,
      targetType: fromTargetType(account.targetType),
      providerName: account.providerName,
      accountIdentifier: account.accountIdentifier,
      accountOwnerName: account.accountOwnerName,
      isDefault: account.isDefault,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  });
};

export const deleteLinkedPayoutAccount = async (
  userId: number,
  accountId: number
): Promise<void> => {
  const account = await prisma.payoutAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
  });

  if (!account) {
    throw new HttpError(404, "Payout account not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.walletTransaction.updateMany({
      where: {
        payoutAccountId: account.id,
      },
      data: {
        payoutAccountId: null,
      },
    });

    await tx.payoutAccount.delete({
      where: {
        id: account.id,
      },
    });

    if (account.isDefault) {
      const nextDefault = await tx.payoutAccount.findFirst({
        where: {
          userId,
          targetType: account.targetType,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      if (nextDefault) {
        await tx.payoutAccount.update({
          where: { id: nextDefault.id },
          data: {
            isDefault: true,
          },
        });
      }
    }
  });
};

export const setDefaultLinkedPayoutAccount = async (
  userId: number,
  accountId: number
): Promise<LinkedPayoutAccountView> => {
  const account = await prisma.payoutAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
  });

  if (!account) {
    throw new HttpError(404, "Payout account not found");
  }

  return prisma.$transaction(async (tx) => {
    await tx.payoutAccount.updateMany({
      where: {
        userId,
        targetType: account.targetType,
      },
      data: {
        isDefault: false,
      },
    });

    const updated = await tx.payoutAccount.update({
      where: { id: account.id },
      data: {
        isDefault: true,
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      targetType: fromTargetType(updated.targetType),
      providerName: updated.providerName,
      accountIdentifier: updated.accountIdentifier,
      accountOwnerName: updated.accountOwnerName,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  });
};

export const createWithdrawalRequest = async (
  userId: number,
  payload: CreateWithdrawalInput
): Promise<WalletTransactionView> => {
  const amount = Math.floor(Number(payload.amount));

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Withdraw amount must be greater than zero");
  }

  const targetType = payload.payout.targetType;
  const providerName = payload.payout.providerName.trim();
  const accountIdentifier = payload.payout.accountIdentifier.trim();
  const verificationStatus = payload.payout.verificationStatus;
  const source = payload.payout.source;

  const identifierError = getPayoutIdentifierValidationError(
    targetType,
    accountIdentifier
  );

  if (identifierError) {
    throw new HttpError(400, identifierError);
  }

  const usingLinkedSource = source === "linked";

  if (!usingLinkedSource && verificationStatus === "pending") {
    throw new HttpError(400, "Verifying account...");
  }

  if (!usingLinkedSource && verificationStatus === "error") {
    throw new HttpError(400, "Unable to verify this account");
  }

  if (!usingLinkedSource && verificationStatus !== "success") {
    throw new HttpError(400, "Please verify payout account details before submitting.");
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(userId, tx);

    if (Number(wallet.balance) < amount) {
      throw new HttpError(400, "Insufficient balance");
    }

    let payoutAccountId: number | null = null;

    if (payload.payout.linkedAccountId) {
      const linkedAccount = await tx.payoutAccount.findFirst({
        where: {
          id: payload.payout.linkedAccountId,
          userId,
        },
      });

      if (!linkedAccount) {
        throw new HttpError(404, "Linked payout account not found");
      }

      payoutAccountId = linkedAccount.id;
    }

    const metadata: Prisma.InputJsonObject = {
      contextType: "wallet",
      contextTitle: `${targetType.toUpperCase()} payout • ${accountIdentifier}`,
      target: `${providerName} • ${accountIdentifier}`,
      providerName,
      accountIdentifier,
      targetType,
      ...(payload.note ? { note: payload.note } : {}),
      ...(source ? { source } : {}),
      ...(typeof payload.payout.linkedAccountId === "number"
        ? { linkedAccountId: payload.payout.linkedAccountId }
        : {}),
      ...(payload.payout.verifiedAccountOwnerName
        ? { verifiedAccountOwnerName: payload.payout.verifiedAccountOwnerName }
        : {}),
      ...(verificationStatus ? { verificationStatus } : {}),
    };

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        actorId: userId,
        payoutAccountId,
        amount: -Math.abs(amount),
        type: "withdrawal",
        status: WalletTransactionStatus.PENDING,
        note: payload.note,
        metadata,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          decrement: amount,
        },
      },
    });

    return mapTransaction(transaction, wallet.userId);
  });
};

export const cancelPendingWithdrawal = async (
  userId: number,
  transactionId: number
): Promise<WalletTransactionView> => {
  return prisma.$transaction(async (tx) => {
    const { wallet, transaction } = await ensureTransactionOwnership(
      transactionId,
      userId,
      tx
    );

    if (toTransactionType(transaction.type) !== "withdrawal") {
      throw new HttpError(400, "Transaction not found or cannot be cancelled");
    }

    if (transaction.status !== WalletTransactionStatus.PENDING) {
      throw new HttpError(400, "Transaction not found or cannot be cancelled");
    }

    const updated = await tx.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: WalletTransactionStatus.CANCELLED,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          increment: Math.abs(Number(transaction.amount)),
        },
      },
    });

    return mapTransaction(updated, wallet.userId);
  });
};

export const retryFailedWithdrawal = async (
  userId: number,
  transactionId: number
): Promise<WalletTransactionView> => {
  const { wallet, transaction } = await ensureTransactionOwnership(transactionId, userId);

  if (toTransactionType(transaction.type) !== "withdrawal") {
    throw new HttpError(400, "Transaction not found or cannot be retried");
  }

  if (transaction.status !== WalletTransactionStatus.FAILED) {
    throw new HttpError(400, "Transaction not found or cannot be retried");
  }

  const updated = await prisma.walletTransaction.update({
    where: { id: transaction.id },
    data: {
      status: WalletTransactionStatus.PENDING,
    },
  });

  return mapTransaction(updated, wallet.userId);
};
