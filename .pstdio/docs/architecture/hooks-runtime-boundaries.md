---
status: "draft"
created: "2026-04-05T00:00:00Z"
---

# Proposal: Plugin Runtime Boundaries

## Summary

This proposal makes three package decisions explicit:

1. Add `pstdio-api-contracts` as the owner of shared API transport contracts.
2. Make `@pstdio/sdk` the preferred first-party client for CLI and dashboard requests where it fits today.
3. Consolidate plugin runtime composition under `pstdio-plugins` subpaths:
   - `pstdio-plugins/loader`
   - `pstdio-plugins/registry`
   - `pstdio-plugins/hooks`

Under this plan, `pstdio-hooks` is removed. Dispatch core and composed hook runtime behavior move into `pstdio-plugins/hooks`.

## Problem

The current shape is inconsistent in several ways:

- API request and response types are effectively shared between `pstdio-api`, `@pstdio/sdk`, CLI, and dashboard, but they do not have a single package owner.
- `@pstdio/sdk` is already treated as a public client surface, but first-party code still frequently bypasses it and writes direct request wrappers.
- `@pstdio/sdk` already owns the typed plugin hook contract and hook contexts, but the current runtime also supports pre-hook payload overrides via merged `data`, and that capability is not fully represented in the SDK contract yet.
- `pstdio-plugins` defines its own loose `PluginDefinition` and `hooks` shape instead of reusing the typed contract from the SDK.
- The intended client direction is muddy: if `pstdio-api-contracts` is introduced without discipline, CLI and dashboard can start depending on raw transport contracts directly instead of treating the SDK as the ergonomic default.
- Hook runtime composition is split between:
  - a local plugin service in `pstdio-api`
  - ad hoc plugin loading plus dispatcher wiring in CLI/features
  - narrow local `HookDispatch` interfaces in packages like `pstdio-wt`
- `pstdio-hooks` has become a tiny dispatch-core package, but the actual runtime composition lives elsewhere.

This makes transport ownership, client direction, and plugin runtime ownership unclear, and it encourages drift between server behavior, SDK behavior, and first-party callers.

## Goals

- Introduce `pstdio-api-contracts` as the canonical home for shared API request, response, and resource transport shapes.
- Make `@pstdio/sdk` the target client for CLI and dashboard API requests as much as possible today.
- Keep `@pstdio/sdk` as the public owner of the full plugin authoring contract, including the complete pre/post hook return contract.
- Make `@pstdio/sdk/plugins` the sole source of plugin contract types used by runtime packages.
- Consolidate plugin runtime composition under `pstdio-plugins/hooks`.
- Remove duplicate hook and plugin contract definitions across packages.
- Eliminate ad hoc runtime wiring from first-party feature code.

## Explicit Non-Goals

- Do not redesign the underlying business events that hooks fire on.
- Do not preserve `pstdio-hooks` as a long-term package.
- Do not make direct `fetch` wrappers illegal on day one; they remain a temporary gap-filling tool while SDK coverage catches up.

## Proposed Ownership

### `pstdio-api-contracts`

Own the API transport contract shared by server, the SDK, and any direct raw-transport consumers:

- request body schemas
- response body schemas
- inferred request and response types
- resource DTOs that cross the HTTP boundary

`pstdio-api` should consume these contracts instead of owning parallel DTO definitions locally. `@pstdio/sdk` should build its client surface on top of them.

CLI and dashboard should not depend on `pstdio-api-contracts` by default. They should consume it directly only when they genuinely need raw transport shapes that the SDK does not model yet.

### `@pstdio/sdk`

Own the public client and plugin-authoring surface:

- ergonomic API client for first-party and external callers
- plugin authoring helpers
- plugin hook contracts
- typed hook contexts

`@pstdio/sdk/plugins` is the sole source of plugin contract types. Plugin modules importing SDK types is expected and desired.

For hooks, `@pstdio/sdk` remains the canonical owner of the full public contract:

- pre-hook return contract, including payload override data
- post-hook return contract
- `PluginHooks`
- pre/post hook name subsets used for typed firing

For first-party code, `@pstdio/sdk` becomes the preferred client used by CLI and dashboard wherever the current SDK surface is sufficient. Direct request wrappers are treated as SDK coverage gaps, not the target architecture.

### `pstdio-plugins/loader`

Own low-level plugin loading concerns only:

- scan `.pstdio/plugins`
- derive plugin identity
- import plugin modules
- ensure plugin workspace structure exists

### `pstdio-plugins/registry`

Own indexing concerns only:

- action indexing
- hook indexing
- action lookup/listing

