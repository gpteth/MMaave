import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border select-none backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "bg-accent/15 text-accent border-accent/25",
        success: "bg-success/15 text-success border-success/25",
        warning: "bg-warning/15 text-warning border-warning/25",
        danger: "bg-danger/15 text-danger border-danger/25",
        muted: "bg-muted/15 text-muted border-muted/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
