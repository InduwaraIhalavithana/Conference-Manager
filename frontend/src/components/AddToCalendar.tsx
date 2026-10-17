import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { Conference } from '../types';
import { googleCalendarUrl } from '../utils/misc';

/** "Add to calendar" with Google Calendar and a downloadable .ics file (Outlook, Apple, others). */
export default function AddToCalendar({ conf, tour }: { conf: Conference; tour?: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div className="atc" ref={ref} data-tour={tour}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <i className="fas fa-calendar-plus" /> {t('add_to_calendar')} <i className="fas fa-chevron-down" style={{ fontSize: '0.75rem' }} />
      </button>
      {open && (
        <div className="atc__menu" role="menu">
          <a role="menuitem" href={googleCalendarUrl(conf)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <i className="fab fa-google" /> {t('calendar_google')}
          </a>
          <a role="menuitem" href={api.calendarUrl(conf.id)} download onClick={() => setOpen(false)}>
            <i className="fas fa-file-arrow-down" /> {t('calendar_ics')}
          </a>
        </div>
      )}
    </div>
  );
}
