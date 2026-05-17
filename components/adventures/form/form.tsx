"use client";
import TextAreaField, { tagsComponent } from '@/ui/FormUI/textComponent';
import ImageUpload from '@/ui/FormUI/imageComponent';
import { validateText, fileToBase64 } from '@/utilities/FormUtils';
import { prepareGameCard } from '@/utilities/utils';
import { CardProps } from '@/types/cards';
import { useCallback } from "react";
import formStyles from "@/styles/forms/form.module.css";
import GamesFormWizard from '@/ui/gamesFormUi/form';
import type { GamesFormData } from '@/types/gameForm';
import type { CharacterDataDB, MapDataDB, ItemDataDB,GamesFormDataDB } from '@/types/gameForm';
import { GAME_FORM_FIELD_CONFIG, initialGameFormState, PRE_EXISTING_TAGS, type GameFormState as FormState } from '@/types/form';
import { useGameForm } from '@/hooks/form';

const STATUS_COLOR_MAP= {
  success: formStyles.statusSuccess,
  warning: formStyles.statusWarning,
  error: formStyles.statusError,
} as const;

export default function CreateForm() {
  const { form, setForm, loading, setLoading, showWizard, setShowWizard, resetCounter, resetForm, updateField } = useGameForm(initialGameFormState);

  const nameValidation = validateText(form.name, GAME_FORM_FIELD_CONFIG.name);
  const descValidation = validateText(form.description, GAME_FORM_FIELD_CONFIG.description);
  const isFormValid = nameValidation.isFormValid && descValidation.isFormValid;

  const handleFinalSubmit = useCallback(async (wizardData: GamesFormData) => {
    if (!isFormValid || !form.image) return;

    setLoading(true);
    try {
      const imageUrl = await fetch("/api/convertUrl", {
        method: "POST",
        body: form.image,
      }).then(res => res.json()).then(data => data.url);

      const characterImages = await Promise.all(
        wizardData.characters.map(c => c.image ? fileToBase64(c.image) : Promise.resolve(null))
      );

      const mapImages = await Promise.all(
        wizardData.maps.map(m => m.image ? fileToBase64(m.image) : Promise.resolve(null))
      );

      const itemImages = await Promise.all(
        wizardData.items.map(i => i.image ? fileToBase64(i.image) : Promise.resolve(null))
      );

      const cardData: CardProps = {
        name: form.name,
        description: form.description,
        tags: form.selectedTags,
        image: imageUrl,
        likes_count: 0,
      };

      const gameData = prepareGameCard(cardData);

      const characters: CharacterDataDB[] = wizardData.characters.map((c, idx) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        image: characterImages[idx] || "",
      }));

      const maps: MapDataDB[] = wizardData.maps.map((m, idx) => ({
        id: m.id,
        nameOfPlace: m.nameOfPlace,
        image: mapImages[idx] || "",
        sizeOfPlace: m.sizeOfPlace,
        placesAtMap: m.placesAtMap,
      }));

      const items: ItemDataDB[] = wizardData.items.map((i, idx) => ({
        id: i.id,
        name: i.name,
        image: itemImages[idx] || "",
      }));

      const payload = {
        type: "game",
        data: gameData,
        gameData: {
          id: gameData.id,
          characters,
          maps,
          items,
        },
      };

      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const convertedGame =await fetch("/api/convertUrl/ConvertGameImages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gameData.id, characters, maps, items }),
      }).then(res => res.json());


      await fetch("/api/push/pushGames", {
        method: "POST",
       headers: { "Content-Type": "application/json" },
      body: JSON.stringify(convertedGame),
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
          minLength={GAME_FORM_FIELD_CONFIG.name.minLength}
          maxLength={GAME_FORM_FIELD_CONFIG.name.maxLength}
          isValid={form.name.length === 0 ? undefined : nameValidation.isFormValid}
          errorMessage={nameValidation.errorMessage}
          statusColorClass={nameValidation.trueLength > 0 ? STATUS_COLOR_MAP[nameValidation.errorColor] : undefined}
        />

        <TextAreaField
          label="Description"
          value={form.description}
          onChange={(value) => updateField("description", value)}
          placeholder="Enter the short description of the game"
          minLength={GAME_FORM_FIELD_CONFIG.description.minLength}
          maxLength={GAME_FORM_FIELD_CONFIG.description.maxLength}
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
