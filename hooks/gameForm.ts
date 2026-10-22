"use client";

import { useFormState } from "@/hooks/useFormState";
import { v7 as uuidV7 } from "uuid";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  type GamesFormData,
  type CharacterData,
  type MapData,
  type ItemData,
  type GamesFormStep,
  type UseGamesFormReturn,
  initialFormData,
} from "@/types/gameForm";
import { loadWizardDraft, saveWizardDraft, clearWizardDraft } from "@/utilities/clientUtilities/gameDraftStorage";

export function createEmptyCharacter(): CharacterData {
  return {
    id: uuidV7(),
    name: "",
    description: "",
    image: null,
    imagePreview: "",
  };
}

export function createEmptyMap(): MapData {
  return {
    id: uuidV7(),
    nameOfPlace: "",
    image: null,
    imagePreview: "",
    sizeOfPlace: "",
    placesAtMap: "",
  };
}

export function createEmptyItem(): ItemData {
  return {
    id: uuidV7(),
    name: "",
    image: null,
    imagePreview: "",
  };
}

const STEP_KEYS: GamesFormStep[] = ["characters", "maps", "items"];
const STEP_COUNT = STEP_KEYS.length;

export function useGamesForm(): UseGamesFormReturn {
  const { state: formData, updateField, reset: resetFormState } = useFormState<GamesFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(0);

  // Restore a draft left behind by a previous session (or by a reload that
  // happened mid-wizard). Images come back as data URLs, so the previews
  // render again instead of showing an empty upload box.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = loadWizardDraft();
    if (!draft) return;
    const hasContent =
      draft.characters.length > 0 || draft.maps.length > 0 || draft.items.length > 0;
    if (!hasContent) return;
    updateField("characters", draft.characters);
    updateField("maps", draft.maps);
    updateField("items", draft.items);
  }, [updateField]);

  // Persist on every change so a step change, a reload or a crash does not
  // lose uploaded images.
  const persistedRef = useRef(false);
  useEffect(() => {
    if (!persistedRef.current) {
      persistedRef.current = true;
      return;
    }
    // An empty draft is not worth keeping - and after a successful create
    // the wizard resets, so this also removes the leftover storage instead
    // of writing an empty draft back.
    if (!formData.characters.length && !formData.maps.length && !formData.items.length) {
      clearWizardDraft();
      return;
    }
    saveWizardDraft(formData);
  }, [formData]);

  const setStep = useCallback((step: number) => {
    const validStep = Math.max(0, Math.min(step, STEP_COUNT - 1));
    setCurrentStep(validStep);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, STEP_COUNT - 1));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const reset = useCallback(() => {
    resetFormState();
    setCurrentStep(0);
    clearWizardDraft();
  }, [resetFormState]);

  const addCharacter = useCallback(() => {
    updateField("characters", [...formData.characters, createEmptyCharacter()]);
    setCurrentStep(0);
  }, [formData.characters, updateField]);

  const removeCharacter = useCallback((id: string) => {
    updateField("characters", formData.characters.filter((c) => c.id !== id));
  }, [formData.characters, updateField]);

  const updateCharacter = useCallback((id: string, field: keyof CharacterData, value: unknown) => {
    // Functional update: the image and the image preview are set by two
    // separate calls in the same tick, and a stale-snapshot update would let
    // the second one wipe the first.
    updateField("characters", (prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }, [updateField]);

  const addMap = useCallback(() => {
    updateField("maps", [...formData.maps, createEmptyMap()]);
  }, [formData.maps, updateField]);

  const removeMap = useCallback((id: string) => {
    updateField("maps", formData.maps.filter((m) => m.id !== id));
  }, [formData.maps, updateField]);

  const updateMap = useCallback((id: string, field: keyof MapData, value: unknown) => {
    updateField("maps", (prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  }, [updateField]);

  const addItem = useCallback(() => {
    updateField("items", [...formData.items, createEmptyItem()]);
  }, [formData.items, updateField]);

  const removeItem = useCallback((id: string) => {
    updateField("items", formData.items.filter((i) => i.id !== id));
  }, [formData.items, updateField]);

  const updateItem = useCallback((id: string, field: keyof ItemData, value: unknown) => {
    updateField("items", (prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }, [updateField]);

   return {
     currentStep,
     formData,
     stepKey: STEP_KEYS[currentStep],
     isFirstStep: currentStep === 0,
     isLastStep: currentStep === STEP_COUNT - 1,
     setStep,
     nextStep,
     prevStep,
     updateField,
     reset,
     addCharacter,
     removeCharacter,
     updateCharacter,
     addMap,
     removeMap,
     updateMap,
     addItem,
     removeItem,
     updateItem,
   };
}