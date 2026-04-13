import {
  LinkedPayoutAccount,
  LinkedPayoutAccountInput,
  PayoutAccountVerificationInput,
  PayoutAccountVerificationResult,
  TopUpConversionPreview,
  TopUpPaymentMethod,
  TopUpPaymentSnapshot,
  TopUpRequestInput,
  Wallet,
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
  WithdrawPayoutTargetType,
  WithdrawRequestInput,
} from '../types';
import { apiRequest } from '../services/apiClient';
import { parseApiError } from '../utils/api-error';
import {
  toSafeDate,
  toSafeEnum,
  toSafeNumber as sharedToSafeNumber,
  toTrimmedString as sharedToTrimmedString,
  toOptionalString as sharedToOptionalString,
} from '../utils/normalizers';

export interface WalletTransactionInput {
  description: string;
  type: WalletTransactionType;
  amount: number;
  status?: WalletTransactionStatus;
  date?: string;
  contextTitle?: string;
  contextId?: string;
  contextType?: WalletTransaction['contextType'];
  target?: string;
  note?: string;
}

interface WalletOverviewDto {
  userId: number;
  balance: number;
  pendingWithdrawalAmount?: number;
  totalInflow?: number;
  totalOutflow?: number;
  currency?: string;
  updatedAt?: string;
}

interface WalletTransactionDto {
  id: number;
  userId: number;
  date: string;
  description?: string;
  type: string;
  amount: number;
  status: string;
  contextTitle?: string;
  contextId?: string;
  contextType?: string;
  target?: string;
  note?: string;
}

interface PaginatedResultDto<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface LinkedPayoutAccountDto {
  id: number;
  userId: number;
  targetType: WithdrawPayoutTargetType;
  providerName: string;
  accountIdentifier: string;
  accountOwnerName: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WithdrawalPayloadDto {
  amount: number;
  payout: {
    targetType: WithdrawPayoutTargetType;
    providerName: string;
    accountIdentifier: string;
    verifiedAccountOwnerName?: string;
    verificationStatus?: 'success' | 'error' | 'pending';
    linkedAccountId?: number;
    source?: 'linked' | 'manual';
  };
  note?: string;
}

interface TopupPaymentSnapshotDto {
  transactionId?: number | string;
  status?: TopUpPaymentSnapshot['status'] | string;
  message?: string;
  amountVnd?: number;
  coins?: number;
  paymentMethod?: TopUpPaymentMethod | string;
  paymentRef?: string;
  paymentUrl?: string;
  qrPayload?: string;
  expiresAt?: string;
  pollIntervalMs?: number;
  transaction?: WalletTransactionDto;
}

const VND_PER_CONVERSION_UNIT = 1_000;
const COINS_PER_CONVERSION_UNIT = 10;
const TOP_UP_MIN_VND = 10_000;
const TOP_UP_MAX_VND = 20_000_000;

const TOP_UP_METHOD_LABELS: Record<TopUpPaymentMethod, string> = {
  bank: 'Bank transfer',
  vnpay: 'VNPAY',
  momo: 'MoMo Wallet',
};

const WITHDRAW_TARGET_LABELS: Record<WithdrawPayoutTargetType, string> = {
  bank: 'Bank',
  momo: 'MoMo Wallet',
  paypal: 'PayPal',
};

const DEFAULT_PROVIDER_BY_TARGET: Record<WithdrawPayoutTargetType, string> = {
  bank: 'Bank account',
  momo: 'MoMo Wallet',
  paypal: 'PayPal',
};

const PAYPAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BANK_ACCOUNT_REGEX = /^\d{8,20}$/;
const MOMO_PHONE_REGEX = /^\d{9,12}$/;
const MOMO_WALLET_ID_REGEX = /^[a-zA-Z0-9._-]{6,32}$/;

const toTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');

const toTrimmedString = (value: unknown): string => sharedToTrimmedString(value);
const toOptionalString = (value: unknown): string | undefined => sharedToOptionalString(value);
const toSafeNumber = (value: unknown, fallback = 0): number => sharedToSafeNumber(value, fallback);

const toId = (value: number | string | undefined, fallback: string): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  const normalized = toTrimmedString(value);
  return normalized || fallback;
};

