import type { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. Undefined on public routes. */
      user?: AuthUser;
      /**
       * Set by `scopeToSelf` when the caller is an EMPLOYEE - the only
       * employeeId they are allowed to read or write.
       */
      scopedEmployeeId?: string;
    }
  }
}

export {};
