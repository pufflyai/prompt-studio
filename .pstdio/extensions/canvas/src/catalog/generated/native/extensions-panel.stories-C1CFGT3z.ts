// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./extensions-panel-view-DiTQ1SAJ.ts";
// packages/pstdio-dashboard/src/modules/settings/components/extensions-panel.stories.tsx
var t = [
	{
		id: "planner-instance",
		projectId: "project-1",
		extensionId: "pstdio.planner",
		installedExtensionId: "installed-planner",
		installName: "pstdio-planner",
		name: "pstdio-planner",
		displayName: "Project Planner",
		version: "0.4.2",
		description: "Plan and track tickets across workspaces.",
		sourcePath: "/repo/.pstdio/extensions/pstdio-planner",
		scope: "repo",
		status: "loaded",
		lastLoadedAt: "2026-08-04T09:14:00.000Z",
		enabled: !0,
		config: {},
		canUpgrade: !0,
		updateAvailable: !1
	},
	{
		id: "issue-tracker-instance",
		projectId: "project-1",
		extensionId: "acme.issue-tracker",
		installedExtensionId: "installed-issue-tracker",
		installName: "issue-tracker",
		name: "issue-tracker",
		displayName: "Acme Issue Tracker",
		version: "1.0.0",
		description: "Issue data and command surface.",
		sourcePath: "/home/user/.pstdio/extensions/issue-tracker",
		scope: "global",
		status: "error",
		lastLoadedAt: "2026-08-04T08:02:00.000Z",
		lastError: {
			code: "extension_import_failed",
			message: "Cannot find module './features/loops/index.ts' — imported from extension.js."
		},
		enabled: !0,
		config: {},
		canUpgrade: !1,
		updateAvailable: !1
	},
	{
		id: "lab-instance",
		projectId: "project-1",
		extensionId: "extension.lab",
		installedExtensionId: "installed-lab",
		installName: "extension-lab",
		name: "extension-lab",
		displayName: "Extension Lab",
		version: "0.1.0",
		description: "Demo and experimental commands.",
		sourcePath: "/home/user/.pstdio/extensions/extension-lab",
		scope: "global",
		status: "disabled",
		enabled: !1,
		config: {},
		canUpgrade: !0,
		updateAvailable: !1
	}
], n = [{
	id: "pstdio-planner.refine-tickets",
	localId: "refine-tickets",
	extensionId: "pstdio.planner",
	extensionInstanceId: "planner-instance",
	title: "Refine open tickets",
	cron: "0 6 * * *",
	commandId: "pstdio-planner.refine",
	enabled: !0
}, {
	id: "pstdio-planner.stuck-work-sweep",
	localId: "stuck-work-sweep",
	extensionId: "pstdio.planner",
	extensionInstanceId: "planner-instance",
	title: "Sweep stuck work",
	cron: "*/30 * * * *",
	commandId: "pstdio-planner.sweep",
	enabled: !1
}], r = [{
	code: "stale-template",
	severity: "warning",
	message: "Bundled template is older than the installed copy.",
	extensionId: "pstdio.planner",
	sourcePath: "templates/ticket.md"
}], i = [{
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
	publisher: "pufflyai"
}, {
	installName: "pstdio-planner",
	displayName: "Project Planner",
	description: "Tickets, managed attempts, reviews, and templates.",
	installed: !1,
	origin: {
		kind: "git",
		url: "https://github.com/pufflyai/prompt-studio",
		path: "extensions/pstdio-planner",
		ref: "pstdio@0.28.0"
	},
	publisher: "pufflyai"
}], a = () => {}, o = (e) => {
	e.querySelector("[data-testid=\"extension-health-trigger\"]")?.click();
}, s = t[1], c = {
	title: "ProjectSettings/ExtensionsPanel",
	component: e,
	parameters: { layout: "fullscreen" },
	args: {
		onUpgrade: a,
		onDropFolder: a
	}
}, l = { args: {
	extensions: t,
	marketplace: i,
	diagnostics: r,
	automations: n
} }, u = {
	...t[0],
	extensionId: "example.remote",
	displayName: "Remote helper",
	canUpgrade: !1
}, d = {
	id: "arbitrary-remote-provider-id",
	name: "Remote helper",
	supportsModels: !1,
	capabilities: [],
	availability: {
		type: "NOT_FOUND",
		reason: "Connect a machine in this extension's settings."
	}
}, f = { args: {
	extensions: [u],
	marketplace: [],
	diagnostics: [],
	automations: [],
	harnesses: [{
		id: d.id,
		localId: "helper",
		extensionId: u.extensionId
	}],
	agents: [d]
} }, p = { args: {
	...f.args,
	agents: void 0
} }, m = {
	args: {
		...f.args,
		diagnostics: [{
			...r[0],
			extensionId: u.extensionId
		}]
	},
	play: async ({ canvasElement: e }) => o(e)
}, h = {
	args: {
		...f.args,
		agents: [{
			...d,
			availability: {
				type: "NOT_FOUND",
				reason: `RemoteEndpoint/${"a".repeat(280)}`
			}
		}]
	},
	play: async ({ canvasElement: e }) => o(e)
}, g = { args: {
	...f.args,
	extensions: [{
		...u,
		enabled: !1,
		status: "disabled"
	}]
} }, _ = { args: {
	extensions: [],
	marketplace: i,
	diagnostics: [],
	automations: []
} }, v = { args: {
	extensions: t,
	marketplace: i,
	diagnostics: [],
	automations: n,
	togglingInstanceId: "planner-instance"
} }, y = { args: {
	extensions: t,
	marketplace: i,
	diagnostics: [],
	automations: n,
	installingMarketplaceNames: ["pstdio-reports", "pstdio-planner"]
} }, b = {
	args: {
		extensions: t,
		marketplace: i,
		diagnostics: r,
		automations: n
	},
	play: async ({ canvasElement: e }) => o(e)
}, x = {
	args: {
		extensions: [{
			...s,
			canUpgrade: !0
		}],
		marketplace: i,
		diagnostics: [],
		automations: []
	},
	play: async ({ canvasElement: e }) => o(e)
}, S = {
	args: {
		extensions: [{
			...s,
			scope: "repo",
			sourcePath: "/repo/.pstdio/extensions/issue-tracker",
			canUpgrade: !1
		}],
		marketplace: i,
		diagnostics: [],
		automations: []
	},
	play: async ({ canvasElement: e }) => o(e)
}, C = { args: {
	extensions: t,
	marketplace: i,
	diagnostics: [],
	automations: n,
	onUpgradeAll: a
} }, w = { args: {
	extensions: t,
	marketplace: i,
	diagnostics: [],
	automations: n,
	upgradingInstanceIds: ["planner-instance"]
} }, T = { args: {
	extensions: t,
	marketplace: i,
	diagnostics: [],
	automations: n,
	upgradingAll: !0,
	upgradingInstanceIds: t.filter((e) => e.canUpgrade).map((e) => e.id)
} }, E = { args: {
	extensions: t.map((e) => ({
		...e,
		canUpgrade: !1
	})),
	marketplace: i,
	diagnostics: [],
	automations: n
} }, D = { args: {
	extensions: t,
	marketplace: i,
	diagnostics: [],
	automations: n,
	addingFolderName: "my-extension"
} };
export { D as AddingLocalFolder, _ as Empty, x as FailedCatalogExtension, S as FailedLocalExtension, m as HarnessAndExtensionIssues, p as HarnessCheckUnknown, g as HarnessDisabled, f as HarnessUnavailable, b as HealthPopoverOpen, y as InstallingMultipleAvailableExtensions, h as LongHarnessReason, v as Mutating, E as NothingToUpgrade, l as Populated, C as UpgradesAvailable, T as UpgradingAll, w as UpgradingOneExtension, c as default };
