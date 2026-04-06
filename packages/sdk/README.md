# @pstdio/sdk

TypeScript SDK for Prompt Studio.

This package is the public integration surface for:

- calling the Prompt Studio HTTP API
- importing shared request and resource types
- rendering prompt templates
- authoring Prompt Studio plugins, actions, and lifecycle hooks

The package is ESM-only and is published through subpath exports. Import from the entrypoint you need, not from `@pstdio/sdk` directly.

## Install

```bash
bun add @pstdio/sdk
```

## Entry Points

| Import path             | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `@pstdio/sdk/client`    | Runtime HTTP client for Prompt Studio                     |
| `@pstdio/sdk/api`       | Request and response payload types                        |
| `@pstdio/sdk/resources` | Shared resource/entity types                              |
| `@pstdio/sdk/plugins`   | Plugin definition types, hook types, and helper utilities |
| `@pstdio/sdk/prompts`   | Prompt rendering helpers                                  |
| `@pstdio/sdk/hooks`     | Hook context and hook client types                        |

Example:

```ts
import { createClient, PstdioApiError } from "@pstdio/sdk/client";
import type { CreateTicketInput } from "@pstdio/sdk/api";
import type { TicketDetail } from "@pstdio/sdk/resources";
import { createSession, definePlugin } from "@pstdio/sdk/plugins";
import { renderPrompt } from "@pstdio/sdk/prompts";
import type { AttemptStatusChangeContext } from "@pstdio/sdk/hooks";
```

## HTTP Client

Create a client with `createClient()`:

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient({
  baseUrl: process.env.PSTDIO_API_URL,
  token: process.env.PSTDIO_API_TOKEN,
});

const tickets = await client.tickets.list("proj_123", {
  status: "wip",
  tag: ["backend", "bug"],
});
```

### Client options

- `baseUrl`: API base URL. Defaults to `process.env.PSTDIO_API_URL ?? "http://localhost:19840"`.
- `token`: Optional bearer token. Sent as `Authorization: Bearer <token>`.
- `fetch`: Optional `fetch` implementation override for tests or custom runtimes.

The client expects a runtime with `fetch` available, or an explicit `fetch` passed in through options.

### Error handling

The request layer throws `PstdioApiError` for non-2xx responses.

- `error.message`: API error message
- `error.status`: HTTP status code
- when the API returns `hook_output`, it is appended to `message`

```ts
import { PstdioApiError, createClient } from "@pstdio/sdk/client";

const client = createClient();

try {
  await client.workspaces.updateAttemptStatus("ws_123", {
    status: "review-ready",
  });
} catch (error) {
  if (error instanceof PstdioApiError) {
    console.error(error.status, error.message);
  }
  throw error;
}
```

### Client groups

`createClient()` returns a grouped client with these domains:

| Group        | Methods                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects`   | `list`, `get`, `create`, `delete`, `listRepos`, `registerRepo`, `removeRepo`                                                                       |
| `tickets`    | `list`, `get`, `create`, `update`, `delete`, `createAttempt`, `updateWhenAttemptStatus`, `listFiles`, `getFileContent`, `uploadFile`, `deleteFile` |
| `workspaces` | `list`, `getByShorthand`, `create`, `updateAttemptStatus`, `removeWorktree`, `delete`                                                              |
| `sessions`   | `list`, `get`, `create`, `archive`, `followUp`, `approve`, `getConversation`, `resolveSessionId`, `updateStatus`                                   |
| `statuses`   | `list`, `create`, `update`, `setDefault`, `delete`, `listAttemptStatuses`, `createAttemptStatus`, `updateAttemptStatus`, `deleteAttemptStatus`     |
| `tags`       | `list`, `create`, `update`, `delete`, `createOption`, `updateOption`, `deleteOption`                                                               |
| `templates`  | `list`, `get`, `create`, `update`, `delete`                                                                                                        |
| `skills`     | `list`, `get`, `update`                                                                                                                            |
| `agents`     | `list`, `info`, `models`, `setup`, `setupAvailable`, `update`, `delete`                                                                            |
| `actions`    | `list`, `execute`                                                                                                                                  |

