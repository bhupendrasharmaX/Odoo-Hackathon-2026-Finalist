import type { NextFunction, Request, Response } from 'express';
import { notFound } from '../http/errors';

/** Registered after all routes, before the error handler. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(notFound(`No route matches ${req.method} ${req.originalUrl}`));
}
