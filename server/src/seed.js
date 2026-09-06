/**
 * Demo data seeder.
 *
 * `npm run seed`        -> wipes and rebuilds the demo catalogue
 * imported `seedIfEmpty` -> runs automatically on boot when the database is empty
 */
import User from './models/User.js';
import Movie, { slugify } from './models/Movie.js';
import Theater from './models/Theater.js';
import Showtime from './models/Showtime.js';
import Booking from './models/Booking.js';
import Review from './models/Review.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { classForRow, seatCapacity } from './utils/seatMap.js';

const poster = (slug) => `https://picsum.photos/seed/${slug}/400/600`;

const MOVIES = [
  {
    title: 'Neon Harbour',
    synopsis:
      'A burnt-out harbour pilot discovers the shipping lanes of a flooded megacity are hiding a signal that should not exist. Chasing it costs her everything she has left on dry land.',
    genres: ['Sci-Fi', 'Thriller'],
    languages: ['English', 'Hindi'],
    durationMins: 138,
    certificate: 'UA',
    director: 'Ava Mendel',
    cast: ['Ines Kabir', 'Tomas Reyes', 'Wren Alcott'],
    accentColor: '#22d3ee',
    releaseDate: '2026-07-11',
  },
  {
    title: 'The Long Monsoon',
    synopsis:
      'Three generations of a tea-estate family are trapped together by a rain season that will not end, and by a secret the youngest of them has already decided to tell.',
    genres: ['Drama'],
    languages: ['Hindi', 'English'],
    durationMins: 152,
    certificate: 'UA',
    director: 'Rahul Sanyal',
    cast: ['Meera Joshi', 'Anil Varma', 'Kiran Bose'],
    accentColor: '#34d399',
    releaseDate: '2026-06-19',
  },
  {
    title: 'Gravity Debt',
    synopsis:
      'The first commercial asteroid crew learns their return fuel was sold out from under them. Ninety days of oxygen, one deeply unhelpful company lawyer, and a very long way home.',
    genres: ['Sci-Fi', 'Adventure'],
    languages: ['English'],
    durationMins: 129,
    certificate: 'UA',
    director: 'Cormac Blake',
    cast: ['Dee Okonjo', 'Marta Lind', 'Yusuf Rahim'],
    accentColor: '#f59e0b',
    releaseDate: '2026-08-01',
  },
  {
    title: 'Paper Tigers',
    synopsis:
      'Two rival origami champions are forced into a heist when the museum housing their masters collection burns down under distinctly suspicious circumstances.',
    genres: ['Comedy', 'Crime'],
    languages: ['English'],
    durationMins: 104,
    certificate: 'U',
    director: 'Nina Prakash',
    cast: ['Leo Tan', 'Grace Abara', 'Peter Vance'],
    accentColor: '#f472b6',
    releaseDate: '2026-08-15',
  },
  {
    title: 'Winterhold',
    synopsis:
      'A research station in the Arctic loses contact for eleven days. When the relief team arrives, everything is exactly where it should be, and that is the problem.',
    genres: ['Horror', 'Mystery'],
    languages: ['English'],
    durationMins: 117,
    certificate: 'A',
    director: 'Sofia Lindqvist',
    cast: ['Erik Haldor', 'Ruth Amari', 'Jonas Fell'],
    accentColor: '#818cf8',
    releaseDate: '2026-07-25',
  },
  {
    title: 'Sixteen Summers',
    synopsis:
      'Every summer for sixteen years, the same two people meet at the same rented beach house. This is the year one of them does not come back.',
    genres: ['Romance', 'Drama'],
    languages: ['English', 'Tamil'],
    durationMins: 121,
    certificate: 'UA',
    director: 'Priya Ravi',
    cast: ['Aditi Menon', 'Sam Whitfield'],
    accentColor: '#fb7185',
    releaseDate: '2026-06-05',
  },
  {
    title: 'Ironbound',
    synopsis:
      'A retired demolitions expert takes one last contract to pay for her brothers care, and finds the building she is meant to bring down still has people inside it.',
    genres: ['Action', 'Thriller'],
    languages: ['English', 'Hindi'],
    durationMins: 126,
    certificate: 'A',
    director: 'Marcus Oyelaran',
    cast: ['Vera Nowak', 'Dev Chandra', 'Bruno Salt'],
    accentColor: '#ef4444',
    releaseDate: '2026-08-22',
  },
  {
    title: 'The Cartographer of Small Things',
    synopsis:
      'An animated map-maker sets out to chart everything the great atlases left out: the shortcut behind the bakery, the good bench, the exact spot where the light lands at four.',
    genres: ['Animation', 'Fantasy', 'Adventure'],
    languages: ['English'],
    durationMins: 96,
    certificate: 'U',
    director: 'Hana Ito',
    cast: ['Sasha Berg', 'Olu Adeyemi'],
    accentColor: '#a78bfa',
    releaseDate: '2026-07-04',
  },
];

