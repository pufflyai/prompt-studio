// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { N as e, O as t, S as n, T as r, c as i, n as a } from "./QueryClientProvider-LIjzams-.ts";
import { a as o, c as s, i as c, l, n as u, o as d, r as f, s as p, u as m } from "./useQuery-OeRqqLZF.ts";
import * as h from "react";
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/queriesObserver.js
function g(e, t) {
	let n = new Set(t);
	return e.filter((e) => !n.has(e));
}
function _(e, t, n) {
	let r = e.slice(0);
	return r[t] = n, r;
}
var v = class extends e {
	#e;
	#t;
	#n;
	#r;
	#i;
	#a;
	#o;
	#s;
	#c;
	#l = [];
	constructor(e, t, n) {
		super(), this.#e = e, this.#r = n, this.#n = [], this.#i = [], this.#t = [], this.setQueries(t);
	}
	onSubscribe() {
		this.listeners.size === 1 && this.#i.forEach((e) => {
			e.subscribe((t) => {
				this.#p(e, t);
			});
		});
	}
	onUnsubscribe() {
		this.listeners.size || this.destroy();
	}
	destroy() {
		this.listeners = /* @__PURE__ */ new Set(), this.#i.forEach((e) => {
			e.destroy();
		});
	}
	setQueries(e, n) {
		this.#n = e, this.#r = n, i.batch(() => {
			let e = this.#i, n = this.#f(this.#n);
			n.forEach((e) => e.observer.setOptions(e.defaultedQueryOptions));
			let r = n.map((e) => e.observer), i = r.map((e) => e.getCurrentResult()), a = e.length !== r.length, o = r.some((t, n) => t !== e[n]), s = a || o, c = s ? !0 : i.some((e, n) => {
				let r = this.#t[n];
				return !r || !t(e, r);
			});
			(s || c) && (s && (this.#l = n, this.#i = r), this.#t = i, this.hasListeners() && (s && (g(e, r).forEach((e) => {
				e.destroy();
			}), g(r, e).forEach((e) => {
				e.subscribe((t) => {
					this.#p(e, t);
				});
			})), this.#m()));
		});
	}
	getCurrentResult() {
		return this.#t;
	}
	getQueries() {
		return this.#i.map((e) => e.getCurrentQuery());
	}
	getObservers() {
		return this.#i;
	}
	getOptimisticResult(e, t) {
		let n = this.#f(e), r = n.map((e) => e.observer.getOptimisticResult(e.defaultedQueryOptions)), i = n.map((e) => e.defaultedQueryOptions.queryHash);
		return [
			r,
			(e) => this.#d(e ?? r, t, i),
			() => this.#u(r, n)
		];
	}
	#u(e, t) {
		return t.map((n, r) => {
			let i = e[r];
			return n.defaultedQueryOptions.notifyOnChangeProps ? i : n.observer.trackResult(i, (e) => {
				t.forEach((t) => {
					t.observer.trackProp(e);
				});
			});
		});
	}
	#d(e, t, n) {
		if (t) {
			let i = this.#c, a = n !== void 0 && i !== void 0 && (i.length !== n.length || n.some((e, t) => e !== i[t]));
			return (!this.#a || this.#t !== this.#s || a || t !== this.#o) && (this.#o = t, this.#s = this.#t, n !== void 0 && (this.#c = n), this.#a = r(this.#a, t(e))), this.#a;
		}
		return e;
	}
	#f(e) {
		let t = /* @__PURE__ */ new Map();
		this.#i.forEach((e) => {
			let n = e.options.queryHash;
			if (!n) return;
			let r = t.get(n);
			r ? r.push(e) : t.set(n, [e]);
		});
		let n = [];
		return e.forEach((e) => {
			let r = this.#e.defaultQueryOptions(e), i = t.get(r.queryHash)?.shift() ?? new m(this.#e, r);
			n.push({
				defaultedQueryOptions: r,
				observer: i
			});
		}), n;
	}
	#p(e, t) {
		let n = this.#i.indexOf(e);
		n !== -1 && (this.#t = _(this.#t, n, t), this.#m());
	}
	#m() {
		if (this.hasListeners()) {
			let e = this.#a, t = this.#u(this.#t, this.#l);
			e !== this.#d(t, this.#r?.combine) && i.batch(() => {
				this.listeners.forEach((e) => {
					e(this.#t);
				});
			});
		}
	}
};
// node_modules/.bun/@tanstack+react-query@5.90.21+b1ab299f0a400331/node_modules/@tanstack/react-query/build/modern/useQueries.js
function y({ queries: e, ...t }, r) {
	let g = a(r), _ = l(), y = s(), b = h.useMemo(() => e.map((e) => {
		let t = g.defaultQueryOptions(e);
		return t._optimisticResults = _ ? "isRestoring" : "optimistic", t;
	}), [
		e,
		g,
		_
	]);
	b.forEach((e) => {
		u(e);
		let t = g.getQueryCache().get(e.queryHash);
		o(e, y, t);
	}), p(y);
	let [x] = h.useState(() => new v(g, b, t)), [S, C, w] = x.getOptimisticResult(b, t.combine), T = !_ && t.subscribed !== !1;
	h.useSyncExternalStore(h.useCallback((e) => T ? x.subscribe(i.batchCalls(e)) : n, [x, T]), () => x.getCurrentResult(), () => x.getCurrentResult()), h.useEffect(() => {
		x.setQueries(b, t);
	}, [
		b,
		t,
		x
	]);
	let E = S.some((e, t) => c(b[t], e)) ? S.flatMap((e, t) => {
		let n = b[t];
		if (n && c(n, e)) {
			let e = new m(g, n);
			return f(n, e, y);
		}
		return [];
	}) : [];
	if (E.length > 0) throw Promise.all(E);
	let D = S.find((e, t) => {
		let n = b[t];
		return n && d({
			result: e,
			errorResetBoundary: y,
			throwOnError: n.throwOnError,
			query: g.getQueryCache().get(n.queryHash),
			suspense: n.suspense
		});
	});
	if (D?.error) throw D.error;
	return C(w());
}
export { y as t };
