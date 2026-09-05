import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';

/**
 * TODO (schedules.service.ts):
 *   listSchedules / createSchedule / getSchedule / updateSchedule
 *
 * Weekly hours are DERIVED from ScheduleLine rows (dayOfWeek, startTime,
 * endTime, breakMinutes) - never stored as a user-entered field.
 */
export const schedulesRouter = Router();

schedulesRouter.use(requireAuth);

schedulesRouter.get(
  '/',
  asyncHandler(async () => {
    throw notImplemented('GET /schedules');
  }),
);

schedulesRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /schedules');
  }),
);

schedulesRouter.get(
  '/:id',
  asyncHandler(async () => {
    throw notImplemented('GET /schedules/:id');
  }),
);

schedulesRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('PATCH /schedules/:id');
  }),
);
