import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/asyncHandler';
import { sendData } from '../../http/envelope';
import { unauthorized } from '../../http/errors';
import { requireAuth } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import { login, me } from './auth.service';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Public.
authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const result = await login(email, password);
    sendData(res, result, 'Signed in');
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    sendData(res, await me(req.user.userId));
  }),
);
