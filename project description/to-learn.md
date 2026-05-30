# Topics to Learn

Based on the project work we've done, here are the topics you need to study to understand what we implemented.

---

## Pretest Results

| # | Topic | Status | Notes |
|---|-------|--------|-------|
| 1 | JWT | ⚠️ Partial | Good concept, missing technical structure |
| 2 | Clerk | ⚠️ Partial | Understands token rotation, needs template details |
| 3 | Supabase JWT | ⚠️ Typo | You meant RS256, not RTS256 - answer was correct |
| 4 | RLS | ❌ IDK | Keep and focus |
| 5 | Middleware | ✅ Correct | Remove |
| 6 | AbortController | ❌ IDK | Keep and focus |
| 7 | HS256 vs RS256 | ⚠️ Partial | Basic idea right, needs more detail |
| 8 | Environment vars | ⚠️ Partial | Basics right, missing NEXT_PUBLIC_ details |
| 9 | WebP | ⚠️ Partial | Too vague, needs specifics |
| 10 | Retry logic | ✅ Correct | Remove |

---

## Remaining Topics to Learn (6 topics)

### 1. JWT (JSON Web Tokens) - Structure Deep Dive
**Your answer was:** "JWT is like an identity card that shows other services: this user is authenticated"
**Correct but incomplete.** You need to learn:

- JWT has 3 parts separated by dots: `header.payload.signature`
- **Header:** Algorithm used (HS256/RS256)
- **Payload:** Claims (data about user)
  - `sub` = user ID
  - `aud` = audience (which service)
  - `exp` = expiration time
  - `iat` = issued at time
- **Signature:** Proves the token wasn't tampered with

**Practice:** Go to https://jwt.io and decode a JWT token

---

### 2. Clerk JWT Templates - How They Work
**Your answer was:** "Clerk generates jwt tokens using specific predefined schemas"
**Correct but you need to understand:**

- You CREATE templates in Clerk dashboard
- Templates have NAME (we used "supabase")
- Templates have CLAIMS (what data goes in the token)
- Shortcodes like `{{user.id}}` get replaced with real values
- You can have MULTIPLE templates for different services
- Each template can use DIFFERENT signing keys

**Practice:** Create a test JWT template in Clerk dashboard

---

### 3. Supabase JWT Validation - Shared Secrets vs Public Keys
**Your answer was:** "uses RS256 mechanism" - **You were right, just had a typo (RTS → RS)**

You correctly identified that RS256 uses public keys. Here's the full picture:

| Algorithm | How it works | Use case |
|-----------|--------------|----------|
| **HS256** | ONE shared secret (both sign & verify) | Same service handles everything |
| **RS256** | TWO keys (private signs, public verifies) | Different services sign & verify |

**For our project:** We use **HS256** because:
1. Clerk signs the JWT with your Supabase JWT secret
2. Supabase verifies with the same secret
3. Both services share the same "password"

**RS256 would be used if:**
1. You want to sign JWTs yourself (not Clerk)
2. You want public services to verify without having the secret
3. You need better security for distributed systems

**Practice:** Compare HS256 and RS256 in Clerk dashboard → JWT Templates

---

### 4. RLS (Row Level Security) - ❌ IDK
**Keep this topic.** Learn:

- RLS is PostgreSQL security (Supabase uses PostgreSQL)
- RLS policies control WHO can read/write WHICH rows
- Example: Users can only see THEIR OWN data
- Uses `auth.uid()` to get current user ID
- Uses `auth.jwt() ->> 'sub'` to get user ID from JWT

**Example policy:**
```sql
CREATE POLICY "Users can only see their own data"
ON my_table FOR SELECT
USING (user_id = auth.uid());
```

**Practice:** Create a Supabase table with RLS and test it

---

### 5. AbortController - ❌ IDK
**Keep this topic.** Learn:

- `AbortController` cancels fetch requests
- Useful when user clicks "Cancel" during upload
- Prevents wasting resources on requests you don't need

**How to use:**
```typescript
const controller = new AbortController();

fetch(url, { signal: controller.signal })
  .then(res => res.json())
  .catch(err => {
    if (err.name === 'AbortError') {
      console.log('Request cancelled');
    }
  });

// Cancel the request
controller.abort();
```

**Practice:** Create a button that cancels an ongoing fetch

---

### 6. HS256 vs RS256 - Signing Algorithms
**Your answer was:** "HS256 uses a private key between services while RS256 uses a public key"
**Close but not quite:**

| | HS256 | RS256 |
|---|-------|-------|
| **Type** | Symmetric | Asymmetric |
| **Keys** | ONE shared secret | TWO keys (public + private) |
| **Signing** | Uses secret | Uses private key |
| **Verification** | Uses SAME secret | Uses public key |
| **Speed** | Faster | Slower |
| **Use case** | Same service signs & verifies | Different services sign & verify |

**We use HS256** because Clerk signs and Supabase verifies with the SAME secret.

**Practice:** Read https://jwt.io/introduction

---

