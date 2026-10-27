// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { s as e, t } from "./test-CYwQ_LKY.ts";
import { m as n, t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./workbench-story-BezxAS71.ts";
import { Box as a, Text as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/panel-header-visibility.stories.tsx
var l = (e = {}) => {
	let t = {
		kind: "page",
		extensionId: "storybook",
		id: "panel-header"
	}, i = r({ startPage: t });
	i.modes.registerMode({
		id: "panel-header",
		label: "Panel header",
		activate: () => void 0,
		regionSettings: { main: {
			showHeader: !!(e.changes || e.collapsed || e.action),
			alwaysShowTabs: !!(e.changes || e.collapsed)
		} }
	});
	for (let [e, t] of [
		["files", "Files"],
		["changes", "Changes"],
		["file-tree", "File tree"]
	]) i.views.registerView({
		id: e,
		title: t,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ s(a, {
				p: "md",
				children: /* @__PURE__ */ c(o, { children: [t, " content"] })
			})
		}
	});
	if (i.viewMenus.registerViewMenu({
		id: "file-tree",
		ownerViewId: "files",
		viewId: "file-tree",
		side: "left"
	}), i.pages.registerPage({
		id: t.id,
		ref: t,
		title: "Panel header",
		path: "panel-header",
		modeId: "panel-header",
		resource: { kinds: [{
			kind: "resource-kind",
			id: "workspace"
		}] },
		main: {
			kind: "panels",
			empty: {
				kind: "view",
				id: "files"
			}
		},
		slots: [{
			id: "files",
			region: "main",
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: "files"
				},
				presence: "fixed"
			}
		}, {
			id: "changes",
			region: "main",
			isAvailable: () => e.changes === !0,
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: "changes"
				},
				presence: "fixed"
			}
		}]
	}), e.action && (i.commands.registerCommand({
		id: "refresh",
		label: "Refresh files"
	}, { execute: () => void 0 }), i.layout.registerMenuItem(n("main"), {
		commandId: "refresh",
		group: "primary",
		...e.panelResource ? { when: "workbench.resource.type == \"file\"" } : {}
	})), i.pageLocations.switchProject("storybook-panel-header"), i.pageLocations.navigate({
		kind: "page",
		page: t,
		resource: {
			type: "workspace",
			id: "workspace-1"
		}
	}), e.panelResource) {
		let e = i.layout.listPanelInstances("main")[0];
		e && i.layout.updatePanel(e.instanceId, { resource: {
			type: "file",
			id: "notes.md"
		} });
	}
	if (e.collapsed) {
		let e = i.layout.listPanelInstances("main-left-menu")[0];
		e && i.panelMenuState.setOpen(`panel-menu:${e.instanceId}`, !1);
	}
	return i;
}, u = {
	title: "pstdio-workbench/Reference/Core API/Panel header visibility",
	component: i,
	parameters: { layout: "fullscreen" }
}, d = {
	args: { workbench: l() },
	play: async ({ canvasElement: n }) => {
		let r = e(n);
		await t(await r.findByText("Files content")).toBeVisible(), await t(r.getByText("File tree content")).toBeVisible(), await t(r.queryAllByRole("tab")).toHaveLength(0), await t(n.querySelector("[data-workbench-panel-header=\"main\"]")).not.toBeVisible();
	}
}, f = {
	args: { workbench: l({ changes: !0 }) },
	play: async ({ canvasElement: n }) => {
		let r = e(n);
		await t(await r.findByRole("tab", { name: "Files" })).toBeVisible(), await t(r.getByRole("tab", { name: "Changes" })).toBeVisible();
	}
}, p = {
	args: { workbench: l({ collapsed: !0 }) },
	play: async ({ canvasElement: n }) => {
		let r = e(n);
		await t(await r.findByRole("button", { name: "Open Main left menu" })).toBeVisible(), await t(r.getByRole("tab", { name: "Files" })).toBeVisible(), await t(r.getByRole("button", { name: "Close Files" })).toBeVisible();
	}
}, m = {
	args: { workbench: l({ action: !0 }) },
	play: async ({ canvasElement: n }) => {
		let r = e(n);
		await t(await r.findByRole("button", { name: "Refresh files" })).toBeVisible(), await t(r.getByRole("tab", { name: "Files" })).toBeVisible();
	}
}, h = {
	...m,
	args: { workbench: l({
		action: !0,
		panelResource: !0
	}) }
}, g = { args: { workbench: (() => {
	let e = {
		kind: "page",
		extensionId: "storybook",
		id: "start"
	}, t = r({ startPage: e });
	return t.modes.registerMode({
		id: "start",
		label: "Start",
		activate: () => void 0,
		regionSettings: { main: { showHeader: !1 } }
	}), t.views.registerView({
		id: "start",
		title: "Start",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ s(o, {
				p: "md",
				children: "Start page content"
			})
		}
	}), t.pages.registerPage({
		id: e.id,
		ref: e,
		title: "Start",
		path: "",
		modeId: "start",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "start"
			},
			cardinality: "one"
		},
		slots: []
	}), t.pageLocations.switchProject("storybook-start-header"), t.pageLocations.navigate({
		kind: "page",
		page: e
	}), t;
})() } };
export { p as CollapsedMenuWithTab, h as HeaderActionForPanelResource, m as HeaderActionWithoutTabs, f as MultipleAvailableFixedPanels, d as SingleAvailableFixedPanel, g as SinglePageHeader, u as default };
