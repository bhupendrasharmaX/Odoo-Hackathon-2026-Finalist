import { evaluate } from 'mathjs';

/**
 * Safe formula evaluation for salary rules.
 *
 * NEVER use eval() or new Function() here. A salary rule formula is data that
 * an HR user typed into a form; evaluating it as JavaScript is remote code
 * execution against the payroll server.
 *
 * Defence in depth, in this order:
 *
 *   1. TOKENISE against a whitelist grammar. Only numbers, identifiers and
 *      `+ - * / ( )` survive. `process.exit(1)`, `a.b`, `"str"` and every
 *      other construct is rejected before an evaluator ever sees the string -
 *      the dot and the comma are not in the grammar, so a member access or a
 *      call argument list cannot be spelled at all.
 *   2. PARSE the token stream ourselves (recursive descent) to confirm it is a
 *      well-formed arithmetic expression, and to reject unknown identifiers
 *      with a message naming the offender rather than a generic failure.
 *   3. EVALUATE with mathjs against a scope containing only resolved numbers.
 *      By this point mathjs is handed an expression already proven to be pure
 *      arithmetic over known symbols.
 *
 * Step 1 is the security boundary. Steps 2 and 3 are correctness and error
 * quality - so a mathjs regression could never become an RCE here.
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

// ---------------------------------------------------------------------
// 1. Tokeniser - the security boundary
// ---------------------------------------------------------------------

type TokenType = 'NUMBER' | 'IDENT' | 'OP' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

/** An identifier is A-Z, a-z, 0-9 and underscore, never starting with a digit. */
const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
const OPERATORS = new Set(['+', '-', '*', '/']);
const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

/**
 * Splits a formula into tokens, throwing on the first character that is not
 * part of the allowed grammar.
 *
 * Deliberately hand-written rather than a regex sweep: a regex that "finds the
 * good parts" silently ignores the bad ones, which is exactly the failure mode
 * that lets `process.exit(1)` through as the identifiers `process` and `exit`.
 * This walks every character and refuses to skip any.
 */
function tokenise(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  /** Past the end reads as '', which matches no rule and ends every loop. */
  const at = (index: number): string => formula[index] ?? '';

  while (i < formula.length) {
    const char = at(i);

    // Whitespace is the only thing that may be discarded.
    if (WHITESPACE.has(char)) {
      i += 1;
      continue;
    }

    if (DIGIT.test(char) || (char === '.' && DIGIT.test(at(i + 1)))) {
      let literal = '';
      let seenDot = false;
      while (i < formula.length) {
        const next = at(i);
        if (DIGIT.test(next)) {
          literal += next;
          i += 1;
        } else if (next === '.' && !seenDot) {
          seenDot = true;
          literal += next;
          i += 1;
        } else {
          break;
        }
      }
      tokens.push({ type: 'NUMBER', value: literal });
      continue;
    }

    if (IDENT_START.test(char)) {
      let ident = '';
      while (i < formula.length && IDENT_PART.test(at(i))) {
        ident += at(i);
        i += 1;
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    if (OPERATORS.has(char)) {
      tokens.push({ type: 'OP', value: char });
      i += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: char });
      i += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: char });
      i += 1;
      continue;
    }

    throw new FormulaError(
      `Illegal character ${JSON.stringify(char)} at position ${i}. A formula may only contain numbers, rule codes and + - * / ( )`,
      formula,
    );
  }

  if (tokens.length === 0) {
    throw new FormulaError('Formula is empty', formula);
  }

  return tokens;
}

// ---------------------------------------------------------------------
// 2. Parser - grammar check + identifier resolution
// ---------------------------------------------------------------------

/**
 * Grammar (standard precedence, left-associative):
 *
 *   expression := term (('+' | '-') term)*
 *   term       := unary (('*' | '/') unary)*
 *   unary      := ('-' | '+')? primary
 *   primary    := NUMBER | IDENT | '(' expression ')'
 *
 * Note there is no rule producing `IDENT '('` - a function call is not
 * expressible, which is what makes `exit(1)` a syntax error rather than
 * something we have to blacklist.
 */
