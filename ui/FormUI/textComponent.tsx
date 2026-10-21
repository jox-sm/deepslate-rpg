import { TextAreaFieldProps, TagsComponentProps } from '@/types/form';
import { Textarea } from '@/ui/primitives/textarea';
import { Label } from '@/ui/primitives/label';
import { cn } from '@/lib/utils';

export default function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
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
      <Label>
        {label}
      </Label>
      <Textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
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
      <Label>
        {label}
      </Label>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
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
