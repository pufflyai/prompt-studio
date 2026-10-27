// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./workbench-story-B6F8bQqu.ts";
import { Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/empty-panel.stories.tsx
var c = (e = !1) => {
	let t = r({ initialSidePanelMode: "attached" });
	t.modes.registerMode({
		id: "tools",
		activate() {}
	});
	for (let [e, n] of [
		["terminal", "Terminal"],
		["session", "Session"],
		["inspector", "Inspector"]
	]) t.views.registerView({
		id: e,
		title: n,
		icon: e === "terminal" ? "Terminal" : void 0,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ s(a, {
				p: "md",
				children: [n, " content"]
			})
		}
	}), t.modePlacements.registerPlacement({
		id: e,
		ref: {
			kind: "placement",
			extensionId: "example",
			id: e
		},
		modeId: "tools",
		region: "side",
		...e === "inspector" ? { movableTo: ["side"] } : {},
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: e
			},
			presence: "closed"
		}
	});
	let n = {
		kind: "page",
		extensionId: "example",
		id: "tools"
	};
	if (e) for (let [e, n] of [["changes", "Changes"], ["new-page", "New page"]]) t.views.registerView({
		id: e,
		title: n,
		icon: "FilePlus",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ s(a, {
				p: "md",
				children: [n, " content"]
			})
		}
	});
	return t.pages.registerPage({
		id: "tools",
		ref: n,
		title: "Tools",
		path: "tools",
		modeId: "tools",
		main: { kind: "panels" },
		slots: e ? ["changes", "new-page"].map((e) => ({
			id: e,
			region: "main",
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: e
				},
				presence: "closed"
			}
		})) : []
	}), t.pageLocations.setProject("storybook-empty-panels"), t.pageLocations.navigate({
		kind: "page",
		page: n
	}), t.shell.setSidePanelPresentation("attached"), t.shell.setRegionOpen("secondary", !0), t;
}, l = {
	title: "pstdio-workbench/Reference/Core API/Empty panel",
	component: i,
	parameters: { layout: "fullscreen" }
}, u = { args: { workbench: c() } }, d = { args: { workbench: c() } }, f = { args: { workbench: c(!0) } }, p = { args: { workbench: (() => {
	let e = c(!0);
	return e.shell.setRegionOpen("side", !1), e.shell.setRegionOpen("secondary", !1), e;
})() } }, m = async (r, i) => {
	let a = t(r.querySelector(`[data-workbench-panel="${i}"]`)), o = t(await a.findByRole("group", { name: "Available tabs" }));
	await e.click(o.getByRole("button", { name: "Terminal" })), await n(await a.findByText("Terminal content")).toBeVisible(), await n(a.getByRole("tab", { name: "Terminal" })).toBeVisible();
}, h = {
	args: { workbench: c() },
	play: async ({ canvasElement: e }) => m(e, "main")
}, g = {
	args: { workbench: c() },
	play: async ({ canvasElement: e }) => m(e, "side")
}, _ = {
	args: { workbench: c() },
	play: async ({ canvasElement: e }) => m(e, "secondary")
}, v = { args: { workbench: (() => {
	let e = c();
	e.views.registerView({
		id: "custom-placeholder",
		title: "Custom placeholder",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ o(a, {
				p: "md",
				children: "Custom panel content"
			})
		}
	});
	for (let t of ["main", "side"]) e.placeholders.registerPlaceholder({
		id: `custom-${t}`,
		viewId: "custom-placeholder",
		region: t
	});
	return e;
})() } }, y = {
	args: { workbench: (() => {
		let e = c();
		return e.pageLocations.clearProject(), e.modes.setActiveMode(void 0), e.shellPlacements.registerPlacement({
			id: "loading-terminal",
			region: "main",
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: "terminal"
				},
				presence: "closed"
			}
		}), e;
	})() },
	play: async ({ canvasElement: e }) => {
		await n(t(e).queryByRole("group", { name: "Available tabs" })).toBeNull();
	}
}, b = {
	tags: ["panel-placeholder-policy"],
	args: { workbench: (() => {
		let e = c();
		return e.modes.registerMode({
			id: "selection",
			panels: [],
			regionSettings: { main: {
				acceptsTabs: !1,
				showHeader: !1
			} },
			activate() {}
		}), e.pageLocations.clearProject(), e.modes.setActiveMode("selection"), e;
	})() },
	play: async ({ canvasElement: e }) => {
		let r = t(e.querySelector("[data-workbench-panel=\"main\"]"));
		await n(r.queryByRole("group", { name: "Available tabs" })).toBeNull(), await n(r.queryByText("No tabs available")).toBeNull();
	}
};
export { u as AvailableTabs, v as CustomPlaceholders, d as NarrowPanel, _ as OpenInBottom, h as OpenInMain, g as OpenInSide, f as PageEntries, y as SelectingMode, b as TabsDisabled, p as TopAlignedCards, l as default };
