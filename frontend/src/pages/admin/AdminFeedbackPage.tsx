import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { hasKey, type TKey } from '../../i18n';
import { formatDateTime } from '../../i18n/format';
import { api } from '../../services/api';
import type { ContactMessage, Feedback } from '../../types';
import { errorMessage } from '../../utils/errors';
import { Avatar, EmptyState, PageHead, Skeleton } from '../../components/ui';
import '../organizer/Organizer.css';

type Tab = 'feedback' | 'contact';
type Filter = 'open' | 'all';

export default function AdminFeedbackPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_feedback');
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'contact' ? 'contact' : 'feedback';
  const [filter, setFilter] = useState<Filter>('open');
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [contacts, setContacts] = useState<ContactMessage[] | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.adminFeedback().then(setFeedback).catch(() => setFeedback([]));
    api.adminContacts().then(setContacts).catch(() => setContacts([]));
  }, []);

  const reply = async (f: Feedback) => {
    const text = (replies[f.id] ?? '').trim();
    if (!text) return;
    setBusy(`r${f.id}`);
    try {
      await api.replyFeedback(f.id, text);
      setFeedback((list) => list!.map((x) => (x.id === f.id ? { ...x, reply: text } : x)));
      setReplies((r) => ({ ...r, [f.id]: '' }));
      toast.success(t('reply_sent'));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (f: Feedback) => {
    setBusy(`f${f.id}`);
    try {
      await api.resolveFeedback(f.id);
      setFeedback((list) => list!.map((x) => (x.id === f.id ? { ...x, status: 'resolved' } : x)));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const resolveContact = async (m: ContactMessage) => {
    setBusy(`c${m.id}`);
    try {
      await api.resolveContact(m.id);
      setContacts((list) => list!.map((x) => (x.id === m.id ? { ...x, status: 'resolved' } : x)));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const openFb = (feedback ?? []).filter((f) => f.status === 'open').length;
  const openCt = (contacts ?? []).filter((m) => m.status === 'open').length;
  const fbShown = (feedback ?? []).filter((f) => filter === 'all' || f.status === 'open');
  const ctShown = (contacts ?? []).filter((m) => filter === 'all' || m.status === 'open');
  const subject = (s: string) => (hasKey(s) ? t(s as TKey) : s);

  return (
    <div className="container page">
      <PageHead icon="comments" title={t('nav_feedback')} subtitle={t('admin_feedback_sub')} />
      <div className="toolbar">
        <div className="tabs" role="tablist">
          <button role="tab" className="tab" aria-selected={tab === 'feedback'} onClick={() => setParams({}, { replace: true })}>
            <i className="fas fa-user-tie" /> {t('tab_organizer_feedback')} <span className="count">{openFb}</span>
          </button>
          <button role="tab" className="tab" aria-selected={tab === 'contact'} onClick={() => setParams({ tab: 'contact' }, { replace: true })}>
            <i className="fas fa-envelope" /> {t('tab_contact_messages')} <span className="count">{openCt}</span>
          </button>
        </div>
        <div className="seg" role="group">
          <button aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>{t('filter_open')}</button>
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('filter_all')}</button>
        </div>
      </div>

      {tab === 'feedback' && (!feedback ? <Skeleton h={300} /> : fbShown.length === 0 ? (
        <EmptyState icon="inbox" title={t('inbox_empty_title')} message={t('inbox_empty_body')} />
      ) : (
        <div className="grid grid-2 stagger">
          {fbShown.map((f) => (
            <article key={f.id} className="card stack" style={{ gap: 12 }}>
              <div className="row">
                <Avatar name={f.organizer_name ?? ''} src={f.organizer_avatar} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{f.organizer_name}</strong>
                  <div className="small muted">{f.organizer_email} · {formatDateTime(f.created_at, lang)}</div>
                </div>
                <span className={`chip ${f.status === 'resolved' ? 'chip--success' : f.reply ? 'chip--accent' : 'chip--warning'}`}>
                  {f.status === 'resolved' ? t('status_resolved') : f.reply ? t('status_replied') : t('status_open')}
                </span>
              </div>
              <h3>{f.subject}</h3>
              <p className="text-2" style={{ whiteSpace: 'pre-wrap' }}>{f.message}</p>
              {f.reply && <div className="alert alert--info"><i className="fas fa-reply" /><div><strong>{t('your_reply')}</strong><p style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{f.reply}</p></div></div>}
              {f.status === 'open' && (
                <>
                  <textarea className="textarea" rows={3} value={replies[f.id] ?? ''} placeholder={t('reply_placeholder')} aria-label={t('reply_placeholder')}
                    onChange={(e) => setReplies((r) => ({ ...r, [f.id]: e.target.value }))} maxLength={5000} />
                  <div className="row">
                    <button className="btn btn--primary btn--sm" onClick={() => reply(f)} disabled={!replies[f.id]?.trim() || busy === `r${f.id}`}>
                      {busy === `r${f.id}` ? <span className="spinner" /> : <i className="fas fa-paper-plane" />} {f.reply ? t('send_another_reply') : t('send_reply')}
                    </button>
                    <button className="btn btn--success btn--sm" onClick={() => resolve(f)} disabled={busy === `f${f.id}`}>
                      <i className="fas fa-circle-check" /> {t('mark_resolved')}
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      ))}

      {tab === 'contact' && (!contacts ? <Skeleton h={300} /> : ctShown.length === 0 ? (
        <EmptyState icon="envelope-open" title={t('inbox_empty_title')} message={t('inbox_empty_body')} />
      ) : (
        <div className="grid grid-2 stagger">
          {ctShown.map((m) => (
            <article key={m.id} className="card stack" style={{ gap: 12 }}>
              <div className="row">
                <Avatar name={m.name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{m.name}</strong>
                  <div className="small muted">{formatDateTime(m.created_at, lang)}</div>
                </div>
                <span className={`chip ${m.status === 'resolved' ? 'chip--success' : 'chip--warning'}`}>
                  {m.status === 'resolved' ? t('status_resolved') : t('status_open')}
                </span>
              </div>
              <h3><span className="chip chip--accent">{subject(m.subject)}</span></h3>
              <p className="text-2" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</p>
              <div className="row">
                <a className="btn btn--primary btn--sm" href={`mailto:${m.email}?subject=${encodeURIComponent(`ConferenceHub: ${subject(m.subject)}`)}`}>
                  <i className="fas fa-reply" /> {t('reply_by_email')}
                </a>
                {m.status === 'open' && (
                  <button className="btn btn--success btn--sm" onClick={() => resolveContact(m)} disabled={busy === `c${m.id}`}>
                    <i className="fas fa-circle-check" /> {t('mark_resolved')}
                  </button>
                )}
                <span className="small muted">{m.email}</span>
              </div>
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}
