# Storage scale diagnostic

PS-903 freezes the PS-902 release workloads before storage optimization. Run this
explicit diagnostic to collect a failing baseline. It is not a required CI check
and does not change product storage. The user authorized
the lower external case execution cap below, then excluded fixture setup from
benchmark work on 2026-10-23. PS-909 owns the later release gate. A performance failure is useful
baseline evidence; missing or unproved coverage remains a failure.

On 2026-10-23, the user accepted up to 25% deviation from this track's performance
limits while completing the repair. The one-second target therefore has a
temporary acceptance ceiling of 1,250 ms in the shared contract. Reports must
still show raw timings and identify samples above the original 1,000 ms target.
This allowance does not change the 60-second execution cap, other test or job
timeouts, fixed workloads, sample counts, correctness checks, or required
platforms. It does not turn a diagnostic run into release acceptance evidence.

## Fixed workloads

`packages/storage-scale-fixture` owns fixture version `ps903-v1`, the generator,
scenario matrix and assertions. The PS-902 `architecture-overview.md` attachment
is the release contract. Its durable-edit and constrained CPU additions apply.

| Workload | Live resources | Values and history |
| --- | --- | --- |
| A, `rich` | Ten owners with 10,000 each | Nested values, tags and multiline content. Median serialized input is at least 2 KiB; every twentieth input is at least 16 KiB. |
| B, `small` | Owner 0 has 100,000; nine others have 100 each | Natural short fields, numbers, booleans, nullable references and timestamps. Every tenth row has tags and nested details. Serialized inputs are 256–1,024 bytes, median at least 512. No padded body. |

Owner 9 is the real Planner extension. Other owners use public SDK APIs. There is
one project. Each resource is created and edited three times. Preparation commits
use 100 rows for rich inputs and 1,000 for small inputs. These groups were fixed
before accepted measurement; the small preparation group avoids thousands of
setup commits without removing rows or edit rounds. The separately measured
atomic operation always changes exactly 100 rows.

Planner creation uses its public collection API, one resource per commit. Later
Planner seed edits discover opaque record addresses through the public API and
preserve those addresses in grouped commits. No code reconstructs a private
collection address. The manifest describes generator inputs; Planner adds domain
fields. `--verify-fixture` records actual stored counts, byte distributions, field
counts and final history values after the full seed, in a process that then exits.

A separate `--churn` seed creates and edits another complete set of distinct IDs,
then deletes them. It retains all live rows. Never use churn as a smaller live
fixture. The input archives contain every final live value; generator source
reconstructs all four history rounds and the separate churn IDs.

The focus predicate selects 100 distributed rows. The broader predicate selects
more than 100, so page two is distinct and sorting is real. Sort ties use record
ID. B view measurements target the 100,000-row owner. A also measures Planner.
Simultaneous public queries target all ten owners.
The `all-owner-edit-burst` shard also submits one durable write per owner together,
records each acknowledgement and fairness, then kills/reopens and restores them.
Planner's legacy collection retry-identity gap remains an explicit failure.

## Exclusive machine timing window

Use this protocol for PS-903 and later PS-904 through PS-909 evidence. A lock file
alone does not pause another session.

1. List active sessions on the machine. Ask every owner to pause benchmarks,
   builds and tests, including child processes and Docker jobs. Obtain explicit
   acknowledgements, or a person's explicit confirmation that those sessions are
   paused. No reply or elapsed time is not acknowledgement.
2. Save an input JSON file with `sessionId`, `requiredPeers`,
   `acknowledgements: [{sessionId, evidence}]` and `purpose`. A dedicated runner
   with no peers must provide `isolatedRunnerEvidence`.
3. Acquire the shared atomic lock and save its returned owner credential:

   ```sh
   bun packages/e2e/src/perf/storage-timing-window.ts acquire /path/ack.json > /path/owner.json
   ```

   The default lock is the machine-wide temporary directory
   `pstdio-exclusive-timing.lock`, shared across worktrees. Acquisition fails if
   another owner holds it. Never steal a lock because its timestamp is old.
