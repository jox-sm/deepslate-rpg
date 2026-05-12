"use client";
import TextAreaField from '@/ui/FormUI/textComponent';
import ImageUpload  from '@/ui/FormUI/imageComponent';
import { validateText } from '@/utilities/FormUtils';
import { useState } from "react";
import formStyles from "@/styles/forms/form.module.css";

const statusColorMap = {
  success: formStyles.statusSuccess,
  warning: formStyles.statusWarning,
  error: formStyles.statusError,
} as const;

export default function CreateForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const nameValidation = validateText(name, { minLength: 4, maxLength: 100, fieldName: "Name" });
  const descValidation = validateText(description, { minLength: 50, maxLength: 400, fieldName: "Description" });
  const isFormValid = nameValidation.isFormValid && descValidation.isFormValid;

  async function handleSubmit() {
    if (!isFormValid) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);

      if (image) {
        formData.append("image", image);
      }

      await fetch("/api", {
        method: "POST",
        body: formData,
      });

      setName("");
      setDescription("");
      setImage(null);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={formStyles.wrapper}>
      <div className={formStyles.card}>

        <h1 className={formStyles.title}>Create Game</h1>

        <TextAreaField
          label="Name"
          value={name}
          onChange={setName}
          placeholder="Enter the name of the game"
          minLength={4}
          maxLength={100}
          isValid={name.length === 0 ? undefined : nameValidation.isFormValid}
          errorMessage={nameValidation.errorMessage}
          statusColorClass={nameValidation.trueLength > 0 ? statusColorMap[nameValidation.errorColor] : undefined}
        />

        <TextAreaField
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Enter the short description of the game"
          minLength={50}
          maxLength={400}
          isValid={description.length === 0 ? undefined : descValidation.isFormValid}
          errorMessage={descValidation.errorMessage}
          statusColorClass={descValidation.trueLength > 0 ? statusColorMap[descValidation.errorColor] : undefined}
        />

        
        <ImageUpload
          label="Image"
          onSelect={setImage}
        />

        {!isFormValid && (
          <p className="text-sm text-red-500 text-center">
            Please follow the length requirements for all fields
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !isFormValid}
          className={formStyles.button}
        >
          {loading ? "Submitting..." : "Submit"}
        </button>

      </div>
    </div>
  );
}
