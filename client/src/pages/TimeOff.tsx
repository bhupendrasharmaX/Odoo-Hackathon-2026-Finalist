import { useMemo, useState } from 'react';
import { CalendarDays, Check, Plus, X } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { daysBetween, formatDate, humanise, num, today } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Button,
  ErrorState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Pager,
  Section,
  Select,
  SkeletonRows,
  Textarea,
} from '../components/ui';
import { Meter } from '../components/charts';
import type { Paged, Employee, TimeOffBalance, TimeOffRequest } from '../types';

const STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REFUSED'];

export function TimeOffPage() {
  const { role, user } = useAuth();
  const { success, error } = useToast();

  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [page, setPage] = useState(1);
  const [requesting, setRequesting] = useState(false);

  const canApprove = CAN.writePeople(role);
  const selfScoped = CAN.isSelfScoped(role);

  const employees = useAsync<Paged<Employee> | null>(
    () => (selfScoped ? Promise.resolve(null) : api.employees.list({ limit: 100 })),
    [selfScoped],
  );
  const requests = useAsync(
    () => api.timeoff.requests({ status, employeeId, page, limit: 20 }),
    [status, employeeId, page],
  );
  const balance = useAsync<TimeOffBalance | null>(
    () => (user?.employeeId ? api.timeoff.balance(user.employeeId) : Promise.resolve(null)),
    [user?.employeeId],
  );

  const { busy, run } = useAction({ onSuccess: success, onError: error });

  const decide = async (request: TimeOffRequest, decision: 'approve' | 'refuse') => {
    const result = await run(
      () =>
        decision === 'approve'
          ? api.timeoff.approveRequest(request.id)
          : api.timeoff.refuseRequest(request.id),
      decision === 'approve' ? 'Time off approved' : 'Time off refused',
    );
    if (result) {
      requests.reload();
      balance.reload();
    }
  };

  const columns: Column<TimeOffRequest>[] = [
    ...(selfScoped
      ? []
      : [
          {
            key: 'employeeName',
            header: 'Employee',
            render: (row: TimeOffRequest) => (
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={row.employeeName} size={30} />
                <span className="font-semibold truncate">{row.employeeName ?? '—'}</span>
              </div>
            ),
          } as Column<TimeOffRequest>,
        ]),
    { key: 'timeOffTypeName', header: 'Type', render: (row) => row.timeOffTypeName ?? '—' },
    { key: 'dateFrom', header: 'From', render: (row) => formatDate(row.dateFrom) },
    { key: 'dateTo', header: 'To', render: (row) => formatDate(row.dateTo) },
    { key: 'durationDays', header: 'Days', align: 'right', render: (row) => num(row.durationDays) },
    {
      key: 'reason',
      header: 'Reason',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-[var(--slate)] line-clamp-1" title={row.reason ?? ''}>
          {row.reason ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge status={row.status} />
          {row.approvedByName && (
            <p className="text-[10.5px] text-[var(--muted)] mt-1">by {row.approvedByName}</p>
          )}
        </div>
      ),
    },
    ...(canApprove
      ? [
          {
            key: 'actions',
            header: '',
            sortable: false,
            align: 'right' as const,
            width: '150px',
            render: (row: TimeOffRequest) =>
              row.status === 'PENDING' || row.status === 'DRAFT' ? (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="xs"
                    variant="success"
                    icon={<Check size={13} />}
                    disabled={busy}
                    onClick={() => decide(row, 'approve')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="xs"
                    variant="danger"
                    icon={<X size={13} />}
                    disabled={busy}
                    onClick={() => decide(row, 'refuse')}
                  >
                    Refuse
                  </Button>
                </div>
              ) : (
                <span className="text-[var(--muted)] text-[12px]">Decided</span>
              ),
          },
        ]
      : []),
  ];

  const pendingCount = useMemo(
    () => (requests.data?.data ?? []).filter((row) => row.status === 'PENDING').length,
    [requests.data],
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<CalendarDays size={19} />}
        title={selfScoped ? 'My time off' : 'Time off'}
        subtitle={
          canApprove
            ? `${requests.data?.meta.total ?? 0} requests · ${pendingCount} awaiting a decision on this page`
            : 'Request leave and follow its approval.'
        }
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setRequesting(true)}>
            Request time off
          </Button>
        }
      />

      {balance.data && balance.data.balances.length > 0 && (
        <Section title="My balances" className="mb-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {balance.data.balances.map((row) => (
              <div key={row.id}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-[13px] font-semibold text-[var(--ink)]">
                    {row.timeOffTypeName}
                  </span>
                  <span className="text-[13px] font-bold text-[var(--ink)] tabular-nums">
                    {num(row.availableDays)}d
                  </span>
                </div>
                <Meter value={row.usedDays} max={row.allocatedDays} />
                <p className="text-[11px] text-[var(--muted)] mt-1.5 tabular-nums">
                  {num(row.usedDays)} used · {num(row.pendingDays)} pending · {num(row.allocatedDays)}{' '}
                  allocated
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {balance.loading && (
        <div className="card mb-5">
          <SkeletonRows rows={2} cols={3} />
        </div>
      )}

      <FilterBar>
        {!selfScoped && (
          <Field label="Employee" className="w-56">
            <Select
              value={employeeId}
              onChange={(event) => {
                setEmployeeId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All employees</option>
              {(employees.data?.data ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

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

      {requests.error ? (
        <ErrorState message={requests.error} onRetry={requests.reload} />
      ) : (
        <DataTable
          columns={columns}
          data={requests.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={requests.loading}
          emptyTitle="No time off requests"
          footer={
            requests.data && (
              <Pager
                page={requests.data.meta.page}
                limit={requests.data.meta.limit}
                total={requests.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      )}

      {requesting && (
        <RequestModal
          canPickEmployee={!selfScoped}
          onClose={() => setRequesting(false)}
          onSaved={() => {
            setRequesting(false);
            success('Time off requested');
            requests.reload();
            balance.reload();
          }}
        />
      )}
    </div>
  );
}

function RequestModal({
  canPickEmployee,
  onClose,
  onSaved,
}: {
  canPickEmployee: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [touched, setTouched] = useState(false);

  const [draft, setDraft] = useState({
    employeeId: '',
    timeOffTypeId: '',
    dateFrom: today(),
    dateTo: today(),
    reason: '',
  });

  const types = useAsync(() => api.timeoff.types(), []);
  const employees = useAsync<Paged<Employee> | null>(
    () => (canPickEmployee ? api.employees.list({ limit: 100 }) : Promise.resolve(null)),
    [canPickEmployee],
  );

  const set = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const duration = daysBetween(draft.dateFrom, draft.dateTo);
  const selectedType = types.data?.find((type) => type.id === draft.timeOffTypeId);

  const missing = {
    timeOffTypeId: !draft.timeOffTypeId,
    range: duration === 0,
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;

    const saved = await run(() =>
      api.timeoff.createRequest({
        // Omitted for an employee: the API fills in their own id and refuses
        // to let anyone file leave on a colleague's behalf.
        ...(draft.employeeId ? { employeeId: draft.employeeId } : {}),
        timeOffTypeId: draft.timeOffTypeId,
        dateFrom: draft.dateFrom,
        dateTo: draft.dateTo,
        reason: draft.reason.trim() || null,
      }),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Request time off"
      footer={
        <>
          <span className="mr-auto text-[13px] text-[var(--slate)]">
            <span className="font-bold text-[var(--ink)] tabular-nums">{duration}</span> day
            {duration === 1 ? '' : 's'}
          </span>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Submit request
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {canPickEmployee && (
          <Field label="Employee" className="sm:col-span-2" hint="Leave empty to request for yourself">
            <Select
              value={draft.employeeId}
              onChange={(event) => set('employeeId', event.target.value)}
            >
              <option value="">Myself</option>
              {(employees.data?.data ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} · {employee.employeeCode}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field
          label="Time off type"
          required
          className="sm:col-span-2"
          error={touched && missing.timeOffTypeId ? 'Choose a type' : undefined}
          hint={
            selectedType
              ? `${selectedType.isPaid ? 'Paid' : 'Unpaid'} · ${
                  selectedType.requiresAllocation
                    ? 'draws down an allocation'
                    : 'no allocation required'
                }`
              : undefined
          }
        >
          <Select
            value={draft.timeOffTypeId}
            onChange={(event) => set('timeOffTypeId', event.target.value)}
          >
            <option value="">Select a type…</option>
            {(types.data ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="From"
          required
          error={touched && missing.range ? 'End date must be on or after the start' : undefined}
        >
          <Input
            type="date"
            value={draft.dateFrom}
            onChange={(event) => set('dateFrom', event.target.value)}
          />
        </Field>

        <Field label="To" required>
          <Input
            type="date"
            value={draft.dateTo}
            min={draft.dateFrom}
            onChange={(event) => set('dateTo', event.target.value)}
          />
        </Field>

        <Field label="Reason" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={draft.reason}
            onChange={(event) => set('reason', event.target.value)}
            placeholder="Optional, but it helps whoever approves this."
          />
        </Field>
      </div>
    </Modal>
  );
}
