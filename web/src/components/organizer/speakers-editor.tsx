"use client";

import { Pencil, Plus, Save, Trash2, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "urql";

import { ErrorNote, Field, type FormError, SubmitButton } from "@/components/auth/fields";
import { RemoveSpeaker, UpsertSpeaker } from "@/components/organizer/conference-queries";
import { ConfirmDialog, ImagePicker, LocalizedField, type Texts, textsFrom, textsInput } from "@/components/organizer/editor-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EditorConferenceFieldsFragment } from "@/graphql/generated/graphql";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { localized } from "@/lib/format";

type Conf = EditorConferenceFieldsFragment;
type Speaker = Conf["speakers"][number];

export function SpeakersEditor({ conference: c, reload }: { conference: Conf; reload: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [editing, setEditing] = useState<Speaker | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">{t("speakers_empty_body")}</p>
        <Button className="rounded-xl" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> {t("add_speaker")}
        </Button>
      </div>
      {c.speakers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <UserRound className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <p className="mt-2 font-semibold">{t("speakers_empty_title")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {c.speakers.map((sp) => (
            <li key={sp.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              {sp.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api${sp.photoUrl}`} alt="" className="size-14 rounded-full object-cover" />
              ) : (
                <span className="inline-flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-lg font-bold text-white">
                  {sp.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{sp.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[sp.jobTitle, sp.organization].filter(Boolean).join(" · ")}</p>
                {sp.bio && <p className="mt-0.5 line-clamp-1 text-xs">{localized(sp.bio, locale)}</p>}
              </div>
              <Button variant="ghost" size="icon" aria-label={`${t("edit_speaker")}: ${sp.name}`} onClick={() => setEditing(sp)}>
                <Pencil className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <SpeakerDialog conference={c} speaker={editing === "new" ? null : editing} onClose={() => setEditing(null)} reload={reload} />}
    </div>
  );
}

function SpeakerDialog({ conference: c, speaker, onClose, reload }: { conference: Conf; speaker: Speaker | null; onClose: () => void; reload: () => void }) {
  const t = useTranslations();
  const [, upsert] = useMutation(UpsertSpeaker);
  const [, remove] = useMutation(RemoveSpeaker);
  const [name, setName] = useState(speaker?.name ?? "");
  const [jobTitle, setJobTitle] = useState(speaker?.jobTitle ?? "");
  const [organization, setOrganization] = useState(speaker?.organization ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(speaker?.photoUrl ?? null);
  const [bio, setBio] = useState<Texts>(() => textsFrom(speaker?.bio));
  const [links, setLinks] = useState(speaker?.links.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = (
      await upsert({
        conferenceId: c.id,
        speakerId: speaker?.id ?? null,
        input: {
          name: name.trim(),
          jobTitle: jobTitle.trim() || null,
          organization: organization.trim() || null,
          photoUrl,
          bio: textsInput(bio),
          links: links.split("\n").map((l) => l.trim()).filter(Boolean),
        },
      })
    ).data?.upsertSpeaker;
    setBusy(false);
    if (result?.__typename === "Speaker") {
      toast.success(t("saved"));
      reload();
      onClose();
    } else setError(result ? (result as FormError) : { code: "NETWORK" });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{speaker ? t("edit_speaker") : t("add_speaker")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <ImagePicker kind="speaker" value={photoUrl} onChange={setPhotoUrl} label={t("profile_photo")} shape="square" />
            <div className="space-y-4">
              <Field label={t("field_name")}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className="h-11" />}</Field>
              <Field label={`${t("field_job_title")} (${t("optional")})`}>
                {(id) => <Input id={id} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={120} className="h-11" />}
              </Field>
              <Field label={`${t("field_organization")} (${t("optional")})`}>
                {(id) => <Input id={id} value={organization} onChange={(e) => setOrganization(e.target.value)} maxLength={120} className="h-11" />}
              </Field>
            </div>
          </div>
          <LocalizedField label={`${t("field_bio")} (${t("optional")})`} value={bio} onChange={setBio} multiline rows={3} maxLength={1000} />
          <Field label={`${t("field_links")} (${t("optional")})`} hint={t("links_help")}>
            {(id, hint) => (
              <textarea
                id={id}
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                rows={3}
                aria-describedby={hint}
                placeholder="https://"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              />
            )}
          </Field>
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {speaker ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden /> {t("delete")}
              </Button>
            ) : (
              <span />
            )}
            <SubmitButton busy={busy} disabled={!name.trim()} className="w-auto px-6">
              <Save className="size-4" aria-hidden /> {t("save")}
            </SubmitButton>
          </div>
        </form>
        {speaker && (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={t("delete_speaker")}
            body={t("delete_speaker_body", { name: speaker.name })}
            confirmLabel={t("delete")}
            onConfirm={async () => {
              const result = (await remove({ conferenceId: c.id, speakerId: speaker.id })).data?.removeSpeaker;
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
