// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { r as e, t } from "./i18nInstance-BLasvKSq.ts";
import { n, t as r } from "./context-CWGGhs3p.ts";
import { t as i } from "./shim-BO2YVxVE.ts";
import { useCallback as a, useContext as o, useEffect as s, useMemo as c, useRef as l, useState as u } from "react";
// node_modules/.bun/react-i18next@16.5.8+d976778d4c9f401e/node_modules/react-i18next/dist/es/utils.js
var d = (e, t, n, r) => {
	let i = [n, {
		code: t,
		...r || {}
	}];
	if (e?.services?.logger?.forward) return e.services.logger.forward(i, "warn", "react-i18next::", !0);
	v(i[0]) && (i[0] = `react-i18next:: ${i[0]}`), e?.services?.logger?.warn ? e.services.logger.warn(...i) : console?.warn && console.warn(...i);
}, f = {}, p = (e, t, n, r) => {
	v(n) && f[n] || (v(n) && (f[n] = /* @__PURE__ */ new Date()), d(e, t, n, r));
}, m = (e, t) => () => {
	if (e.isInitialized) t();
	else {
		let n = () => {
			setTimeout(() => {
				e.off("initialized", n);
			}, 0), t();
		};
		e.on("initialized", n);
	}
}, h = (e, t, n) => {
	e.loadNamespaces(t, m(e, n));
}, g = (e, t, n, r) => {
	if (v(n) && (n = [n]), e.options.preload && e.options.preload.indexOf(t) > -1) return h(e, n, r);
	n.forEach((t) => {
		e.options.ns.indexOf(t) < 0 && e.options.ns.push(t);
	}), e.loadLanguages(t, m(e, r));
}, _ = (e, t, n = {}) => !t.languages || !t.languages.length ? (p(t, "NO_LANGUAGES", "i18n.languages were undefined or empty", { languages: t.languages }), !0) : t.hasLoadedNamespace(e, {
	lng: n.lng,
	precheck: (t, r) => {
		if (n.bindI18n && n.bindI18n.indexOf("languageChanging") > -1 && t.services.backendConnector.backend && t.isLanguageChangingTo && !r(t.isLanguageChangingTo, e)) return !1;
	}
}), v = (e) => typeof e == "string", y = (e) => typeof e == "object" && !!e, b = i(), x = {
	t: (e, t) => {
		if (v(t)) return t;
		if (y(t) && v(t.defaultValue)) return t.defaultValue;
		if (typeof e == "function") return "";
		if (Array.isArray(e)) {
			let t = e[e.length - 1];
			return typeof t == "function" ? "" : t;
		}
		return e;
	},
	ready: !1
}, S = () => () => {}, C = (i, d = {}) => {
	let { i18n: f } = d, { i18n: m, defaultNS: y } = o(r) || {}, C = f || m || t();
	C && !C.reportNamespaces && (C.reportNamespaces = new n()), C || p(C, "NO_I18NEXT_INSTANCE", "useTranslation: You will need to pass in an i18next instance by using initReactI18next");
	let w = c(() => ({
		...e(),
		...C?.options?.react,
		...d
	}), [C, d]), { useSuspense: T, keyPrefix: E } = w, D = i || y || C?.options?.defaultNS, O = v(D) ? [D] : D || ["translation"], k = c(() => O, O);
	C?.reportNamespaces?.addUsedNamespaces?.(k);
	let A = l(0), j = a((e) => {
		if (!C) return S;
		let { bindI18n: t, bindI18nStore: n } = w, r = () => {
			A.current += 1, e();
		};
		return t && C.on(t, r), n && C.store.on(n, r), () => {
			t && t.split(" ").forEach((e) => C.off(e, r)), n && n.split(" ").forEach((e) => C.store.off(e, r));
		};
	}, [C, w]), M = l(), N = a(() => {
		if (!C) return x;
		let e = !!(C.isInitialized || C.initializedStoreOnce) && k.every((e) => _(e, C, w)), t = d.lng || C.language, n = A.current, r = M.current;
		if (r && r.ready === e && r.lng === t && r.keyPrefix === E && r.revision === n) return r;
		let i = {
			t: C.getFixedT(t, w.nsMode === "fallback" ? k : k[0], E),
			ready: e,
			lng: t,
			keyPrefix: E,
			revision: n
		};
		return M.current = i, i;
	}, [
		C,
		k,
		E,
		w,
		d.lng
	]), [P, F] = u(0), { t: I, ready: L } = (0, b.useSyncExternalStore)(j, N, N);
	s(() => {
		if (C && !L && !T) {
			let e = () => F((e) => e + 1);
			d.lng ? g(C, d.lng, k, e) : h(C, k, e);
		}
	}, [
		C,
		d.lng,
		k,
		L,
		T,
		P
	]);
	let R = C || {}, z = l(null), B = l(), V = (e) => {
		let t = Object.getOwnPropertyDescriptors(e);
		t.__original && delete t.__original;
		let n = Object.create(Object.getPrototypeOf(e), t);
		if (!Object.prototype.hasOwnProperty.call(n, "__original")) try {
			Object.defineProperty(n, "__original", {
				value: e,
				writable: !1,
				enumerable: !1,
				configurable: !1
			});
		} catch {}
		return n;
	}, H = c(() => {
		let e = R, t = e?.language, n = e;
		e && (z.current && z.current.__original === e && B.current === t ? n = z.current : (n = V(e), z.current = n, B.current = t));
		let r = [
			I,
			n,
			L
		];
		return r.t = I, r.i18n = n, r.ready = L, r;
	}, [
		I,
		R,
		L,
		R.resolvedLanguage,
		R.language,
		R.languages
	]);
	if (C && T && !L) throw new Promise((e) => {
		let t = () => e();
		d.lng ? g(C, d.lng, k, t) : h(C, k, t);
	});
	return H;
};
export { C as t };
