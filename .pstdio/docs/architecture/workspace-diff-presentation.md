# Workspace Diff Presentation

How pstdio presents workspace diffs to users in the dashboard.

## Scope

Covers the workspace screen and diff summary badges:

- Route: `/projects/:projectId/tickets/:ticketShorthand/workspaces/:workspaceShorthand`
- Diff source: `GET /v1/workspaces/:id/diff`
- Renderer: right-side workspace diff panel

## Where Users See Diffs

### 1) Ticket board cards (summary only)

Each ticket card resolves its latest attempt and shows addition/deletion totals via a diff badge. Clicking the badge opens the workspace page for that attempt.

### 2) Ticket details header button (summary only)

Shows attempt count and latest diff totals. Clicking opens the latest workspace when attempts exist.

### 3) Workspace page right panel (Checks + Changes tabs)

The selected attempt is resolved from route params. The right panel exposes two tabs:

- `Changes`: full file-by-file diff rendering for the selected attempt.
- `Checks`: ticket artifact browsing and artifact content rendering.

## End-to-End Flow

```mermaid
sequenceDiagram
  participant User
  participant Dashboard
  participant API as pstdio-api
  participant Git as pstdio-wt (git)

  User->>Dashboard: Open workspace attempt
  Dashboard->>API: GET /v1/workspaces/:id/diff
  API->>Git: Resolve base via reflog fork point (preferred) or merge-base fallback
  API->>Git: Generate and parse unified diff
  API-->>Dashboard: { files, totals }
  Dashboard-->>User: File cards with inline Monaco diffs
```

## Backend Diff Generation

### Endpoint

`GET /v1/workspaces/:id/diff` in `pstdio-api`.

### Validation

1. Resolve workspace by id
2. Require worktree path
3. Require and resolve associated repository

Returns typed errors (400/404) on failure.

### Diff Calculation

Handled by `pstdio-wt`:

1. **Resolve base commit** (`resolve-base.ts`): prefer the reflog fork point (the commit the worktree branch was created from), falling back to `merge-base HEAD main/master`, then the repo root commit.
2. **Discover changed files**: union of `git diff --name-status <base> HEAD` (committed), `git diff --name-status HEAD` (uncommitted), and `git ls-files --others --exclude-standard` (untracked).
3. **Full diff**: fetch old/new content and numstat per file. **Summary**: aggregate numstat totals without reading file content.

The user sees everything the attempt changed since the branch was created. Both committed and uncommitted worktree changes are included.

### Response Shape (full diff)

- `workspace_id` — the attempt identifier
- `files` — parsed per-file diff objects
- `totals` — additions, deletions, file count

### Response Shape (summary)

A lightweight `GET /v1/workspaces/:id/diff-summary` endpoint returns totals only — no file content:

- `workspace_id` — the attempt identifier
- `additions` — total added lines
- `deletions` — total removed lines
- `file_count` — number of changed files

Used by ticket board cards and the ticket details header to avoid fetching full file diffs.

## Frontend Rendering Pipeline

### Fetching

- **Board cards and ticket header**: use the lightweight diff-summary endpoint. Queries are only enabled for settled sessions (completed, failed, cancelled) to avoid unnecessary load while agents are still running.
- **Workspace page**: fetches the full diff only once the session has settled. While the session is in progress, edit actions (write/execute tool completions) trigger a debounced re-fetch (2 s) so the diff panel updates incrementally.
- Refetches on window focus

### Type Mapping

API file diff objects are transformed into UI diff types. Rename paths fall back to the primary file path when absent.

### Panel Layout

- Workspace panel remains visible even when there are no diffs
- Tab strip is always visible with `Changes` and `Checks`
- `Changes` tab shows the existing diff drawer flow, including the no-diff empty state
- `Checks` tab shows artifact list + selected artifact content

### File Cards

One card per changed file, expanded by default:

- **Modified/Added**: normal file path in header
- **Deleted**: struck-through file path
- **Renamed**: old path arrow new path
- Addition/deletion counts shown as a badge
- Body renders a read-only inline Monaco diff editor

## Checks Tab

Artifacts come from `GET /v1/tickets/:ticketId/files` in `pstdio-api`. They are listed per ticket (not per attempt), with file extension stripped from the display label.

Artifact content is fetched from `GET /v1/tickets/:ticketId/files/:fileId/content` when an item is selected.

Selection behavior:

- First artifact is selected by default
- If the current selection disappears after refresh, selection resets to the first artifact
- If there are no artifacts, the tab shows an artifact empty state

Loading behavior:

- While content is loading, show a spinner in the content pane
- Once loaded, render content as preformatted text

## Errors and Empty States

### API errors

- 404 — workspace or repository not found
- 400 — workspace missing worktree or repository association
- 500 — git diff failure

### UI behavior

- No workspace selected: diff query disabled
- No files: `Changes` tab shows an empty state
- No artifacts: `Checks` tab shows an empty state
- Artifacts but no files: users can still inspect artifacts in `Checks`

## Verification

1. Open a ticket with at least one attempt
2. Navigate to the workspace route for that attempt
3. Open `Changes` and confirm one diff card per changed file (or empty state when none)
4. Open `Checks` and confirm artifact list appears (or empty state when none)
5. Select an artifact and confirm file content renders
6. Edit files in the attempt worktree and wait up to 5 seconds
7. Confirm diff totals and file contents refresh automatically
