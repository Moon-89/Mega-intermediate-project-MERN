import mongoose from 'mongoose';

const showtimeSchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true, index: true },
    theater: { type: mongoose.Schema.Types.ObjectId, ref: 'Theater', required: true, index: true },
    screenId: { type: mongoose.Schema.Types.ObjectId, required: true },
    screenName: { type: String, required: true },
    city: { type: String, required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    language: { type: String, required: true, default: 'English' },
    format: { type: String, enum: ['2D', '3D', 'IMAX', '4DX'], default: '2D' },
    basePrice: { type: Number, required: true, min: 1 },
    totalSeats: { type: Number, required: true, min: 1 },
    /**
     * Seat labels already sold. Kept on the showtime document so a booking can be
     * claimed with one atomic findOneAndUpdate — this is what prevents two people
     * buying the same seat.
     */
    bookedSeats: { type: [String], default: [] },
    status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled', index: true },
  },
  { timestamps: true, versionKey: false },
);

showtimeSchema.index({ movie: 1, startsAt: 1 });
showtimeSchema.index({ theater: 1, screenId: 1, startsAt: 1 });

showtimeSchema.virtual('seatsAvailable').get(function seatsAvailable() {
  return Math.max(0, this.totalSeats - (this.bookedSeats?.length || 0));
});

showtimeSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Showtime', showtimeSchema);
