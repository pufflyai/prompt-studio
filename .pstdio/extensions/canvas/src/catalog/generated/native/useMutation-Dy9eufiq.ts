// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { N as e, O as t, S as n, c as r, g as i, k as a, n as o } from "./QueryClientProvider-LIjzams-.ts";
import { n as s } from "./mutation-C1iNFNLo.ts";
import * as c from "react";
// node_modules/.bun/@tanstack+query-core@5.90.20/node_modules/@tanstack/query-core/build/modern/mutationObserver.js
var l = class extends e {
	#e;
	#t = void 0;
	#n;
	#r;
	constructor(e, t) {
		super(), this.#e = e, this.setOptions(t), this.bindMethods(), this.#i();
	}
	bindMethods() {
		this.mutate = this.mutate.bind(this), this.reset = this.reset.bind(this);
	}
	setOptions(e) {
		let n = this.options;
		this.options = this.#e.defaultMutationOptions(e), t(this.options, n) || this.#e.getMutationCache().notify({
			type: "observerOptionsUpdated",
			mutation: this.#n,
			observer: this
		}), n?.mutationKey && this.options.mutationKey && i(n.mutationKey) !== i(this.options.mutationKey) ? this.reset() : this.#n?.state.status === "pending" && this.#n.setOptions(this.options);
	}
	onUnsubscribe() {
		this.hasListeners() || this.#n?.removeObserver(this);
	}
	onMutationUpdate(e) {
		this.#i(), this.#a(e);
	}
	getCurrentResult() {
		return this.#t;
	}
	reset() {
		this.#n?.removeObserver(this), this.#n = void 0, this.#i(), this.#a();
	}
	mutate(e, t) {
		return this.#r = t, this.#n?.removeObserver(this), this.#n = this.#e.getMutationCache().build(this.#e, this.options), this.#n.addObserver(this), this.#n.execute(e);
	}
	#i() {
		let e = this.#n?.state ?? s();
		this.#t = {
			...e,
			isPending: e.status === "pending",
			isSuccess: e.status === "success",
			isError: e.status === "error",
			isIdle: e.status === "idle",
			mutate: this.mutate,
			reset: this.reset
		};
	}
	#a(e) {
		r.batch(() => {
			if (this.#r && this.hasListeners()) {
				let t = this.#t.variables, n = this.#t.context, r = {
					client: this.#e,
					meta: this.options.meta,
					mutationKey: this.options.mutationKey
				};
				if (e?.type === "success") {
					try {
						this.#r.onSuccess?.(e.data, t, n, r);
					} catch (e) {
						Promise.reject(e);
					}
					try {
						this.#r.onSettled?.(e.data, null, t, n, r);
					} catch (e) {
						Promise.reject(e);
					}
				} else if (e?.type === "error") {
					try {
						this.#r.onError?.(e.error, t, n, r);
					} catch (e) {
						Promise.reject(e);
					}
					try {
						this.#r.onSettled?.(void 0, e.error, t, n, r);
					} catch (e) {
						Promise.reject(e);
					}
				}
			}
			this.listeners.forEach((e) => {
				e(this.#t);
			});
		});
	}
};
// node_modules/.bun/@tanstack+react-query@5.90.21+b1ab299f0a400331/node_modules/@tanstack/react-query/build/modern/useMutation.js
function u(e, t) {
	let i = o(t), [s] = c.useState(() => new l(i, e));
	c.useEffect(() => {
		s.setOptions(e);
	}, [s, e]);
	let u = c.useSyncExternalStore(c.useCallback((e) => s.subscribe(r.batchCalls(e)), [s]), () => s.getCurrentResult(), () => s.getCurrentResult()), d = c.useCallback((e, t) => {
		s.mutate(e, t).catch(n);
	}, [s]);
	if (u.error && a(s.options.throwOnError, [u.error])) throw u.error;
	return {
		...u,
		mutate: d,
		mutateAsync: u.mutate
	};
}
export { u as t };
