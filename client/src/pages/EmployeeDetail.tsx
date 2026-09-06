import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  Mail,
  MessageSquareWarning,
  Pencil,
  Phone,
  Receipt,
  UserRound,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAsync } from '../lib/useApi';
import { formatDate, formatTime, humanise, money, num } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { EmployeeFormModal } from '../components/EmployeeForm';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Button,
  ErrorState,
  Section,
  SkeletonRows,
  Spinner,
} from '../components/ui';
import type { Attendance, Contract, Grievance, Payslip, TimeOffRequest } from '../types';

type Tab = 'contracts' | 'attendance' | 'timeoff' | 'payslips' | 'grievances';

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { success } = useToast();

  const [tab, setTab] = useState<Tab>('contracts');
  const [editing, setEditing] = useState(false);

  const employee = useAsync(() => api.employees.get(id), [id]);
  const summary = useAsync(() => api.employees.summary(id), [id]);

  const canWrite = CAN.writePeople(role);
  const canSeePayslips = CAN.viewPayslips(role);

  if (employee.loading) return <Spinner label="Loading employee…" />;
  if (employee.error || !employee.data) {
    return <ErrorState message={employee.error ?? 'Employee not found'} onRetry={employee.reload} />;
  }

  const person = employee.data;
  const counts = summary.data;

  const smartButtons: Array<{ tab: Tab; label: string; count: number; icon: typeof FileText }> = [
    { tab: 'contracts', label: 'Contracts', count: counts?.contracts ?? 0, icon: FileText },
    { tab: 'attendance', label: 'Attendance', count: counts?.attendance ?? 0, icon: Clock },
    { tab: 'timeoff', label: 'Time off', count: counts?.timeOff ?? 0, icon: CalendarDays },
    ...(canSeePayslips
      ? [{ tab: 'payslips' as Tab, label: 'Payslips', count: counts?.payslips ?? 0, icon: Receipt }]
      : []),
    {
      tab: 'grievances',
      label: 'Grievances',
      count: counts?.grievances ?? 0,
      icon: MessageSquareWarning,
    },
  ];

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={() => navigate('/employees')}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--slate)] hover:text-[var(--accent)] transition-colors mb-4"
      >
        <ArrowLeft size={15} /> Back to employees
      </button>

      <div className="card p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <Avatar name={person.name} src={person.avatarUrl} size={64} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="display-sm truncate">{person.name}</h1>
                <StatusBadge status={person.status} />
                <StatusBadge status={person.employeeType} size="sm" />
              </div>
              <p className="text-sm text-[var(--slate)] mt-1">
                {person.jobPosition ?? 'No job position set'} · {person.employeeCode}
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-[13px] text-[var(--slate)]">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={14} className="text-[var(--muted)]" />
                  {person.email}
                </span>
                {person.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={14} className="text-[var(--muted)]" />
                    {person.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={14} className="text-[var(--muted)]" />
                  {person.departmentName ?? 'Unassigned'}
                </span>
                {person.managerName && (
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound size={14} className="text-[var(--muted)]" />
                    Reports to {person.managerName}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 ${
                    person.bankAccount ? '' : 'text-[var(--danger)] font-semibold'
                  }`}
                >
                  <CreditCard size={14} className={person.bankAccount ? 'text-[var(--muted)]' : ''} />
                  {person.bankAccount ?? 'No bank account on file'}
                </span>
              </div>
            </div>
          </div>

          {canWrite && (
            <Button variant="primary" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>

        {/* Smart buttons - live counts, straight from /employees/:id/summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-[var(--line)]">
          {smartButtons.map((button) => {
            const Icon = button.icon;
            return (
              <button
                key={button.tab}
                type="button"
                onClick={() => setTab(button.tab)}
                className={`rounded-[var(--r-md)] border px-3.5 py-3 text-left transition-all ${
                  tab === button.tab
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] hover:border-[var(--accent)] bg-white'
                }`}
              >
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  <Icon size={13} />
                  {button.label}
                </span>
                <span className="block text-[20px] font-bold text-[var(--ink)] tabular-nums mt-1">
                  {summary.loading ? '—' : button.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'contracts' && <ContractsTab employeeId={id} />}
      {tab === 'attendance' && <AttendanceTab employeeId={id} />}
      {tab === 'timeoff' && <TimeOffTab employeeId={id} />}
      {tab === 'payslips' && canSeePayslips && <PayslipsTab employeeId={id} />}
      {tab === 'grievances' && <GrievancesTab employeeId={id} />}

      {editing && (
        <EmployeeFormModal
          open={editing}
          employee={person}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            success('Employee updated', `${saved.name} has been saved.`);
            employee.reload();
            summary.reload();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   Related-record tabs
   ============================================================ */

function ContractsTab({ employeeId }: { employeeId: string }) {
  const contracts = useAsync(() => api.contracts.list({ employeeId, limit: 50 }), [employeeId]);

  const columns: Column<Contract>[] = [
    { key: 'startDate', header: 'Start', render: (row) => formatDate(row.startDate) },
    { key: 'endDate', header: 'End', render: (row) => formatDate(row.endDate) },
    { key: 'jobPosition', header: 'Position', render: (row) => row.jobPosition ?? '—' },
    {
      key: 'salaryStructureName',
      header: 'Structure',
      hideOnMobile: true,
      render: (row) => row.salaryStructureName ?? '—',
    },
    { key: 'wage', header: 'Wage', align: 'right', render: (row) => money(row.wage) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <DataTable
      columns={columns}
      data={contracts.data?.data ?? []}
      rowKey={(row) => row.id}
      loading={contracts.loading}
      emptyTitle="No contracts"
      emptyMessage="No contract on record."
    />
  );
}

function AttendanceTab({ employeeId }: { employeeId: string }) {
  const attendance = useAsync(() => api.attendance.list({ employeeId, limit: 50 }), [employeeId]);

  const columns: Column<Attendance>[] = [
    {
      key: 'checkIn',
      header: 'Date',
      render: (row) => formatDate(row.checkIn?.slice(0, 10)),
      sortValue: (row) => row.checkIn ?? '',
    },
    { key: 'in', header: 'Check in', render: (row) => formatTime(row.checkIn), sortable: false },
    {
      key: 'out',
      header: 'Check out',
      render: (row) => (row.checkOut ? formatTime(row.checkOut) : '—'),
      sortable: false,
    },
    { key: 'workedHours', header: 'Worked', align: 'right', render: (row) => `${num(row.workedHours)}h` },
    {
      key: 'overtimeHours',
      header: 'Overtime',
      align: 'right',
      hideOnMobile: true,
      render: (row) => `${num(row.overtimeHours)}h`,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <DataTable
      columns={columns}
      data={attendance.data?.data ?? []}
      rowKey={(row) => row.id}
      loading={attendance.loading}
      emptyTitle="No attendance recorded"
    />
  );
}

function TimeOffTab({ employeeId }: { employeeId: string }) {
  const requests = useAsync(() => api.timeoff.requests({ employeeId, limit: 50 }), [employeeId]);
  const balance = useAsync(() => api.timeoff.balance(employeeId), [employeeId]);

  const columns: Column<TimeOffRequest>[] = [
    { key: 'timeOffTypeName', header: 'Type', render: (row) => row.timeOffTypeName ?? '—' },
    { key: 'dateFrom', header: 'From', render: (row) => formatDate(row.dateFrom) },
    { key: 'dateTo', header: 'To', render: (row) => formatDate(row.dateTo) },
    { key: 'durationDays', header: 'Days', align: 'right', render: (row) => num(row.durationDays) },
    { key: 'reason', header: 'Reason', hideOnMobile: true, render: (row) => row.reason ?? '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-5">
      <Section title="Leave balances">
        {balance.loading ? (
          <SkeletonRows rows={2} cols={3} />
        ) : (balance.data?.balances.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--muted)] py-4 text-center">Nothing allocated yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balance.data?.balances.map((row) => (
              <div key={row.id} className="rounded-[var(--r-md)] border border-[var(--line)] p-4">
                <p className="text-[13px] font-bold text-[var(--ink)]">{row.timeOffTypeName}</p>
                <p className="display-sm tabular-nums mt-1">{num(row.availableDays)}</p>
                <p className="text-[11.5px] text-[var(--slate)] mt-0.5">
                  available · {num(row.usedDays)} used of {num(row.allocatedDays)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <DataTable
        columns={columns}
        data={requests.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={requests.loading}
        emptyTitle="No time off requests"
      />
    </div>
  );
}

function PayslipsTab({ employeeId }: { employeeId: string }) {
  const navigate = useNavigate();
  const payslips = useAsync(() => api.payslips.list({ employeeId, limit: 50 }), [employeeId]);

  const columns: Column<Payslip>[] = [
    { key: 'payrunName', header: 'Payrun', render: (row) => row.payrunName ?? '—' },
    {
      key: 'periodStart',
      header: 'Period',
      render: (row) => `${formatDate(row.periodStart)} → ${formatDate(row.periodEnd)}`,
    },
    { key: 'gross', header: 'Gross', align: 'right', render: (row) => money(row.gross) },
    {
      key: 'totalDeductions',
      header: 'Deductions',
      align: 'right',
      hideOnMobile: true,
      render: (row) => money(row.totalDeductions),
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      render: (row) => <span className="font-bold">{money(row.net)}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <DataTable
      columns={columns}
      data={payslips.data?.data ?? []}
      rowKey={(row) => row.id}
      loading={payslips.loading}
      onRowClick={(row) => navigate(`/payroll/payslips/${row.id}`)}
      emptyTitle="No payslips"
    />
  );
}

function GrievancesTab({ employeeId }: { employeeId: string }) {
  const grievances = useAsync(() => api.grievances.list({ employeeId, limit: 50 }), [employeeId]);

  const columns: Column<Grievance>[] = [
    { key: 'subject', header: 'Subject' },
    {
      key: 'createdAt',
      header: 'Raised',
      render: (row) => formatDate(row.createdAt?.slice(0, 10)),
    },
    {
      key: 'payslipId',
      header: 'Payslip',
      hideOnMobile: true,
      render: (row) =>
        row.payslipId ? (
          <Link
            to={`/payroll/payslips/${row.payslipId}`}
            className="text-[var(--accent)] font-semibold hover:underline"
          >
            Open
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'response',
      header: 'Response',
      hideOnMobile: true,
      render: (row) => row.response ?? humanise('AWAITING_RESPONSE'),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={grievances.data?.data ?? []}
      rowKey={(row) => row.id}
      loading={grievances.loading}
      emptyTitle="No grievances raised"
    />
  );
}
