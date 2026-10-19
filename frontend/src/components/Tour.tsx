import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import type { TKey } from '../i18n';
import './Tour.css';

/**
 * Guided help. Never starts by itself: the page shows a "Need help?" button and the tour runs
 * only when it is pressed. Each step points at a `data-tour="..."` element; steps whose target is
 * not on screen right now (an empty list, a collapsed menu) are skipped.
 *
 * Text comes from `tour_<page>_<n>_title` / `_body` keys, so every language has its own wording.
 */
export const TOURS = {
  dashboard: ['dash-stats', 'dash-next', 'dash-actions', 'nav-bell', 'nav-user'],
  myConferences: ['mc-create', 'mc-filters', 'mc-row-actions'],
  editor: ['ed-tabs', 'ed-status', 'ed-capacity', 'ed-map', 'ed-save'],
  attendees: ['at-tabs', 'at-checkin', 'at-tools', 'at-reminders'],
  checkIn: ['ci-pick', 'ci-scan', 'ci-manual', 'ci-recent'],
  analytics: ['an-range', 'an-trend', 'an-table'],
  settings: ['set-photo', 'set-tabs'],
  admin: ['adm-stats', 'adm-charts', 'nav-bell', 'adm-nav'],
  adminOrganizers: ['ao-filters', 'ao-actions'],
  conference: ['cd-register', 'cd-calendar', 'cd-agenda', 'cd-map'],
  ticket: ['tk-qr', 'tk-calendar', 'tk-cancel'],
} as const;

export type TourName = keyof typeof TOURS;

function visibleTarget(target: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function HelpButton({ tour }: { tour: TourName }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const steps = useMemo(() => TOURS[tour].map((target, i) => ({
    target,
    title: `tour_${tour}_${i + 1}_title` as TKey,
    body: `tour_${tour}_${i + 1}_body` as TKey,
  })), [tour]);
  // The button goes into the floating dock (outside the page) so it is always on screen.
  // undefined until looked up (render nothing for that first frame); null when there is no dock.
  const [dock, setDock] = useState<HTMLElement | null | undefined>(undefined);
  useEffect(() => { setDock(document.getElementById('fab-dock')); }, []);
  const pill = (
    <button type="button" className="help-pill" onClick={() => setOpen(true)} aria-label={t('tour_help_aria')}>
      <i className="fas fa-circle-question" aria-hidden="true" />
      <span>{t('tour_help')}</span>
    </button>
  );
  return (
    <>
      {dock ? createPortal(pill, dock) : dock === null ? pill : null}
      {open && <Spotlight steps={steps} onClose={() => setOpen(false)} />}
    </>
  );
}

function Spotlight({ steps, onClose }: { steps: { target: string; title: TKey; body: TKey }[]; onClose: () => void }) {
  const { t } = useApp();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const raf = useRef(0);

  // Decide once, when opened, which steps have something to point at.
  const [visible] = useState(() => {
    const list = steps.filter((s) => visibleTarget(s.target));
    return list.length ? list : steps.slice(0, 1);
  });
  const step = visible[index];

  const measure = useCallback(() => {
    const el = step ? visibleTarget(step.target) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    visibleTarget(step.target)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timers = [0, 120, 300, 600, 900].map((ms) => window.setTimeout(measure, ms));
    return () => timers.forEach(clearTimeout);
  }, [step, measure]);

  useEffect(() => {
    const onMove = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(visible.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf.current);
    };
  }, [measure, onClose, visible.length]);

  const last = index === visible.length - 1;
  const margin = 16;
  const width = Math.min(360, window.innerWidth - margin * 2);
  let box: CSSProperties;
  if (rect) {
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    const below = window.innerHeight - rect.bottom;
    if (below > 240) box = { top: rect.bottom + margin, left };
    else if (rect.top > 240) box = { bottom: window.innerHeight - rect.top + margin, left };
    else box = { bottom: margin, left };
  } else {
    box = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    <div className="tour">
      {rect && <div className="tour__hole" style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }} />}
      {!rect && <div className="tour__dim" />}
      <div className="tour__card" style={{ ...box, width }} role="dialog" aria-live="polite" aria-label={t(step.title)}>
        <div className="tour__dots">
          {visible.map((s, i) => <span key={s.target} className={i === index ? 'is-on' : ''} />)}
          <span className="tour__count">{index + 1} / {visible.length}</span>
        </div>
        <h3>{t(step.title)}</h3>
        <p>{t(step.body)}</p>
        <div className="tour__actions">
          <button className="btn btn--ghost btn--sm" onClick={onClose}>{t('tour_skip')}</button>
          <span className="spacer" />
          {index > 0 && <button className="btn btn--sm" onClick={() => setIndex((i) => i - 1)}>{t('tour_back')}</button>}
          <button className="btn btn--primary btn--sm" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>
            {last ? t('tour_done') : t('tour_next')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
