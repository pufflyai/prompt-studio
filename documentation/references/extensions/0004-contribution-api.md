# Contributions

Contributions are what an extension adds to Prompt Studio. This page lists every contribution kind and explains the UI contributions.

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
| `statuses`                                        | Deprecated workflow providers; use query-owned enums and an extension settings panel.                     |
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

UI contributions attach to targets that the host owns. [Workbench composition](0008-contextual-workbench-composition.md) explains how views, pages, modes, and panels fit together.

## Kanban create results

A successful `createRow` result with string `id` and `title` is passed to the renderer's declared `onRowActivate` callback. That callback owns navigation through `ctx.navigation.open` with an explicit page or panel target. Creating a resource does not choose its presentation. Use the same activation callback for opening an existing row and a newly created row.

Do not return `metadata.resourceParent` or infer a view from a resource type. Resource hierarchy and page destinations are separate contracts. See the [Kanban host](../../../packages/pstdio-workbench/src/extensions/contributions/kanban-renderer-contributions.ts) and the [workbench cookbook](../../guides/extensions/0002-workbench-cookbook.md).

## Settings

`settings.properties` declares values that the host stores for one project or for all projects, as set by `scope`. The Settings tab on the extension's page shows a field for each `boolean`, `number`, and `string` setting. Array and object settings need the extension's own view, placed with `settingsPanels`. A settings panel without `section` appears in the host's Project group.

A `string` setting can offer choices in two ways:

- `enum` lists fixed values. The host refuses any other value.
- `options` loads the choices from a command when the Settings tab opens. It uses the same `ParamOptionSource` as command params: `command`, `valueField`, `labelField`, and optional `params`. The command returns a list of rows. A `{ kind: "param-value", key }` param passes the current value of another setting.

A setting with `options` shows as a searchable dropdown, with the same loading and error states as command dialogs. Clearing it removes the saved value, so the setting falls back to its `default`. The host does not check saved values against the options, because choices such as remote branches can disappear after a value is saved. The dropdown keeps showing a saved value that the command no longer lists. Check the value where the extension uses it.

```ts
"implementation.defaultTargetBranch": {
  type: "string",
  scope: "project",
  default: "",
  title: "Default target branch",
  options: { command: implementationTargetsCommand.ref, valueField: "branch", labelField: "branch" },
},
```

Only `string` settings accept `options`; on other types the host ignores `options` and reports a warning. The option command must belong to the same extension. A command ref that names no command of the extension is reported as `unknown_setting_option_command`. Setting `options` needs extension API 0.1.2.

## Authoring Boundaries

Extensions declare metadata and handlers; the host owns installation, project enablement, command routing, workbench chrome, trusted context keys, and layout primitives.

Extension code should not:

- define package identity inside `defineExtension()`
- invent dashboard target ids outside the SDK target registry
- import Prompt Studio packages other than `@pstdio/sdk` and `@pstdio/ui`
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
and their IDs are scoped. While its resource or page is active, it takes precedence
over saved row selection and automatic page or resource matching. A contextual parent
tree's declared document selection does not override the open workspace.
Rows without a resource or navigation target keep their declared selection.

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

See [Workbench composition](0008-contextual-workbench-composition.md) and [Modes and layout](0009-modes-and-layout.md) for the full rules.

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

Pressed and selected controls, such as an open panel's toggle, use
`editor.selectionBackground`. When a theme sets `editor.background` but not
`editor.selectionBackground`, the app mixes the theme's text color into its
background instead, so pressed controls stand out from the main background.

## Views: filter, sort, and display

Kanban and data table bodies share one view model. A view stores:

- `filter`: a rule is `{ attributeId, condition, value }`. Normal rules join with `"and"`. Optional `groups` contain one level of advanced rules, each with `conjunction: "and" | "or"` and `rules`. Normal rules and groups combine using AND. Whole-view OR filters remain supported and appear as one Advanced filter bubble in the dashboard. Groups cannot contain other groups.
- `sorts`: zero or one field and direction pair. Display settings and table headers edit this same single sort. An empty list keeps the board's manual order, or the query's order for a table.
- `settings`: board display settings (view mode, grouping, sub-grouping, visible properties), or table display settings (`grouping`, `rowNumbers`, `wrapRows`, `showStats`, `hiddenColumns`, `columnOrder`).

