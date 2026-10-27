// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { m as e, o as t } from "./assembly-layout-BE5FCzRo.ts";
import { a as n } from "./use-landing-styles-CQWLl3TI.ts";
import { o as r } from "./demo-workbench-CNySDkwL.ts";
import { t as i } from "./tool-demo-BbhwhxRg.ts";
import { t as a } from "./landing-assembly-DfV4OwkL.ts";
import { Box as o, chakra as s, useSlotRecipe as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// clients/landing-page/src/components/shapes/tool-board.tsx
var d = (d) => {
	let { view: f, x: p, y: m, scale: h, unitScale: g } = d, _ = 640 * g, v = 384 * g, y = Math.min(1, 1 / h), b = e.find((e) => e.id === f.example), x = b.blocks.every((e) => f.parts.includes(e.kind)), S = c({ recipe: a })({});
	return /* @__PURE__ */ u("g", {
		"data-tool-board": "",
		"data-example": f.example,
		"data-complete": x,
		transform: `translate(${p} ${m}) scale(${h})`,
		pointerEvents: "none",
		children: [
			/* @__PURE__ */ l(s.rect, {
				css: S.card,
				width: _,
				height: v + 78 / h,
				rx: "12"
			}),
			/* @__PURE__ */ l(s.path, {
				css: S.divider,
				d: `M0 ${38 * g}H${_}M0 ${v}H${_}`
			}),
			[
				16,
				26,
				36
			].map((e) => /* @__PURE__ */ l(s.circle, {
				css: S.chrome,
				cx: e * g,
				cy: 19 * g,
				r: 3 * g
			}, e)),
			/* @__PURE__ */ l(s.text, {
				css: S.cardTitle,
				"data-tool-title": "",
				visibility: x ? "visible" : "hidden",
				x: 54 * g,
				y: 24 * g,
				children: b.name
			}),
			/* @__PURE__ */ l("g", {
				transform: `translate(${10 * g} ${48 * g}) scale(${y})`,
				children: /* @__PURE__ */ l("foreignObject", {
					width: (_ - 20 * g) / y,
					height: (v - 58 * g) / y,
					children: /* @__PURE__ */ l(o, {
						css: S.preview,
						inert: !0,
						"data-tool-preview": "",
						"data-part-count": f.parts.length,
						children: /* @__PURE__ */ l(n, {
							value: {
								parts: f.parts,
								complete: x
							},
							children: /* @__PURE__ */ l(i, { example: f.example }, f.example)
						})
					})
				})
			}),
			t({
				x: p,
				y: m,
				scale: h,
				unitScale: g
			}, b).map((e) => /* @__PURE__ */ l("g", {
				"data-assembly-slot": e.kind,
				visibility: b.blocks.some((t) => t.kind === e.kind) ? "visible" : "hidden",
				opacity: +!f.parts.includes(e.kind),
				transform: `translate(${(e.x - p) / h} ${(e.y - m) / h}) scale(${1 / h}) translate(${-e.width / 2} ${-e.height / 2})`,
				children: /* @__PURE__ */ l(r, {
					kind: e.kind,
					size: e.height,
					width: e.width,
					outline: !0
				})
			}, e.kind))
		]
	});
};
export { d as t };
