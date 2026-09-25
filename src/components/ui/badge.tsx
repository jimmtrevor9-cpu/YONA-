import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        gold: "bg-accent text-gold-soft ring-1 ring-gold/20",
        subtle: "bg-foreground/5 text-muted-foreground ring-1 ring-foreground/10",
        outline: "text-foreground ring-1 ring-border",
        destructive: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
        success: "bg-success/15 text-success ring-1 ring-success/30",
      },
    },
    defaultVariants: {
      variant: "subtle",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
