# CI stages and qualification

Tests stay beside their owning code. A test file's priority determines when it runs; its runner determines the build and fixture it needs. Discovery and package dependencies select tests. Do not maintain a second list of test filenames in a workflow.

[ADR 0106](../../adrs/0106-prioritize-merge-checks-and-certify-release-candidates.md) records the stage decision. Selection lives in `scripts/ci/test-discovery.ts`, `test-matrices.ts`, and `pull-request-ci-scope.ts`.

## Contracts and naming

| Priority | Contracts | Filename examples |
| --- | --- | --- |
| P0 | Types, public declarations, validation, permissions, state transitions, focused extension logic, repository and CI rules | `session-state.p0.test.ts` |
| P1 | Essential session/workspace/extension lifecycle, isolation and data safety, restart and upgrade integrity, sync/reconnect, usable workbench and native/compiled startup | `session-isolation.p1.test.ts`, `startup.p1.spec.ts`, `storage.p1.integration.ts` |
| P2 | Extension feature workflows, component permutations, browser/platform breadth, full distribution/update and compatibility matrices | `planner-board.p2.spec.ts` |
| P3 | Existing startup, responsiveness, throughput, resource-use, scale and endurance acceptance workloads | `startup.p3.bench.ts`, `chat-rendering.p3.perf.ts` |

Every maintained test file declares one priority. Split mixed-priority files while keeping cases that share an owner, priority and fixture together. A slow critical contract stays P1: improve its fixture or execution path. Review an unknown functional contract as P1 until its importance is understood; discovery rejects an unclassified filename.

Pure and focused tests belong next to the implementation. Stories stay next to components. Component browser tests live under `packages/storybook-tests/src/ui/<owner>/`, where the owner is the source package directory. App and packaged journeys stay in `packages/e2e`. Fixtures use `.fixture.ts` or `.test-fixture.ts`, never a test filename. Diagnostic scale controllers without a release acceptance contract use `.diagnostic.ts` and retain their documented explicit setup.

Keep one primary owner for each behavior. A focused test proves detailed rules; a browser journey proves that the public interaction reaches those rules. Delete repeated assertions, literal-copy checks, cosmetic token mirrors and tests for removed behavior. Keep distinct failure, security, migration and data-safety coverage.

Core-extension P1 smoke checks loading, packaged skill files, authenticated assets, storage ownership and workspace cleanup. Planner settings, Notes resources, theme permutations and template workflows run separately in P2. Both use the same disposable packaged-runtime fixture.

## Local commands

From the repository root, use Bun's script shorthand or `bun run`:

```sh
bun test:p0
bun test:p1
bun test:p2
bun test:p3
bun test:p0 --scope pstdio-paths
bun test:p1 --scope pstdio-api
bun test:p1 --runner component
bun test:p2 --list
```

Each command selects exactly its named priority on the current host, builds the selected owners and dependencies, and invokes the owning runner. `--scope` accepts a workspace name or directory; comma-separated names select several owners. `--runner` narrows the execution kind. `--list` prints the selected files and commands without building or running them. CI uses `--prebuilt` after its declared build step. A selection with no tests fails instead of reporting a successful execution.

Install the maintained browser/native prerequisites before browser and desktop runs. Component tests serve built Storybooks, never development servers. App tests use their existing isolated runtime. For interactive app validation, use `bun run dev:playwright` and stop it with `bun run dev:playwright:down`.

Local commands are current-host diagnostics. They do not certify other platforms or signed publication artifacts. Live-provider tests retain their explicit opt-in requirements. See [the testing guide](0002-testing.md).

## Stage guarantees

| Stage | Selected work | Success means |
| --- | --- | --- |
| Pull request | Affected P0 rules, types, lint and public contracts, selected through workspace dependencies | Every selected fast check passed for that merge commit |
| Merge queue | All P0/P1 plus essential Linux and Apple Silicon delivered startup and defaults | The actual candidate passed the merge-safety plan |
| Main | Matching successful queue tree/build provenance and startup smoke | The tested queue content matches main and still starts |
| Production functional | P0/P1 and separate P2 breadth, including Windows | Every selected functional platform and row passed |
| Production certification | Complete functional, signed-app and P3 evidence for one immutable candidate | Matching evidence permits stable publication |

