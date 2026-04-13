import { STORAGE_KEYS } from '../app/config/storage';
import {
  AuthSession,
  ForgotPasswordPayload,
  LoginPayload,
  ProviderLoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  User,
} from '../types';
import { ApiMessageDto, AuthSessionDto } from '../types/contract-dto';
import { AppError, parseApiError } from '../utils/api-error';
import { mapBackendUser } from '../utils/mappers';
import { toTimestamp } from '../utils/normalizers';
import { apiRequest } from '../services/apiClient';

type SafeUser = Omit<User, 'password'>;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';


const extractContractMessage = (
  responsePayload: unknown,
  fallbackMessage: string,
): string => {
  if (!isRecord(responsePayload)) {
    return fallbackMessage;
  }

  const message =
    typeof responsePayload.message === 'string'
      ? responsePayload.message.trim()
      : '';

  return message || fallbackMessage;
};

const toSafeUser = (dto: AuthSessionDto['user']): SafeUser =>
  mapBackendUser(dto);


const isSessionExpired = (expiresAt?: string): boolean => {
  if (!expiresAt) {
    return false;
  }

  return toTimestamp(expiresAt) > 0 && toTimestamp(expiresAt) <= Date.now();
};

const normalizeStoredSession = (raw: string | null): AuthSession | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const token = typeof parsed?.token === 'string' ? parsed.token.trim() : '';
    const userId =
      parsed?.user && typeof parsed.user.id === 'string' ? parsed.user.id.trim() : '';

    if (!token || !userId) {
      return null;
    }

    if (isSessionExpired(parsed.expiresAt)) {
      return null;
    }

    return {
      token,
      user: parsed.user,
      expiresAt:
        typeof parsed.expiresAt === 'string' && toTimestamp(parsed.expiresAt) > 0
          ? new Date(toTimestamp(parsed.expiresAt)).toISOString()
          : undefined,
      refreshToken:
        typeof parsed.refreshToken === 'string' && parsed.refreshToken.trim()
          ? parsed.refreshToken.trim()
          : undefined,
    } as AuthSession;
  } catch {
    return null;
  }
};

const readStoredSession = (): AuthSession | null => {
  if (!isBrowser()) {
    return null;
  }

  const normalized = normalizeStoredSession(window.localStorage.getItem(STORAGE_KEYS.authSession));

  if (!normalized) {
    window.localStorage.removeItem(STORAGE_KEYS.authSession);
    return null;
  }

  return normalized;
};

const writeStoredSession = (session: AuthSession | null): void => {
  if (!isBrowser()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(STORAGE_KEYS.authSession);
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session));
};

const toSessionFromDto = (dto: AuthSessionDto): AuthSession => ({
  token: dto.token,
  refreshToken: dto.refreshToken,
  expiresAt: dto.expiresAt,
  user: toSafeUser(dto.user),
});

const requestSessionRefresh = async (refreshToken: string): Promise<AuthSession> => {
  const sessionDto = await apiRequest<AuthSessionDto>('/api/auth/refresh-token', {
    method: 'POST',
    body: { refreshToken },
    includeAuth: false,
  });

  const session = toSessionFromDto(sessionDto);
  writeStoredSession(session);
  return session;
};

const throwAuthApiUnavailableIfNeeded = (
  parsed: AppError,
  endpointPath: '/api/auth/login' | '/api/auth/register' | '/api/auth/google',
): void => {
  if (
    parsed.statusCode === 404 ||
    /failed to fetch|networkerror|network error|request failed/i.test(parsed.message)
  ) {
    throw parseApiError({
      message: `Auth API is unavailable. Please make sure backend \`${endpointPath}\` is running.`,
      statusCode: 503,
    });
  }
};

export const restoreSession = async (): Promise<AuthSession | null> => {
  const stored = readStoredSession();
  if (!stored) {
    return null;
  }

  if (!isSessionExpired(stored.expiresAt)) {
    return stored;
  }

  if (!stored.refreshToken) {
    writeStoredSession(null);
    return null;
  }

  try {
    return await requestSessionRefresh(stored.refreshToken);
  } catch {
    writeStoredSession(null);
    return null;
  }
};

export const login = async (payload: LoginPayload): Promise<AuthSession> => {
  const normalizedPayload: LoginPayload = {
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  };

  try {
    const sessionDto = await apiRequest<AuthSessionDto>('/api/auth/login', {
      method: 'POST',
      body: normalizedPayload,
      includeAuth: false,
    });

    const session = toSessionFromDto(sessionDto);
    writeStoredSession(session);
    return session;
  } catch (error) {
    const parsed = parseApiError(error);

    throwAuthApiUnavailableIfNeeded(parsed, '/api/auth/login');

    throw parsed;
  }
};

export interface RegisterResult {
  message: string;
}

