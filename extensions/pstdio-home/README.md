# Home

The default project home page is provided by `pstdio.pstdio-home`. It shows the project name, the five most recently opened resources, existing work actions and setup recovery. It reads project data through the public SDK without storing a second copy.

Home contributes an ordinary `home` page and webview with a Go → H action. Prompt Studio configures this page directly as its project default. The shell owns project-root URLs, saved destinations and tool search. If Home is disabled or uninstalled, the dashboard uses its existing empty-panel UI. Sessions and workspaces remain available.

Recent uses the host’s project-scoped navigation history through `workbenchCommands.recentResources`. Opening a resource promotes it; edits alone do not. The host retains destinations in local project preferences and uses live built-in resource metadata and the last-seen presentation refreshed by extension views. Sessions use the shared status indicator; other resources use their own icons. Home appears first in the default navigation header; saved navigation customization takes precedence.

The Canvas baseline is `src/components/home.canvas.tsx`: `Default`, `SetupDidNotFinish`, and `NoRecentResources`.

Development currently uses the local SDK and a published UI preview. Before delivery, replace the workspace SDK dependency with the supporting published preview and generate the extension lockfile. The SDK/host prerequisite is [PR #1687](https://github.com/pufflyai/prompt-studio/pull/1687). See the [preview release workflow](../../documentation/guides/development/0014-sdk-ui-previews.md).
