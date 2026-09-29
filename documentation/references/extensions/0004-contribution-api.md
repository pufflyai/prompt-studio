# Extension contributions

Part of the [extension API reference](0001-api.md).

## Contribution Surfaces

| Surface                                           | Product role                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `commands`                                        | User-triggered, CLI-triggered, scheduled, or automation-triggered operations.                     |
| `keybindings`                                     | Global app-level shortcuts that run a navigation action, using TanStack Hotkeys syntax.           |
| `middlewares`                                     | Pre-command checks that may continue, patch params, replace invocation data, or reject.           |
| `hooks`                                           | Event observers that run after a product event is emitted.                                        |
| `schedules`                                       | Cron-driven command invocation.                                                                   |
| `views`                                           | Reusable webview, tree, file, controls, table, and Kanban bodies.                                  |
| `viewMenus`                                       | View bodies attached as menus owned by another view.                                               |
| `pages`                                           | Routed screens with resource constraints, Main presentation, and extra panel slots.                                 |
| `placements`                                      | Mode-wide static views or resource bindings.                                                        |
| `navigationItems`, `navigationTrees`              | Explicit actions and Sidenav trees owned by a mode or page.                                        |
| `resourceKinds`                                   | Domain resource identity, labels, icons, menus, and hierarchy.                                     |
| `resourceHierarchyProviders`                      | Domain parent lookup for resources. Page targets supply breadcrumb destinations.                                   |
| `statusBarItems`                                  | Views in the host status bar; all visible items render without layout persistence.                 |
| `statuses`                                        | Workflow status providers shared by Kanban views and the host settings editor.                     |
| `settings`, `settingsSections` | Extension setting definitions and grouped settings sections. |
| `templateTypes` | Commands and metadata for extension-owned template editing. |
| `commandPaletteResources` | Searchable resources with explicit activation targets. |
| `translations`, `defaultLocale` | Localized contribution labels and the fallback locale. |
| `settingsPanels`                                  | References that place views in host-owned settings slots.                                          |
| `modes`                                           | Typed Workbench mode contributions.                                                                |
| `activityItems`                                   | Activity-rail entries that select a Workbench mode.                                                |
| `templates`, `skills`, `themes`, `fileIconThemes` | Packaged catalog assets.                                                                          |
| `artifactMounts`                                  | Safe repo-local file access under `.pstdio/extension-storage/<package-name>/`.                                      |
| `workspaceTypes`, `harnesses`                     | Provider integrations owned by the extension runtime.                                             |
| `connections`                                     | Host-managed HTTP access to a declared remote control plane.                                       |

UI-facing contributions attach to implemented host-owned targets. The attachment model is covered in [Dashboard UI attachments](0013-workbench-attachments.md).

## Kanban create results

A successful `createRow` result with string `id` and `title` is passed to the renderer's declared `onRowActivate` callback. That callback owns navigation through `ctx.navigation.open` with an explicit page or panel target. Creating a resource does not choose its presentation. Use the same activation callback for opening an existing row and a newly created row.

Do not return `metadata.resourceParent` or infer a view from a resource type. Resource hierarchy and page destinations are separate contracts. See the [Kanban host](../../../packages/pstdio-workbench/src/extensions/contributions/kanban-renderer-contributions.ts) and the [workbench cookbook](../../guides/extensions/0002-workbench-cookbook.md).

## Authoring Boundaries

Extensions declare metadata and handlers; the host owns installation, project enablement, command routing, workbench chrome, trusted context keys, and layout primitives.

Extension code should not:

- define package identity inside `defineExtension()`
- invent dashboard target ids outside the SDK target registry
- import from `clients/*`
- write outside package assets, API-owned storage, or declared artifact mounts
- assume a target maps to a fixed physical location across dashboard implementations

When extension UI needs dashboard placement, attach it to a host-owned target and optionally add a `when` expression. The dashboard decides how that target maps to current UI.

## Keybindings

