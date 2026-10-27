// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./icon-options-BaFkbkcp.ts";
import { t as r } from "./list-row-BhxGCvIh.ts";
import { Badge as i, Icon as a, Menu as o, Portal as s } from "@chakra-ui/react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-attribute-badge.tsx
var d = (e) => e.stopPropagation(), f = (e) => Array.isArray(e.value) ? e.value : e.value ? [e.value] : [], p = (e, t) => e.includes(t) ? e.filter((e) => e !== t) : [...e, t], m = (e) => e.color ? `${e.color}.fg` : "fg.muted", h = (h) => {
	let { badge: g, onChange: _ } = h, v = g.options ?? [], y = !!(_ && g.isEditable && v.length > 0), b = Array.isArray(g.value), x = f(g), S = {
		onClick: d,
		onPointerDown: d,
		onKeyDown: d
	}, C = (e) => {
		let t;
		t = b ? p(x, e) : x.includes(e) ? "" : e, _?.(g.attributeId, t);
	}, w = /* @__PURE__ */ u(c, { children: [
		g.icon ? /* @__PURE__ */ l(a, {
			as: n(g.icon),
			boxSize: "3.5",
			color: m(g)
		}) : null,
		g.label,
		y ? /* @__PURE__ */ l(a, {
			as: t,
			boxSize: "3",
			color: "fg.muted"
		}) : null
	] });
	return y ? /* @__PURE__ */ u(o.Root, {
		closeOnSelect: !b,
		children: [/* @__PURE__ */ l(o.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ l(i, {
				as: "span",
				role: "button",
				tabIndex: 0,
				variant: "ticket",
				gap: "2xs",
				textStyle: "label/XS/medium",
				cursor: "pointer",
				onClick: d,
				onPointerDown: d,
				onKeyDown: d,
				children: w
			})
		}), /* @__PURE__ */ l(s, { children: /* @__PURE__ */ l(o.Positioner, { children: /* @__PURE__ */ l(o.Content, {
			minW: "180px",
			p: "0",
			gap: "0",
			onClick: d,
			onPointerDown: d,
			onKeyDown: d,
			children: v.map((t) => {
				let i = x.includes(t.value);
				return /* @__PURE__ */ l(o.Item, {
					value: t.value,
					asChild: !0,
					children: /* @__PURE__ */ l(r, {
						asChild: !0,
						role: b ? "menuitemcheckbox" : "menuitemradio",
						"aria-checked": i,
						variant: "full-width",
						id: t.value,
						label: t.label,
						icon: /* @__PURE__ */ l(a, {
							as: n(t.icon),
							boxSize: "16px"
						}),
						iconColor: `${t.color ?? "gray"}.500`,
						isSelected: i,
						endContent: i ? /* @__PURE__ */ l(a, {
							as: e,
							boxSize: "3.5"
						}) : void 0,
						onActivate: () => C(t.value),
						...S
					})
				}, t.value);
			})
		}) }) })]
	}) : /* @__PURE__ */ l(i, {
		variant: "ticket",
		gap: "2xs",
		textStyle: "label/XS/medium",
		children: w
	});
};
export { h as t };
