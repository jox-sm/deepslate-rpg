# Issue #58: Two nearly identical form hooks - code duplication

## Status
✅ CLOSED

## Category
Refactor

## Problem Description

The codebase had two nearly identical form hooks causing code duplication and maintenance burden:

1. `hooks/form.ts` - Generic form state management
2. `hooks/gameForm.ts` - Nearly identical game-specific version
3. `lib/useGamesForm.ts` - Another duplicate/re-export

### Code Example - Problem
```typescript
// Problem 1: hooks/form.ts
export function useForm(initialState: any) {
  const [formData, setFormData] = useState(initialState);
  
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSubmit = async (onSubmit: Function) => {
    return onSubmit(formData);
  };
  
  return { formData, handleChange, handleSubmit };
}

// Problem 2: hooks/gameForm.ts (nearly identical)
export function useGameForm(initialState: any) {
  const [formData, setFormData] = useState(initialState);
  
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSubmit = async (onSubmit: Function) => {
    return onSubmit(formData);
  };
  
  return { formData, handleChange, handleSubmit };
}

// Problem 3: lib/useGamesForm.ts (another duplicate)
export { useGameForm as useGamesForm } from '@/hooks/gameForm';

// Issues:
// 1. Same logic repeated 3 times
// 2. Maintenance nightmare (fix bug in one, forget others)
// 3. Inconsistent types
// 4. Confusing imports
```

## Root Cause

