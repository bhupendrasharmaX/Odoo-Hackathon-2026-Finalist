import { useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
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
    { key: 'employeeId', header: 'Emp ID', width: '90px' },
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--ink)]">Payroll</h1>
        <Can module="payroll" action="write">
          <button className="inline-flex items-center gap-1.5 px-3 h-8 bg-[var(--accent)] text-white text-sm font-medium rounded hover:opacity-90 transition-opacity">
            <Plus size={14} />
            New Run
          </button>
        </Can>
      </div>

      {/* Payroll Runs */}
      <div className="space-y-3">
        {runs.map((run) => (
          <div
            key={run.id}
            className="bg-white border border-[var(--line)] rounded overflow-hidden"
          >
            {/* Run header */}
            <div
              className="flex items-center justify-between px-4 h-12 cursor-pointer hover:bg-[var(--canvas)] transition-colors"
              onClick={() =>
                selectedRun === run.id
                  ? setSelectedRun(null)
                  : loadPayslips(run.id)
              }
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-[var(--ink)]">
                  {MONTHS[run.month]} {run.year}
                </span>
                <StatusBadge status={run.status} />
                <span className="text-xs text-[var(--slate)]">
                  {run.totalEmployees} employees
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-[var(--slate)]">Net: </span>
                  <span className="text-sm font-semibold text-[var(--ink)] tabular-nums">
                    {formatINR(run.totalNet)}
                  </span>
                </div>
                {canApprove && run.status === 'pending' && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleApprove(run.id)}
                      className="inline-flex items-center gap-1 px-2 h-7 text-xs font-medium bg-emerald-50 text-[var(--accent)] rounded hover:bg-emerald-100 transition-colors"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(run.id)}
                      className="inline-flex items-center gap-1 px-2 h-7 text-xs font-medium bg-red-50 text-[var(--danger)] rounded hover:bg-red-100 transition-colors"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Payslips */}
            {selectedRun === run.id && (
              <div className="border-t border-[var(--line)]">
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
