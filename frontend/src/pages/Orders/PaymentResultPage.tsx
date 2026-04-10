import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCcw,
  Wallet2,
} from 'lucide-react';
import { ordersService } from '../../services/ordersService';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { useToast } from '../../app/providers/ToastProvider';
import { PaymentResultSnapshot } from '../../types';
import { formatCoins, formatRelativeDate, toDateTimeLabel } from '../../utils/format';
import { useLanguage } from '../../app/providers/LanguageProvider';

const STATUS_META: Record<
  PaymentResultSnapshot['status'],
  {
    titleKey: string;
    icon: React.ReactNode;
    cardClassName: string;
  }
> = {
  paid: {
    titleKey: 'payment.success',
    icon: <CheckCircle2 size={18} />,
    cardClassName: 'border-emerald-300/60 bg-emerald-500/10 text-emerald-300',
  },
  failed: {
    titleKey: 'payment.failed',
    icon: <AlertCircle size={18} />,
    cardClassName: 'border-rose-300/60 bg-rose-500/10 text-rose-300',
  },
  pending: {
    titleKey: 'payment.orderPending',
    icon: <Clock3 size={18} />,
    cardClassName: 'border-amber-300/60 bg-amber-500/10 text-amber-200',
  },
  cancelled: {
    titleKey: 'payment.orderCancelled',
    icon: <AlertCircle size={18} />,
    cardClassName: 'border-slate-300/60 bg-slate-500/10 text-slate-300',
  },
};

const ORDER_STATUS_META: Record<
  PaymentResultSnapshot['orderStatus'],
  {
    labelKey: string;
    className: string;
  }
> = {
  paid: {
    labelKey: 'orders.paid',
    className: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-300',
  },
  pending: {
    labelKey: 'orders.pending',
    className: 'border-amber-300/50 bg-amber-500/10 text-amber-200',
  },
  failed: {
    labelKey: 'orders.failed',
    className: 'border-rose-300/50 bg-rose-500/10 text-rose-300',
  },
  cancelled: {
    labelKey: 'orders.cancelled',
    className: 'border-slate-300/50 bg-slate-500/10 text-slate-300',
  },
};

const ACCESS_STATE_META: Record<
  PaymentResultSnapshot['accessState'],
  {
    labelKey: string;
    className: string;
  }
> = {
  unlocked: {
    labelKey: 'payment.unlocked',
    className: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-300',
  },
  processing: {
    labelKey: 'payment.processing',
    className: 'border-amber-300/50 bg-amber-500/10 text-amber-200',
  },
  locked: {
    labelKey: 'payment.locked',
    className: 'border-rose-300/50 bg-rose-500/10 text-rose-300',
  },
};

const STATUS_HINT_KEY_BY_STATUS: Record<PaymentResultSnapshot['orderStatus'], string> = {
  paid: 'paymentResult.hint.lessonUnlocked',
  failed: 'paymentResult.hint.retryRecommended',
  cancelled: 'paymentResult.hint.orderCancelled',
  pending: 'paymentResult.hint.settlementInProgress',
};

const getResultMessageKey = (
  status: PaymentResultSnapshot['status'],
  amount: number,
): string => {
  if (status === 'paid') {
    return amount > 0
      ? 'paymentResult.message.paid'
      : 'paymentResult.message.freeLessonUnlocked';
  }

  if (status === 'failed') {
    return 'paymentResult.message.failed';
  }

  if (status === 'cancelled') {
    return 'paymentResult.message.cancelled';
  }

  return 'paymentResult.message.pending';
};

