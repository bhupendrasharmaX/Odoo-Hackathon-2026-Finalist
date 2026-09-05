import { useState } from 'react';
import { Palette, Plus, Tags } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { useToast } from '../components/Toast';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonRows,
  Toggle,
} from '../components/ui';

const SWATCHES = ['#2B50F5', '#12A67F', '#C2760A', '#7C4DDB', '#E0335C', '#5A6478'];

export function TimeOffTypesPage() {
  const { role } = useAuth();
  const { success } = useToast();
  const canWrite = CAN.writePeople(role);

  const [creating, setCreating] = useState(false);
  const types = useAsync(() => api.timeoff.types(), []);

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Tags size={19} />}
        title="Time off types"
        actions={
          canWrite && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New type
            </Button>
          )
        }
      />

      {types.error ? (
        <ErrorState message={types.error} onRetry={types.reload} />
      ) : types.loading ? (
        <div className="card">
          <SkeletonRows rows={4} cols={3} />
        </div>
      ) : (types.data?.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState
            title="No time off types yet"
            message="Create at least one type before anyone can request leave."
            icon={<Tags size={22} />}
            action={
              canWrite && (
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                  New type
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.data?.map((type) => (
            <div key={type.id} className="card card-hover p-5">
              <div className="flex items-start gap-3">
                <span
                  className="w-10 h-10 rounded-[var(--r-md)] flex-shrink-0"
                  style={{ backgroundColor: `${type.color ?? '#2B50F5'}1F` }}
                >
                  <span
                    className="block w-full h-full rounded-[var(--r-md)] grid place-items-center"
                    style={{ color: type.color ?? '#2B50F5' }}
                  >
                    <Palette size={17} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-[var(--ink)] truncate">{type.name}</p>
                  <p className="text-[12px] text-[var(--slate)] mt-0.5">
                    Counted in {type.unit.toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Chip tone={type.isPaid ? 'success' : 'neutral'}>
                  {type.isPaid ? 'Paid leave' : 'Unpaid'}
                </Chip>
                <Chip tone={type.requiresAllocation ? 'accent' : 'neutral'}>
                  {type.requiresAllocation ? 'Needs allocation' : 'No allocation'}
                </Chip>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <TypeModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            success('Time off type created');
            types.reload();
          }}
        />
      )}
    </div>
  );
}

function TypeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [touched, setTouched] = useState(false);

  const [draft, setDraft] = useState({
    name: '',
    unit: 'DAYS',
    requiresAllocation: true,
    isPaid: true,
    color: SWATCHES[0],
  });

  const invalid = !draft.name.trim();

  const submit = async () => {
    setTouched(true);
    if (invalid) return;

    const saved = await run(() =>
      api.timeoff.createType({
        name: draft.name.trim(),
        unit: draft.unit,
        requiresAllocation: draft.requiresAllocation,
        isPaid: draft.isPaid,
        color: draft.color,
      }),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New time off type"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Create type
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required error={touched && invalid ? 'Name is required' : undefined}>
          <Input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Paid Time Off"
          />
        </Field>

        <Field label="Unit">
          <Select
            value={draft.unit}
            onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
          >
            <option value="DAYS">Days</option>
            <option value="HOURS">Hours</option>
          </Select>
        </Field>

        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, color: swatch }))}
                className={`w-9 h-9 rounded-[var(--r-md)] transition-all ${
                  draft.color === swatch
                    ? 'ring-2 ring-offset-2 ring-[var(--ink)]'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: swatch }}
                aria-label={`Use ${swatch}`}
              />
            ))}
          </div>
        </Field>

        <div className="space-y-3 pt-1">
          <Toggle
            checked={draft.isPaid}
            onChange={(next) => setDraft((current) => ({ ...current, isPaid: next }))}
            label="Paid leave"
          />
          <Toggle
            checked={draft.requiresAllocation}
            onChange={(next) => setDraft((current) => ({ ...current, requiresAllocation: next }))}
            label="Requires an allocation before it can be requested"
          />
        </div>
      </div>
    </Modal>
  );
}
