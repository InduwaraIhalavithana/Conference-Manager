import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminInbox } from "@/components/admin/admin-inbox";

// Private pages render only once the browser knows who is signed in, so there is no shell to validate.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_inbox") };
}

export default function Page() {
  return <AdminInbox />;
}
