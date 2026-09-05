import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { scopeToSelf } from '../../middleware/scopeToSelf';

/**
 * TODO (employees.service.ts):
 *   listEmployees({ search, department, status, type, page, limit })
 *   createEmployee / getEmployee / updateEmployee
 *   getEmployeeSummary(id) -> smart-button counts:
 *     { contracts, attendance, timeOff, allocations, payslips }
 *
 * Scoping note: for an EMPLOYEE caller, scopeToSelf writes their own id into
 * `req.query.employeeId`. listEmployees must honour that and narrow to a
 * single row - the filter is not optional just because the query looked empty.
 */
export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get(
  '/',
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async () => {
    throw notImplemented('GET /employees');
  }),
);

employeesRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /employees');
  }),
);

employeesRouter.get(
  '/:id',
  scopeToSelf({ param: 'id' }),
  asyncHandler(async () => {
    throw notImplemented('GET /employees/:id');
  }),
);

employeesRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('PATCH /employees/:id');
  }),
);

employeesRouter.get(
  '/:id/summary',
  scopeToSelf({ param: 'id' }),
  asyncHandler(async () => {
    throw notImplemented('GET /employees/:id/summary');
  }),
);
