---
status: "draft"
created: "2026-04-05T00:00:00Z"
---

# Proposal: Hook Runtime Boundaries

## Summary

This proposal separates three concerns that are currently easy to blur together:

1. API transport contracts shared by the server and clients.
2. The public plugin hook contract exposed to plugin authors.
3. The in-process dispatch mechanism used by runtime packages.
4. Plugin discovery and registry infrastructure.

The goal is to introduce a dedicated `pstdio-api-contracts` package for shared API wire types, make `@pstdio/sdk` the preferred client surface for CLI and dashboard requests where practical today, keep `pstdio-hooks` as a narrow runtime primitive, and keep `pstdio-plugins` focused on loading and registry concerns instead of redefining the contract.

## Problem

The current shape is inconsistent in a few ways:

- API request and response types are effectively shared between `pstdio-api`, `@pstdio/sdk`, CLI, and dashboard, but they do not have a single package owner.
- `@pstdio/sdk` is already treated as a public type surface, but first-party callers still frequently bypass it and write direct request wrappers.
- `@pstdio/sdk` already owns the typed plugin hook contract and the concrete hook contexts.
- `pstdio-hooks` still exports legacy kebab-case hook name unions and a generic `HookPayload`, even though the active runtime dispatch path uses camelCase plugin hook names such as `preWorktreeCreate`.
- `pstdio-plugins` defines its own loose `PluginDefinition` and `hooks` shape instead of reusing the typed contract from the SDK.
- Callers assemble their own hook runtime ad hoc by loading plugins, creating a dispatcher, and wiring handlers at the call site.
- Existing hook terminology still reflects older hook shapes in places, which makes the product surface harder to explain and evolve.

This makes it unclear which package owns the real transport contract, hook model, and client surface, and it encourages drift between server behavior, plugin authoring APIs, first-party callers, and docs.

## Goals

- Introduce `pstdio-api-contracts` as the canonical home for shared API request, response, and resource transport shapes.
- Make `@pstdio/sdk` the target client for CLI and dashboard API requests as much as possible today.
- Make `@pstdio/sdk` the single public source of truth for plugin hook names, hook return types, and hook context types.
- Keep `pstdio-hooks` focused on dispatch mechanics only.
- Remove duplicate or conflicting hook contract types across packages.
- Centralize runtime hook composition so callers do not manually rebuild the same wiring.
- Remove legacy hook terminology that no longer matches the supported runtime model.

## Explicit Non-Goals

- Do not redesign the actual business events that hooks fire on in this proposal.
- Do not require an immediate rename of packages if the boundary can be cleaned up first.
- Do not preserve or extend legacy hook surfaces that are no longer part of the product direction.

## Proposed Ownership

### `pstdio-api-contracts`

Own the API transport contract shared by the server and clients:

- request body schemas
- response body schemas
- inferred request and response types
- resource DTOs that cross the HTTP boundary

`pstdio-api` should import these contracts instead of owning parallel DTO definitions locally, and `@pstdio/sdk` should build its client surface on top of them.

### `@pstdio/sdk`

Own the public client and plugin-authoring surface:

- ergonomic API client for first-party and external callers
- plugin authoring helpers
- plugin hook contract used by plugin authors

For hooks specifically, it should own:

- `PluginHooks`
- hook response / pre-hook return / post-hook return types
- typed hook contexts
- hook client surface exposed inside hook contexts

For API requests, it should become the preferred client used by CLI and dashboard wherever the current SDK surface is sufficient. Direct `fetch` wrappers should be treated as gap-fillers, not the default architecture.

### `pstdio-hooks`

Own only in-process dispatch primitives:

- `createHookDispatcher`
- dispatcher result types
- minimal handler registration / invocation behavior

This package should not own:

- public plugin hook context types
- public hook name definitions
- generic payload mirrors that duplicate SDK types
- plugin loading or registry behavior

If the package remains named `pstdio-hooks`, its docs should describe it as an internal dispatcher package rather than the hook contract package.

### `pstdio-plugins`

Own only plugin discovery, loading, and registry concerns:

- scan `.pstdio/plugins`
- import plugin modules
- track plugin identity
- expose loaded plugin metadata and registries

It should reuse the SDK's `PluginDefinition` instead of redefining a looser version locally.

## Runtime Shape

Callers should depend on a composed hook runtime instead of rebuilding hook wiring by hand.

Proposed runtime responsibilities:

- resolve plugins for a project
- create a dispatcher
- register typed plugin hooks
- expose a stable runtime interface to feature packages

Example target interface:

```ts
type HookRuntime = {
  firePre<K extends keyof PluginHooks>(
    hookName: K,
    ctx: Parameters<NonNullable<PluginHooks[K]>>[0],
  ): Promise<{
    rejected: boolean;
    reason?: string;
    data?: Record<string, unknown>;
  }>;
  firePost<K extends keyof PluginHooks>(
    hookName: K,
    ctx: Parameters<NonNullable<PluginHooks[K]>>[0],
  ): Promise<void>;
};
```

The exact type shape can be simpler than this, but the important part is that call sites stop depending on raw `string` and `unknown`.

## Client Direction

The desired client stack is:

- `pstdio-api-contracts` owns HTTP-facing shapes
- `@pstdio/sdk` provides the ergonomic client built on those shapes
- CLI and dashboard use `@pstdio/sdk` by default
- direct `fetch` wrappers remain only where the SDK does not yet cover the needed behavior cleanly

This keeps the SDK honest. If first-party callers avoid it, the SDK will drift into a secondary surface rather than the real client API.

