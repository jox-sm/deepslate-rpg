# Issue #96: `db/migrate.ts` cannot be executed

## Status
🔄 OPEN

## Category
Tooling, Developer Experience

## Problem Description

`db/migrate.ts` is the Neon/PostgreSQL schema migrator. It reads `db/schema.sql`, splits it into statements and applies each one to the database:

```typescript
const schema = fs.readFileSync(schemaPath, 'utf-8');
const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
for (const statement of statements) {
  await sql.query(statement);
}
```

`db/schema.sql` currently defines one table and two indexes:

```sql
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  description TEXT,
  image TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_tags ON games USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_games_name ON games USING GIN (name);
```

**The script cannot be run.** Attempting it fails immediately:

```
$ node --env-file=.env db/migrate.ts
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/utilities' imported from db/migrate.ts
```

That means the schema can only be changed by hand-editing SQL against the Neon console. Adding a table or a column requires remembering to run it by hand, and there is no record of whether the applied schema matches `db/schema.sql`.

Nothing in the repository references the script either — there is no npm script, no documentation and no code path that calls it, so it rotted unnoticed.

## Root Cause

Four independent problems, each of which alone is enough to break it:

### 1. The `@/` path alias does not resolve outside the bundler

```typescript
import { classifyError } from '@/utilities/errorHandler';
```

`"@/*": ["./*"]` is declared in `tsconfig.json` and is resolved by **Next.js/Turbopack** and **Vitest**. Node's native TypeScript support (type stripping, no bundler) does **not** read `tsconfig.json` path mappings, so the alias is unresolvable from a plain `node` invocation.

The import is also only needed in the `catch` block, so the whole script is unrunnable because of one error-message helper.

### 2. `dotenv` is not a declared dependency

```
dotenv in package.json : False
dotenv in node_modules  : True     <- present only as a transitive dependency
```

The import resolves today purely by accident. If the package that pulls `dotenv` in changes or drops it, the script breaks with a confusing module error. It is also redundant — Node's built-in `--env-file` does the same job with zero dependencies.

### 3. `ts-node` is not installed

The natural invocation `npx ts-node db/migrate.ts` would download `ts-node` on demand on every run. `ts-node` is deprecated in favour of native type stripping (`node file.ts`) or `tsx`.

### 4. Nothing references the script

There is no `package.json` script, no entry in `documentations/`, and no import from anywhere in `app/`, `lib/`, `utilities/` or `hooks/`. The only mentions in the repository are inside `graphify-out/`, which merely indexes files.

## Impact

| Area | Effect |
|------|--------|
| Schema changes | Must be applied by hand in the Neon console — error-prone and undocumented |
| Drift | `db/schema.sql` and the live database can diverge with nobody noticing |
| Onboarding | A new contributor cannot discover that a migrator exists |
| CI / deploy | No automated step can apply the schema |

## Proposed Solution

Convert the script to the same shape as the other database tooling already in the repo (`db/backfill-mongo.mjs`, `db/reset-data.mjs`):

**1. `db/migrate.mjs` instead of `db/migrate.ts`**

- Use `node --env-file=.env --env-file=.env.local` instead of `dotenv` — removes the undeclared dependency entirely.
- Drop the `@/utilities/errorHandler` import. The script only needs the raw error; it is not a user-facing path. If the themed message is wanted, the error can be formatted inline.
- Reuse the existing `db/client.ts` Neon client instead of creating a second `neon()` instance. `db/client.ts` already exports `sql` and already guards on a missing `DATABASE_URL`.

**2. Run it inside a single transaction**

The current implementation executes each statement separately and is not transactional. A statement that fails halfway through leaves the database partially migrated. Wrapping the whole run in one transaction means a bad statement rolls everything back.

Note: `db/client.ts` exposes a bare `sql` template tag, so transaction support needs either a dedicated client (`neon()` accepts a `Pool`/`Client` for transactions) or a small extension to `db/client.ts`.

**3. Safer statement splitting**

Splitting on `;` works only because no current statement contains a semicolon inside a string or a dollar-quoted block. A `DEFAULT 'a;b'` or a `DO $$ ... $$` block would be split at the wrong place and produce a mid-script syntax error. A small tokenizer that understands single quotes, dollar quotes and comments removes that fragility.

**4. Make it discoverable**

Add an npm script so it is listed in `package.json` and in any README:

```json
"migrate:db": "node --env-file=.env --env-file=.env.local db/migrate.mjs"
```

Optionally add a `--dry-run` flag that prints the statements without executing them, matching `db/reset-data.mjs`.

## Files to Modify

| File | Change |
|------|--------|
| `db/migrate.mjs` | New file — transactional, no `dotenv`, no `@/` alias import |
| `db/migrate.ts` | Delete (superseded) |
| `db/client.ts` | Possibly export a transaction-capable client |
| `package.json` | Add `"migrate:db"` script |
| `README.md` | Document the schema workflow |

## Tasks

- [ ] Create `db/migrate.mjs` using `--env-file` instead of `dotenv`
- [ ] Remove the `@/utilities/errorHandler` import (use the raw error)
- [ ] Reuse `db/client.ts` instead of creating a second Neon client
- [ ] Wrap the run in a single transaction
- [ ] Replace `split(';')` with a quote-aware statement splitter
- [ ] Add `"migrate:db"` to `package.json`
- [ ] Add a `--dry-run` flag
- [ ] Delete `db/migrate.ts`
- [ ] Document the workflow in `README.md`
- [ ] Verify against a scratch database: create, alter, add index, and a deliberate failure that rolls back

## Verification Checklist

- [ ] `npm run migrate:db` runs without error
- [ ] `grep -r "dotenv" db/` returns no results
- [ ] `grep -r "@/" db/` returns no results
- [ ] A failed statement leaves the schema unchanged (transaction rollback)
- [ ] A statement containing `;` inside a string is handled correctly
- [ ] `npm run migrate:db -- --dry-run` prints statements without applying them
- [ ] `db/schema.sql` and the live database agree afterwards

## Depends On
— (none)

## Blocks
— (none)

## Related Issues

- #87: Duplicate of #78 (DB retry mechanism) — `db/migrate.ts` uses `sql.query` directly rather than the shared `retry()` helper in `lib/retry.ts`
- #76: Documentation and bugfixes — a documented schema workflow belongs with the other DX fixes
