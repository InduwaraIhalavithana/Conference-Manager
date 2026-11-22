import { CalendarDays, CircleCheck, Clock, Hourglass, Info, Mail, MapPin, Ticket as TicketIcon, UserRound, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";

import { AddToCalendar } from "@/components/conference/client-widgets";
import { PrintButton, TicketActions } from "@/components/conference/ticket-actions";
import { HelpButton } from "@/components/tour/tour";
import { Button } from "@/components/ui/button";
import { graphql } from "@/graphql/generated";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES } from "@/lib/categories";
import { formatDate, formatRange, formatTime, localized } from "@/lib/format";
import { query } from "@/lib/graphql/server";

const TicketPageQuery = graphql(`
  query TicketPage($code: String!) {
    ticket(code: $code) {
      code
      name
      email
      status
      confirmed
      holdExpiresAt
      waitlistPosition
      checkedInAt
      createdAt
      conference {
        slug
        status
        title { en si ta }
        summary { en si ta }
        category
        coverUrl
        timezone
        startsAt
        endsAt
        ended
        venue { name address city }
      }
    }
  }
`);

/** The ticket is private: the code is its only key, so search engines must never list it. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("ticket_title"), robots: { index: false, follow: false } };
}

export default function TicketPage({ params }: PageProps<"/[locale]/ticket/[code]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-3xl bg-muted" />}>
        <TicketView params={params} />
      </Suspense>
    </div>
  );
}

async function TicketView({ params }: { params: PageProps<"/[locale]/ticket/[code]">["params"] }) {
  const { code } = await params;
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { ticket } = await query(TicketPageQuery, { code: decodeURIComponent(code) });
  if (!ticket) return <TicketMissing />;

  const c = ticket.conference;
  if (!c) notFound();
  const title = localized(c.title, locale);
  const place = [c.venue.name, c.venue.address, c.venue.city].filter(Boolean).join(", ");
  const gone = ticket.status === "CANCELLED" || ticket.status === "RELEASED";
  const waiting = ticket.status === "WAITLISTED";
  const pending = !ticket.confirmed && !gone;
  const showQr = !gone && !pending && !waiting;
  const qr = showQr ? await QRCode.toString(ticket.code, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  const canCancel = !gone && !ticket.checkedInAt && !c.ended && c.status !== "CANCELLED";
  const hold = ticket.holdExpiresAt
    ? `${formatDate(ticket.holdExpiresAt, locale, "short", c.timezone)}, ${formatTime(ticket.holdExpiresAt, locale, c.timezone)}`
    : "";

  const chip = gone
    ? { icon: XCircle, text: ticket.status === "RELEASED" ? t("ticket_released") : t("ticket_cancelled"), tone: "bg-destructive text-white" }
    : pending
      ? { icon: Mail, text: t("ticket_unconfirmed"), tone: "bg-warning text-black" }
      : waiting
        ? { icon: Hourglass, text: t("ticket_waitlisted", { position: ticket.waitlistPosition ?? 1 }), tone: "bg-warning text-black" }
        : ticket.checkedInAt
          ? { icon: CircleCheck, text: t("ticket_checked_in"), tone: "bg-success text-white" }
          : { icon: TicketIcon, text: t("ticket_confirmed"), tone: "bg-primary text-primary-foreground" };

  return (
    <article className="overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-primary/10 print:shadow-none">
      <header className="relative">
        <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORIES[c.category].cover}`} aria-hidden>
          {c.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api${c.coverUrl}`} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/20" aria-hidden />
        <div className="relative px-6 pb-7 pt-20 text-white sm:px-8">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${chip.tone}`}>
            <chip.icon className="size-3.5" aria-hidden /> {chip.text}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-1 text-white/85">{t("ticket_for", { name: ticket.name })}</p>
        </div>
      </header>

      <div className="grid gap-0 md:grid-cols-[minmax(0,340px)_1fr]">
        <section data-tour="tk-qr" aria-label={t("ticket_code")} className="flex flex-col items-center gap-3 border-b border-dashed p-6 text-center md:border-b-0 md:border-r sm:p-8">
          {qr ? (
            <div className="w-full max-w-[250px] rounded-2xl bg-white p-3 shadow-inner [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={t("ticket_show_at_door")} dangerouslySetInnerHTML={{ __html: qr }} />
          ) : pending ? (
            <TicketActions
              mode="confirm"
              ticketCode={ticket.code}
              body={t(waiting ? "ticket_unconfirmed_wait_body" : "ticket_unconfirmed_body", { email: ticket.email, time: hold })}
            />
          ) : gone ? (
            <div className="flex aspect-square w-full max-w-[250px] flex-col items-center justify-center gap-3 rounded-2xl bg-muted p-6 text-sm text-muted-foreground">
              <XCircle className="size-10" aria-hidden />
              {ticket.status === "RELEASED" ? t("ticket_released_body") : t("ticket_cancelled_body")}
            </div>
          ) : (
            <div className="flex aspect-square w-full max-w-[250px] flex-col items-center justify-center gap-3 rounded-2xl bg-warning/12 p-6 text-sm text-warning">
              <Hourglass className="size-10 animate-pulse" aria-hidden />
              {t("ticket_qr_after_waitlist")}
            </div>
          )}
          <code className="rounded-lg bg-muted px-3 py-1.5 font-mono text-lg font-bold tracking-widest" aria-label={t("ticket_code")}>
            {ticket.code}
          </code>
          {showQr && <p className="text-xs text-muted-foreground">{t("ticket_show_at_door")}</p>}
        </section>

        <section className="space-y-6 p-6 sm:p-8">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact icon={CalendarDays} label={t("field_date")} value={formatRange(c.startsAt, c.endsAt, locale, c.timezone)} />
            <Fact icon={Clock} label={t("field_time")} value={`${formatTime(c.startsAt, locale, c.timezone)} – ${formatTime(c.endsAt, locale, c.timezone)}`} />
            <Fact icon={MapPin} label={t("venue")} value={place || t("online_event")} wide />
            <Fact icon={UserRound} label={t("field_name")} value={ticket.name} />
            <Fact icon={Mail} label={t("field_email")} value={ticket.email} />
            <Fact icon={Clock} label={t("registered_on")} value={`${formatDate(ticket.createdAt, locale, "long", c.timezone)}, ${formatTime(ticket.createdAt, locale, c.timezone)}`} wide />
          </dl>
          {!gone && <p className="rounded-xl bg-primary/8 p-3 text-sm">{t("ticket_keep_link")}</p>}
          <div className="flex flex-wrap gap-2 print:hidden">
            {!gone && (
              <div className="w-full sm:w-auto" data-tour="tk-calendar">
                <AddToCalendar slug={c.slug} title={title} details={localized(c.summary, locale)} location={place} startsAt={c.startsAt} endsAt={c.endsAt} />
              </div>
            )}
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/c/${c.slug}`}>
                <Info className="size-4" aria-hidden /> {t("view_details")}
              </Link>
            </Button>
            {showQr && <PrintButton />}
            <HelpButton tour="ticket" />
          </div>
          {canCancel && (
            <div className="border-t pt-4 print:hidden" data-tour="tk-cancel">
              <TicketActions
                mode="cancel"
                ticketCode={ticket.code}
                body={t(waiting ? "cancel_waitlist_body" : "cancel_registration_body", { title })}
              />
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

function Fact({ icon: Icon, label, value, wide }: { icon: typeof Clock; label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden /> {label}
      </dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}

async function TicketMissing() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-lg rounded-3xl border bg-card p-10 text-center">
      <TicketIcon className="mx-auto size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-extrabold">{t("ticket_not_found")}</h1>
      <p className="mt-2 text-muted-foreground">{t("ticket_not_found_body")}</p>
      <Button asChild className="mt-6 rounded-xl">
        <Link href="/conferences">{t("browse_conferences")}</Link>
      </Button>
    </div>
  );
}
