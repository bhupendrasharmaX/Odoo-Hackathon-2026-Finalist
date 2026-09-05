import type Decimal from 'decimal.js';
import type { PayslipWarning } from './warnings';

/**
 * Salary rule engine - CRITICAL LOGIC #2.
 *
 * Pure: plain objects in, plain lines out. No Prisma type is imported here on
 * purpose - if the engine took a Prisma model it could not be tested without a
 * database, and this is the code that most needs tests.
 *
 * How it runs:
 *   1. Sort rules by ascending `sequence`.
 *   2. Evaluate each rule, writing its amount into a context map keyed by
 *      `rule.code`, so later rules can reference earlier ones.
 *   3. DEDUCTION rules are stored as NEGATIVE amounts, so summing every line
 *      gives the correct running total.
 *
 * TODO: implement + unit test
 *   - FIXED / PERCENTAGE / FORMULA each in isolation
 *   - PERCENTAGE with baseRuleCode null falls back to contract.wage
 *   - a DEDUCTION lands negative on the payslip line
 *   - gross / totalDeductions / net add up
 *   - two contracts in the period pro-rate and sum, with a
 *     CONTRACT_CHANGED_MID_PERIOD warning attached
 *   - the seeded "Regular Salary" structure reproduces the numbers in the
 *     shared contract exactly (BASIC 40000, HRA 16000, GROSS 56000,
 *     PF -4800, NET 51200)
 */

export type RuleCategory = 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET';
export type ComputeType = 'FIXED' | 'PERCENTAGE' | 'FORMULA';

export interface EngineRule {
  code: string;
  name: string;
  category: RuleCategory;
  sequence: number;
  computeType: ComputeType;
  /** FIXED only. */
  amount?: number | string | null;
  /** PERCENTAGE only, expressed as a percentage (12 means 12%). */
  percentage?: number | string | null;
  /** FORMULA only, e.g. "GROSS - PF". */
  formula?: string | null;
  /** PERCENTAGE only. Null means "percentage of contract.wage". */
  baseRuleCode?: string | null;
}

export interface EngineContract {
  id: string;
  wage: number | string;
  /** Share of the period this contract covers - 1 when it covers all of it. */
  proRataFactor: number;
}

export interface ComputeInput {
  contracts: EngineContract[];
  rules: EngineRule[];
  workedDays: number;
  totalDays: number;
  unpaidLeaveDays: number;
}

export interface ComputedLine {
  ruleCode: string;
  ruleName: string;
  category: RuleCategory;
  sequence: number;
  /** Negative for DEDUCTION lines. */
  amount: Decimal;
}

export interface ComputeResult {
  lines: ComputedLine[];
  gross: Decimal;
  totalDeductions: Decimal;
  net: Decimal;
  warnings: PayslipWarning[];
}

/**
 * Runs every rule in sequence order and returns the payslip lines plus the
 * gross / totalDeductions / net summary.
 *
 * With more than one contract in `contracts`, each rule is evaluated per
 * contract, multiplied by that contract's proRataFactor, and summed - then
 * CONTRACT_CHANGED_MID_PERIOD is added to the warnings.
 */
export function computePayslip(input: ComputeInput): ComputeResult {
  throw new Error('TODO: implement computePayslip');
}

/**
 * Structure-save-time validation, kept next to the engine so the two never
 * drift apart. Throws when:
 *   - a rule code is duplicated within the structure
 *   - a formula or baseRuleCode references a rule whose sequence is >= its own
 *
 * Enforcing this on save is what makes a circular reference unconstructible,
 * rather than something the engine has to survive at compute time.
 */
export function validateRuleSet(rules: readonly EngineRule[]): void {
  throw new Error('TODO: implement validateRuleSet');
}
