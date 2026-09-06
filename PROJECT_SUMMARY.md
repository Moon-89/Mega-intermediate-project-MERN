# Project Summary — CineBook

**Option 1 — Movie Ticket Booking System** · MERN stack · ~8,800 lines of source across 70 files

## What it is

A working cinema booking platform. A visitor browses films, opens a showtime, picks seats on a
live seat map that shows what is already sold and what each row costs, and confirms a booking
that produces a referenced ticket they can cancel later. An admin signs into the same app and
gets a separate console: film CRUD, theaters and screens with configurable seat-class bands,
show scheduling with conflict detection, every booking in the system, user role management, and a
dashboard of revenue, occupancy and top-performing films.

## Acceptance criteria

**Complex relational data model with at least 4 collections — 6 collections.**
`users`, `movies`, `theaters` (with screens as subdocuments), `showtimes`, `bookings`, `reviews`.
A booking references a user, a showtime, a movie and a theater; a showtime references a movie, a
theater and a specific screen inside it; a review has a compound unique index on `(movie, user)`.
Bookings also carry a `snapshot` of the film, venue and time, so a past ticket still reads
correctly after the catalogue changes underneath it, and movies carry denormalised
`avgRating`/`reviewCount` aggregates refreshed on every review write.

**Role-based authentication — admin vs user.**
JWT bearer tokens, bcrypt-hashed passwords that are never returned by any endpoint. Three
enforcement layers: `requireAuth` (401), `requireRole('admin')` (403) on every catalogue write and
all `/admin` routes, and per-resource ownership checks so a customer cannot read or cancel someone
else's booking or edit someone else's review — with a deliberate exception letting admins do both.
The React app mirrors this with route guards, but the API is the authority.

**Clean API contract with proper status codes.**
Every response uses one envelope: `{ data, meta }` on success, `{ error: { code, message, details } }`
on failure. Request bodies and query strings are validated with Zod, so a 422 always carries a
per-field `details` array the UI turns into inline form errors. The API uses 200, 201, 204, 400,
401, 403, 404, 409, 422, 429 and 500 for what each actually means — 409 in particular is used for
real state conflicts: seats sold from under you, a screen already busy, a duplicate title, an
already-cancelled booking, deleting a film that still has upcoming shows.

**Frontend and backend fully integrated.**
Thirteen screens against thirty-two endpoints, no mock data in the app. Loading, empty and error
states everywhere, toasts on every mutation, debounced search reflected in the URL, and pagination
driven by the server's `meta`.

## The interesting problem

Two people clicking the same seat at the same moment. Seats live on the showtime document and are
claimed with one conditional update:

```js
Showtime.findOneAndUpdate(
  { _id, status: 'scheduled', bookedSeats: { $nin: seats } },
  { $push: { bookedSeats: { $each: seats } } },
)
```

MongoDB guarantees atomicity on a single document, so exactly one request matches and the other
gets a 409 naming the seats it lost. If the booking write then fails, the seats are released with
`$pullAll` so a failed request never strands inventory. A test fires both requests concurrently
and asserts the statuses are exactly `[201, 409]`; the UI handles losing that race by refreshing
the seat map and dropping the dead seats from the selection.

## Verification

`npm test` runs both suites, all passing:

- **38 server tests** — supertest against a throwaway in-memory MongoDB, covering every status
  code, role and ownership rule, seat-map maths, screen-overlap detection, the two-hour
  cancellation window, refund-on-showtime-cancel, and the concurrency race above.
- **13 client tests** — Vitest and Testing Library over the real components with a mocked API:
  catalogue and search, sign-in and bad credentials, anonymous redirect, the admin gate in both
  directions, sold seats disabled, price totals, booking submission, and mid-flow seat conflict.

ESLint is clean and the production build succeeds.

## Running it

`npm run setup && npm run dev` on Node 20+. No MongoDB installation required — with `MONGO_URI`
empty the server starts an in-memory database and seeds 8 films, 4 theaters, 9 screens, 252
showtimes, 26 bookings and 20 reviews, so the app is populated the moment it opens. Sign in with
`admin@cinebook.dev / Admin@123` or `user@cinebook.dev / User@123` (both are one click on the
login page). Point `MONGO_URI` at Atlas to persist instead.

## Scope and honesty

Payment is simulated — bookings confirm immediately with no gateway. Seats are claimed at
confirmation rather than held during selection; a TTL-based hold would be the next step for
production. Posters are placeholder images and every film, venue and person is fictional.
