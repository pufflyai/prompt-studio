---
id: "diff-cpu-spike-on-kanban"
status: closed
severity: "medium"
area: "dashboard"
tags: [performance, diff]
created: "2026-03-23"
---

# Use diff summaries in list views

## What went wrong

The old kanban board requested full file-by-file diffs for every ticket's latest attempt. Each request ran Git and read file contents, although each card only displayed addition and deletion totals. The API used excessive CPU and the board became slow. Requests for active attempts also repeated work while files were changing.

## How it was solved

A lightweight `GET /v1/workspaces/:id/diff-summary` endpoint returned totals without fetching file contents. List callers switched to summaries. The original board also avoided diff requests for unsettled attempts, and untracked-file counting stopped reading files sequentially.

## Current application

The summary endpoint is still used by workspace lists, session data, and extension workspace badges. The dashboard shares cached summary results.

- [Summary endpoint](../../../packages/pstdio-api/src/features/workspaces/endpoints/get-workspace-diff-summary.ts)
- [Dashboard summary data](../../../packages/pstdio-dashboard/src/shared/workspaces/workspace-diff-summary-data.ts)

## Key takeaways

- Fetch aggregates when a list only displays totals.
- Share requests for the same workspace and refresh them when relevant data changes.
- Reserve full diffs for views that display file contents.
- Check repeated I/O and membership scans when per-item work grows with a list.
