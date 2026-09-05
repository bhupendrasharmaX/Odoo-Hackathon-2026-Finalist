import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api';
import type { Department } from '../types';
import { DataTable, type Column } from '../components/DataTable';
import { Can } from '../components/Can';

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
      <h1 className="text-lg font-semibold text-[var(--ink)]">Settings</h1>

      {/* Organization Info */}
      <div className="bg-white border border-[var(--line)] rounded">
        <div className="px-4 py-3 border-b border-[var(--line)]">
          <h2 className="text-sm font-semibold text-[var(--ink)]">
            Organization
          </h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--slate)] uppercase tracking-wider mb-1">
              Company Name
            </label>
            <p className="text-sm text-[var(--ink)]">PeoplePay360 Pvt. Ltd.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--slate)] uppercase tracking-wider mb-1">
              Industry
            </label>
            <p className="text-sm text-[var(--ink)]">Technology / SaaS</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--slate)] uppercase tracking-wider mb-1">
              Registered Address
            </label>
            <p className="text-sm text-[var(--ink)]">
              123, Tech Park, Whitefield, Bangalore — 560066
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--slate)] uppercase tracking-wider mb-1">
              GSTIN
            </label>
            <p className="text-sm text-[var(--ink)] tabular-nums">
              29ABCDE1234F1Z5
            </p>
          </div>
        </div>
      </div>

      {/* Departments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">
            Departments
          </h2>
          <Can module="settings" action="write">
            <button className="inline-flex items-center gap-1.5 px-3 h-8 bg-[var(--accent)] text-white text-sm font-medium rounded hover:opacity-90 transition-opacity">
              <Plus size={14} />
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
