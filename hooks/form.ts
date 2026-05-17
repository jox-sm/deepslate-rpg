"use client";

import { useState, useCallback } from "react";
import type { GameFormState } from "@/types/form";

export function useGameForm(initialState: GameFormState) {
  const [form, setForm] = useState<GameFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  const resetForm = useCallback(() => {
    setForm(initialState);
    setResetCounter((c) => c + 1);
    setShowWizard(false);
  }, [initialState]);

  const updateField = useCallback(<K extends keyof GameFormState>(field: K, value: GameFormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  return {
    form,
    setForm,
    loading,
    setLoading,
    showWizard,
    setShowWizard,
    resetCounter,
    resetForm,
    updateField,
  };
}