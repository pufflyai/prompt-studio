// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./available-extension-detail-DeF7Ijll.ts";
// packages/pstdio-dashboard/src/modules/settings/components/available-extension-detail.stories.tsx
var t = () => void 0, n = {
	title: "ProjectSettings/AvailableExtensionDetail",
	component: e,
	parameters: { layout: "fullscreen" },
	args: {
		extension: {
			installName: "pstdio-reports",
			displayName: "Prompt Studio Reports",
			description: "Workspace reports for agent handoffs.",
			installed: !1,
			origin: {
				kind: "git",
				url: "https://github.com/pufflyai/prompt-studio",
				path: "extensions/pstdio-reports",
				ref: "pstdio@0.28.0"
			},
			publisher: "pstdio",
			registry: {
				url: "https://base.prompt.studio/psx",
				extensionId: "pstdio.pstdio-reports"
			}
		},
		metadata: {
			extensions: [{
				id: "pstdio.pstdio-reports",
				name: "pstdio-reports",
				displayName: "Prompt Studio Reports",
				sourcePath: ""
			}],
			commands: [{
				id: "pstdio-reports.write",
				extensionId: "pstdio.pstdio-reports",
				title: "Write report",
				cliPath: "reports write"
			}],
			menuContributions: [],
			commandPaletteContributions: [],
			modes: [],
			pages: [],
			views: [],
			viewMenus: [],
			placements: [],
			resourceKinds: [],
			navigationItems: [],
			navigationTrees: [],
			statusBarItems: [],
			settingsPanels: [],
			skills: [{
				id: "pstdio-reports.use-reports",
				localId: "use-reports",
				extensionId: "pstdio.pstdio-reports",
				title: "Use reports"
			}],
			templates: [{
				id: "pstdio-reports.change-request",
				localId: "change-request",
				extensionId: "pstdio.pstdio-reports",
				title: "Change request"
			}],
			templateTypes: [{
				id: "pstdio.pstdio-reports.template-type.report",
				localId: "report",
				extensionId: "pstdio.pstdio-reports",
				label: "Report",
				order: 40,
				commands: {
					list: "pstdio.pstdio-reports.command.templates.list",
					read: "pstdio.pstdio-reports.command.templates.read",
					save: "pstdio.pstdio-reports.command.templates.save",
					delete: "pstdio.pstdio-reports.command.templates.delete"
				}
			}],
			diagnostics: []
		},
		loadingContributions: !1,
		installing: !1,
		onBack: t,
		onInstall: t
	}
}, r = {}, i = { args: { extension: {
	...n.args.extension,
	registry: void 0
} } }, a = { args: { installing: !0 } };
export { r as Contributions, a as Installing, i as RepositorySource, n as default };
