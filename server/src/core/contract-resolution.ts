import { AppError } from '../http/errors';

/**
 * Period contract resolution - CRITICAL LOGIC #1.
 *
 * Pure functions over plain objects: no Prisma, no Express, no dates pulled
 * from anywhere but the arguments. That is deliberate - it means this can be
 * unit-tested exhaustively before the database exists, and it is the code a
 * judge will ask about ("this employee got a raise on the 16th - show me that
 * payslip").
 *
 * Every comparison happens at DAY granularity. Contract dates are stored as
 * `@db.Date`, which Prisma hands back as a Date at UTC midnight; comparing
 * those against a period boundary that carries a time-of-day would make a
 * contract starting on the 16th look like it starts partway through the 16th.
 * `atUtcMidnight` normalises both sides so the boundary cases below are exact.
 */

/** The minimum a contract needs to look like for resolution purposes. */
export interface ResolvableContract {
  id: string;
  employeeId: string;
  startDate: Date;
  /** Null means open-ended: the contract is still running. */
  endDate: Date | null;
  status: string;
}

export interface ResolvedContract<T extends ResolvableContract = ResolvableContract> {
  contract: T;
  /** Calendar days of the period this contract actually covers. */
  daysCovered: number;
  /** daysCovered / totalDaysInPeriod - the pro-ration factor. */
  proRataFactor: number;
  /** First day of the period this contract covers. */
  coversFrom: Date;
  /** Last day of the period this contract covers. */
  coversTo: Date;
}

export interface ResolutionResult<T extends ResolvableContract = ResolvableContract> {
  contracts: ResolvedContract<T>[];
  totalDaysInPeriod: number;
  /** True when more than one contract applies - triggers CONTRACT_CHANGED_MID_PERIOD. */
  changedMidPeriod: boolean;
}

/**
 * Which contract statuses payroll will pay against.
 *
 * EXPIRED is deliberately included: a contract that ended on 15-Aug is expired
 * *today* but was in force for the first half of an August payrun, and that is
 * precisely the mid-period-change case. DRAFT (not yet agreed) and CANCELLED
 * (never took effect) are excluded - neither ever entitled anyone to pay.
 */
export const PAYABLE_CONTRACT_STATUSES: readonly string[] = ['RUNNING', 'EXPIRED'];

/** Statuses that block a new overlapping contract from being created. */
export const BLOCKING_CONTRACT_STATUSES: readonly string[] = ['RUNNING'];

