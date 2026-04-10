import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Search, ShoppingCart, Wallet } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../app/providers/ToastProvider';
import { EmptyState } from '../../components/common/EmptyState';
import type { AdminOrderFilters, AdminOrderRow, OrderStatus, WalletTransaction } from '../../types';
import { formatCoins, formatRelativeDate } from '../../utils/format';
import { useLanguage } from '../../app/providers/LanguageProvider';

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const TRANSACTION_TYPE_KEYS: Record<WalletTransaction['type'], string> = {
  sale: 'wallet.sale',
  withdrawal: 'wallet.withdrawal',
  purchase: 'wallet.purchase',
  bonus: 'wallet.bonus',
  topup: 'wallet.topup',
  refund: 'wallet.refund',
};

const TRANSACTION_STATUS_KEYS: Record<WalletTransaction['status'], string> = {
  completed: 'wallet.completed',
  pending: 'wallet.pending',
  failed: 'wallet.failed',
  cancelled: 'wallet.cancelled',
};

type SubTab = 'orders' | 'transactions';

export const AdminOrdersTab: React.FC = () => {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState<SubTab>('orders');

  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [orderFilters, setOrderFilters] = useState<AdminOrderFilters>({ search: '', status: 'all' });
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const rows = await adminService.listOrdersForAdmin(orderFilters);
      setOrders(rows);
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : t('admin.ordersTab.failedToLoadOrders') });
    } finally {
      setOrdersLoading(false);
    }
  }, [orderFilters, showToast, t]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const rows = await adminService.listRecentTransactions(50);
      setTransactions(rows);
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : t('admin.ordersTab.failedToLoadTransactions') });
    } finally {
      setTxLoading(false);
    }
  }, [showToast, t]);

  const getOrderStatusLabel = useCallback((status: OrderStatus): string => {
    switch (status) {
      case 'paid':
        return t('orders.paid');
      case 'failed':
        return t('orders.failed');
      case 'cancelled':
        return t('orders.cancelled');
      case 'pending':
      default:
        return t('orders.pending');
    }
  }, [t]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);
  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <h2 className="inline-flex items-center gap-2 text-xl font-black tracking-tight">
          <ShoppingCart size={20} className="text-indigo-500" /> {t('admin.ordersTab.title')}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSubTab('orders')} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${subTab === 'orders' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
            <ShoppingCart size={14} className="mr-1 inline" /> {t('admin.ordersTab.orders')}
          </button>
          <button type="button" onClick={() => setSubTab('transactions')} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${subTab === 'transactions' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
            <Wallet size={14} className="mr-1 inline" /> {t('admin.ordersTab.transactions')}
          </button>
        </div>
      </div>

      {/* Orders sub-tab */}
      {subTab === 'orders' && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3 dark:border-slate-800">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={orderFilters.search} onChange={(e) => setOrderFilters((p) => ({ ...p, search: e.target.value }))} placeholder={t('admin.ordersTab.searchPlaceholder')} className="h-9 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800" />
            </div>
            <div className="relative">
              <select value={orderFilters.status} onChange={(e) => setOrderFilters((p) => ({ ...p, status: e.target.value as AdminOrderFilters['status'] }))} className="h-9 appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800">
                <option value="all">{t('admin.allStatus')}</option>
                <option value="pending">{t('orders.pending')}</option>
                <option value="paid">{t('orders.paid')}</option>
                <option value="failed">{t('orders.failed')}</option>
                <option value="cancelled">{t('orders.cancelled')}</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <span className="text-xs font-bold text-slate-400">
              {ordersLoading
                ? t('common.loadingDots')
                : t('admin.ordersTab.ordersCount', {
                    count: String(orders.length),
                    suffix: orders.length === 1 ? '' : t('common.s'),
                  })}
            </span>
          </div>
          {!ordersLoading && orders.length === 0 ? (
            <div className="p-6"><EmptyState title={t('admin.ordersTab.noOrdersFound')} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800/50">
                    <th className="px-6 py-3">{t('admin.ordersTab.order')}</th>
                    <th className="px-6 py-3">{t('orders.lesson')}</th>
                    <th className="px-6 py-3">{t('admin.ordersTab.buyer')}</th>
                    <th className="px-6 py-3">{t('admin.ordersTab.seller')}</th>
                    <th className="px-6 py-3">{t('admin.ordersTab.amount')}</th>
                    <th className="px-6 py-3">{t('common.status')}</th>
                    <th className="px-6 py-3">{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 text-sm font-mono font-bold">{order.id}</td>
                      <td className="px-6 py-4 text-sm">{order.lessonTitle}</td>
                      <td className="px-6 py-4 text-sm">{order.buyerName}</td>
                      <td className="px-6 py-4 text-sm">{order.sellerName}</td>
                      <td className="px-6 py-4 text-sm font-bold">{formatCoins(order.amount)} {t('common.coins').toLowerCase()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${ORDER_STATUS_STYLES[order.status]}`}>{getOrderStatusLabel(order.status)}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{formatRelativeDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Transactions sub-tab */}
      {subTab === 'transactions' && (
        <>
          <div className="border-b border-slate-100 px-6 py-3 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400">
              {txLoading
                ? t('common.loadingDots')
                : t('admin.ordersTab.transactionsCount', {
                    count: String(transactions.length),
                    suffix: transactions.length === 1 ? '' : t('common.s'),
                  })}
            </span>
          </div>
          {!txLoading && transactions.length === 0 ? (
            <div className="p-6"><EmptyState title={t('admin.ordersTab.noTransactionsFound')} /></div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{tx.description}</p>
                    <p className="text-xs text-slate-500">{t(TRANSACTION_TYPE_KEYS[tx.type])} • {formatRelativeDate(tx.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-black ${tx.amount > 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatCoins(tx.amount)} {t('common.coins').toLowerCase()}
                    </p>
                    <p className="text-[11px] capitalize text-slate-500">{t(TRANSACTION_STATUS_KEYS[tx.status])}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};
