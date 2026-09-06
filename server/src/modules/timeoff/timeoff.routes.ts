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
import {
  approveAllocation,
  approveRequest,
  createAllocation,
  createRequest,
  createType,
  getBalance,
  listAllocations,
  listRequests,
  listTypes,
  refuseRequest,
} from './timeoff.service';

export const timeoffRouter = Router();

timeoffRouter.use(requireAuth);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');
const requestStatus = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REFUSED']);

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

timeoffRouter.get(
  '/types',
  asyncHandler(async (_req, res) => {
    sendData(res, await listTypes());
  }),
);

timeoffRouter.post(
  '/types',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({
    body: z.object({
      name: z.string().trim().min(1, 'Name is required').max(100),
      unit: z.enum(['DAYS', 'HOURS']).default('DAYS'),
      requiresAllocation: z.boolean().default(true),
      isPaid: z.boolean().default(true),
      color: z.string().trim().max(20).nullish(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createType(req.body, req.user.userId), 'Time off type created');
  }),
);

// ---------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------

timeoffRouter.get(
  '/allocations',
  validate({
    query: z.object({
      employeeId: z.string().trim().min(1).optional(),
      timeOffTypeId: z.string().trim().min(1).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  }),
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listAllocations(
      {
        employeeId: req.query.employeeId as string | undefined,
        timeOffTypeId: req.query.timeOffTypeId as string | undefined,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

timeoffRouter.post(
  '/allocations',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  validate({
    body: z.object({
      employeeId: z.string().trim().min(1, 'Employee is required'),
      timeOffTypeId: z.string().trim().min(1, 'Time off type is required'),
      allocatedDays: z.coerce.number().positive('Allocate at least a fraction of a day'),
      validFrom: isoDate,
      validTo: isoDate,
      status: z.enum(['PENDING', 'APPROVED', 'REFUSED']).default('PENDING'),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createAllocation(req.body, req.user.userId), 'Allocation created');
  }),
);

timeoffRouter.post(
  '/allocations/:id/approve',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await approveAllocation(req.params.id!, req.user.userId), 'Allocation approved');
  }),
);

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------

timeoffRouter.get(
  '/requests',
  validate({
    query: z.object({
      employeeId: z.string().trim().min(1).optional(),
      status: requestStatus.optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  }),
  scopeToSelf({ query: 'employeeId' }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listRequests(
      {
        employeeId: req.query.employeeId as string | undefined,
        status: req.query.status as string | undefined,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

timeoffRouter.post(
  '/requests',
  validate({
    body: z.object({
      employeeId: z.string().trim().min(1).optional(),
      timeOffTypeId: z.string().trim().min(1, 'Time off type is required'),
      allocationId: z.string().trim().min(1).nullish(),
      dateFrom: isoDate,
      dateTo: isoDate,
      durationDays: z.coerce.number().positive().optional(),
      reason: z.string().trim().max(255).nullish(),
      status: requestStatus.default('PENDING'),
    }),
  }),
  // Overwrites body.employeeId with the caller's own id when they are an
  // EMPLOYEE, so nobody can file leave on a colleague's behalf.
  scopeToSelf({ body: 'employeeId', query: false, param: false }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const employeeId = req.body.employeeId ?? req.user.employeeId;
    if (!employeeId) {
      throw unauthorized('This login is not linked to an employee record');
    }
    sendCreated(
      res,
      await createRequest({ ...req.body, employeeId }, req.user.userId),
      'Time off requested',
    );
  }),
);

timeoffRouter.post(
  '/requests/:id/approve',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const { request, alreadyApproved } = await approveRequest(req.params.id!, req.user.userId);
    sendData(
      res,
      request,
      alreadyApproved ? 'Already approved - balance unchanged' : 'Time off approved',
    );
  }),
);

timeoffRouter.post(
  '/requests/:id/refuse',
  requireRole(...ROLE_GROUPS.HR_PLUS),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await refuseRequest(req.params.id!, req.user.userId), 'Time off refused');
  }),
);

timeoffRouter.get(
  '/balance/:employeeId',
  scopeToSelf({ param: 'employeeId', query: false }),
  asyncHandler(async (req, res) => {
    sendData(res, await getBalance(req.params.employeeId!));
  }),
);
