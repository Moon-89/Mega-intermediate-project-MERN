# CineBook — Movie Ticket Booking System

A full-stack MERN cinema booking platform. Customers browse films, pick seats on a live seat
map and manage their tickets; admins run the catalogue, schedule shows across screens and watch
revenue from a dashboard.

Built for the "Mega Intermediate Project" brief (Option 1 — Movie Ticket Booking System).

```
┌── client/   React 18 + Vite + React Router  (UI)
└── server/   Express + Mongoose + JWT        (REST API)
```

---

## Quick start

Requires **Node 20+**. No MongoDB installation needed — if `MONGO_URI` is empty the server boots
an in-memory MongoDB and seeds it, so `npm run dev` works on a clean machine.

```bash
npm run setup     # installs root, server and client dependencies
npm run dev       # starts the API on :5000 and the app on :5173
```

Open <http://localhost:5173>.

### Demo accounts

| Role     | Email                | Password    | Can do                                             |
| -------- | -------------------- | ----------- | -------------------------------------------------- |
| Admin    | `admin@cinebook.dev` | `Admin@123` | Everything below, plus the whole `/admin` console   |
| Customer | `user@cinebook.dev`  | `User@123`  | Browse, book, cancel, review, manage own profile    |

The sign-in page has "Fill Admin" / "Fill Customer" buttons so you never have to type them.

### Using a real database

Set `MONGO_URI` in `server/.env` (copy `server/.env.example`) to a local `mongod` or an Atlas
cluster, then seed it once:

```bash
npm run seed
```

Everything else is identical — the in-memory database is only a zero-setup convenience.

---

## Scripts

| Command               | What it does                                               |
| --------------------- | ---------------------------------------------------------- |
| `npm run setup`       | Install dependencies for root, server and client            |
| `npm run dev`         | Run API + web app together with colour-coded logs           |
| `npm run build`       | Production build of the React app into `client/dist`        |
| `npm start`           | Run the API alone (what a host like Render would run)       |
| `npm run seed`        | Wipe and rebuild the demo catalogue (needs a real `MONGO_URI`) |
| `npm test`            | Server integration tests **and** client component tests     |
| `npm run lint`        | ESLint over the React app                                   |

---

## Data model

Six related collections. Relationships are by `ObjectId` reference, except screens, which belong
to exactly one theater and so are stored as subdocuments.

```
User ──────┐
           ├─< Booking >─┬── Showtime ──┬── Movie
Review >───┴── Movie     │              └── Theater ──< Screen (subdoc)
                         └── Theater
```

| Collection   | Key fields                                                                                   | Notes |
| ------------ | -------------------------------------------------------------------------------------------- | ----- |
| **users**    | `name, email (unique), passwordHash, role: user\|admin, phone`                                 | Password hashed with bcrypt; `passwordHash` is `select: false` so it never leaks |
| **movies**   | `title, slug (unique), synopsis, genres[], languages[], durationMins, certificate, releaseDate, posterUrl, avgRating, reviewCount, isActive` | `avgRating`/`reviewCount` are denormalised aggregates refreshed on every review write |
| **theaters** | `name, city, address, amenities[], screens[]`                                                  | Each screen has `rows`, `seatsPerRow`, `format` and priced `seatClasses` (Classic 1×, Premium 1.4×, Recliner 2×) |
| **showtimes**| `movie→, theater→, screenId, city, startsAt, endsAt, language, format, basePrice, totalSeats, bookedSeats[], status` | `bookedSeats` lives here so a seat can be claimed atomically |
| **bookings** | `reference (unique), user→, showtime→, movie→, theater→, snapshot{}, seats[{label, seatClass, price}], subtotal, convenienceFee, totalAmount, status` | `snapshot` freezes the film/venue/time so an old ticket still reads correctly after the catalogue changes |
| **reviews**  | `movie→, user→, rating 1-5, comment`                                                           | Compound unique index on `(movie, user)` — one review per person per film |

### How double-booking is prevented

Seats are claimed with a single conditional update, so two simultaneous requests for the same
seat cannot both succeed — MongoDB guarantees atomicity on one document:

```js
const claimed = await Showtime.findOneAndUpdate(
  { _id, status: 'scheduled', bookedSeats: { $nin: seats } },  // only if still free
  { $push: { bookedSeats: { $each: seats } } },
  { new: true },
);
if (!claimed) throw ApiError.conflict(..., 'SEATS_UNAVAILABLE');
```

