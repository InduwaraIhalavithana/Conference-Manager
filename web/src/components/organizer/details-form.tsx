"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "urql";

import { ErrorNote, Field, type FormError, SubmitButton } from "@/components/auth/fields";
import { CreateConference, UpdateConference } from "@/components/organizer/conference-queries";
import { EMPTY_TEXTS, ImagePicker, LocalizedField, type Texts, textsFrom, textsInput } from "@/components/organizer/editor-bits";
import type { Pin } from "@/components/organizer/pin-picker";
import { Input } from "@/components/ui/input";
import type { Category, EditorConferenceFieldsFragment } from "@/graphql/generated/graphql";
import { useRouter } from "@/i18n/navigation";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { EDITOR_TZ, fromLocalInput, toLocalInput } from "@/lib/local-time";

const PinPicker = dynamic(() => import("@/components/organizer/pin-picker"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-muted" />,
});

const SELECT =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type State = {
  title: Texts;
  summary: Texts;
  description: Texts;
  category: Category;
  tags: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
  city: string;
  pin: Pin;
  onlineUrl: string;
  capacity: string;
  waitlistEnabled: boolean;
  coverUrl: string | null;
};

function initial(c: EditorConferenceFieldsFragment | null): State {
  return {
    title: textsFrom(c?.title) ?? EMPTY_TEXTS,
    summary: textsFrom(c?.summary),
    description: textsFrom(c?.description),
    category: c?.category ?? "TECH",
    tags: c?.tags.join(", ") ?? "",
    startsAt: toLocalInput(c?.startsAt),
    endsAt: toLocalInput(c?.endsAt),
    venueName: c?.venue.name ?? "",
    venueAddress: c?.venue.address ?? "",
    city: c?.venue.city ?? "",
    pin: c?.venue.location ? { latitude: c.venue.location.latitude, longitude: c.venue.location.longitude } : null,
    onlineUrl: c?.onlineUrl ?? "",
    capacity: c?.capacity?.toString() ?? "",
    waitlistEnabled: c?.waitlistEnabled ?? true,
    coverUrl: c?.coverUrl ?? null,
  };
}

