// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { d as e, i as t, l as n, n as r, o as i, p as a, s as o } from "./collection-view-fields-D15M65ck.ts";
// packages/ui/src/components/collection-view/collection-view-sort.ts
var s = (e, t, n) => {
	if (n.kind !== "enum" && n.kind !== "enum-multi") return 0;
	let r = a(n), i = (e) => {
		if (e === void 0) return r.length;
		let t = r.findIndex((t) => t.value === e);
		return t === -1 ? r.length + 1 : t;
	};
	return i(e) - i(t);
}, c = (e) => n(e)?.getTime() ?? NaN, l = (e, t, n) => {
	let r = o(e, n), a = o(t, n);
	if (n.compare) return n.compare(r, a);
	if (n.type.kind === "date") return c(r) - c(a);
	if (n.type.kind === "number") return Number(r) - Number(a);
	if (n.type.kind === "enum") {
		let [r] = i(e, n), [a] = i(t, n);
		return s(r, a, n.type);
	}
	return String(r).localeCompare(String(a), void 0, {
		numeric: !0,
		sensitivity: "base"
	});
}, u = (e, t) => {
	if (t.type.kind === "date") return n(o(e, t)) === void 0;
	let [r] = i(e, t);
	return r === void 0 || t.type.kind === "number" && !Number.isFinite(Number(r));
}, d = (e, n) => {
	let i = t(n, e.attributeId);
	if (!i || !r(i)) return;
	let a = e.direction === "asc" ? 1 : -1;
	return (e, t) => {
		let n = u(e, i), r = u(t, i);
		return n || r ? Number(n) - Number(r) : a * l(e, t, i);
	};
}, f = (e, t, n) => {
	let r = t[0], i = r ? d(r, n) : void 0;
	return i ? [...e].sort(i) : e;
}, p = (e) => `No ${e.label.toLowerCase()}`, m = (t, n) => t === p(n) ? t : n.type.kind === "enum" || n.type.kind === "enum-multi" ? e(n.type, t) : t, h = (e, t) => {
	if (e !== void 0) return t.type.kind !== "enum" && t.type.kind !== "enum-multi" || a(t.type).some((t) => t.value === e) ? e : void 0;
}, g = (e, t) => {
	let [n] = i(e, t);
	return h(n, t) ?? p(t);
}, _ = (e, t, n) => {
	let r = p(n);
	if (e === r || t === r) return Number(e === r) - Number(t === r);
	let i = s(e, t, n.type);
	return i === 0 ? e.localeCompare(t, void 0, { numeric: !0 }) : i;
}, v = (e, t, n = []) => {
	let r = new Map(n.map((e) => [e, []]));
	for (let n of e) {
		let e = g(n, t), i = r.get(e);
		i ? i.push(n) : r.set(e, [n]);
	}
	return [...r.entries()].sort(([e], [n]) => _(e, n, t)).map(([e, n]) => ({
		key: e,
		label: m(e, t),
		rows: n
	}));
};
export { f as i, g as n, v as r, p as t };
