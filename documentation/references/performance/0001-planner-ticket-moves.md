# Planner ticket move performance

Investigated: 2026-10-14. Ticket: PS-722.

Moving one ticket repeats work for the whole board. The largest measured cost is browser rendering. Persistence and saved-view refresh add avoidable work before and after that rendering.

## Reproduce in isolation

Run from the repository root:

```sh
bun run dev:playwright -- --desktop
bun run --cwd packages/e2e src/perf/planner-moves.stress.ts
bun run --cwd extensions/pstdio-planner src/commands/reorder-ticket.stress.fixture.ts
bun run dev:playwright:down
```

The desktop option serves the built dashboard inside Docker. The diagnostic reads only that stack's `connection.json` and uses its disposable demo project. It creates tickets through Planner commands and views through the public board-view API. It does not open a database directly.

The browser test covers 50 tickets with one view, 500 with one view, 500 with fifteen views, and 1,000 with fifteen views. Each ticket has about 4 KB of instructions, a type, and a priority. Tickets occupy two status columns. Each interaction has three samples. Saved views use archive and priority filters.

The default browser CPU throttle is 4. Use `CPU_THROTTLE=1` for normal browser speed. `--resume` continues from synthetic stress data and skips smaller ticket counts. Use a fresh stack for a full comparison.

The script writes samples, screenshots, and Chromium CPU profiles under `__test-tmp__/planner-stress/<run-id>/`. It checks persisted status and relative order after moves. It has no performance pass/fail budget. Existing timeouts are unchanged.

## Results

Times below are median milliseconds from the drop event to the first animation frame with the expected card placement. This is a browser-clock measurement. It excludes setup and automation waits. A status move can appear before the following reorder and refresh finish.

| Tickets | Saved views | CPU throttle | Same-column reorder | Status move, manual order | Status move, sorted view |
| --- | --- | --- | ---: | ---: | ---: |
| 50 | 1 | 4× | 878 | 437 | 479 |
| 500 | 1 | 4× | 6,113 | 3,459 | 2,869 |
| 500 | 15 | 4× | 8,112 | 4,129 | 4,027 |
| 1,000 | 15 | 4× | 12,025 | 6,269 | 5,120 |
| 1,000 | 15 | 1× | 2,692 | 1,513 | 1,375 |

The board mounted all 500 or 1,000 cards. The manual board had 13,911 DOM elements at 500 tickets and one view, 13,939 at fifteen views, and 26,939 at 1,000 tickets and fifteen views. Extra tabs add little DOM compared with the cards.

At normal CPU speed, individual browser tasks lasted up to 670 ms during reordering. At 4× throttle, the 500-ticket/fifteen-view run reached 2,671 ms. These pauses block input and explain the visible slowdown.

Standalone API calls, with no board open, were much faster. At 500 tickets, reorder samples took 227–341 ms and board queries took 21–47 ms. At 1,000 tickets, reorder samples took 313–580 ms and queries took 29–41 ms. Browser-observed request durations also include delays while the browser is busy; they are not pure server timings.

One initial 1,000-ticket/4× sample exceeded the 30-second wait for expected ordering. Later runs of the same workload completed with the unchanged timeout. The initial failure profile is retained; its specific cause was not isolated. Do not treat it as a measured 30-second paint duration.

## Confirmed causes

### Every reorder rewrites every active ticket

[reorderTicket](../../../extensions/pstdio-planner/src/commands/reorder-ticket.ts) lists all tickets, calculates sequential positions, then calls `collection.put` for every active record. It also writes records whose positions did not change.

The storage diagnostic swapped two adjacent tickets. At 500 tickets, it made 500 writes, including 498 identical writes. At 1,000, it made 1,000 writes, including 998 identical writes. Each write includes the full ticket body and any inline attached text files. The storage API runs a separate upsert for each call.

The command then returns the entire reordered ticket array. The board caller ignores that value. The HTTP response was 2.26 MB at 500 tickets and 4.52 MB at 1,000, measured as decoded JSON bytes.

### One manual move produces two mutations and repeated reads

[applyBoardMoveItem](../../../packages/ui/src/components/kanban-renderer/kanban-renderer-board-move.ts) first changes the grouping attribute and then reorders the ticket. It changes the status even when the ticket stays in its current column. Each Planner handler emits `tickets.changed`.

