# Extension workbench composition

The SDK and workbench share page, view, mode, placement, and resource contracts. The contract layer owns serializable definitions. SDK helpers add inference and generated references; metadata normalization validates declarations before registering callbacks. Diagnostics identify the extension, contribution, field path, and expected contract.

## Owners

A view supplies renderer content. A page owns the route, optional routed resource constraint, Main presentation, and page panels. A mode owns shared panels, region policy, and chrome. The shell provides host defaults.

A page's `resource: { kinds }` is independent of `main`. Main either presents a view with explicit cardinality or a collection of peer Main panels with an empty view. Additional slots use the same static-view or resource-binding item as mode placements. A binding has `kinds`, `view`, `cardinality`, and optional `add` navigation. Page slots expose generated panel refs.

There are three panel regions: Main, Side, and Secondary. Presence, mounting, and tab presentation keep the same meanings across owners. Shared mode panels retain their identity across pages and dispose when their owner is removed.

Default host navigation is composed for every active mode that keeps its chrome. A declared replacement view or `false` overrides that default. A mode is selected by navigating to one of its pages.

## Data flow

Public APIs pass `ResourceRef` with `type`, `id`, and optional presentation and ownership fields. The route owns page context and breadcrumbs. Selecting or opening an auxiliary panel does not change that resource. A workspace collection routes to a workspace while its Main panels contain files.

The SDK's `resourceKey` provides identity comparisons. URI conversion stays in routing and persistence adapters. Labels and metadata do not determine identity. Provider contract modules use `qualifyRef` to export references with stable extension ownership; providers register their local definitions.

## Navigation transaction

Compound navigation contains only page and panel targets. Preparation resolves every dependent target against proposed page and placement state. It does not mutate live registries, layout, history, or selection.

Commit applies final placement and page state as one batch, resolves the final location, and creates at most one browser history entry. Observers read the committed state. Failure during preparation leaves all observable navigation and composition state unchanged. Commands and external links remain separate because their external effects are outside the workbench transaction.

The page-location controller owns URL encoding, browser history, location persistence, and breadcrumbs. The page registry owns page instances. Mode and shell registries own their placements. Layout reconciles those declared instances into regions and selection. No second checkpoint or rollback state is maintained.

## Closing and lifecycle

Native tabs and webview `placement.close` use the same placement close controller. The host supplies the calling webview identity. Fixed placements cannot close. Closing the last routed resource view follows the page's declared parent; closing an auxiliary panel leaves the route intact.

Native renderer callbacks cross a validated serializable boundary. Controls use a discriminated union and typed groups. UI-only React nodes and browser `File` objects remain outside that contract. `GuestHost.call` takes declared capability names and mapped parameters/results, with runtime validation at the host bridge.

## Delivery and persistence

The SDK bundles private contract declarations into public declaration entries. Both workspace development and installed consumers load built SDK files. One package staging script assembles runtime files and resolves public workspace dependencies while excluding development-only dependencies. Verification and release use that same artifact.

This revision retains version 1 page locations and valid resource data. Layout cache version 4 changes the interpretation of Main panels and identity indexes. Only incompatible layout entries are invalidated; independent preferences remain valid. No database migration is needed.

Page caches use the existing location keys for page-owned instances. Shared mode instances are excluded from those entries and persist once per project and mode. Restoration resolves the destination project's mode state before the final layout is published. Cache failures are reported host effects and do not undo committed navigation.

See the [SDK cookbook](../extensions/cookbook.md) for authoring and the [workbench guide](../../../packages/pstdio-workbench/README.md) for host integration.
