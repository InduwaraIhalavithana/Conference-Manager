import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Section({ children, className, band = false }: { children: ReactNode; className?: string; band?: boolean }) {
  return (
    <section className={cn(band && "border-y bg-band")}>
      <div className={cn("mx-auto max-w-page px-4 py-14 sm:px-6", className)}>{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
