// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/pstdio-dashboard/src/shared/app/project-context.ts
var e = "dashboard.project.id", t = "dashboard.project.name", n = (t) => {
	let n = t.context.get(e);
	return typeof n == "string" ? n : void 0;
}, r = (e) => {
	let n = e.context.get(t);
	return typeof n == "string" ? n : void 0;
}, i = (n, r, i) => {
	i?.setSelectedProjectId(r.id), n.context.set(e, r.id), n.context.set(t, r.name);
}, a = (n, r) => {
	n.context.delete(e), n.context.delete(t), r?.setSelectedProjectId(void 0);
}, o = (t, n) => t.context.store.subscribeSelector((t) => t.values[e], n);
export { r as a, n as i, e as n, i as o, t as r, o as s, a as t };