4. Inspect host processes and Docker processes. Check leftover jobs as well as
   agent status. Record the inventory and machine load. Stop only your own jobs
   or jobs whose owner authorized stopping. Resolve unexplained benchmark,
   build or test activity before collecting accepted timings.
5. Finish fixture preparation, builds and tests before the measured window.
   Run one diagnostic shard at a time. Pass `--timing-owner /path/owner.json`.
   The driver checks machine, session and token and records entry/exit inventories.
   Direct layer workers require the same credential through the driver's
   environment. The lock coordinates participants; it cannot detect every
   external workload. If another session resumes heavy work, invalidate the
   affected samples, record the cause and arrange a new exclusive window.
6. Save raw output and the acknowledgements with the report. Verify the lock is
   still owned at completion. Release it explicitly, then tell peer owners the
   window ended:

   ```sh
   bun packages/e2e/src/perf/storage-timing-window.ts release /path/owner.json
   ```

Do not run tests or builds beside accepted benchmarks, even in another worktree.
Fixture setup can overlap other setup owned by this session, but those periods
are preparation and must not be reported as accepted timings. Keep interrupted
or contaminated results with an explicit exclusion reason; never blend them into
accepted summaries.

## Preparation and reproducible commands

Run from the repository root. Use absolute paths for homes and evidence when
invoking the package script, whose working directory is `packages/e2e`.
All runtime homes are disposable. Never point this diagnostic at a live database.
It uses the compiled runtime and public APIs. Layer benchmarks create their own
separate database; they never connect to a running application's PGlite database.

Build the native binary before timing, then select it to prevent another build:

```sh
bun run --cwd scripts build:host
bun run --cwd packages/e2e perf:storage-scale:build
export E2E_PACKAGED_BINARY_PATH="$PWD/dist/pstdio"
bun packages/e2e/src/perf/storage-scale.ts --help
bun packages/e2e/src/perf/storage-scale.ts --fixture rich --output /path/evidence/rich --emit-fixture --timing-owner /path/owner.json
bun packages/e2e/src/perf/storage-scale.ts --fixture rich --output /path/evidence/rich --home /path/native-rich --seed --timing-owner /path/owner.json
```

Repeat with `small` and a different home. Add `--churn` only to a separate fresh
seed. An interrupted or invalid seed must be discarded. `--refresh-source`
refreshes test consumers after harness development; `--verify-fixture` checks the
complete stored fixture and closes its runtime before measurement. Do not refresh
or change a fixture during accepted runs. Commit the exact harness before timing.

For the isolated Linux runtime, first build the native host so the embedded asset
manifest exists. Cross-compile the Linux binary as a separate build, outside any
benchmark case. Then run bounded setup through the required Docker harness:

```sh
bun build packages/pstdio/src/index.ts --compile --target=bun-linux-arm64 --asset-naming '[dir]/[name].[ext]' --external playwright-core --external 'chromium-bidi/*' --outfile /absolute/path/pstdio-linux
bun packages/e2e/src/perf/storage-scale-container-setup.ts ps903-small /path/owner.json /absolute/path/pstdio-linux
```

Use `bun-linux-x64` on x64 hosts. Setup does not build a binary. Its externally
supervised 60-second preparation case calls `bun run dev:isolated` with a
compiled-runtime command override. It writes a container configuration under
`__test-tmp__/storage-scale/ps903-small/`. It does not replace the native binary.
The explicit Linux binary is bind-mounted read-only at
`/opt/pstdio-scale/pstdio-linux`; its host path may be outside the workspace.
Seed the full fixture with its printed home and `--container-config` path. Create
a separate stack/home for the rich workload. Stop each stack with the printed
`bun run dev:isolated -- --name <name> --down` command after saving evidence.
Owned containers are stopped at the end of setup; the next preparation/sample
restarts the configured service. Expiry also stops containers with that exact
Compose project label. The stack's `connection.json` and runtime descriptor contain credentials; do not
attach them to a report.

