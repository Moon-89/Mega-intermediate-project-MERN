import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, ErrorState, LoadingBlock } from '../../components/ui.jsx';
import { fullDate, money } from '../../utils/format.js';

function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <span className="stat__label">{label}</span>
      <strong className="stat__value">{value}</strong>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
}

function RevenueChart({ points }) {
  if (!points.length) return <p className="muted">No confirmed bookings in the last 7 days.</p>;
  const max = Math.max(...points.map((p) => p.revenue), 1);

  return (
    <div className="chart" role="img" aria-label="Revenue over the last 7 days">
      {points.map((p) => (
        <div className="chart__col" key={p.date}>
          <div className="chart__bar-wrap">
            <div
              className="chart__bar"
              style={{ height: `${Math.max(4, (p.revenue / max) * 100)}%` }}
              title={`${p.date}: ${money(p.revenue)} from ${p.bookings} bookings`}
            />
          </div>
          <span className="chart__label">{p.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: null });

  const load = () => {
    setStatus({ loading: true, error: null });
    api.admin
      .stats()
      .then((data) => {
        setStats(data);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  };

  useEffect(load, []);

  if (status.loading) return <LoadingBlock label="Crunching numbers..." />;
  if (status.error) return <ErrorState error={status.error} onRetry={load} />;

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Revenue"
          value={money(stats.bookings.revenue)}
          sub={`${stats.bookings.seatsSold} seats sold`}
          tone="accent"
        />
        <Stat
          label="Confirmed bookings"
          value={stats.bookings.confirmed}
          sub={`${stats.bookings.cancelled} cancelled`}
        />
        <Stat label="Occupancy" value={`${stats.occupancyRate}%`} sub="across scheduled shows" />
        <Stat
          label="Upcoming shows"
          value={stats.catalogue.upcomingShows}
          sub={`${stats.catalogue.theaters} theaters`}
        />
        <Stat
          label="Films"
          value={stats.catalogue.activeMovies}
          sub={`${stats.catalogue.movies} in catalogue`}
        />
        <Stat
          label="Customers"
          value={stats.users.customers}
          sub={`${stats.users.admins} admin${stats.users.admins === 1 ? '' : 's'}`}
        />
      </div>

      <div className="admin-split">
        <section className="panel">
          <h2>Revenue, last 7 days</h2>
          <RevenueChart points={stats.revenueByDay} />
        </section>

        <section className="panel">
          <h2>Top performing films</h2>
          {stats.topMovies.length === 0 ? (
            <p className="muted">Nothing booked yet.</p>
          ) : (
            <ol className="rank-list">
              {stats.topMovies.map((m) => (
                <li key={m.movieId}>
                  {m.posterUrl && <img src={m.posterUrl} alt="" />}
                  <div>
                    <strong>{m.title}</strong>
                    <span className="muted">
                      {m.bookings} bookings &middot; {m.seats} seats
                    </span>
                  </div>
                  <span className="rank-list__value">{money(m.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2>Latest bookings</h2>
          <Link to="/admin/bookings" className="btn btn--ghost btn--sm">
            View all
          </Link>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Film</th>
                <th>Seats</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Booked</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBookings.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.reference}</td>
                  <td>{b.user?.name || '—'}</td>
                  <td>{b.movie?.title || b.snapshot?.movieTitle}</td>
                  <td>{b.seats.map((s) => s.label).join(', ')}</td>
                  <td>{money(b.totalAmount)}</td>
                  <td>
                    <Badge tone={b.status === 'confirmed' ? 'success' : 'danger'}>{b.status}</Badge>
                  </td>
                  <td className="muted">{fullDate(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
