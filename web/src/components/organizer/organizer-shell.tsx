"use client";

import { BarChart3, CalendarDays, CircleHelp, LayoutDashboard, Loader2, ScanLine, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, createContext, use, useEffect } from "react";
import { useQuery } from "urql";

import { MeQuery } from "@/components/organizer/queries";
import { Avatar } from "@/components/site/account-menu";
import { HelpButton, type TourName } from "@/components/tour/tour";
import type { MeQuery as MeQueryResult } from "@/graphql/generated/graphql";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type OrganizerMe = Extract<NonNullable<MeQueryResult["me"]>, { __typename: "Organizer" }>;

const OrganizerContext = createContext<OrganizerMe | null>(null);

/** The signed-in organizer, inside the organizer area. */
export function useOrganizer(): OrganizerMe {
  const me = use(OrganizerContext);
  if (!me) throw new Error("useOrganizer outside OrganizerShell");
  return me;
}

const NAV = [
  { href: "/dashboard", key: "nav_my_dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/conferences", key: "nav_my_conferences", icon: CalendarDays, exact: false },
  { href: "/dashboard/check-in", key: "nav_check_in", icon: ScanLine, exact: false },
  { href: "/dashboard/analytics", key: "nav_analytics", icon: BarChart3, exact: false },
  { href: "/dashboard/settings", key: "nav_settings", icon: Settings, exact: false },
  { href: "/dashboard/help", key: "nav_help", icon: CircleHelp, exact: false },
] as const;

/** The sidebar item for a path; a conference's check-in desk counts as Check-in, not My conferences. */
function activeItem(pathname: string): string | undefined {
  if (pathname.endsWith("/check-in")) return "/dashboard/check-in";
  return NAV.find((item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)))?.href;
}

/** The guided tour for a page, if it has one. */
function tourFor(pathname: string): TourName | null {
  const parts = pathname.split("/").filter(Boolean); // ["dashboard", ...]
  if (parts.length === 1) return "dashboard";
  const [, section, id, sub] = parts;
  if (section === "check-in" || sub === "check-in") return "checkIn";
  if (section === "analytics") return "analytics";
  if (section === "settings") return "settings";
  if (section === "conferences") {
    if (!id) return "myConferences";
    if (sub === "attendees") return "attendees";
    if (sub === "qa") return "qaModeration";
    if (!sub) return "editor";
  }
  return null;
}

/** Sidebar and account check for every /dashboard page. Signed-out visitors go to sign in, admins to /admin. */
export function OrganizerShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [{ data, fetching }] = useQuery({ query: MeQuery });
  const me = data?.me;

  useEffect(() => {
    if (fetching || data === undefined) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (me.__typename === "Admin") router.replace("/admin");
  }, [me, data, fetching, pathname, router]);

  if (!me || me.__typename !== "Organizer") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="size-8 animate-spin text-primary" aria-label={t("loading")} />
      </div>
    );
  }

  const current = activeItem(pathname);
  const tour = tourFor(pathname);

  return (
    <OrganizerContext value={me}>
      <div className="mx-auto grid max-w-page gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4 hidden items-center gap-3 rounded-2xl border bg-card p-3 lg:flex">
            <Avatar name={`${me.firstName} ${me.lastName}`} url={me.avatarUrl} className="size-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {me.firstName} {me.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{me.organization ?? me.email}</p>
            </div>
          </div>
          <nav aria-label={t("nav_my_dashboard")} className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map((item) => {
              const active = item.href === current;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground",
                    active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  <item.icon className="size-4" aria-hidden /> {t(item.key)}
                </Link>
              );
            })}
          </nav>
          {tour && <HelpButton key={tour} tour={tour} className="mt-4 hidden w-full justify-start lg:flex" />}
        </aside>
        <div className="min-w-0">
          {tour && (
            <div className="mb-4 flex justify-end lg:hidden">
              <HelpButton key={tour} tour={tour} />
            </div>
          )}
          {children}
        </div>
      </div>
    </OrganizerContext>
  );
}
