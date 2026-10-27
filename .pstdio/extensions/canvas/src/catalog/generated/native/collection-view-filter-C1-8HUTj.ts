// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, l as t, o as n, s as r, t as i } from "./collection-view-fields-D15M65ck.ts";
import { normalizeBooleanViewRule as a } from "@pstdio/sdk/extensions";
// packages/ui/src/components/collection-view/collection-view-filter.ts
var o = /^today([+-]\d+)?$/, s = /^(\d{4})-(\d{2})-(\d{2})$/, c = (e) => e.getFullYear() * 1e4 + (e.getMonth() + 1) * 100 + e.getDate(), l = (e, t) => {
	let n = o.exec(e);
	if (n) {
		let e = Number(n[1] ?? 0);
		return c(new Date(t.getFullYear(), t.getMonth(), t.getDate() + e));
	}
	let r = s.exec(e);
	if (r) return Number(r[1]) * 1e4 + Number(r[2]) * 100 + Number(r[3]);
}, u = (e) => {
	let n = t(e);
	return n && c(n);
}, d = (e) => {
	if (typeof e == "number") return Number.isFinite(e) ? e : void 0;
	if (typeof e == "string" && e.trim() !== "" && Number.isFinite(Number(e))) return Number(e);
}, f = (e, t) => n(e, t).join(" ").toLowerCase(), p = {
	is: (e, t) => e === t,
	gt: (e, t) => e > t,
	gte: (e, t) => e >= t,
	lt: (e, t) => e < t,
	lte: (e, t) => e <= t,
	"is-before": (e, t) => e < t,
	"is-after": (e, t) => e > t,
	"is-on-or-before": (e, t) => e <= t,
	"is-on-or-after": (e, t) => e >= t
}, m = (e, t, n) => {
	if (t === "is-not") return (t) => e(t) !== n;
	let r = p[t];
	return (t) => {
		let i = e(t);
		return i !== void 0 && r(i, n);
	};
}, h = (e, t, r) => {
	if (r.length === 0) return;
	let i = (t) => n(t, e).filter((e) => r.includes(e));
	if (t === "is-any-of" || t === "has-any-of") return (e) => i(e).length > 0;
	if (t === "is-none-of" || t === "has-none-of") return (e) => i(e).length === 0;
	if (t === "has-all-of") return (e) => new Set(i(e)).size === new Set(r).size;
}, g = (e, t, n) => {
	if (n === "") return;
	let r = n.toLowerCase();
	if (t === "contains") return (t) => f(t, e).includes(r);
	if (t === "does-not-contain") return (t) => !f(t, e).includes(r);
	if (t === "is") return (t) => f(t, e) === r;
	if (t === "is-not") return (t) => f(t, e) !== r;
}, _ = (e, t, n, i) => {
	let a = e.type.kind;
	if (Array.isArray(n)) return h(e, t, n);
	if (a === "boolean" && typeof n == "boolean") return (i) => {
		let a = r(i, e);
		return t === "is-not" && a == null || typeof a == "boolean" && (t === "is" ? a === n : a !== n);
	};
	if (a === "number" && typeof n == "number") {
		let i = m(d, t, n);
		return (t) => i(r(t, e));
	}
	if (a === "date" && typeof n == "string") {
		let a = l(n, i);
		if (a === void 0) return;
		let o = m(u, t, a);
		return (t) => o(r(t, e));
	}
	if (a === "string" && typeof n == "string") return g(e, t, n);
}, v = (t, r, o) => {
	let s = e(r, t.attributeId);
	if (!s || s.filterable === !1) return;
	t = a(t, s.type);
	let c = i(s, t.condition);
	if (!c && s.type.kind !== "boolean" && ["is-any-of", "is-none-of"].includes(t.condition) && Array.isArray(t.value)) return h(s, t.condition, t.value);
	if (c) return c === "is-empty" ? (e) => n(e, s).length === 0 : c === "is-not-empty" ? (e) => n(e, s).length > 0 : _(s, c, t.value, o);
}, y = (e, t, n) => {
	let r = e.rules.flatMap((e) => {
		let r = v(e, t, n);
		return r ? [r] : [];
	});
	for (let i of e.groups ?? []) {
		let e = y(i, t, n);
		e && r.push(e);
	}
	if (r.length !== 0) return e.conjunction === "or" ? (e) => r.some((t) => t(e)) : (e) => r.every((t) => t(e));
}, b = (e, t, n, r = /* @__PURE__ */ new Date()) => {
	let i = y(t, n, r);
	return i ? e.filter(i) : e;
}, x = (e) => e.rules.length + (e.groups ?? []).reduce((e, t) => e + t.rules.length, 0);
export { b as n, x as t };
