"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useQuery } from "urql";

import { MeQuery, NotificationsQuery } from "@/components/organizer/queries";
import { NotificationRow } from "@/components/site/account-menu";
import { usePathname, useRouter } from "@/i18n/navigation";

/** The admin landing page: who is signed in and what arrived. The full admin pages come in Phase 5d. */
export function AdminHome() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [{ data, fetching }] = useQuery({ query: MeQuery });
  const [{ data: notes }] = useQuery({ query: NotificationsQuery, variables: { first: 30 }, requestPolicy: "cache-and-network" });
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
  const items = notes?.notifications.__typename === "NotificationPage" ? notes.notifications.items : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <header className="flex items-center gap-4">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-indigo-900 text-white shadow-lg">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("admin_home_title")}</h1>
          <p className="text-muted-foreground">{t("signed_in_as", { email: me.email })}</p>
        </div>
      </header>
      <section aria-labelledby="admin-notes" className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3">
          <h2 id="admin-notes" className="text-lg font-bold">
            {t("notifications")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("admin_home_sub")}</p>
        </div>
        {items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("notifications_empty")}</p>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow notification={{ ...n, link: null }} className="block px-5 py-3" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
