import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { LoadingState } from '../../components/common/LoadingState';
import { getDefaultAuthenticatedPath } from '../../services/authService';

export const GuestGuard: React.FC = () => {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return <LoadingState title="Preparing authentication" description="Please wait a moment..." />;
  }

  if (isAuthenticated) {
    return <Navigate to={getDefaultAuthenticatedPath(user?.role)} replace />;
  }

  return <Outlet />;
};