/** The conference's details: creates a draft when `conference` is null, otherwise saves changes. */
export function DetailsForm({
  conference,
  onSaved,
}: {
  conference: EditorConferenceFieldsFragment | null;
  onSaved?: (c: EditorConferenceFieldsFragment) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [state, setState] = useState<State>(() => initial(conference));
  const [error, setError] = useState<FormError | null>(null);
  const [busy, setBusy] = useState(false);
  const [, create] = useMutation(CreateConference);
  const [, update] = useMutation(UpdateConference);
  const set = <K extends keyof State>(key: K, value: State[K]) => setState((s) => ({ ...s, [key]: value }));
  const invalid = (field: string) => error !== null && "field" in error && error.field === field;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const title = textsInput(state.title);
    const startsAt = fromLocalInput(state.startsAt);
    const endsAt = fromLocalInput(state.endsAt);
    if (!title || !startsAt || !endsAt) return setError({ code: "LOCAL", text: t("err_title_date_required") });
    const input = {
      title,
      summary: textsInput(state.summary),
      description: textsInput(state.description),
      category: state.category,
      tags: state.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      startsAt,
      endsAt,
      venueName: state.venueName.trim() || null,
      venueAddress: state.venueAddress.trim() || null,
      city: state.city.trim() || null,
      latitude: state.pin?.latitude ?? null,
      longitude: state.pin?.longitude ?? null,
      onlineUrl: state.onlineUrl.trim() || null,
      timezone: EDITOR_TZ,
      capacity: state.capacity.trim() ? Number(state.capacity) : null,
      waitlistEnabled: state.waitlistEnabled,
      coverUrl: state.coverUrl,
    };
    setBusy(true);
    setError(null);
    if (conference === null) {
      const result = (await create({ input })).data?.createConference;
      setBusy(false);
      if (result?.__typename === "Conference") {
        toast.success(t("conf_created"));
        return router.replace(`/dashboard/conferences/${result.id}`);
      }
      return setError(result ? (result as FormError) : { code: "NETWORK" });
    }
    const result = (await update({ id: conference.id, input })).data?.updateConference;
    setBusy(false);
    if (result?.__typename === "Conference") {
      toast.success(t("saved"));
      onSaved?.(result);
    } else setError(result ? (result as FormError) : { code: "NETWORK" });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">{t("translations_help")}</p>
        <LocalizedField label={t("field_title")} value={state.title} onChange={(v) => set("title", v)} maxLength={150} required placeholder={t("title_placeholder")} invalid={invalid("title")} />
        <LocalizedField label={t("field_summary")} value={state.summary} onChange={(v) => set("summary", v)} maxLength={300} hint={t("summary_help")} />
        <LocalizedField label={t("field_description")} value={state.description} onChange={(v) => set("description", v)} multiline rows={6} maxLength={5000} placeholder={t("description_placeholder")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("field_category")}>
            {(id) => (
              <select id={id} value={state.category} onChange={(e) => set("category", e.target.value as Category)} className={SELECT}>
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORIES[c].label)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={`${t("field_tags")} (${t("optional")})`} hint={t("tags_help")}>
            {(id, hint) => <Input id={id} value={state.tags} onChange={(e) => set("tags", e.target.value)} aria-describedby={hint} className="h-11" />}
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("field_starts")} hint={t("times_local_help")}>
            {(id, hint) => (
              <Input id={id} type="datetime-local" required value={state.startsAt} onChange={(e) => set("startsAt", e.target.value)} aria-describedby={hint} aria-invalid={invalid("startsAt") || undefined} className="h-11" />
            )}
          </Field>
          <Field label={t("field_ends")}>
            {(id) => (
              <Input id={id} type="datetime-local" required min={state.startsAt || undefined} value={state.endsAt} onChange={(e) => set("endsAt", e.target.value)} aria-invalid={invalid("endsAt") || undefined} className="h-11" />
            )}
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5" data-tour="ed-venue">
        <h2 className="text-lg font-bold">{t("venue")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("field_venue_name")}>
            {(id) => <Input id={id} value={state.venueName} onChange={(e) => set("venueName", e.target.value)} maxLength={150} className="h-11" />}
          </Field>
          <Field label={t("field_city")}>
            {(id) => <Input id={id} value={state.city} onChange={(e) => set("city", e.target.value)} maxLength={80} aria-invalid={invalid("city") || undefined} className="h-11" />}
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("field_location")}>
              {(id) => <Input id={id} value={state.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} maxLength={250} placeholder={t("location_placeholder")} className="h-11" />}
            </Field>
          </div>
        </div>
        <PinPicker value={state.pin} onChange={(pin) => set("pin", pin)} />
        <Field label={`${t("field_online_url")} (${t("optional")})`} hint={t("online_url_help")}>
          {(id, hint) => (
            <Input id={id} type="url" value={state.onlineUrl} onChange={(e) => set("onlineUrl", e.target.value)} placeholder="https://" aria-describedby={hint} aria-invalid={invalid("onlineUrl") || undefined} className="h-11" />
          )}
        </Field>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5" data-tour="ed-capacity">
        <h2 className="text-lg font-bold">{t("capacity_and_status")}</h2>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label={t("field_capacity")} hint={t("capacity_help")}>
            {(id, hint) => (
              <Input id={id} type="number" min={1} max={100000} inputMode="numeric" value={state.capacity} onChange={(e) => set("capacity", e.target.value)} aria-describedby={hint} aria-invalid={invalid("capacity") || undefined} className="h-11" />
            )}
          </Field>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 sm:mt-6">
            <input type="checkbox" checked={state.waitlistEnabled} onChange={(e) => set("waitlistEnabled", e.target.checked)} className="size-4 accent-primary" />
            <span className="text-sm font-medium">{t("waitlist_enabled")}</span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <ImagePicker kind="cover" value={state.coverUrl} onChange={(url) => set("coverUrl", url)} label={t("tab_cover")} help={t("cover_help")} />
      </section>

      <div data-tour="ed-save" className="sticky bottom-4 z-10 space-y-3 rounded-2xl border bg-background/90 p-4 shadow-lg backdrop-blur">
        <ErrorNote error={error} />
        <SubmitButton busy={busy} className="w-auto px-8">
          <Save className="size-4" aria-hidden /> {conference ? t("save_changes") : t("create_conference")}
        </SubmitButton>
      </div>
    </form>
  );
}
