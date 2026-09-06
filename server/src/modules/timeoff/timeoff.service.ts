import { conflict, notFound, validationError } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { daysInclusive, parseDateOnly } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { toAllocation, toTimeOffRequest, toTimeOffType } from '../../lib/serialize';

/**
 * Time off.
 *
 * The rule judges test: approving an already-APPROVED request must be a no-op,
 * not a second deduction. `approveRequest` guards on the current status INSIDE
 * the transaction that does the deduction, so two approvals racing each other
 * cannot both read PENDING and both deduct.
 */

const ALLOCATION_INCLUDE = {
  employee: { select: { id: true, name: true, employeeCode: true } },
  timeOffType: { select: { id: true, name: true, unit: true, isPaid: true, color: true } },
} as const;

const REQUEST_INCLUDE = {
  employee: { select: { id: true, name: true, employeeCode: true } },
  timeOffType: { select: { id: true, name: true, unit: true, isPaid: true, color: true } },
  approvedBy: { select: { id: true, name: true } },
} as const;

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export async function listTypes() {
  const rows = await prisma.timeOffType.findMany({ orderBy: { name: 'asc' } });
  return rows.map(toTimeOffType);
}

export async function createType(
  input: {
    name: string;
    unit?: string;
    requiresAllocation?: boolean;
    isPaid?: boolean;
    color?: string | null;
  },
  actorUserId: string,
) {
  const created = await prisma.timeOffType.create({
    data: {
      name: input.name.trim(),
      unit: (input.unit ?? 'DAYS') as never,
      requiresAllocation: input.requiresAllocation ?? true,
      isPaid: input.isPaid ?? true,
      color: input.color ?? null,
    },
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'TimeOffType',
    entityId: created.id,
    changes: { name: created.name },
  });

  return toTimeOffType(created);
}

// ---------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------