function parseAndCheck(tokens: Token[], formula: string, known: Set<string>): void {
  let position = 0;

  const peek = (): Token | undefined => tokens[position];

  function expression(): void {
    term();
    let next = peek();
    while (next && next.type === 'OP' && (next.value === '+' || next.value === '-')) {
      position += 1;
      term();
      next = peek();
    }
  }

  function term(): void {
    unary();
    let next = peek();
    while (next && next.type === 'OP' && (next.value === '*' || next.value === '/')) {
      position += 1;
      unary();
      next = peek();
    }
  }

  function unary(): void {
    const token = peek();
    if (token && token.type === 'OP' && (token.value === '-' || token.value === '+')) {
      position += 1;
    }
    primary();
  }

  function primary(): void {
    const token = peek();

    if (!token) {
      throw new FormulaError('Unexpected end of formula - an operand is missing', formula);
    }

    if (token.type === 'NUMBER') {
      position += 1;
      return;
    }

    if (token.type === 'IDENT') {
      if (!known.has(token.value)) {
        throw new FormulaError(
          `Unknown identifier "${token.value}". A formula may reference an earlier rule code or one of ${BUILT_IN_IDENTIFIERS.join(', ')}`,
          formula,
        );
      }
      position += 1;
      // An identifier is a leaf. A '(' immediately after it would be a call,
      // which this grammar has no production for.
      if (peek()?.type === 'LPAREN') {
        throw new FormulaError(
          `Function calls are not allowed in a formula ("${token.value}(")`,
          formula,
        );
      }
      return;
    }

    if (token.type === 'LPAREN') {
      position += 1;
      expression();
      if (peek()?.type !== 'RPAREN') {
        throw new FormulaError('Unbalanced parentheses - a ")" is missing', formula);
      }
      position += 1;
      return;
    }

    throw new FormulaError(`Unexpected "${token.value}" in formula`, formula);
  }

  expression();

  const trailing = tokens[position];
  if (trailing) {
    throw new FormulaError(
      `Unexpected "${trailing.value}" after a complete expression`,
      formula,
    );
  }
}

// ---------------------------------------------------------------------
// 3. Public API
// ---------------------------------------------------------------------

/**
 * Evaluates `formula` against `scope` and returns a plain number.
 *
 * Rounding is the caller's job - do it once, on the final amount, via
 * core/money.ts.
 */
export function evaluateFormula(formula: string, scope: FormulaScope): number {
  if (typeof formula !== 'string' || formula.trim() === '') {
    throw new FormulaError('Formula is empty', String(formula));
  }

  const tokens = tokenise(formula);

  const known = new Set<string>([...BUILT_IN_IDENTIFIERS, ...Object.keys(scope)]);
  parseAndCheck(tokens, formula, known);

  // Every built-in must be present numerically even when the caller omitted
  // it, otherwise mathjs would throw on a symbol our own parser just accepted.
  const safeScope: Record<string, number> = {};
  for (const identifier of BUILT_IN_IDENTIFIERS) {
    safeScope[identifier] = 0;
  }
  for (const [key, value] of Object.entries(scope)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new FormulaError(`Value for "${key}" is not a finite number`, formula);
    }
    safeScope[key] = value;
  }

  let result: unknown;
  try {
    // Safe by construction: the string has been proven to be pure arithmetic
    // over the numeric symbols in safeScope. mathjs is the calculator here,
    // not the security boundary.
    result = evaluate(formula, { ...safeScope });
  } catch (error) {
    throw new FormulaError(
      `Could not evaluate formula: ${error instanceof Error ? error.message : String(error)}`,
      formula,
    );
  }

  if (typeof result !== 'number' || !Number.isFinite(result)) {
    // Division by zero lands here. Infinity or NaN must never reach a payslip.
    throw new FormulaError(
      'Formula did not produce a finite number (check for a division by zero)',
      formula,
    );
  }

  return result;
}

/**
 * Static check used at STRUCTURE SAVE TIME: returns the identifiers a formula
 * references, so we can reject one that points at a rule with a sequence >=
 * its own. Rejecting forward references at save time is what makes circular
 * references impossible to create in the first place.
 *
 * Built-ins are included in the result; callers filter them out, because at
 * save time "is this a known rule code" and "is this a built-in" are different
 * questions with different error messages.
 */
export function extractIdentifiers(formula: string): string[] {
  const tokens = tokenise(formula);
  const seen = new Set<string>();

  for (const token of tokens) {
    if (token.type === 'IDENT') {
      seen.add(token.value);
    }
  }

  return [...seen];
}

/** True when `identifier` is one of the always-available built-ins. */
export function isBuiltIn(identifier: string): boolean {
  return (BUILT_IN_IDENTIFIERS as readonly string[]).includes(identifier);
}
