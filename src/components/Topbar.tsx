import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Banknote,
  Clock,
  CalendarDays,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useCan } from './Can';
import type { PermissionModule, PermissionAction } from '../types';

const NAV_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',  module: null,        action: null },
  { to: '/employees',  icon: Users,           label: 'Employees',  module: 'employees', action: 'read' },
  { to: '/payroll',    icon: Banknote,        label: 'Payroll',    module: 'payroll',   action: 'read' },
  { to: '/attendance', icon: Clock,           label: 'Attendance', module: 'attendance',action: 'read' },
  { to: '/leaves',     icon: CalendarDays,    label: 'Leaves',     module: 'leave',     action: 'read' },
  { to: '/settings',   icon: Settings,        label: 'Settings',   module: 'settings',  action: 'read' },
] as const;

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[var(--line)]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="h-16 flex items-center gap-6">
          {/* Logo */}
          <NavLink to="/" className="flex-shrink-0">
            <span className="text-base font-bold tracking-tight text-[var(--ink)]">
              People<span className="text-[var(--accent)]">Pay</span>360
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </nav>

          {/* Spacer for mobile */}
          <div className="flex-1 lg:hidden" />

          {/* User cluster */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {initials}
              </div>
              <div className="hidden md:block leading-tight">
                <p className="text-[13px] font-semibold text-[var(--ink)] whitespace-nowrap">
                  {user?.name}
                </p>
                <p className="text-[11px] text-[var(--muted)] capitalize whitespace-nowrap">
                  {user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-[var(--slate)] hover:text-[var(--danger)] transition-colors p-2 rounded-[var(--r-sm)] hover:bg-[var(--canvas)]"
              title="Logout"
            >
              <LogOut size={17} />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="lg:hidden text-[var(--ink)] p-2 rounded-[var(--r-sm)] hover:bg-[var(--canvas)] transition-colors"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav className="lg:hidden border-t border-[var(--line)] px-6 py-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              variant="mobile"
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>
      )}
    </header>
  );
}

function NavItem({
  item,
  variant = 'desktop',
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
}) {
  // Hooks must run unconditionally — items with no module pass a placeholder
  // pair, then the null-module check below overrides the result.
  const { allowed: modAllowed } = useCan(
    (item.module ?? 'attendance') as PermissionModule,
    (item.action ?? 'read') as PermissionAction
  );

  // A null module means the item is always visible.
  const allowed = item.module === null ? true : modAllowed;

  if (!allowed) return null;

  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        variant === 'mobile'
          ? `flex items-center gap-3 px-3 h-11 rounded-[var(--r-md)] text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--slate)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]'
            }`
          : `flex items-center gap-2 px-3.5 h-9 rounded-[var(--r-md)] text-[13px] font-semibold transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--slate)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]'
            }`
      }
    >
      <Icon size={variant === 'mobile' ? 18 : 16} />
      <span>{item.label}</span>
    </NavLink>
  );
}
