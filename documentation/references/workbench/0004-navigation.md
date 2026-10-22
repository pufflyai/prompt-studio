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

Ticket supplies its latest session in Side. Workspace supplies its latest session in Side. Terminals open manually. Owners choose their defaults; the host applies shared presentation rules. Page entry always places automatic tabs, including inside panels remembered as closed. Resource pages remember related resource choices and manual closures only for destinations in their current automatic openings; remembered choices do not steal selection. Panels revealed automatically close on leave unless the user keeps them through normal tab or panel controls. Other Side/Bottom state is shared within one project and mode, including closures made on another page. Page or resource navigation within that mode closes all unpinned tabs in every tray. A mode switch preserves the outgoing tabs, selection, panel visibility, sizes and running terminals and restores them on return. Modes show only their supported panels. See [related resource openings](../extensions/0019-related-resource-openings.md) for selection, focus, persistence and cleanup rules.

Each tray keeps at most one unpinned preview, always at the left. Opening or unpinning another preview replaces the previous preview across page, mode and shell owners. Dragging and dropping an unpinned tab pins it instead, preserving the destination preview. The insertion marker and rounded tray outline show its destination; cancelling leaves retention unchanged. The same rule applies to moves through the tab menu or `movePanel`. Pinned resources stay pinned. Automatic related opening protects its initiating preview. Late results are discarded after source/project changes, owner removal, or disabling the setting. Ordinary tab edits and layout reconciliation preserve a valid page-entry lookup; remembered closures control reveal without suppressing placement.

## Validation and history

Navigation validates the complete target before changing state. An unresolved page or inactive panel owner produces one error and leaves location, history, breadcrumbs, page instances, mode placements, selection, and visibility unchanged. Commands and external links remain standalone actions. It does not search by resource kind or fall back to `main`.

Browser Back and Forward replay canonical `PageLocation` values. Replay replaces the active owner set and does not push another history entry. Refreshing metadata for the same logical location preserves the selected panel; replaying a different document or location activates its destination.

The routed page owns its breadcrumb and page actions. A collection page uses Main's selected document for its document context. Focusing Side or Secondary does not replace that context. A resource-bound page keeps its routed resource as the breadcrumb subject, even when Main renders another resource.

## Mounted views

### Main fullscreen

The fullscreen control expands Main over the workbench. In the browser it sits at the end of the navigation header. Desktop places it beside the panel controls in the top bar. It stays reachable when panel headers or mode navigation chrome are hidden. Fullscreen hides the title bar, activity bar, Sidenav, Bottom, Main's tab header, and status bar as presentation. It does not replace or save the global layout, change the page URL, or create page panels.

An open attached or floating Side becomes a temporary floating overlay when the mode allows floating. A closed Side stays closed. While Side is minimized, its bubble remains available in fullscreen and reopens the temporary overlay. The bubble hides beneath the open overlay. A mode without Side, or with a nonfloating Side, hides it. The fullscreen header keeps only the exit control. The bubble and overlay close action change only the temporary presentation. They follow the mode's open and close permissions. Dismissing Side returns focus to the bubble; exiting returns focus to the fullscreen entry control. Escape first lets nested menus and dialogs handle the key, then dismisses Side, then exits fullscreen.

Page navigation keeps fullscreen active. A mode or project change, disposal, or a full reload clears it. Existing views and manual terminal processes remain mounted through these transitions. Automatic previews still follow the related-opening cleanup and remembered-closure rules above. On exit, the underlying tabs, selection, sizes, dock position, and visibility remain available, including ordinary user edits made during fullscreen.

Main tabs belong to the current page, including pinned shell, mode and host tabs moved there. They hide on page leave and restore with that page. Side and Bottom keep shared tabs within the current mode. Moving a tab out of Main makes it shared again. Pinning controls retention, not scope.

Visited registered views remain mounted while their tabs are open, including inactive pages and modes. Closing or replacing a tab keeps its view for 30 minutes so returning preserves reading position, iframe state, and local input. After that grace period the closed view unmounts. Registered mode chrome and status views keep their contribution as their owner. Docked views have stable portal hosts owned by the workbench. Moving a tab changes the host's DOM parent without remounting its React content. Hidden views do not take layout space or accept user input. A pinned Main terminal keeps its running process while its page is hidden.

An auxiliary resource binding with `cardinality: "one"` keeps one placement when its resource changes. The host updates that live view's resource and attached menus. Main keeps a separate view for each routed resource or declared document, including with `cardinality: "one"`, and reuses it on return while open or within the same grace period. A binding with `cardinality: "many"` gives each open resource its own placement.