const toTimestamp = (value: string): number => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const normalizeDate = (value: string | undefined): string => {
  const candidate = toTrimmedString(value);
  if (!candidate) {
    return new Date().toISOString();
  }

  return toSafeDate(candidate);
};

const normalizeOptionalDate = (value: unknown): string | undefined => {
  const candidate = toTrimmedString(value);
  if (!candidate) {
    return undefined;
  }

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
};

const normalizeType = (value: WalletTransactionType | string | undefined): WalletTransactionType => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (
    normalized === 'sale' ||
    normalized === 'withdrawal' ||
    normalized === 'purchase' ||
    normalized === 'bonus' ||
    normalized === 'topup' ||
    normalized === 'refund'
  ) {
    return normalized;
  }

  return 'bonus';
};

const normalizeStatus = (
  value: WalletTransactionStatus | string | undefined,
): WalletTransactionStatus => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (
    normalized === 'completed' ||
    normalized === 'pending' ||
    normalized === 'failed' ||
    normalized === 'cancelled'
  ) {
    return normalized;
  }

  return 'completed';
};

const normalizeContextType = (
  value: WalletTransaction['contextType'] | string | undefined,
): WalletTransaction['contextType'] => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'lesson' || normalized === 'order' || normalized === 'wallet' || normalized === 'system') {
    return normalized;
  }

  return 'wallet';
};

const normalizeTopUpMethod = (
  value: TopUpPaymentMethod | string | undefined,
): TopUpPaymentMethod => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === 'bank' || normalized === 'vnpay' || normalized === 'momo') {
    return normalized;
  }

  return 'bank';
};

const normalizeWithdrawTargetType = (
  value: WithdrawPayoutTargetType | string | undefined,
): WithdrawPayoutTargetType => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === 'bank' || normalized === 'momo' || normalized === 'paypal') {
    return normalized;
  }

  return 'bank';
};

const normalizeTransaction = (
  transaction: WalletTransaction,
  index: number,
): WalletTransaction => ({
  ...transaction,
  id: toTrimmedString(transaction.id) || `tx-${index + 1}`,
  userId: toTrimmedString(transaction.userId) || 'unknown-user',
  date: normalizeDate(transaction.date),
  description: toTrimmedString(transaction.description) || 'Wallet transaction',
  type: normalizeType(transaction.type),
  amount: toSafeNumber(transaction.amount),
  status: normalizeStatus(transaction.status),
  contextTitle: toOptionalString(transaction.contextTitle),
  contextId: toOptionalString(transaction.contextId),
  contextType: normalizeContextType(transaction.contextType),
  target: toOptionalString(transaction.target),
  note: toOptionalString(transaction.note),
});

const WALLET_COMPAT_STORAGE_KEY = 'teacherhub.wallet.compat.v1';
const MAX_COMPAT_TRANSACTIONS_PER_USER = 250;

interface WalletCompatUserState {
  extraBalance: number;
  transactions: WalletTransaction[];
}

type WalletCompatStore = Record<string, WalletCompatUserState>;

const hasLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const toUserKey = (userId: string): string => toTrimmedString(userId) || 'unknown-user';

const normalizeCompatUserState = (state: unknown): WalletCompatUserState => {
  if (!state || typeof state !== 'object') {
    return { extraBalance: 0, transactions: [] };
  }

  const record = state as Partial<WalletCompatUserState>;
  const extraBalance = Math.max(0, toSafeNumber(record.extraBalance, 0));
  const rawTransactions = Array.isArray(record.transactions) ? record.transactions : [];

  const transactions = rawTransactions
    .filter((entry): entry is WalletTransaction => Boolean(entry && typeof entry === 'object'))
    .map((entry, index) => normalizeTransaction(entry, index))
    .sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date))
    .slice(0, MAX_COMPAT_TRANSACTIONS_PER_USER);

  return {
    extraBalance,
    transactions,
  };
};

