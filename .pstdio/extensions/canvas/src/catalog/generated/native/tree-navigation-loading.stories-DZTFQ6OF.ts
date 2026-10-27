// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./navigation-level-composition-CFeKYFum.ts";
import { t as o } from "./workbench-story-BezxAS71.ts";
import { useState as s } from "react";
import { Button as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-navigation-loading.stories.tsx
var p = (e, t) => {
	let n = i(), r = a(n), o = Promise.withResolvers(), s = [], p = async (e) => (e === "second" && !t && await o.promise, [{
		id: "navigation",
		nodes: [{
			id: "destination",
			label: `${e} page action`
		}]
	}]), m = (e) => n.pageLocations.navigate({
		kind: "page",
		page: {
			kind: "page",
			id: e,
			extensionId: "storybook"
		}
	});
	n.views.registerView({
		id: "navigation-tree",
		title: "Navigation",
		body: {
			kind: "tree",
			getChildren: () => [],
			...t ? { getReadKey: () => r.getReadKey() } : {},
			getBody: async (i) => {
				if (t) return r.getSections("content", i.signal, i.onProgress);
				let a = n.pages.store.getState().activePageId;
				return e ? n.navigationTrees.getSections({
					kind: "page",
					id: a,
					extensionId: "storybook"
				}) : p(a);
			}
		}
	}), n.views.registerView({
		id: "navigation-guide",
		title: "Navigation loading",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ f(l, {
				gap: "md",
				p: "md",
				children: [
					/* @__PURE__ */ d(u, { children: "Switch pages while the next navigation query is held. The previous page's action must disappear." }),
					/* @__PURE__ */ d(c, {
						onClick: () => m("second"),
						children: "Switch page"
					}),
					/* @__PURE__ */ d(c, {
						onClick: () => o.resolve(),
						children: "Finish loading"
					}),
					e && /* @__PURE__ */ d(c, {
						onClick: () => {
							for (let e of s) e.dispose();
						},
						children: "Remove page navigation"
					})
				]
			})
		}
	});
	for (let t of ["first", "second"]) n.modes.registerMode({
		id: t,
		label: t,
		activate: () => void 0
	}), n.pages.registerPage({
		id: t,
		ref: {
			kind: "page",
			id: t,
			extensionId: "storybook"
		},
		title: t,
		path: t,
		modeId: e ? "first" : t,
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "navigation-guide"
			},
			cardinality: "one"
		},
		slots: []
	});
	if (e) for (let e of ["first", "second"]) s.push(n.navigationTrees.registerContribution({
		id: e,
		owner: {
			kind: "page",
			id: e,
			extensionId: "storybook"
		},
		sourceExtensionId: "storybook",
		declarationIndex: 0,
		getSections: () => p(e)
	}));
	return t && n.navigationTrees.registerContribution({
		id: "project-files",
		owner: {
			kind: "mode",
			id: "first",
			extensionId: "pstdio"
		},
		sourceExtensionId: "pstdio",
		declarationIndex: 0,
		getSections: async () => (n.pages.store.getState().activePageId === "second" && await o.promise, [])
	}), n.pages.store.subscribe(() => n.views.refreshView("navigation-tree")), n.shellPlacements.registerPlacement({
		id: "navigation-tree",
		region: "sidenav",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: "navigation-tree"
			}
		}
	}), n.pageLocations.setProject("storybook"), m("first"), n;
}, m = {
	title: "pstdio-workbench/Guides/Tree navigation loading",
	component: (e) => {
		let { pageOwned: t, composed: n = !1 } = e, [r] = s(() => p(t, n));
		return /* @__PURE__ */ d(o, { workbench: r });
	},
	args: { pageOwned: !1 },
	parameters: { layout: "fullscreen" }
}, h = { play: async ({ canvasElement: i }) => {
	let a = n(i);
	await r(await a.findByRole("option", { name: "first page action" })).toBeVisible(), await e.click(a.getByRole("button", { name: "Switch page" })), await t(() => r(a.queryByRole("option", { name: "first page action" })).not.toBeInTheDocument()), await e.click(await a.findByRole("button", { name: "Finish loading" })), await r(await a.findByRole("option", { name: "second page action" })).toBeVisible();
} }, g = {
	args: { pageOwned: !0 },
	play: h.play
}, _ = {
	args: {
		pageOwned: !0,
		composed: !0
	},
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await r(await i.findByRole("option", { name: "first page action" })).toBeVisible(), await e.click(i.getByRole("button", { name: "Switch page" })), await r(await i.findByRole("option", { name: "second page action" })).toBeVisible(), await r(i.queryByRole("option", { name: "first page action" })).not.toBeInTheDocument(), await e.click(i.getByRole("button", { name: "Finish loading" }));
	}
}, v = {
	args: { pageOwned: !0 },
	play: async ({ canvasElement: i }) => {
		let a = n(i);
		await r(await a.findByRole("option", { name: "first page action" })).toBeVisible(), await e.click(a.getByRole("button", { name: "Remove page navigation" })), await t(() => r(a.queryByRole("option", { name: "first page action" })).not.toBeInTheDocument());
	}
};
export { v as OwnerRemoval, h as PageChange, g as PageOwnedActions, _ as SlowProjectNavigation, m as default };
