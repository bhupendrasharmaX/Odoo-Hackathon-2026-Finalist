import {
  NoContractForPeriodError,
  overlapsPeriod,
  PAYABLE_CONTRACT_STATUSES,
  resolveContractForPeriod,
} from '../../core/contract-resolution';
import { toNumber } from '../../core/money';
import { computePayslip, type EngineRule } from '../../core/salary-engine';
import { hasBlockingWarning, warning, type PayslipWarning } from '../../core/warnings';
import { conflict, notFound, validationError } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { addDays, businessDaysBetween, daysInclusive, endOfUtcDay, parseDateOnly } from '../../lib/dates';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { toPayrun, toPayslip } from '../../lib/serialize';
import { sendPayslipEmail } from './mailer';
import { renderPayslipPdf } from './pdf';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Payrun lifecycle: DRAFT -> COMPUTED -> VALIDATED -> PAID.
 *
 * Three rules run through this file:
 *
 *   COMPUTE IS IDEMPOTENT. Lines are deleted then re-inserted, never appended.
 *   Running compute twice produces identical output - judges click it twice.
 *
 *   VALIDATE IS GATED. A HIGH-severity warning on any payslip blocks the whole
 *   run with 409. That is what makes the seeded no-bank-account employee a
 *   demonstration rather than a claim.
 *
 *   PAID IS TERMINAL. After PAID nothing may mutate; every entry point calls
 *   `assertMutable` first.
 */

const PAYRUN_INCLUDE = {
  salaryStructure: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { payslips: true } },
} as const;

/** A contract ending within this many days of the period end is flagged. */
const EXPIRING_SOON_DAYS = 30;

// ---------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------

function assertMutable(payrun: { status: string; id: string }): void {
  if (payrun.status === 'PAID') {
    throw conflict('This payrun is PAID and is now read-only. Payroll history cannot be edited.');
  }
  if (payrun.status === 'CANCELLED') {
    throw conflict('This payrun was cancelled.');
  }
}

async function loadPayrun(id: string) {
  const payrun = await prisma.payrun.findUnique({ where: { id }, include: PAYRUN_INCLUDE });
  if (!payrun) throw notFound('Payrun not found');
  return payrun;
}

// ---------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------

export async function listPayruns(
  filters: { status?: string; period?: string },
  page: PageParams,
) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;

  if (filters.period) {
    const [year, month] = filters.period.split('-').map(Number);
    if (year && month) {
      where.periodStart = {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lte: new Date(Date.UTC(year, month, 0)),
      };
    }
  }

  const [rows, total] = await Promise.all([
    prisma.payrun.findMany({
      where,
      include: { ...PAYRUN_INCLUDE, payslips: { select: { net: true, gross: true } } },
      orderBy: { periodStart: 'desc' },
      skip: page.skip,
      take: page.take,
    }),
    prisma.payrun.count({ where }),
  ]);

  return { data: rows.map(toPayrun), total };
}

export async function getPayrun(id: string) {
  const payrun = await prisma.payrun.findUnique({
    where: { id },
    include: {
      ...PAYRUN_INCLUDE,
      payslips: {
        include: {
          employee: { select: { id: true, name: true, employeeCode: true, bankAccount: true } },
          lines: { orderBy: { sequence: 'asc' } },
        },
        orderBy: { employee: { name: 'asc' } },
      },
    },
  });

  if (!payrun) throw notFound('Payrun not found');

  const payslips = payrun.payslips.map((slip: any) =>
    toPayslip({ ...slip, payrun }, payrun.salaryStructureId),
  );

  // Every warning across the run, grouped for the processing screen's panel.
  const allWarnings = payslips.flatMap((slip: any) =>
    slip.warnings.map((w: PayslipWarning) => ({
      ...w,
      payslipId: slip.id,
      employeeName: slip.employeeName,
    })),
  );

  return {
    ...toPayrun(payrun),
    payslips,
    warnings: {
      HIGH: allWarnings.filter((w: any) => w.severity === 'HIGH'),
      MEDIUM: allWarnings.filter((w: any) => w.severity === 'MEDIUM'),
      LOW: allWarnings.filter((w: any) => w.severity === 'LOW'),
    },
    canCompute: payrun.status === 'DRAFT' || payrun.status === 'COMPUTED',
    canValidate: payrun.status === 'COMPUTED',
    canMarkPaid: payrun.status === 'VALIDATED',
    canSendPayslips: payrun.status === 'VALIDATED' || payrun.status === 'PAID',
  };
}

