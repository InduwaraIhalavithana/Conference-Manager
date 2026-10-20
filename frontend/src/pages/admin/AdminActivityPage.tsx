import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { hasKey, type TKey } from '../../i18n';
import { formatDateTime, formatNumber, relativeTime } from '../../i18n/format';
import { api } from '../../services/api';
import type { ActivityItem, Paged } from '../../types';
import CustomSelect from '../../components/CustomSelect';
import { Avatar, EmptyState, PageHead, Pagination, Skeleton } from '../../components/ui';
import { ACTIVITY_ACTIONS, activityIcon } from '../organizer/activity';
import '../organizer/Organizer.css';

export default function AdminActivityPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_activity');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<ActivityItem> | null>(null);

  useEffect(() => {
    setData(null);
    api.activity({ action, page, per_page: 25 }).then(setData).catch(() => setData({ items: [], total: 0, page: 1, pages: 1 }));
  }, [action, page]);
  useEffect(() => { setPage(1); }, [action]);

  const label = (a: string) => (hasKey(`act_${a}`) ? t(`act_${a}` as TKey) : a);

  return (
    <div className="container page">
      <PageHead icon="list-check" title={t('nav_activity')} subtitle={t('admin_activity_sub')} />
      <div className="toolbar">
        <CustomSelect value={action} onChange={setAction} icon="filter" ariaLabel={t('filter_action')}
          options={[{ value: '', label: t('all_actions') }, ...ACTIVITY_ACTIONS.map((a) => ({ value: a, label: label(a), icon: activityIcon(a) }))]} />
        {data && <span className="chip chip--accent">{t('results_count', { count: formatNumber(data.total, lang) })}</span>}
      </div>
      {!data ? <Skeleton h={400} /> : data.items.length === 0 ? <EmptyState icon="list-check" title={t('activity_empty')} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('field_action')}</th>
                <th>{t('field_who')}</th>
                <th>{t('field_target')}</th>
                <th>{t('field_when')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a, i) => (
                <tr key={a.id ?? i}>
                  <td><span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><span className="feed__icon"><i className={`fas fa-${activityIcon(a.action)}`} /></span> <strong>{label(a.action)}</strong></span></td>
                  <td>{a.action.startsWith('admin_')
                    ? <span className="chip"><i className="fas fa-user-shield" /> {t('role_admin')}</span>
                    : a.organizer_name
                      ? <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><Avatar name={a.organizer_name} src={a.organizer_avatar} size={30} /> {a.organizer_name}</span>
                      : <span className="chip"><i className="fas fa-user-slash" /> {t('deleted_account')}</span>}</td>
                  <td className="text-2">{a.target ?? '—'}</td>
                  <td className="nowrap text-2" title={formatDateTime(a.created_at, lang)}>{relativeTime(a.created_at, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}
