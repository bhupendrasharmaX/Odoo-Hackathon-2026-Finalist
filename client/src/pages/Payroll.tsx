import { useEffect, useState } from 'react';
import { Plus, Check, X, Banknote, ChevronDown } from 'lucide-react';
import api from '../api';
import type { PayrollRun, Payslip } from '../types';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Can, useCan } from '../components/Can';
import { useToast } from '../components/Toast';

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

const MONTHS = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const { allowed: canApprove } = useCan('payroll', 'approve');

  useEffect(() => {
    api
      .getPayrollRuns()
      .then(setRuns)
      .finally(() => setLoading(false));
  }, []);

  const loadPayslips = async (runId: string) => {
    setSelectedRun(runId);
    const data = await api.getPayslips(runId);
    setPayslips(data);
  };

  const handleApprove = async (runId: string) => {
    try {
      await api.approvePayrollRun(runId);
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId ? { ...r, status: 'approved' } : r
        )
      );
      addToast('success', 'Payroll run approved');
    } catch (err: any) {
      addToast('error', 'Failed to approve', err.message);
    }
  };

  const handleReject = async (runId: string) => {
    try {
      await api.rejectPayrollRun(runId);
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId ? { ...r, status: 'rejected' } : r
        )
      );
      addToast('warning', 'Payroll run rejected');
    } catch (err: any) {
      addToast('error', 'Failed to reject', err.message);
    }
  };

  const payslipColumns: Column<Payslip>[] = [
    { key: 'employeeId', header: 'Emp ID', width: '110px' },
    { key: 'employeeName', header: 'Name' },
    {
      key: 'basicSalary',
      header: 'Basic',
      align: 'right',
      render: (row) => <span className="tabular-nums">{formatINR(row.basicSalary)}</span>,
    },
    {
      key: 'hra',
      header: 'HRA',
      align: 'right',
      render: (row) => <span className="tabular-nums">{formatINR(row.hra)}</span>,
    },
    {
      key: 'grossSalary',
      header: 'Gross',
      align: 'right',
      render: (row) => <span className="tabular-nums font-medium">{formatINR(row.grossSalary)}</span>,
    },
    {
      key: 'pf',
      header: 'PF',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-[var(--danger)]">
          −{formatINR(row.pf)}
        </span>
      ),
    },
    {
      key: 'tax',
      header: 'Tax',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-[var(--danger)]">
          −{formatINR(row.tax)}
        </span>
      ),
    },
    {
      key: 'totalDeductions',
      header: 'Deductions',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-[var(--danger)] font-medium">
          −{formatINR(row.totalDeductions)}
        </span>
      ),
    },
    {
      key: 'netPay',
      header: 'Net Pay',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-semibold">{formatINR(row.netPay)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--slate)]">
        Loading payroll…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">
            Open a run to see every payslip behind the number.
          </p>
        </div>
        <Can module="payroll" action="write">
          <button className="btn btn-primary">
            <Plus size={16} />
            New Run
          </button>
        </Can>
      </div>

      {/* Payroll Runs */}
      <div className="space-y-4">
        {runs.map((run) => (
          <div key={run.id} className="card overflow-hidden">
            {/* Run header */}
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:bg-[#FAFBFE] transition-colors"
              onClick={() =>
                selectedRun === run.id
                  ? setSelectedRun(null)
                  : loadPayslips(run.id)
              }
            >
              <div className="flex items-center gap-4">
                <span className="icon-tile tile-blue">
                  <Banknote size={19} />
                </span>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[15px] font-semibold text-[var(--ink)]">
                      {MONTHS[run.month]} {run.year}
                    </span>
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="text-xs text-[var(--slate)] mt-0.5 tabular-nums">
                    {run.totalEmployees} employees · gross{' '}
                    {formatINR(run.totalGross)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Net payable
                  </p>
                  <p className="text-lg font-bold text-[var(--ink)] tabular-nums">
                    {formatINR(run.totalNet)}
                  </p>
                </div>
                {canApprove && run.status === 'pending' && (
                  <div
                    className="flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleApprove(run.id)}
                      className="btn btn-sm btn-success-tonal"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(run.id)}
                      className="btn btn-sm btn-danger-tonal"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}
                <ChevronDown
                  size={18}
                  className={`text-[var(--muted)] transition-transform ${
                    selectedRun === run.id ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {/* Payslips */}
            {selectedRun === run.id && (
              <div className="border-t border-[var(--line)] nested-table">
                <DataTable<Payslip>
                  columns={payslipColumns}
                  data={payslips}
                  rowKey={(row) => row.id}
                  searchable={true}
                  searchFields={['employeeName', 'employeeId']}
                  pageSize={15}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
