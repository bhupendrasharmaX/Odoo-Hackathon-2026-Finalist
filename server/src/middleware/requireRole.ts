import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../config/roles';
import { forbidden, unauthorized } from '../http/errors';

/**
 * Route-level role gate.
 *
 *   router.get('/payruns', requireAuth, requireRole(...ROLE_GROUPS.PAYROLL), handler)
 *
 * Judges curl the API directly with an HR_MANAGER token. Hiding a menu item in
 * the frontend proves nothing - this middleware is the actual wall.
 */
export function requireRole(...allowed: readonly Role[]) {
  return function roleGate(req: Request, _res: Response, next: NextFunction): void {
    if (!req.user) {
      next(unauthorized('Authentication required'));
      return;
    }

    if (!allowed.includes(req.user.role)) {
      next(forbidden(`Role ${req.user.role} is not permitted to access this resource`));
      return;
    }

    next();
  };
}
