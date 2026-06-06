# Issue #75: Form styles - button, preview, and wizard layout issues

## Status
✅ CLOSED

## Category
UI / Bug

## Problem Description
Multiple styling issues across the form components:

1. **Button uses viewport-relative units**: `padding: 1vh 0.75vw` caused button sizes to vary wildly across screen sizes. On mobile the button was tiny, on ultrawide it was oversized.

2. **Preview image uses vw units**: `width: 10vw; height: 10vw` doesn't scale properly inside its card container. On mobile (320px viewport) the image is only 32px; on desktop it could overflow the 640px card.

3. **Unnecessary z-index: 999**: The form wrapper had `z-index: 999` with `position: relative` for no reason, creating an unnecessary stacking context.

4. **Wizard container mismatch**: The wizard container had `max-width: 800px` while the form card had `max-width: 640px`, causing layout inconsistency between the main form page and the wizard steps.

## Solution Implemented

### Button fix
```css
/* Before */
padding: 1vh 0.75vw;

/* After */
padding: 12px 24px;
margin: 8px 0;
width: 100%;
border: none;
font-size: 14px;
```

### Preview image fix
```css
/* Before */
width: 10vw;
height: 10vw;

/* After */
width: 100%;
height: 200px;
object-fit: contain;
```

### Wrapper fix
Removed `position: relative` and `z-index: 999`.

### Wizard fix
```css
/* Before */
max-width: 800px;

/* After */
max-width: 640px;
padding: 16px;
```

## Files Modified
- `styles/forms/form.module.css` (button, previewImage, wrapper)
- `styles/forms/wizard.module.css` (container)

## Verification Checklist
- [x] Buttons have consistent size across viewports
- [x] Preview images scale correctly within card container
- [x] No unnecessary stacking context from wrapper
- [x] Wizard container width matches form card width


## Depends On
- [#54](54-FORM-ACCESSIBILITY-DEFICIENCIES.md)

## Blocks
— (none)
