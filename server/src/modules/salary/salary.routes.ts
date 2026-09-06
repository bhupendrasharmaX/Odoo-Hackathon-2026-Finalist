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
  createRule,
  createStructure,
  getStructure,
  listRules,
  listStructures,
  updateRule,
  updateStructure,
} from './salary.service';

/**
 * Salary config.
 *
 * The read and write guards are applied PER ROUTE rather than once at the
 * router, because the split between them is the whole point here:
 *   HR_MANAGER        -> 403 on everything (THE WALL)
 *   HR_PAYROLL_USER   -> may GET, 403 on POST/PATCH (read-only)
 *   HR_PAYROLL_MANAGER, ADMIN -> full access
 */

const ruleCategory = z.enum(['BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET']);
const computeType = z.enum(['FIXED', 'PERCENTAGE', 'FORMULA']);

const ruleSchema = z.object({
  name: z.string().trim().min(1, 'Rule name is required').max(100),
  code: z.string().trim().min(1, 'Rule code is required').max(30),
  category: ruleCategory,
  sequence: z.coerce.number().int().min(0, 'Sequence must be zero or greater'),
  computeType,
  amount: z.coerce.number().nullish(),
  percentage: z.coerce.number().nullish(),
  formula: z.string().trim().max(255).nullish(),
  baseRuleCode: z.string().trim().max(30).nullish(),
});

// ---------------------------------------------------------------------
// /salary-structures
// ---------------------------------------------------------------------

export const salaryStructuresRouter = Router();

salaryStructuresRouter.use(requireAuth);

salaryStructuresRouter.get(
  '/',
  requireRole(...ROLE_GROUPS.SALARY_READ),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listStructures(page);
    sendList(res, data, buildMeta(page, total));
  }),
);

salaryStructuresRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.SALARY_WRITE),
  validate({
    body: z.object({
      name: z.string().trim().min(1, 'Name is required').max(100),
      rules: z.array(ruleSchema).default([]),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createStructure(req.body, req.user.userId), 'Structure created');
  }),
);

salaryStructuresRouter.get(
  '/:id',
  requireRole(...ROLE_GROUPS.SALARY_READ),
  asyncHandler(async (req, res) => {
    sendData(res, await getStructure(req.params.id!));
  }),
);

salaryStructuresRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.SALARY_WRITE),
  validate({
    body: z.object({
      name: z.string().trim().min(1).max(100).optional(),
      rules: z.array(ruleSchema).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await updateStructure(req.params.id!, req.body, req.user.userId), 'Structure updated');
  }),
);

// ---------------------------------------------------------------------
// /salary-rules
// ---------------------------------------------------------------------

export const salaryRulesRouter = Router();

salaryRulesRouter.use(requireAuth);

salaryRulesRouter.get(
  '/',
  requireRole(...ROLE_GROUPS.SALARY_READ),
  validate({
    query: z.object({
      structureId: z.string().trim().min(1).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listRules(
      { structureId: req.query.structureId as string | undefined },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

salaryRulesRouter.post(
  '/',
  requireRole(...ROLE_GROUPS.SALARY_WRITE),
  validate({ body: ruleSchema.extend({ structureId: z.string().trim().min(1) }) }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendCreated(res, await createRule(req.body, req.user.userId), 'Rule created');
  }),
);

salaryRulesRouter.patch(
  '/:id',
  requireRole(...ROLE_GROUPS.SALARY_WRITE),
  validate({ body: ruleSchema.partial() }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await updateRule(req.params.id!, req.body, req.user.userId), 'Rule updated');
  }),
);