PR, queue and complete production targets remain below 180, 480 and 2,400 seconds of active execution. Include installation, builds, artifact transfer, tests, reports and cleanup. Report GitHub queue and runner wait time separately; it does not count against these targets. These targets do not authorize reducing a workload or increasing an execution allowance or operation budget.

PR scope follows workspace dependency names and explicit Nx dependencies, including consumers with released SDK/UI ranges. Shared repository inputs select all essential owners. Documentation selects static checks. The synthetic merge commit is compared with its target parent. A correctly classified new test joins the appropriate stage automatically.

P0 package rows build their owners and dependencies once, then collect lint and unit results independently. Post-build checks invoke package scripts directly so Nx cannot replace dependency output while tests are reading it. API and database files have separate rows for each priority. P1 API work uses up to five rows of complete files; hosted file durations showed the previous three rows were uneven. API files retain fresh processes and at most two active files. A file that needs the whole process pool uses `.exclusive.p1.test.ts`; the scheduler runs it alone under [ADR 0018](../../adrs/0018-temporary-api-test-process-isolation.md). No selection is reduced because time elapsed or a previous attempt failed.

The required queue runs all critical P1 app contracts, including startup, in up to two shards; production adds up to six P2 shards. Integrated P1 feedback arrives at the queue rather than in the fast PR checks. Component rows build and test one owner and priority in the same browser container. They neither start the application nor wait for other Storybook owners. Production adds the complete component permutations as P2 rows. Packaged CLI, packaged browser and Vite contracts have independent rows derived from discovered files.

Relay storage, asset, sync and transport contracts share one disposable PostgreSQL/object-store stack. Each test file owns a separate database, so a privacy or recovery assertion cannot inspect another file's records. The account authority owns its separate disposable stack. Test data never uses the developer database.

## Failure and evidence

P1 alone fails fast. P0, P2 and P3 complete selected independent work and report all failures. A failed setup can block its consumers; it cannot certify them. Mixed-priority matrices disable GitHub matrix fail-fast. P1 supervisors stop only their own work after a peer P1 failure; they never cancel the entire workflow. [ADR 0108](../../adrs/0108-temporary-cooperative-p1-cancellation.md) records the temporary GitHub limitation.

`validation_results` observes the selected graph. Missing, duplicated, skipped, cancelled or failed required rows cannot produce success. Unselected rows may skip. `ci_passed` keeps its existing required check identity and five-minute allowance; the parallel monitor retains its 40-minute allowance. Production aggregation waits for the complete selected graph.

Read the selected plan and observed results in `test-results/ci/gate-results.json`, uploaded as `ci-validation-attempt-<attempt>`. Bun/API case reports live under `test-results/ci/bun` and `test-results/ci/api`. A successful child without a case report fails. A bailed Bun report omits later cases, so its unreported remainder stays unknown. App and component traces/reports stay under their owning package's `test-results` and `playwright-report` directories.

Manual quarantine remains explicit in `scripts/ci/test-quarantine.json`. Each entry keeps its runner, exact file and title, platform/architecture, owner, reason, evidence and removal criteria. All 25 entries inherited from main remain registered; moved tests use their current paths. Bun quarantine owners are discovered from this registry and workspace manifests, so a new owner needs no workflow edit. API quarantine files retain fresh processes. Its separate lane still requires first-attempt execution evidence. Bun quarantine rejects retry/rerun flags and declared per-test retries, including local option aliases. Do not hide retries in test helpers. Browser quarantine uses zero retries and verifies that each registered file/title ran exactly once. Reports reject missing, duplicate, skipped, unexpected, stale or cancelled execution; a real first-attempt assertion failure remains nonblocking in quarantine. Never quarantine or retry automatically to obtain green. Every quarantine attempt clears old evidence, records a fresh attempt identity, and binds reports to that attempt and source revision. Reports are kept separately by runner and owner. Run Bun quarantine locally with `bun scripts/ci/run-quarantined-tests.ts bun` and verify it with `bun scripts/ci/verify-quarantine-reports.ts bun`. The controller also accepts `packaged-bun`, `playwright-ui`, `playwright`, and `packaged-desktop`. Use the controller rather than calling a filtered test runner directly when collecting quarantine proof. Use `--scope <workspace>` for one owner; this reports an empty lane when that host has no matching entries. Production and release-native checks use the same registry filtering. Preserve the first failed attempt before a rerun; a later pass does not resolve the cause.

