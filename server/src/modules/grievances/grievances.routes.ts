import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { scopeToSelf } from '../../middleware/scopeToSelf';

/**
 * TODO (grievances.service.ts):
 *   listGrievances({ employeeId, status })
 *   createGrievance  -> raised by the employee, optionally against a payslip
 *   resolveGrievance -> status + response, records resolvedById / resolvedAt
 */
export const grievancesRouter = Router();

grievancesRouter.use(requireAuth);

grievancesRouter.get(
  '/',
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async () => {
    throw notImplemented('GET /grievances');
  }),
);

grievancesRouter.post(
  '/',
  scopeToSelf({ body: 'employeeId', query: false }),
  asyncHandler(async () => {
    throw notImplemented('POST /grievances');
  }),
);

grievancesRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.GRIEVANCE_RESOLVE),
  asyncHandler(async () => {
    throw notImplemented('PATCH /grievances/:id');
  }),
);
