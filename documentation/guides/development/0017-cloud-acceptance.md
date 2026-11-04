# Cloud phase 1 acceptance

Prepare and run PS-789 against packaged candidates. This procedure records evidence;
it does not approve a release, deploy services, or complete the platform rollup.

## Candidate and delivery gate

Read the full current PS-789, PS-735 and PS-736 tickets and
[PRD 0014](../../requirements/platform/0014-local-first-sync.md) before selecting a
candidate. PS-789 waits for PS-735 and its listed product deliveries. PS-736 waits
for PS-789; it is not an additional prerequisite. PS-1016 is separate proposed
work, not the phase 1 baseline or a new dependency gate.

Preparation may run before delivery. Full integrated and hosted acceptance may
only run against the delivered, correctly deployed candidates. A green component
test, a submitted prerequisite branch, or an old hosted run does not satisfy that
condition. Keep PS-789 and PS-735 unfinished until their actual criteria are met.
Do not create a managed attempt to bypass the unfinished rollup.

For each run, save the following under the `filesPath` returned by
`pst reports write --kind change_request --name change_request --template change-request`:

- Workspace, branch, exact HEAD, dirty status, current `origin/main`, prerequisite
  branch heads and PR URLs. Record which prerequisite commits are present.
- Packaged binary SHA-256, version, OS/architecture, Bun version, harness commit,
  extension versions and package sources. For hosted checks, also record deployed
  relay/account-manager image digests and migration versions, supplied by their owners.
- Original command, exit status, phase timings and complete output for every run.
  Keep the first red result, interrupted runs, timeouts and later corrections.
- A per-requirement verdict: passed, failed, blocked, or unproved, with exact evidence.
  Do not convert a missing run into a pass or an unrelated dependency into a new gate.

The initial preparation workspace contains submitted PS-776
`d4da8b532dc39b0c073cd8a6246650fbd02f9fb3`. This makes its public text APIs available;
it does not establish delivery or deployment. Inspect current branches again before
running final acceptance. Leave other workspaces, tickets and managed attempts alone.

## Shared-machine lease

Broad builds, package installs and consumers, and full browser suites share
`/tmp/pstdio-cloud-heavy-validation.lock`. Acquire it with atomic `mkdir`; record
session ID, PID and purpose. Small focused tests may run independently. Never steal
a live lease or infer abandonment from its age. If acquisition fails, inspect the
owner and coordinate with that session. An unexplained or ownerless lease needs
reconciliation before use.

Use a wrapper with `try/finally`, for example save this as `heavy-command.ts` under
the report's evidence directory. `CLOUD_SESSION_ID` must identify the owning session.

```ts
import { mkdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const lock = "/tmp/pstdio-cloud-heavy-validation.lock";
const session = process.env.CLOUD_SESSION_ID;
const command = process.argv.slice(2);
if (!session || command.length === 0) throw new Error("Provide session and command");
await mkdir(lock); // Existing leases fail closed; never remove another owner here.
const path = join(lock, "owner.json");
const owner = { session, pid: process.pid, purpose: command, acquiredAt: new Date().toISOString() };
let child: ReturnType<typeof Bun.spawn> | undefined;
const interrupt = () => child?.kill("SIGINT");
const terminate = () => child?.kill("SIGTERM");
try {
  await writeFile(path, JSON.stringify(owner, null, 2), { flag: "wx" });
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  child = Bun.spawn(command, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  process.exitCode = await child.exited;
} finally {
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", terminate);
  const current = JSON.parse(await readFile(path, "utf8"));
  if (current.session !== session || current.pid !== process.pid) throw new Error("Lease owner changed");
  await unlink(path);
  await rmdir(lock);
}
```

Run one heavy command per wrapper invocation. Do not launch a second wrapper while
the first owns the lease. A forced kill can leave the lease and child processes
behind: preserve their metadata and reconcile them with the owner. Do not remove
an active directory to make another command start.

