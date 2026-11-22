"use client";

import { LogIn, Send, ShieldCheck, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "urql";

import { CodeEntry, ErrorNote, Field, type FormError, PasswordInput, PasswordMeter, SubmitButton } from "@/components/auth/fields";
import { Input } from "@/components/ui/input";
import { graphql } from "@/graphql/generated";
import { Link, useRouter } from "@/i18n/navigation";
import { safeNext, sessionChanged } from "@/lib/session";

const Login = graphql(`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      __typename
      ... on UserError { code field retryAfterSeconds }
    }
  }
`);

const AdminLogin = graphql(`
  mutation AdminLogin($email: String!, $password: String!) {
    adminLogin(email: $email, password: $password) {
      __typename
      ... on UserError { code field retryAfterSeconds }
    }
  }
`);

const Register = graphql(`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      __typename
      ... on CodeSent { email resendAfterSeconds }
      ... on UserError { code field retryAfterSeconds }
    }
  }
`);

const Verify = graphql(`
  mutation VerifyEmail($email: String!, $code: String!) {
    verifyEmail(email: $email, code: $code) {
      __typename
      ... on UserError { code remainingAttempts retryAfterSeconds }
    }
  }
`);

const ResendCode = graphql(`
  mutation ResendCode($email: String!) {
    resendCode(email: $email) {
      __typename
      ... on CodeSent { resendAfterSeconds }
      ... on UserError { code retryAfterSeconds }
    }
  }
`);

const Forgot = graphql(`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email) {
      __typename
      ... on UserError { code field retryAfterSeconds }
    }
  }
`);

const Reset = graphql(`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword) {
      __typename
      ... on UserError { code field }
    }
  }
`);

type Result = { __typename: string } & Partial<FormError & { email: string; resendAfterSeconds: number }>;

function asError(data: Result | undefined): FormError {
  return data ? (data as FormError) : { code: "NETWORK" };
}

/** The email code step, shared by sign-up and by signing in to an account that was never verified. */
function VerifyStep({ email, intro, onDone }: { email: string; intro: string; onDone: () => void }) {
  const [, verify] = useMutation(Verify);
  const [, resend] = useMutation(ResendCode);
  return (
    <CodeEntry
      intro={intro}
      onSubmit={async (code) => {
        const data = (await verify({ email, code })).data?.verifyEmail;
        if (data?.__typename === "SignedIn") {
          onDone();
          return null;
        }
        return asError(data);
      }}
      onResend={async () => {
        const data = (await resend({ email })).data?.resendCode;
        return data?.__typename === "CodeSent" ? { wait: data.resendAfterSeconds } : asError(data);
      }}
    />
  );
}

function useSignedIn(area: "dashboard" | "admin") {
  const router = useRouter();
  const next = useSearchParams().get("next");
  return () => {
    sessionChanged();
    router.replace(safeNext(next, area));
    router.refresh();
  };
}

export function LoginForm() {
  const t = useTranslations();
  const [, login] = useMutation(Login);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const done = useSignedIn("dashboard");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setBusy(true);
    setError(null);
    const data = (await login({ email, password: String(form.get("password") ?? "") })).data?.login;
    setBusy(false);
    if (data?.__typename === "SignedIn") return done();
    if (data?.__typename === "UserError" && data.code === "EMAIL_NOT_VERIFIED") return setUnverified(email);
    setError(asError(data));
  }

  if (unverified) {
    return <VerifyStep email={unverified} intro={t("err_email_not_verified", { email: unverified })} onDone={done} />;
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t("field_email")}>
          {(id) => <Input id={id} name="email" type="email" required autoComplete="email" placeholder={t("email_placeholder")} className="h-11" />}
        </Field>
        <Field label={t("field_password")}>
          {(id) => <PasswordInput id={id} name="password" required autoComplete="current-password" />}
        </Field>
        <div className="text-right text-sm">
          <Link href="/forgot" className="font-medium text-primary hover:underline">
            {t("forgot_password")}
          </Link>
        </div>
        <ErrorNote error={error} />
        <SubmitButton busy={busy}>
          <LogIn className="size-4" aria-hidden /> {t("login")}
        </SubmitButton>
      </form>
      <div className="mt-6 space-y-3 text-center text-sm">
        <p>
          {t("no_account")}{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            {t("create_account")}
          </Link>
        </p>
        <p className="flex items-center gap-3 text-xs uppercase text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          {t("or")}
        </p>
        <Link href="/admin/login" className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground">
          <ShieldCheck className="size-4" aria-hidden /> {t("admin_login")}
        </Link>
      </div>
    </>
  );
}

