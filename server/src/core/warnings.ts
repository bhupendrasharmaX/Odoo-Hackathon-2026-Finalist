/**
 * Payslip warnings.
 *
 * Detected during compute and stored on `payslip.warnings` as a JSON array.
 * Severity drives the workflow: a payrun cannot be VALIDATED while any payslip
 * still carries an unresolved HIGH warning.
 */

export type WarningSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export type WarningCode =
  | 'MISSING_BANK'
  | 'DUPLICATE_PAYSLIP'
  | 'NO_CONTRACT_FOR_PERIOD'
  | 'CONTRACT_CHANGED_MID_PERIOD'
  | 'CONTRACT_EXPIRING_SOON'
  | 'NEGATIVE_NET'
  | 'ZERO_WORKED_DAYS';

export interface PayslipWarning {
  code: WarningCode;
  severity: WarningSeverity;
  message: string;
}

/** Single source of truth for severity - do not hardcode it at call sites. */
export const WARNING_CATALOG: Record<WarningCode, { severity: WarningSeverity; message: string }> =
  {
    MISSING_BANK: {
      severity: 'HIGH',
      message: 'Employee has no bank account on file',
    },
    DUPLICATE_PAYSLIP: {
      severity: 'HIGH',
      message: 'Another payslip already exists for this employee and period',
    },
    NO_CONTRACT_FOR_PERIOD: {
      severity: 'HIGH',
      message: 'No contract covers this payroll period',
    },
    CONTRACT_CHANGED_MID_PERIOD: {
      severity: 'MEDIUM',
      message: 'More than one contract applies to this period - amounts are pro-rated',
    },
    CONTRACT_EXPIRING_SOON: {
      severity: 'LOW',
      message: 'Contract ends within the next 30 days',
    },
    NEGATIVE_NET: {
      severity: 'HIGH',
      message: 'Deductions exceed gross pay - net is negative',
    },
    ZERO_WORKED_DAYS: {
      severity: 'MEDIUM',
      message: 'No attendance recorded in this period',
    },
  };

/** Builds a warning from the catalog, optionally overriding the message. */
export function warning(code: WarningCode, message?: string): PayslipWarning {
  const entry = WARNING_CATALOG[code];
  return { code, severity: entry.severity, message: message ?? entry.message };
}

export function hasBlockingWarning(warnings: readonly PayslipWarning[]): boolean {
  return warnings.some((item) => item.severity === 'HIGH');
}

export function bySeverity(warnings: readonly PayslipWarning[]): Record<WarningSeverity, PayslipWarning[]> {
  return {
    HIGH: warnings.filter((item) => item.severity === 'HIGH'),
    MEDIUM: warnings.filter((item) => item.severity === 'MEDIUM'),
    LOW: warnings.filter((item) => item.severity === 'LOW'),
  };
}
