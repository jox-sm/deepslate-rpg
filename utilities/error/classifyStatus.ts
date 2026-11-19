import type { ClassifiedError } from "@/types/errorHandler"

// HTTP-status classification switch, moved verbatim from the original
// utilities/errorHandler.ts `classifyError`. Always returns a ClassifiedError
// for any status (the `default` branch handles every value).
export function classifyStatusError(err: unknown, status: number): ClassifiedError {
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
