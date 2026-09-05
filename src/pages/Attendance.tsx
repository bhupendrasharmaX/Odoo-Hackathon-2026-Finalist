import { useState } from 'react';
import { Clock, Pencil, Plus } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { formatDate, formatTime, humanise, num, today } from '../lib/format';
import { AttendanceWidget } from '../components/AttendanceWidget';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Button,
  Chip,
  ErrorState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Pager,
  Select,
} from '../components/ui';
import type { Attendance } from '../types';

const STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'MISSING_CHECKOUT'];

/** A datetime-local value from an ISO instant, in the browser's timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AttendancePage() {
  const { role } = useAuth();
  const { success } = useToast();

  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [creating, setCreating] = useState(false);

  const canWrite = CAN.writePeople(role);
  const selfScoped = CAN.isSelfScoped(role);

  const employees = useAsync(
    () => (selfScoped ? Promise.resolve(null) : api.employees.list({ limit: 100 })),
    [selfScoped],
  );
  const attendance = useAsync(
    () => api.attendance.list({ employeeId, status, from, to, page, limit: 20 }),
    [employeeId, status, from, to, page],
  );

  const columns: Column<Attendance>[] = [
    ...(selfScoped
      ? []
      : [
          {
            key: 'employeeName',
            header: 'Employee',
            render: (row: Attendance) => (
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={row.employeeName} size={30} />
                <span className="font-semibold truncate">{row.employeeName ?? '—'}</span>
              </div>
            ),
          } as Column<Attendance>,
        ]),
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDate(row.checkIn?.slice(0, 10)),
      sortValue: (row) => row.checkIn ?? '',
    },
    { key: 'checkIn', header: 'Check in', render: (row) => formatTime(row.checkIn) },
    {
      key: 'checkOut',
      header: 'Check out',
      render: (row) =>
        row.checkOut ? (
          formatTime(row.checkOut)
        ) : (
          <span className="text-[var(--warning)] font-semibold">Still open</span>
        ),
    },
    {
      key: 'workedHours',
      header: 'Worked',
      align: 'right',
      render: (row) => `${num(row.workedHours)}h`,
    },
    {
      key: 'overtimeHours',
      header: 'Overtime',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (row.overtimeHours > 0 ? `${num(row.overtimeHours)}h` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.isManuallyEdited && <Chip tone="warning">Edited</Chip>}
        </div>
      ),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            sortable: false,
            align: 'right' as const,
            width: '70px',
            render: (row: Attendance) => (
              <Button
                size="xs"
                icon={<Pencil size={13} />}
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(row);
                }}
              >
                Correct
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Clock size={19} />}
        title={selfScoped ? 'My attendance' : 'Attendance'}
        subtitle={
          selfScoped
            ? 'Your own check-ins. Corrections are made by HR and are always audited.'
            : `${attendance.data?.meta.total ?? 0} records · manual corrections are flagged`
        }
        actions={
          canWrite && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              Record attendance
            </Button>
          )
        }
      />

      <div className="mb-5">
        <AttendanceWidget compact onChange={attendance.reload} />
      </div>

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

        <Field label="From" className="w-40">
          <Input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </Field>

        <Field label="To" className="w-40">
          <Input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </Field>

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

        {(employeeId || status || from || to) && (
          <Button
            size="sm"
            onClick={() => {
              setEmployeeId('');
              setStatus('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </FilterBar>

      {attendance.error ? (
        <ErrorState message={attendance.error} onRetry={attendance.reload} />
      ) : (
        <DataTable
          columns={columns}
          data={attendance.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={attendance.loading}
          emptyTitle="No attendance records"
          emptyMessage="Check in with the widget above, or record attendance manually."
          footer={
            attendance.data && (
              <Pager
                page={attendance.data.meta.page}
                limit={attendance.data.meta.limit}
                total={attendance.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      )}

      {(creating || editing) && (
        <AttendanceModal
          record={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            success(editing ? 'Attendance corrected' : 'Attendance recorded');
            setCreating(false);
            setEditing(null);
            attendance.reload();
          }}
        />
      )}
    </div>
  );
}

function AttendanceModal({
  record,
  onClose,
  onSaved,
}: {
  record: Attendance | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [touched, setTouched] = useState(false);

  const [draft, setDraft] = useState({
    employeeId: record?.employeeId ?? '',
    checkIn: toLocalInput(record?.checkIn ?? null) || `${today()}T09:00`,
    checkOut: toLocalInput(record?.checkOut ?? null),
    status: record?.status ?? '',
    notes: record?.notes ?? '',
  });

  const employees = useAsync(() => api.employees.list({ limit: 100 }), []);

  const set = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const missing = {
    employeeId: !record && !draft.employeeId,
    checkIn: !draft.checkIn,
    order: Boolean(draft.checkOut) && draft.checkOut <= draft.checkIn,
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;

    // datetime-local is timezone-naive; toISOString sends a real instant.
    const payload = {
      checkIn: new Date(draft.checkIn).toISOString(),
      checkOut: draft.checkOut ? new Date(draft.checkOut).toISOString() : null,
      status: draft.status || undefined,
      notes: draft.notes.trim() || null,
    };

    const saved = await run(() =>
      record
        ? api.attendance.update(record.id, payload)
        : api.attendance.create({ ...payload, employeeId: draft.employeeId } as never),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={record ? `Correct attendance — ${record.employeeName}` : 'Record attendance'}
      description={
        record
          ? 'The record will be flagged as manually edited and written to the audit log.'
          : 'Worked hours are recalculated from the times you enter.'
      }
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {record ? 'Save correction' : 'Record'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!record && (
          <Field
            label="Employee"
            required
            className="sm:col-span-2"
            error={touched && missing.employeeId ? 'Choose an employee' : undefined}
          >
            <Select
              value={draft.employeeId}
              onChange={(event) => set('employeeId', event.target.value)}
            >
              <option value="">Select an employee…</option>
              {(employees.data?.data ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} · {employee.employeeCode}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field
          label="Check in"
          required
          error={touched && missing.checkIn ? 'Check-in time is required' : undefined}
        >
          <Input
            type="datetime-local"
            value={draft.checkIn}
            onChange={(event) => set('checkIn', event.target.value)}
          />
        </Field>

        <Field
          label="Check out"
          hint="Leave empty for an open session"
          error={touched && missing.order ? 'Check out must be after check in' : undefined}
        >
          <Input
            type="datetime-local"
            value={draft.checkOut}
            onChange={(event) => set('checkOut', event.target.value)}
          />
        </Field>

        <Field label="Status" hint="Leave on automatic to classify from the times">
          <Select value={draft.status} onChange={(event) => set('status', event.target.value)}>
            <option value="">Automatic</option>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {humanise(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notes">
          <Input
            value={draft.notes}
            onChange={(event) => set('notes', event.target.value)}
            placeholder="Reason for the correction"
          />
        </Field>
      </div>
    </Modal>
  );
}
