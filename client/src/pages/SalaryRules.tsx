import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Sliders } from 'lucide-react';
import api from '../api';
import { useAsync } from '../lib/useApi';
import { humanise, money } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Field, FilterBar, PageHeader, Pager, Select } from '../components/ui';
import type { SalaryRule } from '../types';

/** Every rule across every structure, for a flat read of the whole config. */
export function SalaryRulesPage() {
  const [structureId, setStructureId] = useState('');
  const [page, setPage] = useState(1);

  const structures = useAsync(() => api.salary.structures({ limit: 100 }), []);
  const rules = useAsync(
    () => api.salary.rules({ structureId, page, limit: 20 }),
    [structureId, page],
  );

  const structureName = (id: string) =>
    structures.data?.data.find((structure) => structure.id === id)?.name ?? '—';

  const columns: Column<SalaryRule>[] = [
    { key: 'sequence', header: 'Seq', align: 'right', width: '70px' },
    {
      key: 'name',
      header: 'Rule',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-[var(--ink)] truncate">{row.name}</p>
          <p className="text-[11.5px] text-[var(--muted)] font-mono">{row.code}</p>
        </div>
      ),
    },
    {
      key: 'structureId',
      header: 'Structure',
      render: (row) => (
        <Link
          to={`/payroll/structures/${row.structureId}`}
          className="text-[var(--accent)] font-semibold hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {structureName(row.structureId)}
        </Link>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <StatusBadge status={row.category} size="sm" />,
    },
    {
      key: 'computeType',
      header: 'Computation',
      render: (row) => (
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
            {humanise(row.computeType)}
          </span>
          <p className="text-[13px] text-[var(--slate)]">
            {row.computeType === 'FIXED'
              ? money(row.amount ?? 0)
              : row.computeType === 'PERCENTAGE'
                ? `${row.percentage ?? 0}% of ${row.baseRuleCode ?? 'the contract wage'}`
                : row.formula}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Sliders size={19} />}
        title="Salary rules"
      />

      <FilterBar>
        <Field label="Structure" className="w-64">
          <Select
            value={structureId}
            onChange={(event) => {
              setStructureId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All structures</option>
            {(structures.data?.data ?? []).map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.name}
              </option>
            ))}
          </Select>
        </Field>

        {structureId && (
          <Link to={`/payroll/structures/${structureId}`} className="btn btn-secondary btn-sm">
            <FileSpreadsheet size={14} />
            Open structure
          </Link>
        )}
      </FilterBar>

      {rules.error ? (
        <ErrorState message={rules.error} onRetry={rules.reload} />
      ) : (
        <DataTable
          columns={columns}
          data={rules.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={rules.loading}
          emptyTitle="No salary rules"
          emptyMessage="Add rules from inside a salary structure."
          footer={
            rules.data && (
              <Pager
                page={rules.data.meta.page}
                limit={rules.data.meta.limit}
                total={rules.data.meta.total}
                onPage={setPage}
              />
            )
          }
        />
      )}
    </div>
  );
}
