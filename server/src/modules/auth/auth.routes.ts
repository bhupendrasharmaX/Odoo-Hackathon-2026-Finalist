import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { notImplemented } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';

/**
 * TODO (auth.service.ts):
 *   login(email, password)  -> bcrypt.compare, sign a 24h JWT
 *                              { userId, employeeId, role, email, name }
 *   me(userId)              -> current user + role + employeeId
 */
export const authRouter = Router();

// Public.
authRouter.post(
  '/login',
  asyncHandler(async () => {
    throw notImplemented('POST /auth/login');
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async () => {
    throw notImplemented('GET /auth/me');
  }),
);
