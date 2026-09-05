import { useEffect, useState } from 'react';
import api from '../api';
import type { AttendanceRecord, AttendanceStatus } from '../types';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  leave: 'Leave',
  holiday: 'Holiday',
  weekend: 'Weekend',
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const columns: Column<AttendanceRecord>[] = [
  { key: 'employeeId', header: 'Emp ID', width: '90px' },
  { key: 'employeeName', header: 'Name' },
  {
    key: 'checkIn',
    header: 'Check In',
    render: (row) => (
      <span className="tabular-nums">{formatTime(row.checkIn)}</span>
    ),
  },
  {
    key: 'checkOut',
    header: 'Check Out',
    render: (row) => (
      <span className="tabular-nums">{formatTime(row.checkOut)}</span>
    ),
  },
  {
    key: 'hoursWorked',
    header: 'Hours',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums">
        {row.hoursWorked > 0 ? row.hoursWorked.toFixed(1) : '—'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    api
      .getAttendance(date)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [date]);

  // Summary counts
  const summary = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    key,
    label,
    count: records.filter((r) => r.status === key).length,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--slate)]">
        Loading attendance…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--ink)]">Attendance</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-[var(--line)] rounded bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Summary bar */}
      <div className="flex gap-3">
        {summary.map((s) => (
          <div
            key={s.key}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-[var(--line)] rounded"
          >
            <StatusBadge status={s.key} />
            <span className="text-sm font-medium text-[var(--ink)] tabular-nums">
              {s.count}
            </span>
          </div>
        ))}
      </div>

      {/* Table */}
      <DataTable<AttendanceRecord>
        columns={columns}
        data={records}
        rowKey={(row) => row.id}
        searchFields={['employeeName', 'employeeId']}
        pageSize={15}
      />
    </div>
  );
}
