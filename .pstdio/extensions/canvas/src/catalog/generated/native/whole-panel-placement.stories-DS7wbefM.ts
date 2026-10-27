// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { n as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./workbench-story-B6F8bQqu.ts";
import { createArrangementWorkbench as o } from "./panel-arrangement.stories-CRXVk_fc.ts";
import { useState as s } from "react";
import { IconButton as c, Text as l } from "@chakra-ui/react";
import { jsx as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/whole-panel-placement.stories.tsx
var d = (e = !1) => {
	let t = o();
	t.shell.setHeaderVisible("main", !0);
	for (let n of ["sidenav", "activity"]) i(t).registerRenderer({
		id: n,
		render: () => n === "activity" ? /* @__PURE__ */ u(c, {
			"aria-label": "Action",
			size: "sm",
			variant: "ghost",
			children: /* @__PURE__ */ u(l, { children: "A" })
		}) : e ? /* @__PURE__ */ u("iframe", {
			title: "Navigation view",
			srcDoc: "<h1>Navigation</h1>",
			width: "100%",
			height: "100%"
		}) : /* @__PURE__ */ u(l, {
			p: "md",
			children: "Navigation content"
		})
	}), t.layout.registerPanel({
		id: n,
		title: n,
		rendererId: n,
		region: n
	}), t.layout.openPanel(n, { pinned: !0 });
	return t;
}, f = {
	title: "pstdio-workbench/Reference/Core API/Whole panel placement",
	component: (e) => {
		let [t] = s(() => {
			let t = d(e.embeddedNavigation);
			return e.reversed && (t.shell.repositionPanel("side", "left"), t.shell.repositionPanel("secondary", "top"), t.shell.repositionPanel("sidenav", "right"), t.shell.repositionPanel("activity", "bottom")), e.restricted && (t.modes.getMode("arrangement").regionSettings = {
				main: { movable: !1 },
				secondary: { movable: !1 },
				side: { movable: !1 },
				sidenav: { movable: !1 },
				activity: { movable: !1 }
			}), t;
		});
		return /* @__PURE__ */ u(a, {
			workbench: t,
			initialThemePreference: e.dark ? "pstdio-dark" : "pstdio-light"
		});
	},
	parameters: { layout: "fullscreen" }
}, p = {}, m = { args: { dark: !0 } }, h = { args: { reversed: !0 } }, g = { args: { embeddedNavigation: !0 } }, _ = { args: { restricted: !0 } }, v = (e, t, n) => {
	let i = n === "left" || n === "right", a = i ? "x" : "y", o = n === "left" || n === "top" ? -1 : 1, s = e.querySelector(t === "main" ? "[data-workbench-panel=\"main\"]" : `[data-workbench-panel-drag="${t}"]`), c = e.querySelector(`[data-workbench-panel="${t === "main" ? "secondary" : "main"}"]`), l = s.getBoundingClientRect();
	t === "activity" && r(l.height > l.width).toBe(i), r(o * (l[a] - c.getBoundingClientRect()[a])).toBeGreaterThan(0);
}, y = async (i, a = !1) => {
	let o = n(i.ownerDocument.body);
	for (let [n, s, c] of [
		[
			"side",
			"right",
			"left"
		],
		[
			"secondary",
			"bottom",
			"top"
		],
		[
			"main",
			"top",
			"bottom"
		],
		[
			"sidenav",
			"left",
			"right"
		],
		[
			"activity",
			"left",
			"bottom"
		]
	]) {
		let l = a ? c : s, u = a ? s : c, d = n === "activity" ? "action bar" : "panel";
		for (let [a, s] of [[l, u], [u, l]]) i.querySelector(`[data-workbench-panel-drag="${n}"]`).focus(), await e.keyboard("{Shift>}{F10}{/Shift}"), await r(o.queryByRole("menuitem", { name: `Move ${d} to ${a}` })).toBeNull(), await r(o.getAllByRole("menuitem", { name: /^Move (panel|action bar) to / })).toHaveLength(n === "activity" ? 3 : 1), await e.click(o.getByRole("menuitem", { name: `Move ${d} to ${s}` })), await t(() => v(i, n, s)), await e.keyboard("{Escape}");
	}
}, b = { play: async ({ canvasElement: e }) => y(e) }, x = {
	args: { reversed: !0 },
	play: async ({ canvasElement: e }) => y(e, !0)
};
export { m as Dark, g as EmbeddedNavigation, p as Interactive, b as MoveActions, _ as Restricted, h as Reversed, x as ReversedMoveActions, f as default };
