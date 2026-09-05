import { Router, type Request } from 'express';
import { z } from 'zod';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { sendCreated, sendData, sendList } from '../../http/envelope';
import { forbidden, unauthorized } from '../../http/errors';
import { buildMeta, readPageParams } from '../../http/pagination';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { scopeToSelf } from '../../middleware/scopeToSelf';
import { validate } from '../../middleware/validate';
import {
  activeSession,
  checkIn,
  checkOut,
  createAttendance,
  listAttendance,
  todayTotals,
  updateAttendance,
} from './attendance.service';

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

const attendanceStatus = z.enum(['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'MISSING_CHECKOUT']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

/**
 * The widget endpoints act on the CALLER's own employee record, always.
 *
 * They take no employeeId at all - not from the body, not from the query - so
 * there is no parameter through which one person could clock in as another.
 * HR corrections go through PATCH /attendance/:id instead, which is audited.
 */
function ownEmployeeId(req: Request): string {
  const user = req.user;
  if (!user) throw unauthorized();
  if (!user.employeeId) {
    throw forbidden('This login is not linked to an employee record, so it cannot clock in or out');
  }
  return user.employeeId;
}

// Literal paths first, so they win over `/:id`.
attendanceRouter.get(
  '/active',
  asyncHandler(async (req, res) => {
    const employeeId = ownEmployeeId(req);
    const [session, totals] = await Promise.all([
      activeSession(employeeId),
      todayTotals(employeeId),
    ]);
    sendData(res, { session, today: totals });
  }),
);

attendanceRouter.post(
  '/check-in',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const record = await checkIn(ownEmployeeId(req), req.user.userId);
    sendCreated(res, record, 'Checked in');
  }),
);

attendanceRouter.post(
  '/check-out',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const record = await checkOut(ownEmployeeId(req), req.user.userId);
    sendData(res, record, 'Checked out');
  }),
);

const listQuery = z.object({
  employeeId: z.string().trim().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: attendanceStatus.optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

attendanceRouter.get(
  '/',
  validate({ query: listQuery }),
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listAttendance(
      {
        employeeId: req.query.employeeId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        status: req.query.status as string | undefined,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

const createBody = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required'),
  checkIn: z.string().datetime({ offset: true }).or(z.string().min(1)),
  checkOut: z.string().datetime({ offset: true }).or(z.string().min(1)).nullish(),
  workedHours: z.coerce.number().min(0).optional(),
  overtimeHours: z.coerce.number().min(0).optional(),
  status: attendanceStatus.optional(),
  notes: z.string().trim().max(255).nullish(),
});

attendanceRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createAttendance(req.body, req.user.userId), 'Attendance recorded');
  }),
);

attendanceRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({ body: createBody.partial() }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(
      res,
      await updateAttendance(req.params.id!, req.body, req.user.userId),
      'Attendance corrected',
    );
  }),
);