### `pstdio-plugins/hooks`

Own runtime composition and dispatch behavior:

- `createHookDispatcher`
- `PreHookResult`
- `HookRuntime`
- `PluginRuntime`
- repo-scoped plugin runtime loading
- project-scoped cached runtime store

This subpath consumes the SDK-owned public hook contract. It should not redefine `PluginHooks`, `HookResponse`, `PreHookReturn`, or `PostHookReturn` locally.

This subpath owns runtime-only types only, such as:

- resolved dispatch result shapes like `PreHookResult`
- runtime façades like `HookRuntime`
- composed runtime containers like `PluginRuntime`

This subpath composes:

- `pstdio-plugins/loader`
- `pstdio-plugins/registry`
- injected `PstdioClient` instances or `createClient` factories supplied by callers

`pstdio-hooks` is deleted after migration. Its dispatch core moves here.

This proposal does not make `pstdio-plugins/hooks` the owner of SDK client construction. `pstdio-api` or `pstdio` should inject a `PstdioClient` or a `createClient` factory. That keeps the `@pstdio/sdk/client` dependency type-only at this layer unless a future implementation explicitly chooses otherwise.

## Dependency Direction

The target dependency graph is:

```text
pstdio-api-contracts
  <- @pstdio/sdk

@pstdio/sdk/plugins
  <- plugin modules
  <- pstdio-plugins/hooks   (types only)

@pstdio/sdk/client
  <- pstdio-api
  <- pstdio
  <- pstdio-plugins/hooks   (types only)

pstdio-plugins/loader
  <- pstdio-plugins/hooks

pstdio-plugins/registry
  <- pstdio-plugins/hooks

pstdio-plugins/hooks
  <- pstdio-api
  <- pstdio

@pstdio/sdk
  <- dashboard
  <- pstdio

pstdio-wt
  <- (none)
```

Key rules:

- plugin modules should import hook and action contracts from `@pstdio/sdk/plugins`
- `pstdio-plugins/hooks` should import plugin contract types from `@pstdio/sdk/plugins`
- `pstdio` and dashboard should prefer `@pstdio/sdk`, not `pstdio-api-contracts`
- `pstdio-api-contracts` should sit below the SDK, not become the new default dependency for first-party apps
- `pstdio-wt` stays dependency-free

## Runtime Shape

The target runtime surface lives in `pstdio-plugins/hooks`.

```ts
import type {
  PostPluginHooks,
  HookResponse,
  PrePluginHooks,
} from "@pstdio/sdk/plugins";
import type { PstdioClient } from "@pstdio/sdk/client";

type HookHandler = (ctx: unknown) => HookResponse | void | Promise<HookResponse | void>;

type PreHookResult = {
  rejected: boolean;
  reason?: string;
  data?: Record<string, unknown>;
};

declare function createHookDispatcher(): {
  register(hookName: string, handler: HookHandler): void;
  firePreHook(hookName: string, ctx: unknown): Promise<PreHookResult>;
  firePostHook(hookName: string, ctx: unknown): Promise<void>;
};

type HookRuntime = {
  firePre<K extends keyof PrePluginHooks>(
    hookName: K,
    ctx: Parameters<NonNullable<PrePluginHooks[K]>>[0],
  ): Promise<PreHookResult>;
  firePost<K extends keyof PostPluginHooks>(
    hookName: K,
    ctx: Parameters<NonNullable<PostPluginHooks[K]>>[0],
  ): Promise<void>;
};

type WorktreeHookDispatch = {
  firePreHook(hookName: "preCommit" | "preRebase" | "preMerge", ctx: unknown): Promise<{ rejected: boolean; reason?: string }>;
  firePostHook(
    hookName: "postCommit" | "postRebase" | "postMerge" | "onConflict",
    ctx: unknown,
  ): Promise<void>;
};

type PluginRuntime = {
  repoPath: string | null;
  client: PstdioClient;
  hooks: HookRuntime;
  actions: {
    list(targetType?: string): ActionDescriptor[];
    get(namespacedKey: string): ResolvedAction | undefined;
  };
};

declare function loadPluginRuntime(input: {
  repoPath: string;
  client: PstdioClient;
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
}): Promise<PluginRuntime>;

declare function createPluginRuntimeStore(input: {
  resolveRepoPath(projectId: string): Promise<string | null>;
  createClient(): PstdioClient;
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
}): {
  getForProject(projectId: string): Promise<PluginRuntime>;
  invalidate(projectId: string): void;
  dispose(): void;
};
```

Design rules:

