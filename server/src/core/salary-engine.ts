import Decimal from 'decimal.js';
import { evaluateFormula, extractIdentifiers, isBuiltIn, type FormulaScope } from './formula';
import { add, money, multiply, percentOf, round, toNumber } from './money';
import { warning, type PayslipWarning } from './warnings';
import { AppError } from '../http/errors';

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
 * THE SIGN CONVENTION, because it is subtle and everything depends on it:
 *
 *   The CONTEXT holds the magnitude a rule computed - PF is 4800 there.
 *   The LINE holds the signed amount - the PF line is -4800.
 *
 * That split is what makes `NET = GROSS - PF` read the way an HR user wrote
 * it (56000 - 4800 = 51200) while the payslip lines still sum to net. If the
 * context held -4800, that same formula would evaluate to 60800 and quietly
 * pay the deduction out instead of taking it.
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

/** Categories that make up gross pay when no explicit GROSS rule exists. */
const EARNING_CATEGORIES: readonly RuleCategory[] = ['BASIC', 'ALLOWANCE'];

function sortedBySequence(rules: readonly EngineRule[]): EngineRule[] {
  return [...rules].sort((a, b) => a.sequence - b.sequence);
}

/**
 * Runs the whole rule set against ONE contract and returns the magnitude each
 * rule produced, keyed by code.
 *
 * Unrounded on purpose: rounding happens once, after pro-rated contributions
 * from every contract have been summed. Rounding here and again at the end
 * would round twice on a mid-period change and drift by a rupee.
 */
