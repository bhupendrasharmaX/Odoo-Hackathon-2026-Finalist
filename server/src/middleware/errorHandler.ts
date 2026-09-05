import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError, ERROR_STATUS, type ErrorCode } from '../http/errors';
import { sendError } from '../http/envelope';
import { logger } from '../lib/logger';

interface Normalised {
  code: ErrorCode;
  status: number;
  message: string;
  details?: unknown;
  /** Unexpected errors get their stack logged; expected ones do not. */
  unexpected: boolean;
}

/**
 * Duck-typed Prisma detection. We cannot `instanceof` against
 * PrismaClientKnownRequestError because the generated client may not exist yet
 * (see lib/prisma.ts), so we match on its shape instead.
 */
function asPrismaError(error: unknown): { code: string; meta?: Record<string, unknown> } | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'clientVersion' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((error as { code: string }).code)
  ) {
    return error as { code: string; meta?: Record<string, unknown> };
  }
  return null;
}

function normalise(error: unknown): Normalised {
  if (error instanceof AppError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details,
      unexpected: false,
    };
  }

  if (error instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      status: ERROR_STATUS.VALIDATION_ERROR,
      message: 'Request validation failed',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
      unexpected: false,
    };
  }

  const prismaError = asPrismaError(error);
  if (prismaError) {
    switch (prismaError.code) {
      case 'P2002': {
        const target = prismaError.meta?.target;
        const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'field');
        return {
          code: 'CONFLICT',
          status: ERROR_STATUS.CONFLICT,
          message: `A record with this ${fields} already exists`,
          unexpected: false,
        };
      }
      case 'P2025':
        return {
          code: 'NOT_FOUND',
          status: ERROR_STATUS.NOT_FOUND,
          message: 'Resource not found',
          unexpected: false,
        };
      case 'P2003':
        return {
          code: 'CONFLICT',
          status: ERROR_STATUS.CONFLICT,
          message: 'Related record is missing or still referenced',
          unexpected: false,
        };
      default:
        return {
          code: 'SERVER_ERROR',
          status: ERROR_STATUS.SERVER_ERROR,
          message: 'Database error',
          unexpected: true,
        };
    }
  }

  return {
    code: 'SERVER_ERROR',
    status: ERROR_STATUS.SERVER_ERROR,
    message: 'Something went wrong',
    unexpected: true,
  };
}

/**
 * Central error handler. Must be registered LAST, after every route.
 *
 * Nothing internal leaks: only AppError messages reach the client verbatim.
 * Unexpected errors are logged with a stack and reported generically - except
 * in development, where the real message is echoed back to save you a trip to
 * the terminal.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalised = normalise(error);

  if (normalised.unexpected) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, error);
  } else if (env.isDevelopment) {
    logger.warn(`${normalised.code} on ${req.method} ${req.originalUrl}: ${normalised.message}`);
  }

  const message =
    normalised.unexpected && env.isDevelopment && error instanceof Error
      ? error.message
      : normalised.message;

  sendError(res, normalised.status, normalised.code, message, normalised.details);
}