Every measured manual move made two visible board queries. Sorted moves made one query and skipped reorder. Row grouping can add another attribute mutation. The board receives an intermediate snapshot, then another complete snapshot after reorder.

### Saved-view metadata reloads on ordinary ticket changes

[createSharedCollectionViews](../../../packages/pstdio-dashboard/src/shared/collections/collection-views.ts) uses the board's content refresh events to reload saved views. This happens even when no view or filter field changed.

The captured 1,000-ticket run made two `GET /boards/.../views` requests per manual move and one per sorted move. Each view-list read calls [resolveBoardFields](../../../packages/pstdio-api/src/features/views/resolve-board.ts), which runs the full Planner query to discover its attributes. These server-side queries are additional to the board queries visible as command requests. View validation and cleanup then inspect all saved views.

Fifteen views made the measured 500-ticket interactions slower, but the test does not establish a universal percentage or a special threshold at ten views.

### The renderer rebuilds and renders the full board

[KanbanRenderer](../../../packages/ui/src/components/kanban-renderer/kanban-renderer.tsx) builds both list items and board items on every render. Both paths build badges and context-menu actions for rows. [KanbanRendererBoard](../../../packages/ui/src/components/kanban-renderer/kanban-renderer-board.tsx) mounts every card instead of limiting mounted cards to the visible area.

The [query adapter](../../../packages/pstdio-workbench/src/extensions/contributions/kanban-renderer-contributions.ts) publishes fresh attribute descriptors and maps every row to a new object on each query. Unchanged tickets therefore receive new inputs after every move.

CPU profiles show substantial work in Chakra's style hashing/cache lookups, React rendering, scroll-area code, and browser work. The shipped Chakra `memo` and `simpleHash` functions were identified in the built bundle and checked against the installed source. This supports reducing render count and mounted cards; it does not prove the library itself needs replacement.

### Board reads load more data than the visible action needs

[runTicketsQuery](../../../extensions/pstdio-planner/src/data/query.ts) reads full stored tickets, tags, statuses, the plan, and review requests. It rebuilds the plan and maps every ticket for each refresh. [queryTickets](../../../extensions/pstdio-planner/src/commands/query-tickets.ts) also reloads workspaces and sessions for linked workspaces.

The synthetic project had no linked ticket workspaces, dependencies, review requests, or large attached files. Those paths can add cost in real projects and need a later representative workload.

## Improvement order

1. **Reduce mounted and repeated UI work.** Virtualize cards within each board column, including variable-height cards and drag scrolling. Build only the active list or board presentation. Preserve unchanged row references and publish schema changes only when the schema changes. This targets the largest measured cost in the shared UI/workbench layers.
2. **Make ordering writes proportional to the move.** First stop writing unchanged records and returning unused full-ticket arrays. Then use the existing numeric `sortOrder` to assign a position between neighboring tickets, with a defined rebalance when no representable gap remains. Ordering stays owned by Planner; this does not require a core database schema change. Prove ordering, filtered-board moves, concurrent writes, and rebalance behavior before adopting it.
3. **Commit a board move once.** Apply the necessary status, row-group, and order changes as one logical operation, with one refresh event. Skip unchanged attributes. Add a shared move handler if the current renderer contract cannot express this. Keep and deprecate the existing public SDK callbacks according to the extension API versioning rules.
4. **Separate view-schema invalidation from ticket-content invalidation.** Reload and clean saved filters when statuses, tags, or other filter fields change. Ordinary ticket moves should not trigger that cleanup. Preserve the current behavior for deleted options and shared view edits.
5. **Show direct moves immediately.** Put one optimistic move owner in the existing read/mutation flow. Restore the affected row on failure and preserve newer moves. Avoid an older query snapshot undoing a newer local move. This follows the shared design rule for direct actions.
6. **Narrow board reads where measurement still warrants it.** Avoid loading descriptions and attached text for metadata-only reads. Compute only the timeline properties the board needs. Keep derived data owned by Planner and invalidate it from its real inputs; do not add a second persisted board copy.

Keep this workload when comparing implementations. Check visible feedback, browser long tasks, mounted-card count, storage writes, response bytes, and total queries. Choose a move-latency budget separately before adding a CI gate.

These changes belong in Planner for ticket storage and ordering, and in the shared UI/workbench for generic rendering and move behavior. They do not move Planner product features into core.

## Evidence and validation

