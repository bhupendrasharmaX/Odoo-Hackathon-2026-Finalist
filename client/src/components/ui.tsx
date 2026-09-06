import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Inbox,
  Loader2,
  X,
} from 'lucide-react';
import { initials as toInitials } from '../lib/format';

/* ============================================================
   Page scaffolding
   ============================================================ */

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3.5 min-w-0">
        {icon && <span className="icon-tile w-11 h-11 tile-blue mt-0.5">{icon}</span>}
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = 'p-5',
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div className="min-w-0">
            {title && <h2 className="card-title truncate">{title}</h2>}
            {description && (
              <p className="text-xs text-[var(--slate)] mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ============================================================
   States
   ============================================================ */

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="py-14 px-6 text-center">
      <span className="icon-tile w-12 h-12 tile-blue mx-auto">{icon ?? <Inbox size={22} />}</span>
      <p className="mt-4 text-[15px] font-semibold text-[var(--ink)]">{title}</p>
      {message && (
        <p className="mt-1.5 text-sm text-[var(--slate)] max-w-sm mx-auto leading-relaxed">
          {message}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-12 px-6 text-center">
      <span className="icon-tile w-12 h-12 tile-pink mx-auto">
        <AlertTriangle size={22} />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-[var(--ink)]">Could not load this</p>
      <p className="mt-1.5 text-sm text-[var(--slate)] max-w-md mx-auto">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm mt-5">
          Try again
        </button>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-[var(--slate)]">
      <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
      {label ?? 'Loading…'}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-5 space-y-3.5 animate-fade-in">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 skeleton"
              style={{
                flex: colIndex === 0 ? 2 : 1,
                animationDelay: `${(rowIndex * cols + colIndex) * 60}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a grid of KPI tiles, so the layout does not jump on load. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="h-3 w-24 skeleton" />
            <div className="w-9 h-9 skeleton rounded-[var(--r-md)]" />
          </div>
          <div className="h-7 w-32 skeleton mt-4" />
          <div className="h-3 w-40 skeleton mt-2.5" />
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Tones — the five tile tints, shared by chips, meters and KPI tiles
   ============================================================ */

export type Tone = 'blue' | 'green' | 'amber' | 'purple' | 'pink';

export const TONE_COLOR: Record<Tone, string> = {
  blue: '#2B50F5',
  green: '#12A67F',
  amber: '#C2760A',
  purple: '#7C4DDB',
  pink: '#E0335C',
};

/* ============================================================
   Buttons, chips, avatars
   ============================================================ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  success: 'btn-success-tonal',
  danger: 'btn-danger-tonal',
};

export function Button({
  variant = 'secondary',
  size,
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'xs';
  loading?: boolean;
  icon?: ReactNode;
}) {
  const sizeClass = size ? `btn-${size}` : '';
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`btn ${VARIANT_CLASS[variant]} ${sizeClass} ${className}`}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Avatar({
  name,
  src,
  size = 36,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        className="rounded-full object-cover flex-shrink-0 border border-[var(--line)]"
        style={{ width: size, height: size }}
      />
    );
  }

  // Deterministic tint per person, so the same face keeps the same colour.
  const palette = ['tile-blue', 'tile-green', 'tile-amber', 'tile-purple', 'tile-pink'];
  const seed = (name ?? '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return (
    <span
      className={`icon-tile rounded-full font-semibold flex-shrink-0 ${palette[seed % palette.length]}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {toInitials(name)}
    </span>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'purple';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-[#EDF0F6] text-[var(--slate)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    purple: 'bg-[var(--purple-soft)] text-[var(--purple)]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ============================================================
   Form controls
   ============================================================ */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-[var(--danger)] mt-1.5 font-medium">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--muted)] mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`input ${className}`} />;
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`input cursor-pointer ${className}`}>
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  rows = 4,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} rows={rows} className={`input h-auto py-2.5 leading-relaxed ${className}`} />;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm font-medium text-[var(--ink)]"
    >
      <span
        className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
          checked ? 'bg-[var(--accent)]' : 'bg-[#D3DBEC]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-all ${
            checked ? 'left-4.5' : 'left-0.5'
          }`}
        />
      </span>
      {label}
    </button>
  );
}

/* ============================================================
   Modal
   ============================================================ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-[#0B1424]/45 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${width} my-auto bg-white rounded-[var(--r-xl)] shadow-[var(--shadow-lg)] animate-scale-up`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <div className="min-w-0">
            <h3 className="text-[17px] font-bold tracking-tight text-[var(--ink)]">{title}</h3>
            {description && (
              <p className="text-[13px] text-[var(--slate)] mt-1 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--canvas)] p-1.5 -m-1 rounded-[var(--r-sm)] transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-[var(--line)] bg-[#FAFBFE] rounded-b-[var(--r-xl)] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--slate)] leading-relaxed">{message}</p>
    </Modal>
  );
}

/* ============================================================
   Filter bar
   ============================================================ */

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="card p-4 mb-5 flex flex-wrap items-end gap-3">{children}</div>
  );
}

/* ============================================================
   KPI tile
   ============================================================ */

export function KpiCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'blue',
  onClick,
  delta,
  progress,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: ReactNode;
  tone?: Tone;
  onClick?: () => void;
  /** Change against the comparable previous period, as a fraction (0.12 = +12%). */
  delta?: number | null;
  /** 0-1. Draws a meter under the figure, tinted to match the tile. */
  progress?: number | null;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`card card-hover p-5 text-left w-full ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <span className={`icon-tile w-9 h-9 tile-${tone}`}>{icon}</span>
      </div>

      <div className="flex items-baseline gap-2 mt-3 flex-wrap">
        <p className="display-sm tabular-nums truncate" title={value}>
          {value}
        </p>
        {delta != null && <Delta value={delta} />}
      </div>

      {progress != null && (
        <div className="meter mt-3">
          <div
            className="meter-fill"
            style={{
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              backgroundColor: TONE_COLOR[tone],
            }}
          />
        </div>
      )}

      {sublabel && <p className="text-xs text-[var(--slate)] mt-2">{sublabel}</p>}
    </Tag>
  );
}

/** The change against a previous period. Zero reads as flat, not as a rise. */
export function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const rounded = Math.round(value * 1000) / 10;
  if (rounded === 0) return <span className="delta delta-flat">no change</span>;

  const rising = rounded > 0;
  // On a cost or a grievance count, a rise is the bad direction.
  const good = invert ? !rising : rising;

  return (
    <span className={`delta ${good ? 'delta-up' : 'delta-down'}`}>
      {rising ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(rounded)}%
    </span>
  );
}

/** A labelled figure with an optional share meter — for stat strips under a chart. */
export function StatTile({
  label,
  value,
  hint,
  progress,
  tone = 'blue',
}: {
  label: string;
  value: string;
  hint?: string;
  progress?: number | null;
  tone?: Tone;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="text-[19px] font-bold text-[var(--ink)] tabular-nums mt-1 leading-tight">
        {value}
      </p>
      {progress != null && (
        <div className="meter mt-2">
          <div
            className="meter-fill"
            style={{
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              backgroundColor: TONE_COLOR[tone],
            }}
          />
        </div>
      )}
      {hint && <p className="text-[11.5px] text-[var(--muted)] mt-1.5">{hint}</p>}
    </div>
  );
}

/* ============================================================
   Segmented control
   ============================================================ */

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={`segment ${className}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`segment-item ${value === option.value ? 'segment-item-active' : ''}`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   Server-side pagination
   ============================================================ */

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (next: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--line)] text-xs text-[var(--slate)]">
      <span className="tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button size="xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="px-2 font-semibold text-[var(--ink)] tabular-nums">
          {page} / {pages}
        </span>
        <Button size="xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
