import type { Response } from 'express';
import type { ErrorCode } from './errors';

/**
 * The response envelope locked in 00_SHARED_CONTRACT.md.
 *
 * EVERY endpoint goes through these helpers. Never `res.json(someObject)`
 * directly - the frontend unwraps `data` unconditionally and will break on a
 * bare payload.
 */

export interface Meta {
  page: number;
  limit: number;
  total: number;
}

export interface SuccessBody<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ListBody<T> {
  success: true;
  data: T[];
  meta: Meta;
}

export interface ErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/** `{ success: true, data, message? }` */
export function sendData<T>(res: Response, data: T, message?: string, status = 200): Response {
  const body: SuccessBody<T> = message ? { success: true, data, message } : { success: true, data };
  return res.status(status).json(body);
}

/** 201 variant of {@link sendData}, for successful creates. */
export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendData(res, data, message, 201);
}

/** `{ success: true, data: [...], meta: { page, limit, total } }` */
export function sendList<T>(res: Response, data: T[], meta: Meta, status = 200): Response {
  const body: ListBody<T> = { success: true, data, meta };
  return res.status(status).json(body);
}

/** `{ success: false, error: { code, message } }` - normally called only by the error handler. */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorBody = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return res.status(status).json(body);
}
