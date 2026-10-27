// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./extension-detail-Dn6h0zBR.ts";
import { Stack as t, Text as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
import { SelectionInput as a } from "@pstdio/ui/param-editor";
// packages/pstdio-dashboard/src/modules/settings/components/extension-detail.stories.tsx
var o = {
	id: "planner-instance",
	projectId: "project-1",
	extensionId: "pstdio.planner",
	installedExtensionId: "installed-planner",
	installName: "pstdio-planner",
	name: "pstdio-planner",
	displayName: "Project Planner",
	version: "0.7.0",
	description: "Tickets, proposals and planning loops. Contributes the ticket board and planner views.",
	sourcePath: "/repo/.pstdio/extensions/pstdio-planner",
	scope: "repo",
	status: "loaded",
	lastLoadedAt: "2026-08-04T09:14:00.000Z",
	enabled: !0,
	config: {},
	canUpgrade: !1,
	updateAvailable: !1
}, s = [{
	id: "pstdio-planner.refine-tickets",
	localId: "refine-tickets",
	extensionId: "pstdio.planner",
	extensionInstanceId: "planner-instance",
	title: "Refine open tickets",
	cron: "0 6 * * *",
	commandId: "pstdio-planner.refine",
	enabled: !0
}, {
	id: "pstdio-planner.implement-tickets",
	localId: "implement-tickets",
	extensionId: "pstdio.planner",
	extensionInstanceId: "planner-instance",
	title: "Implement Todo tickets",
	cron: "0 7 * * *",
	commandId: "pstdio-planner.implement",
	enabled: !1
}], c = () => {}, l = {
	title: "ProjectSettings/ExtensionDetail",
	component: e,
	parameters: { layout: "fullscreen" },
	args: {
		extension: o,
		metadata: {
			extensions: [],
			commands: [{
				id: "planner.createTicket",
				extensionId: "pstdio.planner",
				title: "Create ticket",
				cliPath: "tickets create"
			}, {
				id: "planner.refineTicket",
				extensionId: "pstdio.planner",
				title: "Refine ticket"
			}],
			menuContributions: [{
				id: "planner.menu.create",
				extensionId: "pstdio.planner",
				commandId: "planner.createTicket",
				slotId: "workbench.top.actions",
				label: "Create ticket"
			}],
			commandPaletteContributions: [],
			keybindings: [{
				id: "planner.kb.create",
				extensionId: "pstdio.planner",
				commandId: "planner.createTicket",
				key: "mod+shift+t",
				hotkey: "mod+shift+t"
			}],
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
			diagnostics: []
		},
		automations: s,
		diagnostics: [],
		settings: [{
			key: "automation.enabled",
			extensionId: "pstdio.planner",
			type: "boolean",
			scope: "project",
			default: !1,
			title: "Enable automations",
			description: "Allow scheduled planner loops to run in this project.",
			value: !0,
			source: "stored"
		}, {
			key: "board.defaultView",
			extensionId: "pstdio.planner",
			type: "string",
			scope: "project",
			enum: ["board", "list"],
			default: "board",
			title: "Default view",
			source: "default"
		}],
		onBack: c,
		onToggle: c,
		onToggleAutomation: c,
		executeOptionCommand: async () => [],
		onChangeSetting: c,
		onReload: c,
		onUpgrade: c,
		onUninstall: c
	}
}, u = { args: {
	extension: {
		...o,
		displayName: "Remote helper",
		extensionId: "example.remote"
	},
	unavailableHarnesses: [{
		id: "arbitrary-remote-provider-id",
		name: "Remote helper",
		supportsModels: !1,
		capabilities: [],
		availability: {
			type: "NOT_FOUND",
			reason: "Connect a machine in this extension's settings."
		}
	}]
} }, d = {
	args: {
		...u.args,
		unavailableHarnesses: u.args.unavailableHarnesses.map((e) => ({
			...e,
			availability: {
				type: "NOT_FOUND",
				reason: `RemoteEndpoint/${"a".repeat(280)}`
			}
		}))
	},
	play: async ({ canvasElement: e }) => {
		e.querySelector("[data-testid=\"extension-health-trigger\"]")?.click();
	}
}, f = {}, p = { args: { settingsViews: /* @__PURE__ */ i(t, {
	gap: "md",
	padding: "lg",
	children: [/* @__PURE__ */ r(n, {
		textStyle: "heading/S/semibold",
		children: "Planner workflow"
	}), /* @__PURE__ */ r(a, {
		id: "completed",
		name: "Completed statuses",
		description: "Statuses used for dependency completion.",
		defaultValue: ["done"],
		multiSelect: !0,
		searchable: !0,
		fullWidth: !0,
		onChange: c,
		options: [{
			id: "building",
			name: "Building",
			icon: "status-progress",
			color: "blue"
		}, {
			id: "done",
			name: "Delivered",
			icon: "status-done",
			color: "green"
		}]
	})]
}) } }, m = { args: { extension: {
	...o,
	status: "error",
	lastError: {
		code: "extension_import_failed",
		message: "Cannot find module './features/loops/index.ts' — imported from extension.js."
	}
} } }, h = { args: { extension: {
	...o,
	enabled: !1,
	status: "disabled"
} } }, g = { args: { extension: {
	...o,
	enabled: !1,
	status: "disabled",
	sourcePath: "/Users/dev/work/second-checkout/.pstdio/extensions/pstdio-planner"
} } }, _ = { args: { extension: {
	...o,
	updateAvailable: !0
} } }, v = { args: { extension: {
	...o,
	canUpgrade: !0,
	scope: "global",
	sourcePath: "/home/user/.pstdio/extensions/pstdio-planner"
} } }, y = { args: { extension: {
	...o,
	canUpgrade: !0,
	scope: "global",
	sourcePath: "/home/user/.pstdio/extensions/pstdio-planner",
	status: "error",
	lastError: {
		code: "extension_import_failed",
		message: "Cannot find module './features/loops/index.ts' — imported from extension.js."
	}
} } }, b = { args: { extension: {
	...o,
	canUpgrade: !0,
	scope: "global",
	sourcePath: "/home/user/.pstdio/extensions/pstdio-planner",
	status: "error",
	lastError: {
		code: "extension_manifest_unsupported_api_version",
		message: "Extension \"pstdio-planner\" targets extension API ^0.0.9 but this host provides 0.1.0. Upgrade the extension to its build for this host."
	}
} } }, x = { args: { extension: {
	...o,
	displayName: "Font Editor",
	extensionId: "pstdio.font-editor",
	installName: "font-editor",
	name: "font-editor",
	sourcePath: "/repo/.pstdio/extensions/font-editor",
	status: "error",
	lastError: {
		code: "extension_manifest_unsupported_api_version",
		message: "Extension \"font-editor\" targets extension API ^0.0.9 but this host provides 0.1.0. Fix the extension source: make it work with extension API 0.1.0, then add \"^0.1.0\" to engines.pstdio in its package.json."
	}
} } };
export { g as ConflictingSourceFolder, p as CustomWorkflowSettings, h as Disabled, y as FailedCatalogExtension, m as FailedToLoad, u as HarnessUnavailable, b as IncompatibleApi, x as IncompatibleLocalSource, f as Loaded, _ as LocalChangesWaiting, d as LongHarnessReason, v as UpgradeAvailable, l as default };
