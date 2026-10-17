import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useApp } from '../context/AppContext';
import { daysUntil, formatDate, formatTime, monthShort, parseDay } from '../i18n/format';
import type { Conference } from '../types';
import { catColor, catMeta, coverGradient } from '../utils/categories';
import { Avatar, CapacityBar } from './ui';
import './ConferenceCard.css';

export function CategoryChip({ category }: { category: Conference['category'] }) {
  const { t } = useApp();
  const m = catMeta(category);
  return (
    <span className="chip chip--cat" style={{ '--cat': catColor(category) } as CSSProperties}>
      <i className={`fas fa-${m.icon}`} aria-hidden="true" /> {t(m.key)}
    </span>
  );
}

export function CountdownChip({ date }: { date: string }) {
  const { t } = useApp();
  const d = daysUntil(date);
  if (d < 0) return <span className="chip chip--warning"><i className="fas fa-clock-rotate-left" /> {t('status_past')}</span>;
  if (d === 0) return <span className="chip chip--success"><span className="live-dot" /> {t('today')}</span>;
  if (d === 1) return <span className="chip chip--accent"><i className="fas fa-bolt" /> {t('tomorrow')}</span>;
  if (d <= 60) return <span className="chip chip--accent"><i className="fas fa-hourglass-half" /> {t('in_days', { count: d })}</span>;
  return null;
}

export function DateBadge({ date }: { date: string }) {
  const { lang } = useApp();
  return (
    <div className="date-badge" aria-hidden="true">
      <span className="date-badge__m">{monthShort(date, lang)}</span>
      <span className="date-badge__d">{parseDay(date).getDate()}</span>
    </div>
  );
}

export default function ConferenceCard({ conf, compact }: { conf: Conference; compact?: boolean }) {
  const { t, lang } = useApp();
  const full = conf.max_attendees !== null && conf.attendee_count >= conf.max_attendees;
  const past = daysUntil(conf.date) < 0;
  return (
    <article className={`ccard card--hover${compact ? ' ccard--compact' : ''}`} style={{ '--cat': catColor(conf.category) } as CSSProperties}>
      <Link to={`/conferences/${conf.id}`} className="ccard__cover" aria-label={conf.title}
        style={conf.cover_image ? { backgroundImage: `url(${conf.cover_image})` } : { background: coverGradient(conf.category, conf.id) }}>
        {!conf.cover_image && <i className={`fas fa-${catMeta(conf.category).icon} ccard__glyph`} aria-hidden="true" />}
        <DateBadge date={conf.date} />
        <div className="ccard__flags">
          {conf.category && <CategoryChip category={conf.category} />}
          {full && !past && <span className="chip chip--warning"><i className="fas fa-hourglass-half" /> {t('waitlist_open')}</span>}
        </div>
      </Link>
      <div className="ccard__body">
        <div className="row" style={{ gap: 8 }}>
          <CountdownChip date={conf.date} />
          {conf.session_count > 0 && <span className="chip"><i className="fas fa-list-ol" /> {t('n_sessions', { count: conf.session_count })}</span>}
        </div>
        <h3 className="ccard__title"><Link to={`/conferences/${conf.id}`}>{conf.title}</Link></h3>
        {!compact && conf.description && <p className="ccard__desc">{conf.description}</p>}
        <ul className="ccard__meta">
          <li><i className="fas fa-calendar-day" aria-hidden="true" /> {formatDate(conf.date, lang, 'medium')}{conf.time && ` · ${formatTime(conf.time, lang)}`}</li>
          {conf.location && <li><i className="fas fa-location-dot" aria-hidden="true" /> {conf.location}</li>}
        </ul>
        {!past && <CapacityBar count={conf.attendee_count} max={conf.max_attendees} />}
        <div className="ccard__foot">
          <span className="ccard__org">
            <Avatar name={conf.organizer_name} src={conf.organizer_avatar} size={32} />
            <span>{conf.organizer_name}</span>
          </span>
          <Link to={`/conferences/${conf.id}`} className="btn btn--primary btn--sm">
            {past ? t('view_details') : full ? t('join_waitlist') : t('register_now')} <i className="fas fa-arrow-right" />
          </Link>
        </div>
      </div>
    </article>
  );
}
