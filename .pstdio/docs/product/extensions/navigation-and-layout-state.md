---
status: "draft"
created: "2026-08-18T17:03:48.668Z"
---

# Product Requirements Document: Extension Navigation and Layout State

## Summary

Make mode and resource selection an atomic, validated navigation operation. Preserve independent layout and location state for each mode, represent browse roots as resources, and keep breadcrumbs and Back/Forward aligned with the active context.

## Problem

Mode activation and resource selection currently happen as separate operations. A mode change can rotate persistence with the old resource still selected, producing combinations such as Lab mode with a ticket resource. Mode seeding runs only once, so clicking an already-active mode cannot repair missing required panels.

Resource hierarchy also lacks an explicit browse-root contract after implicit Kanban placement was removed. Root tree items cannot opt out of the Extensions group.

## Goals

- Keep mode changes explicit.
- Keep resource opens inside the current compatible mode.
- Validate mode and resource compatibility before changing state.
- Restore a mode's last compatible location or default location.
- Preserve different layouts for the same resource in different modes.
- Give collection resources explicit parent-child breadcrumbs.
- Support root-level tree items without a fake group.
- Make required layout reconciliation recoverable and optional state persistent.

## Non-Goals

- Guessing the best mode for an incompatible resource.
- Cross-project navigation in one transaction.
- Treating attached inspectors as primary history locations.
- Persisting UI definitions in resource metadata.
- Replacing the workbench history model.

## Concepts

| Term | Definition |
| ---- | ---------- |
| Navigation context | One project, mode, primary resource, and layout scope. |
| Navigation target | An explicit request to change mode, resource, or both. |
| Compatible resource | A resource whose kind is accepted by the target mode. |
| Browse root | A resource representing a collection or navigation parent. |
| Default resource | A mode-specific fallback used when no compatible last resource exists. |
| Last resource | The most recent compatible primary resource selected in one mode. |

## Requirements

### Atomic Navigation

1. The host provides one navigation operation for mode and resource changes.
2. The operation resolves the final mode-resource pair before mutating mode, history, breadcrumbs, or layout scope.
3. A resource-only target keeps the active mode.
4. A resource-only target fails when the active mode does not accept the resource kind.
5. A mode-only target retains the current resource when the target mode accepts it.
6. Otherwise a mode-only target restores that mode's last compatible resource.
7. If no compatible last resource exists, it opens the mode's default resource.
8. A combined target changes both values only when the pair is valid.
9. Clicking an already-active mode still runs context reconciliation and focuses its last or default location.
10. No observer can see an intermediate invalid mode-resource pair.

### Layout and Persistence

1. Layout persistence remains scoped by project, mode, and resource URI.
2. The host records the last primary resource separately for each project and mode.
3. Switching modes over the same resource rotates to that mode-resource layout.
4. Returning restores valid user placements, active tabs, sizes, and open regions.
5. Missing required placements are restored.
6. Optional placements the user closed remain closed.
7. Invalid old-schema layouts are discarded by layout schema version.
8. Contribution refresh reconciles the active context without resetting it.

### Resource Hierarchy and Browse Roots

1. A collection page such as Tickets is represented by a stable resource.
2. Detail resources name or resolve their parent through a hierarchy provider.
3. Nested resources may point to another detail resource as parent.
4. Breadcrumbs render the complete acyclic resource path.
5. Opening a breadcrumb parent replaces the active primary location without changing mode.
6. The Tickets tree item opens the Tickets browse-root resource.
7. A tree item may set group to null to appear at the root without a section heading.
8. Undefined group keeps the current default group behavior.

### History

1. A history entry continues to include mode id and canonical resource.
2. The history key distinguishes the same resource opened in different modes.
3. Replay uses the atomic navigation operation.
4. Replay never activates a mode first and a resource second.
5. Attached or side-only resource inspectors do not replace primary history.
6. Back/Forward restores the selected sub-panel only when it remains eligible in the restored context.

## Proposed Interface

