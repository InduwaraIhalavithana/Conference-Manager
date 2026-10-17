import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { api } from '../../services/api';
import { errorMessage } from '../../utils/errors';
import { Field, PasswordInput } from '../../components/ui';
import AuthLayout from './AuthLayout';

export default function AdminLoginPage() {
  const { t, login } = useApp();
  usePageTitle('admin_login');
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.adminLogin({ email: form.email.trim(), password: form.password });
      const me = await api.adminMe(res.access_token);
      login(res.access_token, me, 'admin');
      navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      admin
      icon="user-shield"
      title={t('admin_login_title')}
      subtitle={t('admin_login_subtitle')}
      side={{ title: t('admin_side_title'), points: [t('admin_side_1'), t('admin_side_2'), t('admin_side_3'), t('admin_side_4')] }}
    >
      <form className="form" onSubmit={submit}>
        <Field label={t('field_email')} htmlFor="a-email" required>
          <div className="input-icon">
            <i className="fas fa-envelope" aria-hidden="true" />
            <input id="a-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="username" placeholder="admin@example.com" />
          </div>
        </Field>
        <Field label={t('field_password')} htmlFor="a-pw" required>
          <PasswordInput id="a-pw" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" />
        </Field>
        {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
        <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <span className="spinner" /> : <><i className="fas fa-right-to-bracket" /> {t('login')}</>}
        </button>
      </form>
      <div className="auth__links">
        <Link to="/login"><i className="fas fa-arrow-left" /> {t('organizer_login')}</Link>
      </div>
    </AuthLayout>
  );
}
