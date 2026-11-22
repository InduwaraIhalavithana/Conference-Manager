"use client";

import { Camera, KeyRound, Loader2, LogOut, Save, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "urql";

import { ErrorNote, Field, type FormError, PasswordInput, PasswordMeter, SubmitButton } from "@/components/auth/fields";
import { useOrganizer } from "@/components/organizer/organizer-shell";
import { Avatar } from "@/components/site/account-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { graphql } from "@/graphql/generated";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { UPLOAD_MAX_MB, uploadErrorText, uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

const UpdateProfile = graphql(`
  mutation UpdateProfile($input: ProfileInput!) {
    updateProfile(input: $input) {
      __typename
      ... on Organizer { id firstName lastName phone organization avatarUrl lang bio { en si ta } }
      ... on UserError { code field }
    }
  }
`);

const ChangePassword = graphql(`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      __typename
      ... on UserError { code field }
    }
  }
`);

const SignOutOthers = graphql(`
  mutation SignOutOthers {
    signOutOtherDevices {
      __typename
      ... on UserError { code }
    }
  }
`);

const MAX_MB = UPLOAD_MAX_MB.avatar;
const LANGS = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
] as const;

export function SettingsForm() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const me = useOrganizer();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("nav_settings")}</h1>
        <p className="mt-1 text-muted-foreground">{t("settings_sub")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("member_since", { date: formatDate(me.createdAt, locale, "long") })}</p>
      </header>
      <ProfileSection />
      <SecuritySection />
    </div>
  );
}

function ProfileSection() {
  const t = useTranslations();
  const me = useOrganizer();
  const [, update] = useMutation(UpdateProfile);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [avatar, setAvatar] = useState(me.avatarUrl ?? null);
  const [bioLang, setBioLang] = useState<"en" | "si" | "ta">("en");
  const [bio, setBio] = useState({ en: me.bio?.en ?? "", si: me.bio?.si ?? "", ta: me.bio?.ta ?? "" });
  const fileInput = useRef<HTMLInputElement>(null);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    const result = await uploadImage("avatar", file);
    setUploading(false);
    if ("url" in result) {
      setAvatar(result.url);
      toast.success(t("upload_done"));
    } else toast.error(uploadErrorText(t, "avatar", file, result.error));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    setBusy(true);
    setError(null);
    const data = (
      await update({
        input: {
          firstName: value("firstName"),
          lastName: value("lastName"),
          organization: value("organization"),
          phone: value("phone"),
          bio: bio.en.trim() ? bio : null,
          avatarUrl: avatar,
          lang: value("lang") || "en",
        },
      })
    ).data?.updateProfile;
    setBusy(false);
    if (data?.__typename === "Organizer") toast.success(t("profile_saved"));
    else setError(data ? (data as FormError) : { code: "NETWORK" });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6" noValidate>
      <h2 className="text-lg font-bold">{t("tab_profile")}</h2>
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative">
          <Avatar name={`${me.firstName} ${me.lastName}`} url={avatar} className="size-24 text-2xl ring-4 ring-primary/15" />
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="size-6 animate-spin text-white" aria-hidden />
            </span>
          )}
        </div>
        <div className="space-y-2">
          <p className="font-semibold">{t("profile_photo")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {t("profile_photo_help")} {t("upload_rules", { max: MAX_MB })}
          </p>
          <div className="flex gap-2">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} tabIndex={-1} aria-hidden />
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Camera className="size-4" aria-hidden /> {avatar ? t("upload_replace") : t("upload_choose")}
            </Button>
            {avatar && (
              <Button type="button" variant="ghost" size="sm" className="rounded-lg text-destructive" onClick={() => setAvatar(null)}>
                <Trash2 className="size-4" aria-hidden /> {t("upload_remove")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("field_first_name")}>
          {(id) => <Input id={id} name="firstName" defaultValue={me.firstName} required maxLength={60} autoComplete="given-name" className="h-11" />}
        </Field>
        <Field label={t("field_last_name")}>
          {(id) => <Input id={id} name="lastName" defaultValue={me.lastName} required maxLength={60} autoComplete="family-name" className="h-11" />}
        </Field>
        <Field label={t("field_email")} hint={t("email_locked")}>
          {(id, hint) => <Input id={id} value={me.email} readOnly aria-describedby={hint} className="h-11 bg-muted" />}
        </Field>
        <Field label={`${t("field_phone")} (${t("optional")})`}>
          {(id) => <Input id={id} name="phone" type="tel" defaultValue={me.phone ?? ""} maxLength={30} autoComplete="tel" className="h-11" />}
        </Field>
        <Field label={`${t("field_organization")} (${t("optional")})`} hint={t("organization_hint")}>
          {(id, hint) => <Input id={id} name="organization" defaultValue={me.organization ?? ""} maxLength={120} aria-describedby={hint} className="h-11" />}
        </Field>
        <Field label={t("language")} hint={t("language_help")}>
          {(id, hint) => (
            <select
              id={id}
              name="lang"
              defaultValue={me.lang}
              aria-describedby={hint}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {t("field_bio")} ({t("optional")})
        </legend>
        <div className="flex gap-1" role="group">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setBioLang(l.code)}
              aria-pressed={bioLang === l.code}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", bioLang === l.code ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}
            >
              {l.label}
            </button>
          ))}
        </div>
        <textarea
          aria-label={`${t("field_bio")} (${LANGS.find((l) => l.code === bioLang)?.label})`}
          rows={4}
          maxLength={1000}
          value={bio[bioLang]}
          onChange={(e) => setBio({ ...bio, [bioLang]: e.target.value })}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <p className="text-right text-xs text-muted-foreground">{t("chars_left", { count: 1000 - bio[bioLang].length })}</p>
      </fieldset>

      <ErrorNote error={error} />
      <SubmitButton busy={busy} className="w-auto px-6">
        <Save className="size-4" aria-hidden /> {t("save_changes")}
      </SubmitButton>
    </form>
  );
}