export function AdminLoginForm() {
  const t = useTranslations();
  const [, login] = useMutation(AdminLogin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const done = useSignedIn("admin");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const data = (await login({ email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") })).data
      ?.adminLogin;
    setBusy(false);
    if (data?.__typename === "SignedIn") return done();
    setError(asError(data));
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t("field_email")}>
          {(id) => <Input id={id} name="email" type="text" required autoComplete="username" className="h-11" />}
        </Field>
        <Field label={t("field_password")}>
          {(id) => <PasswordInput id={id} name="password" required autoComplete="current-password" />}
        </Field>
        <ErrorNote error={error} />
        <SubmitButton busy={busy}>
          <ShieldCheck className="size-4" aria-hidden /> {t("login")}
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("organizer_login")}
        </Link>
      </p>
    </>
  );
}

export function RegisterForm() {
  const t = useTranslations();
  const locale = useLocale();
  const [, register] = useMutation(Register);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const done = useSignedIn("dashboard");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    if (password !== String(form.get("confirm") ?? "")) return setError({ code: "LOCAL", text: t("err_passwords_differ") });
    setBusy(true);
    setError(null);
    const data = (
      await register({
        input: {
          firstName: value("firstName"),
          lastName: value("lastName"),
          email: value("email"),
          password,
          organization: value("organization") || null,
          phone: value("phone") || null,
          lang: locale,
        },
      })
    ).data?.register;
    setBusy(false);
    if (data?.__typename === "CodeSent") return setSentTo(data.email);
    setError(asError(data));
  }

  if (sentTo) {
    return (
      <VerifyStep
        email={sentTo}
        intro={t("verify_sent_body", { email: sentTo })}
        onDone={() => {
          toast.success(t("verify_done"));
          done();
        }}
      />
    );
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("field_first_name")}>
            {(id) => <Input id={id} name="firstName" required maxLength={60} autoComplete="given-name" className="h-11" />}
          </Field>
          <Field label={t("field_last_name")}>
            {(id) => <Input id={id} name="lastName" required maxLength={60} autoComplete="family-name" className="h-11" />}
          </Field>
        </div>
        <Field label={t("field_email")}>
          {(id) => <Input id={id} name="email" type="email" required autoComplete="email" placeholder={t("email_placeholder")} className="h-11" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("field_organization")} (${t("optional")})`} hint={t("organization_hint")}>
            {(id, hint) => <Input id={id} name="organization" maxLength={120} autoComplete="organization" aria-describedby={hint} className="h-11" />}
          </Field>
          <Field label={`${t("field_phone")} (${t("optional")})`}>
            {(id) => <Input id={id} name="phone" type="tel" maxLength={30} autoComplete="tel" className="h-11" />}
          </Field>
        </div>
        <Field label={t("field_password")} hint={<PasswordMeter value={password} />}>
          {(id, hint) => (
            <PasswordInput id={id} name="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={hint} />
          )}
        </Field>
        <Field label={t("field_confirm_password")}>
          {(id) => <PasswordInput id={id} name="confirm" required autoComplete="new-password" />}
        </Field>
        <ErrorNote error={error} />
        <SubmitButton busy={busy}>
          <UserPlus className="size-4" aria-hidden /> {t("create_account")}
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm">
        {t("have_account")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("login")}
        </Link>
      </p>
    </>
  );
}

export function ForgotForm() {
  const t = useTranslations();
  const [, forgot] = useMutation(Forgot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setError(null);
    const data = (await forgot({ email })).data?.forgotPassword;
    setBusy(false);
    if (data?.__typename === "Done") return setSentTo(email);
    setError(asError(data));
  }

  return (
    <>
      {sentTo ? (
        <p role="status" className="rounded-xl bg-success/10 p-4 text-sm">
          {t("forgot_sent", { email: sentTo })}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t("field_email")}>
            {(id) => <Input id={id} name="email" type="email" required autoComplete="email" placeholder={t("email_placeholder")} className="h-11" />}
          </Field>
          <ErrorNote error={error} />
          <SubmitButton busy={busy}>
            <Send className="size-4" aria-hidden /> {t("send_reset_link")}
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("back_to_login")}
        </Link>
      </p>
    </>
  );
}

export function ResetForm() {
  const t = useTranslations();
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [, reset] = useMutation(Reset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== String(new FormData(event.currentTarget).get("confirm") ?? "")) {
      return setError({ code: "LOCAL", text: t("err_passwords_differ") });
    }
    setBusy(true);
    setError(null);
    const data = (await reset({ token, newPassword: password })).data?.resetPassword;
    setBusy(false);
    if (data?.__typename === "Done") {
      toast.success(t("reset_done"));
      return router.replace("/login");
    }
    setError(asError(data));
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={t("new_password")} hint={<PasswordMeter value={password} />}>
        {(id, hint) => (
          <PasswordInput id={id} name="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={hint} />
        )}
      </Field>
      <Field label={t("field_confirm_password")}>
        {(id) => <PasswordInput id={id} name="confirm" required autoComplete="new-password" />}
      </Field>
      <ErrorNote error={error} />
      <SubmitButton busy={busy} disabled={!token}>
        {t("reset_save")}
      </SubmitButton>
    </form>
  );
}
