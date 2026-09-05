import { notFound, validationError } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { toSchedule } from '../../lib/serialize';

/**
 * Working schedules.
 *
 * Total weekly hours are DERIVED from the lines by `toSchedule`, never stored.
 * A stored total is a second source of truth that goes stale the moment
 * somebody edits a line and forgets to recompute it.
 */

const SCHEDULE_INCLUDE = {
  lines: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
  _count: { select: { employees: true } },
} as const;

export interface ScheduleLineInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
}

/** "HH:MM" and "HH:MM:SS" both arrive from forms; store the padded form. */
function normaliseTime(value: string): string {
  const parts = value.split(':');
  const [h = '00', m = '00', s = '00'] = parts;
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

function assertLinesValid(lines: readonly ScheduleLineInput[]): void {
  for (const line of lines) {
    if (line.dayOfWeek < 0 || line.dayOfWeek > 6) {
      throw validationError('dayOfWeek must be 0 (Sunday) to 6 (Saturday)');
    }
    const start = normaliseTime(line.startTime);
    const end = normaliseTime(line.endTime);
    if (end <= start) {
      throw validationError(
        `A shift on day ${line.dayOfWeek} ends at ${end}, which is not after its ${start} start`,
      );
    }
  }
}

export async function listSchedules(page: PageParams) {
  const [rows, total] = await Promise.all([
    prisma.workingSchedule.findMany({
      include: SCHEDULE_INCLUDE,
      orderBy: { name: 'asc' },
      skip: page.skip,
      take: page.take,
    }),
    prisma.workingSchedule.count(),
  ]);

  return { data: rows.map(toSchedule), total };
}

export async function getSchedule(id: string) {
  const row = await prisma.workingSchedule.findUnique({
    where: { id },
    include: SCHEDULE_INCLUDE,
  });
  if (!row) throw notFound('Working schedule not found');
  return toSchedule(row);
}

export async function createSchedule(
  input: { name: string; lines?: ScheduleLineInput[] },
  actorUserId: string,
) {
  const lines = input.lines ?? [];
  assertLinesValid(lines);

  const created = await prisma.workingSchedule.create({
    data: {
      name: input.name.trim(),
      lines: {
        create: lines.map((line) => ({
          dayOfWeek: line.dayOfWeek,
          startTime: normaliseTime(line.startTime),
          endTime: normaliseTime(line.endTime),
          breakMinutes: line.breakMinutes ?? 0,
        })),
      },
    },
    include: SCHEDULE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'WorkingSchedule',
    entityId: created.id,
    changes: { name: created.name, lineCount: lines.length },
  });

  return toSchedule(created);
}

/**
 * Updating lines REPLACES the whole set rather than patching individually.
 *
 * A schedule is edited as one grid in the UI - a per-line diff API would make
 * "delete Wednesday" a three-call dance with a half-saved state in between.
 * Wrapped in a transaction so a failure cannot leave a schedule with no lines.
 */
export async function updateSchedule(
  id: string,
  input: { name?: string; lines?: ScheduleLineInput[] },
  actorUserId: string,
) {
  const existing = await prisma.workingSchedule.findUnique({ where: { id } });
  if (!existing) throw notFound('Working schedule not found');

  if (input.lines) assertLinesValid(input.lines);

  const updated = await prisma.$transaction(async (tx: typeof prisma) => {
    if (input.name !== undefined) {
      await tx.workingSchedule.update({ where: { id }, data: { name: input.name.trim() } });
    }

    if (input.lines) {
      await tx.scheduleLine.deleteMany({ where: { workingScheduleId: id } });
      if (input.lines.length > 0) {
        await tx.scheduleLine.createMany({
          data: input.lines.map((line) => ({
            workingScheduleId: id,
            dayOfWeek: line.dayOfWeek,
            startTime: normaliseTime(line.startTime),
            endTime: normaliseTime(line.endTime),
            breakMinutes: line.breakMinutes ?? 0,
          })),
        });
      }
    }

    return tx.workingSchedule.findUnique({ where: { id }, include: SCHEDULE_INCLUDE });
  });

  await writeAudit({
    userId: actorUserId,
    action: 'UPDATE',
    entityType: 'WorkingSchedule',
    entityId: id,
    changes: { name: input.name, lineCount: input.lines?.length },
  });

  return toSchedule(updated);
}
