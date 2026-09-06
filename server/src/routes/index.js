import { Router } from 'express';
import mongoose from 'mongoose';

import authRoutes from './auth.routes.js';
import movieRoutes from './movie.routes.js';
import theaterRoutes from './theater.routes.js';
import showtimeRoutes from './showtime.routes.js';
import bookingRoutes from './booking.routes.js';
import reviewRoutes from './review.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

// GET /api/health -> 200
router.get('/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.status(200).json({
    data: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      database: states[mongoose.connection.readyState] || 'unknown',
      time: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/movies', movieRoutes);
router.use('/theaters', theaterRoutes);
router.use('/showtimes', showtimeRoutes);
router.use('/bookings', bookingRoutes);
router.use('/reviews', reviewRoutes);
router.use('/admin', adminRoutes);

export default router;
