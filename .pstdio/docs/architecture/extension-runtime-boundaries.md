---
status: "accepted"
created: "2026-04-27T00:00:00Z"
---

# Extension Runtime Boundaries

Prompt Studio v2 uses a project-scoped extension platform. The extension runtime is the only new automation model documented for future work.

## Target Model

- Project workflow behavior lives in `.pstdio/extensions` or first-party extension packages.
- Extensions are defined with generic primitives from `@pstdio/sdk/extensions`.
- Extension packages own workflow-specific contracts and optional SDKs.
- API-backed state changes run through `pstdio-api`.
- Repo-context artifact IO is allowed where the repo exists, but metadata, activity, sync, and storage mutations go through API services.
- Moving a workflow into an extension changes ownership and package boundaries; it does not remove the workflow from the product model.

## Package Ownership

| Package | Responsibility |
| --- | --- |
| `@pstdio/sdk` | Generic extension primitives, runtime types, request helpers, and core clients only |
| `pstdio-extensions` | Extension loading, diagnostics, command registry, package assets, artifact mounts, and API-backed runtime adapters |
| `pstdio-api` | DB ownership, domain services, extension command execution, activity, sync, and storage |
| `pstdio` | CLI command routing, help generation, missing-command recovery, and API calls |
| First-party extension packages | Workflow-specific contracts, SDK helpers, views, commands, resources, events, templates, skills, and providers |

`@pstdio/sdk` must not import from extension packages or export extension-specific contracts/clients. Extensions may import from `@pstdio/sdk`.

## Extension-Owned SDKs

An extension package can expose public subpaths for other extensions:

- `<package>/contract` for slots, events, resources, providers, and shared types.
- `<package>/sdk` for builders, typed clients, and helper functions.

For example, planner integrations import planner helpers from `@pstdio/pstdio-ext-planner/contract` or `@pstdio/pstdio-ext-planner/sdk`, not from `@pstdio/sdk`.

## Commands

Commands are the executable primitive for CLI, UI buttons, menus, automation, and event handlers.

```ts
export default defineExtension({
  id: "project.review",
  name: "Review",
  commands: {
    runReview: {
      title: "Run review",
      target: "workspace",
      cli: {
        path: "workspaces review",
        description: "Start a review session for a workspace",
      },
      async run(ctx) {
        await ctx.sessions.create({
          title: "Review workspace",
          anchors: [{ type: "workspace", id: ctx.target.id, role: "primary" }],
        });
      },
    },
  },
});
```

Stateful command execution belongs behind the API command execution boundary. Client-side command metadata can support help and diagnostics, but persisted behavior runs in the API-owned runtime.

## Events

Events are facts emitted by the kernel or by the extension that owns a workflow. Blocking pre-flight behavior belongs in command validation or explicit policy checks.

Examples:

- `@pstdio/pstdio-ext-planner/contract` owns ticket events such as ticket created, archived, or status changed.
- `pstdio-ext-workspace-shell/contract` owns workspace shell slots and workspace UI events.
- Kernel project/session events stay generic and workflow-agnostic.

## Slots

The owner of a rendered surface owns the slots inside that surface.

| Surface | Slot Owner |
| --- | --- |
| Project shell | Kernel SDK |
| Session shell | Kernel SDK |
| Ticket pages | `@pstdio/pstdio-ext-planner` |
| Workspace pages | `pstdio-ext-workspace-shell` |

Generic slot primitives live in `@pstdio/sdk/extensions`; named domain slots live in the owning extension package.

## Planner Boundary

Internal ticket management is owned by `@pstdio/pstdio-ext-planner`, not by `@pstdio/sdk`.

`@pstdio/pstdio-ext-planner` owns:

- the default `prompt-studio` ticket provider
- ticket source provider contracts for the internal ticket workflow
- provider registry helpers
- planner diagnostics
- planner-specific typed clients and SDK helpers
- local ticket artifact behavior
- ticket frontmatter and display-title helpers
- ticket pull/push behavior

Ticket commands call the planner boundary for ticket management behavior.

## Data Boundary

The API is the only DB owner.

- CLI, dashboard, TUI, SDK consumers, and extension adapters do not import `pstdio-db`.
- Extension command handlers that mutate project state execute through API services.
- Extension storage is scoped by project and extension.
- Activity records use generic resource refs and include source extension ids.

## Local Files

`.pstdio` remains repo context:

- `.pstdio/extensions` for project-local extension source.
- `.pstdio/tickets` for ticket artifacts owned by the planner extension.
- Future artifact mounts for repo-visible files that AI coding tools should inspect or edit.

Dashboard-edited templates, skills, preferences, statuses, and other active project state live in API-owned storage, not in local extension source.

## Documentation Rule

Product and architecture docs should describe the extension platform as the user-facing system contract.
