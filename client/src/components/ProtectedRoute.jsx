import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingBlock } from './ui.jsx';

/**
 * Gate for authenticated routes.
 * `role="admin"` additionally requires the admin role and renders a 403 page
 * rather than bouncing to the login screen, which would be misleading.
 */
export default function ProtectedRoute({ role }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingBlock label="Checking your session..." />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (role === 'admin' && !isAdmin) {
    return (
      <div className="container narrow section">
        <div className="state-block state-block--error">
          <div className="state-block__icon">🔒</div>
          <h3>Admins only</h3>
          <p>Your account does not have permission to open the admin console.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