export const register = async (payload: RegisterPayload): Promise<RegisterResult> => {
  const normalizedPayload = {
    fullName: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    role: 'TEACHER',
  };

  try {
    const responsePayload = await apiRequest<ApiMessageDto>('/api/auth/register', {
      method: 'POST',
      body: normalizedPayload,
      includeAuth: false,
    });

    const message = extractContractMessage(
      responsePayload,
      'Registration successful. Please check your email to verify your account.',
    );

    return { message };
  } catch (error) {
    const parsed = parseApiError(error);

    throwAuthApiUnavailableIfNeeded(parsed, '/api/auth/register');

    throw parsed;
  }
};

export interface VerifyEmailResult {
  message: string;
}

export const verifyEmail = async (token: string): Promise<VerifyEmailResult> => {
  try {
    const responsePayload = await apiRequest<ApiMessageDto>(
      `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
        includeAuth: false,
      },
    );

    const message = extractContractMessage(
      responsePayload,
      'Email verified successfully. You can now log in.',
    );

    return { message };
  } catch (error) {
    throw parseApiError(error);
  }
};

export interface ResendVerificationResult {
  message: string;
}

export const resendVerification = async (
  email: string,
): Promise<ResendVerificationResult> => {
  try {
    const responsePayload = await apiRequest<ApiMessageDto>('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
      includeAuth: false,
    });

    const message = extractContractMessage(
      responsePayload,
      'If an account with this email exists, a verification email has been sent.',
    );

    return { message };
  } catch (error) {
    throw parseApiError(error);
  }
};

export const loginWithProvider = async (
  payload: ProviderLoginPayload,
): Promise<AuthSession> => {
  if (payload.provider !== 'google') {
    throw parseApiError({
      message: `Sign in with ${payload.provider} is not available yet. Please use email/password login.`,
      statusCode: 501,
    });
  }

  const idToken = typeof payload.idToken === 'string' ? payload.idToken.trim() : '';

  if (!idToken) {
    throw parseApiError({
      message: 'Google ID token is required',
      statusCode: 400,
    });
  }

  try {
    const sessionDto = await apiRequest<AuthSessionDto>('/api/auth/google', {
      method: 'POST',
      body: { idToken },
      includeAuth: false,
    });

    const session = toSessionFromDto(sessionDto);
    writeStoredSession(session);
    return session;
  } catch (error) {
    const parsed = parseApiError(error);

    throwAuthApiUnavailableIfNeeded(parsed, '/api/auth/google');

    throw parsed;
  }
};

export interface ForgotPasswordResult {
  message: string;
}

export const forgotPassword = async (
  payload: ForgotPasswordPayload,
): Promise<ForgotPasswordResult> => {
  const email = payload.email.trim().toLowerCase();

  if (!email) {
    throw parseApiError({ message: 'Email is required', statusCode: 400 });
  }

  try {
    const responsePayload = await apiRequest<ApiMessageDto>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
      includeAuth: false,
    });

    const message = extractContractMessage(
      responsePayload,
      'If an account with this email exists, a password reset link has been sent.',
    );

    return { message };
  } catch (error) {
    throw parseApiError(error);
  }
};

export interface ResetPasswordResult {
  message: string;
}

export const resetPassword = async (
  payload: ResetPasswordPayload,
): Promise<ResetPasswordResult> => {
  const token = payload.token.trim();

  if (!token) {
    throw parseApiError({ message: 'Reset token is required', statusCode: 400 });
  }

  try {
    const responsePayload = await apiRequest<ApiMessageDto>('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token,
        password: payload.password,
      },
      includeAuth: false,
    });

    const message = extractContractMessage(
      responsePayload,
      'Password reset successful. Please log in again.',
    );

    return { message };
  } catch (error) {
    throw parseApiError(error);
  }
};

export const logout = async (): Promise<void> => {
  const stored = readStoredSession();

  try {
    if (stored?.refreshToken) {
      await apiRequest<ApiMessageDto>('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken: stored.refreshToken },
        includeAuth: false,
      });
    }
  } catch {
    // Keep logout client-side idempotent even if backend revocation fails.
  } finally {
    writeStoredSession(null);
  }
};

export const getCurrentSession = async (): Promise<AuthSession | null> => restoreSession();

export const refreshSessionUser = async (
  userId: string,
): Promise<AuthSession | null> => {
  const stored = readStoredSession();
  if (!stored || stored.user.id !== userId) {
    return stored;
  }

  if (!isSessionExpired(stored.expiresAt)) {
    return stored;
  }

  if (!stored.refreshToken) {
    writeStoredSession(null);
    return null;
  }

  try {
    return await requestSessionRefresh(stored.refreshToken);
  } catch {
    writeStoredSession(null);
    return null;
  }
};
