# Contribution Ownership

Contribution ownership is metadata that records which workbench module or runtime extension contributed something to the workbench. It is deliberately separate from contribution ids, widget placement ids, resource ids, and user or project identity.

## Owner ids

`ownerId` identifies the workbench module or extension that owns a contribution. A host registers a module with `workbench.registerModule(module)`. If the module does not provide an explicit `ownerId`, the core uses the module `id`.

```ts
workbench.registerModule({
  id: "dashboard.project",
  activate(ctx) {
    ctx.commands.registerCommand({ id: "project.open", label: "Open project" }, { execute: () => undefined });
  },
});
```

The command above is registered with:

```ts
{
  ownerId: "dashboard.project",
  source: "module",
}
```

Runtime extensions should use the extension id as the owner id and `source: "extension"` when the host maps extension metadata into workbench modules. That keeps extension-owned widgets, commands, menu items, notifications, preferences, and webviews attributable to the extension package that supplied them.

## Contribution metadata

Most registries attach `ContributionMetadata` to registered entries:

```ts
interface ContributionMetadata {
  source?: "module" | "extension";
  ownerId?: string;
  priority?: number;
}
```

The registered form normalizes metadata so every contribution has a source, owner id, and priority. Without module context or explicit metadata, the default owner is `workbench.core`.

The metadata is used for:

- ownership and debugging surfaces, such as module inventory views
- deterministic ordering when two contributions have the same priority
- module-scoped context keys
- extension webview attribution, where a widget contribution's owner id becomes the extension id
- lifecycle clarity when a group of contributions is registered and disposed together

The metadata is attached to contributions across commands, keybindings, resources, layout widgets, placeholders, menu items, navigation handlers, tree renderer contributions, data renderer contributions, notifications, and preference schemas.

## Module context

Prefer registering contributions through the module activation context instead of passing metadata by hand. The context stamps the module's `ownerId` and `source` onto contributions and tracks disposables for cleanup.

```ts
const module = {
  id: "dashboard.project",
  activate(ctx) {
    ctx.resources.registerKind({ kind: "project", label: "Project" });
    ctx.layout.registerWidget({
      id: "project.settings",
      title: "Project settings",
      area: "main",
      rendererId: "project.settings",
    });
  },
};
```

Both contributions are owned by `dashboard.project`. Calling `workbench.unregisterModule("dashboard.project")` disposes the tracked registrations.

Ownership metadata is not the disposal mechanism by itself. Module cleanup works because the module context tracks returned `Disposable` objects and disposes them when the module is unregistered. `ownerId` makes that ownership visible and consistent; it should not be used as a substitute for returning or tracking disposables.

## Owner id vs contribution id

`ownerId` and `contributionId` answer different questions.

`ownerId` answers: which module or extension owns this contribution or placement?

```ts
ownerId: "dashboard.project"
```

`contributionId` answers: which registered widget contribution does this placement instantiate?

```ts
contributionId: "project.settings"
```

They often look related, but they are not interchangeable. One owner can contribute many ids:

```ts
ownerId: "dashboard.project", contributionId: "project.settings"
ownerId: "dashboard.project", contributionId: "project.sidenav"
ownerId: "dashboard.project", contributionId: "project.header"
```

The inverse can also matter for widget placements. A widget contribution may be owned by one module while a placement of that widget is opened by another module. In that case the widget contribution owner and placement owner are intentionally different.

## Widget placements

A widget contribution is the registered definition. A widget placement is an opened instance of that definition in an area.

Important placement fields:

- `widgetId`: the concrete placement id in the current layout
- `contributionId`: the registered widget contribution id
- `ownerId`: the module or extension that owns the placement
- `resourceUri`: the resource instance associated with the placement, when opened for a resource

When a placement is created, layout code sets:

```ts
ownerId: spec.ownerId ?? widget.ownerId
source: spec.source ?? widget.source
```

That means:

- Opening a widget through a module context marks the placement with the opener module's owner id.
- Opening a widget directly without placement metadata falls back to the registered widget contribution's owner id.
- Reopening or updating an existing placement can update its owner metadata when `openWidget()` receives a new `ownerId`.

This distinction is useful when shared widgets are opened by other modules. For example, `shared.resource-viewer` might be contributed by `workbench.shared`, while a project module opens a placement of it:

```ts
{
  widgetId: "shared.resource-viewer",
  contributionId: "shared.resource-viewer",
  ownerId: "dashboard.project",
  resourceUri: "pstdio://project/project-1",
}
```

The placement says "this visible instance was opened by `dashboard.project`." The contribution registry still says "the widget definition belongs to `workbench.shared`."

Code that needs the widget definition should use `contributionId` to read the registered widget. Code that needs to know who opened or owns the visible placement should read the placement `ownerId`.

## Source

`source` records the kind of owner:

- `module`: first-party or host-created workbench module
- `extension`: runtime extension mapped into the workbench by the host

Use `source` with `ownerId` when behavior needs to distinguish host-owned contributions from extension-owned ones. Do not encode source information into the owner id string.

## Conventions

Use stable, dot-separated owner ids aligned with module or extension identity:

```ts
dashboard.project
dashboard.extensions
extension.pstdio.extension-lab
```

Do not use `ownerId` for:

- user ids
- project ids
- resource ids
- widget instance ids
- permission or trust decisions by itself
- unregistering contributions without a tracked disposable

Do not parse a `contributionId` to infer ownership. Always read `ownerId` from the registered contribution or placement metadata.

When adding a new registry or contribution type, include `ContributionMetadata` if entries need attribution, ordering, lifecycle clarity, or debug visibility. Prefer normalizing metadata through the shared contribution metadata helpers so defaults stay consistent.