// ---------------------------------------------------------------------
// Wizard step 2 - preview only, creates NOTHING
// ---------------------------------------------------------------------

export interface EligibleScope {
  salaryStructureId: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Employees with a contract overlapping the period, annotated so the wizard
 * can show warning chips inline BEFORE anything is created.
 *
 * This function writes nothing. That is the point of the two-step wizard: the
 * brief explicitly says clicking NEW must not create a record.
 */
export async function eligibleEmployees(scope: EligibleScope) {
  const periodStart = parseDateOnly(scope.periodStart);
  const periodEnd = parseDateOnly(scope.periodEnd);

  if (periodEnd.getTime() < periodStart.getTime()) {
    throw validationError('The period cannot end before it starts');
  }

  const structure = await prisma.salaryStructure.findUnique({
    where: { id: scope.salaryStructureId },
  });
  if (!structure) throw notFound('That salary structure does not exist');

  // Candidate contracts, filtered in SQL by the same overlap rule core/ uses.
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: PAYABLE_CONTRACT_STATUSES as string[] },
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
    },
    include: {
      employee: {
        include: { department: { select: { id: true, name: true } } },
      },
    },
  });

  // Group by employee - more than one contract means a mid-period change.
  const byEmployee = new Map<string, { employee: any; contracts: any[] }>();
  for (const contract of contracts) {
    if (contract.employee.status !== 'ACTIVE') continue;
    const entry = byEmployee.get(contract.employeeId) ?? {
      employee: contract.employee,
      contracts: [],
    };
    entry.contracts.push(contract);
    byEmployee.set(contract.employeeId, entry);
  }

  const employeeIds = [...byEmployee.keys()];

  // One query for every existing payslip in this period, rather than one per
  // employee - this is the DUPLICATE_PAYSLIP check.
  const existingPayslips =
    employeeIds.length === 0
      ? []
      : await prisma.payslip.findMany({
          where: {
            employeeId: { in: employeeIds },
            periodStart: { lte: periodEnd },
            periodEnd: { gte: periodStart },
          },
          select: { id: true, employeeId: true, payrunId: true },
        });

  const payslipsByEmployee = new Map<string, any[]>();
  for (const slip of existingPayslips) {
    const list = payslipsByEmployee.get(slip.employeeId) ?? [];
    list.push(slip);
    payslipsByEmployee.set(slip.employeeId, list);
  }

  const rows = [...byEmployee.values()].map(({ employee, contracts: employeeContracts }) => {
    const duplicates = payslipsByEmployee.get(employee.id) ?? [];

    const chips: PayslipWarning[] = [];
    if (!employee.bankAccount) chips.push(warning('MISSING_BANK'));
    if (duplicates.length > 0) chips.push(warning('DUPLICATE_PAYSLIP'));
    if (employeeContracts.length > 1) chips.push(warning('CONTRACT_CHANGED_MID_PERIOD'));

    const endingSoon = employeeContracts.some(
      (contract: any) =>
        contract.endDate &&
        contract.endDate.getTime() <= addDays(periodEnd, EXPIRING_SOON_DAYS).getTime() &&
        contract.endDate.getTime() >= periodStart.getTime(),
    );
    if (endingSoon) chips.push(warning('CONTRACT_EXPIRING_SOON'));

    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? null,
      jobPosition: employee.jobPosition ?? null,
      employeeType: employee.employeeType,
      hasBankAccount: Boolean(employee.bankAccount),
      alreadyHasPayslipForPeriod: duplicates.length > 0,
      existingPayslipId: duplicates[0]?.id ?? null,
      contractCount: employeeContracts.length,
      wage: employeeContracts.length > 0 ? toNumber(employeeContracts[0].wage) : 0,
      warnings: chips,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    salaryStructureId: scope.salaryStructureId,
    salaryStructureName: structure.name,
    periodStart: scope.periodStart,
    periodEnd: scope.periodEnd,
    totalDays: daysInclusive(periodStart, periodEnd),
    employees: rows,
  };
}

