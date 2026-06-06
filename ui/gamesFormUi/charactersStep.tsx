"use client";
import ImageUpload from "@/ui/FormUI/imageComponent";
import { characterValidators } from "@/lib/gamesFormValidation";
import { type CharacterData } from "@/types/gameForm";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Textarea } from "@/ui/primitives/textarea";
import { Label } from "@/ui/primitives/label";
import { cn } from "@/lib/utils";

interface CharactersStepProps {
  characters: CharacterData[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof CharacterData, value: unknown) => void;
  onNext: () => void;
}

export default function CharactersStep({ characters, onAdd, onRemove, onUpdate, onNext }: CharactersStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-semibold text-text-primary">Characters</h2>

      {characters.length === 0 && (
        <p className="text-sm text-text-muted">No characters added yet. Add your first character below.</p>
      )}

      {characters.map((char, index) => {
        const nameValidation = characterValidators.name(char.name);
        const descValidation = characterValidators.description(char.description);
        const nameErrorId = `char-${char.id}-name-error`;
        const descErrorId = `char-${char.id}-desc-error`;

        return (
          <div key={char.id} className="rounded-lg border border-border bg-bg-surface p-4 space-y-4" role="group" aria-label={`Character ${index + 1}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Character {index + 1}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(char.id)}
                aria-label={`Remove character ${index + 1}`}
              >
                Remove
              </Button>
            </div>

            <div className="space-y-2">
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
                <span id={nameErrorId} role="alert" className={cn(
                  "text-xs",
                  nameValidation.isFormValid ? "text-success" : nameValidation.errorColor === "error" ? "text-destructive" : "text-warning"
                )}>
                  {nameValidation.errorMessage}
                </span>
              )}
            </div>

            <div className="space-y-2">
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
                <span id={descErrorId} role="alert" className={cn(
                  "text-xs",
                  descValidation.isFormValid ? "text-success" : descValidation.errorColor === "error" ? "text-destructive" : "text-warning"
                )}>
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

      <Button onClick={onAdd}>
        Add Character
      </Button>

      <div className="flex justify-end">
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
