import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { usePageTitle } from '../hooks';
import { api } from '../services/api';
import { errorMessage } from '../utils/errors';
import { CONTACT_EMAIL } from '../config';
import CustomSelect from '../components/CustomSelect';
import { Field } from '../components/ui';
import type { Organizer } from '../types';
import './InfoPages.css';

export default function ContactPage() {
  const { t, role, user } = useApp();
  usePageTitle('nav_contact');
  const org = role === 'organizer' ? (user as Organizer) : null;
  const [form, setForm] = useState({
    name: org ? `${org.first_name} ${org.last_name}` : '',
    email: org?.email ?? '',
    topic: 'general',
    message: '',
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const topics = [
    { value: 'general', label: t('topic_general'), icon: 'circle-question' },
    { value: 'attending', label: t('topic_attending'), icon: 'ticket' },
    { value: 'organizing', label: t('topic_organizing'), icon: 'user-tie' },
    { value: 'technical', label: t('topic_technical'), icon: 'screwdriver-wrench' },
    { value: 'partnership', label: t('topic_partnership'), icon: 'handshake' },
  ];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // The topic is stored as its key, so the admin reads it in their own language.
      await api.contact({ name: form.name.trim(), email: form.email.trim(), subject: `topic_${form.topic}`, message: form.message.trim() });
      setSent(true);
      toast.success(t('contact_sent_title'));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const faqs = [1, 2, 3, 4].map((n) => ({ q: t(`contact_faq_${n}_q` as 'contact_faq_1_q'), a: t(`contact_faq_${n}_a` as 'contact_faq_1_a') }));

  return (
    <div>
      <section className="info-hero info-hero--compact">
        <div className="container">
          <span className="eyebrow">{t('nav_contact')}</span>
          <h1>{t('contact_title')}</h1>
          <p className="info-lead">{t('contact_lead')}</p>
        </div>
      </section>
      <section className="band">
        <div className="container grid-main-side">
          <div className="card">
            {sent ? (
              <div className="info-sent">
                <span className="info-sent__icon"><i className="fas fa-paper-plane" /></span>
                <h2>{t('contact_sent_title')}</h2>
                <p className="text-2">{t('contact_sent_body')}</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn" onClick={() => { setSent(false); setForm((f) => ({ ...f, message: '' })); }}>
                    <i className="fas fa-pen" /> {t('contact_send_another')}
                  </button>
                  <Link to="/conferences" className="btn btn--primary"><i className="fas fa-compass" /> {t('browse_conferences')}</Link>
                </div>
              </div>
            ) : (
              <form className="form" onSubmit={submit}>
                <h2 className="card__title"><i className="fas fa-envelope-open-text" /> {t('contact_form_title')}</h2>
                <div className="form-row">
                  <Field label={t('your_name')} htmlFor="c-name" required>
                    <input id="c-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={160} autoComplete="name" />
                  </Field>
                  <Field label={t('your_email')} htmlFor="c-email" required>
                    <input id="c-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
                  </Field>
                </div>
                <Field label={t('contact_topic')} htmlFor="c-topic">
                  <CustomSelect id="c-topic" value={form.topic} options={topics} onChange={(v) => setForm({ ...form, topic: v })} ariaLabel={t('contact_topic')} />
                </Field>
                <Field label={t('contact_message')} htmlFor="c-msg" required hint={t('chars_left', { count: 5000 - form.message.length })}>
                  <textarea id="c-msg" className="textarea" rows={7} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required minLength={5} maxLength={5000} placeholder={t('contact_message_ph')} />
                </Field>
                {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
                <button className="btn btn--primary btn--lg" disabled={busy} style={{ alignSelf: 'flex-start' }}>
                  {busy ? <span className="spinner" /> : <><i className="fas fa-paper-plane" /> {t('contact_send')}</>}
                </button>
              </form>
            )}
          </div>
          <aside className="stack">
            <div className="card info-channel">
              <span className="info-role__icon"><i className="fas fa-envelope" /></span>
              <div>
                <h3>{t('contact_email_title')}</h3>
                <a href={`mailto:${CONTACT_EMAIL}`} className="info-email">{CONTACT_EMAIL}</a>
                <p className="text-2 small">{t('contact_email_body')}</p>
              </div>
            </div>
            <div className="card info-channel">
              <span className="info-role__icon"><i className="fas fa-clock" /></span>
              <div>
                <h3>{t('contact_hours_title')}</h3>
                <p className="text-2">{t('contact_hours_body')}</p>
              </div>
            </div>
            <div className="card info-channel">
              <span className="info-role__icon"><i className="fas fa-location-dot" /></span>
              <div>
                <h3>{t('contact_where_title')}</h3>
                <p className="text-2">{t('footer_location')}</p>
              </div>
            </div>
            <div className="card">
              <h3 className="card__title"><i className="fas fa-circle-question" /> {t('contact_faq_title')}</h3>
              <div className="faq">
                {faqs.map((f, i) => (
                  <div key={f.q} className={`faq__item${openFaq === i ? ' is-open' : ''}`}>
                    <button className="faq__q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                      <span>{f.q}</span> <i className="fas fa-chevron-down" />
                    </button>
                    {openFaq === i && <p className="faq__a">{f.a}</p>}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
