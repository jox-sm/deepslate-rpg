"use client";
import { useGamesForm, createEmptyCharacter, createEmptyMap, createEmptyItem } from "@/hooks/gameForm";
import { GAMES_FORM_STEPS, type GamesFormData } from "@/types/gameForm";
import CharactersStep from "./charactersStep";
import MapsStep from "./mapsStep";
import ItemsStep from "./itemsStep";
import styles from "@/styles/forms/wizard.module.css";

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
      <div className={styles.container}>
        <nav aria-label="Form steps" className={styles.stepIndicator}>
          {GAMES_FORM_STEPS.map((step, index) => (
            <div
              key={step.key}
              className={`${styles.step} ${index <= hook.currentStep ? styles.active : ""} ${index === hook.currentStep ? styles.current : ""}`}
              aria-current={index === hook.currentStep ? "step" : undefined}
            >
              <span className={styles.stepNumber}>{index + 1}</span>
              <span className={styles.stepLabel}>{step.title}</span>
            </div>
          ))}
        </nav>
      {renderStep()}
    </div>
  );
}

export { createEmptyCharacter, createEmptyMap, createEmptyItem };