Notes:

- `tickets.list(projectId, filters)` supports `status`, `tag`, `archived`, `draft`, `parent_id`, `shorthand`, and `search`.
- `tickets.getFileContent(ticketId, fileId)` returns `Uint8Array`, not JSON.
- `createRequest()` is also exported if you want the lower-level request function without the grouped client.

## API Types

`@pstdio/sdk/api` re-exports the public request and response types used by the HTTP client.

```ts
import type {
  CreateSessionInput,
  CreateTicketInput,
  UpdateTicketInput,
} from "@pstdio/sdk/api";
```

Most of these types come from `pstdio-api-contracts`. The SDK also defines a few client-facing types:

- `ListTicketsInput`
- `TicketAttemptResponse`
- `ActionResult`
- `ExecuteActionInput`

Use `import type` for this entrypoint. It does not expose runtime helpers.

## Resource Types

`@pstdio/sdk/resources` re-exports the shared Prompt Studio entities used across the API and plugin system.

Common exports include `Project`, `Repo`, `Ticket`, `TicketDetail`, `TicketListItem`, `TicketFile`, `Workspace`,
`WorkspaceListItem`, `Session`, `SessionStatus`, `Status`, `AttemptStatus`, `Tag`, `TagOption`, `Template`,
`TemplateWithContent`, `TemplateType`, `Skill`, `SkillWithContent`, `AgentConfig`, `AgentInfo`, `AgentModel`,
`AgentAvailabilityType`, and `FileRecord`.

```ts
import type {
  Session,
  TicketDetail,
  WorkspaceListItem,
} from "@pstdio/sdk/resources";
```

## Prompt Rendering

`@pstdio/sdk/prompts` exposes `renderPrompt(template, data)`, a small wrapper around Mustache.

```ts
import { renderPrompt } from "@pstdio/sdk/prompts";

const prompt = renderPrompt("Implement ticket {{ticket}}", {
  ticket: "PS-42",
});
```

Use this when a session prompt or action prompt is stored as a reusable template with variables.

## Plugins

Prompt Studio plugins export a default `definePlugin(...)` result from a TypeScript or JavaScript module.

Plugins can provide:

- `actions`: user-triggered actions attached to tickets, workspaces, or sessions
- `hooks`: lifecycle handlers that run before or after Prompt Studio events

### Action example

```ts
import { createSession, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "refine-ticket",
      label: "Refine ticket",
      targetType: "ticket",
      placement: "overflow",
      params: [
        {
          key: "context",
          label: "Additional context",
          type: "longtext",
          required: false,
        },
      ],
      async trigger(ctx) {
        const context = ctx.params.context as string | undefined;

        const parts = [`Refine ticket: ${ctx.target.shorthand}`];
        if (context) parts.push(`Additional context:\n${context}`);

        await createSession(ctx, {
          title: `Refine ticket: ${ctx.target.shorthand}`,
          prompt: parts.join("\n\n"),
        });
      },
    },
  ],
});
```

### Hook example

```ts
import { definePlugin, runCommand } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async preAttemptStatusChange(ctx) {
      if (ctx.toStatus !== "review-ready") return;
      if (!ctx.worktreePath) return;

      const validation = await runCommand(ctx.worktreePath, [
        "bun",
        "run",
        "validate",
      ]);
      if (validation.exitCode === 0) return;

      const output = [validation.stdout, validation.stderr]
        .filter(Boolean)
        .join("\n\n");

      return {
        reject: true,
        reason: output || "bun run validate failed",
      };
    },
  },
});
```

### Plugin types

The plugin entrypoint exports the core types used by plugin authors, including `PluginDefinition`, `PluginHooks`,
`PrePluginHooks`, `PostPluginHooks`, `HookResponse`, `PreHookReturn`, `PostHookReturn`, `ActionDefinition`,
`ActionDescriptor`, `ActionInput`, `ActionTriggerContext`, `ActionParamDef`, `TargetType`, and `ActionPlacement`.

