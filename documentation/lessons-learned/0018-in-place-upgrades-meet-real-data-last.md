# Exercise realistic data sizes before rewriting storage

## 1. When to use

- Changing storage formats, imports, bulk writes, or startup data preparation.

## 2. Failure

- Small, clean fixtures passed while a 1.9 GB home failed an engine transfer on orphaned foreign keys.
- A later rewrite processed 78 MB of records in row-count batches. Encoding expanded the payload, exhausted PGlite's heap, and made error formatting fail too.
- Startup retries repeated the expensive failures and kept the app unavailable.

## 3. Prevention

- Follow the current baseline/export policy rather than adding in-place startup rewrites.
- Exercise large, representative data and imperfect histories on a copy taken while the app is stopped.
- Batch by encoded bytes, including encoding overhead and individual oversized records; row count is insufficient.
- Do not assume historical data satisfies every current constraint.
- Preserve original data on failure. Stop repeated startup attempts and report the root cause clearly.
- Log concise errors and cause chains instead of full query payloads that can exhaust memory or hide the error.

## 4. Evidence

- [Database upgrade policy](../references/architecture/0025-database-upgrades.md)
- [Baseline decision](../adrs/0103-database-baseline-replaces-in-place-upgrades.md)
- [Byte-based batching](../../packages/pstdio-db/src/services/extension-storage/json-batches.ts)
