import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { ROLE_LABELS } from '../auth/permissions';
import type { Role } from '../types';
import { Avatar } from './ui';

interface NavLeaf {
  to: string;
  label: string;
  visible: (role: Role) => boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: typeof Users;
  /** A group with a single visible leaf renders as a plain link. */
  items: NavLeaf[];
}

const NAV: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [{ to: '/', label: 'Dashboard', visible: () => true }],
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    items: [
      {
        to: '/employees',
        label: 'Employees',
        visible: () => true,
      },
      {
        to: '/contracts',
        label: 'Contracts',
        visible: (role) => CAN.viewPeople(role),
      },
      {
        to: '/schedules',
        label: 'Working schedules',
        visible: (role) => CAN.viewPeople(role),
      },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: Clock,
    items: [{ to: '/attendance', label: 'Attendance', visible: () => true }],
  },
  {
    id: 'timeoff',
    label: 'Time Off',
    icon: CalendarDays,
    items: [
      { to: '/time-off', label: 'Requests', visible: () => true },
      {
        to: '/time-off/allocations',
        label: 'Allocations',
        visible: () => true,
      },
      {
        to: '/time-off/types',
        label: 'Time off types',
        visible: (role) => CAN.viewPeople(role),
      },
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll',
    icon: Wallet,
    items: [
      {
        to: '/payroll/payruns',
        label: 'Payruns',
        visible: (role) => CAN.viewPayruns(role),
      },
      {
        to: '/payroll/payslips',
        label: 'Payslips',
        visible: (role) => CAN.viewPayslips(role),
      },
      {
        to: '/payroll/structures',
        label: 'Salary structures',
        visible: (role) => CAN.viewSalaryConfig(role),
      },
      {
        to: '/payroll/rules',
        label: 'Salary rules',
        visible: (role) => CAN.viewSalaryConfig(role),
      },
    ],
  },
  {
    id: 'more',
    label: 'More',
    icon: MessageSquareWarning,
    items: [
      { to: '/grievances', label: 'Grievances', visible: () => true },
      {
        to: '/users',
        label: 'Users & roles',
        visible: (role) => CAN.manageUsers(role),
      },
      { to: '/settings', label: 'My account', visible: () => true },
    ],
  },
];

