// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./project-setup-status-CO0VswgG.ts";
// packages/pstdio-dashboard/src/shared/projects/project-setup-status.stories.tsx
var t = {
	title: "Projects/Project setup status",
	component: e,
	args: {
		error: "default extensions: Failed to clone https://github.com/pufflyai/prompt-studio.git at pstdio@0.40.0: spawn git ENOENT",
		onRetry: () => {}
	}
}, n = {}, r = { args: { retrying: !0 } }, i = { args: { error: "EACCES: permission denied, mkdir '/Users/alex/tools/.pstdio'" } }, a = { args: { error: "The workspace provider has not finished setup. Retry to check its progress." } };
export { i as FolderNotWritable, n as MissingGit, a as ProviderPending, r as Retrying, t as default };
