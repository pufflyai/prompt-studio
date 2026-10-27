// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e } from "./collections-CVGR0OYX.ts";
// packages/pstdio-dashboard/src/lib/sync/runtime-state.ts
var t = (t, n) => {
	let r = /* @__PURE__ */ new WeakMap();
	return (i = e()) => {
		let a = r.get(i);
		if (a === void 0) {
			a = t();
			let e = a;
			r.set(i, a), i.onDispose(() => {
				n?.(e), r.delete(i);
			});
		}
		return a;
	};
}, n = () => {
	let n = t(() => /* @__PURE__ */ new Set(), (e) => e.clear());
	return {
		subscribe: (t, r = e()) => {
			let i = n(r);
			return i.add(t), () => {
				i.delete(t);
			};
		},
		publish: (t, r = e()) => {
			if (!r.isDisposed()) for (let e of n(r)) e(t);
		}
	};
};
export { t as n, n as t };