const LEAF_ICON: Record<string, typeof Users> = {
  '/employees': Users,
  '/contracts': FileText,
  '/schedules': CalendarDays,
  '/time-off': CalendarDays,
  '/time-off/allocations': CalendarDays,
  '/time-off/types': FileSpreadsheet,
  '/payroll/payruns': Wallet,
  '/payroll/payslips': Receipt,
  '/payroll/structures': FileSpreadsheet,
  '/payroll/rules': FileSpreadsheet,
  '/grievances': MessageSquareWarning,
  '/users': ShieldCheck,
  '/settings': Settings,
};

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const role = user?.role;

  // Any navigation closes whatever is open - including a click on the link
  // that is already active, which would otherwise leave the menu hanging.
  useEffect(() => {
    setOpenGroup(null);
    setAccountOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (navRef.current && !navRef.current.contains(target)) setOpenGroup(null);
      if (accountRef.current && !accountRef.current.contains(target)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenGroup(null);
      setAccountOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Drop a pending close if this unmounts mid-hover.
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Pointing at a group opens it; leaving waits a beat, so a diagonal move
  // towards the panel does not snap it shut on the way.
  const hoverOpen = (id: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenGroup(id);
  };

  const hoverClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenGroup(null), 140);
  };

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => (role ? item.visible(role) : false)),
  })).filter((group) => group.items.length > 0);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
    );

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-[var(--line)] shadow-[0_1px_2px_rgba(11,20,36,0.04)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center gap-5">
          <NavLink to="/" className="flex-shrink-0 flex items-center gap-2.5 group">
            <span className="w-8 h-8 rounded-[10px] bg-[var(--accent)] text-white grid place-items-center font-black text-[13px] shadow-[var(--shadow-accent)] transition-transform group-hover:scale-105">
              P
            </span>
            <span className="text-[17px] font-extrabold tracking-tight text-[var(--ink)] hidden sm:block">
              People<span className="text-[var(--accent)]">Pay</span>360
            </span>
          </NavLink>

          <nav ref={navRef} className="hidden lg:flex items-center gap-0.5 flex-1">
            {groups.map((group) => {
              const Icon = group.icon;
              const active = isGroupActive(group);

              if (group.items.length === 1) {
                const only = group.items[0];
                return (
                  <NavLink
                    key={group.id}
                    to={only.to}
                    end={only.to === '/'}
                    onMouseEnter={hoverClose}
                    className={({ isActive }) => `nav-pill ${isActive ? 'nav-pill-active' : ''}`}
                  >
                    <Icon size={15} />
                    {group.label}
                  </NavLink>
                );
              }

              const open = openGroup === group.id;

              return (
                <div
                  key={group.id}
                  className="relative"
                  onMouseEnter={() => hoverOpen(group.id)}
                  onMouseLeave={hoverClose}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroup((current) => (current === group.id ? null : group.id))
                    }
                    aria-expanded={open}
                    className={`nav-pill ${active || open ? 'nav-pill-active' : ''}`}
                  >
                    <Icon size={15} />
                    {group.label}
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {open && (
                    <div className="absolute left-0 top-full pt-2 w-[212px]">
                      <div className="sheet p-1.5">
                        {group.items.map((item) => {
                          const LeafIcon = LEAF_ICON[item.to] ?? group.icon;
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={item.to === '/time-off'}
                              className={({ isActive }) =>
                                `flex items-center gap-2.5 px-2.5 h-9 rounded-[var(--r-md)] text-[13px] transition-colors ${
                                  isActive
                                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                                    : 'text-[var(--ink)] font-medium hover:bg-[var(--canvas)]'
                                }`
                              }
                            >
                              <LeafIcon size={15} className="flex-shrink-0 opacity-70" />
                              {item.label}
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex-1 lg:hidden" />

          <div className="flex items-center gap-2 flex-shrink-0">
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-full border transition-colors ${
                  accountOpen
                    ? 'bg-[var(--accent-soft)] border-[var(--accent)]/25'
                    : 'bg-[#F6F8FC] border-[var(--line)] hover:bg-[#EEF1F8]'
                }`}
              >
                <Avatar name={user?.name} size={28} />
                <span className="hidden md:block leading-tight text-left">
                  <span className="block text-[12px] font-bold text-[var(--ink)] whitespace-nowrap">
                    {user?.name}
                  </span>
                  <span className="block text-[10px] text-[var(--muted)] font-medium whitespace-nowrap">
                    {role ? ROLE_LABELS[role] : ''}
                  </span>
                </span>
                <ChevronDown
                  size={13}
                  className={`hidden sm:block text-[var(--muted)] transition-transform duration-150 ${
                    accountOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {accountOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-[250px] sheet p-1.5 z-50"
                  role="menu"
                >
                  <div className="flex items-center gap-3 px-2.5 py-2.5 mb-1 border-b border-[var(--line)]">
                    <Avatar name={user?.name} size={38} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[var(--ink)] truncate">
                        {user?.name}
                      </p>
                      <p className="text-[11.5px] text-[var(--muted)] truncate">{user?.email}</p>
                    </div>
                  </div>

                  <NavLink to="/settings" className="menu-item" role="menuitem">
                    <Settings size={15} className="text-[var(--muted)]" />
                    My account
                  </NavLink>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="menu-item menu-item-danger"
                    role="menuitem"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="lg:hidden text-[var(--ink)] p-2 rounded-[var(--r-md)] hover:bg-[var(--canvas)] transition-colors"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav className="lg:hidden border-t border-[var(--line)] px-3 py-3 bg-white max-h-[70vh] overflow-y-auto animate-rise">
          {groups.map((group) => (
            <div key={group.id} className="mb-3 last:mb-0">
              <p className="menu-label">{group.label}</p>
              {group.items.map((item) => {
                const LeafIcon = LEAF_ICON[item.to] ?? group.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/' || item.to === '/time-off'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 h-11 rounded-[var(--r-md)] text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--slate)] hover:bg-[var(--canvas)]'
                      }`
                    }
                  >
                    <LeafIcon size={16} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
