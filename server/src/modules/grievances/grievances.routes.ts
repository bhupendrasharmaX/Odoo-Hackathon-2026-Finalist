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
import { createGrievance, listGrievances, updateGrievance } from './grievances.service';

export const grievancesRouter = Router();

grievancesRouter.use(requireAuth);

const grievanceStatus = z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']);

grievancesRouter.get(
  '/',
  validate({
    query: z.object({
      employeeId: z.string().trim().min(1).optional(),
      status: grievanceStatus.optional(),
      payslipId: z.string().trim().min(1).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  }),
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listGrievances(
      {
        employeeId: req.query.employeeId as string | undefined,
        status: req.query.status as string | undefined,
        payslipId: req.query.payslipId as string | undefined,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

grievancesRouter.post(
  '/',
  validate({
    body: z.object({
      employeeId: z.string().trim().min(1).optional(),
      payslipId: z.string().trim().min(1).nullish(),
      subject: z.string().trim().min(1, 'Give the grievance a subject').max(150),
      description: z.string().trim().min(1, 'Describe the issue'),
    }),
  }),
  scopeToSelf({ body: 'employeeId', query: false, param: false }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const employeeId = req.body.employeeId ?? req.user.employeeId;
    if (!employeeId) {
      throw unauthorized('This login is not linked to an employee record');
    }
    sendCreated(
      res,
      await createGrievance({ ...req.body, employeeId }, req.user.userId),
      'Grievance raised',
    );
  }),
);

// Resolving is HR+ only - an employee may raise one but never close it.
grievancesRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.GRIEVANCE_RESOLVE),
  validate({
    body: z.object({
      status: grievanceStatus.optional(),
      response: z.string().trim().nullish(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await updateGrievance(req.params.id!, req.body, req.user.userId), 'Grievance updated');
  }),
);
