"use client";
import TextAreaField, { tagsComponent } from '@/ui/FormUI/textComponent';
import ImageUpload from '@/ui/FormUI/imageComponent';
import { validateText } from '@/utilities/FormUtils';
import { arrayBufferToBase64 } from '@/utilities/clientUtilities/imagesUtils';
import { prepareGameCard } from '@/utilities/utils';
import { CardProps } from '@/types/cards';
import { useCallback, useEffect, useRef } from "react";
import GamesFormWizard from '@/ui/gamesFormUi/form';
import type { GamesFormData } from '@/types/gameForm';
import type { CharacterDataDB, MapDataDB, ItemDataDB, GamesFormDataDB } from '@/types/gameForm';
import { GAME_FORM_FIELD_CONFIG, initialGameFormState, PRE_EXISTING_TAGS } from '@/types/form';
import { useGameForm } from '@/hooks/form';
import { Button } from "@/ui/primitives/button";
import { useIdempotentRequest } from '@/hooks/useIdempotentRequest';
import { v7 as uuidv7 } from 'uuid';
import { classifyError } from '@/utilities/errorHandler';
import { clearGameDraft } from '@/utilities/clientUtilities/gameDraftStorage';

/**
 * Fallback cover image. The `games.image` column is NOT NULL, so a game
 * still needs a value even when the upload fails (e.g. the storage host is
 * unreachable) or no image was chosen. Images are optional - the game is
 * not.
 */
const PLACEHOLDER_GAME_IMAGE = "/images/project.jpg";

const STATUS_COLOR_MAP = {
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
} as const;

export default function CreateForm() {
  const { form, loading, setLoading, showWizard, setShowWizard, resetCounter, resetForm, updateField } = useGameForm(initialGameFormState);
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  const { sendRequest } = useIdempotentRequest();

  const nameValidation = validateText(form.name, GAME_FORM_FIELD_CONFIG.name);
  const descValidation = validateText(form.description, GAME_FORM_FIELD_CONFIG.description);
  const isFormValid = nameValidation.isFormValid && descValidation.isFormValid;

  const handleFinalSubmit = useCallback(async (wizardData: GamesFormData) => {
    const currentForm = formRef.current;
    if (!isFormValid) return;

    setLoading(true);
    try {
      const convertUrlKey = uuidv7();
      const pushKey = uuidv7();
      const convertImagesKey = uuidv7();
      const pushGamesKey = uuidv7();

      // The cover image is optional. If storage is unreachable (or no image
      // was chosen) fall back to the bundled placeholder so the game is still
      // created instead of the whole submit failing.
      let imageUrl = PLACEHOLDER_GAME_IMAGE;
      if (currentForm.image) {
        try {
          imageUrl = await sendRequest<{ url: string }>(
            "/api/convertUrl",
            { image: arrayBufferToBase64(currentForm.image) },
            { idempotencyKey: convertUrlKey }
          ).then(data => data.url);
        } catch (error) {
          const classified = classifyError(error, "CreateForm.coverImageUpload");
          console.error("[CreateForm] Cover image upload failed, using placeholder:", classified.message);
        }
      }

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

      // Send EVERY entry, not only the ones that have an image. The previous
      // code filtered them out first, which silently deleted characters,
      // maps and items the user had added without an image.
      const convertedGame = await sendRequest<GamesFormDataDB>(
        "/api/convertUrl/ConvertGameImages",
        {
          id: gameData.id,
          characters,
          maps,
          items,
        },
        { idempotencyKey: convertImagesKey }
      );

      await sendRequest("/api/push/pushGames", convertedGame, { idempotencyKey: pushGamesKey });

      // The game exists now - the draft has served its purpose.
      resetForm();
      clearGameDraft();
    } catch (err) {
      const classified = classifyError(err, "CreateForm.handleFinalSubmit");
      console.error(classified.message);
    } finally {
      setLoading(false);
    }
  }, [isFormValid, resetForm, sendRequest, setLoading]);

  const renderValidationMessage = () => {
    if (!isFormValid) {
      return (
        <p className="text-sm text-warning">
          Please follow the length requirements for all fields
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
      <div className="dungeon-card p-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Create game</h2>
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
            value={form.imagePreview || null}
            onSelect={(file) => updateField("image", file)}
            onPreviewChange={(preview) => updateField("imagePreview", preview)}
            resetKey={resetCounter}
          />

          {renderValidationMessage()}

          <Button
            onClick={() => setShowWizard(true)}
            disabled={loading || !isFormValid}
            className="w-full"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
