import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { Conference } from '../types';
import { googleCalendarUrl } from '../utils/misc';
import { anchorVisible, placePopup } from '../utils/popover';
import './AddToCalendar.css';

/**
 * "Add to calendar" with Google Calendar and a downloadable .ics file (Outlook, Apple, others).
 * The menu is portaled to <body>: on the conference page the button sits in a banner that clips overflow.
 */
export default function AddToCalendar({ conf, tour }: { conf: Conference; tour?: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    if (btnRef.current) setPos(placePopup(btnRef.current, menuRef.current?.scrollHeight || 120, 290));
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onScroll = () => (anchorVisible(btnRef.current) ? place() : setOpen(false));
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  return (
    <div className="atc" data-tour={tour}>
      <button ref={btnRef} type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <i className="fas fa-calendar-plus" /> {t('add_to_calendar')} <i className="fas fa-chevron-down" style={{ fontSize: '0.75rem' }} />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="atc__menu" role="menu" style={pos}>
          <a role="menuitem" href={googleCalendarUrl(conf)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <i className="fab fa-google" /> {t('calendar_google')}
          </a>
          <a role="menuitem" href={api.calendarUrl(conf.id)} download onClick={() => setOpen(false)}>
            <i className="fas fa-file-arrow-down" /> {t('calendar_ics')}
          </a>
        </div>,
        document.body,
      )}
    </div>
  );
}
