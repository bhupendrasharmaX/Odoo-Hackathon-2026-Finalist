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
 * TODO: implement + unit test
 *   - single contract covering the whole period
 *   - no contract at all
 *   - mid-month contract change (two contracts, pro-rated)
 *   - open-ended contract (endDate === null)
 *   - contract ending exactly on periodStart (boundary - it DOES overlap)
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
}

export interface ResolutionResult<T extends ResolvableContract = ResolvableContract> {
  contracts: ResolvedContract<T>[];
  totalDaysInPeriod: number;
  /** True when more than one contract applies - triggers CONTRACT_CHANGED_MID_PERIOD. */
  changedMidPeriod: boolean;
}

export class NoContractForPeriodError extends AppError {
  constructor(employeeId: string) {
    super('CONFLICT', `No contract covers this period for employee ${employeeId}`, {
      domainCode: 'NO_CONTRACT_FOR_PERIOD',
      employeeId,
    });
    this.name = 'NoContractForPeriodError';
  }
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
  throw new Error('TODO: implement overlapsPeriod');
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
  throw new Error('TODO: implement resolveContractForPeriod');
}

/**
 * Called BEFORE creating or updating a contract. Throws CONFLICT when the new
 * range overlaps an existing RUNNING contract for the same employee.
 *
 * `excludeContractId` is the contract being edited, so it does not clash with
 * itself on update.
 */
export function validateNoOverlappingContracts(
  existing: readonly ResolvableContract[],
  startDate: Date,
  endDate: Date | null,
  excludeContractId?: string,
): void {
  throw new Error('TODO: implement validateNoOverlappingContracts');
}

/** Inclusive day count between two dates, ignoring time-of-day. */
export function countDaysInclusive(from: Date, to: Date): number {
  throw new Error('TODO: implement countDaysInclusive');
}