## Fixture preparation and measured case boundaries

User requirement added 2026-10-22. PS-904 through PS-909 inherit this cap through
PS-902's architecture contract. It lowers an execution allowance; it does not
replace the less-than-1,000-ms product acceptance budget. Keep all tighter limits.
On 2026-10-23 the user corrected the fixture boundary: constructing and copying
the dataset is preparation, not a benchmark or a bulk-write performance target.
The measured operations, workloads and sample counts remain unchanged.

Prepare the complete dataset, verify its expected values and durable history,
and close all database and worker handles before marking the fixture complete.
A failed or interrupted preparation cannot supply a sample. Copy a complete,
closed fixture in the controller before spawning each fresh measurement process.
Do not open or hydrate that copy before the cold operation. Record preparation
progress, duration and memory separately; its RSS must not enter the measured
process's high-water mark. The measured-case watchdog does not cap construction.

An idle supervisor starts one absolute deadline before spawning each case worker.
It does no Yjs or database work. Progress never resets the deadline. The effective
allowance is the lesser of 60,000 ms and any tighter caller allowance. There is
no CLI switch to raise it. In-case startup, imports, calibration, warmup,
background sync activity, measured operations, verification, restoration
and worker cleanup all consume that same allowance.

| Case boundary | Included work |
| --- | --- |
| One database sample process | Database open/close, cold and warm operations, verification and shutdown. Fixture construction and copying finish before the process starts. Ten independent cold cases are still required. |
| Application and sync layer controllers | These still include some fixture work inside their old case wrappers. PS-909 must move initial relay download, extension/view preparation and sync-layer seeding outside measured workers before claiming compliance with the corrected boundary. |

Separate binary and fixture extension builds run before these cases under their existing build limits.
Run `perf:storage-scale:build` again after changing the fixture consumer; seed and
refresh commands require that output and never invoke the bundler. Preparation
failures are setup failures, not failed foreground latency samples. Existing
tool-specific build and container-startup limits are separate from benchmark
acceptance. Never use a partial fixture or relabel setup as a successful sample.

At expiry the supervisor freezes its owned POSIX process group, finds descendants
(including separate Chromium groups), and sends SIGKILL. Windows uses `taskkill
/T /F`. Owned Docker services are stopped with a zero-second grace period. A
completion IPC handshake keeps a normally finishing worker alive until its tree
can be inspected and terminated; an unexpected exit cannot pass. SIGINT/SIGTERM
to the supervisor also terminate its active case. SIGKILL of the supervisor itself
cannot run cleanup; reconcile its processes and timing lease before another run.

Tree inspection, Docker control calls and reaping each have independent
one-second administrative limits. OS scheduling and termination delivery may
produce a short overrun in `elapsedWallMs`; this is not permission for more
benchmark work or a successful over-cap run. The final cap check includes this
cleanup, so a completed worker whose cleanup crosses the cap is also timed out.
Failed cleanup is reported explicitly and stops the suite. Never start another
case until owned-process cleanup is established.

Parent-owned stdout/stderr files retain completed phases and any partial final
line. `case-end` records the cap, worker PID, completion handshake, exit/signal,
cleanup errors and wall time. An expired case has `status: timed-out`,
`complete: false`, `passed: false` and `acceptedTiming: false`. Its wall time is
not an operation `durationMs` and never becomes a 60-second successful sample.
Application aggregation admits samples only from a completed case. Its raw
per-case output remains available even if a sample was printed before timeout.
The fixture is invalidated and remaining samples stay missing. No retry,
reduced fixture/sample count, prewarming or disabled sync can turn this into a pass.

Earlier PS-903 uncapped observations and setup timeouts retain their original
metadata and exclusions. The corrected boundary
does not retroactively turn them into accepted cold-operation measurements.
Short injected-deadline watchdog tests prove
control behavior; they are not full-workload performance samples.

