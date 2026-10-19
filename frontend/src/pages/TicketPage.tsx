import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { usePageTitle } from '../hooks';
import { daysUntil, formatDate, formatDateTime, formatTime } from '../i18n/format';
import { api } from '../services/api';
import type { Ticket } from '../types';
import { catColor, coverGradient } from '../utils/categories';
import { errorMessage } from '../utils/errors';
import AddToCalendar from '../components/AddToCalendar';
import CheckInbox from '../components/CheckInbox';
import CodeEntry from '../components/CodeEntry';
import { QRCode } from '../components/QR';
import { HelpButton } from '../components/Tour';
import { ConfirmModal, EmptyState, Spinner } from '../components/ui';
import './TicketPage.css';

/** The attendee's ticket. The code in the link is their key: QR for the door, calendar, cancel. */
export default function TicketPage() {
  const { code } = useParams();
  const { t, lang } = useApp();
  usePageTitle('ticket_title');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [missing, setMissing] = useState(false);
  // What the cancelled ticket was: a seat or a place on the waitlist (the wording differs).
  const [cancelled, setCancelled] = useState<'seat' | 'waitlist' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.ticket(code!).then(setTicket).catch(() => setMissing(true));
  }, [code]);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelTicket(code!);
      setCancelled(ticket?.attendee.status === 'waitlisted' ? 'waitlist' : 'seat');
      setConfirm(false);
      toast.success(t('ticket_cancelled'));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (cancelled || missing) {
    return (
      <div className="container page">
        <EmptyState page icon={cancelled ? 'circle-check' : 'ticket'} title={cancelled ? t('ticket_cancelled') : t('ticket_not_found')}
          message={cancelled === 'waitlist' ? t('ticket_left_waitlist_body') : cancelled ? t('ticket_cancelled_body') : t('ticket_not_found_body')}>
          <Link to="/conferences" className="btn btn--primary"><i className="fas fa-compass" /> {t('browse_conferences')}</Link>
        </EmptyState>
      </div>
    );
  }
  if (!ticket) return <Spinner />;

  const { attendee: a, conference: c } = ticket;
  const past = daysUntil(c.date) < 0;
  const waiting = a.status === 'waitlisted';
  const pending = !a.confirmed_at;

  return (
    <div className="container page">
      <div className="ticket" style={{ '--cat': catColor(c.category) } as CSSProperties}>
        <div className="ticket__top" style={c.cover_image ? { backgroundImage: `url(${c.cover_image})` } : { background: coverGradient(c.category, c.id) }}>
          <div className="ticket__shade" />
          <div className="ticket__head">
            {pending ? (
              <span className="chip chip--warning"><i className="fas fa-envelope" /> {t('ticket_unconfirmed')}</span>
            ) : (
              <span className={`chip ${waiting ? 'chip--warning' : a.checked_in_at ? 'chip--success' : 'chip--accent'}`}>
                <i className={`fas fa-${waiting ? 'hourglass-half' : a.checked_in_at ? 'circle-check' : 'ticket'}`} />
                {waiting ? t('ticket_waitlisted', { position: a.waitlist_position ?? 1 }) : a.checked_in_at ? t('ticket_checked_in') : t('ticket_confirmed')}
              </span>
            )}
            <h1>{c.title}</h1>
            <p>{t('ticket_for', { name: a.name })}</p>
          </div>
        </div>
        <div className="ticket__body">
          <div className="ticket__qr" data-tour="tk-qr">
            {pending ? (
              <CheckInbox title={t('ticket_unconfirmed')}
                body={t(waiting ? 'ticket_unconfirmed_wait_body' : 'ticket_unconfirmed_body',
                  { email: a.email, time: a.hold_expires_at ? formatDateTime(a.hold_expires_at, lang) : '' })}
                onResend={() => api.resendTicketConfirmation(a.ticket_code!)}>
                <CodeEntry onSubmit={async (entered) => {
                  const confirmed = await api.confirmTicket(a.ticket_code!, entered);
                  setTicket(confirmed);
                  toast.success(confirmed.attendee.status === 'waitlisted' ? t('ticket_confirmed_wait_toast') : t('ticket_confirmed_toast'));
                }} />
              </CheckInbox>
            ) : waiting ? (
              <div className="ticket__wait"><i className="fas fa-hourglass-half" /><span>{t('ticket_qr_after_waitlist')}</span></div>
            ) : <QRCode value={`${window.location.origin}/tickets/${a.ticket_code}`} size={230} />}
            <code className="ticket-code">{a.ticket_code}</code>
            <span className="hint">{t('ticket_show_at_door')}</span>
          </div>
          <div className="ticket__info">
            <dl>
              <div><dt><i className="fas fa-calendar-day" /> {t('field_date')}</dt><dd>{formatDate(c.date, lang, 'long')}</dd></div>
              {c.time && <div><dt><i className="fas fa-clock" /> {t('field_time')}</dt><dd>{formatTime(c.time, lang)}{c.end_time && ` – ${formatTime(c.end_time, lang)}`}</dd></div>}
              {c.location && <div><dt><i className="fas fa-location-dot" /> {t('venue')}</dt><dd>{c.location}</dd></div>}
              <div><dt><i className="fas fa-user" /> {t('field_name')}</dt><dd>{a.name}</dd></div>
              <div><dt><i className="fas fa-envelope" /> {t('field_email')}</dt><dd>{a.email}</dd></div>
              <div><dt><i className="fas fa-clock-rotate-left" /> {t('registered_on')}</dt><dd>{formatDateTime(a.registered_at, lang)}</dd></div>
            </dl>
            <div className="row">
              <AddToCalendar conf={c} tour="tk-calendar" />
              <Link to={`/conferences/${c.id}`} className="btn"><i className="fas fa-circle-info" /> {t('view_details')}</Link>
              <button className="btn" onClick={() => window.print()}><i className="fas fa-print" /> {t('print')}</button>
            </div>
            {!past && !a.checked_in_at && (
              <button className="btn btn--danger btn--sm ticket__cancel" onClick={() => setConfirm(true)} data-tour="tk-cancel">
                <i className="fas fa-ban" /> {t('cancel_registration')}
              </button>
            )}
          </div>
        </div>
      </div>
      {confirm && (
        <ConfirmModal danger title={t('cancel_registration')} message={t(waiting ? 'cancel_waitlist_body' : 'cancel_registration_body', { title: c.title })}
          confirmLabel={t('cancel_registration')} busy={busy} onConfirm={cancel} onCancel={() => setConfirm(false)} />
      )}
      <HelpButton tour="ticket" />
    </div>
  );
}
