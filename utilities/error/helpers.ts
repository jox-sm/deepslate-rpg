import type { ClassifiedError, ExceptionResult } from "@/types/errorHandler"
import { classifyError } from "./classify"
import { showToastFor } from "./toast"
import { mapToComponent } from "./mapToComponent"

export function classifyAndFormat(err: unknown, context?: string): { classified: ClassifiedError; formattedMessage: string } {
  const classified = classifyError(err, context)
  const zodMessage = formatZodError(err)
  return {
    classified,
    formattedMessage: zodMessage || classified.message,
  }
}

export function createApiErrorHandler(context: string) {
  return {
    withToast: (err: unknown) => {
      const classified = classifyError(err, context)
      showToastFor(classified, {})
      return classified
    },
    withComponent: (err: unknown) => {
      const classified = classifyError(err, context)
      const { Component, props } = mapToComponent(classified, {})
      return { classified, Component, props }
    },
    classify: (err: unknown) => classifyError(err, context),
  }
}

export function isNotFound(result: ExceptionResult<unknown>): boolean {
  return result.error?.category === "not-found"
}

export function isServerError(result: ExceptionResult<unknown>): boolean {
  return result.error?.category === "server-error"
}

export function isAuthError(result: ExceptionResult<unknown>): boolean {
  return result.error?.category === "auth"
}

export function isNetworkError(result: ExceptionResult<unknown>): boolean {
  return result.error?.category === "network"
}

export function isRetryable(result: ExceptionResult<unknown>): boolean {
  return result.error?.retryable ?? false
}

export function getErrorMessage(result: ExceptionResult<unknown>): string | null {
  return result.error ? result.error.message : null
}

function formatZodError(err: unknown): string | null {
  if (err && typeof err === "object" && "issues" in (err as object)) {
    const zodErr = err as { issues: Array<{ path: (string | number)[]; message: string }> }
    return zodErr.issues.map((issue) => `Field "${issue.path.join(".")}": ${issue.message}`).join("\n")
  }
  return null
}