## Measurement shards

A complete operation/background/profile shard retains ten cold and ten warm
samples. Choose shards to split independent jobs without reducing this count:

```sh
bun packages/e2e/src/perf/storage-scale.ts --fixture rich --output /path/evidence/board --home /path/native-rich --measure --profile native --operation board --background idle --timing-owner /path/owner.json
bun packages/e2e/src/perf/storage-scale.ts --fixture small --output /path/evidence/edit --home /path/isolated-small --container-config /path/runtime.json --measure --profile combined --operation direct-sdk-first-write --background idle --timing-owner /path/owner.json
```

Omit operation/background selectors for the complete profile matrix. Use distinct
output directories; raw JSONL is appended, so reusing one would retain duplicates.
Duplicate or missing samples cannot pass. Diagnostic execution returns nonzero
while the baseline fails; do not retry failures to produce a passing set.

Profiles are `native`, `renderer`, `runtime` and `combined`. CDP rates are 1 or 4.
Docker runtime quotas are unrestricted or one aggregate 0.5 CPU for the service
and every child worker. The driver verifies Docker `NanoCpus` before startup and
records cgroup quota/period and CPU counters. A fixed independent 200-million-step
arithmetic process runs three times per quota; it never reads measured app data.
The renderer uses a separate fixed calibration before app navigation. Startup is
reported separately from calibration and foreground timing.

CDP is applied before navigation to the main renderer. Target/frame inventories
are captured after the app loads. Additional worker/iframe targets are reported
as uncovered, not silently counted as constrained. Native WebViews, native OS
runtime controls, unavailable Windows/macOS/Linux runners, lower-spec physical
machines and unrecorded power modes remain explicit evidence gaps. Docker Linux
plus Chromium is an isolated fallback, not native platform coverage. A quota
limits scheduled CPU time; it does not emulate slow storage, memory or a named
processor.

## Timing and correctness boundaries

Cold navigation restarts the compiled runtime and opens a fresh browser. No owner
read happens before the timer. HTTP readiness is separate. Normal browser login
redemption is included. Warm view observations currently measure reload; the raw
boundary must not be described as a filter-change measurement. First-visible and
requested-data readiness are separate. First content never proves that all 100
virtualized rows, labels and controls are ready.

The second-page driver clicks the native table's next-page control and checks the
new first row and absence of the prior page's first row. Its API companion checks
all 100 IDs, sort order and owner. Legacy client paging and unproved complete
virtualized-row readiness remain failures; this is not evidence of indexed cursor
paging.

Every edit kind has separate public SDK and UI observations. The SDK timer starts
at request and ends at durable local response. The first-write case performs no
owner read after restart. UI timing starts at Save and waits for durable response
and committed visible values. Assertions check titles, nested/tag/multiline
summaries, membership and order. The legacy editor loads its owner before Save;
requested cold UI edits are explicitly marked unavailable, even if fast. The
separate direct cold SDK case prevents editor preparation from hiding hydration.

After acknowledged writes the driver kills the process, restarts, checks exact
values, deletion state, operation outcome, count/membership and idempotent retry,
then restores the fixture outside timing. Contention variants drain their offered
work before killing; only idle/direct cases kill immediately after acknowledgement.
A scenario exception records the error and invalidates the fixture rather than
retrying or continuing with unproved restoration. Missing remaining samples stay
missing in the coverage ledger.

`--sync` prepares a local TLS relay and a second full device through public APIs.
Initial upload/download is separate preparation. The offered incoming workload is
100 operations at 100 ms intervals over ten seconds. Fold pressure offers 129
writes to cross the current persisted threshold. Driver offered/completed counts,
failures, backlog and drain are recorded. Drain requires both sync statuses and
exact receiver readback, followed by reset propagation outside timing. Driver
backlog is not the runtime queue. Backend incoming/fold overlap is not instrumented
and is explicitly unverified. Container sync advertises `host.docker.internal`
with a matching certificate name and the CA in the mounted disposable home.
Linux hosts add Docker's `host-gateway` mapping. The login callback runs inside
the receiver's network namespace because it owns a separate loopback port.
The second device is a native compiled process outside the receiver's CPU quota.
Startup and extension installation happen before measured foreground work.

