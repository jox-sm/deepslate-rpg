import { TextAreaFieldProps, TagsComponentProps } from '@/types/form';
import formStyles from "@/styles/forms/form.module.css";
export default function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  isValid,
  minLength = 150,
  maxLength = 1400,
  errorMessage,
  statusColorClass,
}: TextAreaFieldProps) {
  const length = value.replace(/\s/g, "").length;
  const isTooShort = length < minLength;
  const isTooLong = length > maxLength;

  let displayMessage = errorMessage;
  let displayColor = statusColorClass;

  if (!displayMessage) {
    if (isTooLong) {
      displayMessage = `max is ${maxLength}`;
      displayColor = formStyles.statusError;
    } else if (isTooShort) {
      displayMessage = `too short minimum is ${minLength}`;
      displayColor = formStyles.statusWarning;
    } else if (length > 0) {
      displayMessage = "OK";
      displayColor = formStyles.statusSuccess;
    }
  }

  if (!displayColor) {
    displayColor = length > 0 ? formStyles.statusError : "";
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        {label}
      </label>

      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={formStyles.input}
      />

      <div className="flex justify-between text-sm">
        <span className={displayColor}>
          {displayMessage}
         </span>
      </div>
    </div>
  );
}

export function tagsComponent({
  label,
  availableTags,
  selectedTags,
  onTagsChange,
}: TagsComponentProps) {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        {label}
      </label>

      <div className={formStyles.tagsContainer}>
        {availableTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`${formStyles.tagButton} ${
              selectedTags.includes(tag) ? formStyles.selected : ""
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}