import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Info, Wallet } from 'lucide-react';
import api from '../api';
import { useAction, useAsync } from '../lib/useApi';
import { formatDate, formatPeriod, humanise, money, periodBounds, recentPeriods } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Section,
  Select,
  SkeletonRows,
} from '../components/ui';
import type { EligibleResult } from '../types';

/**
 * The payrun wizard, in the two steps the brief requires.
 *
 * Step 1 collects the scope. Step 2 previews who is eligible through
 * `POST /payruns/eligible-employees`, which CREATES NOTHING - a payrun only
 * comes into existence when "Create payrun" is pressed on step 2.
 */
export function PayrunWizardPage() {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [period, setPeriod] = useState(() => recentPeriods(1)[0]);
  const [name, setName] = useState('');
  const [structureId, setStructureId] = useState('');
  const [bounds, setBounds] = useState(() => periodBounds(recentPeriods(1)[0]));
  const [preview, setPreview] = useState<EligibleResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);

  const structures = useAsync(() => api.salary.structures({ limit: 100 }), []);
  const { busy, run } = useAction({ onError: error });

  const structureName =
    structures.data?.data.find((structure) => structure.id === structureId)?.name ?? '';

  const defaultName = structureName
    ? `${structureName} — ${formatPeriod(period)}`
    : formatPeriod(period);

  const invalid = { structureId: !structureId, range: bounds.end < bounds.start };

  const loadPreview = async () => {
    setTouched(true);
    if (invalid.structureId || invalid.range) return;

    const result = await run(() =>
      api.payruns.eligible({
        salaryStructureId: structureId,
        periodStart: bounds.start,
        periodEnd: bounds.end,
      }),
    );
    if (!result) return;

    setPreview(result);
    // Pre-select everyone who does not already have a payslip for the period -
    // duplicates are the one thing you almost never want to include.
    setSelected(
      new Set(
        result.employees
          .filter((employee) => !employee.alreadyHasPayslipForPeriod)
          .map((employee) => employee.employeeId),
      ),
    );
    setStep(2);
  };

  const createPayrun = async () => {
    if (selected.size === 0) return;

    const created = await run(() =>
      api.payruns.create({
        name: (name.trim() || defaultName).slice(0, 150),
        salaryStructureId: structureId,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        employeeIds: [...selected],
      }),
    );

    if (created) {
      success('Payrun created', `${created.payslipCount} payslip(s) drafted.`);
      navigate(`/payroll/payruns/${created.id}`);
    }
  };

  const toggle = (employeeId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <button
        type="button"
        onClick={() => (step === 2 ? setStep(1) : navigate('/payroll/payruns'))}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--slate)] hover:text-[var(--accent)] transition-colors mb-4"
      >
        <ArrowLeft size={15} /> {step === 2 ? 'Back to scope' : 'Back to payruns'}
      </button>

      <PageHeader
        icon={<Wallet size={19} />}
        title="New payrun"
      />

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-6">
        {[
          { index: 1, label: 'Choose the scope' },
          { index: 2, label: 'Select employees' },
        ].map((item, position) => (
          <div key={item.index} className="flex items-center gap-3 flex-1">
            <div
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-[var(--r-md)] border flex-1 transition-colors ${
                step === item.index
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : step > item.index
                    ? 'border-[var(--success)] bg-[var(--success-soft)]'
                    : 'border-[var(--line)] bg-white'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold flex-shrink-0 ${
                  step === item.index
                    ? 'bg-[var(--accent)] text-white'
                    : step > item.index
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--line)] text-[var(--slate)]'
                }`}
              >
                {step > item.index ? <CheckCircle2 size={13} /> : item.index}
              </span>
              <span className="text-[13px] font-semibold text-[var(--ink)]">{item.label}</span>
            </div>
            {position === 0 && <ArrowRight size={15} className="text-[var(--muted)] hidden sm:block" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Section title="Payroll scope">
          {structures.loading ? (
            <SkeletonRows rows={3} cols={2} />
          ) : structures.error ? (
            <ErrorState message={structures.error} onRetry={structures.reload} />
          ) : (structures.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              title="No salary structures yet"
              message="A payrun computes against a salary structure. Create one before running payroll."
              action={
                <Button variant="primary" onClick={() => navigate('/payroll/structures')}>
                  Go to salary structures
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Salary structure"
                  required
                  error={touched && invalid.structureId ? 'Choose a salary structure' : undefined}
                >
                  <Select
                    value={structureId}
                    onChange={(event) => setStructureId(event.target.value)}
                  >
                    <option value="">Select a structure…</option>
                    {(structures.data?.data ?? []).map((structure) => (
                      <option key={structure.id} value={structure.id}>
                        {structure.name} · {structure.ruleCount ?? structure.rules.length} rules
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Period" hint="Sets the start and end dates below">
                  <Select
                    value={period}
                    onChange={(event) => {
                      setPeriod(event.target.value);
                      setBounds(periodBounds(event.target.value));
                    }}
                  >
                    {recentPeriods(15).map((option) => (
                      <option key={option} value={option}>
                        {formatPeriod(option)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Period start" required>
                  <Input
                    type="date"
                    value={bounds.start}
                    onChange={(event) =>
                      setBounds((current) => ({ ...current, start: event.target.value }))
                    }
                  />
                </Field>

                <Field
                  label="Period end"
                  required
                  error={touched && invalid.range ? 'The end must be on or after the start' : undefined}
                >
                  <Input
                    type="date"
                    value={bounds.end}
                    min={bounds.start}
                    onChange={(event) =>
                      setBounds((current) => ({ ...current, end: event.target.value }))
                    }
                  />
                </Field>

                <Field
                  label="Payrun name"
                  className="sm:col-span-2"
                  hint={`Leave empty to use “${defaultName}”`}
                >
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={defaultName}
                  />
                </Field>
              </div>

              <div className="flex items-start gap-2.5 mt-5 rounded-[var(--r-md)] bg-[var(--accent-soft)] px-4 py-3">
                <Info size={15} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
                <p className="text-[12.5px] text-[var(--slate)] leading-relaxed">
                  Continuing only previews who is eligible. No payrun and no payslip exists until
                  you confirm the selection on the next step.
                </p>
              </div>

              <div className="flex justify-end mt-5">
                <Button
                  variant="primary"
                  loading={busy}
                  icon={<ArrowRight size={16} />}
                  onClick={loadPreview}
                >
                  Continue
                </Button>
              </div>
            </>
          )}
        </Section>
      )}

      {step === 2 && preview && (
        <Section
          title={`Eligible employees — ${preview.salaryStructureName}`}
          description={`${formatDate(preview.periodStart)} → ${formatDate(preview.periodEnd)} · ${
            preview.totalDays
          } days · ${preview.employees.length} with a contract covering the period`}
          bodyClassName="p-0"
          actions={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() =>
                  setSelected(new Set(preview.employees.map((employee) => employee.employeeId)))
                }
              >
                Select all
              </Button>
              <Button size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          }
        >
          {preview.employees.length === 0 ? (
            <EmptyState
              title="Nobody is eligible for this period"
              message="Only employees with a contract overlapping the period can be included. Check the contracts list."
              action={
                <Button onClick={() => navigate('/contracts')}>Open contracts</Button>
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-[var(--line)] max-h-[520px] overflow-y-auto">
                {preview.employees.map((employee) => {
                  const checked = selected.has(employee.employeeId);
                  return (
                    <li key={employee.employeeId}>
                      <label className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#FAFBFE] transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(employee.employeeId)}
                          className="w-4 h-4 accent-[var(--accent)] flex-shrink-0"
                        />
                        <Avatar name={employee.name} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">
                            {employee.name}
                            <span className="text-[var(--muted)] font-normal ml-2">
                              {employee.employeeCode}
                            </span>
                          </p>
                          <p className="text-[12px] text-[var(--slate)] mt-0.5 truncate">
                            {employee.jobPosition ?? '—'} · {employee.departmentName ?? 'Unassigned'}
                          </p>
                          {employee.warnings.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {employee.warnings.map((warning) => (
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
                                  <AlertTriangle size={10} />
                                  {humanise(warning.code)}
                                </Chip>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[13px] font-bold text-[var(--ink)] tabular-nums">
                            {money(employee.wage)}
                          </p>
                          <p className="text-[11px] text-[var(--muted)]">
                            {employee.contractCount} contract
                            {employee.contractCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <StatusBadge status={employee.employeeType} size="sm" />
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-[var(--line)] bg-[#FAFBFE]">
                <p className="text-[13px] text-[var(--slate)]">
                  <span className="font-bold text-[var(--ink)] tabular-nums">{selected.size}</span>{' '}
                  of {preview.employees.length} selected
                  {preview.employees.some((employee) => employee.alreadyHasPayslipForPeriod) && (
                    <span className="text-[var(--warning)] ml-2 font-medium">
                      Employees with an existing payslip for this period are unticked by default.
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2.5">
                  <Button onClick={() => setStep(1)} disabled={busy}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    loading={busy}
                    disabled={selected.size === 0}
                    onClick={createPayrun}
                  >
                    Create payrun
                  </Button>
                </div>
              </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
