"use client";
import ImageUpload from "@/ui/FormUI/imageComponent";
import { mapValidators } from "@/lib/gamesFormValidation";
import { type MapData } from "@/types/gameForm";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Textarea } from "@/ui/primitives/textarea";
import { Label } from "@/ui/primitives/label";
import { cn } from "@/lib/utils";

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
    <div className="space-y-6">
      <h2 className="font-display text-xl font-semibold text-text-primary">Maps</h2>

      {maps.length === 0 && (
        <p className="text-sm text-text-muted">No maps added yet. Add your first map below.</p>
      )}

      {maps.map((mapItem, index) => {
        const nameValidation = mapValidators.nameOfPlace(mapItem.nameOfPlace);
        const sizeValidation = mapValidators.sizeOfPlace(mapItem.sizeOfPlace);
        const placesValidation = mapValidators.placesAtMap(mapItem.placesAtMap);
        const nameErrorId = `map-${mapItem.id}-name-error`;
        const sizeErrorId = `map-${mapItem.id}-size-error`;
        const placesErrorId = `map-${mapItem.id}-places-error`;

        return (
          <div key={mapItem.id} className="rounded-lg border border-border bg-bg-surface p-4 space-y-4" role="group" aria-label={`Map ${index + 1}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Map {index + 1}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(mapItem.id)}
                aria-label={`Remove map ${index + 1}`}
              >
                Remove
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`map-${mapItem.id}-name`}>Name of Place</Label>
              <Input
                id={`map-${mapItem.id}-name`}
                value={mapItem.nameOfPlace}
                onChange={(e) => onUpdate(mapItem.id, "nameOfPlace", e.target.value)}
                placeholder="Place name"
                aria-invalid={mapItem.nameOfPlace.length > 0 && !nameValidation.isFormValid}
                aria-describedby={mapItem.nameOfPlace.length > 0 ? nameErrorId : undefined}
              />
              {mapItem.nameOfPlace.length > 0 && (
                <span id={nameErrorId} role="alert" className={cn(
                  "text-xs",
                  nameValidation.isFormValid ? "text-success" : nameValidation.errorColor === "error" ? "text-destructive" : "text-warning"
                )}>
                  {nameValidation.errorMessage}
                </span>
              )}
            </div>

            <ImageUpload
              label="Map Image"
              onSelect={(file) => onUpdate(mapItem.id, "image", file)}
              onPreviewChange={(preview) => onUpdate(mapItem.id, "imagePreview", preview)}
            />

            <div className="space-y-2">
              <Label htmlFor={`map-${mapItem.id}-size`}>Size of Place</Label>
              <Input
                id={`map-${mapItem.id}-size`}
                value={mapItem.sizeOfPlace}
                onChange={(e) => onUpdate(mapItem.id, "sizeOfPlace", e.target.value)}
                placeholder="e.g. 1000 sq km"
                aria-invalid={mapItem.sizeOfPlace.length > 0 && !sizeValidation.isFormValid}
                aria-describedby={mapItem.sizeOfPlace.length > 0 ? sizeErrorId : undefined}
              />
              {mapItem.sizeOfPlace.length > 0 && (
                <span id={sizeErrorId} role="alert" className={cn(
                  "text-xs",
                  sizeValidation.isFormValid ? "text-success" : sizeValidation.errorColor === "error" ? "text-destructive" : "text-warning"
                )}>
                  {sizeValidation.errorMessage}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`map-${mapItem.id}-places`}>Places at Map</Label>
              <Textarea
                id={`map-${mapItem.id}-places`}
                value={mapItem.placesAtMap}
                onChange={(e) => onUpdate(mapItem.id, "placesAtMap", e.target.value)}
                placeholder="Describe notable places in this map"
                rows={4}
                aria-invalid={mapItem.placesAtMap.length > 0 && !placesValidation.isFormValid}
                aria-describedby={mapItem.placesAtMap.length > 0 ? placesErrorId : undefined}
              />
              {mapItem.placesAtMap.length > 0 && (
                <span id={placesErrorId} role="alert" className={cn(
                  "text-xs",
                  placesValidation.isFormValid ? "text-success" : placesValidation.errorColor === "error" ? "text-destructive" : "text-warning"
                )}>
                  {placesValidation.errorMessage}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <Button onClick={onAdd}>
        Add New Map
      </Button>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