Offline engine checks replay same-record, different-record, conflicting-field and
delete-versus-edit changes in both delivery orders, preserving the seed's causal
identities. Explicit restore is checked separately. These correctness checks do
not stand in for compiled two-device or foreground latency evidence.

## Focused layer diagnostics

```sh
bun packages/e2e/src/perf/storage-scale.ts --fixture rich --output /path/evidence/sync-10000 --layer sync --rows 10000 --timing-owner /path/owner.json
bun packages/e2e/src/perf/storage-scale.ts --fixture small --output /path/evidence/db-100000 --layer database --rows 100000 --timing-owner /path/owner.json
```

Frozen scaling counts are rich 1,000/10,000 and small 1,000/10,000/100,000. These
are one-owner layer comparisons, not replacements for either full application
workload. Preserve the same row shape/history and use a separate churn run.

Sync output separates full encode, hydration, clone, no-op comparison, one-row
application, incremental diff, incoming apply and full list. Database output
separates open, first durable write, warm writes, full list, atomic-100 and writes
crossing the actual fold boundary. Each of ten cold database processes receives
a copy of the same closed seed; each also records ten warm writes. Do not report
those 100 warm observations as ten independent cold observations.

The database layer controller prepares and verifies a complete immutable fixture
once, then starts ten sample controllers with distinct destinations. Each sample
copies the closed fixture before its fresh worker and unchanged 60-second watchdog.
The standalone database commands use the same boundary:

```sh
bun packages/pstdio-db/src/services/extension-storage/document-scale.bench.ts small 100000 /absolute/disposable/owner-fixture prepare
bun packages/pstdio-db/src/services/extension-storage/document-scale.bench.ts small 100000 /absolute/disposable/owner-sample-01 sample /absolute/disposable/owner-fixture
```

Add `churn` to both commands for the separate create/edit/delete variant. Repeat
samples with ten distinct destinations. Existing preparation or sample directories
are rejected rather than overwritten. Verification checks all history receipts,
source revisions, live/deleted counts and decoded final values. It runs only in
preparation; the first resource access in a sample remains its measured write.
Preparation duration and memory are separate from sample measurements. A failed
preparation cannot create the completion manifest, and mutable sample copies cannot
be reused as prepared fixtures. Case events from database child controllers are
retained in `database.jsonl`; the outer `results.jsonl` retains environment and
coverage records. This path still reports diagnostic-only coverage.

Phase telemetry includes wall time, process CPU, event-loop delay, RSS high-water
mark, retained memory, encoded/decoded bytes, clones and database size where
available. API consumers report materialized rows and rows scanned in their own
filter. Actual database scan, hydration, lock wait, index maintenance, notification,
backend queue and full virtualized render phases remain null/uninstrumented where
no trustworthy counter exists. Null is never zero work. Index APIs missing from
the baseline are explicit failures. Whole-owner materialization fails even when
its wall time happens to be below 1,000 ms.

## Evidence and release interpretation

Save commands, environment, exact commit, fixture manifests, full compressed input
files, stored-shape verification, raw JSONL, stderr, screenshots, pause evidence,
control calibration and coverage ledger under the change-request report's
`filesPath`. Record p50/p95/max and every individual failed sample. Keep native and
constrained evidence separate. State which scenario matrix entries were not run,
which controls were unsupported and which backend phases were uninstrumented.

PS-903 is diagnostic work. Submitting its reproducible failing baseline does not
approve the current document boundary or release. PS-904 through PS-908 implement
the repair; PS-909 must prove the complete contract on the final architecture.
No product fix, smaller fixture, retry, prewarmed cold case, disabled sync or raised
budget/timeout is part of this diagnostic.
