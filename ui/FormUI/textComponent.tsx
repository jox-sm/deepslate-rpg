import { TextAreaFieldProps, TagsComponentProps } from '@/types/form';
import { cn } from '@/lib/utils';

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
      displayColor = "text-destructive";
    } else if (isTooShort) {
      displayMessage = `too short minimum is ${minLength}`;
      displayColor = "text-warning";
    } else if (length > 0) {
      displayMessage = "OK";
      displayColor = "text-success";
    }
  }

  if (!displayColor) {
    displayColor = length > 0 ? "text-destructive" : "";
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex min-h-[80px] w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-200 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
      <label className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-all duration-200",
              selectedTags.includes(tag)
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-text-muted hover:border-text-muted hover:text-text-secondary"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
