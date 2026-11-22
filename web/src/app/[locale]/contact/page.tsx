import { Clock, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ContactForm } from "@/components/site/contact-form";
import { CONTACT_EMAIL } from "@/lib/site";
import type { Locale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  return { title: t("nav_contact"), description: t("contact_lead"), alternates: alternates(locale, "/contact") };
}

export default async function ContactPage() {
  const t = await getTranslations();
  const faqs = [1, 2, 3, 4].map((n) => ({ q: t(`contact_faq_${n}_q`), a: t(`contact_faq_${n}_a`) }));
  const channels = [
    {
      icon: Mail,
      title: t("contact_email_title"),
      body: (
        <>
          <a href={`mailto:${CONTACT_EMAIL}`} className="block break-all font-semibold text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          <span className="text-sm text-muted-foreground">{t("contact_email_body")}</span>
        </>
      ),
    },
    { icon: Clock, title: t("contact_hours_title"), body: <span className="text-muted-foreground">{t("contact_hours_body")}</span> },
    { icon: MapPin, title: t("contact_where_title"), body: <span className="text-muted-foreground">{t("footer_location")}</span> },
  ];

  return (
    <>
      <section className="border-b bg-hero">
        <div className="mx-auto max-w-7xl animate-[rise_.6s_ease-out] px-4 py-14 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">{t("nav_contact")}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{t("contact_title")}</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{t("contact_lead")}</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_400px]">
        <div className="rounded-3xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
          <ContactForm />
        </div>
        <aside className="space-y-4">
          {channels.map((c) => (
            <div key={c.title} className="flex gap-4 rounded-3xl border bg-card p-5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <c.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-bold">{c.title}</h2>
                <div className="mt-0.5">{c.body}</div>
              </div>
            </div>
          ))}
          <div className="rounded-3xl border bg-card p-5">
            <h2 className="mb-3 font-bold">{t("contact_faq_title")}</h2>
            <div className="divide-y">
              {faqs.map((f, i) => (
                <details key={f.q} open={i === 0} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold marker:hidden">
                    {f.q}
                    <span className="text-primary transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
