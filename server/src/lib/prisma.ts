import { AppError } from '../http/errors';
import { logger } from './logger';

/**
 * Prisma client accessor.
 *
 * `prisma/schema.prisma` is owned by Person 1 and may not exist yet, in which
 * case `@prisma/client` has nothing generated and throws on import. Loading it
 * eagerly would stop this server from booting at all - so we load it lazily
 * behind a Proxy instead. The process starts, health checks pass, the
 * permission wall is curl-testable, and only an actual database call fails,
 * with a message that says exactly what to run.
 *
 * Once the schema lands:
 *   npm run prisma:generate
 * and this file needs no changes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = any;

let client: PrismaClientLike | null = null;
let loadFailure: string | null = null;

function loadClient(): PrismaClientLike {
  if (client) return client;

  if (loadFailure) {
    throw new AppError('SERVER_ERROR', loadFailure);
  }

  try {
    // Required lazily on purpose - see the note above.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { PrismaClient } = require('@prisma/client');
    client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    logger.info('[prisma] client initialised');
    return client as PrismaClientLike;
  } catch (error) {
    loadFailure =
      'Prisma client is not generated yet. Once prisma/schema.prisma exists, run: npm run prisma:generate';
    logger.warn(`[prisma] ${loadFailure}`, error instanceof Error ? error.message : error);
    throw new AppError('SERVER_ERROR', loadFailure);
  }
}

/**
 * Use exactly like a PrismaClient: `prisma.employee.findMany(...)`.
 * The underlying client is created on first property access.
 */
export const prisma: PrismaClientLike = new Proxy(
  {},
  {
    get(_target, property, receiver) {
      const real = loadClient();
      const value = Reflect.get(real, property, receiver);
      return typeof value === 'function' ? value.bind(real) : value;
    },
  },
);

/** True when the generated client is importable - handy for the health route. */
export function isPrismaAvailable(): boolean {
  try {
    loadClient();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