The host exposes `getPanelDestinations(instanceId)`, `movePanel(instanceId, region, position?)`, and `resetLayout()`. A position is `"start"`, `"end"`, `{ beforeWidgetId }`, or `{ afterWidgetId }`. Moves preserve the current page route and the primary resource anchor. The `workbench.movePanel` and `workbench.resetLayout` commands expose the same operations to commands and agents. `onDidResetLayout` lets host UI clear its active layout preferences after the reset.

Single-resource pages hide the tab strip and close action by default. A routed Main view can set
`closable: true` to use a closeable resource tab; closing it returns to its declared parent.
Selecting a different resource
on that same one-resource page replaces its content in the chosen region, while preserving separate resource
navigation identities. A single-view parent and its resource page also keep that region when they use the
same view. Pages with a declared document keep each document's separate layout and do not replace a moved
document when opening another. Other pages and mode-owned panels keep their declared lifetimes.

Retention is local to the current project and workbench. Removing a view contribution, switching projects, or closing the workbench releases its retained views. A full application reload starts new views. Views are not mounted merely because they are registered; `mountStrategy: "keep-mounted"` can mount inactive placements before their first selection.

Resource removal uses the shared registry cleanup for page, mode and shell placements. It matches the full resource identity, including project and extension, and invalidates pending related openings. Session deletion and archive use this same cleanup; closing a Session view alone does not delete or stop the Session. Resource cleanup does not save a manual panel closure. A retained dirty editor may stay visible while its pending related lookup is cancelled.

Tree selection follows Main's selected document or the routed page resource when Main has no document. A node's declared `selected` value distinguishes documents that share a resource identity, but applies only while that resource or page is active. Rows without a resource or navigation target keep their declared selection. Contextual parent trees remain visible without overriding the current workspace selection. Returning to the parent restores its active document selection.

Tree reads belong to the mounted placement. Changing its resource or navigation level refreshes its data while keeping the current rows until the complete replacement arrives. Rows with the same identity keep their DOM, focus, and scroll position. A changed read scope cancels older reads and ignores their late results. Opening a different tree or project starts a new snapshot. A changed search filter also starts a new snapshot, so results from the previous query cannot be clicked while its replacement loads.

Navigation trees in the sidenav keep their available rows when a read fails. They do not show an inline load-error notice or Retry button, including on the initial load. Later data refreshes and connection recovery load the tree again. Trees in other panels keep their load-error notices and Retry controls.

## Navigation item groups

A navigation item's `group` names a collapsible Sidenav section. The section belongs to the extension that declared the item: its ID is `<extensionId>:<group>`. Each extension's items for one owner and slot also register as their own contribution. Two extensions that both use `group: "Tools"` therefore show two separate **Tools** sections. The workbench does not merge equal labels from different extensions, because a merged section would have no single owner for its order, hiding, and moves. An empty `group` places items at the slot root. See [`navigation-item-contributions.ts`](../../../packages/pstdio-workbench/src/extensions/contributions/navigation-item-contributions.ts).

Choose a group label that names your tool, such as its display name, rather than a generic word. People can still collect rows that share a mode or page owner into their own group with **New group** in the Sidenav menu; see [API](0002-api.md).

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

`serializePageUrl` and `parsePageUrl` from `@pstdio/sdk/extensions` round-trip the declared selector. Browser history distinguishes documents within one resource. Display or capability refreshes preserve selection without adding a history entry. Each declared document has its own Main snapshot and optional-view choices. Changing documents closes previews and restores that document's Main tabs. Section and source-position changes within the same document keep its layout and mounted view. Side and Bottom remain shared within the mode.

`position: { line, column?, endLine?, endColumn? }` is a one-based source location. It requires a selected document and cannot be combined with a Markdown heading `section`. URLs use the same named coordinate parameters. Monaco reveals and selects the requested range after loading, and on another explicit navigation within the same file. It retains the editor draft. Images and rich Markdown show a notice when source positions are unavailable. Markdown heading navigation still uses `section`.

Chat UI accepts an optional `linkHandler` with `resolveHref`, `open`, and optional `describe` methods. It passes the original destination and its origin (Markdown, inline code, reference, or tool) to the host. The session host resolves relative paths from the originating workspace root, checks rooted paths against that root, and uses registered page URLs for saved resources. A file path under `.pstdio/extension-storage/pstdio-planner/tickets` opens those workspace bytes. It does not imply a saved Planner document. Absolute dashboard URLs must have the dashboard's origin; another project is selected before its page is restored. Raw custom schemes cannot execute commands. Uploaded attachments retain their own open behavior.

The legacy public `onOpenFile` callback remains available and is deprecated in favor of `linkHandler`. Existing callers without a handler retain their behavior.

## Shared panel commands

