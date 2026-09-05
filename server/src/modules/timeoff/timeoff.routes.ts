import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { scopeToSelf } from '../../middleware/scopeToSelf';

/**
 * TODO (timeoff.service.ts):
 *   listTypes / createType
 *   listAllocations / createAllocation / approveAllocation
 *   listRequests / createRequest / approveRequest / refuseRequest
 *   getBalance(employeeId) -> allocatedDays - usedDays, never stored twice
 *
 * approveRequest is the one judges poke at. Inside a single database
 * TRANSACTION: re-read the request, no-op if it is already APPROVED, else set
 * APPROVED and increment allocation.usedDays by durationDays - rejecting with
 * 409 when usedDays + durationDays > allocatedDays. Approving twice must not
 * double-deduct.
 */
export const timeoffRouter = Router();

timeoffRouter.use(requireAuth);

// --- Types -----------------------------------------------------------------
timeoffRouter.get(
  '/types',
  asyncHandler(async () => {
    throw notImplemented('GET /timeoff/types');
  }),
);

timeoffRouter.post(
  '/types',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /timeoff/types');
  }),
);

// --- Allocations -----------------------------------------------------------
timeoffRouter.get(
  '/allocations',
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async () => {
    throw notImplemented('GET /timeoff/allocations');
  }),
);

timeoffRouter.post(
  '/allocations',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /timeoff/allocations');
  }),
);

timeoffRouter.post(
  '/allocations/:id/approve',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /timeoff/allocations/:id/approve');
  }),
);

// --- Requests --------------------------------------------------------------
timeoffRouter.get(
  '/requests',
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async () => {
    throw notImplemented('GET /timeoff/requests');
  }),
);

timeoffRouter.post(
  '/requests',
  scopeToSelf({ body: 'employeeId', query: false }),
  asyncHandler(async () => {
    throw notImplemented('POST /timeoff/requests');
  }),
);

timeoffRouter.post(
  '/requests/:id/approve',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /timeoff/requests/:id/approve');
  }),
);

timeoffRouter.post(
  '/requests/:id/refuse',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /timeoff/requests/:id/refuse');
  }),
);

// --- Balance ---------------------------------------------------------------
timeoffRouter.get(
  '/balance/:employeeId',
  scopeToSelf({ param: 'employeeId' }),
  asyncHandler(async () => {
    throw notImplemented('GET /timeoff/balance/:employeeId');
  }),
);
