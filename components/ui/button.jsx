import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[18px] text-sm font-semibold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(191,205,226,0.6)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#111827] text-white shadow-[0_4px_14px_rgba(17,24,39,0.18)] hover:bg-[#1e2d3d] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(17,24,39,0.25)] active:translate-y-0",
        destructive:
          "bg-[#E26D6D] text-white shadow-sm hover:bg-[#d95f5f] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(226,109,109,0.3)]",
        outline:
          "border border-[rgba(17,24,39,0.08)] bg-white shadow-sm hover:bg-[#EEF3FA] hover:text-[#111827] hover:border-[rgba(17,24,39,0.12)]",
        secondary:
          "bg-[#D8E3F3] text-[#111827] shadow-sm hover:bg-[#C8D7EF] hover:-translate-y-0.5",
        ghost: "hover:bg-[#EEF3FA] hover:text-[#111827]",
        link: "text-[#111827] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-[14px] px-3 text-xs",
        lg: "h-11 rounded-[20px] px-8",
        icon: "h-9 w-9 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
