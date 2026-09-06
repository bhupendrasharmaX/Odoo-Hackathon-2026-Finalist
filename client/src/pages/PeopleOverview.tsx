import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock,
  FileText,
  ShieldAlert,
  Users,
} from 'lucide-react';
import api from '../api';
import { useAsync } from '../lib/useApi';
import { formatDate, num } from '../lib/format';
import { AttendanceWidget } from '../components/AttendanceWidget';
import { StatusBadge } from '../components/StatusBadge';
import { Avatar, EmptyState, KpiCard, Section, SkeletonRows } from '../components/ui';

/**
 * The HR_MANAGER landing screen.
 *
 * HR_MANAGER is walled out of `/dashboard` by the API, so this is built only
 * from people-ops endpoints their role can actually read. The wall is stated
 * on screen rather than left as a mystery.
 */
export function PeopleOverview() {
  const employees = useAsync(() => api.employees.list({ limit: 100 }), []);
  const departments = useAsync(() => api.employees.departments(), []);
  const pending = useAsync(() => api.timeoff.requests({ status: 'PENDING', limit: 6 }), []);
  const contracts = useAsync(() => api.contracts.list({ status: 'RUNNING', limit: 100 }), []);
  const attendance = useAsync(() => api.attendance.list({ limit: 8 }), []);

  const roster = employees.data?.data ?? [];
  const activeCount = roster.filter((employee) => employee.status === 'ACTIVE').length;
  const withoutBank = roster.filter((employee) => !employee.bankAccount).length;

  // Pinned once on mount: reading the clock during render would make the
  // cutoff drift between re-renders.
  const [now] = useState(() => Date.now());

  // Contracts running out inside the next 30 days - the same window the
  // payroll dashboard uses for its expiry alerts.
  const expiring = (contracts.data?.data ?? []).filter((contract) => {
    if (!contract.endDate) return false;
    const end = Date.parse(`${contract.endDate}T00:00:00Z`);
    const days = (end - now) / 86_400_000;
    return days >= 0 && days <= 30;
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">People operations</h1>
        <p className="page-subtitle">
          Headcount, contracts and approvals. Payroll figures are restricted for your role.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] mb-5">
        <AttendanceWidget onChange={attendance.reload} />
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            label="Active employees"
            value={num(activeCount, 0)}
            sublabel={`${employees.data?.meta.total ?? 0} on record`}
            icon={<Users size={17} />}
            tone="blue"
          />
          <KpiCard
            label="Pending approvals"
            value={num(pending.data?.meta.total ?? 0, 0)}
            sublabel="Time off awaiting a decision"
            icon={<CalendarDays size={17} />}
            tone="amber"
          />
          <KpiCard
            label="Running contracts"
            value={num(contracts.data?.meta.total ?? 0, 0)}
            sublabel={`${expiring.length} ending within 30 days`}
            icon={<FileText size={17} />}
            tone="purple"
          />
          <KpiCard
            label="Missing bank details"
            value={num(withoutBank, 0)}
            sublabel="Will block their payslip"
            icon={<ShieldAlert size={17} />}
            tone="pink"
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <Section
          title="Time off awaiting approval"
          bodyClassName="p-0"
          actions={
            <Link
              to="/time-off"
              className="text-[12px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              Open queue <ArrowRight size={13} />
            </Link>
          }
        >
          {pending.loading ? (
            <SkeletonRows rows={4} cols={3} />
          ) : (pending.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="Nothing waiting" message="Every request has been decided." />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {pending.data?.data.map((request) => (
                <li key={request.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={request.employeeName} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                      {request.employeeName}
                    </p>
                    <p className="text-[12px] text-[var(--slate)] mt-0.5">
                      {request.timeOffTypeName} · {formatDate(request.dateFrom)} →{' '}
                      {formatDate(request.dateTo)}
                    </p>
                  </div>
                  <span className="text-[12px] font-semibold text-[var(--ink)] tabular-nums">
                    {num(request.durationDays)}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Headcount by department" bodyClassName="p-5">
          {departments.loading ? (
            <SkeletonRows rows={4} cols={2} />
          ) : (departments.data?.length ?? 0) === 0 ? (
            <EmptyState title="No departments yet" icon={<Building2 size={22} />} />
          ) : (
            <ul className="space-y-3">
              {departments.data?.map((department) => {
                const max = Math.max(...(departments.data ?? []).map((row) => row.headcount ?? 0), 1);
                const width = ((department.headcount ?? 0) / max) * 100;
                return (
                  <li key={department.id}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-[13px] font-semibold text-[var(--ink)]">
                        {department.name}
                      </span>
                      <span className="text-[12px] text-[var(--slate)] tabular-nums">
                        {department.headcount ?? 0}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--canvas)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          title="Contracts ending soon"
          description="Running contracts with an end date inside 30 days"
          bodyClassName="p-0"
          actions={
            <Link
              to="/contracts"
              className="text-[12px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              All contracts <ArrowRight size={13} />
            </Link>
          }
        >
          {contracts.loading ? (
            <SkeletonRows rows={3} cols={3} />
          ) : expiring.length === 0 ? (
            <EmptyState
              title="No contract expiries"
              message="Nothing runs out in the next 30 days."
              icon={<CalendarClock size={22} />}
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {expiring.map((contract) => (
                <li key={contract.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={contract.employeeName} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                      {contract.employeeName}
                    </p>
                    <p className="text-[12px] text-[var(--slate)] mt-0.5">
                      Ends {formatDate(contract.endDate)}
                    </p>
                  </div>
                  <StatusBadge status={contract.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Latest attendance"
          bodyClassName="p-0"
          actions={
            <Link
              to="/attendance"
              className="text-[12px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              Open <ArrowRight size={13} />
            </Link>
          }
        >
          {attendance.loading ? (
            <SkeletonRows rows={4} cols={3} />
          ) : (attendance.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="No attendance recorded" icon={<Clock size={22} />} />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {attendance.data?.data.map((record) => (
                <li key={record.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={record.employeeName} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                      {record.employeeName}
                    </p>
                    <p className="text-[12px] text-[var(--slate)] mt-0.5">
                      {formatDate(record.checkIn?.slice(0, 10))}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--ink)] tabular-nums">
                    {num(record.workedHours)}h
                  </span>
                  <StatusBadge status={record.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
