// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./check-Bgh538vW.ts";
import { t as a } from "./git-branch-BjWwGBn9.ts";
import { t as o } from "./rotate-ccw-YxjlnQSJ.ts";
import { r as s, s as c } from "./list-row-BhxGCvIh.ts";
import { useState as l } from "react";
import { Button as u, Icon as d, Menu as f, Stack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
var _ = {
	tags: ["menu-selection"],
	title: "Components/Overlays/Menu Selection",
	component: () => {
		let [e, t] = l("main"), [n, r] = l(!0);
		return /* @__PURE__ */ g(p, {
			align: "start",
			children: [
				/* @__PURE__ */ g(f.Root, {
					closeOnSelect: !1,
					children: [/* @__PURE__ */ h(f.Trigger, {
						asChild: !0,
						children: /* @__PURE__ */ h(u, { children: "Layout options" })
					}), /* @__PURE__ */ h(f.Positioner, { children: /* @__PURE__ */ g(f.Content, { children: [
						/* @__PURE__ */ g(f.CheckboxItem, {
							value: "pinned",
							checked: n,
							onCheckedChange: (e) => r(!!e),
							children: [
								/* @__PURE__ */ h(f.ItemIndicator, { children: /* @__PURE__ */ h(i, {}) }),
								/* @__PURE__ */ h(d, {
									as: a,
									boxSize: "3.5"
								}),
								/* @__PURE__ */ h(f.ItemText, { children: "Pinned" })
							]
						}),
						/* @__PURE__ */ h(f.RadioItemGroup, {
							value: e,
							onValueChange: (e) => t(e.value),
							children: ["main", "release"].map((e) => /* @__PURE__ */ g(f.RadioItem, {
								value: e,
								children: [
									/* @__PURE__ */ h(f.ItemIndicator, { children: /* @__PURE__ */ h(i, {}) }),
									/* @__PURE__ */ h(d, {
										as: a,
										boxSize: "3.5"
									}),
									/* @__PURE__ */ h(f.ItemText, { children: e })
								]
							}, e))
						}),
						/* @__PURE__ */ g(f.Item, {
							value: "reset",
							children: [/* @__PURE__ */ h(d, {
								as: o,
								boxSize: "3.5"
							}), /* @__PURE__ */ h(m, { children: "Reset layout" })]
						}),
						/* @__PURE__ */ g(f.Item, {
							value: "shortcut",
							children: [/* @__PURE__ */ h(f.ItemText, { children: "Open resource" }), /* @__PURE__ */ h(f.ItemCommand, { children: "⌘O" })]
						})
					] }) })]
				}),
				/* @__PURE__ */ h(s, {
					trigger: /* @__PURE__ */ h(u, { children: "Select branches" }),
					showSearch: !1,
					multiple: !0,
					closeOnSelect: !1,
					emptyState: null,
					items: ["main", "release"].map((n) => ({
						id: n,
						label: n,
						icon: a,
						isSelected: n === e,
						onSelect: () => t(n)
					}))
				}),
				/* @__PURE__ */ h(c, {
					actions: [{
						key: "main",
						label: "Main panel",
						icon: /* @__PURE__ */ h(a, {}),
						isSelected: !0
					}, {
						key: "reset",
						label: "Reset layout",
						icon: /* @__PURE__ */ h(o, {})
					}],
					children: /* @__PURE__ */ h(u, { children: "Resource options" })
				})
			]
		});
	}
}, v = { play: async ({ canvasElement: i }) => {
	let a = e(i), o = e(i.ownerDocument.body);
	await n.click(a.getByRole("button", { name: "Layout options" }));
	let s = o.getByRole("menuitemcheckbox", { name: "Pinned" });
	await r(s).toBeChecked();
	let c = e(s).getByText("Pinned").getBoundingClientRect(), l = s.querySelector("[data-part=item-indicator]").getBoundingClientRect();
	r(l.left).toBeGreaterThan(c.right), r(getComputedStyle(s).backgroundColor).toBe("rgba(0, 0, 0, 0)");
	let u = o.getByRole("menuitem", { name: "Reset layout" }), d = u.querySelector("svg").getBoundingClientRect();
	r(s.querySelector(".lucide-git-branch").getBoundingClientRect().left).toBe(d.left), r(e(u).getByText("Reset layout").getBoundingClientRect().left - d.right).toBeLessThanOrEqual(8), await n.click(s), await r(s).not.toBeChecked();
	let f = o.getByRole("menuitemradio", { name: "release" });
	await n.keyboard("{Home}{ArrowDown}{ArrowDown}{Enter}"), await r(f).toBeChecked(), await n.keyboard("{Escape}"), await n.click(a.getByRole("button", { name: "Select branches" })), await r(o.getByRole("menuitemcheckbox", { name: "release" })).toBeChecked(), await n.click(o.getByRole("menuitemcheckbox", { name: "main" })), await r(o.getByRole("menuitemcheckbox", { name: "main" })).toBeChecked(), await n.keyboard("{Escape}"), await n.click(a.getByRole("button", { name: "Resource options" })), await t(() => r(o.getByRole("menuitem", { name: "Main panel" })).toBeVisible());
} };
export { v as CheckmarksAndAlignment, _ as default };
