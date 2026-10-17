import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { hasKey, type TKey } from '../../i18n';
import { daysUntil, formatDate, formatTime, relativeTime } from '../../i18n/format';
import { api } from '../../services/api';
import type { Conference, Organizer, OrganizerAnalytics, OrganizerOverview } from '../../types';
import { catColor, coverGradient } from '../../utils/categories';
import { errorMessage } from '../../utils/errors';
import { AreaChart } from '../../components/Charts';
import { CountdownChip } from '../../components/ConferenceCard';
import { HelpButton } from '../../components/Tour';
import { Avatar, CapacityBar, EmptyState, Skeleton, Stat } from '../../components/ui';
import { activityIcon } from './activity';
import './Organizer.css';

function greetingKey(): TKey {
  const h = new Date().getHours();
  return h < 12 ? 'greet_morning' : h < 17 ? 'greet_afternoon' : 'greet_evening';
}

export default function DashboardPage() {
  const { t, lang, user } = useApp();
  const me = user as Organizer;
  usePageTitle('nav_my_dashboard');
  const [upcoming, setUpcoming] = useState<Conference[] | null>(null);
  const [overview, setOverview] = useState<OrganizerOverview | null>(null);
  const [stats, setStats] = useState<OrganizerAnalytics | null>(null);
  const [reminding, setReminding] = useState(false);

  useEffect(() => {
    api.myConferences({ when: 'upcoming', per_page: 50 }).then((r) => setUpcoming(r.items)).catch(() => setUpcoming([]));
    api.overview().then(setOverview).catch(() => {});
    api.analytics(30).then(setStats).catch(() => {});
  }, []);

  const next = upcoming?.find((c) => c.status === 'published') ?? upcoming?.[0];
  const totals = stats?.totals;

  const remind = async (c: Conference) => {
    setReminding(true);
    try {
      const r = await api.sendReminders(c.id);
      toast.success(r.email_enabled ? t('reminders_sent', { count: r.sent }) : t('reminders_logged', { count: r.sent }));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setReminding(false);
    }
  };

  const checklist = [
    { done: Boolean(me.avatar), label: t('check_photo'), to: '/settings' },
    { done: (totals?.conferences ?? 0) > 0, label: t('check_first_conf'), to: '/my-conferences/new' },
    { done: (upcoming ?? []).some((c) => c.session_count > 0), label: t('check_agenda'), to: next ? `/my-conferences/${next.id}/edit?tab=agenda` : '/my-conferences' },
    { done: (totals?.registered ?? 0) > 0, label: t('check_first_attendee'), to: next ? `/conferences/${next.id}` : '/my-conferences' },
  ];
  const checklistDone = checklist.filter((c) => c.done).length;

  return (
    <div className="container page">
      <section className="dash-hero">
        <Avatar name={`${me.first_name} ${me.last_name}`} src={me.avatar} size={74} />
        <div className="dash-hero__text">
          <span className="muted">{formatDate(new Date(), lang, 'long')}</span>
          <h1>{t(greetingKey(), { name: me.first_name })}</h1>
          <p>{upcoming && upcoming.length > 0 ? t('dash_sub_upcoming', { count: upcoming.length }) : t('dash_sub_empty')}</p>
        </div>
        <div className="dash-hero__actions">
          <Link to="/my-conferences/new" className="btn btn--primary btn--lg"><i className="fas fa-plus" /> {t('new_conference')}</Link>
          <Link to="/check-in" className="btn btn--lg"><i className="fas fa-qrcode" /> {t('nav_check_in')}</Link>
        </div>
      </section>

      <div className="grid grid-4 dash-stats stagger" data-tour="dash-stats">
        <Stat icon="calendar-check" label={t('stat_my_conferences')} value={totals?.conferences ?? null} sub={totals ? t('n_upcoming_past', { up: totals.upcoming, past: totals.past }) : undefined} />
        <Stat icon="users" label={t('stat_registered')} value={totals?.registered ?? null} sub={totals ? t('n_last_30', { count: totals.registrations_in_period }) : undefined} tone="indigo" />
        <Stat icon="hourglass-half" label={t('stat_waitlisted')} value={totals?.waitlisted ?? null} tone="warning" />
        <Stat icon="qrcode" label={t('stat_checked_in')} value={totals?.checked_in ?? null} sub={totals?.checkin_rate != null ? t('checkin_rate_sub', { rate: totals.checkin_rate }) : undefined} tone="success" />
      </div>

      {totals && checklistDone < checklist.length && (
        <section className="card dash-checklist">
          <div className="row row--between">
            <h2 className="card__title" style={{ margin: 0 }}><i className="fas fa-list-check" /> {t('getting_started')}</h2>
            <span className="chip chip--accent">{checklistDone} / {checklist.length}</span>
          </div>
          <div className="bar" style={{ margin: '12px 0 14px' }}><span style={{ width: `${(checklistDone / checklist.length) * 100}%` }} /></div>
          <div className="dash-checklist__items">
            {checklist.map((c) => (
              <Link key={c.label} to={c.to} className={`dash-check${c.done ? ' is-done' : ''}`}>
                <i className={`fas fa-${c.done ? 'circle-check' : 'circle'}`} /> {c.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="dash-row">
        <section className="card dash-row__wide">
          <div className="card__title"><i className="fas fa-chart-area" /> {t('registrations_14')}<span className="spacer" />
            <Link to="/analytics" className="btn btn--sm btn--ghost">{t('nav_analytics')} <i className="fas fa-arrow-right" /></Link>
          </div>
          {overview ? (
            <AreaChart
              labels={overview.trend.map((d) => formatDate(d.date, lang, 'month-day'))}
              series={[{ label: t('registrations'), color: 'var(--accent-strong)', values: overview.trend.map((d) => d.count) }]}
              empty={t('chart_empty')}
            />
          ) : <Skeleton h={240} />}
        </section>

        <section className="card dash-next" data-tour="dash-next">
          {!upcoming ? <Skeleton h={300} /> : next ? (
            <div style={{ '--cat': catColor(next.category) } as CSSProperties} className="dash-next__inner">
              <div className="dash-next__cover" style={next.cover_image ? { backgroundImage: `url(${next.cover_image})` } : { background: coverGradient(next.category, next.id) }}>
                <span className="chip chip--success"><i className="fas fa-forward" /> {t('next_event')}</span>
              </div>
              <div className="dash-next__days">
                <strong>{Math.max(0, daysUntil(next.date))}</strong>
                <span>{t('days_to_go')}</span>
              </div>
              <h3>{next.title}</h3>
              <p className="text-2 small"><i className="fas fa-calendar-day" /> {formatDate(next.date, lang, 'long')}{next.time && ` · ${formatTime(next.time, lang)}`}</p>
              <CapacityBar count={next.attendee_count} max={next.max_attendees} />
              <div className="dash-next__actions">
                <Link to={`/attendees/${next.id}`} className="btn btn--sm"><i className="fas fa-users" /> {t('attendees')}</Link>
                <Link to={`/check-in/${next.id}`} className="btn btn--sm"><i className="fas fa-qrcode" /> {t('nav_check_in')}</Link>
                <button className="btn btn--sm" onClick={() => remind(next)} disabled={reminding || next.attendee_count === 0}>
                  {reminding ? <span className="spinner" /> : <i className="fas fa-bell" />} {t('send_reminders')}
                </button>
              </div>
            </div>
          ) : (
            <EmptyState icon="calendar-plus" title={t('no_upcoming_title')} message={t('no_upcoming_body')}>
              <Link to="/my-conferences/new" className="btn btn--primary"><i className="fas fa-plus" /> {t('new_conference')}</Link>
            </EmptyState>
          )}
        </section>
      </div>

      <div className="dash-row">
        <section className="card dash-row__wide">
          <div className="card__title"><i className="fas fa-calendar-days" /> {t('upcoming_conferences')}<span className="spacer" />
            <Link to="/my-conferences" className="btn btn--sm btn--ghost">{t('manage_all')} <i className="fas fa-arrow-right" /></Link>
          </div>
          {!upcoming ? <Skeleton h={200} /> : upcoming.length === 0 ? <p className="muted">{t('no_upcoming_body')}</p> : (
            <div className="dash-list">
              {upcoming.slice(0, 6).map((c) => (
                <div key={c.id} className="dash-list__row" style={{ '--cat': catColor(c.category) } as CSSProperties}>
                  <div className="dash-list__bar" />
                  <div className="dash-list__info">
                    <div className="row" style={{ gap: 8 }}>
                      <Link to={`/my-conferences/${c.id}/edit`} className="dash-list__title">{c.title}</Link>
                      {c.status === 'draft' && <span className="chip chip--warning"><i className="fas fa-pen-ruler" /> {t('status_draft')}</span>}
                      <CountdownChip date={c.date} />
                    </div>
                    <span className="small text-2"><i className="fas fa-calendar-day" /> {formatDate(c.date, lang, 'medium')}{c.location && ` · ${c.location}`}</span>
                  </div>
                  <div className="dash-list__cap"><CapacityBar count={c.attendee_count} max={c.max_attendees} /></div>
                  <div className="dash-list__actions">
                    {c.waitlist_count > 0 && <span className="chip chip--warning" title={t('stat_waitlisted')}><i className="fas fa-hourglass-half" /> {c.waitlist_count}</span>}
                    <Link to={`/attendees/${c.id}`} className="btn btn--sm btn--icon" title={t('attendees')} aria-label={t('attendees')}><i className="fas fa-users" /></Link>
                    <Link to={`/my-conferences/${c.id}/edit`} className="btn btn--sm btn--icon" title={t('edit')} aria-label={t('edit')}><i className="fas fa-pen" /></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card dash-activity">
          <div className="card__title"><i className="fas fa-wave-square" /> {t('recent_activity')}</div>
          {!overview ? <Skeleton h={200} /> : overview.activity.length === 0 ? <p className="muted">{t('activity_empty')}</p> : (
            <ul className="feed">
              {overview.activity.map((a, i) => (
                <li key={i} className="feed__item" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="feed__icon"><i className={`fas fa-${activityIcon(a.action)}`} /></span>
                  <span className="feed__text">
                    <strong>{hasKey(`act_${a.action}`) ? t(`act_${a.action}` as TKey) : a.action}</strong>
                    {a.target && <span className="muted"> · {a.target}</span>}
                  </span>
                  <small className="muted nowrap">{relativeTime(a.created_at, lang)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section data-tour="dash-actions">
        <h2 className="dash-h2">{t('quick_actions')}</h2>
        <div className="quick-grid">
          {[
            { to: '/my-conferences/new', icon: 'plus', label: t('new_conference'), sub: t('qa_new_sub'), primary: true },
            { to: '/my-conferences', icon: 'calendar-check', label: t('nav_my_conferences'), sub: t('qa_manage_sub') },
            { to: '/check-in', icon: 'qrcode', label: t('nav_check_in'), sub: t('qa_checkin_sub') },
            { to: '/analytics', icon: 'chart-line', label: t('nav_analytics'), sub: t('qa_analytics_sub') },
            { to: '/settings', icon: 'user-gear', label: t('nav_settings'), sub: t('qa_settings_sub') },
            { to: '/help', icon: 'life-ring', label: t('nav_help'), sub: t('qa_help_sub') },
          ].map((q) => (
            <Link key={q.to} to={q.to} className={`quick card--hover${q.primary ? ' quick--primary' : ''}`}>
              <span className="quick__icon"><i className={`fas fa-${q.icon}`} /></span>
              <strong>{q.label}</strong>
              <span>{q.sub}</span>
            </Link>
          ))}
        </div>
      </section>
      <HelpButton tour="dashboard" />
    </div>
  );
}