- `loadPluginRuntime(...)` owns repo-scoped composition only.
- `createPluginRuntimeStore(...)` owns project-scoped caching and invalidation only.
- `pstdio-plugins/hooks` consumes hook contract types from `@pstdio/sdk/plugins`; it does not publish replacement contract types.
- callers inject a `PstdioClient` or `createClient` factory; `pstdio-plugins/hooks` does not own a default SDK client construction policy.
- first-party feature code should depend on `HookRuntime` or `PluginRuntime`, not on loader/registry/dispatcher internals.
- `pstdio-wt` remains dependency-free and continues to accept an injected minimal hook facade rather than importing `pstdio-plugins/hooks` directly.
- callers such as CLI/API adapt from `HookRuntime` to `pstdio-wt`’s local injected facade.

## Client Direction

The intended client stack is:

- `pstdio-api-contracts` owns HTTP-facing shapes
- `@pstdio/sdk` provides the ergonomic client built on those shapes
- CLI and dashboard use `@pstdio/sdk` by default
- `pstdio-api-contracts` is not the default dependency of CLI or dashboard
- direct request wrappers remain only where the SDK does not yet cover the behavior cleanly

This keeps the SDK honest. If first-party callers avoid it, the SDK becomes a secondary surface instead of the real client API.

## Migration Plan

### Phase 1: Introduce `pstdio-api-contracts`

- Create `pstdio-api-contracts` as the canonical home for shared API wire contracts.
- Move duplicated request/response/resource transport shapes there.
- Update `pstdio-api` to consume those contracts instead of owning parallel DTO type definitions.
- Keep `pstdio-api-contracts` scoped below the SDK. Do not make CLI or dashboard depend on it unless they truly need raw transport shapes.

#### Duplicated types to move (~50)

**Resource DTOs** (currently Zod schemas in `pstdio-api/src/features/*/dto.ts` and TypeScript types in `sdk/src/resources/*.ts`):

- Ticket, TicketDetail, TicketListItem, TicketFile (FileRecord)
- Project
- Workspace, WorkspaceListItem
- Session
- Status, AttemptStatus
- Tag, TagOption
- Template, TemplateWithContent
- Skill, SkillWithContent
- AgentConfig

**Request body types** (Zod schemas in `pstdio-api/src/features/*/dto.ts`, TypeScript types in `sdk/src/api/*.ts`):

- CreateTicketInput, UpdateTicketInput, CreateTicketAttemptInput, UploadTicketFileInput, UpdateWhenAttemptStatusInput
- CreateProjectInput
- CreateWorkspaceInput, UpdateAttemptStatusInput
- CreateSessionInput, FollowUpInput, ApprovalInput
- CreateStatusInput
- CreateTagInput, UpdateTagInput, CreateTagOptionInput, UpdateTagOptionInput
- CreateTemplateInput, UpdateTemplateInput
- SetupAgentInput, UpdateAgentInput

**Response types**: TicketAttemptResponse, UpdateAttemptStatusResponse, SessionConversationResponse, UpdateWhenAttemptStatusResponse

**Enums**: SessionStatus, TicketAttemptMode, TemplateType, AgentAvailabilityType

**Types that stay in `pstdio-api` only** (~14): health/readiness schemas, filesystem listing, git repo/branch schemas, workspace diff schemas, internal error response schemas.

### Phase 2: Make SDK authoritative for client and hook contracts

- Make `@pstdio/sdk` consume `pstdio-api-contracts` for request, response, and resource transport types.
- Keep `@pstdio/sdk` as the canonical owner of plugin hook contracts and typed hook contexts.
- Make `@pstdio/sdk/plugins` the sole source of plugin contract types used by runtime packages.
- Add `data?: Record<string, unknown>` to the SDK's `HookResponse` type so it matches the runtime contract already supported by `pstdio-hooks`. This means `HookResponse` becomes `{ reject?: boolean; reason?: string; data?: Record<string, unknown> }`.
- Split the hook contract into pre-hook and post-hook subsets, or equivalent pre/post name unions, so typed runtime methods cannot accept the wrong hook category.
- Prioritize SDK coverage for the API operations that CLI and dashboard use most often.
- Remove remaining legacy compatibility types that duplicate SDK-owned hook contracts.

### Phase 3: Type `pstdio-plugins` against the SDK

- Update `pstdio-plugins` to import `PluginDefinition` from `@pstdio/sdk`.
- Keep loader validation runtime-oriented, but stop redefining the contract locally.
- Introduce explicit subpath exports:
  - `pstdio-plugins/loader`
  - `pstdio-plugins/registry`
  - `pstdio-plugins/hooks`

