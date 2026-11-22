"use client";

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GraphQLProvider } from "@/lib/graphql/client";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <GraphQLProvider>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </GraphQLProvider>
  );
}
