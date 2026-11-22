import { Suspense } from "react";

import {
  LanguageSwitcher,
  LanguageSwitcherFallback,
  MobileMenu,
  MobileMenuFallback,
  NavLinks,
  NavLinksFallback,
  ThemeToggle,
} from "@/components/site/header-controls";
import { AccountMenu } from "@/components/site/account-menu";
import { Link } from "@/i18n/navigation";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight" aria-label="ConferenceHub">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
          <span className="text-lg">
            Conference<span className="text-primary">Hub</span>
          </span>
        </Link>
        <div className="flex-1" />
        {/* These read the current address, which some pages only know at request time. */}
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
        <div className="flex items-center gap-1">
          <Suspense fallback={<LanguageSwitcherFallback />}>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggle />
          <AccountMenu />
          <Suspense fallback={<MobileMenuFallback />}>
            <MobileMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
