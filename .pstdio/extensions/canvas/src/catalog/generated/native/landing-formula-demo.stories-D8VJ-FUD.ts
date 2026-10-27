// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./landing-tool-demo-AYY5tVVR.ts";
import { useState as n } from "react";
import { Box as r, HStack as i, Stack as a, Text as o, chakra as s, useSlotRecipe as c } from "@chakra-ui/react";
import { Slider as l } from "@pstdio/ui";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
var f = {
	title: "Theme/Landing Formula Demo",
	component: () => {
		let f = c({ recipe: t })({}), p = c({ recipe: e })({}), [m, h] = n(10), g = (e) => 1e4 * 1.005 ** (e * 12) + 300 * (1.005 ** (e * 12) - 1) / .005, _ = g(m), v = _ * 1.1, y = Array.from({ length: 101 }, (e, t) => `${24 + t * 3.52},${200 - g(m * t / 100) / v * 176}`).join(" ");
		return /* @__PURE__ */ u(r, {
			css: p.page,
			children: /* @__PURE__ */ d(r, {
				css: p.panel,
				children: [/* @__PURE__ */ u(r, {
					css: p.panelHeader,
					children: "Savings with contributions"
				}), /* @__PURE__ */ d(a, {
					css: p.panelBody,
					children: [
						/* @__PURE__ */ u(o, {
							textStyle: "mono/XS",
							children: "FV = P(1+i)ⁿ + C[(1+i)ⁿ−1]/i"
						}),
						/* @__PURE__ */ u(o, {
							color: "fg.muted",
							textStyle: "label/S/regular",
							children: "Future value"
						}),
						/* @__PURE__ */ u(o, {
							as: "output",
							textStyle: "heading/L",
							children: new Intl.NumberFormat("en-US", {
								style: "currency",
								currency: "USD",
								maximumFractionDigits: 0
							}).format(_)
						}),
						/* @__PURE__ */ d(s.svg, {
							css: f.plot,
							viewBox: "0 0 400 224",
							role: "img",
							"aria-label": "Savings with contributions over time",
							children: [
								/* @__PURE__ */ u(s.path, {
									css: f.plotGrid,
									d: "M24 24H376 M24 112H376 M24 200H376 M24 24V200 M200 24V200 M376 24V200"
								}),
								/* @__PURE__ */ u(s.polyline, {
									css: f.plotComparison,
									points: `24,${200 - 1e4 / v * 176} 376,${200 - (1e4 + 300 * m * 12) / v * 176}`
								}),
								/* @__PURE__ */ u(s.polyline, {
									css: f.plotCurve,
									points: y
								}),
								/* @__PURE__ */ u(s.circle, {
									css: f.plotPoint,
									cx: "376",
									cy: 200 - _ / v * 176,
									r: "5"
								})
							]
						}),
						/* @__PURE__ */ d(i, {
							justify: "space-between",
							textStyle: "label/S/regular",
							children: [/* @__PURE__ */ u(o, { children: "Today" }), /* @__PURE__ */ d(o, { children: ["Year ", m] })]
						}),
						/* @__PURE__ */ u(l, {
							"aria-label": ["Years"],
							min: 1,
							max: 30,
							step: 1,
							value: [m],
							onValueChange: ({ value: e }) => h(e[0])
						})
					]
				})]
			})
		});
	},
	parameters: { layout: "fullscreen" }
}, p = {}, m = { decorators: [(e) => /* @__PURE__ */ u(r, {
	width: "80",
	children: /* @__PURE__ */ u(e, {})
})] };
export { p as Interactive, m as NarrowPanel, f as default };
