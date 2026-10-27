// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./tree-list-selection-Dfhqy5p1.ts";
import { t as i } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as a } from "react";
import { TreeList as o } from "@pstdio/ui";
import { jsx as s } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-workspace-selection.stories.tsx
var c = {
	kind: "page",
	extensionId: "planner",
	id: "ticket"
}, l = {
	kind: "page",
	extensionId: "pstdio",
	id: "workspace"
}, u = {
	type: "ticket",
	id: "ticket"
}, d = (e) => ({
	type: "workspace",
	id: e
}), f = [{
	id: "context",
	label: "Ticket context",
	collapsible: !1,
	nodes: [{
		id: "body",
		label: "Ticket body",
		selected: !0,
		target: {
			kind: "page",
			page: c,
			resource: u
		}
	}, ...["first", "second"].map((e) => ({
		id: e,
		label: `${e} workspace`,
		resource: d(e)
	}))]
}], p = {
	title: "pstdio-workbench/Guides/Workspace selection",
	component: () => {
		let [e, t] = a("first"), n = e === "body" ? u : d(e), i = r({
			sections: f,
			childrenByNodeId: {},
			activeResource: n,
			activeLocation: {
				page: e === "body" ? c : l,
				resource: n
			}
		});
		return /* @__PURE__ */ s(o, {
			sections: f.map((e) => ({
				...e,
				nodes: e.nodes.map((e) => ({
					id: e.id,
					label: e.label,
					isNavigable: !0
				}))
			})),
			activeNodeId: i,
			onNavigate: (e) => t(e.nodeId)
		});
	},
	decorators: [(e) => /* @__PURE__ */ s(i, { children: /* @__PURE__ */ s(e, {}) })]
}, m = { play: async ({ canvasElement: r }) => {
	let i = t(r);
	await n(i.getByRole("option", { name: "first workspace" })).toHaveAttribute("aria-selected", "true"), await n(i.getByRole("option", { name: "Ticket body" })).toHaveAttribute("aria-selected", "false"), await e.click(i.getByRole("option", { name: "second workspace" })), await n(i.getByRole("option", { name: "second workspace" })).toHaveAttribute("aria-selected", "true"), await e.click(i.getByRole("option", { name: "Ticket body" })), await n(i.getByRole("option", { name: "Ticket body" })).toHaveAttribute("aria-selected", "true");
} };
export { m as TicketContext, p as default };
