// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./resource-registry-CVuZngrt.ts";
import { resourceKey as t } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/react/renderers/tree/tree-list-selection.ts
var n = (e) => {
	let t = [...new Set(e)];
	if (t.length !== 0) return t.length === 1 ? t[0] : t;
}, r = (e) => {
	if (e) return [...e.kind === "compound" ? e.targets : [e]].reverse().find((e) => e.kind === "panel")?.resource;
}, i = (e) => {
	let n = e.resource ?? r(e.target);
	return n ? t(n) : void 0;
}, a = (e, t) => e.flatMap((e) => [e, ...a([...e.children ?? [], ...t[e.id] ?? []], t)]), o = (e, t) => e.flatMap((e) => a(e.nodes, t)), s = (e, t, r) => {
	let a = o(e, t);
	for (let e of r) {
		let t = a.filter((t) => t.id === e || i(t) === e).map((e) => e.id);
		if (t.length > 0) return n(t);
	}
}, c = (e, t, n) => o(e, n).find((e) => e.id === t), l = (e, t) => e.id === t.id && e.extensionId === t.extensionId, u = (e, n, i) => !e || r(e) ? !1 : (e.kind === "compound" ? e.targets : [e]).some((e) => e.kind === "page" && l(e.page, n) && (e.resource ? i !== void 0 && t(e.resource) === t(i) : i === void 0)), d = (e, t, r, i) => {
	if (r) return n(o(e, t).filter((e) => u(e.target, r, i)).map((e) => e.id));
}, f = (t) => {
	let { sections: r, childrenByNodeId: a, activeNodeId: l, activeLocation: f, activeResource: p, selectedNodeId: m } = t;
	if (l) return l;
	let h = e(p), g = n(o(r, a).filter((e) => {
		if (!e.selected) return !1;
		let t = i(e);
		return !t && !e.target || t && h.includes(t) ? !0 : f ? u(e.target, f.page, p) : !p;
	}).map((e) => e.id));
	if (g) return g;
	let _ = m ? c(r, m, a) : void 0, v = _ ? i(_) : void 0;
	if (v && h.includes(v) || f && u(_?.target, f.page, p)) return m;
	let y = s(r, a, h);
	if (y) return y;
	let b = d(r, a, f?.page, f?.resource);
	if (b) return b;
	if (m && !v) return m;
}, p = (t) => {
	if (!t.selectedNodeId) return;
	let n = c(t.sections, t.selectedNodeId, t.childrenByNodeId);
	if (!n) return;
	let r = i(n);
	if (!r && !n.target || r && e(t.activeResource).includes(r) || t.activeLocation && u(n.target, t.activeLocation.page, t.activeResource)) return n.id;
};
export { p as n, f as t };
