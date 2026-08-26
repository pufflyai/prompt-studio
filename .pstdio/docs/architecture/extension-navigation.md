# Extension Navigation

This page defines the navigation architecture for extension resources and modes. PS-255 proposed it. PS-266 through PS-270 implemented it.

Mode and resource are separate parts of one navigation context. A mode describes the current task and layout. A resource describes the active domain object. Opening one does not silently select the other.

## Navigation Context

One committed navigation context contains:

- project id;
- mode id;
- primary resource;
- layout persistence scope;
- breadcrumb path;
- primary history identity.

These values change through one navigation transaction. Observers never receive an intermediate mode-resource pair.

## Navigation Targets

A target may request a mode, a resource, or both:

```ts
type WorkbenchNavigationTarget = {
  modeId?: string;
  resource?: ResourceRef;
  replaceActive?: boolean;
};
```

The navigator resolves and validates the final context before committing it.

### Resource-only target

The active mode remains unchanged. The operation succeeds only when that mode accepts the target resource kind. An incompatible resource leaves the current context unchanged and returns a diagnostic.

### Mode-only target

The current resource remains active when the target mode accepts its kind. Otherwise the navigator restores the target mode's last compatible resource. If none exists, it resolves the mode's default resource.

Selecting an already-active mode still reconciles its context and restores a missing required location.

### Combined target

The navigator validates the requested mode and resource together, then commits both once. Commands that intend to change both must provide both explicitly.

## Commit Flow

```text
target
  -> resolve mode
  -> resolve resource or fallback
  -> validate compatibility
  -> resolve hierarchy and layout scope
  -> commit context
  -> notify observers
```

A failed step changes nothing.

## History

Primary history records the canonical mode id and resource identity. The same resource in two modes creates distinct history contexts because each has a different layout scope.

Back and Forward replay through the same atomic navigator. Replay never activates a mode first and a resource second. Attached inspectors and side-only resources do not replace primary history.

## Last and Default Resources

The host records the last primary resource separately for each project and mode. Deleted or unresolved resources are removed from this state.

A mode that can be entered without a compatible active resource must provide a deterministic default resource or resolver. A missing default is a navigation diagnostic, not permission to keep an incompatible resource.

## Resource Hierarchy and Breadcrumbs

Hierarchy comes from resource identity, not UI placement. A browse root such as Tickets is a resource. Ticket details and nested child tickets resolve their parents through the hierarchy provider.

The complete acyclic path forms the breadcrumb. Opening a breadcrumb parent replaces the primary resource without changing mode.

## Layout Rotation

Layout persistence is scoped by project, mode, and resource URI. A successful navigation commit rotates to the final scope once.

When two modes accept the same resource, switching modes keeps the resource and restores the other layout. Required placements are reconciled. Optional placements the user closed remain closed.

## Invariants

- Resource open does not infer mode.
- Mode and resource compatibility is checked before state changes.
- No observer sees an invalid intermediate context.
- History replay uses the same transaction as direct navigation.
- Breadcrumb parents come from resource hierarchy.
- A failed target leaves history, layout, breadcrumbs, mode, and resource unchanged.

## Related Product Requirements

- [Extension Navigation and Layout State](../extensions/navigation-and-layout-state.md)
- [Contextual Workbench Composition](../extensions/contextual-workbench-composition.md)
- [Extension Conformance and Regression Coverage](../extensions/conformance.md)
