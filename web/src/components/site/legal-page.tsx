import { getLocale, getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/site";

/** The privacy policy and the terms share one layout: a lead, a table of contents and numbered sections. */
export async function LegalPage({ prefix, sections }: { prefix: "privacy" | "terms"; sections: number }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const items = Array.from({ length: sections }, (_, i) => ({
    id: `s${i + 1}`,
    title: t(`${prefix}_s${i + 1}_title`),
    body: t(`${prefix}_s${i + 1}_body`),
  }));

  return (
    <>
      <section className="border-b bg-hero">
        <div className="mx-auto max-w-page animate-lift px-4 py-14 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t(`${prefix}_title`)}</h1>
          <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{t(`${prefix}_lead`)}</p>
          <p className="mt-4 text-sm font-medium">{t("legal_updated", { date: formatDate(LEGAL_UPDATED, locale) })}</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-page gap-10 px-4 py-12 sm:px-6 md:grid-cols-[220px_1fr]">
        <nav aria-label={t("legal_on_this_page")} className="md:sticky md:top-24 md:self-start">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("legal_on_this_page")}</p>
          <ol className="space-y-1.5 text-sm">
            {items.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-muted-foreground hover:text-primary">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {/* Two columns of sections on wide screens keeps each line a comfortable reading length. */}
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {items.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24 rounded-3xl border bg-card p-6">
              <h2 id={`${s.id}-h`} className="flex items-center gap-3 text-xl font-bold">
                <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary/12 text-sm text-primary">{i + 1}</span>
                {s.title}
              </h2>
              <div className="mt-3 space-y-2 leading-relaxed text-muted-foreground">
                {s.body.split("\n").map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="rounded-2xl bg-primary/8 p-4 text-sm xl:col-span-2">
            {t.rich("legal_questions", {
              email: CONTACT_EMAIL,
              mail: (chunks) => (
                <a className="font-semibold text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </>
  );
}