export const PaymentResultPage: React.FC = () => {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [isProcessingPrimaryAction, setIsProcessingPrimaryAction] = useState(false);
  const [snapshot, setSnapshot] = useState<PaymentResultSnapshot | null>(null);

  const loadSnapshot = async (): Promise<void> => {
    if (!orderId.trim()) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await ordersService.getPaymentResultSnapshot(orderId);
      setSnapshot(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('paymentResult.unableToLoadLatest');
      setSnapshot(null);
      showToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, [orderId]);

  const statusMeta = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return STATUS_META[snapshot.status];
  }, [snapshot]);

  const localizedMessage = useMemo(() => {
    if (!snapshot) {
      return '';
    }

    return t(getResultMessageKey(snapshot.status, snapshot.order.amount));
  }, [snapshot, t]);

  const localizedStatusHint = useMemo(() => {
    if (!snapshot) {
      return '';
    }

    return t(STATUS_HINT_KEY_BY_STATUS[snapshot.orderStatus]);
  }, [snapshot, t]);

  if (loading) {
    return (
      <LoadingState
        title={t('paymentResult.loadingTitle')}
        description={t('paymentResult.loadingDescription')}
      />
    );
  }

  if (!snapshot || !statusMeta) {
    return (
      <EmptyState
        title={t('paymentResult.notFoundTitle')}
        description={t('paymentResult.notFoundDescription')}
        action={
          <Link
            to="/orders"
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {t('payment.backToOrders')}
          </Link>
        }
      />
    );
  }

  const handlePrimaryAction = async (): Promise<void> => {
    if (!snapshot || isProcessingPrimaryAction) {
      return;
    }

    setIsProcessingPrimaryAction(true);
    try {
      if (snapshot.canRetry) {
        await ordersService.processOrderPayment(snapshot.order.id, 'success');
      }
      await loadSnapshot();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('paymentResult.unableToCompleteAction');
      showToast({ type: 'error', message });
    } finally {
      setIsProcessingPrimaryAction(false);
    }
  };

  const { order, lesson } = snapshot;
  const orderStatusMeta = ORDER_STATUS_META[snapshot.orderStatus] ?? ORDER_STATUS_META.pending;
  const accessStateMeta = ACCESS_STATE_META[snapshot.accessState] ?? ACCESS_STATE_META.processing;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t('paymentResult.pageTitle')}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {t('paymentResult.pageSubtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadSnapshot();
          }}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700 dark:bg-slate-900"
        >
          <RefreshCcw size={16} /> {t('paymentResult.refreshStatus')}
        </button>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${statusMeta.cardClassName}`}>
          {statusMeta.icon}
          {t(statusMeta.titleKey)}
        </div>

        <h2 className="mt-4 text-2xl font-black tracking-tight">
          {lesson?.title ?? t('paymentResult.lessonPurchaseFallback')}
        </h2>

        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          {localizedMessage}
        </p>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-300/50 bg-slate-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          {localizedStatusHint}
        </div>

        <div className="mt-6 grid gap-3 text-sm text-slate-500 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('orders.orderId')}</p>
            <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{order.id}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('orders.paymentRef')}</p>
            <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{snapshot.paymentRef}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('wallet.amount')}</p>
            <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{formatCoins(order.amount)} {t('common.coins')}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('paymentResult.orderState')}</p>
            <div className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${orderStatusMeta.className}`}>
              {t(orderStatusMeta.labelKey)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('paymentResult.accessState')}</p>
            <div className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${accessStateMeta.className}`}>
              {t(accessStateMeta.labelKey)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('paymentResult.processed')}</p>
            <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{toDateTimeLabel(snapshot.processedAt)}</p>
            <p className="mt-1 text-xs text-slate-400">{formatRelativeDate(snapshot.processedAt)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
        <h3 className="text-lg font-black tracking-tight">{t('paymentResult.nextActions')}</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          {snapshot.status === 'paid' ? (
            <Link
              to={lesson ? `/lesson/${lesson.id}` : '/library'}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
            >
              <CheckCircle2 size={16} /> {t('common.openLesson')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                void handlePrimaryAction();
              }}
              disabled={isProcessingPrimaryAction}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {snapshot.canRetry ? (
                <CreditCard size={16} />
              ) : (
                <RefreshCcw size={16} className={isProcessingPrimaryAction ? 'animate-spin' : undefined} />
              )}
              {snapshot.canRetry ? t('orders.retryPayment') : t('paymentResult.refreshStatus')}
            </button>
          )}

          <Link
            to="/wallet"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700 dark:bg-slate-900"
          >
            <Wallet2 size={16} /> {t('wallet.topUpWallet')}
          </Link>

          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700 dark:bg-slate-900"
          >
            <RefreshCcw size={16} /> {t('payment.backToOrders')}
          </button>
        </div>

        <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          {t('paymentResult.entitlementStatus')}: <span className="font-bold">{t(accessStateMeta.labelKey)}</span>.{' '}
          {localizedStatusHint}
        </p>
      </section>
    </div>
  );
};
