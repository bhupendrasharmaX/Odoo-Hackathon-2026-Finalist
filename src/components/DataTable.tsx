import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { EmptyState, SkeletonRows } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Value used for sorting when `render` returns markup. */
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Hide below the `lg` breakpoint - for columns that are nice, not vital. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  /** Highlights the active row, e.g. the record open in a side panel. */
  activeKey?: string | null;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  footer?: ReactNode;
  /** Drops the outer card chrome, for tables nested inside another card. */
  bare?: boolean;
  /** Caps the body height in px and pins the header while it scrolls. */
  maxHeight?: number;
  /** Tints alternate rows — helps the eye track across a wide table. */
  zebra?: boolean;
}

type SortDir = 'asc' | 'desc';

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  onRowClick,
  activeKey,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  emptyAction,
  footer,
  bare = false,
  maxHeight,
  zebra = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const column = columns.find((col) => col.key === sortKey);
    if (!column) return data;

    const valueOf = (row: T): string | number => {
      if (column.sortValue) return column.sortValue(row);
      const raw = (row as Record<string, unknown>)[column.key];
      if (typeof raw === 'number') return raw;
      return raw == null ? '' : String(raw);
    };

    return [...data].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [data, columns, sortKey, sortDir]);

  const toggleSort = (column: Column<T>) => {
    if (column.sortable === false) return;
    if (sortKey === column.key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column.key);
      setSortDir('asc');
    }
  };

  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  const shell = bare ? '' : 'card overflow-hidden';

  if (loading) {
    return (
      <div className={shell}>
        <SkeletonRows rows={6} cols={Math.min(columns.length, 5)} />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className={shell}>
        <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className={shell}>
      <div
        className={`overflow-x-auto ${maxHeight ? 'overflow-y-auto' : ''}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className={`w-full border-collapse ${maxHeight ? 'table-sticky' : ''}`}>
          <thead>
            <tr className="bg-[#F7F9FD]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => toggleSort(col)}
                  className={`h-11 px-4 text-[11px] font-bold tracking-wider uppercase text-[var(--slate)] border-b border-[var(--line)] select-none whitespace-nowrap ${alignClass(
                    col.align,
                  )} ${col.sortable === false ? '' : 'cursor-pointer hover:text-[var(--accent)]'} ${
                    col.hideOnMobile ? 'hidden lg:table-cell' : ''
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${
                      col.align === 'right' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {col.header}
                    {col.sortable !== false &&
                      (sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ChevronUp size={12} className="text-[var(--accent)]" />
                        ) : (
                          <ChevronDown size={12} className="text-[var(--accent)]" />
                        )
                      ) : (
                        <ChevronUp size={12} className="text-[#C6CEE0]" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={`h-12 border-b border-[var(--line)] last:border-b-0 row-rail ${
                    activeKey === key
                      ? 'bg-[var(--accent-soft)] row-rail-active'
                      : zebra
                        ? 'even:bg-[#FBFCFE]'
                        : ''
                  } ${onRowClick ? 'cursor-pointer hover:bg-[var(--accent-soft)]' : 'hover:bg-[#F7F9FD]'}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 text-[13px] text-[var(--ink)] ${alignClass(col.align)} ${
                        col.align === 'right' ? 'tabular-nums' : ''
                      } ${col.hideOnMobile ? 'hidden lg:table-cell' : ''}`}
                    >
                      {col.render
                        ? col.render(row)
                        : ((row as Record<string, unknown>)[col.key] as ReactNode)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
