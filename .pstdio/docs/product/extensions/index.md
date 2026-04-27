# Extensions

Extensions are the Prompt Studio customization model.

## What Extensions Own

Extensions own workflow behavior:

- commands
- views and routes
- slots and rendered panels
- events and event handlers
- resources and activity renderers
- artifact mounts
- templates and skills
- harness providers
- workspace type providers

The kernel owns projects, repos, sessions, workspace lifecycle, storage, sync, diagnostics, routing, and API execution.

## Authoring

Local extension source lives in:

```txt
.pstdio/extensions/<extension-id>/extension.ts
```

Package extensions can be wrapped locally:

```ts
export { default } from "@pstdio/pstdio-ext-planner";
```

Extension definitions use generic primitives from `@pstdio/sdk/extensions`:

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
      cli: {
        path: "review run",
        description: "Run a project review",
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

## SDK Boundary

`@pstdio/sdk` is generic substrate only. It must not import from extension packages or export extension-specific contracts.

Extension packages can expose their own public subpaths:

- `<package>/contract` for named slots, events, resources, providers, and shared types.
- `<package>/sdk` for builders, typed clients, and helper functions.

For planner integrations, use `@pstdio/pstdio-ext-planner/contract` or `@pstdio/pstdio-ext-planner/sdk`.

## API Boundary

All DB-backed state goes through `pstdio-api`.

Extension command handlers that mutate project state execute through the API command execution path. Repo-context artifact IO can happen where the repo exists, but metadata, storage, activity, sync, sessions, and workspace changes go through API services.

## First-Party Extensions

Existing workflow capabilities move into first-party extension packages. They remain supported behavior, but their contracts, SDK helpers, commands, views, and event ownership live with the extension that owns the workflow.

| Extension | Responsibility |
| --- | --- |
| `@pstdio/pstdio-ext-planner` | Internal ticket management, local ticket artifacts, the built-in local ticket workflow, planner diagnostics, and planner contracts |
| `pstdio-ext-workspace-shell` | Workspace page shell and workspace slots |
| `pstdio-ext-workspace-changes` | Workspace change presentation |
| `pstdio-ext-workspace-checks` | Check/status surfaces |
| `pstdio-ext-workspace-review` | Review flows |
| Harness extension packages | Executable detection, start, send, and stop behavior |

See [Planner Extension](./planner.md) for the planner-owned ticket management boundary.

## Capability Ownership

| Capability | Extension Owner |
| --- | --- |
| Ticket resources, ticket files, statuses, labels, ticket templates, and internal ticket sync | `@pstdio/pstdio-ext-planner` |
| Workspace page layout and workspace-level slots | `pstdio-ext-workspace-shell` |
| Workspace diff and change presentation | `pstdio-ext-workspace-changes` |
| Check/status surfaces for workspaces | `pstdio-ext-workspace-checks` |
| Review commands and review UI | `pstdio-ext-workspace-review` |
| Executable AI coding tool integration | Harness extension packages |

Moving a capability into an extension changes ownership and package boundaries. It does not remove the product behavior.

## Diagnostics

Use:

```bash
pstdio extensions check
```

Diagnostics should report invalid exports, duplicate extension ids, invalid commands, CLI collisions, unresolved slots, invalid package assets, artifact mount conflicts, and unavailable harness providers.
