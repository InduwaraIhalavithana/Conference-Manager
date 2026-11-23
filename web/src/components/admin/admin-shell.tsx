"use client";

import { Activity, Building2, CalendarDays, ChevronLeft, ChevronRight, Inbox, LayoutDashboard, Loader2, ServerCog, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect } from "react";
import { useQuery } from "urql";

import { AdminOverviewQuery } from "@/components/admin/admin-queries";
import { HelpButton, type TourName } from "@/components/tour/tour";
import { MeQuery } from "@/components/organizer/queries";
import { Button } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", key: "admin_home_title", icon: LayoutDashboard, exact: true },
  { href: "/admin/organizers", key: "nav_organizers", icon: Building2, exact: false },
  { href: "/admin/conferences", key: "nav_conferences", icon: CalendarDays, exact: false },
  { href: "/admin/inbox", key: "nav_inbox", icon: Inbox, exact: false },
  { href: "/admin/activity", key: "nav_activity", icon: Activity, exact: false },
  { href: "/admin/system", key: "nav_system", icon: ServerCog, exact: false },
] as const;

const TOURS: Record<string, TourName> = { "/admin": "admin", "/admin/organizers": "adminOrganizers", "/admin/conferences": "adminConferences", "/admin/inbox": "adminInbox" };

const OVERVIEW_CONTEXT = { additionalTypenames: ["ContactMessage", "FeedbackItem", "AdminOrganizer", "AdminConference"] };

/** Sidebar and admin check for every /admin page except sign-in. Organizers are sent to their own dashboard. */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [{ data, fetching }] = useQuery({ query: MeQuery });
  // Refreshed whenever an inbox action returns a contact message or feedback item, so the badge stays right.
  const [{ data: overview }] = useQuery({
    query: AdminOverviewQuery,
    pause: data?.me?.__typename !== "Admin",
    requestPolicy: "cache-and-network",
    context: OVERVIEW_CONTEXT,
  });
  const me = data?.me;

  useEffect(() => {
    if (fetching || data === undefined) return;
    if (!me) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    else if (me.__typename === "Organizer") router.replace("/dashboard");
  }, [me, data, fetching, pathname, router]);

  if (!me || me.__typename !== "Admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="size-8 animate-spin text-primary" aria-label={t("loading")} />
      </div>
    );
  }
  const o = overview?.adminOverview.__typename === "AdminOverview" ? overview.adminOverview : null;
  const waiting = o ? o.contactsOpen + o.feedbackOpen : 0;
  const tour = TOURS[pathname] ?? null;

  return (
    <div className="mx-auto grid max-w-page gap-6 px-4 py-8 sm:px-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 hidden items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-800 to-indigo-950 p-3 text-white lg:flex">
          <ShieldCheck className="size-8 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="truncate font-semibold">{t("admin_area")}</p>
            <p className="truncate text-xs text-white/75">{me.email}</p>
          </div>
        </div>
        <nav aria-label={t("admin_area")} className="flex gap-1 overflow-x-auto lg:flex-col" data-tour="adm-nav">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
                {item.href === "/admin/inbox" && waiting > 0 && (
                  <span className={cn("ml-auto rounded-full px-1.5 text-xs font-bold tabular-nums", active ? "bg-primary-foreground text-primary" : "bg-red-600 text-white")}>{waiting}</span>
                )}
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
  );
}

/** Previous / next for the offset-paged admin lists. */
export function Pager({ offset, total, size, onChange }: { offset: number; total: number; size: number; onChange: (offset: number) => void }) {
  const t = useTranslations();
  if (total <= size) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground tabular-nums">{t("shown_of_total", { shown: `${offset + 1}–${Math.min(offset + size, total)}`, total })}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-lg" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - size))} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button variant="outline" size="sm" className="rounded-lg" disabled={offset + size >= total} onClick={() => onChange(offset + size)} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
    </header>
  );
}
