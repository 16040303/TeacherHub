import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCcw,
  Wallet2,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { lessonsService } from '../../services/lessonsService';
import { ordersService } from '../../services/ordersService';
import { Order, OrderStatus } from '../../types';
import { formatCoins, formatRelativeDate, toDateTimeLabel } from '../../utils/format';
import { useLanguage } from '../../app/providers/LanguageProvider';

interface OrderWithLesson {
  order: Order;
  lessonTitle: string;
  lessonThumbnail: string;
}

const STATUS_META: Record<
  OrderStatus,
  {
    labelKey: string;
    className: string;
    icon: React.ReactNode;
  }
> = {
  paid: {
    labelKey: 'orders.paid',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icon: <CheckCircle2 size={14} />,
  },
  pending: {
    labelKey: 'orders.pendingPayment',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: <Clock3 size={14} />,
  },
  failed: {
    labelKey: 'orders.paymentFailed',
    className: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    icon: <XCircle size={14} />,
  },
  cancelled: {
    labelKey: 'orders.cancelled',
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    icon: <XCircle size={14} />,
  },
};

const ORDER_FILTERS: Array<{ key: 'all' | OrderStatus; labelKey: string }> = [
  { key: 'all', labelKey: 'orders.all' },
  { key: 'paid', labelKey: 'orders.paid' },
  { key: 'pending', labelKey: 'orders.pending' },
  { key: 'failed', labelKey: 'orders.failed' },
  { key: 'cancelled', labelKey: 'orders.cancelled' },
];