function runRulesForContract(
  rules: readonly EngineRule[],
  contract: EngineContract,
  workedDays: number,
  totalDays: number,
  unpaidLeaveDays: number,
): Map<string, Decimal> {
  const context = new Map<string, Decimal>();
  const wage = money(contract.wage);

  for (const rule of rules) {
    let value: Decimal;

    switch (rule.computeType) {
      case 'FIXED': {
        value = money(rule.amount ?? 0);
        break;
      }

      case 'PERCENTAGE': {
        // A null baseRuleCode means "percentage of the contract wage".
        const base = rule.baseRuleCode ? context.get(rule.baseRuleCode) : wage;

        if (base === undefined) {
          throw new AppError(
            'VALIDATION_ERROR',
            `Rule ${rule.code} is a percentage of "${rule.baseRuleCode}", which has not been computed yet. A base rule must have a lower sequence number.`,
          );
        }

        value = percentOf(base, money(rule.percentage ?? 0));
        break;
      }

      case 'FORMULA': {
        if (!rule.formula) {
          throw new AppError(
            'VALIDATION_ERROR',
            `Rule ${rule.code} is a FORMULA rule but has no formula`,
          );
        }

        // The scope is numbers, not Decimals - the formula evaluator is a
        // calculator over plain floats. Values re-enter Decimal immediately
        // after, and the final rounding pass keeps the result exact to 2dp.
        const scope: FormulaScope = {
          WAGE: wage.toNumber(),
          WORKED_DAYS: workedDays,
          TOTAL_DAYS: totalDays,
          UNPAID_DAYS: unpaidLeaveDays,
        };
        for (const [code, amount] of context) {
          scope[code] = amount.toNumber();
        }

        value = money(evaluateFormula(rule.formula, scope));
        break;
      }

      default: {
        throw new AppError(
          'VALIDATION_ERROR',
          `Rule ${rule.code} has an unknown compute type "${String(rule.computeType)}"`,
        );
      }
    }

    context.set(rule.code, value);
  }

  return context;
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
  const { contracts, workedDays, totalDays, unpaidLeaveDays } = input;
  const rules = sortedBySequence(input.rules);
  const warnings: PayslipWarning[] = [];

  if (contracts.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Cannot compute a payslip with no contract');
  }

  if (rules.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'The salary structure has no rules - nothing to compute',
    );
  }

  // Accumulate each rule code's pro-rated total across every applicable
  // contract. With a single contract the factor is 1 and this is a plain pass.
  const totals = new Map<string, Decimal>();

  for (const contract of contracts) {
    const context = runRulesForContract(
      rules,
      contract,
      workedDays,
      totalDays,
      unpaidLeaveDays,
    );

    for (const rule of rules) {
      const raw = context.get(rule.code) ?? money(0);
      const share = multiply(raw, contract.proRataFactor);
      totals.set(rule.code, add(totals.get(rule.code) ?? money(0), share));
    }
  }

  if (contracts.length > 1) {
    warnings.push(warning('CONTRACT_CHANGED_MID_PERIOD'));
  }

  // Round once, here, at the boundary between arithmetic and storage.
  const lines: ComputedLine[] = rules.map((rule) => {
    const magnitude = round(totals.get(rule.code) ?? money(0));
    return {
      ruleCode: rule.code,
      ruleName: rule.name,
      category: rule.category,
      sequence: rule.sequence,
      // Sign convention: the LINE is signed, the context was not.
      amount: rule.category === 'DEDUCTION' ? magnitude.negated() : magnitude,
    };
  });

  // Prefer an explicit GROSS / NET rule - that is the number the structure
  // author intended. Fall back to summing categories when the structure has
  // no such rule, so a minimal structure still produces a coherent payslip.
  const grossLine = lines.find((line) => line.category === 'GROSS');
  const netLine = lines.find((line) => line.category === 'NET');

  const totalDeductions = round(
    lines
      .filter((line) => line.category === 'DEDUCTION')
      .reduce<Decimal>((sum, line) => add(sum, line.amount.abs()), money(0)),
  );

  const gross = grossLine
    ? round(grossLine.amount)
    : round(
        lines
          .filter((line) => EARNING_CATEGORIES.includes(line.category))
          .reduce<Decimal>((sum, line) => add(sum, line.amount), money(0)),
      );

  const net = netLine ? round(netLine.amount) : round(gross.minus(totalDeductions));

  if (net.isNegative()) {
    warnings.push(warning('NEGATIVE_NET'));
  }

  if (workedDays <= 0) {
    warnings.push(warning('ZERO_WORKED_DAYS'));
  }

  return { lines, gross, totalDeductions, net, warnings };
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
  const ordered = sortedBySequence(rules);

  // ---- duplicate codes ----------------------------------------------
  const seen = new Set<string>();
  for (const rule of ordered) {
    if (!rule.code || !rule.code.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Every salary rule needs a code');
    }
    if (seen.has(rule.code)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Duplicate rule code "${rule.code}" in this structure. Codes must be unique - they are how formulas refer to each other.`,
      );
    }
    seen.add(rule.code);
  }

  // Lowest sequence each code appears at, so a reference can be checked
  // against it without scanning the list again per rule.
  const sequenceByCode = new Map<string, number>();
  for (const rule of ordered) {
    sequenceByCode.set(rule.code, rule.sequence);
  }

  // ---- per-rule shape + forward references ---------------------------
  for (const rule of ordered) {
    const referenceMustPrecede = (identifier: string, what: string): void => {
      if (isBuiltIn(identifier)) return;

      const target = sequenceByCode.get(identifier);

      if (target === undefined) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Rule ${rule.code}: ${what} refers to "${identifier}", which is not a rule in this structure.`,
        );
      }

      if (target >= rule.sequence) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Rule ${rule.code} (sequence ${rule.sequence}): ${what} refers to "${identifier}" at sequence ${target}. A rule may only reference rules with a LOWER sequence - this is what makes a circular reference impossible.`,
        );
      }
    };

    switch (rule.computeType) {
      case 'FIXED': {
        if (rule.amount === null || rule.amount === undefined || rule.amount === '') {
          throw new AppError(
            'VALIDATION_ERROR',
            `Rule ${rule.code} is FIXED and needs an amount`,
          );
        }
        break;
      }

      case 'PERCENTAGE': {
        if (rule.percentage === null || rule.percentage === undefined || rule.percentage === '') {
          throw new AppError(
            'VALIDATION_ERROR',
            `Rule ${rule.code} is PERCENTAGE and needs a percentage`,
          );
        }
        // A null baseRuleCode is legal - it means "of the contract wage".
        if (rule.baseRuleCode) {
          referenceMustPrecede(rule.baseRuleCode, 'its base rule');
        }
        break;
      }

      case 'FORMULA': {
        if (!rule.formula || !rule.formula.trim()) {
          throw new AppError(
            'VALIDATION_ERROR',
            `Rule ${rule.code} is FORMULA and needs a formula`,
          );
        }
        // Throws a FormulaError on illegal syntax before we look at ordering.
        for (const identifier of extractIdentifiers(rule.formula)) {
          referenceMustPrecede(identifier, 'its formula');
        }
        break;
      }

      default: {
        throw new AppError(
          'VALIDATION_ERROR',
          `Rule ${rule.code} has an unknown compute type "${String(rule.computeType)}"`,
        );
      }
    }
  }
}

/** Convenience for the API layer: lines with plain numbers instead of Decimals. */
export function linesToJson(
  lines: readonly ComputedLine[],
): Array<{
  ruleCode: string;
  ruleName: string;
  category: RuleCategory;
  sequence: number;
  amount: number;
}> {
  return lines.map((line) => ({
    ruleCode: line.ruleCode,
    ruleName: line.ruleName,
    category: line.category,
    sequence: line.sequence,
    amount: toNumber(line.amount),
  }));
}
