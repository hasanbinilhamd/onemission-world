import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#111827] text-white border-transparent hover:bg-[#1e2d3d]",
        secondary:
          "bg-[#D8E3F3] text-[#111827] border-transparent hover:bg-[#C8D7EF]",
        destructive:
          "bg-[#E26D6D]/12 text-[#E26D6D] border border-[#E26D6D]/20 hover:bg-[#E26D6D]/18",
        outline:
          "border border-[rgba(17,24,39,0.1)] text-[#5F6B7A] bg-transparent",
        success:
          "bg-[#4FAF73]/12 text-[#4FAF73] border border-[#4FAF73]/20",
        warning:
          "bg-[#F5B74F]/12 text-[#F5B74F] border border-[#F5B74F]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
