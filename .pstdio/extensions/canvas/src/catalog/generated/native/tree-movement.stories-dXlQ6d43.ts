// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, n as t, o as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./workbench-core-kaLFKJEn.ts";
import { n as o, t as s } from "./tree-view-DssaVHjf.ts";
import { t as c } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as l } from "react";
import { Button as u, Stack as d, Text as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-movement.stories.tsx
var h = (e) => {
	let t = a(), n = [{
		id: "notes",
		nodes: [{
			id: "notes",
			label: "Notes",
			canDrop: !0,
			children: [
				{
					id: "folder",
					label: "Ideas",
					canDrop: !0,
					children: []
				},
				{
					id: "first",
					label: "Research",
					canDrag: !0,
					canDrop: !0
				},
				{
					id: "second",
					label: "Meeting",
					canDrag: !0,
					canDrop: !0
				}
			]
		}]
	}], r = [];
	return t.views.registerView({
		id: "notes",
		title: "Notes",
		body: {
			kind: "tree",
			defaultExpandedNodeIds: ["notes", "folder"],
			getBody: () => n,
			getChildren: (e) => e.children ?? [],
			moveNode: (t, i, a) => new Promise((s, c) => {
				r.push((r) => {
					r && i ? (n = o(n, {}, {
						sourceId: t.id,
						targetId: i.id,
						position: a.position ?? "inside"
					}), s()) : c(/* @__PURE__ */ Error("Save failed")), e();
				}), e();
			})
		}
	}), {
		workbench: t,
		pending: r,
		savedOrder: () => n[0].nodes[0].children.map((e) => e.id).join(", ")
	};
}, g = {
	title: "pstdio-workbench/Tree/Instant resource moves",
	component: () => {
		let [, e] = l(0), [t] = l(() => h(() => e((e) => e + 1))), [n, r] = l("");
		return /* @__PURE__ */ m(d, {
			maxW: "24rem",
			children: [
				/* @__PURE__ */ p(f, { children: "Rows move immediately. Finish or reject the deferred save to see reconciliation." }),
				/* @__PURE__ */ p(s, {
					workbench: t.workbench,
					treeViewId: "notes",
					onOpenResourceError: (e) => r(String(e))
				}),
				/* @__PURE__ */ p(f, {
					"data-testid": "saved-order",
					children: t.savedOrder()
				}),
				/* @__PURE__ */ p(f, { children: n }),
				/* @__PURE__ */ p(u, {
					disabled: !t.pending.length,
					onClick: () => t.pending.shift()?.(!0),
					children: "Finish save"
				}),
				/* @__PURE__ */ p(u, {
					disabled: !t.pending.length,
					onClick: () => t.pending.shift()?.(!1),
					children: "Reject save"
				})
			]
		});
	},
	decorators: [(e) => /* @__PURE__ */ p(c, { children: /* @__PURE__ */ p(e, {}) })]
}, _ = { play: async ({ canvasElement: a }) => {
	let o = r(a), s = (e) => {
		let n = o.getByRole("option", { name: "Research" }).parentElement, r = o.getByRole("option", { name: "Meeting" }).parentElement, i = new DataTransfer(), a = e ? r.getBoundingClientRect().bottom - 1 : r.getBoundingClientRect().top + 1;
		for (let [e, o] of [["dragstart", n], ["drop", r]]) t(o, new DragEvent(e, {
			bubbles: !0,
			cancelable: !0,
			dataTransfer: i,
			clientY: a
		}));
	}, c = () => !!(o.getByRole("option", { name: "Meeting" }).compareDocumentPosition(o.getByRole("option", { name: "Research" })) & Node.DOCUMENT_POSITION_FOLLOWING);
	await o.findByRole("option", { name: "Research" }), s(!0), await n(() => i(c()).toBe(!0)), await i(o.getByTestId("saved-order")).toHaveTextContent("folder, first, second"), await e.click(o.getByRole("button", { name: "Reject save" })), await n(() => i(c()).toBe(!1)), await i(o.getByText("Error: Save failed")).toBeVisible(), s(!0), await n(() => i(c()).toBe(!0)), s(!1), await n(() => i(c()).toBe(!1)), await e.click(o.getByRole("button", { name: "Finish save" })), await n(() => i(o.getByRole("button", { name: "Finish save" })).toBeEnabled()), await i(c()).toBe(!1), await e.click(o.getByRole("button", { name: "Finish save" })), await n(() => i(o.getByRole("button", { name: "Finish save" })).toBeDisabled()), await i(o.getByTestId("saved-order")).toHaveTextContent("folder, first, second"), await i(c()).toBe(!1);
} };
export { _ as DeferredPersistence, g as default };
