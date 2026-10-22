import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { usePageTitle, useReveal } from '../hooks';
import { api } from '../services/api';
import type { PublicStats } from '../types';
import { CONTACT_EMAIL, CREATOR } from '../config';
import { CountUp } from '../components/ui';
import './InfoPages.css';

export default function AboutPage() {
  const { t } = useApp();
  usePageTitle('nav_about');
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => { api.publicStats().then(setStats).catch(() => {}); }, []);
  useReveal([stats]);
  // The footer's "Created by" link opens /about#creator: scroll to that section.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const roles = [
    { icon: 'user-tie', title: t('about_role_org'), points: [t('about_role_org_1'), t('about_role_org_2'), t('about_role_org_3'), t('about_role_org_4')] },
    { icon: 'users', title: t('about_role_att'), points: [t('about_role_att_1'), t('about_role_att_2'), t('about_role_att_3'), t('about_role_att_4')] },
    { icon: 'user-shield', title: t('about_role_admin'), points: [t('about_role_admin_1'), t('about_role_admin_2'), t('about_role_admin_3'), t('about_role_admin_4')] },
  ];
  const values = [
    { icon: 'language', title: t('about_value_lang'), body: t('about_value_lang_body') },
    { icon: 'lock', title: t('about_value_privacy'), body: t('about_value_privacy_body') },
    { icon: 'universal-access', title: t('about_value_access'), body: t('about_value_access_body') },
    { icon: 'bolt', title: t('about_value_speed'), body: t('about_value_speed_body') },
  ];

  return (
    <div>
      <section className="info-hero">
        <div className="container info-hero__grid">
          <div>
            <span className="eyebrow">{t('nav_about')}</span>
            <h1>{t('about_title')}</h1>
            <p className="info-lead">{t('about_lead')}</p>
            <div className="row" style={{ marginTop: 18 }}>
              <Link to="/conferences" className="btn btn--primary btn--lg"><i className="fas fa-compass" /> {t('browse_conferences')}</Link>
              <Link to="/contact" className="btn btn--lg"><i className="fas fa-envelope" /> {t('nav_contact')}</Link>
            </div>
          </div>
          <div className="info-stats">
            {[
              { v: stats?.upcoming, l: t('stat_upcoming'), i: 'calendar-days' },
              { v: stats?.attendees, l: t('stat_attendees'), i: 'users' },
              { v: stats?.organizers, l: t('stat_organizers'), i: 'user-tie' },
              { v: stats?.speakers, l: t('stat_speakers'), i: 'microphone' },
            ].map((s) => (
              <div key={s.l} className="info-stat">
                <i className={`fas fa-${s.i}`} />
                <strong>{s.v === undefined ? '–' : <CountUp value={s.v} />}</strong>
                <span>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band band--alt">
        <div className="container">
          <div className="info-mission reveal">
            <div>
              <span className="eyebrow">{t('about_mission_eyebrow')}</span>
              <h2>{t('about_mission_title')}</h2>
            </div>
            <p>{t('about_mission_body')}</p>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <h2 className="reveal" style={{ marginBottom: 18 }}>{t('about_roles_title')}</h2>
          <div className="grid grid-3">
            {roles.map((r, i) => (
              <article key={r.title} className="card card--hover info-role reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="info-role__icon"><i className={`fas fa-${r.icon}`} /></span>
                <h3>{r.title}</h3>
                <ul>{r.points.map((p) => <li key={p}><i className="fas fa-check" /> {p}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band band--alt-2">
        <div className="container">
          <h2 className="reveal" style={{ marginBottom: 18 }}>{t('about_values_title')}</h2>
          <div className="grid grid-4">
            {values.map((v, i) => (
              <div key={v.title} className="card card--hover reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="info-role__icon"><i className={`fas fa-${v.icon}`} /></span>
                <h3 style={{ margin: '10px 0 6px' }}>{v.title}</h3>
                <p className="text-2">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band band--alt" id="creator">
        <div className="container">
          <div className="creator reveal">
            <div className="creator__photo">
              <img src={CREATOR.photo} alt={CREATOR.name} width="320" height="320" loading="lazy" />
            </div>
            <div className="creator__text">
              <span className="eyebrow">{t('about_creator_eyebrow')}</span>
              <h2>{CREATOR.name}</h2>
              <p className="creator__role"><i className="fas fa-code" /> {t('about_creator_role')}</p>
              <p>{t('about_creator_body')}</p>
              <div className="creator__stack">
                {['FastAPI', 'React + TypeScript', 'PostgreSQL', 'EN · සිං · தமி'].map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
              <a className="btn btn--primary" href={CREATOR.github} target="_blank" rel="noopener noreferrer">
                <i className="fab fa-github" /> {t('about_creator_github')}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="info-contact-strip reveal">
            <div>
              <h2>{t('about_contact_title')}</h2>
              <p>{t('about_contact_body')}</p>
            </div>
            {CONTACT_EMAIL
              ? <a className="btn btn--lg" href={`mailto:${CONTACT_EMAIL}`}><i className="fas fa-envelope" /> {CONTACT_EMAIL}</a>
              : <Link className="btn btn--lg" to="/contact"><i className="fas fa-envelope" /> {t('nav_contact')}</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
