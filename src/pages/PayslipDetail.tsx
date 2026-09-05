import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, MessageSquareWarning, Printer } from 'lucide-react';
import api from '../api';
import { useAction, useAsync } from '../lib/useApi';
import { formatDate, formatPeriod, humanise, money, num } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Button,
  ErrorState,
  Field,
  Input,
  Modal,
  Spinner,
  Textarea,
} from '../components/ui';
import type { PayslipLine, RuleCategory } from '../types';

const CATEGORY_ORDER: RuleCategory[] = ['BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET'];

const CATEGORY_LABEL: Record<RuleCategory, string> = {
  BASIC: 'Basic',
  ALLOWANCE: 'Allowances',
  GROSS: 'Gross',
  DEDUCTION: 'Deductions',
  NET: 'Net',
};

export function PayslipDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const payslip = useAsync(() => api.payslips.get(id), [id]);
  const { busy, run } = useAction({ onError: error });
  const [raising, setRaising] = useState(false);

  if (payslip.loading) return <Spinner label="Loading payslip…" />;
  if (payslip.error || !payslip.data) {
    return <ErrorState message={payslip.error ?? 'Payslip not found'} onRetry={payslip.reload} />;
  }

  const slip = payslip.data;

  const download = () =>
    run(
      () =>
        api.payslips.pdf(
          slip.id,
          `payslip-${slip.employeeCode ?? slip.employeeId}-${slip.periodStart ?? ''}.pdf`,
        ),
      'Payslip downloaded',
    );

  // Lines are grouped the way the calculation runs, then ordered by sequence
  // inside each group - the same order the PDF prints them in.
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    lines: slip.lines
      .filter((line) => line.category === category)
      .sort((a, b) => a.sequence - b.sequence),
  })).filter((group) => group.lines.length > 0);

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--slate)] hover:text-[var(--accent)] transition-colors mb-4 print:hidden"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="card overflow-hidden">
        {/* Payslip header */}
        <div className="p-6 border-b border-[var(--line)] flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <Avatar name={slip.employeeName} size={52} />
            <div className="min-w-0">
              <h1 className="display-sm truncate">{slip.employeeName}</h1>
              <p className="text-sm text-[var(--slate)] mt-0.5">
                {slip.employeeCode} · {slip.payrunName}
              </p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <StatusBadge status={slip.status} />
                <span className="text-[12px] text-[var(--muted)]">
                  {formatDate(slip.periodStart)} → {formatDate(slip.periodEnd)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            <Button icon={<Printer size={15} />} onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="primary" icon={<Download size={15} />} loading={busy} onClick={download}>
              Download PDF
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--line)] border-b border-[var(--line)] bg-[#FAFBFE]">
          {[
            { label: 'Period', value: formatPeriod(slip.periodStart?.slice(0, 7)) },
            { label: 'Worked days', value: num(slip.workedDays) },
            { label: 'Gross', value: money(slip.gross) },
            { label: 'Net pay', value: money(slip.net), strong: true },
          ].map((cell) => (
            <div key={cell.label} className="px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                {cell.label}
              </p>
              <p
                className={`mt-1 tabular-nums ${
                  cell.strong
                    ? 'text-[19px] font-bold text-[var(--accent)]'
                    : 'text-[15px] font-semibold text-[var(--ink)]'
                }`}
              >
                {cell.value}
              </p>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {slip.warnings.length > 0 && (
          <div className="px-6 py-4 border-b border-[var(--line)] space-y-2">
            {slip.warnings.map((warning) => (
              <div
                key={warning.code}
                className={`flex items-start gap-2.5 rounded-[var(--r-md)] px-3.5 py-2.5 ${
                  warning.severity === 'HIGH'
                    ? 'bg-[var(--danger-soft)]'
                    : warning.severity === 'MEDIUM'
                      ? 'bg-[var(--warning-soft)]'
                      : 'bg-[var(--accent-soft)]'
                }`}
              >
                <AlertTriangle
                  size={15}
                  className={`mt-0.5 flex-shrink-0 ${
                    warning.severity === 'HIGH'
                      ? 'text-[var(--danger)]'
                      : warning.severity === 'MEDIUM'
                        ? 'text-[var(--warning)]'
                        : 'text-[var(--accent)]'
                  }`}
                />
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--slate)]">
                    {humanise(warning.code)}
                  </p>
                  <p className="text-[13px] text-[var(--ink)] mt-0.5">{warning.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Calculation */}
        <div className="p-6">
          {grouped.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              This payslip has not been computed yet, so it carries no lines.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] pb-2">
                    Rule
                  </th>
                  <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] pb-2 hidden sm:table-cell">
                    Code
                  </th>
                  <th className="text-right text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] pb-2">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <CategoryGroup key={group.category} category={group.category} lines={group.lines} />
                ))}

                <tr className="border-t-2 border-[var(--ink)]">
                  <td colSpan={2} className="pt-3.5 text-[15px] font-bold text-[var(--ink)]">
                    Net pay
                  </td>
                  <td className="pt-3.5 text-right text-[19px] font-bold text-[var(--accent)] tabular-nums">
                    {money(slip.net, true)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--line)] bg-[#FAFBFE] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <p className="text-[12px] text-[var(--muted)]">
            Something look wrong? Raise it with HR and it will be tracked to a resolution.
          </p>
          <Button
            icon={<MessageSquareWarning size={15} />}
            onClick={() => setRaising(true)}
          >
            Raise a grievance
          </Button>
        </div>
      </div>

      {raising && (
        <GrievanceModal
          payslipId={slip.id}
          onClose={() => setRaising(false)}
          onSaved={() => {
            setRaising(false);
            success('Grievance raised', 'HR can now see and respond to it.');
          }}
        />
      )}
    </div>
  );
}

function CategoryGroup({ category, lines }: { category: RuleCategory; lines: PayslipLine[] }) {
  const isDeduction = category === 'DEDUCTION';
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <>
      <tr>
        <td colSpan={3} className="pt-5 pb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {CATEGORY_LABEL[category]}
          </span>
        </td>
      </tr>
      {lines.map((line) => (
        <tr key={line.ruleCode} className="border-b border-[var(--line)]">
          <td className="py-2.5 text-[13.5px] text-[var(--ink)]">{line.ruleName}</td>
          <td className="py-2.5 text-[12px] text-[var(--muted)] font-mono hidden sm:table-cell">
            {line.ruleCode}
          </td>
          <td
            className={`py-2.5 text-right text-[13.5px] font-semibold tabular-nums ${
              isDeduction ? 'text-[var(--danger)]' : 'text-[var(--ink)]'
            }`}
          >
            {isDeduction ? `−${money(Math.abs(line.amount), true)}` : money(line.amount, true)}
          </td>
        </tr>
      ))}
      {lines.length > 1 && (
        <tr>
          <td colSpan={2} className="py-2 text-[12px] font-semibold text-[var(--slate)]">
            Total {CATEGORY_LABEL[category].toLowerCase()}
          </td>
          <td className="py-2 text-right text-[13px] font-bold text-[var(--ink)] tabular-nums">
            {isDeduction ? `−${money(Math.abs(subtotal), true)}` : money(subtotal, true)}
          </td>
        </tr>
      )}
    </>
  );
}

function GrievanceModal({
  payslipId,
  onClose,
  onSaved,
}: {
  payslipId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  const invalid = !subject.trim() || !description.trim();

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    const saved = await run(() =>
      api.grievances.create({ payslipId, subject: subject.trim(), description: description.trim() }),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Raise a grievance"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Subject"
          required
          error={touched && !subject.trim() ? 'Give the grievance a subject' : undefined}
        >
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Overtime not included"
            maxLength={150}
          />
        </Field>

        <Field
          label="What is wrong?"
          required
          error={touched && !description.trim() ? 'Describe the issue' : undefined}
        >
          <Textarea
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what you expected and what the payslip shows."
          />
        </Field>
      </div>
    </Modal>
  );
}