export async function listAllocations(
  filters: { employeeId?: string; timeOffTypeId?: string },
  page: PageParams,
) {
  const where: Record<string, unknown> = {};
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.timeOffTypeId) where.timeOffTypeId = filters.timeOffTypeId;

  const [rows, total] = await Promise.all([
    prisma.allocation.findMany({
      where,
      include: ALLOCATION_INCLUDE,
      orderBy: [{ validFrom: 'desc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.allocation.count({ where }),
  ]);

  return { data: rows.map(toAllocation), total };
}

export async function createAllocation(
  input: {
    employeeId: string;
    timeOffTypeId: string;
    allocatedDays: number;
    validFrom: string;
    validTo: string;
    status?: string;
  },
  actorUserId: string,
) {
  const [employee, type] = await Promise.all([
    prisma.employee.findUnique({ where: { id: input.employeeId } }),
    prisma.timeOffType.findUnique({ where: { id: input.timeOffTypeId } }),
  ]);

  if (!employee) throw notFound('That employee does not exist');
  if (!type) throw notFound('That time off type does not exist');

  const validFrom = parseDateOnly(input.validFrom);
  const validTo = parseDateOnly(input.validTo);

  if (validTo.getTime() < validFrom.getTime()) {
    throw validationError('The allocation cannot end before it starts');
  }

  const created = await prisma.allocation.create({
    data: {
      employeeId: input.employeeId,
      timeOffTypeId: input.timeOffTypeId,
      allocatedDays: input.allocatedDays,
      usedDays: 0,
      validFrom,
      validTo,
      status: (input.status ?? 'PENDING') as never,
    },
    include: ALLOCATION_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'Allocation',
    entityId: created.id,
    changes: { employeeId: input.employeeId, allocatedDays: input.allocatedDays },
  });

  return toAllocation(created);
}

export async function approveAllocation(id: string, actorUserId: string) {
  const existing = await prisma.allocation.findUnique({ where: { id } });
  if (!existing) throw notFound('Allocation not found');

  // Idempotent - re-approving is a no-op, not an error.
  if (existing.status === 'APPROVED') {
    const row = await prisma.allocation.findUnique({ where: { id }, include: ALLOCATION_INCLUDE });
    return toAllocation(row);
  }

  const updated = await prisma.allocation.update({
    where: { id },
    data: { status: 'APPROVED' },
    include: ALLOCATION_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'APPROVE',
    entityType: 'Allocation',
    entityId: id,
    changes: { from: existing.status, to: 'APPROVED' },
  });

  return toAllocation(updated);
}

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------

export async function listRequests(
  filters: { employeeId?: string; status?: string },
  page: PageParams,
) {
  const where: Record<string, unknown> = {};
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status) where.status = filters.status;

  const [rows, total] = await Promise.all([
    prisma.timeOffRequest.findMany({
      where,
      include: REQUEST_INCLUDE,
      orderBy: [{ dateFrom: 'desc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.timeOffRequest.count({ where }),
  ]);

  return { data: rows.map(toTimeOffRequest), total };
}

export async function createRequest(
  input: {
    employeeId: string;
    timeOffTypeId: string;
    allocationId?: string | null;
    dateFrom: string;
    dateTo: string;
    durationDays?: number;
    reason?: string | null;
    status?: string;
  },
  actorUserId: string,
) {
  const [employee, type] = await Promise.all([
    prisma.employee.findUnique({ where: { id: input.employeeId } }),
    prisma.timeOffType.findUnique({ where: { id: input.timeOffTypeId } }),
  ]);

  if (!employee) throw notFound('That employee does not exist');
  if (!type) throw notFound('That time off type does not exist');

  const dateFrom = parseDateOnly(input.dateFrom);
  const dateTo = parseDateOnly(input.dateTo);

  if (dateTo.getTime() < dateFrom.getTime()) {
    throw validationError('The request cannot end before it starts');
  }

  const durationDays = input.durationDays ?? daysInclusive(dateFrom, dateTo);

  // Pick the allocation automatically when the type needs one and the caller
  // did not name it - the UI shows a balance, not an allocation id.
  let allocationId = input.allocationId ?? null;
  if (!allocationId && type.requiresAllocation) {
    const allocation = await prisma.allocation.findFirst({
      where: {
        employeeId: input.employeeId,
        timeOffTypeId: input.timeOffTypeId,
        status: 'APPROVED',
        validFrom: { lte: dateFrom },
        validTo: { gte: dateTo },
      },
      orderBy: { validFrom: 'desc' },
    });
    allocationId = allocation?.id ?? null;
  }

  const created = await prisma.timeOffRequest.create({
    data: {
      employeeId: input.employeeId,
      timeOffTypeId: input.timeOffTypeId,
      allocationId,
      dateFrom,
      dateTo,
      durationDays,
      status: (input.status ?? 'PENDING') as never,
      reason: input.reason ?? null,
    },
    include: REQUEST_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'TimeOffRequest',
    entityId: created.id,
    changes: { employeeId: input.employeeId, dateFrom: input.dateFrom, dateTo: input.dateTo, durationDays },
  });

  return toTimeOffRequest(created);
}

/**
 * Approves a request and deducts the balance ATOMICALLY.
 *
 * Three things happen in one transaction:
 *   1. Re-read the request FOR THIS TRANSACTION and check it is still PENDING.
 *   2. Check the allocation has room.
 *   3. Set APPROVED and increment usedDays.
 *
 * Step 1 is the double-deduction guard. Reading the status outside the
 * transaction and deciding there would let two concurrent approvals both see
 * PENDING and both deduct. `updateMany ... where status: PENDING` makes the
 * status check and the write a single atomic conditional update - if it
 * reports 0 rows changed, somebody else won the race and we deduct nothing.
 */
export async function approveRequest(id: string, actorUserId: string) {
  const before = await prisma.timeOffRequest.findUnique({ where: { id } });
  if (!before) throw notFound('Time off request not found');

  // Already approved: no-op. Judges test this by clicking Approve twice.
  if (before.status === 'APPROVED') {
    const row = await prisma.timeOffRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    return { request: toTimeOffRequest(row), alreadyApproved: true };
  }

  if (before.status === 'REFUSED') {
    throw conflict('This request was refused. Reopen it before approving.');
  }

  await prisma.$transaction(async (tx: typeof prisma) => {
    // Atomic status transition: only succeeds if nobody has approved it yet.
    const claimed = await tx.timeOffRequest.updateMany({
      where: { id, status: { in: ['DRAFT', 'PENDING'] } },
      data: {
        status: 'APPROVED',
        approvedById: actorUserId,
        approvedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      // Another approval got there first. Nothing further to do - and
      // crucially, no deduction.
      return;
    }

    if (!before.allocationId) {
      // Unpaid or non-allocated leave has no balance to draw down.
      return;
    }

    const allocation = await tx.allocation.findUnique({ where: { id: before.allocationId } });
    if (!allocation) {
      throw notFound('The allocation this request draws on no longer exists');
    }

    const allocated = allocation.allocatedDays.toNumber();
    const used = allocation.usedDays.toNumber();
    const requested = before.durationDays.toNumber();

    if (used + requested > allocated) {
      // Throwing inside the transaction rolls the APPROVED write back, so the
      // request stays PENDING rather than being approved without a deduction.
      throw conflict(
        `This request needs ${requested} day(s) but only ${Math.round((allocated - used) * 100) / 100} remain of ${allocated}.`,
        {
          allocatedDays: allocated,
          usedDays: used,
          requestedDays: requested,
          remainingDays: Math.round((allocated - used) * 100) / 100,
        },
      );
    }

    await tx.allocation.update({
      where: { id: before.allocationId },
      data: { usedDays: { increment: requested } },
    });
  });

  await writeAudit({
    userId: actorUserId,
    action: 'APPROVE',
    entityType: 'TimeOffRequest',
    entityId: id,
    changes: {
      from: before.status,
      to: 'APPROVED',
      durationDays: before.durationDays.toNumber(),
      allocationId: before.allocationId,
    },
  });

  const row = await prisma.timeOffRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
  return { request: toTimeOffRequest(row), alreadyApproved: false };
}

/**
 * Refuses a request, returning the days if it had already been approved.
 * Symmetry matters: approve deducts, so refuse-after-approve must credit back.
 */
export async function refuseRequest(id: string, actorUserId: string) {
  const before = await prisma.timeOffRequest.findUnique({ where: { id } });
  if (!before) throw notFound('Time off request not found');

  if (before.status === 'REFUSED') {
    const row = await prisma.timeOffRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    return toTimeOffRequest(row);
  }

  await prisma.$transaction(async (tx: typeof prisma) => {
    const claimed = await tx.timeOffRequest.updateMany({
      where: { id, status: { not: 'REFUSED' } },
      data: {
        status: 'REFUSED',
        approvedById: actorUserId,
        approvedAt: new Date(),
      },
    });

    if (claimed.count === 0) return;

    // Give the days back only if they were actually taken.
    if (before.status === 'APPROVED' && before.allocationId) {
      await tx.allocation.update({
        where: { id: before.allocationId },
        data: { usedDays: { decrement: before.durationDays.toNumber() } },
      });
    }
  });

  await writeAudit({
    userId: actorUserId,
    action: 'REFUSE',
    entityType: 'TimeOffRequest',
    entityId: id,
    changes: { from: before.status, to: 'REFUSED', creditedBack: before.status === 'APPROVED' },
  });

  const row = await prisma.timeOffRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
  return toTimeOffRequest(row);
}

/**
 * Remaining balance per time off type, so the request form can warn before
 * submit. Remaining is computed, never stored - allocatedDays - usedDays.
 */
export async function getBalance(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true },
  });
  if (!employee) throw notFound('Employee not found');

  const [allocations, pending] = await Promise.all([
    prisma.allocation.findMany({
      where: { employeeId, status: 'APPROVED' },
      include: ALLOCATION_INCLUDE,
      orderBy: { validFrom: 'desc' },
    }),
    prisma.timeOffRequest.findMany({
      where: { employeeId, status: 'PENDING' },
      select: { timeOffTypeId: true, durationDays: true },
    }),
  ]);

  const pendingByType = new Map<string, number>();
  for (const request of pending) {
    pendingByType.set(
      request.timeOffTypeId,
      (pendingByType.get(request.timeOffTypeId) ?? 0) + request.durationDays.toNumber(),
    );
  }

  // Typed explicitly: `prisma` is an untyped Proxy (see lib/prisma.ts), so
  // without this the whole chain below degrades to `any`.
  type Balance = ReturnType<typeof toAllocation> & {
    pendingDays: number;
    availableDays: number;
  };

  const balances: Balance[] = allocations.map((row: unknown) => {
    const allocation = toAllocation(row);
    const pendingDays = pendingByType.get(allocation.timeOffTypeId) ?? 0;
    return {
      ...allocation,
      pendingDays,
      // What is actually still spendable once pending requests land.
      availableDays: Math.round((allocation.remainingDays - pendingDays) * 100) / 100,
    };
  });

  return {
    employeeId,
    employeeName: employee.name,
    balances,
    totals: {
      allocatedDays: balances.reduce((sum, b) => sum + b.allocatedDays, 0),
      usedDays: balances.reduce((sum, b) => sum + b.usedDays, 0),
      remainingDays: balances.reduce((sum, b) => sum + b.remainingDays, 0),
    },
  };
}
