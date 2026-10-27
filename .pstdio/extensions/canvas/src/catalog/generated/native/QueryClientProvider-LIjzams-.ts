// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { jsx as t } from "react/jsx-runtime";
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/subscribable.js
var n = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Set(), this.subscribe = this.subscribe.bind(this);
	}
	subscribe(e) {
		return this.listeners.add(e), this.onSubscribe(), () => {
			this.listeners.delete(e), this.onUnsubscribe();
		};
	}
	hasListeners() {
		return this.listeners.size > 0;
	}
	onSubscribe() {}
	onUnsubscribe() {}
}, r = {
	setTimeout: (e, t) => setTimeout(e, t),
	clearTimeout: (e) => clearTimeout(e),
	setInterval: (e, t) => setInterval(e, t),
	clearInterval: (e) => clearInterval(e)
}, i = new class {
	#e = r;
	setTimeoutProvider(e) {
		this.#e = e;
	}
	setTimeout(e, t) {
		return this.#e.setTimeout(e, t);
	}
	clearTimeout(e) {
		this.#e.clearTimeout(e);
	}
	setInterval(e, t) {
		return this.#e.setInterval(e, t);
	}
	clearInterval(e) {
		this.#e.clearInterval(e);
	}
}();
function a(e) {
	setTimeout(e, 0);
}
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/utils.js
var o = typeof window > "u" || "Deno" in globalThis;
function s() {}
function c(e, t) {
	return typeof e == "function" ? e(t) : e;
}
function l(e) {
	return typeof e == "number" && e >= 0 && e !== Infinity;
}
function u(e, t) {
	return Math.max(e + (t || 0) - Date.now(), 0);
}
function d(e, t) {
	return typeof e == "function" ? e(t) : e;
}
function f(e, t) {
	return typeof e == "function" ? e(t) : e;
}
function p(e, t) {
	let { type: n = "all", exact: r, fetchStatus: i, predicate: a, queryKey: o, stale: s } = e;
	if (o) {
		if (r) {
			if (t.queryHash !== h(o, t.options)) return !1;
		} else if (!_(t.queryKey, o)) return !1;
	}
	if (n !== "all") {
		let e = t.isActive();
		if (n === "active" && !e || n === "inactive" && e) return !1;
	}
	return !(typeof s == "boolean" && t.isStale() !== s || i && i !== t.state.fetchStatus || a && !a(t));
}
function m(e, t) {
	let { exact: n, status: r, predicate: i, mutationKey: a } = e;
	if (a) {
		if (!t.options.mutationKey) return !1;
		if (n) {
			if (g(t.options.mutationKey) !== g(a)) return !1;
		} else if (!_(t.options.mutationKey, a)) return !1;
	}
	return !(r && t.state.status !== r || i && !i(t));
}
function h(e, t) {
	return (t?.queryKeyHashFn || g)(e);
}
function g(e) {
	return JSON.stringify(e, (e, t) => S(t) ? Object.keys(t).sort().reduce((e, n) => (e[n] = t[n], e), {}) : t);
}
function _(e, t) {
	return e === t ? !0 : typeof e == typeof t && e && t && typeof e == "object" && typeof t == "object" ? Object.keys(t).every((n) => _(e[n], t[n])) : !1;
}
var v = Object.prototype.hasOwnProperty;
function y(e, t, n = 0) {
	if (e === t) return e;
	if (n > 500) return t;
	let r = x(e) && x(t);
	if (!r && !(S(e) && S(t))) return t;
	let i = (r ? e : Object.keys(e)).length, a = r ? t : Object.keys(t), o = a.length, s = r ? Array(o) : {}, c = 0;
	for (let l = 0; l < o; l++) {
		let o = r ? l : a[l], u = e[o], d = t[o];
		if (u === d) {
			s[o] = u, (r ? l < i : v.call(e, o)) && c++;
			continue;
		}
		if (u === null || d === null || typeof u != "object" || typeof d != "object") {
			s[o] = d;
			continue;
		}
		let f = y(u, d, n + 1);
		s[o] = f, f === u && c++;
	}
	return i === o && c === i ? e : s;
}
function b(e, t) {
	if (!t || Object.keys(e).length !== Object.keys(t).length) return !1;
	for (let n in e) if (e[n] !== t[n]) return !1;
	return !0;
}
function x(e) {
	return Array.isArray(e) && e.length === Object.keys(e).length;
}
function S(e) {
	if (!C(e)) return !1;
	let t = e.constructor;
	if (t === void 0) return !0;
	let n = t.prototype;
	return !(!C(n) || !n.hasOwnProperty("isPrototypeOf") || Object.getPrototypeOf(e) !== Object.prototype);
}
function C(e) {
	return Object.prototype.toString.call(e) === "[object Object]";
}
function w(e) {
	return new Promise((t) => {
		i.setTimeout(t, e);
	});
}
function T(e, t, n) {
	return typeof n.structuralSharing == "function" ? n.structuralSharing(e, t) : n.structuralSharing === !1 ? t : y(e, t);
}
function E(e, t, n = 0) {
	let r = [...e, t];
	return n && r.length > n ? r.slice(1) : r;
}
function D(e, t, n = 0) {
	let r = [t, ...e];
	return n && r.length > n ? r.slice(0, -1) : r;
}
var O = /* @__PURE__ */ Symbol();
function k(e, t) {
	return !e.queryFn && t?.initialPromise ? () => t.initialPromise : !e.queryFn || e.queryFn === O ? () => Promise.reject(/* @__PURE__ */ Error(`Missing queryFn: '${e.queryHash}'`)) : e.queryFn;
}
function A(e, t) {
	return typeof e == "function" ? e(...t) : !!e;
}
function j(e, t, n) {
	let r = !1, i;
	return Object.defineProperty(e, "signal", {
		enumerable: !0,
		get: () => (i ??= t(), r || (r = !0, i.aborted ? n() : i.addEventListener("abort", n, { once: !0 })), i)
	}), e;
}
var M = new class extends n {
	#e;
	#t;
	#n;
	constructor() {
		super(), this.#n = (e) => {
			if (!o && window.addEventListener) {
				let t = () => e();
				return window.addEventListener("visibilitychange", t, !1), () => {
					window.removeEventListener("visibilitychange", t);
				};
			}
		};
	}
	onSubscribe() {
		this.#t || this.setEventListener(this.#n);
	}
	onUnsubscribe() {
		this.hasListeners() || (this.#t?.(), this.#t = void 0);
	}
	setEventListener(e) {
		this.#n = e, this.#t?.(), this.#t = e((e) => {
			typeof e == "boolean" ? this.setFocused(e) : this.onFocus();
		});
	}
	setFocused(e) {
		this.#e !== e && (this.#e = e, this.onFocus());
	}
	onFocus() {
		let e = this.isFocused();
		this.listeners.forEach((t) => {
			t(e);
		});
	}
	isFocused() {
		return typeof this.#e == "boolean" ? this.#e : globalThis.document?.visibilityState !== "hidden";
	}
}();
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/thenable.js
function N() {
	let e, t, n = new Promise((n, r) => {
		e = n, t = r;
	});
	n.status = "pending", n.catch(() => {});
	function r(e) {
		Object.assign(n, e), delete n.resolve, delete n.reject;
	}
	return n.resolve = (t) => {
		r({
			status: "fulfilled",
			value: t
		}), e(t);
	}, n.reject = (e) => {
		r({
			status: "rejected",
			reason: e
		}), t(e);
	}, n;
}
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/notifyManager.js
var P = a;
function F() {
	let e = [], t = 0, n = (e) => {
		e();
	}, r = (e) => {
		e();
	}, i = P, a = (r) => {
		t ? e.push(r) : i(() => {
			n(r);
		});
	}, o = () => {
		let t = e;
		e = [], t.length && i(() => {
			r(() => {
				t.forEach((e) => {
					n(e);
				});
			});
		});
	};
	return {
		batch: (e) => {
			let n;
			t++;
			try {
				n = e();
			} finally {
				t--, t || o();
			}
			return n;
		},
		batchCalls: (e) => (...t) => {
			a(() => {
				e(...t);
			});
		},
		schedule: a,
		setNotifyFunction: (e) => {
			n = e;
		},
		setBatchNotifyFunction: (e) => {
			r = e;
		},
		setScheduler: (e) => {
			i = e;
		}
	};
}
var I = F(), L = new class extends n {
	#e = !0;
	#t;
	#n;
	constructor() {
		super(), this.#n = (e) => {
			if (!o && window.addEventListener) {
				let t = () => e(!0), n = () => e(!1);
				return window.addEventListener("online", t, !1), window.addEventListener("offline", n, !1), () => {
					window.removeEventListener("online", t), window.removeEventListener("offline", n);
				};
			}
		};
	}
	onSubscribe() {
		this.#t || this.setEventListener(this.#n);
	}
	onUnsubscribe() {
		this.hasListeners() || (this.#t?.(), this.#t = void 0);
	}
	setEventListener(e) {
		this.#n = e, this.#t?.(), this.#t = e(this.setOnline.bind(this));
	}
	setOnline(e) {
		this.#e !== e && (this.#e = e, this.listeners.forEach((t) => {
			t(e);
		}));
	}
	isOnline() {
		return this.#e;
	}
}();
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/retryer.js
function R(e) {
	return Math.min(1e3 * 2 ** e, 3e4);
}
function z(e) {
	return (e ?? "online") !== "online" || L.isOnline();
}
var B = class extends Error {
	constructor(e) {
		super("CancelledError"), this.revert = e?.revert, this.silent = e?.silent;
	}
};
function V(e) {
	let t = !1, n = 0, r, i = N(), a = () => i.status !== "pending", s = (t) => {
		if (!a()) {
			let n = new B(t);
			p(n), e.onCancel?.(n);
		}
	}, c = () => {
		t = !0;
	}, l = () => {
		t = !1;
	}, u = () => M.isFocused() && (e.networkMode === "always" || L.isOnline()) && e.canRun(), d = () => z(e.networkMode) && e.canRun(), f = (e) => {
		a() || (r?.(), i.resolve(e));
	}, p = (e) => {
		a() || (r?.(), i.reject(e));
	}, m = () => new Promise((t) => {
		r = (e) => {
			(a() || u()) && t(e);
		}, e.onPause?.();
	}).then(() => {
		r = void 0, a() || e.onContinue?.();
	}), h = () => {
		if (a()) return;
		let r, i = n === 0 ? e.initialPromise : void 0;
		try {
			r = i ?? e.fn();
		} catch (e) {
			r = Promise.reject(e);
		}
		Promise.resolve(r).then(f).catch((r) => {
			if (a()) return;
			let i = e.retry ?? (o ? 0 : 3), s = e.retryDelay ?? R, c = typeof s == "function" ? s(n, r) : s, l = i === !0 || typeof i == "number" && n < i || typeof i == "function" && i(n, r);
			t || !l ? p(r) : (n++, e.onFail?.(n, r), w(c).then(() => u() ? void 0 : m()).then(() => {
				t ? p(r) : h();
			}));
		});
	};
	return {
		promise: i,
		status: () => i.status,
		cancel: s,
		continue: () => (r?.(), i),
		cancelRetry: c,
		continueRetry: l,
		canStart: d,
		start: () => (d() ? h() : m().then(h), i)
	};
}
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/removable.js
var H = class {
	#e;
	destroy() {
		this.clearGcTimeout();
	}
	scheduleGc() {
		this.clearGcTimeout(), l(this.gcTime) && (this.#e = i.setTimeout(() => {
			this.optionalRemove();
		}, this.gcTime));
	}
	updateGcTime(e) {
		this.gcTime = Math.max(this.gcTime || 0, e ?? (o ? Infinity : 3e5));
	}
	clearGcTimeout() {
		this.#e &&= (i.clearTimeout(this.#e), void 0);
	}
}, U = class extends H {
	#e;
	#t;
	#n;
	#r;
	#i;
	#a;
	#o;
	constructor(e) {
		super(), this.#o = !1, this.#a = e.defaultOptions, this.setOptions(e.options), this.observers = [], this.#r = e.client, this.#n = this.#r.getQueryCache(), this.queryKey = e.queryKey, this.queryHash = e.queryHash, this.#e = K(this.options), this.state = e.state ?? this.#e, this.scheduleGc();
	}
	get meta() {
		return this.options.meta;
	}
	get promise() {
		return this.#i?.promise;
	}
	setOptions(e) {
		if (this.options = {
			...this.#a,
			...e
		}, this.updateGcTime(this.options.gcTime), this.state && this.state.data === void 0) {
			let e = K(this.options);
			e.data !== void 0 && (this.setState(G(e.data, e.dataUpdatedAt)), this.#e = e);
		}
	}
	optionalRemove() {
		!this.observers.length && this.state.fetchStatus === "idle" && this.#n.remove(this);
	}
	setData(e, t) {
		let n = T(this.state.data, e, this.options);
		return this.#s({
			data: n,
			type: "success",
			dataUpdatedAt: t?.updatedAt,
			manual: t?.manual
		}), n;
	}
	setState(e, t) {
		this.#s({
			type: "setState",
			state: e,
			setStateOptions: t
		});
	}
	cancel(e) {
		let t = this.#i?.promise;
		return this.#i?.cancel(e), t ? t.then(s).catch(s) : Promise.resolve();
	}
	destroy() {
		super.destroy(), this.cancel({ silent: !0 });
	}
	reset() {
		this.destroy(), this.setState(this.#e);
	}
	isActive() {
		return this.observers.some((e) => f(e.options.enabled, this) !== !1);
	}
	isDisabled() {
		return this.getObserversCount() > 0 ? !this.isActive() : this.options.queryFn === O || this.state.dataUpdateCount + this.state.errorUpdateCount === 0;
	}
	isStatic() {
		return this.getObserversCount() > 0 && this.observers.some((e) => d(e.options.staleTime, this) === "static");
	}
	isStale() {
		return this.getObserversCount() > 0 ? this.observers.some((e) => e.getCurrentResult().isStale) : this.state.data === void 0 || this.state.isInvalidated;
	}
	isStaleByTime(e = 0) {
		return this.state.data === void 0 ? !0 : e === "static" ? !1 : this.state.isInvalidated ? !0 : !u(this.state.dataUpdatedAt, e);
	}
	onFocus() {
		this.observers.find((e) => e.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: !1 }), this.#i?.continue();
	}
	onOnline() {
		this.observers.find((e) => e.shouldFetchOnReconnect())?.refetch({ cancelRefetch: !1 }), this.#i?.continue();
	}
	addObserver(e) {
		this.observers.includes(e) || (this.observers.push(e), this.clearGcTimeout(), this.#n.notify({
			type: "observerAdded",
			query: this,
			observer: e
		}));
	}
	removeObserver(e) {
		this.observers.includes(e) && (this.observers = this.observers.filter((t) => t !== e), this.observers.length || (this.#i && (this.#o ? this.#i.cancel({ revert: !0 }) : this.#i.cancelRetry()), this.scheduleGc()), this.#n.notify({
			type: "observerRemoved",
			query: this,
			observer: e
		}));
	}
	getObserversCount() {
		return this.observers.length;
	}
	invalidate() {
		this.state.isInvalidated || this.#s({ type: "invalidate" });
	}
	async fetch(e, t) {
		if (this.state.fetchStatus !== "idle" && this.#i?.status() !== "rejected") {
			if (this.state.data !== void 0 && t?.cancelRefetch) this.cancel({ silent: !0 });
			else if (this.#i) return this.#i.continueRetry(), this.#i.promise;
		}
		if (e && this.setOptions(e), !this.options.queryFn) {
			let e = this.observers.find((e) => e.options.queryFn);
			e && this.setOptions(e.options);
		}
		let n = new AbortController(), r = (e) => {
			Object.defineProperty(e, "signal", {
				enumerable: !0,
				get: () => (this.#o = !0, n.signal)
			});
		}, i = () => {
			let e = k(this.options, t), n = (() => {
				let e = {
					client: this.#r,
					queryKey: this.queryKey,
					meta: this.meta
				};
				return r(e), e;
			})();
			return this.#o = !1, this.options.persister ? this.options.persister(e, n, this) : e(n);
		}, a = (() => {
			let e = {
				fetchOptions: t,
				options: this.options,
				queryKey: this.queryKey,
				client: this.#r,
				state: this.state,
				fetchFn: i
			};
			return r(e), e;
		})();
		this.options.behavior?.onFetch(a, this), this.#t = this.state, (this.state.fetchStatus === "idle" || this.state.fetchMeta !== a.fetchOptions?.meta) && this.#s({
			type: "fetch",
			meta: a.fetchOptions?.meta
		}), this.#i = V({
			initialPromise: t?.initialPromise,
			fn: a.fetchFn,
			onCancel: (e) => {
				e instanceof B && e.revert && this.setState({
					...this.#t,
					fetchStatus: "idle"
				}), n.abort();
			},
			onFail: (e, t) => {
				this.#s({
					type: "failed",
					failureCount: e,
					error: t
				});
			},
			onPause: () => {
				this.#s({ type: "pause" });
			},
			onContinue: () => {
				this.#s({ type: "continue" });
			},
			retry: a.options.retry,
			retryDelay: a.options.retryDelay,
			networkMode: a.options.networkMode,
			canRun: () => !0
		});
		try {
			let e = await this.#i.start();
			if (e === void 0) throw Error(`${this.queryHash} data is undefined`);
			return this.setData(e), this.#n.config.onSuccess?.(e, this), this.#n.config.onSettled?.(e, this.state.error, this), e;
		} catch (e) {
			if (e instanceof B) {
				if (e.silent) return this.#i.promise;
				if (e.revert) {
					if (this.state.data === void 0) throw e;
					return this.state.data;
				}
			}
			throw this.#s({
				type: "error",
				error: e
			}), this.#n.config.onError?.(e, this), this.#n.config.onSettled?.(this.state.data, e, this), e;
		} finally {
			this.scheduleGc();
		}
	}
	#s(e) {
		let t = (t) => {
			switch (e.type) {
				case "failed": return {
					...t,
					fetchFailureCount: e.failureCount,
					fetchFailureReason: e.error
				};
				case "pause": return {
					...t,
					fetchStatus: "paused"
				};
				case "continue": return {
					...t,
					fetchStatus: "fetching"
				};
				case "fetch": return {
					...t,
					...W(t.data, this.options),
					fetchMeta: e.meta ?? null
				};
				case "success":
					let n = {
						...t,
						...G(e.data, e.dataUpdatedAt),
						dataUpdateCount: t.dataUpdateCount + 1,
						...!e.manual && {
							fetchStatus: "idle",
							fetchFailureCount: 0,
							fetchFailureReason: null
						}
					};
					return this.#t = e.manual ? n : void 0, n;
				case "error":
					let r = e.error;
					return {
						...t,
						error: r,
						errorUpdateCount: t.errorUpdateCount + 1,
						errorUpdatedAt: Date.now(),
						fetchFailureCount: t.fetchFailureCount + 1,
						fetchFailureReason: r,
						fetchStatus: "idle",
						status: "error",
						isInvalidated: !0
					};
				case "invalidate": return {
					...t,
					isInvalidated: !0
				};
				case "setState": return {
					...t,
					...e.state
				};
			}
		};
		this.state = t(this.state), I.batch(() => {
			this.observers.forEach((e) => {
				e.onQueryUpdate();
			}), this.#n.notify({
				query: this,
				type: "updated",
				action: e
			});
		});
	}
};
function W(e, t) {
	return {
		fetchFailureCount: 0,
		fetchFailureReason: null,
		fetchStatus: z(t.networkMode) ? "fetching" : "paused",
		...e === void 0 && {
			error: null,
			status: "pending"
		}
	};
}
function G(e, t) {
	return {
		data: e,
		dataUpdatedAt: t ?? Date.now(),
		error: null,
		isInvalidated: !1,
		status: "success"
	};
}
function K(e) {
	let t = typeof e.initialData == "function" ? e.initialData() : e.initialData, n = t !== void 0, r = n ? typeof e.initialDataUpdatedAt == "function" ? e.initialDataUpdatedAt() : e.initialDataUpdatedAt : 0;
	return {
		data: t,
		dataUpdateCount: 0,
		dataUpdatedAt: n ? r ?? Date.now() : 0,
		error: null,
		errorUpdateCount: 0,
		errorUpdatedAt: 0,
		fetchFailureCount: 0,
		fetchFailureReason: null,
		fetchMeta: null,
		isInvalidated: !1,
		status: n ? "success" : "pending",
		fetchStatus: "idle"
	};
}
// node_modules/.bun/@tanstack+react-query@5.90.21+b1ab299f0a400331/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js
var q = e.createContext(void 0), J = (t) => {
	let n = e.useContext(q);
	if (t) return t;
	if (!n) throw Error("No QueryClient set, use QueryClientProvider to set one");
	return n;
}, Y = ({ client: n, children: r }) => (e.useEffect(() => (n.mount(), () => {
	n.unmount();
}), [n]), /* @__PURE__ */ t(q.Provider, {
	value: n,
	children: r
}));
export { O as A, _ as C, d as D, f as E, i as M, n as N, b as O, s as S, y as T, h as _, H as a, m as b, I as c, j as d, E as f, g, c as h, W as i, u as j, A as k, N as l, k as m, J as n, V as o, D as p, U as r, L as s, Y as t, M as u, o as v, T as w, p as x, l as y };
