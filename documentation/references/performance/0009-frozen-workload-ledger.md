# Frozen workload migration and qualification ledger

Proposed: 2026-11-14. Status: implementation candidate; **not qualified**.

PS-233 is the user's one-time authorization for the exact eight scenarios. [Manifest](../../../packages/benchmarks/src/catalog/scenarios.ts), [lock](../../../packages/benchmarks/catalog.lock.json), [guidance](../../guides/development/0016-writing-benchmarks.md). Benchmark changes carry the `benchmark` PR label and are left for human review and merge. On 2026-11-14 the user approved the [aligned timing and memory targets](../../guides/development/0016-writing-benchmarks.md#approved-acceptance-limits) and delegated B4 foreground limits. The user explicitly selected B1–B8 on Linux x64, Apple Silicon Mac and Windows x64, with Intel Mac removed entirely from benchmarks. Nightly and stable each require all 24 combinations. B5 version 2 labels native memory by platform; its limits are now <2GB on Linux/macOS and <3GB on Windows. Older host mappings and measurements below are historical evidence.

## Previous catalog

Historical source is preserved in Git at `bd56e2c399be208edcb64eef9f0e7f6ab17eb18d`. Entry retirement does not repair failures or establish equivalent measured coverage. New registrations replace old entry points in the candidate; production qualification is incomplete, so this candidate is not ready to replace qualified release evidence. No duplicate legacy/new suite is scheduled.

| Previous file | Disposition |
| --- | --- |
| `clients/desktop/src/e2e/packaged-renderer.p3.bench.ts` | B4 consolidates foreground streaming/actions; B1/B8 own launch/recovery. New boundaries remain unqualified; old guards and PS-96 failures remain below. |
| `packages/canvas-tests/src/performance/frame-startup.p3.bench.ts` | Explicitly retire standalone Canvas timing. Frame/build and UI conformance tests remain; no numeric startup target was approved. |
| `packages/e2e/src/packaged/packaged-paged-collections.p3.bench.ts` | B4 consolidates foreground streaming/actions; B1/B8 own launch/recovery. New boundaries remain unqualified; old guards and PS-96 failures remain below. |
| `packages/e2e/src/perf/nav-chrome.p3.bench.ts` | B4 consolidates foreground streaming/actions; B1/B8 own launch/recovery. New boundaries remain unqualified; old guards and PS-96 failures remain below. |
| `packages/e2e/src/perf/planner-board-cold-open.p3.bench.ts` | B6; stronger actionable/search/page/move/reopen boundary, unqualified; old 4,000ms first-card guard unresolved for its old operation. |
| `packages/e2e/src/perf/resource-hierarchy.p3.bench.ts` | B4 consolidates foreground streaming/actions; B1/B8 own launch/recovery. New boundaries remain unqualified; old guards and PS-96 failures remain below. |
| `packages/e2e/src/perf/subnav.p3.bench.ts` | B4 consolidates foreground streaming/actions; B1/B8 own launch/recovery. New boundaries remain unqualified; old guards and PS-96 failures remain below. |
| `packages/e2e/src/perf/workbench-interactions.p3.bench.ts` | B4 consolidates foreground streaming/actions; B1/B8 own launch/recovery. New boundaries remain unqualified; old guards and PS-96 failures remain below. |
| `packages/pstdio-api-runtime-host/src/harness-session-resources.p3.bench.ts` | Explicitly retire strategy/count/concurrency microbenchmarks. Preserve adjacent harness-session resource, page-runtime inventory and workspace-removal product tests; no numeric timing target was approved. |
| `packages/pstdio-api/src/features/workspaces/worktree-cleanup.p3.bench.ts` | Explicitly retire strategy/count/concurrency microbenchmarks. Preserve adjacent harness-session resource, page-runtime inventory and workspace-removal product tests; no numeric timing target was approved. |
| `packages/pstdio-db/src/services/extension-storage/document-storage.p3.bench.ts` | B7 replaces the selected record journey; old save/session-badge microbenchmarks explicitly retired. Supported persistence/query correctness remains in adjacent product tests. |
| `packages/pstdio-db/src/services/extension-storage/ordered-legacy-backlog.p3.bench.ts` | Retained interrupted migration P2 integration, same complete fixture and 1,500ms guard. |
| `packages/pstdio-db/src/services/sessions/session-query.p3.bench.ts` | B7 replaces the selected record journey; old save/session-badge microbenchmarks explicitly retired. Supported persistence/query correctness remains in adjacent product tests. |
| `packages/pstdio-workbench/src/core/controllers/page-runtime/open-resource-inventory.p3.bench.ts` | Explicitly retire strategy/count/concurrency microbenchmarks. Preserve adjacent harness-session resource, page-runtime inventory and workspace-removal product tests; no numeric timing target was approved. |
| `packages/ui/src/components/chat-ui/performance/chat-panel.p3.bench.ts` | B4 consolidates foreground streaming/actions; B1/B8 own launch/recovery. New boundaries remain unqualified; old guards and PS-96 failures remain below. |
| `packages/ui/src/components/chat-ui/performance/chat-rendering.p3.bench.ts` | B4 consolidates foreground streaming/actions; B1/B8 own launch/recovery. New boundaries remain unqualified; old guards and PS-96 failures remain below. |
| `services/relay/scripts/storage-bound.p3.bench.ts` | Retire timing entry; existing sync-bound.p1.integration.ts retains real R23 storage bound. The 10,000-update duration series is retired; no timing target was approved. |

## Mandatory guards and historical gaps

