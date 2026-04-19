---
name: create-pstdio-plugin
description: "Create or edit a pstdio plugin. Plugins can react to lifecycle hooks (preCommit, postSessionStart, etc.) and expose actions (user-triggered commands on tickets, workspaces, or sessions). Use when asked to write, add, or modify a plugin, hook, or action."
metadata:
  - version: 0.0.1
---

## What a plugin is

A plugin is a TypeScript (or JavaScript) module in `.pstdio/plugins/` with a default export built from `definePlugin`. It can contribute two things (either, or both):

- **`hooks`** — callbacks that fire on lifecycle events (`preCommit`, `postSessionStart`, `postAttemptStatusChange`, …). Use them to validate, enrich, or react to system state changes.
- **`actions`** — user-triggered commands attached to a ticket, workspace, or session. They appear as buttons/menu items in the dashboard and can accept parameters (agent, repo, text, template selection).

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  key: "my-plugin", // optional but recommended when contributing actions
  hooks: {
    /* ... */
  },
  actions: [
    /* ... */
  ],
});
```

## Workflow

1. Decide whether you need a **hook** (reactive), an **action** (user-triggered), or both.
2. Author a plugin file in `.pstdio/plugins/`. One file can group related hooks and actions, or split by concern. Filenames are arbitrary.
3. For **hooks**, wire up the callback with the typed `ctx` argument. Pre-hooks can reject; post-hooks are fire-and-forget.
4. For **actions**, declare each action with `key`, `label`, `targetType` (`"ticket"` / `"workspace"` / `"session"`), `placement` (`"primary"` / `"secondary"` / `"overflow"`), optional `params`, and an async `trigger(ctx)`.
5. Run `pstdio plugins list` to confirm discovery. If a long-running process missed the file, `pstdio plugins register` force-reloads.
6. Exercise the plugin: trigger the underlying lifecycle event for hooks, or run the action from the dashboard for actions (there is no manual hook/action invoke CLI).

## Key Rules

- Plugins live in `.pstdio/plugins/`. Accepted extensions: `.ts`, `.js`, `.mts`, `.mjs`, `.cts`, `.cjs`. `.d.ts`, `.test.*`, `.spec.*` are ignored.
- Each file exports a single **default** value from `definePlugin` (imported from `@pstdio/sdk/plugins`). Named exports are ignored by the loader.
- Plugins load once at startup. Re-run `pstdio plugins register` after edits if the daemon is long-running.
- Keep hooks and actions fast. For long-running work, dispatch in a `post*` hook or schedule from inside an action rather than blocking.
- `definePlugin` validates that every action has a `trigger` function and throws at load time if one is missing.

## Hooks

All hook contexts extend `BaseHookContext` which provides `client` (a `PstdioClient` with `session.followup()`) and `projectId`. Return `{ reject: true, reason }` from a `pre*` hook to abort the parent operation. `post*` hooks return `void`.

| Hook                                                                                                          | Pre/Post | Context                      | Typical use                                             |
| ------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------- | ------------------------------------------------------- |
| `preWorktreeCreate`                                                                                           | Pre      | `WorktreeCreateContext`      | Validate the ticket/branch before allocating a worktree |
| `postWorktreeCreate`                                                                                          | Post     | `WorktreeContext`            | Bootstrap env files, install deps, prime caches         |
| `preWorktreeRemove`                                                                                           | Pre      | `WorktreeRemoveContext`      | Clean caches, flush logs                                |
| `postWorktreeRemove`                                                                                          | Post     | `WorktreeRemoveContext`      | Audit trails, notifications                             |
| `preCommit`                                                                                                   | Pre      | `CommitContext`              | Validation gates (lint, typecheck, tests)               |
| `postCommit`                                                                                                  | Post     | `CommitContext`              | Log, notify, update external tickets                    |
| `preRebase` / `postRebase`                                                                                    | —        | `RebaseContext`              | Preflight or record a rebase                            |
| `preMerge` / `postMerge`                                                                                      | —        | `MergeContext`               | Run tests before merging; tag after merging             |
| `onConflict`                                                                                                  | Post     | `ConflictContext`            | Surface conflicts to the user                           |
| `preAttemptStatusChange`                                                                                      | Pre      | `AttemptStatusChangeContext` | Gate transitions like `→ review-ready` on validation    |
| `postAttemptStatusChange`                                                                                     | Post     | `AttemptStatusChangeContext` | Launch reviews, route follow-ups                        |
| `postSessionStart` / `postSessionSuccess` / `postSessionFail` / `postSessionResume` / `postSessionAwaitInput` | Post     | `SessionHookContext`         | React to agent session lifecycle                        |
| `preTicketCreation`                                                                                           | Pre      | `TicketCreationContext`      | Require content / metadata before a ticket exists       |
| `postTicketCreation`                                                                                          | Post     | `TicketContext`              | Enrich a new ticket, notify                             |
| `preTicketStatusChange`                                                                                       | Pre      | `TicketStatusChangeContext`  | Block invalid transitions                               |
| `postTicketStatusChange`                                                                                      | Post     | `TicketStatusChangeContext`  | Log, notify, cascade                                    |
| `preTicketArchive` / `postTicketArchive`                                                                      | —        | `TicketContext`              | Guard archival; cleanup afterward                       |
| `preTicketDeletion` / `postTicketDeletion`                                                                    | —        | `TicketContext`              | Prevent deletion; final cleanup                         |

See [references/hook-contexts.md](references/hook-contexts.md) for the exact field list of every context type.

## Actions

An action binds a user-triggered command to a target entity. The dashboard renders it wherever the target is shown, passes any declared parameters, and calls `trigger(ctx)`.

```ts
{
  key: "run-attempt",                // unique within the plugin
  label: "Run attempt",               // button / menu label
  targetType: "ticket",               // "ticket" | "workspace" | "session"
  placement: "primary",               // "primary" | "secondary" | "overflow"
  params: [                           // optional — parameter form shown before trigger
    { key: "agent", label: "Agent", type: "agent" },
    { key: "repo",  label: "Repository", type: "repo" },
  ],
  async trigger(ctx) {
    // ctx.target is the full ticket / workspace / session object
    // ctx.params[key] is the chosen parameter value
    // ctx.client gives access to the pstdio API
    // return { session_id, message } to surface a toast/link in the UI
  },
}
```

### Action params

Every param is rendered as a form input in the dashboard. `ctx.params[key]` holds the chosen value at trigger time.

| Type              | Value shape                         | UI                                         |
| ----------------- | ----------------------------------- | ------------------------------------------ |
| `text`            | `string`                            | Single-line text input                     |
| `longtext`        | `string`                            | Multi-line text area                       |
| `select`          | `string` (one of `options[].value`) | Dropdown                                   |
| `template-select` | `string` (template name)            | Template picker filtered by `templateType` |
| `agent`           | `{ agent: string; model: string }`  | Agent + model picker                       |
| `repo`            | `{ repo: string; branch: string }`  | Repo + branch picker                       |

All params support `required: boolean` and `defaultValue: string`.

### Action trigger context

```ts
type ActionTriggerContext<TTargetType> = {
  client: PstdioClient;
  projectId: string;
  prompts: Record<string, string>; // bundled prompt templates keyed by name
  params: Record<string, ActionParamValue>;
  targetType: TTargetType; // "ticket" | "workspace" | "session"
  targetId: string;
  target: TicketListItem | WorkspaceListItem | Session; // full record for the target
};
```

Return `{ session_id?, message? }` from `trigger` to surface a toast + link in the UI. Returning nothing is fine for fire-and-forget actions.

## SDK Helpers

Import from `@pstdio/sdk/plugins`:

- `definePlugin()` — plugin builder.
- `runCommand(cwd, [cmd, ...args], { env?, quiet? })` — shell out and get `{ exitCode, stdout, stderr }`.
- `bootstrapWorktree(ctx, { repoPath, worktreePath, ticketId })` — copy env/config into a fresh worktree.
- `removeAllWorktreesForTicket(ctx, { ticketId })` — GC worktrees linked to a ticket.
- `setTicketStatus(ctx, { ticket, status })` — move a ticket.
- `setWorkspaceAttemptStatus(ctx, { workspaceId, statusName, sessionId? })` — update an attempt status.
- `updateTicketWhenAllAttemptsMatch(ctx, ...)` — conditional ticket transition when every attempt shares a status.
- `createSession(ctx, input)` / `followupSession(ctx, input)` — start / continue a session from a hook or action.
- `createAttempt(ctx, input)` — start a new attempt for a ticket (workspace + session in one call).
- `createWorkspace(ctx, input)` — create a workspace without launching a session.
- `findTicketByRef`, `findWorkspaceByRef`, `getAttemptsForTicket`, `workspacesForTicket`, `pullTickets` — lookup helpers.

## Cheatsheet

```bash
pstdio plugins list       # List discovered plugins
pstdio plugins register   # Force-reload from .pstdio/plugins/
```

## References

- [references/hook-contexts.md](./references/hook-contexts.md) — Field list for every hook context type.
- [references/examples.md](./references/examples.md) — End-to-end plugin examples (hooks and actions).
