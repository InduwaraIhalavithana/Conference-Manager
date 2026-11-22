"use client";

import { ArrowLeft, Camera, CameraOff, CheckCircle2, CircleAlert, CloudOff, Hourglass, Keyboard, Radio, RefreshCw, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { CheckIn, MyConferenceQuery } from "@/components/organizer/conference-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { enqueue, pending, remove } from "@/lib/checkin-queue";
import { errorMessage } from "@/lib/errors";
import { formatNumber, formatTime, localized } from "@/lib/format";
import { makeQrReader, ticketCodeFrom } from "@/lib/qr-scan";
import { cn } from "@/lib/utils";

type Outcome =
  | { kind: "ok"; name: string }
  | { kind: "already"; name: string; at: string }
  | { kind: "queued"; code: string }
  | { kind: "error"; text: string; tone: "warn" | "bad" };

type Counts = { checkedIn: number; confirmed: number };
type Arrival = { name: string; at: string };

const SAME_CODE_MS = 4000;

export function CheckinDesk({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data }] = useQuery({ query: MyConferenceQuery, variables: { id } });
  const [, checkIn] = useMutation(CheckIn);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [live, setLive] = useState(false);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [code, setCode] = useState("");
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busy = useRef(false);
  const [sending, setSending] = useState(false);

  const conf = data?.myConference.__typename === "Conference" ? data.myConference : null;
  const timezone = conf?.timezone;

  const refreshQueue = useCallback(async () => setQueued((await pending(id).catch(() => [])).length), [id]);

  /** Sends one scan. Network trouble (not an answer from the server) puts it in the offline queue. */
  const submit = useCallback(
    async (raw: string, scannedAt = new Date().toISOString(), fromQueue = false): Promise<"done" | "queued"> => {
      const ticket = ticketCodeFrom(raw);
      if (!ticket) return "done";
      if (!navigator.onLine && !fromQueue) {
        await enqueue({ conferenceId: id, code: ticket, scannedAt });
        await refreshQueue();
        setOutcome({ kind: "queued", code: ticket });
        return "queued";
      }
      const result = await checkIn({ conferenceId: id, code: ticket, scannedAt });
      const answer = result.data?.checkIn;
      if (!answer) {
        if (!fromQueue) {
          await enqueue({ conferenceId: id, code: ticket, scannedAt });
          await refreshQueue();
          setOutcome({ kind: "queued", code: ticket });
        }
        return "queued";
      }
      if (fromQueue) return "done";
      if (answer.__typename === "CheckedIn") {
        setOutcome({ kind: "ok", name: answer.attendee.name });
        navigator.vibrate?.(80);
      } else if (answer.__typename === "AlreadyCheckedIn") {
        setOutcome({ kind: "already", name: answer.attendee.name, at: answer.checkedInAt });
        navigator.vibrate?.([60, 60, 60]);
      } else {
        const tone = answer.code === "CHECKIN_WAITLISTED" || answer.code === "CHECKIN_UNCONFIRMED" ? "warn" : "bad";
        setOutcome({ kind: "error", text: errorMessage(t, answer), tone });
        navigator.vibrate?.([200]);
      }
      return "done";
    },
    [checkIn, id, refreshQueue, t],
  );

  /** Sends the waiting offline scans, oldest first; stops at the first one that still cannot get through. */
  const flush = useCallback(async () => {
    const waiting = await pending(id).catch(() => []);
    let sent = 0;
    for (const scan of waiting) {
      if ((await submit(scan.code, scan.scannedAt, true)) === "queued") break;
      if (scan.id !== undefined) await remove(scan.id);
      sent++;
    }
    await refreshQueue();
    if (sent) toast.success(t("ci_synced", { count: sent }));
  }, [id, refreshQueue, submit, t]);

  // The desk can be reopened offline (public/sw.js keeps this page and its files). Production only: in
  // development the built files keep the same names between edits, so a cached copy would hide new code.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    } else {
      void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()));
    }
  }, []);

  // Online/offline, and syncing whatever waited while offline.
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void flush();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const timer = window.setInterval(() => navigator.onLine && void flush(), 30_000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.clearInterval(timer);
    };
  }, [flush]);

  // Live numbers and arrivals from every desk (server-sent events; the browser reconnects by itself).
  useEffect(() => {
    const source = new EventSource(`/api/conferences/${id}/live`);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as { type: string; checkedIn?: number; confirmed?: number; name?: string; at?: string };
      if (event.checkedIn !== undefined && event.confirmed !== undefined) setCounts({ checkedIn: event.checkedIn, confirmed: event.confirmed });
      if (event.type === "checked_in" && event.name) {
        setArrivals((list) => [{ name: event.name as string, at: event.at ?? new Date().toISOString() }, ...list].slice(0, 12));
      }
    };
    return () => source.close();
  }, [id]);

  /** Handles one scanned or typed code; false when it was ignored (a check still running, or the same QR again). */
  const onCode = useCallback(
    async (raw: string): Promise<boolean> => {
      const ticket = ticketCodeFrom(raw);
      const now = Date.now();
      if (busy.current || (ticket === lastScan.current.code && now - lastScan.current.at < SAME_CODE_MS)) return false;
      lastScan.current = { code: ticket, at: now };
      busy.current = true;
      setSending(true);
      try {
        await submit(ticket);
      } finally {
        busy.current = false;
        setSending(false);
      }
      return true;
    },
    [submit],
  );

  async function typed(event: FormEvent) {
    event.preventDefault();
    lastScan.current = { code: "", at: 0 };
    // Keep what was typed if it could not be sent yet, so a code typed during another check is never lost.
    if (await onCode(code)) setCode("");
  }

  if (data?.myConference.__typename === "UserError") {
    return <p className="rounded-2xl border p-8 text-center">{t("conf_not_yours")}</p>;
  }

  const pct = counts && counts.confirmed ? Math.round((counts.checkedIn / counts.confirmed) * 100) : 0;
  const notOpen = conf && conf.status !== "PUBLISHED";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/dashboard/conferences/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> {conf ? localized(conf.title, locale) : t("edit_conference")}
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{t("ci_scan")}</h1>
          <p className="text-muted-foreground">{t("ci_sub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold", live ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
            <Radio className={cn("size-4", live && "animate-pulse")} aria-hidden /> {t("ci_live")}
          </span>
          {!online && (
            <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 font-semibold text-warning">
              <CloudOff className="size-4" aria-hidden /> {t("ci_offline")}
            </span>
          )}
          {queued > 0 && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => void flush()}>
              <RefreshCw className="size-4" aria-hidden /> {t("ci_queue_count", { count: queued })}
            </Button>
          )}
        </div>
      </header>

      {notOpen && <p className="rounded-2xl bg-warning/12 p-4 text-sm font-medium">{t("ci_not_published")}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Scanner onCode={onCode} disabled={Boolean(notOpen)} />
          <form onSubmit={typed} className="space-y-1.5 rounded-2xl border bg-card p-4" data-tour="ci-typed">
            <Label htmlFor="ci-code">{t("ci_manual")}</Label>
            <div className="flex gap-2">
              <Input
                id="ci-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="ci-code-hint"
                className="h-12 font-mono text-lg tracking-widest"
                disabled={Boolean(notOpen)}
              />
              <Button type="submit" className="h-12 rounded-xl px-5" disabled={!code.trim() || sending || Boolean(notOpen)}>
                <Keyboard className="size-4" aria-hidden /> {t("check_in")}
              </Button>
            </div>
            <p id="ci-code-hint" className="text-xs text-muted-foreground">
              {t("ci_manual_hint")}
            </p>
          </form>
        </div>

        <div className="space-y-4">
          <ResultCard outcome={outcome} timezone={timezone} />
          <section data-tour="ci-progress" aria-labelledby="ci-progress" className="rounded-2xl border bg-card p-5">
            <h2 id="ci-progress" className="sr-only">
              {t("stat_checked_in")}
            </h2>
            <div className="flex items-end justify-between gap-3">
              <p className="text-4xl font-extrabold tabular-nums" aria-live="polite">
                {counts ? formatNumber(counts.checkedIn, locale) : "–"}
                <span className="text-lg font-semibold text-muted-foreground"> / {counts ? formatNumber(counts.confirmed, locale) : "–"}</span>
              </p>
              <p className="text-sm text-muted-foreground">{counts ? t("ci_progress", { pct, left: Math.max(0, counts.confirmed - counts.checkedIn) }) : ""}</p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </section>
          <section data-tour="ci-recent" aria-labelledby="ci-recent" className="rounded-2xl border bg-card">
            <h2 id="ci-recent" className="border-b px-5 py-3 font-bold">
              {t("ci_recent")}
            </h2>
            {arrivals.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{t("ci_recent_empty")}</p>
            ) : (
              <ul className="divide-y">
                {arrivals.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="flex animate-rise items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="size-4 text-success" aria-hidden /> {a.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatTime(a.at, locale, timezone)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Big, fixed colours (not the theme's) so the result reads at a glance and passes contrast in light and dark. */
function ResultCard({ outcome, timezone }: { outcome: Outcome | null; timezone?: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (!outcome) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
        {t("ci_camera_hint")}
      </div>
    );
  }
  const view =
    outcome.kind === "ok"
      ? { icon: CheckCircle2, tone: "bg-emerald-700 text-white", title: t("ci_welcome", { name: outcome.name }), body: t("ci_ok_body") }
      : outcome.kind === "already"
        ? { icon: CircleAlert, tone: "bg-amber-400 text-black", title: t("ci_already", { name: outcome.name }), body: t("ci_already_at", { time: formatTime(outcome.at, locale, timezone) }) }
        : outcome.kind === "queued"
          ? { icon: Hourglass, tone: "bg-sky-700 text-white", title: outcome.code, body: t("ci_queued") }
          : { icon: XCircle, tone: outcome.tone === "warn" ? "bg-amber-400 text-black" : "bg-red-700 text-white", title: t("ci_not_found"), body: outcome.text };
  return (
    <div key={JSON.stringify(outcome)} className={cn("flex min-h-36 animate-rise items-center gap-4 rounded-2xl p-6 shadow-lg", view.tone)} role="status" aria-live="assertive">
      <view.icon className="size-12 shrink-0" aria-hidden />
      <div>
        <p className="text-2xl font-extrabold">{view.title}</p>
        <p className="mt-1">{view.body}</p>
      </div>
    </div>
  );
}

/** The camera preview and the scanning loop (about four looks a second). */
function Scanner({ onCode, disabled }: { onCode: (code: string) => void; disabled: boolean }) {
  const t = useTranslations();
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const read = makeQrReader();
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const found = await read(video.current);
          if (found) onCode(found);
          timer = window.setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setFailed(true);
        setOn(false);
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [on, onCode]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card" data-tour="ci-scan">
      <div className="relative flex aspect-video items-center justify-center bg-black">
        <video ref={video} className={cn("size-full object-cover", !on && "hidden")} muted playsInline aria-label={t("ci_scan")} />
        {on && <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden />}
        {!on && <Camera className="size-12 text-white/40" aria-hidden />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted-foreground">{failed ? t("ci_camera_denied") : t("ci_camera_hint")}</p>
        <Button onClick={() => { setFailed(false); setOn((v) => !v); }} variant={on ? "outline" : "default"} className="rounded-xl" disabled={disabled}>
          {on ? <CameraOff className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />} {on ? t("ci_camera_off") : t("ci_camera_on")}
        </Button>
      </div>
    </div>
  );
}
