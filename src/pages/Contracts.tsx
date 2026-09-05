import { useState } from 'react';
import { FileText, Pencil, Plus } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { formatDate, humanise, money, today } from '../lib/format';
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
import type { Contract } from '../types';

const STATUSES = ['DRAFT', 'RUNNING', 'EXPIRED', 'CANCELLED'];

export function ContractsPage() {
  const { role } = useAuth();
  const { success } = useToast();

  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [creating, setCreating] = useState(false);

  const canWrite = CAN.writePeople(role);
  const canSeeStructures = CAN.viewSalaryConfig(role);

  const employees = useAsync(() => api.employees.list({ limit: 100 }), []);
  const contracts = useAsync(
    () => api.contracts.list({ employeeId, status, page, limit: 20 }),
    [employeeId, status, page],
  );

  const columns: Column<Contract>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={row.employeeName} size={30} />
          <span className="font-semibold truncate">{row.employeeName ?? '—'}</span>
        </div>
      ),
    },
    { key: 'jobPosition', header: 'Position', render: (row) => row.jobPosition ?? '—' },
    {
      key: 'departmentName',
      header: 'Department',
      hideOnMobile: true,
      render: (row) => row.departmentName ?? '—',
    },
    { key: 'startDate', header: 'Start', render: (row) => formatDate(row.startDate) },
    { key: 'endDate', header: 'End', render: (row) => formatDate(row.endDate) },
    {
      key: 'salaryStructureName',
      header: 'Structure',
      hideOnMobile: true,
      render: (row) => row.salaryStructureName ?? '—',
    },
    {
      key: 'wage',
      header: 'Wage',
      align: 'right',
      render: (row) => <span className="font-semibold">{money(row.wage)}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            sortable: false,
            width: '60px',
            align: 'right' as const,
            render: (row: Contract) => (
              <Button
                size="xs"
                icon={<Pencil size={13} />}
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(row);
                }}
              >
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<FileText size={19} />}
        title="Contracts"
        subtitle={`${contracts.data?.meta.total ?? 0} contracts`}
        actions={
          canWrite && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New contract
            </Button>
          )
        }
      />

      <FilterBar>
        <Field label="Employee" className="w-64">
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

      {contracts.error ? (
        <ErrorState message={contracts.error} onRetry={contracts.reload} />
      ) : (
        <DataTable
          columns={columns}
          data={contracts.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={contracts.loading}
          emptyTitle="No contracts yet"
          emptyMessage="No contracts on record."
          emptyAction={
            canWrite && (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                New contract
              </Button>
            )
          }
          footer={
            contracts.data && (
              <Pager
                page={contracts.data.meta.page}
                limit={contracts.data.meta.limit}
                total={contracts.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      )}

      {(creating || editing) && (
        <ContractModal
          contract={editing}
          canSeeStructures={canSeeStructures}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            success(editing ? 'Contract updated' : 'Contract created');
            setCreating(false);
            setEditing(null);
            contracts.reload();
          }}
        />
      )}
    </div>
  );
}

