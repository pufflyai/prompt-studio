# Planner Extension

The planner extension is the first-party replacement for built-in ticket management.

For now, planner owns the internal ticket workflow: ticket records, local ticket artifacts, ticket file sync, frontmatter handling, display-title helpers, ticket-oriented actions, ticket lifecycle automation, and the built-in local ticket pull/push workflow.

The planner SDK should be inspired by the existing bundled plugin helpers where they are about ticket management: resolving tickets, moving ticket status, syncing local ticket files, saving edited ticket artifacts, and preparing repo-visible ticket context. Session and attempt orchestration remains outside the planner SDK.

## Package

| Package                               | Responsibility                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `@pstdio/pstdio-ext-planner`          | Planner extension package and built-in local ticket workflow                                                           |
| `@pstdio/pstdio-ext-planner/contract` | Planner resource/event contracts, planner ticket types, workflow context types, and planner constants                  |
| `@pstdio/pstdio-ext-planner/sdk`      | Planner-owned workflow helpers, typed planner client, and migration equivalents for useful plugin helpers               |

The core `@pstdio/sdk` package stays workflow-agnostic. It can provide generic extension primitives and request helpers, but planner-specific contracts and helper APIs belong to the planner package.

## Current Scope

Planner currently owns:

- internal ticket management
- ticket pull/push behavior for the built-in local ticket workflow
- local ticket artifact layout and file conversion helpers
- ticket frontmatter parsing and serialization
- ticket display-title extraction
- planner ticket record and file record types
- planner diagnostics for the internal ticket workflow
- ticket management helpers used by dashboard/CLI commands
- ticket lifecycle helpers used by extension event handlers
- ticket artifact helpers that existing bundled plugins relied on

These capabilities moved into planner ownership. They are not removed from the product model.

## Boundaries

| Concern                                                           | Owner                                 |
| ----------------------------------------------------------------- | ------------------------------------- |
| Generic extension primitives                                      | `@pstdio/sdk/extensions`              |
| Ticket management workflow                                        | `@pstdio/pstdio-ext-planner`          |
| Planner contracts, resource refs, events, and workflow types      | `@pstdio/pstdio-ext-planner/contract` |
| Planner workflow helpers and typed clients                        | `@pstdio/pstdio-ext-planner/sdk`      |
| Durable project state, storage, activity, and sync emission       | `pstdio-api`                          |

`@pstdio/sdk` must not export planner ticket contracts, planner workflow helpers, or planner clients.

## SDK Surface

The planner SDK should cover the ticket-management helper shape that existing plugins proved useful:

| Helper                             | Planner SDK responsibility                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `createPlannerClient`              | Create the typed planner API client for pull/push commands that cross the API boundary.               |
| `findTicketByRef`                  | Resolve ticket shorthand or id through the planner boundary.                                          |
| `setTicketStatus`                  | Resolve a status name and update the ticket through API-owned services.                               |
| `updateTicketWhenAllAttemptsMatch` | Advance ticket status when all linked attempts reach a target state.                                  |
| `pullTickets`                      | Pull internal ticket state into `.pstdio/tickets`.                                                    |
| `saveTicket` / `pushTicket`        | Push local ticket edits, files, and artifacts back through planner/API services.                      |
| `bootstrapWorktree`                | Prepare a workspace with repo-visible planner artifacts.                                              |
| `runCommand`                       | Run local validation or project commands for planner lifecycle automation.                            |

The names can stay close to the current plugin helpers where that makes migration straightforward. The important boundary is package ownership: these helpers belong to `@pstdio/pstdio-ext-planner/sdk`, not `@pstdio/sdk`.

Helpers such as `createSession`, `createAttempt`, `createWorkspace`, and `followupSession` are not planner SDK helpers. Extension commands that need those flows should use the core SDK client or command runtime around planner-owned ticket helpers.

## Example: Ticket Action Command

Ticket-management commands should use planner SDK helpers for ticket work, then use core clients for non-planner orchestration when needed:

```ts
import { defineExtension, params } from "@pstdio/sdk/extensions";
import { findTicketByRef, saveTicket } from "@pstdio/pstdio-ext-planner/sdk";

export default defineExtension({
  id: "project.ticket-actions",
  name: "Ticket Actions",
  commands: {
    saveTicket: {
      title: "Save ticket",
      target: "ticket",
      params: {
        rootPath: params.text({ label: "Root path", required: true }),
      },
      async run(ctx) {
        const ticket = await findTicketByRef(ctx, { ticketId: ctx.target.id });
        if (!ticket) return;

        await saveTicket(ctx, {
          rootPath: String(ctx.params.rootPath),
          ticketId: ticket.shorthand,
        });
      },
    },
  },
});
```

## Example: Lifecycle Automation

The existing lifecycle plugins should migrate to planner event handlers backed by planner SDK helpers:

```ts
import {
  saveTicket,
  setTicketStatus,
  updateTicketWhenAllAttemptsMatch,
} from "@pstdio/pstdio-ext-planner/sdk";

export const onSessionStart = async (ctx) => {
  if (!ctx.ticket) return;
  await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
};

export const onAttemptStatusChange = async (ctx) => {
  if (ctx.toStatus === "review-ready" && ctx.worktreePath) {
    await saveTicket(ctx, {
      rootPath: ctx.worktreePath,
      ticketId: ctx.ticket.shorthand,
    });
  }

  if (ctx.toStatus === "reviewed") {
    await updateTicketWhenAllAttemptsMatch(ctx, {
      ticketId: ctx.ticket.shorthand,
      allAttemptsStatus: "reviewed",
      setStatus: "review",
    });
  }
};
```

Exact event registration shape belongs to the extension runtime. The SDK responsibility is the ergonomic planner workflow helpers used inside those handlers.

## Runtime Flow

1. Ticket commands and planner event handlers call planner SDK helpers.
2. The command executes through the API-owned extension command path.
3. The built-in local ticket workflow reads or writes ticket state through planner-owned contracts.
4. API services persist ticket records, files, activity, and sync events.
5. Local `.pstdio/tickets` artifacts are pulled or pushed through planner artifact helpers.

## Local Ticket Workflow

Planner calls the built-in local ticket workflow directly. The planner extension does not expose a ticket source provider registry, and external ticket sources are not supported product behavior.
