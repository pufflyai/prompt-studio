# Archive all with 5,000 tickets

Updated at: 2026-11-14

The disposable PGlite fixture contains 5,000 tickets with 8,452-byte bodies;
205 active tickets belong to the selected column. The diagnostic calls the real
Planner archive action and production record service, verifies persisted selected
and unrelated tickets after each sample, and resets only the selection outside
timing. It runs three samples per case with a 60-second whole-case cap.

| Measurement | Baseline | Bounded candidate |
| --- | ---: | ---: |
| First sample | 1,208 ms | 136 ms |
| Median of 3 samples | 1,167 ms | 138 ms |
| Maximum | 1,208 ms | 1,225 ms |
| Full tickets returned to the extension | 5,205 | 0 |
| Selected field-save batches | 205 single-record saves | 3 batches, at most 100 records |
| Concurrent save requests | 205 | 1 |
| Sequential database row visits | 5,000 | 0 |

The action selects indexed metadata, patches only archive fields under the
selected revisions, and retries stale selections without overwriting other
fields. It retains one page of IDs for cleanup jobs. The host still reads and
projects selected records to persist each change; zero refers to complete bodies
returned across the extension read boundary, not zero database work.

The first sample improved 88.7%; the median improved 88.2%. One repeat sample
still took 1,225 ms. These three component samples do not establish a latency
distribution or an end-to-end responsiveness guarantee. Index installation took
1,773 ms during preparation, separately from archival. An intermediate
per-record indexed implementation regressed repeat latency to about 2.2 seconds;
that result prompted the bounded field-save batches.

The harness substitutes empty workspace/session providers, a cleanup enqueue
stub, and notification/event stubs. It measures archival persistence, excluding
real automation queue transport, linked-workspace cleanup and rendering. Shared
workspace safety has separate scale and concurrency regressions.

Run the maintained `scripts/dev/ticket-archive-diagnostic.ts` with the same
arguments as the [opening diagnostic](0009-ticket-opening.md#reproduce). Both
cases use the built matching host SDK. Do not run this against user storage.
