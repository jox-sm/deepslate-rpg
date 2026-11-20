import type { ClassifiedError } from "@/types/errorHandler"
import { classifyStatusError } from "./classifyStatus"

export function classifyError(err: unknown, context?: string): ClassifiedError {
  if (err instanceof Response || (err && typeof err === "object" && "status" in (err as object))) {
    const status = err instanceof Response ? err.status : (err as { status: number }).status
    return classifyStatusError(err, status)
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
