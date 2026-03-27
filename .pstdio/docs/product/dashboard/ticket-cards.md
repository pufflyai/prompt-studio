---
status: "draft"
created: "2026-03-15T13:45:00Z"
---

# Product Requirements Document: Dashboard Ticket Cards

## Summary

Ticket cards are the board item surface in the dashboard tickets panel. They summarize ticket identity, hierarchy, status context, and latest attempt/session state.

## Problem

Ticket card behavior was only implicitly documented inside the broader tickets panel PRD, which left state-source rules unclear, especially for the session indicator.

## Goals

- Define the shipped ticket-card data contract and rendering behavior.
- Make session indicator status rules explicit and testable.
- Clarify which fields come from tickets, workspaces, and sessions.

## Non-Goals

- Visual redesign of the card layout.
- List-view card behavior.
- New actions beyond currently shipped click targets.

## Requirements

### Functional Requirements

1. Cards must show ticket shorthand and title.
2. Cards must show parent path when the ticket has ancestors.
3. Cards must show configured badges from the tickets display settings.
4. Cards must show latest-attempt shorthand as the session indicator label when a latest attempt exists.
5. Session indicator status must use linked `sessions.status` first.
6. If linked session status is missing, the session indicator must remain unset.
7. Diff badge counts must use the latest attempt workspace diff totals.
8. Session indicator click must open the session bubble only when a session id exists.
9. Diff badge click must open the workspace route only when diff totals and workspace shorthand exist.
10. Long unbroken strings in ticket text (for example URL-like tokens) must wrap within card bounds and must not expand kanban column width.

### Session Indicator Mapping

| Source | Value | Indicator |
| ----- | ----- | ------- |
| Session status | `in_progress` | `in_progress` |
| Session status | `awaiting_input` | `awaiting_input` |
| Session status | `completed` | `completed` |
| Session status | `failed` | `failed` |
| Session status | `cancelled` | `failed` |
| No linked session status | `null` | unset |

## Data Dependencies

- Tickets collection (`tickets`) for identity, title, and hierarchy.
- Ticket-workspace links (`ticket_workspaces`) for latest attempt candidates.
- Workspaces collection (`workspaces`) for attempt metadata and workspace lifecycle status.
- Sessions collection (`sessions`) for authoritative session lifecycle status.
- Diff endpoint (`/v1/workspaces/:id/diff`) for addition/deletion totals.

## Verification & Evidence

- **Commands to run**: `bun test src/features/ticket-list/utils/ticket-attempts.test.ts src/features/ticket-list/hooks/ticket-row-mappers.test.ts`
- **Expected evidence**: session indicator logic uses session status only and stays unset when no linked session status exists.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/ticket-list/components/tickets-board-view.tsx`, `packages/pstdio-dashboard/src/features/ticket-list/hooks/ticket-row-mappers.ts`, `packages/pstdio-dashboard/src/features/ticket-list/utils/ticket-attempts.ts`
