import type { Role } from '../types';

/**
 * The role matrix, mirrored from the server's `config/roles.ts`.
 *
 * This is UX only. The backend enforces every one of these independently, and
 * a hidden button is never the reason an action is refused - if these two ever
 * disagree, the server wins and the user sees a 403 toast.
 *
 * THE WALL: HR_MANAGER is deliberately absent from every payroll group.
 */

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  HR_MANAGER: 'HR Manager',
  HR_PAYROLL_USER: 'Payroll User',
  HR_PAYROLL_MANAGER: 'Payroll Manager',
  ADMIN: 'Administrator',
};

export const ROLE_GROUPS = {
  ADMIN_ONLY: ['ADMIN'],
  /** People-ops: employees, contracts, schedules, attendance, time off. */
  HR_PLUS: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  SALARY_READ: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  SALARY_WRITE: ['HR_PAYROLL_MANAGER', 'ADMIN'],
  PAYROLL: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  DASHBOARD: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  PAYSLIP_READ: ['EMPLOYEE', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  GRIEVANCE_RESOLVE: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  ANY: ['EMPLOYEE', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
} satisfies Record<string, Role[]>;

export type RoleGroup = keyof typeof ROLE_GROUPS;

export function inGroup(role: Role | undefined, group: RoleGroup): boolean {
  if (!role) return false;
  return (ROLE_GROUPS[group] as readonly Role[]).includes(role);
}

/**
 * Named capabilities, so a component asks "may I?" rather than restating the
 * role list. Add here, never inline a role comparison in a page.
 */
export const CAN = {
  viewDashboard: (r?: Role) => inGroup(r, 'DASHBOARD'),
  viewPeople: (r?: Role) => inGroup(r, 'HR_PLUS'),
  writePeople: (r?: Role) => inGroup(r, 'HR_PLUS'),
  viewSalaryConfig: (r?: Role) => inGroup(r, 'SALARY_READ'),
  writeSalaryConfig: (r?: Role) => inGroup(r, 'SALARY_WRITE'),
  viewPayruns: (r?: Role) => inGroup(r, 'PAYROLL'),
  viewPayslips: (r?: Role) => inGroup(r, 'PAYSLIP_READ'),
  resolveGrievance: (r?: Role) => inGroup(r, 'GRIEVANCE_RESOLVE'),
  manageUsers: (r?: Role) => inGroup(r, 'ADMIN_ONLY'),
  /** Employees see only their own rows; everyone else sees the whole org. */
  isSelfScoped: (r?: Role) => r === 'EMPLOYEE',
} as const;