// ---------------------------------------------------------------------
// Wizard final submit - the first call that creates anything
// ---------------------------------------------------------------------

export async function createPayrun(
  input: {
    name: string;
    salaryStructureId: string;
    periodStart: string;
    periodEnd: string;
    employeeIds: string[];
  },
  actorUserId: string,
) {
  const periodStart = parseDateOnly(input.periodStart);
  const periodEnd = parseDateOnly(input.periodEnd);

  if (periodEnd.getTime() < periodStart.getTime()) {
    throw validationError('The period cannot end before it starts');
  }

  if (input.employeeIds.length === 0) {
    throw validationError('Select at least one employee');
  }

  const structure = await prisma.salaryStructure.findUnique({
    where: { id: input.salaryStructureId },
    include: { rules: true },
  });
  if (!structure) throw notFound('That salary structure does not exist');
  if (structure.rules.length === 0) {
    throw validationError(`"${structure.name}" has no salary rules, so it cannot compute anything`);
  }

  const contracts = await prisma.contract.findMany({
    where: { employeeId: { in: input.employeeIds } },
    select: { id: true, employeeId: true, startDate: true, endDate: true, status: true, wage: true },
  });

  // Resolve each employee's contract UP FRONT: Payslip.contractId is not
  // nullable, and storing the resolved contract is the audit trail that
  // answers "prove this payslip used the right contract".
  const payslipSeeds: Array<{ employeeId: string; contractId: string }> = [];
  const skipped: Array<{ employeeId: string; reason: string }> = [];

  for (const employeeId of input.employeeIds) {
    try {
      const resolution = resolveContractForPeriod(contracts, employeeId, periodStart, periodEnd);
      // With a mid-period change, store the contract covering the most days.
      // The pro-ration across both still happens at compute time, and the
      // CONTRACT_CHANGED_MID_PERIOD warning keeps the split visible.
      const dominant = [...resolution.contracts].sort(
        (a, b) => b.daysCovered - a.daysCovered,
      )[0]!;
      payslipSeeds.push({ employeeId, contractId: dominant.contract.id });
    } catch (error) {
      if (error instanceof NoContractForPeriodError) {
        skipped.push({ employeeId, reason: 'NO_CONTRACT_FOR_PERIOD' });
        continue;
      }
      throw error;
    }
  }

  if (payslipSeeds.length === 0) {
    throw conflict('None of the selected employees have a contract covering this period');
  }

  const payrun = await prisma.$transaction(async (tx: any) => {
    const created = await tx.payrun.create({
      data: {
        name: input.name.trim(),
        salaryStructureId: input.salaryStructureId,
        periodStart,
        periodEnd,
        status: 'DRAFT',
        createdById: actorUserId,
      },
    });

    await tx.payslip.createMany({
      data: payslipSeeds.map((seed) => ({
        employeeId: seed.employeeId,
        payrunId: created.id,
        contractId: seed.contractId,
        periodStart,
        periodEnd,
        workedDays: 0,
        gross: 0,
        totalDeductions: 0,
        net: 0,
        status: 'DRAFT',
        warnings: [],
      })),
    });

    return created;
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'Payrun',
    entityId: payrun.id,
    changes: {
      name: payrun.name,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payslipCount: payslipSeeds.length,
      skipped,
    },
  });

  const full = await getPayrun(payrun.id);
  return { ...full, skipped };
}

// ---------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------

/**
 * Worked days in the period, from attendance.
 *
 * HALF_DAY counts as 0.5; MISSING_CHECKOUT still counts as a full day, since
 * the check-in proves the person was at work - forgetting to clock out is an
 * administrative slip, not an absence, and docking pay for it would be wrong.
 */
