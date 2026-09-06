import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import Theater from '../models/Theater.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildMeta } from '../utils/pagination.js';
import { priceSeats } from '../utils/seatMap.js';

/** A booking can be cancelled up to this many hours before the show starts. */
const CANCELLATION_WINDOW_HOURS = 2;

const populateBooking = (query) =>
  query
    .populate('movie', 'title slug posterUrl certificate durationMins accentColor')
    .populate('theater', 'name city address')
    .populate('showtime', 'startsAt endsAt status screenName language format');

// POST /api/bookings -> 201 | 409 when seats were taken first
export const createBooking = asyncHandler(async (req, res) => {
  const { showtimeId, seats } = req.body;

  const showtime = await Showtime.findById(showtimeId).populate(
    'movie',
    'title posterUrl durationMins',
  );
  if (!showtime) throw ApiError.notFound('Showtime not found', 'SHOWTIME_NOT_FOUND');
  if (showtime.status === 'cancelled') {
    throw ApiError.conflict('This showtime has been cancelled', 'SHOWTIME_CANCELLED');
  }
  if (showtime.startsAt.getTime() <= Date.now()) {
    throw ApiError.conflict('This showtime has already started', 'SHOWTIME_STARTED');
  }

  const theater = await Theater.findById(showtime.theater);
  const screen = theater && theater.screens.id(showtime.screenId);
  if (!screen) throw ApiError.notFound('Screen not found', 'SCREEN_NOT_FOUND');

  // Throws 422 for labels that do not exist on this screen.
  const pricedSeats = priceSeats(screen, showtime, seats);

  // Atomic claim: the update only matches while none of the seats are taken,
  // so two simultaneous requests for the same seat cannot both succeed.
  const claimed = await Showtime.findOneAndUpdate(
    { _id: showtime._id, status: 'scheduled', bookedSeats: { $nin: seats } },
    { $push: { bookedSeats: { $each: seats } } },
    { new: true },
  );

  if (!claimed) {
    const fresh = await Showtime.findById(showtime._id).select('bookedSeats status');
    const taken = seats.filter((s) => fresh.bookedSeats.includes(s));
    throw ApiError.conflict(
      taken.length
        ? `Seat(s) ${taken.join(', ')} were just booked by someone else`
        : 'These seats could not be reserved',
      'SEATS_UNAVAILABLE',
      { unavailableSeats: taken },
    );
  }

  const { subtotal, convenienceFee, totalAmount } = Booking.priceBreakdown(pricedSeats);

  try {
    const booking = await Booking.create({
      reference: Booking.makeReference(),
      user: req.user._id,
      showtime: showtime._id,
      movie: showtime.movie._id,
      theater: theater._id,
      snapshot: {
        movieTitle: showtime.movie.title,
        posterUrl: showtime.movie.posterUrl,
        theaterName: theater.name,
        city: theater.city,
        screenName: showtime.screenName,
        startsAt: showtime.startsAt,
        language: showtime.language,
        format: showtime.format,
      },
      seats: pricedSeats,
      subtotal,
      convenienceFee,
      totalAmount,
    });

    await populateBooking(Booking.findById(booking._id)).then((doc) => {
      res.status(201).json({ data: doc });
    });
  } catch (err) {
    // Release the seats again so a failed write never leaves them stranded.
    await Showtime.updateOne({ _id: showtime._id }, { $pullAll: { bookedSeats: seats } });
    throw err;
  }
});

// GET /api/bookings/me -> 200
export const myBookings = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;
  const filter = { user: req.user._id };
  if (status !== 'all') filter.status = status;

  const [items, total] = await Promise.all([
    populateBooking(Booking.find(filter))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({ data: items, meta: buildMeta({ page, limit, total }) });
});

// GET /api/bookings/:id -> 200 | 403 | 404
export const getBooking = asyncHandler(async (req, res) => {
  const booking = await populateBooking(Booking.findById(req.params.id)).populate(
    'user',
    'name email',
  );
  if (!booking) throw ApiError.notFound('Booking not found', 'BOOKING_NOT_FOUND');

  const isOwner = String(booking.user._id) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    throw ApiError.forbidden('This booking belongs to another account', 'NOT_YOUR_BOOKING');
  }

  res.status(200).json({ data: booking });
});

// PATCH /api/bookings/:id/cancel -> 200 | 409
export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found', 'BOOKING_NOT_FOUND');

  const isOwner = String(booking.user) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('This booking belongs to another account', 'NOT_YOUR_BOOKING');
  }
  if (booking.status === 'cancelled') {
    throw ApiError.conflict('This booking is already cancelled', 'ALREADY_CANCELLED');
  }

  const showtime = await Showtime.findById(booking.showtime);
  const cutoff = showtime.startsAt.getTime() - CANCELLATION_WINDOW_HOURS * 3600000;
  if (!isAdmin && Date.now() > cutoff) {
    throw ApiError.conflict(
      `Bookings can only be cancelled up to ${CANCELLATION_WINDOW_HOURS} hours before showtime`,
      'CANCELLATION_WINDOW_CLOSED',
      { cutoff: new Date(cutoff) },
    );
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = req.body.reason || (isAdmin && !isOwner ? 'Cancelled by admin' : 'Cancelled by customer');
  await booking.save();

  // Put the seats back on sale.
  await Showtime.updateOne(
    { _id: booking.showtime },
    { $pullAll: { bookedSeats: booking.seats.map((s) => s.label) } },
  );

  res.status(200).json({ data: booking });
});

// GET /api/bookings -> 200 (admin)
export const listAllBookings = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;
  const filter = {};
  if (status !== 'all') filter.status = status;

  const [items, total] = await Promise.all([
    populateBooking(Booking.find(filter))
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({ data: items, meta: buildMeta({ page, limit, total }) });
});
