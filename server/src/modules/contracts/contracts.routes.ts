import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { scopeToSelf } from '../../middleware/scopeToSelf';

/**
 * TODO (contracts.service.ts):
 *   listContracts({ employeeId, status })
 *   createContract / updateContract
 *
 * Both writes must call validateNoOverlappingContracts() from
 * core/contract-resolution.ts BEFORE persisting, and throw CONFLICT when the
 * new range overlaps an existing RUNNING contract for that employee.
 */
export const contractsRouter = Router();

contractsRouter.use(requireAuth);

contractsRouter.get(
  '/',
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async () => {
    throw notImplemented('GET /contracts');
  }),
);

contractsRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /contracts');
  }),
);

contractsRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('PATCH /contracts/:id');
  }),
);
