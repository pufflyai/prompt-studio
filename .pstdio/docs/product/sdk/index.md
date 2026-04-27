# SDK

`@pstdio/sdk` is the generic programmatic interface for the pstdio platform. It provides resource types, a typed HTTP client, prompt helpers, and v2 extension authoring primitives.

## Installation

The SDK is available as a workspace package in the monorepo:

```ts
import { createClient } from "@pstdio/sdk/client";
import type { Ticket } from "@pstdio/sdk/resources";
import { defineExtension } from "@pstdio/sdk/extensions";
```

## Package Structure

The SDK is published through subpath exports:

| Import                 | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `@pstdio/sdk/resources` | Resource types — `Ticket`, `Session`, `Project`, etc.               |
| `@pstdio/sdk/api`       | Request/response types — `CreateTicketInput`, `FollowUpInput`, etc. |
| `@pstdio/sdk/client`    | Typed HTTP client — `createClient()`                                |
| `@pstdio/sdk/extensions` | Generic extension authoring — `defineExtension()`, commands, slots, resources, params, package assets |
| `@pstdio/sdk/prompts`   | Prompt templating helpers — `renderPrompt()`                        |

Import from subpaths. The SDK package does not expose a root entrypoint in the current package manifest.

## Extension Package Boundary

`@pstdio/sdk` is platform substrate only. It must not import from extension packages, bundle extension-specific code, or export workflow-specific contracts/clients such as planner, tickets, workspace shell tabs, templates, skills, or harness implementations.

Extensions can depend on `@pstdio/sdk` for generic authoring primitives, runtime types, request helpers, and core clients. Extension-specific contracts and helper SDKs belong to the package that owns that workflow. For example, planner ticket-management contracts and helpers should come from `@pstdio/pstdio-ext-planner/contract` or `@pstdio/pstdio-ext-planner/sdk`, not from `@pstdio/sdk`.

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
- [Extensions](./extensions.md)
- [Extension Cookbook](../extensions/cookbook.md)
