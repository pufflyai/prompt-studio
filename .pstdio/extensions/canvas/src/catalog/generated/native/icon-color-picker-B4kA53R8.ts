// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./icon-options-BaFkbkcp.ts";
import { t as r } from "./icon-picker-grid-cD8ukHSR.ts";
import { Box as i, Center as a, Grid as o, Icon as s, Popover as c, Portal as l, Stack as u, Text as d, chakra as f } from "@chakra-ui/react";
import { Fragment as p, jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/ui/src/components/primitives/tag-swatch.tsx
var g = (e) => !!e && e !== "circle", _ = (e) => {
	let { color: t, icon: r, iconOptions: o, showIcon: c = !0, ...l } = e, u = n(r, o);
	return /* @__PURE__ */ m(a, {
		boxSize: "tag-swatch",
		flexShrink: 0,
		borderRadius: "compact",
		bg: `${t}.500/15`,
		...l,
		children: c && g(r) ? /* @__PURE__ */ m(s, {
			as: u,
			boxSize: "icon-xs",
			color: `${t}.500`
		}) : /* @__PURE__ */ m(i, {
			boxSize: "tag-swatch-dot",
			borderRadius: "full",
			bg: `${t}.500`
		})
	});
}, v = f("button", { base: {
	display: "inline-flex",
	borderRadius: "compact",
	cursor: "pointer",
	focusVisibleRing: "outside",
	_disabled: {
		cursor: "not-allowed",
		opacity: .5
	}
} }), y = f("button", { base: {
	boxSize: "tag-color-dot",
	borderRadius: "full",
	cursor: "pointer",
	outlineStyle: "solid",
	outlineWidth: "selection",
	outlineOffset: "3xs",
	outlineColor: "transparent",
	_selected: { outlineColor: "fg" }
} }), b = (n) => {
	let { color: a, colorOptions: s = e, icon: f, iconOptions: g = t, onColorChange: b, onIconChange: x, disabled: S, showIcons: C = !0, colorLabel: w = "Color", iconLabel: T = "Icon", "aria-label": E = "Pick color and icon" } = n, D = f === "circle" ? null : f ?? null;
	return /* @__PURE__ */ h(c.Root, {
		positioning: { placement: "bottom-start" },
		children: [/* @__PURE__ */ m(c.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ m(v, {
				type: "button",
				disabled: S,
				"aria-label": E,
				children: /* @__PURE__ */ m(_, {
					color: a,
					icon: f,
					iconOptions: g,
					showIcon: C
				})
			})
		}), /* @__PURE__ */ m(l, { children: /* @__PURE__ */ m(c.Positioner, { children: /* @__PURE__ */ m(c.Content, {
			width: C ? "tag-picker" : "tag-picker-color-only",
			bg: "bg.elevated",
			children: /* @__PURE__ */ h(u, {
				gap: "compact",
				p: "sm",
				children: [
					/* @__PURE__ */ m(d, {
						textStyle: "label/S/medium",
						color: "fg.muted",
						children: w
					}),
					/* @__PURE__ */ m(o, {
						templateColumns: `repeat(${C ? 10 : 5}, 1fr)`,
						gap: "2xs",
						justifyItems: "center",
						children: s.map((e) => /* @__PURE__ */ m(y, {
							type: "button",
							bg: `${e}.500`,
							"aria-label": e,
							"aria-pressed": e === a,
							"data-selected": e === a ? "" : void 0,
							onClick: () => b(e)
						}, e))
					}),
					C ? /* @__PURE__ */ h(p, { children: [
						/* @__PURE__ */ m(i, { borderTop: "subtle" }),
						/* @__PURE__ */ m(d, {
							textStyle: "label/S/medium",
							color: "fg.muted",
							children: T
						}),
						/* @__PURE__ */ m(r, {
							value: D,
							options: g,
							color: a,
							onChange: (e) => x?.(e)
						})
					] }) : null
				]
			})
		}) }) })]
	});
};
export { _ as n, b as t };
