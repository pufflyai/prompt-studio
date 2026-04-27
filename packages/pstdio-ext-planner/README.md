# @pstdio/pstdio-ext-planner

Planner extension package for pstdio ticket management.

This package owns planner ticket behavior. Ticket data, ticket metadata, statuses, tags, local ticket files, pull/push behavior, and ticket-facing workflows belong here rather than in the core database or generic SDK.

## Ownership Boundary

Planner owns:

- ticket records and hierarchy
- ticket statuses and tag definitions
- ticket file and artifact relationships
- ticket pull and push behavior
- ticket-specific CLI/API/UI workflow contracts
- the built-in local ticket workflow

Core owns:

- projects, repos, sessions, workspaces, files, activity, sync, and extension runtime primitives
- generic extension storage and resource tools
- generic command/session/activity APIs that extensions can use

Core should not define ticket-specific DB tables such as `tickets`, `ticket_statuses`, `ticket_tags`, `ticket_tag_options`, `ticket_tag_assignments`, `ticket_files`, `ticket_workspaces`, or ticket-specific artifact tables. Those concepts should be represented by planner-owned data using extension storage and generic file/resource references.

## Entry Points

| Import path                           | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| `@pstdio/pstdio-ext-planner`          | Built-in planner extension definition              |
| `@pstdio/pstdio-ext-planner/contract` | Planner ticket contracts                           |
| `@pstdio/pstdio-ext-planner/sdk`      | Planner API client helpers                         |

Example:

```ts
import plannerExtension from "@pstdio/pstdio-ext-planner";
import { PLANNER_EXTENSION_ID } from "@pstdio/pstdio-ext-planner/contract";
import { createPlannerClient } from "@pstdio/pstdio-ext-planner/sdk";
```

## Package Layout

- `src/index.ts`: first-party planner extension registration.
- `src/contract`: public planner contracts.
- `src/sdk`: planner-specific HTTP client helpers.
- `src/local-ticket-workflow`: built-in local ticket pull/push workflow.

Local ticket workflow implementation details stay under `src/local-ticket-workflow`. Other packages should use public planner entrypoints instead of importing internals.

## Extension Tools Needed

For planner to own ticket data cleanly, core must expose generic tools that are not ticket-aware:

- scoped extension collections with list/get/put/delete operations
- binary file storage with stable file resource refs
- resource refs for activity, sessions, workspaces, and sync payloads
- project repo access for local `.pstdio/tickets` artifact IO
- command and route execution hooks that let planner expose ticket workflows without kernel ticket services

Planner data should be stored under the planner extension id (`pstdio.planner`) and modeled as planner resources, not kernel resources.

## Local Ticket Workflow

Planner uses the built-in local ticket workflow directly. It is not a provider registry and does not support external ticket sources.

## Local Ticket Artifacts

The built-in local ticket workflow stores ticket content under:

- `.pstdio/tickets/<SHORTHAND>/ticket.md`
- `.pstdio/tickets/<SHORTHAND>/files`
- `.pstdio/tickets/<SHORTHAND>/artifacts`

Pull writes ticket frontmatter plus body content to `ticket.md` and downloads attachments. Push uploads local ticket content, files, and artifacts through planner-owned storage.

## Development

From the repo root:

```bash
bun run --cwd packages/pstdio-ext-planner test
bun run --cwd packages/pstdio-ext-planner lint
```

Run `bun run validate` before completing non-documentation changes.
