import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Info, Plus, Save, Trash2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { humanise, money } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  Modal,
  Section,
  Select,
  Spinner,
} from '../components/ui';
import type { ComputeType, RuleCategory, SalaryRuleInput } from '../types';

const CATEGORIES: RuleCategory[] = ['BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET'];
const COMPUTE_TYPES: ComputeType[] = ['FIXED', 'PERCENTAGE', 'FORMULA'];

const BUILT_INS = ['WAGE', 'WORKED_DAYS', 'TOTAL_DAYS', 'UNPAID_DAYS'];

function emptyRule(sequence: number): SalaryRuleInput {
  return {
    name: '',
    code: '',
    category: 'ALLOWANCE',
    sequence,
    computeType: 'FIXED',
    amount: 0,
    percentage: null,
    formula: null,
    baseRuleCode: null,
  };
}

/** How a rule computes, in one line - the same wording the engine uses. */
function describe(rule: SalaryRuleInput): string {
  if (rule.computeType === 'FIXED') return money(rule.amount ?? 0);
  if (rule.computeType === 'PERCENTAGE') {
    return `${rule.percentage ?? 0}% of ${rule.baseRuleCode || 'the contract wage'}`;
  }
  return rule.formula ?? '—';
}

export function StructureDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { success, error } = useToast();

  const canWrite = CAN.writeSalaryConfig(role);
  const structure = useAsync(() => api.salary.structure(id), [id]);
  const { busy, run } = useAction({ onError: error });

  const [name, setName] = useState('');
  const [rules, setRules] = useState<SalaryRuleInput[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  // Seed the editor once the structure lands, and again after every save.
  useEffect(() => {
    if (!structure.data) return;
    setName(structure.data.name);
    setRules(
      [...structure.data.rules]
        .sort((a, b) => a.sequence - b.sequence)
        .map(({ id: _id, structureId: _structureId, ...rule }) => rule),
    );
    setDirty(false);
  }, [structure.data]);

  if (structure.loading) return <Spinner label="Loading structure…" />;
  if (structure.error || !structure.data) {
    return <ErrorState message={structure.error ?? 'Structure not found'} onRetry={structure.reload} />;
  }

  const save = async () => {
    const saved = await run(() =>
      api.salary.updateStructure(id, {
        name: name.trim(),
        // The API replaces the whole rule set, so the full list is always sent.
        rules: rules.map((rule) => ({
          ...rule,
          code: rule.code.trim().toUpperCase(),
          name: rule.name.trim(),
          baseRuleCode: rule.baseRuleCode?.trim().toUpperCase() || null,
          formula: rule.formula?.trim() || null,
        })),
      }),
    );
    if (saved) {
      success('Structure saved', `${saved.rules.length} rule(s) stored.`);
      structure.reload();
    }
  };

  const upsertRule = (rule: SalaryRuleInput, index: number | null) => {
    setRules((current) =>
      index === null ? [...current, rule] : current.map((row, i) => (i === index ? rule : row)),
    );
    setDirty(true);
    setEditingIndex(null);
  };

  const nextSequence = rules.length === 0 ? 10 : Math.max(...rules.map((rule) => rule.sequence)) + 10;
  const ordered = [...rules].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/payroll/structures')}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--slate)] hover:text-[var(--accent)] transition-colors mb-4"
      >
        <ArrowLeft size={15} /> Back to structures
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="icon-tile w-11 h-11 tile-purple mt-0.5">
            <FileSpreadsheet size={19} />
          </span>
          <div className="min-w-0">
            {canWrite ? (
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setDirty(true);
                }}
                className="page-title bg-transparent border-b-2 border-transparent focus:border-[var(--accent)] focus:outline-none w-full max-w-md"
              />
            ) : (
              <h1 className="page-title">{name}</h1>
            )}
            <p className="page-subtitle">
              {rules.length} rule{rules.length === 1 ? '' : 's'} · processed in sequence order
            </p>
          </div>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2.5">
            <Button
              icon={<Plus size={15} />}
              onClick={() => setEditingIndex(-1)}
            >
              Add rule
            </Button>
            <Button
              variant="primary"
              icon={<Save size={15} />}
              loading={busy}
              disabled={!dirty}
              onClick={save}
            >
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-[var(--r-md)] bg-[var(--accent-soft)] px-4 py-3 mb-5">
        <Info size={15} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
        <p className="text-[12.5px] text-[var(--slate)] leading-relaxed">
          Rules run in ascending sequence. A percentage or formula may only reference a rule with a
          <em> lower</em> sequence, plus the built-ins {BUILT_INS.join(', ')}.
        </p>
      </div>

      <Section bodyClassName="p-0">
        {ordered.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-12">
            This structure has no rules yet. A payrun computed against it would produce zero pay.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F9FD]">
                {['Seq', 'Rule', 'Category', 'Computation', ''].map((header) => (
                  <th
                    key={header}
                    className="h-11 px-4 text-left text-[11px] font-bold tracking-wider uppercase text-[var(--slate)] border-b border-[var(--line)]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((rule) => {
                const index = rules.indexOf(rule);
                return (
                  <tr
                    key={`${rule.code}-${rule.sequence}`}
                    className="border-b border-[var(--line)] last:border-b-0 hover:bg-[#FAFBFE] transition-colors"
                  >
                    <td className="px-4 py-3 text-[13px] text-[var(--muted)] tabular-nums w-16">
                      {rule.sequence}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13.5px] font-semibold text-[var(--ink)]">{rule.name}</p>
                      <p className="text-[11.5px] text-[var(--muted)] font-mono">{rule.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={rule.category} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[var(--slate)]">
                      <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)] mr-2">
                        {humanise(rule.computeType)}
                      </span>
                      {describe(rule)}
                    </td>
                    <td className="px-4 py-3 text-right w-28">
                      {canWrite && (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="xs" onClick={() => setEditingIndex(index)}>
                            Edit
                          </Button>
                          <button
                            type="button"
                            onClick={() => setRemoving(index)}
                            className="text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] p-1.5 rounded-[var(--r-sm)] transition-colors"
                            aria-label={`Remove ${rule.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {editingIndex !== null && (
        <RuleModal
          rule={editingIndex >= 0 ? rules[editingIndex] : emptyRule(nextSequence)}
          otherCodes={rules
            .filter((_, index) => index !== editingIndex)
            .map((rule) => rule.code)
            .filter(Boolean)}
          onClose={() => setEditingIndex(null)}
          onSave={(rule) => upsertRule(rule, editingIndex >= 0 ? editingIndex : null)}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove this rule?"
        message="It is removed from the editor. Nothing changes on the server until you press Save changes."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => {
          setRules((current) => current.filter((_, index) => index !== removing));
          setDirty(true);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

function RuleModal({
  rule,
  otherCodes,
  onClose,
  onSave,
}: {
  rule: SalaryRuleInput;
  otherCodes: string[];
  onClose: () => void;
  onSave: (rule: SalaryRuleInput) => void;
}) {
  const [draft, setDraft] = useState<SalaryRuleInput>(rule);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof SalaryRuleInput>(key: K, value: SalaryRuleInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const missing = {
    name: !draft.name.trim(),
    code: !draft.code.trim(),
    duplicate: otherCodes.includes(draft.code.trim().toUpperCase()),
    amount: draft.computeType === 'FIXED' && draft.amount == null,
    percentage: draft.computeType === 'PERCENTAGE' && draft.percentage == null,
    formula: draft.computeType === 'FORMULA' && !draft.formula?.trim(),
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    onSave({
      ...draft,
      code: draft.code.trim().toUpperCase(),
      name: draft.name.trim(),
      // Only the field that matches the compute type is kept, so a stale
      // percentage cannot linger on a rule that is now FIXED.
      amount: draft.computeType === 'FIXED' ? Number(draft.amount ?? 0) : null,
      percentage: draft.computeType === 'PERCENTAGE' ? Number(draft.percentage ?? 0) : null,
      formula: draft.computeType === 'FORMULA' ? (draft.formula?.trim() ?? null) : null,
      baseRuleCode:
        draft.computeType === 'PERCENTAGE' ? draft.baseRuleCode?.trim().toUpperCase() || null : null,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={rule.code ? `Edit rule — ${rule.code}` : 'New salary rule'}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Apply
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Rule name"
          required
          error={touched && missing.name ? 'Name is required' : undefined}
        >
          <Input value={draft.name} onChange={(event) => set('name', event.target.value)} />
        </Field>

        <Field
          label="Code"
          required
          hint="Formulas refer to a rule by this code"
          error={
            touched && missing.code
              ? 'Code is required'
              : touched && missing.duplicate
                ? 'Another rule already uses this code'
                : undefined
          }
        >
          <Input
            value={draft.code}
            onChange={(event) => set('code', event.target.value.toUpperCase())}
            placeholder="HRA"
            className="font-mono"
          />
        </Field>

        <Field label="Category">
          <Select
            value={draft.category}
            onChange={(event) => set('category', event.target.value as RuleCategory)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {humanise(category)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Sequence" hint="Lower numbers are computed first">
          <Input
            type="number"
            min="0"
            step="10"
            value={draft.sequence}
            onChange={(event) => set('sequence', Number(event.target.value))}
          />
        </Field>

        <Field label="Computation" className="sm:col-span-2">
          <div className="grid grid-cols-3 gap-2">
            {COMPUTE_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => set('computeType', option)}
                className={`rounded-[var(--r-md)] border px-3 py-2.5 text-[13px] font-semibold transition-all ${
                  draft.computeType === option
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--line)] text-[var(--slate)] hover:border-[var(--accent)]'
                }`}
              >
                {humanise(option)}
              </button>
            ))}
          </div>
        </Field>

        {draft.computeType === 'FIXED' && (
          <Field
            label="Amount"
            required
            className="sm:col-span-2"
            error={touched && missing.amount ? 'Enter an amount' : undefined}
          >
            <Input
              type="number"
              step="1"
              value={draft.amount ?? ''}
              onChange={(event) => set('amount', Number(event.target.value))}
            />
          </Field>
        )}

        {draft.computeType === 'PERCENTAGE' && (
          <>
            <Field
              label="Percentage"
              required
              hint="12 means 12%"
              error={touched && missing.percentage ? 'Enter a percentage' : undefined}
            >
              <Input
                type="number"
                step="0.5"
                value={draft.percentage ?? ''}
                onChange={(event) => set('percentage', Number(event.target.value))}
              />
            </Field>

            <Field label="Percentage of" hint="Leave empty for the contract wage">
              <Select
                value={draft.baseRuleCode ?? ''}
                onChange={(event) => set('baseRuleCode', event.target.value || null)}
              >
                <option value="">Contract wage</option>
                {otherCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}

        {draft.computeType === 'FORMULA' && (
          <Field
            label="Formula"
            required
            className="sm:col-span-2"
            hint={`Arithmetic over rule codes and ${BUILT_INS.join(', ')}. Example: WAGE * WORKED_DAYS / TOTAL_DAYS`}
            error={touched && missing.formula ? 'Enter a formula' : undefined}
          >
            <Input
              value={draft.formula ?? ''}
              onChange={(event) => set('formula', event.target.value)}
              placeholder="BASIC * 0.4"
              className="font-mono"
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
