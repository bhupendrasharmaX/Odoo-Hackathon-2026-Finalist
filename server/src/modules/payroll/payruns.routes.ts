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
import {
  computePayrun,
  createPayrun,
  eligibleEmployees,
  getPayrun,
  listPayruns,
  markPayrunPaid,
  sendPayslips,
  validatePayrun,
} from './payruns.service';

/**
 * Payruns. HR_MANAGER gets 403 on every route here - that is THE WALL, and it
 * is enforced by the guard below rather than by hiding a menu item.
 */
export const payrunsRouter = Router();

payrunsRouter.use(requireAuth, requireRole(...ROLE_GROUPS.PAYROLL));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

payrunsRouter.get(
  '/',
  validate({
    query: z.object({
      status: z.enum(['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED']).optional(),
      period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listPayruns(
      {
        status: req.query.status as string | undefined,
        period: req.query.period as string | undefined,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

/**
 * Wizard step 2 preview. Declared before the parameterised route so the
 * literal path wins the match.
 *
 * CREATES NOTHING. The 200 here is deliberate rather than a 201: no resource
 * came into existence, this is a computed preview of what would be created.
 */
payrunsRouter.post(
  '/eligible-employees',
  validate({
    body: z.object({
      salaryStructureId: z.string().trim().min(1, 'Choose a salary structure'),
      periodStart: isoDate,
      periodEnd: isoDate,
    }),
  }),
  asyncHandler(async (req, res) => {
    sendData(res, await eligibleEmployees(req.body));
  }),
);

// Wizard final submit - the first call that actually creates a record.
payrunsRouter.post(
  '/',
  validate({
    body: z.object({
      name: z.string().trim().min(1, 'Name this payrun').max(150),
      salaryStructureId: z.string().trim().min(1, 'Choose a salary structure'),
      periodStart: isoDate,
      periodEnd: isoDate,
      employeeIds: z.array(z.string().trim().min(1)).min(1, 'Select at least one employee'),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createPayrun(req.body, req.user.userId), 'Payrun created');
  }),
);

payrunsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendData(res, await getPayrun(req.params.id!));
  }),
);

payrunsRouter.post(
  '/:id/compute',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const result = await computePayrun(req.params.id!, req.user.userId);
    sendData(res, result, `Computed ${result.computed} payslip(s)`);
  }),
);

payrunsRouter.post(
  '/:id/validate',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await validatePayrun(req.params.id!, req.user.userId), 'Payrun validated');
  }),
);

payrunsRouter.post(
  '/:id/mark-paid',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await markPayrunPaid(req.params.id!, req.user.userId), 'Payrun marked as paid');
  }),
);

payrunsRouter.post(
  '/:id/send-payslips',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const result = await sendPayslips(req.params.id!, req.user.userId);
    sendData(res, result, `Sent ${result.sent} of ${result.attempted} payslip(s)`);
  }),
);