Search is screen state. It narrows what is on screen, is never saved, and is never sent to a query.

Boolean fields hold real `true` or `false` values. Their controls read as predicates, such as "Ticket is Archived" or "Ticket is not Archived". Set the native view body's `resourceKind` to a resource-kind ref to use its singular label as the subject; otherwise the subject is "Item". The property label supplies the predicate. `is false` and `is-not true` show the same negative predicate; `is-not` also includes rows with no value. In the CLI, use `--filter "archived is false"`. Data-table columns opt in with `type: "boolean"`; undeclared columns keep their existing text filters.

When changing an enum field to a boolean, declare its old stored IDs in `type.legacyValues`, for example `{ kind: "boolean", legacyValues: { active: false, archived: true } }`. The host normalizes saved rules before cleanup, and the renderer normalizes local view state before edits. This map never coerces row values or allows old option lists in new API writes. Keep the map while saved views may still use those IDs.

Each field kind accepts a fixed list of conditions. `VIEW_FILTER_CONDITIONS` in `@pstdio/sdk/extensions` is the only copy, and the dashboard, the views API, and `pst views` all read it.

| Field kind | Conditions | Sortable |
| --- | --- | --- |
| `string` | `contains`, `does-not-contain`, `is`, `is-not`, `is-empty`, `is-not-empty` | yes |
| `boolean` | `is`, `is-not`, `is-empty`, `is-not-empty` | yes |
| `number` | `is`, `is-not`, `gt`, `gte`, `lt`, `lte`, `is-empty`, `is-not-empty` | yes |
| `date` | `is`, `is-before`, `is-after`, `is-on-or-before`, `is-on-or-after`, `is-empty`, `is-not-empty` | yes |
| `enum`, `status`, `user` | `is-any-of`, `is-none-of`, `is-empty`, `is-not-empty` | yes |
| `enum-multi` | `has-any-of`, `has-all-of`, `has-none-of`, `is-empty`, `is-not-empty` | no |

A date value is a day (`2026-10-02`) or a day relative to today (`today`, `today-7`, `today+7`). Relative days resolve against the viewer's date each time the view renders. Option values are compared by value ID. The board title is a built-in `string` field with ID `title`.

Declare the starting view with `defaultFilter`, `defaultSorts`, and `defaultSettings`, and multiple starting views with `defaultViews`:

```ts
defineView({
  id: "tickets",
  title: "Tickets",
  body: {
    kind: "kanban",
    attributes,
    query: queryTickets,
    defaultFilter: {
      conjunction: "and",
      rules: [{ attributeId: "archived", condition: "is-any-of", value: ["active"] }],
    },
    defaultSorts: [{ attributeId: "created", direction: "desc" }],
    defaultViews: [
      {
        id: "urgent",
        title: "Urgent",
        settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: ["id"] },
        filter: { conjunction: "and", rules: [{ attributeId: "priority", condition: "is-any-of", value: ["urgent"] }] },
        sorts: [{ attributeId: "updated", direction: "desc" }],
      },
    ],
  },
});
```

Data table columns can declare `type` (`"string"`, `"number"`, or `"date"`) and `groupable: true`. Without a type, a column whose values are all numbers is a number field and every other column is text. Columns are filterable by default. Declare `filterable: false` on a column to exclude it from Filter and reject saved rules for it. Query-returned columns use the same option and take precedence over declared columns. Disabling filtering keeps display, sorting, and grouping available. Only groupable columns appear under Grouping in the table's Display menu. Tables group by exact value; empty values form a last "No <column>" group.

The query receives `filter`, `sorts`, and the display `settings`. Use them only to narrow what you load. The renderer always applies the full filter and sorts to the rows you return, so returning more rows than the view shows is always correct.

Deprecated fields still work and are converted where the host reads the contribution. When both are set, the new field wins. They are removed together in the next breaking extension API release.

| Deprecated | Replacement |
| --- | --- |
| `defaultFilters: { status: ["todo"] }` | `defaultFilter` with an `is-any-of` rule (`has-any-of` for `enum-multi`) |
| `defaultSettings.ordering`, `settings.ordering` in `defaultViews` | `defaultSorts`, `sorts`; manual ordering is an empty list |
| `filters` in `defaultViews` | `filter` |
| `params.filters` and `params.settings.ordering` in a kanban query | `params.filter` and `params.sorts` |

