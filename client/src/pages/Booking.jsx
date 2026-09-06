import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import SeatPicker from '../components/SeatPicker.jsx';
import { Badge, ErrorState, LoadingBlock } from '../components/ui.jsx';
import { fullDate, money, relative } from '../utils/format.js';

const MAX_SEATS = 10;
const FEE_RATE = 0.06;

export default function Booking() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [showtime, setShowtime] = useState(null);
  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const data = await api.showtimes.get(showtimeId);
      setShowtime(data);
      setStatus({ loading: false, error: null });
    } catch (err) {
      setStatus({ loading: false, error: err });
    }
  }, [showtimeId]);

  useEffect(() => {
    load();
  }, [load]);

  const priceOf = useCallback(
    (label) => {
      const row = showtime?.seatMap.find((r) => r.row === label.charAt(0));
      return row ? row.price : 0;
    },
    [showtime],
  );

  const totals = useMemo(() => {
    const subtotal = selected.reduce((sum, label) => sum + priceOf(label), 0);
    const fee = Math.round(subtotal * FEE_RATE);
    return { subtotal, fee, total: subtotal + fee };
  }, [selected, priceOf]);

  const toggleSeat = (seat) => {
    setSelected((current) =>
      current.includes(seat.label)
        ? current.filter((l) => l !== seat.label)
        : current.length >= MAX_SEATS
          ? current
          : [...current, seat.label],
    );
  };

  const confirm = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/book/${showtimeId}` } });
      return;
    }
    setSubmitting(true);
    try {
      const booking = await api.bookings.create({ showtimeId, seats: selected });
      toast.success(`Booked! Reference ${booking.reference}`);
      navigate(`/bookings/${booking.id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
      // Someone else took a seat mid-flow: refresh the map and drop the dead seats.
      if (err.code === 'SEATS_UNAVAILABLE') {
        const taken = err.details?.unavailableSeats || [];
        setSelected((cur) => cur.filter((s) => !taken.includes(s)));
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status.loading) return <LoadingBlock label="Loading seat map..." />;
  if (status.error) {
    return (
      <div className="container section">
        <ErrorState error={status.error} onRetry={load} />
        <p className="center">
          <Link to="/" className="btn btn--ghost">
            Back to films
          </Link>
        </p>
      </div>
    );
  }

  const started = new Date(showtime.startsAt).getTime() <= Date.now();
  const cancelled = showtime.status === 'cancelled';
  const closed = started || cancelled;

  return (
    <div className="container section booking-layout">
      <div className="booking-main">
        <div className="booking-head">
          <Link to={`/movies/${showtime.movie.slug}`} className="linklike">
            &larr; {showtime.movie.title}
          </Link>
          <h1>Pick your seats</h1>
          <div className="booking-head__meta">
            <span>
              <strong>{showtime.theater.name}</strong> &middot; {showtime.screen.name}
            </span>
            <span>{fullDate(showtime.startsAt)}</span>
            <Badge tone="accent">{showtime.format}</Badge>
            <Badge>{showtime.language}</Badge>
            {!closed && <Badge tone="success">{relative(showtime.startsAt)}</Badge>}
          </div>
        </div>

        {cancelled && (
          <div className="notice notice--error">This showtime has been cancelled by the cinema.</div>
        )}
        {started && !cancelled && (
          <div className="notice notice--error">This showtime has already started.</div>
        )}

        <SeatPicker
          seatMap={showtime.seatMap}
          legend={showtime.legend}
          selected={closed ? [] : selected}
          onToggle={closed ? () => {} : toggleSeat}
          maxSeats={MAX_SEATS}
        />
      </div>

      <aside className="booking-summary">
        <div className="summary-card">
          <h2>Your order</h2>

          <div className="summary-card__film">
            {showtime.movie.posterUrl && <img src={showtime.movie.posterUrl} alt="" />}
            <div>
              <strong>{showtime.movie.title}</strong>
              <span>{showtime.theater.name}</span>
              <span>{fullDate(showtime.startsAt)}</span>
            </div>
          </div>

          <div className="summary-card__seats">
            <span className="muted">Seats</span>
            {selected.length === 0 ? (
              <p className="muted">Nothing selected yet.</p>
            ) : (
              <ul>
                {selected.map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      className="chip chip--removable"
                      onClick={() => setSelected((c) => c.filter((l) => l !== label))}
                      aria-label={`Remove seat ${label}`}
                    >
                      {label} <span aria-hidden="true">&times;</span>
                    </button>
                    <span>{money(priceOf(label))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <dl className="summary-card__totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(totals.subtotal)}</dd>
            </div>
            <div>
              <dt>Convenience fee (6%)</dt>
              <dd>{money(totals.fee)}</dd>
            </div>
            <div className="is-total">
              <dt>Total</dt>
              <dd>{money(totals.total)}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={selected.length === 0 || submitting || closed}
            onClick={confirm}
          >
            {submitting
              ? 'Confirming...'
              : isAuthenticated
                ? `Confirm ${selected.length || ''} seat${selected.length === 1 ? '' : 's'}`.trim()
                : 'Sign in to book'}
          </button>

          <p className="summary-card__note">
            Up to {MAX_SEATS} seats per booking. Free cancellation up to 2 hours before showtime.
          </p>
        </div>
      </aside>
    </div>
  );
}
