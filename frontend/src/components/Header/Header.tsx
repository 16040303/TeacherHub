import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  LogIn,
  LogOut,
  Menu,
  Moon,
  PlusCircle,
  Settings,
  Sun,
  UserCircle2,
  X,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_NAV, AUTH_NAV, MAIN_NAV } from '../../app/config/navigation';
import { useAuth } from '../../app/providers/AuthProvider';
import { useLanguage } from '../../app/providers/LanguageProvider';
import { useTheme } from '../../app/providers/ThemeProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { notificationService } from '../../services/notificationService';
import { AppNotification } from '../../types';

const isRouteActive = (pathname: string, routePath: string): boolean =>
  pathname === routePath || pathname.startsWith(`${routePath}/`);


export const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);

  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const { showToast } = useToast();

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = (): void => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = useMemo(() => {
    const items = [...MAIN_NAV];

    if (!isAuthenticated) {
      return items;
    }

    items.push(...AUTH_NAV);
    if (isAdmin) {
      items.push(...ADMIN_NAV);
    }

    return items;
  }, [isAdmin, isAuthenticated]);


  const avatarSrc = user?.avatar?.trim()
    ? user.avatar
    : `https://picsum.photos/seed/${user?.id ?? 'guest'}/100/100`;

  const handleThemeToggle = (): void => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      showToast({ type: 'success', message: t('auth.logoutSuccess') });
      setNotifications([]);
      setNotificationsOpen(false);
      navigate('/');
    } catch {
      showToast({ type: 'error', message: t('auth.logoutError') });
    }
  };

  const loadNotifications = async (): Promise<void> => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    setNotificationLoading(true);
    try {
      const rows = await notificationService.listNotificationsByUser(user.id);
      setNotifications(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('header.notificationsLoadError');
      showToast({ type: 'error', message });
    } finally {
      setNotificationLoading(false);
    }
  };

  const settingsActive = isRouteActive(location.pathname, '/settings');

  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      setNotificationsOpen(false);
      return;
    }

    void loadNotifications();
  }, [isAuthenticated, user?.id]);

  const handleNotificationButtonClick = (): void => {
    if (!isAuthenticated || !user?.id) {
      showToast({ type: 'info', message: t('header.loginToViewNotifications') });
      return;
    }

    setNotificationsOpen((current) => !current);
  };

  const closeNotificationPanel = (): void => {
    setNotificationsOpen(false);
  };

  const handleOpenNotification = async (notification: AppNotification): Promise<void> => {
    if (!user?.id || activeNotificationId === notification.id) {
      return;
    }

    setActiveNotificationId(notification.id);

    try {
      if (!notification.read) {
        const updated = await notificationService.markNotificationAsRead(user.id, notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }

      closeNotificationPanel();
      navigate(notification.actionUrl?.trim() || '/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('header.notificationOpenError');
      showToast({ type: 'error', message });
    } finally {
      setActiveNotificationId(null);
    }
  };

  const handleMarkAllNotifications = async (): Promise<void> => {
    if (!user?.id || markingAllNotifications || unreadCount === 0) {
      return;
    }

    setMarkingAllNotifications(true);
    try {
      const updatedCount = await notificationService.markAllNotificationsAsRead(user.id);
      if (updatedCount > 0) {
        setNotifications((current) => current.map((item) => ({ ...item, read: true })));
        showToast({
          type: 'success',
          message: t('header.notificationsMarkedAsRead', { values: { count: updatedCount } }),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('header.markAllNotificationsError');
      showToast({ type: 'error', message });
    } finally {
      setMarkingAllNotifications(false);
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'border-b border-slate-200 bg-white/80 py-2.5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80'
          : 'bg-transparent py-4'
      }`}
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto] items-center gap-x-3 px-4 sm:gap-x-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-x-8 lg:px-8 xl:px-10">
        <Link
          to="/"
          aria-label={t('header.goHome')}
          title={t('header.goHome')}
          className="group flex shrink-0 items-center gap-2.5 justify-self-start"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-transform group-hover:scale-110">
            <span className="text-xl font-black">T</span>
          </div>
          <h1 className="hidden text-2xl font-black tracking-tighter sm:block">TeacherHub</h1>
        </Link>

        <nav className="hidden items-center justify-self-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-700 dark:bg-slate-800/50 lg:flex">
          {navItems.map((item) => {
            const active = isRouteActive(location.pathname, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all ${
                  active
                    ? 'bg-white text-primary shadow-sm dark:bg-slate-700'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <item.icon size={18} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-self-end gap-2.5 lg:ml-3 lg:gap-3">
          {isAuthenticated ? (
            <Link
              to="/upload"
              className="hidden h-10 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover md:flex"
            >
              <PlusCircle size={17} /> {t('nav.upload')}
            </Link>
          ) : (
            <Link
              to="/login"
              className="hidden h-10 items-center gap-2 rounded-xl border border-slate-300 px-5 font-bold text-slate-700 transition-all hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-200 md:flex"
            >
              <LogIn size={16} /> {t('nav.login')}
            </Link>
          )}

          <button
            type="button"
            onClick={handleThemeToggle}
            className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:text-primary dark:bg-slate-800"
            aria-label={t('common.theme')}
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          {isAuthenticated ? (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={handleNotificationButtonClick}
                className="relative flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:text-primary dark:bg-slate-800"
                aria-label={t('header.notifications')}
                aria-expanded={notificationsOpen}
              >
                <Bell size={19} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black text-white dark:border-slate-800">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-12 z-50 w-92 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-black">{t('header.notifications')}</p>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {unreadCount > 0
                          ? t('header.unreadUpdates', { values: { count: unreadCount } })
                          : t('header.allCaughtUp')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleMarkAllNotifications();
                      }}
                      disabled={markingAllNotifications || unreadCount === 0}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-slate-400 dark:disabled:text-slate-500"
                    >
                      <Check size={12} />
                      {markingAllNotifications ? t('common.updating') : t('header.markAll')}
                    </button>
                  </div>

                  <div className="max-h-88 overflow-y-auto">
                    {notificationLoading ? (
                      <div className="flex items-center justify-center px-4 py-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {t('header.loadingNotifications')}
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('header.noNotifications')}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {t('header.noNotificationsHint')}
                        </p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            void handleOpenNotification(notification);
                          }}
                          disabled={activeNotificationId === notification.id}
                          className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800/70 ${
                            notification.read ? '' : 'bg-primary/5 dark:bg-primary/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold">{notification.title}</p>
                            {!notification.read ? <span className="size-2 rounded-full bg-primary" /> : null}
                          </div>
                          <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">{notification.message}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {notification.actionLabel || t('common.view')} · {new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {isAuthenticated ? (
            <Link
              to="/settings"
              aria-label={t('nav.settings')}
              className={`hidden size-10 items-center justify-center rounded-xl border transition-all md:flex ${
                settingsActive
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-primary dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <Settings size={19} />
            </Link>
          ) : null}

          {isAuthenticated ? (
            <Link
              to="/profile"
              aria-label={t('nav.profile')}
              title={t('nav.profile')}
              className="hidden size-10 cursor-pointer overflow-hidden rounded-xl border-2 border-slate-200 transition-transform hover:scale-105 dark:border-slate-700 md:block"
            >
              <img src={avatarSrc} alt={user?.name ?? 'Avatar'} className="h-full w-full object-cover" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="hidden size-10 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition-colors hover:text-primary dark:border-slate-700 md:flex"
            >
              <UserCircle2 size={19} />
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((current) => !current);
              closeNotificationPanel();
            }}
            className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 lg:hidden"
            aria-label={t('header.toggleMobileMenu')}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="absolute left-0 top-full w-full border-b border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const active = isRouteActive(location.pathname, item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 rounded-xl p-4 text-lg font-bold ${
                    active ? 'bg-primary/10 text-primary' : 'text-slate-500'
                  }`}
                >
                  <item.icon size={24} />
                  {t(item.labelKey)}
                </Link>
              );
            })}

            {isAuthenticated ? (
              <>
                <Link
                  to="/upload"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-4 rounded-xl bg-primary/5 p-4 text-lg font-bold text-primary"
                >
                  <PlusCircle size={24} />
                  {t('nav.upload')}
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 rounded-xl p-4 text-lg font-bold ${
                    settingsActive ? 'bg-primary/10 text-primary' : 'text-slate-500'
                  }`}
                >
                  <Settings size={24} />
                  {t('nav.settings')}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await handleLogout();
                  }}
                  className="flex items-center gap-4 rounded-xl p-4 text-lg font-bold text-rose-500"
                >
                  <LogOut size={22} /> {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-4 rounded-xl bg-primary/5 p-4 text-lg font-bold text-primary"
              >
                <LogIn size={24} /> {t('nav.login')}
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
};
