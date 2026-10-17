import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { usePageTitle } from '../../hooks';
import { formatTime, todayISO } from '../../i18n/format';
import { api, type ConferenceInput, type SessionInput, type SpeakerInput } from '../../services/api';
import { CATEGORIES, SESSION_KINDS, type AgendaSession, type Conference, type Speaker } from '../../types';
import { catColor, catMeta } from '../../utils/categories';
import { errorMessage } from '../../utils/errors';
import { KIND_META } from '../../utils/sessions';
import { UPLOAD_LIMITS_MB } from '../../config';
import ConferenceCard from '../../components/ConferenceCard';
import CustomSelect from '../../components/CustomSelect';
import DatePicker, { TimeSelect } from '../../components/DatePicker';
import ImageUpload from '../../components/ImageUpload';
import { HelpButton } from '../../components/Tour';
import { Avatar, ConfirmModal, EmptyState, Field, Modal, PageHead, Skeleton, Spinner } from '../../components/ui';
import './Organizer.css';

const MapPicker = lazy(() => import('../../components/VenueMap').then((m) => ({ default: m.MapPicker })));

type Tab = 'details' | 'cover' | 'agenda' | 'speakers';

/** A few Sri Lankan venues to drop the pin quickly; the organizer can then drag it exactly. */
const QUICK_PLACES: { name: string; lat: number; lng: number }[] = [
  { name: 'Colombo', lat: 6.9271, lng: 79.8612 },
  { name: 'Kandy', lat: 7.2906, lng: 80.6337 },
  { name: 'Galle', lat: 6.0535, lng: 80.221 },
  { name: 'Jaffna', lat: 9.6615, lng: 80.0255 },
  { name: 'Negombo', lat: 7.2083, lng: 79.8358 },
  { name: 'Kurunegala', lat: 7.4863, lng: 80.3647 },
];

interface FormState {
  title: string;
  description: string;
  date: string;
  time: string;
  end_time: string;
  location: string;
  venue_lat: number | null;
  venue_lng: number | null;
  max_attendees: string;
  status: 'published' | 'draft';
  category: string;
}

const EMPTY: FormState = {
  title: '', description: '', date: '', time: '', end_time: '', location: '', venue_lat: null, venue_lng: null,
  max_attendees: '', status: 'published', category: '',
};

function fromConference(c: Conference): FormState {
  return {
    title: c.title,
    description: c.description ?? '',
    date: c.date,
    time: c.time?.slice(0, 5) ?? '',
    end_time: c.end_time?.slice(0, 5) ?? '',
    location: c.location ?? '',
    venue_lat: c.venue_lat,
    venue_lng: c.venue_lng,
    max_attendees: c.max_attendees ? String(c.max_attendees) : '',
    status: c.status,
    category: c.category ?? '',
  };
}

function toInput(f: FormState): ConferenceInput {
  return {
    title: f.title.trim(),
    description: f.description.trim() || null,
    date: f.date,
    time: f.time || null,
    end_time: f.end_time || null,
    location: f.location.trim() || null,
    venue_lat: f.venue_lat,
    venue_lng: f.venue_lng,
    max_attendees: f.max_attendees ? Number(f.max_attendees) : null,
    status: f.status,
    category: f.category || null,
  };
}

