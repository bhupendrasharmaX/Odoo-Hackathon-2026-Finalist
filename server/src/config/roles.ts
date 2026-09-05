/**
 * Role strings locked by 00_SHARED_CONTRACT.md. These exact literals appear in
 * the JWT, in the database and in the frontend - do not alias or rename them.
 */
export const ROLES = [
  'EMPLOYEE',
  'HR_MANAGER',
  'HR_PAYROLL_USER',
  'HR_PAYROLL_MANAGER',
  'ADMIN',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Named groups straight out of the permission matrix. Routes should use these
 * rather than spelling out role lists inline, so the matrix lives in exactly
 * one place and a change here changes every route at once.
 *
 * THE WALL: HR_MANAGER is deliberately absent from every payroll group below.
 * That is the single most-tested rule in the whole project - it is enforced
 * here, in middleware, never in the frontend.
 */
export const ROLE_GROUPS = {
  /** Anyone with a valid token. */
  ANY: ROLES,

  /** Admin-only surface: /users and role assignment. */
  ADMIN_ONLY: ['ADMIN'] as const,

  /** People-ops modules: employees, contracts, schedules, attendance, time off. */
  HR_PLUS: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'] as const,

  /** Salary structures / rules - read. HR_MANAGER is walled out. */
  SALARY_READ: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'] as const,

  /** Salary structures / rules - write. HR_PAYROLL_USER is read-only. */
  SALARY_WRITE: ['HR_PAYROLL_MANAGER', 'ADMIN'] as const,

  /** Payruns and payslips. HR_MANAGER is walled out. */
  PAYROLL: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'] as const,

  /** Dashboard. HR_MANAGER is walled out. */
  DASHBOARD: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'] as const,

  /**
   * Reading payslips: an EMPLOYEE may read their OWN (narrowed further by
   * scopeToSelf). HR_MANAGER is still walled out entirely.
   */
  PAYSLIP_READ: ['EMPLOYEE', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'] as const,

  /** People-ops modules an employee may also touch for their own records. */
  SELF_OR_HR: [
    'EMPLOYEE',
    'HR_MANAGER',
    'HR_PAYROLL_USER',
    'HR_PAYROLL_MANAGER',
    'ADMIN',
  ] as const,

  /** Who may resolve a grievance (an employee may only raise one). */
  GRIEVANCE_RESOLVE: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'] as const,
} satisfies Record<string, readonly Role[]>;

/** Employees see only their own records; everyone else sees the whole org. */
export function isSelfScopedRole(role: Role): boolean {
  return role === 'EMPLOYEE';
}
