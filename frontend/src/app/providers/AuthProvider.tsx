import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthProvider as ExternalAuthProvider } from '../../types';
import {
  AuthSession,
  LANGUAGES,
  USER_ROLES,
  USER_STATUSES,
} from '../../types';
import { authService } from '../../services/authService';
import {
  mapBackendUserId,
  mapBackendRole,
  mapBackendUserStatus,
  parseBackendUserRole,
} from '../../utils/mappers';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthSession['user'] | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (input: LoginInput) => Promise<AuthSession>;
  loginWithProvider: (provider: ExternalAuthProvider) => Promise<AuthSession>;
  register: (input: RegisterInput) => Promise<AuthSession>;
  forgotPassword: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthSession | null>;
  setSession: React.Dispatch<React.SetStateAction<AuthSession | null>>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

const normalizeSession = (value: AuthSession | null): AuthSession | null => {
  if (!value || typeof value.token !== 'string') {
    return null;
  }

  const token = value.token.trim();
  const user = value.user;

  if (!user || typeof user !== 'object') {
    return null;
  }

  const userId =
    typeof user.id === 'string' || typeof user.id === 'number'
      ? mapBackendUserId(user.id)
      : '';
  if (!token || !userId) {
    return null;
  }

  const role = user.role ? mapBackendRole(String(user.role)) : 'user';
  const backendRole =
    parseBackendUserRole(user.backendRole) ?? parseBackendUserRole(user.role);
  const status = user.status ? mapBackendUserStatus(String(user.status)) : 'active';

  const language =
    typeof user.language === 'string' &&
    LANGUAGES.includes(user.language as (typeof LANGUAGES)[number])
      ? (user.language as (typeof LANGUAGES)[number])
      : 'en';

  const expiresAt =
    typeof value.expiresAt === 'string' && !Number.isNaN(new Date(value.expiresAt).getTime())
      ? new Date(value.expiresAt).toISOString()
      : undefined;

  return {
    ...value,
    token,
    expiresAt,
    refreshToken:
      typeof value.refreshToken === 'string' && value.refreshToken.trim()
        ? value.refreshToken.trim()
        : undefined,
    user: {
      ...user,
      id: userId,
      name: user.name?.trim() || 'TeacherHub User',
      role,
      backendRole,
      status,
      language,
      avatar: user.avatar?.trim() || undefined,
    },
  };
};

const requireSession = (value: AuthSession | null, actionLabel: string): AuthSession => {
  if (!value) {
    throw new Error(`Unable to ${actionLabel}. Please try again.`);
  }

  return value;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restore = async (): Promise<void> => {
      try {
        const restored = normalizeSession(await authService.restoreSession());
        if (!active) {
          return;
        }

        setSession(restored);
      } catch {
        if (active) {
          setSession(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput): Promise<AuthSession> => {
    const nextSession = requireSession(
      normalizeSession(await authService.login(input)),
      'complete sign in',
    );
    setSession(nextSession);
    return nextSession;
  }, []);

  const loginWithProvider = useCallback(
    async (provider: ExternalAuthProvider): Promise<AuthSession> => {
      const nextSession = requireSession(
        normalizeSession(await authService.loginWithProvider({ provider })),
        'complete provider sign in',
      );
      setSession(nextSession);
      return nextSession;
    },
    [],
  );

  const register = useCallback(async (input: RegisterInput): Promise<AuthSession> => {
    const nextSession = requireSession(
      normalizeSession(await authService.register(input)),
      'complete registration',
    );
    setSession(nextSession);
    return nextSession;
  }, []);

  const forgotPassword = useCallback(
    async (email: string): Promise<boolean> => authService.forgotPassword({ email }),
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    await authService.logout();
    setSession(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<AuthSession | null> => {
    if (!session?.user?.id) {
      return null;
    }

    const nextSession = normalizeSession(await authService.refreshSessionUser(session.user.id));
    setSession(nextSession);
    return nextSession;
  }, [session?.user?.id]);

  const rawUser = session?.user ?? null;

  // Safe-default critical user fields to prevent UI crashes from partial session data.
  const user = rawUser
    ? {
        ...rawUser,
        name: rawUser.name?.trim() || 'TeacherHub User',
        role: rawUser.role || 'user',
        status: rawUser.status || 'active',
        avatar: rawUser.avatar || undefined,
      }
    : null;

  const isAuthenticated = Boolean(session?.token && user);
  const isAdmin = user?.role === 'admin';

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      isAuthenticated,
      isAdmin,
      login,
      loginWithProvider,
      register,
      forgotPassword,
      logout,
      refreshSession,
      setSession,
    }),
    [
      session,
      user,
      loading,
      isAuthenticated,
      isAdmin,
      login,
      loginWithProvider,
      register,
      forgotPassword,
      logout,
      refreshSession,
      setSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
