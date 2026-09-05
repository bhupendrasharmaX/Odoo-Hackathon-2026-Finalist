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
  { key: 'employeeId', header: 'ID',         width: '110px' },
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">
            Everyone on the payroll, their details and their current standing.
          </p>
        </div>
        <Can module="employees" action="write">
          <button className="btn btn-primary">
            <Plus size={16} />
            Add Employee
          </button>
        </Can>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`tab-pill ${
              activeTab === tab.value ? 'tab-pill-active' : ''
            }`}
          >
            {tab.label}
            <span className="tab-count">
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
