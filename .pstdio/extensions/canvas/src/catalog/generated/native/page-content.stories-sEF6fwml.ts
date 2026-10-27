// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./workbench-story-B6F8bQqu.ts";
import { Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/page-content.stories.tsx
var c = (e, t = !0, n = "tabs") => {
	let i = r();
	i.modes.registerMode({
		id: "page",
		activate() {},
		regionSettings: { main: { showHeader: !1 } }
	});
	for (let [e, t] of [["editor", "Document"], ["empty", "Choose a document"]]) i.views.registerView({
		id: e,
		title: t,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ s(a, {
				p: "md",
				children: [t, " content"]
			})
		}
	});
	let o = {
		kind: "page",
		extensionId: "example",
		id: "document"
	};
	i.pages.registerPage({
		id: "document",
		ref: o,
		title: "Document",
		path: "document",
		modeId: "page",
		regionSettings: { main: { showHeader: t } },
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "editor"
			},
			cardinality: "one",
			presentation: n,
			...e === "custom" ? { empty: {
				kind: "view",
				id: "empty"
			} } : {}
		},
		slots: []
	}), i.pageLocations.setProject("storybook-page-content"), i.pageLocations.navigate({
		kind: "page",
		page: o
	});
	let c = i.layout.getActivePanel("main");
	return e === "moved" ? i.movePanel(c.instanceId, "side") : e && i.closePlacement(c.placementIdentity), i;
}, l = {
	title: "pstdio-workbench/Reference/Core API/Page content",
	component: i,
	parameters: { layout: "fullscreen" }
}, u = { args: { workbench: c() } }, d = {
	tags: ["page-header-policy"],
	args: { workbench: c(void 0, !0, "page") },
	play: async ({ canvasElement: e, args: r }) => {
		let i = t(e);
		await n(await i.findByText("Document content")).toBeVisible(), await n(i.queryByLabelText("Main panel header")).not.toBeInTheDocument(), await n(i.queryByRole("tab")).not.toBeInTheDocument(), await n(i.queryByRole("button", { name: "Add panel" })).not.toBeInTheDocument(), n(r.workbench.layout.getLayout().regions.main.widgets).toEqual([]), n(r.workbench.pages.getContent()?.viewId).toBe("editor");
		let s = i.getByText("Document content");
		r.workbench.views.registerView({
			id: "other",
			title: "Other",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ o(a, {
					p: "md",
					children: "Other content"
				})
			}
		});
		let c = {
			kind: "page",
			extensionId: "example",
			id: "other"
		};
		r.workbench.pages.registerPage({
			id: "other",
			ref: c,
			modeId: "page",
			path: "other",
			main: {
				kind: "view",
				view: {
					kind: "view",
					id: "other"
				},
				cardinality: "one",
				presentation: "page"
			},
			slots: []
		}), r.workbench.pageLocations.navigate({
			kind: "page",
			page: c
		}), await n(await i.findByText("Other content")).toBeVisible(), await n(s).not.toBeVisible(), r.workbench.pageLocations.navigate({
			kind: "page",
			page: {
				kind: "page",
				extensionId: "example",
				id: "document"
			}
		}), await n(await i.findByText("Document content")).toBeVisible(), n(i.getByText("Document content")).toBe(s);
	}
}, f = {
	tags: ["page-header-policy"],
	args: { workbench: c(void 0, !1) },
	play: async ({ canvasElement: e }) => {
		let r = t(e);
		await n(await r.findByLabelText("Main panel header")).toBeVisible(), await n(r.getByRole("tab", { name: "Document" })).toBeVisible();
	}
}, p = {
	args: { workbench: c("closed") },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await e.click(t(await i.findByRole("group", { name: "Available tabs" })).getByRole("button", { name: "Document" })), await n(i.getByRole("tab", { name: "Document" })).toBeVisible(), await n(i.getByText("Document content")).toBeVisible();
	}
}, m = {
	args: { workbench: c("moved") },
	play: async ({ canvasElement: r, args: i }) => {
		let a = t(r), o = i.workbench.layout.getActivePanel("side").instanceId;
		await e.click(t(await a.findByRole("group", { name: "Available tabs" })).getByRole("button", { name: "Document" })), n(i.workbench.layout.getActivePanel("main").instanceId).toBe(o), n(i.workbench.layout.listPanelInstances("side")).toEqual([]);
	}
}, h = { args: { workbench: c("custom") } }, g = { args: { workbench: (() => {
	let e = r(), t = {
		kind: "page",
		extensionId: "example",
		id: "collection"
	};
	return e.modes.registerMode({
		id: "page",
		activate() {}
	}), e.views.registerView({
		id: "empty-tree",
		title: "Filtered empty content",
		body: {
			kind: "tree",
			getBody: ({ pageParams: e }) => [{
				id: "filter",
				nodes: [{
					id: "result",
					label: String(e?.filter ?? "Missing filter")
				}]
			}],
			getChildren: () => []
		}
	}), e.pages.registerPage({
		id: t.id,
		ref: t,
		modeId: "page",
		path: "collection",
		params: { filter: {
			type: "string",
			default: "default-filter"
		} },
		main: {
			kind: "panels",
			empty: {
				kind: "view",
				id: "empty-tree"
			}
		},
		slots: []
	}), e.pageLocations.setProject("storybook-filtered-empty"), e.pageLocations.navigate({
		kind: "page",
		page: t,
		params: { filter: "route-filter" }
	}), e;
})() } }, _ = {
	args: { workbench: c("moved") },
	play: async ({ canvasElement: r, args: i }) => {
		let a = t(r), o = t(await a.findByRole("group", { name: "Available tabs" }));
		await n(o.getByRole("button", { name: "Document" })).toBeVisible(), i.workbench.closePlacement(i.workbench.layout.getActivePanel("side").placementIdentity), await e.click(o.getByRole("button", { name: "Document" })), await n(await a.findByText("Document content")).toBeVisible();
	}
};
export { _ as ClosedMovedContent, h as CustomEmptyView, g as FilteredEmptyView, m as MoveContentBack, f as PageHeaderDefault, p as ReopenContent, u as SinglePageTab, d as SingleViewPage, l as default };
