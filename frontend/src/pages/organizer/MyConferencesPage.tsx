import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { useDebounced, usePageTitle } from '../../hooks';
import { daysUntil, formatDate, formatNumber, formatTime } from '../../i18n/format';
import { api } from '../../services/api';
import type { Conference, Paged } from '../../types';
import { catColor, catMeta, coverGradient } from '../../utils/categories';
import { errorMessage } from '../../utils/errors';
import { CategoryChip, CountdownChip, DateBadge } from '../../components/ConferenceCard';
import { HelpButton } from '../../components/Tour';
import { CapacityBar, ConfirmModal, EmptyState, PageHead, Pagination, Skeleton } from '../../components/ui';
import './Organizer.css';

type When = 'all' | 'upcoming' | 'past' | 'draft';

export default function MyConferencesPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_my_conferences');
  const [when, setWhen] = useState<When>('all');
  const [q, setQ] = useState('');
  const query = useDebounced(q, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Conference> | null>(null);
  const [toDelete, setToDelete] = useState<Conference | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setData(null);
    api.myConferences({ when, q: query, page, per_page: 10 }).then(setData).catch(() => setData({ items: [], total: 0, page: 1, pages: 1 }));
  }, [when, query, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [when, query]);

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteConference(toDelete.id);
      toast.success(t('conf_deleted'));
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: When; icon: string; label: string }[] = [
    { id: 'all', icon: 'layer-group', label: t('tab_all') },
    { id: 'upcoming', icon: 'rocket', label: t('tab_upcoming') },
    { id: 'past', icon: 'clock-rotate-left', label: t('tab_past') },
    { id: 'draft', icon: 'pen-ruler', label: t('tab_drafts') },
  ];

  return (
    <div className="container page">
      <PageHead icon="calendar-check" title={t('nav_my_conferences')} subtitle={t('my_conferences_sub')}>
        <Link to="/my-conferences/new" className="btn btn--primary btn--lg" data-tour="mc-create"><i className="fas fa-plus" /> {t('new_conference')}</Link>
      </PageHead>

      <div className="toolbar" data-tour="mc-filters">
        <div className="input-icon">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_my_conferences')} aria-label={t('search_my_conferences')} />
        </div>
        <div className="tabs" role="tablist">
          {tabs.map((tb) => (
            <button key={tb.id} role="tab" className="tab" aria-selected={when === tb.id} onClick={() => setWhen(tb.id)}>
              <i className={`fas fa-${tb.icon}`} /> {tb.label}
            </button>
          ))}
        </div>
        {data && <span className="chip chip--accent">{t('results_count', { count: formatNumber(data.total, lang) })}</span>}
      </div>

      {!data ? (
        <div className="mc-list">{[0, 1, 2].map((i) => <Skeleton key={i} h={160} r={20} />)}</div>
      ) : data.items.length === 0 ? (
        <EmptyState icon="calendar-plus" title={q || when !== 'all' ? t('no_results_title') : t('no_conferences_yet')}
          message={q || when !== 'all' ? t('no_results_filtered') : t('no_conferences_yet_body')}>
          <Link to="/my-conferences/new" className="btn btn--primary"><i className="fas fa-plus" /> {t('new_conference')}</Link>
        </EmptyState>
      ) : (
        <div className="mc-list stagger">
          {data.items.map((c, i) => {
            const past = daysUntil(c.date) < 0;
            return (
              <article key={c.id} className="mc-row" style={{ '--cat': catColor(c.category) } as CSSProperties}>
                <Link to={`/my-conferences/${c.id}/edit`} className="mc-row__cover" aria-label={c.title}
                  style={c.cover_image ? { backgroundImage: `url(${c.cover_image})` } : { background: coverGradient(c.category, c.id) }}>
                  <DateBadge date={c.date} />
                  {!c.cover_image && <i className={`fas fa-${catMeta(c.category).icon} ccard__glyph`} style={{ fontSize: '4rem' }} aria-hidden="true" />}
                </Link>
                <div className="mc-row__body">
                  <div className="row" style={{ gap: 8 }}>
                    {c.status === 'draft' ? <span className="chip chip--warning"><i className="fas fa-pen-ruler" /> {t('status_draft')}</span>
                      : <span className="chip chip--success"><i className="fas fa-globe" /> {t('status_published')}</span>}
                    {c.category && <CategoryChip category={c.category} />}
                    <CountdownChip date={c.date} />
                  </div>
                  <Link to={`/my-conferences/${c.id}/edit`} className="mc-row__title">{c.title}</Link>
                  <div className="mc-row__meta">
                    <span><i className="fas fa-calendar-day" />{formatDate(c.date, lang, 'medium')}{c.time && ` · ${formatTime(c.time, lang)}`}</span>
                    {c.location && <span><i className="fas fa-location-dot" />{c.location}</span>}
                  </div>
                  <div className="mc-row__nums">
                    <span className="chip"><i className="fas fa-users" /> {t('n_registered', { count: c.attendee_count })}</span>
                    {c.waitlist_count > 0 && <span className="chip chip--warning"><i className="fas fa-hourglass-half" /> {t('n_waitlisted', { count: c.waitlist_count })}</span>}
                    {c.checked_in_count > 0 && <span className="chip chip--success"><i className="fas fa-qrcode" /> {t('n_checked_in', { count: c.checked_in_count })}</span>}
                    <span className="chip"><i className="fas fa-list-ol" /> {t('n_sessions', { count: c.session_count })}</span>
                    <span className="chip"><i className="fas fa-microphone" /> {t('n_speakers', { count: c.speaker_count })}</span>
                  </div>
                  {!past && <div style={{ maxWidth: 420 }}><CapacityBar count={c.attendee_count} max={c.max_attendees} /></div>}
                </div>
                <div className="mc-row__actions" data-tour={i === 0 ? 'mc-row-actions' : undefined}>
                  <Link to={`/my-conferences/${c.id}/edit`} className="btn btn--sm"><i className="fas fa-pen" /> {t('edit')}</Link>
                  <Link to={`/attendees/${c.id}`} className="btn btn--sm"><i className="fas fa-users" /> {t('attendees')}</Link>
                  {!past && <Link to={`/check-in/${c.id}`} className="btn btn--sm"><i className="fas fa-qrcode" /> {t('nav_check_in')}</Link>}
                  {c.status === 'published' && <Link to={`/conferences/${c.id}`} className="btn btn--sm"><i className="fas fa-eye" /> {t('view_public')}</Link>}
                  <button className="btn btn--sm btn--danger" onClick={() => setToDelete(c)}><i className="fas fa-trash" /> {t('delete')}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onPage={setPage} />}

      {toDelete && (
        <ConfirmModal danger title={t('delete_conf_title')} confirmLabel={t('delete')} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)}
          message={t('delete_conf_body', { title: toDelete.title, count: toDelete.attendee_count + toDelete.waitlist_count })} />
      )}
      <HelpButton tour="myConferences" />
    </div>
  );
}
