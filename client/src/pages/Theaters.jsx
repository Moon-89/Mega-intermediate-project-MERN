import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, ErrorState, LoadingBlock } from '../components/ui.jsx';

export default function Theaters() {
  const [theaters, setTheaters] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  const load = () => {
    setStatus({ loading: true, error: null });
    api.theaters
      .list()
      .then((data) => {
        setTheaters(data);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  };

  useEffect(load, []);

  const byCity = useMemo(() => {
    const groups = new Map();
    theaters.forEach((t) => {
      if (!groups.has(t.city)) groups.set(t.city, []);
      groups.get(t.city).push(t);
    });
    return [...groups.entries()];
  }, [theaters]);

  if (status.loading) return <LoadingBlock label="Loading theaters..." />;
  if (status.error) {
    return (
      <div className="container section">
        <ErrorState error={status.error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="container section">
      <h1 className="page-title">Our theaters</h1>
      <p className="page-lead">
        {theaters.length} venues, {theaters.reduce((n, t) => n + t.screens.length, 0)} screens.
      </p>

      {byCity.map(([city, list]) => (
        <section key={city} className="city-block">
          <h2 className="section__title">{city}</h2>
          <div className="theater-grid">
            {list.map((t) => (
              <article className="theater-card" key={t.id}>
                <h3>{t.name}</h3>
                <p className="muted">{t.address}</p>
                <div className="chips">
                  {t.amenities.map((a) => (
                    <Badge key={a}>{a}</Badge>
                  ))}
                </div>
                <ul className="screen-list">
                  {t.screens.map((s) => (
                    <li key={s.id}>
                      <span>{s.name}</span>
                      <span className="muted">
                        {s.format} &middot; {s.rows * s.seatsPerRow} seats
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
