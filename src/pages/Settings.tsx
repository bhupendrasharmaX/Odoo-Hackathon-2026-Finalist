import { useEffect, useState } from 'react';
import { Plus, Building2, Network } from 'lucide-react';
import api from '../api';
import type { Department } from '../types';
import { DataTable, type Column } from '../components/DataTable';
import { Can } from '../components/Can';

const ORG_FIELDS: { label: string; value: string; numeric?: boolean }[] = [
  { label: 'Company Name', value: 'PeoplePay360 Pvt. Ltd.' },
  { label: 'Industry', value: 'Technology / SaaS' },
  {
    label: 'Registered Address',
    value: '123, Tech Park, Whitefield, Bangalore — 560066',
  },
  { label: 'GSTIN', value: '29ABCDE1234F1Z5', numeric: true },
];

const columns: Column<Department>[] = [
  { key: 'id', header: 'ID', width: '80px' },
  { key: 'name', header: 'Department' },
  { key: 'head', header: 'Department Head' },
  {
    key: 'employeeCount',
    header: 'Employees',
    align: 'right',
    render: (row) => <span className="tabular-nums">{row.employeeCount}</span>,
  },
];

export function SettingsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDepartments()
      .then(setDepartments)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--slate)]">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Your organisation details and the departments people belong to.
        </p>
      </div>

      {/* Organization Info */}
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <span className="icon-tile tile-blue">
              <Building2 size={19} />
            </span>
            <h2 className="card-title">Organization</h2>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {ORG_FIELDS.map((field) => (
            <div key={field.label}>
              <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                {field.label}
              </label>
              <p
                className={`text-sm font-medium text-[var(--ink)] ${
                  field.numeric ? 'tabular-nums' : ''
                }`}
              >
                {field.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Departments */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="icon-tile tile-purple">
              <Network size={19} />
            </span>
            <h2 className="card-title">Departments</h2>
          </div>
          <Can module="settings" action="write">
            <button className="btn btn-primary">
              <Plus size={16} />
              Add Department
            </button>
          </Can>
        </div>
        <DataTable<Department>
          columns={columns}
          data={departments}
          rowKey={(row) => row.id}
          searchable={false}
          pageSize={15}
        />
      </div>
    </div>
  );
}
