"use client";
import ImageUpload from "@/ui/FormUI/imageComponent";
import { characterValidators } from "@/lib/gamesFormValidation";
import { type CharacterData } from "@/types/gameForm";
import formStyles from "@/styles/forms/form.module.css";

interface CharactersStepProps {
  characters: CharacterData[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof CharacterData, value: unknown) => void;
  onNext: () => void;
}

export default function CharactersStep({ characters, onAdd, onRemove, onUpdate, onNext }: CharactersStepProps) {
  return (
    <div className={formStyles.card}>
      <h2 className={formStyles.title}>Characters</h2>

      {characters.length === 0 && (
        <p className="text-sm text-zinc-400">No characters added yet. Add your first character below.</p>
      )}

      {characters.map((char, index) => {
        const nameValidation = characterValidators.name(char.name);
        const descValidation = characterValidators.description(char.description);

        return (
          <div key={char.id} className="border border-zinc-700 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-zinc-300">Character {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(char.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Name</label>
              <input
                value={char.name}
                onChange={(e) => onUpdate(char.id, "name", e.target.value)}
                placeholder="Character name"
                className={formStyles.input}
              />
              {char.name.length > 0 && (
                <span className={formStyles[nameValidation.isFormValid ? "statusSuccess" : nameValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
                  {nameValidation.errorMessage}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={char.description}
                onChange={(e) => onUpdate(char.id, "description", e.target.value)}
                placeholder="Character description"
                className={formStyles.input}
                rows={4}
              />
              {char.description.length > 0 && (
                <span className={formStyles[descValidation.isFormValid ? "statusSuccess" : descValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
                  {descValidation.errorMessage}
                </span>
              )}
            </div>

            <ImageUpload
              label="Image"
              onSelect={(file) => onUpdate(char.id, "image", file)}
              onPreviewChange={(preview) => onUpdate(char.id, "imagePreview", preview)}
            />
          </div>
        );
      })}

      <div className="flex gap-2">
        <button type="button" onClick={onAdd} className={formStyles.button}>
          Add Character
        </button>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onNext} className={formStyles.button}>
          Next
        </button>
      </div>
    </div>
  );
}