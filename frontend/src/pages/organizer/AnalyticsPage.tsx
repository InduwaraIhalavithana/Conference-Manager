import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { formatDate, weekdayNames } from '../../i18n/format';
import { api } from '../../services/api';
import type { OrganizerAnalytics } from '../../types';
import { catColor, catMeta } from '../../utils/categories';
import { AreaChart, ColumnChart, Donut } from '../../components/Charts';
import CustomSelect from '../../components/CustomSelect';
import { HelpButton } from '../../components/Tour';
import { EmptyState, PageHead, Skeleton, Stat } from '../../components/ui';
import './Organizer.css';

export default function AnalyticsPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_analytics');
  const [days, setDays] = useState('30');
  const [data, setData] = useState<OrganizerAnalytics | null>(null);

  useEffect(() => {
    setData(null);
    api.analytics(Number(days)).then(setData).catch(() => {});
  }, [days]);

  const totals = data?.totals;
  const weekdays = weekdayNames(lang, 'short');
  const busiest = data ? data.by_weekday.indexOf(Math.max(...data.by_weekday)) : -1;

  return (
    <div className="container page">
      <PageHead icon="chart-line" title={t('nav_analytics')} subtitle={t('analytics_sub')}>
        <div data-tour="an-range" style={{ minWidth: 220 }}>
          <CustomSelect value={days} onChange={setDays} icon="calendar-week" ariaLabel={t('range')}
            options={[
              { value: '14', label: t('range_days', { count: 14 }) },
              { value: '30', label: t('range_days', { count: 30 }) },
              { value: '90', label: t('range_days', { count: 90 }) },
              { value: '365', label: t('range_year') },
            ]} />
        </div>
      </PageHead>

      <div className="grid grid-4 stagger" style={{ marginBottom: 20 }}>
        <Stat icon="user-plus" label={t('registrations_in_range')} value={totals?.registrations_in_period ?? null} />
        <Stat icon="users" label={t('stat_registered')} value={totals?.registered ?? null} tone="indigo" />
        <Stat icon="chair" label={t('avg_fill')} value={totals?.avg_fill ?? null} suffix="%" tone="warning" sub={t('avg_fill_sub')} />
        <Stat icon="qrcode" label={t('checkin_rate')} value={totals?.checkin_rate ?? null} suffix="%" tone="success" sub={t('checkin_rate_hint')} />
      </div>

      <section className="card" style={{ marginBottom: 20 }} data-tour="an-trend">
        <h2 className="card__title"><i className="fas fa-chart-area" /> {t('trend_title')}</h2>
        {data ? (
          <AreaChart height={260}
            labels={data.trend.map((d) => formatDate(d.date, lang, 'month-day'))}
            series={[
              { label: t('registrations'), color: 'var(--accent-strong)', values: data.trend.map((d) => d.registrations) },
              { label: t('checked_in'), color: 'var(--success)', values: data.trend.map((d) => d.checkins) },
            ]}
            empty={t('chart_empty')} />
        ) : <Skeleton h={260} />}
      </section>

      <div className="dash-row">
        <section className="card dash-row__wide">
          <h2 className="card__title"><i className="fas fa-calendar-week" /> {t('by_weekday')}</h2>
          {data ? (
            <>
              <ColumnChart items={data.by_weekday.map((v, i) => ({ label: weekdays[i], value: v }))} highlight={busiest} />
              {data.by_weekday.some(Boolean) && <p className="text-2 small" style={{ marginTop: 10 }}>{t('busiest_day', { day: weekdayNames(lang, 'long')[busiest] })}</p>}
            </>
          ) : <Skeleton h={220} />}
        </section>
        <section className="card">
          <h2 className="card__title"><i className="fas fa-chart-pie" /> {t('by_category')}</h2>
          {data ? (data.by_category.length ? (
            <Donut items={data.by_category.map((c) => ({ label: t(catMeta(c.category).key), value: c.registered, color: catColor(c.category) }))}
              center={<div><strong>{totals?.registered}</strong><div className="small muted">{t('registered')}</div></div>} />
          ) : <p className="muted">{t('chart_empty')}</p>) : <Skeleton h={200} />}
        </section>
      </div>

      <section data-tour="an-table">
        <h2 className="dash-h2">{t('per_conference')}</h2>
        {!data ? <Skeleton h={240} /> : data.by_conference.length === 0 ? (
          <EmptyState icon="chart-simple" title={t('no_conferences_yet')} message={t('no_conferences_yet_body')}>
            <Link to="/my-conferences/new" className="btn btn--primary"><i className="fas fa-plus" /> {t('new_conference')}</Link>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('field_title')}</th>
                  <th>{t('field_date')}</th>
                  <th>{t('stat_registered')}</th>
                  <th>{t('fill')}</th>
                  <th>{t('stat_waitlisted')}</th>
                  <th>{t('checkin_rate')}</th>
                </tr>
              </thead>
              <tbody>
                {data.by_conference.map((c) => {
                  const fill = c.max_attendees ? Math.min(100, Math.round((c.registered / c.max_attendees) * 100)) : null;
                  const rate = c.registered ? Math.round((c.checked_in / c.registered) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td><Link to={`/attendees/${c.id}`} style={{ fontWeight: 650 }}>{c.title}</Link></td>
                      <td className="nowrap text-2">{formatDate(c.date, lang, 'medium')}</td>
                      <td><strong>{c.registered}</strong>{c.max_attendees && <span className="muted"> / {c.max_attendees}</span>}</td>
                      <td style={{ minWidth: 150 }}>
                        {fill === null ? <span className="muted small">{t('no_limit')}</span> : (
                          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                            <div className={`bar${fill >= 100 ? ' bar--warning' : ''}`} style={{ flex: 1 }}><span style={{ width: `${fill}%` }} /></div>
                            <span className="small">{fill}%</span>
                          </div>
                        )}
                      </td>
                      <td>{c.waitlisted > 0 ? <span className="chip chip--warning">{c.waitlisted}</span> : <span className="muted">0</span>}</td>
                      <td style={{ minWidth: 150 }}>
                        <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                          <div className="bar bar--success" style={{ flex: 1 }}><span style={{ width: `${rate}%` }} /></div>
                          <span className="small">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <HelpButton tour="analytics" />
    </div>
  );
}
