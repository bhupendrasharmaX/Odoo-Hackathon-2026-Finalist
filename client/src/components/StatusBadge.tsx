/**
 * PeoplePay360 — <StatusBadge>
 * Colour-codes every status enum in the system using the exact palette.
 * Rendered as a soft-tint pill, matching the reference design language.
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

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent' | 'purple';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  danger:  'bg-[var(--danger-soft)] text-[var(--danger)]',
  accent:  'bg-[var(--accent-soft)] text-[var(--accent)]',
  purple:  'bg-[var(--purple-soft)] text-[var(--purple)]',
  neutral: 'bg-[#EDF0F6] text-[var(--slate)]',
};

const STATUS_CONFIG: Record<string, { tone: Tone; label?: string }> = {
  // Positive
  active:    { tone: 'success' },
  approved:  { tone: 'success' },
  paid:      { tone: 'success' },
  present:   { tone: 'success' },

  // Warning
  pending:   { tone: 'warning' },
  on_leave:  { tone: 'warning', label: 'On Leave' },
  half_day:  { tone: 'warning', label: 'Half Day' },
  draft:     { tone: 'warning' },

  // Danger
  rejected:  { tone: 'danger' },
  terminated:{ tone: 'danger' },
  absent:    { tone: 'danger' },
  cancelled: { tone: 'danger' },

  // Neutral / informational
  inactive:  { tone: 'neutral' },
  leave:     { tone: 'neutral' },
  holiday:   { tone: 'accent' },
  weekend:   { tone: 'neutral' },

  // Leave types
  casual:    { tone: 'accent' },
  sick:      { tone: 'danger' },
  earned:    { tone: 'success' },
  maternity: { tone: 'purple' },
  paternity: { tone: 'purple' },
  unpaid:    { tone: 'neutral' },
};

export function StatusBadge({ status }: { status: StatusValue | string }) {
  const config = STATUS_CONFIG[status] || { tone: 'neutral' as Tone };

  const label =
    config.label || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap ${TONE_CLASS[config.tone]}`}
    >
      {label}
    </span>
  );
}
