import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { daysUntil, formatDate, formatDateTime, formatNumber } from '../../i18n/format';
import { api } from '../../services/api';
import type { Attendee, Conference } from '../../types';
import { errorMessage } from '../../utils/errors';
import { downloadBlob } from '../../utils/misc';
import { HelpButton } from '../../components/Tour';
import { Avatar, ConfirmModal, EmptyState, PageHead, Skeleton, Spinner, Stat } from '../../components/ui';
import './Organizer.css';

export default function AttendeesPage() {
  const { confId } = useParams();
  const { t, lang } = useApp();
  const [conf, setConf] = useState<Conference | null>(null);
  const [people, setPeople] = useState<Attendee[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<'registered' | 'waitlisted'>('registered');
  const [q, setQ] = useState('');
  const [toCancel, setToCancel] = useState<Attendee | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  usePageTitle('attendees', conf?.title);

  const load = useCallback(() => {
    Promise.all([api.myConference(confId!), api.attendees(confId!)])
      .then(([d, list]) => { setConf(d.conference); setPeople(list); })
      .catch(() => setMissing(true));
  }, [confId]);

  useEffect(() => { load(); }, [load]);

  const registered = useMemo(() => (people ?? []).filter((p) => p.status === 'registered'), [people]);
  const waiting = useMemo(() => (people ?? []).filter((p) => p.status === 'waitlisted'), [people]);
  const checked = registered.filter((p) => p.checked_in_at).length;
  const shown = (tab === 'registered' ? registered : waiting).filter((p) => {
    const s = q.trim().toLowerCase();
    return !s || p.name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s) || (p.ticket_code ?? '').toLowerCase().includes(s);
  });

  if (missing) {
    return (
      <div className="container page">
        <EmptyState icon="users-slash" title={t('conf_not_found')} message={t('conf_not_yours')}>
          <Link to="/my-conferences" className="btn btn--primary"><i className="fas fa-arrow-left" /> {t('nav_my_conferences')}</Link>
        </EmptyState>
      </div>
    );
  }
  if (!conf || !people) return <Spinner />;

  const past = daysUntil(conf.date) < 0;

  const toggle = async (a: Attendee) => {
    setBusy(`c${a.id}`);
    try {
      const updated = await api.setCheckIn(conf.id, a.id, !a.checked_in_at);
      setPeople((list) => list!.map((p) => (p.id === a.id ? updated : p)));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!toCancel) return;
    setBusy('cancel');
    try {
      await api.cancelAttendee(conf.id, toCancel.id);
      toast.success(t('attendee_cancelled', { name: toCancel.name }));
      setToCancel(null);
      load(); // someone may have moved up from the waitlist
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy('export');
    try {
      downloadBlob(await api.exportAttendees(conf.id), `attendees_${conf.id}.csv`);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const remind = async () => {
    setBusy('remind');
    try {
      const r = await api.sendReminders(conf.id);
      toast.success(r.email_enabled ? t('reminders_sent', { count: r.sent }) : t('reminders_logged', { count: r.sent }));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container page">
      <PageHead icon="users" title={t('attendees')} subtitle={<>{conf.title} · {formatDate(conf.date, lang, 'long')}</>}>
        <Link to={`/my-conferences/${conf.id}/edit`} className="btn"><i className="fas fa-pen" /> {t('edit')}</Link>
      </PageHead>

      <div className="grid grid-4 stagger" style={{ marginBottom: 20 }}>
        <Stat icon="users" label={t('stat_registered')} value={registered.length} sub={conf.max_attendees ? t('of_seats', { max: formatNumber(conf.max_attendees, lang) }) : t('no_limit')} />
        <Stat icon="hourglass-half" label={t('stat_waitlisted')} value={waiting.length} tone="warning" />
        <Stat icon="qrcode" label={t('stat_checked_in')} value={checked} tone="success" />
        <Stat icon="percent" label={t('checkin_rate')} value={registered.length ? Math.round((checked / registered.length) * 100) : 0} suffix="%" tone="indigo" />
      </div>

      <div className="toolbar">
        <div className="tabs" role="tablist" data-tour="at-tabs">
          <button role="tab" className="tab" aria-selected={tab === 'registered'} onClick={() => setTab('registered')}>
            <i className="fas fa-user-check" /> {t('tab_registered')} <span className="count">{registered.length}</span>
          </button>
          <button role="tab" className="tab" aria-selected={tab === 'waitlisted'} onClick={() => setTab('waitlisted')}>
            <i className="fas fa-hourglass-half" /> {t('tab_waitlist')} <span className="count">{waiting.length}</span>
          </button>
        </div>
        <div className="input-icon">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_attendees')} aria-label={t('search_attendees')} />
        </div>
        <div className="row" data-tour="at-tools">
          {!past && <Link to={`/check-in/${conf.id}`} className="btn"><i className="fas fa-qrcode" /> {t('open_check_in')}</Link>}
          <button className="btn" onClick={exportCsv} disabled={busy === 'export' || people.length === 0}>
            {busy === 'export' ? <span className="spinner" /> : <i className="fas fa-file-csv" />} {t('export_csv')}
          </button>
          {!past && (
            <button className="btn" onClick={remind} disabled={busy === 'remind' || registered.length === 0} data-tour="at-reminders">
              {busy === 'remind' ? <span className="spinner" /> : <i className="fas fa-bell" />} {t('send_reminders')}
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={tab === 'registered' ? 'user-plus' : 'hourglass'} title={q ? t('no_results_title') : tab === 'registered' ? t('no_attendees_title') : t('no_waitlist_title')}
          message={q ? t('no_results_filtered') : tab === 'registered' ? t('no_attendees_body') : t('no_waitlist_body')}>
          {!q && conf.status === 'published' && <Link to={`/conferences/${conf.id}`} className="btn btn--primary"><i className="fas fa-share-nodes" /> {t('view_public')}</Link>}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {tab === 'waitlisted' && <th>#</th>}
                <th>{t('field_name')}</th>
                <th>{t('ticket_code')}</th>
                <th>{t('registered_on')}</th>
                {tab === 'registered' && <th>{t('check_in')}</th>}
                <th><span className="sr-only">{t('actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a, i) => (
                <tr key={a.id}>
                  {tab === 'waitlisted' && <td><span className="chip chip--warning">{a.waitlist_position}</span></td>}
                  <td>
                    <div className="att-row-name">
                      <Avatar name={a.name} size={38} />
                      <div><strong>{a.name}</strong><small>{a.email}</small></div>
                    </div>
                  </td>
                  <td><span className="att-code">{a.ticket_code}</span></td>
                  <td className="nowrap text-2">{formatDateTime(a.registered_at, lang)}</td>
                  {tab === 'registered' && (
                    <td>
                      <button className={`att-check${a.checked_in_at ? ' is-on' : ''}`} onClick={() => toggle(a)} disabled={busy === `c${a.id}`}
                        aria-pressed={Boolean(a.checked_in_at)} data-tour={i === 0 ? 'at-checkin' : undefined}
                        title={a.checked_in_at ? formatDateTime(a.checked_in_at, lang) : t('mark_checked_in')}>
                        <i className={`fas fa-${a.checked_in_at ? 'circle-check' : 'circle'}`} /> {a.checked_in_at ? t('checked_in') : t('not_checked_in')}
                      </button>
                    </td>
                  )}
                  <td>
                    <div className="actions">
                      <a className="btn btn--sm btn--icon" href={`/tickets/${a.ticket_code}`} target="_blank" rel="noreferrer" aria-label={t('open_ticket')} title={t('open_ticket')}>
                        <i className="fas fa-ticket" />
                      </a>
                      {!past && (
                        <button className="btn btn--sm btn--icon btn--danger" onClick={() => setToCancel(a)} aria-label={t('cancel_registration')} title={t('cancel_registration')}>
                          <i className="fas fa-user-xmark" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {people === null && <Skeleton h={300} />}

      {toCancel && (
        <ConfirmModal danger title={t('cancel_registration')} confirmLabel={t('cancel_registration')} busy={busy === 'cancel'}
          message={toCancel.status === 'registered' && waiting.length > 0 ? t('cancel_attendee_body_promote', { name: toCancel.name }) : t('cancel_attendee_body', { name: toCancel.name })}
          onConfirm={cancel} onCancel={() => setToCancel(null)} />
      )}
      <HelpButton tour="attendees" />
    </div>
  );
}