If the booking document then fails to write, the seats are released again with `$pullAll`, so a
failed request never strands inventory. There is a test that fires two bookings for the same seat
concurrently and asserts the statuses are exactly `[201, 409]`.

---

## API contract

Base URL `http://localhost:5000/api`. Auth is `Authorization: Bearer <jwt>`.

**Success**

```jsonc
{ "data": { ... } }                                  // single resource
{ "data": [ ... ], "meta": { "page": 1, "limit": 12, // collections
            "total": 8, "totalPages": 1,
            "hasNextPage": false, "hasPrevPage": false } }
```

**Error** — every failure, including validation, uses one shape:

```jsonc
{ "error": {
    "code": "SEATS_UNAVAILABLE",
    "message": "Seat(s) C6 were just booked by someone else",
    "details": { "unavailableSeats": ["C6"] }        // optional, shape varies by code
} }
```

### Status codes

| Code | Used for |
| ---- | -------- |
| `200` | Successful read or update |
| `201` | Resource created (register, movie, showtime, booking, review) |
| `204` | Successful delete — no body |
| `400` | Malformed request: bad ObjectId, invalid JSON, showtime in the past |
| `401` | Missing, invalid or expired token; wrong credentials |
| `403` | Authenticated but not allowed — wrong role, someone else's booking or review |
| `404` | Resource or route does not exist |
| `409` | State conflict — duplicate email/title, seats gone, overlapping shows, already cancelled, deleting something still referenced |
| `422` | Validation failed, with a `details` array of `{ field, message }` |
| `429` | Rate limit on the auth endpoints |
| `500` | Unhandled server error (stack included outside production) |

### Endpoints

| Method | Path | Access | Success |
| ------ | ---- | ------ | ------- |
| `GET` | `/health` | public | 200 |
| `POST` | `/auth/register` | public | 201 |
| `POST` | `/auth/login` | public | 200 |
| `GET` | `/auth/me` | user | 200 |
| `PATCH` | `/auth/me` | user | 200 |
| `POST` | `/auth/change-password` | user | 200 |
| `GET` | `/movies` | public | 200 — `?q=&genre=&language=&status=&sort=&page=&limit=` |
| `GET` | `/movies/meta/filters` | public | 200 — genres, languages, cities for the filter UI |
| `GET` | `/movies/:idOrSlug` | public | 200 |
| `POST` | `/movies` | **admin** | 201 |
| `PATCH` | `/movies/:id` | **admin** | 200 |
| `DELETE` | `/movies/:id` | **admin** | 204 — 409 if upcoming showtimes reference it |
| `GET` | `/movies/:id/reviews` | public | 200 |
| `POST` | `/movies/:id/reviews` | user | 201 — 409 if already reviewed |
| `PATCH` | `/reviews/:id` | owner | 200 |
| `DELETE` | `/reviews/:id` | owner or admin | 204 |
| `GET` | `/theaters` | public | 200 — `?city=` |
| `GET` | `/theaters/:id` | public | 200 |
| `POST` | `/theaters` | **admin** | 201 |
| `PATCH` | `/theaters/:id` | **admin** | 200 |
| `DELETE` | `/theaters/:id` | **admin** | 204 |
| `POST` | `/theaters/:id/screens` | **admin** | 201 |
| `DELETE` | `/theaters/:id/screens/:screenId` | **admin** | 204 |
| `GET` | `/showtimes` | public | 200 — `?movie=&theater=&city=&date=YYYY-MM-DD` |
| `GET` | `/showtimes/:id` | public | 200 — includes the priced seat map |
| `POST` | `/showtimes` | **admin** | 201 — 409 on screen overlap |
| `PATCH` | `/showtimes/:id` | **admin** | 200 — locked once seats are sold |
| `POST` | `/showtimes/:id/cancel` | **admin** | 200 — cancels the show and refunds every booking |
| `DELETE` | `/showtimes/:id` | **admin** | 204 — 409 if anything is booked |
| `POST` | `/bookings` | user | 201 — 409 `SEATS_UNAVAILABLE` |
| `GET` | `/bookings/me` | user | 200 |
| `GET` | `/bookings/:id` | owner or admin | 200 |
| `PATCH` | `/bookings/:id/cancel` | owner or admin | 200 — 409 inside the 2-hour window (admins exempt) |
| `GET` | `/bookings` | **admin** | 200 — every booking |
| `GET` | `/admin/stats` | **admin** | 200 — revenue, occupancy, top films |
| `GET` | `/admin/users` | **admin** | 200 |
| `PATCH` | `/admin/users/:id/role` | **admin** | 200 — 409 on self-demote or last admin |

