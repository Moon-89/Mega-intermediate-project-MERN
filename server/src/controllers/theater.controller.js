import Theater from '../models/Theater.js';
import Showtime from '../models/Showtime.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { seatCapacity } from '../utils/seatMap.js';

async function findTheaterOr404(id) {
  const theater = await Theater.findById(id);
  if (!theater) throw ApiError.notFound('Theater not found', 'THEATER_NOT_FOUND');
  return theater;
}

// GET /api/theaters -> 200
export const listTheaters = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.city) filter.city = req.query.city;
  const theaters = await Theater.find(filter).sort({ city: 1, name: 1 });
  res.status(200).json({ data: theaters, meta: { total: theaters.length } });
});

// GET /api/theaters/:id -> 200 | 404
export const getTheater = asyncHandler(async (req, res) => {
  const theater = await findTheaterOr404(req.params.id);
  res.status(200).json({ data: theater });
});

// POST /api/theaters -> 201 (admin)
export const createTheater = asyncHandler(async (req, res) => {
  const exists = await Theater.exists({ name: req.body.name, city: req.body.city });
  if (exists) throw ApiError.conflict('That theater already exists in this city', 'THEATER_EXISTS');
  const theater = await Theater.create(req.body);
  res.status(201).json({ data: theater });
});

// PATCH /api/theaters/:id -> 200 (admin)
export const updateTheater = asyncHandler(async (req, res) => {
  const theater = await findTheaterOr404(req.params.id);
  Object.assign(theater, req.body);
  await theater.save();
  if (req.body.city) {
    await Showtime.updateMany({ theater: theater._id }, { city: theater.city });
  }
  res.status(200).json({ data: theater });
});

// DELETE /api/theaters/:id -> 204 (admin)
export const deleteTheater = asyncHandler(async (req, res) => {
  const theater = await findTheaterOr404(req.params.id);
  const upcoming = await Showtime.countDocuments({
    theater: theater._id,
    status: 'scheduled',
    startsAt: { $gte: new Date() },
  });
  if (upcoming > 0) {
    throw ApiError.conflict(
      `Cannot delete: ${upcoming} upcoming showtime(s) are scheduled here`,
      'THEATER_HAS_SHOWTIMES',
      { upcomingShowtimes: upcoming },
    );
  }
  await theater.deleteOne();
  res.status(204).send();
});

// POST /api/theaters/:id/screens -> 201 (admin)
export const addScreen = asyncHandler(async (req, res) => {
  const theater = await findTheaterOr404(req.params.id);
  if (theater.screens.some((s) => s.name.toLowerCase() === req.body.name.toLowerCase())) {
    throw ApiError.conflict('That screen name is already used in this theater', 'SCREEN_EXISTS');
  }
  theater.screens.push(req.body);
  await theater.save();
  const screen = theater.screens[theater.screens.length - 1];
  res.status(201).json({ data: { ...screen.toJSON(), id: String(screen._id), capacity: seatCapacity(screen) } });
});

// DELETE /api/theaters/:id/screens/:screenId -> 204 (admin)
export const removeScreen = asyncHandler(async (req, res) => {
  const theater = await findTheaterOr404(req.params.id);
  const screen = theater.screens.id(req.params.screenId);
  if (!screen) throw ApiError.notFound('Screen not found', 'SCREEN_NOT_FOUND');

  const upcoming = await Showtime.countDocuments({
    theater: theater._id,
    screenId: screen._id,
    status: 'scheduled',
    startsAt: { $gte: new Date() },
  });
  if (upcoming > 0) {
    throw ApiError.conflict(
      `Cannot delete: ${upcoming} upcoming showtime(s) use this screen`,
      'SCREEN_HAS_SHOWTIMES',
    );
  }

  screen.deleteOne();
  await theater.save();
  res.status(204).send();
});