## Migration Plan

### Phase 1: Introduce `pstdio-api-contracts`

- Create `pstdio-api-contracts` as the canonical home for shared API wire contracts.
- Move duplicated request/response/resource transport shapes there.
- Update `pstdio-api` to consume those contracts instead of owning parallel DTO type definitions.

### Phase 2: Make SDK contract authoritative for hooks and preferred for clients

- Treat `@pstdio/sdk` as the canonical home for plugin hook types.
- Make `@pstdio/sdk` consume `pstdio-api-contracts` for its request/response/resource types.
- Prioritize SDK coverage for the API operations that CLI and dashboard use most often.
- Remove duplicated public hook contract types from `pstdio-hooks`.
- Replace duplicated `HookPayload` / `HookResponse` style definitions where they overlap with SDK meanings.
- Remove the remaining legacy kebab-case hook name unions from `pstdio-hooks`.

### Phase 3: Type `pstdio-plugins` against the SDK

- Update `pstdio-plugins` to import `PluginDefinition` from `@pstdio/sdk`.
- Keep loader validation runtime-oriented, but stop redefining the type contract locally.

### Phase 4: Introduce a composed hook runtime

- Add a shared hook runtime service that loads plugins and exposes pre/post firing.
- Move ad hoc wiring out of individual call sites.
- Make `pstdio-api`, `pstdio`, and `pstdio-wt` depend on the runtime interface rather than on raw dispatcher assembly.

### Phase 5: Move first-party callers toward the SDK

- Migrate CLI request wrappers to `@pstdio/sdk` where the SDK already supports the needed operation cleanly.
- Migrate dashboard request wrappers to `@pstdio/sdk` where bundle and transport constraints allow it.
- Track remaining direct `fetch` usage as explicit SDK coverage gaps instead of leaving them as silent alternatives.

### Phase 6: Remove legacy naming and docs drift

- Remove stale hook terminology that no longer matches the plugin runtime.
- Update docs to describe `@pstdio/sdk` as the preferred client for first-party callers.
- Update docs to consistently describe hooks as SDK plugins.
- Drop legacy compatibility types instead of preserving them in `pstdio-hooks`.

## Package-Level Direction

### Keep

- `pstdio-api-contracts` as the transport contract package shared by server and clients
- `@pstdio/sdk` as the plugin authoring surface
- `@pstdio/sdk` as the preferred client surface
- `pstdio-hooks` as a small dispatcher primitive
- `pstdio-plugins` as loader/registry infrastructure

### Change

- Stop duplicating API transport types across `pstdio-api` and `@pstdio/sdk`.
- Stop treating direct `fetch` wrappers in CLI and dashboard as the long-term default.
- Stop treating `pstdio-hooks` as the place where hook names and payloads are defined for the product as a whole.
- Stop treating `pstdio-plugins` as a second type authority for plugin definitions.
- Stop duplicating hook runtime composition in feature call sites.
- Stop preserving legacy kebab-case hook naming inside runtime-core packages.

### Optional Rename

If the cleaned-up boundaries still feel confusing, we can rename `pstdio-hooks` later to reflect its actual responsibility, for example:

- `pstdio-hook-dispatch`
- `pstdio-hook-runtime-core`

That rename should happen only after the boundary is clean. Renaming first would create churn without solving the ownership problem.

## Risks

- Migrating CLI and dashboard toward the SDK may expose missing SDK operations, bundle issues, or transport edge cases that direct `fetch` wrappers had hidden.
- A new `pstdio-api-contracts` package adds one more boundary to maintain, so the split needs to stay focused on wire contracts only.
- Tightening types across `pstdio-plugins` and runtime callers may surface hidden mismatches in existing plugins.
- There may be a short migration period where both generic and typed hook interfaces coexist.
- Docs and examples may still reference outdated hook terminology until the cleanup is complete.

## Alternatives Considered

### Keep all hook-related types in `pstdio-hooks`

Rejected because it makes the internal dispatcher package the public contract authority, while plugin authors already consume the SDK.

### Move everything into `pstdio-plugins`

Rejected because discovery/loading is infrastructure, not the public contract. Plugin hook contexts and authoring types belong in the SDK.

### Put API contracts directly in `@pstdio/sdk`

Viable, but less clean if `pstdio-api` and other first-party code need the same wire-level types independently of the SDK client surface. A dedicated `pstdio-api-contracts` package keeps transport ownership below the ergonomic client layer.

### Leave the current split as-is

Rejected because the duplication already creates ambiguity around ownership, naming, and documentation.

## Open Questions

- Should dashboard consume the full SDK client directly, or should we expose a browser-focused SDK entrypoint if bundle pressure appears?
- Should the composed hook runtime live in `pstdio-api`, or in a shared runtime package used by both CLI and API flows?
- Do we want typed dispatcher methods keyed by `PluginHooks`, or a smaller interface that stays generic internally but is wrapped by typed facades at the edges?

## Recommended Next Step

Start with the lowest-risk boundary cleanup:

1. Create `pstdio-api-contracts` and move shared wire-level shapes there.
2. Make `@pstdio/sdk` consume those contracts and become the preferred client for CLI and dashboard where it already fits.
3. Make `pstdio-plugins` reuse the SDK `PluginDefinition`.
4. Remove duplicated public hook contract types from `pstdio-hooks`.
5. Introduce one shared hook runtime factory and migrate existing callers to it.

That sequence improves ownership and readability while moving the SDK toward being the real client surface instead of a parallel one.
