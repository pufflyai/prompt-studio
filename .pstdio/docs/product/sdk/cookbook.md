# SDK Cookbook

This cookbook reflects the current starter setup in `.pstdio/plugins`. The SDK-based setup is split into small plugin files by responsibility and uses prompt templates plus a few helper functions from `@pstdio/sdk/plugins`.

For the full exported surface, see [Method Reference](/references/sdk/reference).

## Current Starter Layout

```txt
.pstdio/plugins/
  code-review-lifecycle.ts
  ticket-actions.ts
  ticket-lifecycle.ts
  workspace-actions.ts
  worktree-lifecycle.ts
```

- `ticket-actions.ts` starts implementation and refinement flows from ticket actions.
- `workspace-actions.ts` starts manual review sessions from workspace actions.
- `ticket-lifecycle.ts` keeps ticket status and attempt status in sync.
- `code-review-lifecycle.ts` blocks `review-ready` on failed validation and handles review follow-up.
- `worktree-lifecycle.ts` bootstraps new worktrees and removes worktrees when tickets are archived.

## Prompt Keys Used By The Starter Setup

The current plugin set expects these prompt templates to exist in `ctx.prompts`:

- `implement-ticket`
- `refine-ticket`
- `create-sub-tickets`
- `review-code`
- `fix-changes-requested`

## Hook Name Mapping

The SDK hook name is the camel-cased filesystem hook name:

| Filesystem Hook                                      | SDK Hook                  |
| ---------------------------------------------------- | ------------------------- |
| `pre-ticket-creation`                                | `preTicketCreation`       |
| `post-ticket-creation`                               | `postTicketCreation`      |
| `pre-ticket-status-change`                           | `preTicketStatusChange`   |
| `post-ticket-status-change`                          | `postTicketStatusChange`  |
| `pre-ticket-archive`                                 | `preTicketArchive`        |
| `post-ticket-archive`                                | `postTicketArchive`       |
| `pre-ticket-deletion`                                | `preTicketDeletion`       |
| `post-ticket-deletion`                               | `postTicketDeletion`      |
| `post-session-start`                                 | `postSessionStart`        |
| `post-session-success`                               | `postSessionSuccess`      |
| `post-session-fail`                                  | `postSessionFail`         |
| `post-session-resume`                                | `postSessionResume`       |
| `post-session-await-input`                           | `postSessionAwaitInput`   |
| `pre-worktree-create`                                | `preWorktreeCreate`       |
| `post-worktree-create`                               | `postWorktreeCreate`      |
| `pre-worktree-remove`                                | `preWorktreeRemove`       |
| `post-worktree-remove`                               | `postWorktreeRemove`      |
| `pre-commit`                                         | `preCommit`               |
| `post-commit`                                        | `postCommit`              |
| `pre-rebase`                                         | `preRebase`               |
| `post-rebase`                                        | `postRebase`              |
| `pre-merge`                                          | `preMerge`                |
| `post-merge`                                         | `postMerge`               |
| `on-conflict`                                        | `onConflict`              |
| `pre-attempt-status` / `pre-attempt-status-<slug>`   | `preAttemptStatusChange`  |
| `post-attempt-status` / `post-attempt-status-<slug>` | `postAttemptStatusChange` |

## Recipe: Ticket Actions

The current setup uses ticket actions for the three common ticket flows: implement, refine, and break into sub-tickets.

```ts
import {
  createAttempt,
  createSession,
  definePlugin,
  renderPrompt,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "run-attempt",
      label: "Run attempt",
      targetType: "ticket",
      placement: "primary",
      async trigger(ctx) {
        await createAttempt(ctx, {
          ticketId: ctx.target.shorthand,
          prompt: renderPrompt(ctx.prompts["implement-ticket"], {
            ticket_id: ctx.target.shorthand,
          }),
        });
      },
    },
    {
      key: "refine-ticket",
      label: "Refine ticket",
      targetType: "ticket",
      placement: "overflow",
      async trigger(ctx) {
        await createSession(ctx, {
          title: `Refine ticket: ${ctx.target.shorthand}`,
          prompt: renderPrompt(ctx.prompts["refine-ticket"], {
            ticket_id: ctx.target.shorthand,
          }),
        });
      },
    },
    {
      key: "break-into-sub-tickets",
      label: "Break into sub-tickets",
      targetType: "ticket",
      placement: "overflow",
      async trigger(ctx) {
        await createSession(ctx, {
          title: `Break into sub-tickets: ${ctx.target.shorthand}`,
          prompt: renderPrompt(ctx.prompts["create-sub-tickets"], {
            ticket_id: ctx.target.shorthand,
          }),
        });
      },
    },
  ],
});
```

Use this pattern when the action should resolve prompt variables first and then delegate the real work to `createAttempt(...)` or `createSession(...)`.

## Recipe: Workspace Review Action

The workspace action uses the shared `review-code` prompt and binds the selected workspace automatically.

