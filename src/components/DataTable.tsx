import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Column definition ---
export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** Right-align (for money/numbers) */
  align?: 'left' | 'right' | 'center';
  /** Width hint */
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Unique key extractor */
  rowKey: (row: T) => string;
  /** Rows per page. Default: 15 */
  pageSize?: number;
  /** Show search bar. Default: true */
  searchable?: boolean;
  /** Search fields to filter on */
  searchFields?: (keyof T)[];
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Empty state message */
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc';

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  pageSize = 15,
  searchable = true,
  searchFields,
  onRowClick,
  emptyMessage = 'No data found',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) => {
      const rec = row as Record<string, unknown>;
      const fields = searchFields || (Object.keys(rec) as (keyof T)[]);
      return fields.some((f) => {
        const val = rec[f as string];
        return val != null && String(val).toLowerCase().includes(q);
      });
    });
  }, [data, search, searchFields]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const renderSortIcon = (key: string) => {
    if (sortKey !== key)
      return <ChevronUp size={12} className="text-[var(--line)]" />;
    return sortDir === 'asc' ? (
      <ChevronUp size={12} className="text-[var(--accent)]" />
    ) : (
      <ChevronDown size={12} className="text-[var(--accent)]" />
    );
  };

  return (
    <div className="bg-white border border-[var(--line)] rounded overflow-hidden">
      {/* Search bar */}
      {searchable && (
        <div className="px-4 py-2 border-b border-[var(--line)]">
          <div className="relative max-w-xs">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--slate)]"
            />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-[var(--line)] rounded bg-[var(--canvas)] text-[var(--ink)] placeholder:text-[var(--slate)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`h-10 px-3 text-[11px] font-semibold tracking-wider uppercase text-[var(--slate)] border-b border-[var(--line)] select-none ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.sortable !== false ? 'cursor-pointer hover:text-[var(--ink)]' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable !== false && renderSortIcon(col.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-20 text-center text-sm text-[var(--slate)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={`h-10 border-b border-[var(--line)] last:border-b-0 ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-[var(--canvas)]'
                      : ''
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 text-[13px] text-[var(--ink)] ${
                        col.align === 'right'
                          ? 'text-right tabular-nums'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      {col.render
                        ? col.render(row)
                        : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--line)] text-xs text-[var(--slate)]">
          <span>
            {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, sorted.length)} of{' '}
            {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="p-1 rounded hover:bg-[var(--canvas)] disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="p-1 rounded hover:bg-[var(--canvas)] disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
