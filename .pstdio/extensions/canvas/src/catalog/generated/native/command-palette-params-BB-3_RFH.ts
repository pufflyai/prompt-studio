// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { resourceKey as e } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/core/registries/commands/command-resource-params.ts
var t = (e) => typeof e == "object" && !!e && !Array.isArray(e), n = (e) => e.replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (e, t) => t.toUpperCase()).replace(/^[A-Z]/, (e) => e.toLowerCase()), r = (e, t) => {
	let n = e?.[t];
	if (typeof n == "string") return n;
	if (typeof n == "number") return String(n);
}, i = (t, i) => {
	let a = i?.resource;
	if (!a) return;
	let o = r(a.metadata, t.key);
	if (o !== void 0) return o;
	if (t.key === `${n(a.type)}Id`) return a.id ?? e(a);
	if (t.type === "resource" && (!t.resourceType || t.resourceType === a.type)) return {
		type: a.type,
		id: a.id ?? e(a),
		...a.label ? { label: a.label } : {},
		...a.metadata ? { metadata: a.metadata } : {}
	};
}, a = (e, n, r) => {
	let a = t(n) ? n : {};
	return Object.fromEntries(Object.entries(e ?? {}).map(([e, t]) => ({
		...t,
		key: e
	})).filter((e) => e.resolvedFrom === "resource").map((e) => [e.key, Object.hasOwn(a, e.key) ? a[e.key] : i(e, r)]));
}, o = (e) => {
	let t = e.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").trim();
	return t.charAt(0).toUpperCase() + t.slice(1);
}, s = (e) => typeof e == "object" && !!e && !Array.isArray(e), c = (e) => !s(e) || !s(e.file) ? !1 : typeof e.id == "string" && typeof e.file.name == "string" && typeof e.status == "string", l = (e) => s(e) && Array.isArray(e.refs) && e.refs.every((e) => typeof e == "string") && Array.isArray(e.uploads) && e.uploads.every(c), u = (e = {}) => ({
	refs: [...e.refs ?? []],
	uploads: [...e.uploads ?? []]
}), d = (e, t) => {
	let n = l(e) ? u(e) : u({
		refs: Array.isArray(e) ? e.filter((e) => typeof e == "string") : [],
		uploads: Array.isArray(e) ? e.filter(c) : []
	});
	return t === !1 ? n.uploads[0] ? u({ uploads: [n.uploads[0]] }) : u({ refs: n.refs.slice(0, 1) }) : n;
}, f = (e) => e == null ? "" : typeof e == "string" ? e : typeof e == "number" || typeof e == "boolean" ? String(e) : JSON.stringify(e), p = (e) => {
	if (!Array.isArray(e)) return e;
	let t = /* @__PURE__ */ new Set();
	return e.filter((e) => !t.has(e.value) && (t.add(e.value), !0));
}, m = (e) => g(e).length > 0, h = (e) => Object.entries(e ?? {}).map(([e, t]) => ({
	...t,
	options: p(t.options),
	key: e,
	label: t.label ?? o(e)
})), g = (e) => h(e).filter((e) => e.resolvedFrom !== "resource"), _ = (e, t, n, r) => {
	let i = n?.resource;
	if (r?.kind !== "rename" || e !== r.labelParam || i?.type !== r.resourceType) return;
	let a = t[r.idParam];
	return a === void 0 || a === i.id ? i.label : void 0;
}, v = (e, t, n, r) => {
	let a = s(t) ? t : {}, o = {};
	for (let t of g(e)) {
		let e = Object.hasOwn(a, t.key) ? a[t.key] : _(t.key, a, n, r) ?? i(t, n) ?? t.defaultValue;
		t.type === "boolean" ? o[t.key] = e === void 0 ? void 0 : e === !0 || e === "true" : t.type === "files" ? o[t.key] = d(e, t.multiple) : t.type === "multi-select" ? o[t.key] = Array.isArray(e) ? e.map(String) : [] : o[t.key] = f(e);
	}
	return o;
}, y = (e) => l(e) ? e.refs.length === 0 && e.uploads.length === 0 : e === void 0 || e === "" || Array.isArray(e) && e.length === 0, b = (e, t) => {
	if (typeof t != "string") return t;
	try {
		return JSON.parse(t);
	} catch {
		throw Error(`Invalid JSON for ${e.label}`);
	}
}, x = (e, t) => {
	if (e.type === "number") {
		let n = Number(t);
		if (!Number.isFinite(n)) throw Error(`Invalid number for ${e.label}`);
		return n;
	}
	return e.type === "boolean" ? t === !0 || t === "true" : e.type === "files" ? l(t) ? t : u() : e.type === "json" || e.type === "resource" || e.type === "harness" || e.type === "workspace" ? b(e, t) : e.type === "multi-select" ? Array.isArray(t) ? t : String(t).split(",").filter(Boolean) : String(t ?? "");
}, S = (e, t) => {
	let n = {};
	for (let r of g(e)) {
		let e = t[r.key];
		if (y(e)) {
			if (r.required) throw Error(`Missing required parameter: ${r.label}`);
		} else n[r.key] = x(r, e);
	}
	return n;
}, C = (e, t, n) => {
	let r = s(e) ? { ...e } : {};
	for (let e of g(n)) delete r[e.key];
	return {
		...r,
		...t
	};
};
export { c as a, S as c, l as i, a as l, u as n, g as o, m as r, C as s, v as t };
