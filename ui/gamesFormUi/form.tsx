"use client";
import { useGamesForm, createEmptyCharacter, createEmptyMap, createEmptyItem } from "@/hooks/gameForm";
import { GAMES_FORM_STEPS, type GamesFormData } from "@/types/gameForm";
import CharactersStep from "./charactersStep";
import MapsStep from "./mapsStep";
import ItemsStep from "./itemsStep";
import { cn } from "@/lib/utils";

interface GamesFormWizardProps {
  onComplete: (wizardData: GamesFormData) => void;
  loading?: boolean;
}

export default function GamesFormWizard({ onComplete, loading }: GamesFormWizardProps) {
  const hook = useGamesForm(onComplete);

  const renderStep = () => {
    switch (hook.stepKey) {
      case "characters":
        return (
          <CharactersStep
            characters={hook.formData.characters}
            onAdd={hook.addCharacter}
            onRemove={hook.removeCharacter}
            onUpdate={hook.updateCharacter}
            onNext={hook.nextStep}
          />
        );
      case "maps":
        return (
          <MapsStep
            maps={hook.formData.maps}
            onAdd={hook.addMap}
            onRemove={hook.removeMap}
            onUpdate={hook.updateMap}
            onNext={hook.nextStep}
            onBack={hook.prevStep}
          />
        );
      case "items":
        return (
          <ItemsStep
            items={hook.formData.items}
            onAdd={hook.addItem}
            onRemove={hook.removeItem}
            onUpdate={hook.updateItem}
            onBack={hook.prevStep}
            onSubmit={() => onComplete(hook.formData)}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <nav aria-label="Form steps" className="flex items-center justify-center gap-4">
        {GAMES_FORM_STEPS.map((step, index) => (
          <div
            key={step.key}
            className={cn(
              "flex items-center gap-2 transition-colors duration-200",
              index <= hook.currentStep ? "text-accent" : "text-text-muted",
              index === hook.currentStep ? "font-semibold" : ""
            )}
            aria-current={index === hook.currentStep ? "step" : undefined}
          >
            <span className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-colors duration-200",
              index <= hook.currentStep
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-text-muted"
            )}>
              {index + 1}
            </span>
            <span className="hidden text-sm sm:inline">{step.title}</span>
          </div>
        ))}
      </nav>
      {renderStep()}
    </div>
  );
}

export { createEmptyCharacter, createEmptyMap, createEmptyItem };
