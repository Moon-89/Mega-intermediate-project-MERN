import { vi } from 'vitest';

/** Minimal fixtures shaped exactly like the real API envelopes. */
export const movieFixture = {
  id: '507f1f77bcf86cd799439011',
  title: 'Neon Harbour',
  slug: 'neon-harbour',
  synopsis: 'A burnt-out harbour pilot chases a signal that should not exist.',
  genres: ['Sci-Fi', 'Thriller'],
  languages: ['English'],
  durationMins: 138,
  certificate: 'UA',
  releaseDate: '2026-07-11T00:00:00.000Z',
  posterUrl: '',
  director: 'Ava Mendel',
  cast: ['Ines Kabir'],
  accentColor: '#22d3ee',
  isActive: true,
  avgRating: 4.2,
  reviewCount: 5,
  upcomingShowtimes: 3,
};

export const secondMovie = {
  ...movieFixture,
  id: '507f1f77bcf86cd799439012',
  title: 'Paper Tigers',
  slug: 'paper-tigers',
  genres: ['Comedy'],
  avgRating: 0,
  reviewCount: 0,
};

const inTwoDays = () => new Date(Date.now() + 2 * 24 * 3600000).toISOString();

export const showtimeFixture = {
  id: '507f1f77bcf86cd799439021',
  movie: movieFixture,
  theater: { id: '507f1f77bcf86cd799439031', name: 'Grand Cineplex', city: 'Mumbai', address: 'Harbour Mall' },
  screenName: 'Audi 2',
  city: 'Mumbai',
  startsAt: inTwoDays(),
  endsAt: inTwoDays(),
  language: 'English',
  format: '2D',
  basePrice: 200,
  totalSeats: 24,
  bookedSeats: ['A3'],
  seatsAvailable: 23,
  status: 'scheduled',
};

const seatRow = (row, price, bookedLabels) => ({
  row,
  seatClass: price > 200 ? 'Premium' : 'Classic',
  price,
  seats: Array.from({ length: 6 }, (_, i) => ({
    label: `${row}${i + 1}`,
    number: i + 1,
    isBooked: bookedLabels.includes(`${row}${i + 1}`),
    price,
  })),
});

export const showtimeDetailFixture = {
  ...showtimeFixture,
  screen: { id: 's1', name: 'Audi 2', rows: 4, seatsPerRow: 6, format: '2D', capacity: 24 },
  seatMap: [
    seatRow('A', 200, ['A3']),
    seatRow('B', 200, []),
    seatRow('C', 280, []),
    seatRow('D', 280, []),
  ],
  legend: [
    { name: 'Classic', price: 200, rows: ['A', 'B'] },
    { name: 'Premium', price: 280, rows: ['C', 'D'] },
  ],
};

export const userFixture = {
  id: '507f1f77bcf86cd799439041',
  name: 'Sam Viewer',
  email: 'user@cinebook.dev',
  role: 'user',
  phone: '',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const adminFixture = { ...userFixture, id: '507f1f77bcf86cd799439042', name: 'Ada Admin', email: 'admin@cinebook.dev', role: 'admin' };

export const statsFixture = {
  users: { total: 6, admins: 1, customers: 5 },
  catalogue: { movies: 8, activeMovies: 8, theaters: 4, upcomingShows: 252 },
  bookings: { confirmed: 23, cancelled: 3, seatsSold: 46, revenue: 24500, refunded: 3000 },
  occupancyRate: 4.2,
  revenueByDay: [{ date: '2026-09-01', revenue: 12000, bookings: 6 }],
  topMovies: [
    { movieId: movieFixture.id, title: 'Neon Harbour', posterUrl: '', revenue: 12000, seats: 20, bookings: 10 },
  ],
  recentBookings: [],
};

const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/**
 * Installs a fetch stub that answers the endpoints the UI touches.
 * `overrides` lets a single test change one route's response.
 */
export function mockApi(overrides = {}) {
  const calls = [];

  const handler = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    const [path, qs = ''] = String(url).split('?');
    const query = new URLSearchParams(qs);
    const key = `${method} ${path}`;
    calls.push({ key, query, body: options.body ? JSON.parse(options.body) : undefined });

    if (overrides[key]) return overrides[key]({ query, options, json });

    switch (true) {
      case key === 'GET /api/movies/meta/filters':
        return json({ data: { genres: ['Sci-Fi', 'Comedy'], languages: ['English'], cities: ['Mumbai'] } });

      case key === 'GET /api/movies': {
        const q = (query.get('q') || '').toLowerCase();
        const genre = query.get('genre');
        let data = [movieFixture, secondMovie];
        if (q) data = data.filter((m) => m.title.toLowerCase().includes(q));
        if (genre) data = data.filter((m) => m.genres.includes(genre));
        return json({
          data,
          meta: { page: 1, limit: 12, total: data.length, totalPages: 1, hasNextPage: false, hasPrevPage: false },
        });
      }

      case key === `GET /api/movies/${movieFixture.slug}`:
      case key === `GET /api/movies/${movieFixture.id}`:
        return json({ data: movieFixture });

      case key.startsWith('GET /api/movies/') && path.endsWith('/reviews'):
        return json({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1, myReviewId: null } });

      case key === 'GET /api/showtimes':
        return json({ data: [showtimeFixture], meta: { total: 1 } });

      case key === `GET /api/showtimes/${showtimeFixture.id}`:
        return json({ data: showtimeDetailFixture });

      case key === 'GET /api/theaters':
        return json({ data: [], meta: { total: 0 } });

      case key === 'POST /api/auth/login': {
        const body = JSON.parse(options.body);
        const user = body.email === adminFixture.email ? adminFixture : userFixture;
        if (body.password !== 'Admin@123' && body.password !== 'User@123') {
          return json({ error: { code: 'BAD_CREDENTIALS', message: 'Email or password is incorrect' } }, 401);
        }
        return json({ data: { user, token: `token-for-${user.role}` } });
      }

      case key === 'GET /api/auth/me': {
        const token = options.headers?.Authorization || '';
        if (!token) return json({ error: { code: 'NO_TOKEN', message: 'Missing bearer token' } }, 401);
        return json({ data: token.includes('admin') ? adminFixture : userFixture });
      }

      case key === 'POST /api/bookings': {
        const body = JSON.parse(options.body);
        return json(
          {
            data: {
              id: '507f1f77bcf86cd799439051',
              reference: 'CB-ABC123',
              status: 'confirmed',
              seats: body.seats.map((label) => ({ label, seatClass: 'Classic', price: 200 })),
              subtotal: body.seats.length * 200,
              convenienceFee: 24,
              totalAmount: body.seats.length * 200 + 24,
              snapshot: showtimeFixture,
              createdAt: new Date().toISOString(),
            },
          },
          201,
        );
      }

      case key === 'GET /api/bookings/me':
        return json({ data: [], meta: { page: 1, limit: 8, total: 0, totalPages: 1 } });

      case key === 'GET /api/admin/stats':
        return json({ data: statsFixture });

      default:
        return json({ error: { code: 'ROUTE_NOT_FOUND', message: `No mock for ${key}` } }, 404);
    }
  });

  global.fetch = handler;
  return { handler, calls };
}
