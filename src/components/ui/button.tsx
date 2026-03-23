import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-action-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white hover:bg-accent-light shadow-[0_10px_30px_rgba(247,147,26,0.16)] hover:shadow-[0_12px_35px_rgba(247,147,26,0.2)]",
        secondary:
          "bg-transparent text-foreground border border-card-border hover:border-accent hover:bg-background/40",
        ghost: "hover:bg-card-border/30 text-foreground/60 hover:text-foreground",
        danger: "bg-danger text-white hover:bg-danger/80",
        success: "bg-success text-white hover:bg-success/80",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2.5 text-sm",
        sm: "h-8 px-3 py-1.5 text-xs",
        lg: "h-12 px-8 py-3 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
