// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./workbench-story-BezxAS71.ts";
import { useState as o } from "react";
import { Button as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-resource-navigation.stories.tsx
var f = (e, t) => {
	let n = i(), r = Promise.withResolvers(), a = {
		kind: "page",
		id: "sessions",
		extensionId: "storybook"
	}, o = (e) => n.pageLocations.navigate({
		kind: "page",
		page: a,
		resource: {
			type: "session",
			id: e
		}
	}), f = async () => {
		let e = n.pages.store.getState().location?.resource?.id;
		return e === "second" && await r.promise, [{
			id: "sessions",
			nodes: [
				{
					id: "first",
					label: "First session"
				},
				{
					id: "second",
					label: "Second session"
				},
				{
					id: "current",
					label: `Loaded ${e}`
				}
			]
		}];
	};
	n.modes.registerMode({
		id: "sessions",
		activate: () => void 0
	}), n.views.registerView({
		id: "session-guide",
		title: "Session",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ d(c, {
				gap: "md",
				p: "md",
				children: [
					/* @__PURE__ */ u(l, { children: "Shared navigation stays mounted while the next session loads." }),
					/* @__PURE__ */ u(s, {
						onClick: () => o("second"),
						children: "Open second session"
					}),
					/* @__PURE__ */ u(s, {
						onClick: () => r.resolve(),
						children: "Finish loading"
					})
				]
			})
		}
	});
	let p = {
		kind: "page",
		id: "session-list",
		extensionId: "storybook"
	};
	n.pages.registerPage({
		id: p.id,
		ref: p,
		title: "Session list",
		path: "session-list",
		modeId: "sessions",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "session-guide"
			},
			cardinality: "one"
		},
		slots: []
	}), n.pages.registerPage({
		id: a.id,
		ref: a,
		title: "Sessions",
		path: "sessions",
		modeId: "sessions",
		parentId: p.id,
		resource: { kinds: [{
			kind: "resource-kind",
			id: "session"
		}] },
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "session-guide"
			},
			cardinality: "one"
		},
		slots: []
	});
	let m = {
		kind: e ? "page" : "mode",
		id: a.id,
		extensionId: "storybook"
	};
	return n.navigationTrees.registerContribution({
		id: "sessions",
		owner: m,
		sourceExtensionId: "storybook",
		declarationIndex: 0,
		...!e && !t ? { resolveResource: () => void 0 } : {},
		getSections: f
	}), n.views.registerView({
		id: "session-navigation",
		title: "Sessions navigation",
		body: {
			kind: "tree",
			getReadKey: () => n.navigationTrees.getReadKey(m, { resource: n.getPrimaryResource() }),
			getBody: () => n.navigationTrees.getSections(m, "content", { resource: n.getPrimaryResource() }),
			getChildren: () => []
		}
	}), n.shellPlacements.registerPlacement({
		id: "session-navigation",
		region: "sidenav",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: "session-navigation"
			}
		}
	}), n.pages.store.subscribe(() => n.views.refreshView("session-navigation")), n.pageLocations.setProject("storybook"), o("first"), n;
}, p = {
	title: "pstdio-workbench/Guides/Tree resource navigation",
	component: (e) => {
		let { pageOwned: t, resourceDependent: n } = e, [r] = o(() => f(t, n));
		return /* @__PURE__ */ u(a, { workbench: r });
	},
	args: {
		pageOwned: !1,
		resourceDependent: !1
	},
	parameters: { layout: "fullscreen" }
}, m = { play: async ({ canvasElement: t }) => {
	let i = n(t), a = await i.findByRole("option", { name: "First session" });
	await e.click(i.getByRole("button", { name: "Open second session" })), await r(a).toBeVisible(), await r(a).toBe(i.getByRole("option", { name: "First session" })), await e.click(i.getByRole("button", { name: "Finish loading" })), await r(await i.findByRole("option", { name: "Loaded second" })).toBeVisible(), await r(a).toBe(i.getByRole("option", { name: "First session" }));
} }, h = {
	args: { pageOwned: !0 },
	play: async ({ canvasElement: i }) => {
		let a = n(i), o = await a.findByRole("option", { name: "Loaded first" });
		await e.click(a.getByRole("button", { name: "Open second session" })), await r(o).toBeVisible(), await r(o).toBe(a.getByRole("option", { name: "Loaded first" })), await e.click(a.getByRole("button", { name: "Finish loading" })), await r(await a.findByRole("option", { name: "Loaded second" })).toBeVisible(), await t(() => r(a.queryByRole("option", { name: "Loaded first" })).not.toBeInTheDocument());
	}
}, g = {
	args: { resourceDependent: !0 },
	play: h.play
};
export { h as PageResourceActions, g as ResourceDependentMode, m as SharedNavigation, p as default };