Keybindings bind app-level keyboard shortcuts to a navigation `action`. The action is any navigation target: a command, a page, a panel, an href, or a compound target. Pages and panels bind directly; no wrapper command is needed. Chords use `@tanstack/hotkeys` syntax and are validated by the extension runtime. Invalid chords, modifier-only chords, and duplicate platform-aware chords are reported by extension checks and dropped from metadata.

Prefer `Mod+...` so the chord maps to `Cmd` on macOS and `Ctrl` on Windows/Linux without an override. Avoid chords already claimed by browsers, OSes, or developer tooling (`Mod+T`, `Mod+W`, `Mod+R`, `Mod+P`, `Mod+S`, `Mod+Shift+P`, `Mod+Shift+I`, `F5`, `F11`, `F12`, …); the extension runtime emits a `reserved_keybinding_chord` warning when a contribution hits a reserved chord on any platform. Reach for multi-step chords like `mod+k mod+t` if no single chord is safe.

```ts
import { defineCommand, defineExtension, defineKeybinding } from "@pstdio/sdk/extensions";

const preview = defineCommand({
  id: "preview",
  title: "Preview",
  async run(_ctx, _commandParams) {
    return { opened: true };
  },
});

export default defineExtension({
  commands: [preview],
  keybindings: [
    defineKeybinding({
      id: "preview",
      key: "mod+shift+y",
      mac: "cmd+shift+y",
      win: "ctrl+shift+y",
      linux: "ctrl+shift+y",
      action: { kind: "command", target: { command: preview.ref } },
      when: { resourceType: [{ extensionId: "pstdio.marp", kind: "resource-kind", id: "presentation" }] },
    }),
  ],
});
```

A command action may pass params with `target: { command: preview.ref, params: { ... } }`. Use `action: { kind: "page", page: somePage.ref }` or `action: { kind: "panel", panel: somePage.panels.someSlot }` to open a page or panel directly.

## Dashboard UI Contributions

Dashboard UI contributions have one ownership model:

- a view owns its body and may use `webview`, `tree`, `file`, `controls`, `dataTable`, or `kanban`
- a page owns a route, mode, optional resource constraint, Main presentation, and extra slots
- a placement owns a shared mode panel with a static-view or resource-binding item
- a navigation item uses a typed action instead of encoded route or command fields
- a navigation tree adds a tree view to a mode or page in the shared Sidenav
- a view menu references its owner view and menu view
- status-bar and settings contributions reference views; they do not duplicate view bodies

Local ids are explicit. The runtime normalizes them as
`${extensionId}.${contributionKind}.${localId}`. Use the `ref` returned by each `define*`
helper instead of rebuilding that id. Resources still identify domain objects such as
tickets, workspaces, and sessions. Paths belong to pages, never views.

```ts
import { defineExtension, defineNavigationTree, defineView, workbenchModes } from "@pstdio/sdk/extensions";

const files = defineView({
  id: "files",
  title: "Files",
  body: {
    kind: "tree",
    body: async () => [{ id: "files", label: "Files", nodes: [] }],
  },
});

export default defineExtension({
  views: [files],
  navigationTrees: [
    defineNavigationTree({
      id: "project-files",
      owner: workbenchModes.project,
      slot: "content",
      view: files.ref,
      resourceScope: "project",
    }),
  ],
});
```

`body` and optional `footer` return `TreeViewSection[]`. Optional `children` returns `TreeNode[]` for lazy child
content. Renderer callbacks receive the active project, resource, renderer id, tree state, filter text, and selected
node context.

Navigation trees default to `resourceScope: "selection"`, so selecting a different resource starts a new read. Use `resourceScope: "project"` when the tree reads project data independently of the selected resource, such as a shared notes list. Its callbacks receive the project and no resource; selection changes keep its rows visible. Declared refresh events still update its data. The owner still controls where the tree appears.

Set `selected: true` on the current node when several rows share a resource, such as
documents within one ticket. The declaration stays on the node when trees are combined
and their IDs are scoped. It takes precedence over saved row selection and automatic
page or resource matching.

