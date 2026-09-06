import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Confirm, ErrorState, LoadingBlock, Pagination } from '../../components/ui.jsx';
import { fullDate, money } from '../../utils/format.js';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminBookings() {
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], meta: null });
  const [status, setStatus] = useState({ loading: true, error: null });
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setStatus({ loading: true, error: null });
    api.bookings
      .all({ status: tab, page, limit: 15 })
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
      await api.bookings.cancel(cancelling.id, { reason: 'Cancelled by admin' });
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
    <section className="panel">
      <div className="panel__head">
        <h2>Bookings ({result.meta?.total ?? 0})</h2>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
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
      </div>

      {status.loading && <LoadingBlock />}
      {status.error && <ErrorState error={status.error} onRetry={load} />}

      {!status.loading && !status.error && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Film / show</th>
                  <th>Seats</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((b) => {
                  const startsAt = b.showtime?.startsAt || b.snapshot.startsAt;
                  return (
                    <tr key={b.id}>
                      <td className="mono">{b.reference}</td>
                      <td>
                        <strong>{b.user?.name}</strong>
                        <br />
                        <span className="muted">{b.user?.email}</span>
                      </td>
                      <td>
                        {b.snapshot.movieTitle}
                        <br />
                        <span className="muted">
                          {b.snapshot.theaterName} &middot; {fullDate(startsAt)}
                        </span>
                      </td>
                      <td>{b.seats.map((s) => s.label).join(', ')}</td>
                      <td>{money(b.totalAmount)}</td>
                      <td>
                        <Badge tone={b.status === 'confirmed' ? 'success' : 'danger'}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="cell-actions">
                        {b.status === 'confirmed' && (
                          <button
                            type="button"
                            className="linklike linklike--danger"
                            onClick={() => setCancelling(b)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {result.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted center">
                      No bookings here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} onPage={setPage} />
        </>
      )}

      <Confirm
        open={Boolean(cancelling)}
        title={`Cancel ${cancelling?.reference || ''}?`}
        message="The customer's seats go back on sale immediately. Admins can cancel at any time, including inside the 2-hour window."
        confirmLabel="Cancel booking"
        busy={busy}
        onConfirm={cancel}
        onClose={() => setCancelling(null)}
      />
    </section>
  );
}
