# PRD: Shared timeline renderer

Status: Proposed

Proposed: 2026-10-16

## Problem

Planner's Project Timeline runs in an extension iframe. It loads its own React, Chakra, UI styles, and editor dependencies. A production-style build of PR #1127 before the iframe improvements produced 5,532,685 bytes of JavaScript and 2,951,124 bytes of CSS. The CSS contained 63 font faces. These are build sizes, not measured network transfer or startup times.

The iframe also gives shared filter popovers a different viewport from native Kanban and DataTable controls. Moving source files into the UI package alone does not remove that boundary or share the host's loaded runtime.

The current PR improves the iframe by sharing plan reads, combining overlapping refreshes, omitting ordinary ticket documents from the graph response, and rendering nearby cards. This PRD describes the later extraction and host integration.

## Goal and product boundary

Provide a reusable dependency timeline in `@pstdio/ui/timeline`, then let extensions contribute data and actions to a host-rendered timeline through the public SDK. Planner remains an extension.

The shared renderer must support other tools that show dependencies, grouped work, milestones, or execution order. Core owns the view contract and rendering infrastructure. Planner owns tickets, Auto Build, review requests, scheduling rules, risk, ETA, and persistence. This follows the [mission](../../../MISSION.md) and [package boundaries](../../references/architecture/0013-package-boundaries.md).

## Ownership

| Owner | Responsibilities |
| --- | --- |
| UI | Cards, lanes, milestone bands, dependency arrows, pan and zoom, selection, focus, drag feedback, viewport rendering, theme recipes, and Canvas coverage |
| SDK | Serializable timeline data, query and event contracts, declared actions, and capability validation |
| Workbench | Mounting the renderer, shared collection controls, navigation, loading and connection chrome, action reporting, and query lifecycle |
| Planner | Mapping tickets to timeline data; dependency correctness; dates, ordering, ETA and risk; gates and reviews; Auto Build; storage and command implementations |

Neither UI nor Workbench may import Planner source or depend on Planner's types. UI must not fetch data, route pages, own a query client, or execute extension commands.

## Reusable UI contract

The component receives rows with stable IDs and typed attributes, tracks or lanes, milestone groups, dependency links, the selected ID, and view state. Separate layout data from business state: a dependency arrow describes a relation; Planner decides whether that relation blocks work.

Use the shared collection attribute, filter, saved-view, and ordering types where their semantics match. Define only the additional graph geometry and interaction types. Do not expose `PlanRow`, review request records, implementation sessions, or Auto Build state.

Actions are callbacks for selection, movement, grouping, date edits, and context actions. Extra toolbar actions and detail content are optional composition points. Editors, creation forms, and Auto Build dialogs stay outside the renderer and load when opened.

Keep the feature behind its dedicated export. Importing a button or a table must not load timeline code. The renderer's style entry must include only its shared foundations and required fonts; it must not pull in math, Markdown editor, terminal, or Monaco assets.

## Native extension view contract

Add an additive public timeline view contribution after the reusable renderer is established. Its query returns serializable rows, schema, groups, links, and relevant view configuration. Updates use the shared renderer read lifecycle and declared invalidation events. Mutations identify registered commands and pass validated row, group, or date values; arbitrary React callbacks do not cross the extension boundary.

The host renders the collection bar, graph, and error chrome in its own document. This lets Timeline use the same theme, fonts, filters, viewport sizing, connection indicator, and action reporting as Kanban and DataTable. Planner can continue opening its existing ticket pages and sessions through public navigation targets.

Saved views must resolve collection fields without rerunning the row query. Replace the hidden Kanban schema adapter described in [ADR 0076](../../adrs/0076-temporary-timeline-saved-view-schema.md) with a public collection schema contract. Reading saved views must not load ticket rows, session histories, or another dependency plan.

A component extraction consumed by the old iframe is an intermediate release. It is not evidence that runtime duplication or the iframe sizing difference has been removed.

## Interaction and performance requirements

- Preserve pan, anchored zoom, track and milestone collapse, selection, keyboard navigation, and drag/drop behavior.
- Mount cards near the viewport and retain the selected, focused, and dragged card. Preserve measured heights as cards leave and re-enter the viewport.
- Keep dependency edges that cross the viewport even when both endpoint cards are outside it.
- Keep global geometry stable while panning. Changes to one card's measured height may update affected geometry without rebuilding unrelated data.
- Preserve loaded content during reconnects. Workbench owns connection and view failures; forms keep actionable validation beside their fields.
- Match the shared filter component, theme, size tokens, and focus behavior at the same viewport size.
- Load each ticket snapshot once per query and combine overlapping invalidations. Fetch document bodies and request details when needed rather than copying them into every graph row.
- Reuse existing view state and saved views. Do not add a second persisted copy of Planner's plan or a new database migration for the extraction.

## Delivery sequence

1. Extract generic geometry, interaction, and rendering into the UI subpath. Add representative stories for empty, dense, long-title, filtered, collapsed, keyboard, drag, and failed-action states. Keep domain calculations in Planner.
2. Publish the UI package and any necessary additive SDK contract. Validate package consumers and extension compatibility. Follow [API versioning](../../references/extensions/0014-api-versioning.md).
3. Implement Workbench's generic native timeline renderer and lifecycle using the published contract. Keep Planner-specific actions and computations out of the host.
4. In a separate extension PR, update Planner's exact published UI dependency and supported SDK version, adapt its query and actions, and switch its contribution to the native renderer.
5. Remove the old iframe entry, copied composition code, unnecessary browser dependencies, and the temporary filter module once a published UI export replaces it, as required by [ADR 0071](../../adrs/0071-temporary-package-planner-filter-control.md).

Publish dependencies before consuming them. Do not make portable extension installs depend on workspace links or unpublished exports. Preserve the currently supported iframe until the replacement is available; remove it when migration completes.

## Validation and acceptance

Use the same fixed plans before and after the change: 100, 1,000, and 10,000 tickets, multiple tracks, long titles, and dependencies across milestones. Report cold and warm load time, JavaScript and CSS bytes, parse time, mounted card count, interaction latency, and retained memory. Record workload and machine details with the measurements; agree on numeric budgets from that evidence before enforcing them.

The change is accepted when:

- A non-Planner fixture can use the public UI component and the native view contract without importing Planner.
- An installed Planner uses published packages and retains its existing plans, saved views, actions, and navigation.
- Playwright confirms the shared filter geometry and interactions, viewport rendering, height retention, pan and zoom, selection reveal, keyboard focus, cross-viewport links, and drag/drop.
- Reconnection retains the graph and produces one host-owned connection notice. A rejected user action is reported once and never appears as a second page-wide error banner.
- Packaged CLI, API, and browser checks pass, including consumer checks that prove unrelated UI imports do not load the timeline or editor assets.
- The measured native path eliminates Planner's separate iframe UI runtime and demonstrates the reported footprint and responsiveness improvements without hiding work or raising existing timeouts.

## Out of scope

Changing Planner's scheduling or review rules, creating a core project tracker, redesigning the timeline, adding a new animation library, and broad changes to every extension's packaging are separate decisions. Shared style or loading work needed by this renderer must remain useful to other UI consumers.
