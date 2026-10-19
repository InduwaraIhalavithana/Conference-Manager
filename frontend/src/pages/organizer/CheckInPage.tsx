import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useInterval, usePageTitle } from '../../hooks';
import { formatDate, formatDateTime, relativeTime } from '../../i18n/format';
import { api, ApiError } from '../../services/api';
import type { Attendee, Conference } from '../../types';
import { errorMessage } from '../../utils/errors';
import CustomSelect from '../../components/CustomSelect';
import { QrScanner } from '../../components/QR';
import { HelpButton } from '../../components/Tour';
import { Avatar, EmptyState, PageHead, Spinner } from '../../components/ui';
import './Organizer.css';

type Result = { tone: 'ok' | 'warn' | 'err'; title: string; body: string };

export default function CheckInPage() {
  const { confId } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useApp();
  usePageTitle('nav_check_in');
  const [options, setOptions] = useState<Conference[] | null>(null);
  const [conf, setConf] = useState<Conference | null>(null);
  const [people, setPeople] = useState<Attendee[]>([]);
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    api.myConferences({ when: 'upcoming', per_page: 100 }).then((r) => setOptions(r.items)).catch(() => setOptions([]));
  }, []);

  const refresh = useCallback(() => {
    if (!confId) return;
    api.attendees(confId).then(setPeople).catch(() => {});
  }, [confId]);

  useEffect(() => {
    setConf(null);
    setResult(null);
    if (!confId) return;
    api.myConference(confId).then((d) => setConf(d.conference)).catch(() => navigate('/check-in', { replace: true }));
    refresh();
  }, [confId, navigate, refresh]);

  // Other devices at the door may be checking people in too.
  useInterval(refresh, 15000, Boolean(confId));

  const registered = people.filter((p) => p.status === 'registered');
  const checked = useMemo(
    () => registered.filter((p) => p.checked_in_at).sort((a, b) => (b.checked_in_at ?? '').localeCompare(a.checked_in_at ?? '')),
    [registered],
  );

  const checkIn = useCallback(async (raw: string) => {
    if (!conf || busyRef.current || !raw.trim()) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const a = await api.checkIn(conf.id, raw);
      setResult({ tone: 'ok', title: t('ci_welcome', { name: a.name }), body: t('ci_ok_body') });
      setPeople((list) => list.map((p) => (p.id === a.id ? a : p)));
      setCode('');
      navigator.vibrate?.(80);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'already_checked_in') {
        setResult({ tone: 'warn', title: t('ci_already', { name: String(err.extra.name ?? '') }),
          body: err.extra.checked_in_at ? t('ci_already_at', { time: formatDateTime(String(err.extra.checked_in_at), lang) }) : '' });
      } else if (err instanceof ApiError && err.code === 'ticket_unconfirmed') {
        setResult({ tone: 'warn', title: t('ci_unconfirmed', { name: String(err.extra.name ?? '') }), body: t('ci_unconfirmed_body') });
      } else if (err instanceof ApiError && err.code === 'ticket_waitlisted') {
        setResult({ tone: 'warn', title: t('ci_waitlisted', { name: String(err.extra.name ?? '') }), body: t('ci_waitlisted_body') });
      } else {
        setResult({ tone: 'err', title: t('ci_not_found'), body: errorMessage(err, t) });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [conf, t, lang]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    checkIn(code);
  };

  const picker = (
    <div data-tour="ci-pick" style={{ minWidth: 'min(280px, 100%)', flex: 1 }}>
      <CustomSelect
        value={confId ?? ''}
        onChange={(v) => navigate(`/check-in/${v}`)}
        placeholder={t('ci_pick')}
        icon="calendar-day"
        ariaLabel={t('ci_pick')}
        options={(options ?? []).map((c) => ({ value: String(c.id), label: `${c.title} · ${formatDate(c.date, lang, 'month-day')}` }))}
      />
    </div>
  );

  if (!confId) {
    return (
      <div className="container page">
        <PageHead icon="qrcode" title={t('nav_check_in')} subtitle={t('ci_sub')} />
        {!options ? <Spinner /> : options.length === 0 ? (
          <EmptyState icon="calendar-xmark" title={t('ci_none_title')} message={t('ci_none_body')}>
            <Link to="/my-conferences/new" className="btn btn--primary"><i className="fas fa-plus" /> {t('new_conference')}</Link>
          </EmptyState>
        ) : (
          <div className="card stack">
            <h2 className="card__title"><i className="fas fa-calendar-day" /> {t('ci_pick')}</h2>
            {picker}
            <div className="grid grid-3" style={{ marginTop: 8 }}>
              {options.slice(0, 6).map((c) => (
                <Link key={c.id} to={`/check-in/${c.id}`} className="quick card--hover">
                  <span className="quick__icon"><i className="fas fa-qrcode" /></span>
                  <strong>{c.title}</strong>
                  <span>{formatDate(c.date, lang, 'long')} · {t('n_registered', { count: c.attendee_count })}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <HelpButton tour="checkIn" />
      </div>
    );
  }

  if (!conf) return <Spinner />;
  const pct = registered.length ? Math.round((checked.length / registered.length) * 100) : 0;

  return (
    <div className="container page">
      <PageHead icon="qrcode" title={t('nav_check_in')} subtitle={<>{conf.title} · {formatDate(conf.date, lang, 'long')}</>}>
        {picker}
      </PageHead>

      <div className="ci-grid">
        <div className="stack">
          <section className="card stack" data-tour="ci-scan">
            <div className="card__title" style={{ margin: 0 }}><i className="fas fa-camera" /> {t('ci_scan')}<span className="spacer" />
              <button className={`btn btn--sm${camera ? ' btn--danger' : ' btn--primary'}`} onClick={() => setCamera((c) => !c)}>
                <i className={`fas fa-${camera ? 'video-slash' : 'video'}`} /> {camera ? t('ci_camera_off') : t('ci_camera_on')}
              </button>
            </div>
            {camera ? <QrScanner onCode={checkIn} paused={busy} /> : (
              <div className="scanner scanner--idle" style={{ background: 'var(--surface-2)' }}>
                <div className="scanner__msg" style={{ color: 'var(--text-3)' }}>
                  <i className="fas fa-qrcode" />
                  <span>{t('ci_camera_hint')}</span>
                </div>
              </div>
            )}
          </section>

          {result && (
            <div className={`ci-result ci-result--${result.tone}`} role="status" aria-live="assertive">
              <i className={`fas fa-${result.tone === 'ok' ? 'circle-check' : result.tone === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}`} />
              <div><strong>{result.title}</strong>{result.body && <span>{result.body}</span>}</div>
            </div>
          )}

          <form className="card form" onSubmit={submit} data-tour="ci-manual">
            <h2 className="card__title" style={{ margin: 0 }}><i className="fas fa-keyboard" /> {t('ci_manual')}</h2>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="input att-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AB3D5FG7HJ"
                aria-label={t('ticket_code')} autoComplete="off" spellCheck={false} maxLength={40} />
              <button className="btn btn--primary" disabled={busy || !code.trim()}>
                {busy ? <span className="spinner" /> : <><i className="fas fa-check" /> {t('check_in')}</>}
              </button>
            </div>
            <span className="hint">{t('ci_manual_hint')}</span>
          </form>
        </div>

        <div className="stack">
          <section className="card stack">
            <div className="ci-big"><strong>{checked.length}</strong><span>/ {registered.length} {t('checked_in')}</span></div>
            <div className="bar bar--success"><span style={{ width: `${pct}%` }} /></div>
            <span className="text-2">{t('ci_progress', { pct, left: registered.length - checked.length })}</span>
          </section>
          <section className="card" data-tour="ci-recent">
            <h2 className="card__title"><i className="fas fa-clock-rotate-left" /> {t('ci_recent')}<span className="spacer" />
              <Link to={`/attendees/${conf.id}`} className="btn btn--sm btn--ghost">{t('attendees')} <i className="fas fa-arrow-right" /></Link>
            </h2>
            {checked.length === 0 ? <p className="muted">{t('ci_recent_empty')}</p> : (
              <ul className="ci-recent">
                {checked.slice(0, 30).map((p) => (
                  <li key={p.id}>
                    <Avatar name={p.name} size={36} />
                    <span><strong>{p.name}</strong><br /><small className="muted">{p.email}</small></span>
                    <small className="muted nowrap">{relativeTime(p.checked_in_at!, lang)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <HelpButton tour="checkIn" />
    </div>
  );
}
