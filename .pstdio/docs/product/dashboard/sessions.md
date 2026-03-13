---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Sessions

## Summary

The dashboard sessions panel is the read-and-continue surface for project sessions. It lists existing sessions, streams the selected conversation, and lets the user send follow-ups or resolve approval prompts.

## Problem

The previous sessions PRD implied a fuller session creation workflow than the current dashboard actually ships.

## Goals

- Describe the current session list and chat experience.
- Make approval handling and follow-up behavior explicit.
- Remove stale documentation for unshipped session-creation UI.

## Non-Goals

- A complete dashboard form for creating a new session.
- Advanced filtering controls in the sessions panel.
- A separate review UI distinct from the chat surface.

## Overview

The sessions panel lives at:

- `/projects/:projectId/sessions`
- `/projects/:projectId/sessions/:sessionId`

It loads project sessions, groups them by date in the left rail, and renders the selected session in a chat panel.

## Requirements

### Functional Requirements

1. The panel must list project sessions and let the user select one.
2. The selected session must stream live updates into the chat view.
3. Follow-up prompts must be sent from the chat input for the selected session.
4. Approval prompts must support approve and deny actions.
5. The action menu must support downloading the selected session and archiving it.

### UX Requirements

- The left rail should clearly indicate the selected session.
- An empty state should appear when no session is selected.
- Session grouping should be date-based for quick scanning.
- Follow-up submissions should appear immediately with a temporary "Thinking..." assistant placeholder.
- After sending a follow-up, focus stays in the chat composer.

### Operational Requirements

- The streaming view depends on the live session stream hook.
- The panel should prefer fully loaded session details when available for downloads.

## Behavior

1. Load the current project's sessions.
2. Group sessions by date and render them in the left rail.
3. When a session is selected, open its streamed chat history in the right pane.
4. Use the chat input to send follow-up prompts to the selected session.
5. Show the submitted follow-up immediately with a temporary "Thinking..." assistant placeholder.
6. Keep the chat composer focused after a follow-up submit.
7. Clear the optimistic follow-up placeholder when stream history advances or the follow-up fails.
8. If the stream exposes a pending approval request, render approve and deny controls above the chat input.
9. The "new session" button currently clears the selection; it does not create a session by itself.

## Interface

### Routes

| Route | Purpose |
| ----- | ------- |
| `/projects/:projectId/sessions` | Show the list with no selected session. |
| `/projects/:projectId/sessions/:sessionId` | Show the selected session. |

### Current Actions

| Action | Behavior |
| ------ | -------- |
| Select session | Opens that session in the chat view. |
| Send follow-up | Calls the follow-up mutation for the current session. |
| Approve / deny | Resolves the current approval request. |
| Download | Exports the current session as JSON. |
| Archive | Archives the selected session and returns to the list state. |

## Rules & Constraints

- The shipped panel is centered on continuing existing sessions.
- There is no dashboard-native flow yet that persists a brand new session from the empty state.
- Approval handling only appears when the session stream exposes a pending tool request.

## Errors

| Error | Cause |
| ----- | ----- |
| Empty chat state | No session is currently selected. |
| Missing approval controls | The selected session has no pending approval request. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,260p' packages/pstdio-dashboard/src/features/sessions/pages/sessions-panel.tsx`
- **Expected evidence**: Session selection, follow-up messaging, approval handling, download, and archive actions are all present, while new-session creation is not.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/sessions/`
