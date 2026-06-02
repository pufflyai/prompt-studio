---
status: "accepted"
created: "2026-04-05T00:00:00Z"
updated: "2026-05-20T00:00:00Z"
---

# Extension Runtime Boundaries

## Summary

Lifecycle automation, commands, command middleware, schedules, templates, and skills are owned by the extension system.

The runtime boundary is:

- `@pstdio/sdk/extensions` owns the public extension authoring contract.
- `pstdio-extensions` owns extension loading and command/event execution.
- `pstdio-api` owns host command implementations that need database, session, ticket, or worktree services.
- `pstdio` owns CLI workflows and calls API/SDK surfaces rather than loading automation modules directly.
- `pstdio-wt` remains dependency-free and accepts injected lifecycle callbacks where needed.

## Goals

- Keep extensions as the single automation surface.
- Keep host-specific behavior inside `pstdio-api`, where service dependencies already exist.
- Avoid repo-local runtime loading from project configuration folders.
- Keep the SDK focused on typed authoring contracts and the HTTP client.
- Keep worktree Git plumbing independent of product automation.

## Ownership

### `@pstdio/sdk/extensions`

Owns the public extension contract:

- `defineExtension`
- extension command and middleware types
- event payload types
- extension context types
- contribution types for templates, skills, and other declarative assets

The SDK should not depend on server implementation details. When extension authors need host behavior, the contract should expose a typed context API or host command shape that `pstdio-api` implements.

### `pstdio-extensions`

Owns extension runtime mechanics:

- resolve extension manifests and entrypoints
- execute commands
- execute command middleware
- dispatch lifecycle events
- build the extension context from injected environment capabilities

The runner receives host capabilities through `CommandRunnerEnvironment`. Missing host capabilities should fail clearly at runtime instead of silently emulating behavior.

### `pstdio-api`

Owns host-backed behavior:

- project, ticket, session, workspace, and attempt commands
- lifecycle event dispatch from API workflows
- command middleware dispatch for blocking status transitions
- default extension installation and enablement
- database-backed context APIs exposed to extensions

API routes should fire extension events at durable lifecycle boundaries after the primary state change succeeds. Blocking behavior should use extension command middleware around the host command being protected.

### `pstdio`

Owns CLI workflows. The CLI can install/enable extensions and call the API, but it should not load project-local automation modules itself.

### `pstdio-wt`

Owns Git worktree plumbing only. Product lifecycle behavior is injected by callers or handled by API extension events after the worktree operation completes.

## Default Extensions

The default extension set provides the product behavior that used to be shipped as project-local automation:

- `pstdio-core-skills`
- `pstdio-core-templates`
- `pstdio-core-tickets`
- `pstdio-core-workspace-automations`
- `pstdio-core-worktree-automations`

New and linked projects should be bootstrapped with project config only. They should not receive repo-local automation source files.

## Dependency Direction

```text
@pstdio/sdk/extensions
  <- extension packages
  <- pstdio-extensions

pstdio-extensions
  <- pstdio-api

pstdio-api
  <- pstdio
  <- pstdio-dashboard

pstdio-wt
  <- pstdio-api / pstdio through injected callbacks only
```

Rules:

- Extension packages import authoring types from `@pstdio/sdk/extensions`.
- Runtime packages execute extensions through `pstdio-extensions`.
- Host commands and context APIs are implemented where the owning services live.
- Project repos are data/config roots, not automation module roots.

## Unsupported Legacy Surfaces

The old repo-local automation surfaces are not compatibility targets:

- repo-local automation module loading
- action routes
- hook dispatchers
- schedulers
- CLI management commands
- SDK authoring helpers

Existing user-authored automation should be migrated to installed extensions.
