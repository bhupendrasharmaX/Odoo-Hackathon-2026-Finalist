import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api';
import type { Employee, EmployeeStatus } from '../types';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Can } from '../components/Can';

const TABS: { label: string; value: EmployeeStatus | 'all' }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Active',    value: 'active' },
  { label: 'Inactive',  value: 'inactive' },
  { label: 'On Leave',  value: 'on_leave' },
];

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

const columns: Column<Employee>[] = [
  { key: 'employeeId', header: 'ID',         width: '90px' },
  {
    key: 'firstName',
    header: 'Name',
    render: (row) => `${row.firstName} ${row.lastName}`,
  },
  { key: 'email',       header: 'Email' },
  { key: 'department',  header: 'Department' },
  { key: 'designation', header: 'Designation' },
  {
    key: 'dateOfJoining',
    header: 'Joined',
    render: (row) =>
      new Date(row.dateOfJoining).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
  },
  {
    key: 'salary',
    header: 'Salary',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums">{formatINR(row.salary)}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
    sortable: true,
  },
];

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EmployeeStatus | 'all'>('all');

  useEffect(() => {
    api
      .getEmployees()
      .then(setEmployees)
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    activeTab === 'all'
      ? employees
      : employees.filter((e) => e.status === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--slate)]">
        Loading employees…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--ink)]">Employees</h1>
        <Can module="employees" action="write">
          <button className="inline-flex items-center gap-1.5 px-3 h-8 bg-[var(--accent)] text-white text-sm font-medium rounded hover:opacity-90 transition-opacity">
            <Plus size={14} />
            Add Employee
          </button>
        </Can>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--line)]">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.value
                ? 'text-[var(--accent)] border-b-[var(--accent)]'
                : 'text-[var(--slate)] border-b-transparent hover:text-[var(--ink)]'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs tabular-nums">
              {tab.value === 'all'
                ? employees.length
                : employees.filter((e) => e.status === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable<Employee>
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        searchFields={['firstName', 'lastName', 'email', 'department', 'employeeId']}
        pageSize={15}
      />
    </div>
  );
}