- `1791928856868`: built-dashboard 50/one-view and both 500-ticket cases at 4× CPU; initial 1,000-ticket failure profile.
- `1791959409930`: all nine 1,000-ticket/fifteen-view interactions at normal CPU speed.
- `1791959505056`: all nine 1,000-ticket/fifteen-view interactions at 4× CPU, with saved-view request capture.
- Eight existing reorder/attribute tests passed.
- Planner package type checking passed.
- Focused TypeScript and Biome checks passed for the diagnostic files.
- The broader e2e package type check reports existing errors outside these files. No application behavior was changed in this investigation.

The report and raw samples are attached to PS-722. Profiles and screenshots remain in the evidence folders above. Historical samples include an experimental wall-clock completion field. It was removed from the harness because a clock jump made it unreliable. The table uses only monotonic browser `performance.now()` measurements.

See the [testing guide](../../guides/development/0002-testing.md), [renderer refresh lifecycle](../extensions/0012-renderer-edit-refresh-lifecycle.md), [extension API versioning](../extensions/0014-api-versioning.md), and [previous board I/O lesson](../../lessons-learned/0005-diff-cpu-spike-on-kanban.md).

## PS-727 implementation and comparison

Implemented: 2026-10-14. The sections above preserve the original PS-722 investigation, including its timeout. Their cause descriptions describe the old code.

### Final design

Planner assigns a moved ticket a numeric position between its active neighbors. It writes only changed records and returns a compact changed count. When no numeric gap remains, it rebalances the active order and still skips unchanged records. Hidden filtered rows keep their global order; archived tickets do not enter active ordering. The existing ticket-order write guard serializes ownership: a competing writer receives a busy error and can retry. Tests cover that retry, no-ops, filtered order, and rebalance.

The public renderer adds `onMove`, which carries the complete column, row-group, and optional manual-order intent. Planner validates it before writing and emits one final content event. Sorted moves omit manual order. The old public reorder callback remains deprecated for the API transition. The extension API becomes 0.1.6. No database migration or duplicate persisted board state is added.

The shared read/mutation owner previews each move, serializes saves, rejects stale reads, and removes only a failed action from its pending journal. Later actions retain their full destination intent. Reconnecting the same query keeps this owner. The existing refresh path reconciles the saved state after pending actions settle.

Cards are virtualized per column with variable-height measurement and overscan. Drag sources, focused entries, and reveal targets stay mounted. Group and row keys include the column and group membership. Column totals count unique rows. Only the active presentation builds data; offscreen card badges and menu actions are lazy. The workbench retains unchanged rows and avoids publishing unchanged schema.

A separate schema event invalidates saved-view metadata on status/tag changes. Content events still refresh cards. View changes and reset recovery keep their existing paths. An omitted schema event list keeps legacy behavior; an explicit empty list disables content-based metadata refresh.

### Comparable measurements

All four cases retain the original roughly 4 KB ticket bodies, three scenarios, and three samples per scenario. Both baseline CPU runs used unchanged main commit `265612a1e4be392279d1fe25d385f1a28ca55d31`. Both implementation runs used the built Docker dashboard with Chromium 148.0.7778.96 through Playwright. The final 1× run includes the last grouped-key fix; the 4× run predates that grouped-only correction and uses an ungrouped baseline.

Each value is the median of three samples. Arrows show before → after in milliseconds.

| Tickets | Views | CPU | Reorder placement | Manual status placement | Sorted status placement |
| ---: | ---: | --- | ---: | ---: | ---: |
| 50 | 1 | 4× | 1,275 → 123 | 1,048 → 119 | 545 → 116 |
| 500 | 1 | 4× | 6,519 → 110 | 3,493 → 125 | 3,716 → 122 |
| 500 | 15 | 4× | 8,742 → 128 | 3,542 → 120 | 4,371 → 122 |
| 1000 | 15 | 4× | 11,395 → 123 | 6,426 → 131 | 6,997 → 126 |
| 50 | 1 | 1× | 232 → 23 | 118 → 25 | 141 → 24 |
| 500 | 1 | 1× | 1,618 → 28 | 807 → 27 | 843 → 25 |
| 500 | 15 | 1× | 1,495 → 29 | 772 → 28 | 834 → 28 |
| 1000 | 15 | 1× | 2,949 → 31 | 1,516 → 33 | 1,536 → 30 |

