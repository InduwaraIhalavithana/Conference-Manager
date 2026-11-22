"use client";

import { Clock, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "urql";

import { ErrorNote, Field, type FormError, SubmitButton } from "@/components/auth/fields";
import { RemoveSession, RemoveTrack, SetDayLabel, UpsertSession, UpsertTrack } from "@/components/organizer/conference-queries";
import { ConfirmDialog, LocalizedField, type Texts, textsFrom, textsInput } from "@/components/organizer/editor-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EditorConferenceFieldsFragment, SessionKind } from "@/graphql/generated/graphql";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { formatDay, localized } from "@/lib/format";
import { dayAndTime, timeOf } from "@/lib/local-time";
import { cn } from "@/lib/utils";

type Conf = EditorConferenceFieldsFragment;
type Session = Conf["sessions"][number];
const KINDS: SessionKind[] = ["KEYNOTE", "TALK", "WORKSHOP", "PANEL", "BREAK"];
const SELECT =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function AgendaEditor({ conference: c, reload }: { conference: Conf; reload: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [editing, setEditing] = useState<{ session: Session | null; day: string } | null>(null);

  return (
    <div className="space-y-6">
      <TracksEditor conference={c} reload={reload} />
      {c.days.map((day, i) => {
        const sessions = c.sessions.filter((s) => s.day === day.date).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        return (
          <section key={day.date} className="rounded-2xl border bg-card p-5" aria-labelledby={`day-${day.date}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id={`day-${day.date}`} className="text-lg font-bold">
                  {day.label ? localized(day.label, locale) : t("day_n", { n: i + 1 })}
                </h2>
                <p className="text-sm text-muted-foreground">{formatDay(day.date, locale, "long")}</p>
              </div>
              <Button size="sm" className="rounded-lg" onClick={() => setEditing({ session: null, day: day.date })}>
                <Plus className="size-4" aria-hidden /> {t("add_session")}
              </Button>
            </div>
            {c.days.length > 1 && <DayLabel conference={c} day={day.date} label={day.label} reload={reload} />}
            {sessions.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("agenda_empty_body")}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {sessions.map((s) => {
                  const track = c.tracks.find((tr) => tr.id === s.track?.id);
                  return (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderLeftWidth: 4, borderLeftColor: track?.color ?? "var(--border)" }}>
                      <span className="inline-flex w-28 shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
                        <Clock className="size-3.5 text-primary" aria-hidden /> {timeOf(s.startsAt)}–{timeOf(s.endsAt)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{localized(s.title, locale)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[t(`kind_${s.kind.toLowerCase()}`), s.room, track && localized(track.name, locale), s.speakers.map((sp) => c.speakers.find((x) => x.id === sp.id)?.name).filter(Boolean).join(", ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <Button variant="ghost" size="icon" aria-label={`${t("edit_session")}: ${localized(s.title, locale)}`} onClick={() => setEditing({ session: s, day: s.day })}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {editing && <SessionDialog conference={c} session={editing.session} day={editing.day} onClose={() => setEditing(null)} reload={reload} />}
    </div>
  );
}

function DayLabel({ conference: c, day, label, reload }: { conference: Conf; day: string; label: Conf["days"][number]["label"]; reload: () => void }) {
  const t = useTranslations();
  const [value, setValue] = useState<Texts>(() => textsFrom(label));
  const [, save] = useMutation(SetDayLabel);
  const changed = JSON.stringify(value) !== JSON.stringify(textsFrom(label));
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <div className="min-w-60 flex-1">
        <LocalizedField label={t("day_label")} value={value} onChange={setValue} maxLength={60} placeholder={t("day_label_ph")} />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-11 rounded-lg"
        disabled={!changed}
        onClick={async () => {
          const result = (await save({ conferenceId: c.id, day, label: textsInput(value) })).data?.setDayLabel;
          if (result?.__typename === "Conference") {
            toast.success(t("saved"));
            reload();
          } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
        }}
      >
        <Save className="size-4" aria-hidden /> {t("save")}
      </Button>
    </div>
  );
}

function TracksEditor({ conference: c, reload }: { conference: Conf; reload: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [, upsert] = useMutation(UpsertTrack);
  const [, remove] = useMutation(RemoveTrack);
  const [name, setName] = useState<Texts>({ en: "", si: "", ta: "" });
  const [color, setColor] = useState("#0ea5e9");
  const [error, setError] = useState<FormError | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    const input = textsInput(name);
    if (!input) return;
    const result = (await upsert({ conferenceId: c.id, input: { name: input, color } })).data?.upsertTrack;
    if (result?.__typename === "Track") {
      setName({ en: "", si: "", ta: "" });
      setError(null);
      reload();
    } else setError(result ? (result as FormError) : { code: "NETWORK" });
  }

  return (
    <section className="rounded-2xl border bg-card p-5" aria-labelledby="tracks-h">
      <h2 id="tracks-h" className="text-lg font-bold">
        {t("tracks")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("tracks_help")}</p>
      {c.tracks.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {c.tracks.map((track) => (
            <li key={track.id} className="inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 text-sm">
              <span className="size-3 rounded-full" style={{ background: track.color }} aria-hidden />
              {localized(track.name, locale)}
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`${t("delete")}: ${localized(track.name, locale)}`}
                onClick={async () => {
                  const result = (await remove({ conferenceId: c.id, trackId: track.id })).data?.removeTrack;
                  if (result?.__typename === "Done") reload();
                  else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
                }}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <LocalizedField label={t("track_name")} value={name} onChange={setName} maxLength={60} />
        </div>
        <Field label={t("track_color")}>
          {(id) => <input id={id} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-16 cursor-pointer rounded-md border bg-background p-1" />}
        </Field>
        <Button type="submit" variant="outline" className="h-11 rounded-lg" disabled={!name.en.trim()}>
          <Plus className="size-4" aria-hidden /> {t("add_track")}
        </Button>
      </form>
      <div className="mt-2">
        <ErrorNote error={error} />
      </div>
    </section>
  );
}

function SessionDialog({ conference: c, session, day, onClose, reload }: { conference: Conf; session: Session | null; day: string; onClose: () => void; reload: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [, upsert] = useMutation(UpsertSession);
  const [, remove] = useMutation(RemoveSession);
  const [title, setTitle] = useState<Texts>(() => textsFrom(session?.title));
  const [description, setDescription] = useState<Texts>(() => textsFrom(session?.description));
  const [kind, setKind] = useState<SessionKind>(session?.kind ?? "TALK");
  const [sessionDay, setSessionDay] = useState(session?.day ?? day);
  const [start, setStart] = useState(session ? timeOf(session.startsAt) : "09:00");
  const [end, setEnd] = useState(session ? timeOf(session.endsAt) : "10:00");
  const [room, setRoom] = useState(session?.room ?? "");
  const [trackId, setTrackId] = useState(session?.track?.id ?? "");
  const [speakerIds, setSpeakerIds] = useState<string[]>(session?.speakers.map((s) => s.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const titleInput = textsInput(title);
    const startsAt = dayAndTime(sessionDay, start);
    const endsAt = dayAndTime(sessionDay, end);
    if (!titleInput || !startsAt || !endsAt) return setError({ code: "LOCAL", text: t("err_title_date_required") });
    setBusy(true);
    const result = (
      await upsert({
        conferenceId: c.id,
        sessionId: session?.id ?? null,
        input: {
          title: titleInput,
          description: textsInput(description),
          kind,
          startsAt,
          endsAt,
          room: room.trim() || null,
          trackId: trackId || null,
          speakerIds,
        },
      })
    ).data?.upsertSession;
    setBusy(false);
    if (result?.__typename === "AgendaSession") {
      toast.success(t("saved"));
      reload();
      onClose();
    } else setError(result ? (result as FormError) : { code: "NETWORK" });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{session ? t("edit_session") : t("add_session")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <LocalizedField label={t("field_title")} value={title} onChange={setTitle} maxLength={150} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("field_kind")}>
              {(id) => (
                <select id={id} value={kind} onChange={(e) => setKind(e.target.value as SessionKind)} className={SELECT}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`kind_${k.toLowerCase()}`)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("field_date")}>
              {(id) => (
                <select id={id} value={sessionDay} onChange={(e) => setSessionDay(e.target.value)} className={SELECT}>
                  {c.days.map((d, i) => (
                    <option key={d.date} value={d.date}>
                      {t("day_n", { n: i + 1 })} · {formatDay(d.date, locale, "medium")}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("field_start_time")}>{(id) => <Input id={id} type="time" value={start} onChange={(e) => setStart(e.target.value)} required className="h-11" />}</Field>
            <Field label={t("field_end_time")}>{(id) => <Input id={id} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required className="h-11" />}</Field>
            <Field label={`${t("field_room")} (${t("optional")})`}>
              {(id) => <Input id={id} value={room} onChange={(e) => setRoom(e.target.value)} maxLength={80} placeholder={t("room_placeholder")} className="h-11" />}
            </Field>
            <Field label={t("tracks")}>
              {(id) => (
                <select id={id} value={trackId} onChange={(e) => setTrackId(e.target.value)} className={SELECT}>
                  <option value="">{t("no_track")}</option>
                  {c.tracks.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {localized(tr.name, locale)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("field_speakers")}</legend>
            {c.speakers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("add_speakers_first")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {c.speakers.map((sp) => {
                  const on = speakerIds.includes(sp.id);
                  return (
                    <label key={sp.id} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition", on && "border-primary bg-primary/10")}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setSpeakerIds(on ? speakerIds.filter((x) => x !== sp.id) : [...speakerIds, sp.id])}
                        className="accent-primary"
                      />
                      {sp.name}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
          <LocalizedField label={`${t("field_description")} (${t("optional")})`} value={description} onChange={setDescription} multiline rows={3} maxLength={2000} />
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {session ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden /> {t("delete")}
              </Button>
            ) : (
              <span />
            )}
            <SubmitButton busy={busy} className="w-auto px-6">
              <Save className="size-4" aria-hidden /> {t("save")}
            </SubmitButton>
          </div>
        </form>
        {session && (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={t("delete_session")}
            body={t("delete_session_body", { title: localized(session.title, locale) })}
            confirmLabel={t("delete")}
            onConfirm={async () => {
              const result = (await remove({ conferenceId: c.id, sessionId: session.id })).data?.removeSession;
              if (result?.__typename === "Done") {
                reload();
                onClose();
              } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
