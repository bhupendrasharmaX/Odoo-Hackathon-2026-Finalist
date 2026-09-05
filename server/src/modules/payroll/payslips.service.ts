import { notFound } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { endOfUtcDay, monthBounds } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { toPayslip } from '../../lib/serialize';
import { renderPayslipPdf } from './pdf';

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAYSLIP_INCLUDE = {
  employee: {
    select: { id: true, name: true, employeeCode: true, email: true, bankAccount: true },
  },
  payrun: { select: { id: true, name: true, salaryStructureId: true, status: true } },
  lines: { orderBy: { sequence: 'asc' as const } },
} as const;

export interface ListPayslipFilters {
  payrunId?: string;
  employeeId?: string;
  /** "YYYY-MM" - matches any payslip whose period overlaps that month. */
  period?: string;
  status?: string;
}

export async function listPayslips(filters: ListPayslipFilters, page: PageParams) {
  const where: Record<string, unknown> = {};

  if (filters.payrunId) where.payrunId = filters.payrunId;
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status) where.status = filters.status;

  if (filters.period) {
    const { start, end } = monthBounds(filters.period);
    where.periodStart = { lte: endOfUtcDay(end) };
    where.periodEnd = { gte: start };
  }

  const [rows, total] = await Promise.all([
    prisma.payslip.findMany({
      where,
      include: PAYSLIP_INCLUDE,
      orderBy: [{ periodStart: 'desc' }, { employee: { name: 'asc' } }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.payslip.count({ where }),
  ]);

  return { data: rows.map((row: any) => toPayslip(row)), total };
}

/** Full payslip including its lines. Returns the raw row too, for the PDF. */
export async function getPayslipRow(id: string) {
  const row = await prisma.payslip.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true } },
      payrun: { include: { salaryStructure: true } },
      contract: true,
      lines: { orderBy: { sequence: 'asc' } },
    },
  });

  if (!row) throw notFound('Payslip not found');
  return row;
}

export async function getPayslip(id: string) {
  const row = await getPayslipRow(id);

  // The resolved contract is surfaced explicitly: "prove this payslip used the
  // right contract" is answered by data on the payslip, not by recomputation.
  return {
    ...toPayslip(row),
    contract: row.contract
      ? {
          id: row.contract.id,
          startDate: row.contract.startDate.toISOString().slice(0, 10),
          endDate: row.contract.endDate ? row.contract.endDate.toISOString().slice(0, 10) : null,
          wage: Number(row.contract.wage),
          jobPosition: row.contract.jobPosition,
          status: row.contract.status,
        }
      : null,
    structureName: row.payrun?.salaryStructure?.name ?? null,
    payrunStatus: row.payrun?.status ?? null,
    departmentName: row.employee?.department?.name ?? null,
  };
}

export async function getPayslipPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
  const row = await getPayslipRow(id);
  const buffer = await renderPayslipPdf(row);

  const period = row.periodStart.toISOString().slice(0, 7);
  const code = row.employee?.employeeCode ?? row.employeeId;

  return { buffer, filename: `payslip-${code}-${period}.pdf` };
}
