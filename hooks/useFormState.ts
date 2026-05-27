"use client";

import { useState, useCallback } from "react";

export interface FormState<T> {
  state: T;
  loading: boolean;
}

export interface FormActions<T> {
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
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

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setState(prev => ({ ...prev, [field]: value }));
  }, []);

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