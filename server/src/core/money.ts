import Decimal from 'decimal.js';

/**
 * All money arithmetic goes through here.
 *
 * Never use JavaScript numbers for currency. 51199.999999999996 on a payslip
 * is the kind of thing that gets noticed instantly, and it comes from exactly
 * one place: floating-point addition of percentages.
 *
 * Convention: 2 decimal places, ROUND_HALF_UP (standard commercial rounding).
 * Prisma stores these as Decimal(12, 2).
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal | number | string;

export const SCALE = 2;

export function money(value: MoneyInput = 0): Decimal {
  return new Decimal(value ?? 0);
}

/** Rounds to 2dp with commercial rounding. Apply once, at the boundary. */
export function round(value: MoneyInput): Decimal {
  return money(value).toDecimalPlaces(SCALE, Decimal.ROUND_HALF_UP);
}

export function add(...values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(money(value)), money(0));
}

export function subtract(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).minus(money(b));
}

export function multiply(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).times(money(b));
}

/** Guards against divide-by-zero, which shows up with a zero-day period. */
export function divide(a: MoneyInput, b: MoneyInput): Decimal {
  const divisor = money(b);
  if (divisor.isZero()) return money(0);
  return money(a).dividedBy(divisor);
}

/** `percent` is expressed as a percentage, i.e. 12 means 12%. */
export function percentOf(base: MoneyInput, percent: MoneyInput): Decimal {
  return multiply(base, divide(money(percent), 100));
}

export function isNegative(value: MoneyInput): boolean {
  return money(value).isNegative();
}

/**
 * Serialises for JSON. The contract shows plain numbers in payload examples,
 * so we emit numbers - safe here because every value is already rounded to 2dp
 * and well inside Number.MAX_SAFE_INTEGER for any realistic payroll.
 */
export function toNumber(value: MoneyInput): number {
  return round(value).toNumber();
}

export function toFixedString(value: MoneyInput): string {
  return round(value).toFixed(SCALE);
}