function SecuritySection() {
  const t = useTranslations();
  const [, change] = useMutation(ChangePassword);
  const [, signOutOthers] = useMutation(SignOutOthers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (password !== String(form.get("confirm") ?? "")) return setError({ code: "LOCAL", text: t("err_passwords_differ") });
    setBusy(true);
    setError(null);
    const data = (await change({ currentPassword: String(form.get("current") ?? ""), newPassword: password })).data?.changePassword;
    setBusy(false);
    if (data?.__typename === "Done") {
      toast.success(t("password_changed"));
      formElement.reset();
      setPassword("");
    } else setError(data ? (data as FormError) : { code: "NETWORK" });
  }

  async function others() {
    const data = (await signOutOthers({})).data?.signOutOtherDevices;
    if (data?.__typename === "Done") toast.success(t("sign_out_others_done"));
    else toast.error(t("err_server"));
  }

  return (
    <section className="grid gap-6 rounded-2xl border bg-card p-6 lg:grid-cols-[1.3fr_1fr]" aria-labelledby="security-h">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <h2 id="security-h" className="text-lg font-bold">
          {t("tab_security")}
        </h2>
        <Field label={t("current_password")}>{(id) => <PasswordInput id={id} name="current" required autoComplete="current-password" />}</Field>
        <Field label={t("new_password")} hint={<PasswordMeter value={password} />}>
          {(id, hint) => (
            <PasswordInput id={id} name="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={hint} />
          )}
        </Field>
        <Field label={t("field_confirm_password")}>{(id) => <PasswordInput id={id} name="confirm" required autoComplete="new-password" />}</Field>
        <ErrorNote error={error} />
        <SubmitButton busy={busy} className="w-auto px-6">
          <KeyRound className="size-4" aria-hidden /> {t("change_password")}
        </SubmitButton>
      </form>
      <div className="rounded-2xl bg-muted/60 p-5">
        <h3 className="font-semibold">{t("sign_out_others")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("sign_out_others_body")}</p>
        <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={others}>
          <LogOut className="size-4" aria-hidden /> {t("sign_out_others")}
        </Button>
      </div>
    </section>
  );
}
