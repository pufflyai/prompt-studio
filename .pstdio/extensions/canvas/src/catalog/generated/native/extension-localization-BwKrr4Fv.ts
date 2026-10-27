// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./config-D-5Hdhn-.ts";
import { a as t } from "./collections-CVGR0OYX.ts";
import { n } from "./runtime-state-DUeC3JNx.ts";
n(() => /* @__PURE__ */ new Map(), (e) => e.clear());
var r = (e, n = t()) => `ext:${n.id}:${e}`, i = (e) => typeof e == "object" && !!e && "$l10n" in e && typeof e.$l10n == "string", a = (e, t) => Object.entries(t ?? {}).reduce((e, [t, n]) => e.replaceAll(`{{${t}}}`, String(n)), e), o = (n, o, s, c = t()) => {
	if (n === void 0) return "";
	if (!i(n)) return n;
	let l = n.default ?? n.$l10n;
	return o ? e.t(n.$l10n, {
		defaultValue: l,
		ns: r(o, c),
		replace: s
	}) : a(l, s);
};
export { o as t };
