type ValidationResult = {
  isFormValid: boolean;
  errorMessage: string;
  errorColor: "success" | "error" | "warning";
  trueLength: number;
};

type ValidationOptions = {
  minLength: number;
  maxLength: number;
  fieldName?: string;
};

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)\b)/i,
  /(--|;|@@|@@@)/,
  /('|"|`|;)/,
  /\b(OR|AND)\s+\d+\s*=\s*\d+/i,
  /\b(OR|AND)\s+['"].*['"]\s*=\s*['"]/i,
  /\b(WAITFOR|DELAY)\b/i,
  /INTO\s+(OUTFILE|DUMPFILE)/i,
];

const WEIRD_CHARACTER_PATTERNS = [
  /[.]{2,}/,
  /[#${}]/,
  /[@]{2,}/,
  /[\\\/]{2,}/,
  /[|]{2,}/,
  /^[./#@\\]+$/,
  /(.)\1{4,}/,
];

export function validateText(
  text: string,
  options: ValidationOptions
): ValidationResult {
  const { minLength, maxLength, fieldName = "field" } = options;
  const trimmedLength = text.trim().length;
  const trueLength = text.replace(/\s/g, "").length;

  if (text.length === 0) {
    return {
      isFormValid: false,
      errorMessage: `${fieldName} is required`,
      errorColor: "warning",
      trueLength,
    };
  }

  if (/^\s+$/.test(text)) {
    return {
      isFormValid: false,
      errorMessage: `${fieldName} cannot contain whitespace only`,
      errorColor: "warning",
      trueLength,
    };
  }

  if (trimmedLength < minLength) {
    return {
      isFormValid: false,
      errorMessage: `${fieldName} is too short (minimum ${minLength} characters)`,
      errorColor: "warning",
      trueLength,
    };
  }

  if (trimmedLength > maxLength) {
    return {
      isFormValid: false,
      errorMessage: `${fieldName} exceeds maximum length (${maxLength} characters)`,
      errorColor: "error",
      trueLength,
    };
  }

  for (const pattern of WEIRD_CHARACTER_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isFormValid: false,
        errorMessage: `${fieldName} contains invalid characters`,
        errorColor: "error",
        trueLength,
      };
    }
  }

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isFormValid: false,
        errorMessage: `${fieldName} contains potentially unsafe content`,
        errorColor: "error",
        trueLength,
      };
    }
  }

  return {
    isFormValid: true,
    errorMessage: "OK",
    errorColor: "success",
    trueLength,
  };
}