export default function ConferenceEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'details';
  const [conf, setConf] = useState<Conference | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sessions, setSessions] = useState<AgendaSession[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  usePageTitle(isNew ? 'new_conference' : 'edit_conference', conf?.title);

  useEffect(() => {
    if (isNew) { setConf(null); setForm(EMPTY); setLoading(false); return; }
    setLoading(true);
    api.myConference(id!)
      .then((d) => {
        setConf(d.conference);
        setForm(fromConference(d.conference));
        setSpeakers(d.speakers);
        setSessions(d.sessions);
      })
      .catch(() => setConf(null))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const setTab = (next: Tab) => setParams(next === 'details' ? {} : { tab: next }, { replace: true });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!form.title.trim() || !form.date) {
      setError(t('err_title_date_required'));
      return;
    }
    if (form.time && form.end_time && form.end_time <= form.time) {
      setError(t('err_end_before_start'));
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.createConference(toInput(form));
        toast.success(t('conf_created'));
        navigate(`/my-conferences/${created.id}/edit?tab=cover`, { replace: true });
      } else {
        const updated = await api.updateConference(conf!.id, toInput(form));
        setConf(updated);
        setForm(fromConference(updated));
        toast.success(t('saved'));
      }
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  // Live preview of the public card, built from the form as it is now.
  const preview: Conference = useMemo(() => ({
    id: conf?.id ?? 0,
    organizer_id: conf?.organizer_id ?? 0,
    title: form.title || t('untitled_conference'),
    description: form.description || null,
    date: form.date || todayISO(),
    time: form.time ? `${form.time}:00` : null,
    end_time: form.end_time ? `${form.end_time}:00` : null,
    location: form.location || null,
    venue_lat: form.venue_lat,
    venue_lng: form.venue_lng,
    max_attendees: form.max_attendees ? Number(form.max_attendees) : null,
    status: form.status,
    category: (form.category || null) as Conference['category'],
    cover_image: conf?.cover_image ?? null,
    created_at: '',
    attendee_count: conf?.attendee_count ?? 0,
    waitlist_count: conf?.waitlist_count ?? 0,
    checked_in_count: conf?.checked_in_count ?? 0,
    speaker_count: speakers.length,
    session_count: sessions.length,
    organizer_name: conf?.organizer_name ?? '',
    organizer_avatar: conf?.organizer_avatar ?? null,
    organizer_organization: null,
  }), [form, conf, speakers.length, sessions.length, t]);

  if (loading) return <Spinner />;
  if (!isNew && !conf) {
    return (
      <div className="container page">
        <EmptyState icon="calendar-xmark" title={t('conf_not_found')} message={t('conf_not_yours')}>
          <Link to="/my-conferences" className="btn btn--primary"><i className="fas fa-arrow-left" /> {t('nav_my_conferences')}</Link>
        </EmptyState>
      </div>
    );
  }

  const tabs: { id: Tab; icon: string; label: string; count?: number }[] = [
    { id: 'details', icon: 'file-pen', label: t('tab_details') },
    { id: 'cover', icon: 'image', label: t('tab_cover') },
    { id: 'agenda', icon: 'list-ol', label: t('agenda'), count: sessions.length },
    { id: 'speakers', icon: 'microphone', label: t('speakers'), count: speakers.length },
  ];

  return (
    <div className="container page">
      <PageHead icon={isNew ? 'calendar-plus' : 'pen-to-square'} title={isNew ? t('new_conference') : t('edit_conference')}
        subtitle={isNew ? t('new_conference_sub') : conf!.title}>
        {!isNew && (
          <>
            <Link to={`/attendees/${conf!.id}`} className="btn"><i className="fas fa-users" /> {t('attendees')}</Link>
            {conf!.status === 'published' && <Link to={`/conferences/${conf!.id}`} className="btn"><i className="fas fa-eye" /> {t('view_public')}</Link>}
          </>
        )}
      </PageHead>

      <div className="tabs editor-tabs" role="tablist" data-tour="ed-tabs">
        {tabs.map((tb) => (
          <button key={tb.id} role="tab" className="tab" aria-selected={tab === tb.id} disabled={isNew && tb.id !== 'details'}
            title={isNew && tb.id !== 'details' ? t('save_first') : undefined} onClick={() => setTab(tb.id)}>
            <i className={`fas fa-${tb.icon}`} /> {tb.label}
            {tb.count !== undefined && <span className="count">{tb.count}</span>}
          </button>
        ))}
      </div>

      <div className="editor-grid">
        <div>
          {tab === 'details' && (
            <form className="stack" onSubmit={save} style={{ gap: 18 }}>
              <section className="card form">
                <h2 className="card__title"><i className="fas fa-circle-info" /> {t('basics')}</h2>
                <Field label={t('field_title')} htmlFor="e-title" required>
                  <input id="e-title" className="input" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={255} required placeholder={t('title_placeholder')} />
                </Field>
                <Field label={t('field_description')} htmlFor="e-desc" hint={t('chars_left', { count: 5000 - form.description.length })}>
                  <textarea id="e-desc" className="textarea" rows={6} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} placeholder={t('description_placeholder')} />
                </Field>
                <Field label={t('field_category')} htmlFor="e-cat">
                  <CustomSelect id="e-cat" value={form.category} onChange={(v) => set('category', v)} ariaLabel={t('field_category')}
                    options={[{ value: '', label: t('no_category'), icon: 'minus' }, ...CATEGORIES.map((c) => ({ value: c, label: t(catMeta(c).key), icon: catMeta(c).icon, color: catColor(c) }))]} />
                </Field>
              </section>

              <section className="card form">
                <h2 className="card__title"><i className="fas fa-clock" /> {t('when')}</h2>
                <div className="form-row">
                  <Field label={t('field_date')} htmlFor="e-date" required>
                    <DatePicker id="e-date" value={form.date} onChange={(v) => set('date', v)} ariaLabel={t('field_date')} />
                  </Field>
                  <Field label={t('field_start_time')} htmlFor="e-time">
                    <TimeSelect id="e-time" value={form.time} onChange={(v) => set('time', v)} ariaLabel={t('field_start_time')} />
                  </Field>
                  <Field label={t('field_end_time')} htmlFor="e-end">
                    <TimeSelect id="e-end" value={form.end_time} onChange={(v) => set('end_time', v)} ariaLabel={t('field_end_time')} />
                  </Field>
                </div>
              </section>

              <section className="card form" data-tour="ed-capacity">
                <h2 className="card__title"><i className="fas fa-chair" /> {t('capacity_and_status')}</h2>
                <div className="form-row">
                  <Field label={t('field_max_attendees')} htmlFor="e-max" hint={t('max_attendees_hint')}>
                    <input id="e-max" className="input" type="number" min={1} max={100000} value={form.max_attendees}
                      onChange={(e) => set('max_attendees', e.target.value)} placeholder={t('no_limit')} />
                  </Field>
                  <Field label={t('field_status')}>
                    <div className="seg" data-tour="ed-status" role="group" aria-label={t('field_status')}>
                      <button type="button" aria-pressed={form.status === 'published'} onClick={() => set('status', 'published')}>
                        <i className="fas fa-globe" /> {t('status_published')}
                      </button>
                      <button type="button" className="is-draft" aria-pressed={form.status === 'draft'} onClick={() => set('status', 'draft')}>
                        <i className="fas fa-pen-ruler" /> {t('status_draft')}
                      </button>
                    </div>
                    <span className="hint">{form.status === 'draft' ? t('draft_hint') : t('published_hint')}</span>
                  </Field>
                </div>
              </section>

              <section className="card form" data-tour="ed-map">
                <h2 className="card__title"><i className="fas fa-map-location-dot" /> {t('venue')}</h2>
                <Field label={t('field_location')} htmlFor="e-loc" hint={t('location_hint')}>
                  <input id="e-loc" className="input" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={255} placeholder={t('location_placeholder')} />
                </Field>
                <div className="row" style={{ gap: 8 }}>
                  <span className="small text-2">{t('quick_pin')}</span>
                  {QUICK_PLACES.map((p) => (
                    <button key={p.name} type="button" className="chip" onClick={() => setForm((f) => ({ ...f, venue_lat: p.lat, venue_lng: p.lng, location: f.location || `${p.name}, Sri Lanka` }))}>
                      <i className="fas fa-location-dot" /> {p.name}
                    </button>
                  ))}
                  {form.venue_lat !== null && (
                    <button type="button" className="chip chip--danger" onClick={() => setForm((f) => ({ ...f, venue_lat: null, venue_lng: null }))}>
                      <i className="fas fa-xmark" /> {t('remove_pin')}
                    </button>
                  )}
                </div>
                <Suspense fallback={<Skeleton h={320} r={14} />}>
                  <MapPicker lat={form.venue_lat} lng={form.venue_lng} onPick={(lat, lng) => setForm((f) => ({ ...f, venue_lat: lat, venue_lng: lng }))} />
                </Suspense>
                <span className="hint">{form.venue_lat !== null ? t('pin_set', { lat: form.venue_lat.toFixed(4), lng: form.venue_lng!.toFixed(4) }) : t('pin_hint')}</span>
              </section>

              {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
              <div className="row" data-tour="ed-save">
                <button className="btn btn--primary btn--lg" disabled={saving}>
                  {saving ? <span className="spinner" /> : <><i className="fas fa-floppy-disk" /> {isNew ? t('create_conference') : t('save_changes')}</>}
                </button>
                <Link to="/my-conferences" className="btn btn--lg btn--ghost">{t('cancel')}</Link>
              </div>
            </form>
          )}

          {tab === 'cover' && conf && (
            <section className="card stack">
              <h2 className="card__title"><i className="fas fa-image" /> {t('tab_cover')}</h2>
              <p className="text-2">{t('cover_help')}</p>
              <ImageUpload shape="wide" current={conf.cover_image} maxMb={UPLOAD_LIMITS_MB.cover}
                onUpload={async (f) => setConf(await api.uploadCover(conf.id, f))}
                onRemove={async () => setConf(await api.removeCover(conf.id))}
                placeholder={<span className="stack" style={{ alignItems: 'center', gap: 6, fontSize: '1rem' }}><i className="fas fa-image" style={{ fontSize: '2.4rem' }} />{t('cover_drop')}</span>} />
              <div className="row">
                <button className="btn btn--primary" onClick={() => setTab('agenda')}>{t('next_agenda')} <i className="fas fa-arrow-right" /></button>
              </div>
            </section>
          )}

          {tab === 'agenda' && conf && (
            <AgendaEditor conf={conf} sessions={sessions} speakers={speakers} onChange={setSessions} />
          )}

          {tab === 'speakers' && conf && (
            <SpeakersEditor conf={conf} speakers={speakers} onChange={setSpeakers} />
          )}
        </div>

        <aside className="editor-preview">
          <h3 className="small muted" style={{ marginBottom: 10 }}><i className="fas fa-eye" /> {t('live_preview')}</h3>
          <div style={{ pointerEvents: 'none' }}><ConferenceCard conf={preview} /></div>
        </aside>
      </div>
      <HelpButton tour="editor" />
    </div>
  );
}

/* ── Agenda ─────────────────────────────────────────────────────────────── */

const EMPTY_SESSION: SessionInput = { title: '', description: null, start_time: '09:00', end_time: null, room: null, kind: 'talk', speaker_id: null };

function AgendaEditor({ conf, sessions, speakers, onChange }: {
  conf: Conference; sessions: AgendaSession[]; speakers: Speaker[]; onChange: (s: AgendaSession[]) => void;
}) {
  const { t, lang } = useApp();
  const [editing, setEditing] = useState<{ id: number | null; data: SessionInput } | null>(null);
  const [toDelete, setToDelete] = useState<AgendaSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sorted = [...sessions].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const speakerName = useCallback((sid: number | null) => speakers.find((s) => s.id === sid)?.name, [speakers]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    const d = editing.data;
    if (d.end_time && d.end_time <= d.start_time) { setError(t('err_end_before_start')); return; }
    setBusy(true);
    try {
      const body = { ...d, title: d.title.trim(), room: d.room?.trim() || null, description: d.description?.trim() || null };
      if (editing.id) {
        const saved = await api.updateSession(conf.id, editing.id, body);
        onChange(sessions.map((s) => (s.id === saved.id ? saved : s)));
      } else {
        onChange([...sessions, await api.addSession(conf.id, body)]);
      }
      setEditing(null);
      toast.success(t('saved'));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteSession(conf.id, toDelete.id);
      onChange(sessions.filter((s) => s.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const d = editing?.data;
  return (
    <section className="card">
      <div className="card__title"><i className="fas fa-list-ol" /> {t('agenda')}<span className="spacer" />
        <button className="btn btn--primary btn--sm" onClick={() => { setError(''); setEditing({ id: null, data: { ...EMPTY_SESSION } }); }}>
          <i className="fas fa-plus" /> {t('add_session')}
        </button>
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon="list-ol" title={t('agenda_empty_title')} message={t('agenda_empty_body')}>
          <button className="btn btn--primary" onClick={() => setEditing({ id: null, data: { ...EMPTY_SESSION } })}><i className="fas fa-plus" /> {t('add_session')}</button>
        </EmptyState>
      ) : (
        <div className="agenda-edit stagger">
          {sorted.map((s) => {
            const k = KIND_META[s.kind] ?? KIND_META.talk;
            return (
              <div key={s.id} className="agenda-edit__row">
                <div className="agenda-edit__time">
                  {formatTime(s.start_time, lang)}
                  {s.end_time && <small>{formatTime(s.end_time, lang)}</small>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="chip chip--accent"><i className={`fas fa-${k.icon}`} /> {t(k.key)}</span>
                    {s.room && <span className="chip"><i className="fas fa-door-open" /> {s.room}</span>}
                  </div>
                  <strong style={{ display: 'block', marginTop: 4 }}>{s.title}</strong>
                  {speakerName(s.speaker_id) && <span className="small text-2"><i className="fas fa-microphone" /> {speakerName(s.speaker_id)}</span>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--sm btn--icon" aria-label={t('edit')} title={t('edit')}
                    onClick={() => { setError(''); setEditing({ id: s.id, data: { title: s.title, description: s.description, start_time: s.start_time.slice(0, 5), end_time: s.end_time?.slice(0, 5) ?? null, room: s.room, kind: s.kind, speaker_id: s.speaker_id } }); }}>
                    <i className="fas fa-pen" />
                  </button>
                  <button className="btn btn--sm btn--icon btn--danger" aria-label={t('delete')} title={t('delete')} onClick={() => setToDelete(s)}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && d && (
        <Modal title={editing.id ? t('edit_session') : t('add_session')} icon="list-ol" onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEditing(null)}>{t('cancel')}</button>
            <button className="btn btn--primary" form="session-form" disabled={busy}>{busy ? <span className="spinner" /> : <><i className="fas fa-floppy-disk" /> {t('save')}</>}</button>
          </>}>
          <form id="session-form" className="form" onSubmit={submit}>
            <Field label={t('field_title')} htmlFor="s-title" required>
              <input id="s-title" className="input" value={d.title} onChange={(e) => setEditing({ ...editing, data: { ...d, title: e.target.value } })} required maxLength={255} />
            </Field>
            <div className="form-row">
              <Field label={t('field_kind')} htmlFor="s-kind">
                <CustomSelect id="s-kind" value={d.kind} ariaLabel={t('field_kind')} onChange={(v) => setEditing({ ...editing, data: { ...d, kind: v } })}
                  options={SESSION_KINDS.map((k) => ({ value: k, label: t(KIND_META[k].key), icon: KIND_META[k].icon }))} />
              </Field>
              <Field label={t('field_room')} htmlFor="s-room">
                <input id="s-room" className="input" value={d.room ?? ''} onChange={(e) => setEditing({ ...editing, data: { ...d, room: e.target.value } })} maxLength={120} placeholder={t('room_placeholder')} />
              </Field>
            </div>
            <div className="form-row">
              <Field label={t('field_start_time')} htmlFor="s-start" required>
                <TimeSelect id="s-start" allowEmpty={false} value={d.start_time} onChange={(v) => setEditing({ ...editing, data: { ...d, start_time: v } })} />
              </Field>
              <Field label={t('field_end_time')} htmlFor="s-end">
                <TimeSelect id="s-end" value={d.end_time ?? ''} onChange={(v) => setEditing({ ...editing, data: { ...d, end_time: v || null } })} />
              </Field>
            </div>
            <Field label={t('field_speaker')} htmlFor="s-speaker" hint={speakers.length === 0 ? t('add_speakers_first') : undefined}>
              <CustomSelect id="s-speaker" value={d.speaker_id ? String(d.speaker_id) : ''} ariaLabel={t('field_speaker')}
                onChange={(v) => setEditing({ ...editing, data: { ...d, speaker_id: v ? Number(v) : null } })}
                options={[{ value: '', label: t('no_speaker') }, ...speakers.map((s) => ({ value: String(s.id), label: s.name }))]} />
            </Field>
            <Field label={t('field_description')} htmlFor="s-desc">
              <textarea id="s-desc" className="textarea" rows={3} value={d.description ?? ''} onChange={(e) => setEditing({ ...editing, data: { ...d, description: e.target.value } })} maxLength={2000} />
            </Field>
            {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
          </form>
        </Modal>
      )}
      {toDelete && (
        <ConfirmModal danger title={t('delete_session')} message={t('delete_session_body', { title: toDelete.title })} confirmLabel={t('delete')}
          busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
      )}
    </section>
  );
}

/* ── Speakers ───────────────────────────────────────────────────────────── */

const EMPTY_SPEAKER: SpeakerInput = { name: '', job_title: null, organization: null, bio: null, position: 0 };

function SpeakersEditor({ conf, speakers, onChange }: { conf: Conference; speakers: Speaker[]; onChange: (s: Speaker[]) => void }) {
  const { t } = useApp();
  const [editing, setEditing] = useState<{ id: number | null; data: SpeakerInput } | null>(null);
  const [toDelete, setToDelete] = useState<Speaker | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = editing?.id ? speakers.find((s) => s.id === editing.id) : undefined;

  const replace = (s: Speaker) => onChange(speakers.map((x) => (x.id === s.id ? s : x)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    setBusy(true);
    const d = editing.data;
    const body = { ...d, name: d.name.trim(), job_title: d.job_title?.trim() || null, organization: d.organization?.trim() || null, bio: d.bio?.trim() || null };
    try {
      if (editing.id) {
        replace(await api.updateSpeaker(conf.id, editing.id, body));
        setEditing(null);
      } else {
        const created = await api.addSpeaker(conf.id, { ...body, position: speakers.length });
        onChange([...speakers, created]);
        // Stay open so a photo can be added straight away.
        setEditing({ id: created.id, data: { name: created.name, job_title: created.job_title, organization: created.organization, bio: created.bio, position: created.position } });
      }
      toast.success(t('saved'));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteSpeaker(conf.id, toDelete.id);
      onChange(speakers.filter((s) => s.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const d = editing?.data;
  return (
    <section className="card">
      <div className="card__title"><i className="fas fa-microphone" /> {t('speakers')}<span className="spacer" />
        <button className="btn btn--primary btn--sm" onClick={() => { setError(''); setEditing({ id: null, data: { ...EMPTY_SPEAKER } }); }}>
          <i className="fas fa-plus" /> {t('add_speaker')}
        </button>
      </div>
      {speakers.length === 0 ? (
        <EmptyState icon="microphone" title={t('speakers_empty_title')} message={t('speakers_empty_body')}>
          <button className="btn btn--primary" onClick={() => setEditing({ id: null, data: { ...EMPTY_SPEAKER } })}><i className="fas fa-plus" /> {t('add_speaker')}</button>
        </EmptyState>
      ) : (
        <div className="speaker-edit stagger">
          {speakers.map((s) => (
            <div key={s.id} className="speaker-edit__card">
              <Avatar name={s.name} src={s.photo} size={64} />
              <div>
                <strong>{s.name}</strong>
                <div className="small text-2">{[s.job_title, s.organization].filter(Boolean).join(' · ') || t('no_role')}</div>
                {!s.photo && <div className="small" style={{ color: 'var(--warning)', marginTop: 4 }}><i className="fas fa-camera" /> {t('no_photo_yet')}</div>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn--sm btn--icon" aria-label={t('edit')} title={t('edit')}
                  onClick={() => { setError(''); setEditing({ id: s.id, data: { name: s.name, job_title: s.job_title, organization: s.organization, bio: s.bio, position: s.position } }); }}>
                  <i className="fas fa-pen" />
                </button>
                <button className="btn btn--sm btn--icon btn--danger" aria-label={t('delete')} title={t('delete')} onClick={() => setToDelete(s)}>
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && d && (
        <Modal title={editing.id ? t('edit_speaker') : t('add_speaker')} icon="microphone" onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEditing(null)}>{editing.id ? t('close') : t('cancel')}</button>
            <button className="btn btn--primary" form="speaker-form" disabled={busy}>{busy ? <span className="spinner" /> : <><i className="fas fa-floppy-disk" /> {t('save')}</>}</button>
          </>}>
          <form id="speaker-form" className="form" onSubmit={submit}>
            {current ? (
              <Field label={t('photo')}>
                <ImageUpload shape="round" current={current.photo} maxMb={UPLOAD_LIMITS_MB.speaker}
                  onUpload={async (f) => replace(await api.uploadSpeakerPhoto(conf.id, current.id, f))}
                  onRemove={async () => replace(await api.removeSpeakerPhoto(conf.id, current.id))}
                  placeholder={<Avatar name={current.name} size={124} />} />
              </Field>
            ) : <p className="hint"><i className="fas fa-camera" /> {t('photo_after_save')}</p>}
            <Field label={t('field_name')} htmlFor="sp-name" required>
              <input id="sp-name" className="input" value={d.name} onChange={(e) => setEditing({ ...editing, data: { ...d, name: e.target.value } })} required maxLength={160} />
            </Field>
            <div className="form-row">
              <Field label={t('field_job_title')} htmlFor="sp-job">
                <input id="sp-job" className="input" value={d.job_title ?? ''} onChange={(e) => setEditing({ ...editing, data: { ...d, job_title: e.target.value } })} maxLength={160} />
              </Field>
              <Field label={t('field_organization')} htmlFor="sp-org">
                <input id="sp-org" className="input" value={d.organization ?? ''} onChange={(e) => setEditing({ ...editing, data: { ...d, organization: e.target.value } })} maxLength={160} />
              </Field>
            </div>
            <Field label={t('field_bio')} htmlFor="sp-bio">
              <textarea id="sp-bio" className="textarea" rows={4} value={d.bio ?? ''} onChange={(e) => setEditing({ ...editing, data: { ...d, bio: e.target.value } })} maxLength={2000} />
            </Field>
            {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> {error}</div>}
          </form>
        </Modal>
      )}
      {toDelete && (
        <ConfirmModal danger title={t('delete_speaker')} message={t('delete_speaker_body', { name: toDelete.name })} confirmLabel={t('delete')}
          busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
      )}
    </section>
  );
}
