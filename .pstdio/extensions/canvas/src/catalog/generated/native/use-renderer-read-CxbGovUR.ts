// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createContext as e, startTransition as t, useContext as n, useEffect as r, useRef as i, useState as a } from "react";
import { jsx as o } from "react/jsx-runtime";
import { PstdioConnectionError as s } from "@pstdio/sdk/client";
// packages/pstdio-workbench/src/react/renderers/renderer-mutations.ts
var c = () => {
	let e, t = 0, n = [], r = () => n.some((e) => e.saving);
	return {
		value: () => e === void 0 ? void 0 : n.reduce((e, t) => t.update(e), e),
		pending: r,
		revision: () => t,
		accept(i, a) {
			return a !== t || r() ? !1 : (e = i, n.length = 0, !0);
		},
		begin(e) {
			t += 1;
			let r = {
				update: e,
				saving: !0
			};
			return n.push(r), r;
		},
		finish(e, r) {
			t += 1, e.saving = !1, r || n.splice(n.indexOf(e), 1);
		}
	};
}, l = () => {
	let e, t = c();
	return { bind(n, r) {
		let i = JSON.stringify([n, r]);
		return e !== void 0 && e !== i && (t = c()), e = i, t;
	} };
}, u = e(!0), d = (e) => {
	let { connected: t, children: n } = e;
	return /* @__PURE__ */ o(u, {
		value: t,
		children: n
	});
}, f = () => n(u), p = (e) => {
	let { workbench: n, ownerKey: o, queryKey: c, refreshKey: u } = e, d = f(), [p, m] = a({
		queryKey: c,
		loading: !0
	}), h = i(void 0), g = i(void 0), _ = i(u), v = i(e), y = i(l()), b = i(y.current.bind(o, c)), x = i(Promise.resolve());
	r(() => {
		v.current = e;
	}), r(() => {
		let e = n.views.reads.bind(o), r = y.current.bind(o, c);
		b.current = r;
		let i = {
			onValue: (e, n) => {
				t(() => m({
					queryKey: c,
					request: n,
					value: r.value() ?? e,
					loading: !1
				}));
			},
			onError: (e) => {
				let t = e instanceof s, n = e instanceof Error ? e : Error(String(e));
				m((e) => ({
					queryKey: c,
					request: e.queryKey === c ? e.request : void 0,
					value: e.queryKey === c ? e.value : void 0,
					loading: !1,
					error: t && e.queryKey === c && e.value !== void 0 ? void 0 : n
				}));
			}
		}, a = (n) => {
			if (r.pending()) return Promise.resolve();
			m((e) => ({
				...e,
				loading: !0,
				error: void 0
			}));
			let a = v.current, o = r.revision(), s = Symbol();
			return e.request({
				...i,
				queryKey: JSON.stringify([c, a.refreshKey]),
				load: a.load,
				onProgress: (e) => {
					t(() => m((t) => t.queryKey === c && t.value !== void 0 && t.request !== s ? t : {
						queryKey: c,
						request: s,
						value: e,
						loading: !0
					}));
				},
				onValue: (e) => {
					r.accept(e, o) && i.onValue(e, s);
				}
			}, n);
		};
		g.current = () => a(), _.current = v.current.refreshKey, h.current = () => (m((e) => ({
			...e,
			loading: e.value === void 0,
			error: void 0
		})), a("retry")), a();
		let l = v.current.subscribe(a);
		return () => {
			h.current = void 0, g.current = void 0, e.dispose(), typeof l == "function" ? l() : l.dispose();
		};
	}, [
		n,
		o,
		c,
		d
	]), r(() => {
		_.current !== u && (_.current = u, g.current?.());
	}, [u]);
	let S = p.queryKey === c ? p : {
		queryKey: c,
		loading: !0
	}, C = S.error instanceof s && !d;
	return {
		...S,
		error: C ? void 0 : S.error?.message,
		loading: S.loading || C && S.value === void 0,
		retry: () => h.current?.() ?? Promise.resolve(),
		mutate: (e, t) => {
			let n = b.current, r = n.begin(e), i = () => m((e) => ({
				...e,
				value: n.value()
			}));
			i();
			let a = x.current.then(t);
			return x.current = a.catch(() => void 0), a.then(() => n.finish(r, !0), (e) => {
				throw n.finish(r, !1), e;
			}).finally(() => {
				b.current === n && (i(), n.pending() || g.current?.());
			});
		}
	};
};
export { d as n, p as t };
