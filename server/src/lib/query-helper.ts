/**
 * Database query pagination and date filtering helpers for PeoplePay360 services.
 * Standardizes API list endpoints without mutating incoming params.
 */

export interface PaginationInput {
  page?: string | number;
  limit?: string | number;
  maxLimit?: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

/**
 * Parses pagination query parameters safely with fallback defaults.
 */
export function parsePagination(input: PaginationInput = {}): PaginationResult {
  const max = input.maxLimit ?? 100;
  let page = Number(input.page) || 1;
  let limit = Number(input.limit) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 20;
  if (limit > max) limit = max;

  const skip = (page - 1) * limit;

  return {
    skip,
    take: limit,
    page,
    limit,
  };
}

/**
 * Builds Prisma-compatible date range filters for month-end and payroll cycles.
 */
export function buildDateRangeFilter(startDate?: string | Date, endDate?: string | Date) {
  if (!startDate && !endDate) return undefined;

  const filter: { gte?: Date; lte?: Date } = {};

  if (startDate) {
    const s = typeof startDate === 'string' ? new Date(startDate) : startDate;
    if (!isNaN(s.getTime())) filter.gte = s;
  }

  if (endDate) {
    const e = typeof endDate === 'string' ? new Date(endDate) : endDate;
    if (!isNaN(e.getTime())) filter.lte = e;
  }

  return Object.keys(filter).length > 0 ? filter : undefined;
}
