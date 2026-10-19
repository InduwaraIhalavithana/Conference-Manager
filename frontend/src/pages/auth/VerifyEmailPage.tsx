import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { api } from '../../services/api';
import CheckInbox from '../../components/CheckInbox';
import CodeEntry from '../../components/CodeEntry';
import { Field } from '../../components/ui';
import AuthLayout from './AuthLayout';

/** Where the button in the verification email leads: enter the 6-digit code (for anyone who closed the sign-up page). */
export default function VerifyEmailPage() {
  const { t, login } = useApp();
  usePageTitle('verify_title');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');

  const verify = async (code: string) => {
    const res = await api.verifyEmail(email.trim(), code);
    login(res.access_token, await api.me(res.access_token), 'organizer');
    toast.success(t('verify_done'));
    navigate('/dashboard', { replace: true });
  };

  return (
    <AuthLayout icon="envelope-circle-check" title={t('verify_title')} subtitle={t('verify_page_body')}
      side={{ title: t('register_side_title'), points: [t('register_side_1'), t('register_side_2'), t('register_side_3'), t('register_side_4')] }}>
      <Field label={t('field_email')} htmlFor="v-email" required>
        <div className="input-icon">
          <i className="fas fa-envelope" aria-hidden="true" />
          <input id="v-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email" placeholder={t('email_placeholder')} />
        </div>
      </Field>
      <CheckInbox onResend={email.includes('@') ? () => api.resendVerification(email.trim()) : undefined}>
        <CodeEntry onSubmit={verify} />
      </CheckInbox>
      <div className="auth__links">
        <Link to="/login"><i className="fas fa-arrow-left" /> {t('back_to_login')}</Link>
      </div>
    </AuthLayout>
  );
}
