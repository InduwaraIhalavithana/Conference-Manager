import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { anchorVisible, placePopup } from '../utils/popover';
import { useApp } from '../context/AppContext';
import { formatDate, formatTime, monthNames, parseDay, toISODate, todayISO, weekdayNames } from '../i18n/format';
import CustomSelect, { type SelectOption } from './CustomSelect';
import './DatePicker.css';

interface Props {
  value: string; // yyyy-mm-dd or ''
  onChange: (value: string) => void;
  id?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  ariaLabel?: string;
}

/** Calendar picker in the reader's language, styled by the theme (the native one is neither). */
export default function DatePicker({ value, onChange, id, min, max, placeholder, clearable, ariaLabel }: Props) {
  const { lang, t } = useApp();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const initial = value ? parseDay(value) : parseDay(todayISO());
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    // Measure the calendar itself: months spanning six weeks are taller than five-week ones.
    const height = popRef.current?.scrollHeight || 410;
    setPos({ ...placePopup(btn, height, 320), overflowY: 'auto' });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const d = value ? parseDay(value) : parseDay(todayISO());
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }, [open, place, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // The year list is portaled too; clicks in it belong to this picker.
      if ((target as Element).closest?.('.csel__list')) return;
      if (!btnRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // Follow the field while it is on screen; close once it scrolls away.
    const onScroll = () => (anchorVisible(btnRef.current) ? place() : setOpen(false));
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  // A month change can change the calendar's height.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, view, place]);

  const weeks = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(view.y, view.m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [view]);

  const months = monthNames(lang);
  const days = weekdayNames(lang, 'short');
  const today = todayISO();
  const yearOptions: SelectOption[] = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, i) => String(now - 3 + i)).map((y) => ({ value: y, label: y }));
  }, []);

  const shift = (delta: number) => setView((v) => {
    const d = new Date(v.y, v.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const choose = (d: Date) => {
    onChange(toISODate(d));
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className="dp">
      <button
        ref={btnRef}
        id={id}
        type="button"
        className={`dp__btn${value ? '' : ' dp__btn--ph'}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <i className="fas fa-calendar-day" aria-hidden="true" />
        <span>{value ? formatDate(value, lang, 'medium') : placeholder ?? t('pick_date')}</span>
        {clearable && value && (
          <span
            className="dp__clear"
            role="button"
            tabIndex={0}
            aria-label={t('clear')}
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
          >
            <i className="fas fa-xmark" />
          </span>
        )}
      </button>
      {open && createPortal(
        <div ref={popRef} className="dp__pop" style={pos} role="dialog" aria-label={ariaLabel ?? t('pick_date')}>
          <div className="dp__head">
            <button type="button" className="dp__nav" onClick={() => shift(-1)} aria-label={t('previous_month')}>
              <i className="fas fa-chevron-left" />
            </button>
            <strong className="dp__month">{months[view.m]}</strong>
            <CustomSelect
              compact
              className="dp__year"
              value={String(view.y)}
              options={yearOptions}
              onChange={(y) => setView((v) => ({ ...v, y: Number(y) }))}
              ariaLabel={t('year')}
            />
            <button type="button" className="dp__nav" onClick={() => shift(1)} aria-label={t('next_month')}>
              <i className="fas fa-chevron-right" />
            </button>
          </div>
          <div className="dp__grid">
            {days.map((d) => <span key={d} className="dp__dow">{d}</span>)}
            {weeks.map((d) => {
              const iso = toISODate(d);
              const outside = d.getMonth() !== view.m;
              const disabled = (min && iso < min) || (max && iso > max);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={Boolean(disabled)}
                  className={`dp__day${outside ? ' dp__day--out' : ''}${iso === value ? ' dp__day--sel' : ''}${iso === today ? ' dp__day--today' : ''}`}
                  onClick={() => choose(d)}
                  aria-label={formatDate(iso, lang, 'long')}
                  aria-pressed={iso === value}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="dp__foot">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => choose(parseDay(today))} disabled={Boolean((min && today < min) || (max && today > max))}>
              {t('today')}
            </button>
            {clearable && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { onChange(''); setOpen(false); }}>
                {t('clear')}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Times every 15 minutes, labelled in the reader's language. Value is "HH:MM" or "". */
/** `after` (HH:MM) hides times up to and including it, e.g. end times before the start. */
export function TimeSelect({ value, onChange, id, allowEmpty = true, ariaLabel, after }: {
  value: string; onChange: (v: string) => void; id?: string; allowEmpty?: boolean; ariaLabel?: string; after?: string | null;
}) {
  const { lang, t } = useApp();
  const options = useMemo(() => {
    const list: SelectOption[] = allowEmpty ? [{ value: '', label: t('no_time') }] : [];
    for (let m = 6 * 60; m <= 23 * 60 + 45; m += 15) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const v = `${hh}:${mm}`;
      // Keep the current value listed even if it is now too early, so it still shows (saving explains why).
      if (after && v <= after.slice(0, 5) && v !== value.slice(0, 5)) continue;
      list.push({ value: v, label: formatTime(v, lang) });
    }
    return list;
  }, [lang, t, allowEmpty, after, value]);
  return <CustomSelect id={id} value={value} options={options} onChange={onChange} icon="clock" ariaLabel={ariaLabel} placeholder={t('no_time')} />;
}
