"use client";
import TextAreaField, { tagsComponent } from '@/ui/FormUI/textComponent';
import ImageUpload from '@/ui/FormUI/imageComponent';
import { validateText } from '@/utilities/FormUtils';
import { prepareGameCard } from '@/utilities/utils';
import { CardProps } from '@/types/cards';
import { useState, useCallback } from "react";
import formStyles from "@/styles/forms/form.module.css";
import GamesFormWizard from '@/ui/gamesFormUi/form';
import type { GamesFormData } from '@/types/form';

const PRE_EXISTING_TAGS = [
  "Adventure", "Action", "New", "Thrills", "Isekai",
  "Fantasy", "Sci-Fi", "Horror", "Romance", "Comedy"
] as const;

const FIELD_CONFIG = {
  name: { minLength: 4, maxLength: 100, fieldName: "Name" },
  description: { minLength: 50, maxLength: 400, fieldName: "Description" },
} as const;

const STATUS_COLOR_MAP = {
  success: formStyles.statusSuccess,
  warning: formStyles.statusWarning,
  error: formStyles.statusError,
} as const;

interface FormState {
  name: string;
  description: string;
  image: File | null;
  imagePreview: string;
  selectedTags: string[];
}

const initialFormState: FormState = {
  name: "",
  description: "",
  image: null,
  imagePreview: "",
  selectedTags: [],
};

export default function CreateForm() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [loading, setLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  const nameValidation = validateText(form.name, FIELD_CONFIG.name);
  const descValidation = validateText(form.description, FIELD_CONFIG.description);
  const isFormValid = nameValidation.isFormValid && descValidation.isFormValid;

  const resetForm = useCallback(() => {
    setForm(initialFormState);
    setResetCounter((c) => c + 1);
    setShowWizard(false);
  }, []);

  const updateField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleFinalSubmit = useCallback(async (wizardData: GamesFormData) => {
    if (!isFormValid || !form.image) return;

    setLoading(true);
    try {
      const imageUrl = await fetch("/api/convertUrl", {
        method: "POST",
        body: form.image,
      }).then(res => res.json()).then(data => data.url);

      const cardData: CardProps = {
        name: form.name,
        description: form.description,
        tags: form.selectedTags,
        image: imageUrl,
        likes_count: 0,
      };

      const gameData = prepareGameCard(cardData);

      const payload = {
        type: "game",
        data: gameData,
        gameData: {
          characters: wizardData.characters,
          maps: wizardData.maps,
          items: wizardData.items,
        },
      };

      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isFormValid, form, resetForm]);

  const renderValidationMessage = () => {
    if (!isFormValid) {
      return (
        <p className="text-sm text-red-500 text-center">
          Please follow the length requirements for all fields
        </p>
      );
    }
    if (form.name.length > 0 && form.description.length > 0 && !form.image) {
      return (
        <p className="text-sm text-red-500 text-center">
          Please upload an image
        </p>
      );
    }
    return null;
  };

  if (showWizard) {
    return (
      <div className={formStyles.wrapper}>
        <GamesFormWizard onComplete={handleFinalSubmit} loading={loading} />
      </div>
    );
  }

  return (
    <div className={formStyles.wrapper}>
      <div className={formStyles.card}>
        <h1 className={formStyles.title}>Create Game</h1>

        <TextAreaField
          label="Name"
          value={form.name}
          onChange={(value) => updateField("name", value)}
          placeholder="Enter the name of the game"
          minLength={FIELD_CONFIG.name.minLength}
          maxLength={FIELD_CONFIG.name.maxLength}
          isValid={form.name.length === 0 ? undefined : nameValidation.isFormValid}
          errorMessage={nameValidation.errorMessage}
          statusColorClass={nameValidation.trueLength > 0 ? STATUS_COLOR_MAP[nameValidation.errorColor] : undefined}
        />

        <TextAreaField
          label="Description"
          value={form.description}
          onChange={(value) => updateField("description", value)}
          placeholder="Enter the short description of the game"
          minLength={FIELD_CONFIG.description.minLength}
          maxLength={FIELD_CONFIG.description.maxLength}
          isValid={form.description.length === 0 ? undefined : descValidation.isFormValid}
          errorMessage={descValidation.errorMessage}
          statusColorClass={descValidation.trueLength > 0 ? STATUS_COLOR_MAP[descValidation.errorColor] : undefined}
        />

        {tagsComponent({
          label: "Tags",
          availableTags: [...PRE_EXISTING_TAGS],
          selectedTags: form.selectedTags,
          onTagsChange: (tags) => updateField("selectedTags", tags),
        })}

        <ImageUpload
          label="Image"
          onSelect={(file) => updateField("image", file)}
          onPreviewChange={(preview) => updateField("imagePreview", preview)}
          resetKey={resetCounter}
        />

        {renderValidationMessage()}

        <button
          onClick={() => setShowWizard(true)}
          disabled={loading || !isFormValid || !form.image}
          className={formStyles.button}
        >
          Next
        </button>
      </div>
    </div>
  );
}
