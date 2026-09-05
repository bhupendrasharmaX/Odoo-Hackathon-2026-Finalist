import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Plus } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/StatusBadge';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SkeletonRows,
} from '../components/ui';
import type { SalaryRuleInput } from '../types';

/** A sane starting point, so a new structure is never an empty shell. */
const STARTER_RULES: SalaryRuleInput[] = [
  {
    name: 'Basic Salary',
    code: 'BASIC',
    category: 'BASIC',
    sequence: 10,
    computeType: 'PERCENTAGE',
    amount: null,
    percentage: 50,
    formula: null,
    baseRuleCode: null,
  },
  {
    name: 'House Rent Allowance',
    code: 'HRA',
    category: 'ALLOWANCE',
    sequence: 20,
    computeType: 'PERCENTAGE',
    amount: null,
    percentage: 40,
    formula: null,
    baseRuleCode: 'BASIC',
  },
  {
    name: 'Provident Fund',
    code: 'PF',
    category: 'DEDUCTION',
    sequence: 100,
    computeType: 'PERCENTAGE',
    amount: null,
    percentage: 12,
    formula: null,
    baseRuleCode: 'BASIC',
  },
];

export function StructuresPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { success } = useToast();

  const canWrite = CAN.writeSalaryConfig(role);
  const [creating, setCreating] = useState(false);

  const structures = useAsync(() => api.salary.structures({ limit: 50 }), []);

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<FileSpreadsheet size={19} />}
        title="Salary structures"
        actions={
          canWrite && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New structure
            </Button>
          )
        }
      />

      {!canWrite && (
        <div className="card px-5 py-3.5 mb-5 text-[13px] text-[var(--slate)]">
          Your role can read salary configuration but not change it. Editing is restricted to a
          payroll manager.
        </div>
      )}

      {structures.error ? (
        <ErrorState message={structures.error} onRetry={structures.reload} />
      ) : structures.loading ? (
        <div className="card">
          <SkeletonRows rows={4} cols={3} />
        </div>
      ) : (structures.data?.data.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState
            title="No salary structures yet"
            message="Payroll cannot run without one. Create a structure and give it at least a basic rule."
            icon={<FileSpreadsheet size={22} />}
            action={
              canWrite && (
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                  New structure
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {structures.data?.data.map((structure) => {
            const categories = [...new Set(structure.rules.map((rule) => rule.category))];
            return (
              <button
                key={structure.id}
                type="button"
                onClick={() => navigate(`/payroll/structures/${structure.id}`)}
                className="card card-hover p-5 text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="icon-tile w-10 h-10 tile-purple">
                    <FileSpreadsheet size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-[var(--ink)] truncate">
                      {structure.name}
                    </p>
                    <p className="text-[12px] text-[var(--slate)] mt-0.5">
                      {structure.ruleCount ?? structure.rules.length} rule
                      {(structure.ruleCount ?? structure.rules.length) === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {categories.map((category) => (
                      <StatusBadge key={category} status={category} size="sm" />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {creating && (
        <NewStructureModal
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            success('Structure created');
            navigate(`/payroll/structures/${id}`);
          }}
        />
      )}
    </div>
  );
}

function NewStructureModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [name, setName] = useState('');
  const [withStarter, setWithStarter] = useState(true);
  const [touched, setTouched] = useState(false);

  const invalid = !name.trim();

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    const saved = await run(() =>
      api.salary.createStructure({
        name: name.trim(),
        rules: withStarter ? STARTER_RULES : [],
      }),
    );
    if (saved) onSaved(saved.id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New salary structure"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Create structure
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required error={touched && invalid ? 'Name is required' : undefined}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Regular Salary"
          />
        </Field>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={withStarter}
            onChange={(event) => setWithStarter(event.target.checked)}
            className="w-4 h-4 accent-[var(--accent)] mt-0.5"
          />
          <span className="text-[13px] text-[var(--slate)] leading-relaxed">
            Start with three worked example rules — Basic (50% of the contract wage), HRA (40% of
            Basic) and PF (12% of Basic). You can edit or delete them afterwards.
          </span>
        </label>
      </div>
    </Modal>
  );
}
