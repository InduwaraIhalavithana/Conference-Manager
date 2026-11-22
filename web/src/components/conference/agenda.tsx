"use client";

import { Clock, DoorOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { Locale } from "@/i18n/routing";
import { formatDay, formatTime, localized } from "@/lib/format";
import { cn } from "@/lib/utils";

type Text = { en: string; si: string | null; ta: string | null };

export type AgendaData = {
  timezone: string;
  days: { date: string; label: Text | null }[];
  sessions: {
    id: string;
    day: string;
    kind: "KEYNOTE" | "TALK" | "WORKSHOP" | "PANEL" | "BREAK";
    title: Text;
    description: Text | null;
    startsAt: string;
    endsAt: string;
    room: string | null;
    track: { name: Text; color: string } | null;
    speakers: { id: string; name: string; photoUrl: string | null }[];
  }[];
};

const KIND_STYLE: Record<AgendaData["sessions"][number]["kind"], string> = {
  KEYNOTE: "bg-brand-2/15 text-brand-2 border-brand-2/30",
  TALK: "bg-primary/12 text-primary border-primary/30",
  WORKSHOP: "bg-success/12 text-success border-success/30",
  PANEL: "bg-warning/15 text-warning border-warning/30",
  BREAK: "bg-muted text-muted-foreground border-border",
};

export function Agenda({ data }: { data: AgendaData }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [day, setDay] = useState(data.days[0]?.date ?? "");
  const sessions = data.sessions.filter((s) => s.day === day);

  if (data.sessions.length === 0) {
    return <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{t("agenda_empty")}</p>;
  }

  return (
    <div className="space-y-5">
      {data.days.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("agenda")}>
          {data.days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={d.date === day}
              onClick={() => setDay(d.date)}
              className={cn(
                "rounded-xl border px-4 py-2 text-left transition",
                d.date === day ? "border-primary bg-primary text-primary-foreground shadow" : "bg-card hover:border-primary/50",
              )}
            >
              <span className="block text-xs font-semibold uppercase tracking-wide opacity-80">
                {d.label ? localized(d.label, locale) : t("day_n", { n: i + 1 })}
              </span>
              <span className="block font-bold">{formatDay(d.date, locale, "short")}</span>
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel">
      <ol className="relative space-y-3 border-l-2 border-primary/25 pl-6">
        {sessions.map((s) => (
          <li key={s.id} className="relative animate-rise">
            <span
              className="absolute -left-[33px] top-5 size-4 rounded-full border-4 border-background"
              style={{ background: s.track?.color ?? "var(--primary)" }}
              aria-hidden
            />
            <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", s.kind === "BREAK" && "border-dashed bg-transparent shadow-none")}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                  <Clock className="size-4 text-primary" aria-hidden />
                  {formatTime(s.startsAt, locale, data.timezone)} – {formatTime(s.endsAt, locale, data.timezone)}
                </span>
                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", KIND_STYLE[s.kind])}>
                  {t(`kind_${s.kind.toLowerCase()}`)}
                </span>
                {s.track && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <span className="size-2.5 rounded-full" style={{ background: s.track.color }} aria-hidden />
                    {localized(s.track.name, locale)}
                  </span>
                )}
                {s.room && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <DoorOpen className="size-3.5" aria-hidden /> {s.room}
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-lg font-bold">{localized(s.title, locale)}</h3>
              {s.description && <p className="mt-1 text-sm text-muted-foreground">{localized(s.description, locale)}</p>}
              {s.speakers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.speakers.map((sp) => (
                    <a
                      key={sp.id}
                      href={`#speaker-${sp.id}`}
                      className="inline-flex items-center gap-2 rounded-full border bg-background/60 py-1 pl-1 pr-3 text-sm font-medium hover:border-primary/50"
                    >
                      <Avatar name={sp.name} photoUrl={sp.photoUrl} size="size-7" />
                      {sp.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      </div>
    </div>
  );
}

export function Avatar({ name, photoUrl, size = "size-12" }: { name: string; photoUrl: string | null; size?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api${photoUrl}`} alt="" className={cn(size, "shrink-0 rounded-full object-cover")} />
  ) : (
    <span
      className={cn(size, "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-bold text-white")}
      aria-hidden
    >
      {initials}
    </span>
  );
}
