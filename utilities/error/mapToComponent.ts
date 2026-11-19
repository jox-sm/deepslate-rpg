import type { ClassifiedError, ExceptionOptions, ComponentMapping } from "@/types/errorHandler"
import {
  NotFoundErrorPage,
  ServerErrorPage,
  ForbiddenErrorPage,
  BadRequestErrorPage,
  ServiceUnavailableErrorPage,
  GeneralErrorPage,
} from "@/exceptions/errorPages"

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
