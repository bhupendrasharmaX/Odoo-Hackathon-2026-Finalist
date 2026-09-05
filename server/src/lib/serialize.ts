/**
 * Serialisers to the payload shapes locked in 00_SHARED_CONTRACT.md.
 *
 * The frontend builds directly against these keys, so this file is the single
 * place a response shape is decided. A route handler never hands a raw Prisma
 * row to `sendData` - Prisma returns Decimal objects and Date objects, which
 * JSON.stringify renders as `{"s":1,"e":4,"d":[40000]}` and a full ISO
 * timestamp respectively. Neither is what the contract promises.
 *
 * Two conversions matter:
 *   Decimal -> number   money is emitted as a plain number, already 2dp
 *   Date    -> "YYYY-MM-DD" for @db.Date fields, ISO instant for timestamps
 */

import type { PayslipWarning } from '../core/warnings';

/** Anything Prisma might hand back for a Decimal column. */
type DecimalLike = { toNumber(): number } | number | string | null | undefined;

/** Prisma Decimal -> plain number. Null becomes 0, never null-in-arithmetic. */
export function num(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value.toNumber();
}

/** Same, but preserves null - for genuinely optional numbers. */
export function numOrNull(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  return num(value);
}

/**
 * A `@db.Date` column -> "YYYY-MM-DD".
 *
 * Read in UTC deliberately. Prisma hands back a Date pinned to UTC midnight;
 * formatting it in the server's local timezone would render 2026-08-01 as
 * "2026-07-31" anywhere west of Greenwich.
 */
export function dateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

/** A timestamp column -> full ISO instant. */
export function instant(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

/** Prisma `Json` warnings column -> a typed array, tolerating null/garbage. */
export function warningsOf(value: unknown): PayslipWarning[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is PayslipWarning =>
      typeof item === 'object' && item !== null && 'code' in item && 'severity' in item,
  );
}

// ---------------------------------------------------------------------
// Locked shapes
// ---------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Employee, exactly as locked. `departmentName` and `managerName` are
 * flattened from relations so the frontend never has to join client-side.
 * Include `department` and `manager` in the query that feeds this.
 */
export function toEmployee(row: any) {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    departmentId: row.departmentId,
    departmentName: row.department?.name ?? null,
    jobPosition: row.jobPosition ?? null,
    managerId: row.managerId ?? null,
    managerName: row.manager?.name ?? null,
    workingScheduleId: row.workingScheduleId ?? null,
    employeeType: row.employeeType,
    status: row.status,
    bankAccount: row.bankAccount ?? null,
    avatarUrl: row.avatarUrl ?? null,
  };
}

export function toDepartment(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    headcount: row._count?.employees ?? undefined,
  };
}

export function toContract(row: any) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    startDate: dateOnly(row.startDate),
    endDate: dateOnly(row.endDate),
    wage: num(row.wage),
    jobPosition: row.jobPosition ?? null,
    departmentId: row.departmentId,
    departmentName: row.department?.name ?? null,
    workingScheduleId: row.workingScheduleId ?? null,
    workingScheduleName: row.workingSchedule?.name ?? null,
    salaryStructureId: row.salaryStructureId ?? null,
    salaryStructureName: row.salaryStructure?.name ?? null,
    status: row.status,
  };
}

export function toScheduleLine(row: any) {
  return {
    id: row.id,
    workingScheduleId: row.workingScheduleId,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes,
  };
}

/**
 * Weekly hours are DERIVED from the lines, never stored - a stored total
 * silently goes stale the moment someone edits a line.
 */
export function weeklyHours(lines: Array<{ startTime: string; endTime: string; breakMinutes: number }>): number {
  const total = lines.reduce((sum, line) => {
    const minutes = minutesBetween(line.startTime, line.endTime) - (line.breakMinutes ?? 0);
    return sum + Math.max(minutes, 0);
  }, 0);
  return Math.round((total / 60) * 100) / 100;
}

/** "HH:MM:SS" difference in minutes. Wall clock, no dates, no timezone. */
function minutesBetween(start: string, end: string): number {
  const toMinutes = (value: string): number => {
    const [h = '0', m = '0'] = value.split(':');
    return Number(h) * 60 + Number(m);
  };
  return toMinutes(end) - toMinutes(start);
}

export function toSchedule(row: any) {
  const lines = (row.lines ?? []).map(toScheduleLine);
  return {
    id: row.id,
    name: row.name,
    lines,
    weeklyHours: weeklyHours(row.lines ?? []),
    employeeCount: row._count?.employees ?? undefined,
  };
}

