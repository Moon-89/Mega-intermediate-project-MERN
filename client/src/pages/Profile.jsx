import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Badge, Field } from '../components/ui.jsx';
import { fullDate } from '../utils/format.js';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [pwErrors, setPwErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await updateProfile(profile);
      toast.success('Profile updated');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    setPwErrors({});
    try {
      await api.auth.changePassword(pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      setPwErrors(err.fieldErrors || {});
      toast.error(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="container narrow section">
      <h1 className="page-title">Profile</h1>

      <div className="panel">
        <div className="panel__head">
          <div>
            <h2>{user.name}</h2>
            <p className="muted">{user.email}</p>
          </div>
          <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>{user.role}</Badge>
        </div>
        <p className="muted">Member since {fullDate(user.createdAt)}</p>
      </div>

      <form className="panel" onSubmit={saveProfile}>
        <h2>Your details</h2>
        <Field label="Full name" error={errors.name} htmlFor="p-name">
          <input
            id="p-name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
        </Field>
        <Field label="Phone" error={errors.phone} htmlFor="p-phone">
          <input
            id="p-phone"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
        </Field>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      <form className="panel" onSubmit={savePassword}>
        <h2>Change password</h2>
        <Field label="Current password" error={pwErrors.currentPassword} htmlFor="p-current">
          <input
            id="p-current"
            type="password"
            autoComplete="current-password"
            required
            value={pw.currentPassword}
            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
          />
        </Field>
        <Field
          label="New password"
          hint="8+ characters with upper, lower and a number"
          error={pwErrors.newPassword}
          htmlFor="p-new"
        >
          <input
            id="p-new"
            type="password"
            autoComplete="new-password"
            required
            value={pw.newPassword}
            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
          />
        </Field>
        <button type="submit" className="btn btn--primary" disabled={pwBusy}>
          {pwBusy ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
