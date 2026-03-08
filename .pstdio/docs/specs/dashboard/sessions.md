---
status: draft
---

# Sessions

Browse and interact with agent sessions within a project. The sessions page provides a sidebar listing all sessions and a chat view for reading messages and sending follow-ups.

---

## Route

- `/projects/:projectId/sessions` — session list with empty chat view
- `/projects/:projectId/sessions/:sessionId` — session list with selected session chat

---

## Layout

```
+----------------------------------------------------------+
| Sessions              [+]  | Session Title       [...]   |
+----------------------------------------------------------+
|                             |                             |
| Today                       |  Message stream             |
|   o Fix auth redirect       |                             |
|   o Add dark mode           |  (user and assistant        |
|                             |   messages rendered          |
| Yesterday                   |   with tool invocations)    |
|   o Refactor queries        |                             |
|   o Settings page           |                             |
|                             |                             |
|                             | [Approval prompt]           |
|                             | [Chat input]                |
+----------------------------------------------------------+
```

The page has two sections:

1. **Sidebar** — fixed-width panel listing sessions grouped by date.
2. **Chat view** — message stream with follow-up input and approval prompts.

---

## Sidebar

### Header

- **Title** — "Sessions"
- **New session button** — icon button that navigates to `/projects/:projectId/sessions` (no session selected)

### Session list

- Sessions are grouped by date label: "Today", "Yesterday", or formatted date (e.g. "Mar 5")
- Each session shows its title and a status indicator icon
- Status indicators:
  - Completed — green check circle
  - Failed — red alert circle
  - In progress / Awaiting input — muted dashed circle
- Clicking a session navigates to `/projects/:projectId/sessions/:sessionId`
- The selected session is visually highlighted

### States

| State   | Display                                          |
| ------- | ------------------------------------------------ |
| Loading | Four skeleton rows                               |
| Empty   | Centered "No sessions yet" message               |
| Loaded  | Grouped session list with status indicators      |

---

## Chat View

### Header

- **Session title** — shows the selected session's title, or "New session" when none is selected
- **Action menu** — three-dot dropdown (shown when a session is selected)

### Message stream

Displays the session's messages streamed via SSE. Messages include:

- User messages
- Assistant messages with text, tool invocations, and reasoning
- Tool results displayed inline

When no session is selected, shows an empty state: "No session selected".

### Follow-up input

A chat input at the bottom for sending follow-up messages to the selected session.

### Approval prompt

When the agent requests tool approval, a prompt appears above the chat input with:

- Tool name
- Truncated tool input preview
- "Allow" and "Deny" buttons

---

## Action Menu

| Action               | Behavior                                              |
| -------------------- | ----------------------------------------------------- |
| Download session JSON | Exports the session as a pretty-printed JSON file    |
| Archive session      | Archives the session and navigates back to the list   |

---

## Data

The sessions page fetches:

- **Sessions list** — all sessions for the current project
- **Session detail** — full session record for the selected session (used for download)
- **Session stream** — real-time message stream via SSE for the selected session

---

## Mutations

| Action          | Method | Endpoint                             |
| --------------- | ------ | ------------------------------------ |
| Follow-up       | POST   | `/v1/sessions/:sessionId/follow-up`  |
| Approve/Deny    | POST   | `/v1/sessions/:sessionId/approve`    |
| Archive         | POST   | `/v1/sessions/:sessionId/archive`    |
| Download        | —      | Client-side JSON export via Blob API |
