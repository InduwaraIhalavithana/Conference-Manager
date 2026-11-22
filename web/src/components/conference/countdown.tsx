"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

function partsUntil(target: number) {
  const left = Math.max(0, target - Date.now());
  return {
    days: Math.floor(left / 86_400_000),
    hours: Math.floor(left / 3_600_000) % 24,
    minutes: Math.floor(left / 60_000) % 60,
    seconds: Math.floor(left / 1000) % 60,
  };
}

/** Days, hours, minutes and seconds to a start time, ticking every second. */
export function Countdown({ startsAt }: { startsAt: string }) {
  const t = useTranslations();
  const target = new Date(startsAt).getTime();
  const [parts, setParts] = useState<ReturnType<typeof partsUntil> | null>(null);

  useEffect(() => {
    const tick = () => setParts(partsUntil(target));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const cells = [
    ["days", "cd_days"],
    ["hours", "cd_hours"],
    ["minutes", "cd_minutes"],
    ["seconds", "cd_seconds"],
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-live="off">
      {cells.map(([key, label]) => (
        <div key={key} className="rounded-xl border bg-background/60 px-2 py-2.5 text-center">
          <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">
            {parts ? String(parts[key]).padStart(2, "0") : "--"}
          </div>
          <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">{t(label)}</div>
        </div>
      ))}
    </div>
  );
}
