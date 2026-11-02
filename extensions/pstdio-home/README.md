# Home

The default project home page is provided by `pstdio.pstdio-home`. It shows the project name, the five most recently updated conversations, existing work actions, setup recovery and agent availability. It reads project data through the public SDK without storing a second copy.

The shell owns project-root URLs, saved destinations, tool search and the fallback when this extension is disabled. Home contributes an ordinary `home` page marked `projectLanding: true` and a Go → H action. Disabling Home does not change sessions or workspaces.

The Canvas baseline is `src/components/home.canvas.tsx`: `Default`, `NoAgentAvailable`, `SetupDidNotFinish`, and `NoRecentResources`.

Development currently uses the local SDK and a published UI preview. Before delivery, replace the workspace SDK dependency with the supporting published preview and generate the extension lockfile. The SDK/host prerequisite is [PR #1687](https://github.com/pufflyai/prompt-studio/pull/1687). See the [preview release workflow](../../documentation/guides/development/0014-sdk-ui-previews.md).
