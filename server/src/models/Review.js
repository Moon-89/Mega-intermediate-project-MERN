import mongoose from 'mongoose';
import Movie from './Movie.js';

const reviewSchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 800, default: '' },
  },
  { timestamps: true, versionKey: false },
);

// One review per user per movie.
reviewSchema.index({ movie: 1, user: 1 }, { unique: true });

/** Recomputes the denormalised rating aggregate stored on the movie. */
reviewSchema.statics.syncMovieRating = async function syncMovieRating(movieId) {
  const [agg] = await this.aggregate([
    { $match: { movie: new mongoose.Types.ObjectId(String(movieId)) } },
    { $group: { _id: '$movie', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Movie.findByIdAndUpdate(movieId, {
    avgRating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    reviewCount: agg ? agg.count : 0,
  });
};

reviewSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Review', reviewSchema);
