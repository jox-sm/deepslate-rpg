"use client";
import ImageUpload from "@/ui/FormUI/imageComponent";
import { itemValidators } from "@/lib/gamesFormValidation";
import { type ItemData } from "@/types/gameForm";
import formStyles from "@/styles/forms/form.module.css";

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

        return (
          <div key={item.id} className="border border-zinc-700 rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">#{index + 1}</span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <input
                value={item.name}
                onChange={(e) => onUpdate(item.id, "name", e.target.value)}
                placeholder="Item name"
                className={formStyles.input}
              />
              {item.name.length > 0 && (
                <span className={formStyles[nameValidation.isFormValid ? "statusSuccess" : nameValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
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

      <button type="button" onClick={onAdd} className={formStyles.button}>
        Make New Item
      </button>

      <div className="flex gap-2 justify-between mt-4">
        <button type="button" onClick={onBack} className={formStyles.button}>
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className={formStyles.button}
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}