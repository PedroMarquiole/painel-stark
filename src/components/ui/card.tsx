import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-raised", className)} {...props} />;
}

export function CardHeader({ title, action, className }: { title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-2 px-card pt-card", className)}>
      <h3 className="text-sm font-medium text-fg-muted">{title}</h3>
      {action}
    </div>
  );
}