const readWalletCompatStore = (): WalletCompatStore => {
  if (!hasLocalStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(WALLET_COMPAT_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const store: WalletCompatStore = {};

    Object.entries(parsed as Record<string, unknown>).forEach(([userId, state]) => {
      store[toUserKey(userId)] = normalizeCompatUserState(state);
    });

    return store;
  } catch {
    return {};
  }
};

const writeWalletCompatStore = (store: WalletCompatStore): void => {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(WALLET_COMPAT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage write failures to avoid blocking wallet interactions.
  }
};

const getWalletCompatState = (userId: string): WalletCompatUserState => {
  const store = readWalletCompatStore();
  return normalizeCompatUserState(store[toUserKey(userId)]);
};

const updateWalletCompatState = (
  userId: string,
  updater: (current: WalletCompatUserState) => WalletCompatUserState,
): WalletCompatUserState => {
  const key = toUserKey(userId);
  const store = readWalletCompatStore();
  const current = normalizeCompatUserState(store[key]);
  const next = normalizeCompatUserState(updater(current));

  store[key] = next;
  writeWalletCompatStore(store);

  return next;
};

const mergeTransactionsWithCompat = (
  remoteTransactions: WalletTransaction[],
  compatTransactions: WalletTransaction[],
): WalletTransaction[] => {
  const byId = new Map<string, WalletTransaction>();

  [...compatTransactions, ...remoteTransactions].forEach((transaction, index) => {
    const normalized = normalizeTransaction(transaction, index);

    if (!byId.has(normalized.id)) {
      byId.set(normalized.id, normalized);
    }
  });

  return Array.from(byId.values()).sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date));
};

const mapWalletOverview = (dto: WalletOverviewDto): Wallet => ({
  userId: toId(dto.userId, 'unknown-user'),
  balance: toSafeNumber(dto.balance, 0),
});

const mapWalletTransaction = (dto: WalletTransactionDto): WalletTransaction => ({
  id: toId(dto.id, ''),
  userId: toId(dto.userId, ''),
  date: normalizeDate(dto.date),
  description:
    toTrimmedString(dto.description) ||
    `Wallet ${toTrimmedString(dto.type).toLowerCase() || 'transaction'}`,
  type: normalizeType(dto.type),
  amount: toSafeNumber(dto.amount),
  status: normalizeStatus(dto.status),
  contextTitle: toOptionalString(dto.contextTitle),
  contextId: toOptionalString(dto.contextId),
  contextType: normalizeContextType(dto.contextType),
  target: toOptionalString(dto.target),
  note: toOptionalString(dto.note),
});

const mapLinkedPayoutAccount = (dto: LinkedPayoutAccountDto): LinkedPayoutAccount => ({
  id: toId(dto.id, ''),
  userId: toId(dto.userId, ''),
  targetType: normalizeWithdrawTargetType(dto.targetType),
  providerName: toTrimmedString(dto.providerName) || DEFAULT_PROVIDER_BY_TARGET[normalizeWithdrawTargetType(dto.targetType)],
  accountIdentifier: toTrimmedString(dto.accountIdentifier),
  accountOwnerName: toTrimmedString(dto.accountOwnerName),
  isDefault: Boolean(dto.isDefault),
  createdAt: normalizeDate(dto.createdAt),
  updatedAt: normalizeDate(dto.updatedAt),
});

const getPayoutIdentifierValidationError = (
  targetType: WithdrawPayoutTargetType,
  accountIdentifier: string,
): string | null => {
  if (!accountIdentifier) {
    return 'Please provide an account or wallet identifier.';
  }

  if (targetType === 'bank' && !BANK_ACCOUNT_REGEX.test(accountIdentifier)) {
    return 'Please enter a valid bank account number.';
  }

  if (
    targetType === 'momo' &&
    !MOMO_PHONE_REGEX.test(accountIdentifier) &&
    !MOMO_WALLET_ID_REGEX.test(accountIdentifier)
  ) {
    return 'Please enter a valid MoMo phone number or wallet ID.';
  }

  if (targetType === 'paypal' && !PAYPAL_EMAIL_REGEX.test(accountIdentifier)) {
    return 'Please enter a valid PayPal email address.';
  }

  return null;
};

const toDerivedOwnerName = (
  targetType: WithdrawPayoutTargetType,
  accountIdentifier: string,
): string => {
  if (targetType === 'paypal') {
    const [localPart = 'paypal user'] = accountIdentifier.split('@');
    const fromLocalPart = localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\d+/g, ' ')
      .trim();

    if (fromLocalPart) {
      return toTitleCase(fromLocalPart);
    }
  }

  const suffix = accountIdentifier.slice(-4) || '0000';
  if (targetType === 'bank') {
    return `Bank Account Holder ${suffix}`;
  }

  if (targetType === 'momo') {
    return `MoMo Owner ${suffix}`;
  }

  return 'Verified Account Owner';
};

