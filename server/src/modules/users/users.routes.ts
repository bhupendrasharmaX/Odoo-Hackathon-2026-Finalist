import { Router } from 'express';
import { z } from 'zod';
import { ROLES, ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { sendCreated, sendData, sendList } from '../../http/envelope';
import { unauthorized } from '../../http/errors';
import { buildMeta, readPageParams } from '../../http/pagination';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { changeRole, createUser, listUsers } from './users.service';

export const usersRouter = Router();

// The whole /users surface is ADMIN-only.
usersRouter.use(requireAuth, requireRole(...ROLE_GROUPS.ADMIN_ONLY));

const roleEnum = z.enum(ROLES);

const listQuery = z.object({
  search: z.string().trim().min(1).optional(),
  role: roleEnum.optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

usersRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const page = readPageParams(req);
    const { data, total } = await listUsers(
      {
        search: req.query.search as string | undefined,
        role: req.query.role as never,
      },
      page,
    );
    sendList(res, data, buildMeta(page, total));
  }),
);

const createBody = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1, 'Name is required'),
  role: roleEnum,
  employeeId: z.string().trim().min(1).nullish(),
});

usersRouter.post(
  '/',
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const created = await createUser(req.body, req.user.userId);
    sendCreated(res, created, 'User created');
  }),
);

usersRouter.patch(
  '/:id/role',
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ role: roleEnum }),
  }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const updated = await changeRole(req.params.id!, req.body.role, req.user.userId);
    sendData(res, updated, 'Role updated');
  }),
);
