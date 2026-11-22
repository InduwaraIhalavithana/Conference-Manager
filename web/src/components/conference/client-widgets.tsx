"use client";

import { CalendarPlus, Check, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VenueMap = dynamic(() => import("@/components/conference/venue-map"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse bg-muted" />,
});

/**
 * The venue map, loaded only when it is about to scroll into view: Leaflet and its tiles are the
 * heaviest thing on the conference page and sit far below the fold on a phone.
 */
export function VenueMapLazy({ latitude, longitude }: { latitude: number; longitude: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return <div ref={ref}>{visible ? <VenueMap latitude={latitude} longitude={longitude} /> : <div className="h-72 bg-muted" />}</div>;
}

function googleDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function AddToCalendar({
  slug,
  title,
  details,
  location,
  startsAt,
  endsAt,
}: {
  slug: string;
  title: string;
  details: string;
  location: string;
  startsAt: string;
  endsAt: string;
}) {
  const t = useTranslations();
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${googleDate(startsAt)}/${googleDate(endsAt)}`,
    details,
    location,
  }).toString();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full rounded-xl">
          <CalendarPlus className="size-4" aria-hidden /> {t("add_to_calendar")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem asChild>
          <a href={google.toString()} target="_blank" rel="noopener noreferrer">
            {t("calendar_google")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/api/conferences/${slug}/calendar.ics`} download>
            {t("calendar_ics")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CopyLink() {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      className="w-full rounded-xl"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      {copied ? t("link_copied") : t("copy_link")}
    </Button>
  );
}