export class NoContractForPeriodError extends AppError {
  constructor(employeeId: string) {
    super('CONFLICT', `No contract covers this period for employee ${employeeId}`, {
      domainCode: 'NO_CONTRACT_FOR_PERIOD',
      employeeId,
    });
    this.name = 'NoContractForPeriodError';
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Strips the time of day, pinning a date to UTC midnight.
 *
 * Everything here compares calendar days, never instants. Without this a
 * period end of "2026-08-31T00:00:00Z" would exclude a contract starting
 * "2026-08-31T09:00:00Z", which is the same day.
 */
function atUtcMidnight(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}

/** Inclusive day count between two dates, ignoring time-of-day. */
export function countDaysInclusive(from: Date, to: Date): number {
  const start = atUtcMidnight(from).getTime();
  const end = atUtcMidnight(to).getTime();

  if (end < start) return 0;

  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/**
 * Overlap test, extracted so the rule lives in exactly one place:
 *
 *   contract.startDate <= periodEnd AND
 *   (contract.endDate IS NULL OR contract.endDate >= periodStart)
 *
 * Both bounds are INCLUSIVE. A contract ending on the first day of the period
 * still covers that one day.
 */
export function overlapsPeriod(
  contract: Pick<ResolvableContract, 'startDate' | 'endDate'>,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  const start = atUtcMidnight(contract.startDate).getTime();
  const periodFrom = atUtcMidnight(periodStart).getTime();
  const periodTo = atUtcMidnight(periodEnd).getTime();

  if (start > periodTo) return false;

  // Open-ended: nothing can end before the period starts.
  if (contract.endDate === null || contract.endDate === undefined) return true;

  return atUtcMidnight(contract.endDate).getTime() >= periodFrom;
}

/**
 * Returns EVERY contract that overlaps the period, each with the number of
 * calendar days it covers, so payroll can pro-rate.
 *
 * Never silently picks the latest one - a mid-period change must stay visible
 * all the way to the payslip.
 *
 * Throws NoContractForPeriodError when nothing matches.
 */
export function resolveContractForPeriod<T extends ResolvableContract>(
  contracts: readonly T[],
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): ResolutionResult<T> {
  const from = atUtcMidnight(periodStart);
  const to = atUtcMidnight(periodEnd);

  if (to.getTime() < from.getTime()) {
    throw new AppError('VALIDATION_ERROR', 'Period end must not be before period start');
  }

  const totalDaysInPeriod = countDaysInclusive(from, to);

  const applicable = contracts.filter(
    (contract) =>
      contract.employeeId === employeeId &&
      PAYABLE_CONTRACT_STATUSES.includes(contract.status) &&
      overlapsPeriod(contract, from, to),
  );

  if (applicable.length === 0) {
    throw new NoContractForPeriodError(employeeId);
  }

  const resolved: ResolvedContract<T>[] = applicable
    .map((contract) => {
      // Clamp the contract's own range to the period on both sides.
      const contractStart = atUtcMidnight(contract.startDate);
      const coversFrom = contractStart.getTime() > from.getTime() ? contractStart : from;

      const contractEnd = contract.endDate ? atUtcMidnight(contract.endDate) : null;
      const coversTo = contractEnd && contractEnd.getTime() < to.getTime() ? contractEnd : to;

      const daysCovered = countDaysInclusive(coversFrom, coversTo);

      return {
        contract,
        daysCovered,
        proRataFactor: totalDaysInPeriod === 0 ? 0 : daysCovered / totalDaysInPeriod,
        coversFrom,
        coversTo,
      };
    })
    .sort((a, b) => a.coversFrom.getTime() - b.coversFrom.getTime());

  return {
    contracts: resolved,
    totalDaysInPeriod,
    changedMidPeriod: resolved.length > 1,
  };
}

/**
 * Called BEFORE creating or updating a contract. Throws CONFLICT when the new
 * range overlaps an existing RUNNING contract for the same employee.
 *
 * `excludeContractId` is the contract being edited, so it does not clash with
 * itself on update.
 *
 * Note this only guards against RUNNING contracts. An EXPIRED one is history -
 * backdating a correction alongside it is legitimate, and blocking that would
 * make the mid-period-change case impossible to set up in the first place.
 */
export function validateNoOverlappingContracts(
  existing: readonly ResolvableContract[],
  startDate: Date,
  endDate: Date | null,
  excludeContractId?: string,
): void {
  const newStart = atUtcMidnight(startDate);
  const newEnd = endDate ? atUtcMidnight(endDate) : null;

  if (newEnd && newEnd.getTime() < newStart.getTime()) {
    throw new AppError('VALIDATION_ERROR', 'Contract end date must not be before its start date');
  }

  const clash = existing.find((contract) => {
    if (excludeContractId && contract.id === excludeContractId) return false;
    if (!BLOCKING_CONTRACT_STATUSES.includes(contract.status)) return false;

    // Two ranges overlap when each starts on or before the other one ends.
    // A null end date is treated as +infinity.
    const otherStart = atUtcMidnight(contract.startDate).getTime();
    const otherEnd = contract.endDate ? atUtcMidnight(contract.endDate).getTime() : null;

    const newStartsBeforeOtherEnds = otherEnd === null || newStart.getTime() <= otherEnd;
    const otherStartsBeforeNewEnds = newEnd === null || otherStart <= newEnd.getTime();

    return newStartsBeforeOtherEnds && otherStartsBeforeNewEnds;
  });

  if (clash) {
    throw new AppError(
      'CONFLICT',
      `This date range overlaps an existing running contract (${clash.id}). End that contract first, or choose a different start date.`,
      { conflictingContractId: clash.id },
    );
  }
}
