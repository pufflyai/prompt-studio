// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { m as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./scroll-area-I7hjn89T.ts";
import { useState as r } from "react";
import { Box as i, Button as a, Stack as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/primitives/scroll-area.stories.tsx
var u = Array.from({ length: 24 }, (e, t) => `Scrollable row ${t + 1}`), d = Array.from({ length: 16 }, (e, t) => `Layered row ${t + 1}`), f = {
	title: "Components/Layout/Scroll Area",
	component: n,
	parameters: { docs: { description: { component: "Shared scrolling surface. The default xs size uses a 2px thumb with an 8px pointer target." } } },
	decorators: [(e) => /* @__PURE__ */ c(i, {
		bg: "bg",
		maxW: "560px",
		p: "lg",
		children: /* @__PURE__ */ c(e, {})
	})],
	args: {
		maxH: "14rem",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "md",
		contentProps: {
			p: "sm",
			spaceY: "xs"
		}
	}
}, p = { render: (e) => /* @__PURE__ */ c(n, {
	...e,
	children: u.map((e) => /* @__PURE__ */ c(s, {
		textStyle: "paragraph/S/regular",
		children: e
	}, e))
}) }, m = {
	...p,
	play: async ({ canvasElement: e }) => {
		let n = e.querySelector("[data-part=\"viewport\"]");
		await t(n).not.toBeNull(), n.focus(), await t(n).toHaveFocus(), await t(getComputedStyle(n).outlineStyle).toBe("none");
	}
}, h = {
	args: {
		showHorizontalScrollbar: !0,
		maxW: "24rem",
		contentProps: {
			p: "sm",
			minW: "42rem"
		}
	},
	render: (e) => /* @__PURE__ */ c(n, {
		...e,
		children: /* @__PURE__ */ c(o, {
			gap: "xs",
			children: u.slice(0, 12).map((e) => /* @__PURE__ */ l(s, {
				textStyle: "paragraph/S/regular",
				children: [e, " with extra content to demonstrate horizontal scrolling."]
			}, e))
		})
	}),
	play: async ({ canvasElement: n }) => {
		await e(() => {
			for (let e of ["vertical", "horizontal"]) {
				let r = n.querySelector(`[data-part="scrollbar"][data-orientation="${e}"]`), i = r.getBoundingClientRect();
				t(e === "vertical" ? i.width : i.height).toBe(2);
				let a = e === "vertical" ? {
					x: i.right - 7,
					y: i.top + i.height / 2
				} : {
					x: i.left + i.width / 2,
					y: i.bottom - 7
				}, o = n.ownerDocument.elementFromPoint(a.x, a.y);
				t(o?.closest("[data-part=\"scrollbar\"]")).toBe(r);
			}
		});
	}
}, g = {
	args: {
		showHorizontalScrollbar: !0,
		maxH: "12rem",
		maxW: "24rem",
		contentProps: { minW: "42rem" }
	},
	render: (e) => /* @__PURE__ */ c(n, {
		...e,
		children: /* @__PURE__ */ c(o, {
			gap: "2xs",
			children: d.map((e) => /* @__PURE__ */ c(i, {
				"data-testid": "scroll-area-layered-row",
				position: "relative",
				zIndex: "1",
				bg: "bg",
				borderWidth: "1px",
				borderColor: "border.subtle",
				px: "sm",
				py: "xs",
				children: /* @__PURE__ */ l(s, {
					textStyle: "paragraph/S/regular",
					children: [e, " with enough content to require horizontal scrolling."]
				})
			}, e))
		})
	})
}, _ = () => {
	let [e, t] = r(24);
	return /* @__PURE__ */ l(o, {
		gap: "sm",
		children: [/* @__PURE__ */ c(a, {
			size: "xs",
			onClick: () => t((e) => e + 24),
			children: "Add rows"
		}), /* @__PURE__ */ c(n, {
			h: "14rem",
			contentProps: { p: "sm" },
			children: /* @__PURE__ */ l(o, {
				gap: "sm",
				children: [/* @__PURE__ */ c(n, {
					h: "8rem",
					showHorizontalScrollbar: !0,
					children: /* @__PURE__ */ c(o, {
						minW: "42rem",
						gap: "0",
						children: Array.from({ length: e }, (e, t) => /* @__PURE__ */ l(s, {
							textStyle: "paragraph/S/regular",
							children: [
								"Nested row ",
								t + 1,
								" with enough content to scroll in both directions."
							]
						}, t))
					})
				}), u.map((e) => /* @__PURE__ */ c(s, {
					textStyle: "paragraph/S/regular",
					children: e
				}, e))]
			})
		})]
	});
}, v = { render: () => /* @__PURE__ */ c(_, {}) };
export { h as BothDirections, m as Focused, v as GrowingNested, g as LayeredRows, p as Vertical, f as default };
