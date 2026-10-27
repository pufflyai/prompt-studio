// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { D as e, E as t, M as n, N as r, O as i, S as a, c as o, i as s, j as c, k as l, l as u, n as d, u as f, v as p, w as m, y as h } from "./QueryClientProvider-LIjzams-.ts";
import * as g from "react";
import "react/jsx-runtime";
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/queryObserver.js
var _ = class extends r {
	constructor(e, t) {
		super(), this.options = t, this.#e = e, this.#s = null, this.#o = u(), this.bindMethods(), this.setOptions(t);
	}
	#e;
	#t = void 0;
	#n = void 0;
	#r = void 0;
	#i;
	#a;
	#o;
	#s;
	#c;
	#l;
	#u;
	#d;
	#f;
	#p;
	#m = /* @__PURE__ */ new Set();
	bindMethods() {
		this.refetch = this.refetch.bind(this);
	}
	onSubscribe() {
		this.listeners.size === 1 && (this.#t.addObserver(this), y(this.#t, this.options) ? this.#h() : this.updateResult(), this.#y());
	}
	onUnsubscribe() {
		this.hasListeners() || this.destroy();
	}
	shouldFetchOnReconnect() {
		return b(this.#t, this.options, this.options.refetchOnReconnect);
	}
	shouldFetchOnWindowFocus() {
		return b(this.#t, this.options, this.options.refetchOnWindowFocus);
	}
	destroy() {
		this.listeners = /* @__PURE__ */ new Set(), this.#b(), this.#x(), this.#t.removeObserver(this);
	}
	setOptions(n) {
		let r = this.options, a = this.#t;
		if (this.options = this.#e.defaultQueryOptions(n), this.options.enabled !== void 0 && typeof this.options.enabled != "boolean" && typeof this.options.enabled != "function" && typeof t(this.options.enabled, this.#t) != "boolean") throw Error("Expected enabled to be a boolean or a callback that returns a boolean");
		this.#S(), this.#t.setOptions(this.options), r._defaulted && !i(this.options, r) && this.#e.getQueryCache().notify({
			type: "observerOptionsUpdated",
			query: this.#t,
			observer: this
		});
		let o = this.hasListeners();
		o && x(this.#t, a, this.options, r) && this.#h(), this.updateResult(), o && (this.#t !== a || t(this.options.enabled, this.#t) !== t(r.enabled, this.#t) || e(this.options.staleTime, this.#t) !== e(r.staleTime, this.#t)) && this.#g();
		let s = this.#_();
		o && (this.#t !== a || t(this.options.enabled, this.#t) !== t(r.enabled, this.#t) || s !== this.#p) && this.#v(s);
	}
	getOptimisticResult(e) {
		let t = this.#e.getQueryCache().build(this.#e, e), n = this.createResult(t, e);
		return C(this, n) && (this.#r = n, this.#a = this.options, this.#i = this.#t.state), n;
	}
	getCurrentResult() {
		return this.#r;
	}
	trackResult(e, t) {
		return new Proxy(e, { get: (e, n) => (this.trackProp(n), t?.(n), n === "promise" && (this.trackProp("data"), !this.options.experimental_prefetchInRender && this.#o.status === "pending" && this.#o.reject(/* @__PURE__ */ Error("experimental_prefetchInRender feature flag is not enabled"))), Reflect.get(e, n)) });
	}
	trackProp(e) {
		this.#m.add(e);
	}
	getCurrentQuery() {
		return this.#t;
	}
	refetch({ ...e } = {}) {
		return this.fetch({ ...e });
	}
	fetchOptimistic(e) {
		let t = this.#e.defaultQueryOptions(e), n = this.#e.getQueryCache().build(this.#e, t);
		return n.fetch().then(() => this.createResult(n, t));
	}
	fetch(e) {
		return this.#h({
			...e,
			cancelRefetch: e.cancelRefetch ?? !0
		}).then(() => (this.updateResult(), this.#r));
	}
	#h(e) {
		this.#S();
		let t = this.#t.fetch(this.options, e);
		return e?.throwOnError || (t = t.catch(a)), t;
	}
	#g() {
		this.#b();
		let t = e(this.options.staleTime, this.#t);
		if (p || this.#r.isStale || !h(t)) return;
		let r = c(this.#r.dataUpdatedAt, t) + 1;
		this.#d = n.setTimeout(() => {
			this.#r.isStale || this.updateResult();
		}, r);
	}
	#_() {
		return (typeof this.options.refetchInterval == "function" ? this.options.refetchInterval(this.#t) : this.options.refetchInterval) ?? !1;
	}
	#v(e) {
		this.#x(), this.#p = e, !p && t(this.options.enabled, this.#t) !== !1 && h(this.#p) && this.#p !== 0 && (this.#f = n.setInterval(() => {
			(this.options.refetchIntervalInBackground || f.isFocused()) && this.#h();
		}, this.#p));
	}
	#y() {
		this.#g(), this.#v(this.#_());
	}
	#b() {
		this.#d &&= (n.clearTimeout(this.#d), void 0);
	}
	#x() {
		this.#f &&= (n.clearInterval(this.#f), void 0);
	}
	createResult(e, n) {
		let r = this.#t, i = this.options, a = this.#r, o = this.#i, c = this.#a, l = e === r ? this.#n : e.state, { state: d } = e, f = { ...d }, p = !1, h;
		if (n._optimisticResults) {
			let t = this.hasListeners(), a = !t && y(e, n), o = t && x(e, r, n, i);
			(a || o) && (f = {
				...f,
				...s(d.data, e.options)
			}), n._optimisticResults === "isRestoring" && (f.fetchStatus = "idle");
		}
		let { error: g, errorUpdatedAt: _, status: v } = f;
		h = f.data;
		let b = !1;
		if (n.placeholderData !== void 0 && h === void 0 && v === "pending") {
			let e;
			a?.isPlaceholderData && n.placeholderData === c?.placeholderData ? (e = a.data, b = !0) : e = typeof n.placeholderData == "function" ? n.placeholderData(this.#u?.state.data, this.#u) : n.placeholderData, e !== void 0 && (v = "success", h = m(a?.data, e, n), p = !0);
		}
		if (n.select && h !== void 0 && !b) {
			if (a && h === o?.data && n.select === this.#c) h = this.#l;
			else try {
				this.#c = n.select, h = n.select(h), h = m(a?.data, h, n), this.#l = h, this.#s = null;
			} catch (e) {
				this.#s = e;
			}
		}
		this.#s && (g = this.#s, h = this.#l, _ = Date.now(), v = "error");
		let C = f.fetchStatus === "fetching", w = v === "pending", T = v === "error", E = w && C, D = h !== void 0, O = {
			status: v,
			fetchStatus: f.fetchStatus,
			isPending: w,
			isSuccess: v === "success",
			isError: T,
			isInitialLoading: E,
			isLoading: E,
			data: h,
			dataUpdatedAt: f.dataUpdatedAt,
			error: g,
			errorUpdatedAt: _,
			failureCount: f.fetchFailureCount,
			failureReason: f.fetchFailureReason,
			errorUpdateCount: f.errorUpdateCount,
			isFetched: f.dataUpdateCount > 0 || f.errorUpdateCount > 0,
			isFetchedAfterMount: f.dataUpdateCount > l.dataUpdateCount || f.errorUpdateCount > l.errorUpdateCount,
			isFetching: C,
			isRefetching: C && !w,
			isLoadingError: T && !D,
			isPaused: f.fetchStatus === "paused",
			isPlaceholderData: p,
			isRefetchError: T && D,
			isStale: S(e, n),
			refetch: this.refetch,
			promise: this.#o,
			isEnabled: t(n.enabled, e) !== !1
		};
		if (this.options.experimental_prefetchInRender) {
			let t = O.data !== void 0, n = O.status === "error" && !t, i = (e) => {
				n ? e.reject(O.error) : t && e.resolve(O.data);
			}, a = () => {
				let e = this.#o = O.promise = u();
				i(e);
			}, o = this.#o;
			switch (o.status) {
				case "pending":
					e.queryHash === r.queryHash && i(o);
					break;
				case "fulfilled":
					(n || O.data !== o.value) && a();
					break;
				case "rejected": n && O.error === o.reason || a();
			}
		}
		return O;
	}
	updateResult() {
		let e = this.#r, t = this.createResult(this.#t, this.options);
		this.#i = this.#t.state, this.#a = this.options, this.#i.data !== void 0 && (this.#u = this.#t), !i(t, e) && (this.#r = t, this.#C({ listeners: (() => {
			if (!e) return !0;
			let { notifyOnChangeProps: t } = this.options, n = typeof t == "function" ? t() : t;
			if (n === "all" || !n && !this.#m.size) return !0;
			let r = new Set(n ?? this.#m);
			return this.options.throwOnError && r.add("error"), Object.keys(this.#r).some((t) => {
				let n = t;
				return this.#r[n] !== e[n] && r.has(n);
			});
		})() }));
	}
	#S() {
		let e = this.#e.getQueryCache().build(this.#e, this.options);
		if (e === this.#t) return;
		let t = this.#t;
		this.#t = e, this.#n = e.state, this.hasListeners() && (t?.removeObserver(this), e.addObserver(this));
	}
	onQueryUpdate() {
		this.updateResult(), this.hasListeners() && this.#y();
	}
	#C(e) {
		o.batch(() => {
			e.listeners && this.listeners.forEach((e) => {
				e(this.#r);
			}), this.#e.getQueryCache().notify({
				query: this.#t,
				type: "observerResultsUpdated"
			});
		});
	}
};
function v(e, n) {
	return t(n.enabled, e) !== !1 && e.state.data === void 0 && (e.state.status !== "error" || n.retryOnMount !== !1);
}
function y(e, t) {
	return v(e, t) || e.state.data !== void 0 && b(e, t, t.refetchOnMount);
}
function b(n, r, i) {
	if (t(r.enabled, n) !== !1 && e(r.staleTime, n) !== "static") {
		let e = typeof i == "function" ? i(n) : i;
		return e === "always" || e !== !1 && S(n, r);
	}
	return !1;
}
function x(e, n, r, i) {
	return (e !== n || t(i.enabled, e) === !1) && (!r.suspense || e.state.status !== "error") && S(e, r);
}
function S(n, r) {
	return t(r.enabled, n) !== !1 && n.isStaleByTime(e(r.staleTime, n));
}
function C(e, t) {
	return !i(e.getCurrentResult(), t);
}
// node_modules/.bun/@tanstack+react-query@5.90.21+b1ab299f0a400331/node_modules/@tanstack/react-query/build/modern/IsRestoringProvider.js
var w = g.createContext(!1), T = () => g.useContext(w);
w.Provider;
// node_modules/.bun/@tanstack+react-query@5.90.21+b1ab299f0a400331/node_modules/@tanstack/react-query/build/modern/QueryErrorResetBoundary.js
function E() {
	let e = !1;
	return {
		clearReset: () => {
			e = !1;
		},
		reset: () => {
			e = !0;
		},
		isReset: () => e
	};
}
var D = g.createContext(E()), O = () => g.useContext(D), k = (e, t, n) => {
	let r = n?.state.error && typeof e.throwOnError == "function" ? l(e.throwOnError, [n.state.error, n]) : e.throwOnError;
	(e.suspense || e.experimental_prefetchInRender || r) && (t.isReset() || (e.retryOnMount = !1));
}, A = (e) => {
	g.useEffect(() => {
		e.clearReset();
	}, [e]);
}, j = ({ result: e, errorResetBoundary: t, throwOnError: n, query: r, suspense: i }) => e.isError && !t.isReset() && !e.isFetching && r && (i && e.data === void 0 || l(n, [e.error, r])), M = (e) => {
	if (e.suspense) {
		let t = 1e3, n = (e) => e === "static" ? e : Math.max(e ?? t, t), r = e.staleTime;
		e.staleTime = typeof r == "function" ? (...e) => n(r(...e)) : n(r), typeof e.gcTime == "number" && (e.gcTime = Math.max(e.gcTime, t));
	}
}, N = (e, t) => e.isLoading && e.isFetching && !t, P = (e, t) => e?.suspense && t.isPending, F = (e, t, n) => t.fetchOptimistic(e).catch(() => {
	n.clearReset();
});
// node_modules/.bun/@tanstack+react-query@5.90.21+b1ab299f0a400331/node_modules/@tanstack/react-query/build/modern/useBaseQuery.js
function I(e, t, n) {
	let r = T(), i = O(), s = d(n), c = s.defaultQueryOptions(e);
	s.getDefaultOptions().queries?._experimental_beforeQuery?.(c);
	let l = s.getQueryCache().get(c.queryHash);
	c._optimisticResults = r ? "isRestoring" : "optimistic", M(c), k(c, i, l), A(i);
	let u = !s.getQueryCache().get(c.queryHash), [f] = g.useState(() => new t(s, c)), m = f.getOptimisticResult(c), h = !r && e.subscribed !== !1;
	if (g.useSyncExternalStore(g.useCallback((e) => {
		let t = h ? f.subscribe(o.batchCalls(e)) : a;
		return f.updateResult(), t;
	}, [f, h]), () => f.getCurrentResult(), () => f.getCurrentResult()), g.useEffect(() => {
		f.setOptions(c);
	}, [c, f]), P(c, m)) throw F(c, f, i);
	if (j({
		result: m,
		errorResetBoundary: i,
		throwOnError: c.throwOnError,
		query: l,
		suspense: c.suspense
	})) throw m.error;
	return s.getDefaultOptions().queries?._experimental_afterQuery?.(c, m), c.experimental_prefetchInRender && !p && N(m, r) && (u ? F(c, f, i) : l?.promise)?.catch(a).finally(() => {
		f.updateResult();
	}), c.notifyOnChangeProps ? m : f.trackResult(m);
}
// node_modules/.bun/@tanstack+react-query@5.90.21+b1ab299f0a400331/node_modules/@tanstack/react-query/build/modern/useQuery.js
function L(e, t) {
	return I(e, _, t);
}
export { k as a, O as c, P as i, T as l, M as n, j as o, F as r, A as s, L as t, _ as u };
