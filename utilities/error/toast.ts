import type { ErrorCategory, ToastConfig, ClassifiedError, ExceptionOptions } from "@/types/errorHandler"
import { errorToast, warningToast } from "@/ui/notifications"

export const toastConfigMap: Record<ErrorCategory, ToastConfig> = {
  "not-found": { title: "Not found", variant: "warning" },
  "server-error": { title: "Server error", variant: "error" },
  forbidden: { title: "Access denied", variant: "error" },
  "bad-request": { title: "Bad request", variant: "warning" },
  "service-unavailable": { title: "Service unavailable", variant: "error" },
  network: { title: "Network error", variant: "error" },
  validation: { title: "Validation failed", variant: "warning" },
  auth: { title: "Authentication required", variant: "error" },
  timeout: { title: "Request timed out", variant: "warning" },
  unknown: { title: "Unexpected error", variant: "error" },
}

export function showToastFor(classified: ClassifiedError, options: ExceptionOptions) {
  if (options.suppressToast) return

  const config = toastConfigMap[classified.category]
  const description = options.fallbackMessage || classified.message

  switch (config.variant) {
    case "error":
      errorToast(config.title, description)
      break
    case "warning":
      warningToast(config.title, description)
      break
  }
}
