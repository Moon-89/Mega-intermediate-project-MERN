/**
 * End-to-end API tests. Runs against a throwaway in-memory MongoDB.
 *   npm test
 */
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = '';
process.env.JWT_SECRET = 'test-secret';

const { createApp } = await import('../src/app.js');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { seedAll } = await import('../src/seed.js');

let app;
let adminToken;
let userToken;
let otherToken;
let movie;
let showtime;

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  await connectDB();
  await seedAll({ quiet: true });
  app = createApp({ logging: false });

  const admin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@cinebook.dev', password: 'Admin@123' });
  adminToken = admin.body.data.token;

  const user = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@cinebook.dev', password: 'User@123' });
  userToken = user.body.data.token;

  const other = await request(app).post('/api/auth/register').send({
    name: 'Other Person',
    email: 'other@example.com',
    password: 'Other@123',
  });
  otherToken = other.body.data.token;
});

after(async () => {
  await disconnectDB();
});

describe('health & routing', () => {
  test('GET /api/health -> 200', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'ok');
  });

  test('unknown route -> 404 with an error envelope', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
  });

  test('malformed JSON body -> 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });
});

describe('auth', () => {
  test('POST /api/auth/register -> 201 and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New Person', email: 'new@example.com', password: 'Str0ngPass' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'user');
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.passwordHash, undefined);
  });

  test('duplicate email -> 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Copy Cat', email: 'new@example.com', password: 'Str0ngPass' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  });

  test('weak password -> 422 with field details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Weak', email: 'weak@example.com', password: 'abc' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.field === 'password'));
  });

  test('wrong password -> 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@cinebook.dev', password: 'nope' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'BAD_CREDENTIALS');
  });

  test('GET /api/auth/me -> 401 without a token, 200 with one', async () => {
    assert.equal((await request(app).get('/api/auth/me')).status, 401);

    const res = await request(app).get('/api/auth/me').set(bearer(userToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, 'user@cinebook.dev');
  });

  test('a tampered token -> 401', async () => {
    const res = await request(app).get('/api/auth/me').set(bearer(`${userToken}x`));
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });
});

describe('movies', () => {
  test('GET /api/movies -> 200 with pagination meta', async () => {
    const res = await request(app).get('/api/movies?limit=5');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 5);
    assert.equal(res.body.meta.limit, 5);
    assert.ok(res.body.meta.total >= 8);
    [movie] = res.body.data;
  });

  test('search and genre filters narrow the list', async () => {
    const res = await request(app).get('/api/movies?q=neon&genre=Sci-Fi');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].title, 'Neon Harbour');
  });

  test('GET /api/movies/:slug -> 200, unknown -> 404', async () => {
    const ok = await request(app).get('/api/movies/neon-harbour');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.slug, 'neon-harbour');

    const missing = await request(app).get('/api/movies/not-a-real-movie');
    assert.equal(missing.status, 404);
  });

  test('creating a movie: 401 anon, 403 user, 201 admin', async () => {
    const payload = {
      title: 'Test Feature',
      synopsis: 'A movie created by the automated test suite for verification.',
      genres: ['Drama'],
      durationMins: 100,
      releaseDate: '2026-01-01',
    };

    assert.equal((await request(app).post('/api/movies').send(payload)).status, 401);

    const forbidden = await request(app).post('/api/movies').set(bearer(userToken)).send(payload);
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, 'ROLE_REQUIRED');

    const created = await request(app).post('/api/movies').set(bearer(adminToken)).send(payload);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.slug, 'test-feature');

    const dup = await request(app).post('/api/movies').set(bearer(adminToken)).send(payload);
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'MOVIE_EXISTS');

    const patched = await request(app)
      .patch(`/api/movies/${created.body.data.id}`)
      .set(bearer(adminToken))
      .send({ durationMins: 111 });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.durationMins, 111);

    const removed = await request(app)
      .delete(`/api/movies/${created.body.data.id}`)
      .set(bearer(adminToken));
    assert.equal(removed.status, 204);
  });

  test('invalid movie payload -> 422', async () => {
    const res = await request(app)
      .post('/api/movies')
      .set(bearer(adminToken))
      .send({ title: 'X', synopsis: 'short', genres: [], durationMins: 5 });
    assert.equal(res.status, 422);
    assert.ok(res.body.error.details.length >= 3);
  });

  test('deleting a movie that has upcoming showtimes -> 409', async () => {
    const res = await request(app).delete(`/api/movies/${movie.id}`).set(bearer(adminToken));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'MOVIE_HAS_SHOWTIMES');
  });

  test('a malformed id -> 400', async () => {
    const res = await request(app).delete('/api/movies/12345').set(bearer(adminToken));
    assert.equal(res.status, 400);
  });
});