const validateLinkedPayoutAccountInput = (input: LinkedPayoutAccountInput): {
  targetType: WithdrawPayoutTargetType;
  providerName: string;
  accountIdentifier: string;
  accountOwnerName: string;
  setAsDefault: boolean;
} => {
  const targetType = normalizeWithdrawTargetType(input.targetType);
  const providerName = toTrimmedString(input.providerName) || DEFAULT_PROVIDER_BY_TARGET[targetType];
  const accountIdentifier = toTrimmedString(input.accountIdentifier);

  if (!accountIdentifier) {
    throw new Error('Payout account ID is required.');
  }

  const accountOwnerName =
    toTrimmedString(input.accountOwnerName) || toDerivedOwnerName(targetType, accountIdentifier);

  return {
    targetType,
    providerName,
    accountIdentifier,
    accountOwnerName,
    setAsDefault: input.setAsDefault ?? true,
  };
};

const resolveDefaultTargetStatus = (
  account: LinkedPayoutAccount,
  accounts: LinkedPayoutAccount[],
): LinkedPayoutAccount => {
  const hasDefaultInTarget = accounts.some(
    (item) => item.targetType === account.targetType && item.isDefault,
  );

  if (hasDefaultInTarget) {
    return account;
  }

  return {
    ...account,
    isDefault: true,
  };
};

const toTopUpCoins = (amountVnd: number): number => {
  const normalizedAmount = Number.isFinite(amountVnd) ? Math.max(0, amountVnd) : 0;
  return Math.floor(normalizedAmount / 100);
};

const validateTopUpAmountVnd = (amountVnd: number): void => {
  if (!Number.isFinite(amountVnd) || amountVnd <= 0) {
    throw new Error('Please enter a valid top-up amount.');
  }

  if (amountVnd < TOP_UP_MIN_VND) {
    throw new Error(`Top-up amount must be at least ${TOP_UP_MIN_VND.toLocaleString('vi-VN')}đ.`);
  }

  if (amountVnd > TOP_UP_MAX_VND) {
    throw new Error(`Top-up amount cannot exceed ${TOP_UP_MAX_VND.toLocaleString('vi-VN')}đ.`);
  }

  if (toTopUpCoins(amountVnd) <= 0) {
    throw new Error('Top-up amount is too low to convert into coins.');
  }
};

const topUpStatusMeta: Record<
  TopUpPaymentSnapshot['status'],
  { transactionStatus: WalletTransactionStatus; message: string }
> = {
  success: {
    transactionStatus: 'completed',
    message: 'Payment completed. Coins have been added to your wallet balance.',
  },
  failed: {
    transactionStatus: 'failed',
    message: 'Payment failed. Please retry with another method or verify payment details.',
  },
  pending: {
    transactionStatus: 'pending',
    message: 'Payment is pending confirmation. Your wallet will update once settlement completes.',
  },
};

const normalizeTopUpSnapshotStatus = (
  value: TopUpPaymentSnapshot['status'] | string | undefined,
): TopUpPaymentSnapshot['status'] => toSafeEnum(value, ['success', 'failed', 'pending'], 'pending');

const normalizePollIntervalMs = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(1_000, Math.floor(value));
};