/** rows A-C classic, D-F premium, the rest recliner. */
function seatClassesFor(rows) {
  const letters = 'ABCDEFGHIJKLMNOPQRST'.slice(0, rows).split('');
  const classic = letters.slice(0, Math.max(1, Math.ceil(rows * 0.4)));
  const premium = letters.slice(classic.length, classic.length + Math.max(1, Math.ceil(rows * 0.35)));
  const recliner = letters.slice(classic.length + premium.length);
  const out = [
    { name: 'Classic', rows: classic, priceMultiplier: 1 },
    { name: 'Premium', rows: premium, priceMultiplier: 1.4 },
  ];
  if (recliner.length) out.push({ name: 'Recliner', rows: recliner, priceMultiplier: 2 });
  else out[1].rows = [...premium, ...recliner];
  return out;
}

const screen = (name, rows, seatsPerRow, format = '2D') => ({
  name,
  rows,
  seatsPerRow,
  format,
  seatClasses: seatClassesFor(rows),
});

const THEATERS = [
  {
    name: 'Grand Cineplex',
    city: 'Mumbai',
    address: 'Level 4, Harbour Mall, Lower Parel',
    amenities: ['Dolby Atmos', 'Recliners', 'Parking', 'Cafe'],
    screens: [screen('Audi 1 - IMAX', 10, 16, 'IMAX'), screen('Audi 2', 8, 12), screen('Audi 3', 6, 10, '3D')],
  },
  {
    name: 'Riverside Multiplex',
    city: 'Mumbai',
    address: '22 Riverside Promenade, Bandra West',
    amenities: ['Dolby 7.1', 'Wheelchair access', 'Parking'],
    screens: [screen('Screen A', 8, 14, '3D'), screen('Screen B', 6, 10)],
  },
  {
    name: 'Nova Luxe',
    city: 'Bengaluru',
    address: 'Nova Tower, Indiranagar 100ft Road',
    amenities: ['4DX', 'Recliners', 'Valet', 'Bar'],
    screens: [screen('Nova One', 7, 12, '4DX'), screen('Nova Two', 8, 12)],
  },
  {
    name: 'Skyline Screens',
    city: 'Delhi',
    address: 'Block C, Skyline Plaza, Saket',
    amenities: ['Dolby Atmos', 'Parking'],
    screens: [screen('Sky 1', 9, 14), screen('Sky 2', 6, 10, '3D')],
  },
];

const SHOW_SLOTS = [10, 13.5, 17, 20.5];
const PRICE_BY_FORMAT = { '2D': 220, '3D': 300, IMAX: 450, '4DX': 520 };

function slotDate(dayOffset, hourDecimal) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setMinutes(Math.round((hourDecimal % 1) * 60));
  d.setHours(Math.floor(hourDecimal));
  return d;
}

const pick = (arr, i) => arr[i % arr.length];

