# Frozen workload migration and qualification ledger

Proposed: 2026-11-14. Status: implementation candidate; **not qualified**.

PS-233 is the user's one-time authorization for the exact eight scenarios. [Manifest](../../../packages/benchmarks/src/catalog/scenarios.ts), [lock](../../../packages/benchmarks/catalog.lock.json), [guidance](../../guides/development/0016-writing-benchmarks.md). Benchmark changes carry the `benchmark` PR label and are left for human review and merge. No new numeric latency limit has been approved.

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
| M5 2s empty-home interactive/API/default-tools cold start | B1; numeric target and readiness boundary retained. Exact 10-core/32 GiB M5 proof is optional, per the user's instruction, and is not a suite/release qualification blocker. Record actual hosts separately. |
| M5 2GB average physical footprint | B5; fixed 30s settle/10min/100 messages/file/terminal, ≥1Hz whole owned tree. Exact M5 reference proof is optional; complete valid physical sampling remains required. RSS/heap cannot substitute. |
| Idle renderer 2% script / 5% task; settle2s/sample10s | B4 retains the exact idle phase and numeric guards. Per-renderer coverage still needs actual-host review; one captured renderer cannot certify every live renderer. |
| Hosted startup window and shell deadlines; recovery feedback500ms | B1/B8 retain matching existing budget constants. Complete usable journeys have separate unqualified clocks. B1 must retain OS first-launch checks. |
| Streaming renderer script85% / task120% | B4 retains counters/limits; task120% provides no independent responsiveness guarantee. New foreground/paint/stall/completion/cancel guards pending human baseline decisions. |
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
