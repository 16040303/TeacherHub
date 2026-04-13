import { OrderStatus, PaymentStatus, User, UserRole, UserStatus } from '../types';
import {
  BackendOrderStatus,
  BackendPaymentStatus,
  BackendUserRole,
  BackendUserStatus,
  UserResponseDto,
} from '../types/contract-dto';
import { toSafeId } from './normalizers';

const throwUnsupportedStatus = (label: string, value: string): never => {
  throw new Error(`Unsupported ${label} at contract boundary: "${value}"`);
};

/**
 * Extract a backend source-of-truth role when the value is explicitly a backend role enum.
 */
export const parseBackendUserRole = (role: unknown): BackendUserRole | undefined => {
  if (role === 'TEACHER' || role === 'STUDENT' || role === 'ADMIN') {
    return role;
  }
  return undefined;
};

/**
 * Project backend/domain roles into the simplified UI authorization vocabulary.
 *
 * IMPORTANT: `TEACHER` and `STUDENT` are intentionally projected to `user`
 * for current UI authorization behavior. This is not a backend role equivalence.
 */
export const mapBackendRole = (role: string | BackendUserRole): UserRole => {
  switch (role.trim().toUpperCase()) {
    case 'ADMIN':
      return 'admin';
    case 'TEACHER':
    case 'STUDENT':
    case 'USER':
      return 'user';
    case 'GUEST':
      return 'guest';
    default:
      return 'guest';
  }
};

export const mapBackendUserId = (id: number | string): string => {
  return toSafeId(String(id), '');
};

export const mapBackendUserStatus = (status: string | BackendUserStatus): UserStatus => {
  switch (status.trim().toUpperCase()) {
    case 'ACTIVE':
      return 'active';
    case 'SUSPENDED':
      return 'suspended';
    case 'INACTIVE':
    case 'PENDING':
    case 'LOCKED':
      return 'locked';
    default:
      return throwUnsupportedStatus('backend user status', status);
  }
};

/**
 * Canonical runtime boundary for inbound backend order status values.
 */
export const mapBackendOrderStatus = (status: string | BackendOrderStatus): OrderStatus => {
  switch (status.trim().toUpperCase()) {
    case 'PAID':
      return 'paid';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    case 'PENDING':
      return 'pending';
    default:
      return throwUnsupportedStatus('backend order status', status);
  }
};

/**
 * Canonical runtime boundary for inbound backend payment status values.
 *
 * `CANCELLED` is preserved explicitly as `cancelled` (not folded into `pending`).
 */
export const mapBackendPaymentStatus = (status: string | BackendPaymentStatus): PaymentStatus => {
  switch (status.trim().toUpperCase()) {
    case 'PAID':
    case 'SUCCESS':
      return 'success';
    case 'FAILED':
      return 'failed';
    case 'PENDING':
      return 'pending';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return throwUnsupportedStatus('backend payment status', status);
  }
};

export const mapBackendUser = (
  dto: UserResponseDto,
): Pick<
  User,
  | 'id'
  | 'name'
  | 'email'
  | 'role'
  | 'backendRole'
  | 'status'
  | 'avatar'
  | 'bio'
  | 'createdAt'
  | 'language'
> => {
  return {
    id: mapBackendUserId(dto.id),
    name: dto.fullName || 'Unknown User',
    email: dto.email,
    role: mapBackendRole(dto.role),
    backendRole: dto.role,
    // status is optional in DTO — default to 'active' when not returned (e.g. auth response)
    status: dto.status ? mapBackendUserStatus(dto.status) : 'active',
    avatar: dto.avatarUrl || undefined,
    bio: dto.bio || undefined,
    createdAt: dto.createdAt,
    language: 'en',
  };
};
