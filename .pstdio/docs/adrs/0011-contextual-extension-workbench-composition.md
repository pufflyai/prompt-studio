# ADR: Contextual Extension Workbench Composition

## Status

Proposed.

## Context

The extension API currently puts default region, resource binding, mode eligibility, and full-content versus supporting-panel role onto panel declarations. Mode layouts can override a region while resource presentation still infers the primary view from the panel whose declared region is main.

This creates conflicting owners. A panel can be moved by a mode, but its menu remains registered against its original region. A mode may be activated while an incompatible resource remains selected. An extension that adds a panel to an existing resource must either name modes it does not own or hardcode a region that a mode may arrange differently.

The same resource must also support different layouts in different modes, such as Animation and Sculpt arrangements over one project.

## Decision

Use contextual composition:

- Panels define renderers and supported placement targets.
- Resource kinds define semantic panel slots and resource-panel capability registrations.
- External extensions add panels through separate resource-panel contributions.
- Modes define allowed resource kinds and placement recipes.
- Placement policy defines required, default-open, optional, pinned, and movable behavior.
- Resource instances contain domain identity only.
- Navigation selects a valid mode-resource pair atomically.
- Persisted layout state is scoped by project, mode, and resource location.

A mode may retain the current resource when the target mode accepts its kind. Otherwise it restores a compatible last or default resource. Opening a resource alone never changes mode.

## Rationale

The model separates stable capability from contextual presentation:

- Resource authors can expose safe extension points without knowing future modes or extensions.
- Mode authors can arrange the same panels differently without changing resource data.
- Panel authors can reuse one renderer in multiple resources and modes.
- Users can customize optional panels without losing required layout structure.
- Navigation can validate context before changing history or persistence scope.

## Rejected Alternatives

- **Panel-owned mode and resource eligibility:** This scatters the composition graph across every panel and couples extensions to modes they do not own.
- **Resource-owned fixed layouts:** This cannot express two layouts over the same resource.
- **Mode-owned panels only:** This loses the resource input contract and makes resource-aware panels global to the mode.
- **Automatic mode selection on resource open:** This hides navigation policy and makes a resource action change the whole workbench unexpectedly.
- **Resource instances storing panel metadata:** This duplicates UI configuration in domain data and makes extension upgrades unsafe.

## Consequences

- The extension UI contract requires a major version.
- The workbench needs explicit location roles and relative panel-menu placement.
- Mode and resource navigation must become one transaction.
- Resource and mode registries must compose contributions deterministically.
- Old persisted extension layouts must be discarded or migrated by version, not interpreted as v2 layouts.
- Built-in Planner and Extension Lab contributions must migrate together with the host.

## Verification

- Contract tests cover the mode-resource-panel compatibility matrix.
- One fixture resource is opened in two modes with different panel regions.
- One external extension contributes an optional panel to an existing resource slot.
- Playwright proves mode switching, breadcrumbs, required panel recovery, optional panel persistence, and Back/Forward behavior.

## References

- [Contextual extension architecture proposal](../product/extensions/proposals/contextual-extension-architecture.md)
- [Contextual workbench composition PRD](../product/extensions/proposals/contextual-workbench-composition-prd.md)
- [Extension navigation and layout PRD](../product/extensions/proposals/extension-navigation-and-layout-prd.md)
