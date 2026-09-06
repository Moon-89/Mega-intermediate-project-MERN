import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Field } from '../components/ui.jsx';

const DEMO = [
  { label: 'Admin', email: 'admin@cinebook.dev', password: 'Admin@123' },
  { label: 'Customer', email: 'user@cinebook.dev', password: 'User@123' },
];

export default function Login() {
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const from = location.state?.from || '/';
  if (isAuthenticated) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const user = await signIn(form);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(from, { replace: true });
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow section">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="muted">Welcome back. Your seats are waiting.</p>

        <form onSubmit={submit} noValidate>
          <Field label="Email" error={errors.email} htmlFor="email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>

          <Field label="Password" error={errors.password} htmlFor="password">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-card__demo">
          <span className="muted">Demo accounts</span>
          <div className="auth-card__demo-buttons">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setForm({ email: d.email, password: d.password })}
              >
                Fill {d.label}
              </button>
            ))}
          </div>
        </div>

        <p className="auth-card__foot">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
