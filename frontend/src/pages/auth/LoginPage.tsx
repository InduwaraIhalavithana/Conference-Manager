import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { ApiError, api } from '../../services/api';
import { errorMessage } from '../../utils/errors';
import { Field, PasswordInput } from '../../components/ui';
import CheckInbox from '../../components/CheckInbox';
import AuthLayout from './AuthLayout';

export default function LoginPage() {
  const { t, login } = useApp();
  usePageTitle('login');
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverified('');
    setBusy(true);
    try {
      const res = await api.login({ email: form.email.trim(), password: form.password });
      const me = await api.me(res.access_token);
      login(res.access_token, me, 'organizer');
      navigate(from && !from.startsWith('/admin') ? from : '/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_not_verified') setUnverified(String(err.extra.email ?? form.email.trim()));
      else setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      icon="right-to-bracket"
      title={t('login_title')}
      subtitle={t('login_subtitle')}
      side={{ title: t('login_side_title'), points: [t('login_side_1'), t('login_side_2'), t('login_side_3'), t('login_side_4')] }}
    >
      {unverified && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <CheckInbox title={t('verify_title')} body={t('err_email_not_verified', { email: unverified })}
            onResend={() => api.resendVerification(unverified)} />
        </div>
      )}
      <form className="form" onSubmit={submit}>
        <Field label={t('field_email')} htmlFor="login-email" required>
          <div className="input-icon">
            <i className="fas fa-envelope" aria-hidden="true" />
            <input id="login-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" placeholder={t('email_placeholder')} />
          </div>
        </Field>
        <Field label={t('field_password')} htmlFor="login-pw" required>
          <PasswordInput id="login-pw" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" />
        </Field>
        <div className="row row--between">
          <span />
          <Link to="/forgot-password" className="small">{t('forgot_password')}</Link>
        </div>
        {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
        <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <span className="spinner" /> : <><i className="fas fa-right-to-bracket" /> {t('login')}</>}
        </button>
      </form>
      <div className="auth__links">
        <span>{t('no_account')} <Link to="/register">{t('register')}</Link></span>
        <span className="auth__divider" style={{ width: '100%' }}>{t('or')}</span>
        <Link to="/admin/login"><i className="fas fa-user-shield" /> {t('admin_login')}</Link>
      </div>
    </AuthLayout>
  );
}
