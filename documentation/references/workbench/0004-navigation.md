# Workbench navigation

`workbench.navigation.openTarget()` accepts explicit targets:

| Target | Effect |
| --- | --- |
| `page` | Activates the page and its declared mode, then updates `PageLocation`, URL, history, breadcrumbs, and restore state. |
| `panel` | Opens one active page slot or mode placement without changing the location. |
| `command` | Executes one command target. |
| `href` | Opens an external URL. |
| `compound` | Prepares page and panel steps against proposed state, then publishes the final state with at most one history entry. |

A page target may carry `resource`, `section`, `open`, and contextual `parent`. A panel target may carry `resource` and `open`. A target never carries a region or activation callback.

Navigation validates the complete target before changing state. An unresolved page or inactive panel owner produces one error and leaves location, history, breadcrumbs, page instances, mode placements, selection, and visibility unchanged. Commands and external links remain standalone actions. It does not search by resource kind or fall back to `main`.

Browser Back and Forward replay canonical `PageLocation` values. Replay replaces the active owner set and does not push another history entry.

Visited registered views remain mounted when navigation hides them. Returning to a page or mode reuses its live view, including its iframe and local state. Docked views have stable portal hosts owned by the workbench. Moving a tab changes the host's DOM parent without remounting its React content. Hidden views do not take layout space or accept user input.

A resource binding with `cardinality: "one"` keeps one placement when its resource changes. The host updates that live view's resource and attached menus. A binding with `cardinality: "many"` gives each open resource its own placement.

The host exposes `getPanelDestinations(instanceId)`, `movePanel(instanceId, region, position?)`, and `resetLayout()`. A position is `"start"`, `"end"`, `{ beforeWidgetId }`, or `{ afterWidgetId }`. Moves preserve the current page route and the primary resource anchor. The `workbench.movePanel` and `workbench.resetLayout` commands expose the same operations to commands and agents. `onDidResetLayout` lets host UI clear its active layout preferences after the reset.

Retention is local to the current project and workbench. Removing a view contribution, switching projects, or closing the workbench releases its retained views. A full application reload starts new views. Views are not mounted merely because they are registered; `mountStrategy: "keep-mounted"` can mount inactive placements before their first selection.

Tree selection follows the active resource and page. A node's declared `selected` value distinguishes documents that share a resource identity, but applies only while that resource or page is active. Rows without a resource or navigation target keep their declared selection. Contextual parent trees remain visible without overriding the current workspace selection. Returning to the parent restores its active document selection.

Tree reads belong to the mounted placement. Changing its resource or navigation level refreshes its data while keeping the current rows until the complete replacement arrives. Rows with the same identity keep their DOM, focus, and scroll position. A changed read scope cancels older reads and ignores their late results. Opening a different tree or project starts a new snapshot. A changed search filter also starts a new snapshot, so results from the previous query cannot be clicked while its replacement loads.

## Resource actions on navigation rows

Set `TreeNode.resource` to the subject of row actions. `target` remains the normal-click destination. Session rows in the Sessions level, workspace group, and Planner ticket section use the same session reference for both. The shared tree resolves resource menu contributions and keeps the clicked resource in command context, including parameter dialogs. Opening or dismissing a menu does not navigate.

Keep these identities separate when they differ. A file row may open its parent ticket while declaring file-specific `contextMenuActions`. Do not infer its action subject from the destination. Rows with no applicable actions and the navigation background keep the customization menu.
