import { useEffect, useId, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { formatNumber } from '../i18n/format';
import { avatarColor, initials } from '../utils/misc';

/* ── Avatar ─────────────────────────────────────────────────────────────── */
export function Avatar({ name, src, size = 40, className = '' }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { '--size': `${size}px`, '--avatar-bg': avatarColor(name) } as CSSProperties;
  return (
    <span className={`avatar ${className}`} style={style} aria-hidden="true">
      {src && !broken ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

/* ── Page header ────────────────────────────────────────────────────────── */
export function PageHead({ icon, title, subtitle, children, tour }: {
  icon: string; title: ReactNode; subtitle?: ReactNode; children?: ReactNode; tour?: string;
}) {
  return (
    <header className="page-head" data-tour={tour}>
      <div className="page-head__icon"><i className={`fas fa-${icon}`} aria-hidden="true" /></div>
      <div className="page-head__text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-head__actions">{children}</div>}
    </header>
  );
}

/* ── Animated number ────────────────────────────────────────────────────── */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const { lang } = useApp();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{formatNumber(shown, lang)}</>;
}

/* ── Stat tile ──────────────────────────────────────────────────────────── */
export function Stat({ icon, label, value, sub, tone, suffix }: {
  icon: string; label: ReactNode; value: number | null; sub?: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'indigo'; suffix?: string;
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <div className="stat__icon"><i className={`fas fa-${icon}`} aria-hidden="true" /></div>
      <div>
        <div className="stat__value">{value === null ? '–' : <><CountUp value={value} />{suffix}</>}</div>
        <div className="stat__label">{label}</div>
        {sub && <div className="stat__sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */
export function EmptyState({ icon, title, message, children }: { icon: string; title: ReactNode; message?: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon"><i className={`fas fa-${icon}`} aria-hidden="true" /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {children && <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>{children}</div>}
    </div>
  );
}

export function Skeleton({ h = 18, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function SkeletonCards({ count = 6, h = 260 }: { count?: number; h?: number }) {
  return (
    <div className="grid grid-3">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} h={h} r={16} />)}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <div className="center"><span className="spinner" role="status" aria-label={label} /></div>;
}

/* ── Pagination ─────────────────────────────────────────────────────────── */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const { t } = useApp();
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  return (
    <nav className="row" style={{ justifyContent: 'center', marginTop: 22 }} aria-label={t('pagination')}>
      <button className="btn btn--sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        <i className="fas fa-chevron-left" /> {t('previous')}
      </button>
      {nums.map((p, i) => (
        <span key={p} className="row" style={{ gap: 6 }}>
          {i > 0 && p - nums[i - 1] > 1 && <span className="muted">…</span>}
          <button className={`btn btn--sm${p === page ? ' btn--primary' : ''}`} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}>
            {p}
          </button>
        </span>
      ))}
      <button className="btn btn--sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        {t('next')} <i className="fas fa-chevron-right" />
      </button>
    </nav>
  );
}

/* ── Modal ──────────────────────────────────────────────────────────────── */
export function Modal({ title, icon, onClose, children, footer, size }: {
  title: ReactNode; icon?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'lg';
}) {
  const { t } = useApp();
  const boxRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // Escape closes the modal unless a dropdown inside it is open (it closes itself first).
      if (e.key === 'Escape' && !document.querySelector('.csel__list, .dp__pop')) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    boxRef.current?.querySelector<HTMLElement>('input, textarea, button.csel__btn')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className={`modal${size ? ` modal--${size}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__head">
          {icon && <i className={`fas fa-${icon}`} style={{ color: 'var(--accent)', fontSize: '1.2rem' }} aria-hidden="true" />}
          <h2 id={titleId}>{title}</h2>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label={t('close')}>
            <i className="fas fa-xmark" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({ title, message, confirmLabel, danger, busy, onConfirm, onCancel, children }: {
  title: ReactNode; message: ReactNode; confirmLabel: ReactNode; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onCancel: () => void; children?: ReactNode;
}) {
  const { t } = useApp();
  return (
    <Modal
      title={title}
      icon={danger ? 'triangle-exclamation' : 'circle-question'}
      onClose={onCancel}
      size="sm"
      footer={(
        <>
          <button className="btn btn--ghost" onClick={onCancel} disabled={busy}>{t('cancel')}</button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner" /> : confirmLabel}
          </button>
        </>
      )}
    >
      <p className="text-2" style={{ fontSize: '1.02rem' }}>{message}</p>
      {children}
    </Modal>
  );
}

/* ── Password field with show / hide ────────────────────────────────────── */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useApp();
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input {...props} type={show ? 'text' : 'password'} className={`input ${props.className ?? ''}`} />
      <button
        type="button"
        className="pw__eye"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t('hide_password') : t('show_password')}
        aria-pressed={show}
        title={show ? t('hide_password') : t('show_password')}
      >
        <i className={`fas fa-${show ? 'eye-slash' : 'eye'}`} />
      </button>
    </div>
  );
}

/* ── Field wrapper ──────────────────────────────────────────────────────── */
export function Field({ label, htmlFor, required, hint, children }: {
  label: ReactNode; htmlFor?: string; required?: boolean; hint?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ── Capacity bar ───────────────────────────────────────────────────────── */
export function CapacityBar({ count, max }: { count: number; max: number | null }) {
  const { t, lang } = useApp();
  if (!max) {
    return <span className="small muted"><i className="fas fa-infinity" /> {t('no_limit')}</span>;
  }
  const pct = Math.min(100, Math.round((count / max) * 100));
  return (
    <div style={{ width: '100%' }}>
      <div className="row row--between small" style={{ marginBottom: 5 }}>
        <span className="text-2">{t('seats_taken', { count: formatNumber(count, lang), max: formatNumber(max, lang) })}</span>
        <strong style={{ color: pct >= 100 ? 'var(--warning)' : 'var(--accent)' }}>{pct}%</strong>
      </div>
      <div className={`bar${pct >= 100 ? ' bar--warning' : ''}`}><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
