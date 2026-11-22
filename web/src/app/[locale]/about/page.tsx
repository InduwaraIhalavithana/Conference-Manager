import { Accessibility, CalendarDays, Check, Code2, Compass, Languages, Lock, Mail, Mic, ShieldCheck, UserCog, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { graphql } from "@/graphql/generated";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { query } from "@/lib/graphql/server";
import { CONTACT_EMAIL, CREATOR } from "@/lib/site";
import { alternates } from "@/lib/seo";

const AboutStats = graphql(`
  query AboutStats {
    platformStats { upcomingConferences registeredAttendees organizers speakers }
  }
`);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  return { title: t("nav_about"), description: t("about_lead"), alternates: alternates(locale, "/about") };
}

export default async function AboutPage() {
  const t = await getTranslations();
  const roles = [
    { icon: UserCog, title: t("about_role_org"), points: [1, 2, 3, 4].map((n) => t(`about_role_org_${n}`)), tone: "from-sky-500 to-blue-600" },
    { icon: Users, title: t("about_role_att"), points: [1, 2, 3, 4].map((n) => t(`about_role_att_${n}`)), tone: "from-emerald-500 to-teal-600" },
    { icon: ShieldCheck, title: t("about_role_admin"), points: [1, 2, 3, 4].map((n) => t(`about_role_admin_${n}`)), tone: "from-violet-500 to-fuchsia-600" },
  ];
  const values = [
    { icon: Languages, title: t("about_value_lang"), body: t("about_value_lang_body") },
    { icon: Lock, title: t("about_value_privacy"), body: t("about_value_privacy_body") },
    { icon: Accessibility, title: t("about_value_access"), body: t("about_value_access_body") },
    { icon: Zap, title: t("about_value_speed"), body: t("about_value_speed_body") },
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b bg-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-20">
          <div className="animate-[rise_.6s_ease-out]">
            <p className="text-sm font-bold uppercase tracking-widest text-primary">{t("nav_about")}</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{t("about_title")}</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{t("about_lead")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl">
                <Link href="/conferences">
                  <Compass className="size-4" aria-hidden /> {t("browse_conferences")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl">
                <Link href="/contact">
                  <Mail className="size-4" aria-hidden /> {t("nav_contact")}
                </Link>
              </Button>
            </div>
          </div>
          <Suspense fallback={<StatsGrid values={null} />}>
            <Stats />
          </Suspense>
        </div>
      </section>

      <Section band>
        <div className="grid gap-6 rounded-3xl border bg-card p-8 lg:grid-cols-[1fr_1.4fr] lg:p-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-primary">{t("about_mission_eyebrow")}</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{t("about_mission_title")}</h2>
          </div>
          <p className="text-lg leading-relaxed text-muted-foreground">{t("about_mission_body")}</p>
        </div>
      </Section>

      <Section>
        <h2 className="mb-8 text-3xl font-extrabold tracking-tight">{t("about_roles_title")}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {roles.map((r) => (
            <article key={r.title} className="group rounded-3xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
              <span className={`inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${r.tone} text-white shadow-lg`}>
                <r.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-xl font-bold">{r.title}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section band>
        <h2 className="mb-8 text-3xl font-extrabold tracking-tight">{t("about_values_title")}</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <div key={v.title} className="rounded-3xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <v.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-lg font-bold">{v.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{v.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div id="creator" className="grid scroll-mt-24 items-center gap-8 rounded-3xl border bg-card p-6 md:grid-cols-[280px_1fr] md:p-10">
          <Image
            src={CREATOR.photo}
            alt={CREATOR.name}
            width={320}
            height={320}
            className="mx-auto aspect-square w-full max-w-[280px] rounded-3xl object-cover shadow-xl ring-4 ring-primary/20"
          />
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-primary">{t("about_creator_eyebrow")}</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{CREATOR.name}</h2>
            <p className="mt-2 flex items-center gap-2 font-semibold text-muted-foreground">
              <Code2 className="size-4" aria-hidden /> {t("about_creator_role")}
            </p>
            <p className="mt-4 leading-relaxed">{t("about_creator_body")}</p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Stack">
              {["FastAPI", "GraphQL", "MongoDB", "Redis", "Next.js", "EN · සිං · தமி"].map((s) => (
                <li key={s} className="rounded-full border bg-background px-3 py-1 text-xs font-semibold">
                  {s}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 rounded-xl">
              <a href={CREATOR.github} target="_blank" rel="noopener noreferrer">
                <GithubMark /> {t("about_creator_github")}
              </a>
            </Button>
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-gradient-to-r from-brand to-brand-2 p-8 text-white shadow-xl">
          <div>
            <h2 className="text-2xl font-extrabold">{t("about_contact_title")}</h2>
            <p className="mt-1 text-white/85">{t("about_contact_body")}</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="rounded-xl">
            <a href={`mailto:${CONTACT_EMAIL}`}>
              <Mail className="size-4" aria-hidden /> {CONTACT_EMAIL}
            </a>
          </Button>
        </div>
      </Section>
    </>
  );
}

async function Stats() {
  const { platformStats: s } = await query(AboutStats);
  return <StatsGrid values={[s.upcomingConferences, s.registeredAttendees, s.organizers, s.speakers]} />;
}

async function StatsGrid({ values }: { values: number[] | null }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const items = [
    { icon: CalendarDays, label: t("stat_upcoming") },
    { icon: Users, label: t("stat_attendees") },
    { icon: UserCog, label: t("stat_organizers") },
    { icon: Mic, label: t("stat_speakers") },
  ];
  return (
    <dl className="grid grid-cols-2 gap-4">
      {items.map((item, i) => (
        <div key={item.label} className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <item.icon className="size-6 text-primary" aria-hidden />
          <dd className="mt-3 text-3xl font-extrabold tabular-nums">{values ? formatNumber(values[i], locale) : "–"}</dd>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
