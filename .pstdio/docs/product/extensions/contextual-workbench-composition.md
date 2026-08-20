---
status: "shipped"
created: "2026-08-18T17:03:48.668Z"
---

# Product Requirements Document: Contextual Workbench Composition

## Summary

Replace fixed extension panel placement with a contextual composition model. Resource kinds expose panels through semantic slots, modes arrange those slots and known panels, and persisted user choices apply only inside the valid mode-resource context.

## Problem

The current extension panel record combines renderer definition, fixed region, closability, resource kind, and mode eligibility. The dashboard then infers whether the panel is a location, sub-panel, or resource companion from those fields.

This prevents several valid products:

- One resource cannot have an Animation layout and a Sculpt layout without duplicating panels.
- A third-party panel cannot attach to an existing resource without hardcoding modes or a region.
- A panel moved by a mode can leave its menus in the panel's declared region.
- Required and optional behavior cannot differ by mode.
- The primary resource location is inferred from whichever panel declares region main.

## Goals

- Let the same resource instance keep its identity while its mode changes the layout.
- Let resource authors expose controlled extension points.
- Let another extension add an optional panel to an existing resource.
- Let a panel support several regions without owning its current region.
- Give required, default, optional, and user-movable placements precise behavior.
- Make invalid composition fail during extension checks.

## Non-Goals

- Arbitrary CSS layouts supplied by extensions.
- Resource instances storing UI configuration.
- External extensions replacing a resource's primary panel.
- Preserving the current alpha panel composition schema at runtime.
- Collaborative editing or shared live layout state.

## Concepts

| Term | Definition |
| ---- | ---------- |
| Panel | A named renderer and its intrinsic capabilities. |
| Resource kind | A domain resource type with surface and semantic panel slots. |
| Resource panel | A registration that lets a panel consume one resource kind in one slot. |
| Slot | A semantic extension point such as primary, navigation, inspector, or auxiliary. |
| Mode layout | A recipe that maps accepted resources, slots, and known panels to regions. |
| Placement | One panel instance in one region for one mode-resource context. |
| Required placement | Structural placement that cannot be closed and is reconciled whenever its context activates. |
| Default placement | Placement seeded for a new layout but removable by the user. |
| Optional panel | Available through Add Panel and opened only by user or explicit action. |

## Users

| User | Need | Current Workaround |
| ---- | ---- | ------------------ |
| Extension author | Add UI for an existing resource without owning its modes. | Hardcode resource kinds and default regions on panels. |
| Mode author | Arrange the same tools differently for different tasks. | Duplicate panels or imperatively reopen them. |
| Resource author | Control which parts of a resource may be extended. | Accept every eligible panel or keep the resource closed. |
| End user | Customize optional panels without losing required structure. | Reopen tabs manually or reset the entire layout. |

## Ownership

Each concern has exactly one owner:

| Concern | Owner |
| ------- | ----- |
| Panel capability | The panel definition. |
| Resource slots | The resource kind definition. |
| Mode placement | The active mode's placement recipe. |
| Resource identity | The resource instance. |
| Persisted user layout | The workbench layout store, scoped by project, mode, and resource URI. |

## Requirements

### Panel Definitions

1. A panel declares one body, title, icon, and stable namespaced id.
2. A dockable panel declares its supported regions or supported target class.
3. A panel does not declare a current mode or current resource kind.
4. A panel does not declare required or default-open behavior.
5. A panel menu is owned by a panel instance and follows that instance's region.
6. An overlay-only or chrome-only body cannot be placed into a docked panel region unless it explicitly supports it.

### Placement Typing (Decided)

Docked regions and chrome surfaces use separate contribution types. They do not share one placement union.

1. Docked regions are `sidenav`, `main`, `secondary`, and `side`. Only docked regions appear in mode recipes, user moves, and persisted layout.
2. Chrome surfaces such as nav actions, the activity bar, the status bar, and overlays stay typed item contributions on host workbench targets, as menus and activity items are today.
3. Chrome contributions may show or hide by active mode through `when` expressions. A mode recipe never assigns a chrome position.
4. Chrome contributions are not persisted user layout and take no part in required-placement reconciliation.
5. Overlay presentation is an explicit panel capability. An overlay opens from an action and is never a resolved layout placement.

This matches the current kernel, where mode layout targets already cover only docked areas and menus, trees, and settings already attach to typed targets. The replacement contract removes the single region union that let a panel declare a chrome region.

### Resource Kinds and Slots

1. A resource kind declares its surface: primary, secondary, or attached.
2. A primary resource kind declares exactly one primary slot with cardinality one.
3. A resource kind may declare navigation, inspector, auxiliary, or extension-defined slots.
4. Each slot declares cardinality and whether external extensions may contribute.
5. A resource-panel contribution references an existing resource kind, panel, and slot.
6. Resource-panel registrations compose as registry entries. They do not mutate or replace the resource kind record.
7. A panel may register against several resource kinds or slots.
8. An external contribution to a closed slot fails validation.

### Mode Layouts

1. A mode declares the resource kinds it accepts.
2. A mode may declare mode-wide panels that do not consume the active resource.
3. For each accepted resource kind, the mode maps supported slots to default regions.
4. A mode places a specific known panel through a `panels` map keyed by panel id. A panel entry wins over its slot placement and must satisfy the panel's supported regions and its slot's rules.
5. A mode marks placements as required or default.
6. `required` on a slot placement is valid only when the slot's cardinality is one. In a cardinality-many slot, `required` must name a specific panel in the `panels` map.
7. External resource panels are optional unless the mode explicitly names them.
8. A mode may allow users to move a placement within a declared region set.
9. A required placement is non-closable. A default placement is closable unless its placement says otherwise.
10. Exactly one main-region placement establishes the location for a primary resource.
11. Attached resources may open inspectors without replacing the primary location.

