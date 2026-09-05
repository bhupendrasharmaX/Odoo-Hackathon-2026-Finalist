import type { Role } from '../config/roles';

/** What `requireAuth` attaches to `req.user` after verifying the bearer token. */
export interface AuthUser {
  userId: string;
  /** Null for a login that is not linked to an employee record (e.g. a bare admin). */
  employeeId: string | null;
  role: Role;
  email: string;
  name: string;
}

/** The signed JWT body. Keep it small - it travels on every request. */
export interface AccessTokenPayload {
  userId: string;
  employeeId: string | null;
  role: Role;
  email: string;
  name: string;
}
