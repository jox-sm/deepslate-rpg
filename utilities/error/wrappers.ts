import type { ExceptionResult, ExceptionOptions } from "@/types/errorHandler"
import { classifyError } from "./classify"
import { toastConfigMap, showToastFor } from "./toast"
import { mapToComponent } from "./mapToComponent"

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
