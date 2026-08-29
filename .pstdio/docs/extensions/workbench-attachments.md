# Workbench UI Contributions

Extension API alpha.4 uses references between small UI contributions. Each fact has one owner:

- `views` own UI bodies
- `viewMenus` attach one view to another
- `resourceKinds` own semantic slots
- `resourceViews` bind views to resource slots
- `placements` own docked geometry
- `navigationItems` own typed navigation actions
- `settingsPanels` and `statusBarItems` place view references in host chrome

## Views

Create views with `defineView`. A view body is one of `webview`, `tree`, `file`,
`controls`, `dataTable`, or `kanban`. The view may define a deep-link `path`, but it
does not define a region or resource kind.

```ts
const tickets = defineView({
  id: "tickets",
  title: "Tickets",
  path: "tickets",
  body: {
    kind: "kanban",
    attributes: [],
    query: async () => ({ rows: [] }),
  },
});
```

The helper returns `tickets.ref`. Use that ref in every contribution that targets the
view. The runtime creates the canonical id
`${extensionId}.view.${localId}`.

## Navigation

Navigation actions are typed. They can open a view or resource, run a command, open an
href, or combine several targets.

```ts
const ticketsNavigation = defineNavigationItem({
  id: "tickets",
  slot: workbenchSlots.projectNavigation,
  label: "Tickets",
  action: { kind: "view", view: tickets.ref },
});
```

The built-in slots are exported from `workbenchSlots`. An optional `when` expression
controls visibility.

## Resource Slots

A resource kind declares semantic slots. `access: "owner"` keeps a slot private to the
declaring extension. `access: "public"` allows another extension to bind a view.

```ts
const ticket = defineResourceKind({
  id: "ticket",
  surface: "primary",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "inspector", cardinality: "many", access: "public" },
  ],
});

const primary = resourceSlotRef(ticket.ref, "primary");
const editorBinding = defineResourceView({
  id: "ticket-editor",
  resourceKind: ticket.ref,
  slot: primary,
  view: editor.ref,
});
```

A binding has no region. This lets modes arrange the same resource views differently
without changing their identity or duplicating data.

## Placements

A placement puts a direct view or a resource slot in a docked region for one mode.

```ts
const editorPlacement = definePlacement({
  id: "ticket-primary",
  mode: workbenchModes.project,
  item: { kind: "resource-slot", slot: primary },
  region: "main",
  required: true,
});
```

Docked regions are `sidenav`, `main`, `secondary`, and `side`. `movableTo` lists the
regions where a user may move the placement. A required placement must be open and can
only target a cardinality-one resource slot.

Status-bar items do not use placements or saved dock layout. The host renders every
visible item in stable slot and order sequence.

## View Menus And Settings

Menus and settings reference existing views:

```ts
const propertiesMenu = defineViewMenu({
  id: "ticket-properties",
  owner: editor.ref,
  view: properties.ref,
  side: "right",
});

const tagsSettings = defineSettingsPanel({
  id: "ticket-tags",
  view: tagSettings.ref,
  slot: workbenchSlots.projectSettings,
  section: "planner",
});
```

The owner view controls menu lifetime. The host settings slot controls settings
navigation and layout.

## Webview capabilities by attachment

Capabilities belong to the reusable view body. The host still decides which handlers
exist at each attachment. A declaration grants permission to call a handler; it does
not create missing project context.

| Attachment | `files.upload`, `files.list`, `files.delete` | `resource.open` |
| --- | --- | --- |
| Project route or panel | Available when declared and the view has an extension instance owner. | Available when declared. |
| Project resource view | Available when declared and the view has an extension instance owner. | Available when declared. |
| Project settings panel | Available when declared and the settings panel resolves to a project extension instance. | Available when declared. |
| Global settings panel | Unavailable because there is no project extension instance. | Available when declared. |

The dashboard gets project and extension ownership from its trusted contribution
metadata. Guest messages cannot supply or replace either id. File scopes group data
inside that fixed owner boundary.

See [Webview files](./api.md#webview-files) for method shapes and
[Open a resource from a webview](./api.md#open-a-resource-from-a-webview) for resource
navigation.

## Validation

`pst extensions check` rejects missing refs, duplicate local ids, closed resource slots,
invalid placement geometry, and alpha.3 UI fields. One invalid contribution is omitted
without changing unrelated valid contributions.
