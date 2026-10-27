// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./lucide-react-DrMf1u5h.ts";
import { t } from "./tooltip-BweQW627.ts";
import { _ as n, d as r, f as i, g as a, m as o, o as s, p as c, s as l } from "./collection-view-fields-D15M65ck.ts";
import { n as u } from "./collection-view-filter-C1-8HUTj.ts";
import { n as d, t as f } from "./collection-view-grouping-B8HGb2BH.ts";
import { createElement as p } from "react";
import { Badge as m, Icon as h, Text as g } from "@chakra-ui/react";
import { Fragment as _, jsx as v, jsxs as y } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/collection-badge.tsx
var b = (e) => e.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((e) => `${e.charAt(0).toUpperCase()}${e.slice(1)}`).join(""), x = (t) => {
	if (!t) return;
	let n = b(t);
	for (let r of [
		t,
		n,
		`${n}Icon`
	]) {
		let t = e[r];
		if (t && (typeof t == "function" || typeof t == "object")) return t;
	}
}, S = (e) => {
	let { label: n, icon: r, color: i, tooltip: a, onClick: o } = e, s = x(r), c = /* @__PURE__ */ y(_, { children: [s ? /* @__PURE__ */ v(h, {
		as: s,
		boxSize: "3.5",
		flexShrink: 0,
		"aria-hidden": "true"
	}) : null, /* @__PURE__ */ v(g, {
		as: "span",
		textStyle: "label/XS/medium",
		minW: "0",
		maxW: "10rem",
		truncate: !0,
		children: n
	})] }), l = {
		display: "inline-flex",
		gap: "2xs",
		alignItems: "center",
		minW: "0",
		maxW: "100%",
		variant: i ? "subtle" : "ticket",
		colorPalette: i ?? "gray",
		size: "sm",
		textStyle: "label/XS/medium",
		"data-testid": "collection-badge"
	}, u = o ? /* @__PURE__ */ v(m, {
		asChild: !0,
		...l,
		cursor: "pointer",
		children: /* @__PURE__ */ v("button", {
			type: "button",
			"aria-label": a,
			onClick: (e) => {
				e.stopPropagation(), o();
			},
			children: c
		})
	}) : /* @__PURE__ */ v(m, {
		as: "span",
		...l,
		cursor: "default",
		children: c
	});
	return a ? /* @__PURE__ */ v(t, {
		content: a,
		children: u
	}) : u;
}, C = (e, t) => e.length === 0 ? null : e.length <= 2 ? e.map((e) => r(t, e)).join(", ") : `${r(t, e[0])}, ${r(t, e[1])} +${e.length - 2}`, w = (e, t, n) => {
	if (t.kind !== "enum") return null;
	let r = typeof n == "string" ? n : null, a = e.editable === !0;
	if (!r) return a ? {
		attributeId: e.id,
		attributeLabel: e.label,
		label: e.label,
		value: r ?? void 0,
		options: c(t),
		isEditable: !0
	} : null;
	let s = i(t, r);
	return {
		attributeId: e.id,
		attributeLabel: e.label,
		label: s?.label ?? o(r),
		color: s?.color,
		icon: s?.icon,
		...a ? {
			value: r,
			options: c(t),
			isEditable: !0
		} : {}
	};
}, T = (e, t, n) => {
	if (t.kind !== "enum-multi") return null;
	let r = Array.isArray(n) ? n.filter((e) => typeof e == "string") : [], a = C(r, t), o = e.editable === !0;
	if (!a) return o ? {
		attributeId: e.id,
		attributeLabel: e.label,
		label: e.label,
		value: r,
		options: c(t),
		isEditable: !0
	} : null;
	let s = r[0] ? i(t, r[0]) : void 0;
	return {
		attributeId: e.id,
		attributeLabel: e.label,
		label: a,
		color: s?.color,
		icon: s?.icon,
		...o ? {
			value: r,
			options: c(t),
			isEditable: !0
		} : {}
	};
}, E = (e) => {
	if (typeof e != "string" || e === "") return null;
	let t = new Date(e);
	return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString();
}, D = (e) => typeof e == "number" && Number.isFinite(e) ? String(e) : typeof e == "string" && e !== "" && !Number.isNaN(Number(e)) ? e : null, O = (e) => e == null ? null : typeof e == "string" ? e === "" ? null : e : String(e), k = (e) => O(e), A = (e) => e != null && e !== !1, j = (e) => typeof e == "object" && !!e && !Array.isArray(e), M = (e) => typeof e == "string" && e.trim() ? e.trim() : void 0, N = (e) => j(e) && typeof e.type == "string" && typeof e.id == "string", P = (e) => Array.isArray(e) ? e.flatMap((e) => {
	if (!j(e)) return [];
	let t = M(e.id);
	if (!t) return [];
	let n = M(e.label) ?? t, r = M(e.icon), i = M(e.color), a = M(e.tooltip), o = N(e.resource) ? e.resource : void 0;
	return [{
		id: t,
		label: n,
		icon: r,
		color: i,
		tooltip: a,
		...o ? { resource: o } : {}
	}];
}) : [], F = (e, t, n, r, i) => {
	if (e.display?.kind !== "badge-list") return null;
	let a = P(n.attributes[e.display.itemsAttributeId]);
	if (a.length === 0) return null;
	let o = typeof t == "string" ? t : void 0, s = a.find((e) => e.id === o) ?? a[0];
	return s ? [s, ...a.filter((e) => e.id !== s.id)].map((e) => p(S, {
		key: e.id,
		label: e.label,
		icon: e.icon,
		color: e.color,
		tooltip: e.tooltip,
		onClick: i?.(e.id) ?? (e.resource && r ? () => r(e.resource) : void 0)
	})) : null;
}, I = (e, t) => {
	let n = e.type, r = l(t, e);
	if (e.render || e.display) return null;
	if (n.kind === "enum") return w(e, n, r);
	if (n.kind === "enum-multi") return T(e, n, r);
	if (n.kind === "date") {
		let t = E(r);
		return t ? {
			attributeId: e.id,
			label: t
		} : null;
	}
	if (n.kind === "number") {
		let t = D(r);
		return t ? {
			attributeId: e.id,
			label: t
		} : null;
	}
	if (n.kind === "user") {
		let t = k(r);
		return t ? {
			attributeId: e.id,
			label: t,
			color: "blue"
		} : null;
	}
	let i = O(r);
	return i ? {
		attributeId: e.id,
		label: i
	} : null;
}, L = (e, t, r) => {
	let i = [];
	for (let a of r) {
		let r = n(t, a);
		if (!r || r.displayable === !1) continue;
		let o = I(r, e);
		o && i.push(o);
	}
	return i;
}, R = (e, t, r) => {
	let i = [];
	for (let a of r) {
		let r = n(t, a);
		if (!r || r.displayable === !1) continue;
		let o = l(e, r), s = r.render ? r.render(o, e) : F(r, o, e);
		A(s) && i.push(s);
	}
	return i;
}, z = (e, t) => {
	let n = /* @__PURE__ */ new Set();
	for (let r of e) for (let e of s(r, t)) n.add(e);
	return n;
}, B = (e, t) => {
	let n = [];
	for (let r of e) {
		if (!r.filterable) continue;
		if (r.type.kind === "enum" || r.type.kind === "enum-multi") {
			let e = c(r.type), i = z(t, r), a = new Set(e.map((e) => e.value)), s = [...i].filter((e) => !a.has(e)).sort((e, t) => e.localeCompare(t, void 0, { numeric: !0 })).map((e) => ({
				value: e,
				label: o(e)
			}));
			n.push({
				id: r.id,
				label: r.label,
				selectionMode: "multiple",
				options: [...e.map((e) => ({
					value: e.value,
					label: e.label,
					color: e.color,
					icon: e.icon
				})), ...s]
			});
			continue;
		}
		let e = [...z(t, r)].sort((e, t) => e.localeCompare(t, void 0, { numeric: !0 })).map((e) => ({
			value: e,
			label: o(e)
		}));
		n.push({
			id: r.id,
			label: r.label,
			selectionMode: "multiple",
			options: e
		});
	}
	return n;
}, V = (e) => {
	let t = [{
		value: a,
		label: "None"
	}];
	for (let n of e) n.groupable && n.type.kind !== "enum-multi" && t.push({
		value: n.id,
		label: n.label
	});
	return t;
}, H = (e) => {
	let t = [];
	for (let n of e) n.displayable && t.push({
		value: n.id,
		label: n.label
	});
	return t;
}, U = (e, t) => t === "none" ? e.filter((e) => e.value === a) : e.filter((e) => e.value === "none" || e.value !== t), W = (e, t) => e === "none" ? "all" : t?.columnKey, G = (e, t, r, i = []) => {
	if (e === "none") return;
	let a = n(t, e);
	if (!a || a.type.kind !== "enum") return;
	let o = c(a.type).map((e) => e.value), s = f(a);
	if (i.some((e) => d(e, a) === s) && o.push(s), r?.conjunction !== "and") return o;
	let l = o.map((t) => ({
		id: t,
		title: t,
		attributes: t === s ? {} : { [e]: t }
	}));
	return u(l, {
		conjunction: "and",
		rules: r.rules.filter((t) => t.attributeId === e)
	}, [a]).map((e) => e.id);
};
export { R as a, W as c, L as i, U as l, B as n, F as o, V as r, G as s, H as t, S as u };
