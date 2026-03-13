---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Ticket Detail

## Summary

The ticket detail panel is the dashboard workspace for reading and editing one ticket's content, viewing its latest attempt state, and launching related ticket workflows.

## Problem

The old ticket detail PRD described broader editing behavior than the current UI actually exposes. The current doc should match the shipped panel.

## Goals

- Document the current ticket detail layout and actions.
- Clarify which ticket fields are editable in the panel.
- Describe the session and workspace launch points tied to a ticket.

## Non-Goals

- A full ticket form that edits every field inline.
- Direct status editing from the detail panel.
- A separate process inspector PRD while that surface is still evolving.

## Overview

The panel lives at `/projects/:projectId/tickets/:ticketShorthand`. It loads the target ticket, its markdown content, related tickets, project metadata, template assets, sessions, and the latest attempt diff.

## Requirements

### Functional Requirements

1. Ticket markdown content must be editable with autosave.
2. The header must expose ticket navigation plus ticket actions.
3. The panel must support starting a run attempt for the ticket and surfacing success/failure clearly.
4. The sidebar must expose ticket properties, sub-tickets, and attached files.
5. Users must be able to create sub-tickets, break a ticket into sub-tickets, refine a ticket, archive a ticket, and delete a ticket.

### UX Requirements

- Breadcrumbs must show the parent ticket path when a parent exists.
- The detail sidebar must be collapsible.
- When the latest attempt exists, the header should show attempt count and latest diff totals.

### Operational Requirements

- Ticket templates shown in the sub-ticket and refinement flows must come from project ticket templates.
- The panel must flush pending autosaves before navigating back to the tickets board.

## Behavior

1. Resolve the ticket from the project ticket list by shorthand.
2. Load ticket markdown content and keep an autosave buffer for edits.
3. Compute the latest attempt from the ticket's attempts and fetch its diff totals.
4. Expose header actions for running an attempt, viewing the latest workspace, creating sub-tickets, refining, breaking down, archiving, and deleting.
5. Render a sidebar with ticket metadata, parent and dependency links, tag editing, sub-ticket navigation, and file listings.

### Run Attempt Flow

1. When no attempts exist, the header shows `Run attempt` and opens the create-workspace modal.
2. Confirming run attempt calls `POST /v1/tickets/:ticket_id/attempts` with agent/repo/branch/model context.
3. On success, the modal closes and table-sync updates make the new attempt/session visible without manual refresh.
4. On failure, the modal stays open and a toast is shown via `createAttemptDialog.error`.
5. When attempts exist, the header button opens the latest workspace directly (`View workspace` behavior).

## Interface

### Route

| Route | Purpose |
| ----- | ------- |
| `/projects/:projectId/tickets/:ticketShorthand` | Ticket detail page. |

### Header Actions

| Action | Behavior |
| ------ | -------- |
| Run attempt | Starts an attempt using current content fallback to title, creates workspace + session, and closes the modal only on success. |
| View workspace | Opens the latest attempt workspace when one exists. |
| Create sub-ticket | Opens the create-ticket modal with the current ticket as parent. |
| Break into sub-tickets | Starts a session using the built-in breakdown prompt. |
| Refine ticket | Starts a session using the built-in refinement prompt. |
| Archive / unarchive | Toggles the archived flag. |
| Delete | Deletes the ticket, then returns to the board. |

## Rules & Constraints

- The markdown editor is the only direct content editor in the panel.
- Complexity and tags are editable in the sidebar; most other properties are read-only.
- The workspace shortcut only targets the latest attempt, not an arbitrary historical attempt.

## Errors

| Error | Cause |
| ----- | ----- |
| `ticketNotFound` state | The shorthand does not resolve to a ticket in the current project. |
| Missing workspace navigation | The ticket has no latest attempt yet. |
| `createAttemptDialog.error` toast | Attempt creation request fails; modal remains open so the user can retry. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,260p' packages/pstdio-dashboard/src/features/ticket/pages/ticket-details-panel.tsx`
- **Expected evidence**: Autosave, header actions, sub-ticket creation, refinement, and sidebar editing are all present in the shipped panel.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/ticket/`
