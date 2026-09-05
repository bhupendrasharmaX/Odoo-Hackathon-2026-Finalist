import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isRole } from '../config/roles';
import { unauthorized } from '../http/errors';
import type { AccessTokenPayload, AuthUser } from '../types/auth';

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches `req.user`.
 *
 * This is the only place a token is decoded. Every downstream check reads
 * `req.user` and trusts it - so anything unverified must not get past here.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next(unauthorized('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(unauthorized('Missing bearer token'));
    return;
  }

  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    const message =
      error instanceof jwt.TokenExpiredError
        ? 'Session expired, please log in again'
        : 'Invalid authentication token';
    next(unauthorized(message));
    return;
  }

  const payload = decoded as Partial<AccessTokenPayload> | null;

  if (
    !payload ||
    typeof payload.userId !== 'string' ||
    typeof payload.email !== 'string' ||
    !isRole(payload.role)
  ) {
    next(unauthorized('Malformed authentication token'));
    return;
  }

  const user: AuthUser = {
    userId: payload.userId,
    employeeId: typeof payload.employeeId === 'string' ? payload.employeeId : null,
    role: payload.role,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : payload.email,
  };

  req.user = user;
  next();
}
