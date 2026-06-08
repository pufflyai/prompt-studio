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

The planner extension contributes ticket resource views:

- `ticketEditor` for the markdown body, editable ticket files, and image
  attachment previews.
- `ticketFiles` for the native files/workspaces tree.
- `ticketProperties` for planner-owned ticket properties.

The dashboard workbench provides hosting, command execution, resource
navigation, and synced core host rows. It does not own ticket data.

## Requirements

### Functional Requirements

1. Ticket markdown content must be loaded and saved through planner commands.
2. Ticket files must be created, renamed, edited, and deleted through planner
   commands.
3. Image attachments must be listed by the planner ticket files tree and
   previewed through `pstdio-planner.read-ticket-attachment`.
4. Manual workspace creation must execute `pstdio-planner.create-workspace`.
5. Implementation attempts must execute `pstdio-planner.run-attempt`.

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

1. Open the planner ticket resource in the workbench.
2. The planner `ticketEditor` view loads the ticket via
   `pstdio-planner.get-ticket`.
3. The planner `ticketFiles` tree lists the ticket body, editable files, image
   attachments, and linked workspaces.
4. Selecting an editable file opens it in the planner editor.
5. Selecting an image attachment fetches bytes through
   `pstdio-planner.read-ticket-attachment` and renders a read-only preview.

### Run Attempt Flow

1. `pstdio-planner.create-workspace` creates a ticket-linked workspace without
   starting a session.
2. `pstdio-planner.run-attempt` creates the same ticket-linked workspace and
   starts the implementation session unless `startSession` is false.
3. Both commands pass the planner ticket shorthand as `shorthand_base` so the
   host workspace shorthand is allocated from the ticket.
4. Session start moves the planner ticket to `In Progress`.

## Interface

### Route

| Surface              | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `ticketEditor` view  | Planner-owned ticket body/file/preview view. |
| `ticketFiles` tree   | Planner-owned files and linked workspaces.   |
| `ticketProperties`   | Planner-owned ticket properties.             |

### Header Actions

| Action                 | Planner command                              |
| ---------------------- | -------------------------------------------- |
| Create workspace       | `pstdio-planner.create-workspace`            |
| Run attempt            | `pstdio-planner.run-attempt`                 |
| Break into sub-tickets | `pstdio-planner.break-into-sub-tickets`      |
| Refine ticket          | `pstdio-planner.refine-ticket`               |
| Archive                | `pstdio-planner.archive-ticket`              |
| Delete                 | `pstdio-planner.delete-ticket`               |

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
