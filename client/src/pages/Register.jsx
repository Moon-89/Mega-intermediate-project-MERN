import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Field } from '../components/ui.jsx';

const RULES = [
  { test: (v) => v.length >= 8, label: 'At least 8 characters' },
  { test: (v) => /[a-z]/.test(v), label: 'A lowercase letter' },
  { test: (v) => /[A-Z]/.test(v), label: 'An uppercase letter' },
  { test: (v) => /[0-9]/.test(v), label: 'A number' },
];

export default function Register() {
  const { signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const from = location.state?.from || '/';
  if (isAuthenticated) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const user = await signUp(form);
      toast.success(`Account created. Welcome, ${user.name.split(' ')[0]}`);
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
        <h1>Create your account</h1>
        <p className="muted">It takes about twenty seconds.</p>

        <form onSubmit={submit} noValidate>
          <Field label="Full name" error={errors.name} htmlFor="name">
            <input
              id="name"
              autoComplete="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

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

          <Field label="Phone" hint="Optional" error={errors.phone} htmlFor="phone">
            <input
              id="phone"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>

          <Field label="Password" error={errors.password} htmlFor="password">
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          <ul className="rules">
            {RULES.map((r) => (
              <li key={r.label} className={r.test(form.password) ? 'is-met' : ''}>
                {r.test(form.password) ? '✓' : '○'} {r.label}
              </li>
            ))}
          </ul>

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-card__foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
