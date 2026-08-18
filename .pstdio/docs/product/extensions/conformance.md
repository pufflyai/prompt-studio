---
status: "draft"
created: "2026-08-18T17:03:48.668Z"
---

# Product Requirements Document: Extension Conformance and Regression Coverage

## Summary

Turn Extension Lab, the extension testbench, packaged smoke checks, and Playwright into one conformance suite for extension composition, navigation, renderer lifecycle, and runtime ownership.

## Problem

The PS-246 checks proved individual normalization and callback paths but missed complete user flows:

- a save event remounted an active editor;
- a mode retained an incompatible resource;
- required Lab tabs could not be recovered;
- ticket breadcrumbs lost their browse root;
- root tree placement required a fake group;
- repeated command execution leaked imported modules until OOM.

Tests were organized around implementation surfaces instead of invariants that cross the SDK, API, dashboard, and workbench.

## Goals

- Provide representative fixtures for every supported extension composition.
- Run the same navigation invariants against built-in and extension resources.
- Prove editing behavior in a real browser.
- Prove packaged extension metadata and runtime execution use the same contracts.
- Detect unbounded command-time module loading before merge.
- Make failed diagnostics point extension authors to the invalid contribution.

## Non-Goals

- Snapshotting every pixel of extension webviews.
- Testing arbitrary third-party extension code.
- Raising CI timeouts or container memory limits.
- Replacing focused unit tests with only end-to-end tests.

## Fixture Matrix

Extension Lab must include:

| Fixture | Purpose |
| ------- | ------- |
| Lab root resource | Default resource and mode-wide layout. |
| Glass Lab artifact | Detail resource inside Lab mode. |
| Animation mode | First layout over a shared project resource. |
| Sculpt mode | Different regions over the same resource. |
| External ticket insights panel | Cross-extension resource-panel contribution. |
| Required panel | Close prevention and reconciliation. |
| Default optional panel | User close and persistence. |
| Movable panel with menu | Region move and relative menu ownership. |
| Root tree item | Headerless group null behavior. |
| Nested resource tree | Root, child, and grandchild breadcrumbs. |
| Editable file renderer | Focus, selection, save, and refresh lifecycle. |
| No-op public and private commands | Runtime snapshot reuse and soak. |

## Regression Coverage Map

Every reproduced PS-246 regression has a test owner and a validation layer:

| Regression | Owning PRD | Fixture | Validation layer |
| ---------- | ---------- | ------- | ---------------- |
| Editor saves unchanged content, remounts, and loses focus and selection | Renderer Edit and Refresh Lifecycle | Editable file renderer | Renderer lifecycle unit tests plus Playwright focus and selection checks |
| Ticket breadcrumbs lose the Tickets browse root | Extension Navigation and Layout State | Nested resource tree | Workbench hierarchy contract test plus Playwright breadcrumb assertions |
| Resource presenters infer and change mode from resource kind | Extension Navigation and Layout State | Shared workbench suite | Contract test: a resource-only open preserves the active mode |
| Lab retains a ticket resource and places Lab panels under the ticket location | Extension Navigation and Layout State | Lab root resource | Navigation state transition unit test plus Playwright mode switch |
| Closed required Lab panels have no recovery path | Contextual Workbench Composition | Required panel | Mode re-entry reconciliation test plus Playwright |
| Root tree items cannot opt out of the Extensions group | Contextual Workbench Composition | Root tree item | Sidenav story plus Playwright |
| Repeated commands import fresh module identities until OOM | Project Extension Runtime Snapshots | No-op public and private commands | Loader-count integration test plus isolated container soak |

## Requirements

### Static and Normalization Tests

1. SDK typechecks cover valid resource kinds, slots, resource panels, modes, and placements.
2. Invalid references produce stable diagnostic codes.
3. Duplicate ownership and closed-slot contributions fail deterministically.
4. Normalized metadata preserves declaration order and namespaced ids.
5. Packaged extension fixtures use the same API version and schema as source fixtures.

### Workbench Contract Tests

1. A shared contract opens one resource in two modes and restores distinct layouts.
2. A resource-only open preserves mode.
3. An incompatible resource leaves navigation unchanged.
4. History replay restores mode and resource atomically.
5. Panel menus follow owner placement.
6. Required and optional placement rules are tested with persistence.
7. Attached resources do not replace primary history.

### Dashboard and Playwright Tests

1. Project mode opens Tickets and nested ticket resources without changing mode.
2. Ticket breadcrumbs show Tickets and all nested parents.
3. Ticket editing retains focus and a held selection beyond the save debounce.
4. Switching Project to Lab never renders Lab under a ticket breadcrumb.
5. Switching Animation and Sculpt retains the shared resource and changes panel regions.
6. Closing optional panels persists; required panels cannot be closed and recover from stale fixture state.
7. Root tree items render without an Extensions heading.
8. Extension Lab exercises webview, tree, file, controls, data table, and Kanban renderers across the matrix.

### Runtime and Packaged Tests

1. Loader counters prove one project snapshot for repeated unchanged commands.
2. Concurrent commands share the cold load.
3. Source refresh produces one new generation.
4. An isolated container executes a bounded command soak and records memory samples.
5. Packaged smoke verifies every built-in extension contribution referenced by the conformance fixtures.
6. Package verification runs after bundled defaults change.

## Success Metrics

| Metric | Baseline | Target | Measurement |
| ------ | -------- | ------ | ----------- |
| Reported PS-246 UX regressions caught automatically | Zero | All reproduced as tests | Test mapping in proposal |
| Cross-layer navigation contracts | Partial route coverage | Mode-resource matrix covered | Shared workbench suite |
| Renderer focus validation | Missing | Chromium Playwright coverage | E2E trace |
| Command module reuse | Missing | Exact load-count assertion | API integration test |
| Packaged fixture parity | Partial | All conformance fixtures verified | verify:packages |

## Rules and Constraints

- Tests assert user behavior and system invariants, not implementation wording.
- UI changes use Storybook stories and Playwright rather than component snapshot tests.
- Bug fixes begin with a failing reproduction.
- No test increases a suite, job, or Playwright timeout.
- Memory tests use import counts as the deterministic gate and memory sampling as supporting evidence.
- Every fixture is small enough to diagnose when one layer fails.

## Failure Evidence

CI artifacts should include:

- Playwright trace and screenshot for browser failures;
- mode id, resource URI, layout scope, and active placement summary for navigation failures;
- runtime generation and source load counts for snapshot failures;
- container RSS samples and exit reason for soak failures;
- extension id, contribution id, and diagnostic code for schema failures.

## Risks and Open Questions

- A full isolated soak is slower than a unit load-count test and should run in the existing packaged or end-to-end budget.
- Browser selection APIs differ; the focus test must use supported semantic assertions.
- Extension Lab must stay demonstrative and not become a second production extension.
- Test fixtures must not rely on the Planner extension's private implementation.

## Rollout Plan

1. Add failing reproductions for the current regressions.
2. Add the composition and navigation fixture matrix.
3. Add browser focus, selection, mode, and hierarchy tests.
4. Add catalog load-count and invalidation tests.
5. Add the isolated packaged soak.
6. Map every proposal acceptance criterion to at least one test.

## Related Architecture

- [Extension Workbench Composition](../../architecture/extension-workbench-composition.md)
- [Extension Navigation](../../architecture/extension-navigation.md)
- [Project Extension Runtime Snapshots](../../architecture/project-extension-runtime-snapshots.md)
