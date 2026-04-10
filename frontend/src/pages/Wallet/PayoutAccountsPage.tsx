import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit3,
  ExternalLink,
  Loader2,
  Plus,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { walletService } from '../../services/walletService';
import { useToast } from '../../app/providers/ToastProvider';
import { LinkedPayoutAccount, WithdrawPayoutTargetType } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';

/* ─────────────────────── Constants ─────────────────────── */

type PayoutMethodConfig = {
  value: WithdrawPayoutTargetType;
  label: string;
  icon: React.ReactNode;
  color: string;
  badgeClass: string;
  providerLabel: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  helperText: string;
  requiresProvider: boolean;
};

const PAYOUT_METHODS: PayoutMethodConfig[] = [
  {
    value: 'bank',
    label: 'Bank Transfer',
    icon: <Building2 size={16} />,
    color: 'text-blue-400',
    badgeClass: 'border-blue-300/40 bg-blue-500/10 text-blue-300',
    providerLabel: 'Bank name',
    identifierLabel: 'Account number',
    identifierPlaceholder: 'e.g. 0123456789',
    helperText: 'Use your payout-ready bank account number (8–20 digits).',
    requiresProvider: true,
  },
  {
    value: 'momo',
    label: 'MoMo Wallet',
    icon: <Smartphone size={16} />,
    color: 'text-rose-400',
    badgeClass: 'border-rose-300/40 bg-rose-500/10 text-rose-300',
    providerLabel: 'Provider',
    identifierLabel: 'Phone number / Wallet ID',
    identifierPlaceholder: 'e.g. 0901234567',
    helperText: 'Your MoMo-linked phone number or wallet ID.',
    requiresProvider: false,
  },
  {
    value: 'paypal',
    label: 'PayPal',
    icon: <CreditCard size={16} />,
    color: 'text-indigo-400',
    badgeClass: 'border-indigo-300/40 bg-indigo-500/10 text-indigo-300',
    providerLabel: 'Provider',
    identifierLabel: 'PayPal email',
    identifierPlaceholder: 'e.g. teacher@paypal.com',
    helperText: 'The PayPal email that can receive international payouts.',
    requiresProvider: false,
  },
];

const BANK_OPTIONS = [
  'Vietcombank',
  'BIDV',
  'VietinBank',
  'Techcombank',
  'ACB',
  'MB Bank',
] as const;

const DEFAULT_PROVIDER: Record<WithdrawPayoutTargetType, string> = {
  bank: 'Vietcombank',
  momo: 'MoMo Wallet',
  paypal: 'PayPal',
};

const PAYPAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BANK_ACCOUNT_REGEX = /^\d{8,20}$/;
const MOMO_PHONE_REGEX = /^\d{9,12}$/;
const MOMO_WALLET_ID_REGEX = /^[a-zA-Z0-9._-]{6,32}$/;

/* ─────────────────────── Helpers ─────────────────────── */

const getMethodConfig = (
  targetType: WithdrawPayoutTargetType,
): PayoutMethodConfig =>
  PAYOUT_METHODS.find((m) => m.value === targetType) ?? PAYOUT_METHODS[0];

const getIdentifierError = (
  targetType: WithdrawPayoutTargetType,
  identifier: string,
): string | null => {
  if (!identifier) return 'Account identifier is required.';
  if (targetType === 'bank' && !BANK_ACCOUNT_REGEX.test(identifier))
    return 'Bank account: 8-20 digits required.';
  if (
    targetType === 'momo' &&
    !MOMO_PHONE_REGEX.test(identifier) &&
    !MOMO_WALLET_ID_REGEX.test(identifier)
  )
    return 'Enter a valid MoMo phone number or wallet ID.';
  if (targetType === 'paypal' && !PAYPAL_EMAIL_REGEX.test(identifier))
    return 'Enter a valid PayPal email address.';
  return null;
};

const maskIdentifier = (
  targetType: WithdrawPayoutTargetType,
  identifier: string,
): string => {
  const v = identifier.trim();
  if (!v) return '—';
  if (targetType === 'bank') return `•••• ${v.slice(-4)}`;
  if (targetType === 'momo') {
    if (v.length <= 5) return v;
    return `${v.slice(0, 3)}••••${v.slice(-2)}`;
  }
  const [local, domain] = v.split('@');
  if (!domain || local.length < 3) return v;
  return `${local.slice(0, 2)}••••@${domain}`;
};

type VerificationState = {
  status: 'idle' | 'pending' | 'success' | 'error';
  ownerName: string;
  message: string;
};

const IDLE_VERIFICATION: VerificationState = {
  status: 'idle',
  ownerName: '',
  message: '',
};

