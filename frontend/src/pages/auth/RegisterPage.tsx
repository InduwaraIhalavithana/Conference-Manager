import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { api } from '../../services/api';
import { errorMessage } from '../../utils/errors';
import { Field, PasswordInput } from '../../components/ui';
import CheckInbox from '../../components/CheckInbox';
import CodeEntry from '../../components/CodeEntry';
import AuthLayout from './AuthLayout';

export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, Math.min(4, score));
}

export function PasswordMeter({ value }: { value: string }) {
  const { t } = useApp();
  const score = passwordScore(value);
  const labels = ['', t('pw_weak'), t('pw_fair'), t('pw_good'), t('pw_strong')];
  if (!value) return <span className="hint">{t('pw_rule')}</span>;
  return (
    <div>
      <div className="pw-meter" data-score={score} aria-hidden="true"><span /><span /><span /><span /></div>
      <span className="hint">{labels[score]} · {t('pw_rule')}</span>
    </div>
  );
}

export default function RegisterPage() {
  const { t, lang, login } = useApp();
  usePageTitle('register');
  const navigate = useNavigate();
  const [sentTo, setSentTo] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', organization: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError(t('err_passwords_differ'));
      return;
    }
    setBusy(true);
    try {
      const res = await api.register({
        first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(),
        password: form.password, phone: form.phone.trim() || null, organization: form.organization.trim() || null, lang,
      });
      // No sign-in yet: the account opens with the code from the verification email.
      setSentTo(res.email);
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      icon="user-plus"
      title={t('register_title')}
      subtitle={t('register_subtitle')}
      side={{ title: t('register_side_title'), points: [t('register_side_1'), t('register_side_2'), t('register_side_3'), t('register_side_4')] }}
    >
      {sentTo ? (
        <CheckInbox body={t('verify_sent_body', { email: sentTo })} onResend={() => api.resendVerification(sentTo)}>
          <CodeEntry onSubmit={async (code) => {
            const res = await api.verifyEmail(sentTo, code);
            login(res.access_token, await api.me(res.access_token), 'organizer');
            toast.success(t('verify_done'));
            navigate('/dashboard', { replace: true });
          }} />
        </CheckInbox>
      ) : (
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <Field label={t('field_first_name')} htmlFor="r-first" required>
            <input id="r-first" className="input" value={form.first_name} onChange={set('first_name')} required maxLength={80} autoComplete="given-name" />
          </Field>
          <Field label={t('field_last_name')} htmlFor="r-last" required>
            <input id="r-last" className="input" value={form.last_name} onChange={set('last_name')} required maxLength={80} autoComplete="family-name" />
          </Field>
        </div>
        <Field label={t('field_email')} htmlFor="r-email" required>
          <input id="r-email" type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="email" placeholder={t('email_placeholder')} />
        </Field>
        <div className="form-row">
          <Field label={t('field_organization')} htmlFor="r-org" hint={t('optional')}>
            <input id="r-org" className="input" value={form.organization} onChange={set('organization')} maxLength={160} autoComplete="organization" />
          </Field>
          <Field label={t('field_phone')} htmlFor="r-phone" hint={t('optional')}>
            <input id="r-phone" type="tel" className="input" value={form.phone} onChange={set('phone')} maxLength={30} autoComplete="tel" placeholder="+94 7X XXX XXXX" />
          </Field>
        </div>
        <Field label={t('field_password')} htmlFor="r-pw" required>
          <PasswordInput id="r-pw" value={form.password} onChange={set('password')} required minLength={8} maxLength={128} autoComplete="new-password" />
          <PasswordMeter value={form.password} />
        </Field>
        <Field label={t('field_confirm_password')} htmlFor="r-pw2" required>
          <PasswordInput id="r-pw2" value={form.confirm} onChange={set('confirm')} required minLength={8} autoComplete="new-password"
            aria-invalid={Boolean(form.confirm && form.confirm !== form.password)} />
        </Field>
        {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
        <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <span className="spinner" /> : <><i className="fas fa-user-plus" /> {t('create_account')}</>}
        </button>
      </form>
      )}
      <div className="auth__links">
        <span>{t('have_account')} <Link to="/login">{t('login')}</Link></span>
      </div>
    </AuthLayout>
  );
}