const toDateBoundaryTimestamp = (value: string, endOfDay = false): number | null => {
  const safeValue = value.trim();
  if (!safeValue) {
    return null;
  }

  const boundary = endOfDay ? '23:59:59.999' : '00:00:00.000';
  const parsed = new Date(`${safeValue}T${boundary}`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

export const OrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orders, setOrders] = useState<OrderWithLesson[]>([]);

  /* ── Expand/detail state ── */
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  /* ── Cancel order state ── */
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async (): Promise<void> => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const orderRows = await ordersService.listOrdersByUser(user.id);
      const lessonIds = Array.from(new Set(orderRows.map((row) => row.lessonId)));
      const lessons = await Promise.all(
        lessonIds.map(async (lessonId) => [lessonId, await lessonsService.getLessonById(lessonId)] as const),
      );

      const lessonMap = new Map(lessons);
      const enriched: OrderWithLesson[] = orderRows.map((row) => ({
        order: row,
        lessonTitle: lessonMap.get(row.lessonId)?.title ?? 'Unavailable lesson',
        lessonThumbnail:
          lessonMap.get(row.lessonId)?.thumbnail ?? `https://picsum.photos/seed/${row.lessonId}/800/600`,
      }));

      setOrders(enriched);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('orders.unableToLoadOrdersDescription');
      setLoadError(message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const totals = useMemo(
    () => ({
      total: orders.length,
      paid: orders.filter((entry) => entry.order.status === 'paid').length,
      pending: orders.filter((entry) => entry.order.status === 'pending').length,
      failedOrCancelled: orders.filter(
        (entry) => entry.order.status === 'failed' || entry.order.status === 'cancelled',
      ).length,
      spent: orders
        .filter((entry) => entry.order.status === 'paid')
        .reduce((sum, entry) => sum + Math.max(0, entry.order.amount), 0),
    }),
    [orders],
  );

  const hasInvalidDateRange = useMemo(() => {
    const fromTimestamp = toDateBoundaryTimestamp(dateFrom);
    const toTimestamp = toDateBoundaryTimestamp(dateTo, true);

    return (
      fromTimestamp !== null &&
      toTimestamp !== null &&
      fromTimestamp > toTimestamp
    );
  }, [dateFrom, dateTo]);

  const filteredOrders = useMemo(() => {
    const statusFiltered =
      filter === 'all'
        ? orders
        : orders.filter((entry) => entry.order.status === filter);

    const fromTimestamp = toDateBoundaryTimestamp(dateFrom);
    const toTimestamp = toDateBoundaryTimestamp(dateTo, true);

    if (fromTimestamp !== null && toTimestamp !== null && fromTimestamp > toTimestamp) {
      return [];
    }

    return statusFiltered.filter((entry) => {
      if (fromTimestamp === null && toTimestamp === null) {
        return true;
      }

      const orderTimestamp = new Date(entry.order.createdAt).getTime();
      if (Number.isNaN(orderTimestamp)) {
        return false;
      }

      if (fromTimestamp !== null && orderTimestamp < fromTimestamp) {
        return false;
      }

      if (toTimestamp !== null && orderTimestamp > toTimestamp) {
        return false;
      }

      return true;
    });
  }, [dateFrom, dateTo, filter, orders]);

  const hasActiveFilters = filter !== 'all' || dateFrom.length > 0 || dateTo.length > 0;

  const emptyDescription = useMemo(() => {
    if (hasInvalidDateRange) {
      return t('orders.startDateError');
    }

    if (!hasActiveFilters) {
      return t('orders.noPurchases');
    }

    return t('orders.noMatchingOrders');
  }, [t, hasActiveFilters, hasInvalidDateRange]);

  const resetFilters = (): void => {
    setFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const openPaymentResult = (orderId: string): void => {
    navigate(`/orders/${orderId}/payment-result`);
  };

  const processPayment = async (order: Order): Promise<void> => {
    if (processingOrderId) {
      return;
    }

    setProcessingOrderId(order.id);

    try {
      await ordersService.processOrderPayment(order.id, 'success');
      await loadOrders();
      openPaymentResult(order.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('orders.unableToProcessPayment');
      showToast({ type: 'error', message });
    } finally {
      setProcessingOrderId(null);
    }
  };

  /* ── Cancel pending order ── */
  const handleCancelOrder = async (orderId: string): Promise<void> => {
    if (!user || cancellingOrderId) return;
    setCancellingOrderId(orderId);
    try {
      await ordersService.cancelOrder(orderId, user.id);
      setConfirmCancelOrderId(null);
      showToast({ type: 'success', message: t('toast.orderCancelled') });
      await loadOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('orders.cancelOrderError');
      showToast({ type: 'error', message });
      setConfirmCancelOrderId(null);
    } finally {
      setCancellingOrderId(null);
    }
  };

  if (loading) {
    return <LoadingState title={t('orders.loadingOrders')} description={t('orders.loadingOrdersDescription')} />;
  }

  if (loadError) {
    return (
      <EmptyState
        title={t('orders.unableToLoadOrders')}
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => {
              void loadOrders();
            }}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {t('common.retry')}
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t('orders.title')}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {t('orders.subtitle')}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            to="/wallet"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700 dark:bg-slate-900"
          >
            <Wallet2 size={16} /> {t('orders.wallet')}
          </Link>
          <button
            type="button"
            onClick={() => {
              void loadOrders();
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
          >
            <RefreshCcw size={16} /> {t('orders.refresh')}
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('orders.totalOrders')}</p>
          <p className="mt-2 text-2xl font-black">{totals.total}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('orders.paid')}</p>
          <p className="mt-2 text-2xl font-black text-emerald-400">{totals.paid}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('orders.pending')}</p>
          <p className="mt-2 text-2xl font-black text-amber-400">{totals.pending}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('orders.failedCancelled')}</p>
          <p className="mt-2 text-2xl font-black text-rose-400">{totals.failedOrCancelled}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('orders.totalSpent')}</p>
          <p className="mt-2 text-2xl font-black">{formatCoins(totals.spent)} {t('common.coins')}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-2">
          {ORDER_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                filter === item.key
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label htmlFor="orders-date-from" className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('orders.from')}</span>
            <input
              id="orders-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>

          <label htmlFor="orders-date-to" className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('orders.to')}</span>
            <input
              id="orders-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
          >
            {t('library.resetFilters')}
          </button>
        </div>

        {hasInvalidDateRange ? (
          <p className="mt-3 text-xs font-semibold text-rose-400">{t('orders.startDateError')}</p>
        ) : null}
      </section>

      {filteredOrders.length === 0 ? (
        <EmptyState
          title={t('orders.noOrdersFound')}
          description={emptyDescription}
          action={
            <Link
              to="/library"
              className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              {t('common.browseLibrary')}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((entry) => {
            const status = STATUS_META[entry.order.status] ?? STATUS_META.pending;
            const processing = processingOrderId === entry.order.id;
            const isExpanded = expandedOrderId === entry.order.id;
            const isPending = entry.order.status === 'pending';
            const isConfirmingCancel = confirmCancelOrderId === entry.order.id;
            const isCancelling = cancellingOrderId === entry.order.id;

            return (
              <article
                key={entry.order.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row"
              >
                <img
                  src={entry.lessonThumbnail}
                  alt={entry.lessonTitle}
                  className="h-24 w-full rounded-xl object-cover md:w-40"
                />

                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-500">{t('orders.order', { id: entry.order.id })}</p>
                      <h2 className="text-lg font-black tracking-tight">{entry.lessonTitle}</h2>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${status.className}`}
                    >
                      {status.icon}
                      {t(status.labelKey)}
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-500 md:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('common.total')}</p>
                      <p className="font-bold text-slate-700 dark:text-slate-200">{formatCoins(entry.order.amount)} {t('common.coins')}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('orders.purchaseOn')}</p>
                      <p className="font-bold text-slate-700 dark:text-slate-200">{toDateTimeLabel(entry.order.createdAt)}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatRelativeDate(entry.order.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('orders.paymentRef')}</p>
                      <p className="font-bold text-slate-700 dark:text-slate-200">{entry.order.paymentRef ?? t('common.na')}</p>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {entry.order.status === 'paid'
                      ? t('orders.paymentCompleted')
                      : entry.order.status === 'pending'
                        ? t('orders.paymentPending')
                        : entry.order.status === 'failed'
                          ? t('orders.paymentFailed')
                          : t('orders.orderCancelled')}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {entry.order.status === 'pending' || entry.order.status === 'failed' ? (
                      <button
                        type="button"
                        onClick={() => {
                          void processPayment(entry.order);
                        }}
                        disabled={processing}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-70"
                      >
                        {processing ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                        {processing
                          ? t('orders.processing')
                          : entry.order.status === 'pending'
                            ? t('orders.payNow')
                            : t('orders.retryPayment')}
                      </button>
                    ) : entry.order.status === 'paid' ? (
                      <Link
                        to={`/lesson/${entry.order.lessonId}`}
                        className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700"
                      >
                        {t('common.openLesson')}
                      </Link>
                    ) : (
                      <Link
                        to={`/lesson/${entry.order.lessonId}`}
                        className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700"
                      >
                        {t('common.viewLesson')}
                      </Link>
                    )}

                    {/* Cancel pending order */}
                    {isPending ? (
                      isConfirmingCancel ? (
                        <span className="inline-flex items-center gap-2">
                          <AlertCircle size={14} className="text-rose-400" />
                          <span className="text-xs font-medium text-rose-400">{t('orders.cancelThisOrder')}</span>
                          <button
                            type="button"
                            disabled={isCancelling}
                            onClick={() => void handleCancelOrder(entry.order.id)}
                            className="text-xs font-bold text-rose-500 hover:underline disabled:opacity-60"
                          >
                            {isCancelling ? t('orders.cancelling') : t('orders.yesCancel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCancelOrderId(null)}
                            className="text-xs font-bold text-slate-400 hover:underline"
                          >
                            {t('orders.noCancel')}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelOrderId(entry.order.id)}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 text-sm font-bold text-rose-400 transition hover:bg-rose-500/20"
                        >
                          <XCircle size={16} /> {t('orders.cancelOrder')}
                        </button>
                      )
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openPaymentResult(entry.order.id)}
                      className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700"
                    >
                      {t('orders.viewPaymentResult')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedOrderId((current) => current === entry.order.id ? null : entry.order.id)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700"
                    >
                      <FileText size={16} /> {isExpanded ? t('orders.hideReceipt') : t('orders.viewReceipt')}
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Expandable receipt detail */}
                  {isExpanded ? (
                    <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
                        <h4 className="flex items-center gap-2 text-sm font-black">
                          <FileText size={16} className="text-primary" /> {t('orders.orderReceipt')}
                        </h4>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${status.className}`}>
                          {status.icon} {t(status.labelKey)}
                        </span>
                      </div>
                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('orders.orderId')}</p>
                          <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{entry.order.id}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('orders.lesson')}</p>
                          <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{entry.lessonTitle}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('common.total')}</p>
                          <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{formatCoins(entry.order.amount)} {t('common.coins')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('orders.paymentReference')}</p>
                          <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{entry.order.paymentRef ?? t('orders.notYetAssigned')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('orders.createdAt')}</p>
                          <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{toDateTimeLabel(entry.order.createdAt)}</p>
                        </div>
                        {entry.order.updatedAt ? (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('orders.lastUpdated')}</p>
                            <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{toDateTimeLabel(entry.order.updatedAt)}</p>
                          </div>
                        ) : null}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('orders.lessonId')}</p>
                          <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{entry.order.lessonId}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('orders.sellerId')}</p>
                          <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{entry.order.lessonAuthorId}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => {
                            const receiptText = [
                              `${t('orders.orderReceipt')} — ${entry.order.id}`,
                              `${t('orders.lesson')}: ${entry.lessonTitle}`,
                              `${t('common.total')}: ${formatCoins(entry.order.amount)} ${t('common.coins')}`,
                              `${t('common.status')}: ${t(status.labelKey)}`,
                              `${t('orders.paymentReference')}: ${entry.order.paymentRef ?? t('common.na')}`,
                              `${t('common.date')}: ${toDateTimeLabel(entry.order.createdAt)}`,
                            ].join('\n');
                            if (!navigator.clipboard) {
                              showToast({ type: 'error', message: t('orders.clipboardUnavailable') });
                              return;
                            }
                            void navigator.clipboard
                              .writeText(receiptText)
                              .then(() => showToast({ type: 'success', message: t('orders.receiptCopied') }))
                              .catch(() => showToast({ type: 'error', message: t('orders.unableToCopyReceipt') }));
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary transition-colors hover:underline"
                        >
                          <ExternalLink size={14} /> {t('orders.copyReceiptText')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