The next table reports network completion on the monotonic browser clock. Triples are reorder / manual status / sorted status. Persistence is the final mutation response end; refresh is the last board-query response end. They do not include React rendering after that response. Placement can precede either, so optimistic paint alone is not completion evidence.

| Tickets | Views | CPU | Persistence before → after | Refresh before → after | Maximum long task before → after |
| ---: | ---: | --- | --- | --- | ---: |
| 50 | 1 | 4× | 677 → 147 / 687 → 137 / 16 → 131 | 926 → 200 / 972 → 464 / 117 → 305 | 227 → 125 |
| 500 | 1 | 4× | 3,298 → 138 / 3,524 → 150 / 16 → 149 | 3,411 → 182 / 3,708 → 492 / 535 → 379 | 1643 → 150 |
| 500 | 15 | 4× | 5,863 → 173 / 12,876 → 144 / 458 → 148 | 6,201 → 230 / 14,390 → 466 / 1,712 → 310 | 1493 → 127 |
| 1000 | 15 | 4× | 6,035 → 161 / 7,071 → 167 / 16 → 161 | 6,239 → 226 / 7,358 → 493 / 863 → 342 | 3454 → 154 |
| 50 | 1 | 1× | 73 → 46 / 66 → 41 / 15 → 45 | 151 → 61 / 148 → 84 / 50 → 72 | 0 → 0 |
| 500 | 1 | 1× | 871 → 56 / 813 → 52 / 13 → 52 | 950 → 80 / 900 → 113 / 161 → 82 | 374 → 0 |
| 500 | 15 | 1× | 803 → 57 / 781 → 54 / 14 → 54 | 929 → 85 / 864 → 114 / 163 → 86 | 354 → 0 |
| 1000 | 15 | 1× | 1,557 → 71 / 1,596 → 83 / 14 → 76 | 1,749 → 126 / 1,707 → 150 / 298 → 133 | 705 → 0 |

Mounted cards fell from 50/500/1,000 to 26 in the baseline viewport. At 1,000 tickets, DOM elements fell from 26,956 to 1,664. Ordinary manual moves now make one board query and zero saved-view reads, compared with two of each. Sorted moves make one board query and zero saved-view reads.

An adjacent reorder now writes one record, zero unchanged records, and 4,356 stored bytes at every tested size. Previously the 1,000-ticket case wrote 1,000 records, 998 unchanged, and about 4.36 MB. The board move response is 429 decoded JSON bytes; the old reorder response was about 4.52 MB at 1,000 tickets. Standalone 1,000-ticket reorders now took 22–23 ms and queries 29–38 ms in the final 4× run.

Sorted mutation completion was already cheap in the baseline and is slower with the combined path, particularly under CPU throttle. The complete action still paints sooner and cuts rendering pauses. At 500/one-view/4×, sorted query-response completion fell from 535 to 379 ms, while the 50-ticket sorted case increased from 117 to 305 ms. No latency budget was invented and no timeout was raised.

### Supplemental validation and limits

The supplemental case keeps all 1,000 tickets and adds 20 attached text files (1,380,000 bytes), nineteen dependency edges, two real linked workspaces, four open review requests, and variable title heights. Playwright checks keyboard navigation, menus, vertical drag scrolling, a rejected save followed by a later successful destination, persisted order, reload, a second client, group collapse/expansion, and grouped focus/drag pinning.

The supplemental case proves functional behavior; it is not a separate latency benchmark. Planner queries still read full records and rebuild derived metadata. The smaller query count removes repeated work, but further read narrowing needs measurements for a representative project. Milestone-plus-ticket moves use the existing guarded plan storage and are a logical operation, not a new database transaction.

SDK/host and Planner changes ship in separate PRs under the extension repository rules. The Planner PR waits for the SDK merge and published release, then needs its SDK dependency updated. No compatibility workaround was added.

### Retained implementation evidence

- Clean baseline 4×: `1791971623206`; clean baseline 1×: `1791972192041`.
- Final implementation 4×: `1791973077973`; final implementation 1×: `1791973689224`.
- Earlier implementation/baseline samples are retained in the change request report.
- Run `bun run --cwd packages/e2e src/perf/planner-moves.validation.ts` after the full workload for supplemental checks.
- Targeted behavior tests, package type checks, scoped Biome checks, packaged smoke, and `bun run --cwd scripts verify:packages` passed locally. Independent review RP-642 found no remaining issues.
- Change request reports RP-645 and RP-649 contain samples, profiles, screenshots, and command logs.
