---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Planner Ticket Host

## Summary

The dashboard hosts the `pstdio-planner` ticket board contributed through the
extension workbench. Ticket data, statuses, tags, files, attachments, and ticket
workflow commands belong to the planner extension.

## Problem

The old dashboard ticket pages were written as if tickets were a core dashboard
domain. That boundary is no longer correct: tickets are extension-owned state
and must be loaded or mutated through planner extension commands.

## Goals

- Describe the dashboard as a host for planner ticket contributions.
- Clarify that ticket movement, creation, archival, and row actions execute
  planner commands.
- Remove stale guidance that points implementation at dashboard ticket APIs.

## Non-Goals

- Reintroducing core ticket tables or dashboard ticket data clients.
- Adding dashboard-owned ticket file or attachment upload APIs.
- Rebuilding planner ticket workflows in dashboard feature folders.

## Overview

The planner extension declares a `tickets` page whose Main view has `kind: "kanban"`.
The view queries tickets and updates attributes through native renderer callbacks.
Row activation returns a target for the resource-bound `ticket` page.
User actions call public commands such as `pstdio.pstdio-planner.command.create-ticket`,
`pstdio.pstdio-planner.command.create-workspace`, and `pstdio.pstdio-planner.command.run-attempt`.
See [the UI declarations](../../src/ui-contributions.ts) for the current callbacks and refs.

## Requirements

### Functional Requirements

1. The dashboard must render the planner-provided ticket kanban renderer.
2. The dashboard must execute planner row actions without interpreting ticket
   storage itself.
3. Moving a row between status columns must call the planner update command.
4. Creating a row must call the planner create command.
5. Manual workspace creation must call `pstdio.pstdio-planner.command.create-workspace`.
6. Running an implementation attempt must call `pstdio.pstdio-planner.command.run-attempt`.

### UX Requirements

- Ticket rows must use the attributes returned by the planner kanban renderer.
- Row context menus must show planner row actions.
- Host-owned workspace/session sync may be combined with planner rows for
  display, but planner ticket state remains extension-owned.

### Operational Requirements

- Planner ticket statuses and tags come from planner extension storage.
- The dashboard must not import from dashboard ticket API modules to read or
  mutate planner tickets.
- Host rows such as `workspaces`, `workspace_sessions`, and `sessions` remain
  core synced tables.

## Behavior

1. Load workbench metadata for the project.
2. Render the planner `tickets` kanban renderer.
3. Execute kanban queries and mutations through the declared native renderer callbacks.
4. Execute row actions with the row id supplied by the workbench host.
5. Refresh planner queries after mutation command outcomes.

## Interface

### Route

| Surface                         | Purpose                       |
| ------------------------------- | ----------------------------- |
| Planner `tickets` kanban renderer | Extension-owned ticket board. |

### Current Visible Controls

| Control              | Behavior                                                |
| -------------------- | ------------------------------------------------------- |
| Row action menu      | Executes planner commands such as create workspace/run. |
| Column create action | Executes the planner create-ticket command.             |
| Drag and drop        | Executes the planner status update command.             |

## Rules & Constraints

- Dashboard code must know how to render a kanban renderer, not how to persist
  tickets.
- Ticket files and image attachments are surfaced by the planner ticket files
  tree, not dashboard file endpoints.
- Ticket workflow automation is configured in `pstdio-planner`.

## Errors

| Error                                | Cause                                                      |
| ------------------------------------ | ---------------------------------------------------------- |
| Ticket board remains empty after load | Planner query returned no visible ticket rows.             |
| Row action fails                      | The planner command rejected or the workbench omitted args. |

## Verification & Evidence

- **Commands to run**: `bun test extensions/pstdio-planner/extension.test.ts`
- **Expected evidence**: The planner extension contributes the `tickets` kanban
  renderer and row actions.
- **Where to find artifacts**: `extensions/pstdio-planner/extension.ts`
