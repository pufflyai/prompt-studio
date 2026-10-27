// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./tree-list-Db4WJcm2.ts";
import { useState as i } from "react";
import { Stack as a, Text as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
var l = {
	title: "Components/Data Display/Tree List/Branch navigation",
	component: () => {
		let [e, t] = i([]), [n, l] = i("Nothing open");
		return /* @__PURE__ */ c(a, { children: [/* @__PURE__ */ s(r, {
			sections: [{
				id: "project",
				nodes: [{
					id: "notes",
					label: "Notes",
					isContainer: !0,
					navigationIntent: {
						id: "page",
						payload: "notes"
					},
					children: [{
						id: "note",
						label: "First note",
						navigationIntent: {
							id: "resource",
							payload: "note"
						}
					}]
				}]
			}],
			expandedNodeIds: e,
			onToggleNode: (e) => t((t) => t.includes(e) ? t.filter((t) => t !== e) : [...t, e]),
			onNavigate: ({ node: e }) => l(e.label)
		}), /* @__PURE__ */ s(o, {
			role: "status",
			children: n
		})] });
	},
	tags: ["tree-branch-navigation"]
}, u = { play: async ({ canvasElement: r }) => {
	let i = e(r), a = i.getByRole("option", { name: "Notes" });
	await n(e(a).queryByRole("button", { name: /^(Expand|Collapse) group$/ })).toBeNull(), await t.click(a), await n(i.getByRole("status")).toHaveTextContent("Notes"), await n(a).toHaveAttribute("aria-expanded", "true"), await n(await i.findByRole("option", { name: "First note" })).toBeVisible(), await t.click(a), await n(a).toHaveAttribute("aria-expanded", "false"), await t.click(a.querySelector("svg[data-open]")), await n(a).toHaveAttribute("aria-expanded", "true"), await n(i.getByRole("status")).toHaveTextContent("Notes"), await t.click(i.getByRole("option", { name: "First note" })), await n(i.getByRole("status")).toHaveTextContent("First note");
} };
export { u as PageAndChildren, l as default };
