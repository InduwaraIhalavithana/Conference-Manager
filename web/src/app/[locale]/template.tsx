import type { ReactNode } from "react";

// Next.js rebuilds a template on every page change, which replays this gentle entrance.
export default function PageTransition({ children }: { children: ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