Global panel controls render in the web navigation header: closed Sidenav recovery before history, and Bottom/Side controls after breadcrumbs. Desktop hosts use the exported `WorkbenchPanelToggles` and `WorkbenchFullscreenToggle` beside project tabs and set `Workbench.panelControlsPlacement="host"`. The navigation header keeps the exit control available while fullscreen hides the top bar. Custom mode navigation chrome keeps these host controls. Session panels are available in each mode that allows Side or Bottom and retain that project/mode’s own tabs. Project navigation stays above the shared Main and Bottom layout. The Sidenav control icon mirrors when Navigation is on the right, including while Navigation is closed.

`shell.getPanelPolicy(region)` resolves availability, visibility, opening, closing, tab acceptance, resizing, floating and header visibility. UI controls, tab destinations, public commands and restoration use this policy. `workbench.movePanel` moves a tab; whole-panel docking is separate work.

| Command | Parameters |
| --- | --- |
| `workbench.setPanelOpen` | `region: sidenav, secondary, side`, `open: boolean` |
| `workbench.setPanelHeaderVisible` | `region: main, secondary, side`, `visible: boolean` |
| `workbench.resizePanel` | `region: sidenav, secondary, side`, `size: number` in pixels |
| `workbench.setSidePanelPresentation` | `presentation: attached, floating, closed` |

The matching shell methods enforce the same permissions. Header show/hide also has a context menu on the header or hidden top edge with keyboard and touch access. Explicitly showing a header also shows its tabs, including a single Start page. Header choices stay in the mode layout and layout reset clears them. Optional panels collapse after their last tab closes, including panels previously opened empty.

## Panel placement and closed-edge drops

The shared shell owns whole-panel positions in the existing project and mode layout. Side can sit left or right of Main. Navigation sits at the far left or far right. Main and Bottom can flip their vertical order. The action bar can sit on any outer edge. Moving a panel keeps its tabs, resources, selection and live content. Reset layout restores the default positions.

Drag empty Main, attached Side or Bottom header space to an allowed edge. A floating Side header, including the temporary fullscreen overlay, does not start a whole-panel drag. Reattaching Side restores its panel drag handle. Main moves with its own header; the project navigation row is not a Main drag handle. Navigation and the action bar also accept drags from empty space. Buttons, tabs and resource controls keep their own gestures. The header context menu offers the same placement actions through right-click, Shift+F10, the Context Menu key and touch hold. Unavailable moves and the current position are omitted. Actions refresh after each placement change.

Insertion targets reserve space at the boundary that owns the panel: Side sits between Navigation and Main, and Bottom stays within Main's column. The current placement has no target. Main can change vertical placement only while Bottom is open; closing or removing Bottom disables Main’s move actions and drag surface. During a whole-panel drag, the original grab point competes with allowed destinations. Releasing closer to that point keeps the current placement, so returning toward the start cancels a move. Approaching a destination selects its full rounded outline and accent fill, without a center bar. Empty movable chrome uses a grab cursor and dragging uses a grabbing cursor. Leaving the workbench or cancelling also preserves the placement.

Agents use the same shell operations through these commands:

- `workbench.repositionPanel` takes `region` (`main`, `secondary`, `side` or `sidenav`) and `position` (`left`, `right`, `top` or `bottom`). The controller rejects unsupported combinations and mode restrictions before changing the layout.
- `workbench.setActionBarPosition` takes `position` on any outer edge.
- `workbench.movePanel` continues to move a single tab. It respects the destination policy and the placement's allowed trays.

During a tab drag, a closed eligible Side offers both allowed left/right edges and Bottom offers both allowed top/bottom edges, including before their first opening. Fixed placement rules keep only the saved edge available. A valid drop saves the chosen edge, opens the panel and inserts the pinned tab in one step. Closed Side opens attached. Cancelling or dropping elsewhere leaves visibility and tab retention unchanged. Open panels accept incoming tabs only within their current visible bounds. When dragging the sole tab of Side or Bottom, that panel also offers its opposite permitted edge. Dropping there moves the panel with the same tab and live content, pins an unpinned tab, and saves the new edge. A floating Side attaches at the chosen edge. Cancelling preserves placement, presentation and retention. Panels with multiple tabs and fixed panels offer no alternate edge for their own tabs. Tab edge targets stay invisible until the pointer approaches an eligible edge. Only the nearest target appears, including where edges meet. Its complete rounded outline and filled background reserve space at the owning layout boundary, like a whole-panel dropzone, without guidance text. Leaving the edge removes the slot and restores the content bounds. Choosing the nearest edge stays stable while the preview shifts content. Existing tab targets keep priority and remain reachable while a slot shifts their header. An existing destination preview stays open and leftmost; the dropped tab never replaces it. Removed page panels have no targets.
