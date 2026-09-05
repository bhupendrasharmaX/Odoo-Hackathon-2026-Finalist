/**
 * Date helpers for a payroll system.
 *
 * One rule runs through this file: a payroll DATE is a calendar day, not an
 * instant. `@db.Date` columns round-trip through UTC midnight, so every date
 * we construct is built with `Date.UTC`. Using `new Date("2026-08-01")` is
 * fine (it parses as UTC), but `new Date(2026, 7, 1)` is not - that is local
 * midnight, and in IST it lands on 2026-07-31T18:30:00Z, one day early.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" -> Date at UTC midnight. */
export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return atUtcMidnight(value);

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${value}"`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function atUtcMidnight(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}

/** Last instant of the given day, for a `checkIn <= end` style filter. */
export function endOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999),
  );
}

export function addDays(value: Date, days: number): Date {
  return new Date(atUtcMidnight(value).getTime() + days * MS_PER_DAY);
}

/** Inclusive day count, both endpoints counted. */
export function daysInclusive(from: Date, to: Date): number {
  const start = atUtcMidnight(from).getTime();
  const end = atUtcMidnight(to).getTime();
  if (end < start) return 0;
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/** "YYYY-MM" -> the first and last day of that month. */
export function monthBounds(period: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    throw new Error(`Expected a YYYY-MM period, got "${period}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return {
    start: new Date(Date.UTC(year, month, 1)),
    // Day 0 of the next month is the last day of this one.
    end: new Date(Date.UTC(year, month + 1, 0)),
  };
}

/** Date -> "YYYY-MM", the key the dashboard trend groups on. */
export function toPeriodKey(value: Date): string {
  return value.toISOString().slice(0, 7);
}

/** The N most recent "YYYY-MM" keys, oldest first, ending at `from`. */
export function recentPeriods(from: Date, count: number): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(
      toPeriodKey(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - offset, 1))),
    );
  }
  return keys;
}

/**
 * Working days in a period, Monday-Friday.
 *
 * Used as the payroll denominator when an employee has no attendance rows at
 * all - a salaried employee with a clean month should not be paid zero just
 * because nobody clocked them in. Attendance, when present, always wins.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  let cursor = atUtcMidnight(from);
  const end = atUtcMidnight(to);

  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  return count;
}

/** Hours between two instants, 2dp. */
export function hoursBetween(from: Date, to: Date): number {
  const hours = (to.getTime() - from.getTime()) / (60 * 60 * 1000);
  return Math.round(hours * 100) / 100;
}

/** "HH:MM:SS" -> minutes since midnight. */
export function timeToMinutes(value: string): number {
  const [h = '0', m = '0'] = value.split(':');
  return Number(h) * 60 + Number(m);
}
