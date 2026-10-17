import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { usePageTitle, useReveal } from '../hooks';
import { formatDate, formatNumber, formatTime, relativeTime } from '../i18n/format';
import { api } from '../services/api';
import type { Conference, Featured, PublicStats } from '../types';
import { catColor, catMeta, coverGradient } from '../utils/categories';
import ConferenceCard, { CategoryChip } from '../components/ConferenceCard';
import { Avatar, CapacityBar, CountUp, SkeletonCards } from '../components/ui';
import { HOME_OF } from '../App';
import './HomePage.css';

function Countdown({ date, time }: { date: string; time: string | null }) {
  const { t, lang } = useApp();
  const target = new Date(`${date}T${time ?? '09:00:00'}`).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, target - now);
  const parts = [
    { v: Math.floor(left / 86400000), l: t('cd_days') },
    { v: Math.floor((left / 3600000) % 24), l: t('cd_hours') },
    { v: Math.floor((left / 60000) % 60), l: t('cd_minutes') },
    { v: Math.floor((left / 1000) % 60), l: t('cd_seconds') },
  ];
  return (
    <div className="countdown" role="timer">
      {parts.map((p) => (
        <div key={p.l} className="countdown__cell">
          <strong>{formatNumber(p.v, lang).padStart(2, '0')}</strong>
          <span>{p.l}</span>
        </div>
      ))}
    </div>
  );
}

/** Start and end of an event in the viewer's clock (times are the venue's local time). */
function eventWindow(c: Conference): { start: number; end: number } {
  const start = new Date(`${c.date}T${c.time ?? '00:00:00'}`).getTime();
  const end = c.end_time ? new Date(`${c.date}T${c.end_time}`).getTime() : new Date(`${c.date}T23:59:59`).getTime();
  return { start, end };
}

function LiveProgress({ conf }: { conf: Conference }) {
  const { t, lang } = useApp();
  const { start, end } = eventWindow(conf);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const pct = Math.min(100, Math.max(0, Math.round(((now - start) / Math.max(1, end - start)) * 100)));
  return (
    <div className="nextup__live-box">
      <div className="row row--between small">
        <span className="text-2">{t('home_live_progress', { start: formatTime(conf.time, lang), end: formatTime(conf.end_time, lang) || '–' })}</span>
        <strong style={{ color: 'var(--success)' }}>{pct}%</strong>
      </div>
      <div className="bar bar--success"><span style={{ width: `${pct}%` }} /></div>
      {conf.checked_in_count > 0 && (
        <span className="small text-2"><i className="fas fa-qrcode" /> {t('n_checked_in', { count: conf.checked_in_count })}</span>
      )}
    </div>
  );
}

