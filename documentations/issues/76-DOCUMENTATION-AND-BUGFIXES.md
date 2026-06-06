# Issue #76: Documentation updates and bug fixes

## Status
✅ CLOSED (PR)

## Category
Build / Bugfix

## Description
Pull request that consolidated documentation for issues #74 and #75, added the `utilities/clientUtilities/exceptions.ts` utility, renamed `useAuth` import to `useClerkAuth` to resolve naming conflict, fixed Zod validation for the adventure form, and fixed client/server utility separation by creating `utilities/clientUtilities/` for client-only functions.

## Files Modified
- `utilities/clientUtilities/exceptions.ts` (new)
- `utilities/clientUtilities/imagesUtils.ts` (new)
- `components/adventures/form/form.tsx` (refactored imports)
- Various documentation files


## Depends On
- [#74](74-REQUEST-ABORTED-NO-IMAGES.md)

## Blocks
— (none)

## Related Issues
- #74: Request aborted when no images
- #75: Form styles - button, preview, wizard layout
