/**
 * Dependency-free chart marks.
 *
 * These are plain CSS, deliberately: a stacked bar and a meter do not justify
 * a charting library, and keeping them here means the pages that only need a
 * progress bar never pull Recharts into their bundle. The plotted panels live
 * in `PayrollCharts.tsx` and are loaded on demand by the dashboard.
 */

/* ============================================================
   Attendance mix - part-to-whole across four states.

   The four hues were run through a colourblind-safety validator in this exact
   order (lightness band, chroma floor, adjacent-pair CVD separation and
   contrast all pass). Each segment is ALSO labelled below the bar, so identity
   never depends on colour alone.
   ============================================================ */

const ATTENDANCE_SERIES = [
  { key: 'present', label: 'Present', color: '#12A67F' },
  { key: 'late', label: 'Late', color: '#C2760A' },
  { key: 'halfDay', label: 'Half day', color: '#7C4DDB' },
  { key: 'absent', label: 'Absent', color: '#E0335C' },
] as const;

export function AttendanceMix({
  counts,
}: {
  counts: { present: number; late: number; halfDay: number; absent: number };
}) {
  const total = ATTENDANCE_SERIES.reduce((sum, series) => sum + counts[series.key], 0);

  if (total === 0) {
    return (
      <p className="text-sm text-[var(--muted)] py-6 text-center">
        No attendance recorded for this period.
      </p>
    );
  }

  return (
    <div>
      {/* 2px surface gaps separate the segments - no borders drawn on marks. */}
      <div className="flex h-3 rounded-full overflow-hidden gap-[2px] bg-[var(--canvas)]">
        {ATTENDANCE_SERIES.map((series) =>
          counts[series.key] > 0 ? (
            <div
              key={series.key}
              style={{
                width: `${(counts[series.key] / total) * 100}%`,
                backgroundColor: series.color,
              }}
              title={`${series.label}: ${counts[series.key]}`}
            />
          ) : null,
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {ATTENDANCE_SERIES.map((series) => (
          <div key={series.key} className="flex items-start gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: series.color }}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {series.label}
              </p>
              <p className="text-[17px] font-bold text-[var(--ink)] tabular-nums leading-tight">
                {counts[series.key]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   A single fraction, where the number is the story.
   ============================================================ */

export function Meter({
  value,
  max,
  label,
  tone = '#2B50F5',
}: {
  value: number;
  max: number;
  label?: string;
  tone?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-[12px] mb-1.5">
          <span className="text-[var(--slate)] font-medium">{label}</span>
          <span className="font-bold text-[var(--ink)] tabular-nums">{pct}%</span>
        </div>
      )}
      <div
        className="h-2 rounded-full bg-[var(--canvas)] overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
      </div>
    </div>
  );
}
