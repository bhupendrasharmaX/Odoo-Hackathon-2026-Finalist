import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { scopeToSelf } from '../../middleware/scopeToSelf';

/**
 * Payslips. An EMPLOYEE may read their OWN payslips - HR_MANAGER may read
 * none at all, hence PAYSLIP_READ rather than SELF_OR_HR.
 *
 * TODO (payslips.service.ts):
 *   listPayslips({ payrunId, employeeId, period })
 *   getPayslip(id)     -> include lines ordered by sequence, plus gross,
 *                         totalDeductions, net and warnings
 *   renderPdf(id)      -> pdfkit; Content-Type: application/pdf and
 *                         Content-Disposition: attachment
 *
 * For /:id and /:id/pdf the owning employee is only known after the row is
 * read, so the service must call assertOwnsEmployee(req.user, payslip.employeeId)
 * once it has loaded the record. scopeToSelf cannot do that part for you.
 */
export const payslipsRouter = Router();

payslipsRouter.use(requireAuth, requireRole(...ROLE_GROUPS.PAYSLIP_READ));

payslipsRouter.get(
  '/',
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async () => {
    throw notImplemented('GET /payslips');
  }),
);

payslipsRouter.get(
  '/:id',
  asyncHandler(async () => {
    throw notImplemented('GET /payslips/:id');
  }),
);

payslipsRouter.get(
  '/:id/pdf',
  asyncHandler(async () => {
    throw notImplemented('GET /payslips/:id/pdf');
  }),
);
