import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';

/**
 * Salary structures and rules.
 *
 * THE WALL: HR_MANAGER is absent from both role groups below, so every route
 * here answers 403 for that role. HR_PAYROLL_USER can read but not write -
 * which is why the read and write guards are applied per-route rather than
 * once with router.use().
 *
 * TODO (salary.service.ts):
 *   listStructures / createStructure / getStructure / updateStructure
 *   listRules / createRule / updateRule
 *
 * Validation happens at STRUCTURE SAVE TIME, not compute time:
 *   - reject a rule whose formula or baseRuleCode references a rule with a
 *     sequence >= its own (this makes circular references unconstructible)
 *   - reject duplicate rule codes within a structure
 */
export const salaryStructuresRouter = Router();

salaryStructuresRouter.use(requireAuth);

salaryStructuresRouter.get(
  '/',
  requireRole(...ROLE_GROUPS.SALARY_READ),
  asyncHandler(async () => {
    throw notImplemented('GET /salary-structures');
  }),
);

salaryStructuresRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.SALARY_WRITE),
  asyncHandler(async () => {
    throw notImplemented('POST /salary-structures');
  }),
);

salaryStructuresRouter.get(
  '/:id',
  requireRole(...ROLE_GROUPS.SALARY_READ),
  asyncHandler(async () => {
    throw notImplemented('GET /salary-structures/:id');
  }),
);

salaryStructuresRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.SALARY_WRITE),
  asyncHandler(async () => {
    throw notImplemented('PATCH /salary-structures/:id');
  }),
);

export const salaryRulesRouter = Router();

salaryRulesRouter.use(requireAuth);

salaryRulesRouter.get(
  '/',
  requireRole(...ROLE_GROUPS.SALARY_READ),
  asyncHandler(async () => {
    throw notImplemented('GET /salary-rules');
  }),
);

salaryRulesRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.SALARY_WRITE),
  asyncHandler(async () => {
    throw notImplemented('POST /salary-rules');
  }),
);

salaryRulesRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.SALARY_WRITE),
  asyncHandler(async () => {
    throw notImplemented('PATCH /salary-rules/:id');
  }),
);
