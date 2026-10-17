import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { api } from '../../services/api';
import { errorMessage } from '../../utils/errors';
import { Field } from '../../components/ui';
import AuthLayout from './AuthLayout';

export default function ForgotPasswordPage() {
  const { t } = useApp();
  usePageTitle('forgot_password');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      icon="key"
      title={t('forgot_title')}
      subtitle={t('forgot_subtitle')}
      side={{ title: t('forgot_side_title'), points: [t('forgot_side_1'), t('forgot_side_2'), t('forgot_side_3')] }}
    >
      {sent ? (
        <div className="alert alert--success" role="status">
          <i className="fas fa-envelope-circle-check" />
          <span>{t('forgot_sent', { email })}</span>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <Field label={t('field_email')} htmlFor="f-email" required>
            <div className="input-icon">
              <i className="fas fa-envelope" aria-hidden="true" />
              <input id="f-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder={t('email_placeholder')} />
            </div>
          </Field>
          {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
          <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {busy ? <span className="spinner" /> : <><i className="fas fa-paper-plane" /> {t('send_reset_link')}</>}
          </button>
        </form>
      )}
      <div className="auth__links">
        <Link to="/login"><i className="fas fa-arrow-left" /> {t('back_to_login')}</Link>
      </div>
    </AuthLayout>
  );
}
