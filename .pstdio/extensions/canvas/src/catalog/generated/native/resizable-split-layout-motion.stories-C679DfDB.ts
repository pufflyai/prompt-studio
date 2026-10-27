// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./resizable-split-layout-DdxKHR9a.ts";
import { useState as a } from "react";
import { Box as o, Button as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
var f = {
	tags: ["motion"],
	title: "Components/Layout/Resizable Split Layout/Motion",
	component: (e) => {
		let { side: t = "right" } = e, [n, r] = a(!0);
		return /* @__PURE__ */ d(c, {
			h: "96",
			gap: "sm",
			children: [/* @__PURE__ */ u(s, {
				onClick: () => r(!n),
				children: "Toggle panel"
			}), /* @__PURE__ */ u(i, {
				resizableSide: t,
				collapsed: n,
				onCollapsedChange: r,
				defaultSizePx: 240,
				minSizePx: 120,
				contentMinSizePx: 160,
				resizablePanel: /* @__PURE__ */ u(o, {
					h: "full",
					bg: "bg.subtle",
					children: /* @__PURE__ */ u(l, { children: "Saved size content" })
				}),
				contentPanel: /* @__PURE__ */ u(o, { children: /* @__PURE__ */ u(l, { children: "Main content" }) })
			})]
		});
	},
	parameters: { docs: { description: { component: "Resize a divider, drag it closed, then reopen. The content should fill the restored panel." } } }
}, p = { play: async ({ canvasElement: i, args: a }) => {
	let o = e(i), s = o.getByRole("button", { name: "Toggle panel" }), c = o.getByText("Saved size content"), l = c.closest("[data-collapsed]"), u = l.parentElement;
	await r(c).not.toBeVisible(), await n.click(s), await t(() => r(c).toBeVisible()), await t(() => r(u.getAnimations()).toHaveLength(0));
	let d = a.side === "top" || a.side === "bottom" ? "height" : "width", f = o.getByRole("separator", { hidden: !0 }), p = l.querySelector("[data-split-panel-content]");
	f.focus(), await n.keyboard("{End}"), await t(() => r(u.getAnimations()).toHaveLength(0));
	let m = l.getBoundingClientRect()[d], h = d === "width" ? "ArrowRight" : "ArrowDown", g = d === "width" ? "ArrowLeft" : "ArrowUp", _ = a.side === "left" || a.side === "top";
	await n.keyboard(`{${_ ? g : h}}`), await t(() => r(u.getAnimations()).toHaveLength(0));
	let v = l.getBoundingClientRect()[d];
	await r(v).toBeLessThan(m), await n.click(s), await r(l).toHaveAttribute("inert"), await r(l).toBeVisible(), await r(l.getBoundingClientRect()[d]).toBeGreaterThan(0), await t(() => r(c).not.toBeVisible()), await r(f.getBoundingClientRect()[d]).toBe(0), await n.click(s), await t(() => r(c).toBeVisible()), await t(() => r(u.getAnimations()).toHaveLength(0)), await r(l.getBoundingClientRect()[d]).toBe(v), await r(p.getBoundingClientRect()[d]).toBe(v);
} }, m = {
	...p,
	args: { side: "left" }
}, h = {
	...p,
	args: { side: "bottom" }
}, g = {
	...p,
	args: { side: "top" }
};
export { h as Bottom, m as Left, p as Right, g as Top, f as default };
