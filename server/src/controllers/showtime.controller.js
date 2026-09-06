import mongoose from 'mongoose';
import Showtime from '../models/Showtime.js';
import Movie from '../models/Movie.js';
import Theater from '../models/Theater.js';
import Booking from '../models/Booking.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildSeatMap, seatCapacity } from '../utils/seatMap.js';

/** Minutes a screen needs between shows for cleaning. */
const TURNAROUND_MINS = 20;

async function loadShowtimeOr404(id) {
  const showtime = await Showtime.findById(id)
    .populate('movie', 'title slug posterUrl durationMins certificate genres accentColor')
    .populate('theater', 'name city address amenities screens');
  if (!showtime) throw ApiError.notFound('Showtime not found', 'SHOWTIME_NOT_FOUND');
  return showtime;
}

/** 409 if the proposed slot collides with another show on the same screen. */
async function assertNoOverlap({ theaterId, screenId, startsAt, endsAt, excludeId }) {
  const filter = {
    theater: theaterId,
    screenId,
    status: 'scheduled',
    startsAt: { $lt: new Date(endsAt.getTime() + TURNAROUND_MINS * 60000) },
    endsAt: { $gt: new Date(startsAt.getTime() - TURNAROUND_MINS * 60000) },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await Showtime.findOne(filter).populate('movie', 'title');
  if (clash) {
    const title = clash.movie ? clash.movie.title : 'another show';
    throw ApiError.conflict(
      `This screen is busy with "${title}" until ${clash.endsAt.toISOString()}`,
      'SHOWTIME_OVERLAP',
      { conflictingShowtimeId: String(clash._id), startsAt: clash.startsAt, endsAt: clash.endsAt },
    );
  }
}

// GET /api/showtimes -> 200
export const listShowtimes = asyncHandler(async (req, res) => {
  const { movie, theater, city, date, includePast } = req.validatedQuery;
  const filter = { status: 'scheduled' };

  if (movie) {
    const movieDoc = mongoose.isValidObjectId(movie)
      ? await Movie.findById(movie).select('_id')
      : await Movie.findOne({ slug: movie }).select('_id');
    if (!movieDoc) throw ApiError.notFound('Movie not found', 'MOVIE_NOT_FOUND');
    filter.movie = movieDoc._id;
  }
  if (theater) filter.theater = theater;
  if (city) filter.city = city;

  if (date) {
    const day = new Date(`${date}T00:00:00`);
    if (Number.isNaN(day.getTime())) {
      throw ApiError.badRequest('date must be in YYYY-MM-DD format', 'INVALID_DATE');
    }
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    filter.startsAt = { $gte: day, $lt: next };
  } else if (!includePast) {
    filter.startsAt = { $gte: new Date() };
  }

  const showtimes = await Showtime.find(filter)
    .sort({ startsAt: 1 })
    .populate('movie', 'title slug posterUrl durationMins certificate accentColor')
    .populate('theater', 'name city address');

  res.status(200).json({ data: showtimes, meta: { total: showtimes.length } });
});

// GET /api/showtimes/:id -> 200 | 404  (includes the live seat map)
export const getShowtime = asyncHandler(async (req, res) => {
  const showtime = await loadShowtimeOr404(req.params.id);
  const screen = showtime.theater.screens.id(showtime.screenId);
  if (!screen) throw ApiError.notFound('Screen no longer exists', 'SCREEN_NOT_FOUND');

  const theaterJson = showtime.theater.toJSON();
  delete theaterJson.screens;

  res.status(200).json({
    data: {
      ...showtime.toJSON(),
      theater: theaterJson,
      screen: {
        id: String(screen._id),
        name: screen.name,
        rows: screen.rows,
        seatsPerRow: screen.seatsPerRow,
        format: screen.format,
        capacity: seatCapacity(screen),
      },
      seatMap: buildSeatMap(screen, showtime),
      legend: screen.seatClasses.map((c) => ({
        name: c.name,
        price: Math.round(showtime.basePrice * c.priceMultiplier),
        rows: c.rows,
      })),
    },
  });
});

// POST /api/showtimes -> 201 (admin)
export const createShowtime = asyncHandler(async (req, res) => {
  const { movieId, theaterId, screenId, startsAt, language, format, basePrice } = req.body;

  const [movie, theater] = await Promise.all([Movie.findById(movieId), Theater.findById(theaterId)]);
  if (!movie) throw ApiError.notFound('Movie not found', 'MOVIE_NOT_FOUND');
  if (!movie.isActive) throw ApiError.conflict('That movie is not active', 'MOVIE_INACTIVE');
  if (!theater) throw ApiError.notFound('Theater not found', 'THEATER_NOT_FOUND');

  const screen = theater.screens.id(screenId);
  if (!screen) throw ApiError.notFound('Screen not found in this theater', 'SCREEN_NOT_FOUND');

  const start = new Date(startsAt);
  if (start.getTime() <= Date.now()) {
    throw ApiError.badRequest('Showtime must start in the future', 'SHOWTIME_IN_PAST');
  }
  const end = new Date(start.getTime() + movie.durationMins * 60000);

  await assertNoOverlap({
    theaterId: theater._id,
    screenId: screen._id,
    startsAt: start,
    endsAt: end,
  });

  const showtime = await Showtime.create({
    movie: movie._id,
    theater: theater._id,
    screenId: screen._id,
    screenName: screen.name,
    city: theater.city,
    startsAt: start,
    endsAt: end,
    language,
    format: format || screen.format,
    basePrice,
    totalSeats: seatCapacity(screen),
  });

  await showtime.populate([
    { path: 'movie', select: 'title posterUrl' },
    { path: 'theater', select: 'name city' },
  ]);

  res.status(201).json({ data: showtime });
});

// PATCH /api/showtimes/:id -> 200 (admin)
export const updateShowtime = asyncHandler(async (req, res) => {
  const showtime = await Showtime.findById(req.params.id).populate('movie', 'durationMins title');
  if (!showtime) throw ApiError.notFound('Showtime not found', 'SHOWTIME_NOT_FOUND');
  if (showtime.status === 'cancelled') {
    throw ApiError.conflict('This showtime is cancelled', 'SHOWTIME_CANCELLED');
  }

  const soldSeats = showtime.bookedSeats.length;
  if (soldSeats > 0 && (req.body.startsAt || req.body.basePrice)) {
    throw ApiError.conflict(
      `${soldSeats} seat(s) are already sold - time and price are locked. Cancel the showtime to refund and reschedule.`,
      'SHOWTIME_HAS_BOOKINGS',
      { soldSeats },
    );
  }

  if (req.body.startsAt) {
    const start = new Date(req.body.startsAt);
    if (start.getTime() <= Date.now()) {
      throw ApiError.badRequest('Showtime must start in the future', 'SHOWTIME_IN_PAST');
    }
    const end = new Date(start.getTime() + showtime.movie.durationMins * 60000);
    await assertNoOverlap({
      theaterId: showtime.theater,
      screenId: showtime.screenId,
      startsAt: start,
      endsAt: end,
      excludeId: showtime._id,
    });
    showtime.startsAt = start;
    showtime.endsAt = end;
  }

  if (req.body.basePrice) showtime.basePrice = req.body.basePrice;
  if (req.body.language) showtime.language = req.body.language;
  if (req.body.format) showtime.format = req.body.format;

  await showtime.save();
  res.status(200).json({ data: showtime });
});

// POST /api/showtimes/:id/cancel -> 200 (admin), cancels the show and every booking on it
export const cancelShowtime = asyncHandler(async (req, res) => {
  const showtime = await Showtime.findById(req.params.id);
  if (!showtime) throw ApiError.notFound('Showtime not found', 'SHOWTIME_NOT_FOUND');
  if (showtime.status === 'cancelled') {
    throw ApiError.conflict('Showtime is already cancelled', 'ALREADY_CANCELLED');
  }

  showtime.status = 'cancelled';
  await showtime.save();

  const result = await Booking.updateMany(
    { showtime: showtime._id, status: 'confirmed' },
    {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: 'Showtime cancelled by the cinema',
    },
  );

  res.status(200).json({ data: { showtime, refundedBookings: result.modifiedCount } });
});

// DELETE /api/showtimes/:id -> 204 (admin)
export const deleteShowtime = asyncHandler(async (req, res) => {
  const showtime = await Showtime.findById(req.params.id);
  if (!showtime) throw ApiError.notFound('Showtime not found', 'SHOWTIME_NOT_FOUND');

  const bookings = await Booking.countDocuments({ showtime: showtime._id, status: 'confirmed' });
  if (bookings > 0) {
    throw ApiError.conflict(
      `Cannot delete: ${bookings} confirmed booking(s) exist. Cancel the showtime instead.`,
      'SHOWTIME_HAS_BOOKINGS',
      { bookings },
    );
  }

  await showtime.deleteOne();
  res.status(204).send();
});
