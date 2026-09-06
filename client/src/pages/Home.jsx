import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import MovieCard from '../components/MovieCard.jsx';
import { EmptyState, ErrorState, LoadingBlock, Pagination } from '../components/ui.jsx';

const SORTS = [
  { value: 'newest', label: 'Recently added' },
  { value: 'rating', label: 'Top rated' },
  { value: 'releaseDate', label: 'Newest release' },
  { value: 'title', label: 'A to Z' },
];

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState({ data: [], meta: null });
  const [filters, setFilters] = useState({ genres: [], languages: [], cities: [] });
  const [search, setSearch] = useState(params.get('q') || '');
  const [status, setStatus] = useState({ loading: true, error: null });

  const query = useMemo(
    () => ({
      q: params.get('q') || '',
      genre: params.get('genre') || '',
      language: params.get('language') || '',
      sort: params.get('sort') || 'newest',
      page: Number(params.get('page') || 1),
      limit: 12,
    }),
    [params],
  );

  const patchQuery = useCallback(
    (patch) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === '' || v === null || v === undefined) next.delete(k);
        else next.set(k, v);
      });
      if (!('page' in patch)) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    api.movies.filters().then(setFilters).catch(() => {});
  }, []);

  // Debounce the search box, and drop responses from stale requests.
  useEffect(() => {
    const id = setTimeout(() => patchQuery({ q: search.trim() }), search === query.q ? 0 : 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const load = useCallback(() => {
    const controller = new AbortController();
    setStatus({ loading: true, error: null });
    api.movies
      .list(query, controller.signal)
      .then((res) => {
        setResult(res);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setStatus({ loading: false, error: err });
      });
    return () => controller.abort();
  }, [query]);

  useEffect(() => load(), [load]);

  const hasFilters = query.q || query.genre || query.language;

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <p className="hero__eyebrow">Now showing</p>
          <h1>
            Great films.
            <br />
            The seat you actually want.
          </h1>
          <p className="hero__lead">
            Browse what is playing, pick your seats on a live seat map, and hold them the moment you
            confirm.
          </p>
          <div className="hero__actions">
            <Link to="/showtimes" className="btn btn--primary">
              Browse showtimes
            </Link>
            <Link to="/theaters" className="btn btn--ghost">
              Our theaters
            </Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="toolbar">
          <div className="toolbar__search">
            <input
              type="search"
              value={search}
              placeholder="Search films by title..."
              aria-label="Search films"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="toolbar__filters">
            <select
              value={query.genre}
              aria-label="Filter by genre"
              onChange={(e) => patchQuery({ genre: e.target.value })}
            >
              <option value="">All genres</option>
              {filters.genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={query.language}
              aria-label="Filter by language"
              onChange={(e) => patchQuery({ language: e.target.value })}
            >
              <option value="">All languages</option>
              {filters.languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <select
              value={query.sort}
              aria-label="Sort films"
              onChange={(e) => patchQuery({ sort: e.target.value })}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setSearch('');
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {status.loading && <LoadingBlock label="Loading films..." />}
        {status.error && <ErrorState error={status.error} onRetry={load} />}

        {!status.loading && !status.error && result.data.length === 0 && (
          <EmptyState
            title="No films match that"
            hint="Try a different genre, language or search term."
          />
        )}

        {!status.loading && !status.error && result.data.length > 0 && (
          <>
            <p className="result-count">
              {result.meta.total} film{result.meta.total === 1 ? '' : 's'}
              {hasFilters ? ' matching your filters' : ' now showing'}
            </p>
            <div className="movie-grid">
              {result.data.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
            <Pagination meta={result.meta} onPage={(page) => patchQuery({ page })} />
          </>
        )}
      </section>
    </>
  );
}
