import type {
  ErrorCategory,
  ClassifiedError,
  ExceptionResult,
  ExceptionOptions,
  ComponentMapping,
  ToastConfig,
} from "@/types/errorHandler"
import {
  NotFoundErrorPage,
  ServerErrorPage,
  ForbiddenErrorPage,
  BadRequestErrorPage,
  ServiceUnavailableErrorPage,
  GeneralErrorPage,
} from "@/exceptions/errorPages"
import { errorToast, warningToast } from "@/ui/notifications"

export function classifyError(err: unknown, context?: string): ClassifiedError {
  if (err instanceof Response || (err && typeof err === "object" && "status" in (err as object))) {
    const status = err instanceof Response ? err.status : (err as { status: number }).status

    switch (status) {
      case 400:
        return {
          category: "bad-request",
          severity: "medium",
          statusCode: 400,
          title: "Bad request",
          message: "The incantation you spoke was garbled. Please check your input and try again.",
          retryable: false,
          originalError: err,
        }
      case 401:
        return {
          category: "auth",
          severity: "high",
          statusCode: 401,
          title: "Unauthorized",
          message: "Your session token has expired or is invalid. Please sign in again.",
          retryable: true,
          originalError: err,
        }
      case 403:
        return {
          category: "forbidden",
          severity: "high",
          statusCode: 403,
          title: "Access forbidden",
          message: "These ancient halls are sealed by powerful wards. You lack the required permissions to enter this realm.",
          retryable: false,
          originalError: err,
        }
      case 404:
        return {
          category: "not-found",
          severity: "low",
          statusCode: 404,
          title: "Page not found",
          message: "The dungeon you seek has crumbled into darkness. This passage no longer exists or has been relocated.",
          retryable: false,
          originalError: err,
        }
      case 409:
        return {
          category: "validation",
          severity: "medium",
          statusCode: 409,
          title: "Conflict",
          message: "A duplicate or conflicting request was detected. The archmages prevent casting the same spell twice.",
          retryable: true,
          originalError: err,
        }
      case 422:
        return {
          category: "validation",
          severity: "medium",
          statusCode: 422,
          title: "Validation failed",
          message: "The data you provided does not meet the required enchantments. Check your inputs and try again.",
          retryable: false,
          originalError: err,
        }
      case 429:
        return {
          category: "timeout",
          severity: "medium",
          statusCode: 429,
          title: "Too many requests",
          message: "You have cast too many spells in rapid succession. Wait a moment before trying again.",
          retryable: true,
          originalError: err,
        }
      case 503:
        return {
          category: "service-unavailable",
          severity: "critical",
          statusCode: 503,
          title: "Service unavailable",
          message: "The realm is temporarily unreachable. The gates will reopen shortly — our sentinels are working on it.",
          retryable: true,
          originalError: err,
        }
      default:
        if (status >= 500) {
          return {
            category: "server-error",
            severity: "critical",
            statusCode: status,
            title: "Internal server error",
            message: "A dark magic has disturbed the server's balance. Our archmages have been alerted and are working to restore order.",
            retryable: true,
            originalError: err,
          }
        }
        return {
          category: "unknown",
          severity: "medium",
          statusCode: status,
          title: "Request failed",
          message: `An unexpected response was received (status ${status}). The weave of reality is unstable.`,
          retryable: true,
          originalError: err,
        }
    }
  }

  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return {
      category: "network",
      severity: "critical",
      statusCode: 0,
      title: "Network error",
      message: "The connection to the realm has been severed. Check your connection and try again.",
      retryable: true,
      originalError: err,
    }
  }

  if (err instanceof DOMException && err.name === "AbortError") {
    return {
      category: "timeout",
      severity: "medium",
      statusCode: 0,
      title: "Request cancelled",
      message: "The spell was interrupted mid-cast. If you didn't cancel it, try again.",
      retryable: true,
      originalError: err,
    }
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase()

    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("abort")) {
      return {
        category: "timeout",
        severity: "medium",
        statusCode: 0,
        title: "Request timed out",
        message: "The ritual took too long to complete. The connection has been closed.",
        retryable: true,
        originalError: err,
      }
    }

    if (msg.includes("network") || msg.includes("socket") || msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("fetch")) {
      return {
        category: "network",
        severity: "critical",
        statusCode: 0,
        title: "Network error",
        message: "The connection to the realm has been severed. Check your connection and try again.",
        retryable: true,
        originalError: err,
      }
    }

    if (msg.includes("unauthorized") || msg.includes("unauthenticated") || msg.includes("login") || msg.includes("token") || msg.includes("session") || msg.includes("jwt")) {
      return {
        category: "auth",
        severity: "high",
        statusCode: 401,
        title: "Authentication required",
        message: "You must be signed in to access this area. Your session may have expired.",
        retryable: false,
        originalError: err,
      }
    }

    if (msg.includes("forbidden") || msg.includes("permission") || msg.includes("access denied")) {
      return {
        category: "forbidden",
        severity: "high",
        statusCode: 403,
        title: "Access forbidden",
        message: "You lack the required permissions to enter this realm.",
        retryable: false,
        originalError: err,
      }
    }

    if (msg.includes("not found") || msg.includes("missing") || msg.includes("404")) {
      return {
        category: "not-found",
        severity: "low",
        statusCode: 404,
        title: "Not found",
        message: "The requested resource could not be located in any known realm.",
        retryable: false,
        originalError: err,
      }
    }

    if (msg.includes("validation") || msg.includes("invalid") || msg.includes("bad request") || msg.includes("malformed")) {
      return {
        category: "validation",
        severity: "medium",
        statusCode: 400,
        title: "Validation error",
        message: "The data provided does not meet the required enchantments. Check your inputs.",
        retryable: false,
        originalError: err,
      }
    }

    if (msg.includes("rate limit") || msg.includes("too many")) {
      return {
        category: "timeout",
        severity: "medium",
        statusCode: 429,
        title: "Rate limited",
        message: "You have cast too many spells too quickly. Wait before trying again.",
        retryable: true,
        originalError: err,
      }
    }
  }

  return {
    category: "unknown",
    severity: "medium",
    statusCode: 0,
    title: context ? `Error in ${context}` : "Something went wrong",
    message: "An unexpected disturbance in the weave of reality has occurred. Our mages are investigating.",
    retryable: true,
    originalError: err,
  }
}

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

