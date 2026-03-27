---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Tickets

## Summary

The dashboard tickets panel is a status-grouped board for browsing, moving, creating, and archiving project tickets.

## Problem

The legacy tickets PRD described display controls and alternate views that are not currently exposed in the shipped dashboard.

## Goals

- Describe the shipped board behavior accurately.
- Clarify how ticket movement and creation work.
- Remove stale documentation for controls that are not visible.

## Non-Goals

- A user-facing display settings menu.
- A user-facing list view toggle.
- Archived ticket browsing inside the tickets panel.

## Overview

The tickets panel lives at `/projects/:projectId/tickets`. It loads project metadata and project tickets, filters out archived tickets, groups tickets by status, and renders the result as a board.
Ticket-card behavior and data-source rules are specified in `/product/dashboard/ticket-cards`.

## Requirements

### Functional Requirements

1. Tickets must be grouped by project status and rendered as columns.
2. Archived tickets must be excluded from the panel.
3. Moving a ticket between columns must update the target status.
4. Dropping a ticket into another status updates status.
5. Columns that expose `archive_all` must archive every visible ticket in that column when the action is triggered.
6. A create-ticket modal must be available from statuses that allow creation.
7. Creating a ticket with a selected template must auto-start a refine session for the new ticket using that template and open the session bubble.

### UX Requirements

- The panel header must expose the view title.
- Ticket cards must show shorthand, title, parent path when applicable, and the currently configured badges.
- Ticket card session indicators must reflect linked `sessions.status` when present.

### Operational Requirements

- Ticket statuses and tags come from the current project.
- Ticket templates shown in the create modal come from project template assets with type `ticket`.
- Template-based ticket creation reuses the last selected agent/model from project settings to create the refine session.

## Behavior

1. Load the current project and all project tickets.
2. Drop archived tickets from the visible set.
3. Group the result by status and render a board column for each group.
4. When a ticket is moved, update its status.
5. When a user creates a ticket, write the editor content as both title and content, with optional status and parent id.
6. When ticket creation includes a template, immediately start a session with `refine ticket: <ticket-shorthand> with template <template-name>` and open it in the session bubble.

## Interface

### Route

| Route                          | Purpose             |
| ------------------------------ | ------------------- |
| `/projects/:projectId/tickets` | Main tickets board. |

### Current Visible Controls

| Control              | Behavior                                            |
| -------------------- | --------------------------------------------------- |
| Column create action | Opens the create-ticket modal for that status.      |
| Drag and drop        | Moves a ticket to another status.                   |
| Column action menu   | Supports `archive_all` when provided by the status. |

## Rules & Constraints

- The shipped UI currently uses the default display settings only: board view, grouping by status, and ordering `manual`.
- Archived tickets are hidden instead of toggleable.
- Implementation automation is configured through hooks, not through status metadata.

## Errors

| Error                                              | Cause                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Ticket board remains empty after load              | No non-archived tickets matched the current project.                             |
| Template refine session does not open after create | Ticket creation succeeded but session creation failed or returned no session id. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,260p' packages/pstdio-dashboard/src/features/ticket-list/pages/tickets-panel.tsx`
- **Expected evidence**: The panel uses default board settings, filters archived tickets, updates status on drop, and starts refine sessions from template-based ticket creation.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/ticket-list/`
