"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";

/** A number that counts up the first time it scrolls into view. The real value is in the HTML from the start. */
export function CountUp({ value }: { value: number }) {
  const locale = useLocale() as Locale;
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / 1100);
          setShown(Math.round(value * (1 - (1 - p) ** 3)));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return <span ref={ref}>{formatNumber(shown, locale)}</span>;
}
