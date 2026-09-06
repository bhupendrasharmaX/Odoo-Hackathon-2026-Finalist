import { useState } from 'react';
import { Check, Plus, Wallet } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { formatDate, num, today } from '../lib/format';
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
  Select,
} from '../components/ui';
import { Meter } from '../components/charts';
import type { Allocation, Employee, Paged } from '../types';

export function AllocationsPage() {
  const { role } = useAuth();
  const { success, error } = useToast();

  const [employeeId, setEmployeeId] = useState('');
  const [timeOffTypeId, setTimeOffTypeId] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const canWrite = CAN.writePeople(role);
  const selfScoped = CAN.isSelfScoped(role);

  const employees = useAsync<Paged<Employee> | null>(
    () => (selfScoped ? Promise.resolve(null) : api.employees.list({ limit: 100 })),
    [selfScoped],
  );
  const types = useAsync(() => api.timeoff.types(), []);
  const allocations = useAsync(
    () => api.timeoff.allocations({ employeeId, timeOffTypeId, page, limit: 20 }),
    [employeeId, timeOffTypeId, page],
  );

  const { busy, run } = useAction({ onSuccess: success, onError: error });

  const approve = async (allocation: Allocation) => {
    const result = await run(
      () => api.timeoff.approveAllocation(allocation.id),
      'Allocation approved',
    );
    if (result) allocations.reload();
  };

  const columns: Column<Allocation>[] = [
    ...(selfScoped
      ? []
      : [
          {
            key: 'employeeName',
            header: 'Employee',
            render: (row: Allocation) => (
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={row.employeeName} size={30} />
                <span className="font-semibold truncate">{row.employeeName ?? '—'}</span>
              </div>
            ),
          } as Column<Allocation>,
        ]),
    { key: 'timeOffTypeName', header: 'Type', render: (row) => row.timeOffTypeName ?? '—' },
    {
      key: 'usage',
      header: 'Usage',
      sortable: false,
      width: '190px',
      render: (row) => (
        <div className="py-1">
          <Meter value={row.usedDays} max={row.allocatedDays} />
          <p className="text-[11px] text-[var(--muted)] mt-1 tabular-nums">
            {num(row.usedDays)} of {num(row.allocatedDays)} days used
          </p>
        </div>
      ),
    },
    {
      key: 'remainingDays',
      header: 'Remaining',
      align: 'right',
      render: (row) => <span className="font-bold">{num(row.remainingDays)}</span>,
    },
    { key: 'validFrom', header: 'Valid from', hideOnMobile: true, render: (row) => formatDate(row.validFrom) },
    { key: 'validTo', header: 'Valid to', hideOnMobile: true, render: (row) => formatDate(row.validTo) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            sortable: false,
            align: 'right' as const,
            width: '110px',
            render: (row: Allocation) =>
              row.status === 'PENDING' ? (
                <Button
                  size="xs"
                  variant="success"
                  icon={<Check size={13} />}
                  disabled={busy}
                  onClick={() => approve(row)}
                >
                  Approve
                </Button>
              ) : (
                <span className="text-[var(--muted)] text-[12px]">—</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Wallet size={19} />}
        title={selfScoped ? 'My allocations' : 'Leave allocations'}
        actions={
          canWrite && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New allocation
            </Button>
          )
        }
      />

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

        <Field label="Time off type" className="w-52">
          <Select
            value={timeOffTypeId}
            onChange={(event) => {
              setTimeOffTypeId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {(types.data ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      {allocations.error ? (
        <ErrorState message={allocations.error} onRetry={allocations.reload} />
      ) : (
        <DataTable
          columns={columns}
          data={allocations.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={allocations.loading}
          emptyTitle="No allocations yet"
          emptyMessage="No allocations recorded."
          emptyAction={
            canWrite && (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                New allocation
              </Button>
            )
          }
          footer={
            allocations.data && (
              <Pager
                page={allocations.data.meta.page}
                limit={allocations.data.meta.limit}
                total={allocations.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      )}

      {creating && (
        <AllocationModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            success('Allocation created');
            allocations.reload();
          }}
        />
      )}
    </div>
  );
}

function AllocationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [touched, setTouched] = useState(false);

  const yearEnd = `${new Date().getFullYear()}-12-31`;

  const [draft, setDraft] = useState({
    employeeId: '',
    timeOffTypeId: '',
    allocatedDays: '12',
    validFrom: today(),
    validTo: yearEnd,
    status: 'APPROVED',
  });

  const employees = useAsync(() => api.employees.list({ limit: 100 }), []);
  const types = useAsync(() => api.timeoff.types(), []);

  const set = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const missing = {
    employeeId: !draft.employeeId,
    timeOffTypeId: !draft.timeOffTypeId,
    allocatedDays: !(Number(draft.allocatedDays) > 0),
    range: !draft.validFrom || !draft.validTo || draft.validTo < draft.validFrom,
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;

    const saved = await run(() =>
      api.timeoff.createAllocation({
        employeeId: draft.employeeId,
        timeOffTypeId: draft.timeOffTypeId,
        allocatedDays: Number(draft.allocatedDays),
        validFrom: draft.validFrom,
        validTo: draft.validTo,
        status: draft.status,
      }),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New allocation"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Create allocation
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Employee"
          required
          className="sm:col-span-2"
          error={touched && missing.employeeId ? 'Choose an employee' : undefined}
        >
          <Select value={draft.employeeId} onChange={(event) => set('employeeId', event.target.value)}>
            <option value="">Select an employee…</option>
            {(employees.data?.data ?? []).map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.employeeCode}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Time off type"
          required
          error={touched && missing.timeOffTypeId ? 'Choose a type' : undefined}
        >
          <Select
            value={draft.timeOffTypeId}
            onChange={(event) => set('timeOffTypeId', event.target.value)}
          >
            <option value="">Select…</option>
            {(types.data ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Days allocated"
          required
          error={touched && missing.allocatedDays ? 'Allocate more than zero days' : undefined}
        >
          <Input
            type="number"
            min="0.5"
            step="0.5"
            value={draft.allocatedDays}
            onChange={(event) => set('allocatedDays', event.target.value)}
          />
        </Field>

        <Field
          label="Valid from"
          required
          error={touched && missing.range ? 'The end must be on or after the start' : undefined}
        >
          <Input
            type="date"
            value={draft.validFrom}
            onChange={(event) => set('validFrom', event.target.value)}
          />
        </Field>

        <Field label="Valid to" required>
          <Input
            type="date"
            value={draft.validTo}
            min={draft.validFrom}
            onChange={(event) => set('validTo', event.target.value)}
          />
        </Field>

        <Field
          label="Status"
          className="sm:col-span-2"
          hint="A pending allocation cannot be drawn down until it is approved."
        >
          <Select value={draft.status} onChange={(event) => set('status', event.target.value)}>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
