# @pstdio/sdk

TypeScript SDK for Prompt Studio.

This package is the public integration surface for:

- calling the Prompt Studio HTTP API
- importing shared request and resource types
- rendering prompt templates
- authoring Prompt Studio extensions

The package is ESM-only and is published through subpath exports. Import from the entrypoint you need, not from `@pstdio/sdk` directly.

## Install

```bash
bun add @pstdio/sdk
```

## Entry Points

| Import path              | Purpose                               |
| ------------------------ | ------------------------------------- |
| `@pstdio/sdk/client`     | Runtime HTTP client for Prompt Studio |
| `@pstdio/sdk/api`        | Request and response payload types    |
| `@pstdio/sdk/resources`  | Shared resource/entity types          |
| `@pstdio/sdk/prompts`    | Prompt rendering helpers              |
| `@pstdio/sdk/extensions` | Extension authoring types             |
| `@pstdio/sdk/hooks`      | Hook context and client types         |

Example:

```ts
import { createClient, PstdioApiError } from "@pstdio/sdk/client";
import type { CreateTicketInput } from "@pstdio/sdk/api";
import type { TicketDetail } from "@pstdio/sdk/resources";
import { renderPrompt } from "@pstdio/sdk/prompts";
import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import type { WorktreeCreateContext } from "@pstdio/sdk/hooks";
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

Most of these types come from `pstdio-api-contracts`. Use `import type` for this entrypoint. It does not expose runtime helpers.

## Resource Types

`@pstdio/sdk/resources` re-exports the shared Prompt Studio entities used across the API and extension system.

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

## Extensions

Prompt Studio extensions are packaged integrations that can contribute commands, middleware, lifecycle event handlers, menu entries, and webviews. Use `@pstdio/sdk/extensions` for the extension authoring types.

```ts
import type { ExtensionDefinition } from "@pstdio/sdk/extensions";

const extension: ExtensionDefinition = {
  manifest: {
    id: "example-extension",
    name: "Example extension",
    version: "0.0.0",
  },
  activate(ctx) {
    ctx.commands.register({
      id: "example-extension.say-hello",
      title: "Say hello",
      handler: () => ({ ok: true }),
    });
  },
};

export default extension;
```

## Hook Types

`@pstdio/sdk/hooks` exposes the shared context types used by hook runtimes and hook handlers.

```ts
import type {
  CommitContext,
  RebaseContext,
  WorktreeRemoveContext,
} from "@pstdio/sdk/hooks";
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
