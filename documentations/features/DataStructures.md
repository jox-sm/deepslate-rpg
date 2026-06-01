# Data Structures

**Status: FUTURE UPDATE — not implemented.**

Initial research into V8 `Map` overhead was misleading. After further investigation, V8's built-in `Map` adds approximately **2.5% overhead** for JSON-object payloads like our use case. This is negligible.

The custom `CompactMap` design (parallel flat arrays, Uint8Array state encoding, FNV-1a + prime modulo, linear probing, tombstone recycling) was explored as a potential optimization but is **not needed at current scale**.

## Decision

- **Current**: Use standard JavaScript `Map` for all hashmap needs (`dataMap`, `viewsMap`, `hotnessMap`).
- **Future**: If profiling reveals `Map` as a bottleneck at higher traffic scales (>100k entries or memory pressure), revisit the `CompactMap` implementation documented below.

---

## Archived Design: CompactMap (Parallel Flat Arrays)

Kept for reference if the optimization is needed later.

### Memory Topology

Three parallel flat arrays replace V8's per-entry object overhead:

1. `keys: Array<string | null>` — UUID strings
2. `values: Array<V>` — Values (avoids number-boxing)
3. `states: Uint8Array` — 1 byte per slot: 0=EMPTY, 1=OCCUPIED, 2=TOMBSTONE

### Hash Strategy

FNV-1a with `Math.imul` + `% primeCapacity` — uses full 32-bit hash distribution, not just lower bits like power-of-2 bitmask.

```typescript
function getFnv1aIndex(key: string, capacity: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % capacity;
}
```

### Prime Table Sizes

```typescript
const PRIME_SIZES = [
  101, 211, 431, 863, 1733, 3467, 6949, 13901, 27803, 55609,
  111227, 222461, 444929, 889871, 1779751, 3559507, 7119019,
  14238061, 28476139, 56952299, 113904637
];
```

### Implementation Sketch

```typescript
export class CompactMap<V> {
  private keys!: Array<string | null>;
  private values!: Array<V>;
  private states!: Uint8Array;
  private _size: number;
  private _capacity: number;
  private _threshold: number;
  private readonly _loadFactor = 0.7;

  constructor(initialCapacity = 101) { /* ... */ }

  get(key: string): V | undefined {
    // Linear probe: stop at EMPTY (0), match at OCCUPIED (1) + key equality, skip TOMBSTONE (2)
  }

  set(key: string, value: V): this {
    // If size >= threshold, _grow()
    // Linear probe: recycle first TOMBSTONE if found, overwrite OCCUPIED match, insert at EMPTY
  }

  delete(key: string): boolean {
    // Linear probe: set state to TOMBSTONE (2), free key/value refs for GC
  }

  private _grow(): void {
    // nextPrime(capacity * 2), allocate fresh arrays
    // Rehash only OCCUPIED entries — tombstones purged entirely
    // Amortized O(1)
  }
}
```

### When to Revisit

- Memory profiling shows `Map` using >5% of total heap
- Cache grows beyond 10,000 entries
- GC pause times from Map entry churn become measurable
