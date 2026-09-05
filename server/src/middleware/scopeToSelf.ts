import type { NextFunction, Request, Response } from 'express';
import { isSelfScopedRole } from '../config/roles';
import { forbidden, unauthorized } from '../http/errors';
import type { AuthUser } from '../types/auth';

export interface ScopeOptions {
  /**
   * Route param that carries an employee id (e.g. `:employeeId` on
   * /timeoff/balance/:employeeId). If the caller is an EMPLOYEE and this param
   * is not their own id, the request is rejected with 403. Pass `false` to
   * skip the check.
   */
  param?: string | false;
  /**
   * Query param that filters by employee (e.g. `?employeeId=`). For an
   * EMPLOYEE caller this is OVERWRITTEN with their own id - not merely
   * validated - so omitting it cannot widen the result set. Pass `false` on
   * routes that take no employee filter.
   */
  query?: string | false;
  /**
   * Body field that carries an employee id on create/update. Overwritten the
   * same way, so an EMPLOYEE cannot file a request on someone else's behalf.
   */
  body?: string | false;
}

/**
 * Forces EMPLOYEE callers into their own lane.
 *
 * Applied at the ROUTE level, never checked in the frontend. For any other
 * role this is a no-op - HR and above legitimately read the whole org.
 *
 * Note the asymmetry that matters: an explicit id in the path is REJECTED when
 * it is not theirs, while a filter in the query or body is silently REPLACED
 * with theirs. Rejecting a path id gives a clear 403 on a deliberate probe;
 * replacing a filter means a missing `?employeeId=` still returns only their
 * own rows instead of everyone's.
 */
export function scopeToSelf(options: ScopeOptions = {}) {
  const { param = 'employeeId', query = 'employeeId', body } = options;

  return function selfScope(req: Request, _res: Response, next: NextFunction): void {
    const user = req.user;

    if (!user) {
      next(unauthorized('Authentication required'));
      return;
    }

    if (!isSelfScopedRole(user.role)) {
      next();
      return;
    }

    if (!user.employeeId) {
      next(forbidden('This login is not linked to an employee record'));
      return;
    }

    const own = user.employeeId;

    if (param) {
      const requested = req.params[param];
      if (requested && requested !== own) {
        next(forbidden('You may only access your own records'));
        return;
      }
    }

    if (query) {
      // Mutate rather than reassign - req.query is a getter in Express.
      (req.query as Record<string, unknown>)[query] = own;
    }

    if (body && req.body && typeof req.body === 'object') {
      (req.body as Record<string, unknown>)[body] = own;
    }

    req.scopedEmployeeId = own;
    next();
  };
}

/**
 * Ownership check for records fetched BY THEIR OWN ID, where the employee id
 * is only known after the database read (e.g. GET /payslips/:id). Call this in
 * the service once the row is loaded.
 */
export function assertOwnsEmployee(user: AuthUser, employeeId: string | null | undefined): void {
  if (!isSelfScopedRole(user.role)) return;
  if (!user.employeeId || user.employeeId !== employeeId) {
    throw forbidden('You may only access your own records');
  }
}