### Composition Resolution

1. The host resolves one effective layout from active mode, active resource, registered contributions, and persisted layout.
2. A panel may be placed only when the mode accepts the resource, the resource exposes the panel's slot, and the region is supported by both panel and mode.
3. Existing valid user placements win over default placements.
4. Missing required placements are restored without resetting optional placements or tab order.
5. Removed or invalid contributions are omitted and reported. They do not prevent unrelated valid panels from rendering.
6. Two panels in the same slot and region use stable contribution order until the user reorders them.

## Interface

These are the shipped names. The relationships are normative.

~~~ts
defineExtension({
  panels: {
    insights: {
      title: "Insights",
      supportedRegions: ["side", "secondary"],
      renderer: { kind: "controls", id: "ticketInsights" },
    },
  },

  resourcePanels: {
    ticketInsights: {
      // A kind reference may be bare or namespaced. Naming the owner is
      // clearer when the kind belongs to another extension.
      resourceKind: "planner.ticket",
      panel: "insights",
      slot: "inspector",
    },
  },
});
~~~

The resource owner exposes slots:

~~~ts
resourceKinds: {
  ticket: {
    surface: "primary",
    slots: {
      primary: { cardinality: "one", external: false },
      navigation: { cardinality: "many", external: true },
      inspector: { cardinality: "many", external: true },
      auxiliary: { cardinality: "many", external: true },
    },
  },
}
~~~

The mode chooses placement:

~~~ts
modes: {
  project: {
    resources: {
      ticket: {
        slots: {
          primary: { region: "main", required: true },
          navigation: { region: "sidenav" },
          inspector: {
            region: "side",
            allowedRegions: ["side", "secondary"],
          },
        },
        // Places one known panel; wins over its slot placement.
        panels: {
          "acme.insights": { region: "secondary" },
        },
      },
    },
  },
}
~~~

## Success Metrics

| Metric | Baseline | Target | Measurement |
| ------ | -------- | ------ | ----------- |
| Same-resource multi-mode fixture | Unsupported | Two distinct layouts | Extension Lab contract and Playwright test |
| External resource panel | Requires inverse eligibility | Optional slot contribution | SDK typecheck and testbench fixture |
| Menu follows moved panel | Can remain in old region | Always follows owner | Workbench placement test |
| Invalid composition | May fail at runtime | Static diagnostic | Extension check fixtures |
| Required panel recovery | One-shot seed | Deterministic reconciliation | Mode re-entry test |

## Rules and Constraints

- Panel and mode ids are stable, namespaced contribution ids. A bare id in a contribution resolves inside the declaring extension; a reference to another extension's panel uses the namespaced form `<extension>.<id>`.
- A resource kind's id is the plain name its extension declares. The host does not namespace it, because that same name is the resource type in every payload crossing the extension boundary, in resource URIs, and in stored session anchors.
- A resource kind reference may be written bare or namespaced as `<extension>.<kind>`. Both resolve to the declared id; the namespaced form records who owns the kind.
- A resource kind has exactly one owner. Two extensions declaring the same kind is an install-time error for both.
- A slot name is local to its resource kind.
- A resource is not a mode. Opening one keeps the workbench the user is in, so a resource kind needs a mode only when it reshapes the workbench around itself. Without a mode recipe, each panel bound to the kind lands in the region it supports and the surrounding chrome stays put.
- External extensions cannot claim a closed slot or primary location.
- A mode layout cannot expand a panel's supported regions.
- Required placement reconciliation cannot reset user tab order.
- No stored resource or history record contains renderer definitions.
- The replacement schema removes the current alpha fields rather than maintaining two composition systems.

## Errors

| Code | Cause |
| ---- | ----- |
| extension_resource_kind_missing | A resource-panel or mode references an unknown resource kind. |
| extension_resource_kind_duplicate | Two extensions declare the same resource kind. |
| extension_resource_slot_missing | A resource-panel or mode references an unknown slot. |
| extension_resource_slot_closed | An external extension contributes to a closed slot. |
| extension_panel_missing | A resource-panel or mode references an unknown panel. |
| extension_panel_region_unsupported | A mode places a panel outside its supported regions. |
| extension_mode_resource_unsupported | A layout references a resource kind the mode does not accept. |
| extension_placement_required_invalid | `required` is set on a cardinality-many slot placement without naming a panel. |
| extension_resource_primary_invalid | A primary resource has zero or several primary location placements. |

## Risks and Open Questions

- Placement typing is decided: chrome and docked placements are separate contribution types (see Placement Typing). Remaining risk: existing panels that declare chrome regions must migrate to chrome contribution types during the cutover.
- Cross-extension ordering must remain stable when extensions are enabled in different orders.
- A missing optional extension panel should not invalidate the owning resource layout.
- A missing required panel should produce a visible diagnostic and safe fallback location.

## Rollout Plan

1. Add the replacement contracts and diagnostics without using them in the dashboard.
2. Add workbench composition and relative menu primitives.
3. Migrate host resources and modes.
4. Migrate Planner and Extension Lab.
5. Update the extension authoring skill, reference docs, and testbench.
6. Remove the old composition fields in the current alpha API. Do not introduce a major version boundary or compatibility engine.

## Related Architecture

- [Extension Workbench Composition](../../architecture/extension-workbench-composition.md)
