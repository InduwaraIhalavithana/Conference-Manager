import type { Metadata } from "next";
import { Suspense } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";

// Private: never listed by search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: LayoutProps<"/[locale]/dashboard">) {
  // Client-only from here on: the signed-in organizer is known only in the browser.
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <OrganizerShell>{children}</OrganizerShell>
    </Suspense>
  );
}
