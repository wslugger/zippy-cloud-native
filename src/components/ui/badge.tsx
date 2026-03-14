import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zippy-green/30 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zippy-navy text-white hover:bg-zippy-navy/80",
        secondary:
          "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
        destructive:
          "border-transparent bg-red-100 text-red-700 hover:bg-red-200",
        outline:
          "border-slate-200 text-slate-700",
        success:
          "border-zippy-green/20 bg-zippy-green/10 text-zippy-green",
        info:
          "border-zippy-cyan/20 bg-zippy-cyan/10 text-zippy-cyan",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
