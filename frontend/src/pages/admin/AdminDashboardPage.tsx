import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { hasKey, type TKey } from '../../i18n';
import { formatDate, monthShort, relativeTime } from '../../i18n/format';
import { api } from '../../services/api';
import type { ActivityItem, AdminAnalytics, AdminStats, AdminTrends } from '../../types';
import { catColor, catMeta } from '../../utils/categories';
import { AreaChart, BarList, ColumnChart, Donut } from '../../components/Charts';
import { HelpButton } from '../../components/Tour';
import { Avatar, PageHead, Skeleton, Stat } from '../../components/ui';
import { activityIcon } from '../organizer/activity';
import '../organizer/Organizer.css';

export default function AdminDashboardPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_my_dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [trends, setTrends] = useState<AdminTrends | null>(null);
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    api.adminStats().then(setStats).catch(() => {});
    api.adminTrends(30).then(setTrends).catch(() => {});
    api.adminAnalytics().then(setData).catch(() => {});
    api.activity({ per_page: 8 }).then((r) => setActivity(r.items)).catch(() => setActivity([]));
  }, []);

  const monthLabel = (m: string) => monthShort(`${m}-01`, lang);
  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="container page">
      <PageHead icon="gauge-high" title={t('admin_dashboard_title')} subtitle={t('admin_dashboard_sub')}>
        <span className="chip chip--success"><span className="live-dot" /> {t('system_online')}</span>
      </PageHead>

      <div className="grid grid-4 stagger" style={{ marginBottom: 20 }} data-tour="adm-stats">
        <Stat icon="user-tie" label={t('stat_organizers')} value={stats?.total_organizers ?? null} sub={stats ? t('n_active_suspended', { active: stats.active_organizers, suspended: stats.suspended }) : undefined} />
        <Stat icon="calendar-days" label={t('stat_conferences')} value={stats?.total_confs ?? null} sub={stats ? t('n_upcoming', { count: stats.upcoming_confs }) : undefined} tone="indigo" />
        <Stat icon="users" label={t('stat_registered')} value={stats?.total_attendees ?? null} sub={stats ? t('n_waitlisted', { count: stats.waitlisted }) : undefined} tone="success" />
        <Stat icon="qrcode" label={t('checkin_rate')} value={data?.checkin_rate ?? null} suffix="%" sub={stats ? t('n_checked_in', { count: stats.checked_in }) : undefined} tone="warning" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }} data-tour="adm-nav">
        <Link to="/admin/feedback" className="quick card--hover" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <span className="quick__icon" style={{ margin: 0 }}><i className="fas fa-comments" /></span>
          <span style={{ flex: 1 }}><strong>{t('nav_feedback')}</strong><br /><span className="text-2 small">{stats ? t('n_open_feedback', { feedback: stats.open_feedback, contacts: stats.open_contacts }) : '…'}</span></span>
          {stats && stats.open_feedback + stats.open_contacts > 0 && <span className="chip chip--danger">{stats.open_feedback + stats.open_contacts}</span>}
          <i className="fas fa-arrow-right muted" />
        </Link>
        <Link to="/admin/organizers?status=suspended" className="quick card--hover" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <span className="quick__icon" style={{ margin: 0 }}><i className="fas fa-user-lock" /></span>
          <span style={{ flex: 1 }}><strong>{t('suspended_accounts')}</strong><br /><span className="text-2 small">{stats ? t('n_suspended', { count: stats.suspended }) : '…'}</span></span>
          <i className="fas fa-arrow-right muted" />
        </Link>
      </div>

      <div className="dash-row" data-tour="adm-charts">
        <section className="card dash-row__wide">
          <h2 className="card__title"><i className="fas fa-chart-area" /> {t('last_30_days')}</h2>
          {trends ? (
            <AreaChart
              labels={trends.registrations.map((d) => formatDate(d.date, lang, 'month-day'))}
              series={[
                { label: t('registrations'), color: 'var(--accent-strong)', values: trends.registrations.map((d) => d.count) },
                { label: t('new_organizers'), color: 'var(--accent-2)', values: trends.organizers.map((d) => d.count) },
              ]}
              empty={t('chart_empty')} />
          ) : <Skeleton h={240} />}
        </section>
        <section className="card">
          <h2 className="card__title"><i className="fas fa-chart-pie" /> {t('by_category')}</h2>
          {data ? (
            <Donut items={data.by_category.map((c) => ({ label: t(catMeta(c.category).key), value: c.conferences, color: catColor(c.category) }))}
              center={<div><strong>{stats?.total_confs ?? 0}</strong><div className="small muted">{t('stat_conferences')}</div></div>} />
          ) : <Skeleton h={200} />}
        </section>
      </div>

      <div className="dash-row">
        <section className="card dash-row__wide">
          <h2 className="card__title"><i className="fas fa-calendar-week" /> {t('conferences_by_month')}</h2>
          {data ? <ColumnChart items={data.by_month.map((m) => ({ label: monthLabel(m.month), value: m.count }))} highlight={data.by_month.findIndex((m) => m.month === thisMonth)} />
            : <Skeleton h={220} />}
        </section>
        <section className="card">
          <h2 className="card__title"><i className="fas fa-location-dot" /> {t('top_cities')}</h2>
          {data ? <BarList items={data.cities.slice(0, 6).map((c) => ({ key: c.city, label: c.city, value: c.count }))} /> : <Skeleton h={200} />}
        </section>
      </div>

      <div className="dash-row">
        <section className="card dash-row__wide">
          <h2 className="card__title"><i className="fas fa-trophy" /> {t('top_conferences')}</h2>
          {!data ? <Skeleton h={220} /> : (
            <BarList items={data.top_conferences.map((c) => ({
              key: c.id,
              label: <Link to={`/conferences/${c.id}`}>{c.title}</Link>,
              value: c.attendee_count,
              color: catColor(c.category),
              sub: `${c.organizer_name} · ${formatDate(c.date, lang, 'medium')}`,
            }))} />
          )}
        </section>
        <section className="card">
          <h2 className="card__title"><i className="fas fa-medal" /> {t('top_organizers')}</h2>
          {!data ? <Skeleton h={220} /> : (
            <ul className="feed">
              {data.top_organizers.map((o) => (
                <li key={o.id} className="feed__item">
                  <Avatar name={o.name} src={o.avatar} size={40} />
                  <span className="feed__text"><strong>{o.name}</strong><br /><small className="muted">{o.organization ?? t('n_conferences', { count: o.conferences })}</small></span>
                  <span className="chip chip--accent"><i className="fas fa-users" /> {o.attendees}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="card__title"><i className="fas fa-wave-square" /> {t('recent_activity')}<span className="spacer" />
          <Link to="/admin/activity" className="btn btn--sm btn--ghost">{t('see_all')} <i className="fas fa-arrow-right" /></Link>
        </h2>
        {!activity ? <Skeleton h={160} /> : activity.length === 0 ? <p className="muted">{t('activity_empty')}</p> : (
          <ul className="feed">
            {activity.map((a, i) => (
              <li key={a.id ?? i} className="feed__item">
                <span className="feed__icon"><i className={`fas fa-${activityIcon(a.action)}`} /></span>
                <span className="feed__text">
                  <strong>{a.action.startsWith('admin_') ? t('role_admin') : a.organizer_name ?? t('role_admin')}</strong> · {hasKey(`act_${a.action}`) ? t(`act_${a.action}` as TKey) : a.action}
                  {a.target && <span className="muted"> · {a.target}</span>}
                </span>
                <small className="muted nowrap">{relativeTime(a.created_at, lang)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
      <HelpButton tour="admin" />
    </div>
  );
}
