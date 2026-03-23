import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percent = Math.min((value / max) * 100, 100);
    return (
      <div
        ref={ref}
        className={cn(
          "w-full rounded-full h-2.5 bg-background/70 border border-card-border/60 overflow-hidden",
          className
        )}
        {...props}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-light transition-all duration-500 shadow-[0_0_18px_rgba(247,147,26,0.22)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
