"use client";

import { useFormState } from "@/hooks/useFormState";
import { v7 as uuidV7 } from "uuid";
import { useState, useCallback } from "react";
import type { GamesFormData, CharacterData, MapData, ItemData, GamesFormStep } from "@/types/form";

const initialFormData: GamesFormData = {
  id:"",
  characters: [],
  maps: [],
  items: [],
};

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

export interface UseGamesFormReturn {
  currentStep: number;
  formData: GamesFormData;
  stepKey: GamesFormStep;
  isFirstStep: boolean;
  isLastStep: boolean;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateField: <K extends keyof GamesFormData>(field: K, value: GamesFormData[K]) => void;
  reset: () => void;
  addCharacter: () => void;
  removeCharacter: (id: string) => void;
  updateCharacter: (id: string, field: keyof CharacterData, value: unknown) => void;
  addMap: () => void;
  removeMap: (id: string) => void;
  updateMap: (id: string, field: keyof MapData, value: unknown) => void;
  addItem: () => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, field: keyof ItemData, value: unknown) => void;
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
    updateField("characters", formData.characters.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }, [formData.characters]);

  const addMap = useCallback(() => {
    updateField("maps", [...formData.maps, createEmptyMap()]);
  }, [formData.maps]);

  const removeMap = useCallback((id: string) => {
    updateField("maps", formData.maps.filter((m) => m.id !== id));
  }, [formData.maps]);

  const updateMap = useCallback((id: string, field: keyof MapData, value: unknown) => {
    updateField("maps", formData.maps.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }, [formData.maps]);

  const addItem = useCallback(() => {
    updateField("items", [...formData.items, createEmptyItem()]);
  }, [formData.items]);

  const removeItem = useCallback((id: string) => {
    updateField("items", formData.items.filter((i) => i.id !== id));
  }, [formData.items]);

  const updateItem = useCallback((id: string, field: keyof ItemData, value: unknown) => {
    updateField("items", formData.items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
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