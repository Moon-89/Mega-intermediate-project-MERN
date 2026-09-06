import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Confirm, ErrorState, LoadingBlock, Pagination } from '../../components/ui.jsx';
import { fullDate } from '../../utils/format.js';

export default function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], meta: null });
  const [status, setStatus] = useState({ loading: true, error: null });
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setStatus({ loading: true, error: null });
    api.admin
      .users({ q: search, role, page, limit: 15 })
      .then((res) => {
        setResult(res);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  }, [search, role, page]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const changeRole = async () => {
    setBusy(true);
    try {
      await api.admin.setRole(pending.user.id, pending.role);
      toast.success(`${pending.user.name} is now ${pending.role === 'admin' ? 'an admin' : 'a customer'}`);
      setPending(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Users ({result.meta?.total ?? 0})</h2>
      </div>

      <div className="toolbar__filters">
        <input
          type="search"
          placeholder="Search name or email..."
          aria-label="Search users"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={role}
          aria-label="Filter by role"
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="user">Customers</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {status.loading && <LoadingBlock />}
      {status.error && <ErrorState error={status.error} onRetry={load} />}

      {!status.loading && !status.error && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Bookings</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      {u.id === me.id && <span className="muted"> (you)</span>}
                    </td>
                    <td className="muted">{u.email}</td>
                    <td className="muted">{u.phone || '—'}</td>
                    <td>{u.bookingCount}</td>
                    <td>
                      <Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role}</Badge>
                    </td>
                    <td className="muted">{fullDate(u.createdAt)}</td>
                    <td className="cell-actions">
                      {u.id !== me.id && (
                        <button
                          type="button"
                          className="linklike"
                          onClick={() =>
                            setPending({ user: u, role: u.role === 'admin' ? 'user' : 'admin' })
                          }
                        >
                          {u.role === 'admin' ? 'Demote' : 'Make admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {result.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted center">
                      No users match that search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} onPage={setPage} />
        </>
      )}

      <Confirm
        open={Boolean(pending)}
        tone="primary"
        title={pending?.role === 'admin' ? 'Grant admin access?' : 'Remove admin access?'}
        message={
          pending?.role === 'admin'
            ? `${pending?.user.name} will be able to manage films, theaters, showtimes and every booking.`
            : `${pending?.user.name} will lose access to the admin console.`
        }
        confirmLabel={pending?.role === 'admin' ? 'Make admin' : 'Demote to customer'}
        busy={busy}
        onConfirm={changeRole}
        onClose={() => setPending(null)}
      />
    </section>
  );
}
