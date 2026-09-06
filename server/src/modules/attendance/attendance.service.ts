import { conflict, forbidden, notFound } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { endOfUtcDay, hoursBetween, parseDateOnly, timeToMinutes } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { toAttendance } from '../../lib/serialize';

/**
 * Attendance, including the check-in / check-out widget.
 *
 * Status is DERIVED from the employee's working schedule, not typed in:
 *   late arrival        -> LATE
 *   under half the shift-> HALF_DAY
 *   otherwise           -> PRESENT
 * and anything left open is MISSING_CHECKOUT until it is closed.
 */

const ATTENDANCE_INCLUDE = {
  employee: { select: { id: true, name: true, employeeCode: true } },
} as const;

/** Grace before a check-in counts as late. */
const LATE_GRACE_MINUTES = 10;
/** A day shorter than this share of the scheduled shift is a half day. */
const HALF_DAY_THRESHOLD = 0.5;
/** Default shift when an employee has no schedule attached. */
const DEFAULT_SHIFT_HOURS = 8;
const DEFAULT_SHIFT_START_MINUTES = 9 * 60;

export interface ListAttendanceFilters {
  employeeId?: string;
  from?: string;
  to?: string;
  status?: string;
}

export async function listAttendance(filters: ListAttendanceFilters, page: PageParams) {
  const where: Record<string, unknown> = {};
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status) where.status = filters.status;

  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.gte = parseDateOnly(filters.from);
    if (filters.to) range.lte = endOfUtcDay(parseDateOnly(filters.to));
    where.checkIn = range;
  }

  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: ATTENDANCE_INCLUDE,
      orderBy: { checkIn: 'desc' },
      skip: page.skip,
      take: page.take,
    }),
    prisma.attendance.count({ where }),
  ]);

  return { data: rows.map(toAttendance), total };
}

/**
 * The scheduled shift for a given weekday, or a sane default.
 * Returns minutes-since-midnight for the start, and the paid hours expected.
 */
async function shiftFor(
  employeeId: string,
  when: Date,
): Promise<{ startMinutes: number; expectedHours: number }> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      workingSchedule: { include: { lines: true } },
    },
  });

  const lines = employee?.workingSchedule?.lines ?? [];
  const today = lines.find(
    (line: { dayOfWeek: number }) => line.dayOfWeek === when.getUTCDay(),
  );

  if (!today) {
    return { startMinutes: DEFAULT_SHIFT_START_MINUTES, expectedHours: DEFAULT_SHIFT_HOURS };
  }

  const startMinutes = timeToMinutes(today.startTime);
  const paidMinutes = timeToMinutes(today.endTime) - startMinutes - (today.breakMinutes ?? 0);

  return {
    startMinutes,
    expectedHours: Math.max(paidMinutes, 0) / 60,
  };
}

/** The open session for an employee, or null. Feeds the widget's state. */
export async function activeSession(employeeId: string) {
  const row = await prisma.attendance.findFirst({
    where: { employeeId, checkOut: null },
    include: ATTENDANCE_INCLUDE,
    orderBy: { checkIn: 'desc' },
  });

  return row ? toAttendance(row) : null;
}

/** Total hours already logged today, so the widget can show "today's total". */
export async function todayTotals(employeeId: string) {
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );

  const rows = await prisma.attendance.findMany({
    where: { employeeId, checkIn: { gte: dayStart, lte: endOfUtcDay(dayStart) } },
    select: { workedHours: true, overtimeHours: true },
  });

  const worked = rows.reduce(
    (sum: number, row: { workedHours: { toNumber(): number } }) => sum + row.workedHours.toNumber(),
    0,
  );
  const overtime = rows.reduce(
    (sum: number, row: { overtimeHours: { toNumber(): number } }) =>
      sum + row.overtimeHours.toNumber(),
    0,
  );

  return {
    workedHours: Math.round(worked * 100) / 100,
    overtimeHours: Math.round(overtime * 100) / 100,
    sessions: rows.length,
  };
}

/**
 * Opens a session. Rejects with 409 when one is already open - double
 * check-in is the fastest way to corrupt a day's hours.
 */
export async function checkIn(employeeId: string, actorUserId: string) {
  const open = await prisma.attendance.findFirst({
    where: { employeeId, checkOut: null },
  });

  if (open) {
    throw conflict(
      `You are already checked in (since ${open.checkIn.toISOString()}). Check out before starting a new session.`,
    );
  }

  const now = new Date();
  const { startMinutes } = await shiftFor(employeeId, now);
  const arrivalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const created = await prisma.attendance.create({
    data: {
      employeeId,
      checkIn: now,
      checkOut: null,
      workedHours: 0,
      overtimeHours: 0,
      // Provisional. check-out re-derives it once the duration is known; a row
      // is never left without a status, because status is not nullable.
      status: arrivalMinutes > startMinutes + LATE_GRACE_MINUTES ? 'LATE' : 'PRESENT',
    },
    include: ATTENDANCE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CHECK_IN',
    entityType: 'Attendance',
    entityId: created.id,
    changes: { employeeId, checkIn: created.checkIn.toISOString() },
  });

  return toAttendance(created);
}

