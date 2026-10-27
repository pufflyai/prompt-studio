// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./workbench-story-B6F8bQqu.ts";
import { Text as a } from "@chakra-ui/react";
import { jsx as o } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/header/workbench-nav-chrome.stories.tsx
var s = () => {
	let e = {
		kind: "page",
		extensionId: "storybook",
		id: "panel-controls"
	}, t = r({
		startPage: e,
		initialSidePanelMode: "attached"
	});
	t.modes.registerMode({
		id: "project",
		activate() {},
		chrome: { sidenav: "navigation" }
	});
	for (let [e, n] of [
		["navigation", "Project navigation"],
		["main", "Project overview"],
		["secondary", "Terminal"],
		["side", "Session"]
	]) t.views.registerView({
		id: e,
		title: n,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ o(a, {
				p: "md",
				children: n
			})
		}
	});
	t.pages.registerPage({
		id: "panel-controls",
		ref: e,
		path: "panel-controls",
		modeId: "project",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "main"
			},
			cardinality: "one"
		},
		slots: []
	});
	for (let e of ["secondary", "side"]) t.modePlacements.registerPlacement({
		id: e,
		ref: {
			kind: "placement",
			extensionId: "storybook",
			id: e
		},
		modeId: "project",
		region: e,
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: e
			},
			presence: "open"
		}
	});
	return t.pageLocations.switchProject("storybook"), t.pageLocations.navigate({
		kind: "page",
		page: e
	}), t;
}, c = async (r, i) => {
	let a = r.querySelector("[data-workbench-region=\"nav\"]"), o = t(a).getByRole("group", { name: "Panel controls" }), s = t(o).getAllByRole("button");
	await n(s.map((e) => e.getAttribute("aria-label"))).toEqual([
		`${i ? "Hide" : "Show"} Sidenav`,
		"Hide Bottom Panel",
		"Hide Side Panel"
	]), await n(o.getBoundingClientRect().left).toBeGreaterThan(a.getBoundingClientRect().left + a.clientWidth / 2), await e.click(s[0]), await n(t(o).getByRole("button", { name: `${i ? "Show" : "Hide"} Sidenav` })).toBeVisible(), await n(t(o).getAllByRole("button")).toHaveLength(3);
}, l = {
	title: "pstdio-workbench/Reference/Core API/Browser panel controls",
	component: i,
	parameters: { layout: "fullscreen" }
}, u = {
	args: { workbench: s() },
	play: async ({ canvasElement: e }) => c(e, !0)
}, d = {
	args: { workbench: (() => {
		let e = s();
		return e.shell.setRegionOpen("sidenav", !1), e;
	})() },
	play: async ({ canvasElement: e }) => c(e, !1)
};
export { d as SidenavClosed, u as SidenavOpen, l as default };
