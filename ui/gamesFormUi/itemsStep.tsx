"use client";
import ImageUpload from "@/ui/FormUI/imageComponent";
import { itemValidators } from "@/lib/gamesFormValidation";
import { type ItemData } from "@/types/gameForm";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Label } from "@/ui/primitives/label";
import { cn } from "@/lib/utils";

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
    <div className="space-y-6">
      <h2 className="font-display text-xl font-semibold text-text-primary">Items</h2>

      {items.length === 0 && (
        <p className="text-sm text-text-muted">No items yet. Create your first item below.</p>
      )}

      {items.map((item, index) => {
        const nameValidation = itemValidators.name(item.name);
        const nameErrorId = `item-${item.id}-name-error`;

        return (
          <div key={item.id} className="rounded-lg border border-border bg-bg-surface p-4 space-y-3" role="group" aria-label={`Item ${index + 1}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-muted">#{index + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove item ${index + 1}`}
              >
                Remove
              </Button>
            </div>
            <div className="space-y-2">
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
                <span id={nameErrorId} role="alert" className={cn(
                  "text-xs",
                  nameValidation.isFormValid ? "text-success" : nameValidation.errorColor === "error" ? "text-destructive" : "text-warning"
                )}>
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

      <div className="flex justify-between gap-2">
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
