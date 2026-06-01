"use client";
import ImageUpload from "@/ui/FormUI/imageComponent";
import { itemValidators } from "@/lib/gamesFormValidation";
import { type ItemData } from "@/types/gameForm";
import formStyles from "@/styles/forms/form.module.css";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Label } from "@/ui/primitives/label";

interface ItemsStepProps {
  items: ItemData[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof ItemData, value: unknown) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading?: boolean;
}

export default function ItemsStep({
  items,
  onAdd,
  onRemove,
  onUpdate,
  onBack,
  onSubmit,
  loading,
}: ItemsStepProps) {
  return (
    <div className={formStyles.card}>
      <h2 className={formStyles.title}>Items</h2>

      {items.length === 0 && (
        <p className="text-sm text-zinc-400">No items yet. Create your first item below.</p>
      )}

      {items.map((item, index) => {
        const nameValidation = itemValidators.name(item.name);
        const nameErrorId = `item-${item.id}-name-error`;

        return (
          <div key={item.id} className="border border-zinc-700 rounded-lg p-3 flex flex-col gap-2" role="group" aria-label={`Item ${index + 1}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">#{index + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove item ${index + 1}`}
              >
                Remove
              </Button>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <Label htmlFor={`item-${item.id}-name`}>Name</Label>
              <Input
                id={`item-${item.id}-name`}
                value={item.name}
                onChange={(e) => onUpdate(item.id, "name", e.target.value)}
                placeholder="Item name"
                aria-invalid={item.name.length > 0 && !nameValidation.isFormValid}
                aria-describedby={item.name.length > 0 ? nameErrorId : undefined}
              />
              {item.name.length > 0 && (
                <span id={nameErrorId} role="alert" className={formStyles[nameValidation.isFormValid ? "statusSuccess" : nameValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
                  {nameValidation.errorMessage}
                </span>
              )}
            </div>
            <ImageUpload
              label="Item Image"
              onSelect={(file) => onUpdate(item.id, "image", file)}
              onPreviewChange={(preview) => onUpdate(item.id, "imagePreview", preview)}
            />
          </div>
        );
      })}

      <Button onClick={onAdd}>
        Make New Item
      </Button>

      <div className="flex gap-2 justify-between mt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}