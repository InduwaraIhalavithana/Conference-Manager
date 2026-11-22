import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Locale-aware versions of Next's Link and navigation hooks: links keep the current language.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