### Phase 4: Move dispatch core and runtime composition into `pstdio-plugins/hooks`

`pstdio-plugins/hooks` is the concrete runtime home. Do not add a separate `pstdio-plugin-runtime` package.

Deliverables:

- Move the current dispatcher implementation from `pstdio-hooks` into `pstdio-plugins/hooks`.
- Move hook registration/composition logic currently spread across `pstdio-api` and local callers into `pstdio-plugins/hooks`.
- Export:
  - `createHookDispatcher()`
  - `loadPluginRuntime({ repoPath, client, ensureWorkspace? })`
  - `createPluginRuntimeStore({ resolveRepoPath, createClient, ensureWorkspace? })`
  - `type HookRuntime`
  - `type PluginRuntime`
- Keep SDK client creation at the caller boundary:
  - `loadPluginRuntime(...)` receives an injected `PstdioClient`
  - `createPluginRuntimeStore(...)` receives an injected `createClient` factory
  - `pstdio-plugins/hooks` does not choose a default SDK client internally
- Keep `pstdio-wt` on its local injected hook facade. Do not make `pstdio-wt` depend directly on `pstdio-plugins/hooks`.
- Make `loadPluginRuntime(...)` own the full repo-scoped composition:
  - ensure plugin workspace exists
  - load plugins from `.pstdio/plugins`
  - create registry
  - create dispatcher
  - register plugin hooks
  - expose `runtime.hooks`
  - expose `runtime.actions`
- Make `createPluginRuntimeStore(...)` own project-scoped concerns only:
  - resolve `projectId -> repoPath`
  - cache per-project runtimes
  - watch plugin files and invalidate cache
  - provide empty-runtime behavior when no repo exists

Migration steps:

- Replace the current `pstdio-api`-local plugin service with `createPluginRuntimeStore(...)`.
- Replace ad hoc CLI/feature composition that currently does `loadPlugins(...) + createHookDispatcher()` with `loadPluginRuntime(...)`.
- Keep `pstdio-wt`’s local `HookDispatch`-style interface and adapt to it in CLI/API callers that already own `loadPluginRuntime(...)`.
- Stop allowing first-party feature code to call `loadPlugins(...)`, `createPluginRegistry(...)`, or `createHookDispatcher()` directly unless it is implementing plugin infrastructure.
- Before deleting `pstdio-hooks`, remove all manifest and build references to it:
  - workspace package dependencies and devDependencies
  - e2e package references
  - Dockerfiles or other build-manifest copy steps
  - any packaged build expectations that still mention the package
- Delete `pstdio-hooks`.

Acceptance criteria:

- no import of `pstdio-hooks` remains
- `pstdio-api` no longer owns a private plugin composition service
- no first-party feature code manually wires loader + dispatcher + registration
- `pstdio-api` and `pstdio` consume `pstdio-plugins/hooks`
- `pstdio-wt` remains on a dependency-free injected facade
- project-level cache, empty-runtime behavior, and plugin-file invalidation are implemented once
- all package manifests, Dockerfiles, and build-artifact references to `pstdio-hooks` are removed

### Phase 5: Move first-party callers toward the SDK

- Migrate CLI request wrappers to `@pstdio/sdk` where the SDK already supports the needed operation cleanly.
- Migrate dashboard request wrappers to `@pstdio/sdk` where bundle and transport constraints allow it.
- Track remaining direct request wrappers as explicit SDK coverage gaps instead of leaving them as silent alternatives.

#### SDK coverage audit

The SDK currently covers ~75% of API calls (65+ endpoints). The remaining ~17 endpoints are SDK coverage gaps:

**Repository management** (no SDK coverage):
- `GET /v1/projects/{id}/repos` — list repos
- `POST /v1/projects/{id}/repos` — register repo
- `GET /v1/repos/{id}/branches` — get branches
- `DELETE /v1/projects/{id}/repos/{repoId}` — remove repo

**Streaming / SSE** (no SDK coverage):
- `GET /v1/sessions/{id}/stream` — live session output
- `GET /v1/sync/stream` — real-time data sync (used by both CLI and dashboard)

**Workspace diffs** (no SDK coverage):
- `GET /v1/workspaces/{id}/diff` — file-level diff
- `GET /v1/workspaces/{id}/diff-summary` — diff statistics

**Attempt status CRUD** (no SDK coverage):
- `GET /v1/projects/{id}/attempt-statuses` — list
- `POST /v1/projects/{id}/attempt-statuses` — create
- `PATCH /v1/projects/{id}/attempt-statuses/{id}` — update
- `DELETE /v1/projects/{id}/attempt-statuses/{id}` — delete

