import { Router } from 'express';
import * as ctrl from '../controllers/showtime.controller.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { showtimeCreateSchema, showtimeUpdateSchema, showtimeQuerySchema } from '../validators/schemas.js';

const router = Router();
const adminOnly = [requireAuth, requireRole('admin')];

router.get('/', validate(showtimeQuerySchema, 'query'), ctrl.listShowtimes);
router.get('/:id', objectIdParam('id'), ctrl.getShowtime);

router.post('/', ...adminOnly, validate(showtimeCreateSchema), ctrl.createShowtime);
router.patch('/:id', objectIdParam('id'), ...adminOnly, validate(showtimeUpdateSchema), ctrl.updateShowtime);
router.post('/:id/cancel', objectIdParam('id'), ...adminOnly, ctrl.cancelShowtime);
router.delete('/:id', objectIdParam('id'), ...adminOnly, ctrl.deleteShowtime);

export default router;
