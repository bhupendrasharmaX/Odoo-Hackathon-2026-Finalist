import { addDays, monthBounds, recentPeriods, toPeriodKey } from '../../lib/dates';
import { prisma } from '../../lib/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Dashboard aggregation.
 *
 * EVERY number here comes from a live query. Not one is hardcoded, and each
 * one below can be opened and shown - which is the whole point of the panel.
 *
 * All three filters (period, departmentId, employeeType) narrow every number
 * on the screen, so changing one visibly changes the whole dashboard.
 */

const TREND_MONTHS = 6;
const EXPIRING_SOON_DAYS = 30;

/** Payslip statuses that represent money actually committed. */
const PAID_STATUSES = ['VALIDATED', 'PAID'];

export interface DashboardFilters {
  /** "YYYY-MM". Defaults to the most recent month that has payroll data. */
  period?: string;
  departmentId?: string;
  employeeType?: string;
}

/**
 * Employee ids matching the department / type filters, or null when neither
 * filter is set - null means "no employee restriction", which lets the callers
 * below skip an `IN (...)` clause entirely rather than passing every id.
 */
async function scopedEmployeeIds(filters: DashboardFilters): Promise<string[] | null> {
  if (!filters.departmentId && !filters.employeeType) return null;

  const where: Record<string, unknown> = {};
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.employeeType) where.employeeType = filters.employeeType;

  const rows = await prisma.employee.findMany({ where, select: { id: true } });
  return rows.map((row: any) => row.id);
}