const mapTopUpSnapshot = (dto: TopupPaymentSnapshotDto): TopUpPaymentSnapshot => {
  const status = normalizeTopUpSnapshotStatus(dto.status);
  const paymentMethod = normalizeTopUpMethod(dto.paymentMethod);
  const amountVnd = Math.max(0, Math.floor(toSafeNumber(dto.amountVnd, 0)));
  const coins = Math.max(0, Math.floor(toSafeNumber(dto.coins, toTopUpCoins(amountVnd))));
  const transactionId = toId(dto.transactionId ?? dto.transaction?.id, '');
  const paymentRef = toTrimmedString(dto.paymentRef) || `TOPUP-${transactionId || Date.now()}`;
  const paymentMethodLabel = TOP_UP_METHOD_LABELS[paymentMethod];
  const fallbackTransactionStatus = topUpStatusMeta[status].transactionStatus;

  const transaction = dto.transaction
    ? normalizeTransaction(mapWalletTransaction(dto.transaction), 0)
    : normalizeTransaction(
        {
          id: transactionId || `tx-topup-${Date.now()}`,
          userId: 'unknown-user',
          date: new Date().toISOString(),
          description: `Top-up via ${paymentMethodLabel}`,
          type: 'topup',
          amount: coins,
          status: fallbackTransactionStatus,
          contextTitle: amountVnd > 0 ? `Top-up ${amountVnd.toLocaleString('vi-VN')}đ` : undefined,
          contextType: 'wallet',
          target: `${paymentMethodLabel} • ${paymentRef}`,
        },
        0,
      );

  return {
    transactionId: transactionId || transaction.id,
    status,
    message: toTrimmedString(dto.message) || topUpStatusMeta[status].message,
    amountVnd,
    coins,
    paymentMethod,
    paymentRef,
    paymentUrl: toOptionalString(dto.paymentUrl),
    qrPayload: toOptionalString(dto.qrPayload) ?? toOptionalString(dto.paymentUrl),
    expiresAt: normalizeOptionalDate(dto.expiresAt),
    pollIntervalMs: normalizePollIntervalMs(dto.pollIntervalMs),
    transaction,
  };
};

export const getWallet = async (userId: string): Promise<Wallet> => {
  try {
    const wallet = await apiRequest<WalletOverviewDto>('/api/wallet');
    const remoteWallet = mapWalletOverview(wallet);
    const compatState = getWalletCompatState(userId);

    return {
      ...remoteWallet,
      userId: remoteWallet.userId || toUserKey(userId),
      balance: Math.max(0, remoteWallet.balance + compatState.extraBalance),
    };
  } catch (error) {
    throw parseApiError(error);
  }
};

