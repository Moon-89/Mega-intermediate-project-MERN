import mongoose from 'mongoose';
import Movie, { slugify } from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildMeta } from '../utils/pagination.js';

/** Escapes user input so it can be used safely inside a $regex filter. */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  newest: { createdAt: -1 },
  rating: { avgRating: -1, reviewCount: -1 },
  title: { title: 1 },
  releaseDate: { releaseDate: -1 },
};

async function findMovieOr404(idOrSlug) {
  const query = mongoose.isValidObjectId(idOrSlug)
    ? { _id: idOrSlug }
    : { slug: String(idOrSlug).toLowerCase() };
  const movie = await Movie.findOne(query);
  if (!movie) throw ApiError.notFound('Movie not found', 'MOVIE_NOT_FOUND');
  return movie;
}

// GET /api/movies -> 200
export const listMovies = asyncHandler(async (req, res) => {
  const { q, genre, language, status, sort, page, limit } = req.validatedQuery;

  const filter = {};
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (genre) filter.genres = genre;
  if (language) filter.languages = language;
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [items, total] = await Promise.all([
    Movie.find(filter)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit),
    Movie.countDocuments(filter),
  ]);

  res.status(200).json({ data: items, meta: buildMeta({ page, limit, total }) });
});

// GET /api/movies/:idOrSlug -> 200 | 404
export const getMovie = asyncHandler(async (req, res) => {
  const movie = await findMovieOr404(req.params.idOrSlug);
  const upcomingShowtimes = await Showtime.countDocuments({
    movie: movie._id,
    status: 'scheduled',
    startsAt: { $gte: new Date() },
  });
  res.status(200).json({ data: { ...movie.toJSON(), upcomingShowtimes } });
});

// GET /api/movies/meta/filters -> 200
export const movieFilters = asyncHandler(async (_req, res) => {
  const [genres, languages, cities] = await Promise.all([
    Movie.distinct('genres', { isActive: true }),
    Movie.distinct('languages', { isActive: true }),
    Showtime.distinct('city', { status: 'scheduled' }),
  ]);
  res.status(200).json({ data: { genres: genres.sort(), languages: languages.sort(), cities: cities.sort() } });
});

// POST /api/movies -> 201 (admin)
export const createMovie = asyncHandler(async (req, res) => {
  const slug = slugify(req.body.title);
  if (await Movie.exists({ slug })) {
    throw ApiError.conflict('A movie with that title already exists', 'MOVIE_EXISTS');
  }
  const movie = await Movie.create({ ...req.body, slug });
  res.status(201).json({ data: movie });
});

// PATCH /api/movies/:id -> 200 (admin)
export const updateMovie = asyncHandler(async (req, res) => {
  const movie = await findMovieOr404(req.params.id);

  if (req.body.title && req.body.title !== movie.title) {
    const slug = slugify(req.body.title);
    if (await Movie.exists({ slug, _id: { $ne: movie._id } })) {
      throw ApiError.conflict('A movie with that title already exists', 'MOVIE_EXISTS');
    }
    movie.slug = slug;
  }

  Object.assign(movie, req.body);
  await movie.save();
  res.status(200).json({ data: movie });
});

// DELETE /api/movies/:id -> 204 (admin)
export const deleteMovie = asyncHandler(async (req, res) => {
  const movie = await findMovieOr404(req.params.id);

  const upcoming = await Showtime.countDocuments({
    movie: movie._id,
    status: 'scheduled',
    startsAt: { $gte: new Date() },
  });
  if (upcoming > 0) {
    throw ApiError.conflict(
      `Cannot delete: ${upcoming} upcoming showtime(s) reference this movie. Cancel them first or deactivate the movie instead.`,
      'MOVIE_HAS_SHOWTIMES',
      { upcomingShowtimes: upcoming },
    );
  }

  await movie.deleteOne();
  res.status(204).send();
});
