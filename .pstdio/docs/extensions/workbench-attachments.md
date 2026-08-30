# Workbench UI Contributions

The workbench UI is composed from references between small contributions. Each
fact has one owner:

- `views` own UI bodies
- `viewMenus` attach one view to another
- `pages` own tool screens: slots and resource-kind bindings
- `resourceKinds` own domain data; they say nothing about presentation
- `placements` dock static views into modes
- `navigationItems` own typed navigation actions
- `settingsPanels` and `statusBarItems` place view references in host chrome

If you are deciding which of these a feature needs, read
[Choosing a UI surface](./choosing-a-ui-surface.md) first.

## Views

Create views with `defineView`. A view body is one of `webview`, `tree`, `file`,
`controls`, `dataTable`, or `kanban`. A view owns its title and icon, shown
wherever it renders, including tabs. It never defines a region, a URL, or a
resource kind.

```ts
const tickets = defineView({
  id: "tickets",
  title: "Tickets",
  body: {
    kind: "kanban",
    attributes: [],
    query: async () => ({ rows: [] }),
  },
});
```

The helper returns `tickets.ref`. Use that ref in every contribution that targets
the view. The runtime creates the canonical id `${extensionId}.view.${localId}`.

## Pages

A page places views and resources on the bench. Its slots declare regions and open
policy; its bindings say which view presents which resource kind in which slot.
Tabs are derived from slot content, and the page's `path` is its URL under the
extension's namespace.

```ts
const ticketsPage = definePage({
  id: "tickets",
  title: "Tickets",
  path: "tickets",
  slots: [
    { id: "board", region: "main", view: tickets.ref, closable: false },
    { id: "ticket", region: "main", cardinality: "many" },
  ],
  bindings: [{ resourceKind: ticket.ref, view: editor.ref, slot: "ticket" }],
});
```

A binding has no region; the slot it names carries the geometry. Because any page
can bind any kind, two pages can present the same resource kind differently.
Slot policy and the page-versus-mode contract are covered in
[Extension modes and layout](./modes-and-layout.md).

## Navigation

Navigation actions are typed. They can open a page (optionally with a resource
argument), run a command, open an href, or combine several targets.

```ts
const ticketsNavigation = defineNavigationItem({
  id: "tickets",
  slot: workbenchSlots.projectNavigation,
  label: "Tickets",
  action: { kind: "page", page: ticketsPage.ref },
});
```

The built-in slots are exported from `workbenchSlots`. An optional `when`
expression controls visibility. Host pages for native screens are exported from
`workbenchPages` (`workspaces`, `sessions`, `start`). See
[Navigation](../references/workbench/navigation.md) for the full target union and
in-page emissions.

## Placements

A placement docks a static view in a region for one mode. It is for workbench
furniture that must survive page switches (a terminal, a sessions panel), because
pages replace only the regions they declare.

```ts
const terminalPlacement = definePlacement({
  id: "terminal",
  mode: workbenchModes.project,
  item: { kind: "view", view: terminal.ref },
  region: "secondary",
});
```

Docked regions are `sidenav`, `main`, `secondary`, and `side`. `movableTo` lists
the regions where a user may move the placement and must include the initial
region. A required placement must be open. Content that belongs to one tool screen
is a page slot, not a placement.

Status-bar items do not use placements or saved dock layout. The host renders
every visible item in stable slot and order sequence.

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
  section: plannerSettingsSection.ref,
});
```

The owner view controls menu lifetime: the menu follows the owner wherever it
renders, including into every tab. The host settings slot controls settings
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

`pst extensions check` rejects missing refs, duplicate local ids, invalid page
slots and bindings, invalid placement geometry, and removed contribution kinds
(for example `resourceViews`, replaced by page `bindings`). One invalid
contribution is dropped without changing unrelated valid contributions.

The page diagnostic codes:

- `extension_page_slot_duplicate`: a slot id is declared twice on one page.
- `extension_page_slot_invalid`: a static slot sets bound-only fields (`cardinality`, `follows`), a bound slot sets static-only fields (`defaultOpen`, `scope`), or a `many` slot is outside the panel regions (`main`, `side`, `secondary`).
- `extension_page_binding_invalid`: a binding targets a slot that is not a bound slot on the page, or binds the same kind to the same slot twice.
- `extension_page_follows_invalid`: `follows` names a slot that is not a `many` slot on the page, or the follower binds none of its kinds.
- `extension_page_path_invalid`: a page path is not lowercase kebab-case segments, collides with a reserved host segment, or repeats another path in the extension.
- `extension_page_missing`: a page target names an unknown page (own pages and host pages resolve; refs into other extensions are shape-checked only).
- `extension_page_target_invalid`: a page target names a slot the page lacks or a resource kind the page does not bind.
- `extension_page_scope_inert` (warning): `scope: "location"` on a page with no bindings; the location never changes.