export const listWalletTransactions = async (
  userId: string,
): Promise<WalletTransaction[]> => {
  try {
    const response = await apiRequest<PaginatedResultDto<WalletTransactionDto>>(
      '/api/wallet/transactions?page=1&pageSize=200',
    );

    const remoteTransactions = response.data
      .map(mapWalletTransaction)
      .map((transaction, index) => normalizeTransaction(transaction, index));

    const compatState = getWalletCompatState(userId);

    return mergeTransactionsWithCompat(remoteTransactions, compatState.transactions);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const createWalletTransaction = async (
  userId: string,
  input: WalletTransactionInput,
  applyBalanceChange = true,
): Promise<WalletTransaction> => {
  const description = toTrimmedString(input.description);
  if (!description) {
    throw new Error('Transaction description is required');
  }

  const normalizedAmount = toSafeNumber(input.amount);

  const simulated: WalletTransaction = {
    id: `tx-local-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    userId,
    date: normalizeDate(input.date),
    description,
    type: normalizeType(input.type),
    amount: normalizedAmount,
    status: normalizeStatus(input.status),
    contextTitle: toOptionalString(input.contextTitle),
    contextId: toOptionalString(input.contextId),
    contextType: normalizeContextType(input.contextType),
    target: toOptionalString(input.target),
    note: toOptionalString(input.note),
  };

  const normalizedTransaction = normalizeTransaction(simulated, 0);

  updateWalletCompatState(userId, (current) => ({
    extraBalance:
      applyBalanceChange && normalizedAmount > 0
        ? current.extraBalance + normalizedAmount
        : current.extraBalance,
    transactions: [normalizedTransaction, ...current.transactions].slice(
      0,
      MAX_COMPAT_TRANSACTIONS_PER_USER,
    ),
  }));

  return normalizedTransaction;
};

export const getTopUpConversionPreview = (
  amountVnd: number,
): TopUpConversionPreview => {
  const normalizedAmount = Number.isFinite(amountVnd) ? Math.max(0, Math.floor(amountVnd)) : 0;

  return {
    amountVnd: normalizedAmount,
    conversionRateLabel: `${VND_PER_CONVERSION_UNIT.toLocaleString('vi-VN')}đ = ${COINS_PER_CONVERSION_UNIT} coins`,
    coins: toTopUpCoins(normalizedAmount),
  };
};

export const getTopUpLimits = (): { minVnd: number; maxVnd: number } => ({
  minVnd: TOP_UP_MIN_VND,
  maxVnd: TOP_UP_MAX_VND,
});

export const topUpWallet = async (
  _userId: string,
  input: TopUpRequestInput,
): Promise<TopUpPaymentSnapshot> => {
  const amountVnd = Math.floor(Number(input.amountVnd));
  const paymentMethod = normalizeTopUpMethod(input.paymentMethod);
  const note = toOptionalString(input.note);

  validateTopUpAmountVnd(amountVnd);

  try {
    const snapshot = await apiRequest<TopupPaymentSnapshotDto>('/api/wallet/topups', {
      method: 'POST',
      body: {
        amountVnd,
        paymentMethod,
        note,
      },
    });

    return mapTopUpSnapshot(snapshot);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const getTopupStatus = async (
  _userId: string,
  transactionId: string,
): Promise<TopUpPaymentSnapshot> => {
  const normalizedTransactionId = toTrimmedString(transactionId);
  if (!normalizedTransactionId) {
    throw new Error('Transaction ID is required');
  }

  try {
    const snapshot = await apiRequest<TopupPaymentSnapshotDto>(
      `/api/wallet/topups/${encodeURIComponent(normalizedTransactionId)}`,
    );

    return mapTopUpSnapshot(snapshot);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const verifyPayoutAccount = async (
  input: PayoutAccountVerificationInput,
): Promise<PayoutAccountVerificationResult> => {
  const targetType = normalizeWithdrawTargetType(input.targetType);
  const providerName = toTrimmedString(input.providerName) || DEFAULT_PROVIDER_BY_TARGET[targetType];
  const accountIdentifier = toTrimmedString(input.accountIdentifier);

  try {
    const result = await apiRequest<PayoutAccountVerificationResult>('/api/wallet/payout-accounts/verify', {
      method: 'POST',
      body: {
        targetType,
        providerName,
        accountIdentifier,
      },
    });

    return {
      status: result.status,
      ownerName: toOptionalString(result.ownerName),
      message: toTrimmedString(result.message) || 'Account verification completed.',
      verifiedAt: normalizeDate(result.verifiedAt),
    };
  } catch (error) {
    throw parseApiError(error);
  }
};

export const listLinkedPayoutAccounts = async (userId: string): Promise<LinkedPayoutAccount[]> => {
  try {
    const linkedAccounts = await apiRequest<LinkedPayoutAccountDto[]>('/api/wallet/payout-accounts');

    const normalized = linkedAccounts.map(mapLinkedPayoutAccount);

    const byTarget = normalized.reduce<Record<WithdrawPayoutTargetType, LinkedPayoutAccount[]>>(
      (acc, account) => {
        const targetType = account.targetType;
        const next = acc[targetType] ?? [];
        acc[targetType] = [...next, account];
        return acc;
      },
      { bank: [], momo: [], paypal: [] },
    );

    return (Object.keys(byTarget) as WithdrawPayoutTargetType[]).flatMap((targetType) => {
      const bucket = byTarget[targetType];
      return bucket
        .map((account) => resolveDefaultTargetStatus(account, bucket))
        .sort((left, right) => {
          if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1;
          }
          return toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
        });
    });
  } catch (error) {
    throw parseApiError(error);
  }
};

export const upsertLinkedPayoutAccount = async (
  _userId: string,
  input: LinkedPayoutAccountInput,
): Promise<LinkedPayoutAccount> => {
  const validated = validateLinkedPayoutAccountInput(input);

  try {
    const saved = await apiRequest<LinkedPayoutAccountDto>('/api/wallet/payout-accounts', {
      method: 'POST',
      body: validated,
    });

    return mapLinkedPayoutAccount(saved);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const deleteLinkedPayoutAccount = async (
  _userId: string,
  accountId: string,
): Promise<void> => {
  const trimmedId = toTrimmedString(accountId);
  if (!trimmedId) {
    throw new Error('Account ID is required');
  }

  try {
    await apiRequest<null>(`/api/wallet/payout-accounts/${encodeURIComponent(trimmedId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    throw parseApiError(error);
  }
};

export const setDefaultLinkedPayoutAccount = async (
  _userId: string,
  accountId: string,
): Promise<LinkedPayoutAccount> => {
  const trimmedId = toTrimmedString(accountId);
  if (!trimmedId) {
    throw new Error('Account ID is required');
  }

  try {
    const account = await apiRequest<LinkedPayoutAccountDto>(
      `/api/wallet/payout-accounts/${encodeURIComponent(trimmedId)}/default`,
      {
        method: 'POST',
      },
    );

    return mapLinkedPayoutAccount(account);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const withdrawFromWallet = async (
  _userId: string,
  input: WithdrawRequestInput,
): Promise<WalletTransaction> => {
  const amount = toSafeNumber(input.amount);
  const payout = input.payout;
  const targetType = normalizeWithdrawTargetType(payout?.targetType);
  const providerName = toTrimmedString(payout?.providerName) || DEFAULT_PROVIDER_BY_TARGET[targetType];
  const accountIdentifier = toTrimmedString(payout?.accountIdentifier);
  const verifiedAccountOwnerName = toOptionalString(payout?.verifiedAccountOwnerName);
  const verificationStatus = payout?.verificationStatus
    ? toSafeEnum(payout.verificationStatus, ['success', 'error', 'pending'], 'pending')
    : undefined;
  const linkedAccountId = toOptionalString(payout?.linkedAccountId);
  const note = toOptionalString(input.note);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Withdraw amount must be greater than zero');
  }

  const identifierError = getPayoutIdentifierValidationError(targetType, accountIdentifier);
  if (identifierError) {
    throw new Error(identifierError);
  }

  const usingLinkedSource = payout?.source === 'linked';

  if (!usingLinkedSource && verificationStatus === 'pending') {
    throw new Error('Verifying account...');
  }

  if (!usingLinkedSource && verificationStatus === 'error') {
    throw new Error('Unable to verify this account');
  }

  if (!usingLinkedSource && verificationStatus !== 'success') {
    throw new Error('Please verify payout account details before submitting.');
  }

  const payload: WithdrawalPayloadDto = {
    amount,
    payout: {
      targetType,
      providerName,
      accountIdentifier,
      ...(verifiedAccountOwnerName ? { verifiedAccountOwnerName } : {}),
      ...(verificationStatus ? { verificationStatus } : {}),
      ...(linkedAccountId ? { linkedAccountId: Number(linkedAccountId) } : {}),
      ...(payout?.source ? { source: payout.source } : {}),
    },
    ...(note ? { note } : {}),
  };

  try {
    const transaction = await apiRequest<WalletTransactionDto>('/api/wallet/withdrawals', {
      method: 'POST',
      body: payload,
    });

    return normalizeTransaction(mapWalletTransaction(transaction), 0);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const getWalletAnalyticsSeries = async (
  userId: string,
): Promise<Array<{ name: string; coins: number }>> => {
  const transactions = await listWalletTransactions(userId);

  const now = new Date();
  const labels: Array<{ key: string; label: string }> = [];

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    labels.push({
      key,
      label: date.toLocaleDateString(undefined, { month: 'short' }),
    });
  }

  const summary = labels.map((item) => ({ ...item, coins: 0 }));

  transactions.forEach((transaction) => {
    const date = new Date(transaction.date);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const found = summary.find((entry) => entry.key === key);
    if (!found) {
      return;
    }

    if (transaction.amount > 0 && normalizeStatus(transaction.status) === 'completed') {
      found.coins += transaction.amount;
    }
  });

  return summary.map((item) => ({ name: item.label, coins: item.coins }));
};

export const cancelPendingWithdrawal = async (
  transactionId: string,
  _userId: string,
): Promise<WalletTransaction> => {
  try {
    const updated = await apiRequest<WalletTransactionDto>(
      `/api/wallet/withdrawals/${encodeURIComponent(transactionId)}/cancel`,
      {
        method: 'POST',
      },
    );

    return normalizeTransaction(mapWalletTransaction(updated), 0);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const retryFailedWithdrawal = async (
  transactionId: string,
  _userId: string,
): Promise<WalletTransaction> => {
  try {
    const updated = await apiRequest<WalletTransactionDto>(
      `/api/wallet/withdrawals/${encodeURIComponent(transactionId)}/retry`,
      {
        method: 'POST',
      },
    );

    return normalizeTransaction(mapWalletTransaction(updated), 0);
  } catch (error) {
    throw parseApiError(error);
  }
};
