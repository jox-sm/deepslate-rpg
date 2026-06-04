import type * as React from "react"

export type ErrorCategory =
  | "not-found"
  | "server-error"
  | "forbidden"
  | "bad-request"
  | "service-unavailable"
  | "network"
  | "validation"
  | "auth"
  | "timeout"
  | "unknown"

export type ErrorSeverity = "critical" | "high" | "medium" | "low"

export interface ClassifiedError {
  category: ErrorCategory
  severity: ErrorSeverity
  statusCode: number
  title: string
  message: string
  retryable: boolean
  originalError?: unknown
}

export interface ExceptionResult<T> {
  data: T | null
  error: ClassifiedError | null
  ErrorComponent: React.ComponentType<any> | null
  errorProps: Record<string, unknown>
  showToast: boolean
  toastTitle: string
  toastDescription?: string
  toastVariant: "error" | "warning" | "success"
  ok: boolean
}

export interface ExceptionOptions {
  context?: string
  fallbackMessage?: string
  suppressToast?: boolean
  suppressComponent?: boolean
  onRetry?: () => void
  onBackHome?: () => void
}

export interface ComponentMapping {
  Component: React.ComponentType<any>
  props: Record<string, unknown>
}

export interface ApiErrorHandler {
  withToast: (err: unknown) => ClassifiedError
  withComponent: (err: unknown) => ComponentMapping & { classified: ClassifiedError }
  classify: (err: unknown) => ClassifiedError
}

export interface ToastConfig {
  title: string
  variant: "error" | "warning"
}

export type ErrorHookReturn = {
  error: ClassifiedError | null
  setError: (err: unknown) => void
  handle: <T>(fn: () => Promise<T>) => Promise<ExceptionResult<T>>
  clear: () => void
  ErrorComponent: React.ComponentType<any> | null
  errorProps: Record<string, unknown>
  hasError: boolean
}
