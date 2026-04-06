# Plugins

The SDK plugin system provides project-local extensions for:

- dashboard actions (button/menu actions on tickets, workspaces, sessions)
- lifecycle hooks (ticket/session/worktree/attempt events)

Plugins use file-based implicit identity, modeled after OpenCode plugin ergonomics.

## Authoring Model

Plugins live in `.pstdio/plugins` as one file per plugin, with a `default` export.

```txt
.pstdio/plugins/
  worktree-bootstrap.ts
  attempt-status.js
  actions/
    run-review.ts
```

No `index.ts` registry is required.

## Defining a Plugin

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "deploy-preview",
      label: "Deploy preview",
      targetType: "workspace",
      placement: "secondary",
      async trigger(ctx) {
        await ctx.client.sessions.create({
          project_id: ctx.projectId,
          workspace_id: ctx.targetId,
          title: "Deploy preview",
          prompt: "Deploy this workspace and post the preview URL in the ticket.",
        });
      },
    },
  ],
  hooks: {
    preTicketStatusChange(ctx) {
      if (ctx.toStatus === "done" && ctx.draft) {
        return { reject: true, reason: "Cannot mark a draft as done" };
      }
    },
  },
});
```

`definePlugin(...)` is an authoring helper. Plugin identity is not provided in source — it is derived from the file path at load time.

## Plugin Definition

```ts
type PluginDefinition = {
  actions?: ActionDefinition[]; // UI actions + trigger handlers
  hooks?: PluginHooks; // lifecycle hooks
};
```

## Identity

Plugin identity is derived from the plugin file path, relative to `.pstdio/plugins`, with extension removed.

Examples:

- `.pstdio/plugins/worktree-bootstrap.ts` -> `worktree-bootstrap`
- `.pstdio/plugins/actions/run-review.js` -> `actions/run-review`

This identity is used internally for registration, logging, and action namespacing.

## Discovery and Loading

The runtime discovers plugin modules by recursively scanning `.pstdio/plugins/`.

### Included Extensions

- `.ts`
- `.js`
- `.mts`
- `.mjs`
- `.cts`
- `.cjs`

### Excluded Files

- `*.d.ts`
- `*.test.*`
- `*.spec.*`

### Module Contract

1. Files without a `default` export are silently skipped (helper/utility files).
2. When a `default` export exists it must be a valid `PluginDefinition`.
3. One plugin definition per file.

### Failure Behavior

The loader **fail-fasts at startup** for:

1. Invalid default export (not a valid `PluginDefinition`)
2. Duplicate derived plugin identities
3. Duplicate action keys within one plugin
4. Duplicate final action IDs across plugins

## Default Plugins

New projects get a set of default plugins scaffolded to `.pstdio/plugins/`. These serve as working examples and common automation:

- **worktree-bootstrap** — copies `.pstdio/config.json` and agent configuration directories (`.claude`, `.opencode`, `.agents`) into new worktrees, pulls ticket context, and runs `bun install` + `bun run build`.
- **ticket-archive-cleanup** — removes all workspaces for a ticket when it is archived.
- **session-ticket-sync** — moves ticket and workspace attempt status to `wip` when a session starts.
- **attempt-status-automation** — orchestrates review workflows by creating review sessions, handling change requests, and transitioning ticket status based on attempt status.

## Actions

Actions declare what appears in the UI and what runs when clicked:

```ts
type ActionDefinition = {
  key: string; // action key local to a single plugin file
  label: string; // user-facing name
  targetType: "ticket" | "workspace" | "session"; // where it appears
  placement: "primary" | "secondary" | "overflow"; // how prominent
  trigger: (ctx: ActionTriggerContext) => void | Promise<void>;
};
```

```ts
type ActionTriggerContext = {
  client: PstdioClient; // pre-configured client
  projectId: string;
  prompts: Record<string, string>; // resolved prompt templates
  targetType: "ticket" | "workspace" | "session";
  targetId: string;
};
```

### Namespaced Action IDs

Action IDs exposed by the runtime are namespaced by plugin identity:

- `<pluginIdentity>/<action.key>`

For example, if `actions/run-review.ts` defines an action with `key: "start"`, the runtime action ID is `actions/run-review/start`.

This allows simple local action keys while preventing collisions across files.

| Placement   | Renders as               |
| ----------- | ------------------------ |
| `primary`   | Visible button in header |
| `secondary` | Less prominent button    |
| `overflow`  | Inside the "more" menu   |

## Hooks

Hooks run in response to platform lifecycle events.

- pre-hooks are blocking and can return `{ reject: true, reason: "..." }`
- post-hooks are fire-and-forget

### Pre-hooks (blocking)

```ts
hooks: {
  preTicketCreation(ctx) {
    if (!ctx.content) {
      return { reject: true, reason: "Ticket must have content" };
    }
  },
}
```

### Post-hooks (fire-and-forget)

```ts
hooks: {
  async postTicketCreation(ctx) {
    await ctx.client.tickets.create({
      project_id: ctx.projectId,
      content: "Review acceptance criteria",
      parent_id: ctx.id,
    });
  },
}
```

### Available Hooks

**Ticket**

| Hook                      | Event                    | Blocking | Context                     |
| ------------------------- | ------------------------ | -------- | --------------------------- |
| `preTicketCreation`       | Before ticket is created | Yes      | `TicketCreationContext`     |
| `postTicketCreation`      | After ticket is created  | No       | `TicketContext`             |
| `preTicketStatusChange`   | Before status changes    | Yes      | `TicketStatusChangeContext` |
| `postTicketStatusChange`  | After status changes     | No       | `TicketStatusChangeContext` |
| `preTicketArchive`        | Before archiving         | Yes      | `TicketContext`             |
| `postTicketArchive`       | After archiving          | No       | `TicketContext`             |
| `preTicketDeletion`       | Before deletion          | Yes      | `TicketContext`             |
| `postTicketDeletion`      | After deletion           | No       | `TicketContext`             |

**Session**

| Hook                    | Event                      | Blocking | Context              |
| ----------------------- | -------------------------- | -------- | -------------------- |
| `postSessionStart`      | After session starts       | No       | `SessionHookContext`  |
| `postSessionSuccess`    | After session completes    | No       | `SessionHookContext`  |
| `postSessionFail`       | After session fails        | No       | `SessionHookContext`  |
| `postSessionResume`     | After session resumes      | No       | `SessionHookContext`  |
| `postSessionAwaitInput` | After session awaits input | No       | `SessionHookContext`  |

**Worktree**

| Hook                 | Event                    | Blocking | Context                 |
| -------------------- | ------------------------ | -------- | ----------------------- |
| `preWorktreeCreate`  | Before worktree creation | Yes      | `WorktreeCreateContext` |
| `postWorktreeCreate` | After worktree creation  | No       | `WorktreeContext`       |

**Attempt Status**

| Hook                      | Event                         | Blocking | Context                      |
| ------------------------- | ----------------------------- | -------- | ---------------------------- |
| `preAttemptStatusChange`  | Before attempt status changes | Yes      | `AttemptStatusChangeContext`  |
| `postAttemptStatusChange` | After attempt status changes  | No       | `AttemptStatusChangeContext`  |

### Hook Contexts

Every hook context includes:

- `client` — a pre-configured `PstdioClient` for calling back into the platform
- `projectId` — the project this event belongs to

Import specific context types from `@pstdio/sdk/hooks`:

```ts
import type { TicketStatusChangeContext } from "@pstdio/sdk/hooks";
```

## Runtime Helper Context

The runtime helpers exported from `@pstdio/sdk/plugins` take `ctx` as their first parameter, but they only require:

```ts
{
  client: PstdioClient
  projectId: string
}
```

That is why the same helpers work from both hook handlers and action handlers. Pass the full `ctx` you already have, but think of the helper contract as `client + projectId` plus whatever explicit ids you provide in the helper input object.

## Hook Payload Parity

SDK hook contexts expose normalized typed fields and also an optional raw payload mirror:

- `ctx.payload?: Record<string, unknown>`

This is intended for migration from filesystem hooks where automation previously read flat stdin payload JSON directly.

Practical guidance:

1. Prefer typed fields first (`ctx.id`, `ctx.shorthand`, `ctx.toStatus`, etc.).
2. Use `ctx.payload` only for fields not yet modeled in SDK context types.
3. Treat `ctx.payload` as optional and untyped.

Example:

```ts
hooks: {
  postTicketArchive(ctx) {
    // Prefer typed SDK fields
    const ticketId = ctx.id;
    const shorthand = ctx.shorthand;

    // Optional raw payload fallback
    const legacyTicket = ctx.payload?.ticket;
    void ticketId;
    void shorthand;
    void legacyTicket;
  },
}
```

Note: some related SDK list endpoints (for example workspace list items) currently expose `ticket_shorthand` rather than `ticket_id`, so filtering by shorthand can still be required in some plugin logic.

## Built-in Plugin Helpers

`@pstdio/sdk/plugins` includes helper functions that mirror common CLI helper workflows.

```ts
import {
  createAttempt,
  createSession,
  createWorkspace,
  findTicketByRef,
  followupSession,
  findWorkspaceByRef,
  getAttemptsForTicket,
  removeAllWorktreesForTicket,
  runCommand,
  setTicketStatus,
  setWorkspaceAttemptStatus,
  updateTicketWhenAllAttemptsMatch,
  workspacesForTicket,
} from "@pstdio/sdk/plugins";
```

These helpers share the same context contract: they only read `ctx.client` and `ctx.projectId`.

### `createAttempt(ctx, { ticketId?, ... })`

Creates an attempt for a ticket and always starts a session.

### `createSession(ctx, input)`

Creates a session and fills `project_id` from `ctx.projectId`.

### `followupSession(ctx, { sessionId?, ... })`

Sends a follow-up to an existing session. Uses the explicit `sessionId` when provided, otherwise falls back to the current session context or a session action target.

### `createWorkspace(ctx, { ticketId?, ... })`

Creates a workspace-only attempt and does not start a session.

### `findTicketByRef(ctx, { ticketId? })`

Looks up a ticket by ID or shorthand and returns the matching ticket, or `null`. When the current hook or action context already carries the matching rich ticket object, it reuses that object first.

### `findWorkspaceByRef(ctx, { workspaceId? })`

Looks up a workspace by ID or shorthand and returns the matching workspace, or `null`. When the current hook or action context already carries the matching rich workspace object, it reuses that object first.

### `workspacesForTicket(ctx, { ticketId? })`

Lists the workspaces associated with the resolved ticket.

### `getAttemptsForTicket(ctx, { ticketId? })`

Alias of `workspacesForTicket(ctx, { ticketId? })`.

### `removeAllWorktreesForTicket(ctx, { ticketId? })`

Equivalent intent to `pstdio tickets worktrees remove-all`.
Removes linked worktrees/branches for matching ticket workspaces and keeps workspace records.

```ts
hooks: {
  async postTicketArchive(ctx) {
    await removeAllWorktreesForTicket(ctx, { ticketId: ctx.id });
  },
}
```

### `setTicketStatus(ctx, { ticket, status })`

Equivalent intent to `pstdio tickets update --status <name>`.

### `setWorkspaceAttemptStatus(ctx, { workspaceId? | workspaceShorthand?, statusName, sessionId? })`

Equivalent intent to `pstdio workspaces set-status`. When `ctx.workspace` already matches, it uses that object directly instead of listing workspaces first.

### `runCommand(cwd, command, { quiet? })`

Runs a command and captures `{ exitCode, stdout, stderr }` with trimmed output.

```ts
const validation = await runCommand(ctx.worktreePath, ["bun", "run", "validate"]);
```

### `updateTicketWhenAllAttemptsMatch(ctx, { ticketId?, allAttemptsStatus, setStatus })`

Equivalent intent to `pstdio tickets update-when-attempt-status`.

This helper uses the dedicated API endpoint and returns whether the ticket status was updated.

## Migration Cookbook

For filesystem hook mapping examples and rewrite patterns, see [SDK Cookbook](./cookbook.md).