### Try it

```bash
curl -s localhost:5000/api/health

TOKEN=$(curl -s -X POST localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cinebook.dev","password":"Admin@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')

curl -s localhost:5000/api/admin/stats -H "Authorization: Bearer $TOKEN"
```

---

## Authorisation model

Three layers, all enforced server-side:

1. **`requireAuth`** — verifies the JWT and loads the user, or `401`.
2. **`requireRole('admin')`** — `403` for anyone else. Guards every write to movies, theaters,
   showtimes and the admin routes.
3. **Ownership checks in the controller** — a booking or review is readable and editable by its
   owner; admins may additionally read any booking and delete any review, but no one else can.

The React app mirrors this for UX only: `<ProtectedRoute>` redirects anonymous visitors to
sign-in and shows an explicit "Admins only" screen to signed-in customers. The API is the
authority — removing the guard in the browser changes nothing.

Passwords are bcrypt-hashed (cost 10), never returned by any endpoint, and required to be 8+
characters with upper, lower and a digit. The auth routes are rate-limited.

---

## Frontend

| Route | Who | Screen |
| ----- | --- | ------ |
| `/` | public | Film catalogue with debounced search, genre/language filters, sorting, pagination |
| `/movies/:slug` | public | Film detail, showtime board grouped by day and theater, reviews |
| `/showtimes` | public | Everything playing, by date and city |
| `/theaters` | public | Venues and screens by city |
| `/book/:showtimeId` | public → sign-in to pay | Interactive seat map, live totals |
| `/bookings`, `/bookings/:id` | user | Ticket list and a printable-looking ticket stub |
| `/profile` | user | Details and password change |
| `/admin` | admin | Dashboard: revenue chart, occupancy, top films, latest bookings |
| `/admin/movies` | admin | Full film CRUD |
| `/admin/theaters` | admin | Theater CRUD plus add/remove screens with seat-class bands |
| `/admin/showtimes` | admin | Schedule shows, cancel with refunds, per-show occupancy meters |
| `/admin/bookings` | admin | Every booking, filterable, cancellable |
| `/admin/users` | admin | Search users, promote/demote |

State is React context (`AuthContext`, `ToastContext`) plus local component state; the API layer
in `src/api/client.js` unwraps envelopes and turns error bodies into a typed `ApiError` whose
`fieldErrors` feed inline form validation. No CSS framework — one hand-written stylesheet with
custom properties, responsive down to mobile, with `prefers-reduced-motion` respected.

---

## Tests

```bash
npm test
```

**Server — 38 tests** (`node:test` + supertest, against a throwaway in-memory MongoDB): every
status code above, role enforcement, ownership rules, seat-map correctness, screen overlap
detection, the cancellation window, refund-on-showtime-cancel, and the concurrent-booking race.

**Client — 13 tests** (Vitest + Testing Library, jsdom, mocked API): catalogue rendering and
search, sign-in and bad credentials, redirect of anonymous users, the admin role gate in both
directions, seat map rendering with disabled sold seats, price totals, booking submission, and
recovery when a seat is taken mid-flow.

---

## Deployment notes

**API** (Render, Railway, Fly): root directory `server`, build `npm install`, start `npm start`.
Set `MONGO_URI` (Atlas), `JWT_SECRET`, `NODE_ENV=production`, and `CLIENT_ORIGIN` to the deployed
frontend URL. Run the seeder once if you want the demo catalogue.

**Web** (Vercel, Netlify): root directory `client`, build `npm run build`, output `dist`. Set
`VITE_API_URL` to `https://<your-api>/api`. Add an SPA rewrite (`/* → /index.html`) so deep links
like `/admin/movies` resolve.

---

## Notes and known limits

- Payment is simulated. A booking is confirmed immediately; there is no gateway integration.
- Seats are claimed at confirmation, not held during selection. A short-lived hold (a TTL
  document per seat) would be the next step for a real system.
- Posters are deterministic placeholder images from picsum.photos. All films, venues and people
  are fictional.
- The in-memory database resets on every restart. That is deliberate for a demo; set `MONGO_URI`
  to persist.
