# @pstdio/sdk

TypeScript SDK for Prompt Studio.

This package is the public integration surface for:

- calling the Prompt Studio HTTP API
- importing shared request and resource types
- rendering prompt templates
- authoring Prompt Studio extensions with generic platform primitives

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
| `@pstdio/sdk/extensions` | Generic extension authoring primitives and runtime types |
| `@pstdio/sdk/prompts`   | Prompt rendering helpers                                  |

Example:

```ts
import { createClient, PstdioApiError } from "@pstdio/sdk/client";
import type { CreateTicketInput } from "@pstdio/sdk/api";
import type { TicketDetail } from "@pstdio/sdk/resources";
import { defineExtension } from "@pstdio/sdk/extensions";
import { renderPrompt } from "@pstdio/sdk/prompts";
```

## Extension Package Boundary

`@pstdio/sdk` is platform substrate only. It must stay workflow-agnostic: no imports from extension packages, no bundled extension-specific code, and no extension-owned contracts or clients such as planner, tickets, workspace shell tabs, templates, skills, or harness implementations.

Extensions can depend on `@pstdio/sdk` for generic primitives, runtime types, request helpers, and core clients. Extension-specific contracts and helper SDKs belong to the package that owns that workflow. For example, planner ticket-management contracts and helpers should come from `@pstdio/pstdio-ext-planner/contract` or `@pstdio/pstdio-ext-planner/sdk`, not from `@pstdio/sdk`.

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
| `harnesses`  | `list`, `info`, `models`, `setup`, `setupAvailable`, `update`, `delete`                                                                            |
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

`@pstdio/sdk/resources` re-exports the shared Prompt Studio entities used across the API and extension system.

Common exports include `Project`, `Repo`, `Ticket`, `TicketDetail`, `TicketListItem`, `TicketFile`, `Workspace`,
`WorkspaceListItem`, `Session`, `SessionStatus`, `Status`, `AttemptStatus`, `Tag`, `TagOption`, `Template`,
`TemplateWithContent`, `TemplateType`, `Skill`, `SkillWithContent`, `HarnessConfig`, `HarnessInfo`, `HarnessModel`,
`HarnessAvailabilityType`, and `FileRecord`.

```ts
import type {
  Session,
  TicketDetail,
  WorkspaceListItem,
} from "@pstdio/sdk/resources";
```

## Extensions

`@pstdio/sdk/extensions` exposes generic v2 extension authoring primitives:

- `defineExtension`
- `defineSlot`
- `defineEvent`
- `defineResource`
- `packageAsset`
- `params`
- runtime and context types for commands, storage, resources, slots, events, templates, skills, and harness providers

Keep workflow-specific contracts in the extension package that owns them. For example, planner integrations should import planner ticket-management contracts and helpers from `@pstdio/pstdio-ext-planner/contract` or `@pstdio/pstdio-ext-planner/sdk`.

## Prompt Rendering

`@pstdio/sdk/prompts` exposes `renderPrompt(template, data)`, a small wrapper around Mustache.

```ts
import { renderPrompt } from "@pstdio/sdk/prompts";

const prompt = renderPrompt("Implement ticket {{ticket}}", {
  ticket: "PS-42",
});
```

Use this when a session prompt or action prompt is stored as a reusable template with variables.

## Extension Commands

Extensions export a default `defineExtension(...)` result from a TypeScript or JavaScript module.

```ts
import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "project.review",
  name: "Review",
  commands: {
    runReview: {
      title: "Run review",
      params: {
        notes: params.longtext({ label: "Notes" }),
      },
      async run(ctx) {
        await ctx.activity.record({
          eventType: "review.started",
          summary: "Review started",
        });
      },
    },
  },
});
```

Workflow-specific helpers live in the owning extension package. Planner ticket management, for example, belongs to `@pstdio/pstdio-ext-planner`, not to `@pstdio/sdk`.

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