Tree rows use `resource` as their action subject and `target` as their normal-click destination. Right-clicking
a row resolves the registered actions for its resource kind and adds its `contextMenuActions`. The command and
any parameter dialog keep the clicked resource as their context, even when another resource is open.

The host refreshes the tree after a section or row action runs. An action command calls
`ctx.navigation.open(target)` to move the page, for example back to the ticket body after deleting an open
document. The host applies explicit requests once after a successful command. Returned values remain data.

Set `resource` explicitly on ticket, workspace, and other resource rows. Reuse the same reference in `target`
when the destination represents that resource. A ticket file can instead open its parent ticket page and use
row actions with explicit ticket and file IDs. It must not use the parent ticket as its action subject.

Resource menus work in the Sidenav and standalone trees. A row menu takes precedence over Sidenav customization.
Right-clicking the background or a plain navigation row still opens the customization menu. Workspace rows use
current host capability data, including default-workspace restrictions, when resolving their actions.

The owner can be a mode or page ref. A mode-owned tree adds sections to that mode's navigation. A page-owned
`content` tree starts a [Sidenav level](#sidenav-levels) instead. The Sidenav renders one tree with pinned
`header` and `footer` slots and one scrolling `content` slot.

Inside a command declaration, use a typed menu slot and limit visibility with `when`. Import `workspaceSlots` and `workbenchResourceKinds` from `@pstdio/sdk/extensions`:

```ts
menus: [
  {
    slot: workspaceSlots.headerOverflow,
    label: "Run review",
    when: { resourceType: [workbenchResourceKinds.workspace] },
  },
];
```

Workspace resources use the host project mode. Target workspace actions with
`workbenchResourceKinds.workspace`; the SDK does not export a host workspace mode.

See [Dashboard UI attachments](0013-workbench-attachments.md) and [Extension modes](0009-modes-and-layout.md) for the current product contract.

## Native view toolbar actions

Both `dataTable` and `kanban` bodies accept `toolbarActions`. These actions stay
visible when a query returns no rows. Use them for commands such as creating a
record or starting an experiment.

```ts
const experiments = defineView({
  id: "experiments",
  title: "Experiments",
  body: {
    kind: "dataTable",
    query: () => ({ rows: [] }),
    toolbarActions: [{
      id: "run",
      label: "Run experiment",
      icon: "play",
      presentation: "primary",
      command: runExperiment.ref,
      params: { source: "experiments" },
      input: { name: params.text({ required: true }) },
      submitLabel: "Start experiment",
    }],
  },
});
```

Actions use the shared command path and current resource context. `params`
provides static arguments; values collected by `input` override matching static
arguments. An input schema opens the command dialog. It supports
[command-backed choices](0003-command-and-process-api.md#command-backed-choices).
`when` uses the workbench context expression to control visibility, and
`disabled` disables an action. Command visibility and enablement still apply.

Use `presentation: "primary"` for the main action and `"secondary"` for other
actions. Secondary is the default. More than one primary action produces a
warning, and an unknown command produces an error diagnostic.


## Appearance Contributions

Themes and file icon themes use contribution arrays. Define each theme with a
local ID and register the returned definition. Use its typed ref for a mode's
`defaultTheme`.

```ts
import { defineExtension, defineTheme, packageAsset } from "@pstdio/sdk/extensions";

const monokai = defineTheme({
  id: "monokai",
  title: "Monokai",
  format: "vscode-color-theme",
  mode: "dark",
  source: packageAsset("./themes/monokai.json", import.meta.url),
});

export default defineExtension({ themes: [monokai] });
```

The runtime qualifies the ref with the extension owner. For publisher `acme` and
package `planner`, the theme ID is `acme.planner.theme.monokai`.

## Shared kanban views

`defaultViews` defines extension-owned, read-only built-ins. `defaultActiveViewId` chooses the extension fallback. The deprecated `isDefault` flag remains a fallback when `defaultActiveViewId` is absent; use `defaultActiveViewId` in new extensions. The project's shared default takes precedence over both. Do not copy or save built-ins into extension storage.

The host saves user-created views per project, extension instance and local board ID. Query-returned attributes and status options are used to validate settings and filters. Keep field IDs stable across releases. A successful query can clean removed options from saved views; a failed query never removes them.

Use [board view commands and APIs](../cli/0009-board-views.md) for agent workflows. `KanbanRendererViewsSource` supplies shared views and asynchronous mutations to the UI renderer. The workbench accepts a subscribable views provider from its host; standalone callers without one show their built-ins read-only.

## Sidenav levels

A page-owned content navigation tree starts a sidenav level. Its sections replace the mode content while that page or any child location is open. The nearest owner in the page location parent chain wins, so levels can nest. Pages with only header or footer trees do not start a level.

This extension adds a Recipes row to the project navigation. The row opens the Recipes page. That page owns the `recipe-list` tree, so the recipes replace the project navigation. Opening a recipe keeps the level, because the Recipe page declares Recipes as its parent.

```ts
import {
  defineExtension,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const recipe = defineResourceKind({ id: "recipe", label: "Recipe", icon: "chef-hat" });
const recipes = [
  { id: "pancakes", title: "Pancakes" },
  { id: "ramen", title: "Ramen" },
];

const recipeView = defineView({
  id: "recipe",
  title: "Recipe",
  body: { kind: "controls", query: async () => ({ values: {} }) },
});

// Opening this page starts the Recipes level.
const recipesPage = definePage({
  id: "recipes",
  title: "Recipes",
  path: "recipes",
  mode: workbenchModes.project,
  main: { kind: "panels", empty: recipeView.ref },
  slots: [],
});

// A child page keeps the Recipes level open through its declared parent.
const recipePage = definePage({
  id: "recipe",
  title: "Recipe",
  path: "recipe",
  mode: workbenchModes.project,
  parent: recipesPage.ref,
  resource: { kinds: [recipe.ref] },
  main: { kind: "view", view: recipeView.ref, cardinality: "one" },
  slots: [],
});

const recipeList = defineView({
  id: "recipe-list",
  title: "Recipes",
  body: {
    kind: "tree",
    body: async () => [
      {
        id: "recipes",
        label: "Recipes",
        collapsible: false,
        nodes: recipes.map(({ id, title }) => {
          const resource = { type: recipe.id, id, label: title };
          return {
            id,
            label: title,
            icon: "chef-hat",
            resource,
            target: { kind: "page", page: recipePage.ref, resource },
          };
        }),
      },
    ],
  },
});

export default defineExtension({
  resourceKinds: [recipe],
  views: [recipeView, recipeList],
  pages: [recipesPage, recipePage],
  navigationItems: [
    // The main level shows one row that opens the level.
    defineNavigationItem({
      id: "recipes",
      owner: workbenchModes.project,
      slot: "content",
      label: "Recipes",
      icon: "chef-hat",
      group: "",
      action: { kind: "page", page: recipesPage.ref },
    }),
  ],
  navigationTrees: [
    // A page owner starts a level instead of adding rows to the project navigation.
    defineNavigationTree({
      id: "recipe-list",
      owner: recipesPage.ref,
      slot: "content",
      view: recipeList.ref,
      resourceScope: "project",
    }),
  ],
});
```

The header and footer keep the mode's sections, followed by the sections of every open level from the outermost inward. Header rows therefore stay visible in nested levels. Rows that users drag into the header or footer also stay there inside levels. Users leave a level through the breadcrumb or browser history; the Sidenav adds no Back row. In the Sidenav customize menu, users can hide a level's labeled sections but not its rows.

For example, Notes contributes one mode-owned navigation item opening its Notes page. Its note-list tree is owned by that page. Notes are top-level rows in a section with a New note action. A compound target opens the Notes page and pins the chosen note panel; the location remains in the Notes level. To add sections at the main level, own them with the mode instead of a page.
