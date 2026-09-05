import { prisma } from './prisma';
import { logger } from './logger';

/**
 * AuditLog writer.
 *
 * Every approval, correction, validation and payroll state change writes one
 * row: who did it, what they did, to which entity, and what changed.
 *
 * Deliberately non-throwing. An audit write failing must never roll back the
 * business action that succeeded - a leave approval that worked but whose log
 * row failed is a monitoring problem, not a reason to tell the user their
 * approval did not happen. It is logged loudly instead.
 *
 * When you need the log and the action to be atomic, pass the transaction
 * client as `tx` and the write joins that transaction.
 */

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'APPROVE'
  | 'REFUSE'
  | 'REJECT'
  | 'CORRECT'
  | 'COMPUTE'
  | 'VALIDATE'
  | 'MARK_PAID'
  | 'SEND_PAYSLIPS'
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'ROLE_CHANGE'
  | 'RESOLVE';

export interface AuditEntry {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: unknown;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function writeAudit(entry: AuditEntry, tx?: any): Promise<void> {
  const client = tx ?? prisma;

  try {
    await client.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        // entityId is VarChar(30); a cuid is 25, but never let a long id throw.
        entityId: String(entry.entityId).slice(0, 30),
        changes: (entry.changes ?? {}) as any,
      },
    });
  } catch (error) {
    logger.error(
      `[audit] failed to record ${entry.action} on ${entry.entityType} ${entry.entityId}`,
      error instanceof Error ? error.message : error,
    );
  }
}

/** Reads the audit trail for one entity, newest first. */
export async function readAuditTrail(entityType: string, entityId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
}
