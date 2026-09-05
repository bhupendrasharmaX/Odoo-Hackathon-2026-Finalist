/**
 * Safe formula evaluation for salary rules.
 *
 * NEVER use eval() or new Function() here. A salary rule formula is data that
 * an HR user typed into a form; evaluating it as JavaScript is remote code
 * execution against the payroll server.
 *
 * Use mathjs `evaluate` with a restricted scope, or a small shunting-yard
 * parser. Allow only: + - * / ( ) numbers, and identifiers that resolve from
 * the supplied scope.
 *
 * TODO: implement + unit test
 *   - "GROSS - PF"           resolves both from the context map
 *   - "BASIC * 0.12"         identifier times literal
 *   - "WAGE * WORKED_DAYS / TOTAL_DAYS"  pro-ration
 *   - unknown identifier     -> throws, never silently 0
 *   - "process.exit(1)"      -> throws
 *   - division by zero       -> defined behaviour, not Infinity on a payslip
 */

/**
 * Values a formula may reference: every rule code computed so far, plus the
 * built-ins below.
 */
export interface FormulaScope {
  [ruleCode: string]: number;
}

/** Built-in identifiers always available to a formula, alongside rule codes. */
export const BUILT_IN_IDENTIFIERS = [
  'WAGE',
  'WORKED_DAYS',
  'TOTAL_DAYS',
  'UNPAID_DAYS',
] as const;

export class FormulaError extends Error {
  constructor(
    message: string,
    public readonly formula: string,
  ) {
    super(message);
    this.name = 'FormulaError';
  }
}

/**
 * Evaluates `formula` against `scope` and returns a plain number.
 *
 * Rounding is the caller's job - do it once, on the final amount, via
 * core/money.ts.
 */
export function evaluateFormula(formula: string, scope: FormulaScope): number {
  throw new Error('TODO: implement evaluateFormula');
}

/**
 * Static check used at STRUCTURE SAVE TIME: returns the identifiers a formula
 * references, so we can reject one that points at a rule with a sequence >=
 * its own. Rejecting forward references at save time is what makes circular
 * references impossible to create in the first place.
 */
export function extractIdentifiers(formula: string): string[] {
  throw new Error('TODO: implement extractIdentifiers');
}
