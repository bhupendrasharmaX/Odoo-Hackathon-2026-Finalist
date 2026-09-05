import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';

/**
 * Dashboard. HR_MANAGER is walled out here too.
 *
 * TODO (dashboard.service.ts):
 *   getDashboard({ period, departmentId, employeeType }) -> exactly the shape
 *   locked in the shared contract:
 *     kpis { totalNetPaid, payslipsGenerated, averageSalary,
 *            approvedTimeOffDays, attendanceHealth, openGrievances }
 *     salaryByDepartment[] / monthlyNetTrend[] / attendanceOverview / alerts[]
 *
 * Every number comes from a live query. A hardcoded figure here is the one
 * thing guaranteed to be found.
 */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requireAuth,
  requireRole(...ROLE_GROUPS.DASHBOARD),
  asyncHandler(async () => {
    throw notImplemented('GET /dashboard');
  }),
);
