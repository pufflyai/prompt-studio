# Storage scale diagnostic (draft)

PS-903 freezes the PS-902 workloads before storage optimization. This implementation
is unfinished. It is a diagnostic command, not a required release check or evidence
that the release contract passes. Product storage behavior and existing budgets are
unchanged.

## Frozen fixture

`packages/storage-scale-fixture` owns the deterministic generator, workload constants,
scenario matrix and evidence checks. The fixture version is `ps903-v1`.

- Rich: ten owners with 10,000 live records each. Owner 9 is Planner. Every record
  has nested values, tags, multiline content and three edits after creation. Every
  twentieth record has at least 16 KiB of serialized JSON; other records have at
  least 2 KiB. Actual sizes and hashes are recorded per owner.
- Small: owner 0 has 100,000 database-style records. Nine other owners, including
  Planner, have 100 records each. Small records have short strings, numbers,
  booleans, nullable references and timestamps. Every tenth record has tags and
  nested details. The generator has no padded body for small records.
- Creation and three edit rounds use groups of 100 through the public records API.
  Planner uses its public collection API, whose individual writes are not atomic
  groups. Do not report Planner seeding as a 100-record atomic commit.
- Churn is a separate variant with distinct IDs, the same create/edit history,
  then deletion. It preserves the live fixture.
- The focus filter selects 100 records distributed across each owner. A larger
  filter selects more than 100, with distinct sorted pages. Sort ties use record ID.

Generate the complete final live values and manifest:

```sh
bun run --cwd packages/e2e perf:storage-scale -- --fixture rich --output /path/to/evidence/rich --emit-fixture
bun run --cwd packages/e2e perf:storage-scale -- --fixture small --output /path/to/evidence/small --emit-fixture
```

Each output includes ten JSONL files with every live record, their SHA-256 hashes,
byte distributions, history/churn rules and the complete required scenario matrix.
Compressing these files preserves the full workload; decompress before inspecting
their hashes. The generator and seed source reconstruct all four history rounds.

## Current runnable measurements

```sh
bun run --cwd packages/e2e perf:storage-scale -- --help
bun run --cwd packages/e2e perf:storage-scale -- --fixture rich --output /path/to/evidence/sync --layer sync --rows 10000
bun run --cwd packages/e2e perf:storage-scale -- --fixture small --output /path/to/evidence/db --layer database --rows 100000
```

The layer commands use one owner at a time. They are scaling diagnostics, **not**
the complete ten-owner workload or browser acceptance. Frozen scaling sizes are
1,000 and 10,000 rich records, and 1,000, 10,000 and 100,000 small records.

The sync benchmark records encoding, decoding, cloning, no-op comparison, incoming
diff/application, single-edit application and full reads. The database benchmark
uses its own disposable PGlite directory. It seeds outside timers, runs first
writes in fresh processes, records warm durable writes, a separate atomic
100-record commit, and crosses the persisted fold boundary. Never point it at an
existing application database. An interrupted seed must be discarded and recreated.

Layer output includes duration, process CPU, event-loop delay, memory and phase
work. Unknown lock, index, notification or queue metrics are reported as missing.
The SDK/browser draft can seed a disposable compiled runtime with ten enabled
owners, issue concurrent public-API reads and make a direct first write after
restart. The browser uses a fresh context and includes normal login redemption in
its first navigation timer. Runtime readiness is reported separately. The draft
only records first-visible content; it explicitly fails complete-page readiness.

The current consumer uses `records.list()` and reports all rows it materializes.
This is the baseline failure being exposed. A fast local filter cannot pass the
bounded-read assertion. The additive query contract will need an adapter after
PS-904; do not silently truncate or reinterpret the existing list API.

## Required completion work

The scenario contract requires ten cold and ten warm samples for every operation,
background variant and CPU profile. Every foreground sample must be strictly below
1,000 ms. Unknown work, missing samples, duplicate samples and hidden full loads
cannot pass. The 100-record atomic operation has separate reporting.

Still unfinished:

- Full board/list readiness, stable pages, indexed aggregates and selected-field
  correctness; the current draft must not equate first content with readiness.
- The complete durable-edit operation matrix, UI submission boundaries,
  kill/restart and retry checks, offline merge delivery orders and deletion cases.
- Integrated active incoming sync, no-op sync, folding, other-owner catch-up,
  fairness and fixed incoming-load queue-drain measurements.
- Aggregate 0.5-CPU runtime control, effective-limit verification and independent
  calibration. CDP 4x page throttling exists in the draft, but worker/iframe
  coverage is unverified. Runtime and combined profiles currently fail as missing
  coverage, rather than running unconstrained and claiming success.
- Native macOS, Windows and Linux evidence, supported constrained profiles,
  complete machine/power metadata and any lower-spec physical-machine evidence.
- Complete raw samples and p50/p95/max summaries, adversarial review and PR/CI.

## Blocked validation on 2026-10-22

The first rich-owner diagnostic observed approximately 32,357 ms for a full encode
of 50,833,358 bytes. A no-op comparison took approximately 42,532 ms. These are
partial baseline observations, not complete or isolated release evidence. Later
samples overlapped fixture seeding and must not be used as controlled comparisons.
The event-loop monitor was corrected after this run; the original samples do not
establish event-loop delay. No complete set of ten samples was collected.

Host free space fell from about 4 GiB to 125 MiB. `bun run dev:playwright` failed
because Docker's container metadata filesystem was read-only. Heavy processes were
stopped. Full generated live fixtures were compressed without reducing records.
The draft and logs are preserved in change request RP-1154. Planner human request
`d21596dc-b2b2-47ee-8b43-7b087bbeabd2` asks for writable Docker storage and enough
disk space, or an isolated runner. Continue in the same PS-903 attempt after the
environment is restored; do not treat the request's answer as completed validation.

The [existing Planner cold-open contract](0002-planner-board-cold-open.md) remains
separate and unchanged.
