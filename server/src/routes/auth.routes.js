import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  updateMeSchema,
  changePasswordSchema,
} from '../validators/schemas.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 60_000, max: 30 });

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.get('/me', requireAuth, ctrl.me);
router.patch('/me', requireAuth, validate(updateMeSchema), ctrl.updateMe);
router.post('/change-password', requireAuth, validate(changePasswordSchema), ctrl.changePassword);

export default router;