This lease is not the separate acknowledged exclusive machine timing window
required for PS-903 performance measurements. Follow the
[storage-scale timing protocol](../../references/performance/0005-storage-scale-diagnostic.md#exclusive-machine-timing-window)
for those measurements; a lease alone does not pause other sessions.

## Maintained coverage and remaining evidence

Paths below are relative to the repository root. The new phase 1 scenario is
`packages/e2e/src/packaged/packaged-cloud-phase-one.p2.spec.ts`; its fixture is
`packages/e2e/src/packaged/packaged-cloud-acceptance.fixture.ts`. A fixture run
against controlled account/relay peers proves packaged client behavior only.

| Acceptance | Harness or existing coverage to inspect | Required evidence beyond a component pass |
| --- | --- | --- |
| One account/project, three devices, online and offline | New phase 1 scenario; `packaged-cloud-extension-set-smoke.p2.test.ts` already starts three hosts | Three independent homes, databases, runtime PIDs, environment IDs and enrolled device IDs; one account/project; exact Notes, Artifacts, Planner and unrelated-extension readback on all three |
| Same-note edits and live native collaboration | New phase 1 scenario; `packaged-public-text-sync.p2.spec.ts`; `packaged-public-text-native-sync.p2.spec.ts` | Actual public editor sessions and independent offline edits both survive; settled note file and displayed text agree on every device |
| Object, nested-key and identified-list edits | New phase 1 scenario; `packages/sdk/src/testing/memory-storage-devices.p0.test.ts` | Real packaged storage clients merge independent field/item edits, not only simulated two-device storage |
| Atomic multi-record delivery | New phase 1 scenario; `packaged-document-sync-smoke.p1.test.ts` | Receiver observations show only complete before/after sets; final equality alone cannot prove absence of intermediate partial states |
| Missed replacements and repair | New phase 1 scenario; relay fixture controls; `packages/pstdio-sync/src/relay/document-sync.p0.test.ts` | One device misses several actual replacements with covered history trimmed; its offline edits survive. A validly encrypted incomplete state is repaired from retained client edits |
| Number uniqueness and old aliases | New phase 1 scenario; `packaged-grouped-storage-smoke.p2.test.ts` | Offline same-kind allocations collide, converge to unique current numbers, and old shared aliases resolve every affected resource; verify Planner and Reports adoption separately |
| Deterministic migrations and order | New phase 1 scenario; `packaged-cloud-extension-set-smoke.p2.test.ts`; `packages/sdk/src/testing/storage-ordering.p0.test.ts` | Offline migration outputs use the same IDs without duplicates; concurrent card moves produce the same order with every card once; core-only checks do not prove Planner adoption |
| Local then re-enabled | New phase 1 scenario; `packaged-two-device-sync-smoke.p2.test.ts` | Account-wide Local status, independent retained copies, two-device edits while local and identical merged content after re-enable |
| Reset and new-device recovery | New phase 1 scenario; `packaged-two-device-sync-smoke.p2.test.ts`; `packaged-cloud-notes-onboarding.p2.test.ts` | Reset a disposable home and database; perform supervised Google login; discover every cloud project and recover content from stored data, without copying the source database |
| Early access and Cloud UI ownership | `packaged-account-smoke.p2.test.ts`; deployed Cloud extension candidate | Denied account remains signed in, sees no cloud projects and Coming soon. Enabled account gets full Cloud extension status item, popover and settings; dashboard contains no independent Cloud UI |
| Plaintext absence | `packaged-document-sync-smoke.p1.test.ts`; new phase 1 scenario | Scan relay metadata and decoded stored payload/blob bytes for all known titles, file names, record text and file bytes; also scan real hosted test database/object dump and service logs |
| Blob grace and per-document bound | Relay reference workload and storage-bound benchmark | An offline referenced file remains readable within seven-day grace; after 10,000 edits, each document is below twice latest state plus grace copy, with all objects reconciled |
| Full folder recovery | PRD R57–R59 and its delivered recovery candidate | `.pstignore` policy, hidden/Git-ignored files including `.env`, missing entries, private keys, interrupted transfer and non-overwriting restore all satisfy the PRD; declared-file recovery is narrower evidence |
| Scale and hosting cost | PS-903 scale harness and PS-787 reference workload | Exact frozen workloads, raw timings, three-device correctness, concurrent second account and hosted cost/capacity evidence |

Keep semantic gaps visible. Early-access API fixture coverage already exists, but
production early-access UI coverage remains unproved until its actual extension is
available. At the preparation base,
[`ticketOrderChanges`](../../../extensions/pstdio-planner/src/data/ticket-order.ts)
uses numeric midpoint positions and floating-point rebalance. Core provides string
positions through `storage.positions.between`. A passing core order fixture cannot
certify the Planner R51 adoption requirement. Report the mismatch to its owner;
acceptance work must not fix Planner or substitute PS-1016 behavior.

The existing two-isolated-setup waiver for PS-877 does not waive PS-789's three-device
workload, real login, product content, scale, retention, UI or recovery requirements.

## Focused preparation and final candidate commands

Run from the repository root, except where a subshell changes to the owning package.
Use absolute paths for `EVIDENCE`, `E2E_PACKAGED_BINARY_PATH` and the wrapper. The
commands below assume `EVIDENCE` is the report's returned `filesPath`, and
`CLOUD_SESSION_ID` is already set. Preserve original output before correcting a run.

```sh
(cd packages/e2e && bun test src/packaged/fixtures/cloud-acceptance-extension.p0.test.ts src/packaged/packaged-sync-relay.fixture.p0.test.ts src/packaged/packaged-cloud-repair.fixture.p0.test.ts src/packaged/packaged-cloud-peer.fixture.p0.test.ts)
bun run --cwd packages/e2e test:packaged:cli -- src/packaged/packaged-cloud-record-repair.fixture.p0.test.ts
```

The record-stream repair check currently exposes an acceptance failure: a quiet joined
client accepts an authenticated incomplete replacement at the same cursor without
repairing the missing record. Preserve that red result and refer it to the sync owner.
The green `createDocumentSync` checks exercise the text/document path and do not
waive the record-stream failure. Cloud extension UI is also absent at this base; no
UI selectors or passing production UI coverage are invented for its Canvas previews.

Only after the delivery gate and candidate verification, run:

```sh
bun "$EVIDENCE/heavy-command.ts" bun run --cwd scripts build:host
export E2E_PACKAGED_BINARY_PATH="$PWD/dist/pstdio"
bun "$EVIDENCE/heavy-command.ts" bun run --cwd packages/e2e test:packaged:browser -- src/packaged/packaged-cloud-phase-one.p2.spec.ts
bun "$EVIDENCE/heavy-command.ts" bun run --cwd packages/e2e test:packaged:cli -- src/packaged/packaged-document-sync-smoke.p1.test.ts src/packaged/packaged-two-device-sync-smoke.p2.test.ts src/packaged/packaged-cloud-extension-set-smoke.p2.test.ts src/packaged/packaged-account-smoke.p2.test.ts
bun "$EVIDENCE/heavy-command.ts" bun run --cwd packages/e2e test:packaged:browser -- src/packaged/packaged-public-text-sync.p2.spec.ts src/packaged/packaged-public-text-native-sync.p2.spec.ts
```

The first two commands run focused fixture checks, not integrated acceptance. The
record-stream check uses the maintained packaged runner’s existing platform allowance;
the original direct-Bun 5-second setup timeouts remain failure evidence. The
packaged browser scenarios are maintained preparation and have not established a
passing packaged run at the preparation base. They do not include Cloud UI because
its production extension has not been delivered.
The existing packaged test and fixture allowances remain unchanged. Do not raise
Bun/Playwright timeouts, job limits, retries or budgets; do not drop a device, record,
sample, file, platform or scenario to obtain a pass. Preserve slow-phase diagnostics.

Run affected package type/lint checks. Keep the PR draft; before any later ready
transition, follow [PR completion](../../guidance/0004-ci.md), including full required
local checks and every applicable CI check on the latest pushed commit. Save the
independent review report and resolve relevant findings. Generated results belong
in report evidence, not Git.

## Frozen scale and relay workloads

PS-789 requires ten enabled extensions with 10,000 live resources each, filtered
pages of 100 within the view limit in every cold and warm sample, during active
sync. Owner 9 is real Planner. Preserve the complete PS-903 contract, including
its rich/small workloads, history/churn variants, ten cold and ten warm samples,
atomic 100-row edits, operations, backgrounds, and supported constrained profiles.
The product target is 1,000 ms; the approved temporary ceiling is 1,250 ms.
Report misses of both thresholds. The case cap remains 60,000 ms or any tighter
caller limit; setup must follow the documented boundary.

Use the maintained [scale procedure](../../references/performance/0005-storage-scale-diagnostic.md)
and [production validation reference](../../references/performance/0006-production-validation.md).
Build before measurement under the heavy lease. Arrange an acknowledged exclusive
timing window before using the following example shard:

```sh
bun "$EVIDENCE/heavy-command.ts" bun run --cwd packages/e2e perf:storage-scale:build
bun packages/e2e/src/perf/storage-scale.diagnostic.ts --fixture rich --output "$EVIDENCE/scale-rich" --home /absolute/disposable-rich-home --seed --timing-owner /absolute/owner.json
bun packages/e2e/src/perf/storage-scale.diagnostic.ts --fixture rich --output "$EVIDENCE/scale-rich-incoming-board" --home /absolute/disposable-rich-home --measure --profile native --operation board --background incoming --sync --timing-owner /absolute/owner.json
```

The example is one shard, not full coverage. Run the remaining frozen matrix through
the maintained supervisor with distinct evidence paths. Layer-only results and the
current diagnostic controller's incomplete-coverage exit cannot become a passing
full acceptance claim. Do not start a new hourly CPU experiment for this preparation.

The separate [relay reference workload](0012-portable-cloud-deployment.md#reference-workload-measurement)
uses disposable Compose PostgreSQL and RustFS with real production relay clients.
It is the maintained path for retention, physical object reconciliation and bulk
transfer, not a wire-peer substitute. It needs about 30 GiB of free disk. Under the
heavy lease, when ready to collect that separate evidence:

```sh
bun "$EVIDENCE/heavy-command.ts" docker build -f infra/relay/Dockerfile --target runtime -t pstdio-relay:acceptance .
bun "$EVIDENCE/heavy-command.ts" bun packages/e2e/src/perf/relay-reference-workload/workload.diagnostic.ts "$EVIDENCE/relay-reference" pstdio-relay:acceptance
```

Do not select a smaller workload for a full claim. The reference is one user, two
projects, three devices, 10,000 records and 5 GiB of distinct files including one
1 GiB file; a second account must sync inside that file's actual transfer window.
Each project receives 10,000 edits. The separate scale workload is ten owners with
10,000 records each on three devices and 10,000 edits per owner. The large-save
case retains its eight 150,002-byte values. Keep seven-day grace, 1 MiB/1,000-update
latest-state triggers and normal relay limits. Record cost against the under-US$50
per month target; local Docker results alone do not establish hosted capacity,
provider compatibility, billing, or Google/account-manager behavior.

## Final integrated and hosted handoff

After the delivery gate is satisfied, verify that the packaged app, extension
packages and deployed service digests contain the same approved contracts. Do not
run production Apply, deploy, publish a release, merge main/PRs, or create resources
as part of preparation. Service owners provide an existing correct test deployment.

Use owned disposable accounts/projects and three independent runtime identities.
A human supervises real Google-account interaction. Record successful login on all
three, denied/enabled early-access behavior, reset recovery of every project, and
Cloud extension surfaces with screenshots or traces. Never attach credentials,
access tokens, recovery keys, runtime descriptors or real private project content.
Record relay dump source, object inventory and scan terms using synthetic canaries.
A wire fixture's fake callback is not Google-login acceptance.

Complete the matrix above against those candidates. Preserve all failures from
preparation and final runs; name their owners and linked fixes instead of hiding
them with retries. Save a fresh report with exact commit and latest-head CI results.
If any dependency, deployed candidate, workload or acceptance item remains
incomplete, report the precise missing evidence and keep final acceptance unproved.
