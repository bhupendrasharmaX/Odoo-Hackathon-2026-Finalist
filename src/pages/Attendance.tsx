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
  { key: 'employeeId', header: 'Emp ID', width: '110px' },
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            Who clocked in, who didn&apos;t, and how the day added up.
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-auto tabular-nums"
        />
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {summary.map((s) => (
          <div key={s.key} className="card card-hover px-4 py-4">
            <StatusBadge status={s.key} />
            <p className="display-sm text-[var(--ink)] tabular-nums mt-3">
              {s.count}
            </p>
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
