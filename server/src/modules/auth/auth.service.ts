import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { isRole, type Role } from '../../config/roles';
import { unauthorized } from '../../http/errors';
import { prisma } from '../../lib/prisma';
import type { AccessTokenPayload } from '../../types/auth';

/**
 * Authentication.
 *
 * The token carries { userId, employeeId, role, email, name } - everything
 * every downstream guard needs, so a permission check never costs a database
 * round trip. It is signed, so a client editing `role` in localStorage gets a
 * 401 at `requireAuth`, not elevated access.
 */

const BCRYPT_ROUNDS = 10;

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    role: Role;
    employeeId: string | null;
    name: string;
  };
}

function signToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verifies credentials and issues a 24h token.
 *
 * The same message is returned for an unknown email and a wrong password, on
 * purpose: distinguishing them turns the login form into an account
 * enumeration oracle.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    // Spend roughly the same time as a real compare would, so response timing
    // does not leak whether the address exists.
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    throw unauthorized('Incorrect email or password');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw unauthorized('Incorrect email or password');
  }

  if (!isRole(user.role)) {
    throw unauthorized('This account has an unrecognised role - contact an administrator');
  }

  const payload: AccessTokenPayload = {
    userId: user.id,
    employeeId: user.employeeId ?? null,
    role: user.role,
    email: user.email,
    name: user.name,
  };

  return {
    token: signToken(payload),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? null,
      name: user.name,
    },
  };
}

/**
 * Current user, re-read from the database rather than echoed from the token.
 *
 * That matters: an admin can change someone's role mid-session, and `/auth/me`
 * is how the frontend notices. The token still carries the old role until it
 * expires - the backend re-checks on every request anyway, so this only makes
 * the UI agree with reality sooner.
 */
export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: {
        include: { department: true },
      },
    },
  });

  if (!user) {
    throw unauthorized('This account no longer exists');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeId: user.employeeId ?? null,
    employee: user.employee
      ? {
          id: user.employee.id,
          employeeCode: user.employee.employeeCode,
          name: user.employee.name,
          departmentId: user.employee.departmentId,
          departmentName: user.employee.department?.name ?? null,
          jobPosition: user.employee.jobPosition ?? null,
          avatarUrl: user.employee.avatarUrl ?? null,
        }
      : null,
  };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
