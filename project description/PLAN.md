# Plan for Fixing Supabase Image Storage Issues

## Overview
This plan addresses the Supabase image storage issues identified in the codebase analysis and documented in `project description/New folder/problems.md`. It incorporates the user's request to leverage Convex auth JWT, Neon authentication, and MongoDB where appropriate, while adding retry mechanisms to Supabase operations.

## Issues to Fix

### 1. No Retry Mechanism on Supabase Operations
**Location:** `lib/storage.ts:15`
**Current Code:** 
```typescript
if (error) throw error;
```
**Fix:** Implement retry logic using existing `lib/retry.ts` pattern, similar to how database and Redis operations are handled.

### 2. Batch Upload Has No Error Isolation
**Location:** `utilities/insertGameImages.ts:5-30`
**Current Code:** Uses `Promise.all` which fails entirely on any single rejection.
**Fix:** Use individual error handling for each upload type (characters, maps, items) so failures in one category don't block others.

### 3. Missing Image Error Handling in UI
**Location:** `components/adventures/cards/cards.tsx:22-26`
**Current Code:** No error handling on `<img>` elements.
**Fix:** Add `onError` handler with fallback image and optional retry logic.

### 4. Supabase Client Created with Non-null Assertions
**Location:** `lib/supabase.ts:10-14`
**Current Code:** Uses non-null assertions that can fail silently.
**Fix:** Add proper validation and error handling for missing environment variables.

### 5. Supabase Auth Code Is Dead/Unused
**Location:** `lib/middleware.ts`, `lib/server.ts`, `lib/client.ts`
**Current Code:** Supabase auth middleware exists but is unused.
**Fix:** Remove dead code or repurpose for secure storage access patterns.

### 6. Image Upload Pipeline Uses Inefficient Data URL Conversion
**Location:** `utilities/insertGameImages.ts:40-44`
**Current Code:** base64 data URL → fetch() → arrayBuffer() → Buffer
**Fix:** Accept binary data directly when possible, or optimize the conversion pipeline.

### 7. Public URL Generation Doesn't Verify Bucket Access
**Location:** Conceptual issue with `getPublicUrl()` usage
**Current Code:** Assumes bucket is public without verification.
**Fix:** Add configuration check and consider signed URLs for private buckets when appropriate.

### 8. No Image Upload Progress or Cancellation Support
**Location:** Multiple files in upload pipeline
**Current Code:** No progress feedback or cancellation.
**Fix:** Implement upload progress tracking and abort controller support.

### 9. No CDN Cache Control on Uploaded Images
**Location:** `lib/storage.ts:10-13`
**Current Code:** Uses default cache control headers.
**Fix:** Add configurable cache control options for performance tuning.

### 10. Supabase Storage Bucket Name Hardcoded
**Location:** Multiple files
**Current Code:** Hardcoded `'deepslate-rpg'` string.
**Fix:** Move to configuration/environment variables.

## Security Enhancement Plan: Convex Auth JWT Approach

### Rationale
Instead of using Supabase's publishable (anon) key directly in the frontend, we can:
1. Use Convex authentication to generate JWTs
2. Use those JWTs to obtain scoped Supabase storage tokens
3. This provides better security and auditability
4. Leverages the existing Convex setup in the project

### Implementation Steps

#### Step 1: Enhance Convex Auth Configuration
- Ensure Convex is properly configured with authentication providers
- Add Supabase storage access rules to Convex auth functions if needed

#### Step 2: Create Secure Supabase Token Service
Create a new service that:
1. Accepts a Convex JWT (or uses server-side auth)
2. Exchanges it for a Supabase storage token with limited scope/permissions
3. Returns a Supabase client configured with the token

#### Step 3: Update Storage Layer
Modify `lib/storage.ts` to:
1. Accept an optional Supabase client (for server-side use with JWTs)
2. Fall back to the current anon key approach for backward compatibility
3. Use the JWT-based approach in secure contexts

#### Step 4: Update API Routes
Update API routes to:
1. Use server-side Convex auth when available
2. Pass authenticated Supabase client to storage functions
3. Handle token refresh/expiration gracefully

### Alternative Approaches Considered

#### Option A: Direct Convex Storage Migration
- Migrate image storage entirely to Convex
- Pros: Single backend, consistent auth, real-time capabilities
- Cons: Higher cost for blob storage, migration complexity

#### Option B: Neon/PostgreSQL for Image Metadata Only
- Keep images in Supabase but store metadata/access controls in Neon
- Pros: Leverages existing relational strengths
- Cons: Doesn't solve the core anon key security issue