## Builds and publication

Reuse dependency downloads and Nx build archives, never passing test results. Build inputs include production source/dependencies, lockfile, build helpers, toolchain, OS/architecture and relevant environment. Test-only edits do not invalidate production builds. Storybook builds still include their stories. Check committed generated outputs after builds, including cache hits.

Main verifies the exact successful queue tree and inputs before promoting Linux and Apple Silicon build-cache namespaces. Container Storybook and app archives stay in the separate Linux Playwright namespace. Download each producer into its own directory, then import complete task archives serially. The same Nx hash can have different tar metadata between runners; concurrent extraction into the same file can corrupt it. Main smoke must not replace that complete certified cache with a partial archive. A missing cache runs the required build. Smoke runs only after its build succeeds. A passing PR does not certify a different merged tree.

If a cache importer has already published corrupt archives, remove those exact cache entries before validating its fix. Preserve the failing build logs and identify the producer run. Changing the importer does not repair an immutable cache that later jobs can still restore. A cache failure never justifies changing a test or its priority.

Queue integrity assigns portable public consumer checks once to Linux. Each native desktop row verifies the CLI it just compiled for its sidecar, including embedded Bun, before starting the app. This shares installation and compilation instead of starting separate queue toolchain builds. Intel macOS validation and desktop publication run only for full stable releases. Stable production repeats full public-consumer and runtime coverage on all six native CLI hosts and certifies Linux x64, macOS x64/arm64 and Windows x64 desktop publication inputs. Nightly validates the other five CLI hosts, publishes Linux x64 and Apple Silicon desktop apps, and keeps its daily Windows source diagnostics. All quarantine entries remain registered, including Intel-only cases exercised during full releases.

Production binds evidence to the original source SHA, version SHA, actual toolchain/policy, producer run/attempt and immutable artifact IDs/digests. Stable publication requires a complete release-eligible certificate and rechecks those identities before downloading the certified artifacts. Missing, expired, changed or partial evidence blocks publication.

Deep P2/P3 validation runs nightly and for stable candidates. Nightly publication retains basic integrity and all-or-nothing publication without waiting for deep diagnostics. Stable publication waits for full matching certification of its own candidate. A source-built nightly Windows diagnostic cannot certify a stable published Windows app.

## Deeper diagnostics and qualification

`ci:full` dispatches separate functional diagnostics for a same-repository PR through the trusted base workflow. Its `production_ci_passed` result does not replace the ordinary `ci_passed` gate. Forks need a maintainer-driven diagnostic run. Functional source diagnostics do not certify release artifacts or replace P3 validation.

Use Test and Build's manual `merge_queue` profile for source-only rehearsals. Pushes to `test/ci-reliability/merge/**` select that profile; other reliability branches select production functional diagnostics. These runs publish no release and do not replace qualification with an actual merge-group event.

Before treating the architecture as qualified:

1. Measure representative source, SDK/UI, extension, tooling and native changes with cold and warm builds.
2. Verify early P1 failure while independent P0 work finishes and retains evidence.
3. Exercise missing/duplicate/skipped rows, setup failure, cancellation and superseded attempts. None may pass.
4. Exercise P2/P3 failures, signed/native targets, candidate mismatch and publication rejection.
5. Verify the real queue-to-main provenance path and compare complete first-attempt active execution with the targets. Report GitHub queue and runner wait time separately.

Keep `ci_passed` and ALLGREEN. Inspect live rules before changing enforcement. If qualification fails, restore the last qualified workflow/selector, remove stale queue candidates and validate fresh candidates. Keep stable publication blocked until its exact candidate passes. Never weaken protection or reuse a green result from another tree to make rollback appear successful.
