import { humanise } from '../lib/format';

/**
 * Colour-codes every status enum the API emits. The keys are the exact
 * uppercase literals from the backend - nothing is lowercased on the way in,
 * so an unmapped value shows as neutral rather than silently disappearing.
 */

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent' | 'purple';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  purple: 'bg-[var(--purple-soft)] text-[var(--purple)]',
  neutral: 'bg-[#EDF0F6] text-[var(--slate)]',
};

const STATUS: Record<string, { tone: Tone; label?: string }> = {
  // Employee
  ACTIVE: { tone: 'success' },
  INACTIVE: { tone: 'neutral' },
  ARCHIVED: { tone: 'neutral' },

  // Employee type
  FULL_TIME: { tone: 'accent', label: 'Full time' },
  PART_TIME: { tone: 'purple', label: 'Part time' },
  CONTRACT: { tone: 'warning' },
  INTERN: { tone: 'neutral' },

  // Contract
  DRAFT: { tone: 'neutral' },
  RUNNING: { tone: 'success' },
  EXPIRED: { tone: 'warning' },
  CANCELLED: { tone: 'danger' },

  // Attendance
  PRESENT: { tone: 'success' },
  LATE: { tone: 'warning' },
  ABSENT: { tone: 'danger' },
  HALF_DAY: { tone: 'warning', label: 'Half day' },
  MISSING_CHECKOUT: { tone: 'danger', label: 'Missing checkout' },

  // Time off / allocations
  PENDING: { tone: 'warning' },
  APPROVED: { tone: 'success' },
  REFUSED: { tone: 'danger' },

  // Payroll
  COMPUTED: { tone: 'accent' },
  VALIDATED: { tone: 'purple' },
  PAID: { tone: 'success' },

  // Grievances
  OPEN: { tone: 'warning' },
  UNDER_REVIEW: { tone: 'accent', label: 'Under review' },
  RESOLVED: { tone: 'success' },
  REJECTED: { tone: 'danger' },

  // Warning severity
  HIGH: { tone: 'danger' },
  MEDIUM: { tone: 'warning' },
  LOW: { tone: 'neutral' },

  // Salary rule categories
  BASIC: { tone: 'accent' },
  ALLOWANCE: { tone: 'success' },
  GROSS: { tone: 'purple' },
  DEDUCTION: { tone: 'danger' },
  NET: { tone: 'accent' },

  // Roles
  EMPLOYEE: { tone: 'neutral' },
  HR_MANAGER: { tone: 'accent', label: 'HR Manager' },
  HR_PAYROLL_USER: { tone: 'purple', label: 'Payroll User' },
  HR_PAYROLL_MANAGER: { tone: 'success', label: 'Payroll Manager' },
  ADMIN: { tone: 'warning', label: 'Admin' },
};

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: string | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (!status) return <span className="text-[var(--muted)]">—</span>;

  const config = STATUS[status] ?? { tone: 'neutral' as Tone };
  const label = config.label ?? humanise(status);

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide uppercase whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      } ${TONE_CLASS[config.tone]}`}
    >
      {label}
    </span>
  );
}
