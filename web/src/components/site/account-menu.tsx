"use client";

import { Bell, CheckCheck, LayoutDashboard, LogIn, LogOut, Settings, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { useMutation, useQuery } from "urql";

import { LogoutMutation, MarkReadMutation, MeQuery, NotificationsQuery, UnreadQuery } from "@/components/organizer/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime } from "@/lib/format";
import { notificationText } from "@/lib/notifications";
import { sessionChanged, useWho } from "@/lib/session";
import { cn } from "@/lib/utils";

/** "Sign in" for visitors; the notification bell and account menu for organizers and admins. */
export function AccountMenu() {
  const t = useTranslations();
  const who = useWho();
  if (!who) {
    return (
      <Button asChild size="sm" className="ml-1 hidden rounded-lg sm:inline-flex">
        <Link href="/login">
          <LogIn className="size-4" aria-hidden /> {t("login")}
        </Link>
      </Button>
    );
  }
  return (
    <>
      <NotificationBell />
      <AccountDropdown area={who === "admin" ? "admin" : "dashboard"} />
    </>
  );
}

function Initials({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api${url}`} alt="" className={cn("rounded-full object-cover", className)} />
  ) : (
    <span className={cn("inline-flex items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 font-bold text-white", className)}>
      {letters || "?"}
    </span>
  );
}

export { Initials as Avatar };

function AccountDropdown({ area }: { area: "dashboard" | "admin" }) {
  const t = useTranslations();
  const router = useRouter();
  const [{ data }] = useQuery({ query: MeQuery });
  const [, logout] = useMutation(LogoutMutation);
  const me = data?.me;
  const name = me?.__typename === "Organizer" ? `${me.firstName} ${me.lastName}` : me?.__typename === "Admin" ? me.username : "";
  const avatar = me?.__typename === "Organizer" ? me.avatarUrl : null;

  async function signOut() {
    await logout({});
    sessionChanged();
    router.replace("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" data-tour="nav-account" aria-label={t("open_menu_account")}>
          <Initials name={name} url={avatar} className="size-8 text-xs" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {me && (
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate font-semibold">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{me.email}</span>
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${area}`}>
            {area === "admin" ? <ShieldCheck className="size-4" aria-hidden /> : <LayoutDashboard className="size-4" aria-hidden />}
            {area === "admin" ? t("admin_home_title") : t("nav_my_dashboard")}
          </Link>
        </DropdownMenuItem>
        {area === "dashboard" && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <Settings className="size-4" aria-hidden /> {t("nav_settings")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4" aria-hidden /> {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationBell() {
  const t = useTranslations();
  const [{ data: unreadData }, refetchUnread] = useQuery({ query: UnreadQuery, requestPolicy: "cache-and-network" });
  const [{ data: listData }, refetchList] = useQuery({ query: NotificationsQuery, variables: { first: 8 }, requestPolicy: "cache-and-network" });
  const [, markRead] = useMutation(MarkReadMutation);
  const unread = unreadData?.unreadNotifications.__typename === "UnreadCount" ? unreadData.unreadNotifications.unread : 0;
  const page = listData?.notifications.__typename === "NotificationPage" ? listData.notifications : null;

  // New registrations arrive while the organizer works: check once a minute while the tab is visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refetchUnread({ requestPolicy: "network-only" });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refetchUnread]);

  async function readAll() {
    await markRead({ ids: null });
    refetchUnread({ requestPolicy: "network-only" });
    refetchList({ requestPolicy: "network-only" });
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && refetchList({ requestPolicy: "network-only" })}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-tour="nav-bell" aria-label={unread ? t("notifications_unread", { count: unread }) : t("notifications")}>
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-bold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-semibold">{t("notifications")}</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={readAll}>
              <CheckCheck className="size-3.5" aria-hidden /> {t("mark_all_read")}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {page && page.items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{t("notifications_empty")}</p>}
          {page?.items.map((n) => (
            <DropdownMenuItem key={n.id} asChild className="rounded-none border-b px-3 py-2.5 last:border-b-0">
              <NotificationRow notification={n} />
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type NotificationItem = { id: string; kind: string; params: unknown; link?: string | null; read: boolean; createdAt: string };

/** One notification: a link when it points somewhere. Wrap it in a menu item or a list item. */
export function NotificationRow({ notification: n, className, ...rest }: { notification: NotificationItem; className?: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const text = notificationText(t, n.kind, (n.params ?? {}) as Record<string, unknown>);
  const when = `${formatDate(n.createdAt, locale, "short")}, ${formatTime(n.createdAt, locale)}`;
  const body = (
    <span className="flex gap-2.5">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden />
      <span className="min-w-0">
        <span className={cn("block text-sm", !n.read && "font-semibold")}>{text}</span>
        <span className="block text-xs text-muted-foreground">{when}</span>
      </span>
    </span>
  );
  return n.link ? (
    <Link href={n.link} className={className} {...rest}>
      {body}
    </Link>
  ) : (
    <div className={className} {...rest}>
      {body}
    </div>
  );
}
