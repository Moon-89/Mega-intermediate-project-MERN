import { z } from 'zod';
import { GENRES, CERTIFICATES } from '../models/Movie.js';
import { SEAT_CLASSES } from '../models/Theater.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date');
const trimmed = (min, max) => z.string().trim().min(min).max(max);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[0-9]/, 'Password needs a number');

/* ------------------------------- auth ---------------------------------- */

export const registerSchema = z.object({
  name: trimmed(2, 60),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: passwordSchema,
  phone: z.string().trim().max(20).optional().default(''),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateMeSchema = z
  .object({
    name: trimmed(2, 60).optional(),
    phone: z.string().trim().max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

/* ------------------------------ movies --------------------------------- */

export const movieCreateSchema = z.object({
  title: trimmed(1, 140),
  synopsis: trimmed(10, 2000),
  genres: z.array(z.enum(GENRES)).min(1, 'Pick at least one genre').max(5),
  languages: z.array(trimmed(1, 30)).min(1).default(['English']),
  durationMins: z.coerce.number().int().min(30).max(300),
  certificate: z.enum(CERTIFICATES).default('UA'),
  releaseDate: isoDate,
  posterUrl: z.string().trim().url('Poster must be a URL').or(z.literal('')).default(''),
  trailerUrl: z.string().trim().url('Trailer must be a URL').or(z.literal('')).default(''),
  director: z.string().trim().max(80).default(''),
  cast: z.array(trimmed(1, 80)).max(20).default([]),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour').default('#e11d48'),
  isActive: z.boolean().default(true),
});

export const movieUpdateSchema = movieCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const movieQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  genre: z.string().trim().optional(),
  language: z.string().trim().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('active'),
  sort: z.enum(['newest', 'rating', 'title', 'releaseDate']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

/* ----------------------------- theaters -------------------------------- */

export const screenSchema = z
  .object({
    name: trimmed(1, 40),
    rows: z.coerce.number().int().min(2).max(20),
    seatsPerRow: z.coerce.number().int().min(4).max(24),
    format: z.enum(['2D', '3D', 'IMAX', '4DX']).default('2D'),
    seatClasses: z
      .array(
        z.object({
          name: z.enum(SEAT_CLASSES),
          rows: z.array(z.string().regex(/^[A-T]$/, 'Row must be a letter A-T')).min(1),
          priceMultiplier: z.coerce.number().min(0.5).max(5),
        }),
      )
      .min(1, 'Define at least one seat class'),
  })
  .superRefine((screen, ctx) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, screen.rows).split('');
    const covered = new Set(screen.seatClasses.flatMap((c) => c.rows));
    const missing = letters.filter((l) => !covered.has(l));
    if (missing.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['seatClasses'],
        message: `Rows ${missing.join(', ')} are not assigned to a seat class`,
      });
    }
    const extra = [...covered].filter((l) => !letters.includes(l));
    if (extra.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['seatClasses'],
        message: `Rows ${extra.join(', ')} do not exist on a ${screen.rows}-row screen`,
      });
    }
  });

export const theaterCreateSchema = z.object({
  name: trimmed(2, 100),
  city: trimmed(2, 60),
  address: trimmed(4, 200),
  amenities: z.array(trimmed(1, 40)).max(12).default([]),
  screens: z.array(screenSchema).default([]),
});

export const theaterUpdateSchema = z
  .object({
    name: trimmed(2, 100).optional(),
    city: trimmed(2, 60).optional(),
    address: trimmed(4, 200).optional(),
    amenities: z.array(trimmed(1, 40)).max(12).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

/* ----------------------------- showtimes ------------------------------- */

export const showtimeCreateSchema = z.object({
  movieId: objectId,
  theaterId: objectId,
  screenId: objectId,
  startsAt: isoDate,
  language: trimmed(1, 30).default('English'),
  format: z.enum(['2D', '3D', 'IMAX', '4DX']).default('2D'),
  basePrice: z.coerce.number().int().min(1).max(10000),
});

export const showtimeUpdateSchema = z
  .object({
    startsAt: isoDate.optional(),
    basePrice: z.coerce.number().int().min(1).max(10000).optional(),
    language: trimmed(1, 30).optional(),
    format: z.enum(['2D', '3D', 'IMAX', '4DX']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const showtimeQuerySchema = z.object({
  movie: z.string().trim().optional(),
  theater: objectId.optional(),
  city: z.string().trim().optional(),
  date: z.string().trim().optional(),
  includePast: z.coerce.boolean().default(false),
});

/* ----------------------------- bookings -------------------------------- */

export const bookingCreateSchema = z.object({
  showtimeId: objectId,
  seats: z
    .array(z.string().trim().toUpperCase().regex(/^[A-T]([1-9]|1\d|2[0-4])$/, 'Seat looks like "C7"'))
    .min(1, 'Select at least one seat')
    .max(10, 'A maximum of 10 seats can be booked at once')
    .refine((s) => new Set(s).size === s.length, 'Duplicate seats in selection'),
});

export const bookingCancelSchema = z.object({
  reason: z.string().trim().max(200).optional().default(''),
});

export const bookingQuerySchema = z.object({
  status: z.enum(['all', 'confirmed', 'cancelled']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/* ------------------------------ reviews -------------------------------- */

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(800).default(''),
});

export const idParamSchema = z.object({ id: objectId });
