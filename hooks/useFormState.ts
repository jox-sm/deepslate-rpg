"use client";

import { useState, useCallback } from "react";

export interface FormState<T> {
  state: T;
  loading: boolean;
}

export interface FormActions<T> {
  updateField: <K extends keyof T>(field: K, value: T[K] | ((prev: T[K]) => T[K])) => void;
  reset: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * A shared primitive hook for form state management
 * @param initialState - The initial state of the form
 * @returns An object containing the form state and actions
 */
export function useFormState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [loading, setLoading] = useState(false);

  // The value may be a plain value OR an updater function. The updater form
  // matters when two updates land in the same React batch: with a plain
  // value each one is computed from the same stale snapshot, so the second
  // update silently discards the first. (Setting a character's image and its
  // image preview are two updates in one tick - the second used to wipe the
  // first.)
  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K] | ((prev: T[K]) => T[K])) => {
      setState(prev => ({
        ...prev,
        [field]:
          typeof value === "function"
            ? (value as (p: T[K]) => T[K])(prev[field])
            : value,
      }));
    },
    []
  );

  const reset = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  return {
    state,
    loading,
    updateField,
    reset,
    setLoading
  } as const;
}