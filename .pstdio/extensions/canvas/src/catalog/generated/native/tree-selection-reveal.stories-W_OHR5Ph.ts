// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { n as r, t as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./use-workbench-store-BMaFgEbb.ts";
import { t as o } from "./use-tree-selection-BuV6mfak.ts";
import { t as s } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as c } from "react";
import { Button as l, Stack as u } from "@chakra-ui/react";
import { TreeList as d } from "@pstdio/ui";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-selection-reveal.stories.tsx
var m = () => {
	let [e] = c(() => {
		let e = i();
		return r(e).registerTreeRenderer({
			id: "notes",
			title: "Notes",
			getBody: () => [],
			getChildren: () => []
		}), e;
	}), [t, n] = c(!1), [s, m] = c(0), h = r(e), g = a(h.treeStore, (e) => e.statesByTreeId.notes), _ = [{
		id: "navigation",
		nodes: [{
			id: "notes",
			label: "Notes",
			children: [{
				id: "ideas",
				label: "Ideas",
				children: t ? [{
					id: "new-note",
					label: "New note"
				}] : []
			}]
		}]
	}], v = o(e, "notes", {
		sections: _,
		childrenByNodeId: {},
		activeNodeId: t ? "new-note" : void 0
	});
	return /* @__PURE__ */ p(u, {
		maxW: "20rem",
		children: [
			/* @__PURE__ */ f(l, {
				onClick: () => n(!0),
				children: "New note in Ideas"
			}),
			/* @__PURE__ */ f(l, {
				onClick: () => m((e) => e + 1),
				children: "Refresh"
			}),
			/* @__PURE__ */ f(d, {
				sections: _,
				expandedNodeIds: g?.expandedNodeIds,
				expandedSectionIds: g?.expandedSectionIds,
				activeNodeId: v,
				onToggleNode: (e) => h.setNodeExpanded("notes", e, !g?.expandedNodeIds.includes(e))
			})
		]
	}, s);
}, h = (e) => {
	let { resourceFree: t, aliases: n } = e, [s] = c(() => {
		let e = i();
		return r(e).registerTreeRenderer({
			id: "notes",
			title: "Notes",
			getBody: () => [],
			getChildren: () => []
		}), e;
	}), [m, h] = c(!0), [g, _] = c("first"), [v, y] = c("first"), b = r(s), x = a(b.treeStore, (e) => e.statesByTreeId.notes), S = {
		kind: "page",
		extensionId: "author.notes",
		id: "notes"
	}, C = (e) => ({
		type: "note",
		id: n ? "shared" : e,
		extensionId: "author.notes"
	}), w = [{
		id: "navigation",
		nodes: [{
			id: "notes",
			label: "Notes",
			collapsible: !0,
			target: {
				kind: "page",
				page: S
			},
			children: m ? ["first", "second"].map((e) => ({
				id: e,
				label: e,
				...t ? { target: {
					kind: "page",
					page: {
						...S,
						id: e
					}
				} } : { resource: C(e) }
			})) : []
		}]
	}], T = o(s, "notes", {
		sections: w,
		childrenByNodeId: {},
		activeLocation: { page: t ? {
			...S,
			id: g
		} : S },
		activeResource: t ? void 0 : C(g),
		selectedNodeId: v
	});
	return /* @__PURE__ */ p(u, {
		maxW: "20rem",
		children: [
			/* @__PURE__ */ f(l, {
				onClick: () => h(!1),
				children: "Start refresh"
			}),
			/* @__PURE__ */ f(l, {
				onClick: () => h(!0),
				children: "Finish refresh"
			}),
			/* @__PURE__ */ f(l, {
				onClick: () => {
					_("first"), y("first");
				},
				children: "Select first"
			}),
			/* @__PURE__ */ f(l, {
				onClick: () => {
					_("second"), y("second");
				},
				children: "Select second"
			}),
			/* @__PURE__ */ f(d, {
				sections: w,
				activeNodeId: T,
				expandedNodeIds: x?.expandedNodeIds,
				expandedSectionIds: x?.expandedSectionIds,
				onToggleNode: (e) => b.setNodeExpanded("notes", e, !x?.expandedNodeIds.includes(e))
			})
		]
	});
}, g = {
	title: "pstdio-workbench/Guides/Tree selection reveal",
	tags: ["tree-selection-reveal"],
	component: m,
	decorators: [(e) => /* @__PURE__ */ f(s, { children: /* @__PURE__ */ f(e, {}) })]
}, _ = { play: async ({ canvasElement: r }) => {
	let i = t(r);
	await n(i.queryByRole("option", { name: "New note" })).not.toBeInTheDocument(), await e.click(i.getByRole("button", { name: "New note in Ideas" })), await n(await i.findByRole("option", { name: "New note" })).toHaveAttribute("aria-selected", "true"), await e.click(i.getByRole("option", { name: "Ideas" })), await e.click(i.getByRole("button", { name: "Refresh" })), await n(i.queryByRole("option", { name: "New note" })).not.toBeInTheDocument();
} }, v = {
	render: () => /* @__PURE__ */ f(h, {}),
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await n(await i.findByRole("option", { name: "first" })).toHaveAttribute("aria-selected", "true"), await e.click(i.getByRole("option", { name: "Notes" })), await e.click(i.getByRole("button", { name: "Start refresh" })), await e.click(i.getByRole("button", { name: "Finish refresh" })), await n(i.getByRole("option", { name: "Notes" })).toHaveAttribute("aria-expanded", "false"), await e.click(i.getByRole("button", { name: "Start refresh" })), await e.click(i.getByRole("button", { name: "Select second" })), await e.click(i.getByRole("button", { name: "Finish refresh" })), await n(await i.findByRole("option", { name: "second" })).toHaveAttribute("aria-selected", "true"), await n(i.getByRole("option", { name: "Notes" })).toHaveAttribute("aria-expanded", "true");
	}
}, y = {
	render: () => /* @__PURE__ */ f(h, { resourceFree: !0 }),
	play: v.play
}, b = {
	render: () => /* @__PURE__ */ f(h, { aliases: !0 }),
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await n(await i.findByRole("option", { name: "first" })).toHaveAttribute("aria-selected", "true");
		for (let t of ["second", "first"]) await e.click(i.getByRole("option", { name: "Notes" })), await e.click(i.getByRole("button", { name: `Select ${t}` })), await n(await i.findByRole("option", { name: t })).toHaveAttribute("aria-selected", "true");
	}
};
export { _ as NewNoteInCollapsedFolder, v as RefreshKeepsUserCollapse, y as RefreshResourceFreePage, b as RevisitResourceAlias, g as default };
