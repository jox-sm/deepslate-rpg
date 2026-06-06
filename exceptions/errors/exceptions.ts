import * as React from "react"
import type { ClassifiedError, ExceptionOptions, ExceptionResult } from "@/types/errorHandler"
import { classifyError, mapToComponent, tryOrError } from "@/utilities/errorHandler"

export function useErrorHandler(options: ExceptionOptions = {}) {
  const [error, setErrorState] = React.useState<ClassifiedError | null>(null)

  const handle = React.useCallback(
    async <T>(fn: () => Promise<T>): Promise<ExceptionResult<T>> => {
      return tryOrError(fn, options)
    },
    [options],
  )

  const clear = React.useCallback(() => setErrorState(null), [])

  const ErrorComponent = error ? mapToComponent(error, options).Component : null
  const errorProps = error ? mapToComponent(error, options).props : {}

  return {
    error,
    setError: (err: unknown) => {
      const classified = classifyError(err, options.context)
      setErrorState(classified)
    },
    handle,
    clear,
    ErrorComponent,
    errorProps,
    hasError: error !== null,
  }
}

export type { ErrorHookReturn } from "@/types/errorHandler"

export {
  classifyError,
  mapToComponent,
  showToastFor,
  toastConfigMap,
  tryOrError,
  tryOrErrorSync,
  handleApiResponse,
  tryFetch,
  classifyAndFormat,
  createApiErrorHandler,
  isNotFound,
  isServerError,
  isAuthError,
  isNetworkError,
  isRetryable,
  getErrorMessage,
} from "@/utilities/errorHandler"

export type {
  ErrorCategory,
  ErrorSeverity,
  ClassifiedError,
  ExceptionResult,
  ExceptionOptions,
} from "@/types/errorHandler"
