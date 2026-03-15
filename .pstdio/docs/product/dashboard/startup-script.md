---
status: "draft"
created: "2026-03-15T00:00:00Z"
---

# Product Requirements Document: Dashboard Startup Script

## Summary

This PRD documents the shipped startup script editor in project settings, including draft persistence, save/cancel behavior, and API integration.

## Problem

Startup script editing is now available in the dashboard, but behavior details were not documented in a dedicated PRD.

## Goals

- Document current startup script behavior in `/projects/:projectId/settings`.
- Define draft persistence and source-of-truth rules.
- Capture API contract and clear-on-empty behavior.

## Non-Goals

- Executing startup scripts directly from the settings editor page.
- Workspace startup log viewing.
- Multi-file startup script authoring.

## Overview

The startup script editor is a section in project settings. It loads the current project startup script, allows edits in a code editor, and saves changes to the project API.

The remote project value (`projects.startup_script`) is the source of truth. The UI keeps a local draft in `localStorage` so unsaved edits survive section navigation and page refresh.

## Requirements

### Functional Requirements

1. Startup script editing is available at `/projects/:projectId/settings` under the `Startup script` section.
2. The editor must initialize from project `startup_script` when no local draft exists.
3. Unsaved edits must persist in `localStorage` per project.
4. Saving non-empty content must update the remote startup script.
5. Saving whitespace-only content must clear the remote startup script.
6. Cancel must discard local edits and restore the last saved remote value.

### UX Requirements

- Show an `Unsaved` badge whenever the draft differs from saved content.
- Disable `Save` and `Cancel` when there are no unsaved changes.
- Show a success toast on save and an error toast on failure.

### Operational Requirements

- Use project-scoped draft keys: `startup-script-draft:${projectId}`.
- Clear local draft cache after successful save and after cancel.
- Startup script execution is centralized in backend workspace creation (`POST /v1/tickets/{id}/attempts`), so the same script behavior applies to dashboard, CLI, and direct API workspace creation flows.

## Behavior

1. Opening project settings and selecting `Startup script` renders the code editor with current content.
2. Edits update the in-memory draft and persist immediately to `localStorage`.
3. If the draft differs from last saved content, the UI enters dirty state and shows `Unsaved`.
4. `Save` triggers:
   - `PUT /v1/projects/{projectId}/startup-script` when draft is non-empty.
   - `DELETE /v1/projects/{projectId}/startup-script` when draft is empty/whitespace-only.
5. After a successful save:
   - dirty state clears,
   - local draft is removed,
   - success toast is shown.
6. `Cancel` resets draft to last saved content and removes local draft.
7. On page reload, if a local draft exists it is restored instead of remote content.

## Interface

### Route

| Route | Purpose |
| ----- | ------- |
| `/projects/:projectId/settings` | Project settings page containing the startup script editor section. |

### API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/v1/projects/{projectId}/startup-script` | Read current startup script (`string` or `null`). |
| `PUT` | `/v1/projects/{projectId}/startup-script` | Set script content with `startup_script` body value. |
| `DELETE` | `/v1/projects/{projectId}/startup-script` | Clear startup script (`null`). |

### Local Draft Storage

| Key Pattern | Value |
| ----------- | ----- |
| `startup-script-draft:${projectId}` | Draft script text for that project. |

## Rules & Constraints

- Remote startup script remains authoritative; local draft is temporary UI state.
- Empty string and whitespace-only script values are treated as clear.
- Drafts are isolated per project ID.
- Workspace creation runs startup scripts in worktree mode after worktree setup and before agent session spawn.
- Startup script failures do not block workspace creation; output is persisted as workspace startup log when present.

## Errors

| Error | Cause |
| ----- | ----- |
| `Project id is required.` | Save attempted without route project ID. |
| `Save failed` toast | API mutation failed; toast description contains the underlying error message when available. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio-dashboard/src/features/project-settings/components/startup-script-editor.tsx`, `sed -n '1,220p' packages/pstdio-dashboard/src/features/project-settings/hooks/use-startup-script.ts`, `sed -n '344,520p' packages/e2e/src/ui/projects.spec.ts`
- **Expected evidence**: Unsaved badge behavior, draft persistence across navigation and reload, save/cancel draft clearing, and backend value updates.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/project-settings/`, `packages/e2e/src/ui/projects.spec.ts`