function workedDaysFrom(rows: Array<{ status: string; checkIn: Date }>): number {
  const perDay = new Map<string, number>();

  for (const row of rows) {
    const key = row.checkIn.toISOString().slice(0, 10);
    const credit =
      row.status === 'ABSENT' ? 0 : row.status === 'HALF_DAY' ? 0.5 : 1;
    // A day with two sessions is still one day.
    perDay.set(key, Math.max(perDay.get(key) ?? 0, credit));
  }

  let total = 0;
  for (const value of perDay.values()) total += value;
  return total;
}

/** Removes duplicate warning codes, keeping the first occurrence. */
function dedupeWarnings(warnings: PayslipWarning[]): PayslipWarning[] {
  const seen = new Set<string>();
  return warnings.filter((item) => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
}

export async function computePayrun(id: string, actorUserId: string) {
  const payrun = await loadPayrun(id);
  assertMutable(payrun);

  if (payrun.status === 'VALIDATED') {
    throw conflict('This payrun is already validated. Recomputing would change validated figures.');
  }

  const structure = await prisma.salaryStructure.findUnique({
    where: { id: payrun.salaryStructureId },
    include: { rules: { orderBy: { sequence: 'asc' } } },
  });
  if (!structure) throw notFound('The salary structure for this payrun no longer exists');

  const rules: EngineRule[] = structure.rules.map((rule: any) => ({
    code: rule.code,
    name: rule.name,
    category: rule.category,
    sequence: rule.sequence,
    computeType: rule.computeType,
    amount: rule.amount === null ? null : Number(rule.amount),
    percentage: rule.percentage === null ? null : Number(rule.percentage),
    formula: rule.formula,
    baseRuleCode: rule.baseRuleCode,
  }));

  const payslips = await prisma.payslip.findMany({
    where: { payrunId: id },
    include: { employee: true },
  });

  const periodStart = payrun.periodStart;
  const periodEnd = payrun.periodEnd;
  const totalDays = daysInclusive(periodStart, periodEnd);
  const employeeIds = payslips.map((slip: any) => slip.employeeId);

  // Load everything the whole run needs in four queries rather than four per
  // payslip - a 200-employee run should not be 800 round trips.
  const [contracts, attendance, unpaidLeave, otherPayslips] = await Promise.all([
    prisma.contract.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { id: true, employeeId: true, startDate: true, endDate: true, status: true, wage: true },
    }),
    prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        checkIn: { gte: periodStart, lte: endOfUtcDay(periodEnd) },
      },
      select: { employeeId: true, status: true, checkIn: true },
    }),
    prisma.timeOffRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        dateFrom: { lte: periodEnd },
        dateTo: { gte: periodStart },
        timeOffType: { isPaid: false },
      },
      select: { employeeId: true, durationDays: true },
    }),
    prisma.payslip.findMany({
      where: {
        employeeId: { in: employeeIds },
        payrunId: { not: id },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { id: true, employeeId: true },
    }),
  ]);

  const attendanceByEmployee = new Map<string, any[]>();
  for (const row of attendance) {
    const list = attendanceByEmployee.get(row.employeeId) ?? [];
    list.push(row);
    attendanceByEmployee.set(row.employeeId, list);
  }

  const unpaidByEmployee = new Map<string, number>();
  for (const row of unpaidLeave) {
    unpaidByEmployee.set(
      row.employeeId,
      (unpaidByEmployee.get(row.employeeId) ?? 0) + Number(row.durationDays),
    );
  }

  const duplicateEmployeeIds = new Set(otherPayslips.map((slip: any) => slip.employeeId));

  let computed = 0;
  const failures: Array<{ payslipId: string; employeeName: string; reason: string }> = [];

  for (const slip of payslips) {
    const employee = slip.employee;
    const warnings: PayslipWarning[] = [];

    // ---- resolve the contract(s) ------------------------------------
    let resolution;
    try {
      resolution = resolveContractForPeriod(
        contracts,
        slip.employeeId,
        periodStart,
        periodEnd,
      );
    } catch (error) {
      if (error instanceof NoContractForPeriodError) {
        // Record it on the payslip rather than failing the whole run - one
        // bad row must not stop payroll for everyone else.
        await prisma.payslip.update({
          where: { id: slip.id },
          data: {
            status: 'DRAFT',
            gross: 0,
            totalDeductions: 0,
            net: 0,
            workedDays: 0,
            warnings: [warning('NO_CONTRACT_FOR_PERIOD')] as any,
          },
        });
        await prisma.payslipLine.deleteMany({ where: { payslipId: slip.id } });
        failures.push({
          payslipId: slip.id,
          employeeName: employee.name,
          reason: 'NO_CONTRACT_FOR_PERIOD',
        });
        continue;
      }
      throw error;
    }

    // ---- worked days ------------------------------------------------
    const employeeAttendance = attendanceByEmployee.get(slip.employeeId) ?? [];
    const attendanceDays = workedDaysFrom(employeeAttendance);

    // With no attendance rows at all, fall back to the business-day count so
    // a salaried employee is not paid zero because nobody clocked them in -
    // and flag it, because a payslip computed on an assumption should say so.
    const workedDays =
      employeeAttendance.length === 0 ? businessDaysBetween(periodStart, periodEnd) : attendanceDays;

    if (employeeAttendance.length === 0) {
      warnings.push(warning('ZERO_WORKED_DAYS', 'No attendance recorded - paid on scheduled working days'));
    }

    // ---- run the engine ---------------------------------------------
    const result = computePayslip({
      contracts: resolution.contracts.map((entry) => ({
        id: entry.contract.id,
        wage: Number((entry.contract as any).wage),
        proRataFactor: entry.proRataFactor,
      })),
      rules,
      workedDays,
      totalDays,
      unpaidLeaveDays: unpaidByEmployee.get(slip.employeeId) ?? 0,
    });

    warnings.push(...result.warnings);

    // ---- warnings needing database context --------------------------
    if (!employee.bankAccount) warnings.push(warning('MISSING_BANK'));
    if (duplicateEmployeeIds.has(slip.employeeId)) warnings.push(warning('DUPLICATE_PAYSLIP'));

    const dominant = [...resolution.contracts].sort((a, b) => b.daysCovered - a.daysCovered)[0]!;
    const dominantEnd = (dominant.contract as any).endDate as Date | null;
    if (
      dominantEnd &&
      dominantEnd.getTime() <= addDays(periodEnd, EXPIRING_SOON_DAYS).getTime() &&
      dominantEnd.getTime() >= periodStart.getTime()
    ) {
      warnings.push(warning('CONTRACT_EXPIRING_SOON'));
    }

    // ---- persist, idempotently --------------------------------------
    await prisma.$transaction(async (tx: any) => {
      // Delete-then-insert. Running compute twice must never append a second
      // set of lines - this is the guarantee, and it is why lines have no
      // natural key we could accidentally upsert against.
      await tx.payslipLine.deleteMany({ where: { payslipId: slip.id } });

      await tx.payslipLine.createMany({
        data: result.lines.map((line) => ({
          payslipId: slip.id,
          ruleCode: line.ruleCode,
          ruleName: line.ruleName,
          category: line.category as never,
          sequence: line.sequence,
          amount: toNumber(line.amount),
        })),
      });

      await tx.payslip.update({
        where: { id: slip.id },
        data: {
          // Re-store the resolved contract: it is recomputed here, so the
          // audit field must agree with what was actually used.
          contractId: dominant.contract.id,
          workedDays,
          gross: toNumber(result.gross),
          totalDeductions: toNumber(result.totalDeductions),
          net: toNumber(result.net),
          status: 'COMPUTED',
          warnings: dedupeWarnings(warnings) as any,
        },
      });
    });

    computed += 1;
  }

  await prisma.payrun.update({ where: { id }, data: { status: 'COMPUTED' } });

  await writeAudit({
    userId: actorUserId,
    action: 'COMPUTE',
    entityType: 'Payrun',
    entityId: id,
    changes: { computed, failed: failures.length, status: 'COMPUTED' },
  });

  const full = await getPayrun(id);
  return { ...full, computed, failures };
}

