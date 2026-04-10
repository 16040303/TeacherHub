/**
 * Explicit DTO typings representing shapes sent by the backend.
 * This acts as a firebreak preventing backend types from leaking implicitly into UI models.
 */

/**
 * Backend domain role vocabulary (source-of-truth from backend contracts).
 * Frontend UI authorization roles are a projection layer defined separately.
 */
export type BackendUserRole = 'TEACHER' | 'STUDENT' | 'ADMIN';
export type BackendUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type BackendOrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type BackendPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface UserResponseDto {
  id: number;
  fullName: string;
  email: string;
  role: BackendUserRole;
  status: BackendUserStatus;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
}

export interface AuthSessionDto {
  token: string;
  user: UserResponseDto;
}
