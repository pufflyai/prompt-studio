# Proposal: Contextual Extension Architecture

## Status

Proposed. This document describes work that is not implemented.

Planner proposal: PS-255.

Stack base: [PR #572](https://github.com/pufflyai/prompt-studio/pull/572), refactor(PS-253): remove unused renderer surfaces.

## Summary

Redesign extension UI composition around explicit mode, resource, panel, and placement contracts. At the same time, make one invalidated project runtime snapshot the source of truth for extension execution.

The change must let the same resource use different layouts in different modes, let another extension add an optional panel to an existing resource, keep navigation identity independent from panels, and prevent commands from importing fresh extension modules on every call.

## Why

Manual validation of the PS-246 stack exposed failures that the current contracts make easy to create:

- Opening a ticket repeatedly saves unchanged content, reloads the editor, and destroys focus and selection.
- A ticket loses the Tickets browse root in its breadcrumb because the parent relationship depended on implicit Kanban placement.
- Opening a resource can change mode even though modes and resources are separate concepts.
- Entering Lab can retain a ticket location, place Lab tabs under it, and leave no recovery path after required tabs disappear.
- Tickets cannot be placed at the root of the project tree without pretending to belong to an Extensions group.
- Every command imports fresh copies of all enabled extension modules. Repeated commands grow memory until the API is killed.

These are not one bug. They show missing ownership rules between extension definitions, workbench placement, navigation state, renderer refresh, and runtime loading.

## Product Model

The proposed model has five independent parts:

| Part | Owns |
| ---- | ---- |
| Panel | Renderer, title, supported placement targets, and intrinsic instance behavior. |
| Resource kind | Resource identity, hierarchy behavior, semantic panel slots, and the panels that can consume that resource. |
| Mode | Allowed resource kinds, mode-wide panels, and a layout recipe for each supported resource kind. |
| Resource instance | URI, label, parent, metadata, and domain identity. It stores no UI composition. |
| Persisted layout | User choices for one project, mode, and resource location. |

The effective UI is resolved in one direction:

~~~text
active mode
  + active resource kind
  + registered resource-panel contributions
  + persisted user choices
  = current placements
~~~

## Decisions

### Panels are reusable renderers

A panel does not own one fixed region, mode, or resource kind. It declares the regions or target classes it can support. A mode placement chooses the actual region.

Required, default-open, optional, pinned, and user-movable behavior belongs to the placement. The same panel may be required in one mode and optional in another.

### Resource kinds expose semantic slots

A resource kind declares semantic slots such as primary, navigation, inspector, and auxiliary. It also declares whether other extensions may contribute panels to each slot.

An external extension registers a separate resource-panel contribution. It does not mutate the resource definition and does not hardcode a mode or final region.

### Modes compose layouts

A mode declares which resource kinds it accepts. For each accepted kind, it maps resource slots and known panels to workbench regions.

Two modes may keep the same resource active while applying different layouts. For example, Animation and Sculpt may use the same project resource while placing its timeline, tools, and properties panels differently.

### Navigation changes mode and resource atomically

Opening a resource does not infer or change mode. It opens in the current mode only when that mode accepts the resource kind.

An explicit navigation target may change both mode and resource. The host validates the pair and rotates layout state once. When a mode switch can retain the current resource, it does. Otherwise it restores the target mode's last compatible resource or its default resource.

### Runtime snapshots have one owner

The API's project extension runtime catalog becomes the only source of normalized extension runtime data. Commands, events, schedules, settings, UI metadata, skills, and templates read the same snapshot.

Installed-source, enablement, dependency, or linked-repo changes invalidate the catalog. Normal command execution never creates a new module import identity.

### Renderer saves do not cause self-refresh loops

Opening an editor does not save unchanged content. A renderer ignores its own save invalidation, preserves focus while a save is in flight, and reloads external changes only when doing so cannot overwrite a local draft.

## Focused PRDs

- [Contextual workbench composition](./contextual-workbench-composition-prd.md)
- [Extension navigation and layout state](./extension-navigation-and-layout-prd.md)
- [Project extension runtime snapshots](./extension-runtime-snapshots-prd.md)
- [Renderer edit and refresh lifecycle](./renderer-edit-refresh-lifecycle-prd.md)
- [Extension conformance and regression coverage](./extension-conformance-prd.md)

## Architecture Decisions

- [Contextual extension workbench composition](../../../adrs/0011-contextual-extension-workbench-composition.md)
- [Project extension runtime snapshots](../../../adrs/0012-project-extension-runtime-snapshots.md)

## Scope

### Included

- Extension SDK contribution types and validation.
- Runtime metadata normalization and diagnostics.
- Workbench panel registration, relative menus, locations, modes, and layout reconciliation.
- Dashboard navigation transactions, history, breadcrumbs, browse roots, and tree grouping.
- Planner and Extension Lab migration to the new contracts.
- Project runtime snapshot ownership and invalidation.
- File renderer editing and refresh behavior.
- Testbench, unit, packaged, and Playwright coverage.

### Not included

- Collaborative text merging or real-time multi-user editing.
- Automatic mode selection when a resource is incompatible with the active mode.
- A compatibility adapter for the old extension UI schema.
- Database migrations for resource layout state.
- Changes to native visual design.
- Automatic recovery, rebasing, or merging of the PS-246 Git stack.

## Delivery Order

1. Introduce the v2 composition contracts and static validation.
2. Add atomic mode-resource navigation and contextual layout resolution.
3. Migrate built-in Project, Planner, and Extension Lab contributions.
4. Replace per-call runtime loading with catalog snapshots.
5. Correct renderer save and refresh state.
6. Expand the extension testbench, packaged smoke checks, and Playwright scenarios.
7. Remove the old resource-owned mode, fixed panel placement, and implicit presenter grouping paths.

Runtime snapshots and renderer lifecycle can be implemented independently after the v2 contract foundation. The dashboard migration must land only after the workbench resolver and navigation transaction exist.

## Acceptance

- Opening a ticket in Project mode does not change mode.
- Tickets show the Tickets resource as their breadcrumb parent.
- Switching between two modes that both accept a resource preserves the resource and restores a different persisted layout.
- Switching to a mode that rejects the current resource restores a compatible last or default location without an intermediate invalid scope.
- An external extension panel appears as an optional panel for an existing resource without naming every compatible mode.
- A required panel cannot be closed and is restored if persisted state is incomplete.
- An optional closed panel stays closed.
- Panel menus follow their owner when the owner moves between supported regions.
- Opening and editing a ticket preserves focus and selection and does not create repeated unchanged saves.
- Repeated commands reuse one project runtime snapshot and do not create new extension module identities.
- Static checks reject invalid slot, panel, region, mode, and resource references.
- The complete behavior is covered in Extension Lab and Playwright.

## Risks

- This is a breaking extension API change and requires an extension API major version.
- Cross-extension contributions need deterministic ordering and clear ownership diagnostics.
- A navigation transaction touches history, layout scopes, breadcrumbs, and resource presentation together.
- Persisted layouts created by the old schema cannot be trusted as v2 layouts.
- Memory checks based only on RSS are noisy; module-load counts and snapshot identity are the primary invariant.

## Stack Placement

This proposal is stacked directly on PR #572. It depends on the final PS-246 renderer and panel API shape and should not be inserted below PR #571 or PR #572, because doing so would rebase unrelated refresh and cleanup work.

Implementation PRs should branch from this proposal or its successor after the contracts are approved.
