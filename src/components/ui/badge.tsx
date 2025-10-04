import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 shadow-[0_0_10px_rgba(79,143,255,0.3)]",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[0_0_10px_rgba(125,211,252,0.3)]",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 shadow-[0_0_10px_rgba(239,68,68,0.3)]",
        accent: "border-transparent bg-accent text-accent-foreground hover:bg-accent/80 shadow-[0_0_10px_rgba(185,131,255,0.3)]",
        outline: "text-foreground border-primary/50 hover:bg-primary/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
