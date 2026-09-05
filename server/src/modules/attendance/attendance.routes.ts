import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { scopeToSelf } from '../../middleware/scopeToSelf';

/**
 * TODO (attendance.service.ts):
 *   listAttendance({ employeeId, from, to })
 *   checkIn(employeeId)   -> 409 CONFLICT if an open session already exists
 *   checkOut(employeeId)  -> close the open session, compute workedHours,
 *                            compare against the WorkingSchedule to set
 *                            PRESENT / LATE / HALF_DAY, compute overtimeHours
 *   getActiveSession(employeeId) -> the open session or null (widget polls this)
 *   createManual / correctEntry -> HR+ only, sets isManuallyEdited = true and
 *                                  writes an AuditLog row
 */
export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

// Specific paths before parameterised ones.
attendanceRouter.get(
  '/active',
  asyncHandler(async () => {
    throw notImplemented('GET /attendance/active');
  }),
);

attendanceRouter.post(
  '/check-in',
  asyncHandler(async () => {
    throw notImplemented('POST /attendance/check-in');
  }),
);

attendanceRouter.post(
  '/check-out',
  asyncHandler(async () => {
    throw notImplemented('POST /attendance/check-out');
  }),
);

attendanceRouter.get(
  '/',
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async () => {
    throw notImplemented('GET /attendance');
  }),
);

attendanceRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('POST /attendance');
  }),
);

attendanceRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async () => {
    throw notImplemented('PATCH /attendance/:id');
  }),
);
