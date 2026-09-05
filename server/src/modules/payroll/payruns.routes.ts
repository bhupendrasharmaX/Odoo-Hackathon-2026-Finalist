import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';

/**
 * Payruns. HR_MANAGER gets 403 on every route here - that is THE WALL, and it
 * is enforced by the guard below rather than by hiding a menu item.
 *
 * TODO (payruns.service.ts):
 *   listPayruns / getPayrun
 *   eligibleEmployees({ salaryStructureId, periodStart, periodEnd })
 *     -> employees with a contract overlapping the period, each annotated with
 *        hasBankAccount, alreadyHasPayslipForPeriod, contractCount.
 *        CREATES NOTHING - this is wizard step 2, a preview only.
 *   createPayrun(...)  -> Payrun DRAFT + one DRAFT Payslip per selected employee
 *   compute(id)        -> run the salary engine; MUST BE IDEMPOTENT
 *                         (delete-then-insert lines, never append)
 *   validate(id)       -> only from COMPUTED; 409 if any payslip carries an
 *                         unresolved HIGH-severity warning
 *   markPaid(id)       -> only from VALIDATED; after PAID everything is
 *                         read-only and further mutation returns 409
 *   sendPayslips(id)   -> render each PDF and email it; with no SMTP
 *                         configured, log the send and still record it as sent
 *                         so the demo works offline
 *
 * compute / validate / markPaid each write an AuditLog row
 * { userId, action, entityType, entityId, changes }.
 */
export const payrunsRouter = Router();

payrunsRouter.use(requireAuth, requireRole(...ROLE_GROUPS.PAYROLL));

payrunsRouter.get(
  '/',
  asyncHandler(async () => {
    throw notImplemented('GET /payruns');
  }),
);

// Wizard step 2 preview. Declared before the parameterised route so the
// literal path wins the match.
payrunsRouter.post(
  '/eligible-employees',
  asyncHandler(async () => {
    throw notImplemented('POST /payruns/eligible-employees');
  }),
);

// Wizard final submit - the first call that actually creates a record.
payrunsRouter.post(
  '/',
  asyncHandler(async () => {
    throw notImplemented('POST /payruns');
  }),
);

payrunsRouter.get(
  '/:id',
  asyncHandler(async () => {
    throw notImplemented('GET /payruns/:id');
  }),
);

payrunsRouter.post(
  '/:id/compute',
  asyncHandler(async () => {
    throw notImplemented('POST /payruns/:id/compute');
  }),
);

payrunsRouter.post(
  '/:id/validate',
  asyncHandler(async () => {
    throw notImplemented('POST /payruns/:id/validate');
  }),
);

payrunsRouter.post(
  '/:id/mark-paid',
  asyncHandler(async () => {
    throw notImplemented('POST /payruns/:id/mark-paid');
  }),
);

payrunsRouter.post(
  '/:id/send-payslips',
  asyncHandler(async () => {
    throw notImplemented('POST /payruns/:id/send-payslips');
  }),
);
