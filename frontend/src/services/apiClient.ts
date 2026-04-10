import { API_BASE_URL } from '../app/config/constants';
import { STORAGE_KEYS } from '../app/config/storage';
import type { ApiResponse } from '../types';
import { parseApiError } from '../utils/api-error';

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  authToken?: string;
  includeAuth?: boolean;
}

const buildUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  let normalizedBase = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // When VITE_API_URL already ends with `/api` but callers use paths like `/api/auth/...`,
  // avoid `.../api/api/...` (404) — common with .env examples that set base to `http://host:port/api`.
  if (normalizedPath.startsWith('/api/') && /\/api$/i.test(normalizedBase)) {
    normalizedBase = normalizedBase.replace(/\/api$/i, '');
  }

  return `${normalizedBase}${normalizedPath}`;
};

const readStoredToken = (): string | undefined => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.authSession);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === 'string' && parsed.token.trim() ? parsed.token.trim() : undefined;
  } catch {
    return undefined;
  }
};

const extractPayload = async <T>(response: Response): Promise<T> => {
  let parsed: unknown = null;

  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw parseApiError({
      ...(typeof parsed === 'object' && parsed !== null ? parsed : {}),
      statusCode: response.status,
      status: response.status,
      message:
        typeof (parsed as { message?: unknown } | null)?.message === 'string'
          ? (parsed as { message: string }).message
          : `Request failed with status ${response.status}`,
      raw: parsed,
    });
  }

  if (parsed === null || parsed === undefined) {
    return undefined as T;
  }

  if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
    return (parsed as ApiResponse<T>).data;
  }

  return parsed as T;
};

export const apiRequest = async <T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const {
    body,
    authToken,
    includeAuth = true,
    headers,
    method = body === undefined ? 'GET' : 'POST',
    ...rest
  } = options;

  const resolvedToken = authToken ?? (includeAuth ? readStoredToken() : undefined);
  const hasBody = body !== undefined;

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : Array.isArray(headers)
      ? Object.fromEntries(headers)
      : (headers as Record<string, string> | undefined) ?? {}),
  };

  if (resolvedToken) {
    requestHeaders.Authorization = `Bearer ${resolvedToken}`;
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...rest,
      method,
      headers: requestHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    return await extractPayload<T>(response);
  } catch (error) {
    throw parseApiError(error);
  }
};
