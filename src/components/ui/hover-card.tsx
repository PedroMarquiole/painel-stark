"use client";
import * as HC from "@radix-ui/react-hover-card";
import { cn } from "@/lib/utils";

export function HoverCard({ trigger, children, className }: { trigger: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <HC.Root openDelay={350} closeDelay={80}>
      <HC.Trigger asChild>{trigger}</HC.Trigger>
      <HC.Portal>
        <HC.Content
          sideOffset={6}
          align="start"
          className={cn("z-50 w-72 rounded-xl border border-border bg-raised p-card shadow-pop data-[state=open]:animate-enter", className)}
        >
          {children}
        </HC.Content>
      </HC.Portal>
    </HC.Root>
  );
}
