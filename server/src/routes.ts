import { Router } from 'express';
import { sendData } from './http/envelope';
import { isPrismaAvailable } from './lib/prisma';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { employeesRouter } from './modules/employees/employees.routes';
import { contractsRouter } from './modules/contracts/contracts.routes';
import { schedulesRouter } from './modules/schedules/schedules.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { timeoffRouter } from './modules/timeoff/timeoff.routes';
import { salaryRulesRouter, salaryStructuresRouter } from './modules/salary/salary.routes';
import { payrunsRouter } from './modules/payroll/payruns.routes';
import { payslipsRouter } from './modules/payroll/payslips.routes';
import { grievancesRouter } from './modules/grievances/grievances.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';

/**
 * The complete /api/v1 surface, in the order it is locked in
 * 00_SHARED_CONTRACT.md. If a path is not here, it does not exist.
 */
export const apiRouter = Router();

// Unauthenticated liveness probe - also reports whether the Prisma client has
// been generated yet, which is the usual reason a fresh clone misbehaves.
apiRouter.get('/health', (_req, res) => {
  sendData(res, {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    database: isPrismaAvailable() ? 'connected' : 'prisma-client-not-generated',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/contracts', contractsRouter);
apiRouter.use('/schedules', schedulesRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/timeoff', timeoffRouter);
apiRouter.use('/salary-structures', salaryStructuresRouter);
apiRouter.use('/salary-rules', salaryRulesRouter);
apiRouter.use('/payruns', payrunsRouter);
apiRouter.use('/payslips', payslipsRouter);
apiRouter.use('/grievances', grievancesRouter);
apiRouter.use('/dashboard', dashboardRouter);
