import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { useDebounced, usePageTitle } from '../../hooks';
import { formatDate, formatNumber } from '../../i18n/format';
import { api } from '../../services/api';
import type { AdminOrganizer, Paged } from '../../types';
import { errorMessage } from '../../utils/errors';
import CustomSelect from '../../components/CustomSelect';
import { HelpButton } from '../../components/Tour';
import { Avatar, ConfirmModal, EmptyState, PageHead, Pagination, Skeleton } from '../../components/ui';
import '../organizer/Organizer.css';

type Action = { kind: 'suspend' | 'unsuspend' | 'delete'; org: AdminOrganizer };

export default function AdminOrganizersPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_organizers');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const [q, setQ] = useState('');
  const query = useDebounced(q, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminOrganizer> | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setData(null);
    api.adminOrganizers({ q: query, status, page, per_page: 15 }).then(setData).catch(() => setData({ items: [], total: 0, page: 1, pages: 1 }));
  }, [query, status, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, status]);

  const run = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === 'suspend') await api.suspendOrganizer(action.org.id);
      if (action.kind === 'unsuspend') await api.unsuspendOrganizer(action.org.id);
      if (action.kind === 'delete') await api.deleteOrganizer(action.org.id);
      toast.success(t(`org_${action.kind}_done`, { name: `${action.org.first_name} ${action.org.last_name}` }));
      setAction(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <PageHead icon="user-tie" title={t('nav_organizers')} subtitle={t('admin_organizers_sub')} />
      <div className="toolbar" data-tour="ao-filters">
        <div className="input-icon">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_organizers')} aria-label={t('search_organizers')} />
        </div>
        <CustomSelect value={status} onChange={(v) => setParams(v === 'all' ? {} : { status: v }, { replace: true })} icon="filter" ariaLabel={t('field_status')}
          options={[
            { value: 'all', label: t('filter_all_accounts') },
            { value: 'active', label: t('status_active'), icon: 'circle-check' },
            { value: 'suspended', label: t('status_suspended'), icon: 'user-lock' },
          ]} />
        {data && <span className="chip chip--accent">{t('results_count', { count: formatNumber(data.total, lang) })}</span>}
      </div>

      {!data ? <Skeleton h={360} r={14} /> : data.items.length === 0 ? (
        <EmptyState icon="user-tie" title={t('no_results_title')} message={t('no_results_filtered')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('field_name')}</th>
                <th>{t('field_organization')}</th>
                <th>{t('stat_conferences')}</th>
                <th>{t('stat_registered')}</th>
                <th>{t('joined')}</th>
                <th>{t('field_status')}</th>
                <th><span className="sr-only">{t('actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o, i) => (
                <tr key={o.id}>
                  <td>
                    <div className="att-row-name">
                      <Avatar name={`${o.first_name} ${o.last_name}`} src={o.avatar} size={42} />
                      <div><strong>{o.first_name} {o.last_name}</strong><small>{o.email}</small></div>
                    </div>
                  </td>
                  <td className="text-2">{o.organization ?? '—'}</td>
                  <td><span className="chip"><i className="fas fa-calendar-days" /> {o.conference_count}</span></td>
                  <td><span className="chip"><i className="fas fa-users" /> {o.attendee_count}</span></td>
                  <td className="nowrap text-2">{o.created_at ? formatDate(o.created_at, lang, 'medium') : ''}</td>
                  <td>{o.is_suspended
                    ? <span className="chip chip--danger"><i className="fas fa-user-lock" /> {t('status_suspended')}</span>
                    : <span className="chip chip--success"><i className="fas fa-circle-check" /> {t('status_active')}</span>}
                  </td>
                  <td>
                    <div className="actions" data-tour={i === 0 ? 'ao-actions' : undefined}>
                      {o.is_suspended ? (
                        <button className="btn btn--sm btn--success" onClick={() => setAction({ kind: 'unsuspend', org: o })}><i className="fas fa-unlock" /> {t('unsuspend')}</button>
                      ) : (
                        <button className="btn btn--sm" onClick={() => setAction({ kind: 'suspend', org: o })}><i className="fas fa-user-lock" /> {t('suspend')}</button>
                      )}
                      <button className="btn btn--sm btn--icon btn--danger" onClick={() => setAction({ kind: 'delete', org: o })} aria-label={t('delete')} title={t('delete')}>
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onPage={setPage} />}

      {action && (
        <ConfirmModal danger={action.kind !== 'unsuspend'} busy={busy} onConfirm={run} onCancel={() => setAction(null)}
          title={t(`org_${action.kind}_title`)}
          confirmLabel={t(action.kind === 'delete' ? 'delete' : action.kind)}
          message={t(`org_${action.kind}_body`, { name: `${action.org.first_name} ${action.org.last_name}`, count: action.org.conference_count })} />
      )}
      <HelpButton tour="adminOrganizers" />
    </div>
  );
}
