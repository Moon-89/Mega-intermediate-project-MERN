import ApiError from './ApiError.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** ['A','B','C', ...] for a screen with `count` rows. */
export function rowLabels(count) {
  return Array.from({ length: count }, (_, i) => ALPHABET[i]);
}

/** The seat class a given row belongs to, falling back to the last class defined. */
export function classForRow(screen, row) {
  const found = screen.seatClasses.find((c) => c.rows.includes(row));
  return found || screen.seatClasses[screen.seatClasses.length - 1];
}

export function priceForRow(screen, row, basePrice) {
  const seatClass = classForRow(screen, row);
  return Math.round(basePrice * (seatClass?.priceMultiplier ?? 1));
}

/** Every valid seat label on a screen, e.g. ["A1", "A2", ... "H12"]. */
export function allSeatLabels(screen) {
  const labels = [];
  for (const row of rowLabels(screen.rows)) {
    for (let n = 1; n <= screen.seatsPerRow; n += 1) labels.push(`${row}${n}`);
  }
  return labels;
}

/**
 * Full seat grid for a showtime, annotated with class, price and booked state.
 * This is what the seat-picker UI renders.
 */
export function buildSeatMap(screen, showtime) {
  const booked = new Set(showtime.bookedSeats || []);
  return rowLabels(screen.rows).map((row) => {
    const seatClass = classForRow(screen, row);
    const price = Math.round(showtime.basePrice * (seatClass?.priceMultiplier ?? 1));
    return {
      row,
      seatClass: seatClass?.name || 'Classic',
      price,
      seats: Array.from({ length: screen.seatsPerRow }, (_, i) => {
        const label = `${row}${i + 1}`;
        return { label, number: i + 1, isBooked: booked.has(label), price };
      }),
    };
  });
}

/**
 * Validates the requested labels against the screen layout and prices them.
 * Throws 422 for labels that do not exist on this screen.
 */
export function priceSeats(screen, showtime, labels) {
  const valid = new Set(allSeatLabels(screen));
  const unknown = labels.filter((l) => !valid.has(l));
  if (unknown.length) {
    throw ApiError.unprocessable(
      `Unknown seat(s) for this screen: ${unknown.join(', ')}`,
      'INVALID_SEATS',
      { seats: unknown },
    );
  }
  return labels.map((label) => {
    const row = label.charAt(0);
    const seatClass = classForRow(screen, row);
    return {
      label,
      seatClass: seatClass?.name || 'Classic',
      price: Math.round(showtime.basePrice * (seatClass?.priceMultiplier ?? 1)),
    };
  });
}

export function seatCapacity(screen) {
  return screen.rows * screen.seatsPerRow;
}
