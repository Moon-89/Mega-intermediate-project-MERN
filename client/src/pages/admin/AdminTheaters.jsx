import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Confirm, ErrorState, Field, LoadingBlock, Modal } from '../../components/ui.jsx';

const LETTERS = 'ABCDEFGHIJKLMNOPQRST';

const BLANK_THEATER = { name: '', city: '', address: '', amenities: '' };
const BLANK_SCREEN = { name: '', rows: 8, seatsPerRow: 12, format: '2D', classicRows: 4, premiumRows: 3 };

/** Splits rows into Classic / Premium / Recliner bands for the API payload. */
function buildSeatClasses({ rows, classicRows, premiumRows }) {
  const letters = LETTERS.slice(0, rows).split('');
  const classic = letters.slice(0, Math.min(classicRows, rows));
  const premium = letters.slice(classic.length, Math.min(classic.length + premiumRows, rows));
  const recliner = letters.slice(classic.length + premium.length);

  const classes = [];
  if (classic.length) classes.push({ name: 'Classic', rows: classic, priceMultiplier: 1 });
  if (premium.length) classes.push({ name: 'Premium', rows: premium, priceMultiplier: 1.4 });
  if (recliner.length) classes.push({ name: 'Recliner', rows: recliner, priceMultiplier: 2 });
  return classes;
}

