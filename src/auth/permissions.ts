/**
 * PeoplePay360 — Permission Matrix & Checker
 *
 * IMPORTANT: Frontend role-hiding is UX only — the backend enforces
 * permissions independently. Never write logic that assumes the
 * frontend is the gatekeeper.
 */
import type { Role, PermissionModule, PermissionAction, PermissionValue } from '../types';

type PermissionMatrix = Record<
  PermissionModule,
  Partial<Record<PermissionAction, Record<Role, PermissionValue>>>
>;

export const PERMISSIONS: PermissionMatrix = {
  employees: {
    read:   { super_admin: true, hr_manager: true, hr_executive: true,  payroll_manager: true,  employee: 'self' },
    write:  { super_admin: true, hr_manager: true, hr_executive: true,  payroll_manager: false, employee: false },
    delete: { super_admin: true, hr_manager: true, hr_executive: false, payroll_manager: false, employee: false },
  },
  payroll: {
    read:    { super_admin: true, hr_manager: true,  hr_executive: false, payroll_manager: true,  employee: 'self' },
    write:   { super_admin: true, hr_manager: false, hr_executive: false, payroll_manager: true,  employee: false },
    approve: { super_admin: true, hr_manager: true,  hr_executive: false, payroll_manager: false, employee: false },
  },
  attendance: {
    read:  { super_admin: true, hr_manager: true, hr_executive: true,  payroll_manager: true,  employee: 'self' },
    write: { super_admin: true, hr_manager: true, hr_executive: true,  payroll_manager: false, employee: 'self' },
  },
  leave: {
    read:    { super_admin: true, hr_manager: true,  hr_executive: true,  payroll_manager: false, employee: 'self' },
    write:   { super_admin: true, hr_manager: true,  hr_executive: false, payroll_manager: false, employee: 'self' },
    approve: { super_admin: true, hr_manager: true,  hr_executive: false, payroll_manager: false, employee: false },
  },
  settings: {
    read:  { super_admin: true, hr_manager: true,  hr_executive: false, payroll_manager: false, employee: false },
    write: { super_admin: true, hr_manager: false, hr_executive: false, payroll_manager: false, employee: false },
  },
  reports: {
    read: { super_admin: true, hr_manager: true, hr_executive: false, payroll_manager: true, employee: false },
  },
};

/**
 * Check if a role has permission for a given module and action.
 * Returns true, false, or 'self'.
 */
export function checkPermission(
  role: Role,
  module: PermissionModule,
  action: PermissionAction
): PermissionValue {
  const modulePerms = PERMISSIONS[module];
  if (!modulePerms) return false;
  const actionPerms = modulePerms[action];
  if (!actionPerms) return false;
  return actionPerms[role] ?? false;
}
