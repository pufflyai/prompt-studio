---
status: "shipped"
created: "2026-08-18T17:03:48.668Z"
---

# Extension conformance and regression coverage

Extension Lab, the extension testbench, packaged smoke checks, Storybook, and Playwright form one vertical conformance suite. Tests follow user-visible invariants across the SDK, extension normalization, workbench, and dashboard.

## Fixture matrix

| Fixture | Rule proved |
| --- | --- |
| Project Lab page | A first-party extension page uses the public page and navigation path. |
| Lab mode page | Page placements compose with mode placements and choose the page's declared mode. |
| Faulty Lab page | A broken view fails inside one page without changing navigation ownership. |
| Artifact auxiliary slot | An explicit panel target opens a page-owned resource binding. |
| Page-owned camera tree | Page navigation appears with mode navigation and disappears on page leave. |
| Planner Tickets and Ticket pages | List and detail are mutually exclusive pages. |
| Attached ticket session | A panel target leaves Ticket `PageLocation` unchanged. |
| Ticket to Workspace | Contextual parent navigation restores the parent Ticket breadcrumb. |
| Editable file renderer | Focus, selection, save, and refresh lifecycle. |

## Coverage map

| Invariant | Owning proof |
| --- | --- |
| Mode and page placements share a region without deleting each other | `owned-placement-layout.test.ts`, `placement-reconciliation.test.ts`, and the Workbench Page Composition story |
| Leaving a page removes only that page's placements | `page-registry-transition.test.ts` and `page-runtime.test.ts` |
| Leaving a mode removes its page and mode placements together | `page-location-controller.test.ts` and `workbench-core-page-navigation.test.ts` |
| One canonical location drives history and breadcrumbs | `page-location-controller.test.ts`, `page-location-codec.test.ts`, and `page-breadcrumbs.test.ts` |
| Page navigation selects the declared mode | `page-registry-transition.test.ts` and `extension-lab-pages.spec.ts` |
| Start, Tickets, Ticket, Sessions, Workspaces, and Lab replace the active page | Dashboard module tests and page Playwright journeys |
| Page and mode Sidenav sections compose and clean up by owner | `dashboard-sidenav.test.ts` and the Dashboard Sidenav story |
| Webviews use explicit page or panel navigation | `extension-webview-capabilities.test.ts` and `extension-webview-command.test.ts` |
| Packaged extensions expose the same page metadata | `packaged-serve-smoke.test.ts` and extension composition conformance tests |

## Requirements

1. SDK typechecks cover valid pages, slots, modes, placements, and explicit navigation targets.
2. Normalization rejects invalid refs and relationships with stable diagnostics.
3. Workbench tests assert complete placement owner identities, not incidental widget order.
4. Every UI behavior change has a runnable Storybook or dashboard journey.
5. Playwright validates the visible page, mode, Sidenav, URL, breadcrumb, and stale-panel cleanup where applicable.
6. Packaged smoke tests use the same public extension metadata as development.
7. Full validation must pass without increasing a timeout.
