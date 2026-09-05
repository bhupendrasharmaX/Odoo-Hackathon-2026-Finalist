import { Router } from 'express';
import { z } from 'zod';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { sendCreated, sendData, sendList } from '../../http/envelope';
import { unauthorized } from '../../http/errors';
import { buildMeta, readPageParams } from '../../http/pagination';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { scopeToSelf } from '../../middleware/scopeToSelf';
import { validate } from '../../middleware/validate';
import {
  createEmployee,
  getEmployee,
  getEmployeeSummary,
  listDepartments,
  listEmployees,
  updateEmployee,
} from './employees.service';

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

const employeeType = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);
const employeeStatus = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);

/**
 * Departments live here rather than at a top-level /departments, because the
 * shared contract locks the endpoint list and does not include one. The UI
 * needs them for the kanban grouping and the employee form, and a sub-path of
 * an existing module adds no new top-level surface.
 *
 * Declared before `/:id` so the literal path wins the match.
 */
employeesRouter.get(
  '/departments',
  asyncHandler(async (_req, res) => {
    sendData(res, await listDepartments());
  }),
);

const listQuery = z.object({
  search: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  status: employeeStatus.optional(),
  type: employeeType.optional(),
  employeeId: z.string().trim().min(1).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// validate runs BEFORE scopeToSelf: the schema strips unknown keys, and
// scopeToSelf then writes the caller's own id in afterwards, so an EMPLOYEE
// cannot smuggle a wider filter past either one.
employeesRouter.get(
  '/',
  validate({ query: listQuery }),
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listEmployees(
      {
        search: req.query.search as string | undefined,
        department: req.query.department as string | undefined,
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
        employeeId: req.query.employeeId as string | undefined,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

const createBody = z.object({
  employeeCode: z.string().trim().min(1, 'Employee code is required').max(30),
  name: z.string().trim().min(1, 'Name is required').max(150),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().trim().max(30).nullish(),
  departmentId: z.string().trim().min(1, 'Department is required'),
  jobPosition: z.string().trim().max(100).nullish(),
  managerId: z.string().trim().min(1).nullish(),
  workingScheduleId: z.string().trim().min(1).nullish(),
  employeeType: employeeType.default('FULL_TIME'),
  status: employeeStatus.default('ACTIVE'),
  bankAccount: z.string().trim().max(60).nullish(),
  avatarUrl: z.string().trim().max(255).nullish(),
});

employeesRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createEmployee(req.body, req.user.userId), 'Employee created');
  }),
);

employeesRouter.get(
  '/:id',
  scopeToSelf({ param: 'id', query: false }),
  asyncHandler(async (req, res) => {
    sendData(res, await getEmployee(req.params.id!));
  }),
);

employeesRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({ body: createBody.partial() }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await updateEmployee(req.params.id!, req.body, req.user.userId), 'Employee updated');
  }),
);

employeesRouter.get(
  '/:id/summary',
  scopeToSelf({ param: 'id', query: false }),
  asyncHandler(async (req, res) => {
    sendData(res, await getEmployeeSummary(req.params.id!));
  }),
);
