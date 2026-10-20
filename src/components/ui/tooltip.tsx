"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <T.Provider delayDuration={300} skipDelayDuration={100}>{children}</T.Provider>
);

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: T.TooltipContentProps["side"] }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 flex items-center gap-2 rounded-md bg-overlay px-2 py-1 text-xs text-fg shadow-pop",
            "data-[state=delayed-open]:animate-enter",
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
