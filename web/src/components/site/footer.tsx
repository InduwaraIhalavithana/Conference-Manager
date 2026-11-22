import { useTranslations } from "next-intl";

import { CurrentYear } from "@/components/site/current-year";
import { Link } from "@/i18n/navigation";
import { CONTACT_EMAIL, CREATOR } from "@/lib/site";

export function Footer() {
  const t = useTranslations();
  return (
    <footer className="mt-16 border-t bg-band">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="flex items-center gap-2.5 text-lg font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={28} height={28} className="size-7 rounded-lg" />
            <span>
              Conference<span className="text-primary">Hub</span>
            </span>
          </p>
          <p className="max-w-md text-sm text-muted-foreground">{t("footer_tagline")}</p>
        </div>
        <nav aria-label={t("footer_explore")} className="space-y-3 text-sm">
          <p className="font-semibold">{t("footer_explore")}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link className="hover:text-foreground" href="/conferences">
                {t("nav_conferences")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/about">
                {t("nav_about")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/contact">
                {t("nav_contact")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={t("footer_legal")} className="space-y-3 text-sm">
          <p className="font-semibold">{t("footer_legal")}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link className="hover:text-foreground" href="/privacy">
                {t("nav_privacy")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/terms">
                {t("nav_terms")}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="space-y-3 text-sm">
          <p className="font-semibold">{t("footer_contact")}</p>
          <a className="block break-all text-muted-foreground hover:text-foreground" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          <p className="text-muted-foreground">{t("footer_location")}</p>
          <p className="text-muted-foreground">{t("footer_made")}</p>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <span>
            © <CurrentYear /> ConferenceHub. {t("footer_rights")}
          </span>
          <Link href="/about#creator" className="hover:text-foreground">
            {t("footer_created_by", { name: CREATOR.name })}
          </Link>
        </div>
      </div>
    </footer>
  );
}