function NextUpCard({ conf }: { conf: Conference }) {
  const { t, lang } = useApp();
  const { start, end } = eventWindow(conf);
  const now = Date.now();
  const live = now >= start && now < end;
  const full = conf.max_attendees !== null && conf.attendee_count >= conf.max_attendees;
  return (
    <div className="nextup" style={{ '--cat': catColor(conf.category) } as CSSProperties}>
      <div className="nextup__cover" style={conf.cover_image ? { backgroundImage: `url(${conf.cover_image})` } : { background: coverGradient(conf.category, conf.id) }}>
        <span className="chip chip--success nextup__live"><span className="live-dot" /> {live ? t('home_live_now') : t('home_next_up')}</span>
        {conf.category && <CategoryChip category={conf.category} />}
      </div>
      <div className="nextup__body">
        <h3>{conf.title}</h3>
        <ul className="nextup__meta">
          <li><i className="fas fa-calendar-day" /> {formatDate(conf.date, lang, 'long')}</li>
          {conf.time && <li><i className="fas fa-clock" /> {formatTime(conf.time, lang)}{conf.end_time && ` – ${formatTime(conf.end_time, lang)}`}</li>}
          {conf.location && <li><i className="fas fa-location-dot" /> {conf.location}</li>}
        </ul>
        {live ? <LiveProgress conf={conf} /> : <Countdown date={conf.date} time={conf.time} />}
        <CapacityBar count={conf.attendee_count} max={conf.max_attendees} />
        <div className="row row--between">
          <span className="row small text-2" style={{ gap: 8 }}>
            <Avatar name={conf.organizer_name} src={conf.organizer_avatar} size={30} /> {conf.organizer_name}
          </span>
          <Link to={`/conferences/${conf.id}`} className="btn btn--primary btn--sm">
            {live ? t('view_details') : full ? t('join_waitlist') : t('register_now')} <i className="fas fa-arrow-right" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { t, lang, role } = useApp();
  const navigate = useNavigate();
  usePageTitle('nav_home');
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [featured, setFeatured] = useState<Featured | null>(null);
  const [q, setQ] = useState('');
  useReveal([stats, featured]);

  useEffect(() => {
    api.publicStats().then(setStats).catch(() => {});
    api.featured().then(setFeatured).catch(() => setFeatured({ next: [], speakers: [] }));
  }, []);

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/conferences${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  // The next event that has not finished yet (one under way today counts as next).
  const next = featured?.next.find((c) => eventWindow(c).end > Date.now()) ?? featured?.next[0];
  const catCount = (c: string) => stats?.categories.find((x) => x.category === c)?.count ?? 0;
  const tickerItems = [
    ...(stats?.recent ?? []).map((r) => ({ key: `r${r.conference_id}${r.at}`, to: `/conferences/${r.conference_id}`, icon: 'user-plus', text: t('ticker_registered', { title: r.title }), when: relativeTime(r.at, lang) })),
    ...(featured?.next ?? []).map((c) => ({ key: `c${c.id}`, to: `/conferences/${c.id}`, icon: 'calendar-day', text: c.title, when: formatDate(c.date, lang, 'month-day') })),
  ];

  const statTiles = [
    { icon: 'calendar-days', value: stats?.upcoming, label: t('stat_upcoming') },
    { icon: 'flag-checkered', value: stats?.held, label: t('stat_held') },
    { icon: 'users', value: stats?.attendees, label: t('stat_attendees') },
    { icon: 'qrcode', value: stats?.checked_in, label: t('stat_checked_in') },
    { icon: 'microphone', value: stats?.speakers, label: t('stat_speakers') },
    { icon: 'user-tie', value: stats?.organizers, label: t('stat_organizers') },
  ];

  const features = [
    { icon: 'ticket', title: t('feat_tickets'), body: t('feat_tickets_body') },
    { icon: 'hourglass-half', title: t('feat_waitlist'), body: t('feat_waitlist_body') },
    { icon: 'list-ol', title: t('feat_agenda'), body: t('feat_agenda_body') },
    { icon: 'bell', title: t('feat_reminders'), body: t('feat_reminders_body') },
    { icon: 'map-location-dot', title: t('feat_maps'), body: t('feat_maps_body') },
    { icon: 'chart-line', title: t('feat_analytics'), body: t('feat_analytics_body') },
    { icon: 'language', title: t('feat_languages'), body: t('feat_languages_body') },
    { icon: 'shield-halved', title: t('feat_secure'), body: t('feat_secure_body') },
  ];

  return (
    <div className="home">
      {/* Hero */}
      <section className="home-hero">
        <div className="container home-hero__grid">
          <div className="home-hero__text">
            <span className="chip chip--accent home-hero__eyebrow">
              <span className="live-dot" /> {stats ? t('home_live_week', { count: formatNumber(stats.registrations_this_week, lang) }) : t('home_eyebrow')}
            </span>
            <h1>{t('home_title_1')} <span className="grad-text">{t('home_title_2')}</span></h1>
            <p className="home-hero__sub">{t('home_subtitle')}</p>
            <form className="home-search" onSubmit={search} role="search">
              <i className="fas fa-magnifying-glass" aria-hidden="true" />
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_placeholder')} aria-label={t('search_placeholder')} />
              <button className="btn btn--primary">{t('search')}</button>
            </form>
            <div className="row home-hero__cats">
              {(['Tech', 'Health', 'Education', 'Business', 'Science', 'Arts'] as const).map((c) => (
                <Link key={c} to={`/conferences?category=${c}`} className="chip chip--cat home-cat-link" style={{ '--cat': catColor(c) } as CSSProperties}>
                  <i className={`fas fa-${catMeta(c).icon}`} /> {t(catMeta(c).key)} <b>{formatNumber(catCount(c), lang)}</b>
                </Link>
              ))}
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <Link to="/conferences" className="btn btn--primary btn--lg"><i className="fas fa-compass" /> {t('browse_conferences')}</Link>
              {role ? (
                <Link to={HOME_OF[role]} className="btn btn--lg"><i className="fas fa-gauge-high" /> {t('nav_my_dashboard')}</Link>
              ) : (
                <Link to="/register" className="btn btn--lg"><i className="fas fa-rocket" /> {t('start_organizing')}</Link>
              )}
            </div>
          </div>
          <div className="home-hero__side">
            {next ? <NextUpCard conf={next} /> : featured ? (
              <div className="nextup nextup--empty">
                <i className="fas fa-calendar-plus" />
                <h3>{t('home_no_upcoming')}</h3>
                <Link to="/register" className="btn btn--primary">{t('start_organizing')}</Link>
              </div>
            ) : <div className="skeleton" style={{ height: 470, borderRadius: 22 }} />}
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="band band--tight band--alt">
        <div className="container home-stats stagger">
          {statTiles.map((s) => (
            <div key={s.label} className="home-stat">
              <i className={`fas fa-${s.icon}`} aria-hidden="true" />
              <strong>{s.value === undefined ? '–' : <CountUp value={s.value} />}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Live ticker */}
      {tickerItems.length > 0 && (
        <div className="ticker" aria-label={t('ticker_label')}>
          <span className="ticker__label"><span className="live-dot" /> {t('ticker_label')}</span>
          <div className="ticker__track">
            <div className="ticker__move">
              {[...tickerItems, ...tickerItems].map((it, i) => (
                <Link key={`${it.key}-${i}`} to={it.to} className="ticker__item" tabIndex={i >= tickerItems.length ? -1 : 0}>
                  <i className={`fas fa-${it.icon}`} /> {it.text} <span className="muted">· {it.when}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <section className="band">
        <div className="container">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow">{t('home_upcoming_eyebrow')}</span>
              <h2>{t('home_upcoming_title')}</h2>
            </div>
            <Link to="/conferences" className="btn">{t('see_all')} <i className="fas fa-arrow-right" /></Link>
          </div>
          {!featured ? <SkeletonCards count={4} /> : featured.next.length === 0 ? (
            <p className="muted">{t('home_no_upcoming')}</p>
          ) : (
            <div className="grid grid-cards stagger">
              {featured.next.slice(0, 8).map((c) => <ConferenceCard key={c.id} conf={c} />)}
            </div>
          )}
        </div>
      </section>

      {/* Categories + cities */}
      <section className="band band--alt">
        <div className="container home-split">
          <div className="reveal">
            <span className="eyebrow">{t('home_topics_eyebrow')}</span>
            <h2>{t('home_topics_title')}</h2>
            <div className="home-cats">
              {(['Tech', 'Health', 'Education', 'Business', 'Science', 'Arts', 'Other'] as const).map((c) => (
                <Link key={c} to={`/conferences?category=${c}`} className="home-cat card--hover" style={{ '--cat': catColor(c) } as CSSProperties}>
                  <span className="home-cat__icon"><i className={`fas fa-${catMeta(c).icon}`} /></span>
                  <strong>{t(catMeta(c).key)}</strong>
                  <span>{t('n_upcoming', { count: formatNumber(catCount(c), lang) })}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="reveal">
            <span className="eyebrow">{t('home_cities_eyebrow')}</span>
            <h2>{t('home_cities_title')}</h2>
            <div className="home-cities">
              {(stats?.cities ?? []).map((c, i) => (
                <Link key={c.city} to={`/conferences?city=${encodeURIComponent(c.city)}`} className="home-city" style={{ animationDelay: `${i * 50}ms` }}>
                  <i className="fas fa-location-dot" /> {c.city} <b>{formatNumber(c.count, lang)}</b>
                </Link>
              ))}
              {stats && stats.cities.length === 0 && <span className="muted">{t('home_no_cities')}</span>}
            </div>
            <div className="home-mini-stats">
              <div><strong><CountUp value={stats?.sessions ?? 0} /></strong><span>{t('stat_sessions')}</span></div>
              <div><strong><CountUp value={stats?.registrations_this_week ?? 0} /></strong><span>{t('stat_this_week')}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Speakers */}
      {featured && featured.speakers.length > 0 && (
        <section className="band">
          <div className="container">
            <div className="section-head reveal">
              <div>
                <span className="eyebrow">{t('home_speakers_eyebrow')}</span>
                <h2>{t('home_speakers_title')}</h2>
              </div>
            </div>
            <div className="home-speakers stagger">
              {featured.speakers.map((s) => (
                <Link key={s.id} to={`/conferences/${s.conference_id}`} className="home-speaker card--hover">
                  <Avatar name={s.name} src={s.photo} size={92} />
                  <strong>{s.name}</strong>
                  <span>{[s.job_title, s.organization].filter(Boolean).join(' · ')}</span>
                  <small><i className="fas fa-microphone" /> {s.conference_title}</small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="band band--alt-2">
        <div className="container">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow">{t('home_features_eyebrow')}</span>
              <h2>{t('home_features_title')}</h2>
            </div>
          </div>
          <div className="home-features">
            {features.map((f, i) => (
              <div key={f.title} className="home-feature card--hover reveal" style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
                <span className="home-feature__icon"><i className={`fas fa-${f.icon}`} /></span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works + CTA */}
      <section className="band">
        <div className="container">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow">{t('home_steps_eyebrow')}</span>
              <h2>{t('home_steps_title')}</h2>
            </div>
          </div>
          <ol className="home-steps">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="home-step reveal" style={{ transitionDelay: `${n * 80}ms` }}>
                <span className="home-step__n">{n}</span>
                <h3>{t(`step_${n}_title` as 'step_1_title')}</h3>
                <p>{t(`step_${n}_body` as 'step_1_body')}</p>
              </li>
            ))}
          </ol>
          <div className="home-cta reveal">
            <div>
              <h2>{t('cta_title')}</h2>
              <p>{t('cta_body')}</p>
            </div>
            <div className="row">
              {!role && <Link to="/register" className="btn btn--lg home-cta__btn"><i className="fas fa-user-plus" /> {t('create_free_account')}</Link>}
              <Link to="/contact" className="btn btn--lg btn--ghost home-cta__ghost"><i className="fas fa-envelope" /> {t('nav_contact')}</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
