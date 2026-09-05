import type { Request } from 'express';
import type { Meta } from './envelope';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PageParams {
  page: number;
  limit: number;
  /** Ready to spread into a Prisma `findMany`. */
  skip: number;
  take: number;
}

/**
 * Reads `?page=` and `?limit=` off the query string, clamped to sane values so
 * a caller cannot ask for 100000 rows.
 */
export function readPageParams(req: Request): PageParams {
  const rawPage = Number.parseInt(String(req.query.page ?? ''), 10);
  const rawLimit = Number.parseInt(String(req.query.limit ?? ''), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function buildMeta(params: PageParams, total: number): Meta {
  return { page: params.page, limit: params.limit, total };
}
