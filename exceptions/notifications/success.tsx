import * as React from "react"
import { CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/primitives/button"
import { successToast } from "@/ui/notifications"

interface SuccessNotificationProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  variant?: "inline" | "toast"
}

function SuccessNotification({
  title,
  description,
  action,
  className,
  variant = "inline",
}: SuccessNotificationProps) {
  React.useEffect(() => {
    if (variant === "toast") {
      successToast(title, description)
    }
  }, [variant, title, description])

  if (variant === "toast") return null

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-emerald-800 bg-emerald-950/50 p-4",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-emerald-100">{title}</p>
        {description && (
          <p className="text-sm text-emerald-300">{description}</p>
        )}
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          variant="ghost"
          size="sm"
          className="shrink-0 text-emerald-300 hover:text-emerald-100 hover:bg-emerald-900"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

function SuccessToastTrigger({ title, description }: { title: string; description?: string }) {
  const handleClick = () => {
    successToast(title, description)
  }

  return (
    <Button onClick={handleClick} variant="default" size="sm">
      Show success
    </Button>
  )
}

export { SuccessNotification, SuccessToastTrigger }
export type { SuccessNotificationProps }
