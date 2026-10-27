// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r, u as i } from "./test-whhQHjQi.ts";
import { t as a } from "./circle-question-mark-Ck8Da90Q.ts";
import { t as o } from "./plus-CYkLGSPS.ts";
import { t as s } from "./tree-list-Db4WJcm2.ts";
import { useState as c } from "react";
import { Box as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
var p = {
	title: "Components/Tree List/Menu rows",
	component: () => {
		let [e, t] = c("Choose Help with the pointer or keyboard."), [n, r] = c([]), i = [{
			id: "docs",
			label: "Documentation",
			onAction: () => t("Documentation selected")
		}];
		return /* @__PURE__ */ f(l, {
			w: "full",
			children: [/* @__PURE__ */ d(s, {
				expandedNodeIds: n,
				onToggleNode: (e) => r((t) => t.includes(e) ? t.filter((t) => t !== e) : [...t, e]),
				sections: [{
					id: "navigation",
					nodes: [{
						id: "help",
						label: "Help",
						icon: /* @__PURE__ */ d(a, {}),
						menuItems: i,
						contextMenuItems: i
					}, {
						id: "folder",
						label: "Folder",
						children: [{
							id: "child",
							label: "Child"
						}],
						actions: [{
							id: "add",
							label: "Add item",
							icon: /* @__PURE__ */ d(o, {}),
							onAction: () => t("Add item selected")
						}]
					}]
				}]
			}), /* @__PURE__ */ d(u, { children: e })]
		});
	}
}, m = {}, h = {
	render: () => /* @__PURE__ */ d(l, {
		h: "20rem",
		display: "flex",
		alignItems: "flex-end",
		p: "md",
		children: /* @__PURE__ */ d(l, {
			w: "xs",
			children: /* @__PURE__ */ d(s, { sections: [{
				id: "footer",
				nodes: [{
					id: "help-footer",
					label: "Help",
					icon: /* @__PURE__ */ d(a, {}),
					menuPlacement: "top-start",
					menuItems: [{
						id: "docs",
						label: "Documentation"
					}]
				}]
			}] })
		})
	}),
	play: async ({ canvasElement: a }) => {
		let o = e(a).getByRole("button", {
			name: "Help",
			exact: !0
		});
		await n.click(o);
		let s = await i.findByRole("menu");
		await t(() => {
			let e = o.getBoundingClientRect(), t = s.getBoundingClientRect();
			r(Math.abs(t.left - e.left)).toBeLessThan(12), r(Math.abs(t.bottom - e.top)).toBeLessThan(20);
		}), await n.keyboard("{Escape}"), await t(() => r(s).not.toBeVisible()), o.focus(), await n.keyboard("{Enter}"), await t(() => r(i.getByRole("menuitem", { name: "Documentation" })).toBeVisible()), await n.keyboard("{Escape}"), await t(() => r(s).not.toBeVisible());
	}
};
export { h as FooterMenu, m as MenuAndBranch, p as default };
