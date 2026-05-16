"use client";
import ImageUpload from "@/ui/FormUI/imageComponent";
import { mapValidators } from "@/lib/gamesFormValidation";
import { type MapData } from "@/types/gameForm";
import formStyles from "@/styles/forms/form.module.css";

interface MapsStepProps {
  maps: MapData[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof MapData, value: unknown) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function MapsStep({ maps, onAdd, onRemove, onUpdate, onNext, onBack }: MapsStepProps) {
  return (
    <div className={formStyles.card}>
      <h2 className={formStyles.title}>Maps</h2>

      {maps.length === 0 && (
        <p className="text-sm text-zinc-400">No maps added yet. Add your first map below.</p>
      )}

      {maps.map((mapItem, index) => {
        const nameValidation = mapValidators.nameOfPlace(mapItem.nameOfPlace);
        const sizeValidation = mapValidators.sizeOfPlace(mapItem.sizeOfPlace);
        const placesValidation = mapValidators.placesAtMap(mapItem.placesAtMap);

        return (
          <div key={mapItem.id} className="border border-zinc-700 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-zinc-300">Map {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(mapItem.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Name of Place</label>
              <input
                value={mapItem.nameOfPlace}
                onChange={(e) => onUpdate(mapItem.id, "nameOfPlace", e.target.value)}
                placeholder="Place name"
                className={formStyles.input}
              />
              {mapItem.nameOfPlace.length > 0 && (
                <span className={formStyles[nameValidation.isFormValid ? "statusSuccess" : nameValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
                  {nameValidation.errorMessage}
                </span>
              )}
            </div>

            <ImageUpload
              label="Map Image"
              onSelect={(file) => onUpdate(mapItem.id, "image", file)}
              onPreviewChange={(preview) => onUpdate(mapItem.id, "imagePreview", preview)}
            />

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Size of Place</label>
              <input
                value={mapItem.sizeOfPlace}
                onChange={(e) => onUpdate(mapItem.id, "sizeOfPlace", e.target.value)}
                placeholder="e.g. 1000 sq km"
                className={formStyles.input}
              />
              {mapItem.sizeOfPlace.length > 0 && (
                <span className={formStyles[sizeValidation.isFormValid ? "statusSuccess" : sizeValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
                  {sizeValidation.errorMessage}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Places at Map</label>
              <textarea
                value={mapItem.placesAtMap}
                onChange={(e) => onUpdate(mapItem.id, "placesAtMap", e.target.value)}
                placeholder="Describe notable places in this map"
                className={formStyles.input}
                rows={4}
              />
              {mapItem.placesAtMap.length > 0 && (
                <span className={formStyles[placesValidation.isFormValid ? "statusSuccess" : placesValidation.errorColor === "error" ? "statusError" : "statusWarning"]}>
                  {placesValidation.errorMessage}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <button type="button" onClick={onAdd} className={formStyles.button}>
        Add New Map
      </button>

      <div className="flex gap-2 justify-between">
        <button type="button" onClick={onBack} className={formStyles.button}>
          Back
        </button>
        <button type="button" onClick={onNext} className={formStyles.button}>
          Next
        </button>
      </div>
    </div>
  );
}