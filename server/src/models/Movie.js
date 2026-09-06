import mongoose from 'mongoose';

export const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama',
  'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
];

export const CERTIFICATES = ['U', 'UA', 'A', 'PG-13', 'R'];

export const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    synopsis: { type: String, required: true, trim: true, maxlength: 2000 },
    genres: {
      type: [{ type: String, enum: GENRES }],
      validate: [(v) => v.length > 0, 'At least one genre is required'],
    },
    languages: { type: [String], default: ['English'] },
    durationMins: { type: Number, required: true, min: 30, max: 300 },
    certificate: { type: String, enum: CERTIFICATES, default: 'UA' },
    releaseDate: { type: Date, required: true },
    posterUrl: { type: String, default: '' },
    trailerUrl: { type: String, default: '' },
    director: { type: String, default: '', trim: true },
    cast: { type: [String], default: [] },
    accentColor: { type: String, default: '#e11d48' },
    isActive: { type: Boolean, default: true, index: true },
    // Denormalised review aggregates, refreshed whenever a review changes.
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

movieSchema.index({ title: 'text', synopsis: 'text', director: 'text' });

movieSchema.pre('validate', function assignSlug(next) {
  if (!this.slug && this.title) this.slug = slugify(this.title);
  next();
});

movieSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Movie', movieSchema);