Parallel development without refactoring:
- Multiple developers created similar hooks
- No consolidation during code review
- No DRY (Don't Repeat Yourself) enforcement
- Import paths create re-export confusion

## Why It's Critical

1. **Duplication**: Same code in multiple places
2. **Maintenance**: Bug fixes need to happen 3 times
3. **Consistency**: Behavior might diverge
4. **Testing**: Test same logic multiple times
5. **Confusion**: Multiple imports for same thing

## Solution Implemented

**Create single, generic, reusable hook:**

```typescript
// ✅ CORRECT: hooks/useForm.ts (single source)
import { useState, useCallback } from 'react';

export interface FormState {
  [key: string]: any;
}

export interface UseFormReturn<T extends FormState> {
  formData: T;
  updateField: (field: keyof T, value: any) => void;
  updateFields: (updates: Partial<T>) => void;
  resetForm: () => void;
  setFormData: (data: T) => void;
}

export function useForm<T extends FormState>(initialState: T): UseFormReturn<T> {
  const [formData, setFormData] = useState<T>(initialState);
  
  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);
  
  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({
      ...prev,
      ...updates
    }));
  }, []);
  
  const resetForm = useCallback(() => {
    setFormData(initialState);
  }, [initialState]);
  
  return {
    formData,
    updateField,
    updateFields,
    resetForm,
    setFormData
  };
}

// ✅ CORRECT: Type-safe game form usage
interface GameFormData {
  title: string;
  description: string;
  image?: File;
  tags: string[];
  likes_count: number;
}

export function useGameForm() {
  return useForm<GameFormData>({
    title: '',
    description: '',
    image: undefined,
    tags: [],
    likes_count: 0
  });
}

// ✅ CORRECT: Clean up imports
// Remove: hooks/gameForm.ts
// Remove: lib/useGamesForm.ts
// Keep only: hooks/useForm.ts with useGameForm factory
```

## File Structure

```
Before (Duplication):
├── hooks/
│   ├── form.ts (generic hook)
│   ├── gameForm.ts (duplicate)
│   └── ...
└── lib/
    ├── useGamesForm.ts (re-export)
    └── ...

After (Single source):
├── hooks/
│   ├── useForm.ts (single hook with factories)
│   ├── useGameForm.ts (optional thin wrapper)
│   └── ...
```

## Consolidated Hook Pattern

```typescript
// hooks/useForm.ts - Single, powerful hook

export function useForm<T extends FormState>(initialState: T) {
  const [formData, setFormData] = useState<T>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isDirty, setIsDirty] = useState(false);
  
  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);
  
  const validate = useCallback((validator?: (data: T) => Partial<Record<keyof T, string>>) => {
    const newErrors = validator?.(formData) || {};
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);
  
  const resetForm = useCallback(() => {
    setFormData(initialState);
    setErrors({});
    setIsDirty(false);
  }, [initialState]);
  
  return {
    formData,
    updateField,
    updateFields: (updates: Partial<T>) => {
      setFormData(prev => ({ ...prev, ...updates }));
      setIsDirty(true);
    },
    setFormData,
    resetForm,
    errors,
    validate,
    isDirty
  };
}

// Usage
const form = useForm<GameFormData>({
  title: '',
  description: '',
  tags: []
});

// Update field
form.updateField('title', 'New Title');

// Validate
form.validate((data) => {
  if (!data.title) return { title: 'Title required' };
  return {};
});
```

## Migration Steps

```typescript
// Step 1: Update useGameForm to use unified hook
// hooks/useGameForm.ts
import { useForm, FormState } from './useForm';

interface GameFormData extends FormState {
  title: string;
  description: string;
  image?: File;
  tags: string[];
}

export function useGameForm() {
  return useForm<GameFormData>({
    title: '',
    description: '',
    tags: []
  });
}

// Step 2: Update components to use new hook
import { useGameForm } from '@/hooks/useGameForm';

function GameForm() {
  const form = useGameForm();
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.updateField('title', e.target.value);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.validate()) return;
    
    await submitGame(form.formData);
    form.resetForm();
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={form.formData.title}
        onChange={handleTitleChange}
      />
      {form.errors.title && <error>{form.errors.title}</error>}
    </form>
  );
}

// Step 3: Remove duplicates
// Delete: hooks/form.ts (old version)
// Delete: lib/useGamesForm.ts (re-export)
```

## Files Modified

- Created: `hooks/useForm.ts` - Unified form hook
- Updated: `hooks/useGameForm.ts` - Uses unified hook
- Updated: All components using form hooks
- Removed: `hooks/form.ts` (old duplicate)
- Removed: `lib/useGamesForm.ts` (duplicate export)

## Testing

```typescript
describe('useForm', () => {
  test('should initialize with default values', () => {
    const { result } = renderHook(() =>
      useForm({ title: '', count: 0 })
    );
    
    expect(result.current.formData).toEqual({ title: '', count: 0 });
  });

  test('should update field', () => {
    const { result } = renderHook(() =>
      useForm({ title: '' })
    );
    
    act(() => {
      result.current.updateField('title', 'Test');
    });
    
    expect(result.current.formData.title).toBe('Test');
  });

  test('should reset form', () => {
    const { result } = renderHook(() =>
      useForm({ title: 'initial' })
    );
    
    act(() => {
      result.current.updateField('title', 'changed');
    });
    expect(result.current.formData.title).toBe('changed');
    
    act(() => {
      result.current.resetForm();
    });
    expect(result.current.formData.title).toBe('initial');
  });

  test('should track dirty state', () => {
    const { result } = renderHook(() =>
      useForm({ title: '' })
    );
    
    expect(result.current.isDirty).toBe(false);
    
    act(() => {
      result.current.updateField('title', 'changed');
    });
    
    expect(result.current.isDirty).toBe(true);
  });
});
```

## Verification Checklist

- [x] Single form hook implementation
- [x] No code duplication
- [x] All components updated
- [x] Duplicates removed
- [x] Tests passing
- [x] Type safety maintained


## Depends On
- [#57](57-EXCESSIVE-PROP-DRILLING.md)

## Blocks
- [#54](54-FORM-ACCESSIBILITY-DEFICIENCIES.md)

## Related Issues

- #36: Two nearly identical form hooks - code duplication (duplicate)
- #13: Two nearly identical form hooks - code duplication (duplicate)
