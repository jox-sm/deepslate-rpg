// Compatibility barrel: preserves the public surface of the original
// utilities/errorHandler.ts. Implementation now lives in ./error/*.
export { classifyError } from "./error/classify"
export { toastConfigMap, showToastFor } from "./error/toast"
export { mapToComponent } from "./error/mapToComponent"
export { tryOrError, tryOrErrorSync, handleApiResponse, tryFetch } from "./error/wrappers"
export {
  classifyAndFormat,
  createApiErrorHandler,
  isNotFound,
  isServerError,
  isAuthError,
  isNetworkError,
  isRetryable,
  getErrorMessage,
} from "./error/helpers"
