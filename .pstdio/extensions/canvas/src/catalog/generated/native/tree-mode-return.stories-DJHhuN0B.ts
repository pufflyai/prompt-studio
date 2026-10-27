// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./navigation-level-composition-CFeKYFum.ts";
import { t as a } from "./workbench-story-BezxAS71.ts";
import { useState as o } from "react";
import { Text as s } from "@chakra-ui/react";
import { jsx as c } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-mode-return.stories.tsx
var l = (e, t) => {
	let n = r(), a = i(n), o = (e) => ({
		kind: "page",
		extensionId: "story",
		id: e
	});
	n.modes.registerMode({
		id: "project",
		label: e,
		activate() {}
	});
	for (let e of ["home", "details"]) n.views.registerView({
		id: e,
		title: e,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ c(s, {
				p: "md",
				children: e
			})
		}
	}), n.pages.registerPage({
		id: e,
		ref: o(e),
		title: e,
		path: e,
		modeId: "project",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: e
			},
			cardinality: "one"
		},
		slots: []
	});
	return n.navigationTrees.registerContribution({
		id: "header",
		owner: {
			kind: "mode",
			extensionId: "pstdio",
			id: "project"
		},
		sourceExtensionId: "pstdio",
		declarationIndex: 0,
		slot: "header",
		getSections: () => [{
			id: "header",
			nodes: t ? [{
				id: "search",
				label: "Search",
				icon: "Search"
			}, {
				id: "pinned",
				label: "Pinned note",
				icon: "FileText"
			}] : []
		}]
	}), n.navigationTrees.registerContribution({
		id: "details",
		owner: {
			kind: "page",
			extensionId: "story",
			id: "details"
		},
		sourceExtensionId: "story",
		declarationIndex: 0,
		getSections: () => [{
			id: "files",
			nodes: Array.from({ length: 60 }, (e, t) => ({
				id: `file-${t}`,
				label: `File ${t + 1}`,
				icon: "FileText"
			}))
		}]
	}), n.views.registerView({
		id: "navigation",
		title: "Navigation",
		body: {
			kind: "tree",
			getReadKey: () => a.getReadKey(),
			getHeader: (e) => a.getSections("header", e.signal, e.onProgress),
			getBody: (e) => a.getSections("content", e.signal, e.onProgress),
			getChildren: () => [],
			defaultExpandedSectionIds: ["files"]
		}
	}), n.pages.store.subscribeSelector((e) => e.location, () => n.views.refreshView("navigation")), n.shellPlacements.registerPlacement({
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
	}), n.pageLocations.setProject("story"), n.pageLocations.navigate({
		kind: "page",
		page: o("home")
	}), n.pageLocations.navigate({
		kind: "page",
		page: o("details")
	}), n;
}, u = {
	title: "pstdio-workbench/Guides/Fixed mode return",
	component: (e) => {
		let { modeLabel: t, showHeader: n } = e, [r] = o(() => l(t, n));
		return /* @__PURE__ */ c(a, { workbench: r });
	},
	parameters: { layout: "fullscreen" },
	args: {
		modeLabel: "Project",
		showHeader: !0
	}
}, d = { play: async ({ canvasElement: r, args: i }) => {
	let a = t(r), o = await a.findByRole("button", { name: `Back to ${i.modeLabel.toLocaleLowerCase()}` });
	if (await n(o).toBeVisible(), await n(o.closest("[draggable=\"true\"]")).toBeNull(), i.showHeader) {
		let e = await a.findByRole("option", { name: "Pinned note" });
		await n(o.getBoundingClientRect().top).toBeGreaterThanOrEqual(e.getBoundingClientRect().bottom);
	}
	let s = o.closest("[data-scope=\"scroll-area\"][data-part=\"viewport\"]");
	await n(s).not.toBeNull();
	let c = await a.findByRole("option", { name: "File 1" }), l = await a.findByRole("option", { name: "File 2" }), u = o.getBoundingClientRect();
	await n(c.closest("[data-scope=\"scroll-area\"][data-part=\"viewport\"]")).toBe(s);
	let d = c.getBoundingClientRect(), f = l.getBoundingClientRect();
	await n(u.x).toBe(d.x), await n(u.width).toBe(d.width), await n(u.height).toBe(d.height), await n(d.top - u.bottom).toBe(f.top - d.bottom), await e.click(o), await n(await t(a.getByRole("main")).findByText("home", { exact: !0 })).toBeVisible(), await n(a.queryByRole("button", { name: `Back to ${i.modeLabel.toLocaleLowerCase()}` })).toBeNull();
} }, f = {
	args: { modeLabel: "Workspace" },
	play: d.play
}, p = {
	args: { showHeader: !1 },
	play: d.play
};
export { d as Project, f as RenamedMode, p as WithoutHeaderItems, u as default };
