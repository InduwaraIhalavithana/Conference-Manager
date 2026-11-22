import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Next 16 "proxy" (formerly middleware): sends / and other unprefixed paths to the visitor's language.
export default createMiddleware(routing);

export const config = {
  // Not for the API proxy (/api), Next internals, or files with an extension (images, icons, robots.txt).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
