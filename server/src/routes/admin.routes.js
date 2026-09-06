import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/stats', ctrl.stats);
router.get('/users', ctrl.listUsers);
router.patch('/users/:id/role', objectIdParam('id'), ctrl.setUserRole);

export default router;
