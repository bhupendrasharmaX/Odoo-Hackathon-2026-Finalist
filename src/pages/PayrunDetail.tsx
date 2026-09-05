import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  Mail,
  Wallet,
} from 'lucide-react';
import api from '../api';
import { useAction, useAsync } from '../lib/useApi';
import { formatDate, formatDateTime, humanise, money, num } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Button,
  Chip,
  ConfirmDialog,
  ErrorState,
  KpiCard,
  Section,
  Spinner,
} from '../components/ui';
import type { Payslip, PayslipWarning } from '../types';

const FLOW = [
  { status: 'DRAFT', label: 'Draft' },
  { status: 'COMPUTED', label: 'Computed' },
  { status: 'VALIDATED', label: 'Validated' },
  { status: 'PAID', label: 'Paid' },
];

type PendingAction = 'compute' | 'validate' | 'mark-paid' | 'send' | null;

export function PayrunDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { success, error, info } = useToast();

  const payrun = useAsync(() => api.payruns.get(id), [id]);
  const { busy, run } = useAction({ onError: error });
  const [pending, setPending] = useState<PendingAction>(null);

  if (payrun.loading) return <Spinner label="Loading payrun…" />;
  if (payrun.error || !payrun.data) {
    return <ErrorState message={payrun.error ?? 'Payrun not found'} onRetry={payrun.reload} />;
  }

  const data = payrun.data;
  const highWarnings = data.warnings.HIGH ?? [];
  const allWarnings: PayslipWarning[] = [
    ...highWarnings,
    ...(data.warnings.MEDIUM ?? []),
    ...(data.warnings.LOW ?? []),
  ];

  const act = async (action: Exclude<PendingAction, null>) => {
    setPending(null);

    if (action === 'compute') {
      const result = await run(() => api.payruns.compute(id));
      if (result) {
        success(`Computed ${result.computed} payslip(s)`);
        if (result.failures?.length) {
          error(
            `${result.failures.length} payslip(s) could not be computed`,
            result.failures.map((failure) => failure.reason).join(' · '),
          );
        }
        payrun.reload();
      }
      return;
    }

    if (action === 'validate') {
      const result = await run(() => api.payruns.validate(id), 'Payrun validated');
      if (result) {
        success('Payrun validated');
        payrun.reload();
      }
      return;
    }

    if (action === 'mark-paid') {
      const result = await run(() => api.payruns.markPaid(id));
      if (result) {
        success('Payrun marked as paid');
        payrun.reload();
      }
      return;
    }

    const result = await run(() => api.payruns.sendPayslips(id));
    if (result) {
      if (result.sent === result.attempted) {
        success(`Sent ${result.sent} payslip(s)`);
      } else {
        info(
          `Sent ${result.sent} of ${result.attempted} payslip(s)`,
          'Delivery is logged per payslip on the server.',
        );
      }
      payrun.reload();
    }
  };

  const columns: Column<Payslip>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={row.employeeName} size={30} />
          <div className="min-w-0">
            <p className="font-semibold truncate">{row.employeeName ?? '—'}</p>
            <p className="text-[11px] text-[var(--muted)]">{row.employeeCode}</p>
          </div>
        </div>
      ),
    },
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
      key: 'warnings',
      header: 'Warnings',
      sortable: false,
      render: (row) =>
        row.warnings.length === 0 ? (
          <span className="text-[var(--muted)]">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.warnings.map((warning) => (
              <Chip
                key={warning.code}
                tone={
                  warning.severity === 'HIGH'
                    ? 'danger'
                    : warning.severity === 'MEDIUM'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {humanise(warning.code)}
              </Chip>
            ))}
          </div>
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  const currentStep = FLOW.findIndex((step) => step.status === data.status);

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={() => navigate('/payroll/payruns')}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--slate)] hover:text-[var(--accent)] transition-colors mb-4"
      >
        <ArrowLeft size={15} /> Back to payruns
      </button>

      <div className="card p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="display-sm">{data.name}</h1>
              <StatusBadge status={data.status} />
            </div>
            <p className="text-sm text-[var(--slate)] mt-1">
              {data.salaryStructureName} · {formatDate(data.periodStart)} →{' '}
              {formatDate(data.periodEnd)}
            </p>
            <p className="text-[12px] text-[var(--muted)] mt-1">
              Created by {data.createdByName ?? 'unknown'} on {formatDateTime(data.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {data.canCompute && (
              <Button
                variant="primary"
                icon={<Calculator size={15} />}
                loading={busy}
                onClick={() => setPending('compute')}
              >
                {data.status === 'DRAFT' ? 'Compute' : 'Recompute'}
              </Button>
            )}
            {data.canValidate && (
              <Button
                variant="primary"
                icon={<BadgeCheck size={15} />}
                loading={busy}
                onClick={() => setPending('validate')}
              >
                Validate
              </Button>
            )}
            {data.canMarkPaid && (
              <Button
                variant="success"
                icon={<CheckCircle2 size={15} />}
                loading={busy}
                onClick={() => setPending('mark-paid')}
              >
                Mark as paid
              </Button>
            )}
            {data.canSendPayslips && (
              <Button icon={<Mail size={15} />} loading={busy} onClick={() => setPending('send')}>
                Send payslips
              </Button>
            )}
          </div>
        </div>

        {/* Workflow */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-[var(--line)]">
          {FLOW.map((step, index) => (
            <div key={step.status} className="flex items-center gap-2 flex-1">
              <div
                className={`flex-1 rounded-[var(--r-md)] px-3 py-2 text-center text-[12px] font-bold transition-colors ${
                  index < currentStep
                    ? 'bg-[var(--success-soft)] text-[var(--success)]'
                    : index === currentStep
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--canvas)] text-[var(--muted)]'
                }`}
              >
                {step.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <KpiCard
          label="Payslips"
          value={num(data.payslipCount, 0)}
          icon={<Wallet size={17} />}
          tone="blue"
        />
        <KpiCard
          label="Total gross"
          value={money(data.totalGross)}
          icon={<Wallet size={17} />}
          tone="purple"
        />
        <KpiCard
          label="Total net"
          value={money(data.totalNet)}
          sublabel={`${money(data.totalGross - data.totalNet)} deducted`}
          icon={<Wallet size={17} />}
          tone="green"
        />
      </div>

      {allWarnings.length > 0 && (
        <Section
          title="Warnings on this payrun"
          description={
            highWarnings.length > 0
              ? 'A payrun cannot be validated while a high-severity warning is unresolved.'
              : 'These do not block validation, but they are worth a look.'
          }
          className="mb-5"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-[var(--line)] max-h-[280px] overflow-y-auto">
            {allWarnings.map((warning, index) => (
              <li
                key={`${warning.code}-${warning.payslipId ?? index}`}
                className="flex items-start gap-3 px-5 py-3"
              >
                <span
                  className={`icon-tile w-8 h-8 mt-0.5 ${
                    warning.severity === 'HIGH'
                      ? 'tile-pink'
                      : warning.severity === 'MEDIUM'
                        ? 'tile-amber'
                        : 'tile-blue'
                  }`}
                >
                  <AlertTriangle size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={warning.severity} size="sm" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {humanise(warning.code)}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--ink)] mt-1">
                    {warning.employeeName ? `${warning.employeeName}: ` : ''}
                    {warning.message}
                  </p>
                </div>
                {warning.payslipId && (
                  <Button size="xs" onClick={() => navigate(`/payroll/payslips/${warning.payslipId}`)}>
                    Open
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <DataTable
        columns={columns}
        data={data.payslips}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/payroll/payslips/${row.id}`)}
        emptyTitle="No payslips computed yet"
        emptyMessage="Compute this run to generate its payslips."
      />

      <ConfirmDialog
        open={pending === 'compute'}
        title={data.status === 'DRAFT' ? 'Compute this payrun?' : 'Recompute this payrun?'}
        message={
          data.status === 'DRAFT'
            ? 'Every selected employee gets a payslip computed from their applicable contract and the salary structure.'
            : 'Existing payslip amounts are recalculated from the current contracts and rules. Amounts may change.'
        }
        confirmLabel="Compute"
        busy={busy}
        onConfirm={() => act('compute')}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={pending === 'validate'}
        title="Validate this payrun?"
        message={
          highWarnings.length > 0
            ? `There ${highWarnings.length === 1 ? 'is' : 'are'} ${highWarnings.length} high-severity warning${
                highWarnings.length === 1 ? '' : 's'
              } on this run. Validation is blocked until they are resolved.`
            : 'Validated payslips become historical data and can be sent to employees.'
        }
        confirmLabel="Validate"
        busy={busy}
        onConfirm={() => act('validate')}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={pending === 'mark-paid'}
        title="Mark this payrun as paid?"
        message="This records that the money has left. Paid payruns stay as historical data."
        confirmLabel="Mark as paid"
        busy={busy}
        onConfirm={() => act('mark-paid')}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={pending === 'send'}
        title="Send payslips by email?"
        message={`A PDF payslip is emailed to each of the ${data.payslipCount} employee(s) in this run.`}
        confirmLabel="Send payslips"
        busy={busy}
        onConfirm={() => act('send')}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
