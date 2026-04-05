# SDK

`@pstdio/sdk` is the programmatic interface for the pstdio platform. It provides resource types, a typed HTTP client, and plugin authoring tools.

## Installation

The SDK is available as a workspace package in the monorepo:

```ts
import { createClient } from "@pstdio/sdk/client";
import type { Ticket } from "@pstdio/sdk/resources";
import { definePlugin } from "@pstdio/sdk/plugins";
```

## Package Structure

The SDK exposes a root entrypoint plus several subpath exports:

| Import                 | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `@pstdio/sdk/resources` | Resource types — `Ticket`, `Session`, `Project`, etc.               |
| `@pstdio/sdk/api`       | Request/response types — `CreateTicketInput`, `FollowUpInput`, etc. |
| `@pstdio/sdk/client`    | Typed HTTP client — `createClient()`                                |
| `@pstdio/sdk/plugins`   | Plugin authoring — `definePlugin()`, `PluginHooks`, file-based plugin modules in `.pstdio/plugins` |
| `@pstdio/sdk/prompts`   | Prompt templating helpers — `renderPrompt()`                        |
| `@pstdio/sdk/hooks`     | Hook context types — `TicketContext`, `SessionHookContext`, etc.    |

The root import `@pstdio/sdk` is intentionally smaller than the subpaths. It re-exports `createClient()`, `PstdioApiError`, and the shared API/resource/hook types. Plugin authoring helpers, low-level client request helpers, and prompt rendering stay on their dedicated subpaths.

## Quick Start

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient();

const projects = await client.projects.list();
const tickets = await client.tickets.list(projects[0].id);
console.log(tickets);
```

## Next

- [Method Reference](./reference.md)
- [Plugins](./plugins.md)
- [Cookbook](./cookbook.md)
