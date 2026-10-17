import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { useDebounced, usePageTitle } from '../../hooks';
import { daysUntil, formatDate, formatNumber } from '../../i18n/format';
import { api } from '../../services/api';
import { CATEGORIES, type Conference, type Paged } from '../../types';
import { catColor, catMeta, coverGradient } from '../../utils/categories';
import { errorMessage } from '../../utils/errors';
import { CategoryChip } from '../../components/ConferenceCard';
import CustomSelect from '../../components/CustomSelect';
import { Avatar, ConfirmModal, EmptyState, PageHead, Pagination, Skeleton } from '../../components/ui';
import '../organizer/Organizer.css';

type When = 'all' | 'upcoming' | 'past' | 'draft';

export default function AdminConferencesPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_conferences');
  const [when, setWhen] = useState<When>('all');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const query = useDebounced(q, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Conference> | null>(null);
  const [toDelete, setToDelete] = useState<Conference | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setData(null);
    api.adminConferences({ q: query, when, category, page, per_page: 15 }).then(setData).catch(() => setData({ items: [], total: 0, page: 1, pages: 1 }));
  }, [query, when, category, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, when, category]);

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.adminDeleteConference(toDelete.id);
      toast.success(t('conf_deleted'));
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <PageHead icon="calendar-days" title={t('nav_conferences')} subtitle={t('admin_conferences_sub')} />
      <div className="toolbar">
        <div className="input-icon">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_admin_conferences')} aria-label={t('search_admin_conferences')} />
        </div>
        <div className="tabs" role="tablist">
          {(['all', 'upcoming', 'past', 'draft'] as When[]).map((w) => (
            <button key={w} role="tab" className="tab" aria-selected={when === w} onClick={() => setWhen(w)}>
              {t(w === 'all' ? 'tab_all' : w === 'upcoming' ? 'tab_upcoming' : w === 'past' ? 'tab_past' : 'tab_drafts')}
            </button>
          ))}
        </div>
        <CustomSelect value={category} onChange={setCategory} icon="tags" ariaLabel={t('filter_category')}
          options={[{ value: '', label: t('all_categories') }, ...CATEGORIES.map((c) => ({ value: c, label: t(catMeta(c).key), icon: catMeta(c).icon, color: catColor(c) }))]} />
        {data && <span className="chip chip--accent">{t('results_count', { count: formatNumber(data.total, lang) })}</span>}
      </div>

      {!data ? <Skeleton h={360} r={14} /> : data.items.length === 0 ? (
        <EmptyState icon="calendar-xmark" title={t('no_results_title')} message={t('no_results_filtered')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('field_title')}</th>
                <th>{t('organized_by')}</th>
                <th>{t('field_date')}</th>
                <th>{t('field_location')}</th>
                <th>{t('stat_registered')}</th>
                <th>{t('field_status')}</th>
                <th><span className="sr-only">{t('actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => {
                const past = daysUntil(c.date) < 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="att-row-name">
                        <span style={{ width: 64, height: 42, borderRadius: 9, flexShrink: 0, background: c.cover_image ? `center / cover url(${c.cover_image})` : coverGradient(c.category, c.id), '--cat': catColor(c.category) } as CSSProperties} />
                        <div style={{ minWidth: 0 }}>
                          <strong>{c.title}</strong>
                          {c.category && <CategoryChip category={c.category} />}
                        </div>
                      </div>
                    </td>
                    <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><Avatar name={c.organizer_name} src={c.organizer_avatar} size={30} /> {c.organizer_name}</span></td>
                    <td className="nowrap text-2">{formatDate(c.date, lang, 'medium')}</td>
                    <td className="text-2">{c.location ?? '—'}</td>
                    <td><strong>{c.attendee_count}</strong>{c.max_attendees && <span className="muted"> / {c.max_attendees}</span>}
                      {c.waitlist_count > 0 && <span className="chip chip--warning" style={{ marginLeft: 6 }}>+{c.waitlist_count}</span>}</td>
                    <td>
                      {c.status === 'draft' ? <span className="chip chip--warning"><i className="fas fa-pen-ruler" /> {t('status_draft')}</span>
                        : past ? <span className="chip"><i className="fas fa-flag-checkered" /> {t('status_past')}</span>
                          : <span className="chip chip--success"><i className="fas fa-globe" /> {t('status_published')}</span>}
                    </td>
                    <td>
                      <div className="actions">
                        {c.status === 'published' && (
                          <Link to={`/conferences/${c.id}`} className="btn btn--sm btn--icon" aria-label={t('view_public')} title={t('view_public')}><i className="fas fa-eye" /></Link>
                        )}
                        <button className="btn btn--sm btn--icon btn--danger" onClick={() => setToDelete(c)} aria-label={t('delete')} title={t('delete')}><i className="fas fa-trash" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onPage={setPage} />}
      {toDelete && (
        <ConfirmModal danger title={t('delete_conf_title')} confirmLabel={t('delete')} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)}
          message={t('admin_delete_conf_body', { title: toDelete.title, name: toDelete.organizer_name })} />
      )}
    </div>
  );
}
