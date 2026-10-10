# Store session token totals at conversation save

Proposed: 2026-10-06

## Context

Extensions need token totals to build session dashboards. Usage parts live in conversation files. Reading and parsing one file per session on every refresh makes the work grow with both session count and conversation size.

## Decision

Store nullable `usage_json` on the session row. `persistSessionMessages` owns this derived value. It sums the token usage parts from the exact array it saves, on both initial saves and replacements. Missing cache fields count as zero. No usage parts means null, including an empty conversation replacement.

The value is created on a save that includes usage, replaced on every later save, and removed with the session. No other runtime writer should update it. Extensions receive the totals through the public session read API and own aggregation and display.

## Consequences

Session queries read totals without loading conversation files. This adds derived data, with one owner and a rule tied to the saved conversation. Existing sessions remain null until their next save; there is no backfill. Totals depend on the harness reporting non-overlapping usage parts. They do not include money costs or per-run history.

File storage and database writes are separate operations. If a database write fails after a file save, totals can lag until the next successful checkpoint. The checkpoint reports the error instead of reporting a successful save.
