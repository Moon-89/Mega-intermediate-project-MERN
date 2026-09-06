import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Confirm, ErrorState, Field, LoadingBlock, Modal } from '../../components/ui.jsx';
import { dateKey, fullDate, money, toLocalInput } from '../../utils/format.js';

const BLANK = {
  movieId: '',
  theaterId: '',
  screenId: '',
  startsAt: '',
  language: 'English',
  format: '2D',
  basePrice: 250,
};

export default function AdminShowtimes() {
  const toast = useToast();
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);
  const [theaters, setTheaters] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [day, setDay] = useState('');
  const [theaterFilter, setTheaterFilter] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    setStatus({ loading: true, error: null });
    Promise.all([
      api.showtimes.list({ date: day || undefined, theater: theaterFilter || undefined }),
      api.movies.list({ limit: 50, status: 'active' }),
      api.theaters.list(),
    ])
      .then(([shows, movieRes, theaterList]) => {
        setShowtimes(shows);
        setMovies(movieRes.data);
        setTheaters(theaterList);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  }, [day, theaterFilter]);

  useEffect(() => load(), [load]);

  const selectedTheater = useMemo(
    () => theaters.find((t) => t.id === form.theaterId),
    [theaters, form.theaterId],
  );

  const openNew = () => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(18, 0, 0, 0);
    setForm({ ...BLANK, startsAt: toLocalInput(start) });
    setErrors({});
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.showtimes.create({
        movieId: form.movieId,
        theaterId: form.theaterId,
        screenId: form.screenId,
        startsAt: new Date(form.startsAt).toISOString(),
        language: form.language,
        format: form.format,
        basePrice: Number(form.basePrice),
      });
      toast.success('Showtime scheduled');
      setOpen(false);
      load();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async () => {
    setBusy(true);
    try {
      await confirm.action();
      toast.success(confirm.done);
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Showtimes ({showtimes.length})</h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={openNew}>
          Schedule a show
        </button>
      </div>

      <div className="toolbar__filters">
        <input
          type="date"
          value={day}
          aria-label="Filter by date"
          min={dateKey(new Date())}
          onChange={(e) => setDay(e.target.value)}
        />
        <select
          value={theaterFilter}
          aria-label="Filter by theater"
          onChange={(e) => setTheaterFilter(e.target.value)}
        >
          <option value="">All theaters</option>
          {theaters.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.city}
            </option>
          ))}
        </select>
        {(day || theaterFilter) && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setDay('');
              setTheaterFilter('');
            }}
          >
            Clear
          </button>
        )}
      </div>

      {status.loading && <LoadingBlock />}
      {status.error && <ErrorState error={status.error} onRetry={load} />}

      {!status.loading && !status.error && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Film</th>
                <th>Theater / screen</th>
                <th>Format</th>
                <th>Base price</th>
                <th>Seats</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {showtimes.map((s) => {
                const sold = s.totalSeats - s.seatsAvailable;
                return (
                  <tr key={s.id}>
                    <td>{fullDate(s.startsAt)}</td>
                    <td>{s.movie?.title}</td>
                    <td>
                      {s.theater?.name}
                      <span className="muted"> · {s.screenName}</span>
                    </td>
                    <td>
                      <Badge>{s.format}</Badge>
                    </td>
                    <td>{money(s.basePrice)}</td>
                    <td>
                      <div className="meter" title={`${sold} of ${s.totalSeats} sold`}>
                        <span style={{ width: `${(sold / s.totalSeats) * 100}%` }} />
                      </div>
                      <span className="muted">
                        {sold}/{s.totalSeats}
                      </span>
                    </td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="linklike linklike--danger"
                        onClick={() =>
                          setConfirm({
                            title: 'Cancel this showtime?',
                            message: `Every confirmed booking on this show is cancelled and refunded. ${sold} seat(s) affected.`,
                            label: 'Cancel showtime',
                            done: 'Showtime cancelled and bookings refunded',
                            action: () => api.showtimes.cancel(s.id),
                          })
                        }
                      >
                        Cancel show
                      </button>
                      {sold === 0 && (
                        <button
                          type="button"
                          className="linklike linklike--danger"
                          onClick={() =>
                            setConfirm({
                              title: 'Delete this showtime?',
                              message: 'Nothing is booked on it, so it can be removed entirely.',
                              label: 'Delete',
                              done: 'Showtime deleted',
                              action: () => api.showtimes.remove(s.id),
                            })
                          }
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {showtimes.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted center">
                    No showtimes match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title="Schedule a showtime"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="showtime-form" className="btn btn--primary" disabled={busy}>
              {busy ? 'Scheduling...' : 'Schedule'}
            </button>
          </>
        }
      >
        <form id="showtime-form" onSubmit={save} className="form-grid">
          <Field label="Film" error={errors.movieId} htmlFor="st-movie">
            <select
              id="st-movie"
              required
              value={form.movieId}
              onChange={(e) => {
                const movie = movies.find((m) => m.id === e.target.value);
                setForm({
                  ...form,
                  movieId: e.target.value,
                  language: movie?.languages?.[0] || form.language,
                });
              }}
            >
              <option value="">Choose a film...</option>
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.durationMins} min)
                </option>
              ))}
            </select>
          </Field>

          <div className="form-row">
            <Field label="Theater" error={errors.theaterId} htmlFor="st-theater">
              <select
                id="st-theater"
                required
                value={form.theaterId}
                onChange={(e) => setForm({ ...form, theaterId: e.target.value, screenId: '' })}
              >
                <option value="">Choose a theater...</option>
                {theaters.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.city}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Screen" error={errors.screenId} htmlFor="st-screen">
              <select
                id="st-screen"
                required
                disabled={!selectedTheater}
                value={form.screenId}
                onChange={(e) => {
                  const screen = selectedTheater?.screens.find((s) => s.id === e.target.value);
                  setForm({ ...form, screenId: e.target.value, format: screen?.format || form.format });
                }}
              >
                <option value="">{selectedTheater ? 'Choose a screen...' : 'Pick a theater first'}</option>
                {selectedTheater?.screens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.rows * s.seatsPerRow} seats)
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="form-row">
            <Field label="Starts at" error={errors.startsAt} htmlFor="st-start">
              <input
                id="st-start"
                type="datetime-local"
                required
                min={toLocalInput(new Date())}
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </Field>

            <Field label="Base price" hint="Classic seats" error={errors.basePrice} htmlFor="st-price">
              <input
                id="st-price"
                type="number"
                min={1}
                required
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              />
            </Field>
          </div>

          <div className="form-row">
            <Field label="Language" error={errors.language} htmlFor="st-lang">
              <input
                id="st-lang"
                required
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              />
            </Field>

            <Field label="Format" error={errors.format} htmlFor="st-format">
              <select
                id="st-format"
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
              >
                {['2D', '3D', 'IMAX', '4DX'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>

          <p className="muted">
            The end time is derived from the film runtime, and a 20 minute turnaround is enforced
            between shows on the same screen.
          </p>
        </form>
      </Modal>

      <Confirm
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        busy={busy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </section>
  );
}
