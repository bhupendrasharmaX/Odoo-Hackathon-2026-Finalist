import { useEffect, useState } from 'react';
import { Users, UserCheck, CalendarClock, Banknote } from 'lucide-react';
import api from '../api';
import type { DashboardStats } from '../types';
import { StatusBadge } from '../components/StatusBadge';

/** Format INR currency */
function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

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
      fmt: false,
    },
    {
      label: 'Present Today',
      value: stats.presentToday,
      icon: UserCheck,
      fmt: false,
    },
    {
      label: 'Pending Leaves',
      value: stats.pendingLeaves,
      icon: CalendarClock,
      fmt: false,
    },
    {
      label: 'Payroll (Net)',
      value: stats.totalPayrollAmount,
      icon: Banknote,
      fmt: true,
    },
  ];

  const maxDeptCount = Math.max(
    ...stats.departmentBreakdown.map((d) => d.count)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-lg font-semibold text-[var(--ink)]">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border border-[var(--line)] rounded p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[var(--slate)] uppercase tracking-wider">
                  {card.label}
                </span>
                <Icon size={16} className="text-[var(--slate)]" />
              </div>
              <p className="text-2xl font-semibold text-[var(--ink)] tabular-nums">
                {card.fmt ? formatINR(card.value) : card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Department Breakdown + Recent Hires */}
      <div className="grid grid-cols-2 gap-4">
        {/* Department Breakdown */}
        <div className="bg-white border border-[var(--line)] rounded">
          <div className="px-4 py-3 border-b border-[var(--line)]">
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Department Breakdown
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {stats.departmentBreakdown.map((dept) => (
              <div key={dept.department} className="flex items-center gap-3">
                <span className="text-xs text-[var(--slate)] w-24 flex-shrink-0 truncate">
                  {dept.department}
                </span>
                <div className="flex-1 h-5 bg-[var(--canvas)] rounded overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded"
                    style={{
                      width: `${(dept.count / maxDeptCount) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-[var(--ink)] tabular-nums w-6 text-right">
                  {dept.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Hires */}
        <div className="bg-white border border-[var(--line)] rounded">
          <div className="px-4 py-3 border-b border-[var(--line)]">
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Recent Hires
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[#F8FAFC]">
                <th className="h-10 px-4 text-left text-[11px] font-semibold tracking-wider uppercase text-[var(--slate)] border-b border-[var(--line)]">
                  Name
                </th>
                <th className="h-10 px-4 text-left text-[11px] font-semibold tracking-wider uppercase text-[var(--slate)] border-b border-[var(--line)]">
                  Department
                </th>
                <th className="h-10 px-4 text-left text-[11px] font-semibold tracking-wider uppercase text-[var(--slate)] border-b border-[var(--line)]">
                  Joined
                </th>
                <th className="h-10 px-4 text-left text-[11px] font-semibold tracking-wider uppercase text-[var(--slate)] border-b border-[var(--line)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recentHires.map((emp) => (
                <tr
                  key={emp.id}
                  className="h-10 border-b border-[var(--line)] last:border-b-0"
                >
                  <td className="px-4 text-[13px] text-[var(--ink)]">
                    {emp.firstName} {emp.lastName}
                  </td>
                  <td className="px-4 text-[13px] text-[var(--slate)]">
                    {emp.department}
                  </td>
                  <td className="px-4 text-[13px] text-[var(--slate)] tabular-nums">
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
  );
}
