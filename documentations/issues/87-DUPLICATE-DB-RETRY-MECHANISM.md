# Issue #87: Missing retry mechanism on DB functions — cold start failures in cache warm-up

## Status
✅ CLOSED (Duplicate of #78)

## Category
Bug, Performance, Reliability

## Note
This issue is a **duplicate** of **Issue #78** ([Missing retry mechanism on DB functions](./78-DB-RETRY-MECHANISM.md)).

Both issues describe the same problem: DB functions lacking retry logic for Neon PostgreSQL cold start failures, specifically affecting the `warmUpCache()` path where `cacheInitialized` is set to `true` even when warm-up fails, permanently preventing cache population.

See `documentations/issues/78-DB-RETRY-MECHANISM.md` for full documentation of the problem and solution.

## Related Issues
- #78: Original issue with full solution documentation
- #67: N+1 Redis query in games API
