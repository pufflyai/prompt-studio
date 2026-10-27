// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { d as t } from "./collection-view-fields-D15M65ck.ts";
import { r as n } from "./list-row-BhxGCvIh.ts";
import { Button as r, Icon as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/rule-select.tsx
var c = (e) => Array.isArray(e) ? e : e === void 0 ? [] : [e], l = (t) => {
	let { options: l, value: u, onSelect: d, multiple: f = !1, placeholder: p = "Choose…", width: m, showSearch: h } = t, g = c(u), _ = l.filter((e) => g.includes(e.value)), v = _.map((e) => e.label).join(", ") || p, y = _.length === 1 ? _[0]?.icon : void 0;
	return /* @__PURE__ */ o(n, {
		portalled: !1,
		open: t.open,
		onOpenChange: t.onOpenChange ? (e) => t.onOpenChange?.(e.open) : void 0,
		positioning: {
			strategy: "fixed",
			hideWhenDetached: !0
		},
		multiple: f,
		closeOnSelect: !f,
		showSearch: h ?? l.length > 8,
		searchPlaceholder: "Search…",
		emptyState: /* @__PURE__ */ o(a, {
			textStyle: "label/S/regular",
			color: "fg.muted",
			padding: "xs",
			children: "No matches"
		}),
		width: "14rem",
		items: l.map((e) => ({
			id: e.value,
			label: e.label,
			icon: e.icon,
			iconColor: e.iconColor,
			variant: "compact",
			secondaryLabel: e.count && e.count > 0 ? String(e.count) : void 0,
			isDisabled: e.disabled,
			isSelected: g.includes(e.value),
			onSelect: () => d(e.value)
		})),
		trigger: /* @__PURE__ */ s(r, {
			"aria-label": t["aria-label"],
			variant: t.variant ?? "subtle",
			size: t.size ?? "2xs",
			width: m,
			minW: "0",
			justifyContent: "flex-start",
			gap: "2xs",
			flexShrink: 0,
			children: [
				y && t.showSelectedIcon !== !1 ? /* @__PURE__ */ o(i, {
					as: y,
					color: _[0]?.iconColor ?? "fg.muted"
				}) : null,
				/* @__PURE__ */ o(a, {
					as: "span",
					flex: "1",
					minW: "0",
					textAlign: "start",
					textStyle: t.size === "sm" ? "label/S/regular" : "label/XS",
					truncate: !0,
					children: t.selectedLabel ?? v
				}),
				t.variant !== "filter-segment" && t.variant !== "filter-condition" ? /* @__PURE__ */ o(i, {
					as: e,
					color: "fg.subtle"
				}) : null
			]
		})
	});
}, u = {
	contains: "contains",
	"does-not-contain": "does not contain",
	is: "is",
	"is-not": "is not",
	gt: ">",
	gte: "≥",
	lt: "<",
	lte: "≤",
	"is-before": "is before",
	"is-after": "is after",
	"is-on-or-before": "is on or before",
	"is-on-or-after": "is on or after",
	"is-any-of": "is any of",
	"is-none-of": "is none of",
	"has-any-of": "has any of",
	"has-all-of": "has all of",
	"has-none-of": "has none of",
	"is-empty": "is empty",
	"is-not-empty": "is not empty"
}, d = (e, t) => t?.type.kind === "number" && e === "is" ? "=" : t?.type.kind === "number" && e === "is-not" ? "≠" : u[e], f = (e, t) => {
	if (t?.type.kind === "boolean" && e.value === !1 && (e.condition === "is" || e.condition === "is-not")) return d(e.condition === "is" ? "is-not" : "is");
	let n = Array.isArray(e.value) && e.value.length === 1;
	return Array.isArray(e.value) && e.value.length > 1 && ["is-any-of", "has-any-of"].includes(e.condition) ? "is any of" : ["is-none-of", "has-none-of"].includes(e.condition) ? "is not" : n && e.condition === "is-any-of" ? "is" : n && e.condition === "is-none-of" ? "is not" : d(e.condition, t);
}, p = /^today([+-])(\d+)$/, m = (e) => {
	if (e === "today") return "today";
	let t = p.exec(e);
	if (t) {
		let e = Number(t[2]), n = e === 1 ? "day" : "days";
		return t[1] === "-" ? `${e} ${n} ago` : `in ${e} ${n}`;
	}
	let n = /* @__PURE__ */ new Date(`${e}T00:00:00`);
	return Number.isNaN(n.getTime()) ? e : n.toLocaleDateString();
}, h = (e, n) => e ? t(e.type, n) : n, g = (e, t) => {
	let { value: n } = e;
	return n === void 0 ? "" : t?.type.kind === "boolean" && typeof n == "boolean" ? t.label : Array.isArray(n) ? n.map((e) => h(t, e)).join(", ") : t?.type.kind === "date" && typeof n == "string" ? m(n) : String(n);
}, _ = {
	boolean: ["False first", "True first"],
	number: ["1 → 9", "9 → 1"],
	date: ["Oldest first", "Newest first"],
	enum: ["Option order", "Reverse order"]
}, v = (e, t) => {
	let [n, r] = _[e?.type.kind ?? ""] ?? ["A → Z", "Z → A"];
	return t === "asc" ? n : r;
};
export { v as a, g as i, m as n, l as o, f as r, d as t };
