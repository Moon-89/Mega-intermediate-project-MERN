import User from '../models/User.js';
import Movie from '../models/Movie.js';
import Theater from '../models/Theater.js';
import Showtime from '../models/Showtime.js';
import Booking from '../models/Booking.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildMeta, parsePagination } from '../utils/pagination.js';

// GET /api/admin/stats -> 200 (admin)
export const stats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 24 * 3600000);

  const [
    users,
    admins,
    movies,
    activeMovies,
    theaters,
    upcomingShows,
    bookingTotals,
    weekRevenue,
    topMovies,
    recentBookings,
    occupancy,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
    Movie.countDocuments(),
    Movie.countDocuments({ isActive: true }),
    Theater.countDocuments(),
    Showtime.countDocuments({ status: 'scheduled', startsAt: { $gte: now } }),
    Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          seats: { $sum: { $size: '$seats' } },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { status: 'confirmed', createdAt: { $gte: last7 } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id: '$movie',
          revenue: { $sum: '$totalAmount' },
          seats: { $sum: { $size: '$seats' } },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movie' } },
      { $unwind: '$movie' },
      {
        $project: {
          _id: 0,
          movieId: '$_id',
          title: '$movie.title',
          posterUrl: '$movie.posterUrl',
          revenue: 1,
          seats: 1,
          bookings: 1,
        },
      },
    ]),
    Booking.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('user', 'name email')
      .populate('movie', 'title posterUrl'),
    Showtime.aggregate([
      { $match: { status: 'scheduled' } },
      {
        $group: {
          _id: null,
          sold: { $sum: { $size: '$bookedSeats' } },
          capacity: { $sum: '$totalSeats' },
        },
      },
    ]),
  ]);

  const byStatus = Object.fromEntries(bookingTotals.map((b) => [b._id, b]));
  const confirmed = byStatus.confirmed || { count: 0, revenue: 0, seats: 0 };
  const cancelled = byStatus.cancelled || { count: 0, revenue: 0, seats: 0 };
  const occ = occupancy[0] || { sold: 0, capacity: 0 };

  res.status(200).json({
    data: {
      users: { total: users, admins, customers: users - admins },
      catalogue: { movies, activeMovies, theaters, upcomingShows },
      bookings: {
        confirmed: confirmed.count,
        cancelled: cancelled.count,
        seatsSold: confirmed.seats,
        revenue: confirmed.revenue,
        refunded: cancelled.revenue,
      },
      occupancyRate: occ.capacity ? Math.round((occ.sold / occ.capacity) * 1000) / 10 : 0,
      revenueByDay: weekRevenue.map((d) => ({ date: d._id, revenue: d.revenue, bookings: d.bookings })),
      topMovies,
      recentBookings,
    },
  });
});

// GET /api/admin/users -> 200 (admin)
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.role === 'user' || req.query.role === 'admin') filter.role = req.query.role;
  if (req.query.q) {
    const rx = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: rx, $options: 'i' } }, { email: { $regex: rx, $options: 'i' } }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const withCounts = await Promise.all(
    items.map(async (u) => ({
      ...u.toJSON(),
      bookingCount: await Booking.countDocuments({ user: u._id, status: 'confirmed' }),
    })),
  );

  res.status(200).json({ data: withCounts, meta: buildMeta({ page, limit, total }) });
});

// PATCH /api/admin/users/:id/role -> 200 (admin)
export const setUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    throw ApiError.unprocessable('Role must be "user" or "admin"', 'VALIDATION_ERROR', [
      { field: 'role', message: 'Must be user or admin' },
    ]);
  }

  if (String(req.params.id) === String(req.user._id)) {
    throw ApiError.conflict('You cannot change your own role', 'SELF_ROLE_CHANGE');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');

  if (user.role === 'admin' && role === 'user') {
    const admins = await User.countDocuments({ role: 'admin' });
    if (admins <= 1) {
      throw ApiError.conflict('The last admin cannot be demoted', 'LAST_ADMIN');
    }
  }

  user.role = role;
  await user.save();
  res.status(200).json({ data: user.toJSON() });
});
