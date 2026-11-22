"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, type FormEvent, type ReactNode, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, type UserErrorLike } from "@/lib/errors";
import { cn } from "@/lib/utils";

/** An API UserError, "no connection", or a message the form found itself (already translated). */
export type FormError = (UserErrorLike & { field?: string | null }) | { code: "NETWORK" } | { code: "LOCAL"; text: string };

export function ErrorNote({ error }: { error: FormError | null }) {
  const t = useTranslations();
  if (!error) return null;
  let text: string;
  if (error.code === "NETWORK") text = t("err_network");
  else if ("text" in error) text = error.text;
  else text = errorMessage(t, error as UserErrorLike);
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
      {text}
    </p>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: (id: string, hintId: string | undefined) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id, hintId)}
      {hint && (
        <div id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}

export function SubmitButton({ busy, disabled, children, className }: { busy: boolean; disabled?: boolean; children: ReactNode; className?: string }) {
  return (
    <Button type="submit" size="lg" disabled={busy || disabled} className={cn("h-12 w-full rounded-xl text-base", className)}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, Math.min(4, score));
}

const METER = ["", "bg-destructive", "bg-warning", "bg-sky-500", "bg-success"];

export function PasswordMeter({ value }: { value: string }) {
  const t = useTranslations();
  const score = passwordScore(value);
  const labels = ["", t("pw_weak"), t("pw_fair"), t("pw_good"), t("pw_strong")];
  return (
    <span className="block space-y-1">
      {value && (
        <span className="flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", n <= score && METER[score])} />
          ))}
        </span>
      )}
      <span>{value ? `${labels[score]} · ${t("pw_rule")}` : t("pw_rule")}</span>
    </span>
  );
}

export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const t = useTranslations();
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn("h-11 pr-11", className)} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={shown ? t("hide_password") : t("show_password")}
        aria-pressed={shown}
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

/** The 6-digit email code, with a resend button that waits out the cooldown the API gives. */
export function CodeEntry({
  intro,
  onSubmit,
  onResend,
}: {
  intro: string;
  onSubmit: (code: string) => Promise<FormError | null>;
  onResend: () => Promise<{ wait: number } | FormError>;
}) {
  const t = useTranslations();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [wait, setWait] = useState(60);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(await onSubmit(code));
    setBusy(false);
  }

  async function resend() {
    setError(null);
    const result = await onResend();
    if ("wait" in result) setWait(result.wait);
    else setError(result);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-xl bg-primary/10 p-4 text-sm">{intro}</p>
      <Field label={t("code_label")}>
        {(id) => (
          <Input
            id={id}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            className="h-14 text-center font-mono text-3xl tracking-[0.5em]"
          />
        )}
      </Field>
      <ErrorNote error={error} />
      <SubmitButton busy={busy} disabled={code.length !== 6}>
        {t("code_verify_btn")}
      </SubmitButton>
      <Button type="button" variant="ghost" className="w-full" disabled={wait > 0} onClick={resend}>
        {wait > 0 ? t("resend_wait", { seconds: wait }) : t("resend_link")}
      </Button>
    </form>
  );
}
