"use client";

import { Check, Languages, Menu, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type MouseEvent, useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { restoreAfterLanguageChange, saveForLanguageChange } from "@/lib/language-carry";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", key: "nav_home" },
  { href: "/conferences", key: "nav_conferences" },
  { href: "/about", key: "nav_about" },
  { href: "/contact", key: "nav_contact" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** The nav links, highlighting the current page. */
export function NavLinks() {
  return <NavLinksFor pathname={usePathname()} />;
}

/** Shown until the current address is known (pages whose address is only known at request time). */
export function NavLinksFallback() {
  return <NavLinksFor pathname={null} />;
}

function NavLinksFor({ pathname }: { pathname: string | null }) {
  const t = useTranslations();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname && isActive(pathname, item.href) ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            pathname && isActive(pathname, item.href) && "bg-accent text-accent-foreground",
          )}
        >
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}

export function LanguageSwitcher() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  // Same page in the new language: filters, the place on the page and anything typed all stay.
  function choose(code: Locale) {
    if (code === locale) return;
    const { pathname: current, search, hash } = window.location;
    saveForLanguageChange(current.replace(/^\/(en|si|ta)(?=\/|$)/, `/${code}`));
    startTransition(() => router.replace(`${pathname}${search}${hash}`, { locale: code, scroll: false }));
  }

  useEffect(restoreAfterLanguageChange, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${t("language")}: ${locale.toUpperCase()}`} disabled={pending} className="gap-1.5">
          <Languages className="size-4" aria-hidden />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((code) => (
          <DropdownMenuItem
            key={code}
            lang={code}
            onSelect={() => choose(code)}
          >
            <span className="flex-1">{t(`language_name_${code}`)}</span>
            {code === locale && <Check className="size-4" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggle() {
  const t = useTranslations();
  const theme = useTheme();

  // The new theme spreads out from the button as a circle, where the browser can do it.
  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next = theme === "dark" ? "light" : "dark";
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(next);
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const change = document.startViewTransition(() => setTheme(next));
    void change.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("toggle_theme")}
      onClick={toggle}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </Button>
  );
}

export function MobileMenu() {
  const t = useTranslations();
  const pathname = usePathname();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("open_menu")}>
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>ConferenceHub</SheetTitle>
        </SheetHeader>
        <nav aria-label="Main" className="flex flex-col gap-1 px-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2.5 font-medium hover:bg-accent",
                isActive(pathname, item.href) && "bg-accent text-accent-foreground",
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function LanguageSwitcherFallback() {
  const locale = useLocale();
  return (
    <Button variant="ghost" size="sm" disabled className="gap-1.5">
      <Languages className="size-4" aria-hidden />
      <span className="uppercase">{locale}</span>
    </Button>
  );
}

export function MobileMenuFallback() {
  return (
    <Button variant="ghost" size="icon" className="md:hidden" disabled>
      <Menu className="size-5" aria-hidden />
    </Button>
  );
}