describe('showtimes', () => {
  test('GET /api/showtimes -> 200, only future scheduled shows', async () => {
    const res = await request(app).get('/api/showtimes');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    for (const s of res.body.data.slice(0, 20)) {
      assert.ok(new Date(s.startsAt).getTime() > Date.now());
      assert.equal(s.status, 'scheduled');
    }
    // Pick a clean show at least a day out so the 2-hour cancellation window is open.
    showtime = res.body.data.find(
      (s) =>
        s.movie &&
        s.bookedSeats.length === 0 &&
        new Date(s.startsAt).getTime() > Date.now() + 26 * 3600000,
    );
    assert.ok(showtime, 'expected a seeded showtime more than a day away');
  });

  test('GET /api/showtimes/:id -> 200 with a full seat map', async () => {
    const res = await request(app).get(`/api/showtimes/${showtime.id}`);
    assert.equal(res.status, 200);
    const { seatMap, screen, legend } = res.body.data;
    assert.equal(seatMap.length, screen.rows);
    assert.equal(seatMap[0].seats.length, screen.seatsPerRow);
    assert.ok(legend.length >= 1);
    assert.ok(seatMap[0].seats[0].price > 0);
  });

  test('scheduling a show in the past -> 400', async () => {
    const theaters = await request(app).get('/api/theaters');
    const theater = theaters.body.data[0];
    const res = await request(app)
      .post('/api/showtimes')
      .set(bearer(adminToken))
      .send({
        movieId: movie.id,
        theaterId: theater.id,
        screenId: theater.screens[0].id,
        startsAt: new Date(Date.now() - 3600000).toISOString(),
        basePrice: 200,
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'SHOWTIME_IN_PAST');
  });

  test('double-booking a screen -> 409 SHOWTIME_OVERLAP', async () => {
    const theaters = await request(app).get('/api/theaters');
    const theater = theaters.body.data[0];
    const startsAt = new Date(Date.now() + 40 * 24 * 3600000).toISOString();

    const body = {
      movieId: movie.id,
      theaterId: theater.id,
      screenId: theater.screens[0].id,
      startsAt,
      basePrice: 300,
    };

    const first = await request(app).post('/api/showtimes').set(bearer(adminToken)).send(body);
    assert.equal(first.status, 201);

    const clash = await request(app).post('/api/showtimes').set(bearer(adminToken)).send(body);
    assert.equal(clash.status, 409);
    assert.equal(clash.body.error.code, 'SHOWTIME_OVERLAP');

    const gone = await request(app)
      .delete(`/api/showtimes/${first.body.data.id}`)
      .set(bearer(adminToken));
    assert.equal(gone.status, 204);
  });
});

describe('bookings', () => {
  let bookingId;

  test('POST /api/bookings -> 401 without a token', async () => {
    const res = await request(app).post('/api/bookings').send({ showtimeId: showtime.id, seats: ['A1'] });
    assert.equal(res.status, 401);
  });

  test('a seat that does not exist on the screen -> 422', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(bearer(userToken))
      .send({ showtimeId: showtime.id, seats: ['T24'] });
    assert.equal(res.status, 422);
  });

  test('POST /api/bookings -> 201 and marks the seats sold', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(bearer(userToken))
      .send({ showtimeId: showtime.id, seats: ['C5', 'C6'] });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.seats.length, 2);
    assert.equal(res.body.data.status, 'confirmed');
    assert.ok(res.body.data.reference.startsWith('CB-'));
    assert.equal(
      res.body.data.totalAmount,
      res.body.data.subtotal + res.body.data.convenienceFee,
    );
    bookingId = res.body.data.id;

    const detail = await request(app).get(`/api/showtimes/${showtime.id}`);
    const row = detail.body.data.seatMap.find((r) => r.row === 'C');
    assert.equal(row.seats.find((s) => s.label === 'C5').isBooked, true);
  });

  test('booking a taken seat -> 409 with the offending seats', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(bearer(otherToken))
      .send({ showtimeId: showtime.id, seats: ['C6', 'C7'] });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'SEATS_UNAVAILABLE');
    assert.deepEqual(res.body.error.details.unavailableSeats, ['C6']);
  });

  test('two simultaneous requests for the same seat: exactly one wins', async () => {
    const attempt = (token) =>
      request(app)
        .post('/api/bookings')
        .set(bearer(token))
        .send({ showtimeId: showtime.id, seats: ['D9'] });

    const results = await Promise.all([attempt(userToken), attempt(otherToken)]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409]);
  });

  test('GET /api/bookings/me -> 200, scoped to the caller', async () => {
    const mine = await request(app).get('/api/bookings/me').set(bearer(userToken));
    assert.equal(mine.status, 200);
    assert.ok(mine.body.meta.total >= 1);
    assert.ok(mine.body.data.some((b) => b.id === bookingId));

    // A different account never sees it.
    const theirs = await request(app).get('/api/bookings/me').set(bearer(otherToken));
    assert.equal(theirs.status, 200);
    assert.ok(!theirs.body.data.some((b) => b.id === bookingId));
  });

  test("reading another user's booking -> 403, admin -> 200", async () => {
    const forbidden = await request(app).get(`/api/bookings/${bookingId}`).set(bearer(otherToken));
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, 'NOT_YOUR_BOOKING');

    const asAdmin = await request(app).get(`/api/bookings/${bookingId}`).set(bearer(adminToken));
    assert.equal(asAdmin.status, 200);
  });

  test('listing every booking is admin-only', async () => {
    assert.equal((await request(app).get('/api/bookings').set(bearer(userToken))).status, 403);
    assert.equal((await request(app).get('/api/bookings').set(bearer(adminToken))).status, 200);
  });

  test('cancelling releases the seats; cancelling twice -> 409', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set(bearer(userToken))
      .send({ reason: 'Changed my mind' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'cancelled');

    const detail = await request(app).get(`/api/showtimes/${showtime.id}`);
    const row = detail.body.data.seatMap.find((r) => r.row === 'C');
    assert.equal(row.seats.find((s) => s.label === 'C5').isBooked, false);

    const again = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set(bearer(userToken))
      .send({});
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'ALREADY_CANCELLED');
  });

  test('more than 10 seats in one order -> 422', async () => {
    const seats = Array.from({ length: 11 }, (_, i) => `A${i + 1}`);
    const res = await request(app)
      .post('/api/bookings')
      .set(bearer(userToken))
      .send({ showtimeId: showtime.id, seats });
    assert.equal(res.status, 422);
  });
});

