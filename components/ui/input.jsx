import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-[16px] border border-[rgba(17,24,39,0.07)] bg-white px-4 py-2 text-sm font-medium text-[#111827] transition-all placeholder:text-[#5F6B7A]/50 focus-visible:outline-none focus-visible:border-[#BFCDE2] focus-visible:shadow-[0_0_0_4px_rgba(191,205,226,0.25)] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
