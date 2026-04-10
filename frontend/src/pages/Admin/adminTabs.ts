import type { ComponentType } from 'react';
import {
  AlertTriangle,
  BookOpen,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { DashboardStats } from '../../types';

export type AdminTabKey = 'dashboard' | 'users' | 'lessons' | 'community' | 'reports' | 'orders';

export interface AdminTabItem {
  key: AdminTabKey;
  labelKey: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  countFrom?: (stats: DashboardStats) => number;
}

export const DEFAULT_ADMIN_TAB: AdminTabKey = 'dashboard';

export const ADMIN_TAB_ITEMS: AdminTabItem[] = [
  { key: 'dashboard', labelKey: 'admin.tabDashboard', icon: TrendingUp },
  { key: 'users', labelKey: 'admin.tabUsers', icon: Users, countFrom: (stats) => stats.totalUsers },
  {
    key: 'lessons',
    labelKey: 'admin.tabLessonModeration',
    icon: BookOpen,
    countFrom: (stats) => stats.pendingModerations,
  },
  {
    key: 'community',
    labelKey: 'admin.tabCommunity',
    icon: MessageSquare,
    countFrom: (stats) => stats.totalCommunityPosts,
  },
  {
    key: 'reports',
    labelKey: 'admin.tabReports',
    icon: AlertTriangle,
    countFrom: (stats) => stats.pendingReports,
  },
  { key: 'orders', labelKey: 'admin.tabOrders', icon: ShoppingCart, countFrom: (stats) => stats.totalOrders },
];

export const toAdminTab = (value: string | null | undefined): AdminTabKey => {
  if (value === 'users' || value === 'lessons' || value === 'community' || value === 'reports' || value === 'orders') {
    return value;
  }
  return DEFAULT_ADMIN_TAB;
};

export const getAdminTabHref = (tab: AdminTabKey): string =>
  tab === DEFAULT_ADMIN_TAB ? '/admin' : `/admin?tab=${tab}`;