#### Option C: MongoDB GridFS for Images
- Store images in MongoDB using GridFS
- Pros: Unified database layer, existing MongoDB setup
- Cons: Less efficient for binary blobs, loses CDN benefits

**Chosen Approach:** Enhance current Supabase usage with Convex JWT authentication because:
1. Preserves existing CDN benefits and cost structure
2. Leverages work already done on Convex setup
3. Provides migration path to more secure patterns
4. Maintains compatibility with existing image processing pipeline

## Detailed Implementation Plan

### Phase 1: Immediate Fixes (No Auth Changes)
1. Add retry mechanism to `lib/storage.ts`
2. Fix batch upload error isolation in `utilities/insertGameImages.ts`
3. Add image error handling to `components/adventures/cards/cards.tsx`
4. Fix non-null assertion issue in `lib/supabase.ts`
5. Remove or comment out dead Supabase auth code
6. Make bucket name configurable via environment variable
7. Add cache control configuration to uploads
8. Add basic progress/cancellation support (foundation for later enhancement)

### Phase 2: Security Enhancement (Convex JWT Integration)
1. Verify/improve Convex auth configuration
2. Create Supabase token service that uses Convex JWTs
3. Update storage layer to accept optional authenticated client
4. Modify API routes to use server-side Convex auth when available
5. Add configuration flags to toggle between auth methods

### Phase 3: Optimization and Polish
1. Optimize image conversion pipeline if needed
2. Add upload progress UI components
3. Implement sophisticated retry policies (exponential backoff)
4. Add upload cancellation support to UI
5. Add comprehensive logging and metrics

## File-by-File Changes

### lib/storage.ts
- Add retry logic using `retry` function from `lib/retry.ts`
- Make bucket name configurable via environment variable
- Add cache control options to upload calls
- Accept optional pre-configured Supabase client (for JWT-based auth)
- Improve error handling and logging

### lib/supabase.ts
- Replace non-null assertions with proper validation
- Log clear error messages for missing configuration
- Consider creating client lazily (on first use) to avoid build-time issues
- Add function to create client with custom token (for JWT approach)

### utilities/insertGameImages.ts
- Replace `Promise.all` with individual error handling
- Add logging for individual upload successes/failures
- Consider optimizing data URL → Buffer conversion
- Add retry logic for individual uploads using existing retry utility

### components/adventures/cards/cards.tsx
- Add `onError` handler to `<img>` element
- Implement fallback to default image
- Consider adding retry-on-error functionality (limited attempts)
- Add optional loading state placeholder

### app/api/convertUrl/route.ts
- Add retry logic for upload operation
- Improve error responses with more detail
- Consider adding basic progress tracking (if feasible in API route)

### app/api/convertUrl/ConvertGameImages/route.ts
- Improve error isolation between different upload types
- Add better error reporting per upload category
- Consider parallelizing with individual error handling

### Configuration Updates
- Add `NEXT_PUBLIC_SUPABASE_BUCKET_NAME` environment variable
- Add `SUPABASE_CACHE_CONTROL` or similar for tuning CDN behavior
- Document all new configuration requirements

## Testing Strategy

### Unit Tests
- Test retry logic with mocked failures
- Test error isolation in batch uploads
- Test environment variable validation
- Test fallback image handling

### Integration Tests
- Test full upload flow with mocked Supabase
- Test UI error handling with broken images
- Test configuration loading from environment variables

### Manual Testing
- Verify images still display correctly after changes
- Test error cases (network failure, invalid files, etc.)
- Verify fallback images appear when expected
- Check that uploads succeed with retry logic on flaky connections

## Rollback Plan
Since these are primarily additive improvements:
1. All changes are backward compatible (except removal of truly dead code)
2. Environment variables have defaults or clear error messages
3. Retry logic can be tuned or disabled via configuration if needed
4. UI improvements are strictly additive (better error handling)

## Estimated Effort
- Phase 1 (Immediate Fixes): 2-3 days
- Phase 2 (Security Enhancement): 3-5 days  
- Phase 3 (Optimization): 2-3 days
- Total: 1-2 weeks depending on complexity and testing requirements

## Open Questions
1. Should we keep both anon-key and JWT-based approaches concurrently?
2. How should we handle token expiration in long-running processes?
3. What level of upload progress detail is useful/feasible?
4. Should we add image metadata tracking (dimensions, file size, etc.) to database records?
5. How do we handle existing images uploaded with the old system during transition?

These questions can be addressed during implementation or in follow-up iterations.