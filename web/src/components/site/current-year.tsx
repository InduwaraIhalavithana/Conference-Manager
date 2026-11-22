import { cacheLife } from "next/cache";

/** The current year. Cached (and refreshed daily), because Next 16 does not allow reading the clock while
 * prerendering a page: the value would be frozen at build time without saying so. */
export async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}
