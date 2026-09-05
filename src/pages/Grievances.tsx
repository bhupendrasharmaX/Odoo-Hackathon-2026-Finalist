import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareWarning, Plus } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { formatDateTime, humanise } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Pager,
  Select,
  SkeletonRows,
  Textarea,
} from '../components/ui';
import type { Grievance } from '../types';

const STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

export function GrievancesPage() {
  const { role } = useAuth();
  const { success } = useToast();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [raising, setRaising] = useState(false);
  const [responding, setResponding] = useState<Grievance | null>(null);

  const canResolve = CAN.resolveGrievance(role);
  const selfScoped = CAN.isSelfScoped(role);

  const grievances = useAsync(
    () => api.grievances.list({ status, page, limit: 20 }),
    [status, page],
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<MessageSquareWarning size={19} />}
        title={selfScoped ? 'My grievances' : 'Grievances'}
        subtitle={
          canResolve
            ? 'Payroll queries raised by employees. Only HR and payroll can close one.'
            : 'Raise a payroll query and follow its resolution.'
        }
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setRaising(true)}>
            Raise a grievance
          </Button>
        }
      />

      <FilterBar>
        <Field label="Status" className="w-48">
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

      {grievances.error ? (
        <ErrorState message={grievances.error} onRetry={grievances.reload} />
      ) : grievances.loading ? (
        <div className="card">
          <SkeletonRows rows={4} cols={3} />
        </div>
      ) : (grievances.data?.data.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState
            title="No grievances"
            message="Nothing has been raised under this filter."
            icon={<MessageSquareWarning size={22} />}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-[var(--line)]">
            {grievances.data?.data.map((grievance) => (
              <li key={grievance.id} className="p-5">
                <div className="flex items-start gap-3.5">
                  <Avatar name={grievance.employeeName} size={38} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <p className="text-[14px] font-bold text-[var(--ink)]">{grievance.subject}</p>
                      <StatusBadge status={grievance.status} size="sm" />
                    </div>

                    <p className="text-[12px] text-[var(--muted)] mt-0.5">
                      {grievance.employeeName} · raised {formatDateTime(grievance.createdAt)}
                      {grievance.payslipId && (
                        <>
                          {' · '}
                          <Link
                            to={`/payroll/payslips/${grievance.payslipId}`}
                            className="text-[var(--accent)] font-semibold hover:underline"
                          >
                            view payslip
                          </Link>
                        </>
                      )}
                    </p>

                    <p className="text-[13.5px] text-[var(--slate)] mt-2.5 leading-relaxed whitespace-pre-line">
                      {grievance.description}
                    </p>

                    {grievance.response && (
                      <div className="mt-3.5 rounded-[var(--r-md)] bg-[var(--success-soft)] px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--success)]">
                          Response from {grievance.resolvedByName ?? 'HR'}
                        </p>
                        <p className="text-[13px] text-[var(--ink)] mt-1 leading-relaxed whitespace-pre-line">
                          {grievance.response}
                        </p>
                        {grievance.resolvedAt && (
                          <p className="text-[11px] text-[var(--muted)] mt-1.5">
                            {formatDateTime(grievance.resolvedAt)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {canResolve && (
                    <Button size="sm" onClick={() => setResponding(grievance)}>
                      {grievance.status === 'RESOLVED' || grievance.status === 'REJECTED'
                        ? 'Reopen'
                        : 'Respond'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {grievances.data && (
            <Pager
              page={grievances.data.meta.page}
              limit={grievances.data.meta.limit}
              total={grievances.data.meta.total}
              onPage={setPage}
            />
          )}
        </div>
      )}

      {raising && (
        <RaiseModal
          onClose={() => setRaising(false)}
          onSaved={() => {
            setRaising(false);
            success('Grievance raised');
            grievances.reload();
          }}
        />
      )}

      {responding && (
        <RespondModal
          grievance={responding}
          onClose={() => setResponding(null)}
          onSaved={() => {
            setResponding(null);
            success('Grievance updated');
            grievances.reload();
          }}
        />
      )}
    </div>
  );
}

function RaiseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
      api.grievances.create({ subject: subject.trim(), description: description.trim() }),
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
            maxLength={150}
            placeholder="Leave balance looks wrong"
          />
        </Field>

        <Field
          label="Description"
          required
          error={touched && !description.trim() ? 'Describe the issue' : undefined}
        >
          <Textarea
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function RespondModal({
  grievance,
  onClose,
  onSaved,
}: {
  grievance: Grievance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [status, setStatus] = useState(grievance.status);
  const [response, setResponse] = useState(grievance.response ?? '');

  const submit = async () => {
    const saved = await run(() =>
      api.grievances.update(grievance.id, {
        status,
        response: response.trim() || null,
      }),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={grievance.subject}
      description={`Raised by ${grievance.employeeName ?? 'an employee'}`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[var(--r-md)] bg-[var(--canvas)] px-4 py-3">
          <p className="text-[13px] text-[var(--slate)] leading-relaxed whitespace-pre-line">
            {grievance.description}
          </p>
        </div>

        <Field label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as never)}>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {humanise(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Response" hint="The employee sees this on their grievance.">
          <Textarea
            rows={4}
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="What you found, and what happens next."
          />
        </Field>
      </div>
    </Modal>
  );
}
