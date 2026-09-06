import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';

/**
 * Renders the whole app at a given route, exactly as main.jsx wires it,
 * but with an in-memory router so tests can start anywhere.
 */
export function renderApp(route = '/', { token } = {}) {
  if (token) localStorage.setItem('cinebook.token', token);

  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
