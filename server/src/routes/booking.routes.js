import { Router } from 'express';
import * as ctrl from '../controllers/booking.controller.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { bookingCreateSchema, bookingCancelSchema, bookingQuerySchema } from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/me', validate(bookingQuerySchema, 'query'), ctrl.myBookings);
router.post('/', validate(bookingCreateSchema), ctrl.createBooking);
router.get('/:id', objectIdParam('id'), ctrl.getBooking);
router.patch('/:id/cancel', objectIdParam('id'), validate(bookingCancelSchema), ctrl.cancelBooking);

router.get('/', requireRole('admin'), validate(bookingQuerySchema, 'query'), ctrl.listAllBookings);

export default router;