// ---------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------

export async function validatePayrun(id: string, actorUserId: string) {
  const payrun = await loadPayrun(id);
  assertMutable(payrun);

  if (payrun.status !== 'COMPUTED') {
    throw conflict(
      `A payrun can only be validated from COMPUTED. This one is ${payrun.status} - run Compute first.`,
    );
  }

  const payslips = await prisma.payslip.findMany({
    where: { payrunId: id },
    include: { employee: { select: { name: true } } },
  });

  // THE GATE: any unresolved HIGH-severity warning blocks the whole run.
  const blocked = payslips
    .map((slip: any) => ({
      payslipId: slip.id,
      employeeName: slip.employee.name,
      warnings: (Array.isArray(slip.warnings) ? slip.warnings : []) as PayslipWarning[],
    }))
    .filter((entry: any) => hasBlockingWarning(entry.warnings));

  if (blocked.length > 0) {
    throw conflict(
      `${blocked.length} payslip(s) carry a high-severity warning. Resolve them before validating.`,
      {
        blocked: blocked.map((entry: any) => ({
          payslipId: entry.payslipId,
          employeeName: entry.employeeName,
          warnings: entry.warnings.filter((w: PayslipWarning) => w.severity === 'HIGH'),
        })),
      },
    );
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.payslip.updateMany({ where: { payrunId: id }, data: { status: 'VALIDATED' } });
    await tx.payrun.update({ where: { id }, data: { status: 'VALIDATED' } });
  });

  await writeAudit({
    userId: actorUserId,
    action: 'VALIDATE',
    entityType: 'Payrun',
    entityId: id,
    changes: { from: 'COMPUTED', to: 'VALIDATED', payslipCount: payslips.length },
  });

  return getPayrun(id);
}

