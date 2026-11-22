import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/** The organizer or admin area a path belongs to ("/en/dashboard/x" -> ["en", "dashboard"]), or null. */
function privateArea(pathname: string): [string, "dashboard" | "admin"] | null {
  const [, locale, area, page] = pathname.split("/");
  if (!(routing.locales as readonly string[]).includes(locale)) return null;
  if (area === "dashboard") return [locale, area];
  if (area === "admin" && page !== "login") return [locale, area];
  return null;
}

// Signed-out visitors to the organizer or admin area go to the right sign-in page and come back after.
// This only spares them a flash of an empty page: the API checks the session on every request.
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const area = privateArea(pathname);
  if (area && !request.cookies.has("cm_refresh")) {
    const [locale, name] = area;
    const target = new URL(name === "admin" ? `/${locale}/admin/login` : `/${locale}/login`, request.url);
    target.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(target);
  }
  return intl(request);
}

export const config = {
  // Not for the API proxy (/api), Next internals, or files with an extension (images, icons, robots.txt).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
