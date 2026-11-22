"use client";

import { Briefcase, CircleHelp, Compass, Handshake, Loader2, MailOpen, PenLine, Send, Ticket, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "urql";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { graphql } from "@/graphql/generated";
import type { ContactTopic } from "@/graphql/generated/graphql";
import { Link } from "@/i18n/navigation";
import { errorMessage, type UserErrorLike } from "@/lib/errors";

const Send_ = graphql(`
  mutation SendContactMessage($input: ContactInput!) {
    sendContactMessage(input: $input) {
      __typename
      ... on UserError { code field retryAfterSeconds }
    }
  }
`);

const MAX = 2000;
const TOPICS: { value: ContactTopic; key: string; icon: typeof Ticket }[] = [
  { value: "GENERAL", key: "topic_general", icon: CircleHelp },
  { value: "ATTENDING", key: "topic_attending", icon: Ticket },
  { value: "ORGANIZING", key: "topic_organizing", icon: Briefcase },
  { value: "TECHNICAL", key: "topic_technical", icon: Wrench },
  { value: "PARTNERSHIP", key: "topic_partnership", icon: Handshake },
];

export function ContactForm() {
  const t = useTranslations();
  const [topic, setTopic] = useState<ContactTopic>("GENERAL");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<(UserErrorLike & { field?: string | null }) | null>(null);
  const [{ fetching }, send] = useMutation(Send_);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    const data = (
      await send({ input: { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "").trim(), topic, message } })
    ).data?.sendContactMessage;
    if (!data) return setError({ code: "NETWORK" });
    if (data.__typename === "UserError") return setError(data);
    setSent(true);
    toast.success(t("contact_sent_title"));
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
          <Send className="size-7" aria-hidden />
        </span>
        <h2 className="text-2xl font-extrabold">{t("contact_sent_title")}</h2>
        <p className="max-w-md text-muted-foreground">{t("contact_sent_body")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setMessage("");
              setSent(false);
            }}
          >
            <PenLine className="size-4" aria-hidden /> {t("contact_send_another")}
          </Button>
          <Button asChild className="rounded-xl">
            <Link href="/conferences">
              <Compass className="size-4" aria-hidden /> {t("browse_conferences")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <MailOpen className="size-5 text-primary" aria-hidden /> {t("contact_form_title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">{t("your_name")}</Label>
          <Input id="c-name" name="name" required maxLength={120} autoComplete="name" aria-invalid={error?.field === "name"} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-email">{t("your_email")}</Label>
          <Input id="c-email" name="email" type="email" required autoComplete="email" aria-invalid={error?.field === "email"} className="h-11" />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("contact_topic")}</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((o) => (
            <label
              key={o.value}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring hover:bg-muted"
            >
              <input type="radio" name="topic" value={o.value} checked={topic === o.value} onChange={() => setTopic(o.value)} className="sr-only" />
              <o.icon className="size-4" aria-hidden /> {t(o.key)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="c-msg">{t("contact_message")}</Label>
        <textarea
          id="c-msg"
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
          required
          minLength={10}
          maxLength={MAX}
          placeholder={t("contact_message_ph")}
          aria-invalid={error?.field === "message"}
          aria-describedby="c-msg-count"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        />
        <p id="c-msg-count" className="text-right text-xs text-muted-foreground">
          {t("chars_left", { count: MAX - message.length })}
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error.code === "NETWORK" ? t("err_network") : errorMessage(t, error)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={fetching} className="h-12 rounded-xl px-6">
        {fetching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {t("contact_send")}
      </Button>
    </form>
  );
}
