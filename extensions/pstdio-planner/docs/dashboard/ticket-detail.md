---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Planner Ticket Detail Host

## Summary

The dashboard hosts planner ticket detail views contributed by the
`pstdio-planner` extension. The planner extension owns ticket content, files,
attachments, and ticket workflow commands.

## Problem

The old ticket detail PRD treated ticket detail as a dashboard-owned feature.
That is no longer the architecture. Ticket detail behavior must run through
extension commands and extension-provided views.

## Goals

- Document ticket detail as an extension-hosted workbench surface.
- Clarify which commands own ticket editing, files, attachments, and workspace
  creation.
- Keep dashboard implementation away from planner ticket persistence.

## Non-Goals

- Dashboard-owned ticket REST clients or file upload paths.
- Core ticket tables or core attempt status hooks.
- Legacy route-specific ticket detail business logic.

## Overview

The planner extension declares a resource-bound `ticket` page with a parent
`tickets` page. Its native views are:

- `ticket-editor` for the markdown body, editable ticket files, and image
  attachment previews.
- `ticket-files` for the native files/workspaces tree.
- `ticket-properties` for planner-owned ticket properties.

The editor is the page's Main view. The files tree contributes page-owned
navigation, and the properties view is attached through a view menu. See the
[UI declarations](../../src/ui-contributions.ts) for their current placement.

The dashboard workbench provides hosting, command execution, resource
navigation, and synced core host rows. It does not own ticket data.

## Requirements

### Functional Requirements

1. Ticket markdown content must be loaded and saved through Planner's native file renderer callbacks.
2. Ticket files must be created, renamed, edited, and deleted through planner
   commands.
3. Image attachments must be listed by the planner ticket files tree and
   previewed through the editor's content loader. Programmatic callers can use
   `pstdio.pstdio-planner.command.read-ticket-attachment`.
4. Manual workspace creation must execute `pstdio.pstdio-planner.command.create-workspace`.
5. Implementation attempts must execute `pstdio.pstdio-planner.command.run-attempt`.

### UX Requirements

- The host must open planner ticket resources without translating them into
  dashboard ticket models.
- The files tree must show editable ticket files and read-only image
  attachments.
- Linked workspaces must open as normal workspace resources.

### Operational Requirements

- Planner ticket mutations are extension command outcomes.
- Core sync updates still cover host rows such as sessions and workspaces.
- Planner ticket files and attachment metadata are not core synced tables.

## Behavior

1. Navigate to the Planner `ticket` page with its ticket resource.
2. The `ticket-editor` view loads content through the `getTicketContent` callback.
   The same operation is exposed as `pstdio.pstdio-planner.command.get-ticket-content`.
3. The `ticket-files` tree lists the ticket body, editable files, image
   attachments, and linked workspaces.
4. Selecting an editable file opens it in the planner editor.
5. Selecting an image attachment makes the content loader return a data URL
   and MIME type for a read-only preview.

### Run Attempt Flow

1. `pstdio.pstdio-planner.command.create-workspace` creates a ticket-linked workspace without
   starting a session.
2. `pstdio.pstdio-planner.command.run-attempt` checks dependency readiness, creates a managed
   attempt at the chosen commit, and starts its implementation session.
3. Both commands pass the planner ticket shorthand as `shorthand_base` so the
   host workspace shorthand is allocated from the ticket.
4. Planner stores the attempt and rolls the ticket to `In Progress`; generic
   session-start hooks do not change ticket workflow state.

## Interface

### Route

| Surface              | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `ticket-editor` view | Planner-owned ticket body/file/preview view. |
| `ticket-files` tree | Planner-owned files and linked workspaces. |
| `ticket-properties` view | Planner-owned ticket properties. |

### Header Actions

| Action                 | Planner command                              |
| ---------------------- | -------------------------------------------- |
| Create workspace       | `pstdio.pstdio-planner.command.create-workspace`            |
| Run attempt            | `pstdio.pstdio-planner.command.run-attempt`                 |
| Break into sub-tickets | `pstdio.pstdio-planner.command.break-into-sub-tickets`      |
| Refine ticket          | `pstdio.pstdio-planner.command.refine-ticket`               |
| Archive                | `pstdio.pstdio-planner.command.archive-ticket`              |
| Delete                 | `pstdio.pstdio-planner.command.delete-ticket`               |

## Rules & Constraints

- Dashboard code must not upload ticket files through dashboard ticket APIs.
- Binary/image attachments must stay on the planner extension blob path.
- Planner command responses drive refreshes; core sync does not stream planner
  ticket file metadata.

## Errors

| Error                         | Cause                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| Ticket not found              | Planner command could not resolve the ticket resource.     |
| Image preview unavailable     | Attachment metadata is missing or blob bytes are missing.  |
| Workspace creation fails      | Planner command or host workspace creation rejected input. |

## Verification & Evidence

- **Commands to run**:
  `bun test extensions/pstdio-planner/src/commands/ticket-files.test.ts extensions/pstdio-planner/src/commands/read-ticket-attachment.test.ts extensions/pstdio-planner/src/commands/ticket-actions.test.ts`
- **Expected evidence**: Planner commands create ticket-linked workspaces,
  expose image attachments in the files tree, and return data URLs for image
  preview.
- **Where to find artifacts**: `extensions/pstdio-planner/src/commands/`
