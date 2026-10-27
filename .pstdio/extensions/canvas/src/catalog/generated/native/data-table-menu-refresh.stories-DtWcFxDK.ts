// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./data-table-BpTupEfR.ts";
import { useState as a } from "react";
import { Box as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
var u = {
	title: "Components/Data Display/Data Table/Menu refresh",
	component: () => {
		let [e, t] = a(!1), [n, r] = a("");
		return /* @__PURE__ */ l(o, {
			p: "md",
			onClickCapture: (e) => {
				e.target.closest("button[aria-label=\"Row actions\"]") && t(!0);
			},
			children: [/* @__PURE__ */ c(i, {
				data: [{
					id: "workspace",
					Name: e ? "Updated workspace" : "Workspace"
				}],
				hiddenColumns: ["id"],
				getRowId: (e) => String(e.id),
				rowActions: [{
					label: "Open terminal",
					onSelect: (e) => r(String(e.Name))
				}]
			}), /* @__PURE__ */ c(s, {
				role: "status",
				children: n
			})]
		});
	},
	tags: ["!manifest"]
}, d = { play: async ({ canvasElement: i }) => {
	let a = e(i);
	await n.click(a.getByRole("button", { name: "Row actions" })), await r(a.getByText("Updated workspace")).toBeVisible();
	let o = await e(i.ownerDocument.body).findByRole("menuitem", { name: "Open terminal" });
	await t(() => r(o).toBeVisible()), await n.click(o), await r(a.getByRole("status")).toHaveTextContent("Updated workspace");
} };
export { d as KeepsOpenDuringRefresh, u as default };
