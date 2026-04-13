import { z } from "zod";

const optionalTrimmedText = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(500).optional()
);

const queryStringSchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  },
  z.string().trim()
);

const requiredQueryStringSchema = (fieldName: string) =>
  queryStringSchema.pipe(z.string().min(1, `${fieldName} is required`));

const numericQueryStringSchema = (fieldName: string) =>
  queryStringSchema.pipe(z.string().regex(/^\d+$/, `${fieldName} must be numeric`));

const payoutTargetTypeSchema = z.enum(["bank", "momo", "paypal"]);

const payoutVerificationStatusSchema = z.enum(["success", "error", "pending"]).optional();

const payoutSourceSchema = z.enum(["linked", "manual"]).optional();

const topupPaymentMethodSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(["bank", "vnpay", "momo"]));

export const listWalletTransactionsQuerySchema = z.object({
  type: z
    .enum(["sale", "withdrawal", "purchase", "bonus", "topup", "refund"])
    .optional(),
  status: z.enum(["completed", "pending", "failed", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const payoutAccountIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const transactionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createTopupSchema = z.object({
  amountVnd: z.coerce.number().int().min(10_000).max(20_000_000),
  paymentMethod: topupPaymentMethodSchema,
  note: optionalTrimmedText,
});

export const topupStatusParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const vnpayIpnQuerySchema = z
  .object({
    vnp_Amount: numericQueryStringSchema("vnp_Amount"),
    vnp_ResponseCode: requiredQueryStringSchema("vnp_ResponseCode"),
    vnp_TransactionStatus: queryStringSchema.optional(),
    vnp_TxnRef: requiredQueryStringSchema("vnp_TxnRef"),
    vnp_TransactionNo: queryStringSchema.optional(),
    vnp_PayDate: queryStringSchema.optional(),
    vnp_BankCode: queryStringSchema.optional(),
    vnp_BankTranNo: queryStringSchema.optional(),
    vnp_OrderInfo: queryStringSchema.optional(),
    vnp_SecureHash: requiredQueryStringSchema("vnp_SecureHash"),
    vnp_SecureHashType: queryStringSchema.optional(),
  })
  .passthrough();

export const upsertPayoutAccountSchema = z.object({
  targetType: payoutTargetTypeSchema,
  providerName: z.string().trim().min(1).max(120).optional(),
  accountIdentifier: z.string().trim().min(1).max(191),
  accountOwnerName: z.string().trim().min(1).max(191).optional(),
  setAsDefault: z.coerce.boolean().optional(),
});

export const verifyPayoutAccountSchema = z.object({
  targetType: payoutTargetTypeSchema,
  providerName: z.string().trim().min(1).max(120).optional(),
  accountIdentifier: z.string().trim().min(1).max(191),
});

const withdrawPayoutSchema = z.object({
  targetType: payoutTargetTypeSchema,
  providerName: z.string().trim().min(1).max(120),
  accountIdentifier: z.string().trim().min(1).max(191),
  verifiedAccountOwnerName: z.string().trim().min(1).max(191).optional(),
  verificationStatus: payoutVerificationStatusSchema,
  linkedAccountId: z.coerce.number().int().positive().optional(),
  source: payoutSourceSchema,
});

export const createWithdrawalSchema = z.object({
  amount: z.coerce.number().positive(),
  payout: withdrawPayoutSchema,
  note: optionalTrimmedText,
});

export type ListWalletTransactionsQueryInput = z.infer<
  typeof listWalletTransactionsQuerySchema
>;

export type CreateTopupInput = z.infer<typeof createTopupSchema>;

export type VnpayIpnQueryInput = z.infer<typeof vnpayIpnQuerySchema>;

export type UpsertPayoutAccountInput = z.infer<typeof upsertPayoutAccountSchema>;

export type VerifyPayoutAccountInput = z.infer<typeof verifyPayoutAccountSchema>;

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
