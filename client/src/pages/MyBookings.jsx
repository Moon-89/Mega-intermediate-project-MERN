import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Badge, Confirm, EmptyState, ErrorState, LoadingBlock, Pagination } from '../components/ui.jsx';
import { fullDate, money } from '../utils/format.js';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function MyBookings() {
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], meta: null });
  const [status, setStatus] = useState({ loading: true, error: null });
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setStatus({ loading: true, error: null });
    api.bookings
      .mine({ status: tab, page, limit: 8 })
      .then((res) => {
        setResult(res);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  }, [tab, page]);

  useEffect(() => load(), [load]);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.bookings.cancel(cancelling);
      toast.success('Booking cancelled and seats released');
      setCancelling(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container section">
      <h1 className="page-title">My bookings</h1>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={`tabs__tab ${tab === t.value ? 'is-active' : ''}`}
            onClick={() => {
              setTab(t.value);
              setPage(1);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {status.loading && <LoadingBlock label="Loading your bookings..." />}
      {status.error && <ErrorState error={status.error} onRetry={load} />}

      {!status.loading && !status.error && result.data.length === 0 && (
        <EmptyState
          icon="🎟️"
          title="No bookings here yet"
          hint="Pick a film and grab some seats."
          action={
            <Link to="/" className="btn btn--primary">
              Browse films
            </Link>
          }
        />
      )}

      <div className="ticket-list">
        {result.data.map((b) => {
          const startsAt = b.showtime?.startsAt || b.snapshot.startsAt;
          const isPast = new Date(startsAt).getTime() < Date.now();
          const canCancel =
            b.status === 'confirmed' && new Date(startsAt).getTime() - Date.now() > 2 * 3600000;

          return (
            <article className={`ticket ${b.status === 'cancelled' ? 'is-cancelled' : ''}`} key={b.id}>
              <div className="ticket__poster">
                {b.snapshot.posterUrl && <img src={b.snapshot.posterUrl} alt="" />}
              </div>

              <div className="ticket__body">
                <div className="ticket__head">
                  <h3>{b.snapshot.movieTitle}</h3>
                  <Badge tone={b.status === 'confirmed' ? (isPast ? 'neutral' : 'success') : 'danger'}>
                    {b.status === 'confirmed' && isPast ? 'watched' : b.status}
                  </Badge>
                </div>

                <p className="muted">
                  {b.snapshot.theaterName} &middot; {b.snapshot.screenName} &middot; {b.snapshot.city}
                </p>
                <p>{fullDate(startsAt)}</p>

                <div className="chips">
                  {b.seats.map((s) => (
                    <span className="chip" key={s.label}>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="ticket__side">
                <span className="mono ticket__ref">{b.reference}</span>
                <strong>{money(b.totalAmount)}</strong>
                <Link to={`/bookings/${b.id}`} className="btn btn--ghost btn--sm">
                  View ticket
                </Link>
                {canCancel && (
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => setCancelling(b.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Pagination meta={result.meta} onPage={setPage} />

      <Confirm
        open={Boolean(cancelling)}
        title="Cancel this booking?"
        message="The seats go back on sale immediately. This cannot be undone."
        confirmLabel="Cancel booking"
        busy={busy}
        onConfirm={cancel}
        onClose={() => setCancelling(null)}
      />
    </div>
  );
}