export default function AdminTheaters() {
  const toast = useToast();
  const [theaters, setTheaters] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  const [theaterModal, setTheaterModal] = useState(null); // 'new' | theater
  const [theaterForm, setTheaterForm] = useState(BLANK_THEATER);
  const [screenModal, setScreenModal] = useState(null); // theater
  const [screenForm, setScreenForm] = useState(BLANK_SCREEN);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    setStatus({ loading: true, error: null });
    api.theaters
      .list()
      .then((data) => {
        setTheaters(data);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => setStatus({ loading: false, error: err }));
  }, []);

  useEffect(() => load(), [load]);

  const saveTheater = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const payload = {
      name: theaterForm.name,
      city: theaterForm.city,
      address: theaterForm.address,
      amenities: theaterForm.amenities.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (theaterModal === 'new') {
        await api.theaters.create({ ...payload, screens: [] });
        toast.success('Theater added');
      } else {
        await api.theaters.update(theaterModal.id, payload);
        toast.success('Theater updated');
      }
      setTheaterModal(null);
      load();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveScreen = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const rows = Number(screenForm.rows);
    try {
      await api.theaters.addScreen(screenModal.id, {
        name: screenForm.name,
        rows,
        seatsPerRow: Number(screenForm.seatsPerRow),
        format: screenForm.format,
        seatClasses: buildSeatClasses({
          rows,
          classicRows: Number(screenForm.classicRows),
          premiumRows: Number(screenForm.premiumRows),
        }),
      });
      toast.success('Screen added');
      setScreenModal(null);
      load();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async () => {
    setBusy(true);
    try {
      await confirm.action();
      toast.success(confirm.done);
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (status.loading) return <LoadingBlock />;
  if (status.error) return <ErrorState error={status.error} onRetry={load} />;

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2>Theaters ({theaters.length})</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              setTheaterForm(BLANK_THEATER);
              setErrors({});
              setTheaterModal('new');
            }}
          >
            Add theater
          </button>
        </div>

        <div className="theater-admin-grid">
          {theaters.map((t) => (
            <article className="theater-card" key={t.id}>
              <div className="panel__head">
                <div>
                  <h3>{t.name}</h3>
                  <p className="muted">
                    {t.city} &middot; {t.address}
                  </p>
                </div>
                <div className="cell-actions">
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => {
                      setTheaterForm({
                        name: t.name,
                        city: t.city,
                        address: t.address,
                        amenities: t.amenities.join(', '),
                      });
                      setErrors({});
                      setTheaterModal(t);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="linklike linklike--danger"
                    onClick={() =>
                      setConfirm({
                        title: `Delete ${t.name}?`,
                        message: 'Theaters with upcoming showtimes cannot be deleted.',
                        label: 'Delete theater',
                        done: 'Theater deleted',
                        action: () => api.theaters.remove(t.id),
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="chips">
                {t.amenities.map((a) => (
                  <Badge key={a}>{a}</Badge>
                ))}
              </div>

              <ul className="screen-list">
                {t.screens.map((s) => (
                  <li key={s.id}>
                    <span>
                      <strong>{s.name}</strong>
                      <em className="muted">
                        {' '}
                        {s.format} &middot; {s.rows}&times;{s.seatsPerRow} = {s.rows * s.seatsPerRow}{' '}
                        seats
                      </em>
                    </span>
                    <button
                      type="button"
                      className="linklike linklike--danger"
                      onClick={() =>
                        setConfirm({
                          title: `Delete screen ${s.name}?`,
                          message: 'Screens with upcoming showtimes cannot be deleted.',
                          label: 'Delete screen',
                          done: 'Screen deleted',
                          action: () => api.theaters.removeScreen(t.id, s.id),
                        })
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {t.screens.length === 0 && <li className="muted">No screens yet.</li>}
              </ul>

              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setScreenForm(BLANK_SCREEN);
                  setErrors({});
                  setScreenModal(t);
                }}
              >
                Add screen
              </button>
            </article>
          ))}
        </div>
      </section>

      <Modal
        open={Boolean(theaterModal)}
        title={theaterModal === 'new' ? 'Add a theater' : `Edit ${theaterModal?.name || ''}`}
        onClose={() => setTheaterModal(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setTheaterModal(null)}>
              Cancel
            </button>
            <button type="submit" form="theater-form" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving...' : 'Save theater'}
            </button>
          </>
        }
      >
        <form id="theater-form" onSubmit={saveTheater} className="form-grid">
          <Field label="Name" error={errors.name} htmlFor="t-name">
            <input
              id="t-name"
              required
              value={theaterForm.name}
              onChange={(e) => setTheaterForm({ ...theaterForm, name: e.target.value })}
            />
          </Field>
          <Field label="City" error={errors.city} htmlFor="t-city">
            <input
              id="t-city"
              required
              value={theaterForm.city}
              onChange={(e) => setTheaterForm({ ...theaterForm, city: e.target.value })}
            />
          </Field>
          <Field label="Address" error={errors.address} htmlFor="t-address">
            <input
              id="t-address"
              required
              value={theaterForm.address}
              onChange={(e) => setTheaterForm({ ...theaterForm, address: e.target.value })}
            />
          </Field>
          <Field label="Amenities" hint="Comma separated" error={errors.amenities} htmlFor="t-amenities">
            <input
              id="t-amenities"
              value={theaterForm.amenities}
              onChange={(e) => setTheaterForm({ ...theaterForm, amenities: e.target.value })}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(screenModal)}
        title={`Add a screen to ${screenModal?.name || ''}`}
        onClose={() => setScreenModal(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setScreenModal(null)}>
              Cancel
            </button>
            <button type="submit" form="screen-form" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving...' : 'Add screen'}
            </button>
          </>
        }
      >
        <form id="screen-form" onSubmit={saveScreen} className="form-grid">
          <Field label="Screen name" error={errors.name} htmlFor="s-name">
            <input
              id="s-name"
              required
              placeholder="Audi 4"
              value={screenForm.name}
              onChange={(e) => setScreenForm({ ...screenForm, name: e.target.value })}
            />
          </Field>

          <div className="form-row">
            <Field label="Rows" hint="2-20" error={errors.rows} htmlFor="s-rows">
              <input
                id="s-rows"
                type="number"
                min={2}
                max={20}
                required
                value={screenForm.rows}
                onChange={(e) => setScreenForm({ ...screenForm, rows: e.target.value })}
              />
            </Field>
            <Field label="Seats per row" hint="4-24" error={errors.seatsPerRow} htmlFor="s-seats">
              <input
                id="s-seats"
                type="number"
                min={4}
                max={24}
                required
                value={screenForm.seatsPerRow}
                onChange={(e) => setScreenForm({ ...screenForm, seatsPerRow: e.target.value })}
              />
            </Field>
            <Field label="Format" htmlFor="s-format">
              <select
                id="s-format"
                value={screenForm.format}
                onChange={(e) => setScreenForm({ ...screenForm, format: e.target.value })}
              >
                {['2D', '3D', 'IMAX', '4DX'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="form-row">
            <Field label="Classic rows" hint="1x price" htmlFor="s-classic">
              <input
                id="s-classic"
                type="number"
                min={0}
                max={Number(screenForm.rows)}
                value={screenForm.classicRows}
                onChange={(e) => setScreenForm({ ...screenForm, classicRows: e.target.value })}
              />
            </Field>
            <Field label="Premium rows" hint="1.4x price" htmlFor="s-premium">
              <input
                id="s-premium"
                type="number"
                min={0}
                max={Number(screenForm.rows)}
                value={screenForm.premiumRows}
                onChange={(e) => setScreenForm({ ...screenForm, premiumRows: e.target.value })}
              />
            </Field>
          </div>

          <p className="muted">
            Remaining rows become Recliner seats at 2x price.{' '}
            {errors.seatClasses && <span className="field__msg--error">{errors.seatClasses}</span>}
          </p>
        </form>
      </Modal>

      <Confirm
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        busy={busy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
