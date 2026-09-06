import mongoose from 'mongoose';

const CONVENIENCE_FEE_RATE = 0.06;

const bookingSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, uppercase: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    showtime: { type: mongoose.Schema.Types.ObjectId, ref: 'Showtime', required: true, index: true },
    // Snapshotted so a booking still reads correctly if the catalogue changes later.
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true, index: true },
    theater: { type: mongoose.Schema.Types.ObjectId, ref: 'Theater', required: true },
    snapshot: {
      movieTitle: String,
      posterUrl: String,
      theaterName: String,
      city: String,
      screenName: String,
      startsAt: Date,
      language: String,
      format: String,
    },
    seats: {
      type: [
        {
          _id: false,
          label: { type: String, required: true },
          seatClass: { type: String, required: true },
          price: { type: Number, required: true, min: 0 },
        },
      ],
      required: true,
      validate: [(v) => v.length > 0, 'At least one seat is required'],
    },
    subtotal: { type: Number, required: true, min: 0 },
    convenienceFee: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);

bookingSchema.statics.makeReference = function makeReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `CB-${out}`;
};

bookingSchema.statics.priceBreakdown = function priceBreakdown(seats) {
  const subtotal = seats.reduce((sum, s) => sum + s.price, 0);
  const convenienceFee = Math.round(subtotal * CONVENIENCE_FEE_RATE);
  return { subtotal, convenienceFee, totalAmount: subtotal + convenienceFee };
};

bookingSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Booking', bookingSchema);
