import { useEffect } from 'react';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="spinner" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}

export function LoadingBlock({ label = 'Loading...' }) {
  return (
    <div className="state-block">
      <Spinner />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ icon = '🎬', title, hint, action }) {
  return (
    <div className="state-block">
      <div className="state-block__icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state-block state-block--error">
      <div className="state-block__icon" aria-hidden="true">
        ⚠️
      </div>
      <h3>{error?.message || 'Something went wrong'}</h3>
      {error?.code && <p className="mono">{error.code}</p>}
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Stars({ value = 0, count }) {
  const rounded = Math.round(value);
  return (
    <span className="stars" title={`${value} out of 5`}>
      <span className="stars__glyphs" aria-hidden="true">
        {'★★★★★'.slice(0, rounded)}
        <span className="stars__empty">{'★★★★★'.slice(rounded)}</span>
      </span>
      <span className="stars__value">
        {value ? value.toFixed(1) : 'New'}
        {count ? ` (${count})` : ''}
      </span>
    </span>
  );
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <label className={`field ${error ? 'field--error' : ''}`} htmlFor={htmlFor}>
      <span className="field__label">{label}</span>
      {children}
      {error ? (
        <span className="field__msg field__msg--error">{error}</span>
      ) : (
        hint && <span className="field__msg">{hint}</span>
      )}
    </label>
  );
}

export function Modal({ open, title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={!meta.hasPrevPage}
        onClick={() => onPage(meta.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {meta.page} of {meta.totalPages}
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={!meta.hasNextPage}
        onClick={() => onPage(meta.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function Confirm({ open, title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onClose, busy }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
