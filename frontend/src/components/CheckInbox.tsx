import { useEffect, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { errorMessage } from '../utils/errors';

const COOLDOWN_SECONDS = 60;

/** "We emailed you a link" panel with a resend button that cools down between sends. */
export default function CheckInbox({ title, body, onResend, children }: {
  title?: ReactNode;
  body: ReactNode;
  onResend?: () => Promise<unknown>;
  children?: ReactNode;
}) {
  const { t } = useApp();
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const resend = async () => {
    if (!onResend) return;
    setBusy(true);
    try {
      await onResend();
      toast.success(t('link_resent'));
      setWait(COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inbox" role="status">
      <div className="inbox__icon" aria-hidden="true"><i className="fas fa-envelope-open-text" /></div>
      <h2>{title ?? t('inbox_title')}</h2>
      <p>{body}</p>
      <p className="hint">{t('inbox_spam_hint')}</p>
      {onResend && (
        <button type="button" className="btn btn--block" onClick={resend} disabled={busy || wait > 0}>
          {busy ? <span className="spinner" /> : <><i className="fas fa-paper-plane" /> {wait > 0 ? t('resend_wait', { seconds: wait }) : t('resend_link')}</>}
        </button>
      )}
      {children}
    </div>
  );
}
