# Contribution Ownership

Contribution ownership is metadata that records which workbench module or runtime extension contributed something to the workbench. It is deliberately separate from contribution ids, Panel instance ids, resource ids, and user or project identity.

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

Runtime extensions should use the extension id as the owner id and `source: "extension"` when the host maps extension metadata into workbench modules. That keeps extension-owned Panels, commands, menu items, notifications, preferences, and webviews attributable to the extension package that supplied them.

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
- extension webview attribution, where a Panel contribution's owner id becomes the extension id
- lifecycle clarity when a group of contributions is registered and disposed together

The metadata is attached to contributions across commands, keybindings, resources, layout Panels, placeholders, menu items, navigation handlers, tree renderer contributions, kanban renderer contributions, notifications, and preference schemas.

## Module context

Prefer registering contributions through the module activation context instead of passing metadata by hand. The context stamps the module's `ownerId` and `source` onto contributions and tracks disposables for cleanup.

```ts
const module = {
  id: "dashboard.project",
  activate(ctx) {
    ctx.resources.registerKind({ kind: "project", label: "Project" });
    ctx.layout.registerPanel({
      id: "project.settings",
      title: "Project settings",
      region: "main"
      closable: false,
      rendererId: "project.settings",
    });
  },
};
```

Both contributions are owned by `dashboard.project`. Calling `workbench.unregisterModule("dashboard.project")` disposes the tracked registrations.

Ownership metadata is not the disposal mechanism by itself. Module cleanup works because the module context tracks returned `Disposable` objects and disposes them when the module is unregistered. `ownerId` makes that ownership visible and consistent; it should not be used as a substitute for returning or tracking disposables.

## Owner id vs contribution id

`ownerId` and `panelId` answer different questions.

`ownerId` answers: which module or extension owns this contribution or instance?

```ts
ownerId: "dashboard.project"
```

`panelId` answers: which registered Panel contribution does this instance instantiate?

```ts
panelId: "project.settings"
```

They often look related, but they are not interchangeable. One owner can contribute many ids:

```ts
ownerId: "dashboard.project", panelId: "project.settings"
ownerId: "dashboard.project", panelId: "project.sidenav"
ownerId: "dashboard.project", panelId: "project.header"
```

The inverse can also matter for Panel instances. A Panel contribution may be owned by one module while a instance of that Panel is opened by another module. In that case the Panel contribution owner and instance owner are intentionally different.

## Panel instances

A Panel contribution is the registered definition. A Panel instance is an opened instance of that definition in an area.

Important instance fields:

- `instanceId`: the concrete instance id in the current layout
- `panelId`: the registered Panel contribution id
- `ownerId`: the module or extension that owns the instance
- `resourceUri`: the resource instance associated with the instance, when opened for a resource

When an instance is created, layout code sets:

```ts
ownerId: spec.ownerId ?? Panel.ownerId
source: spec.source ?? Panel.source
```

That means:

- Opening a Panel through a module context marks the instance with the presenter module's owner id.
- Opening a Panel directly without instance metadata falls back to the registered Panel contribution's owner id.
- Reopening or updating an existing instance can update its owner metadata when `openPanel()` receives a new `ownerId`.

This distinction is useful when shared Panels are opened by other modules. For example, `shared.resource-viewer` might be contributed by `workbench.shared`, while a project module opens an instance of it:

```ts
{
  instanceId: "shared.resource-viewer:project-1",
  panelId: "shared.resource-viewer",
  ownerId: "dashboard.project",
  resourceUri: "pstdio://project/project-1",
}
```

The instance says "this visible instance was opened by `dashboard.project`." The contribution registry still says "the Panel definition belongs to `workbench.shared`."

Code that needs the Panel definition should use `panelId` to read the registered Panel. Code that needs to know who opened or owns the visible instance should read the instance `ownerId`.

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
- Panel instance ids
- permission or trust decisions by itself
- unregistering contributions without a tracked disposable

Do not parse a `panelId` to infer ownership. Always read `ownerId` from the registered contribution or instance metadata.

When adding a new registry or contribution type, include `ContributionMetadata` if entries need attribution, ordering, lifecycle clarity, or debug visibility. Prefer normalizing metadata through the shared contribution metadata helpers so defaults stay consistent.
