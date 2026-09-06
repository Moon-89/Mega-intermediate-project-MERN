import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui.jsx';
import { dateKey, showDay, showTime } from '../utils/format.js';

export default function Showtimes() {
  const [city, setCity] = useState('');
  const [cities, setCities] = useState([]);
  const [day, setDay] = useState(dateKey(new Date()));
  const [showtimes, setShowtimes] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return { key: dateKey(d), iso: d.toISOString() };
      }),
    [],
  );

  useEffect(() => {
    api.movies
      .filters()
      .then((f) => setCities(f.cities))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setStatus({ loading: true, error: null });
    api.showtimes
      .list({ city, date: day })
      .then((data) => {
        setShowtimes(data);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  }, [city, day]);

  useEffect(() => load(), [load]);

  const byMovie = useMemo(() => {
    const groups = new Map();
    showtimes
      .filter((s) => new Date(s.startsAt).getTime() > Date.now())
      .forEach((s) => {
        const id = s.movie?.id;
        if (!id) return;
        if (!groups.has(id)) groups.set(id, { movie: s.movie, theaters: new Map() });
        const g = groups.get(id);
        const tid = s.theater?.id;
        if (!g.theaters.has(tid)) g.theaters.set(tid, { theater: s.theater, shows: [] });
        g.theaters.get(tid).shows.push(s);
      });
    return [...groups.values()].map((g) => ({ ...g, theaters: [...g.theaters.values()] }));
  }, [showtimes]);

  return (
    <div className="container section">
      <h1 className="page-title">Showtimes</h1>
      <p className="page-lead">Everything playing across our four venues over the next week.</p>

      <div className="toolbar">
        <div className="daystrip" role="tablist" aria-label="Choose a date">
          {days.map((d) => (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={d.key === day}
              className={`daystrip__day ${d.key === day ? 'is-active' : ''}`}
              onClick={() => setDay(d.key)}
            >
              {showDay(d.iso)}
            </button>
          ))}
        </div>
        <div className="toolbar__filters">
          <select value={city} aria-label="Filter by city" onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status.loading && <LoadingBlock label="Loading showtimes..." />}
      {status.error && <ErrorState error={status.error} onRetry={load} />}

      {!status.loading && !status.error && byMovie.length === 0 && (
        <EmptyState
          icon="🗓️"
          title="Nothing playing on this date"
          hint="Pick another day, or clear the city filter."
        />
      )}

      {byMovie.map(({ movie, theaters }) => (
        <article className="board board--film" key={movie.id}>
          <header className="board__film-head">
            {movie.posterUrl && <img src={movie.posterUrl} alt="" />}
            <div>
              <h3>
                <Link to={`/movies/${movie.slug}`}>{movie.title}</Link>
              </h3>
              <span className="muted">{movie.certificate}</span>
            </div>
          </header>

          {theaters.map(({ theater, shows }) => (
            <div className="board__theater" key={theater.id}>
              <div className="board__theater-head">
                <h4>{theater.name}</h4>
                <span>{theater.city}</span>
              </div>
              <div className="board__times">
                {shows.map((s) => (
                  <Link key={s.id} to={`/book/${s.id}`} className="showchip">
                    <strong>{showTime(s.startsAt)}</strong>
                    <span>{s.format}</span>
                    <span className={`showchip__seats ${s.seatsAvailable < 10 ? 'is-low' : ''}`}>
                      {s.seatsAvailable > 0 ? `${s.seatsAvailable} left` : 'Sold out'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
