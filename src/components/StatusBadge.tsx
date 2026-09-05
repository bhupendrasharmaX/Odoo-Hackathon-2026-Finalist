/**
 * PeoplePay360 — <StatusBadge>
 * Colour-codes every status enum in the system using the exact palette.
 */

type StatusValue =
  // Employee
  | 'active' | 'inactive' | 'terminated' | 'on_leave'
  // Payroll
  | 'draft' | 'pending' | 'approved' | 'paid' | 'rejected'
  // Attendance
  | 'present' | 'absent' | 'half_day' | 'leave' | 'holiday' | 'weekend'
  // Leave type
  | 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'unpaid'
  // Leave status
  | 'cancelled';

const STATUS_CONFIG: Record<string, { bg: string; text: string; label?: string }> = {
  // Positive / green
  active:    { bg: 'bg-emerald-50',  text: 'text-[var(--accent)]' },
  approved:  { bg: 'bg-emerald-50',  text: 'text-[var(--accent)]' },
  paid:      { bg: 'bg-emerald-50',  text: 'text-[var(--accent)]' },
  present:   { bg: 'bg-emerald-50',  text: 'text-[var(--accent)]' },

  // Warning / amber
  pending:   { bg: 'bg-amber-50',    text: 'text-[var(--warning)]' },
  on_leave:  { bg: 'bg-amber-50',    text: 'text-[var(--warning)]', label: 'On Leave' },
  half_day:  { bg: 'bg-amber-50',    text: 'text-[var(--warning)]', label: 'Half Day' },
  draft:     { bg: 'bg-amber-50',    text: 'text-[var(--warning)]' },

  // Danger / red
  rejected:  { bg: 'bg-red-50',      text: 'text-[var(--danger)]' },
  terminated:{ bg: 'bg-red-50',      text: 'text-[var(--danger)]' },
  absent:    { bg: 'bg-red-50',      text: 'text-[var(--danger)]' },
  cancelled: { bg: 'bg-red-50',      text: 'text-[var(--danger)]' },

  // Neutral / grey
  inactive:  { bg: 'bg-gray-100',    text: 'text-[var(--slate)]' },
  leave:     { bg: 'bg-gray-100',    text: 'text-[var(--slate)]' },
  holiday:   { bg: 'bg-blue-50',     text: 'text-blue-700' },
  weekend:   { bg: 'bg-gray-100',    text: 'text-[var(--slate)]' },

  // Leave types
  casual:    { bg: 'bg-blue-50',     text: 'text-blue-700' },
  sick:      { bg: 'bg-red-50',      text: 'text-[var(--danger)]' },
  earned:    { bg: 'bg-emerald-50',  text: 'text-[var(--accent)]' },
  maternity: { bg: 'bg-purple-50',   text: 'text-purple-700' },
  paternity: { bg: 'bg-purple-50',   text: 'text-purple-700' },
  unpaid:    { bg: 'bg-gray-100',    text: 'text-[var(--slate)]' },
};

export function StatusBadge({ status }: { status: StatusValue | string }) {
  const config = STATUS_CONFIG[status] || {
    bg: 'bg-gray-100',
    text: 'text-[var(--slate)]',
  };

  const label =
    config.label || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase ${config.bg} ${config.text}`}
    >
      {label}
    </span>
  );
}
