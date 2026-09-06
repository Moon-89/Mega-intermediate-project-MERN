import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Badge, Confirm, ErrorState, LoadingBlock } from '../components/ui.jsx';
import { fullDate, money } from '../utils/format.js';

export default function BookingDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setStatus({ loading: true, error: null });
    api.bookings
      .get(id)
      .then((data) => {
        setBooking(data);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  }, [id]);

  useEffect(() => load(), [load]);

  const cancel = async () => {
    setBusy(true);
    try {
      const updated = await api.bookings.cancel(id);
      setBooking((b) => ({ ...b, ...updated }));
      setConfirming(false);
      toast.success('Booking cancelled');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (status.loading) return <LoadingBlock label="Loading ticket..." />;
  if (status.error) {
    return (
      <div className="container section">
        <ErrorState error={status.error} onRetry={load} />
        <p className="center">
          <Link to="/bookings" className="btn btn--ghost">
            Back to my bookings
          </Link>
        </p>
      </div>
    );
  }

  const startsAt = booking.showtime?.startsAt || booking.snapshot.startsAt;
  const canCancel =
    booking.status === 'confirmed' && new Date(startsAt).getTime() - Date.now() > 2 * 3600000;

  return (
    <div className="container narrow section">
      <Link to="/bookings" className="linklike">
        &larr; My bookings
      </Link>

      <div className={`stub ${booking.status === 'cancelled' ? 'is-cancelled' : ''}`}>
        <div className="stub__main">
          <div className="stub__head">
            <div>
              <p className="stub__eyebrow">
                {booking.status === 'confirmed' ? 'Confirmed booking' : 'Cancelled booking'}
              </p>
              <h1>{booking.snapshot.movieTitle}</h1>
            </div>
            <Badge tone={booking.status === 'confirmed' ? 'success' : 'danger'}>{booking.status}</Badge>
          </div>

          <dl className="stub__grid">
            <div>
              <dt>Theater</dt>
              <dd>{booking.snapshot.theaterName}</dd>
            </div>
            <div>
              <dt>Screen</dt>
              <dd>{booking.snapshot.screenName}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{booking.snapshot.city}</dd>
            </div>
            <div>
              <dt>Showtime</dt>
              <dd>{fullDate(startsAt)}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>
                {booking.snapshot.format} &middot; {booking.snapshot.language}
              </dd>
            </div>
            <div>
              <dt>Booked on</dt>
              <dd>{fullDate(booking.createdAt)}</dd>
            </div>
          </dl>

          <div className="stub__seats">
            <span className="muted">Seats</span>
            <div className="chips">
              {booking.seats.map((s) => (
                <span className="chip chip--seat" key={s.label}>
                  <strong>{s.label}</strong>
                  <em>{s.seatClass}</em>
                  <span>{money(s.price)}</span>
                </span>
              ))}
            </div>
          </div>

          <dl className="summary-card__totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(booking.subtotal)}</dd>
            </div>
            <div>
              <dt>Convenience fee</dt>
              <dd>{money(booking.convenienceFee)}</dd>
            </div>
            <div className="is-total">
              <dt>{booking.status === 'cancelled' ? 'Refunded' : 'Paid'}</dt>
              <dd>{money(booking.totalAmount)}</dd>
            </div>
          </dl>

          {booking.status === 'cancelled' && booking.cancellationReason && (
            <div className="notice notice--error">
              Cancelled: {booking.cancellationReason}
              {booking.cancelledAt ? ` (${fullDate(booking.cancelledAt)})` : ''}
            </div>
          )}
        </div>

        <div className="stub__tear" aria-hidden="true" />

        <div className="stub__side">
          <span className="muted">Booking reference</span>
          <p className="stub__ref mono">{booking.reference}</p>
          <div className="stub__barcode" aria-hidden="true">
            {Array.from({ length: 26 }, (_, i) => (
              <span key={i} style={{ width: `${(i % 4) + 1}px` }} />
            ))}
          </div>
          <p className="muted center">Show this at the door</p>

          {canCancel && (
            <button type="button" className="btn btn--danger btn--block" onClick={() => setConfirming(true)}>
              Cancel booking
            </button>
          )}
          {booking.status === 'confirmed' && !canCancel && (
            <p className="muted center">The 2-hour cancellation window has closed.</p>
          )}
        </div>
      </div>

      <Confirm
        open={confirming}
        title="Cancel this booking?"
        message="Your seats go back on sale immediately."
        confirmLabel="Cancel booking"
        busy={busy}
        onConfirm={cancel}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
