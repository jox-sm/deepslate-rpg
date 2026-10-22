"use client";

import { useFormState } from "@/hooks/useFormState";
import { useState, useCallback, useEffect, useRef } from "react";
import type { GameFormState } from "@/types/form";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/utilities/clientUtilities/gameDraftStorage";
import { dataUrlToBuffer } from "@/utilities/clientUtilities/imagesUtils";

export function useGameForm(initialState: GameFormState) {
  const { state: form, loading, updateField, reset, setLoading } = useFormState(initialState);
  const [showWizard, setShowWizard] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  // Restore a saved draft so a reload mid-creation does not lose the name,
  // description or cover image.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = loadFormDraft();
    if (!draft) return;
    if (draft.name) updateField("name", draft.name);
    if (draft.description) updateField("description", draft.description);
    if (draft.selectedTags?.length) updateField("selectedTags", draft.selectedTags);
    if (draft.image) {
      const buffer = dataUrlToBuffer(draft.image);
      if (buffer) {
        updateField("image", buffer);
        updateField("imagePreview", draft.image);
      }
    }
  }, [updateField]);

  const persistedRef = useRef(false);
  useEffect(() => {
    if (!persistedRef.current) {
      persistedRef.current = true;
      return;
    }
    // Nothing worth keeping - after a successful create the form resets, so
    // this removes the leftover storage instead of writing an empty draft.
    if (!form.name && !form.description && !form.imagePreview && !form.selectedTags.length) {
      clearFormDraft();
      return;
    }
    saveFormDraft({
      name: form.name,
      description: form.description,
      selectedTags: form.selectedTags,
      image: form.imagePreview || undefined,
    });
  }, [form.name, form.description, form.selectedTags, form.imagePreview]);

  const resetForm = useCallback(() => {
    reset();
    setResetCounter((c) => c + 1);
    setShowWizard(false);
    clearFormDraft();
  }, [reset]);

  return {
    form,
    setForm: (newState: GameFormState) => {
      // For backward compatibility, we update the state directly
      // but this breaks encapsulation. Better to use the individual updateField function.
      // This is kept only for API compatibility.
      if (newState !== form) {
        // Since we can't directly set state from useFormState, we'd need to update each field
        // For now, we'll just note that direct state replacement isn't supported
        console.warn('Direct state replacement not supported in useGameForm. Use updateField instead.');
      }
    },
    loading,
    setLoading,
    showWizard,
    setShowWizard,
    resetCounter,
    resetForm,
    updateField,
  };
}