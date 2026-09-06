import { money } from '../utils/format.js';

const CLASS_KEY = { Classic: 'classic', Premium: 'premium', Recliner: 'recliner' };

/**
 * Renders the auditorium grid. Booked seats are disabled; selecting past
 * `maxSeats` is blocked by the parent, which owns the selection state.
 */
export default function SeatPicker({ seatMap = [], legend = [], selected = [], onToggle, maxSeats = 10 }) {
  const chosen = new Set(selected);
  const seatsPerRow = seatMap[0]?.seats.length || 0;
  const aisleAfter = seatsPerRow > 8 ? Math.ceil(seatsPerRow / 2) : 0;

  return (
    <div className="auditorium">
      <div className="screen-arc">
        <span>Screen this way</span>
      </div>

      <div className="seat-grid" role="group" aria-label="Seat selection">
        {seatMap.map((row) => (
          <div className="seat-row" key={row.row}>
            <span className="seat-row__label" aria-hidden="true">
              {row.row}
            </span>

            <div className="seat-row__seats">
              {row.seats.map((seat) => {
                const isSelected = chosen.has(seat.label);
                const atLimit = !isSelected && chosen.size >= maxSeats;
                return (
                  <span key={seat.label} className="seat-slot">
                    <button
                      type="button"
                      className={[
                        'seat',
                        `seat--${CLASS_KEY[row.seatClass] || 'classic'}`,
                        seat.isBooked ? 'is-booked' : '',
                        isSelected ? 'is-selected' : '',
                      ]
                        .join(' ')
                        .trim()}
                      disabled={seat.isBooked || atLimit}
                      aria-pressed={isSelected}
                      aria-label={`Seat ${seat.label}, ${row.seatClass}, ${money(seat.price)}${
                        seat.isBooked ? ', already booked' : ''
                      }`}
                      title={`${seat.label} - ${row.seatClass} - ${money(seat.price)}`}
                      onClick={() => onToggle(seat)}
                    >
                      {seat.number}
                    </button>
                    {aisleAfter && seat.number === aisleAfter ? <span className="aisle" /> : null}
                  </span>
                );
              })}
            </div>

            <span className="seat-row__price" aria-hidden="true">
              {money(row.price)}
            </span>
          </div>
        ))}
      </div>

      <div className="seat-legend">
        <span className="seat-legend__item">
          <span className="seat seat--sample" /> Available
        </span>
        <span className="seat-legend__item">
          <span className="seat seat--sample is-selected" /> Selected
        </span>
        <span className="seat-legend__item">
          <span className="seat seat--sample is-booked" /> Taken
        </span>
        {legend.map((l) => (
          <span className="seat-legend__item" key={l.name}>
            <span className={`seat seat--sample seat--${CLASS_KEY[l.name] || 'classic'}`} /> {l.name}{' '}
            {money(l.price)}
          </span>
        ))}
      </div>
    </div>
  );
}
