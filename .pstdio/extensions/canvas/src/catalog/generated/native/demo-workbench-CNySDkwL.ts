// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./grip-vertical-C8TSneyx.ts";
import { f as t, p as n } from "./assembly-layout-BE5FCzRo.ts";
import { r, s as i } from "./use-landing-styles-CQWLl3TI.ts";
import { Box as a, Button as o, HStack as s, Icon as c, Text as l } from "@chakra-ui/react";
import { Fragment as u, jsx as d, jsxs as f } from "react/jsx-runtime";
// clients/landing-page/src/content/building-block-content.ts
var p = [
	{
		kind: "page",
		name: "Pages",
		detail: "Give your tool an interface.",
		example: "Dashboards, boards, forms, and custom views."
	},
	{
		kind: "editor",
		name: "Editors",
		detail: "Work with files your way.",
		example: "A storyboard, a CSV editor, or a document review tool."
	},
	{
		kind: "command",
		name: "Commands",
		detail: "Add an action you or your agent can run.",
		example: "Create a report, import feedback, or publish an update."
	},
	{
		kind: "skill",
		name: "Skills",
		detail: "Teach your agent how you work.",
		example: "Your review checklist, writing style, or research method."
	},
	{
		kind: "hook",
		name: "Hooks",
		detail: "Run an action when something happens.",
		example: "Check a result when an agent finishes its work."
	},
	{
		kind: "automation",
		name: "Schedules",
		detail: "Give repeated work a time to run.",
		example: "A morning brief, a weekly report, or a regular check."
	}
], m = (e) => p.find((t) => t.kind === e), h = (e, t) => {
	let n = e * 6 / 26, r = t * 6 / 26, i = (e - n) / 2, a = (t - r) / 2;
	return [
		{
			x: i,
			y: 0,
			width: n,
			height: t
		},
		{
			x: 0,
			y: a,
			width: i,
			height: r
		},
		{
			x: i + n,
			y: a,
			width: i,
			height: r
		}
	];
}, g = (e, t) => {
	let [n, r] = h(e, t), i = n.x, a = i + n.width, o = r.y, s = o + r.height;
	return `M${i} 0H${a}V${o}H${e}V${s}H${a}V${t}H${i}V${s}H0V${o}H${i}Z`;
}, _ = (e, t) => `M0 ${t}A${e / 2} ${t} 0 0 1 ${e} ${t}Z`, v = (e, t) => Array.from({ length: 33 }, (n, r) => {
	let i = r * Math.PI / 32;
	return {
		x: e / 2 * (1 - Math.cos(i)),
		y: t * (1 - Math.sin(i))
	};
}), y = (e) => {
	let { kind: r, size: i, outline: a = !1 } = e, o = e.width ?? i * t[r], s = n[r], c = a ? {
		fill: "none",
		stroke: "var(--chakra-colors-fg-subtle)",
		strokeWidth: 1.5,
		strokeDasharray: "4 4",
		vectorEffect: "non-scaling-stroke"
	} : { fill: s };
	return r === "command" ? /* @__PURE__ */ d("svg", {
		width: o,
		height: i,
		viewBox: "0 0 88 24",
		"aria-hidden": "true",
		focusable: "false",
		children: /* @__PURE__ */ d("rect", {
			x: "0",
			y: "0",
			width: "88",
			height: "24",
			rx: "12",
			...c
		})
	}) : r === "skill" ? /* @__PURE__ */ d("svg", {
		width: o,
		height: i,
		viewBox: `0 0 ${o} ${i}`,
		"aria-hidden": "true",
		focusable: "false",
		children: /* @__PURE__ */ d("path", {
			d: _(o, i),
			...c
		})
	}) : r === "hook" ? /* @__PURE__ */ d("svg", {
		width: o,
		height: i,
		viewBox: `0 0 ${o} ${i}`,
		"aria-hidden": "true",
		focusable: "false",
		children: /* @__PURE__ */ d("path", {
			d: g(o, i),
			...c
		})
	}) : r === "automation" ? /* @__PURE__ */ d("svg", {
		width: o,
		height: i,
		viewBox: "0 0 26 26",
		"aria-hidden": "true",
		focusable: "false",
		children: /* @__PURE__ */ d("circle", {
			cx: "13",
			cy: "13",
			r: "13",
			...c
		})
	}) : r === "editor" ? /* @__PURE__ */ d("svg", {
		width: o,
		height: i,
		viewBox: "0 0 26 26",
		"aria-hidden": "true",
		focusable: "false",
		children: a ? /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d("rect", {
			width: "26",
			height: "26",
			rx: "8.5",
			...c
		}), /* @__PURE__ */ d("rect", {
			x: "5",
			y: "5",
			width: "16",
			height: "16",
			rx: "3.5",
			...c
		})] }) : /* @__PURE__ */ d("rect", {
			x: "2.5",
			y: "2.5",
			width: "21",
			height: "21",
			rx: "6",
			fill: "none",
			stroke: s,
			strokeWidth: "5"
		})
	}) : /* @__PURE__ */ d("svg", {
		width: o,
		height: i,
		viewBox: "0 0 26 26",
		"aria-hidden": "true",
		focusable: "false",
		children: /* @__PURE__ */ d("rect", {
			x: "0",
			y: "0",
			width: "26",
			height: "26",
			rx: "7.5",
			...c
		})
	});
}, b = (e) => {
	let { kind: t, large: n = !1 } = e, i = r(), o = n ? 40 : 16, s = t === "command" ? o / 2 : o, c = n ? "10" : "4", l = n ? "5" : "2";
	return /* @__PURE__ */ d(a, {
		as: "span",
		css: i.blockMark,
		height: t === "command" ? l : c,
		children: /* @__PURE__ */ d(y, {
			kind: t,
			size: s
		})
	});
}, x = (e) => {
	let { kind: t, selected: n, onClick: r } = e, i = /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(b, { kind: t }), /* @__PURE__ */ d(l, {
		textStyle: "label/S/medium",
		children: m(t).name
	})] });
	return r ? /* @__PURE__ */ d(o, {
		variant: "ghost",
		size: "sm",
		"aria-pressed": n,
		onClick: r,
		children: i
	}) : /* @__PURE__ */ d(s, {
		gap: "xs",
		children: i
	});
}, S = () => {
	let e = r();
	return /* @__PURE__ */ d(a, {
		css: e.blockGrid,
		children: p.map((t) => /* @__PURE__ */ f(a, {
			css: e.block,
			children: [
				/* @__PURE__ */ d(a, {
					css: e.blockSymbol,
					children: /* @__PURE__ */ d(b, {
						kind: t.kind,
						large: !0
					})
				}),
				/* @__PURE__ */ d(l, {
					as: "h2",
					textStyle: "heading/S",
					children: t.name
				}),
				/* @__PURE__ */ d(l, {
					textStyle: "paragraph/M/regular",
					children: t.detail
				}),
				/* @__PURE__ */ d(l, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: t.example
				})
			]
		}, t.kind))
	});
}, C = (t) => {
	let { title: n, kind: o, highlighted: s, children: u } = t, p = r(), m = i();
	return /* @__PURE__ */ f(a, {
		hidden: !(!m || m.parts.includes(o)),
		css: p.panel,
		"data-demo-part": o,
		"data-highlighted": o === s,
		children: [/* @__PURE__ */ f(a, {
			css: p.panelHeader,
			children: [
				/* @__PURE__ */ d(b, { kind: o }),
				/* @__PURE__ */ d(l, {
					flex: "1",
					visibility: m && !m.complete ? "hidden" : void 0,
					children: n
				}),
				/* @__PURE__ */ d(c, {
					as: e,
					boxSize: "icon-sm",
					color: "fg.subtle"
				})
			]
		}), /* @__PURE__ */ d(a, {
			css: p.panelBody,
			children: u
		})]
	});
}, w = (e) => {
	let { children: t } = e, n = r();
	return /* @__PURE__ */ d(a, {
		css: n.visual,
		children: t
	});
};
export { S as a, v as c, b as i, m as l, w as n, y as o, x as r, h as s, C as t };
