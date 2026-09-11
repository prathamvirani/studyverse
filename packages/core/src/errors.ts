import type { ErrorCode } from '@study/contracts';
export const errorStatus: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  CSRF_REJECTED: 403,
  ORIGIN_REJECTED: 403,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};
const messages: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Authentication required.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'Resource not found.',
  INVALID_REQUEST: 'Invalid request.',
  CSRF_REJECTED: 'Request verification failed.',
  ORIGIN_REJECTED: 'Origin not allowed.',
  RATE_LIMITED: 'Too many requests.',
  CONFLICT: 'Conflict.',
  UNAVAILABLE: 'Service unavailable.',
  INTERNAL: 'Internal error.',
};
export class AppError extends Error {
  constructor(readonly code: ErrorCode) {
    super(messages[code]);
  }
}
export function safeError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('INTERNAL');
}
