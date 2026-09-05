import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Banknote,
  Clock,
  CalendarDays,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useCan } from './Can';

const NAV_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',  module: null,        action: null },
  { to: '/employees',  icon: Users,           label: 'Employees',  module: 'employees', action: 'read' },
  { to: '/payroll',    icon: Banknote,        label: 'Payroll',    module: 'payroll',   action: 'read' },
  { to: '/attendance', icon: Clock,           label: 'Attendance', module: 'attendance',action: 'read' },
  { to: '/leaves',     icon: CalendarDays,    label: 'Leaves',     module: 'leave',     action: 'read' },
  { to: '/settings',   icon: Settings,        label: 'Settings',   module: 'settings',  action: 'read' },
] as const;

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 h-screen bg-[var(--sidebar-bg)] flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-white/10">
        <span className="text-base font-semibold text-white tracking-tight">
          People<span className="text-[var(--accent-light)]">Pay</span>360
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.to} item={item} />
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center text-white text-xs font-medium">
            {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-white/50 capitalize">
              {user?.role?.replace(/_/g, ' ')}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/40 hover:text-white"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
}: {
  item: (typeof NAV_ITEMS)[number];
}) {
  // Permission check — null module means always visible
  const { allowed } = item.module
    ? useCan(item.module as any, item.action as any)
    : { allowed: true };

  if (!allowed) return null;

  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 h-9 rounded text-sm transition-colors ${
          isActive
            ? 'bg-white/10 text-white border-l-[3px] border-l-[var(--accent)] -ml-px'
            : 'text-white/60 hover:text-white hover:bg-white/5'
        }`
      }
    >
      <Icon size={16} />
      <span>{item.label}</span>
    </NavLink>
  );
}
