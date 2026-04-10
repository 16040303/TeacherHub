import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../app/providers/LanguageProvider';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Clock3,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Building2,
  QrCode,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Repeat,
  Filter,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../../app/providers/AuthProvider';
import { walletService } from '../../services/walletService';
import { useToast } from '../../app/providers/ToastProvider';
import {
  LinkedPayoutAccount,
  LinkedPayoutAccountInput,
  TopUpPaymentMethod,
  TopUpPaymentSnapshot,
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
  WithdrawPayoutTargetType,
} from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { formatCoins, formatRelativeDate, formatVnd, toDateTimeLabel } from '../../utils/format';

const TOP_UP_SUGGESTIONS_VND = [100_000, 200_000, 500_000, 1_000_000] as const;

type WithdrawFormErrorKey = 'amount' | 'providerName' | 'accountIdentifier' | 'general';

type WithdrawFormErrors = Partial<Record<WithdrawFormErrorKey, string>>;

type WithdrawVerificationState = {
  status: 'idle' | 'pending' | 'success' | 'error';
  ownerName: string;
  message: string;
};

const WITHDRAW_TARGET_OPTIONS: Array<{
  value: WithdrawPayoutTargetType;
  label: string;
  providerLabel: string;
  providerPlaceholder: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  helperText: string;
  requiresProvider: boolean;
}> = [
  {
    value: 'bank',
    label: 'Bank',
    providerLabel: 'Bank name',
    providerPlaceholder: 'Choose bank',
    identifierLabel: 'Account number',
    identifierPlaceholder: 'e.g. 0123456789',
    helperText: 'Use your payout-ready bank account number. Supported: 8-20 digits.',
    requiresProvider: true,
  },
  {
    value: 'momo',
    label: 'MoMo Wallet',
    providerLabel: 'Wallet provider',
    providerPlaceholder: 'MoMo Wallet',
    identifierLabel: 'Phone number / Wallet ID',
    identifierPlaceholder: 'e.g. 0901234567',
    helperText: 'Use your MoMo phone number or wallet ID linked to payout.',
    requiresProvider: false,
  },
  {
    value: 'paypal',
    label: 'PayPal',
    providerLabel: 'Provider',
    providerPlaceholder: 'PayPal',
    identifierLabel: 'PayPal email',
    identifierPlaceholder: 'e.g. teacher@paypal.com',
    helperText: 'Use the PayPal email that can receive international payouts.',
    requiresProvider: false,
  },
];

const BANK_PROVIDER_OPTIONS = [
  'Vietcombank',
  'BIDV',
  'VietinBank',
  'Techcombank',
  'ACB',
  'MB Bank',
] as const;

const WITHDRAW_DEFAULT_PROVIDER: Record<WithdrawPayoutTargetType, string> = {
  bank: 'Vietcombank',
  momo: 'MoMo Wallet',
  paypal: 'PayPal',
};

const PAYPAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BANK_ACCOUNT_REGEX = /^\d{8,20}$/;
const MOMO_PHONE_REGEX = /^\d{9,12}$/;
const MOMO_WALLET_ID_REGEX = /^[a-zA-Z0-9._-]{6,32}$/;

const getWithdrawIdentifierError = (
  targetType: WithdrawPayoutTargetType,
  identifier: string,
  t: (key: string) => string,
): string | null => {
  if (!identifier) {
    return t('wallet.accountIdentifierRequired');
  }

  if (targetType === 'bank' && !BANK_ACCOUNT_REGEX.test(identifier)) {
    return t('wallet.validBankAccountRequired');
  }

  if (
    targetType === 'momo' &&
    !MOMO_PHONE_REGEX.test(identifier) &&
    !MOMO_WALLET_ID_REGEX.test(identifier)
  ) {
    return t('wallet.validMomoRequired');
  }

  if (targetType === 'paypal' && !PAYPAL_EMAIL_REGEX.test(identifier)) {
    return t('wallet.validPaypalEmailRequired');
  }

  return null;
};

const maskPayoutIdentifier = (
  targetType: WithdrawPayoutTargetType,
  identifier: string,
  t: (key: string) => string,
): string => {
  const normalized = identifier.trim();
  if (!normalized) {
    return t('wallet.notProvided');
  }

  if (targetType === 'bank') {
    const suffix = normalized.slice(-4);
    return `•••• ${suffix}`;
  }

  if (targetType === 'momo') {
    if (normalized.length <= 5) {
      return normalized;
    }

    return `${normalized.slice(0, 3)}••••${normalized.slice(-2)}`;
  }

  const [localPart, domain] = normalized.split('@');
  if (!domain || localPart.length < 3) {
    return normalized;
  }

  return `${localPart.slice(0, 2)}••••@${domain}`;
};

const getWithdrawTargetConfig = (
  targetType: WithdrawPayoutTargetType,
): (typeof WITHDRAW_TARGET_OPTIONS)[number] =>
  WITHDRAW_TARGET_OPTIONS.find((option) => option.value === targetType) ?? WITHDRAW_TARGET_OPTIONS[0];

const PAYMENT_METHODS: Array<{
  value: TopUpPaymentMethod;
  label: string;
  helper: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'bank',
    label: 'Bank',
    helper: 'Transfer via bank gateway. Confirmation may take a little longer.',
    icon: <Building2 size={18} />,
  },
  {
    value: 'vnpay',
    label: 'VNPAY',
    helper: 'Fast QR and card-compatible checkout flow.',
    icon: <QrCode size={18} />,
  },
  {
    value: 'momo',
    label: 'MoMo Wallet',
    helper: 'Direct wallet payment with mobile confirmation.',
    icon: <Smartphone size={18} />,
  },
];

const STATUS_META: Record<
  WalletTransactionStatus,
  {
    label: string;
    dotClassName: string;
    chipClassName: string;
    icon: React.ReactNode;
  }
> = {
  completed: {
    label: 'Completed',
    dotClassName: 'bg-emerald-500',
    chipClassName: 'border-emerald-300/40 bg-emerald-500/10 text-emerald-300',
    icon: <CheckCircle2 size={14} />,
  },
  pending: {
    label: 'Pending',
    dotClassName: 'bg-amber-500',
    chipClassName: 'border-amber-300/40 bg-amber-500/10 text-amber-200',
    icon: <Clock3 size={14} />,
  },
  failed: {
    label: 'Failed',
    dotClassName: 'bg-rose-500',
    chipClassName: 'border-rose-300/40 bg-rose-500/10 text-rose-300',
    icon: <XCircle size={14} />,
  },
  cancelled: {
    label: 'Cancelled',
    dotClassName: 'bg-slate-400',
    chipClassName: 'border-slate-300/30 bg-slate-500/10 text-slate-300',
    icon: <XCircle size={14} />,
  },
};

