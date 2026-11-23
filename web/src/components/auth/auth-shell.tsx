import { CheckCircle2, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";

import { graphql } from "@/graphql/generated";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { query } from "@/lib/graphql/server";
import { cn } from "@/lib/utils";

const AuthStats = graphql(`
  query AuthStats {
    platformStats { upcomingConferences registeredAttendees organizers }
  }
`);

/** Two panels: why to sign in (with live numbers) on one side, the form on the other. */
export function AuthShell({
  icon: Icon,
  title,
  subtitle,
  sideTitle,
  points,
  admin = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  sideTitle: string;
  points: string[];
  admin?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-page px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-16">
      <aside
        className={cn(
          "relative hidden overflow-hidden rounded-l-3xl p-10 text-white lg:block",
          admin ? "bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950" : "bg-gradient-to-br from-brand via-sky-700 to-brand-2",
        )}
      >
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="absolute -bottom-20 -left-10 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-tight">{sideTitle}</h2>
          <ul className="mt-6 space-y-3">
            {points.map((point, i) => (
              <li key={point} className="flex animate-rise gap-2.5" style={{ animationDelay: `${150 + i * 90}ms` }}>
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-white/90" aria-hidden /> {point}
              </li>
            ))}
          </ul>
          <Suspense fallback={<StatsRow values={null} />}>
            <Stats />
          </Suspense>
        </div>
      </aside>
      <section className="rounded-3xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-10 lg:rounded-l-none xl:px-16 2xl:px-24">
        <span
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-2xl text-white shadow-lg",
            admin ? "bg-gradient-to-br from-slate-700 to-indigo-900" : "bg-gradient-to-br from-brand to-brand-2",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </section>
    </div>
  );
}

async function Stats() {
  const values = await query(AuthStats)
    .then(({ platformStats: s }) => [s.upcomingConferences, s.registeredAttendees, s.organizers])
    .catch(() => null);
  return <StatsRow values={values} />;
}

async function StatsRow({ values }: { values: number[] | null }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const labels = [t("stat_upcoming"), t("stat_attendees"), t("stat_organizers")];
  return (
    <dl className="mt-10 grid grid-cols-3 gap-3">
      {labels.map((label, i) => (
        <div key={label} className="flex flex-col-reverse rounded-2xl bg-white/12 p-3 backdrop-blur">
          <dt className="text-xs text-white/85">{label}</dt>
          <dd className="text-2xl font-extrabold tabular-nums">{values ? formatNumber(values[i], locale) : "–"}</dd>
        </div>
      ))}
    </dl>
  );
}