export async function seedAll({ quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);

  await Promise.all([
    User.deleteMany({}),
    Movie.deleteMany({}),
    Theater.deleteMany({}),
    Showtime.deleteMany({}),
    Booking.deleteMany({}),
    Review.deleteMany({}),
  ]);

  /* ------------------------------ users -------------------------------- */
  const admin = new User({ name: 'Ada Admin', email: env.demo.adminEmail, role: 'admin', phone: '+91 90000 00001' });
  await admin.setPassword(env.demo.adminPassword);

  const customer = new User({ name: 'Sam Viewer', email: env.demo.userEmail, role: 'user', phone: '+91 90000 00002' });
  await customer.setPassword(env.demo.userPassword);

  const extras = [];
  for (const [i, name] of ['Riya Kapoor', 'Daniel Osei', 'Mei Lin', 'Omar Haddad'].entries()) {
    const u = new User({
      name,
      email: `${name.split(' ')[0].toLowerCase()}@example.com`,
      role: 'user',
    });
    await u.setPassword(`Demo@123${i}`);
    extras.push(u);
  }

  const users = await User.insertMany([admin, customer, ...extras]);
  log(`[seed] users: ${users.length}`);

  /* ------------------------------ movies ------------------------------- */
  const movies = await Movie.insertMany(
    MOVIES.map((m) => ({
      ...m,
      slug: slugify(m.title),
      releaseDate: new Date(m.releaseDate),
      posterUrl: poster(slugify(m.title)),
      isActive: true,
    })),
  );
  log(`[seed] movies: ${movies.length}`);

  /* ----------------------------- theaters ------------------------------ */
  const theaters = await Theater.insertMany(THEATERS);
  log(`[seed] theaters: ${theaters.length} (${theaters.reduce((n, t) => n + t.screens.length, 0)} screens)`);

  /* ---------------------------- showtimes ------------------------------ */
  const showtimeDocs = [];
  let rotation = 0;

  for (let day = 0; day < 7; day += 1) {
    for (const theater of theaters) {
      for (const scr of theater.screens) {
        for (const slot of SHOW_SLOTS) {
          const startsAt = slotDate(day, slot);
          if (startsAt.getTime() <= Date.now() + 30 * 60000) continue; // skip slots already past

          const movie = pick(movies, rotation);
          rotation += 1;

          const format = scr.format;
          showtimeDocs.push({
            movie: movie._id,
            theater: theater._id,
            screenId: scr._id,
            screenName: scr.name,
            city: theater.city,
            startsAt,
            endsAt: new Date(startsAt.getTime() + movie.durationMins * 60000),
            language: movie.languages[0],
            format,
            basePrice: PRICE_BY_FORMAT[format] ?? 220,
            totalSeats: seatCapacity(scr),
            bookedSeats: [],
          });
        }
      }
    }
  }

  const showtimes = await Showtime.insertMany(showtimeDocs);
  log(`[seed] showtimes: ${showtimes.length}`);

  /* ----------------------------- bookings ------------------------------ */
  const theaterById = new Map(theaters.map((t) => [String(t._id), t]));
  const movieById = new Map(movies.map((m) => [String(m._id), m]));
  const bookings = [];
  const seatUpdates = [];

  for (let i = 0; i < 26; i += 1) {
    const showtime = showtimes[(i * 7) % showtimes.length];
    const theater = theaterById.get(String(showtime.theater));
    const movie = movieById.get(String(showtime.movie));
    const scr = theater.screens.id(showtime.screenId);
    const user = i % 3 === 0 ? users[1] : users[2 + (i % 4)];

    const rowIndex = i % scr.rows;
    const row = 'ABCDEFGHIJKLMNOPQRST'[rowIndex];
    const startSeat = 1 + (i % Math.max(1, scr.seatsPerRow - 2));
    const labels = [`${row}${startSeat}`, `${row}${startSeat + 1}`];
    if (showtime.bookedSeats.some((s) => labels.includes(s))) continue;

    const seatClass = classForRow(scr, row);
    const seats = labels.map((label) => ({
      label,
      seatClass: seatClass.name,
      price: Math.round(showtime.basePrice * seatClass.priceMultiplier),
    }));
    const { subtotal, convenienceFee, totalAmount } = Booking.priceBreakdown(seats);
    const cancelled = i % 9 === 4;

    showtime.bookedSeats.push(...(cancelled ? [] : labels));
    seatUpdates.push({
      updateOne: {
        filter: { _id: showtime._id },
        update: { $set: { bookedSeats: showtime.bookedSeats } },
      },
    });

    bookings.push({
      reference: `${Booking.makeReference()}${i}`.slice(0, 10),
      user: user._id,
      showtime: showtime._id,
      movie: movie._id,
      theater: theater._id,
      snapshot: {
        movieTitle: movie.title,
        posterUrl: movie.posterUrl,
        theaterName: theater.name,
        city: theater.city,
        screenName: showtime.screenName,
        startsAt: showtime.startsAt,
        language: showtime.language,
        format: showtime.format,
      },
      seats,
      subtotal,
      convenienceFee,
      totalAmount,
      status: cancelled ? 'cancelled' : 'confirmed',
      cancelledAt: cancelled ? new Date() : null,
      cancellationReason: cancelled ? 'Plans changed' : '',
      createdAt: new Date(Date.now() - (i % 7) * 24 * 3600000),
    });
  }

  await Booking.insertMany(bookings);
  if (seatUpdates.length) await Showtime.bulkWrite(seatUpdates);
  log(`[seed] bookings: ${bookings.length}`);

  /* ------------------------------ reviews ------------------------------ */
  const COMMENTS = [
    'Genuinely surprised by the third act. Worth the ticket.',
    'Beautiful to look at, a little slow in the middle.',
    'The sound design alone is worth seeing this in IMAX.',
    'Solid performances, but the ending felt rushed.',
    'Took my whole family and everyone found something to like.',
    'Not for everyone, but it stayed with me for days.',
  ];

  const reviews = [];
  movies.forEach((movie, mi) => {
    users.slice(1).forEach((user, ui) => {
      if ((mi + ui) % 2 === 0) {
        reviews.push({
          movie: movie._id,
          user: user._id,
          rating: 3 + ((mi + ui) % 3),
          comment: pick(COMMENTS, mi + ui),
        });
      }
    });
  });
  await Review.insertMany(reviews);
  for (const movie of movies) await Review.syncMovieRating(movie._id);
  log(`[seed] reviews: ${reviews.length}`);

  log('');
  log('[seed] demo accounts');
  log(`[seed]   admin -> ${env.demo.adminEmail} / ${env.demo.adminPassword}`);
  log(`[seed]   user  -> ${env.demo.userEmail} / ${env.demo.userPassword}`);

  return { users: users.length, movies: movies.length, theaters: theaters.length, showtimes: showtimes.length };
}

/** Seeds only when the database has no movies yet. */
export async function seedIfEmpty() {
  const count = await Movie.estimatedDocumentCount();
  if (count > 0) {
    // Top up showtimes if every seeded show is now in the past.
    const upcoming = await Showtime.countDocuments({ startsAt: { $gte: new Date() } });
    if (upcoming === 0) {
      console.log('[seed] no upcoming showtimes left - reseeding demo data');
      return seedAll({ quiet: true });
    }
    return null;
  }
  console.log('[seed] empty database detected - loading demo data');
  return seedAll();
}

// `npm run seed`
const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isDirectRun) {
  connectDB()
    .then(async ({ uri, inMemory }) => {
      if (inMemory) {
        console.log('[seed] MONGO_URI is not set. An in-memory database cannot be seeded for later use.');
        console.log('[seed] Set MONGO_URI in server/.env to seed a persistent database.');
        await disconnectDB();
        process.exit(1);
      }
      console.log(`[seed] connected to ${uri.replace(/\/\/[^@]*@/, '//***@')}`);
      await seedAll();
      await disconnectDB();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}

export default seedAll;