const TOP_UP_RESULT_META: Record<
  TopUpPaymentSnapshot['status'],
  {
    title: string;
    panelClassName: string;
    icon: React.ReactNode;
  }
> = {
  success: {
    title: 'Payment Success',
    panelClassName: 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100',
    icon: <CheckCircle2 size={16} />,
  },
  failed: {
    title: 'Payment Failed',
    panelClassName: 'border-rose-300/40 bg-rose-500/10 text-rose-100',
    icon: <XCircle size={16} />,
  },
  pending: {
    title: 'Payment Pending',
    panelClassName: 'border-amber-300/40 bg-amber-500/10 text-amber-100',
    icon: <Clock3 size={16} />,
  },
};

const TRANSACTION_TYPE_LABELS: Record<WalletTransaction['type'], string> = {
  sale: 'Sale',
  withdrawal: 'Withdrawal',
  purchase: 'Purchase',
  bonus: 'Bonus',
  topup: 'Top-up',
  refund: 'Refund',
};

const toTransactionTypeLabel = (type: WalletTransaction['type']): string =>
  TRANSACTION_TYPE_LABELS[type] ?? 'Activity';

const toContextLabel = (entry: WalletTransaction): string => {
  if (entry.contextTitle) {
    return entry.contextTitle;
  }

  if (entry.target) {
    return entry.target;
  }

  switch (entry.contextType) {
    case 'lesson':
      return 'Lesson payment';
    case 'order':
      return 'Order settlement';
    case 'system':
      return 'Platform event';
    default:
      return 'Wallet activity';
  }
};

const escapeCsvValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '""';
  }

  const normalized = String(value).replace(/"/g, '""');
  return `"${normalized}"`;
};

const buildWalletTransactionsCsv = (entries: WalletTransaction[]): string => {
  const headers = [
    'Transaction ID',
    'Date',
    'Relative Date',
    'Description',
    'Context',
    'Type',
    'Amount (coins)',
    'Status',
    'Note',
    'Context Type',
    'Context ID',
    'Target',
  ];

  const rows = entries.map((entry) =>
    [
      entry.id,
      toDateTimeLabel(entry.date),
      formatRelativeDate(entry.date),
      entry.description,
      toContextLabel(entry),
      toTransactionTypeLabel(entry.type),
      entry.amount,
      entry.status,
      entry.note ?? '',
      entry.contextType ?? '',
      entry.contextId ?? '',
      entry.target ?? '',
    ]
      .map((value) => escapeCsvValue(value))
      .join(','),
  );

  return [headers.map((header) => escapeCsvValue(header)).join(','), ...rows].join('\n');
};

const toPaymentMethodLabel = (method: TopUpPaymentMethod): string =>
  PAYMENT_METHODS.find((item) => item.value === method)?.label ?? 'Bank';

const toAmountClassName = (entry: WalletTransaction): string => {
  if (entry.amount <= 0) {
    return 'text-slate-900 dark:text-white';
  }

  if (entry.status === 'completed') {
    return 'text-emerald-500';
  }

  if (entry.status === 'pending') {
    return 'text-amber-400';
  }

  if (entry.status === 'failed') {
    return 'text-rose-400';
  }

  return 'text-slate-500';
};