function ContractModal({
  contract,
  canSeeStructures,
  onClose,
  onSaved,
}: {
  contract: Contract | null;
  canSeeStructures: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [touched, setTouched] = useState(false);

  const [draft, setDraft] = useState({
    employeeId: contract?.employeeId ?? '',
    departmentId: contract?.departmentId ?? '',
    startDate: contract?.startDate ?? today(),
    endDate: contract?.endDate ?? '',
    wage: contract ? String(contract.wage) : '',
    jobPosition: contract?.jobPosition ?? '',
    workingScheduleId: contract?.workingScheduleId ?? '',
    salaryStructureId: contract?.salaryStructureId ?? '',
    status: contract?.status ?? 'DRAFT',
  });

  const employees = useAsync(() => api.employees.list({ limit: 100 }), []);
  const departments = useAsync(() => api.employees.departments(), []);
  const schedules = useAsync(() => api.schedules.list({ limit: 100 }), []);
  // Salary structures are payroll-scoped; HR_MANAGER gets a 403 there, so the
  // list is only requested for roles that may read it.
  const structures = useAsync(
    () => (canSeeStructures ? api.salary.structures({ limit: 100 }) : Promise.resolve(null)),
    [canSeeStructures],
  );

  const set = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const missing = {
    employeeId: !draft.employeeId,
    departmentId: !draft.departmentId,
    startDate: !draft.startDate,
    wage: draft.wage === '' || Number.isNaN(Number(draft.wage)) || Number(draft.wage) < 0,
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;

    const payload = {
      startDate: draft.startDate,
      endDate: draft.endDate || null,
      wage: Number(draft.wage),
      jobPosition: draft.jobPosition.trim() || null,
      departmentId: draft.departmentId,
      workingScheduleId: draft.workingScheduleId || null,
      salaryStructureId: draft.salaryStructureId || null,
      status: draft.status,
    };

    // employeeId is create-only: the API refuses to move a contract between
    // employees, because a payslip may already cite it.
    const saved = await run(() =>
      contract
        ? api.contracts.update(contract.id, payload as never)
        : api.contracts.create({ ...payload, employeeId: draft.employeeId } as never),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={contract ? `Edit contract — ${contract.employeeName}` : 'New contract'}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {contract ? 'Save changes' : 'Create contract'}
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
          hint={contract ? 'A contract cannot be reassigned to a different employee.' : undefined}
        >
          <Select
            value={draft.employeeId}
            disabled={Boolean(contract)}
            onChange={(event) => {
              const employee = employees.data?.data.find((row) => row.id === event.target.value);
              setDraft((current) => ({
                ...current,
                employeeId: event.target.value,
                // Prefill from the employee record - overridable below.
                departmentId: employee?.departmentId ?? current.departmentId,
                jobPosition: employee?.jobPosition ?? current.jobPosition,
                workingScheduleId: employee?.workingScheduleId ?? current.workingScheduleId,
              }));
            }}
          >
            <option value="">Select an employee…</option>
            {(employees.data?.data ?? []).map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.employeeCode}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Start date"
          required
          error={touched && missing.startDate ? 'Start date is required' : undefined}
        >
          <Input
            type="date"
            value={draft.startDate}
            onChange={(event) => set('startDate', event.target.value)}
          />
        </Field>

        <Field label="End date" hint="Leave empty for an open-ended contract">
          <Input
            type="date"
            value={draft.endDate}
            onChange={(event) => set('endDate', event.target.value)}
          />
        </Field>

        <Field
          label="Monthly wage"
          required
          error={touched && missing.wage ? 'Enter a wage of zero or more' : undefined}
        >
          <Input
            type="number"
            min="0"
            step="100"
            value={draft.wage}
            onChange={(event) => set('wage', event.target.value)}
            placeholder="50000"
          />
        </Field>

        <Field label="Job position">
          <Input
            value={draft.jobPosition}
            onChange={(event) => set('jobPosition', event.target.value)}
          />
        </Field>

        <Field
          label="Department"
          required
          error={touched && missing.departmentId ? 'Choose a department' : undefined}
        >
          <Select
            value={draft.departmentId}
            onChange={(event) => set('departmentId', event.target.value)}
          >
            <option value="">Select…</option>
            {(departments.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Working schedule">
          <Select
            value={draft.workingScheduleId}
            onChange={(event) => set('workingScheduleId', event.target.value)}
          >
            <option value="">None</option>
            {(schedules.data?.data ?? []).map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name} · {schedule.weeklyHours}h/week
              </option>
            ))}
          </Select>
        </Field>

        {canSeeStructures && (
          <Field label="Salary structure" hint="Used when this contract is picked up by a payrun">
            <Select
              value={draft.salaryStructureId}
              onChange={(event) => set('salaryStructureId', event.target.value)}
            >
              <option value="">None</option>
              {(structures.data?.data ?? []).map((structure) => (
                <option key={structure.id} value={structure.id}>
                  {structure.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Status" hint="Only RUNNING contracts are picked up by payroll">
          <Select value={draft.status} onChange={(event) => set('status', event.target.value)}>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {humanise(option)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
