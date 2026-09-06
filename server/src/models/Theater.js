import mongoose from 'mongoose';

export const SEAT_CLASSES = ['Classic', 'Premium', 'Recliner'];

/** A screen (auditorium) lives inside exactly one theater, so it is a subdocument. */
const screenSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    rows: { type: Number, required: true, min: 2, max: 20 },
    seatsPerRow: { type: Number, required: true, min: 4, max: 24 },
    format: { type: String, enum: ['2D', '3D', 'IMAX', '4DX'], default: '2D' },
    seatClasses: {
      type: [
        {
          _id: false,
          name: { type: String, enum: SEAT_CLASSES, required: true },
          rows: { type: [String], required: true },
          priceMultiplier: { type: Number, required: true, min: 0.5, max: 5 },
        },
      ],
      default: [],
    },
  },
  { versionKey: false },
);

const theaterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    city: { type: String, required: true, trim: true, index: true },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    amenities: { type: [String], default: [] },
    screens: { type: [screenSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

theaterSchema.index({ name: 1, city: 1 }, { unique: true });

const transform = (_doc, ret) => {
  ret.id = String(ret._id);
  delete ret._id;
  if (Array.isArray(ret.screens)) {
    ret.screens = ret.screens.map((s) => {
      const { _id, ...rest } = s;
      return { id: String(_id), ...rest };
    });
  }
  return ret;
};

theaterSchema.set('toJSON', { transform });

export default mongoose.model('Theater', theaterSchema);
