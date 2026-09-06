import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { initials } from '../utils/format.js';

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="CineBook home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path d="M8 10h16v12H8z" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="12" cy="16" r="1.7" fill="white" />
        <circle cx="20" cy="16" r="1.7" fill="white" />
      </svg>
      <span>
        Cine<b>Book</b>
      </span>
    </Link>
  );
}

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__inner container">
          <Brand />

          <button
            type="button"
            className="icon-btn topbar__burger"
            aria-label="Toggle navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span className="burger" />
          </button>

          <nav className={`topbar__nav ${navOpen ? 'is-open' : ''}`}>
            <NavLink to="/" end>
              Movies
            </NavLink>
            <NavLink to="/showtimes">Showtimes</NavLink>
            <NavLink to="/theaters">Theaters</NavLink>
            {user && <NavLink to="/bookings">My bookings</NavLink>}
            {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          </nav>

          <div className="topbar__actions">
            {user ? (
              <div className="usermenu" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="avatar"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  {initials(user.name)}
                </button>
                {menuOpen && (
                  <div className="usermenu__panel" role="menu">
                    <div className="usermenu__head">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                      <span className={`badge badge--${isAdmin ? 'accent' : 'neutral'}`}>{user.role}</span>
                    </div>
                    <Link to="/profile" role="menuitem">
                      Profile
                    </Link>
                    <Link to="/bookings" role="menuitem">
                      My bookings
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" role="menuitem">
                        Admin console
                      </Link>
                    )}
                    <button type="button" onClick={handleSignOut} role="menuitem">
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn btn--primary btn--sm">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <Brand />
          <p>
            A MERN demo cinema. Movies, theaters, showtimes and bookings are fictional; posters are
            placeholder images.
          </p>
          <p className="footer__meta">
            Built with React, Express, MongoDB &amp; Mongoose &middot; role-based auth &middot; REST API
          </p>
        </div>
      </footer>
    </div>
  );
}