Action parameter definitions support `text`, `longtext`, `select`, `template-select`, `agent`, and `repo`.
Action targets support `ticket`, `workspace`, and `session`. Action placement supports `primary`, `secondary`,
and `overflow`.

`definePlugin()` is intentionally small. Today it mainly validates that every declared action has a `trigger(ctx)` function and then returns the plugin definition unchanged.

### Lifecycle hooks

Pre hooks may return `{ reject, reason, data }` to stop an operation. Post hooks return `void`.

Available pre hooks:

- `preTicketCreation`
- `preTicketStatusChange`
- `preTicketArchive`
- `preTicketDeletion`
- `preWorktreeCreate`
- `preWorktreeRemove`
- `preCommit`
- `preRebase`
- `preMerge`
- `preAttemptStatusChange`

Available post hooks:

- `postTicketCreation`
- `postTicketStatusChange`
- `postTicketArchive`
- `postTicketDeletion`
- `postSessionStart`
- `postSessionSuccess`
- `postSessionFail`
- `postSessionResume`
- `postSessionAwaitInput`
- `postWorktreeCreate`
- `postWorktreeRemove`
- `postCommit`
- `postRebase`
- `postMerge`
- `onConflict`
- `postAttemptStatusChange`

### Plugin helpers

`@pstdio/sdk/plugins` also exports helper functions for common workflow automation:

| Helper                             | Purpose                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `createAttempt`                    | Create a ticket attempt and start a session                                                  |
| `createWorkspace`                  | Create a ticket attempt without starting a session                                           |
| `createSession`                    | Create a session using `ctx.projectId` automatically                                         |
| `followupSession`                  | Send a follow-up message using an explicit or contextual session id                          |
| `findTicketByRef`                  | Resolve a ticket by id or shorthand                                                          |
| `findWorkspaceByRef`               | Resolve a workspace by id or shorthand                                                       |
| `getAttemptsForTicket`             | List workspaces for a ticket                                                                 |
| `workspacesForTicket`              | List workspaces for a ticket                                                                 |
| `setTicketStatus`                  | Resolve a status by name and update the ticket                                               |
| `setWorkspaceAttemptStatus`        | Update a workspace attempt status by name                                                    |
| `updateTicketWhenAllAttemptsMatch` | Update a ticket when all attempts share a target attempt status                              |
| `removeAllWorktreesForTicket`      | Remove every worktree currently attached to a ticket                                         |
| `bootstrapWorktree`                | Copy Prompt Studio and agent metadata into a worktree and optionally pull the ticket locally |
| `pullTickets`                      | Write ticket markdown and attachments into `.pstdio/tickets/...`                             |
| `runCommand`                       | Run a command array in a working directory and capture `stdout`, `stderr`, and `exitCode`    |

These helpers accept action or hook context and resolve project-scoped ids for you where possible.

## Hook Context Types

`@pstdio/sdk/hooks` exposes the shared context types used by hooks and hook runtimes:

`BaseHookContext`, `HookClient`, `HookPayload`, `SessionFollowupInput`, `AttemptStatusChangeContext`,
`SessionHookContext`, `TicketContext`, `TicketCreationContext`, `TicketStatusChangeContext`, `WorktreeContext`,
and `WorktreeCreateContext`.

Import from this entrypoint when you want to annotate hook code explicitly:

```ts
import type {
  SessionHookContext,
  TicketStatusChangeContext,
} from "@pstdio/sdk/hooks";

const logStatusChange = (ctx: TicketStatusChangeContext) => {
  console.log(ctx.shorthand, ctx.fromStatus, ctx.toStatus);
};

const onSessionStart = async (ctx: SessionHookContext) => {
  console.log(ctx.sessionId, ctx.sessionStatus);
};
```

## Package Development

From the repo root:

```bash
bun run --cwd packages/sdk build
bun run --cwd packages/sdk lint
bun run --cwd packages/sdk test
```

From `packages/sdk`:

```bash
bun run build
bun run lint
bun run test
```