| Guard | Disposition and evidence needed |
| --- | --- |
| Empty-home interactive/API/default-tools cold start | B1; the user replaced the M5-specific target with <5,000ms on all three hosts, plus window <1,200ms, shell <3,000ms and first interaction <1,200ms. Record actual hosts; no reference machine is required. |
| Average whole-app memory | B5; fixed 30s settle/10min/100 messages/file/terminal, ≥1Hz whole owned tree. User-approved <2GB Linux RSS/macOS physical footprint, <3GB Windows private committed bytes. Native measures stay distinct; complete sampling remains required. |
| Idle renderer 2% script / 5% task; settle2s/sample10s | B4 retains the exact idle phase and numeric guards. Per-renderer coverage still needs actual-host review; one captured renderer cannot certify every live renderer. |
| Startup and recovery deadlines | B1/B8 apply the new cross-platform targets, including restored usable state <6,000ms and recovery feedback <480ms. B1 retains OS first-launch checks. Older per-host limits are superseded by this explicit decision. |
| Streaming renderer script85% / task120% | B4 retains counters/limits; task120% provides no independent responsiveness guarantee. Foreground/paint/stall/completion/cancel targets now follow the user-authorized B4 limits. |
| Monitoring main CPU10% | Still binding for the old monitoring-enabled workload; not replaced by B4's default renderer counters. Pending qualified replacement or explicit human retirement. |
| Workbench project1850ms/task525ms, hierarchy675ms/task750ms, nav875ms, tabs800ms, header425ms, side panel325ms, interaction450ms/task200ms | Old exact-workload guards unresolved. B4's changed loaded/streaming actions cannot silently inherit or waive them. PS-96 remains open. |
| Subnav structure375ms/data1525ms/editor1325ms | Changed B4 journey is not equivalent. Pending qualified replacement or explicit human disposition. |
| Planner first-card4000ms | B6 actionable first content is stronger. Old guard remains unresolved, not automatically transferred. |
| Collections temporary1250ms; product target1000ms | Unmet target remains visible; B6/B7 are not equivalent proof for every old paged collection. |
| Chat mount20000ms/switch10000ms/stream30000ms/longtask20000ms/switch-start500ms | Rich/plain/1000/5000 response variants retired as authorized; these loose old limits do not approve B4 UX. Their changed-operation guard disposition still needs human review. |
| Legacy conversion1500ms largest macrotask | Retained unchanged in ordered-legacy-backlog.p2.integration.ts with interrupted resume, xmin, exact counts and unrelated foreground work. |
| Relay R23 storage ratio1 | Existing real sync-bound integration retains the invariant. Timing benchmark retired; no timing target is claimed. |
| PS-232 removed failing quarantine | 73 distinct failing cases/93 platform entries were deleted at the user's direction; original failure evidence remains in RP-744. Retirement does not restore those contracts or close PS-96. |

B6 write amplification and B6/B7 scanned-entry ceilings are explicitly pending guards. Counters alone do not prove bounded access. No unapproved numeric ceiling has been invented; qualified evidence remains blocked until exact-workload baselines and human decisions resolve those guards.

## First-attempt evidence

- B7 local M5/16GiB: deterministic 10,000-record/three-history fixture verified. First page returned100 correct rows but scanned10,000 projection rows and traversed zero index entries; the bounded indexed-read assertion failed. Later phases did not run. This is an unresolved result, not a qualified baseline or a product repair.
- B4 first local launch attempt stopped in fixture preparation because the public UI publish build was absent. The prerequisite build was repaired; the next actual setup failed with two default-tool warnings. A focused project-creation diagnostic established local ENOSPC during real extension installation. No stream measurements ran. No setup failure is called a pass.
- At the first local update, B1/B2/B3/B5/B6/B8 and required hosted/source/signed-artifact combinations were unrun. Later hosted outcomes are retained in RP-747. The unavailable 32 GiB M5 is no longer a qualification blocker under the user's instruction. Pending numeric decisions cannot be resolved from unrun or failed phases.

## Human review and merge

Benchmark PRs carry the `benchmark` label. Agents must leave them for a human to review and merge, even when CI is green; they must not enable auto-merge, enqueue the PR, merge it directly or remove the label to bypass the rule. Human instructions still authorize semantic workload and numeric-limit changes. The catalog check validates source/manifest consistency without a deployment receipt or a separate required status. Actual-host measurements and unresolved numeric decisions remain qualification blockers.

## B6 Planner failure investigation after the platform run

The benchmark requested a data-table next-page button although Planner uses a native collection list with infinite scrolling. Its continuation action now scrolls `Collection list` and requires a newly measured cursor page, keeping the existing assertion allowance and all five journey actions. A missing cursor is an explicit failure; scrolling already-loaded rows cannot count as a page read.

There is also a real product limitation: `queryTickets` calls `readMigratedTickets`, which lists every ticket, then `runTicketsQuery` builds global timeline/review state and enriches every visible row. The view does not declare `queryMode: "paged"`. The old Mac result exposed 975 filtered tickets; Linux/Windows did not reach first actionable rows within five seconds. Fixing the locator does not establish bounded reads, remove sequential scans or qualify B6.

A product repair must preserve native-title derivation, logical tag selections, ancestor labels and global milestone/attention/review state while applying complete filters/search/order before bounded page selection. Public indexed queries, same-revision aggregates, batched identity/link reads and the existing cursor-aware native renderer provide the transport; deriving those fields from only a page would silently change results. Keep this product work and the original failures visible rather than slicing a full response or weakening the scan guard.
