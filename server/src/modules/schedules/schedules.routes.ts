import { Router } from 'express';
import { z } from 'zod';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { sendCreated, sendData, sendList } from '../../http/envelope';
import { unauthorized } from '../../http/errors';
import { buildMeta, readPageParams } from '../../http/pagination';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { createSchedule, getSchedule, listSchedules, updateSchedule } from './schedules.service';

export const schedulesRouter = Router();

schedulesRouter.use(requireAuth);

const timeString = z
  .string()
  .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, 'Use HH:MM or HH:MM:SS');

const lineSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0, '0 is Sunday').max(6, '6 is Saturday'),
  startTime: timeString,
  endTime: timeString,
  breakMinutes: z.coerce.number().int().min(0).default(0),
});

schedulesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listSchedules(page);
    sendList(res, data, buildMeta(page, total));
  }),
);

schedulesRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({
    body: z.object({
      name: z.string().trim().min(1, 'Name is required').max(100),
      lines: z.array(lineSchema).default([]),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createSchedule(req.body, req.user.userId), 'Schedule created');
  }),
);

schedulesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendData(res, await getSchedule(req.params.id!));
  }),
);

schedulesRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({
    body: z.object({
      name: z.string().trim().min(1).max(100).optional(),
      lines: z.array(lineSchema).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await updateSchedule(req.params.id!, req.body, req.user.userId), 'Schedule updated');
  }),
);
