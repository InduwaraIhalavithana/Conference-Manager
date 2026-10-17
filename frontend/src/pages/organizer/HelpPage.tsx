import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import type { TKey } from '../../i18n';
import { formatDateTime } from '../../i18n/format';
import { api } from '../../services/api';
import type { Feedback } from '../../types';
import { errorMessage } from '../../utils/errors';
import { CONTACT_EMAIL } from '../../config';
import { EmptyState, Field, PageHead, Skeleton } from '../../components/ui';
import '../InfoPages.css';
import './Organizer.css';

type Tab = 'faq' | 'feedback' | 'history';
const FAQ_COUNT = 8;

export default function HelpPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_help');
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'faq';
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number | null>(0);
  const [form, setForm] = useState({ subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Feedback[] | null>(null);

  useEffect(() => {
    if (tab === 'history') api.myFeedback().then(setHistory).catch(() => setHistory([]));
  }, [tab]);

  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({
    q: t(`faq_${i + 1}_q` as TKey), a: t(`faq_${i + 1}_a` as TKey),
  })).filter((f) => !search.trim() || `${f.q} ${f.a}`.toLowerCase().includes(search.trim().toLowerCase()));

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.submitFeedback({ subject: form.subject.trim(), message: form.message.trim() });
      setForm({ subject: '', message: '' });
      toast.success(t('feedback_sent'));
      setParams({ tab: 'history' }, { replace: true });
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'faq', icon: 'book-open', label: t('tab_faq') },
    { id: 'feedback', icon: 'paper-plane', label: t('tab_send_feedback') },
    { id: 'history', icon: 'clock-rotate-left', label: t('tab_my_feedback') },
  ];

  return (
    <div className="container page">
      <PageHead icon="life-ring" title={t('nav_help')} subtitle={t('help_sub')}>
        <a className="btn" href={`mailto:${CONTACT_EMAIL}`}><i className="fas fa-envelope" /> {CONTACT_EMAIL}</a>
      </PageHead>
      <div className="side-layout">
        <nav className="card side-nav" role="tablist">
          {tabs.map((tb) => (
            <button key={tb.id} role="tab" aria-selected={tab === tb.id} onClick={() => setParams(tb.id === 'faq' ? {} : { tab: tb.id }, { replace: true })}>
              <i className={`fas fa-${tb.icon}`} /> {tb.label}
            </button>
          ))}
        </nav>
        <div className="stack">
          {tab === 'faq' && (
            <section className="card stack">
              <div className="input-icon">
                <i className="fas fa-magnifying-glass" aria-hidden="true" />
                <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_help')} aria-label={t('search_help')} />
              </div>
              {faqs.length === 0 ? <p className="muted">{t('no_results_title')}</p> : (
                <div className="faq">
                  {faqs.map((f, i) => (
                    <div key={f.q} className={`faq__item${open === i ? ' is-open' : ''}`}>
                      <button className="faq__q" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                        <span>{f.q}</span> <i className="fas fa-chevron-down" />
                      </button>
                      {open === i && <p className="faq__a">{f.a}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'feedback' && (
            <form className="card form" onSubmit={send} style={{ maxWidth: 820 }}>
              <h2 className="card__title" style={{ margin: 0 }}><i className="fas fa-paper-plane" /> {t('tab_send_feedback')}</h2>
              <p className="text-2">{t('feedback_help')}</p>
              <Field label={t('field_subject')} htmlFor="fb-subject" required>
                <input id="fb-subject" className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required maxLength={255} />
              </Field>
              <Field label={t('contact_message')} htmlFor="fb-msg" required hint={t('chars_left', { count: 5000 - form.message.length })}>
                <textarea id="fb-msg" className="textarea" rows={7} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required maxLength={5000} />
              </Field>
              {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
              <button className="btn btn--primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
                {busy ? <span className="spinner" /> : <><i className="fas fa-paper-plane" /> {t('send')}</>}
              </button>
            </form>
          )}

          {tab === 'history' && (
            !history ? <Skeleton h={200} /> : history.length === 0 ? (
              <EmptyState icon="comments" title={t('feedback_empty_title')} message={t('feedback_empty_body')}>
                <button className="btn btn--primary" onClick={() => setParams({ tab: 'feedback' }, { replace: true })}><i className="fas fa-paper-plane" /> {t('tab_send_feedback')}</button>
              </EmptyState>
            ) : (
              <div className="stack stagger">
                {history.map((f) => (
                  <article key={f.id} className="card">
                    <div className="row row--between">
                      <h3>{f.subject}</h3>
                      <span className={`chip ${f.status === 'resolved' ? 'chip--success' : f.reply ? 'chip--accent' : 'chip--warning'}`}>
                        <i className={`fas fa-${f.status === 'resolved' ? 'circle-check' : f.reply ? 'reply' : 'hourglass-half'}`} />
                        {f.status === 'resolved' ? t('status_resolved') : f.reply ? t('status_replied') : t('status_open')}
                      </span>
                    </div>
                    <p className="small muted" style={{ margin: '4px 0 10px' }}>{formatDateTime(f.created_at, lang)}</p>
                    <p className="text-2" style={{ whiteSpace: 'pre-wrap' }}>{f.message}</p>
                    {f.reply && (
                      <div className="alert alert--info" style={{ marginTop: 12 }}>
                        <i className="fas fa-user-shield" />
                        <div><strong>{t('admin_reply')}</strong><p style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{f.reply}</p></div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
