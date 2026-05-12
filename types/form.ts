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

type ImageUploadProps = {
  label: string;
  onSelect: (file: File) => void;

  accept?: string;
  maxSizeMB?: number;
};

export type { TextAreaFieldProps , ImageUploadProps};



