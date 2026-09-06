import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import MovieDetail from './pages/MovieDetail.jsx';
import Showtimes from './pages/Showtimes.jsx';
import Theaters from './pages/Theaters.jsx';
import Booking from './pages/Booking.jsx';
import MyBookings from './pages/MyBookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import NotFound from './pages/NotFound.jsx';

import AdminLayout from './pages/admin/AdminLayout.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import AdminMovies from './pages/admin/AdminMovies.jsx';
import AdminTheaters from './pages/admin/AdminTheaters.jsx';
import AdminShowtimes from './pages/admin/AdminShowtimes.jsx';
import AdminBookings from './pages/admin/AdminBookings.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';

/** Every navigation should start at the top of the new page. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          {/* public */}
          <Route path="/" element={<Home />} />
          <Route path="/movies/:slug" element={<MovieDetail />} />
          <Route path="/showtimes" element={<Showtimes />} />
          <Route path="/theaters" element={<Theaters />} />
          <Route path="/book/:showtimeId" element={<Booking />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* signed in */}
          <Route element={<ProtectedRoute />}>
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/bookings/:id" element={<BookingDetail />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* admins only */}
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="movies" element={<AdminMovies />} />
              <Route path="theaters" element={<AdminTheaters />} />
              <Route path="showtimes" element={<AdminShowtimes />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="users" element={<AdminUsers />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
