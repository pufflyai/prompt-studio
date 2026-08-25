# SDK

`@pstdio/sdk` is the programmatic interface for the core Prompt Studio platform.
It provides resource types, a typed HTTP client, prompt rendering helpers, and
extension authoring types. Planner tickets are extension-owned and are exposed
through planner commands rather than core SDK ticket clients.

## Installation

The SDK is available as a workspace package in the monorepo:

```ts
import { createClient } from "@pstdio/sdk/client";
import type { Session, Workspace } from "@pstdio/sdk/resources";
import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
```

## Package Structure

| Import                   | Purpose                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `@pstdio/sdk/resources`  | Core resource types: `Session`, `Project`, `Workspace`, etc.             |
| `@pstdio/sdk/api`        | Core request/response types: `CreateSessionInput`, `FollowUpInput`, etc. |
| `@pstdio/sdk/client`     | Typed HTTP client: `createClient()`                                      |
| `@pstdio/sdk/prompts`    | Prompt templating helpers: `renderPrompt()`                              |
| `@pstdio/sdk/extensions` | Extension authoring types and contracts                                  |

The root import `@pstdio/sdk` is intentionally smaller than the subpaths. It re-exports the main client and shared API/resource types. Extension authoring and prompt rendering stay on their dedicated subpaths.

## Quick Start

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient();

const projects = await client.projects.list();
const sessions = await client.sessions.list(projects[0].id);
console.log(sessions);
```

## Next

- [Method Reference](/references/sdk/reference)
- [Extensions](../../extensions/api.md)
