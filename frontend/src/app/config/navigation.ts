import { ComponentType } from 'react';
import { BookOpen, House, MessageSquare, Shield, LayoutDashboard, Wallet } from 'lucide-react';

export interface NavItem {
  labelKey: string;
  path: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

export const MAIN_NAV: NavItem[] = [
  { labelKey: 'nav.home', path: '/', icon: House },
  { labelKey: 'nav.library', path: '/library', icon: BookOpen },
  { labelKey: 'nav.community', path: '/community', icon: MessageSquare },
];

export const AUTH_NAV: NavItem[] = [
  { labelKey: 'nav.wallet', path: '/wallet', icon: Wallet },
  { labelKey: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard },
];

export const ADMIN_NAV: NavItem[] = [{ labelKey: 'nav.admin', path: '/admin', icon: Shield }];
