import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useInterval } from '../hooks';
import { hasKey } from '../i18n';
import { relativeTime } from '../i18n/format';
import { api } from '../services/api';
import type { AppNotification } from '../types';
import { notificationIcon, notificationText } from '../utils/misc';

export default function NotificationBell() {
  const { t, lang, token } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [right, setRight] = useState(16);
  const [bump, setBump] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastUnread = useRef(0);

  const refreshCount = useCallback(() => {
    if (!token) return;
    api.unreadCount().then((r) => {
      if (r.unread > lastUnread.current) {
        setBump(true);
        window.setTimeout(() => setBump(false), 900);
      }
      lastUnread.current = r.unread;
      setUnread(r.unread);
    }).catch(() => {});
  }, [token]);

  const load = useCallback(() => {
    api.notifications(25).then((r) => {
      setItems(r.items);
      setUnread(r.unread);
      lastUnread.current = r.unread;
    }).catch(() => setItems([]));
  }, []);

  useEffect(() => { refreshCount(); }, [refreshCount]);
  useInterval(refreshCount, 30000, Boolean(token));

  useEffect(() => {
    if (!open) return;
    load();
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, load]);

  const markRead = async (n: AppNotification) => {
    if (n.is_read) return;
    setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? null);
    setUnread((u) => Math.max(0, u - 1));
    lastUnread.current = Math.max(0, lastUnread.current - 1);
    await api.markRead(n.id).catch(() => {});
  };

  const markAll = async () => {
    setItems((list) => list?.map((x) => ({ ...x, is_read: true })) ?? null);
    setUnread(0);
    lastUnread.current = 0;
    await api.markAllRead().catch(() => {});
  };

  const openItem = (n: AppNotification) => {
    markRead(n);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="nav-pop" ref={ref} data-tour="nav-bell">
      <button
        type="button"
        className={`nav-btn nav-btn--icon bell${bump ? ' bell--bump' : ''}`}
        onClick={(e) => {
          setRight(Math.max(8, window.innerWidth - e.currentTarget.getBoundingClientRect().right));
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? t('notifications_unread', { count: unread }) : t('notifications')}
        title={t('notifications')}
      >
        <i className="fas fa-bell" aria-hidden="true" />
        {unread > 0 && <span className="bell__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="nav-menu bell__panel" style={{ right }} role="dialog" aria-label={t('notifications')}>
          <div className="bell__head">
            <strong>{t('notifications')}</strong>
            {unread > 0 && (
              <button className="btn btn--ghost btn--sm" onClick={markAll}>
                <i className="fas fa-check-double" /> {t('mark_all_seen')}
              </button>
            )}
          </div>
          <div className="bell__list">
            {items === null && <div className="center" style={{ padding: 30 }}><span className="spinner" /></div>}
            {items?.length === 0 && (
              <div className="bell__empty">
                <i className="fas fa-bell-slash" aria-hidden="true" />
                <span>{t('notifications_empty')}</span>
              </div>
            )}
            {items?.map((n) => (
              <div key={n.id} className={`bell__item${n.is_read ? '' : ' bell__item--unread'}`}>
                <button className="bell__main" onClick={() => openItem(n)}>
                  <span className="bell__icon"><i className={`fas fa-${notificationIcon(n.kind)}`} aria-hidden="true" /></span>
                  <span className="bell__text">
                    <span>{notificationText(n, t, hasKey)}</span>
                    <small>{relativeTime(n.created_at, lang)}</small>
                  </span>
                </button>
                {!n.is_read && (
                  <button className="bell__seen" onClick={() => markRead(n)} title={t('mark_seen')} aria-label={t('mark_seen')}>
                    <i className="fas fa-check" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
