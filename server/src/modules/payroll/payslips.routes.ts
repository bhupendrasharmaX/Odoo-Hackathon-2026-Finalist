import { Router } from 'express';
import { z } from 'zod';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { sendData, sendList } from '../../http/envelope';
import { unauthorized } from '../../http/errors';
import { buildMeta, readPageParams } from '../../http/pagination';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { assertOwnsEmployee, scopeToSelf } from '../../middleware/scopeToSelf';
import { validate } from '../../middleware/validate';
import { getPayslip, getPayslipPdf, listPayslips } from './payslips.service';

/**
 * Payslips.
 *
 * PAYSLIP_READ lets an EMPLOYEE read their OWN payslip - and HR_MANAGER is
 * still walled out entirely. For `/:id` the employee id is not in the path, so
 * ownership is checked with `assertOwnsEmployee` once the row is loaded.
 */
export const payslipsRouter = Router();

payslipsRouter.use(requireAuth, requireRole(...ROLE_GROUPS.PAYSLIP_READ));

payslipsRouter.get(
  '/',
  validate({
    query: z.object({
      payrunId: z.string().trim().min(1).optional(),
      employeeId: z.string().trim().min(1).optional(),
      period: z.string().regex(/^\d{4}-\d{2}$/, 'Use a YYYY-MM period').optional(),
      status: z.enum(['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID']).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  }),
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listPayslips(
      {
        payrunId: req.query.payrunId as string | undefined,
        employeeId: req.query.employeeId as string | undefined,
        period: req.query.period as string | undefined,
        status: req.query.status as string | undefined,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

payslipsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const payslip = await getPayslip(req.params.id!);
    assertOwnsEmployee(req.user, payslip.employeeId);
    sendData(res, payslip);
  }),
);

payslipsRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();

    // Ownership is checked BEFORE the PDF is rendered - no point spending the
    // work, and a 403 must not be distinguishable by response timing.
    const payslip = await getPayslip(req.params.id!);
    assertOwnsEmployee(req.user, payslip.employeeId);

    const { buffer, filename } = await getPayslipPdf(req.params.id!);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    // The one endpoint that does not use the envelope - it returns a file.
    res.status(200).end(buffer);
  }),
);
