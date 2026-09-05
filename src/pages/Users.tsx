import { useState } from 'react';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../auth/permissions';
import { useAction, useAsync, useDebounced } from '../lib/useApi';
import { formatDate } from '../lib/format';
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
import type { Role, User } from '../types';

const ROLES: Role[] = [
  'EMPLOYEE',
  'HR_MANAGER',
  'HR_PAYROLL_USER',
  'HR_PAYROLL_MANAGER',
  'ADMIN',
];

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [changing, setChanging] = useState<User | null>(null);

  const debouncedSearch = useDebounced(search);
  const users = useAsync(
    () =>
      api.users.list({
        search: debouncedSearch,
        role: role || undefined,
        page,
        limit: 20,
      }),
    [debouncedSearch, role, page],
  );

  const { busy, run } = useAction({ onSuccess: success, onError: error });

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      render: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={row.name} size={34} />
          <div className="min-w-0">
            <p className="font-semibold text-[var(--ink)] truncate">
              {row.name}
              {row.id === currentUser?.id && (
                <span className="text-[11px] text-[var(--muted)] font-normal ml-2">you</span>
              )}
            </p>
            <p className="text-[11.5px] text-[var(--muted)] truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'employeeName',
      header: 'Linked employee',
      render: (row) =>
        row.employeeName ?? <span className="text-[var(--muted)]">Not linked</span>,
    },
    { key: 'role', header: 'Role', render: (row) => <StatusBadge status={row.role} /> },
    {
      key: 'createdAt',
      header: 'Created',
      hideOnMobile: true,
      render: (row) => formatDate(row.createdAt?.slice(0, 10)),
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      align: 'right',
      width: '120px',
      render: (row) => (
        <Button size="xs" disabled={busy} onClick={() => setChanging(row)}>
          Change role
        </Button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<ShieldCheck size={19} />}
        title="Users & roles"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New user
          </Button>
        }
      />

      <FilterBar>
        <Field label="Search" className="flex-1 min-w-[220px]">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Name or email…"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="Role" className="w-52">
          <Select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as '' | Role);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      {users.error ? (
        <ErrorState message={users.error} onRetry={users.reload} />
      ) : (
        <DataTable
          columns={columns}
          data={users.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={users.loading}
          emptyTitle="No users match this filter"
          footer={
            users.data && (
              <Pager
                page={users.data.meta.page}
                limit={users.data.meta.limit}
                total={users.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      )}

      {creating && (
        <NewUserModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            success('User created');
            users.reload();
          }}
        />
      )}

      {changing && (
        <RoleModal
          user={changing}
          busy={busy}
          onClose={() => setChanging(null)}
          onSave={async (nextRole) => {
            const saved = await run(
              () => api.users.changeRole(changing.id, nextRole),
              'Role updated',
            );
            if (saved) {
              setChanging(null);
              users.reload();
            }
          }}
        />
      )}
    </div>
  );
}

function NewUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });
  const [touched, setTouched] = useState(false);

  const [draft, setDraft] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE' as Role,
    employeeId: '',
  });

  const employees = useAsync(() => api.employees.list({ limit: 100 }), []);

  const set = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const missing = {
    name: !draft.name.trim(),
    email: !draft.email.trim(),
    password: draft.password.length < 8,
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    const saved = await run(() =>
      api.users.create({
        name: draft.name.trim(),
        email: draft.email.trim(),
        password: draft.password,
        role: draft.role,
        employeeId: draft.employeeId || null,
      }),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New user"
      description="A login without a linked employee cannot clock in or request time off."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Create user
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={touched && missing.name ? 'Name is required' : undefined}>
          <Input value={draft.name} onChange={(event) => set('name', event.target.value)} />
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
          />
        </Field>

        <Field
          label="Password"
          required
          hint="At least 8 characters"
          error={touched && missing.password ? 'Use at least 8 characters' : undefined}
        >
          <Input
            type="password"
            value={draft.password}
            onChange={(event) => set('password', event.target.value)}
          />
        </Field>

        <Field label="Role">
          <Select value={draft.role} onChange={(event) => set('role', event.target.value)}>
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Linked employee"
          className="sm:col-span-2"
          hint="Links this login to an employee record, so it can clock in and see its own payslips."
        >
          <Select
            value={draft.employeeId}
            onChange={(event) => set('employeeId', event.target.value)}
          >
            <option value="">Not linked</option>
            {(employees.data?.data ?? []).map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.employeeCode}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function RoleModal({
  user,
  busy,
  onClose,
  onSave,
}: {
  user: User;
  busy: boolean;
  onClose: () => void;
  onSave: (role: Role) => void;
}) {
  const [role, setRole] = useState<Role>(user.role);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change role — ${user.name}`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={role === user.role}
            onClick={() => onSave(role)}
          >
            Update role
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {ROLES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRole(option)}
            className={`w-full text-left rounded-[var(--r-md)] border px-4 py-3 transition-all ${
              role === option
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)] hover:border-[var(--accent)]'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">
                {ROLE_LABELS[option]}
              </span>
              {user.role === option && (
                <span className="text-[11px] text-[var(--muted)] font-medium">current</span>
              )}
            </div>
            <p className="text-[12px] text-[var(--slate)] mt-0.5">{ROLE_NOTES[option]}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

const ROLE_NOTES: Record<Role, string> = {
  EMPLOYEE: 'Own records only — attendance, time off, payslips.',
  HR_MANAGER: 'People operations. No access to payroll, payslips or the dashboard.',
  HR_PAYROLL_USER: 'People ops plus payroll. Salary configuration is read-only.',
  HR_PAYROLL_MANAGER: 'Full payroll, including salary structures and rules.',
  ADMIN: 'Everything, plus user and role management.',
};
