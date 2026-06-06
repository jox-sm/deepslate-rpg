import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 ease-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white hover:bg-accent-hover shadow-lg glow-accent-sm",
        destructive:
          "bg-destructive text-white hover:bg-destructive-hover",
        outline:
          "border border-border bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary hover:border-accent/30",
        secondary:
          "bg-bg-elevated text-text-primary hover:bg-bg-hover border border-border",
        ghost:
          "text-text-secondary hover:text-text-primary hover:bg-bg-hover",
        link:
          "text-accent underline-offset-4 hover:underline",
        gradient:
          "text-white shadow-lg glow-accent bg-gradient-to-r from-torch-500 to-torch-400 hover:from-torch-400 hover:to-torch-300",
        glass:
          "bg-glass text-text-primary border border-border/50 hover:bg-bg-hover/70 hover:border-accent/30 glow-accent-sm",
        torch:
          "bg-torch-500 text-charcoal-950 hover:bg-torch-400 shadow-lg glow-torch active:glow-torch",
        gold:
          "bg-gold-500 text-charcoal-950 hover:bg-gold-400 shadow-lg glow-gold font-semibold",
        blood:
          "bg-blood-500 text-charcoal-950 hover:bg-blood-400 shadow-lg glow-blood font-semibold",
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
