# Home

The default project home page is provided by `pstdio.pstdio-home`. It shows the project name, the five most recently opened resources, existing work actions and setup recovery. It reads project data through the public SDK without storing a second copy.

Home contributes an ordinary `home` page and webview with a Go → H action. Prompt Studio configures this page directly as its project default. The shell owns project-root URLs, saved destinations and tool search. If Home is disabled or uninstalled, the dashboard uses its existing empty-panel UI. Sessions and workspaces remain available.

Home uses `repo` scope. Project setup copies its source into `<project>/.pstdio/extensions/pstdio-home/`. Users and agents can customize `src/view.tsx` or its components in that folder and commit the changes with the project. Normal extension source watching and reload apply those edits only to that project's Home. Repeating setup preserves the existing folder and its customizations.

Existing projects can install Home through the ordinary Extensions panel. If a project already uses another Home source, select its project-local copy using the existing extension source controls.

Recent uses the host’s project-scoped navigation history through `workbenchCommands.recentResources`. Opening a resource promotes it; edits alone do not. The host retains destinations in local project preferences and uses live built-in resource metadata and the last-seen presentation refreshed by extension views. Sessions use the shared status indicator; other resources use their own icons. Home appears first in the default navigation header; saved navigation customization takes precedence.

The Canvas baseline is `src/components/home.canvas.tsx`: `Default`, `SetupDidNotFinish`, and `NoRecentResources`.

Home pins the published SDK and UI nightly `0.47.0-nightly.20261104030253` and includes a standalone `bun.lock`. Its public API prerequisite landed in [PR #1687](https://github.com/pufflyai/prompt-studio/pull/1687). Dependency updates must use real published versions and regenerate the extension lockfile through the [supported release workflow](../../documentation/guides/development/0014-sdk-ui-previews.md).

## Account quotas

Home shows only providers with native quota data. Each quota window has a usage history chart, current used and remaining percentages, and its reset date. Quotas refresh automatically every minute while Home is open, independently from project data. Refreshes never overlap and recover automatically from failed reads. There is no manual refresh control or chart legend. When multiple harnesses have quotas, a dropdown selects which harness to display; one harness needs no selector. `pst pstdio-home quotas` returns the same reports with saved history. Home calls the four known harness extensions' `quotas` commands through the public command API. Missing commands, unsupported providers, and unavailable snapshots have no graph and never become a zero or full allowance. The whole widget stays hidden when no quota is available.

Home records the latest observation each hour in its project-scoped extension storage and retains eight days. An hourly extension schedule samples even when Home is closed, while the host is running. Opening Home and automatic refreshes also record observations. Reset timestamps separate periods. Native window durations define period bounds: charts show a solid usage line, a solid yellow forecast from average usage since the period began, and a solid 100% quota limit. A lone reading connects from zero at the period start (or the chart start when the period is unknown); that visual zero is never stored as a measured observation. The forecast is an estimate, not an additional provider quota. Unknown or expired periods have no forecast.

Quotas describe the runtime's sign-in and may include usage outside this project. Each project records its own history. The graph Canvas is `src/components/quota-graph.canvas.tsx`, frame **Automatic quota history**, with single/multiple harnesses, first-point, loading, empty, and error controls.

*Updated at: 2026-11-10*
