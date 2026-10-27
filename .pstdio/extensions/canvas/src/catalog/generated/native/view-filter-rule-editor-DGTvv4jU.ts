// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./x-DqEAa6-d.ts";
import { r as t } from "./collection-view-fields-D15M65ck.ts";
import { n, s as r } from "./filter-rule-value-y7_Oj9HU.ts";
import { o as i, t as a } from "./collection-view-labels-C1iICfrD.ts";
import { createContext as o, useContext as s } from "react";
import { HStack as c, Icon as l, IconButton as u, Stack as d, Text as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-item-label.tsx
var h = o("Item"), g = () => s(h), _ = (e, t) => t === "is-empty" || t === "is-not-empty" ? {
	attributeId: e.attributeId,
	condition: t
} : {
	...e,
	condition: t
}, v = (e) => {
	let { field: t, rule: n, width: r, onChange: a } = e, o = n.condition === "is-empty" || n.condition === "is-not-empty", s = [
		"is-none-of",
		"has-none-of",
		"is-not-empty"
	].includes(n.condition), c = t.type.kind === "enum-multi" ? "has-any-of" : "is-any-of", l = t.type.kind === "enum-multi" ? "has-none-of" : "is-none-of", u = Array.isArray(n.value) && n.value.length > 1;
	return /* @__PURE__ */ p(i, {
		"aria-label": "Condition",
		width: r,
		variant: e.variant,
		options: [{
			value: "is",
			label: u ? "is any of" : "is"
		}, {
			value: "is-not",
			label: "is not"
		}],
		value: s ? "is-not" : "is",
		onSelect: (e) => {
			e !== (s ? "is-not" : "is") && a(o ? {
				attributeId: n.attributeId,
				condition: e === "is" ? "is-empty" : "is-not-empty"
			} : {
				...n,
				condition: e === "is" ? c : l
			});
		}
	});
}, y = (e) => {
	let { field: n, rule: r, width: o, onChange: s } = e, c = n.type.kind === "boolean";
	if ([
		"enum",
		"enum-multi",
		"user"
	].includes(n.type.kind) || Array.isArray(r.value)) return /* @__PURE__ */ p(v, { ...e });
	let l = r.condition;
	c && r.value === !1 && (r.condition === "is" && (l = "is-not"), r.condition === "is-not" && (l = "is"));
	let u = c ? ["is", "is-not"] : t(n), d = u.includes(r.condition) ? u : [r.condition, ...u];
	return /* @__PURE__ */ p(i, {
		"aria-label": "Condition",
		variant: e.variant,
		open: e.open,
		onOpenChange: e.onOpenChange,
		width: o,
		options: d.map((e) => ({
			value: e,
			label: a(e, n)
		})),
		value: l,
		onSelect: (e) => {
			if (e === l && (!c || typeof r.value == "boolean")) return;
			let t = e, n = _(!u.includes(r.condition) && Array.isArray(r.value) ? {
				attributeId: r.attributeId,
				condition: r.condition
			} : r, t);
			if (c && (t === "is" || t === "is-not")) {
				let e = r.condition === "is-not";
				s({
					attributeId: r.attributeId,
					condition: e ? "is-not" : "is",
					value: e ? t === "is-not" : t === "is"
				});
			} else s(n);
		}
	});
}, b = (t) => {
	let { field: i, rule: a, options: o, onChange: s, onDelete: h } = t, _ = g();
	return /* @__PURE__ */ m(d, {
		"data-testid": "view-filter-rule-editor",
		gap: "2xs",
		minW: "0",
		children: [/* @__PURE__ */ m(c, {
			gap: "xs",
			paddingX: "xs",
			paddingTop: "2xs",
			children: [
				/* @__PURE__ */ p(f, {
					textStyle: "label/S/regular",
					color: "fg.muted",
					flexShrink: 0,
					children: i.type.kind === "boolean" && typeof a.value == "boolean" ? _ : i.label
				}),
				/* @__PURE__ */ p(y, {
					field: i,
					rule: a,
					onChange: s
				}),
				/* @__PURE__ */ p(u, {
					"aria-label": "Remove filter",
					variant: "ghost",
					size: "2xs",
					marginLeft: "auto",
					onClick: h,
					children: /* @__PURE__ */ p(l, { as: e })
				})
			]
		}), /* @__PURE__ */ p(n, {
			field: i,
			rule: a,
			options: o,
			onChange: (e) => s(r(i, a, e))
		})]
	});
};
export { g as i, b as n, h as r, y as t };
