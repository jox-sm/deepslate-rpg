# Issue #68: Double-read request body in /api/convertUrl

## Status
✅ CLOSED

## Category
Bug

## Problem Description

The `/api/convertUrl` endpoint attempted to read the request body twice:

1. First call to `req.json()` - consumes the stream
2. Second call to `req.blob()` - fails because stream already consumed

In Node.js, request bodies are streams that can only be read once.

### Code Example
```javascript
// Problem code
export async function POST(req: Request) {
  // First read - consumes the stream
  const data = await req.json();
  
  // Second read - fails! Stream already consumed
  const blob = await req.blob(); // Returns empty
  
  const buffer = await blob.arrayBuffer();
  // ...
}
```

## Root Cause

Misunderstanding of Node.js streams:
- Request body is a readable stream
- Once consumed, stream position is at EOF
- Cannot seek back or re-read
- Second read returns empty data

## Why It's Critical

1. **API fails silently**: No error thrown, just empty data
2. **Data loss**: Blob is always empty
3. **Video processing fails**: URL conversion fails for video data
4. **Hard to debug**: Appears to work but returns nothing

## Solution Implemented

**Read stream only once, store for multiple uses:**

```javascript
export async function POST(req: Request) {
  // Option 1: Use req.json() if JSON is expected
  const data = await req.json();
  const { url } = data;
  
  // Process the URL
  const converted = convertYoutubeUrl(url);
  
  return Response.json({ converted });
}

// Option 2: If both JSON and binary needed, read once and parse
export async function POST(req: Request) {
  const buffer = await req.arrayBuffer();
  const text = new TextDecoder().decode(buffer);
  
  // Parse as JSON
  const data = JSON.parse(text);
  
  // Can also access raw buffer if needed
  console.log('Buffer:', buffer);
  
  return Response.json({ success: true });
}

// Option 3: Clone the request if multiple reads needed
export async function POST(req: Request) {
  const req1 = req.clone();
  const req2 = req.clone();
  
  const json = await req1.json();
  const blob = await req2.blob();
  
  // Both work now
}
```

## Best Practice

```javascript
// ✅ CORRECT - Single read, multiple uses
export async function POST(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = await req.json();
    const { url } = data;

    if (!url) {
      return Response.json({ error: 'URL required' }, { status: 400 });
    }

    // Process URL
    const converted = processUrl(url);

    return Response.json({ url: converted, success: true });
  } catch (error) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

## Files Modified

- `app/api/convertUrl/route.ts` - Fixed double-read issue
- `app/api/upload/route.ts` - Applied same pattern
- `lib/requestHelpers.ts` - New helpers for safe request handling

## Refactoring Pattern

```typescript
// Helper function to safely handle request body
export async function parseRequestBody<T>(req: Request): Promise<T> {
  try {
    return await req.json();
  } catch (error) {
    throw new Error('Failed to parse request body: ' + error.message);
  }
}

// Usage in route
const data = await parseRequestBody<ConvertUrlRequest>(req);
```

## Testing

```typescript
describe('POST /api/convertUrl', () => {
  test('should convert YouTube URL correctly', async () => {
    const response = await fetch('/api/convertUrl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtube.com/watch?v=123' })
    });

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.url).toContain('embed');
  });

  test('should handle malformed requests gracefully', async () => {
    const response = await fetch('/api/convertUrl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
  });
});
```

## Verification Checklist

- [x] Request body read only once
- [x] URL conversion working correctly
- [x] Error handling for missing URL
- [x] Error handling for malformed JSON
- [x] No silent failures

## Related Issues

- #70: Wasteful data URL fetch round-trip (similar streaming issue)
- #67: N+1 Redis queries (performance related)