export const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [analytics, setAnalytics] = useState<Array<{ name: string; coins: number }>>([]);

  const [topUpAmountVnd, setTopUpAmountVnd] = useState('200000');
  const [topUpMethod, setTopUpMethod] = useState<TopUpPaymentMethod>('vnpay');
  const [topUpNote, setTopUpNote] = useState('');
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [topUpResult, setTopUpResult] = useState<TopUpPaymentSnapshot | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState('150');
  const [withdrawTargetType, setWithdrawTargetType] = useState<WithdrawPayoutTargetType>('bank');
  const [linkedPayoutAccounts, setLinkedPayoutAccounts] = useState<LinkedPayoutAccount[]>([]);
  const [withdrawEditingManual, setWithdrawEditingManual] = useState(false);
  const [withdrawProviderName, setWithdrawProviderName] = useState(WITHDRAW_DEFAULT_PROVIDER.bank);
  const [withdrawAccountIdentifier, setWithdrawAccountIdentifier] = useState('');
  const [withdrawVerification, setWithdrawVerification] = useState<WithdrawVerificationState>({
    status: 'idle',
    ownerName: '',
    message: '',
  });
  const [withdrawErrors, setWithdrawErrors] = useState<WithdrawFormErrors>({});
  const [lastWithdrawalDraft, setLastWithdrawalDraft] = useState<LinkedPayoutAccountInput | null>(null);
  const [showSaveLinkedAccount, setShowSaveLinkedAccount] = useState(false);
  const [saveLinkedAccountChecked, setSaveLinkedAccountChecked] = useState(false);
  const [savingLinkedAccount, setSavingLinkedAccount] = useState(false);

  /* ── Transaction filter state ── */
  const [filterType, setFilterType] = useState<WalletTransactionType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<WalletTransactionStatus | 'all'>('all');

  /* ── Transaction expand state ── */
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  /* ── Cancel/Retry state ── */
  const [confirmCancelTxId, setConfirmCancelTxId] = useState<string | null>(null);
  const [cancellingTxId, setCancellingTxId] = useState<string | null>(null);
  const [retryingTxId, setRetryingTxId] = useState<string | null>(null);

  const topUpLimits = useMemo(() => walletService.getTopUpLimits(), []);

  const topUpPreview = useMemo(
    () => walletService.getTopUpConversionPreview(Number(topUpAmountVnd)),
    [topUpAmountVnd],
  );

  const refresh = async (): Promise<void> => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [wallet, txRows, chart, payoutAccounts] = await Promise.all([
        walletService.getWallet(user.id),
        walletService.listWalletTransactions(user.id),
        walletService.getWalletAnalyticsSeries(user.id),
        walletService.listLinkedPayoutAccounts(user.id),
      ]);

      setBalance(wallet.balance);
      setTransactions(txRows);
      setAnalytics(chart);
      setLinkedPayoutAccounts(payoutAccounts);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('wallet.unableToLoadDetails');
      setLoadError(message);
      setTransactions([]);
      setAnalytics([]);
      setLinkedPayoutAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  const totalCompletedIncoming = useMemo(
    () =>
      transactions
        .filter((entry) => entry.amount > 0 && entry.status === 'completed')
        .reduce((sum, entry) => sum + entry.amount, 0),
    [transactions],
  );

  const thisMonthIncome = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions.reduce((sum, entry) => {
      if (entry.amount <= 0 || entry.status !== 'completed') {
        return sum;
      }

      const entryDate = new Date(entry.date);
      if (Number.isNaN(entryDate.getTime())) {
        return sum;
      }

      if (entryDate.getFullYear() !== currentYear || entryDate.getMonth() !== currentMonth) {
        return sum;
      }

      return sum + entry.amount;
    }, 0);
  }, [transactions]);

  const pendingWithdrawTotal = useMemo(
    () =>
      Math.abs(
        transactions
          .filter((entry) => entry.type === 'withdrawal' && entry.status === 'pending')
          .reduce((sum, entry) => sum + entry.amount, 0),
      ),
    [transactions],
  );

  const failedWithdrawCount = useMemo(
    () => transactions.filter((entry) => entry.type === 'withdrawal' && entry.status === 'failed').length,
    [transactions],
  );

  const completedWithdrawCount = useMemo(
    () => transactions.filter((entry) => entry.type === 'withdrawal' && entry.status === 'completed').length,
    [transactions],
  );

  const pendingTopUpCount = useMemo(
    () => transactions.filter((entry) => entry.type === 'topup' && entry.status === 'pending').length,
    [transactions],
  );

  const failedTopUpCount = useMemo(
    () => transactions.filter((entry) => entry.type === 'topup' && entry.status === 'failed').length,
    [transactions],
  );

  const linkedAccountsByTarget = useMemo(
    () =>
      linkedPayoutAccounts.reduce<Record<WithdrawPayoutTargetType, LinkedPayoutAccount[]>>(
        (acc, account) => {
          const next = acc[account.targetType] ?? [];
          acc[account.targetType] = [...next, account];
          return acc;
        },
        { bank: [], momo: [], paypal: [] },
      ),
    [linkedPayoutAccounts],
  );

  const linkedAccountForWithdrawTarget = useMemo(() => {
    const bucket = linkedAccountsByTarget[withdrawTargetType] ?? [];

    const explicitDefault = bucket.find((account) => account.isDefault);
    return explicitDefault ?? bucket[0] ?? null;
  }, [linkedAccountsByTarget, withdrawTargetType]);

  const withdrawTargetConfig = useMemo(
    () => getWithdrawTargetConfig(withdrawTargetType),
    [withdrawTargetType],
  );

  const withdrawPayoutVnd = useMemo(() => {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    return Math.floor(amount * 100);
  }, [withdrawAmount]);

  const withdrawNeedsVerification =
    withdrawEditingManual || !linkedAccountForWithdrawTarget || !withdrawAccountIdentifier.trim();

  useEffect(() => {
    if (withdrawEditingManual) {
      return;
    }

    if (linkedAccountForWithdrawTarget) {
      setWithdrawProviderName(
        linkedAccountForWithdrawTarget.providerName || WITHDRAW_DEFAULT_PROVIDER[withdrawTargetType],
      );
      setWithdrawAccountIdentifier(linkedAccountForWithdrawTarget.accountIdentifier);
      setWithdrawVerification({
        status: 'success',
        ownerName: linkedAccountForWithdrawTarget.accountOwnerName,
        message: t('wallet.usingLinkedPayoutAccount'),
      });
      return;
    }

    setWithdrawProviderName(WITHDRAW_DEFAULT_PROVIDER[withdrawTargetType]);
    setWithdrawAccountIdentifier('');
    setWithdrawVerification({
      status: 'idle',
      ownerName: '',
      message: '',
    });
  }, [linkedAccountForWithdrawTarget, withdrawEditingManual, withdrawTargetType]);

  useEffect(() => {
    if (linkedAccountForWithdrawTarget) {
      setWithdrawEditingManual(false);
    } else {
      setWithdrawEditingManual(true);
      setWithdrawProviderName(WITHDRAW_DEFAULT_PROVIDER[withdrawTargetType]);
      setWithdrawAccountIdentifier('');
      setWithdrawVerification({
        status: 'idle',
        ownerName: '',
        message: '',
      });
    }

    setShowSaveLinkedAccount(false);
    setSaveLinkedAccountChecked(false);
    setLastWithdrawalDraft(null);
    setWithdrawErrors({});
  }, [withdrawTargetType, linkedAccountForWithdrawTarget?.id]);

  const topUpValidationError = useMemo(() => {
    const amountVnd = Number(topUpAmountVnd);

    if (!Number.isFinite(amountVnd) || amountVnd <= 0) {
      return t('wallet.validTopupRequired');
    }

    if (amountVnd < topUpLimits.minVnd) {
      return t('wallet.minTopupRequired', { values: { amount: formatVnd(topUpLimits.minVnd) } });
    }

    if (amountVnd > topUpLimits.maxVnd) {
      return t('wallet.maxTopupExceeded', { values: { amount: formatVnd(topUpLimits.maxVnd) } });
    }

    if (topUpPreview.coins <= 0) {
      return t('wallet.amountTooLow');
    }

    return null;
  }, [topUpAmountVnd, topUpLimits.maxVnd, topUpLimits.minVnd, topUpPreview.coins, t]);

  const validateWithdrawForm = (): WithdrawFormErrors => {
    const next: WithdrawFormErrors = {};
    const amount = Number(withdrawAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      next.amount = t('wallet.validWithdrawalRequired');
    } else if (amount > balance) {
      next.amount = t('wallet.withdrawalExceedsBalance');
    }

    const providerName = withdrawProviderName.trim() || WITHDRAW_DEFAULT_PROVIDER[withdrawTargetType];
    if (withdrawTargetConfig.requiresProvider && !providerName) {
      next.providerName = t('wallet.providerNameRequired');
    }

    const accountIdentifier = withdrawAccountIdentifier.trim();
    const identifierError = getWithdrawIdentifierError(withdrawTargetType, accountIdentifier, t);
    if (identifierError) {
      next.accountIdentifier = identifierError;
    }

    if (withdrawNeedsVerification) {
      if (withdrawVerification.status === 'pending') {
        next.general = t('wallet.verificationPending');
      } else if (withdrawVerification.status === 'error') {
        next.general = t('wallet.verificationError');
      } else if (withdrawVerification.status !== 'success') {
        next.general = t('wallet.verificationRequired');
      }
    }

    return next;
  };

  const canSubmitTopUp = useMemo(
    () => Boolean(user) && !submittingTopup && !topUpValidationError,
    [user, submittingTopup, topUpValidationError],
  );

  const canSubmitWithdraw = useMemo(() => {
    const amount = Number(withdrawAmount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > balance || submittingWithdraw) {
      return false;
    }

    if (withdrawTargetConfig.requiresProvider && !withdrawProviderName.trim()) {
      return false;
    }

    if (Boolean(getWithdrawIdentifierError(withdrawTargetType, withdrawAccountIdentifier.trim(), t))) {
      return false;
    }

    if (withdrawNeedsVerification && withdrawVerification.status !== 'success') {
      return false;
    }

    return true;
  }, [
    withdrawAmount,
    balance,
    submittingWithdraw,
    withdrawProviderName,
    withdrawAccountIdentifier,
    withdrawTargetType,
    withdrawTargetConfig.requiresProvider,
    withdrawNeedsVerification,
    withdrawVerification.status,
  ]);

  const doTopup = async (): Promise<void> => {
    if (!user || submittingTopup) {
      return;
    }

    if (topUpValidationError) {
      setTopUpError(topUpValidationError);
      return;
    }

    setSubmittingTopup(true);
    setTopUpError(null);

    try {
      const result = await walletService.topUpWallet(user.id, {
        amountVnd: Number(topUpAmountVnd),
        paymentMethod: topUpMethod,
        note: topUpNote.trim() || undefined,
      });

      setTopUpResult(result);
      showToast({
        type:
          result.status === 'success' ? 'success' : result.status === 'failed' ? 'error' : 'info',
        message: result.message,
      });

      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('wallet.unableToInitializePayment');
      setTopUpError(message);
      showToast({ type: 'error', message });
    } finally {
      setSubmittingTopup(false);
    }
  };

  const verifyWithdrawAccount = async (): Promise<void> => {
    const accountIdentifier = withdrawAccountIdentifier.trim();
    const providerName = withdrawProviderName.trim() || WITHDRAW_DEFAULT_PROVIDER[withdrawTargetType];

    const identifierError = getWithdrawIdentifierError(withdrawTargetType, accountIdentifier, t);
    if (identifierError) {
      setWithdrawErrors({ accountIdentifier: identifierError });
      setWithdrawVerification({
        status: 'error',
        ownerName: '',
        message: t('wallet.unableToVerifyAccount'),
      });
      return;
    }

    setWithdrawErrors({});

    setWithdrawVerification({
      status: 'pending',
      ownerName: '',
      message: t('wallet.verificationPending'),
    });

    try {
      const result = await walletService.verifyPayoutAccount({
        targetType: withdrawTargetType,
        providerName,
        accountIdentifier,
      });

      if (result.status === 'success') {
        setWithdrawVerification({
          status: 'success',
          ownerName: result.ownerName ?? '',
          message: result.message,
        });
        return;
      }

      setWithdrawVerification({
        status: 'error',
        ownerName: '',
        message: result.message || t('wallet.unableToVerifyAccount'),
      });
    } catch {
      setWithdrawVerification({
        status: 'error',
        ownerName: '',
        message: t('wallet.unableToVerifyAccount'),
      });
    }
  };

  useEffect(() => {
    if (!withdrawNeedsVerification) {
      return;
    }

    setWithdrawVerification({
      status: 'idle',
      ownerName: '',
      message: '',
    });
  }, [withdrawNeedsVerification, withdrawTargetType, withdrawProviderName, withdrawAccountIdentifier]);

  const handleSaveLinkedPayoutAccount = async (): Promise<void> => {
    if (!user || !saveLinkedAccountChecked || !lastWithdrawalDraft || savingLinkedAccount) {
      return;
    }

    setSavingLinkedAccount(true);

    try {
      await walletService.upsertLinkedPayoutAccount(user.id, {
        ...lastWithdrawalDraft,
        setAsDefault: true,
      });

      showToast({
        type: 'success',
        message: t('wallet.payoutAccountSaved', { values: { type: getWithdrawTargetConfig(lastWithdrawalDraft.targetType).label } }),
      });

      setShowSaveLinkedAccount(false);
      setSaveLinkedAccountChecked(false);
      setLastWithdrawalDraft(null);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('wallet.unableToSavePayoutAccount');
      showToast({ type: 'error', message });
    } finally {
      setSavingLinkedAccount(false);
    }
  };

  const doWithdraw = async (): Promise<void> => {
    if (!user || submittingWithdraw) {
      return;
    }

    const validation = validateWithdrawForm();
    setWithdrawErrors(validation);

    if (Object.keys(validation).length > 0) {
      return;
    }

    setSubmittingWithdraw(true);

    const providerName = withdrawProviderName.trim() || WITHDRAW_DEFAULT_PROVIDER[withdrawTargetType];
    const accountIdentifier = withdrawAccountIdentifier.trim();
    const amount = Number(withdrawAmount);

    const usingLinkedAccount =
      !withdrawEditingManual &&
      Boolean(linkedAccountForWithdrawTarget) &&
      linkedAccountForWithdrawTarget?.accountIdentifier === accountIdentifier;

    const verificationStatus = usingLinkedAccount
      ? 'success'
      : withdrawVerification.status === 'success'
        ? 'success'
        : withdrawVerification.status === 'pending'
          ? 'pending'
          : 'error';

    const verifiedAccountOwnerName = usingLinkedAccount
      ? linkedAccountForWithdrawTarget?.accountOwnerName
      : withdrawVerification.ownerName;

    try {
      await walletService.withdrawFromWallet(user.id, {
        amount,
        payout: {
          targetType: withdrawTargetType,
          providerName,
          accountIdentifier,
          verifiedAccountOwnerName: verifiedAccountOwnerName || undefined,
          verificationStatus,
          linkedAccountId: usingLinkedAccount ? linkedAccountForWithdrawTarget?.id : undefined,
          source: usingLinkedAccount ? 'linked' : 'manual',
        },
      });

      const submissionDraft: LinkedPayoutAccountInput = {
        targetType: withdrawTargetType,
        providerName,
        accountIdentifier,
        accountOwnerName: verifiedAccountOwnerName || undefined,
      };

      setLastWithdrawalDraft(submissionDraft);

      const existsMatching = linkedPayoutAccounts.some(
        (account) =>
          account.targetType === withdrawTargetType &&
          account.accountIdentifier.trim().toLowerCase() === accountIdentifier.toLowerCase(),
      );

      setShowSaveLinkedAccount(!existsMatching && !usingLinkedAccount);
      setSaveLinkedAccountChecked(!existsMatching && !usingLinkedAccount);
      setWithdrawErrors({});

      showToast({
        type: 'success',
        message: t('toast.withdrawalSubmitted', { values: { amount: formatCoins(amount) } }),
      });
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('wallet.unableToCreateWithdrawal');
      setWithdrawErrors({ general: message });
      showToast({ type: 'error', message });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  /* ── Cancel pending withdrawal ── */
  const handleCancelWithdrawal = async (txId: string): Promise<void> => {
    if (!user || cancellingTxId) return;
    setCancellingTxId(txId);
    try {
      await walletService.cancelPendingWithdrawal(txId, user.id);
      setConfirmCancelTxId(null);
      showToast({ type: 'success', message: t('toast.withdrawalCancelled') });
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('wallet.cancelWithdrawalError');
      showToast({ type: 'error', message });
      setConfirmCancelTxId(null);
    } finally {
      setCancellingTxId(null);
    }
  };

  /* ── Retry failed withdrawal ── */
  const handleRetryWithdrawal = async (txId: string): Promise<void> => {
    if (!user || retryingTxId) return;
    setRetryingTxId(txId);
    try {
      await walletService.retryFailedWithdrawal(txId, user.id);
      showToast({ type: 'success', message: t('toast.withdrawalResubmitted') });
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('wallet.retryWithdrawalError');
      showToast({ type: 'error', message });
    } finally {
      setRetryingTxId(null);
    }
  };

  /* ── Filtered transactions ── */
  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (filterType !== 'all') {
      result = result.filter((t) => t.type === filterType);
    }
    if (filterStatus !== 'all') {
      result = result.filter((t) => t.status === filterStatus);
    }
    return result;
  }, [transactions, filterType, filterStatus]);

  useEffect(() => {
    const deepLinkTxId = searchParams.get('transaction')?.trim() ?? '';
    if (!deepLinkTxId || loading) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('transaction');

    const hasTransaction = transactions.some((entry) => entry.id === deepLinkTxId);
    if (!hasTransaction) {
      showToast({
        type: 'info',
        message: t('wallet.transactionNotFound'),
      });
      setSearchParams(nextParams, { replace: true });
      return;
    }

    setFilterType('all');
    setFilterStatus('all');
    setExpandedTxId(deepLinkTxId);
    setSearchParams(nextParams, { replace: true });
  }, [loading, searchParams, setSearchParams, showToast, transactions]);

  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all';

  const handleExportTransactions = (): void => {
    if (filteredTransactions.length === 0) {
      showToast({
        type: 'info',
        message: t('wallet.noTransactionsExport'),
      });
      return;
    }

    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      showToast({ type: 'error', message: t('wallet.csvExportError') });
      return;
    }

    try {
      const csv = buildWalletTransactionsCsv(filteredTransactions);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);

      anchor.href = downloadUrl;
      anchor.download = `wallet-transactions-${today}.csv`;
      anchor.style.display = 'none';

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      const noun = filteredTransactions.length === 1 ? 'transaction' : 'transactions';
      showToast({
        type: 'success',
        message: t('toast.csvExported', { values: { count: filteredTransactions.length, noun } }),
      });
    } catch {
      showToast({ type: 'error', message: t('wallet.exportError') });
    }
  };

  if (loading) {
    return <LoadingState title={t('wallet.loadingWallet')} description={t('wallet.loadingWalletDescription')} />;
  }

  if (loadError) {
    return (
      <EmptyState
        title={t('wallet.unableToLoadWallet')}
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Retry
          </button>
        }
      />
    );
  }

  const topUpResultMeta = topUpResult ? TOP_UP_RESULT_META[topUpResult.status] : null;
  const withdrawIdentifierError = getWithdrawIdentifierError(
    withdrawTargetType,
    withdrawAccountIdentifier.trim(),
    t,
  );
  const canTriggerWithdrawVerification =
    !submittingWithdraw &&
    withdrawVerification.status !== 'pending' &&
    Boolean(withdrawAccountIdentifier.trim()) &&
    !(withdrawTargetConfig.requiresProvider && !withdrawProviderName.trim()) &&
    !withdrawIdentifierError;

  return (
    <div className="flex flex-col gap-10 pb-20">
      <div className="flex flex-col items-end justify-between gap-6 md:flex-row">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight">{t('wallet.title')}</h1>
          <p className="text-slate-500">{t('wallet.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700 dark:bg-slate-900"
        >
          <RefreshCcw size={16} /> {t('wallet.refresh')}
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-primary p-10 text-white shadow-2xl xl:col-span-1">
          <div className="absolute right-0 top-0 -mr-10 -mt-10 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                <Wallet size={28} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest opacity-70">{t('wallet.currentBalance')}</span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black">{formatCoins(balance)}</span>
                <span className="text-xl font-bold opacity-80">{t('wallet.coins')}</span>
              </div>
              <p className="text-sm font-medium opacity-80">{t('wallet.conversionNote', { values: { amount: formatVnd(balance * 100) } })}</p>
            </div>

            <div className="grid gap-3 border-t border-white/10 pt-6 text-sm">
              <div className="flex items-center justify-between">
                <span className="opacity-70">{t('wallet.incomingThisMonth')}</span>
                <span className="font-black">+{formatCoins(thisMonthIncome)} coins</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-70">{t('wallet.completedIncoming')}</span>
                <span className="font-black">+{formatCoins(totalCompletedIncoming)} coins</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-70">{t('wallet.pendingPayout')}</span>
                <span className="font-black">{formatCoins(pendingWithdrawTotal)} coins</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-70">{t('wallet.topupPendingFailed')}</span>
                <span className="font-black">
                  {pendingTopUpCount} / {failedTopUpCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">{t('wallet.earningsOverview')}</h3>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-300">
              {t('wallet.updatedOnRefresh')}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.payoutReadyBalance')}</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{formatCoins(balance)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.pendingWithdrawals')}</p>
              <p className="mt-2 text-2xl font-black text-amber-300">{formatCoins(pendingWithdrawTotal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.completedPayouts')}</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{completedWithdrawCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.failedPayoutPayments')}</p>
              <p className="mt-2 text-2xl font-black text-rose-300">{failedWithdrawCount + failedTopUpCount}</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="coins" radius={[6, 6, 0, 0]}>
                  {analytics.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={index === analytics.length - 1 ? '#4f46e5' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <section className="grid gap-8 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-black tracking-tight">{t('wallet.topUpWallet')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('wallet.topUpDescription')}
              </p>
            </div>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary">
              1.000đ = 10 coins
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Amount (VND)
                <input
                  type="text"
                  inputMode="numeric"
                  value={topUpAmountVnd}
                  onChange={(event) => {
                    const numericOnly = event.target.value.replace(/[^0-9]/g, '');
                    setTopUpAmountVnd(numericOnly);
                    setTopUpError(null);
                  }}
                  placeholder="e.g. 200000"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Min: {formatVnd(topUpLimits.minVnd)} • Max: {formatVnd(topUpLimits.maxVnd)}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('wallet.optionalSuggestions')}</p>
                <div className="flex flex-wrap gap-2">
                  {TOP_UP_SUGGESTIONS_VND.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setTopUpAmountVnd(String(suggestion));
                        setTopUpError(null);
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold transition hover:border-primary dark:border-slate-700"
                    >
                      {formatVnd(suggestion)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('wallet.paymentMethod')}</p>
                <div className="grid gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => {
                        setTopUpMethod(method.value);
                        setTopUpError(null);
                      }}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        topUpMethod === method.value
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-primary/50 dark:border-slate-700'
                      }`}
                    >
                      <span className="mt-0.5 text-primary">{method.icon}</span>
                      <span>
                        <span className="block text-sm font-bold">{method.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{method.helper}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {t('wallet.paymentNote')}
                <textarea
                  rows={3}
                  value={topUpNote}
                  onChange={(event) => {
                    setTopUpNote(event.target.value);
                    setTopUpError(null);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                  placeholder="Example: company card top-up"
                />
              </label>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.conversionSummary')}</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t('wallet.enteredAmount')}</span>
                    <span className="font-black">{formatVnd(topUpPreview.amountVnd)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t('wallet.conversionRate')}</span>
                    <span className="font-black">{topUpPreview.conversionRateLabel}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">{t('wallet.coinsToReceive')}</span>
                    <span className="text-lg font-black text-primary">{formatCoins(topUpPreview.coins)} coins</span>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  topUpResultMeta
                    ? topUpResultMeta.panelClassName
                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{t('wallet.latestPaymentResult')}</p>
                {topUpResult ? (
                  <>
                    <div className="mt-2 flex items-center gap-2 text-sm font-black">
                      {topUpResultMeta?.icon}
                      {topUpResultMeta?.title}
                    </div>
                    <p className="mt-2 text-sm opacity-90">{topUpResult.message}</p>
                    <div className="mt-3 grid gap-2 text-xs opacity-90 md:grid-cols-2">
                      <span>Method: {toPaymentMethodLabel(topUpResult.paymentMethod)}</span>
                      <span>Payment ref: {topUpResult.paymentRef}</span>
                      <span>Amount: {formatVnd(topUpResult.amountVnd)}</span>
                      <span>Coins: {formatCoins(topUpResult.coins)}</span>
                      <span>
                        Wallet tx status:{' '}
                        {(STATUS_META[topUpResult.transaction.status] ?? STATUS_META.pending).label}
                      </span>
                      <span>Recorded: {toDateTimeLabel(topUpResult.transaction.date)}</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm opacity-90">
                    {t('wallet.noTopupAttempted')}
                  </p>
                )}
              </div>

              {topUpError ? (
                <div className="flex items-start gap-2 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200">
                  <AlertCircle size={14} className="mt-0.5" />
                  <span>{topUpError}</span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  void doTopup();
                }}
                disabled={!canSubmitTopUp}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submittingTopup ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {submittingTopup ? t('wallet.processingPayment') : `${t('wallet.proceedTo')} ${toPaymentMethodLabel(topUpMethod)}`}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70 xl:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-200">{t('wallet.withdraw')}</h3>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('wallet.secondaryAction')}
              </p>
            </div>
            <Link
              to="/payout-accounts"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {t('wallet.managePayoutAccounts')} <ExternalLink size={12} />
            </Link>
          </div>

          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('wallet.linkedPayoutAccounts')}
                </p>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {linkedPayoutAccounts.length} linked
                </span>
              </div>

              <div className="mt-2 grid gap-2">
                {WITHDRAW_TARGET_OPTIONS.map((option) => {
                  const targetAccounts = linkedAccountsByTarget[option.value] ?? [];
                  const defaultAccount =
                    targetAccounts.find((account) => account.isDefault) ?? targetAccounts[0] ?? null;

                  return (
                    <div
                      key={option.value}
                      className={`rounded-lg border px-2.5 py-2 ${
                        option.value === withdrawTargetType
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {option.label}
                        </span>
                        {defaultAccount ? (
                          <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            {t('wallet.default')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">{t('wallet.noLinked')}</span>
                        )}
                      </div>
                      {defaultAccount ? (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {defaultAccount.providerName} •{' '}
                          {maskPayoutIdentifier(option.value, defaultAccount.accountIdentifier, t)}
                          <br />
                          {defaultAccount.accountOwnerName}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('wallet.amountCoins')}
              <input
                type="number"
                min={1}
                value={withdrawAmount}
                onChange={(event) => {
                  setWithdrawAmount(event.target.value);
                  setWithdrawErrors({});
                }}
                className={`h-10 rounded-lg border bg-white px-3 text-sm font-medium outline-none transition focus:border-primary dark:bg-slate-800 ${
                  withdrawErrors.amount ? 'border-rose-400/60' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {withdrawErrors.amount ? <span className="text-[11px] text-rose-300">{withdrawErrors.amount}</span> : null}
              {withdrawPayoutVnd ? (
                <span className="text-[11px] normal-case text-slate-500 dark:text-slate-400">
                  {t('wallet.equivalentPayout', { values: { amount: formatVnd(withdrawPayoutVnd) } })}
                </span>
              ) : (
                <span className="text-[11px] normal-case text-slate-400 dark:text-slate-500">
                  {t('wallet.enterCoinAmountPreview')}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('wallet.payoutTarget')}
              <select
                value={withdrawTargetType}
                onChange={(event) => {
                  setWithdrawTargetType(event.target.value as WithdrawPayoutTargetType);
                  setWithdrawErrors({});
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
              >
                {WITHDRAW_TARGET_OPTIONS.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>

            {linkedAccountForWithdrawTarget && !withdrawEditingManual ? (
              <div className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2.5 text-xs">
                <p className="font-bold text-emerald-100">
                  {t('wallet.usingLinkedAccount', { values: { type: withdrawTargetConfig.label } })}
                </p>
                <p className="mt-1 text-emerald-100/90">
                  {linkedAccountForWithdrawTarget.providerName} •{' '}
                  {maskPayoutIdentifier(withdrawTargetType, linkedAccountForWithdrawTarget.accountIdentifier, t)}
                </p>
                <p className="text-emerald-100/80">
                  {t('wallet.accountOwner')}: {linkedAccountForWithdrawTarget.accountOwnerName}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawEditingManual(true);
                    setWithdrawProviderName(
                      linkedAccountForWithdrawTarget.providerName ||
                        WITHDRAW_DEFAULT_PROVIDER[withdrawTargetType],
                    );
                    setWithdrawAccountIdentifier(linkedAccountForWithdrawTarget.accountIdentifier);
                    setWithdrawVerification({
                      status: 'idle',
                      ownerName: '',
                      message: '',
                    });
                    setWithdrawErrors({});
                  }}
                  className="mt-2 text-[11px] font-semibold text-emerald-200 underline-offset-2 hover:underline"
                >
                  {t('wallet.changeAccount')}
                </button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {linkedAccountForWithdrawTarget
                      ? t('wallet.manualOverrideNote')
                      : t('wallet.noLinkedAccountYet', { values: { type: withdrawTargetConfig.label.toLowerCase() } })}
                  </p>
                  {linkedAccountForWithdrawTarget ? (
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawEditingManual(false);
                        setWithdrawErrors({});
                      }}
                      className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {t('wallet.useLinkedAccount')}
                    </button>
                  ) : null}
                </div>

                {withdrawTargetType === 'bank' ? (
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {withdrawTargetConfig.providerLabel}
                    <select
                      value={withdrawProviderName}
                      onChange={(event) => {
                        setWithdrawProviderName(event.target.value);
                        setWithdrawErrors({});
                      }}
                      className={`h-9 rounded-lg border bg-white px-3 text-sm font-medium normal-case outline-none transition focus:border-primary dark:bg-slate-900 ${
                        withdrawErrors.providerName
                          ? 'border-rose-400/60'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {BANK_PROVIDER_OPTIONS.map((bankOption) => (
                        <option key={bankOption} value={bankOption}>
                          {bankOption}
                        </option>
                      ))}
                    </select>
                    {withdrawErrors.providerName ? (
                      <span className="text-[11px] normal-case text-rose-300">{withdrawErrors.providerName}</span>
                    ) : null}
                  </label>
                ) : null}

                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {withdrawTargetConfig.identifierLabel}
                  <input
                    type={withdrawTargetType === 'paypal' ? 'email' : 'text'}
                    inputMode={withdrawTargetType === 'paypal' ? 'email' : 'text'}
                    value={withdrawAccountIdentifier}
                    onChange={(event) => {
                      setWithdrawAccountIdentifier(event.target.value);
                      setWithdrawErrors({});
                    }}
                    placeholder={withdrawTargetConfig.identifierPlaceholder}
                    className={`h-9 rounded-lg border bg-white px-3 text-sm font-medium normal-case outline-none transition focus:border-primary dark:bg-slate-900 ${
                      withdrawErrors.accountIdentifier
                        ? 'border-rose-400/60'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {withdrawErrors.accountIdentifier ? (
                    <span className="text-[11px] normal-case text-rose-300">
                      {withdrawErrors.accountIdentifier}
                    </span>
                  ) : (
                    <span className="text-[11px] normal-case text-slate-400 dark:text-slate-500">
                      {withdrawTargetConfig.helperText}
                    </span>
                  )}
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setWithdrawErrors({});
                    void verifyWithdrawAccount();
                  }}
                  disabled={!canTriggerWithdrawVerification}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {withdrawVerification.status === 'pending' ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  {withdrawVerification.status === 'pending' ? t('wallet.verificationPending') : t('wallet.verifyAccount')}
                </button>

                {withdrawVerification.status === 'pending' ? (
                  <p className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                    <Clock3 size={12} /> {t('wallet.verificationPending')}
                  </p>
                ) : null}

                {withdrawVerification.status === 'success' ? (
                  <p className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                    <CheckCircle2 size={12} /> {t('wallet.accountOwner')}: {withdrawVerification.ownerName || t('wallet.verified')}
                  </p>
                ) : null}

                {withdrawVerification.status === 'error' ? (
                  <p className="inline-flex items-center gap-1 text-[11px] text-rose-300">
                    <AlertCircle size={12} /> {t('wallet.unableToVerifyAccount')}
                  </p>
                ) : null}
              </div>
            )}

            {withdrawErrors.general ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200">
                <AlertCircle size={14} className="mt-0.5" />
                <span>{withdrawErrors.general}</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void doWithdraw();
              }}
              disabled={!canSubmitWithdraw}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submittingWithdraw ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
              {t('wallet.submitRequest')}
            </button>

            {showSaveLinkedAccount && lastWithdrawalDraft ? (
              <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                <label className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={saveLinkedAccountChecked}
                    onChange={(event) => {
                      setSaveLinkedAccountChecked(event.target.checked);
                    }}
                    className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-900"
                  />
                  <span>{t('wallet.saveLinkedAccountPrompt')}</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveLinkedPayoutAccount();
                  }}
                  disabled={!saveLinkedAccountChecked || savingLinkedAccount}
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-primary/40 px-3 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingLinkedAccount ? <Loader2 size={14} className="animate-spin" /> : null}
                  {savingLinkedAccount ? t('wallet.saving') : t('wallet.saveLinkedAccount')}
                </button>
              </div>
            ) : null}

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('wallet.available')}: {formatCoins(balance)} {t('wallet.coins')} • {t('wallet.reviewNote')}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-8 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-xl font-bold">
            <History size={22} className="text-slate-400" /> {t('wallet.transactionHistory')}
          </h3>
          <button
            type="button"
            onClick={handleExportTransactions}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-1 text-sm font-bold text-primary transition hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:disabled:text-slate-500"
          >
            {t('wallet.downloadReport')} <Download size={16} />
          </button>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-8 py-4 dark:border-slate-800">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as WalletTransactionType | 'all')}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All types</option>
            <option value="sale">Sale</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="purchase">Purchase</option>
            <option value="bonus">Bonus</option>
            <option value="topup">Top-up</option>
            <option value="refund">Refund</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as WalletTransactionStatus | 'all')}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => { setFilterType('all'); setFilterStatus('all'); }}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <X size={14} /> {t('wallet.clearFilters')}
            </button>
          ) : null}
          <span className="ml-auto text-xs font-medium text-slate-400">
            {filteredTransactions.length} of {transactions.length} transactions
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={hasActiveFilters ? t('wallet.noMatchingTransactions') : t('wallet.noWalletActivity')}
              description={hasActiveFilters ? t('wallet.adjustFiltersHint') : t('wallet.topUpOrSellHint')}
              action={hasActiveFilters ? (
                <button type="button" onClick={() => { setFilterType('all'); setFilterStatus('all'); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
                  {t('wallet.clearFilters')}
                </button>
              ) : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800/50">
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Description</th>
                  <th className="px-8 py-4">Context</th>
                  <th className="px-8 py-4">Type</th>
                  <th className="px-8 py-4">Amount</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.map((entry) => {
                  const statusMeta = STATUS_META[entry.status] ?? STATUS_META.pending;
                  const isExpanded = expandedTxId === entry.id;
                  const isPendingWithdrawal = entry.type === 'withdrawal' && entry.status === 'pending';
                  const isFailedWithdrawal = entry.type === 'withdrawal' && entry.status === 'failed';
                  const isConfirmingCancel = confirmCancelTxId === entry.id;
                  const isCancelling = cancellingTxId === entry.id;
                  const isRetrying = retryingTxId === entry.id;

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        onClick={() => setExpandedTxId((current) => current === entry.id ? null : entry.id)}
                      >
                        <td className="px-8 py-5 text-sm font-medium text-slate-500">
                          <div className="flex flex-col">
                            <span>{toDateTimeLabel(entry.date)}</span>
                            <span className="text-xs text-slate-400">{formatRelativeDate(entry.date)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-sm">
                          <p className="font-bold">{entry.description}</p>
                          {entry.note ? <p className="mt-1 text-xs text-slate-500">{entry.note}</p> : null}
                        </td>
                        <td className="px-8 py-5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {toContextLabel(entry)}
                        </td>
                        <td className="px-8 py-5">
                          <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800">
                            {toTransactionTypeLabel(entry.type)}
                          </span>
                        </td>
                        <td className={`px-8 py-5 text-sm font-black ${toAmountClassName(entry)}`}>
                          {entry.amount > 0 ? `+${formatCoins(entry.amount)}` : formatCoins(entry.amount)} Coins
                        </td>
                        <td className="px-8 py-5">
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${statusMeta.chipClassName}`}>
                            <span className={`size-2 rounded-full ${statusMeta.dotClassName}`} />
                            {statusMeta.icon}
                            {statusMeta.label}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded ? (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/50 px-8 py-4 dark:bg-slate-800/20">
                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.transactionId')}</p>
                                <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{entry.id}</p>
                              </div>
                              {entry.target ? (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.target')}</p>
                                  <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{entry.target}</p>
                                </div>
                              ) : null}
                              {entry.contextType ? (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.contextType')}</p>
                                  <p className="mt-1 text-xs font-medium capitalize text-slate-600 dark:text-slate-300">{entry.contextType}</p>
                                </div>
                              ) : null}
                              {entry.contextId ? (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.contextId')}</p>
                                  <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{entry.contextId}</p>
                                </div>
                              ) : null}
                              {entry.note ? (
                                <div className="md:col-span-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.note')}</p>
                                  <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{entry.note}</p>
                                </div>
                              ) : null}
                            </div>

                            {/* Action buttons for withdrawals */}
                            <div className="mt-3 flex items-center gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                              {isPendingWithdrawal ? (
                                isConfirmingCancel ? (
                                  <span className="inline-flex items-center gap-2">
                                    <AlertCircle size={14} className="text-rose-400" />
                                    <span className="text-xs font-medium text-rose-400">{t('wallet.cancelWithdrawalConfirm')}</span>
                                    <button
                                      type="button"
                                      disabled={isCancelling}
                                      onClick={(e) => { e.stopPropagation(); void handleCancelWithdrawal(entry.id); }}
                                      className="text-xs font-bold text-rose-500 hover:underline disabled:opacity-60"
                                    >
                                      {isCancelling ? t('wallet.cancelling') : t('wallet.yesCancel')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setConfirmCancelTxId(null); }}
                                      className="text-xs font-bold text-slate-400 hover:underline"
                                    >
                                      No
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setConfirmCancelTxId(entry.id); }}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20"
                                  >
                                    <XCircle size={14} /> {t('wallet.cancelWithdrawal')}
                                  </button>
                                )
                              ) : null}

                              {isFailedWithdrawal ? (
                                <button
                                  type="button"
                                  disabled={isRetrying}
                                  onClick={(e) => { e.stopPropagation(); void handleRetryWithdrawal(entry.id); }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-60"
                                >
                                  <Repeat size={14} /> {isRetrying ? t('wallet.retrying') : t('wallet.retryWithdrawal')}
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const deepLink = `${window.location.origin}/wallet?transaction=${encodeURIComponent(entry.id)}`;
                                  if (!navigator.clipboard) {
                                    showToast({ type: 'error', message: 'Clipboard is not available in this browser context.' });
                                    return;
                                  }
                                  void navigator.clipboard
                                    .writeText(deepLink)
                                    .then(() => showToast({ type: 'success', message: t('wallet.linkCopied') }))
                                    .catch(() => showToast({ type: 'error', message: t('wallet.linkCopyError') }));
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition-colors hover:text-primary"
                              >
                                <ExternalLink size={14} /> {t('wallet.copyLink')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
