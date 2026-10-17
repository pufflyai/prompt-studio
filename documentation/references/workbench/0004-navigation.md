# Navigation

The workbench navigates only to explicit targets. This page lists the target kinds, how navigation validates them, and how history and mounted views behave.

## Targets

`workbench.navigation.openTarget()` accepts explicit targets:

| Target | Effect |
| --- | --- |
| `page` | Activates the page and its declared mode, then updates `PageLocation`, URL, history, breadcrumbs, and restore state. |
| `panel` | Opens one active page slot or mode placement without changing the location. |
| `command` | Executes one command target. |
| `href` | Opens an external URL. |
| `compound` | Prepares page and panel steps against proposed state, then publishes the final state with at most one history entry. |

A page target may carry `resource`, `section` or `position`, `open`, and contextual `parent`. A panel target may carry `resource` and `open`. A target never carries a region or activation callback.

## Related resources

Appearance's **Open related resources** setting is on by default. Opening a resource or selecting its tab evaluates its owner's optional `relatedOpenings` command. Only entries with `autoOpen: true` open automatically. Targets use their normal owner resolvers; automatic openings do not recursively open their own related resources.

Ticket supplies its latest session in Side. Workspace supplies its latest session in Side. Terminals open manually. Owners choose their defaults; the host applies shared presentation rules. Page entry always places automatic tabs, including inside panels remembered as closed. Resource pages remember related resource choices and manual closures only for destinations in their current automatic openings; remembered choices do not steal selection. Panels revealed automatically close on leave unless the user keeps them through normal tab or panel controls. Other Side/Bottom state is global within the project, including closures made on another page. See [related resource openings](../extensions/0018-related-resource-openings.md) for selection, focus, persistence and cleanup rules.

Each tray keeps at most one unpinned preview, always at the left. Opening or unpinning another preview replaces the previous preview across page, mode and shell owners. Dragging and dropping an unpinned tab pins it instead, preserving the destination preview. The insertion marker and rounded tray outline show its destination; cancelling leaves retention unchanged. The same rule applies to moves through the tab menu or `movePanel`. Pinned resources stay pinned. Automatic related opening protects its initiating preview. Late results are discarded after source/project changes, owner removal, or disabling the setting. Ordinary tab edits and layout reconciliation preserve a valid page-entry lookup; remembered closures control reveal without suppressing placement.

## Validation and history

Navigation validates the complete target before changing state. An unresolved page or inactive panel owner produces one error and leaves location, history, breadcrumbs, page instances, mode placements, selection, and visibility unchanged. Commands and external links remain standalone actions. It does not search by resource kind or fall back to `main`.

Browser Back and Forward replay canonical `PageLocation` values. Replay replaces the active owner set and does not push another history entry. Refreshing metadata for the same logical location preserves the selected panel; replaying a different document or location activates its destination.

The routed page owns its breadcrumb and page actions. A collection page uses Main's selected document for its document context. Focusing Side or Secondary does not replace that context. A resource-bound page keeps its routed resource as the breadcrumb subject, even when Main renders another resource.

## Mounted views

Visited registered views remain mounted when navigation hides them. Returning to a page or mode reuses its live view, including its iframe and local state. Docked views have stable portal hosts owned by the workbench. Moving a tab changes the host's DOM parent without remounting its React content. Hidden views do not take layout space or accept user input.

A resource binding with `cardinality: "one"` keeps one placement when its resource changes. The host updates that live view's resource and attached menus. A binding with `cardinality: "many"` gives each open resource its own placement.

The host exposes `getPanelDestinations(instanceId)`, `movePanel(instanceId, region, position?)`, and `resetLayout()`. A position is `"start"`, `"end"`, `{ beforeWidgetId }`, or `{ afterWidgetId }`. Moves preserve the current page route and the primary resource anchor. The `workbench.movePanel` and `workbench.resetLayout` commands expose the same operations to commands and agents. `onDidResetLayout` lets host UI clear its active layout preferences after the reset.

Retention is local to the current project and workbench. Removing a view contribution, switching projects, or closing the workbench releases its retained views. A full application reload starts new views. Views are not mounted merely because they are registered; `mountStrategy: "keep-mounted"` can mount inactive placements before their first selection.

