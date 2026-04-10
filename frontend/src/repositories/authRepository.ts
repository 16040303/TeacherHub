import { STORAGE_KEYS } from '../app/config/storage';
import {
  AuthSession,
  ForgotPasswordPayload,
  LoginPayload,
  ProviderLoginPayload,
  RegisterPayload,
  User,
} from '../types';
import { AuthSessionDto } from '../types/contract-dto';
import { parseApiError } from '../utils/api-error';
import { mapBackendUser } from '../utils/mappers';
import { toTimestamp } from '../utils/normalizers';
import { apiRequest } from '../services/apiClient';

type SafeUser = Omit<User, 'password'>;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const hasUserId = (value: unknown): value is { id: string | number } => {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === 'string' || typeof value.id === 'number';
};

const extractAuthSessionDto = (responsePayload: unknown): AuthSessionDto => {
  const responseData = isRecord(responsePayload) ? responsePayload.data : undefined;

  // Candidate layers from outermost to innermost.
  // Handles:
  //   1. apiClient already stripped the envelope: { token, user }
  //   2. apiClient returned the full envelope: { message, data: { token, user } }
  //   3. apiClient returned a double-wrapped: { message, data: { data: { token, user } } }
  //   4. AuthSessionDto already: { token, user } nested in responseData
  const candidates: unknown[] = [
    responsePayload, // case 1: already unwrapped
    responseData,   // case 2: one-level envelope
    isRecord(responseData) ? responseData.data : undefined, // case 3: double nested
  ];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue;
    }

    const token = toNonEmptyString(candidate.token);
    const user = candidate.user;

    if (!token || !hasUserId(user)) {
      continue;
    }

    return {
      token,
      user: user as AuthSessionDto['user'],
    };
  }

  throw parseApiError({
    message: 'Invalid auth response payload',
    statusCode: 502,
    raw: responsePayload,
  });
};

const toSafeUser = (dto: AuthSessionDto['user']): SafeUser => {
  const mappedUser = mapBackendUser({
    ...(dto as Parameters<typeof mapBackendUser>[0]),
    status: dto.status ?? 'ACTIVE',
    createdAt: dto.createdAt ?? new Date(0).toISOString(),
  });

  return mappedUser;
};

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
  user: toSafeUser(dto.user),
});

const trySessionRequest = async (
  path: string,
  payload: LoginPayload | RegisterPayload,
): Promise<AuthSession | null> => {
  try {
    const responsePayload = await apiRequest<unknown>(path, {
      method: 'POST',
      body: payload,
      includeAuth: false,
    });

    const sessionDto = extractAuthSessionDto(responsePayload);
    const session = toSessionFromDto(sessionDto);
    writeStoredSession(session);
    return session;
  } catch (error) {
    const parsed = parseApiError(error);

    // During migration/dev, keep compatibility if backend is unreachable.
    if (
      parsed.statusCode === 404 ||
      /failed to fetch|networkerror|network error|request failed/i.test(parsed.message)
    ) {
      return null;
    }

    throw parsed;
  }
};

export const restoreSession = async (): Promise<AuthSession | null> => {
  const stored = readStoredSession();
  if (!stored) {
    return null;
  }

  if (isSessionExpired(stored.expiresAt)) {
    writeStoredSession(null);
    return null;
  }

  return stored;
};

export const login = async (payload: LoginPayload): Promise<AuthSession> => {
  const normalizedPayload: LoginPayload = {
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  };

  const session = await trySessionRequest('/api/auth/login', normalizedPayload);
  if (session) {
    return session;
  }

  throw parseApiError({
    message: 'Auth API is unavailable. Please make sure backend `/api/auth/login` is running.',
    statusCode: 503,
  });
};

export const register = async (payload: RegisterPayload): Promise<AuthSession> => {
  const normalizedPayload: RegisterPayload = {
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  };

  const session = await trySessionRequest('/api/auth/register', {
    fullName: normalizedPayload.name,
    email: normalizedPayload.email,
    password: normalizedPayload.password,
    role: 'TEACHER',
  } as unknown as RegisterPayload);

  if (session) {
    return session;
  }

  throw parseApiError({
    message: 'Auth API is unavailable. Please make sure backend `/api/auth/register` is running.',
    statusCode: 503,
  });
};

export const loginWithProvider = async (
  payload: ProviderLoginPayload,
): Promise<AuthSession> => {
  // Provider endpoints are not yet available in backend auth routes.
  throw parseApiError({
    message: `Sign in with ${payload.provider} is not available yet. Please use email/password login.`,
    statusCode: 501,
  });
};

export const forgotPassword = async (
  payload: ForgotPasswordPayload,
): Promise<boolean> => {
  const email = payload.email.trim();

  if (!email) {
    throw parseApiError({ message: 'Email is required', statusCode: 400 });
  }

  // Endpoint is not yet available. Return privacy-safe acknowledgment for UI compatibility.
  return true;
};

export const logout = async (): Promise<void> => {
  writeStoredSession(null);
};

export const getCurrentSession = async (): Promise<AuthSession | null> => restoreSession();

export const refreshSessionUser = async (
  userId: string,
): Promise<AuthSession | null> => {
  const stored = readStoredSession();
  if (!stored || stored.user.id !== userId) {
    return stored;
  }

  if (isSessionExpired(stored.expiresAt)) {
    writeStoredSession(null);
    return null;
  }

  return stored;
};
