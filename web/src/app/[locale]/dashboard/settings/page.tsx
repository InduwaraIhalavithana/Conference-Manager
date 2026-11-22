import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SettingsForm } from "@/components/organizer/settings-form";

// Private pages render only once the browser knows who is signed in, so there is no shell to validate.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_settings") };
}

export default function Page() {
  return <SettingsForm />;
}
