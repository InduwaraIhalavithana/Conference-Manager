"use client";

import { CheckCircle2, Loader2, MailCheck, Ticket, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { useMutation } from "urql";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { graphql } from "@/graphql/generated";
import type { Lang } from "@/graphql/generated/graphql";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { errorMessage, type UserErrorLike } from "@/lib/errors";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

const Register = graphql(`
  mutation RegisterForConference($slug: String!, $input: AttendeeInput!) {
    registerForConference(slug: $slug, input: $input) {
      __typename
      ... on Registered { ticketCode holdExpiresAt }
      ... on Waitlisted { ticketCode position }
      ... on AlreadyRegistered { email }
      ... on ConferenceFull { capacity }
      ... on UserError { code field remainingAttempts retryAfterSeconds }
    }
  }
`);

const Confirm = graphql(`
  mutation ConfirmRegistration($ticketCode: String!, $code: String!) {
    confirmRegistration(ticketCode: $ticketCode, code: $code) {
      __typename
      ... on Ticket { status waitlistPosition }
      ... on UserError { code remainingAttempts retryAfterSeconds }
    }
  }
`);

const Resend = graphql(`
  mutation ResendConfirmation($ticketCode: String!) {
    resendConfirmation(ticketCode: $ticketCode) {
      __typename
      ... on ConfirmationSent { resendAfterSeconds }
      ... on UserError { code retryAfterSeconds }
    }
  }
`);

type Step =
  | { kind: "form" }
  | { kind: "code"; ticketCode: string; email: string; waitlisted: boolean; position: number | null; holdExpiresAt: string | null }
  | { kind: "done"; ticketCode: string; waitlisted: boolean; position: number | null }
  | { kind: "already"; email: string }
  | { kind: "full" };

const LANG: Record<Locale, Lang> = { en: "EN", si: "SI", ta: "TA" };

export function RegisterPanel({
  slug,
  timezone,
  capacity,
  seatsLeft,
  waitlisted,
  waitlistEnabled,
  closedReason,
}: {
  slug: string;
  timezone: string;
  capacity: number | null;
  seatsLeft: number | null;
  waitlisted: number;
  waitlistEnabled: boolean;
  closedReason: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [error, setError] = useState<UserErrorLike & { field?: string | null } | null>(null);
  const [{ fetching: registering }, register] = useMutation(Register);

  const full = seatsLeft === 0;
  const taken = capacity !== null && seatsLeft !== null ? capacity - seatsLeft : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setError(null);
    const result = await register({
      slug,
      input: { name: String(form.get("name") ?? ""), email, lang: LANG[locale] },
    });
    const data = result.data?.registerForConference;
    if (!data) return setError({ code: "NETWORK" });
    switch (data.__typename) {
      case "Registered":
        return setStep({ kind: "code", ticketCode: data.ticketCode, email, waitlisted: false, position: null, holdExpiresAt: data.holdExpiresAt });
      case "Waitlisted":
        return setStep({ kind: "code", ticketCode: data.ticketCode, email, waitlisted: true, position: data.position, holdExpiresAt: null });
      case "AlreadyRegistered":
        return setStep({ kind: "already", email: data.email });
      case "ConferenceFull":
        return setStep({ kind: "full" });
      case "UserError":
        return setError(data);
    }
  }

  return (
    <div className="space-y-4">
      {capacity !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Users className="size-4 text-primary" aria-hidden />
              {t("seats_of", { taken: formatNumber(taken, locale), capacity: formatNumber(capacity, locale) })}
            </span>
            {waitlisted > 0 && <span className="text-warning">{t("waiting_count", { count: formatNumber(waitlisted, locale) })}</span>}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-all duration-700"
              style={{ width: `${capacity ? Math.min(100, (taken / capacity) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {closedReason ? (
        <p className="rounded-xl border bg-muted/50 p-4 text-sm font-medium">{closedReason}</p>
      ) : step.kind === "form" ? (
        <form onSubmit={submit} className="space-y-3" noValidate>
          {full && waitlistEnabled && <p className="rounded-xl bg-warning/12 p-3 text-sm text-warning">{t("full_waitlist_note", { count: formatNumber(waitlisted, locale) })}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="reg-name">{t("field_name")}</Label>
            <Input id="reg-name" name="name" required maxLength={120} autoComplete="name" aria-invalid={error?.field === "name"} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">{t("field_email")}</Label>
            <Input id="reg-email" name="email" type="email" required autoComplete="email" aria-invalid={error?.field === "email"} aria-describedby="reg-email-hint" className="h-11" />
            <p id="reg-email-hint" className="text-xs text-muted-foreground">
              {t("reg_email_hint")}
            </p>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error.code === "NETWORK" ? t("err_network") : errorMessage(t, error)}
            </p>
          )}
          <Button type="submit" size="lg" disabled={registering} className="h-12 w-full rounded-xl text-base">
            {registering && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {full && waitlistEnabled ? t("join_waitlist") : t("register_now")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("reg_privacy")}</p>
        </form>
      ) : step.kind === "code" ? (
        <CodeStep
          step={step}
          timezone={timezone}
          onDone={(position) => {
            setStep({ kind: "done", ticketCode: step.ticketCode, waitlisted: step.waitlisted, position });
            router.refresh();
          }}
        />
      ) : step.kind === "done" ? (
        <div className="space-y-3 rounded-xl bg-success/10 p-4 text-center" role="status">
          <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
          <p className="font-bold">{step.waitlisted ? t("wait_success_title") : t("reg_success_title")}</p>
          <p className="text-sm text-muted-foreground">
            {step.waitlisted ? t("wait_success_body", { position: step.position ?? 1 }) : t("ticket_keep_link")}
          </p>
          <Button asChild className="w-full rounded-xl">
            <Link href={`/ticket/${step.ticketCode}`}>
              <Ticket className="size-4" aria-hidden /> {t("open_ticket")}
            </Link>
          </Button>
        </div>
      ) : step.kind === "already" ? (
        <div className="space-y-3 rounded-xl bg-primary/10 p-4 text-sm" role="status">
          <MailCheck className="size-8 text-primary" aria-hidden />
          <p>{t("err_already_registered")}</p>
          <Button variant="ghost" size="sm" onClick={() => setStep({ kind: "form" })}>
            {t("edit_details")}
          </Button>
        </div>
      ) : (
        <p className="rounded-xl bg-warning/12 p-4 text-sm text-warning" role="status">
          {t("seats_full")}
        </p>
      )}
    </div>
  );
}

function CodeStep({
  step,
  timezone,
  onDone,
}: {
  step: Extract<Step, { kind: "code" }>;
  timezone: string;
  onDone: (position: number | null) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [code, setCode] = useState("");
  const [error, setError] = useState<UserErrorLike | null>(null);
  const [wait, setWait] = useState(60);
  const [{ fetching }, confirm] = useMutation(Confirm);
  const [, resend] = useMutation(Resend);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result = await confirm({ ticketCode: step.ticketCode, code });
    const data = result.data?.confirmRegistration;
    if (!data) return setError({ code: "NETWORK" });
    if (data.__typename === "UserError") return setError(data);
    onDone(data.waitlistPosition);
  }

  async function again() {
    const result = await resend({ ticketCode: step.ticketCode });
    const data = result.data?.resendConfirmation;
    if (data?.__typename === "ConfirmationSent") setWait(data.resendAfterSeconds);
    else if (data?.__typename === "UserError") setError(data);
  }

  const hold = step.holdExpiresAt
    ? `${formatDate(step.holdExpiresAt, locale, "short", timezone)}, ${formatTime(step.holdExpiresAt, locale, timezone)}`
    : null;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-xl bg-primary/10 p-4 text-sm">
        <p className="font-bold">{t("reg_confirm_title")}</p>
        <p className="mt-1 text-muted-foreground">
          {step.waitlisted
            ? t("wait_confirm_body", { position: step.position ?? 1, email: step.email })
            : t("reg_confirm_body", { email: step.email, hours: 24 })}
        </p>
        {hold && <p className="mt-1 font-medium">{t("hold_until", { time: hold })}</p>}
      </div>
      <Label htmlFor="reg-code">{t("code_label")}</Label>
      <Input
        id="reg-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        className="h-14 text-center font-mono text-3xl tracking-[0.5em]"
      />
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error.code === "NETWORK" ? t("err_network") : errorMessage(t, error)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={fetching || code.length !== 6} className="h-12 w-full rounded-xl">
        {fetching && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t("code_verify_btn")}
      </Button>
      <Button type="button" variant="ghost" className="w-full" disabled={wait > 0} onClick={again}>
        {wait > 0 ? t("resend_wait", { seconds: wait }) : t("resend_link")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link className="underline" href={`/ticket/${step.ticketCode}`}>
          {t("open_ticket")}
        </Link>
      </p>
    </form>
  );
}
