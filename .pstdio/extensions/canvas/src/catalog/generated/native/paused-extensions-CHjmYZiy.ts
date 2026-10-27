// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useSyncExternalStore as e } from "react";
// packages/pstdio-dashboard/src/shared/extensions/paused-extensions.ts
var t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = (e) => {
	t = e;
	for (let e of n) e();
}, i = {
	get: () => t,
	pause: (e) => {
		t.has(e) || r(/* @__PURE__ */ new Set([...t, e]));
	},
	resume: (e) => {
		t.has(e) && r(new Set([...t].filter((t) => t !== e)));
	},
	subscribe: (e) => (n.add(e), () => {
		n.delete(e);
	})
}, a = () => e(i.subscribe, i.get);
export { a as n, i as t };
