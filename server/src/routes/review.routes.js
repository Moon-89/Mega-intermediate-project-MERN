import { Router } from 'express';
import * as ctrl from '../controllers/review.controller.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { reviewSchema } from '../validators/schemas.js';

const router = Router();

router.patch('/:id', objectIdParam('id'), requireAuth, validate(reviewSchema), ctrl.updateReview);
router.delete('/:id', objectIdParam('id'), requireAuth, ctrl.deleteReview);

export default router;