/* ─────────────────────── Page Component ─────────────────────── */

export const PayoutAccountsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  /* ── Data ── */
  const [accounts, setAccounts] = useState<LinkedPayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* ── CRUD busy flags ── */
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* ── Form ── */
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LinkedPayoutAccount | null>(null);
  const [formMethod, setFormMethod] = useState<WithdrawPayoutTargetType>('bank');
  const [formProvider, setFormProvider] = useState(DEFAULT_PROVIDER.bank);
  const [formIdentifier, setFormIdentifier] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  /* ── Verification ── */
  const [verification, setVerification] = useState<VerificationState>(IDLE_VERIFICATION);

  const methodConfig = useMemo(() => getMethodConfig(formMethod), [formMethod]);

  /* ── Data fetching ── */
  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await walletService.listLinkedPayoutAccounts(user.id);
      setAccounts(data);
      setLoadError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load payout accounts';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  /* ── Form helpers ── */
  const resetForm = () => {
    setShowForm(false);
    setEditingAccount(null);
    setFormMethod('bank');
    setFormProvider(DEFAULT_PROVIDER.bank);
    setFormIdentifier('');
    setFormErrors({});
    setVerification(IDLE_VERIFICATION);
  };

  const openAddForm = (method?: WithdrawPayoutTargetType) => {
    const m = method ?? 'bank';
    setEditingAccount(null);
    setFormMethod(m);
    setFormProvider(DEFAULT_PROVIDER[m]);
    setFormIdentifier('');
    setFormErrors({});
    setVerification(IDLE_VERIFICATION);
    setShowForm(true);
  };

  const openEditForm = (account: LinkedPayoutAccount) => {
    setEditingAccount(account);
    setFormMethod(account.targetType);
    setFormProvider(account.providerName || DEFAULT_PROVIDER[account.targetType]);
    setFormIdentifier(account.accountIdentifier);
    setFormErrors({});
    setVerification(
      account.accountOwnerName
        ? { status: 'success', ownerName: account.accountOwnerName, message: 'Previously verified.' }
        : IDLE_VERIFICATION,
    );
    setShowForm(true);
  };

  /* ── Verification ── */
  const doVerify = async () => {
    const identifier = formIdentifier.trim();
    const provider = formProvider.trim() || DEFAULT_PROVIDER[formMethod];

    const idErr = getIdentifierError(formMethod, identifier);
    if (idErr) {
      setFormErrors({ identifier: idErr });
      setVerification({ status: 'error', ownerName: '', message: 'Invalid identifier' });
      return;
    }

    setFormErrors({});
    setVerification({ status: 'pending', ownerName: '', message: 'Verifying account...' });

    try {
      const result = await walletService.verifyPayoutAccount({
        targetType: formMethod,
        providerName: provider,
        accountIdentifier: identifier,
      });

      if (result.status === 'success') {
        setVerification({
          status: 'success',
          ownerName: result.ownerName ?? '',
          message: result.message,
        });
      } else {
        setVerification({
          status: 'error',
          ownerName: '',
          message: result.message || 'Unable to verify this account',
        });
      }
    } catch {
      setVerification({
        status: 'error',
        ownerName: '',
        message: 'Unable to verify this account',
      });
    }
  };

  /* ── Save / Update ── */
  const handleSave = async () => {
    if (!user || saving) return;

    const identifier = formIdentifier.trim();
    const provider = formProvider.trim() || DEFAULT_PROVIDER[formMethod];

    const idErr = getIdentifierError(formMethod, identifier);
    if (idErr) {
      setFormErrors({ identifier: idErr });
      return;
    }

    if (methodConfig.requiresProvider && !provider) {
      setFormErrors({ provider: 'Provider is required.' });
      return;
    }

    if (verification.status !== 'success') {
      setFormErrors({ general: 'Please verify the account before saving.' });
      return;
    }

    setSaving(true);
    try {
      await walletService.upsertLinkedPayoutAccount(user.id, {
        targetType: formMethod,
        providerName: provider,
        accountIdentifier: identifier,
        accountOwnerName: verification.ownerName || undefined,
        setAsDefault: editingAccount?.isDefault ?? accounts.filter((a) => a.targetType === formMethod).length === 0,
      });

      showToast({
        type: 'success',
        message: editingAccount ? 'Payout account updated.' : 'Payout account added.',
      });

      resetForm();
      await fetchAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save payout account';
      setFormErrors({ general: msg });
      showToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (accountId: string) => {
    if (!user) return;
    setDeletingId(accountId);
    try {
      await walletService.deleteLinkedPayoutAccount(user.id, accountId);
      showToast({ type: 'success', message: 'Payout account removed.' });
      setConfirmDeleteId(null);
      await fetchAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to remove account';
      showToast({ type: 'error', message: msg });
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Set default ── */
  const handleSetDefault = async (accountId: string) => {
    if (!user) return;
    setSettingDefaultId(accountId);
    try {
      await walletService.setDefaultLinkedPayoutAccount(user.id, accountId);
      showToast({ type: 'success', message: 'Default payout account updated.' });
      await fetchAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update default';
      showToast({ type: 'error', message: msg });
    } finally {
      setSettingDefaultId(null);
    }
  };

  /* ── Derived ── */
  const accountsByMethod = useMemo(() => {
    const grouped: Record<WithdrawPayoutTargetType, LinkedPayoutAccount[]> = {
      bank: [],
      momo: [],
      paypal: [],
    };
    accounts.forEach((a) => {
      grouped[a.targetType] = [...(grouped[a.targetType] || []), a];
    });
    return grouped;
  }, [accounts]);

  const canVerify =
    verification.status !== 'pending' &&
    Boolean(formIdentifier.trim()) &&
    !(methodConfig.requiresProvider && !formProvider.trim());

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <LoadingState
        title="Loading payout accounts"
        description="Fetching your saved withdrawal methods..."
      />
    );
  }

  if (loadError) {
    return (
      <EmptyState
        title="Unable to load payout accounts"
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void fetchAccounts();
            }}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            to="/wallet"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg text-sm font-semibold text-primary transition hover:underline"
          >
            <ArrowLeft size={14} /> Back to Wallet
          </Link>
          <h1 className="text-3xl font-black tracking-tight">Manage Payout Accounts</h1>
          <p className="max-w-lg text-sm font-medium text-slate-500 dark:text-slate-400">
            These accounts are used when you withdraw coins from your wallet. You can add, verify,
            and set a default account for each payout method.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAddForm()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-md transition hover:bg-primary-hover"
        >
          <Plus size={16} /> Add payout account
        </button>
      </div>

      {/* ── Account cards by method ── */}
      {accounts.length === 0 && !showForm ? (
        <EmptyState
          title="No payout accounts yet"
          description="Add your first payout account to start receiving withdrawals."
          action={
            <button
              type="button"
              onClick={() => openAddForm()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover"
            >
              <Plus size={16} /> Add payout account
            </button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {PAYOUT_METHODS.map((method) => {
            const methodAccounts = accountsByMethod[method.value] ?? [];
            if (methodAccounts.length === 0) return null;

            return (
              <section key={method.value} className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={method.color}>{method.icon}</span>
                  <h2 className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-200">
                    {method.label}
                  </h2>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {methodAccounts.length} {methodAccounts.length === 1 ? 'account' : 'accounts'}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {methodAccounts.map((account) => {
                    const cfg = getMethodConfig(account.targetType);
                    const isDeleting = deletingId === account.id;
                    const isSettingDefault = settingDefaultId === account.id;
                    const isConfirmingDelete = confirmDeleteId === account.id;

                    return (
                      <div
                        key={account.id}
                        className={`group relative flex flex-col gap-3 rounded-2xl border p-5 transition ${
                          account.isDefault
                            ? 'border-primary/30 bg-primary/[0.02] shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Badge row */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.badgeClass}`}
                          >
                            {cfg.icon} {cfg.label}
                          </span>
                          {account.isDefault ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                              <Star size={10} /> Default
                            </span>
                          ) : null}
                        </div>

                        {/* Account details */}
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-bold text-slate-800 dark:text-white">
                            {account.providerName}
                          </p>
                          <p className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {maskIdentifier(account.targetType, account.accountIdentifier)}
                          </p>
                          {account.accountOwnerName ? (
                            <p className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                              <CheckCircle2 size={12} /> {account.accountOwnerName}
                            </p>
                          ) : (
                            <p className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                              <Clock3 size={12} /> Owner not verified
                            </p>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          Updated {new Date(account.updatedAt).toLocaleDateString()}
                        </p>

                        {/* Actions */}
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2">
                            <AlertCircle size={14} className="text-rose-400" />
                            <span className="flex-1 text-xs font-medium text-rose-300">
                              Remove this account?
                            </span>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => void handleDelete(account.id)}
                              className="inline-flex h-7 items-center gap-1 rounded-lg bg-rose-500 px-2.5 text-[11px] font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
                            >
                              {isDeleting ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                              Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] font-semibold text-slate-400 hover:text-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                            {!account.isDefault ? (
                              <button
                                type="button"
                                disabled={isSettingDefault}
                                onClick={() => void handleSetDefault(account.id)}
                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-primary hover:text-primary disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {isSettingDefault ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Star size={12} />
                                )}
                                Set default
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => openEditForm(account)}
                              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                              <Edit3 size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(account.id)}
                              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-rose-400"
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Form ── */}
      {showForm ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight">
              {editingAccount ? 'Edit Payout Account' : 'Add Payout Account'}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm font-semibold text-slate-400 transition hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-5">
            {/* Method picker */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Payout method
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {PAYOUT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={Boolean(editingAccount)}
                    onClick={() => {
                      setFormMethod(m.value);
                      setFormProvider(DEFAULT_PROVIDER[m.value]);
                      setFormIdentifier('');
                      setFormErrors({});
                      setVerification(IDLE_VERIFICATION);
                    }}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      formMethod === m.value
                        ? 'border-primary/40 bg-primary/5 text-primary'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider (bank selector) */}
            {formMethod === 'bank' ? (
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {methodConfig.providerLabel}
                <select
                  value={formProvider}
                  onChange={(e) => {
                    setFormProvider(e.target.value);
                    setFormErrors({});
                    setVerification(IDLE_VERIFICATION);
                  }}
                  className={`h-11 rounded-xl border bg-white px-3 text-sm font-medium normal-case outline-none transition focus:border-primary dark:bg-slate-800 ${
                    formErrors.provider
                      ? 'border-rose-400/60'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {BANK_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {formErrors.provider ? (
                  <span className="text-[11px] normal-case text-rose-400">
                    {formErrors.provider}
                  </span>
                ) : null}
              </label>
            ) : null}

            {/* Identifier */}
            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {methodConfig.identifierLabel}
              <input
                type={formMethod === 'paypal' ? 'email' : 'text'}
                inputMode={formMethod === 'paypal' ? 'email' : 'text'}
                value={formIdentifier}
                onChange={(e) => {
                  setFormIdentifier(e.target.value);
                  setFormErrors({});
                  setVerification(IDLE_VERIFICATION);
                }}
                placeholder={methodConfig.identifierPlaceholder}
                className={`h-11 rounded-xl border bg-white px-3 text-sm font-medium normal-case outline-none transition focus:border-primary dark:bg-slate-800 ${
                  formErrors.identifier
                    ? 'border-rose-400/60'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {formErrors.identifier ? (
                <span className="text-[11px] normal-case text-rose-400">
                  {formErrors.identifier}
                </span>
              ) : (
                <span className="text-[11px] normal-case text-slate-400 dark:text-slate-500">
                  {methodConfig.helperText}
                </span>
              )}
            </label>

            {/* Verify button */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void doVerify()}
                disabled={!canVerify}
                className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {verification.status === 'pending' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {verification.status === 'pending'
                  ? 'Verifying account...'
                  : 'Verify account'}
              </button>

              {/* Verification result */}
              {verification.status === 'pending' ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                  <Clock3 size={13} /> Verifying account details...
                </p>
              ) : null}

              {verification.status === 'success' ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                  <CheckCircle2 size={13} />{' '}
                  {verification.ownerName
                    ? `Account owner: ${verification.ownerName}`
                    : 'Account verified'}
                </p>
              ) : null}

              {verification.status === 'error' ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400">
                  <XCircle size={13} /> Unable to verify this account
                </p>
              ) : null}
            </div>

            {/* General error */}
            {formErrors.general ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300">
                <AlertCircle size={14} className="mt-0.5" />
                <span>{formErrors.general}</span>
              </div>
            ) : null}

            {/* Save / Cancel */}
            <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || verification.status !== 'success'}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {editingAccount ? 'Update account' : 'Save account'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Info / Help ── */}
      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Wallet size={16} className="text-slate-400" /> Payout information
        </h3>
        <div className="mt-3 grid gap-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400 md:grid-cols-2">
          <div>
            <p className="font-bold text-slate-600 dark:text-slate-300">Conversion rate</p>
            <p>1.000 VND = 10 coins (1 coin = 100 VND). Payouts are converted at this fixed rate.</p>
          </div>
          <div>
            <p className="font-bold text-slate-600 dark:text-slate-300">Processing time</p>
            <p>Withdrawal requests are reviewed within 1–3 business days before funds are transferred to your payout account.</p>
          </div>
          <div>
            <p className="font-bold text-slate-600 dark:text-slate-300">Verification</p>
            <p>All payout accounts are verified before your first withdrawal. We check account ownership to ensure safe payouts.</p>
          </div>
          <div>
            <p className="font-bold text-slate-600 dark:text-slate-300">Default account</p>
            <p>Your default account for each method is used automatically when you submit a withdrawal from the Wallet page.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
