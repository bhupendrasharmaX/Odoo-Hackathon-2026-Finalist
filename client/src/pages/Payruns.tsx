import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Wallet } from 'lucide-react';
import api from '../api';
import { useAsync } from '../lib/useApi';
import { formatDate, formatPeriod, humanise, money, num, recentPeriods } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import {
  Button,
  ErrorState,
  Field,
  FilterBar,
  PageHeader,
  Pager,
  Select,
} from '../components/ui';
import type { Payrun } from '../types';

const STATUSES = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED'];

/** The workflow, spelled out so the status column reads as a position in it. */
const FLOW = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID'];

export function PayrunsPage() {
  const navigate = useNavigate();

  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('');
  const [page, setPage] = useState(1);

  const payruns = useAsync(
    () => api.payruns.list({ status, period, page, limit: 20 }),
    [status, period, page],
  );

  const columns: Column<Payrun>[] = [
    {
      key: 'name',
      header: 'Payrun',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-[var(--ink)] truncate">{row.name}</p>
          <p className="text-[11.5px] text-[var(--muted)]">{row.salaryStructureName ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'periodStart',
      header: 'Period',
      render: (row) => `${formatDate(row.periodStart)} → ${formatDate(row.periodEnd)}`,
    },
    {
      key: 'payslipCount',
      header: 'Payslips',
      align: 'right',
      render: (row) => num(row.payslipCount, 0),
    },
    { key: 'totalGross', header: 'Gross', align: 'right', render: (row) => money(row.totalGross) },
    {
      key: 'totalNet',
      header: 'Net',
      align: 'right',
      render: (row) => <span className="font-bold">{money(row.totalNet)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          {FLOW.includes(row.status) && (
            <span className="hidden xl:flex items-center gap-1" aria-hidden>
              {FLOW.map((step, index) => (
                <span
                  key={step}
                  className={`w-1.5 h-1.5 rounded-full ${
                    index <= FLOW.indexOf(row.status) ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
                  }`}
                />
              ))}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'createdByName',
      header: 'Created by',
      hideOnMobile: true,
      render: (row) => row.createdByName ?? '—',
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Wallet size={19} />}
        title="Payruns"
        actions={
          <Link to="/payroll/payruns/new" className="btn btn-primary">
            <Plus size={16} />
            New payrun
          </Link>
        }
      />

      <FilterBar>
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

      {payruns.error ? (
        <ErrorState message={payruns.error} onRetry={payruns.reload} />
      ) : (
        <DataTable
          columns={columns}
          data={payruns.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={payruns.loading}
          onRowClick={(row) => navigate(`/payroll/payruns/${row.id}`)}
          emptyTitle="No payruns yet"
          emptyAction={
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate('/payroll/payruns/new')}>
              New payrun
            </Button>
          }
          footer={
            payruns.data && (
              <Pager
                page={payruns.data.meta.page}
                limit={payruns.data.meta.limit}
                total={payruns.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      )}
    </div>
  );
}
