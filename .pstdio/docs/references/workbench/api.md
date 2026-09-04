# Workbench API

The workbench separates reusable bodies, routed pages, mode-wide placement, and navigation.

| API | Responsibility |
| --- | --- |
| `views` | Register reusable view bodies and create independent instances for placements. |
| `pages` | Register routed screens and resolve page-owned slots. |
| `modePlacements` | Register content owned by a mode. |
| `navigation` | Open explicit page, panel, command, href, or compound targets. |
| `pageLocation` | Own the canonical active page, browser history, restore, and breadcrumb projection. |
| `layout` | Render and persist owner-scoped placement state. |
| `modes` | Register mode context used by pages and placements. |
| `resources` | Register resource kinds and hierarchy data. Resource identity does not choose presentation. |

Host modules and extensions register pages through the same page registry. Page activation resolves the declared mode and reconciles shell, mode, and page placements as one desired set.

Use `navigation.openTarget()` for user navigation. View and mode registries expose lower-level lifecycle operations for the page runtime; callers must not combine them into a second navigation path.

Panel open state is layout state. Page, resource, section, and contextual parent are location state. Breadcrumbs, the URL, history, and last-location persistence all derive from that one location.

See [Navigation](./navigation.md), [Extension modes](../../extensions/modes-and-layout.md), and [Dashboard UI contributions](../../extensions/workbench-attachments.md).
