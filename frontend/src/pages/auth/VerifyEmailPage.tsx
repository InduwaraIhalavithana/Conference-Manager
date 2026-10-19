import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { ApiError, api } from '../../services/api';
import { errorMessage } from '../../utils/errors';
import CheckInbox from '../../components/CheckInbox';
import { Spinner } from '../../components/ui';
import AuthLayout from './AuthLayout';

/** Landing page of the link in the sign-up email: verifies the address and signs the organizer in. */
export default function VerifyEmailPage() {
  const { t, login } = useApp();
  usePageTitle('verify_title');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [error, setError] = useState<{ message: string; email?: string } | null>(null);
  // The link works once, so make sure it is only sent once (StrictMode runs effects twice).
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    (async () => {
      try {
        const res = await api.verifyEmail(token);
        const me = await api.me(res.access_token);
        login(res.access_token, me, 'organizer');
        toast.success(t('verify_done'));
        navigate('/dashboard', { replace: true });
      } catch (err) {
        const email = err instanceof ApiError && err.code === 'verify_expired' ? String(err.extra.email ?? '') : undefined;
        setError({ message: token ? errorMessage(err, t) : t('err_verify_invalid'), email });
      }
    })();
  }, [token, login, navigate, t]);

  return (
    <AuthLayout icon="envelope-circle-check" title={t('verify_title')} subtitle={t('inbox_spam_hint')}
      side={{ title: t('register_side_title'), points: [t('register_side_1'), t('register_side_2'), t('register_side_3'), t('register_side_4')] }}>
      {!error ? (
        <div className="inbox">
          <Spinner label={t('verify_working')} />
          <p>{t('verify_working')}</p>
        </div>
      ) : error.email ? (
        <CheckInbox title={t('verify_failed_title')} body={error.message} onResend={() => api.resendVerification(error.email!)} />
      ) : (
        <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> <span>{error.message}</span></div>
      )}
      <div className="auth__links">
        <Link to="/login"><i className="fas fa-arrow-left" /> {t('back_to_login')}</Link>
      </div>
    </AuthLayout>
  );
}
