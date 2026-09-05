/**
 * Error taxonomy for the API.
 *
 * The six codes below are LOCKED by 00_SHARED_CONTRACT.md. The frontend
 * switches on them, so never invent a seventh - if you need to say something
 * more specific, put it in `message` or `details`, not in a new code.
 */

export const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/**
 * Any error thrown as an AppError is considered "expected" and is rendered to
 * the client verbatim. Anything else that reaches the error handler is treated
 * as a bug: it gets logged with its stack and reported as SERVER_ERROR with a
 * generic message, so internals never leak.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const unauthorized = (message = 'Authentication required') =>
  new AppError('UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError('FORBIDDEN', message);

export const notFound = (message = 'Resource not found') =>
  new AppError('NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError('CONFLICT', message, details);

export const validationError = (message: string, details?: unknown) =>
  new AppError('VALIDATION_ERROR', message, details);

export const serverError = (message = 'Something went wrong') =>
  new AppError('SERVER_ERROR', message);

/**
 * Placeholder for routes that are wired but not yet implemented. Returns 500
 * rather than 404 on purpose: the route EXISTS, it just has no body yet, and a
 * 404 here would be indistinguishable from a typo in the path.
 */
export const notImplemented = (what: string) =>
  new AppError('SERVER_ERROR', `Not implemented yet: ${what}`);
