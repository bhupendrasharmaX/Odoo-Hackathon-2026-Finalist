import { useEffect, useState } from 'react';
import { Users, UserCheck, CalendarClock, Banknote, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import type { DashboardStats } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../auth/AuthContext';

/** Format INR currency */
function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api
      .getDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--slate)]">
        Loading dashboard…
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      tile: 'tile-blue',
      fmt: false,
      to: '/employees',
    },
    {
      label: 'Present Today',
      value: stats.presentToday,
      icon: UserCheck,
      tile: 'tile-green',
      fmt: false,
      to: '/attendance',
    },
    {
      label: 'Pending Leaves',
      value: stats.pendingLeaves,
      icon: CalendarClock,
      tile: 'tile-amber',
      fmt: false,
      to: '/leaves',
    },
    {
      label: 'Payroll (Net)',
      value: stats.totalPayrollAmount,
      icon: Banknote,
      tile: 'tile-purple',
      fmt: true,
      to: '/payroll',
    },
  ];

  const maxDeptCount = Math.max(
    ...stats.departmentBreakdown.map((d) => d.count)
  );

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      {/* ---------- Hero band ---------- */}
      <div className="hero-accent px-8 py-9 md:px-10 md:py-10">
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1 className="display-md mt-2">Welcome back, {firstName}</h1>
          <p className="text-sm text-white/70 mt-3 leading-relaxed">
            {stats.activeEmployees} of {stats.totalEmployees} people are active,
            and this month&apos;s payroll is{' '}
            <span className="font-semibold text-white">
              {stats.currentPayrollStatus}
            </span>
            . Here&apos;s where everything stands.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link to="/payroll" className="btn btn-on-accent">
              Review payroll
              <ArrowRight size={16} />
            </Link>
            <Link to="/employees" className="btn btn-outline-light">
              View employees
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- Stat Cards ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.to}
              className="card card-hover p-5 block group"
            >
              <div className="flex items-start justify-between">
                <span className={`icon-tile ${card.tile}`}>
                  <Icon size={19} />
                </span>
                <ArrowRight
                  size={16}
                  className="text-[var(--muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="display-sm text-[var(--ink)] tabular-nums mt-5">
                {card.fmt ? formatINR(card.value) : card.value}
              </p>
              <p className="text-[13px] font-medium text-[var(--slate)] mt-1">
                {card.label}
              </p>
            </Link>
          );
        })}
      </div>

      {/* ---------- Department Breakdown + Recent Hires ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Department Breakdown */}
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Department Breakdown</h2>
            <span className="text-xs text-[var(--muted)] tabular-nums">
              {stats.departmentBreakdown.length} departments
            </span>
          </div>
          <div className="p-5 space-y-4">
            {stats.departmentBreakdown.map((dept) => (
              <div key={dept.department} className="flex items-center gap-4">
                <span className="text-[13px] font-medium text-[var(--slate)] w-28 flex-shrink-0 truncate">
                  {dept.department}
                </span>
                <div className="flex-1 h-2.5 bg-[#EDF0F7] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-500"
                    style={{
                      width: `${(dept.count / maxDeptCount) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[13px] font-semibold text-[var(--ink)] tabular-nums w-6 text-right">
                  {dept.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Hires */}
        <div className="card overflow-hidden">
          <div className="card-head">
            <h2 className="card-title">Recent Hires</h2>
            <Link
              to="/employees"
              className="text-xs font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F7F9FD]">
                  {['Name', 'Department', 'Joined', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="h-11 px-4 text-left text-[11px] font-bold tracking-wider uppercase text-[var(--slate)] border-b border-[var(--line)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentHires.map((emp) => (
                  <tr
                    key={emp.id}
                    className="h-12 border-b border-[var(--line)] last:border-b-0 hover:bg-[#FAFBFE] transition-colors"
                  >
                    <td className="px-4 text-[13px] font-medium text-[var(--ink)] whitespace-nowrap">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="px-4 text-[13px] text-[var(--slate)] whitespace-nowrap">
                      {emp.department}
                    </td>
                    <td className="px-4 text-[13px] text-[var(--slate)] tabular-nums whitespace-nowrap">
                      {new Date(emp.dateOfJoining).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4">
                      <StatusBadge status={emp.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
