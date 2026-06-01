"use client";

import { useFormState } from "@/hooks/useFormState";
import { v7 as uuidV7 } from "uuid";
import { useState, useCallback } from "react";
import {
  type GamesFormData,
  type CharacterData,
  type MapData,
  type ItemData,
  type GamesFormStep,
  type UseGamesFormReturn,
  initialFormData,
} from "@/types/gameForm";

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

export function useGamesForm(onComplete?: (data: GamesFormData) => void): UseGamesFormReturn {
  const { state: formData, updateField, reset: resetFormState, setLoading } = useFormState<GamesFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(0);

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
  }, []);

  const addCharacter = useCallback(() => {
    updateField("characters", [...formData.characters, createEmptyCharacter()]);
    setCurrentStep(0);
  }, [formData.characters]);

  const removeCharacter = useCallback((id: string) => {
    updateField("characters", formData.characters.filter((c) => c.id !== id));
  }, [formData.characters]);

  const updateCharacter = useCallback((id: string, field: keyof CharacterData, value: unknown) => {
    const updatedCharacters = formData.characters.map((c) => 
      c.id === id ? { ...c, [field]: value } : c
    );
    updateField("characters", updatedCharacters);
  }, [formData.characters]);

  const addMap = useCallback(() => {
    updateField("maps", [...formData.maps, createEmptyMap()]);
  }, [formData.maps]);

  const removeMap = useCallback((id: string) => {
    updateField("maps", formData.maps.filter((m) => m.id !== id));
  }, [formData.maps]);

  const updateMap = useCallback((id: string, field: keyof MapData, value: unknown) => {
    const updatedMaps = formData.maps.map((m) => 
      m.id === id ? { ...m, [field]: value } : m
    );
    updateField("maps", updatedMaps);
  }, [formData.maps]);

  const addItem = useCallback(() => {
    updateField("items", [...formData.items, createEmptyItem()]);
  }, [formData.items]);

  const removeItem = useCallback((id: string) => {
    updateField("items", formData.items.filter((i) => i.id !== id));
  }, [formData.items]);

  const updateItem = useCallback((id: string, field: keyof ItemData, value: unknown) => {
    const updatedItems = formData.items.map((i) => 
      i.id === id ? { ...i, [field]: value } : i
    );
    updateField("items", updatedItems);
  }, [formData.items]);

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