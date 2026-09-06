import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Badge, Confirm, EmptyState, ErrorState, LoadingBlock, Stars } from '../components/ui.jsx';
import { dateKey, fullDate, runtime, showDay, showTime } from '../utils/format.js';

function ShowtimeBoard({ showtimes }) {
  const [day, setDay] = useState(null);

  const days = useMemo(() => {
    const set = new Map();
    showtimes.forEach((s) => set.set(dateKey(s.startsAt), s.startsAt));
    return [...set.entries()].map(([key, iso]) => ({ key, iso }));
  }, [showtimes]);

  const activeDay = day || days[0]?.key;

  const byTheater = useMemo(() => {
    const groups = new Map();
    showtimes
      .filter((s) => dateKey(s.startsAt) === activeDay)
      .forEach((s) => {
        const id = s.theater?.id || s.theater;
        if (!groups.has(id)) groups.set(id, { theater: s.theater, shows: [] });
        groups.get(id).shows.push(s);
      });
    return [...groups.values()];
  }, [showtimes, activeDay]);

  if (!showtimes.length) {
    return <EmptyState icon="🗓️" title="No upcoming showtimes" hint="Check back soon." />;
  }

  return (
    <div className="board">
      <div className="daystrip" role="tablist" aria-label="Choose a date">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={d.key === activeDay}
            className={`daystrip__day ${d.key === activeDay ? 'is-active' : ''}`}
            onClick={() => setDay(d.key)}
          >
            {showDay(d.iso)}
          </button>
        ))}
      </div>

      {byTheater.map(({ theater, shows }) => (
        <div className="board__theater" key={theater?.id || theater}>
          <div className="board__theater-head">
            <h4>{theater?.name}</h4>
            <span>
              {theater?.city} &middot; {theater?.address}
            </span>
          </div>
          <div className="board__times">
            {shows.map((s) => (
              <Link key={s.id} to={`/book/${s.id}`} className="showchip">
                <strong>{showTime(s.startsAt)}</strong>
                <span>
                  {s.format} &middot; {s.language}
                </span>
                <span className={`showchip__seats ${s.seatsAvailable < 10 ? 'is-low' : ''}`}>
                  {s.seatsAvailable > 0 ? `${s.seatsAvailable} left` : 'Sold out'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewForm({ movieId, existing, onSaved }) {
  const [rating, setRating] = useState(existing?.rating || 5);
  const [comment, setComment] = useState(existing?.comment || '');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = existing
        ? await api.reviews.update(existing.id, { rating, comment })
        : await api.movies.addReview(movieId, { rating, comment });
      toast.success(existing ? 'Review updated' : 'Thanks for the review');
      onSaved(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <div className="review-form__rating">
        <span>Your rating</span>
        <div className="rating-input" role="radiogroup" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              className={`rating-input__star ${n <= rating ? 'is-on' : ''}`}
              onClick={() => setRating(n)}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={comment}
        maxLength={800}
        rows={3}
        placeholder="What did you think? (optional)"
        onChange={(e) => setComment(e.target.value)}
      />
      <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
        {busy ? 'Saving...' : existing ? 'Update review' : 'Post review'}
      </button>
    </form>
  );
}

export default function MovieDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [reviews, setReviews] = useState({ data: [], meta: null });
  const [status, setStatus] = useState({ loading: true, error: null });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const m = await api.movies.get(slug);
      setMovie(m);
      const [shows, revs] = await Promise.all([
        api.showtimes.list({ movie: m.id }),
        api.movies.reviews(m.id, { limit: 20 }),
      ]);
      setShowtimes(shows);
      setReviews(revs);
      setStatus({ loading: false, error: null });
    } catch (err) {
      setStatus({ loading: false, error: err });
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const myReview = useMemo(
    () => (user ? reviews.data.find((r) => r.user?.id === user.id || r.id === reviews.meta?.myReviewId) : null),
    [reviews, user],
  );

  const refreshReviews = async () => {
    const [m, revs] = await Promise.all([api.movies.get(slug), api.movies.reviews(movie.id, { limit: 20 })]);
    setMovie(m);
    setReviews(revs);
  };

  const removeReview = async () => {
    try {
      await api.reviews.remove(confirmDelete);
      setConfirmDelete(null);
      toast.success('Review removed');
      await refreshReviews();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (status.loading) return <LoadingBlock label="Loading film..." />;
  if (status.error) {
    return (
      <div className="container section">
        <ErrorState error={status.error} onRetry={load} />
        <p className="center">
          <Link to="/" className="btn btn--ghost">
            Back to all films
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="film-hero" style={{ '--card-accent': movie.accentColor }}>
        <div className="container film-hero__inner">
          <div className="film-hero__poster">
            {movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} /> : null}
          </div>
          <div className="film-hero__body">
            <div className="chips">
              <Badge tone="accent">{movie.certificate}</Badge>
              {movie.genres.map((g) => (
                <Badge key={g}>{g}</Badge>
              ))}
            </div>
            <h1>{movie.title}</h1>
            <div className="film-hero__meta">
              <span>{runtime(movie.durationMins)}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{movie.languages.join(', ')}</span>
              <span aria-hidden="true">&middot;</span>
              <span>Released {fullDate(movie.releaseDate).split(',').slice(0, 2).join(',')}</span>
            </div>
            <Stars value={movie.avgRating} count={movie.reviewCount} />
            <p className="film-hero__synopsis">{movie.synopsis}</p>
            {movie.director && (
              <p className="film-hero__credits">
                <strong>Director</strong> {movie.director}
              </p>
            )}
            {movie.cast?.length > 0 && (
              <p className="film-hero__credits">
                <strong>Cast</strong> {movie.cast.join(', ')}
              </p>
            )}
            <div className="hero__actions">
              <a href="#showtimes" className="btn btn--primary">
                {movie.upcomingShowtimes > 0
                  ? `Book tickets (${movie.upcomingShowtimes} shows)`
                  : 'No shows scheduled'}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="container section" id="showtimes">
        <h2 className="section__title">Showtimes</h2>
        <ShowtimeBoard showtimes={showtimes} />
      </section>

      <section className="container section">
        <h2 className="section__title">
          Reviews <span className="muted">({movie.reviewCount})</span>
        </h2>

        {user ? (
          <ReviewForm
            movieId={movie.id}
            existing={myReview}
            onSaved={async () => {
              await refreshReviews();
            }}
          />
        ) : (
          <p className="muted">
            <button type="button" className="linklike" onClick={() => navigate('/login')}>
              Sign in
            </button>{' '}
            to leave a review.
          </p>
        )}

        {reviews.data.length === 0 ? (
          <EmptyState icon="💬" title="No reviews yet" hint="Be the first to say something." />
        ) : (
          <ul className="review-list">
            {reviews.data.map((r) => (
              <li key={r.id} className="review">
                <div className="review__head">
                  <strong>{r.user?.name || 'Someone'}</strong>
                  <Stars value={r.rating} />
                  <span className="muted">{fullDate(r.createdAt)}</span>
                  {(r.user?.id === user?.id || user?.role === 'admin') && (
                    <button
                      type="button"
                      className="linklike linklike--danger"
                      onClick={() => setConfirmDelete(r.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {r.comment && <p>{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Confirm
        open={Boolean(confirmDelete)}
        title="Delete this review?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={removeReview}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
}
