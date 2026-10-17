import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import type { PublicStats } from '../../types';
import { CountUp } from '../../components/ui';
import './Auth.css';

/** Two-panel sign-in layout: live numbers and benefits on the left, the form on the right. */
export default function AuthLayout({ icon, title, subtitle, side, children, admin }: {
  icon: string; title: string; subtitle: string; side: { title: string; points: string[] }; children: ReactNode; admin?: boolean;
}) {
  const { t } = useApp();
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => { api.publicStats().then(setStats).catch(() => {}); }, []);
  return (
    <div className={`auth${admin ? ' auth--admin' : ''}`}>
      <aside className="auth__side">
        <div className="auth__side-inner">
          <h2>{side.title}</h2>
          <ul className="auth__points">
            {side.points.map((p, i) => (
              <li key={p} style={{ animationDelay: `${150 + i * 90}ms` }}><i className="fas fa-circle-check" /> {p}</li>
            ))}
          </ul>
          <div className="auth__stats">
            <div><strong>{stats ? <CountUp value={stats.upcoming} /> : '–'}</strong><span>{t('stat_upcoming')}</span></div>
            <div><strong>{stats ? <CountUp value={stats.attendees} /> : '–'}</strong><span>{t('stat_attendees')}</span></div>
            <div><strong>{stats ? <CountUp value={stats.organizers} /> : '–'}</strong><span>{t('stat_organizers')}</span></div>
          </div>
        </div>
      </aside>
      <section className="auth__main">
        <div className="auth__card">
          <div className="auth__icon"><i className={`fas fa-${icon}`} aria-hidden="true" /></div>
          <h1>{title}</h1>
          <p className="auth__sub">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
