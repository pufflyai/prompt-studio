---
id: "diff-cpu-spike-on-kanban"
status: closed
severity: "medium"
area: "dashboard"
tags: [performance, diff, react-query]
links:
  - issue:
  - pr:
  - adr:
created: "2026-03-23"
---

# Lessons Learned

## Summary

The kanban ticket board was fetching full file-by-file diffs for every ticket's latest attempt, causing high CPU usage on the API and slow page loads. Additionally, diffs were being requested for in-progress sessions whose worktrees were still being modified.

## Impact

Dashboard became sluggish when many tickets had active or completed attempts, especially on larger repos where full diffs are expensive.

## Detection

Observed during development — high CPU and slow responses when loading the kanban board.

## Timeline

- t1: Kanban board loads and resolves latest attempt per ticket
- t2: `useTicketAttemptDiffs` fires a full diff request per workspace
- t3: API shells out to git for each request — full content fetches + numstat per file
- t4: CPU spikes, responses slow down

## Expected behavior

Board cards only need addition/deletion totals, not full file content. Diffs for in-progress sessions are unstable and wasteful.

## Actual behavior

Every card fetched the full diff endpoint (file content + parsed diffs), including for sessions still running.

## Root cause

1. No lightweight summary endpoint existed — the only option was the full diff.
2. No guard against fetching diffs for unsettled (in-progress) sessions.
3. The `discoverChangedFiles` helper read untracked files sequentially and used an O(n*m) array filter.

## Contributing factors

- The full diff endpoint was designed for the workspace detail page where file content is needed. Reusing it for summary badges was expedient but expensive.
- No concept of "settled" session status was surfaced to the diff-fetching layer.

## Correction

1. Added `GET /v1/workspaces/:id/diff-summary` — returns only totals via `git diff --numstat`, no file content.
2. Board cards and ticket header now use the summary endpoint.
3. Diff queries are only enabled for settled sessions (completed, failed, cancelled).
4. Workspace page uses edit-action callbacks to debounce-refresh diffs during active sessions.
5. Parallelized untracked file line counting and switched array filter to a `Set` lookup.

## Corrective actions

- Always consider whether callers need the full payload or just aggregates before reusing an endpoint.

## Preventive actions

- When adding list views that show per-item data, prefer lightweight summary endpoints over reusing detail endpoints.

## Verification

1. Open kanban board with multiple attempts — confirm only summary requests fire.
2. Confirm no diff requests for in-progress sessions.
3. Open workspace page for an active session — confirm diffs refresh after edit actions.

## Key takeaways

1. List views should never fetch detail-level data per item — add summary endpoints early.
2. Guard expensive queries behind session lifecycle status to avoid wasted work.
3. Sequential I/O in loops compounds quickly — parallelize file reads and use Set for membership checks.
