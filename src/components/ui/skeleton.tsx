import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-card-border/50 animate-pulse",
        className
      )}
      {...props}
    />
  );
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-card-border bg-card p-4 md:p-6 space-y-3",
        className
      )}
      {...props}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

function SkeletonTable({ rows = 3, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { rows?: number }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-card-border bg-card p-4 md:p-6 space-y-4",
        className
      )}
      {...props}
    >
      <Skeleton className="h-5 w-40 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable };
