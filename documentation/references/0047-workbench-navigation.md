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

Visited registered views remain mounted in their regions when navigation hides them. Returning to a page or mode reuses its live view, including its iframe and local state. Hidden views do not take layout space or accept user input. Region containers remain in the same DOM position when optional panels or mode chrome change.

Retention is local to the current project and workbench. Removing a view contribution, switching projects, or closing the workbench releases its retained views. A full application reload starts new views. Views are not mounted merely because they are registered; `mountStrategy: "keep-mounted"` can mount inactive placements before their first selection.