export async function getDashboard(filters: DashboardFilters) {
  // ---- resolve the period ------------------------------------------
  // With no period given, use the latest month that actually has payslips, so
  // a fresh login lands on a dashboard with data rather than an empty one.
  let period = filters.period;
  if (!period) {
    const latest = await prisma.payslip.findFirst({
      orderBy: { periodStart: 'desc' },
      select: { periodStart: true },
    });
    period = latest ? toPeriodKey(latest.periodStart) : toPeriodKey(new Date());
  }

  const { start: periodStart, end: periodEnd } = monthBounds(period);
  const employeeIds = await scopedEmployeeIds(filters);

  // A filter that matches nobody must produce zeros, not "unfiltered".
  const employeeFilter =
    employeeIds === null ? {} : { employeeId: { in: employeeIds } };

  const payslipWhere = {
    ...employeeFilter,
    periodStart: { lte: periodEnd },
    periodEnd: { gte: periodStart },
  };

  const [
    payslipAgg,
    paidAgg,
    payslipCount,
    timeOffAgg,
    attendanceGroups,
    overtimeAgg,
    manualEditCount,
    openGrievances,
    departmentRows,
    trendRows,
    warningPayslips,
    expiringContracts,
  ] = await Promise.all([
    // 1-3. net totals and average over the period
    prisma.payslip.aggregate({
      where: payslipWhere,
      _sum: { net: true, gross: true, totalDeductions: true },
      _avg: { net: true },
      _count: true,
    }),
    prisma.payslip.aggregate({
      where: { ...payslipWhere, status: { in: PAID_STATUSES } },
      _sum: { net: true },
    }),
    prisma.payslip.count({ where: payslipWhere }),

    // 4. approved time off days landing in the period
    prisma.timeOffRequest.aggregate({
      where: {
        ...employeeFilter,
        status: 'APPROVED',
        dateFrom: { lte: periodEnd },
        dateTo: { gte: periodStart },
      },
      _sum: { durationDays: true },
    }),

    // 5. attendance health - a real GROUP BY, not a computed guess
    prisma.attendance.groupBy({
      by: ['status'],
      where: {
        ...employeeFilter,
        checkIn: { gte: periodStart, lte: addDays(periodEnd, 1) },
      },
      _count: { _all: true },
    }),
    prisma.attendance.aggregate({
      where: {
        ...employeeFilter,
        checkIn: { gte: periodStart, lte: addDays(periodEnd, 1) },
      },
      _sum: { overtimeHours: true },
    }),
    prisma.attendance.count({
      where: {
        ...employeeFilter,
        isManuallyEdited: true,
        checkIn: { gte: periodStart, lte: addDays(periodEnd, 1) },
      },
    }),

    // 6. open grievances
    prisma.grievance.count({
      where: { ...employeeFilter, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    }),

    // 7. salary by department - joined through the payslip's employee
    prisma.payslip.findMany({
      where: payslipWhere,
      select: {
        net: true,
        employeeId: true,
        employee: {
          select: {
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    }),

    // 8. six-month net trend
    prisma.payslip.findMany({
      where: {
        ...employeeFilter,
        periodStart: {
          gte: new Date(
            Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - (TREND_MONTHS - 1), 1),
          ),
          lte: periodEnd,
        },
      },
      select: { periodStart: true, net: true, status: true },
    }),

    // 9. alerts - payslips carrying warnings
    prisma.payslip.findMany({
      where: payslipWhere,
      select: {
        id: true,
        warnings: true,
        employee: { select: { id: true, name: true } },
      },
    }),

    // 9b. alerts - contracts expiring within 30 days
    prisma.contract.findMany({
      where: {
        ...(employeeIds === null ? {} : { employeeId: { in: employeeIds } }),
        status: 'RUNNING',
        endDate: { not: null, gte: periodEnd, lte: addDays(periodEnd, EXPIRING_SOON_DAYS) },
      },
      select: {
        id: true,
        endDate: true,
        employee: { select: { id: true, name: true } },
      },
    }),
  ]);

  // ---- KPIs ---------------------------------------------------------
  const totalNetPaid = Number(paidAgg._sum.net ?? 0);
  const averageSalary = Number(payslipAgg._avg.net ?? 0);

  const attendanceCounts = new Map<string, number>();
  for (const group of attendanceGroups as any[]) {
    attendanceCounts.set(group.status, group._count._all);
  }

  const present = attendanceCounts.get('PRESENT') ?? 0;
  const late = attendanceCounts.get('LATE') ?? 0;
  const absent = attendanceCounts.get('ABSENT') ?? 0;
  const halfDay = attendanceCounts.get('HALF_DAY') ?? 0;
  const missingCheckouts = attendanceCounts.get('MISSING_CHECKOUT') ?? 0;
  const attendanceTotal = present + late + absent + halfDay + missingCheckouts;

  // PRESENT / total, as a 0-1 decimal. Zero records is 0, not NaN.
  const attendanceHealth =
    attendanceTotal === 0 ? 0 : Math.round((present / attendanceTotal) * 100) / 100;

  // ---- salary by department ------------------------------------------
  const departmentTotals = new Map<
    string,
    { department: string; headcount: Set<string>; totalSalary: number }
  >();

  for (const slip of departmentRows as any[]) {
    const name = slip.employee?.department?.name ?? 'Unassigned';
    const entry = departmentTotals.get(name) ?? {
      department: name,
      headcount: new Set<string>(),
      totalSalary: 0,
    };
    entry.headcount.add(slip.employeeId);
    entry.totalSalary += Number(slip.net);
    departmentTotals.set(name, entry);
  }

  const salaryByDepartment = [...departmentTotals.values()]
    .map((entry) => ({
      department: entry.department,
      headcount: entry.headcount.size,
      totalSalary: Math.round(entry.totalSalary * 100) / 100,
    }))
    .sort((a, b) => b.totalSalary - a.totalSalary);

  // ---- monthly net trend ---------------------------------------------
  const trendTotals = new Map<string, number>();
  for (const key of recentPeriods(periodStart, TREND_MONTHS)) {
    // Seed every month so a gap renders as a zero point, not a missing one -
    // a line chart that silently skips a month tells a false story.
    trendTotals.set(key, 0);
  }

  for (const slip of trendRows as any[]) {
    if (!PAID_STATUSES.includes(slip.status)) continue;
    const key = toPeriodKey(slip.periodStart);
    if (trendTotals.has(key)) {
      trendTotals.set(key, (trendTotals.get(key) ?? 0) + Number(slip.net));
    }
  }

  const monthlyNetTrend = [...trendTotals.entries()].map(([key, net]) => ({
    period: key,
    net: Math.round(net * 100) / 100,
  }));

  // ---- alerts ---------------------------------------------------------
  const alerts: Array<{
    type: string;
    severity: string;
    message: string;
    payslipId?: string;
    employeeId?: string;
    contractId?: string;
  }> = [];

  for (const slip of warningPayslips as any[]) {
    const warnings = Array.isArray(slip.warnings) ? slip.warnings : [];
    for (const item of warnings) {
      alerts.push({
        type: item.code,
        severity: item.severity,
        message: `${slip.employee?.name ?? 'Employee'}: ${item.message}`,
        payslipId: slip.id,
        employeeId: slip.employee?.id,
      });
    }
  }

  for (const contract of expiringContracts as any[]) {
    alerts.push({
      type: 'CONTRACT_EXPIRING_SOON',
      severity: 'LOW',
      message: `${contract.employee?.name ?? 'Employee'}: contract ends ${contract.endDate.toISOString().slice(0, 10)}`,
      contractId: contract.id,
      employeeId: contract.employee?.id,
    });
  }

  const severityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  alerts.sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3));

  return {
    period,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    filters: {
      departmentId: filters.departmentId ?? null,
      employeeType: filters.employeeType ?? null,
    },
    kpis: {
      totalNetPaid: Math.round(totalNetPaid * 100) / 100,
      payslipsGenerated: payslipCount,
      averageSalary: Math.round(averageSalary * 100) / 100,
      approvedTimeOffDays: Number(timeOffAgg._sum.durationDays ?? 0),
      attendanceHealth,
      openGrievances,
    },
    salaryByDepartment,
    monthlyNetTrend,
    attendanceOverview: {
      present,
      late,
      absent,
      halfDay,
      overtimeHours: Math.round(Number(overtimeAgg._sum.overtimeHours ?? 0) * 100) / 100,
      missingCheckouts,
      manualEdits: manualEditCount,
    },
    alerts,
  };
}

/** Filter options for the dashboard's own filter bar. */
export async function getDashboardFilters() {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });

  const periods = await prisma.payrun.findMany({
    orderBy: { periodStart: 'desc' },
    select: { periodStart: true },
    distinct: ['periodStart'],
    take: 24,
  });

  return {
    departments,
    periods: [...new Set(periods.map((row: any) => toPeriodKey(row.periodStart)))],
    employeeTypes: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
  };
}
