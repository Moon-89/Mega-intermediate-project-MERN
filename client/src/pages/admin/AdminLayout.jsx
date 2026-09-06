import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/movies', label: 'Movies' },
  { to: '/admin/theaters', label: 'Theaters' },
  { to: '/admin/showtimes', label: 'Showtimes' },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/users', label: 'Users' },
];

export default function AdminLayout() {
  return (
    <div className="container section">
      <header className="admin-head">
        <div>
          <p className="hero__eyebrow">Admin console</p>
          <h1 className="page-title">Run the cinema</h1>
        </div>
      </header>

      <nav className="admin-nav">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
