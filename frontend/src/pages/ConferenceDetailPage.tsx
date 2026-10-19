import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { usePageTitle } from '../hooks';
import { daysUntil, formatDate, formatTime } from '../i18n/format';
import { api, ApiError } from '../services/api';
import type { Attendee, ConferenceDetails, Organizer } from '../types';
import { KIND_META } from '../utils/sessions';
import { catColor, catMeta, coverGradient } from '../utils/categories';
import { errorMessage } from '../utils/errors';
import { mapsSearchUrl } from '../utils/misc';
import AddToCalendar from '../components/AddToCalendar';
import ConferenceCard, { CategoryChip, CountdownChip } from '../components/ConferenceCard';
import CheckInbox from '../components/CheckInbox';
import CodeEntry from '../components/CodeEntry';
import { QRCode } from '../components/QR';
import { HelpButton } from '../components/Tour';
import { Avatar, CapacityBar, EmptyState, Field, Skeleton } from '../components/ui';
import './ConferenceDetailPage.css';

const VenueMap = lazy(() => import('../components/VenueMap'));

export default function ConferenceDetailPage() {
  const { id } = useParams();
  const { t, lang, role, user } = useApp();
  const [data, setData] = useState<ConferenceDetails | null>(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // After registering: the new (unconfirmed) registration, or null when we only resent the link.
  const [done, setDone] = useState<{ attendee: Attendee | null; email: string } | null>(null);
  usePageTitle('nav_conferences', data?.conference.title);

  useEffect(() => {
    let alive = true;
    setData(null);
    setMissing(false);
    setDone(null);
    api.conferenceDetails(id!)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [id]);

  const speakersById = useMemo(() => new Map((data?.speakers ?? []).map((s) => [s.id, s])), [data]);

  if (missing) {
    return (
      <div className="container page">
        <EmptyState icon="calendar-xmark" title={t('conf_not_found')} message={t('conf_not_found_body')}>
          <Link to="/conferences" className="btn btn--primary"><i className="fas fa-arrow-left" /> {t('browse_conferences')}</Link>
        </EmptyState>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container page">
        <Skeleton h={320} r={22} />
        <div className="grid-main-side" style={{ marginTop: 22 }}>
          <Skeleton h={420} r={16} />
          <Skeleton h={360} r={16} />
        </div>
      </div>
    );
  }

  const c = data.conference;
  const past = daysUntil(c.date) < 0;
  const full = c.max_attendees !== null && c.attendee_count >= c.max_attendees;
  const isOwner = role === 'organizer' && (user as Organizer | null)?.id === c.organizer_id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const email = form.email.trim();
      const res = await api.registerAttendee(c.id, { name: form.name.trim(), email, lang });
      if ('code' in res) {
        setDone({ attendee: null, email });
        return;
      }
      const a = res;
      setDone({ attendee: a, email });
      setData((d) => d && {
        ...d,
        conference: {
          ...d.conference,
          attendee_count: d.conference.attendee_count + (a.status === 'registered' ? 1 : 0),
          waitlist_count: d.conference.waitlist_count + (a.status === 'waitlisted' ? 1 : 0),
        },
      });
      toast.success(t('reg_confirm_title'));
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'already_registered' ? t('err_already_registered') : errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: c.title, url });
      else { await navigator.clipboard.writeText(url); toast.success(t('link_copied')); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="cd" style={{ '--cat': catColor(c.category) } as CSSProperties}>
      <section className="cd-hero" style={c.cover_image ? { backgroundImage: `url(${c.cover_image})` } : { background: coverGradient(c.category, c.id) }}>
        {!c.cover_image && <i className={`fas fa-${catMeta(c.category).icon} cd-hero__glyph`} aria-hidden="true" />}
        <div className="cd-hero__shade" />
        <div className="container cd-hero__content">
          <Link to="/conferences" className="cd-back"><i className="fas fa-arrow-left" /> {t('all_conferences')}</Link>
          <div className="row" style={{ gap: 8 }}>
            {c.category && <CategoryChip category={c.category} />}
            <CountdownChip date={c.date} />
            {full && !past && <span className="chip chip--warning"><i className="fas fa-hourglass-half" /> {t('waitlist_open')}</span>}
          </div>
          <h1>{c.title}</h1>
          <ul className="cd-hero__meta">
            <li><i className="fas fa-calendar-day" /> {formatDate(c.date, lang, 'long')}</li>
            {c.time && <li><i className="fas fa-clock" /> {formatTime(c.time, lang)}{c.end_time && ` – ${formatTime(c.end_time, lang)}`}</li>}
            {c.location && <li><i className="fas fa-location-dot" /> {c.location}</li>}
          </ul>
          <div className="row">
            <AddToCalendar conf={c} tour="cd-calendar" />
            <button className="btn" onClick={share}><i className="fas fa-share-nodes" /> {t('share')}</button>
            {isOwner && <Link to={`/my-conferences/${c.id}/edit`} className="btn"><i className="fas fa-pen" /> {t('edit')}</Link>}
          </div>
        </div>
      </section>

      <div className="container page">
        <div className="grid-main-side">
          <div className="stack" style={{ gap: 22 }}>
            <section className="card">
              <h2 className="card__title"><i className="fas fa-circle-info" /> {t('about_event')}</h2>
              <p className="cd-desc">{c.description || t('no_description')}</p>
              <div className="cd-facts">
                <div><i className="fas fa-users" /><strong>{c.attendee_count}</strong><span>{t('registered')}</span></div>
                <div><i className="fas fa-chair" /><strong>{c.max_attendees ?? '∞'}</strong><span>{t('seats')}</span></div>
                <div><i className="fas fa-list-ol" /><strong>{data.sessions.length}</strong><span>{t('sessions')}</span></div>
                <div><i className="fas fa-microphone" /><strong>{data.speakers.length}</strong><span>{t('speakers')}</span></div>
              </div>
            </section>

            <section className="card" data-tour="cd-agenda">
              <h2 className="card__title"><i className="fas fa-list-ol" /> {t('agenda')}</h2>
              {data.sessions.length === 0 ? <p className="muted">{t('agenda_empty')}</p> : (
                <ol className="agenda">
                  {data.sessions.map((s) => {
                    const sp = s.speaker_id ? speakersById.get(s.speaker_id) : undefined;
                    const k = KIND_META[s.kind] ?? KIND_META.talk;
                    return (
                      <li key={s.id} className={`agenda__item agenda__item--${s.kind}`}>
                        <div className="agenda__time">
                          <strong>{formatTime(s.start_time, lang)}</strong>
                          {s.end_time && <span>{formatTime(s.end_time, lang)}</span>}
                        </div>
                        <div className="agenda__dot"><i className={`fas fa-${k.icon}`} /></div>
                        <div className="agenda__body">
                          <div className="row" style={{ gap: 8 }}>
                            <span className="chip chip--accent">{t(k.key)}</span>
                            {s.room && <span className="chip"><i className="fas fa-door-open" /> {s.room}</span>}
                          </div>
                          <h3>{s.title}</h3>
                          {s.description && <p className="text-2">{s.description}</p>}
                          {sp && (
                            <a href={`#speaker-${sp.id}`} className="agenda__speaker">
                              <Avatar name={sp.name} src={sp.photo} size={30} /> {sp.name}
                              {sp.job_title && <span className="muted"> · {sp.job_title}</span>}
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {data.speakers.length > 0 && (
              <section className="card">
                <h2 className="card__title"><i className="fas fa-microphone" /> {t('speakers')}</h2>
                <div className="speakers stagger">
                  {data.speakers.map((s) => (
                    <article key={s.id} id={`speaker-${s.id}`} className="speaker card--hover">
                      <Avatar name={s.name} src={s.photo} size={84} />
                      <div>
                        <h3>{s.name}</h3>
                        <p className="speaker__role">{[s.job_title, s.organization].filter(Boolean).join(' · ')}</p>
                        {s.bio && <p className="text-2 small">{s.bio}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="card" data-tour="cd-map">
              <h2 className="card__title"><i className="fas fa-map-location-dot" /> {t('venue')}</h2>
              <p className="text-2" style={{ marginBottom: 12 }}><i className="fas fa-location-dot" style={{ color: '#e11d48' }} /> {c.location || t('venue_tba')}</p>
              {c.venue_lat !== null && c.venue_lng !== null ? (
                <Suspense fallback={<Skeleton h={300} r={14} />}>
                  <VenueMap lat={c.venue_lat} lng={c.venue_lng} />
                </Suspense>
              ) : <p className="muted small">{t('venue_no_map')}</p>}
              {c.location && (
                <a className="btn btn--sm" style={{ marginTop: 12 }} href={mapsSearchUrl(c.location, c.venue_lat, c.venue_lng)} target="_blank" rel="noopener noreferrer">
                  <i className="fas fa-diamond-turn-right" /> {t('open_in_maps')}
                </a>
              )}
            </section>
          </div>

          <aside className="cd-side">
            <section className="card cd-reg" data-tour="cd-register">
              {done ? (
                <RegisteredPanel confId={c.id} attendee={done.attendee} email={done.email} />
              ) : (
                <>
                  <h2 className="card__title"><i className="fas fa-ticket" /> {past ? t('registration_closed') : full ? t('join_waitlist') : t('register_to_attend')}</h2>
                  {!past && <CapacityBar count={c.attendee_count} max={c.max_attendees} />}
                  {full && !past && (
                    <div className="alert alert--warning" style={{ marginTop: 12 }}>
                      <i className="fas fa-hourglass-half" /> <span>{t('full_waitlist_note', { count: c.waitlist_count })}</span>
                    </div>
                  )}
                  {past ? (
                    <p className="text-2" style={{ marginTop: 10 }}>{t('registration_closed_body')}</p>
                  ) : (
                    <form className="form" style={{ marginTop: 16 }} onSubmit={submit}>
                      <Field label={t('your_name')} htmlFor="reg-name" required>
                        <input id="reg-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={160} autoComplete="name" />
                      </Field>
                      <Field label={t('your_email')} htmlFor="reg-email" required hint={t('reg_email_hint')}>
                        <input id="reg-email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
                      </Field>
                      {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
                      <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
                        {busy ? <span className="spinner" /> : <><i className={`fas fa-${full ? 'hourglass-half' : 'check'}`} /> {full ? t('join_waitlist') : t('register_now')}</>}
                      </button>
                      <p className="hint"><i className="fas fa-lock" /> {t('reg_privacy')}</p>
                    </form>
                  )}
                </>
              )}
            </section>

            <section className="card cd-org">
              <h2 className="card__title"><i className="fas fa-user-tie" /> {t('organized_by')}</h2>
              <div className="row">
                <Avatar name={c.organizer_name} src={c.organizer_avatar} size={58} />
                <div>
                  <strong>{c.organizer_name}</strong>
                  {c.organizer_organization && <div className="text-2 small">{c.organizer_organization}</div>}
                </div>
              </div>
            </section>
          </aside>
        </div>

        {data.related && data.related.length > 0 && (
          <section style={{ marginTop: 34 }}>
            <h2 style={{ marginBottom: 16 }}>{t('related_conferences')}</h2>
            <div className="grid grid-3">
              {data.related.map((r) => <ConferenceCard key={r.id} conf={r} compact />)}
            </div>
          </section>
        )}
      </div>
      <HelpButton tour="conference" />
    </div>
  );
}

/** Shown after registering: the ticket only works once the emailed code is entered. */
function RegisteredPanel({ confId, attendee: a, email }: { confId: number; attendee: Attendee | null; email: string }) {
  const { t } = useApp();
  const [ticket, setTicket] = useState<Attendee | null>(null);

  if (ticket) {
    const waiting = ticket.status === 'waitlisted';
    return (
      <div className="cd-done">
        <div className={`cd-done__icon${waiting ? ' is-wait' : ''}`}>
          <i className={`fas fa-${waiting ? 'hourglass-half' : 'circle-check'}`} />
        </div>
        <h2>{waiting ? t('wait_success_title') : t('reg_success_title')}</h2>
        <p className="text-2">{waiting ? t('wait_success_body', { position: ticket.waitlist_position ?? 1 }) : t('reg_success_body')}</p>
        {!waiting && <div className="cd-done__qr"><QRCode value={`${window.location.origin}/tickets/${ticket.ticket_code}`} size={190} /></div>}
        <code className="ticket-code">{ticket.ticket_code}</code>
        <Link to={`/tickets/${ticket.ticket_code}`} className="btn btn--primary btn--block"><i className="fas fa-ticket" /> {t('open_my_ticket')}</Link>
        <p className="hint">{t('ticket_keep_link')}</p>
      </div>
    );
  }

  const hours = a?.hold_expires_at ? Math.round((Date.parse(a.hold_expires_at) - Date.parse(a.registered_at)) / 3_600_000) : 24;
  const body = !a ? t('reg_resent_body', { email })
    : a.status === 'waitlisted' ? t('wait_confirm_body', { position: a.waitlist_position ?? 1, email })
    : t('reg_confirm_body', { email, hours });
  return (
    <CheckInbox title={t('reg_confirm_title')} body={body}
      onResend={a?.ticket_code ? () => api.resendTicketConfirmation(a.ticket_code!) : undefined}>
      <CodeEntry onSubmit={async (code) => {
        const res = await api.confirmRegistration(confId, email, code);
        setTicket(res.attendee);
        toast.success(t('ticket_confirmed_toast'));
      }} />
    </CheckInbox>
  );
}
