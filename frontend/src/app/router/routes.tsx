import React from 'react';
import { RouteObject } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { AuthGuard } from './AuthGuard';
import { GuestGuard } from './GuestGuard';
import { HomePage } from '../../pages/Home/HomePage';
import { LibraryPage } from '../../pages/Library/LibraryPage';
import { LessonDetailPage } from '../../pages/LessonDetail/LessonDetailPage';
import { CommunityPage } from '../../pages/Community/CommunityPage';
import { CommunityPostDetailPage } from '../../pages/Community/CommunityPostDetailPage';
import { DashboardPage } from '../../pages/Dashboard/DashboardPage';
import { UploadPage } from '../../pages/Upload/UploadPage';
import { PortfolioPage } from '../../pages/Portfolio/PortfolioPage';
import { WalletPage } from '../../pages/Wallet/WalletPage';
import { PayoutAccountsPage } from '../../pages/Wallet/PayoutAccountsPage';
import { ProfilePage } from '../../pages/Profile/ProfilePage';
import { AuthPage } from '../../pages/Auth/AuthPage';
import { VerifyEmailPage } from '../../pages/Auth/VerifyEmailPage';
import { ResetPasswordPage } from '../../pages/Auth/ResetPasswordPage';
import { AccessDeniedPage } from '../../pages/AccessDenied/AccessDeniedPage';
import { NotFoundPage } from '../../pages/NotFound/NotFoundPage';
import { SettingsPage } from '../../pages/Settings/SettingsPage';
import { OrdersPage } from '../../pages/Orders/OrdersPage';
import { PaymentResultPage } from '../../pages/Orders/PaymentResultPage';
import { AdminPage } from '../../pages/Admin/AdminPage';
import { PrivacyPage } from '../../pages/Legal/PrivacyPage';
import { TermsPage } from '../../pages/Legal/TermsPage';
import { TeacherProfilePage } from '../../pages/Profile/TeacherProfilePage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'lesson/:id', element: <LessonDetailPage /> },
      { path: 'teacher/:id', element: <TeacherProfilePage /> },
      { path: 'community', element: <CommunityPage /> },
      { path: 'community/:id', element: <CommunityPostDetailPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'access-denied', element: <AccessDeniedPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      {
        element: <GuestGuard />,
        children: [{ path: 'login', element: <AuthPage /> }],
      },
      {
        element: <AuthGuard />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'upload', element: <UploadPage /> },
          { path: 'portfolio', element: <PortfolioPage /> },
          { path: 'wallet', element: <WalletPage /> },
          { path: 'payout-accounts', element: <PayoutAccountsPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:orderId/payment-result', element: <PaymentResultPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      {
        element: <AuthGuard allowedRoles={['admin']} />,
        children: [{ path: 'admin', element: <AdminPage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
