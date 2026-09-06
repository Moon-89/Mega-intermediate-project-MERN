import { Link } from 'react-router-dom';
import { Badge, Stars } from './ui.jsx';
import { runtime } from '../utils/format.js';

export default function MovieCard({ movie }) {
  return (
    <Link
      to={`/movies/${movie.slug}`}
      className="movie-card"
      style={{ '--card-accent': movie.accentColor || 'var(--accent)' }}
    >
      <div className="movie-card__poster">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className="movie-card__fallback">{movie.title.slice(0, 2)}</div>
        )}
        <span className="movie-card__cert">{movie.certificate}</span>
        {!movie.isActive && <span className="movie-card__inactive">Not showing</span>}
      </div>

      <div className="movie-card__body">
        <h3>{movie.title}</h3>
        <div className="movie-card__meta">
          <span>{runtime(movie.durationMins)}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{movie.languages?.[0]}</span>
        </div>
        <Stars value={movie.avgRating} count={movie.reviewCount} />
        <div className="chips">
          {movie.genres?.slice(0, 2).map((g) => (
            <Badge key={g}>{g}</Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
