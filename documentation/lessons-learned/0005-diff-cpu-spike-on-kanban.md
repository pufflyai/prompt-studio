# Use summaries in list views

## 1. When to use

- Building lists, badges, or dashboards that show totals from expensive data.

## 2. Failure

- Board cards requested full file diffs to display addition and deletion totals. Per-item Git calls and file reads made the API slow.

## 3. Prevention

- Fetch aggregates when the view only displays totals.
- Reuse cached results for the same workspace and refresh them when relevant data changes.
- Reserve full diffs for views that display file contents.
- Check repeated I/O and membership scans as the number of items grows.

## 4. Evidence

- [Diff summary endpoint](../../packages/pstdio-api/src/features/workspaces/endpoints/get-workspace-diff-summary.ts)
- [Shared summary data](../../packages/pstdio-dashboard/src/shared/workspaces/workspace-diff-summary-data.ts)
