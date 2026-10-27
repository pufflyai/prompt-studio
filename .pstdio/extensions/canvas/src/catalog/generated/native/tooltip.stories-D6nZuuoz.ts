// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./tooltip-BweQW627.ts";
import { useRef as a, useState as o } from "react";
import { Box as s, Button as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/primitives/tooltip.stories.tsx
var f = {
	title: "Components/Overlays/Tooltip",
	component: i,
	parameters: { docs: { description: { component: "Tooltips wait 380 ms on the first hover. Pass overflowRef for a label tooltip that is useful only when its text is clipped. The tooltip updates when the label or its available width changes. Keyboard focus uses the shared tooltip behavior." } } }
}, p = { args: {
	content: "Reasoning effort",
	children: /* @__PURE__ */ u(c, { children: "High" })
} }, m = () => new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), h = () => {
	let e = a(null), [t, n] = o(!0), [r, f] = o("Session notes for review"), [p, m] = o(!1);
	return /* @__PURE__ */ d(s, { children: [
		/* @__PURE__ */ u(i, {
			content: r,
			overflowRef: e,
			disabled: p,
			children: /* @__PURE__ */ u(c, {
				role: "tab",
				"aria-label": r,
				width: t ? "24" : "md",
				children: /* @__PURE__ */ u(l, {
					asChild: !0,
					truncate: !0,
					children: /* @__PURE__ */ u("span", {
						ref: e,
						children: r
					})
				})
			})
		}),
		/* @__PURE__ */ u(c, {
			onClick: () => n(!t),
			children: "Toggle width"
		}),
		/* @__PURE__ */ u(c, {
			onClick: () => f(r === "Notes" ? "Session notes for review" : "Notes"),
			children: "Rename"
		}),
		/* @__PURE__ */ u(c, {
			onClick: () => m(!p),
			children: "Toggle tooltips"
		})
	] });
}, g = {
	args: { content: "Session notes for review" },
	render: () => /* @__PURE__ */ u(h, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = e(i.ownerDocument.body), s = a.getByRole("tab"), c = async (e) => {
			await t(() => {
				let t = s.querySelector("span");
				r(t.scrollWidth > t.clientWidth).toBe(e);
			}), await m();
		};
		await c(!0), await n.hover(s), await r(await o.findByRole("tooltip")).toHaveTextContent("Session notes for review"), await n.unhover(s), await n.click(a.getByRole("button", { name: "Toggle width" })), await c(!1), s.focus(), await n.hover(s), await t(() => r(o.queryByRole("tooltip")).toBeNull()), await n.unhover(s), await n.click(a.getByRole("button", { name: "Toggle width" })), await c(!0), await n.hover(s), await r(await o.findByRole("tooltip")).toHaveTextContent("Session notes for review"), await n.unhover(s), await n.click(a.getByRole("button", { name: "Rename" })), await c(!1), await n.hover(s), await t(() => r(o.queryByRole("tooltip")).toBeNull()), await n.unhover(s), await n.click(a.getByRole("button", { name: "Toggle tooltips" })), await n.click(a.getByRole("button", { name: "Rename" })), await c(!0), await n.hover(s), await t(() => r(o.queryByRole("tooltip")).toBeNull()), await n.unhover(s), await n.click(a.getByRole("button", { name: "Toggle width" })), await n.click(a.getByRole("button", { name: "Toggle tooltips" })), await c(!1), await n.hover(s), await t(() => r(o.queryByRole("tooltip")).toBeNull()), await n.unhover(s), await n.click(a.getByRole("button", { name: "Toggle width" })), await c(!0), await n.hover(s), await r(await o.findByRole("tooltip")).toHaveTextContent("Session notes for review");
	}
};
export { p as Default, g as TruncatedLabel, f as default };
