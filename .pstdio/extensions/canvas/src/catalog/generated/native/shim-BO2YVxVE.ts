// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./rolldown-runtime-CwxnZyOB.ts";
import * as t from "react";
// builtin:esm-external-require-react
var n = /* @__PURE__ */ e(((e, n) => {
	n.exports = Object.prototype.hasOwnProperty.call(t, "module.exports") ? t["module.exports"] : { ...t };
})), r = /* @__PURE__ */ e(((e) => {
	var t = n();
	function r(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var i = typeof Object.is == "function" ? Object.is : r, a = t.useState, o = t.useEffect, s = t.useLayoutEffect, c = t.useDebugValue;
	function l(e, t) {
		var n = t(), r = a({ inst: {
			value: n,
			getSnapshot: t
		} }), i = r[0].inst, l = r[1];
		return s(function() {
			i.value = n, i.getSnapshot = t, u(i) && l({ inst: i });
		}, [
			e,
			n,
			t
		]), o(function() {
			return u(i) && l({ inst: i }), e(function() {
				u(i) && l({ inst: i });
			});
		}, [e]), c(n), n;
	}
	function u(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !i(e, n);
		} catch {
			return !0;
		}
	}
	function d(e, t) {
		return t();
	}
	var f = typeof window > "u" || window.document === void 0 || window.document.createElement === void 0 ? d : l;
	e.useSyncExternalStore = t.useSyncExternalStore === void 0 ? f : t.useSyncExternalStore;
})), i = /* @__PURE__ */ e(((e, t) => {
	t.exports = r();
}));
export { n, i as t };
