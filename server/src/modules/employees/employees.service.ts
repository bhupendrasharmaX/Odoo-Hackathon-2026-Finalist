import { conflict, notFound } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { toEmployee } from '../../lib/serialize';

/**
 * Employees.
 *
 * The scoping note that matters: for an EMPLOYEE caller, `scopeToSelf` writes
 * their own id into `req.query.employeeId`. `listEmployees` honours it and
 * narrows to a single row - the filter is not optional just because the query
 * string looked empty when the request arrived.
 */

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, name: true, code: true } },
  manager: { select: { id: true, name: true } },
} as const;

export interface ListEmployeeFilters {
  search?: string;
  department?: string;
  status?: string;
  type?: string;
  /** Set by scopeToSelf for an EMPLOYEE caller. Narrows to exactly one row. */
  employeeId?: string;
}

export async function listEmployees(filters: ListEmployeeFilters, page: PageParams) {
  const where: Record<string, unknown> = {};

  // Self-scoping wins over every other filter.
  if (filters.employeeId) {
    where.id = filters.employeeId;
  }

  if (filters.status) where.status = filters.status;
  if (filters.type) where.employeeType = filters.type;

  if (filters.department) {
    // Accept either a department id or its name, so the UI can pass whichever
    // it has without a lookup round trip.
    where.OR = [
      { departmentId: filters.department },
      { department: { name: { equals: filters.department, mode: 'insensitive' } } },
      { department: { code: { equals: filters.department, mode: 'insensitive' } } },
    ];
  }

  if (filters.search) {
    const search = filters.search;
    const searchClause = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeCode: { contains: search, mode: 'insensitive' } },
      { jobPosition: { contains: search, mode: 'insensitive' } },
    ];
    // AND them together so search narrows the department filter rather than
    // widening it - two bare ORs on the same object would overwrite.
    where.AND = [...((where.AND as unknown[]) ?? []), { OR: searchClause }];
  }

  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: EMPLOYEE_INCLUDE,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.employee.count({ where }),
  ]);

  return { data: rows.map(toEmployee), total };
}

export async function getEmployee(id: string) {
  const row = await prisma.employee.findUnique({
    where: { id },
    include: EMPLOYEE_INCLUDE,
  });

  if (!row) throw notFound('Employee not found');

  return toEmployee(row);
}

export interface CreateEmployeeInput {
  employeeCode: string;
  name: string;
  email: string;
  phone?: string | null;
  departmentId: string;
  jobPosition?: string | null;
  managerId?: string | null;
  workingScheduleId?: string | null;
  employeeType?: string;
  status?: string;
  bankAccount?: string | null;
  avatarUrl?: string | null;
}

export async function createEmployee(input: CreateEmployeeInput, actorUserId: string) {
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw notFound('That department does not exist');

  if (input.managerId) {
    const manager = await prisma.employee.findUnique({ where: { id: input.managerId } });
    if (!manager) throw notFound('That manager does not exist');
  }

  if (input.workingScheduleId) {
    const schedule = await prisma.workingSchedule.findUnique({
      where: { id: input.workingScheduleId },
    });
    if (!schedule) throw notFound('That working schedule does not exist');
  }

  const created = await prisma.employee.create({
    data: {
      employeeCode: input.employeeCode.trim(),
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone ?? null,
      departmentId: input.departmentId,
      jobPosition: input.jobPosition ?? null,
      managerId: input.managerId ?? null,
      workingScheduleId: input.workingScheduleId ?? null,
      employeeType: (input.employeeType ?? 'FULL_TIME') as never,
      status: (input.status ?? 'ACTIVE') as never,
      bankAccount: input.bankAccount ?? null,
      avatarUrl: input.avatarUrl ?? null,
    },
    include: EMPLOYEE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'Employee',
    entityId: created.id,
    changes: { employeeCode: created.employeeCode, name: created.name },
  });

  return toEmployee(created);
}

export async function updateEmployee(
  id: string,
  input: Partial<CreateEmployeeInput>,
  actorUserId: string,
) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) throw notFound('Employee not found');

  if (input.managerId) {
    if (input.managerId === id) {
      throw conflict('An employee cannot be their own manager');
    }
    const manager = await prisma.employee.findUnique({ where: { id: input.managerId } });
    if (!manager) throw notFound('That manager does not exist');
  }

  if (input.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw notFound('That department does not exist');
  }

  // Build the patch from present keys only, so an omitted field is left alone
  // rather than nulled.
  const data: Record<string, unknown> = {};
  const assign = <K extends keyof CreateEmployeeInput>(key: K): void => {
    if (input[key] !== undefined) data[key as string] = input[key];
  };

  (
    [
      'employeeCode',
      'name',
      'email',
      'phone',
      'departmentId',
      'jobPosition',
      'managerId',
      'workingScheduleId',
      'employeeType',
      'status',
      'bankAccount',
      'avatarUrl',
    ] as const
  ).forEach(assign);

  if (typeof data.email === 'string') data.email = data.email.toLowerCase().trim();
  if (typeof data.name === 'string') data.name = data.name.trim();

  const updated = await prisma.employee.update({
    where: { id },
    data,
    include: EMPLOYEE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'UPDATE',
    entityType: 'Employee',
    entityId: id,
    changes: data,
  });

  return toEmployee(updated);
}

/**
 * Smart-button counts for the employee form.
 *
 * Six parallel counts rather than one query with six joins: each is an index
 * lookup, and a join fan-out would multiply rows before counting them.
 */
export async function getEmployeeSummary(id: string) {
  const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
  if (!employee) throw notFound('Employee not found');

  const [contracts, attendance, timeOff, allocations, payslips, grievances] = await Promise.all([
    prisma.contract.count({ where: { employeeId: id } }),
    prisma.attendance.count({ where: { employeeId: id } }),
    prisma.timeOffRequest.count({ where: { employeeId: id } }),
    prisma.allocation.count({ where: { employeeId: id } }),
    prisma.payslip.count({ where: { employeeId: id } }),
    prisma.grievance.count({ where: { employeeId: id } }),
  ]);

  return { employeeId: id, contracts, attendance, timeOff, allocations, payslips, grievances };
}

/** Departments, with live headcount. Feeds the kanban grouping and filters. */
export async function listDepartments() {
  const rows = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });

  return rows.map((row: { id: string; name: string; code: string; _count: { employees: number } }) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    headcount: row._count.employees,
  }));
}
