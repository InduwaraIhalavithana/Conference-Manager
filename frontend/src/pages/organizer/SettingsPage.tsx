import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { LANGS } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { api } from '../../services/api';
import type { Organizer } from '../../types';
import { errorMessage } from '../../utils/errors';
import { UPLOAD_LIMITS_MB } from '../../config';
import ImageUpload from '../../components/ImageUpload';
import { HelpButton } from '../../components/Tour';
import { Avatar, ConfirmModal, Field, PageHead, PasswordInput } from '../../components/ui';
import { PasswordMeter } from '../auth/RegisterPage';
import './Organizer.css';

type Tab = 'profile' | 'password' | 'preferences' | 'danger';

export default function SettingsPage() {
  const { t, lang, setLang, theme, setTheme, user, updateUser, logout } = useApp();
  const me = user as Organizer;
  usePageTitle('nav_settings');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'profile';
  const [profile, setProfile] = useState({
    first_name: me.first_name, last_name: me.last_name, phone: me.phone ?? '', organization: me.organization ?? '', bio: me.bio ?? '',
  });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [delPw, setDelPw] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = (next: Tab) => { setError(''); setParams(next === 'profile' ? {} : { tab: next }, { replace: true }); };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const updated = await api.updateProfile({
        first_name: profile.first_name.trim(), last_name: profile.last_name.trim(), phone: profile.phone.trim() || null,
        organization: profile.organization.trim() || null, bio: profile.bio.trim() || null,
      });
      updateUser(updated);
      toast.success(t('profile_saved'));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.next !== pw.confirm) { setError(t('err_passwords_differ')); return; }
    setBusy(true);
    try {
      await api.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      toast.success(t('password_changed'));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.deleteAccount(delPw);
      logout();
      toast.success(t('account_deleted'));
      navigate('/', { replace: true });
    } catch (err) {
      setConfirmDelete(false);
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; icon: string; label: string; danger?: boolean }[] = [
    { id: 'profile', icon: 'user', label: t('tab_profile') },
    { id: 'password', icon: 'lock', label: t('change_password') },
    { id: 'preferences', icon: 'palette', label: t('tab_preferences') },
    { id: 'danger', icon: 'triangle-exclamation', label: t('tab_danger'), danger: true },
  ];

  return (
    <div className="container page">
      <PageHead icon="user-gear" title={t('nav_settings')} subtitle={t('settings_sub')} />
      <div className="side-layout">
        <nav className="card side-nav" role="tablist" aria-label={t('nav_settings')} data-tour="set-tabs">
          <div className="profile-card">
            <Avatar name={`${me.first_name} ${me.last_name}`} src={me.avatar} size={84} />
            <strong>{me.first_name} {me.last_name}</strong>
            <span className="small muted">{me.email}</span>
            {me.created_at && <span className="small muted">{t('member_since', { date: formatDate(me.created_at, lang, 'month-year') })}</span>}
          </div>
          {tabs.map((tb) => (
            <button key={tb.id} role="tab" aria-selected={tab === tb.id} className={tb.danger ? 'is-danger' : ''} onClick={() => go(tb.id)}>
              <i className={`fas fa-${tb.icon}`} /> {tb.label}
            </button>
          ))}
        </nav>

        <div className="stack">
          {tab === 'profile' && (
            <>
              <section className="card stack" data-tour="set-photo">
                <h2 className="card__title" style={{ margin: 0 }}><i className="fas fa-camera" /> {t('profile_photo')}</h2>
                <p className="text-2">{t('profile_photo_help')}</p>
                <ImageUpload shape="round" current={me.avatar} maxMb={UPLOAD_LIMITS_MB.avatar}
                  placeholder={<Avatar name={`${me.first_name} ${me.last_name}`} size={124} />}
                  onUpload={async (f) => updateUser(await api.uploadPhoto(f))}
                  onRemove={async () => updateUser(await api.removePhoto())} />
              </section>
              <form className="card form" onSubmit={saveProfile}>
                <h2 className="card__title" style={{ margin: 0 }}><i className="fas fa-id-card" /> {t('tab_profile')}</h2>
                <div className="form-row">
                  <Field label={t('field_first_name')} htmlFor="p-first" required>
                    <input id="p-first" className="input" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} required maxLength={80} />
                  </Field>
                  <Field label={t('field_last_name')} htmlFor="p-last" required>
                    <input id="p-last" className="input" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} required maxLength={80} />
                  </Field>
                </div>
                <div className="form-row">
                  <Field label={t('field_email')} htmlFor="p-email" hint={t('email_locked')}>
                    <input id="p-email" className="input" value={me.email} disabled />
                  </Field>
                  <Field label={t('field_phone')} htmlFor="p-phone" hint={t('optional')}>
                    <input id="p-phone" type="tel" className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} maxLength={30} />
                  </Field>
                </div>
                <Field label={t('field_organization')} htmlFor="p-org" hint={t('organization_hint')}>
                  <input id="p-org" className="input" value={profile.organization} onChange={(e) => setProfile({ ...profile, organization: e.target.value })} maxLength={160} />
                </Field>
                <Field label={t('field_bio')} htmlFor="p-bio" hint={t('chars_left', { count: 1000 - profile.bio.length })}>
                  <textarea id="p-bio" className="textarea" rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} maxLength={1000} />
                </Field>
                {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
                <button className="btn btn--primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
                  {busy ? <span className="spinner" /> : <><i className="fas fa-floppy-disk" /> {t('save_changes')}</>}
                </button>
              </form>
            </>
          )}

          {tab === 'password' && (
            <form className="card form" onSubmit={savePassword} style={{ maxWidth: 640 }}>
              <h2 className="card__title" style={{ margin: 0 }}><i className="fas fa-lock" /> {t('change_password')}</h2>
              <Field label={t('current_password')} htmlFor="pw-cur" required>
                <PasswordInput id="pw-cur" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" />
              </Field>
              <Field label={t('new_password')} htmlFor="pw-new" required>
                <PasswordInput id="pw-new" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} maxLength={128} autoComplete="new-password" />
                <PasswordMeter value={pw.next} />
              </Field>
              <Field label={t('field_confirm_password')} htmlFor="pw-conf" required>
                <PasswordInput id="pw-conf" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required minLength={8} autoComplete="new-password" />
              </Field>
              {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
              <button className="btn btn--primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
                {busy ? <span className="spinner" /> : <><i className="fas fa-key" /> {t('change_password')}</>}
              </button>
            </form>
          )}

          {tab === 'preferences' && (
            <>
              <section className="card stack">
                <h2 className="card__title" style={{ margin: 0 }}><i className="fas fa-circle-half-stroke" /> {t('theme')}</h2>
                <div className="theme-cards">
                  {(['light', 'dark'] as const).map((th) => (
                    <button key={th} className="theme-card" aria-pressed={theme === th} onClick={() => setTheme(th)}>
                      <span className="theme-card__preview" style={{ background: th === 'light' ? '#dbe4f1' : '#050c1d' }}>
                        <span style={{ background: th === 'light' ? '#edf2fa' : '#0f1a36' }} />
                        <span style={{ background: th === 'light' ? '#0369a1' : '#38bdf8', flex: 0.4 }} />
                      </span>
                      <span><i className={`fas fa-${th === 'light' ? 'sun' : 'moon'}`} /> {th === 'light' ? t('light_mode') : t('dark_mode')}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="card stack">
                <h2 className="card__title" style={{ margin: 0 }}><i className="fas fa-language" /> {t('language')}</h2>
                <p className="text-2">{t('language_help')}</p>
                <div className="theme-cards">
                  {LANGS.map((l) => (
                    <button key={l.code} className="theme-card" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                      <strong style={{ fontSize: '1.5rem' }}>{l.short}</strong>
                      <span>{l.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === 'danger' && (
            <section className="card stack" style={{ borderColor: 'var(--danger)', maxWidth: 680 }}>
              <h2 className="card__title" style={{ margin: 0, color: 'var(--danger)' }}><i className="fas fa-triangle-exclamation" style={{ color: 'var(--danger)' }} /> {t('delete_account')}</h2>
              <p className="text-2">{t('delete_account_body')}</p>
              <Field label={t('confirm_with_password')} htmlFor="del-pw">
                <PasswordInput id="del-pw" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" />
              </Field>
              {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
              <button className="btn btn--danger" disabled={!delPw} onClick={() => setConfirmDelete(true)} style={{ alignSelf: 'flex-start' }}>
                <i className="fas fa-trash" /> {t('delete_account')}
              </button>
            </section>
          )}
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal danger title={t('delete_account')} message={t('delete_account_confirm')} confirmLabel={t('delete_account')}
          busy={busy} onConfirm={deleteAccount} onCancel={() => setConfirmDelete(false)} />
      )}
      <HelpButton tour="settings" />
    </div>
  );
}
