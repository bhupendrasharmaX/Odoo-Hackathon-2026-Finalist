import { validateNoOverlappingContracts } from '../../core/contract-resolution';
import { notFound } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { parseDateOnly } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { toContract } from '../../lib/serialize';

/**
 * Contracts.
 *
 * Every create and update runs `validateNoOverlappingContracts` from core/
 * BEFORE touching the database. Two running contracts covering the same day
 * would make "which contract applies to this period" ambiguous in exactly the
 * place the whole payroll depends on it being decidable.
 */

const CONTRACT_INCLUDE = {
  employee: { select: { id: true, name: true, employeeCode: true } },
  department: { select: { id: true, name: true } },
  workingSchedule: { select: { id: true, name: true } },
  salaryStructure: { select: { id: true, name: true } },
} as const;

export interface ListContractFilters {
  employeeId?: string;
  status?: string;
}

export async function listContracts(filters: ListContractFilters, page: PageParams) {
  const where: Record<string, unknown> = {};
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status) where.status = filters.status;

  const [rows, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: CONTRACT_INCLUDE,
      orderBy: [{ startDate: 'desc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.contract.count({ where }),
  ]);

  return { data: rows.map(toContract), total };
}

export async function getContract(id: string) {
  const row = await prisma.contract.findUnique({ where: { id }, include: CONTRACT_INCLUDE });
  if (!row) throw notFound('Contract not found');
  return toContract(row);
}

export interface CreateContractInput {
  employeeId: string;
  startDate: string;
  endDate?: string | null;
  wage: number;
  jobPosition?: string | null;
  departmentId: string;
  workingScheduleId?: string | null;
  salaryStructureId?: string | null;
  status?: string;
}

export async function createContract(input: CreateContractInput, actorUserId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw notFound('That employee does not exist');

  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw notFound('That department does not exist');

  const startDate = parseDateOnly(input.startDate);
  const endDate = input.endDate ? parseDateOnly(input.endDate) : null;

  const existing = await prisma.contract.findMany({
    where: { employeeId: input.employeeId },
    select: { id: true, employeeId: true, startDate: true, endDate: true, status: true },
  });

  // Throws CONFLICT before anything is written.
  validateNoOverlappingContracts(existing, startDate, endDate);

  const created = await prisma.contract.create({
    data: {
      employeeId: input.employeeId,
      startDate,
      endDate,
      wage: input.wage,
      jobPosition: input.jobPosition ?? null,
      departmentId: input.departmentId,
      workingScheduleId: input.workingScheduleId ?? null,
      salaryStructureId: input.salaryStructureId ?? null,
      status: (input.status ?? 'DRAFT') as never,
    },
    include: CONTRACT_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'Contract',
    entityId: created.id,
    changes: {
      employeeId: created.employeeId,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      wage: input.wage,
      status: created.status,
    },
  });

  return toContract(created);
}

export async function updateContract(
  id: string,
  input: Partial<CreateContractInput>,
  actorUserId: string,
) {
  const existing = await prisma.contract.findUnique({ where: { id } });
  if (!existing) throw notFound('Contract not found');

  // Re-check the overlap against the range as it will be AFTER the patch,
  // not as it was before it - otherwise moving a start date could silently
  // create the overlap this guard exists to prevent.
  const startDate = input.startDate ? parseDateOnly(input.startDate) : existing.startDate;
  const endDate =
    input.endDate === undefined
      ? existing.endDate
      : input.endDate === null
        ? null
        : parseDateOnly(input.endDate);

  const siblings = await prisma.contract.findMany({
    where: { employeeId: existing.employeeId },
    select: { id: true, employeeId: true, startDate: true, endDate: true, status: true },
  });

  const nextStatus = input.status ?? existing.status;

  // Only a contract that will be RUNNING can collide with another RUNNING one.
  if (nextStatus === 'RUNNING') {
    validateNoOverlappingContracts(siblings, startDate, endDate, id);
  }

  const data: Record<string, unknown> = {};
  if (input.startDate !== undefined) data.startDate = startDate;
  if (input.endDate !== undefined) data.endDate = endDate;
  if (input.wage !== undefined) data.wage = input.wage;
  if (input.jobPosition !== undefined) data.jobPosition = input.jobPosition;
  if (input.departmentId !== undefined) data.departmentId = input.departmentId;
  if (input.workingScheduleId !== undefined) data.workingScheduleId = input.workingScheduleId;
  if (input.salaryStructureId !== undefined) data.salaryStructureId = input.salaryStructureId;
  if (input.status !== undefined) data.status = input.status;

  const updated = await prisma.contract.update({
    where: { id },
    data,
    include: CONTRACT_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'UPDATE',
    entityType: 'Contract',
    entityId: id,
    changes: data,
  });

  return toContract(updated);
}
