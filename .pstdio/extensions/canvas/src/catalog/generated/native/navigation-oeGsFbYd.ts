// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { X as e } from "./workbench-core-kaLFKJEn.ts";
// packages/pstdio-api-contracts/src/extension-kernel/navigation-href.ts
var t = (e) => {
	if (typeof e != "string") return !1;
	try {
		let { protocol: t } = new URL(e);
		return t === "https:" || t === "http:";
	} catch {
		return !1;
	}
}, n = (e) => !(!e || typeof e != "object" || Array.isArray(e)), r = (e, t) => n(e) && e.kind === t && typeof e.id == "string", i = (e) => n(e) && typeof e.type == "string" && typeof e.id == "string", a = (e) => e === void 0 || e === "preview" || e === "pin", o = (t, s = /* @__PURE__ */ new Set()) => {
	if (!n(t) || t.kind !== "page" || !r(t.page, "page") || s.has(t) || t.resource !== void 0 && !i(t.resource) || t.section !== void 0 && !n(t.section) || t.position !== void 0 && (!e(t.position) || t.section !== void 0) || !a(t.open) || t.intent !== void 0 && t.intent !== "open" && t.intent !== "restore") return !1;
	if (t.parent === void 0) return !0;
	let c = new Set(s);
	return c.add(t), o(t.parent, c);
}, s = (e) => {
	if (!n(e) || e.kind !== "panel" || !n(e.panel)) return !1;
	let t = e.panel;
	return (r(t, "placement") || t.kind === "page-slot" && r(t.page, "page") && typeof t.id == "string") && (e.resource === void 0 || i(e.resource)) && a(e.open);
}, c = (a) => n(a) ? a.kind === "page" ? o(a) : a.kind === "panel" ? s(a) : a.kind === "viewer" ? (a.operation === "switch" || a.operation === "replace") && (a.from === void 0 ? r(a.page, "page") : i(a.from)) && i(a.resource) && (a.page === void 0 || r(a.page, "page")) && (a.section === void 0 || n(a.section)) && (a.position === void 0 || e(a.position) && a.section === void 0) && Object.keys(a).every((e) => [
	"kind",
	"operation",
	"from",
	"resource",
	"page",
	"section",
	"position"
].includes(e)) : a.kind === "href" ? t(a.href) : a.kind === "command" && n(a.target) && r(a.target.command, "command") && (a.target.params === void 0 || n(a.target.params)) : !1, l = (e) => c(e) ? !0 : !n(e) || e.kind !== "compound" || !Array.isArray(e.targets) || e.targets.length === 0 ? !1 : e.targets.every((e) => o(e) || s(e)), u = (e, t) => e.extensionId !== void 0 || t === void 0 ? e : {
	...e,
	extensionId: t
}, d = (e, t, n) => ({
	...e,
	page: u(e.page, t),
	...e.resource ? { resource: f(e.resource, t, n) } : {},
	...e.parent ? { parent: d(e.parent, t, n) } : {}
}), f = (e, t, n) => ({
	...e,
	extensionId: e.extensionId ?? t,
	projectId: e.projectId ?? n
}), p = (e, t, n) => {
	if (!l(e)) throw Error("Invalid navigation target.");
	return e.kind === "page" ? d(e, t, n) : e.kind === "viewer" ? {
		...e,
		...e.from ? { from: f(e.from, t, n) } : {},
		resource: f(e.resource, t, n),
		...e.page ? { page: u(e.page, t) } : {}
	} : e.kind === "panel" ? {
		...e,
		panel: e.panel.kind === "page-slot" ? {
			...e.panel,
			page: u(e.panel.page, t)
		} : u(e.panel, t),
		...e.resource ? { resource: f(e.resource, t, n) } : {}
	} : e.kind === "command" ? {
		...e,
		target: {
			...e.target,
			command: u(e.target.command, t)
		}
	} : e.kind === "href" ? e : {
		...e,
		targets: e.targets.map((e) => p(e, t, n))
	};
};
export { p as n, t as r, l as t };
