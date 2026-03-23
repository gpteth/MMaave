import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-xl border border-card-border shadow-[0_10px_30px_rgba(0,0,0,0.18)]",
  {
    variants: {
      variant: {
        default: "bg-card/90 p-4 md:p-6 backdrop-blur-sm",
        gradient:
          "bg-gradient-to-br from-card/95 to-card-elevated p-4 md:p-6",
        stat: "bg-card/90 p-4 md:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-gradient-to-r before:from-accent before:to-accent-light",
        elevated: "bg-card-elevated/95 p-4 md:p-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  hoverable?: boolean;
  glow?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hoverable, glow, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardVariants({ variant }),
          hoverable &&
            "transition-all duration-250 hover:border-accent hover:bg-card-elevated/95 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.28)]",
          glow &&
            "shadow-[0_0_30px_rgba(247,147,26,0.12),0_0_60px_rgba(247,147,26,0.06)] border-accent/30",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base md:text-lg font-bold", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent, cardVariants };