/**
 * Closes the open session, computing worked and overtime hours against the
 * scheduled shift.
 */
export async function checkOut(employeeId: string, actorUserId: string) {
  const open = await prisma.attendance.findFirst({
    where: { employeeId, checkOut: null },
    orderBy: { checkIn: 'desc' },
  });

  if (!open) {
    throw conflict('You are not checked in, so there is nothing to check out of.');
  }

  const now = new Date();
  const { startMinutes, expectedHours } = await shiftFor(employeeId, open.checkIn);

  const workedHours = Math.max(hoursBetween(open.checkIn, now), 0);
  const overtimeHours = Math.max(Math.round((workedHours - expectedHours) * 100) / 100, 0);

  const arrivalMinutes = open.checkIn.getUTCHours() * 60 + open.checkIn.getUTCMinutes();
  const wasLate = arrivalMinutes > startMinutes + LATE_GRACE_MINUTES;

  let status: string;
  if (expectedHours > 0 && workedHours < expectedHours * HALF_DAY_THRESHOLD) {
    status = 'HALF_DAY';
  } else if (wasLate) {
    status = 'LATE';
  } else {
    status = 'PRESENT';
  }

  const updated = await prisma.attendance.update({
    where: { id: open.id },
    data: {
      checkOut: now,
      workedHours,
      overtimeHours,
      status: status as never,
    },
    include: ATTENDANCE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CHECK_OUT',
    entityType: 'Attendance',
    entityId: open.id,
    changes: { workedHours, overtimeHours, status },
  });

  return toAttendance(updated);
}

export interface CreateAttendanceInput {
  employeeId: string;
  checkIn: string;
  checkOut?: string | null;
  workedHours?: number;
  overtimeHours?: number;
  status?: string;
  notes?: string | null;
}

/** Manual entry by HR. Always flagged as manually edited. */
export async function createAttendance(input: CreateAttendanceInput, actorUserId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw notFound('That employee does not exist');

  const checkIn = new Date(input.checkIn);
  const checkOut = input.checkOut ? new Date(input.checkOut) : null;

  if (checkOut && checkOut.getTime() <= checkIn.getTime()) {
    throw conflict('Check-out must be after check-in');
  }

  const workedHours =
    input.workedHours ?? (checkOut ? Math.max(hoursBetween(checkIn, checkOut), 0) : 0);

  const created = await prisma.attendance.create({
    data: {
      employeeId: input.employeeId,
      checkIn,
      checkOut,
      workedHours,
      overtimeHours: input.overtimeHours ?? 0,
      status: (input.status ?? (checkOut ? 'PRESENT' : 'MISSING_CHECKOUT')) as never,
      notes: input.notes ?? null,
      isManuallyEdited: true,
    },
    include: ATTENDANCE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'Attendance',
    entityId: created.id,
    changes: { employeeId: input.employeeId, checkIn: input.checkIn, manual: true },
  });

  return toAttendance(created);
}

/**
 * HR correction. Sets `isManuallyEdited = true` and writes an audit row -
 * a corrected attendance record must always be distinguishable from one the
 * employee clocked themselves.
 */
export async function updateAttendance(
  id: string,
  input: Partial<CreateAttendanceInput>,
  actorUserId: string,
) {
  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) throw notFound('Attendance record not found');

  if (input.employeeId && input.employeeId !== existing.employeeId) {
    throw forbidden('An attendance record cannot be moved to a different employee');
  }

  const checkIn = input.checkIn ? new Date(input.checkIn) : existing.checkIn;
  const checkOut =
    input.checkOut === undefined
      ? existing.checkOut
      : input.checkOut === null
        ? null
        : new Date(input.checkOut);

  if (checkOut && checkOut.getTime() <= checkIn.getTime()) {
    throw conflict('Check-out must be after check-in');
  }

  const data: Record<string, unknown> = { isManuallyEdited: true };
  if (input.checkIn !== undefined) data.checkIn = checkIn;
  if (input.checkOut !== undefined) data.checkOut = checkOut;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.status !== undefined) data.status = input.status;

  // Recompute hours whenever a boundary moved and the caller did not override.
  if (input.workedHours !== undefined) {
    data.workedHours = input.workedHours;
  } else if (input.checkIn !== undefined || input.checkOut !== undefined) {
    data.workedHours = checkOut ? Math.max(hoursBetween(checkIn, checkOut), 0) : 0;
  }
  if (input.overtimeHours !== undefined) data.overtimeHours = input.overtimeHours;

  const updated = await prisma.attendance.update({
    where: { id },
    data,
    include: ATTENDANCE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CORRECT',
    entityType: 'Attendance',
    entityId: id,
    changes: { ...data, previousStatus: existing.status },
  });

  return toAttendance(updated);
}
