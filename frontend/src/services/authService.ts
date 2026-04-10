import {
  forgotPassword,
  getCurrentSession,
  login,
  loginWithProvider,
  logout,
  refreshSessionUser,
  register,
  restoreSession,
} from '../repositories/authRepository';
import type { UserRole } from '../types';

const UNSAFE_REDIRECT_PATTERN = /^(?:javascript|data|vbscript):/i;

const isAdminPath = (path: string): boolean => path === '/admin' || path.startsWith('/admin/');

const isSafeInternalPath = (path: string): boolean => {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false;
  }

  if (UNSAFE_REDIRECT_PATTERN.test(path)) {
    return false;
  }

  return true;
};

export const getDefaultAuthenticatedPath = (role?: UserRole): string =>
  role === 'admin' ? '/admin' : '/';

interface ResolvePostAuthRedirectInput {
  search: string;
  role?: UserRole;
  fallbackPath?: string;
}

/**
 * Resolve a post-auth redirect from `?redirect=` query in a role-safe manner.
 *
 * This stays in the service layer so page components are decoupled from
 * redirect-security and role-gating rules.
 */
export const resolvePostAuthRedirect = ({
  search,
  role,
  fallbackPath,
}: ResolvePostAuthRedirectInput): string => {
  const fallback = fallbackPath ?? getDefaultAuthenticatedPath(role);
  const params = new URLSearchParams(search);
  const redirect = params.get('redirect');

  if (!redirect) {
    return fallback;
  }

  let decoded = redirect;
  try {
    decoded = decodeURIComponent(redirect);
  } catch {
    return fallback;
  }

  if (!isSafeInternalPath(decoded)) {
    return fallback;
  }

  if (role !== 'admin' && isAdminPath(decoded)) {
    return fallback;
  }

  return decoded;
};

export const authService = {
  login,
  loginWithProvider,
  register,
  forgotPassword,
  logout,
  restoreSession,
  getCurrentSession,
  refreshSessionUser,
};

/* Re-export auth contracts from centralized types (mock-agnostic). */
export type {
  AuthProvider,
  ProviderLoginPayload,
  LoginPayload,
  RegisterPayload,
  ForgotPasswordPayload,
} from '../types';
