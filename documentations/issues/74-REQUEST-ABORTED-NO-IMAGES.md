# Issue #74: Request aborted when characters/maps/items have no images

## Status
✅ CLOSED

## Category
Bug

## Problem Description
When submitting a game form with characters, maps, or items that have no images attached, the API call to `/api/convertUrl/ConvertGameImages` gets aborted. The error appears as:
```
0vy1ik.hyzkwg.js:1 Error: Request aborted
```

Entries with `image: ""` are sent to the server, where `Buffer.from("", 'base64')` creates an empty buffer. `sharp` then crashes during WebP conversion of the empty buffer.

## Root Cause
The form component sent all character/map/item entries to the image conversion endpoint regardless of whether they had images. Entries with no images had `image: ""` (empty string), which caused the server-side image processing pipeline to fail.

## Solution Implemented
1. Created `utilities/clientUtilities/exceptions.ts` with a `filterEntriesWithImages()` utility that filters out entries with empty image strings.
2. Updated the form component to apply this filter to characters, maps, and items before sending to the image conversion API.

```typescript
// utilities/clientUtilities/exceptions.ts
export function filterEntriesWithImages<T extends { image: string }>(entries: T[]): T[] {
  return entries.filter(entry => entry.image && entry.image.length > 0);
}
```

```typescript
// In form component, before ConvertGameImages call:
characters: filterEntriesWithImages(characters),
maps: filterEntriesWithImages(maps),
items: filterEntriesWithImages(items),
```

## Files Modified
- `utilities/clientUtilities/exceptions.ts` (new)
- `components/adventures/form/form.tsx` (import + usage)

## Verification Checklist
- [x] Submitting form with characters that have no images no longer aborts
- [x] Characters/images/maps with actual images still upload correctly
- [x] Empty entries are filtered out before API call


## Depends On
- [#70](70-WASTEFUL-DATA-URL-FETCH-ROUND-TRIP-IN-IMAGE-PIPELINE.md)

## Blocks
- [#76](76-DOCUMENTATION-AND-BUGFIXES.md)