Tree selection follows Main's selected document or the routed page resource when Main has no document. A node's declared `selected` value distinguishes documents that share a resource identity, but applies only while that resource or page is active. Rows without a resource or navigation target keep their declared selection. Contextual parent trees remain visible without overriding the current workspace selection. Returning to the parent restores its active document selection.

Tree reads belong to the mounted placement. Changing its resource or navigation level refreshes its data while keeping the current rows until the complete replacement arrives. Rows with the same identity keep their DOM, focus, and scroll position. A changed read scope cancels older reads and ignores their late results. Opening a different tree or project starts a new snapshot. A changed search filter also starts a new snapshot, so results from the previous query cannot be clicked while its replacement loads.

Navigation trees in the sidenav keep their available rows when a read fails. They do not show an inline load-error notice or Retry button, including on the initial load. Later data refreshes and connection recovery load the tree again. Trees in other panels keep their load-error notices and Retry controls.

## Resource actions on navigation rows

Set `TreeNode.resource` to the subject of row actions. `target` remains the normal-click destination. Session rows in the Sessions level, workspace group, and Planner ticket section use the same session reference for both. The shared tree resolves resource menu contributions and keeps the clicked resource in command context, including parameter dialogs. Opening or dismissing a menu does not navigate.

Resource-owned menu contributions also appear on resource tabs and resource breadcrumbs. The workbench resolves one ordered resource group for the explicit subject of each menu. Navigation-specific actions supplement that group; a row's menu path does not replace it. Parent breadcrumbs resolve their own resource actions. Tab controls, placement sections, and current-page actions remain separate groups.

A view's custom tab controls belong only to the current breadcrumb with the same declared document reference. A parent resource breadcrumb never inherits those document controls, even when both references share a resource ID.

A host resource kind can supply `resolve` and `subscribe` to read current state and notify menu consumers. This keeps an inactive tab's actions consistent with navigation after a status or capability change. Resource data stays with its owner; the workbench does not store another copy.

Owner refreshes distinguish a resource's declared document selection. Two documents on the same resource resolve their own labels and metadata. Refreshing or activating one placement preserves the other placement's selected document.

The primary resource watcher owns refreshes for the current page resource. When an inactive placement becomes primary, its pending placement refresh is canceled and its late result is ignored. An older response cannot restore stale titles, permissions, or menu metadata over the primary watcher's newer result.

Keep these identities separate when they differ. A file row may open its parent ticket while declaring file-specific `contextMenuActions`. Do not infer its action subject from the destination. Rows with no applicable actions and the navigation background keep the customization menu.

## Document routes and source positions

A routed resource page can declare `document: { metadataKey: "workspaceFilePath" }`. The selected document stays in that ResourceRef metadata field. The shared page URL codec projects only that declared string into the `document` query parameter. Labels, roots, permissions, and other metadata stay out of URLs. Owners hydrate those values and validate document membership before loading content.

`serializePageUrl` and `parsePageUrl` from `@pstdio/sdk/extensions` round-trip the declared selector. Browser history distinguishes documents within one resource. Display or capability refreshes preserve selection without adding a history entry. Document and position changes share the owner's layout and mounted view.

`position: { line, column?, endLine?, endColumn? }` is a one-based source location. It requires a selected document and cannot be combined with a Markdown heading `section`. URLs use the same named coordinate parameters. Monaco reveals and selects the requested range after loading, and on another explicit navigation within the same file. It retains the editor draft. Images and rich Markdown show a notice when source positions are unavailable. Markdown heading navigation still uses `section`.

Chat UI accepts an optional `linkHandler` with `resolveHref`, `open`, and optional `describe` methods. It passes the original destination and its origin (Markdown, inline code, reference, or tool) to the host. The session host resolves relative paths from the originating workspace root, checks rooted paths against that root, and uses registered page URLs for saved resources. A file path under `.pstdio/extension-storage/pstdio-planner/tickets` opens those workspace bytes. It does not imply a saved Planner document. Absolute dashboard URLs must have the dashboard's origin; another project is selected before its page is restored. Raw custom schemes cannot execute commands. Uploaded attachments retain their own open behavior.

The legacy public `onOpenFile` callback remains available and is deprecated in favor of `linkHandler`. Existing callers without a handler retain their behavior.
