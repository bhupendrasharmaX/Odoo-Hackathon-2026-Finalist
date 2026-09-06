import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from './AuthContext';
import { inGroup, type RoleGroup } from './permissions';

/** Full-screen spinner while /auth/me settles, so no route flashes first. */
function Booting() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--canvas)]">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <p className="text-sm text-[var(--slate)]">Restoring your session…</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, booting } = useAuth();
  const location = useLocation();

  if (booting) return <Booting />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/**
 * Route-level role gate. Renders an explanation rather than redirecting: a
 * silent bounce to the dashboard reads as a bug, and the wall between
 * HR_MANAGER and payroll is a rule worth stating out loud.
 */
export function RequireRole({ group, children }: { group: RoleGroup; children: ReactNode }) {
  const { user } = useAuth();

  if (!inGroup(user?.role, group)) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto mt-10 animate-rise">
        <span className="icon-tile w-14 h-14 tile-pink mx-auto">
          <ShieldOff size={26} />
        </span>
        <h2 className="display-sm mt-5">Not available for your role</h2>
        <p className="text-sm text-[var(--slate)] mt-2 leading-relaxed">
          This area is restricted. Your account is signed in as an authorised user, but this
          module is outside what your role may open.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
