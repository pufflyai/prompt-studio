# Extension Workbench Composition

This page defines the architecture for extension-owned workbench UI. PS-255 proposed it. PS-266 through PS-270 implemented it.

The architecture separates stable UI capability from contextual layout. A resource defines what it is. A panel defines what it can render. A mode defines how compatible resources and panels are arranged. User layout state records choices inside that valid composition.

## Goals

- Keep mode, resource, panel, placement, and persisted layout responsibilities separate.
- Let one resource use different layouts in different modes.
- Let an extension add an optional panel to a resource kind owned by another extension.
- Keep required panels available without reopening optional panels the user closed.
- Let panel menus follow the panel's actual placement.
- Keep resource identity free of renderer and layout data.

## Ownership Model

| Part | Owns | Does not own |
| ---- | ---- | ------------ |
| Panel | Renderer, title, and default placement policy for resources or modes owned by its extension. | Current resolved placement or user layout. |
| Resource kind | Resource identity rules, hierarchy behavior, surface, and semantic panel slots. | Final workbench regions or mode selection. |
| Resource-panel contribution | A panel's ability to consume another extension's resource kind through one slot. | Required state or final region. |
| Mode | Accepted resource kinds and contextual placement overrides. | Resource identity or renderer implementation. |
| Resource instance | URI, kind, label, parent, metadata, and domain identity. | Panel definitions or layout state. |
| Persisted layout | User choices for one project, mode, and resource location. | Extension capability definitions. |

## Composition Direction

The host resolves the workbench in one direction:

```text
active mode
  + active resource kind
  + panel placement declarations
  + cross-extension resource-panel contributions
  + persisted user choices
  = effective placements
```

No panel, resource, or dashboard adapter may reverse this flow by inferring a mode from a resource or treating a panel's default region as its permanent owner.

## Panels

A panel is a reusable renderer. It declares a stable namespaced id and one or more default placements through `show`. A placement may name a resource kind owned by the extension, or omit `for` to place the panel in the extension's modes.

Each placement declares a default region and the regions a mode may move it to. The resolver combines that declaration with the active mode, active resource, and valid persisted user placement.

Panel menus are relative to a panel instance. When the instance moves within `allowedRegions`, its menus move with it.

## Resource Kinds and Slots

A resource kind declares its surface and semantic slots. Common slots include:

- `primary`: the resource's main location;
- `navigation`: resource navigation or hierarchy;
- `inspector`: supporting details and properties;
- `auxiliary`: additional resource-aware tools.

Each slot declares cardinality and whether another extension may contribute to it. The primary slot is closed to external replacement. Other slots may be open extension points.

An external extension registers a resource-panel edge that names a resource kind, panel, and open slot. The registration composes with the resource definition; it does not mutate or replace it. An extension does not create resource-panel edges for its own resource kinds. External panels are optional unless a mode explicitly promotes a known contribution.

## Modes and Placement Recipes

A mode is a task and layout context. It declares:

- accepted resource kinds;
- a placement recipe for each accepted resource kind;
- placement overrides for slots or known panels.

Required and default are resolved placement policies, not registration properties. A panel may declare the default `required` value and a mode may override it. A required placement cannot be closed and is reconciled whenever its context activates. An optional placement is seeded for a new layout but remains user-managed.

Two modes may accept the same resource kind and arrange it differently. Animation and Sculpt can therefore retain one project resource while restoring distinct tools, timelines, inspectors, sizes, and tab state.

## Chrome and Docked Placement

Docked regions and chrome surfaces are different contracts.

Docked regions hold panels: `sidenav`, `main`, `secondary`, and `side`. Mode recipes place panels into docked regions. Users move panels between allowed docked regions. Layout persistence stores docked placements.

Chrome surfaces are host-owned fixed slots: nav actions, the activity bar, the status bar, and overlays. Extensions contribute typed items to chrome targets, as menus and activity items do today. A chrome item may show or hide by active mode through a `when` expression, but no mode recipe positions it, and no chrome state lives in persisted panel layout.

This split exists in the kernel: mode layout targets cover only docked areas, while menus, trees, and settings attach to typed workbench targets. The contract has no single region union, so a panel cannot claim a chrome region.

A panel body that also supports overlay presentation declares that capability explicitly. An overlay opens from an action; it is never a resolved layout placement.

## Effective Layout Resolution

The workbench resolves one layout for the active project, mode, and resource:

1. Confirm that the mode accepts the resource kind.
2. Collect panel declarations and valid cross-extension resource-panel contributions.
3. Apply the mode's placement recipe.
4. Reject mode overrides outside the panel placement's allowed regions.
5. Restore valid user placements and tab order.
6. Restore missing required placements.
7. Seed default placements only for a new layout.
8. Expose remaining valid panels through Add Panel.

Invalid or removed optional contributions are omitted and reported without preventing unrelated panels from rendering. A missing required placement produces a visible diagnostic and a safe location fallback.
Add Panel reads these resolved options from the active mode. It does not infer availability from a panel's global registration, because one panel may participate in several modes and resource slots.

## Layout Persistence

Layout state is scoped by project, mode, and resource URI. This lets the same resource retain different layouts in different modes.

The persistence format has an internal schema revision. Layouts saved under the old alpha contract are not read under this contract. The host keeps saved state only when its meaning does not depend on the removed panel roles and bindings.

## Resource Hierarchy

Browse roots are resources. For example, Tickets is a stable collection resource and a ticket detail names Tickets or another ticket as its parent.

Breadcrumbs follow the acyclic resource hierarchy. They do not infer parents from panel regions or renderer placement.

A tree contribution may use `group: null` to appear at the root without a heading. An undefined group keeps the default grouping behavior.

## Package Boundaries

| Package | Responsibility |
| ------- | -------------- |
| `@pstdio/sdk` and API contracts | Public authoring types and static diagnostics. |
| `pstdio-extensions` | Normalize panels, resource kinds, slots, resource-panel edges, modes, and recipes. |
| `@pstdio/workbench` | Resolve placements, enforce required state, own menus, history, and layout persistence. |
| `pstdio-dashboard` | Adapt project resources and call the atomic navigation service. |
| Core extensions | Declare their resources, panels, modes, and open extension slots. |

## Invariants

- Opening a resource never infers or changes mode.
- A primary resource context has exactly one primary location placement.
- A mode cannot place a panel outside the panel and mode region intersection.
- External extensions cannot replace the primary resource panel.
- External resource panels are optional unless the active mode names them.
- Required placements cannot be closed.
- Reconciliation restores required structure without resetting valid optional user state.
- Resource instances and history never store renderer definitions.
- The alpha extension contract was replaced in place, without a major version or a parallel compatibility engine.

## Related Product Requirements

- [Contextual Workbench Composition](../../../extensions/docs/contextual-workbench-composition.md)
- [Extension Navigation and Layout State](../../../extensions/docs/navigation-and-layout-state.md)
- [Renderer Edit and Refresh Lifecycle](../../../extensions/docs/renderer-edit-refresh-lifecycle.md)
- [Extension Conformance and Regression Coverage](../../../extensions/docs/conformance.md)
