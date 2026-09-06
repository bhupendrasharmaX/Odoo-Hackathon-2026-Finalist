import { Router } from 'express';
import { z } from 'zod';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { sendCreated, sendData, sendList } from '../../http/envelope';
import { forbidden, unauthorized } from '../../http/errors';
import { buildMeta, readPageParams } from '../../http/pagination';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { assertOwnsEmployee, scopeToSelf } from '../../middleware/scopeToSelf';
import { validate } from '../../middleware/validate';
import { createContract, getContract, listContracts, updateContract } from './contracts.service';

export const contractsRouter = Router();

contractsRouter.use(requireAuth);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

const contractStatus = z.enum(['DRAFT', 'RUNNING', 'EXPIRED', 'CANCELLED']);

const listQuery = z.object({
  employeeId: z.string().trim().min(1).optional(),
  status: contractStatus.optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

contractsRouter.get(
  '/',
  validate({ query: listQuery }),
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listContracts(
      {
        employeeId: req.query.employeeId as string | undefined,
        status: req.query.status as string | undefined,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

const createBody = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required'),
  startDate: isoDate,
  endDate: isoDate.nullish(),
  wage: z.coerce.number().nonnegative('Wage cannot be negative'),
  jobPosition: z.string().trim().max(100).nullish(),
  departmentId: z.string().trim().min(1, 'Department is required'),
  workingScheduleId: z.string().trim().min(1).nullish(),
  salaryStructureId: z.string().trim().min(1).nullish(),
  status: contractStatus.default('DRAFT'),
});

contractsRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createContract(req.body, req.user.userId), 'Contract created');
  }),
);

// An EMPLOYEE may read their own contract, so ownership is checked after the
// row is loaded - the employee id is not in the path to check up front.
contractsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const contract = await getContract(req.params.id!);
    assertOwnsEmployee(req.user, contract.employeeId);
    sendData(res, contract);
  }),
);

contractsRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({ body: createBody.partial() }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    if (req.body.employeeId) {
      // Moving a contract between employees would orphan any payslip that
      // already cites it as the resolved contract.
      throw forbidden('A contract cannot be reassigned to a different employee');
    }
    sendData(res, await updateContract(req.params.id!, req.body, req.user.userId), 'Contract updated');
  }),
);
