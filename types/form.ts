type TextAreaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isValid?: boolean;
  minLength?: number;
  maxLength?: number;
  errorMessage?: string;
  statusColorClass?: string;
};

type TagsComponentProps = {
  label: string;
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
};

type ImageUploadProps = {
  label: string;
  onSelect: (file: File) => void;
  onPreviewChange?: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
};

export type { TextAreaFieldProps, ImageUploadProps, TagsComponentProps };