export function toAttendance(row: any) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    checkIn: instant(row.checkIn),
    checkOut: instant(row.checkOut),
    workedHours: num(row.workedHours),
    overtimeHours: num(row.overtimeHours),
    status: row.status,
    notes: row.notes ?? null,
    isManuallyEdited: row.isManuallyEdited,
  };
}

export function toTimeOffType(row: any) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    requiresAllocation: row.requiresAllocation,
    isPaid: row.isPaid,
    color: row.color ?? null,
  };
}

export function toAllocation(row: any) {
  const allocated = num(row.allocatedDays);
  const used = num(row.usedDays);
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    timeOffTypeId: row.timeOffTypeId,
    timeOffTypeName: row.timeOffType?.name ?? null,
    allocatedDays: allocated,
    usedDays: used,
    // Derived, never stored twice.
    remainingDays: Math.round((allocated - used) * 100) / 100,
    validFrom: dateOnly(row.validFrom),
    validTo: dateOnly(row.validTo),
    status: row.status,
  };
}

export function toTimeOffRequest(row: any) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    timeOffTypeId: row.timeOffTypeId,
    timeOffTypeName: row.timeOffType?.name ?? null,
    allocationId: row.allocationId ?? null,
    dateFrom: dateOnly(row.dateFrom),
    dateTo: dateOnly(row.dateTo),
    durationDays: num(row.durationDays),
    status: row.status,
    reason: row.reason ?? null,
    approvedById: row.approvedById ?? null,
    approvedByName: row.approvedBy?.name ?? null,
    approvedAt: instant(row.approvedAt),
  };
}

export function toSalaryRule(row: any) {
  return {
    id: row.id,
    structureId: row.structureId,
    name: row.name,
    code: row.code,
    category: row.category,
    sequence: row.sequence,
    computeType: row.computeType,
    amount: numOrNull(row.amount),
    percentage: numOrNull(row.percentage),
    formula: row.formula ?? null,
    baseRuleCode: row.baseRuleCode ?? null,
  };
}

export function toSalaryStructure(row: any) {
  return {
    id: row.id,
    name: row.name,
    rules: (row.rules ?? []).map(toSalaryRule),
    ruleCount: row._count?.rules ?? (row.rules ? row.rules.length : undefined),
  };
}

export function toPayslipLine(row: any) {
  return {
    ruleCode: row.ruleCode,
    ruleName: row.ruleName,
    category: row.category,
    sequence: row.sequence,
    amount: num(row.amount),
  };
}

/**
 * Payslip, exactly as locked. `structureId` comes from the parent payrun -
 * include `payrun` in the query, or pass `structureIdFallback`.
 */
export function toPayslip(row: any, structureIdFallback?: string | null) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    employeeCode: row.employee?.employeeCode ?? null,
    payrunId: row.payrunId,
    payrunName: row.payrun?.name ?? null,
    structureId: row.payrun?.salaryStructureId ?? structureIdFallback ?? null,
    periodStart: dateOnly(row.periodStart),
    periodEnd: dateOnly(row.periodEnd),
    contractId: row.contractId,
    workedDays: num(row.workedDays),
    status: row.status,
    lines: (row.lines ?? []).map(toPayslipLine),
    gross: num(row.gross),
    totalDeductions: num(row.totalDeductions),
    net: num(row.net),
    warnings: warningsOf(row.warnings),
  };
}

export function toPayrun(row: any) {
  const payslips = row.payslips ?? [];
  return {
    id: row.id,
    name: row.name,
    salaryStructureId: row.salaryStructureId,
    salaryStructureName: row.salaryStructure?.name ?? null,
    periodStart: dateOnly(row.periodStart),
    periodEnd: dateOnly(row.periodEnd),
    status: row.status,
    createdById: row.createdById,
    createdByName: row.createdBy?.name ?? null,
    createdAt: instant(row.createdAt),
    payslipCount: row._count?.payslips ?? payslips.length,
    totalNet: payslips.reduce((sum: number, slip: any) => sum + num(slip.net), 0),
    totalGross: payslips.reduce((sum: number, slip: any) => sum + num(slip.gross), 0),
  };
}

export function toGrievance(row: any) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    payslipId: row.payslipId ?? null,
    subject: row.subject,
    description: row.description,
    status: row.status,
    response: row.response ?? null,
    resolvedById: row.resolvedById ?? null,
    resolvedByName: row.resolvedBy?.name ?? null,
    resolvedAt: instant(row.resolvedAt),
    createdAt: instant(row.createdAt),
  };
}

export function toUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    employeeId: row.employeeId ?? null,
    employeeName: row.employee?.name ?? null,
    createdAt: instant(row.createdAt),
  };
}
