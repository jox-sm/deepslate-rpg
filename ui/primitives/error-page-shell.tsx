import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface ErrorPageShellProps {
  statusCode: number
  title: string
  message: string
  children?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "gradient" | "glass"
  }
  secondaryAction?: {
    label: string
    onClick: () => void
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "gradient" | "glass"
  }
  className?: string
}

const ErrorPageShell = React.forwardRef<HTMLDivElement, ErrorPageShellProps>(
  ({ statusCode, title, message, children, action, secondaryAction, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center relative",
          className
        )}
        role="alert"
      >
        <div className="absolute inset-0 bg-gradient-radial-accent pointer-events-none" />
        <div className="mx-auto max-w-md space-y-8 relative">
          <div className="space-y-4">
            <p
              className="select-none text-8xl font-bold tracking-tighter text-gradient"
              aria-hidden="true"
            >
              {statusCode || "???"}
            </p>
            <h1 className="font-display text-3xl font-semibold text-text-primary">
              {title}
            </h1>
            <p className="text-base leading-relaxed text-text-muted">
              {message}
            </p>
          </div>
          {children}
          {(action || secondaryAction) && (
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              {action && (
                <Button
                  onClick={action.onClick}
                  variant={action.variant ?? "gradient"}
                  size="lg"
                >
                  {action.label}
                </Button>
              )}
              {secondaryAction && (
                <Button
                  onClick={secondaryAction.onClick}
                  variant={secondaryAction.variant ?? "glass"}
                  size="lg"
                >
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
)
ErrorPageShell.displayName = "ErrorPageShell"

export { ErrorPageShell }
export type { ErrorPageShellProps }
