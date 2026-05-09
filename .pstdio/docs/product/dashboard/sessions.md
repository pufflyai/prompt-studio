---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Sessions

## Summary

The dashboard sessions panel is the read-and-continue surface for project sessions. It lists existing sessions, streams the selected conversation, and lets the user send follow-ups or resolve approval prompts.

## Goals

- Describe the current session list and chat experience.
- Describe dashboard-native session creation from the chat composer.
- Make approval handling and follow-up behavior explicit.
- Define how agent and model selection behave for new and existing sessions.

## Non-Goals

- A separate full-page form for creating a new session.
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
3. When no session is selected, sending a chat message must create a new session.
4. Follow-up prompts must be sent from the chat input for the selected session.
5. Approval prompts must support approve and deny actions.
6. The action menu must support downloading the selected session and archiving it.
7. Active sessions must be cancellable from the chat composer stop button.
8. The agent browser must send the selected agent and selected model for new sessions and follow-ups.

### UX Requirements

- The left rail should clearly indicate the selected session.
- An empty state should appear when no session is selected.
- Session grouping should be date-based for quick scanning.
- New-session and follow-up submissions should appear immediately with a temporary "Thinking..." assistant placeholder.
- After sending a message, focus stays in the chat composer.
- For running or awaiting-input sessions, the composer send button becomes the stop action.
- Draft chat input text should persist per session, including the new-session composer.
- The chat composer should stop growing after a maximum height and become scrollable.

### Operational Requirements

- The streaming view depends on the live session stream hook.
- The panel should prefer fully loaded session details when available for downloads.

## Behavior

1. Load the current project's sessions.
2. Group sessions by date and render them in the left rail.
3. When a session is selected, open its streamed chat history in the right pane.
4. When no session is selected, use the chat input to create a new session.
5. Use the chat input to send follow-up prompts to the selected session.
6. Show the submitted prompt immediately with a temporary "Thinking..." assistant placeholder.
7. Keep the chat composer focused after submit.
8. Clear the optimistic placeholder when stream history advances or the request fails.
9. If the stream exposes a pending approval request, render approve and deny controls above the chat input.
10. If the selected session is running or awaiting input, use the chat composer stop action to abort the active provider session and mark it cancelled.
11. The "new session" button clears the selection; the next submitted message creates the new session.
12. Preserve unsent chat drafts independently for each session and for the new-session state while switching layouts.
13. Keep the chat input area scrollable after it reaches its max height so messages stay visible.

## Agent and Model Selection

1. For a new session, the selected agent and model in the agent browser are authoritative.
2. For an existing session, the chat view first initializes the agent browser from the session's `agent` and `lastSelectedModel`.
3. After initialization, the user can keep or change the selected model before sending a follow-up.
4. The submitted request body uses `model` for the currently selected model on that request.
5. The persisted session field is `last_selected_model` in the API/DB and `lastSelectedModel` in dashboard state. It is the latest selected model, not an immutable session model.

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
| Send new-session prompt | Calls the create-session mutation with the selected agent and model. |
| Send follow-up | Calls the follow-up mutation for the current session with the selected agent and model. |
| Stop session | Aborts the active provider session, marks the session as cancelled, and keeps the user on the chat route. |
| Approve / deny | Resolves the current approval request. |
| Download | Exports the current session as JSON. |
| Archive | Archives the selected session and returns to the list state. |

## Rules & Constraints

- The shipped panel supports both creating a session from the no-session state and continuing existing sessions.
- A session can change model across turns; display and storage must use last-selected terminology.
- Approval handling only appears when the session stream exposes a pending tool request.

## Errors

| Error | Cause |
| ----- | ----- |
| Empty chat state | No session is currently selected. |
| Missing approval controls | The selected session has no pending approval request. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,260p' packages/pstdio-dashboard/src/features/sessions/components/session-chat-view.tsx`
- **Expected evidence**: Session selection, new-session creation from the composer, follow-up messaging, approval handling, download, and archive actions are all present.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/sessions/`
