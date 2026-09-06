import { Router } from 'express';
import * as ctrl from '../controllers/movie.controller.js';
import * as reviewCtrl from '../controllers/review.controller.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import {
  movieCreateSchema,
  movieUpdateSchema,
  movieQuerySchema,
  reviewSchema,
} from '../validators/schemas.js';

const router = Router();
const adminOnly = [requireAuth, requireRole('admin')];

router.get('/', validate(movieQuerySchema, 'query'), ctrl.listMovies);
router.get('/meta/filters', ctrl.movieFilters);

// Reviews live under their movie.
router.get('/:id/reviews', objectIdParam('id'), optionalAuth, reviewCtrl.listReviews);
router.post('/:id/reviews', objectIdParam('id'), requireAuth, validate(reviewSchema), reviewCtrl.createReview);

router.get('/:idOrSlug', ctrl.getMovie);

router.post('/', ...adminOnly, validate(movieCreateSchema), ctrl.createMovie);
router.patch('/:id', objectIdParam('id'), ...adminOnly, validate(movieUpdateSchema), ctrl.updateMovie);
router.delete('/:id', objectIdParam('id'), ...adminOnly, ctrl.deleteMovie);

export default router;