describe('reviews', () => {
  let reviewId;

  test('POST a review -> 201, duplicate -> 409', async () => {
    const target = await request(app).get('/api/movies/gravity-debt');
    const movieId = target.body.data.id;

    await request(app)
      .post(`/api/movies/${movieId}/reviews`)
      .set(bearer(otherToken))
      .send({ rating: 5, comment: 'Great' })
      .then((r) => {
        assert.equal(r.status, 201);
        reviewId = r.body.data.id;
      });

    const dup = await request(app)
      .post(`/api/movies/${movieId}/reviews`)
      .set(bearer(otherToken))
      .send({ rating: 4, comment: 'Again' });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'REVIEW_EXISTS');

    const listed = await request(app).get(`/api/movies/${movieId}/reviews`);
    assert.equal(listed.status, 200);
    assert.ok(listed.body.data.length > 0);

    const refreshed = await request(app).get('/api/movies/gravity-debt');
    assert.ok(refreshed.body.data.reviewCount > 0);
    assert.ok(refreshed.body.data.avgRating > 0);
  });

  test('rating outside 1-5 -> 422', async () => {
    const target = await request(app).get('/api/movies/winterhold');
    const res = await request(app)
      .post(`/api/movies/${target.body.data.id}/reviews`)
      .set(bearer(userToken))
      .send({ rating: 9 });
    assert.equal(res.status, 422);
  });

  test("editing someone else's review -> 403; own -> 200; delete -> 204", async () => {
    const forbidden = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set(bearer(userToken))
      .send({ rating: 1, comment: 'nope' });
    assert.equal(forbidden.status, 403);

    const ok = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set(bearer(otherToken))
      .send({ rating: 4, comment: 'Revised opinion' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.rating, 4);

    const removed = await request(app).delete(`/api/reviews/${reviewId}`).set(bearer(otherToken));
    assert.equal(removed.status, 204);
  });
});

describe('admin', () => {
  test('GET /api/admin/stats -> 403 for a user, 200 for an admin', async () => {
    assert.equal((await request(app).get('/api/admin/stats').set(bearer(userToken))).status, 403);

    const res = await request(app).get('/api/admin/stats').set(bearer(adminToken));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.bookings.confirmed >= 1);
    assert.ok(res.body.data.catalogue.movies >= 8);
    assert.ok(Array.isArray(res.body.data.topMovies));
  });

  test('GET /api/admin/users -> 200 with booking counts', async () => {
    const res = await request(app).get('/api/admin/users').set(bearer(adminToken));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.every((u) => typeof u.bookingCount === 'number'));
  });

  test('promoting and demoting a user', async () => {
    const list = await request(app).get('/api/admin/users?q=other@example.com').set(bearer(adminToken));
    const target = list.body.data[0];

    const promoted = await request(app)
      .patch(`/api/admin/users/${target.id}/role`)
      .set(bearer(adminToken))
      .send({ role: 'admin' });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.data.role, 'admin');

    const demoted = await request(app)
      .patch(`/api/admin/users/${target.id}/role`)
      .set(bearer(adminToken))
      .send({ role: 'user' });
    assert.equal(demoted.status, 200);
  });

  test('an admin cannot change their own role -> 409', async () => {
    const me = await request(app).get('/api/auth/me').set(bearer(adminToken));
    const res = await request(app)
      .patch(`/api/admin/users/${me.body.data.id}/role`)
      .set(bearer(adminToken))
      .send({ role: 'user' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'SELF_ROLE_CHANGE');
  });

  test('cancelling a showtime refunds every booking on it', async () => {
    const res = await request(app)
      .post(`/api/showtimes/${showtime.id}/cancel`)
      .set(bearer(adminToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.showtime.status, 'cancelled');
    assert.ok(res.body.data.refundedBookings >= 1);

    const again = await request(app)
      .post(`/api/showtimes/${showtime.id}/cancel`)
      .set(bearer(adminToken));
    assert.equal(again.status, 409);
  });
});
