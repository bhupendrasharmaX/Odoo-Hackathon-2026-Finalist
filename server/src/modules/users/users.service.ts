import { ROLES, type Role } from '../../config/roles';
import { conflict, forbidden, notFound, validationError } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { toUser } from '../../lib/serialize';
import { hashPassword } from '../auth/auth.service';

/**
 * User administration. ADMIN only - the router gates that.
 *
 * The rule worth reading twice is in `changeRole`: nobody may change their own
 * role, ADMIN included. An admin who could demote or promote themselves makes
 * the whole role system advisory.
 */

export interface ListUsersFilters {
  search?: string;
  role?: Role;
}

export async function listUsers(filters: ListUsersFilters, page: PageParams) {
  const where: Record<string, unknown> = {};

  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.user.count({ where }),
  ]);

  return { data: rows.map(toUser), total };
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  employeeId?: string | null;
}

export async function createUser(input: CreateUserInput, actorUserId: string) {
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw conflict('A user with this email already exists');
  }

  if (input.employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) {
      throw notFound('That employee does not exist');
    }

    // User.employeeId is @unique - one login per employee.
    const linked = await prisma.user.findUnique({ where: { employeeId: input.employeeId } });
    if (linked) {
      throw conflict(`${employee.name} already has a login (${linked.email})`);
    }
  }

  const created = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      role: input.role,
      employeeId: input.employeeId ?? null,
      passwordHash: await hashPassword(input.password),
    },
    include: { employee: { select: { id: true, name: true, employeeCode: true } } },
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'User',
    entityId: created.id,
    changes: { email: created.email, role: created.role, employeeId: created.employeeId },
  });

  return toUser(created);
}

/**
 * Assigns a role.
 *
 * THE SELF-ROLE RULE: a caller may never change their own role. This is
 * checked against the authenticated user id, not against anything in the
 * request body, so it cannot be worked around by spoofing a field.
 */
export async function changeRole(targetUserId: string, role: Role, actorUserId: string) {
  if (targetUserId === actorUserId) {
    throw forbidden(
      'You cannot change your own role. Ask another administrator to do it.',
    );
  }

  if (!(ROLES as readonly string[]).includes(role)) {
    throw validationError(`"${role}" is not a valid role`);
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw notFound('User not found');
  }

  if (target.role === role) {
    // Idempotent: re-assigning the same role is a no-op, not an error.
    return toUser(target);
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    include: { employee: { select: { id: true, name: true, employeeCode: true } } },
  });

  await writeAudit({
    userId: actorUserId,
    action: 'ROLE_CHANGE',
    entityType: 'User',
    entityId: targetUserId,
    changes: { from: target.role, to: role },
  });

  return toUser(updated);
}
