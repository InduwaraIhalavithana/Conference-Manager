"use client";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Guided help, ported from v2. It never starts by itself: the page shows a "Need help?" button and
 * the tour runs only when it is pressed. Each step points at an element with `data-tour="..."`;
 * steps whose element is not on screen right now (an empty list, another tab) are skipped.
 *
 * Text comes from `tour_<name>_<n>_title` / `_body`, so every language has its own wording.
 * When a page changes, change its steps here in the same pull request.
 */
export const TOURS = {
  dashboard: ["dash-stats", "dash-upcoming", "dash-quick", "nav-bell", "nav-account"],
  myConferences: ["mc-create", "mc-filters", "mc-actions"],
  editor: ["ed-tabs", "ed-venue", "ed-capacity", "ed-save"],
  attendees: ["at-stats", "at-filters", "at-tools", "at-actions"],
  checkIn: ["ci-pick", "ci-scan", "ci-typed", "ci-progress", "ci-recent"],
  analytics: ["an-pick", "an-chart", "an-table", "an-feedback"],
  settings: ["set-photo", "set-profile", "set-security"],
  admin: ["adm-stats", "adm-system", "adm-notes", "adm-nav"],
  adminOrganizers: ["ao-filters", "ao-actions"],
  adminConferences: ["ac-filters", "ac-hide"],
  adminInbox: ["ai-tabs", "ai-status", "ai-reply"],
  conference: ["cd-register", "cd-calendar", "cd-agenda", "cd-map"],
  ticket: ["tk-qr", "tk-calendar", "tk-agenda", "tk-feedback", "tk-cancel"],
} as const;

export type TourName = keyof typeof TOURS;

type Step = { target: string; title: string; body: string };

function visibleTarget(target: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function HelpButton({ tour, className }: { tour: TourName; className?: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const steps: Step[] = TOURS[tour].map((target, i) => ({ target, title: t(`tour_${tour}_${i + 1}_title`), body: t(`tour_${tour}_${i + 1}_body`) }));
  return (
    <>
      <Button ref={trigger} type="button" variant="outline" className={cn("gap-2 rounded-xl", className)} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <CircleHelp className="size-4 text-primary" aria-hidden /> {t("tour_help")}
        <span className="sr-only"> {t("tour_help_aria")}</span>
      </Button>
      {open && (
        <Spotlight
          steps={steps}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        />
      )}
    </>
  );
}

function Spotlight({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  const t = useTranslations();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const card = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  // Decided once, when opened: the steps that have something to point at.
  const [visible] = useState(() => {
    const list = steps.filter((s) => visibleTarget(s.target));
    return list.length ? list : steps.slice(0, 1);
  });
  const step = visible[index];
  const last = index === visible.length - 1;

  const measure = useCallback(() => {
    const el = visibleTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
    setSize({ w: window.innerWidth, h: window.innerHeight });
  }, [step]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    visibleTarget(step.target)?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    const timers = [0, 150, 350, 700].map((ms) => window.setTimeout(measure, ms));
    card.current?.focus();
    return () => timers.forEach(clearTimeout);
  }, [step, measure]);

  useEffect(() => {
    const onMove = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(visible.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (e.key === "Tab" && card.current) {
        // Keep keyboard focus inside the guide while it is open.
        const items = [...card.current.querySelectorAll<HTMLElement>("button")];
        const first = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === card.current)) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf.current);
    };
  }, [measure, onClose, visible.length]);

  const margin = 16;
  const width = Math.min(360, size.w - margin * 2);
  let box: CSSProperties;
  if (rect) {
    const left = Math.min(Math.max(margin, rect.left), size.w - width - margin);
    const top = Math.max(margin, Math.min(rect.top, size.h - 280));
    if (size.h - rect.bottom > 240) box = { top: rect.bottom + margin, left };
    else if (rect.top > 240) box = { bottom: size.h - rect.top + margin, left };
    // A tall target: beside it when there is room, otherwise over its lower edge.
    else if (rect.left > width + margin * 2) box = { top, left: rect.left - width - margin * 1.5 };
    else if (size.w - rect.right > width + margin * 2) box = { top, left: rect.right + margin * 1.5 };
    else box = { bottom: margin, left };
  } else {
    box = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl outline-4 outline-primary outline-solid transition-all duration-200 motion-reduce:transition-none"
          style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16, boxShadow: "0 0 0 9999px rgb(2 6 23 / 0.6)" }}
          aria-hidden
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-slate-950/60" aria-hidden />
      )}
      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute space-y-3 rounded-2xl border bg-popover p-5 text-popover-foreground shadow-2xl outline-none"
        style={{ ...box, width }}
      >
        <div className="flex items-center gap-1.5" aria-hidden>
          {visible.map((s, i) => (
            <span key={s.target} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40")} />
          ))}
          <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
            {index + 1} / {visible.length}
          </span>
        </div>
        <h2 id="tour-title" className="text-lg font-bold" aria-live="polite">
          {step.title}
        </h2>
        <p id="tour-body" className="text-sm text-muted-foreground">
          {step.body}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("tour_skip")}
          </Button>
          <span className="flex-1" />
          {index > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setIndex((i) => i - 1)}>
              {t("tour_back")}
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>
            {last ? t("tour_done") : t("tour_next")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
