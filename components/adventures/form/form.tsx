"use client";
import TextAreaField, { tagsComponent } from '@/ui/FormUI/textComponent';
import ImageUpload from '@/ui/FormUI/imageComponent';
import { validateText } from '@/utilities/FormUtils';
import { arrayBufferToBase64 } from '@/utilities/clientUtilities/imagesUtils';
import { filterEntriesWithImages } from '@/utilities/clientUtilities/exceptions';
import { prepareGameCard } from '@/utilities/utils';
import { CardProps } from '@/types/cards';
import { useCallback, useRef } from "react";
import GamesFormWizard from '@/ui/gamesFormUi/form';
import type { GamesFormData } from '@/types/gameForm';
import type { CharacterDataDB, MapDataDB, ItemDataDB, GamesFormDataDB } from '@/types/gameForm';
import { GAME_FORM_FIELD_CONFIG, initialGameFormState, PRE_EXISTING_TAGS, type GameFormState as FormState } from '@/types/form';
import { useGameForm } from '@/hooks/form';
import { Button } from "@/ui/primitives/button";
import { useIdempotentRequest } from '@/hooks/useIdempotentRequest';
import { v7 as uuidv7 } from 'uuid';
import { cn } from '@/lib/utils';
import styles from "@/styles/forms/form.module.css";
import { classifyError } from '@/utilities/errorHandler';

const STATUS_COLOR_MAP = {
  success: styles.statusSuccess,
  warning: styles.statusWarning,
  error: styles.statusError,
} as const;

export default function CreateForm() {
  const { form, loading, setLoading, showWizard, setShowWizard, resetCounter, resetForm, updateField } = useGameForm(initialGameFormState);
  const formRef = useRef(form);
  formRef.current = form;
  const { sendRequest, abortAll } = useIdempotentRequest();

  const nameValidation = validateText(form.name, GAME_FORM_FIELD_CONFIG.name);
  const descValidation = validateText(form.description, GAME_FORM_FIELD_CONFIG.description);
  const isFormValid = nameValidation.isFormValid && descValidation.isFormValid;

  const handleFinalSubmit = useCallback(async (wizardData: GamesFormData) => {
    const currentForm = formRef.current;
    if (!isFormValid || !currentForm.image) return;

    setLoading(true);
    try {
      const convertUrlKey = uuidv7();
      const pushKey = uuidv7();
      const convertImagesKey = uuidv7();
      const pushGamesKey = uuidv7();

      const imageUrl = await sendRequest<{ url: string }>(
        "/api/convertUrl",
        { image: arrayBufferToBase64(currentForm.image) },
        { idempotencyKey: convertUrlKey }
      ).then(data => data.url);

      const characterImages = wizardData.characters.map(c =>
        c.image ? arrayBufferToBase64(c.image) : null
      );
      const mapImages = wizardData.maps.map(m =>
        m.image ? arrayBufferToBase64(m.image) : null
      );
      const itemImages = wizardData.items.map(i =>
        i.image ? arrayBufferToBase64(i.image) : null
      );

      const cardData: CardProps = {
        id: '',
        name: currentForm.name,
        description: currentForm.description,
        tags: currentForm.selectedTags,
        image: imageUrl,
        likes_count: 0,
      };

      const gameData = prepareGameCard(cardData);
      const characters: CharacterDataDB[] = wizardData.characters.map((c, idx) => ({
        id: c.id, name: c.name, description: c.description,
        image: characterImages[idx] || "",
      }));
      const maps: MapDataDB[] = wizardData.maps.map((m, idx) => ({
        id: m.id, nameOfPlace: m.nameOfPlace,
        image: mapImages[idx] || "", sizeOfPlace: m.sizeOfPlace,
        placesAtMap: m.placesAtMap,
      }));
      const items: ItemDataDB[] = wizardData.items.map((i, idx) => ({
        id: i.id, name: i.name, image: itemImages[idx] || "",
      }));

      const payload = {
        type: "game",
        data: gameData,
        gameData: { id: gameData.id, characters, maps, items },
      };

      await sendRequest("/api/push", payload, { idempotencyKey: pushKey });

      const convertedGame = await sendRequest<GamesFormDataDB>(
        "/api/convertUrl/ConvertGameImages",
        {
          id: gameData.id,
          characters: filterEntriesWithImages(characters),
          maps: filterEntriesWithImages(maps),
          items: filterEntriesWithImages(items),
        },
        { idempotencyKey: convertImagesKey }
      );

      await sendRequest("/api/push/pushGames", convertedGame, { idempotencyKey: pushGamesKey });
      resetForm();
    } catch (err) {
      const classified = classifyError(err, "CreateForm.handleFinalSubmit");
      console.error(classified.message);
    } finally {
      setLoading(false);
    }
  }, [isFormValid, resetForm, sendRequest, abortAll]);

  const renderValidationMessage = () => {
    if (!isFormValid) {
      return (
        <p className={cn(styles.validationMessage, "text-sm")}>
          Please follow the length requirements for all fields
        </p>
      );
    }
    if (form.name.length > 0 && form.description.length > 0 && !form.image) {
      return (
        <p className={cn(styles.validationMessage, "text-sm")}>
          Please upload an image
        </p>
      );
    }
    return null;
  };

  if (showWizard) {
    return (
      <div className="mx-auto max-w-3xl">
        <GamesFormWizard onComplete={handleFinalSubmit} loading={loading} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className={cn(styles.card, "p-8")}>
        <h2 className={cn(styles.title, "text-2xl")}>Create Game</h2>
        <p className="mt-1 text-sm text-text-muted">Fill in the details to create a new adventure.</p>

        <div className="mt-8 space-y-6">
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

          <Button
            onClick={() => setShowWizard(true)}
            disabled={loading || !isFormValid || !form.image}
            className="w-full"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