export function mapToComponent(classified: ClassifiedError, options: ExceptionOptions): ComponentMapping {
  const sharedProps: Record<string, unknown> = {}

  if (options.onRetry) sharedProps.onRetry = options.onRetry
  if (options.onBackHome) sharedProps.onBackHome = options.onBackHome

  switch (classified.category) {
    case "not-found":
      return {
        Component: NotFoundErrorPage,
        props: { onBackHome: options.onBackHome ?? (() => (window.location.href = "/")) },
      }
    case "server-error":
      return {
        Component: ServerErrorPage,
        props: { onRetry: options.onRetry, onBackHome: options.onBackHome ?? (() => (window.location.href = "/")) },
      }
    case "forbidden":
      return {
        Component: ForbiddenErrorPage,
        props: { onBackHome: options.onBackHome ?? (() => (window.location.href = "/")) },
      }
    case "bad-request":
      return {
        Component: BadRequestErrorPage,
        props: { onBackHome: options.onBackHome ?? (() => (window.location.href = "/")) },
      }
    case "service-unavailable":
      return {
        Component: ServiceUnavailableErrorPage,
        props: { onRetry: options.onRetry, onBackHome: options.onBackHome ?? (() => (window.location.href = "/")) },
      }
    case "auth":
      return {
        Component: GeneralErrorPage,
        props: {
          statusCode: 401,
          title: "Authentication required",
          message: "Your session has expired or you need to sign in to access this area.",
          ...sharedProps,
        },
      }
    case "network":
      return {
        Component: GeneralErrorPage,
        props: {
          statusCode: 0,
          title: "Network error",
          message: "The connection to the realm has been severed. Check your connection and try again.",
          ...sharedProps,
        },
      }
    case "validation":
      return {
        Component: BadRequestErrorPage,
        props: { ...sharedProps },
      }
    case "timeout":
      return {
        Component: GeneralErrorPage,
        props: {
          statusCode: 0,
          title: "Request timed out",
          message: "The ritual took too long to complete. Please try again.",
          ...sharedProps,
        },
      }
    case "unknown":
    default:
      return {
        Component: GeneralErrorPage,
        props: {
          statusCode: classified.statusCode || undefined,
          title: classified.title,
          message: classified.message,
          ...sharedProps,
        },
      }
  }
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

export async function tryOrError<T>(
  fn: () => Promise<T>,
  options: ExceptionOptions = {},
): Promise<ExceptionResult<T>> {
  try {
    const data = await fn()

    return {
      data,
      error: null,
      ErrorComponent: null,
      errorProps: {},
      showToast: false,
      toastTitle: "",
      toastVariant: "success",
      ok: true,
    }
  } catch (err) {
    const classified = classifyError(err, options.context)

    const toastConfig = toastConfigMap[classified.category]
    showToastFor(classified, options)

    if (options.suppressComponent) {
      return {
        data: null,
        error: classified,
        ErrorComponent: null,
        errorProps: {},
        showToast: !options.suppressToast,
        toastTitle: toastConfig.title,
        toastDescription: options.fallbackMessage || classified.message,
        toastVariant: toastConfig.variant,
        ok: false,
      }
    }

    const { Component, props } = mapToComponent(classified, options)

    return {
      data: null,
      error: classified,
      ErrorComponent: Component,
      errorProps: props,
      showToast: !options.suppressToast,
      toastTitle: toastConfig.title,
      toastDescription: options.fallbackMessage || classified.message,
      toastVariant: toastConfig.variant,
      ok: false,
    }
  }
}

export function tryOrErrorSync<T>(
  fn: () => T,
  options: ExceptionOptions = {},
): ExceptionResult<T> {
  try {
    const data = fn()
    return { data, error: null, ErrorComponent: null, errorProps: {}, showToast: false, toastTitle: "", toastVariant: "success", ok: true }
  } catch (err) {
    const classified = classifyError(err, options.context)
    const { Component, props } = mapToComponent(classified, options)
    return { data: null, error: classified, ErrorComponent: Component, errorProps: props, showToast: false, toastTitle: "", toastVariant: "error", ok: false }
  }
}

export function handleApiResponse<T>(response: Response, data: T): { result: ExceptionResult<T>; data: T | null } {
  if (!response.ok) {
    const classified = classifyError(response, "API call")
    const { Component, props } = mapToComponent(classified, {})
    showToastFor(classified, {})
    return {
      result: {
        data: null,
        error: classified,
        ErrorComponent: Component,
        errorProps: props,
        showToast: true,
        toastTitle: toastConfigMap[classified.category].title,
        toastDescription: classified.message,
        toastVariant: toastConfigMap[classified.category].variant,
        ok: false,
      },
      data: null,
    }
  }

  return {
    result: {
      data,
      error: null,
      ErrorComponent: null,
      errorProps: {},
      showToast: false,
      toastTitle: "",
      toastVariant: "success",
      ok: true,
    },
    data,
  }
}

export async function tryFetch<T>(
  url: string,
  init?: RequestInit,
  options: ExceptionOptions = {},
): Promise<ExceptionResult<T>> {
  return tryOrError<T>(async () => {
    const response = await fetch(url, init)
    if (!response.ok) {
      throw response
    }
    return response.json() as Promise<T>
  }, options)
}

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
