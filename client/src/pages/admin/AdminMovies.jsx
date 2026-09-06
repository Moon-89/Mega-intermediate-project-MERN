import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  Badge,
  Confirm,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  Pagination,
} from '../../components/ui.jsx';
import { runtime } from '../../utils/format.js';

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama',
  'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
];
const CERTIFICATES = ['U', 'UA', 'A', 'PG-13', 'R'];

const BLANK = {
  title: '',
  synopsis: '',
  genres: [],
  languages: 'English',
  durationMins: 120,
  certificate: 'UA',
  releaseDate: new Date().toISOString().slice(0, 10),
  posterUrl: '',
  director: '',
  cast: '',
  accentColor: '#e11d48',
  isActive: true,
};

const toForm = (m) => ({
  title: m.title,
  synopsis: m.synopsis,
  genres: m.genres,
  languages: m.languages.join(', '),
  durationMins: m.durationMins,
  certificate: m.certificate,
  releaseDate: new Date(m.releaseDate).toISOString().slice(0, 10),
  posterUrl: m.posterUrl || '',
  director: m.director || '',
  cast: (m.cast || []).join(', '),
  accentColor: m.accentColor || '#e11d48',
  isActive: m.isActive,
});

const toPayload = (f) => ({
  title: f.title,
  synopsis: f.synopsis,
  genres: f.genres,
  languages: f.languages.split(',').map((s) => s.trim()).filter(Boolean),
  durationMins: Number(f.durationMins),
  certificate: f.certificate,
  releaseDate: new Date(f.releaseDate).toISOString(),
  posterUrl: f.posterUrl.trim(),
  director: f.director.trim(),
  cast: f.cast.split(',').map((s) => s.trim()).filter(Boolean),
  accentColor: f.accentColor,
  isActive: f.isActive,
});

export default function AdminMovies() {
  const toast = useToast();
  const [result, setResult] = useState({ data: [], meta: null });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState({ loading: true, error: null });

  const [editing, setEditing] = useState(null); // movie object or 'new'
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    setStatus({ loading: true, error: null });
    api.movies
      .list({ page, limit: 10, status: 'all', sort: 'newest' })
      .then((res) => {
        setResult(res);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  }, [page]);

  useEffect(() => load(), [load]);

  const openNew = () => {
    setForm(BLANK);
    setErrors({});
    setEditing('new');
  };

  const openEdit = (movie) => {
    setForm(toForm(movie));
    setErrors({});
    setEditing(movie);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const payload = toPayload(form);
      if (editing === 'new') {
        await api.movies.create(payload);
        toast.success('Film added');
      } else {
        await api.movies.update(editing.id, payload);
        toast.success('Film updated');
      }
      setEditing(null);
      load();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.movies.remove(deleting.id);
      toast.success('Film deleted');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleGenre = (g) =>
    setForm((f) => ({
      ...f,
      genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g],
    }));

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Films ({result.meta?.total ?? 0})</h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={openNew}>
          Add film
        </button>
      </div>

      {status.loading && <LoadingBlock />}
      {status.error && <ErrorState error={status.error} onRetry={load} />}

      {!status.loading && !status.error && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Film</th>
                  <th>Genres</th>
                  <th>Runtime</th>
                  <th>Cert</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="cell-media">
                        {m.posterUrl && <img src={m.posterUrl} alt="" />}
                        <div>
                          <strong>{m.title}</strong>
                          <span className="muted mono">{m.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td>{m.genres.join(', ')}</td>
                    <td>{runtime(m.durationMins)}</td>
                    <td>{m.certificate}</td>
                    <td>
                      {m.avgRating ? `${m.avgRating.toFixed(1)} (${m.reviewCount})` : '—'}
                    </td>
                    <td>
                      <Badge tone={m.isActive ? 'success' : 'neutral'}>
                        {m.isActive ? 'active' : 'hidden'}
                      </Badge>
                    </td>
                    <td className="cell-actions">
                      <button type="button" className="linklike" onClick={() => openEdit(m)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="linklike linklike--danger"
                        onClick={() => setDeleting(m)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} onPage={setPage} />
        </>
      )}

      <Modal
        open={Boolean(editing)}
        wide
        title={editing === 'new' ? 'Add a film' : `Edit ${editing?.title || ''}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="movie-form" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving...' : 'Save film'}
            </button>
          </>
        }
      >
        <form id="movie-form" onSubmit={save} className="form-grid">
          <Field label="Title" error={errors.title} htmlFor="m-title">
            <input
              id="m-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>

          <Field label="Director" error={errors.director} htmlFor="m-director">
            <input
              id="m-director"
              value={form.director}
              onChange={(e) => setForm({ ...form, director: e.target.value })}
            />
          </Field>

          <Field
            label="Synopsis"
            error={errors.synopsis}
            hint="10-2000 characters"
            htmlFor="m-synopsis"
          >
            <textarea
              id="m-synopsis"
              rows={4}
              required
              value={form.synopsis}
              onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
            />
          </Field>

          <Field label="Genres" error={errors.genres} hint="Pick 1 to 5">
            <div className="chips chips--pick">
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`chip chip--toggle ${form.genres.includes(g) ? 'is-on' : ''}`}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>

          <div className="form-row">
            <Field label="Runtime (min)" error={errors.durationMins} htmlFor="m-runtime">
              <input
                id="m-runtime"
                type="number"
                min={30}
                max={300}
                required
                value={form.durationMins}
                onChange={(e) => setForm({ ...form, durationMins: e.target.value })}
              />
            </Field>

            <Field label="Certificate" error={errors.certificate} htmlFor="m-cert">
              <select
                id="m-cert"
                value={form.certificate}
                onChange={(e) => setForm({ ...form, certificate: e.target.value })}
              >
                {CERTIFICATES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="Release date" error={errors.releaseDate} htmlFor="m-release">
              <input
                id="m-release"
                type="date"
                required
                value={form.releaseDate}
                onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
              />
            </Field>
          </div>

          <div className="form-row">
            <Field label="Languages" hint="Comma separated" error={errors.languages} htmlFor="m-lang">
              <input
                id="m-lang"
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
              />
            </Field>

            <Field label="Accent colour" error={errors.accentColor} htmlFor="m-colour">
              <input
                id="m-colour"
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Poster URL" error={errors.posterUrl} htmlFor="m-poster">
            <input
              id="m-poster"
              type="url"
              placeholder="https://..."
              value={form.posterUrl}
              onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
            />
          </Field>

          <Field label="Cast" hint="Comma separated" error={errors.cast} htmlFor="m-cast">
            <input
              id="m-cast"
              value={form.cast}
              onChange={(e) => setForm({ ...form, cast: e.target.value })}
            />
          </Field>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span>Show this film in the public catalogue</span>
          </label>
        </form>
      </Modal>

      <Confirm
        open={Boolean(deleting)}
        title={`Delete "${deleting?.title || ''}"?`}
        message="Films with upcoming showtimes cannot be deleted - hide them instead."
        confirmLabel="Delete film"
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
