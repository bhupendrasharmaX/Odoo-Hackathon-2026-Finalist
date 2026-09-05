import { Router } from 'express';
import { ROLE_GROUPS } from '../../config/roles';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';

/**
 * ADMIN only, for every route.
 *
 * TODO (users.service.ts):
 *   listUsers / createUser / changeRole
 *
 * Hard rule from the contract: NOBODY may change their own role. Reject with
 * 403 even when the caller is ADMIN and the target id is themselves - that
 * check belongs in the service, since it compares req.user.userId to :id.
 */
export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole(...ROLE_GROUPS.ADMIN_ONLY));

usersRouter.get(
  '/',
  asyncHandler(async () => {
    throw notImplemented('GET /users');
  }),
);

usersRouter.post(
  '/',
  asyncHandler(async () => {
    throw notImplemented('POST /users');
  }),
);

usersRouter.patch(
  '/:id/role',
  asyncHandler(async () => {
    throw notImplemented('PATCH /users/:id/role');
  }),
);
