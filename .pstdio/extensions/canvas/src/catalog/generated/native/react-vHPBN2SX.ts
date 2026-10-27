// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import e from "react";
// node_modules/.bun/zustand@5.0.11+a8ae0598b29e5fe6/node_modules/zustand/esm/vanilla.mjs
var t = (e) => {
	let t, n = /* @__PURE__ */ new Set(), r = (e, r) => {
		let i = typeof e == "function" ? e(t) : e;
		if (!Object.is(i, t)) {
			let e = t;
			t = r ?? (typeof i != "object" || !i) ? i : Object.assign({}, t, i), n.forEach((n) => n(t, e));
		}
	}, i = () => t, a = {
		setState: r,
		getState: i,
		getInitialState: () => o,
		subscribe: (e) => (n.add(e), () => n.delete(e))
	}, o = t = e(r, i, a);
	return a;
}, n = ((e) => e ? t(e) : t), r = (e) => e;
function i(t, n = r) {
	let i = e.useSyncExternalStore(t.subscribe, e.useCallback(() => n(t.getState()), [t, n]), e.useCallback(() => n(t.getInitialState()), [t, n]));
	return e.useDebugValue(i), i;
}
var a = (e) => {
	let t = n(e), r = (e) => i(t, e);
	return Object.assign(r, t), r;
}, o = ((e) => e ? a(e) : a);
export { i as n, n as r, o as t };
