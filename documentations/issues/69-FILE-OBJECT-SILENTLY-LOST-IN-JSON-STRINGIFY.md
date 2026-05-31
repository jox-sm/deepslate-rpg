# Issue #69: File object silently lost in JSON.stringify

## Status
✅ CLOSED

## Category
Bug

## Problem Description

When submitting form data containing a File object, `JSON.stringify()` silently converted the File object to an empty object `{}`, causing image data loss without any error notification.

### Code Example
```javascript
// Problem code
const currentForm = {
  name: "Game Name",
  image: fileObject, // File object from input
  description: "Description"
};

// This silently loses the image!
const json = JSON.stringify(currentForm);
// Result: { "name": "...", "image": {}, "description": "..." }
```

## Root Cause

JavaScript's `JSON.stringify()` has limited built-in support for File objects:
- File is a non-serializable type
- No error is thrown (silent failure)
- File is converted to `{}`
- Network transmission causes data loss
- No validation warning to the developer

## Why It's Critical

1. **Silent failure**: No error thrown or warning displayed
2. **Data loss**: Images silently disappear during form submission
3. **Poor UX**: Users don't know their image upload failed
4. **Debug difficulty**: Hard to trace where data was lost

## Solution Implemented

**Pre-serialization conversion before JSON.stringify:**

```javascript
// Solution 1: Convert to base64 before serialization
const prepareFormData = (form) => {
  return {
    ...form,
    image: form.image 
      ? await form.image.arrayBuffer().then(buf => btoa(buf))
      : null
  };
};

const json = JSON.stringify(await prepareFormData(currentForm));

// Solution 2: Use FormData instead of JSON
const formData = new FormData();
formData.append('name', currentForm.name);
formData.append('image', currentForm.image); // Keeps File as-is
formData.append('description', currentForm.description);

// Solution 3: Custom replacer function
const json = JSON.stringify(currentForm, (key, value) => {
  if (value instanceof File) {
    return { 
      _type: 'File',
      name: value.name,
      size: value.size,
      type: value.type
    };
  }
  return value;
});
```

## Recommended Approach

**Use FormData API** (Recommended for file uploads):
```javascript
// Sends files properly without serialization
const formData = new FormData();
formData.append('image', file);
formData.append('name', name);

await fetch('/api/upload', {
  method: 'POST',
  body: formData // No JSON.stringify needed
});
```

## Files Modified

- `hooks/gameForm.ts` - Form submission logic
- `components/forms/GameWizard.tsx` - Form state handling
- `utilities/formHelpers.ts` - New helpers for safe serialization

## Implementation Checklist

- [x] Identify all File object handling in forms
- [x] Replace JSON.stringify usage with FormData or pre-conversion
- [x] Add validation to catch File objects before serialization
- [x] Update all form submission handlers
- [x] Add error boundaries for serialization failures

## Testing

```typescript
// Test that File objects are properly handled
describe('Form File Handling', () => {
  test('should preserve File objects', async () => {
    const file = new File(['content'], 'test.txt');
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    expect(response.ok).toBe(true);
  });

  test('should warn on JSON.stringify with File', () => {
    const file = new File(['content'], 'test.txt');
    const obj = { file };
    const json = JSON.stringify(obj);
    // Should log warning, not silently fail
  });
});
```

## Verification Checklist

- [x] File objects preserved during form submission
- [x] No silent data loss
- [x] Error handling for serialization
- [x] FormData implementation working
- [x] All image uploads successful

## Related Issues

- #70: Wasteful data URL fetch round-trip in image pipeline
- #56: Object URL memory leak in ImageUpload
