// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./browser-storage-CFZrWu9H.ts";
import { createContext as n, useContext as r } from "react";
import { jsx as i } from "react/jsx-runtime";
// packages/ui/src/utils/host-storage.tsx
var a = n(void 0), o = (e) => {
	let { storage: t, children: n } = e;
	return /* @__PURE__ */ i(a, {
		value: t,
		children: n
	});
}, s = () => r(a), c = (n) => e(() => n ? {
	getItem: (e) => n.getItem(e),
	setItem: (e, t) => n.setItem(e, t),
	removeItem: (e) => n.removeItem?.(e)
} : t()), l = (e) => {
	let t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new Map();
	return (r, i, ...a) => {
		let o = i ? t.get(i) : n;
		o || (o = /* @__PURE__ */ new Map(), t.set(i, o));
		let s = o.get(r);
		if (s) return s;
		let c = e(r, i, ...a);
		return o.set(r, c), c;
	};
};
export { s as i, c as n, l as r, o as t };