The host keeps sending `params.filters`, derived from root `is-any-of` and `has-any-of` rules when the root joins with `"and"`, and `params.settings.ordering`, the first sort or `manual`.

## Shared views

`defaultViews` defines the starting views for a collection with no saved views. The host saves them as ordinary project views that people and agents can edit, rename, reorder, and delete. At least one view must remain. `defaultActiveViewId` chooses the initial default. The deprecated `isDefault` flag remains a fallback when `defaultActiveViewId` is absent; use `defaultActiveViewId` in new extensions. Saved project views and their shared default take precedence after initialization. Do not store a second copy in extension storage.

The host saves user-created views for kanban and data table views per project, extension instance and local view ID. Query-returned attributes, columns, and status options are used to validate settings, rules, and sorts. Keep field IDs stable across releases. A successful query can clean rules for removed fields and options from saved views; a failed query never removes them.

Use [board view commands and APIs](../cli/0009-board-views.md) for agent workflows. `KanbanRendererViewsSource` and `DataTableViewsSource` supply shared views and asynchronous mutations to the UI renderers. The workbench accepts a subscribable views provider from its host. Standalone callers need a views source to persist view changes.

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

The header and footer keep the mode's sections, followed by the sections of every open level from the outermost inward. Header rows therefore stay visible in nested levels. Rows that users drag into the header or footer also stay there inside levels. Users leave a level through the breadcrumb or browser history; the Sidenav adds no Back row. Users can hide and reorder a level's labeled sections, but its rows keep the order their owner gives them.

A level page without a declared parent, such as Notes, has nothing outside the level in its breadcrumb. The host then leads that breadcrumb with a project crumb. It opens the last location the user visited outside every level, or the start page when there is none. A page whose mode sets `chrome.sidenav` also hides the project rows, so it counts as a level here. Extensions need no code for this: declare a `parent` when the level belongs under another page, and leave it out when the level is a top-level page.

For example, Notes contributes one mode-owned navigation item opening its Notes page. Its note-list tree is owned by that page. Notes are top-level rows in a section with a New note action. A compound target opens the Notes page and pins the chosen note panel; the location remains in the Notes level. To add sections at the main level, own them with the mode instead of a page.

Session commands contributed through `sessionSlots.headerPrimary` or `sessionSlots.headerOverflow` also appear in shared session resource menus. Session tree rows must set `resource` explicitly, even when `target.resource` already names the session. Visibility and execution use the clicked session; opening a different resource first is not required. Host session rows expose the existing Open session panel action without tab placement arguments.

## Queued conversation requests

The host provides these project-scoped `ctx.sessions` methods:

- `getQueuedFollowUps(sessionId)` returns full saved requests, their revisions, and the active run precondition.
- `updateQueuedFollowUp(sessionId, queuePosition, input)` saves the full request and returns its new revision. Send `expectedRevision`; omitted fields retain saved values. `model: null` selects the provider default, `params: null` resets supported defaults, and `attachments: []` clears references.
- `combineQueuedFollowUps(sessionId, targetPosition, { sourcePosition, sourceRevision, targetRevision })` atomically combines compatible requests.
- `steerQueuedFollowUp(sessionId, queuePosition, { expectedRevision, expectedRunStartedAt })` returns an accepted, rejected, or uncertain outcome.

An active `HarnessSession` may provide `steer({ deliveryId, prompt, attachments, signal })`. It must use native input without cancelling or starting a turn. Before returning accepted, emit exactly one normalized user message whose ID is `deliveryId`. Native history must preserve that correlation for recovery. A successful pipe write alone is insufficient. A transport failure after input may have been sent is uncertain. Only return rejected when native input was definitely refused. Older harnesses remain supported without this optional method.

Publish the additive SDK before harness extensions adopt it. Codex native acceptance and persisted `clientUserMessageId` were verified on 0.160.0. Claude Code 2.1.294 validation is blocked by a weekly usage limit; OpenCode is unverified. This host change enables neither adapter by itself.
