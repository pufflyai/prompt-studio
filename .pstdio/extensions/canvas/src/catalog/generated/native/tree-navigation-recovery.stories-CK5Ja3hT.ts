// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./workbench-story-B6F8bQqu.ts";
import { useState as o } from "react";
import { Button as s, Stack as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-navigation-recovery.stories.tsx
var d = (e) => {
	let t = i(), n = e, r = 0, a = (e) => {
		n = e, t.views.refreshView("navigation");
	};
	return t.views.registerView({
		id: "navigation",
		title: "Navigation",
		body: {
			kind: "tree",
			getChildren: () => [],
			getHeader: () => [{
				id: "header",
				nodes: [{
					id: "search",
					label: "Search"
				}]
			}],
			getFooter: () => [{
				id: "footer",
				nodes: [{
					id: "settings",
					label: "Settings"
				}]
			}],
			getBody: () => {
				if (r++, n) throw Error("Navigation refresh failed");
				return [{
					id: "tools",
					nodes: [{
						id: "notes",
						label: `Notes ${r}`
					}]
				}];
			}
		}
	}), t.views.registerView({
		id: "guide",
		title: "Navigation recovery",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(c, {
				p: "md",
				gap: "md",
				children: [/* @__PURE__ */ l(s, {
					onClick: () => a(!0),
					children: "Fail refresh"
				}), /* @__PURE__ */ l(s, {
					onClick: () => a(!1),
					children: "Restore navigation"
				})]
			})
		}
	}), t.modes.registerMode({
		id: "project",
		activate: () => void 0
	}), t.pages.registerPage({
		id: "guide",
		ref: {
			kind: "page",
			extensionId: "storybook",
			id: "guide"
		},
		modeId: "project",
		path: "",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "guide"
			},
			cardinality: "one"
		},
		slots: []
	}), t.shellPlacements.registerPlacement({
		id: "navigation",
		region: "sidenav",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: "navigation"
			}
		}
	}), t.pageLocations.setProject("storybook"), t.pageLocations.navigate({
		kind: "page",
		page: {
			kind: "page",
			extensionId: "storybook",
			id: "guide"
		}
	}), t;
}, f = {
	title: "pstdio-workbench/Guides/Navigation recovery",
	component: (e) => {
		let { initialFailure: t } = e, [n] = o(() => d(t));
		return /* @__PURE__ */ l(a, { workbench: n });
	},
	args: { initialFailure: !1 },
	parameters: { layout: "fullscreen" }
}, p = { play: async ({ canvasElement: i }) => {
	let a = n(i), o = await a.findByRole("option", { name: /^Notes / }), s = o.textContent;
	await e.click(a.getByRole("button", { name: "Fail refresh" })), await new Promise((e) => requestAnimationFrame(() => e())), await t(() => r(a.getByRole("region", { name: "Navigation" })).toHaveAttribute("aria-busy", "false")), await r(o).toBeVisible(), await r(a.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument(), await r(a.getByRole("option", { name: "Search" })).toBeVisible(), await r(a.getByRole("option", { name: "Settings" })).toBeVisible(), await e.click(a.getByRole("button", { name: "Restore navigation" })), await t(() => r(a.getByRole("option", { name: /^Notes / })).not.toHaveTextContent(s));
} }, m = {
	args: { initialFailure: !0 },
	play: async ({ canvasElement: i }) => {
		let a = n(i);
		await t(() => r(a.getByRole("region", { name: "Navigation" })).toHaveAttribute("aria-busy", "false")), await r(a.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument(), await e.click(a.getByRole("button", { name: "Restore navigation" })), await r(await a.findByRole("option", { name: /^Notes / })).toBeVisible(), await r(a.getByRole("option", { name: "Search" })).toBeVisible(), await r(a.getByRole("option", { name: "Settings" })).toBeVisible();
	}
};
export { p as FailedRefresh, m as InitialFailure, f as default };
