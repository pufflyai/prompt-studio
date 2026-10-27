// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { VIEW_FILTER_CONDITIONS as e } from "@pstdio/sdk/extensions";
// packages/ui/src/components/kanban-renderer/types.ts
var t = "none", n = (e) => !Array.isArray(e), r = {
	viewMode: "board",
	columnGrouping: t,
	rowGrouping: t,
	displayProperties: []
}, i = (e, t) => {
	if (t && t !== "none") return e.find((e) => e.id === t);
}, a = (e) => {
	let t = /* @__PURE__ */ new Set();
	return e.filter((e) => !t.has(e.value) && (t.add(e.value), !0));
}, o = (e) => e.kind !== "enum" && e.kind !== "enum-multi" ? [] : a(n(e.options) ? e.options.getSnapshot() : e.options), s = (e) => e.replaceAll("_", " ").split(" ").filter((e) => e.length > 0).map((e) => e[0].toUpperCase() + e.slice(1)).join(" "), c = (e, t) => {
	if (e.kind === "enum" || e.kind === "enum-multi") return o(e).find((e) => e.value === t);
}, l = (e, t) => c(e, t)?.label ?? s(t), u = {
	id: "title",
	label: "Title",
	type: { kind: "string" },
	filterable: !0,
	sortable: !0
}, d = (e) => e.some((e) => e.id === u.id) ? e : [u, ...e], f = (e, t) => e.find((e) => e.id === t), p = (e) => e.type.kind === "enum" || e.type.kind === "enum-multi" || e.type.kind === "user", m = (e) => e.sortable === !0 && e.type.kind !== "enum-multi", h = (t) => e[t.type.kind], g = {
	"is-any-of": "has-any-of",
	"has-any-of": "is-any-of",
	"is-none-of": "has-none-of",
	"has-none-of": "is-none-of"
}, _ = (e, t) => {
	let n = h(e);
	if (n.includes(t)) return t;
	let r = g[t];
	return r && n.includes(r) ? r : void 0;
}, v = (e, t) => {
	let n = t === u ? e.title : e.attributes[t.id];
	return t.type.kind === "enum-multi" ? Array.isArray(n) ? n.filter((e) => typeof e == "string") : [] : n;
}, y = (e, t) => {
	let n = v(e, t);
	return t.type.kind === "boolean" ? typeof n == "boolean" ? [String(n)] : [] : t.type.kind === "enum-multi" ? n : n == null ? [] : typeof n == "string" ? n === "" ? [] : [n] : typeof n == "number" || typeof n == "boolean" ? [String(n)] : [];
}, b = /^(\d{4})-(\d{2})-(\d{2})$/, x = (e) => {
	if (typeof e != "string" && typeof e != "number") return;
	let t = typeof e == "string" ? b.exec(e) : null, n = t ? new Date(Number(t[1]), Number(t[2]) - 1, Number(t[3])) : new Date(e);
	return Number.isNaN(n.getTime()) ? void 0 : n;
}, S = (e, t) => {
	let n = y(e, t);
	if (t.type.kind === "enum" || t.type.kind === "enum-multi") return n.map((e) => l(t.type, e));
	if (t.type.kind !== "date") return n;
	let r = x(v(e, t));
	return r ? [r.toLocaleDateString()] : n;
};
export { i as _, S as a, p as c, l as d, c as f, t as g, r as h, f as i, x as l, s as m, m as n, y as o, o as p, h as r, v as s, _ as t, d as u, n as v };
