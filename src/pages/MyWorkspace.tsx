import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock, Receipt, Wallet } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { useAsync } from '../lib/useApi';
import { formatDate, formatPeriod, formatTime, money, num } from '../lib/format';
import { AttendanceWidget } from '../components/AttendanceWidget';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, KpiCard, Section, SkeletonRows } from '../components/ui';
import { Meter } from '../components/charts';

/** The employee's own workspace: their attendance, their leave, their payslips. */
export function MyWorkspace() {
  const { user, profile } = useAuth();
  const employeeId = user?.employeeId ?? null;

  const balance = useAsync(
    () => (employeeId ? api.timeoff.balance(employeeId) : Promise.resolve(null)),
    [employeeId],
  );
  const requests = useAsync(() => api.timeoff.requests({ limit: 5 }), []);
  const payslips = useAsync(() => api.payslips.list({ limit: 5 }), []);
  const attendance = useAsync(() => api.attendance.list({ limit: 6 }), []);

  const totals = balance.data?.totals;
  const latestPayslip = payslips.data?.data[0];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">Hello, {user?.name?.split(' ')[0]}</h1>
        <p className="page-subtitle">
          {profile?.employee
            ? `${profile.employee.jobPosition ?? 'Team member'} · ${
                profile.employee.departmentName ?? 'Unassigned'
              }`
            : 'Your workspace'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] mb-5">
        <AttendanceWidget onChange={attendance.reload} />

        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            label="Leave available"
            value={`${num(totals?.remainingDays ?? 0)} days`}
            sublabel={`${num(totals?.usedDays ?? 0)} used of ${num(totals?.allocatedDays ?? 0)}`}
            icon={<CalendarDays size={17} />}
            tone="green"
          />
          <KpiCard
            label="Latest net pay"
            value={latestPayslip ? money(latestPayslip.net) : '—'}
            sublabel={
              latestPayslip
                ? formatPeriod(latestPayslip.periodStart?.slice(0, 7))
                : 'No payslip issued yet'
            }
            icon={<Wallet size={17} />}
            tone="blue"
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          title="My leave balances"
          bodyClassName="p-5"
          actions={
            <Link
              to="/time-off"
              className="text-[12px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              Request time off <ArrowRight size={13} />
            </Link>
          }
        >
          {balance.loading ? (
            <SkeletonRows rows={3} cols={2} />
          ) : !balance.data || balance.data.balances.length === 0 ? (
            <EmptyState
              title="No leave allocated yet"
              message="Once HR allocates leave to you, the balance shows up here."
              icon={<CalendarDays size={22} />}
            />
          ) : (
            <div className="space-y-4">
              {balance.data.balances.map((row) => (
                <div key={row.id}>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <span className="text-[13px] font-semibold text-[var(--ink)]">
                      {row.timeOffTypeName}
                    </span>
                    <span className="text-[12px] text-[var(--slate)] tabular-nums">
                      {num(row.availableDays)} available
                      {row.pendingDays > 0 && ` · ${num(row.pendingDays)} pending`}
                    </span>
                  </div>
                  <Meter value={row.usedDays} max={row.allocatedDays} />
                  <p className="text-[11px] text-[var(--muted)] mt-1.5 tabular-nums">
                    {num(row.usedDays)} used of {num(row.allocatedDays)} · valid{' '}
                    {formatDate(row.validFrom)} → {formatDate(row.validTo)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="My recent requests" bodyClassName="p-0">
          {requests.loading ? (
            <SkeletonRows rows={4} cols={3} />
          ) : (requests.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="No time off requested yet" icon={<CalendarDays size={22} />} />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {requests.data?.data.map((request) => (
                <li key={request.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                      {request.timeOffTypeName}
                    </p>
                    <p className="text-[12px] text-[var(--slate)] mt-0.5">
                      {formatDate(request.dateFrom)} → {formatDate(request.dateTo)} ·{' '}
                      {num(request.durationDays)} day{request.durationDays === 1 ? '' : 's'}
                    </p>
                  </div>
                  <StatusBadge status={request.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="My payslips"
          bodyClassName="p-0"
          actions={
            <Link
              to="/payroll/payslips"
              className="text-[12px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowRight size={13} />
            </Link>
          }
        >
          {payslips.loading ? (
            <SkeletonRows rows={4} cols={3} />
          ) : (payslips.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              title="No payslips yet"
              message="Your payslips appear here once payroll has been run for a period you worked in."
              icon={<Receipt size={22} />}
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {payslips.data?.data.map((payslip) => (
                <li key={payslip.id}>
                  <Link
                    to={`/payroll/payslips/${payslip.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--accent-soft)] transition-colors"
                  >
                    <span className="icon-tile w-9 h-9 tile-blue">
                      <Receipt size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                        {formatPeriod(payslip.periodStart?.slice(0, 7))}
                      </p>
                      <p className="text-[12px] text-[var(--slate)] mt-0.5">{payslip.payrunName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-[var(--ink)] tabular-nums">
                        {money(payslip.net)}
                      </p>
                      <StatusBadge status={payslip.status} size="sm" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="My recent attendance"
          bodyClassName="p-0"
          actions={
            <Link
              to="/attendance"
              className="text-[12px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowRight size={13} />
            </Link>
          }
        >
          {attendance.loading ? (
            <SkeletonRows rows={4} cols={3} />
          ) : (attendance.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="No attendance recorded yet" icon={<Clock size={22} />} />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {attendance.data?.data.map((record) => (
                <li key={record.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)]">
                      {formatDate(record.checkIn?.slice(0, 10))}
                    </p>
                    <p className="text-[12px] text-[var(--slate)] mt-0.5 tabular-nums">
                      {formatTime(record.checkIn)} → {record.checkOut ? formatTime(record.checkOut) : 'open'}
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
