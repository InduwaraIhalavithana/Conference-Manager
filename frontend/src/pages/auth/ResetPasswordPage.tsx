import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { api } from '../../services/api';
import { errorMessage } from '../../utils/errors';
import { Field, PasswordInput } from '../../components/ui';
import AuthLayout from './AuthLayout';
import { PasswordMeter } from './RegisterPage';

export default function ResetPasswordPage() {
  const { t } = useApp();
  usePageTitle('reset_title');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.next !== pw.confirm) {
      setError(t('err_passwords_differ'));
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, pw.next);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      icon="lock-open"
      title={t('reset_title')}
      subtitle={t('reset_subtitle')}
      side={{ title: t('forgot_side_title'), points: [t('forgot_side_1'), t('forgot_side_2'), t('forgot_side_3')] }}
    >
      {!token ? (
        <div className="alert alert--error"><i className="fas fa-link-slash" /> {t('err_reset_invalid')}</div>
      ) : done ? (
        <div className="stack">
          <div className="alert alert--success"><i className="fas fa-circle-check" /> {t('reset_done')}</div>
          <Link to="/login" className="btn btn--primary btn--lg btn--block"><i className="fas fa-right-to-bracket" /> {t('login')}</Link>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <Field label={t('new_password')} htmlFor="rp-1" required>
            <PasswordInput id="rp-1" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} maxLength={128} autoComplete="new-password" />
            <PasswordMeter value={pw.next} />
          </Field>
          <Field label={t('field_confirm_password')} htmlFor="rp-2" required>
            <PasswordInput id="rp-2" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required minLength={8} autoComplete="new-password" />
          </Field>
          {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
          <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {busy ? <span className="spinner" /> : <><i className="fas fa-check" /> {t('reset_save')}</>}
          </button>
        </form>
      )}
      <div className="auth__links">
        <Link to="/login"><i className="fas fa-arrow-left" /> {t('back_to_login')}</Link>
      </div>
    </AuthLayout>
  );
}
