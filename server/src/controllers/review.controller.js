import Review from '../models/Review.js';
import Movie from '../models/Movie.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildMeta, parsePagination } from '../utils/pagination.js';

async function assertMovieExists(movieId) {
  const exists = await Movie.exists({ _id: movieId });
  if (!exists) throw ApiError.notFound('Movie not found', 'MOVIE_NOT_FOUND');
}

// GET /api/movies/:id/reviews -> 200
export const listReviews = asyncHandler(async (req, res) => {
  await assertMovieExists(req.params.id);
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });

  const [items, total] = await Promise.all([
    Review.find({ movie: req.params.id })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments({ movie: req.params.id }),
  ]);

  const mine = req.user
    ? await Review.findOne({ movie: req.params.id, user: req.user._id })
    : null;

  res.status(200).json({
    data: items,
    meta: { ...buildMeta({ page, limit, total }), myReviewId: mine ? String(mine._id) : null },
  });
});

// POST /api/movies/:id/reviews -> 201 | 409 when the user already reviewed it
export const createReview = asyncHandler(async (req, res) => {
  await assertMovieExists(req.params.id);

  const existing = await Review.findOne({ movie: req.params.id, user: req.user._id });
  if (existing) {
    throw ApiError.conflict(
      'You have already reviewed this movie - edit your review instead',
      'REVIEW_EXISTS',
      { reviewId: String(existing._id) },
    );
  }

  const review = await Review.create({
    movie: req.params.id,
    user: req.user._id,
    rating: req.body.rating,
    comment: req.body.comment,
  });
  await Review.syncMovieRating(req.params.id);
  await review.populate('user', 'name');

  res.status(201).json({ data: review });
});

// PATCH /api/reviews/:id -> 200
export const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found', 'REVIEW_NOT_FOUND');
  if (String(review.user) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only edit your own review', 'NOT_YOUR_REVIEW');
  }

  review.rating = req.body.rating;
  review.comment = req.body.comment;
  await review.save();
  await Review.syncMovieRating(review.movie);
  await review.populate('user', 'name');

  res.status(200).json({ data: review });
});

// DELETE /api/reviews/:id -> 204 (owner or admin)
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found', 'REVIEW_NOT_FOUND');
  if (String(review.user) !== String(req.user._id) && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own review', 'NOT_YOUR_REVIEW');
  }

  const movieId = review.movie;
  await review.deleteOne();
  await Review.syncMovieRating(movieId);

  res.status(204).send();
});
