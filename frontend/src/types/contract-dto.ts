/**
 * Explicit DTO typings representing shapes sent by the backend.
 * This acts as a firebreak preventing backend types from leaking implicitly into UI models.
 */

/**
 * Backend domain role vocabulary (source-of-truth from backend contracts).
 * Frontend UI authorization roles are a projection layer defined separately.
 */
export type BackendUserRole = 'TEACHER' | 'STUDENT' | 'ADMIN';
export type BackendUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING' | 'LOCKED';
export type BackendOrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type BackendPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

/**
 * User record as sent by the backend in auth and profile responses.
 * All fields must match what the backend serializes.
 */
export interface UserResponseDto {
  id: number | string;
  fullName: string;
  email: string;
  role: BackendUserRole;
  status?: BackendUserStatus;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Response shape from POST /api/auth/login and /api/auth/refresh-token → data field.
 * Backend wraps this in { success, message, data: AuthSessionDto }
 */
export interface AuthSessionDto {
  token: string;
  refreshToken: string;
  expiresAt: string;
  user: UserResponseDto;
}

/**
 * Minimal envelope for standard backend responses when no data is returned.
 */
export interface ApiMessageDto {
  success: boolean;
  message: string;
}
