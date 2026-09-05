/**
 * PeoplePay360 — <Can> Component & useCan() Hook
 *
 * IMPORTANT: Frontend role-hiding is UX only — the backend enforces
 * permissions independently. Never write logic that assumes the
 * frontend is the gatekeeper.
 */
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { checkPermission } from '../auth/permissions';
import type { PermissionModule, PermissionAction } from '../types';

/**
 * Hook to check if the current user's role has permission
 * for the given module + action.
 *
 * Returns { allowed: boolean, isSelfOnly: boolean }
 */
export function useCan(module: PermissionModule, action: PermissionAction) {
  const { user } = useAuth();
  if (!user) return { allowed: false, isSelfOnly: false };

  const perm = checkPermission(user.role, module, action);
  return {
    allowed: perm === true || perm === 'self',
    isSelfOnly: perm === 'self',
  };
}

/**
 * Declarative permission gate.
 * Renders children only if the current role has permission.
 * Optionally renders a fallback.
 */
export function Can({
  module,
  action,
  children,
  fallback = null,
}: {
  module: PermissionModule;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { allowed } = useCan(module, action);
  return <>{allowed ? children : fallback}</>;
}
