"use client";
import ImageUpload from "@/ui/FormUI/imageComponent";
import { characterValidators } from "@/lib/gamesFormValidation";
import { type CharacterData } from "@/types/gameForm";
import formStyles from "@/styles/forms/form.module.css";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Textarea } from "@/ui/primitives/textarea";
import { Label } from "@/ui/primitives/label";

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
        const nameErrorId = `char-${char.id}-name-error`;
        const descErrorId = `char-${char.id}-desc-error`;

        return (
          <div key={char.id} className="border border-zinc-700 rounded-lg p-4 flex flex-col gap-3" role="group" aria-label={`Character ${index + 1}`}>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-zinc-300">Character {index + 1}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(char.id)}
                aria-label={`Remove character ${index + 1}`}
              >
                Remove
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`char-${char.id}-name`}>Name</Label>
              <Input
                id={`char-${char.id}-name`}
                value={char.name}
                onChange={(e) => onUpdate(char.id, "name", e.target.value)}
                placeholder="Character name"
                aria-invalid={char.name.length > 0 && !nameValidation.isFormValid}
                aria-describedby={char.name.length > 0 ? nameErrorId : undefined}
              />
              {char.name.length > 0 && (
                <span id={nameErrorId} role="alert" className={formStyles[nameValidation.isFormValid ? "statusSuccess" : nameValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
                  {nameValidation.errorMessage}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`char-${char.id}-desc`}>Description</Label>
              <Textarea
                id={`char-${char.id}-desc`}
                value={char.description}
                onChange={(e) => onUpdate(char.id, "description", e.target.value)}
                placeholder="Character description"
                rows={4}
                aria-invalid={char.description.length > 0 && !descValidation.isFormValid}
                aria-describedby={char.description.length > 0 ? descErrorId : undefined}
              />
              {char.description.length > 0 && (
                <span id={descErrorId} role="alert" className={formStyles[descValidation.isFormValid ? "statusSuccess" : descValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
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
        <Button onClick={onAdd}>
          Add Character
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}