import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-colors duration-200 ease-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-charcoal-950 font-semibold hover:bg-accent-hover",
        destructive:
          "bg-destructive text-text-primary hover:bg-destructive-hover",
        outline:
          "border border-border bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary",
        secondary:
          "bg-bg-elevated text-text-primary border border-border hover:bg-bg-hover",
        ghost:
          "text-text-secondary hover:text-text-primary hover:bg-bg-hover",
        link:
          "text-accent underline-offset-4 hover:underline",
        // Deprecated aliases — kept so old call sites keep building.
        // Do not use in new code; they all resolve to the single accent.
        gradient:
          "bg-accent text-charcoal-950 font-semibold hover:bg-accent-hover",
        glass:
          "bg-bg-elevated text-text-primary border border-border hover:bg-bg-hover",
        torch:
          "bg-accent text-charcoal-950 font-semibold hover:bg-accent-hover",
        glow:
          "bg-accent text-charcoal-950 font-semibold hover:bg-accent-hover",
        gold:
          "bg-accent text-charcoal-950 font-semibold hover:bg-accent-hover",
        blood:
          "bg-destructive text-text-primary hover:bg-destructive-hover",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
