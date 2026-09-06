import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAsync } from '../lib/useApi';
import { formatDate, formatPeriod, humanise, money, num, recentPeriods } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import {
  Avatar,
  Chip,
  ErrorState,
  Field,
  FilterBar,
  PageHeader,
  Pager,
  Select,
} from '../components/ui';
import type { Employee, Paged, Payslip } from '../types';

const STATUSES = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID'];

export function PayslipsPage() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const selfScoped = CAN.isSelfScoped(role);

  const employees = useAsync<Paged<Employee> | null>(
    () => (selfScoped ? Promise.resolve(null) : api.employees.list({ limit: 100 })),
    [selfScoped],
  );
  const payslips = useAsync(
    () => api.payslips.list({ employeeId, period, status, page, limit: 20 }),
    [employeeId, period, status, page],
  );

  const columns: Column<Payslip>[] = [
    ...(selfScoped
      ? []
      : [
          {
            key: 'employeeName',
            header: 'Employee',
            render: (row: Payslip) => (
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={row.employeeName} size={30} />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{row.employeeName ?? '—'}</p>
                  <p className="text-[11px] text-[var(--muted)]">{row.employeeCode}</p>
                </div>
              </div>
            ),
          } as Column<Payslip>,
        ]),
    {
      key: 'periodStart',
      header: 'Period',
      render: (row) => (
        <div>
          <p className="font-semibold">{formatPeriod(row.periodStart?.slice(0, 7))}</p>
          <p className="text-[11px] text-[var(--muted)]">
            {formatDate(row.periodStart)} → {formatDate(row.periodEnd)}
          </p>
        </div>
      ),
      sortValue: (row) => row.periodStart ?? '',
    },
    { key: 'payrunName', header: 'Payrun', hideOnMobile: true, render: (row) => row.payrunName ?? '—' },
    {
      key: 'workedDays',
      header: 'Worked days',
      align: 'right',
      hideOnMobile: true,
      render: (row) => num(row.workedDays),
    },
    { key: 'gross', header: 'Gross', align: 'right', render: (row) => money(row.gross) },
    {
      key: 'totalDeductions',
      header: 'Deductions',
      align: 'right',
      render: (row) => (
        <span className={row.totalDeductions > 0 ? 'text-[var(--danger)]' : ''}>
          {row.totalDeductions > 0 ? `−${money(row.totalDeductions)}` : money(0)}
        </span>
      ),
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      render: (row) => <span className="font-bold">{money(row.net)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.warnings.length > 0 && (
            <Chip tone={row.warnings.some((w) => w.severity === 'HIGH') ? 'danger' : 'warning'}>
              {row.warnings.length}
            </Chip>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Receipt size={19} />}
        title={selfScoped ? 'My payslips' : 'Payslips'}
        subtitle={
          selfScoped
            ? 'Every payslip issued to you. Open one to see the full calculation or download the PDF.'
            : `${payslips.data?.meta.total ?? 0} payslips across all payruns`
        }
      />

      <FilterBar>
        {!selfScoped && (
          <Field label="Employee" className="w-56">
            <Select
              value={employeeId}
              onChange={(event) => {
                setEmployeeId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All employees</option>
              {(employees.data?.data ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Period" className="w-48">
          <Select
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All periods</option>
            {recentPeriods(12).map((option) => (
              <option key={option} value={option}>
                {formatPeriod(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" className="w-44">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {humanise(option)}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      {payslips.error ? (
        <ErrorState message={payslips.error} onRetry={payslips.reload} />
      ) : (
        <DataTable
          columns={columns}
          data={payslips.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={payslips.loading}
          onRowClick={(row) => navigate(`/payroll/payslips/${row.id}`)}
          emptyTitle="No payslips found"
          emptyMessage="Payslips appear here once a payrun has been computed."
          footer={
            payslips.data && (
              <Pager
                page={payslips.data.meta.page}
                limit={payslips.data.meta.limit}
                total={payslips.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      )}
    </div>
  );
}