**Other gaps** (1 endpoint each):
- `PATCH /v1/projects/{id}/statuses/{statusId}` — update status color / set default
- `DELETE /v1/tickets/{id}/files/{fileId}` — delete ticket file
- `POST /v1/tickets/create-and-start` — create ticket and start session
- `POST /v1/projects/{id}/skills/{name}/update` — update skill
- `POST /v1/agents/setup-available` — batch setup available agents
- `POST /shutdown` — shutdown API

### Phase 6: Remove legacy naming and docs drift

- Remove stale hook terminology that no longer matches the plugin runtime.
- Update docs to describe `@pstdio/sdk` as the preferred client for first-party callers.
- Update docs to consistently describe hooks as SDK plugins.
- Remove references to `pstdio-hooks` as a target architecture package.

## Package-Level Direction

### Keep

- `pstdio-api-contracts` as the transport contract package shared by server, the SDK, and any direct raw-transport consumers
- `@pstdio/sdk` as the preferred client and plugin-authoring surface
- `pstdio-plugins` as the plugin-system package

### Change

- stop duplicating API transport types across `pstdio-api` and `@pstdio/sdk`
- stop treating direct request wrappers in CLI and dashboard as the long-term default
- avoid taking direct `pstdio-api-contracts` dependencies in `pstdio` or dashboard unless they truly need raw wire contracts
- make `pstdio-plugins` subpath-first:
  - `pstdio-plugins/loader`
  - `pstdio-plugins/registry`
  - `pstdio-plugins/hooks`
- make `pstdio-plugins/hooks` consume `@pstdio/sdk/plugins` as the sole plugin contract source
- stop duplicating hook runtime composition in feature call sites

### Delete

- `pstdio-hooks`

## Risks

- Migrating CLI and dashboard toward the SDK may expose missing SDK operations, bundle issues, or transport edge cases that direct request wrappers had hidden.
- A new `pstdio-api-contracts` package adds one more boundary to maintain, so it needs to stay tightly scoped to wire contracts.
- Broadening `pstdio-plugins` into the plugin-system package increases responsibility there, so the internal subpath boundaries need to stay disciplined.
- Deleting `pstdio-hooks` requires a full import migration across API, CLI/features, tests, e2e, and worktree packages.
- The SDK hook contract must be updated before `pstdio-plugins/hooks` is typed against it, otherwise payload override support will drift or be lost.
- If `pstdio-plugins/hooks` starts constructing SDK clients internally, it will reintroduce an unnecessary runtime edge to `@pstdio/sdk/client` and blur ownership again.

## Alternatives Considered

### Keep a separate `pstdio-hooks` package

Rejected because dispatch core is now part of the plugin runtime path, and keeping a separate package would preserve an extra boundary without adding meaningful reuse.

### Create a separate `pstdio-plugin-runtime` package

Rejected because `pstdio-plugins/hooks` keeps the package graph smaller while still preserving internal boundaries through subpaths.

### Put API contracts directly in `@pstdio/sdk`

Viable, but less clean if `pstdio-api` and other first-party code need the same wire-level types independently of the SDK client surface. A dedicated `pstdio-api-contracts` package keeps transport ownership below the ergonomic client layer.

### Leave the current split as-is

Rejected because the duplication already creates ambiguity around ownership, naming, and first-party client direction.

## Open Questions

- Should dashboard consume the full SDK client directly, or should we expose a browser-focused SDK entrypoint if bundle pressure appears?
- SSE streaming endpoints (`/sessions/{id}/stream`, `/sync/stream`) are fundamentally different from REST endpoints. Should the SDK own streaming clients, or should streaming remain a separate concern outside the SDK?

## Recommended Next Step

Start with the lowest-risk boundary cleanup:

1. Create `pstdio-api-contracts` and move shared wire-level shapes there.
2. Make `@pstdio/sdk` consume those contracts and become the preferred client for CLI and dashboard where it already fits.
3. Keep `pstdio-api-contracts` below the SDK layer; only direct raw-transport consumers should depend on it.
4. Make `pstdio-plugins` reuse SDK plugin contracts from `@pstdio/sdk/plugins` and expose `loader`, `registry`, and `hooks` subpaths.
5. Keep SDK client creation at the caller boundary and inject clients into `pstdio-plugins/hooks`.
6. Move dispatch core and runtime composition into `pstdio-plugins/hooks`.
7. Migrate callers and delete `pstdio-hooks`.

That sequence clarifies ownership while moving the SDK toward being the real client surface and `pstdio-plugins` toward being the single plugin-system package.
