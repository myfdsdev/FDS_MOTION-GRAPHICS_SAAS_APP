import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-2 text-white",
        accent: "border-accent/30 bg-accent/15 text-accent-soft",
        success: "border-success/30 bg-success/15 text-emerald-300",
        warning: "border-warning/30 bg-warning/15 text-amber-300",
        danger: "border-danger/30 bg-danger/15 text-red-300",
        muted: "border-border bg-surface-2 text-muted",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
