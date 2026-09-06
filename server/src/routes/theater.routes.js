import { Router } from 'express';
import * as ctrl from '../controllers/theater.controller.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { theaterCreateSchema, theaterUpdateSchema, screenSchema } from '../validators/schemas.js';

const router = Router();
const adminOnly = [requireAuth, requireRole('admin')];

router.get('/', ctrl.listTheaters);
router.get('/:id', objectIdParam('id'), ctrl.getTheater);

router.post('/', ...adminOnly, validate(theaterCreateSchema), ctrl.createTheater);
router.patch('/:id', objectIdParam('id'), ...adminOnly, validate(theaterUpdateSchema), ctrl.updateTheater);
router.delete('/:id', objectIdParam('id'), ...adminOnly, ctrl.deleteTheater);

router.post('/:id/screens', objectIdParam('id'), ...adminOnly, validate(screenSchema), ctrl.addScreen);
router.delete('/:id/screens/:screenId', objectIdParam('id'), objectIdParam('screenId'), ...adminOnly, ctrl.removeScreen);

export default router;
