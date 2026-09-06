import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Mail, Phone, Plus, Search, Users } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAsync, useDebounced } from '../lib/useApi';
import { humanise } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { EmployeeFormModal } from '../components/EmployeeForm';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  PageHeader,
  Pager,
  SegmentedControl,
  Select,
  SkeletonRows,
} from '../components/ui';
import type { Employee } from '../types';

const PAGE_SIZE = 20;

export function EmployeesPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebounced(search);
  const canWrite = CAN.writePeople(role);
  const selfScoped = CAN.isSelfScoped(role);

  const departments = useAsync(() => api.employees.departments(), []);
  const employees = useAsync(
    () =>
      api.employees.list({
        search: debouncedSearch,
        department,
        status,
        type,
        page,
        limit: PAGE_SIZE,
      }),
    [debouncedSearch, department, status, type, page],
  );

  const rows = useMemo(() => employees.data?.data ?? [], [employees.data]);

  // Kanban groups by department, mirroring the grouping in the brief.
  const grouped = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const employee of rows) {
      const key = employee.departmentName ?? 'Unassigned';
      map.set(key, [...(map.get(key) ?? []), employee]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (employee) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={employee.name} src={employee.avatarUrl} size={34} />
          <div className="min-w-0">
            <p className="font-semibold text-[var(--ink)] truncate">{employee.name}</p>
            <p className="text-[11.5px] text-[var(--muted)] truncate">{employee.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'employeeCode', header: 'Code', width: '110px' },
    {
      key: 'jobPosition',
      header: 'Job position',
      hideOnMobile: true,
      render: (employee) => employee.jobPosition ?? '—',
    },
    {
      key: 'departmentName',
      header: 'Department',
      render: (employee) => employee.departmentName ?? '—',
    },
    {
      key: 'managerName',
      header: 'Manager',
      hideOnMobile: true,
      render: (employee) => employee.managerName ?? '—',
    },
    {
      key: 'employeeType',
      header: 'Type',
      render: (employee) => <StatusBadge status={employee.employeeType} size="sm" />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (employee) => <StatusBadge status={employee.status} />,
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Users size={19} />}
        title={selfScoped ? 'My profile' : 'Employees'}
        subtitle={
          selfScoped
            ? 'Your own record, as HR holds it.'
            : `${employees.data?.meta.total ?? 0} employees on record`
        }
        actions={
          <>
            <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'List', icon: <List size={14} /> },
                { value: 'kanban', label: 'Kanban', icon: <LayoutGrid size={14} /> },
              ]}
            />
            {canWrite && (
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New employee
              </Button>
            )}
          </>
        }
      />

      {!selfScoped && (
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
                placeholder="Name, email, code or job position…"
                className="pl-9"
              />
            </div>
          </Field>

          <Field label="Department" className="w-52">
            <Select
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All departments</option>
              {(departments.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} ({row.headcount ?? 0})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type" className="w-40">
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All types</option>
              {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((option) => (
                <option key={option} value={option}>
                  {humanise(option)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" className="w-40">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {['ACTIVE', 'INACTIVE', 'ARCHIVED'].map((option) => (
                <option key={option} value={option}>
                  {humanise(option)}
                </option>
              ))}
            </Select>
          </Field>
        </FilterBar>
      )}

      {employees.error ? (
        <ErrorState message={employees.error} onRetry={employees.reload} />
      ) : view === 'list' ? (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(employee) => employee.id}
          loading={employees.loading}
          onRowClick={(employee) => navigate(`/employees/${employee.id}`)}
          zebra
          emptyTitle="No employees match these filters"
          footer={
            employees.data && (
              <Pager
                page={employees.data.meta.page}
                limit={employees.data.meta.limit}
                total={employees.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      ) : employees.loading ? (
        <div className="card">
          <SkeletonRows rows={6} cols={4} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState title="No employees match these filters" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map(([departmentName, members]) => (
            <section key={departmentName} className="card overflow-hidden">
              <div className="card-head">
                <h2 className="card-title">{departmentName}</h2>
                <span className="tab-count">{members.length}</span>
              </div>
              <div className="p-3 space-y-2.5 max-h-[560px] overflow-y-auto">
                {members.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => navigate(`/employees/${employee.id}`)}
                    className="w-full text-left rounded-[var(--r-md)] border border-[var(--line)] p-3.5 hover:border-[var(--accent)] hover:shadow-[var(--shadow-sm)] transition-all bg-white"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={employee.name} src={employee.avatarUrl} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-bold text-[var(--ink)] truncate">
                          {employee.name}
                        </p>
                        <p className="text-[12px] text-[var(--slate)] truncate">
                          {employee.jobPosition ?? employee.employeeCode}
                        </p>
                      </div>
                      <StatusBadge status={employee.status} size="sm" />
                    </div>

                    <div className="mt-3 pt-3 border-t border-[var(--line)] space-y-1.5">
                      <p className="flex items-center gap-2 text-[11.5px] text-[var(--slate)] truncate">
                        <Mail size={12} className="flex-shrink-0 text-[var(--muted)]" />
                        {employee.email}
                      </p>
                      {employee.phone && (
                        <p className="flex items-center gap-2 text-[11.5px] text-[var(--slate)]">
                          <Phone size={12} className="flex-shrink-0 text-[var(--muted)]" />
                          {employee.phone}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {creating && (
        <EmployeeFormModal
          open={creating}
          onClose={() => setCreating(false)}
          onSaved={(employee) => {
            setCreating(false);
            success('Employee created', `${employee.name} has been added.`);
            employees.reload();
            departments.reload();
          }}
        />
      )}
    </div>
  );
}