~~~ts
type WorkbenchNavigationTarget = {
  modeId?: string;
  resource?: ResourceRef;
  replaceActive?: boolean;
};

await workbench.navigation.open({
  modeId: "extension-lab.animation",
  resource: blendProject,
});
~~~

Mode metadata supplies a static default resource reference, or the id of a command that resolves one. Extension UI metadata is serialized to the dashboard, so a function resolver is not supported.

~~~ts
modes: {
  lab: {
    defaultResource: { kind: "lab-root", id: "current-project" },
    // Or resolve at runtime through a command:
    // defaultResource: { commandId: "lab.default-resource" },
    resources: {
      "lab-root": { /* layout */ },
      "glass-lab-artifact": { /* layout */ },
    },
  },
}
~~~

Root tree placement is explicit:

~~~ts
treeItems: {
  tickets: {
    group: null,
    action: { kind: "resource", resource: "tickets-root" },
  },
}
~~~

## Behavior

### Project Ticket to Lab

1. Project mode has P-1 active.
2. The user selects Lab mode.
3. Lab rejects resource kind ticket.
4. The navigator resolves Lab's last resource or lab-root.
5. One state transition activates Lab, the chosen resource, its breadcrumb, and its layout scope.

### Animation to Sculpt

1. Animation mode has blend-project A active.
2. Sculpt mode also accepts blend-project.
3. The resource remains A.
4. The navigator rotates directly to A's Sculpt layout.
5. Sculpt tools replace Animation defaults while valid user state is restored.

### Ticket Hierarchy

1. Tickets root is active in Project mode.
2. The user opens P-1.
3. P-1 resolves Tickets as its parent.
4. A child P-4 resolves P-1 as its parent.
5. Breadcrumbs show Tickets / P-1 / P-4.

## Success Metrics

| Metric | Baseline | Target | Measurement |
| ------ | -------- | ------ | ----------- |
| Invalid Lab-ticket context | Reproducible | Never observable | State transition unit test and Playwright |
| Ticket parent breadcrumb | Missing | Tickets parent shown | Nested resource Playwright test |
| Same resource in two modes | Stale shared layout | Independent restored layouts | Persistence test |
| Closed required panel | No recovery path | Reconciled on activation | Mode re-entry test |
| Root Tickets item | Forced Extensions group | Headerless root item | Sidenav story and Playwright |

## Rules and Constraints

- Opening a resource never infers a mode.
- A command that wants both must provide both.
- A mode must have a resolvable default when it can be entered without an active compatible resource.
- Resource hierarchy providers must be deterministic and cycle-safe.
- A failed target leaves the current navigation context unchanged.
- Layout scope rotation happens once per successful target.
- Tree group null and undefined have different meanings.

## Errors

| Code | Cause |
| ---- | ----- |
| navigation_mode_missing | The target mode is not registered. |
| navigation_resource_missing | The target resource cannot be resolved or presented. |
| navigation_resource_incompatible | The target mode does not accept the resource kind. |
| navigation_default_missing | A mode needs a fallback but has no valid default resource. |
| navigation_target_stale | The target contribution disappeared before commit. |
| resource_hierarchy_cycle | Parent resolution repeats a resource URI. |

## Risks and Open Questions

- Navigation observers must receive one committed result rather than current mode and resource events in arbitrary order.
- Last-resource state must be cleared when a resource is deleted.
- A default-resource command may depend on selected project and extension readiness.
- Existing route helpers must delegate to the transaction or be removed to avoid two navigation paths.

## Rollout Plan

1. Add an atomic navigator over the existing mode, resource, history, and layout services.
2. Move history replay and route helpers onto it.
3. Add mode compatibility and per-mode last-resource state.
4. Add browse-root resources and group null.
5. Migrate Project, Planner, and Extension Lab.
6. Remove direct dashboard calls that pair setActiveMode with selectDashboardNavigationResource.

## Related Architecture

- [Extension Workbench Composition](../../architecture/extension-workbench-composition.md)
- [Extension Navigation](../../architecture/extension-navigation.md)