```ts
import { createSession, definePlugin, renderPrompt } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "run-review",
      label: "Run review",
      targetType: "workspace",
      placement: "secondary",
      async trigger(ctx) {
        const ticketId = ctx.target.ticket_shorthand || null;

        await createSession(ctx, {
          workspace_id: ctx.target.id,
          title: `Code review: ${ticketId ?? "ticket"}`,
          prompt: renderPrompt(
            ctx.prompts["review-code"],
            ticketId ? { ticket: ticketId } : {},
          ),
        });
      },
    },
  ],
});
```

## Recipe: Ticket And Review Lifecycle

The current lifecycle setup is split across two plugins:

- `ticket-lifecycle.ts` moves the ticket to `wip` when work resumes, initializes attempt status, mirrors `blocked`, and moves the ticket to `review` once every attempt is `reviewed`.
- `code-review-lifecycle.ts` blocks `review-ready` if validation fails, starts a review session from the `review-code` prompt, and follows up the original session with `fix-changes-requested`.

```ts
import {
  createSession,
  definePlugin,
  followupSession,
  runCommand,
  setTicketStatus,
  setWorkspaceAttemptStatus,
  updateTicketWhenAllAttemptsMatch,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postSessionStart(ctx) {
      if (!ctx.ticket) return;

      if (ctx.ticket.status_name !== "review") {
        await setTicketStatus(ctx, {
          ticket: ctx.ticket.shorthand,
          status: "wip",
        });
      }

      if (ctx.workspace && !ctx.workspace.attempt_status_name) {
        await setWorkspaceAttemptStatus(ctx, {
          workspaceId: ctx.workspace.id,
          statusName: "wip",
          sessionId: ctx.sessionId,
        });
      }
    },

    async preAttemptStatusChange(ctx) {
      if (ctx.toStatus !== "review-ready" || !ctx.worktreePath) return;

      const validation = await runCommand(ctx.worktreePath, [
        "bun",
        "run",
        "validate",
      ]);
      if (validation.exitCode === 0) return;

      const output = [validation.stdout, validation.stderr].join("\n").trim();
      return {
        reject: true,
        reason: output
          ? `Validation failed; cannot move to review-ready\n\n${output}`
          : "Validation failed; cannot move to review-ready",
      };
    },

    async postAttemptStatusChange(ctx) {
      if (!ctx.ticket) return;

      if (ctx.toStatus === "review-ready") {
        await createSession(ctx, {
          workspace_id: ctx.workspace.id,
          title: `Code review: ${ctx.ticket.shorthand}`,
          template: "review-code",
          vars: { ticket: ctx.ticket.shorthand },
          original_session_id: ctx.sessionId,
        });
      }

      if (ctx.toStatus === "changes-requested") {
        await setWorkspaceAttemptStatus(ctx, {
          workspaceId: ctx.workspace.id,
          statusName: "wip",
          sessionId: ctx.sessionId,
        });

        await followupSession(ctx, {
          sessionId: ctx.originalSessionId,
          template: "fix-changes-requested",
          vars: { ticket: ctx.ticket.shorthand },
        });
      }

      if (ctx.toStatus === "blocked") {
        await setTicketStatus(ctx, {
          ticket: ctx.ticket.shorthand,
          status: "blocked",
        });
      }

      if (ctx.toStatus === "reviewed") {
        await updateTicketWhenAllAttemptsMatch(ctx, {
          ticketId: ctx.ticket.shorthand,
          allAttemptsStatus: "reviewed",
          setStatus: "review",
        });
      }
    },
  },
});
```

## Recipe: Worktree Bootstrap And Cleanup

The current worktree setup uses `bootstrapWorktree(...)` instead of reimplementing the copy logic in every plugin. It copies `.pstdio/config.json`, mirrors `.claude`, `.opencode`, and `.agents`, and pulls the ticket into `.pstdio/tickets/<shorthand>/` when a ticket ref is available.

```ts
import {
  bootstrapWorktree,
  definePlugin,
  removeAllWorktreesForTicket,
  runCommand,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postTicketArchive(ctx) {
      await removeAllWorktreesForTicket(ctx, { ticketId: ctx.id });
    },

    async postWorktreeCreate(ctx) {
      await bootstrapWorktree(ctx, {
        repoPath: ctx.repoPath,
        worktreePath: ctx.worktreePath,
        ticketId: ctx.ticket,
      });

      await runCommand(ctx.worktreePath, ["bun", "install"]);
      await runCommand(ctx.worktreePath, ["bun", "run", "build"]);
    },
  },
});
```

## Notes

- `@pstdio/sdk/plugins` now covers worktree remove, commit, rebase, merge, and conflict hooks in `PluginHooks`.
- `@pstdio/sdk/hooks` currently re-exports the ticket, session, worktree, and attempt-status context types. For the remaining lifecycle points, the callback parameter is still typed through `PluginHooks`.
