"use client";

import { Ban, Loader2, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "urql";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { graphql } from "@/graphql/generated";
import { useRouter } from "@/i18n/navigation";
import { errorMessage, type UserErrorLike } from "@/lib/errors";

const Confirm = graphql(`
  mutation TicketConfirm($ticketCode: String!, $code: String!) {
    confirmRegistration(ticketCode: $ticketCode, code: $code) {
      __typename
      ... on Ticket { status }
      ... on UserError { code remainingAttempts retryAfterSeconds }
    }
  }
`);

const Resend = graphql(`
  mutation TicketResend($ticketCode: String!) {
    resendConfirmation(ticketCode: $ticketCode) {
      __typename
      ... on ConfirmationSent { resendAfterSeconds }
      ... on UserError { code retryAfterSeconds }
    }
  }
`);

const Cancel = graphql(`
  mutation TicketCancel($ticketCode: String!) {
    cancelRegistration(ticketCode: $ticketCode) {
      __typename
      ... on Ticket { status }
      ... on UserError { code retryAfterSeconds }
    }
  }
`);

export function TicketActions({ mode, ticketCode, body }: { mode: "confirm" | "cancel"; ticketCode: string; body: string }) {
  return mode === "confirm" ? <ConfirmForm ticketCode={ticketCode} body={body} /> : <CancelButton ticketCode={ticketCode} body={body} />;
}

function ConfirmForm({ ticketCode, body }: { ticketCode: string; body: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<UserErrorLike | null>(null);
  const [wait, setWait] = useState(0);
  const [{ fetching }, confirm] = useMutation(Confirm);
  const [{ fetching: sending }, resend] = useMutation(Resend);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const data = (await confirm({ ticketCode, code })).data?.confirmRegistration;
    if (!data) return setError({ code: "NETWORK" });
    if (data.__typename === "UserError") return setError(data);
    toast.success(data.status === "WAITLISTED" ? t("ticket_confirmed_wait_toast") : t("ticket_confirmed_toast"));
    router.refresh();
  }

  async function again() {
    setError(null);
    const data = (await resend({ ticketCode })).data?.resendConfirmation;
    if (data?.__typename === "ConfirmationSent") setWait(data.resendAfterSeconds);
    else if (data?.__typename === "UserError") setError(data);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[280px] space-y-3 text-left">
      <p className="rounded-xl bg-warning/12 p-3 text-sm">{body}</p>
      <Label htmlFor="ticket-code-input">{t("code_label")}</Label>
      <Input
        id="ticket-code-input"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        className="h-14 text-center font-mono text-3xl tracking-[0.4em]"
      />
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error.code === "NETWORK" ? t("err_network") : errorMessage(t, error)}
        </p>
      )}
      <Button type="submit" disabled={fetching || code.length !== 6} className="h-11 w-full rounded-xl">
        {fetching && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t("code_verify_btn")}
      </Button>
      <Button type="button" variant="ghost" className="w-full" disabled={wait > 0 || sending} onClick={again}>
        {wait > 0 ? t("resend_wait", { seconds: wait }) : t("resend_link")}
      </Button>
    </form>
  );
}

function CancelButton({ ticketCode, body }: { ticketCode: string; body: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<UserErrorLike | null>(null);
  const [{ fetching }, cancel] = useMutation(Cancel);

  async function run() {
    setError(null);
    const data = (await cancel({ ticketCode })).data?.cancelRegistration;
    if (!data) return setError({ code: "NETWORK" });
    if (data.__typename === "UserError") return setError(data);
    setOpen(false);
    toast.success(t("ticket_cancelled"));
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Ban className="size-4" aria-hidden /> {t("cancel_registration")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("cancel_registration")}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error.code === "NETWORK" ? t("err_network") : errorMessage(t, error)}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("close")}</Button>
          </DialogClose>
          <Button variant="destructive" disabled={fetching} onClick={run}>
            {fetching && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("cancel_registration")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PrintButton() {
  const t = useTranslations();
  return (
    <Button variant="outline" className="rounded-xl" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> {t("print")}
    </Button>
  );
}