// ---------------------------------------------------------------------
// Mark paid
// ---------------------------------------------------------------------

export async function markPayrunPaid(id: string, actorUserId: string) {
  const payrun = await loadPayrun(id);
  assertMutable(payrun);

  if (payrun.status !== 'VALIDATED') {
    throw conflict(
      `A payrun can only be marked paid from VALIDATED. This one is ${payrun.status}.`,
    );
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.payslip.updateMany({ where: { payrunId: id }, data: { status: 'PAID' } });
    await tx.payrun.update({ where: { id }, data: { status: 'PAID' } });
  });

  await writeAudit({
    userId: actorUserId,
    action: 'MARK_PAID',
    entityType: 'Payrun',
    entityId: id,
    changes: { from: 'VALIDATED', to: 'PAID' },
  });

  return getPayrun(id);
}

// ---------------------------------------------------------------------
// Send payslips
// ---------------------------------------------------------------------

/**
 * Renders each payslip to PDF and emails it.
 *
 * With SMTP unconfigured the send is logged and still recorded as sent, so the
 * demo works offline - that behaviour is specified, not a fallback we invented.
 */
export async function sendPayslips(id: string, actorUserId: string) {
  const payrun = await loadPayrun(id);

  if (payrun.status !== 'VALIDATED' && payrun.status !== 'PAID') {
    throw conflict(
      `Payslips can only be sent once a payrun is validated. This one is ${payrun.status}.`,
    );
  }

  const payslips = await prisma.payslip.findMany({
    where: { payrunId: id },
    include: {
      employee: { include: { department: true } },
      lines: { orderBy: { sequence: 'asc' } },
      contract: true,
      payrun: { include: { salaryStructure: true } },
    },
  });

  const results: Array<{ payslipId: string; email: string; sent: boolean; error?: string }> = [];

  for (const slip of payslips) {
    try {
      const pdf = await renderPayslipPdf(slip);
      const outcome = await sendPayslipEmail({
        to: slip.employee.email,
        employeeName: slip.employee.name,
        periodStart: slip.periodStart,
        periodEnd: slip.periodEnd,
        net: Number(slip.net),
        pdf,
      });
      results.push({ payslipId: slip.id, email: slip.employee.email, sent: outcome.sent });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[payslips] failed to send ${slip.id}`, message);
      results.push({
        payslipId: slip.id,
        email: slip.employee.email,
        sent: false,
        error: message,
      });
    }
  }

  const sent = results.filter((entry) => entry.sent).length;

  await writeAudit({
    userId: actorUserId,
    action: 'SEND_PAYSLIPS',
    entityType: 'Payrun',
    entityId: id,
    changes: { attempted: results.length, sent },
  });

  return { payrunId: id, attempted: results.length, sent, results };
}
