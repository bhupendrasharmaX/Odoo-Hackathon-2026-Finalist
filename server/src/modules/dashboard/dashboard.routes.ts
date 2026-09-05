import { Router } from 'express';
import { z } from 'zod';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { sendData } from '../../http/envelope';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { getDashboard, getDashboardFilters } from './dashboard.service';

/**
 * Dashboard. HR_MANAGER is walled out here too - the guard is the same one
 * that protects payruns, so the two can never drift apart.
 */
export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRole(...ROLE_GROUPS.DASHBOARD));

// Declared before '/' has a chance to swallow it.
dashboardRouter.get(
  '/filters',
  asyncHandler(async (_req, res) => {
    sendData(res, await getDashboardFilters());
  }),
);

dashboardRouter.get(
  '/',
  validate({
    query: z.object({
      period: z.string().regex(/^\d{4}-\d{2}$/, 'Use a YYYY-MM period').optional(),
      departmentId: z.string().trim().min(1).optional(),
      employeeType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    sendData(
      res,
      await getDashboard({
        period: req.query.period as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
        employeeType: req.query.employeeType as string | undefined,
      }),
    );
  }),
);
