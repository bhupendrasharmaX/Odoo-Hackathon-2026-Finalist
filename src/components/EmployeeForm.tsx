import { useState } from 'react';
import api from '../api';
import { useAction, useAsync } from '../lib/useApi';
import { humanise } from '../lib/format';
import { useToast } from './Toast';
import { Button, Field, Input, Modal, Select } from './ui';
import type { Employee } from '../types';

interface Draft {
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  jobPosition: string;
  managerId: string;
  workingScheduleId: string;
  employeeType: string;
  status: string;
  bankAccount: string;
}

function toDraft(employee?: Employee | null): Draft {
  return {
    employeeCode: employee?.employeeCode ?? '',
    name: employee?.name ?? '',
    email: employee?.email ?? '',
    phone: employee?.phone ?? '',
    departmentId: employee?.departmentId ?? '',
    jobPosition: employee?.jobPosition ?? '',
    managerId: employee?.managerId ?? '',
    workingScheduleId: employee?.workingScheduleId ?? '',
    employeeType: employee?.employeeType ?? 'FULL_TIME',
    status: employee?.status ?? 'ACTIVE',
    bankAccount: employee?.bankAccount ?? '',
  };
}

/**
 * Create / edit an employee.
 *
 * Optional text fields are sent as `null` rather than `""`: the API's schema
 * treats an empty string as a value, and a blank bank account stored as "" is
 * indistinguishable from a real one when payroll checks for it.
 */
export function EmployeeFormModal({
  open,
  employee,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee?: Employee | null;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
}) {
  const { error } = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(employee));
  const [touched, setTouched] = useState(false);

  const departments = useAsync(() => api.employees.departments(), []);
  const schedules = useAsync(() => api.schedules.list({ limit: 100 }), []);
  const colleagues = useAsync(() => api.employees.list({ limit: 100 }), []);

  const { busy, run } = useAction({ onError: error });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const missing = {
    employeeCode: !draft.employeeCode.trim(),
    name: !draft.name.trim(),
    email: !draft.email.trim(),
    departmentId: !draft.departmentId,
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;

    const payload = {
      employeeCode: draft.employeeCode.trim(),
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim() || null,
      departmentId: draft.departmentId,
      jobPosition: draft.jobPosition.trim() || null,
      managerId: draft.managerId || null,
      workingScheduleId: draft.workingScheduleId || null,
      employeeType: draft.employeeType,
      status: draft.status,
      bankAccount: draft.bankAccount.trim() || null,
    } as Partial<Employee>;

    const saved = await run(() =>
      employee ? api.employees.update(employee.id, payload) : api.employees.create(payload),
    );
    if (saved) onSaved(saved);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={employee ? `Edit ${employee.name}` : 'New employee'}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {employee ? 'Save changes' : 'Create employee'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          required
          error={touched && missing.name ? 'Name is required' : undefined}
        >
          <Input
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Aarav Mehta"
          />
        </Field>

        <Field
          label="Employee code"
          required
          error={touched && missing.employeeCode ? 'Employee code is required' : undefined}
        >
          <Input
            value={draft.employeeCode}
            onChange={(event) => set('employeeCode', event.target.value)}
            placeholder="EMP014"
          />
        </Field>

        <Field
          label="Email"
          required
          error={touched && missing.email ? 'Email is required' : undefined}
        >
          <Input
            type="email"
            value={draft.email}
            onChange={(event) => set('email', event.target.value)}
            placeholder="name@peoplepay.com"
          />
        </Field>

        <Field label="Phone">
          <Input
            value={draft.phone}
            onChange={(event) => set('phone', event.target.value)}
            placeholder="9000000000"
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
            <option value="">Select a department…</option>
            {(departments.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Job position">
          <Input
            value={draft.jobPosition}
            onChange={(event) => set('jobPosition', event.target.value)}
            placeholder="Software Engineer"
          />
        </Field>

        <Field label="Manager">
          <Select value={draft.managerId} onChange={(event) => set('managerId', event.target.value)}>
            <option value="">No manager</option>
            {(colleagues.data?.data ?? [])
              .filter((row) => row.id !== employee?.id)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Working schedule" hint="Drives attendance and payroll working days">
          <Select
            value={draft.workingScheduleId}
            onChange={(event) => set('workingScheduleId', event.target.value)}
          >
            <option value="">No schedule</option>
            {(schedules.data?.data ?? []).map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name} · {schedule.weeklyHours}h/week
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Employee type">
          <Select
            value={draft.employeeType}
            onChange={(event) => set('employeeType', event.target.value)}
          >
            {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((option) => (
              <option key={option} value={option}>
                {humanise(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select value={draft.status} onChange={(event) => set('status', event.target.value)}>
            {['ACTIVE', 'INACTIVE', 'ARCHIVED'].map((option) => (
              <option key={option} value={option}>
                {humanise(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Bank account"
          className="sm:col-span-2"
          hint="Payroll raises a high-severity warning when this is missing."
        >
          <Input
            value={draft.bankAccount}
            onChange={(event) => set('bankAccount', event.target.value)}
            placeholder="XXXX1234"
          />
        </Field>
      </div>
    </Modal>
  );
}
