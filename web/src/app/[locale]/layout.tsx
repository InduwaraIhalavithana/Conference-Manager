import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Inter, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import { notFound } from "next/navigation";

import "../globals.css";

import { Providers } from "@/components/providers";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sinhala = Noto_Sans_Sinhala({ subsets: ["sinhala"], variable: "--font-sinhala", display: "swap" });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-tamil", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const OG_LOCALE = { en: "en_LK", si: "si_LK", ta: "ta_LK" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as keyof typeof OG_LOCALE;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: "ConferenceHub", template: "%s · ConferenceHub" },
    description: t("home_meta_description"),
    applicationName: "ConferenceHub",
    icons: { icon: "/logo.svg", apple: "/apple-touch-icon.png" },
    openGraph: { siteName: "ConferenceHub", locale: OG_LOCALE[locale], type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${sinhala.variable} ${tamil.variable} dark`}
    >
      <head>
        {/* Runs before the first paint so a saved light theme never flashes dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers>
            <a
              href="#main"
              className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
            >
              {t("skip_to_content")}
            </a>
            <Header />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
