import { notFound } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { toGrievance } from '../../lib/serialize';

/* eslint-disable @typescript-eslint/no-explicit-any */

const GRIEVANCE_INCLUDE = {
  employee: { select: { id: true, name: true, employeeCode: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export async function listGrievances(
  filters: { employeeId?: string; status?: string; payslipId?: string },
  page: PageParams,
) {
  const where: Record<string, unknown> = {};
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status) where.status = filters.status;
  if (filters.payslipId) where.payslipId = filters.payslipId;

  const [rows, total] = await Promise.all([
    prisma.grievance.findMany({
      where,
      include: GRIEVANCE_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.grievance.count({ where }),
  ]);

  return { data: rows.map(toGrievance), total };
}

export async function createGrievance(
  input: {
    employeeId: string;
    payslipId?: string | null;
    subject: string;
    description: string;
  },
  actorUserId: string,
) {
  const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw notFound('That employee does not exist');

  if (input.payslipId) {
    const payslip = await prisma.payslip.findUnique({ where: { id: input.payslipId } });
    if (!payslip) throw notFound('That payslip does not exist');
  }

  const created = await prisma.grievance.create({
    data: {
      employeeId: input.employeeId,
      payslipId: input.payslipId ?? null,
      subject: input.subject.trim(),
      description: input.description.trim(),
      status: 'OPEN',
    },
    include: GRIEVANCE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'Grievance',
    entityId: created.id,
    changes: { employeeId: input.employeeId, subject: created.subject },
  });

  return toGrievance(created);
}

/**
 * Resolve / reject / move to review.
 *
 * `resolvedById` and `resolvedAt` are stamped only on a terminal status, so an
 * UNDER_REVIEW grievance does not look resolved in the audit trail.
 */
export async function updateGrievance(
  id: string,
  input: { status?: string; response?: string | null },
  actorUserId: string,
) {
  const existing = await prisma.grievance.findUnique({ where: { id } });
  if (!existing) throw notFound('Grievance not found');

  const data: Record<string, unknown> = {};
  if (input.response !== undefined) data.response = input.response;

  if (input.status !== undefined) {
    data.status = input.status;

    const terminal = input.status === 'RESOLVED' || input.status === 'REJECTED';
    if (terminal) {
      data.resolvedById = actorUserId;
      data.resolvedAt = new Date();
    } else {
      // Reopening clears the resolution stamp rather than leaving a stale one.
      data.resolvedById = null;
      data.resolvedAt = null;
    }
  }

  const updated = await prisma.grievance.update({
    where: { id },
    data,
    include: GRIEVANCE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: input.status === 'RESOLVED' ? 'RESOLVE' : 'UPDATE',
    entityType: 'Grievance',
    entityId: id,
    changes: { from: existing.status, to: input.status ?? existing.status },
  });

  return toGrievance(updated);
}