### 7. Environment Variables - NEXT_PUBLIC_ Prefix
**Your answer was:** "process.env from .env file" - **Correct but missing key detail:**

| Variable | Available In | Example |
|----------|--------------|---------|
| `NEXT_PUBLIC_*` | Client + Server | `NEXT_PUBLIC_SUPABASE_URL` |
| Regular vars | Server only | `CLERK_SECRET_KEY` |

**Why it matters:**
- `NEXT_PUBLIC_` vars are BUNDLED into client JavaScript (visible in browser)
- Regular vars are ONLY on the server (hidden from browser)
- NEVER put secrets in `NEXT_PUBLIC_` variables

**Practice:** Check your .env file and categorize each variable

---

### 8. WebP Image Format - Specific Benefits
**Your answer was:** "lower memory space" - **Too vague, learn:**

| Format | Size (same quality) | Transparency | Animation | Browser Support |
|--------|---------------------|--------------|-----------|-----------------|
| JPEG | 100% | No | No | 100% |
| PNG | 150% | Yes | No | 100% |
| WebP | **60-80%** | Yes | Yes | 97% |

**WebP benefits:**
- **25-35% smaller** than JPEG at same quality
- Supports transparency (like PNG)
- Supports animation (like GIF)
- Faster loading = better UX
- Less bandwidth = lower costs

**Practice:** Compare file sizes of same image in JPEG, PNG, WebP

---

## Topics Removed (You Got These Right)

### ~~5. Middleware~~ ✅
You answered: "because we need to make sure that only authenticated users can access certain routes"
**Correct!** No further study needed.

### ~~10. Retry Logic~~ ✅
You answered: "it retry after error because most of the time production errors are because of traffic"
**Correct!** No further study needed.

---

## Study Plan (4 Days)

### Day 1: JWT Deep Dive
- [ ] Decode a JWT at jwt.io
- [ ] Understand header, payload, signature
- [ ] Learn about claims (sub, aud, exp, iat)

### Day 2: Clerk Templates
- [ ] Create a test JWT template
- [ ] Add custom claims
- [ ] Test with different shortcodes

### Day 3: RLS + AbortController
- [ ] Create a table with RLS
- [ ] Test policies with auth.uid()
- [ ] Create a cancel button
- [ ] Cancel a fetch request

### Day 4: Review
- [ ] HS256 vs RS256
- [ ] Environment variables
- [ ] WebP format

---

## Quick Reference Card

```
JWT Structure: header.payload.signature

HS256: One shared secret (sign + verify)
RS256: Two keys (private sign, public verify)

RLS: PostgreSQL row-level security using auth.uid()

NEXT_PUBLIC_*: Visible in browser (client-side)
Regular vars: Server-only (hidden)

WebP: 25-35% smaller than JPEG, supports transparency

AbortController: Cancels fetch requests

Retry: Handles temporary failures (network, traffic)
```

---

## Questions to Answer After Studying

1. What are the 3 parts of a JWT?
1-there is header , what the fuck is the algorithm used? rs256? hs256 , whatever algorithm
2- the data itself, user.id? , is the user an admin? and whatever
3- the signature itself
all those data be like this format header.data.sign
and each part is encoded in base 64 format
2. How does Clerk's JWT template shortcode `{{user.id}}` work?
user.id means nothing there actually it's like sql sanitization technique
it's like clerk telling the script Hay there is a variable which will go in this specific place called 'user.id'
same login with printf with python
3. What is a "shared secret" in JWT validation?
it's like hs256 algorithm both service and sign use same key so it's called shared secret key
but it advanced ones like rs256 it uses a public key actually there be 2 keys public and private
so the key be the public key
4. Write a simple RLS policy that lets users see only their own data.
```sql
CREATE POLICY "Users can only see their own data"
ON my_table FOR SELECT
USING (user_id = auth.uid());
```

5. How do you cancel a fetch request using AbortController?
i can add smth like use refrence with the id of the task to the abort controller and whenever it's button is used
it triggers use state and use state triggers the function then it excutes the .then and .catch and then .abort
6. When should you use HS256 vs RS256?
HS256 is for same auth platform like you keep your data into same room
it's like clerk uses hs256 cuz it's the same platform
same to supabase for example
but rs256 is for shared secret like you keep your data into different rooms
like supabase and clerk or neon and clerk and so on
7. What's the difference between `NEXT_PUBLIC_API_KEY` and `API_KEY`?
next_public_API_KEY get sent to both server and client
client can actually see it 
but API_KEY is only sent to server and there is no script that can trigger that api key to be taken from server
except process.env ofc but i mean no script on user client....
or actually there may be some ways if you use that secret on client device but next prohebts that it won't compile
so technically no
8. How much smaller is WebP compared to JPEG?
it's smaller about 35%
9. What error does AbortController throw when cancelled?
it throws AbortError and .catch handles it simply
10. Why is retry logic important for production apps?
because simply your app is not only used by you and 3 more friends
there are much more error types than syntax errors and logical erros
there are networks errors packets errors and many more errors
so it's important to handle those errors properly
somme errors happen without your control like traffic load
