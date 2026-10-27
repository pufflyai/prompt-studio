// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { resourceKey as e } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/core/shared/disposable.ts
var t = (e) => {
	let t = !1;
	return { dispose() {
		t || (t = !0, e());
	} };
}, n = (e) => !!e.dispatchFromDevtools && typeof e.dispatch == "function", r = /* @__PURE__ */ new Map(), i = (e) => {
	let t = r.get(e);
	return t ? Object.fromEntries(Object.entries(t.stores).map(([e, t]) => [e, t.getState()])) : {};
}, a = (e, t, n) => {
	if (e === void 0) return {
		type: "untracked",
		connection: t.connect(n)
	};
	let i = r.get(n.name);
	if (i) return {
		type: "tracked",
		store: e,
		...i
	};
	let a = {
		connection: t.connect(n),
		stores: {}
	};
	return r.set(n.name, a), {
		type: "tracked",
		store: e,
		...a
	};
}, o = (e, t) => {
	if (t === void 0) return;
	let n = r.get(e);
	n && (delete n.stores[t], Object.keys(n.stores).length === 0 && r.delete(e));
}, s = (e) => {
	if (!e) return;
	let t = e.split("\n"), n = t.findIndex((e) => e.includes("api.setState"));
	if (n < 0) return;
	let r = t[n + 1]?.trim() || "";
	return /.+ (.+) .+/.exec(r)?.[1];
}, c = (e, t = {}) => (r, c, u) => {
	let { enabled: d, anonymousActionType: f, store: p, ...m } = t, h;
	try {
		h = (d ?? !1) && window.__REDUX_DEVTOOLS_EXTENSION__;
	} catch {}
	if (!h) return e(r, c, u);
	let { connection: g, ..._ } = a(p, h, m), v = !0;
	u.setState = ((e, t, n) => {
		let a = r(e, t);
		if (!v) return a;
		let o = n === void 0 ? { type: f || s((/* @__PURE__ */ Error()).stack) || "anonymous" } : typeof n == "string" ? { type: n } : n;
		return p === void 0 ? (g?.send(o, c()), a) : (g?.send({
			...o,
			type: `${p}/${o.type}`
		}, {
			...i(m.name),
			[p]: u.getState()
		}), a);
	}), u.devtools = { cleanup: () => {
		g && typeof g.unsubscribe == "function" && g.unsubscribe(), o(m.name, p);
	} };
	let y = (...e) => {
		let t = v;
		v = !1, r(...e), v = t;
	}, b = e(u.setState, c, u);
	if (_.type === "untracked" ? g?.init(b) : (_.stores[_.store] = u, g?.init(Object.fromEntries(Object.entries(_.stores).map(([e, t]) => [e, e === _.store ? b : t.getState()])))), n(u)) {
		let e = u.dispatch;
		u.dispatch = (...t) => {
			e(...t);
		};
	}
	return g.subscribe((e) => {
		switch (e.type) {
			case "ACTION":
				if (typeof e.payload != "string") {
					console.error("[zustand devtools middleware] Unsupported action format");
					return;
				}
				return l(e.payload, (e) => {
					if (e.type === "__setState") {
						if (p === void 0) {
							y(e.state);
							return;
						}
						Object.keys(e.state).length !== 1 && console.error("\n                    [zustand devtools middleware] Unsupported __setState action format.\n                    When using 'store' option in devtools(), the 'state' should have only one key, which is a value of 'store' that was passed in devtools(),\n                    and value of this only key should be a state object. Example: { \"type\": \"__setState\", \"state\": { \"abc123Store\": { \"foo\": \"bar\" } } }\n                    ");
						let t = e.state[p];
						if (t == null) return;
						JSON.stringify(u.getState()) !== JSON.stringify(t) && y(t);
					} else n(u) && u.dispatch(e);
				});
			case "DISPATCH":
				switch (e.payload.type) {
					case "RESET": return y(b), p === void 0 ? g?.init(u.getState()) : g?.init(i(m.name));
					case "COMMIT":
						if (p === void 0) {
							g?.init(u.getState());
							return;
						}
						return g?.init(i(m.name));
					case "ROLLBACK": return l(e.state, (e) => {
						p === void 0 ? (y(e), g?.init(u.getState())) : (y(e[p]), g?.init(i(m.name)));
					});
					case "JUMP_TO_STATE":
					case "JUMP_TO_ACTION": return l(e.state, (e) => {
						p === void 0 ? y(e) : JSON.stringify(u.getState()) !== JSON.stringify(e[p]) && y(e[p]);
					});
					case "IMPORT_STATE": {
						let { nextLiftedState: t } = e.payload, n = t.computedStates.slice(-1)[0]?.state;
						if (!n) return;
						y(p === void 0 ? n : n[p]), g?.send(null, t);
						return;
					}
					case "PAUSE_RECORDING": return v = !v;
				}
				return;
		}
	}), b;
}, l = (e, t) => {
	let n;
	try {
		n = JSON.parse(e);
	} catch (e) {
		console.error("[zustand devtools middleware] Could not parse the received json", e);
	}
	n !== void 0 && t(n);
}, u = (e) => {
	let t, n = /* @__PURE__ */ new Set(), r = (e, r) => {
		let i = typeof e == "function" ? e(t) : e;
		if (!Object.is(i, t)) {
			let e = t;
			t = r ?? (typeof i != "object" || !i) ? i : Object.assign({}, t, i), n.forEach((n) => n(t, e));
		}
	}, i = () => t, a = {
		setState: r,
		getState: i,
		getInitialState: () => o,
		subscribe: (e) => (n.add(e), () => n.delete(e))
	}, o = t = e(r, i, a);
	return a;
}, d = ((e) => e ? u(e) : u);
// packages/pstdio-workbench/src/core/shared/workbench-effect.ts
function f(e, t) {
	try {
		return t();
	} catch (t) {
		console.error(`Workbench effect failed (${e})`, t);
		return;
	}
}
// packages/pstdio-workbench/src/core/shared/store/workbench-batch.ts
var p = 0, m = /* @__PURE__ */ new Map(), h = (e, t) => {
	p === 0 ? f("store subscriber", t) : m.has(e) || m.set(e, t);
}, g = (e) => {
	p++;
	try {
		return e();
	} finally {
		if (p--, p === 0) {
			p++;
			try {
				for (; m.size;) {
					let [e, t] = m.entries().next().value;
					m.delete(e), f("store subscriber", t);
				}
			} finally {
				p--;
			}
		}
	}
}, _ = /* @__PURE__ */ new WeakMap(), v = (e, t) => {
	let n = _.get(e);
	if (!n) throw Error("Unknown workbench store");
	return n(t);
}, y = (e, t) => Object.is(e, t), b = (e) => {
	let t = d()(c(() => e.initialState, { name: e.name ?? "workbench.store" })), n = (e) => {
		let n = {};
		return t.subscribe((r, i) => h(n, () => e(t.getState(), i)));
	}, r = {
		getState: t.getState,
		getInitialState: t.getInitialState,
		subscribe: n,
		subscribeSelector: (e, r, i = {}) => {
			let a = i.equalityFn ?? y, o = e(t.getState());
			return i.fireImmediately && r(o, o), n((t) => {
				let n = e(t);
				if (a(o, n)) return;
				let i = o;
				o = n, r(n, i);
			});
		},
		setState: t.setState,
		api: t
	};
	return _.set(r, (e) => t.subscribe(e)), r;
}, x = (t, n) => {
	let r = t;
	for (let i of n.values()) e(i.resource) === e(t) && (r = "removed" in i.change ? void 0 : {
		...t,
		label: i.change.label
	});
	return r;
}, S = () => {
	let n = b({
		name: "workbench.resource-preview",
		initialState: { changes: /* @__PURE__ */ new Map() }
	}), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set(), a = (e) => {
		let t = new Map(n.getState().changes);
		t.delete(e), n.setState({ changes: t });
	};
	return {
		store: n,
		resolve(e) {
			return x(e, n.getState().changes);
		},
		persist(t, n) {
			let i = e(t), a = (r.get(i) ?? Promise.resolve()).catch(() => void 0).then(n);
			return r.set(i, a), a.finally(() => {
				r.get(i) === a && r.delete(i);
			}).catch(() => void 0), a;
		},
		subscribeRefresh(e) {
			return i.add(e), t(() => i.delete(e));
		},
		begin(e, t) {
			let r = Symbol("resource mutation");
			return n.setState({ changes: new Map([...n.getState().changes, [r, {
				resource: e,
				change: t
			}]]) }), {
				rollback: () => a(r),
				async commit() {
					await Promise.allSettled([...i].map((t) => t(e))), a(r);
				}
			};
		}
	};
}, C = "workbench.core", w = (e = {}) => ({
	source: e.source ?? "module",
	ownerId: e.ownerId ?? C,
	priority: e.priority ?? 0
}), T = (e, t) => t.priority - e.priority || e.ownerId.localeCompare(t.ownerId), E = (e) => "viewId" in e && e.type === "view", D = "resource_hierarchy_cycle", O = (e) => [...e].sort((e, t) => t.priority - e.priority || e.id.localeCompare(t.id)), k = (t, n, r) => {
	let i = O(t), a = [n], o = /* @__PURE__ */ new Set([`resource:${e(n)}`]), s = n;
	for (;;) {
		let t = i.find((e) => e.canResolve(s))?.getParent(s);
		if (!t) break;
		let n = E(t) ? `view:${t.viewId}` : `resource:${e(t)}`;
		if (o.has(n)) {
			r({
				code: D,
				path: [...a],
				repeatedUri: E(t) ? n : e(t)
			});
			break;
		}
		if (a.unshift(t), o.add(n), E(t)) break;
		s = t;
	}
	return a;
}, A = "workbench.resource.type", j = "workbench.resource.extensionId", M = "workbench.resource.id", N = (e) => `workbench.resource.metadata.${e}`, P = "workbench.selectionResourceKey", F = (e) => typeof e == "string" || typeof e == "number" || typeof e == "boolean", I = (e) => {
	if (!e) return {};
	let t = {
		[A]: e.type,
		[M]: e.id,
		[j]: e.extensionId
	};
	for (let [n, r] of Object.entries(e.metadata ?? {})) F(r) && (t[N(n)] = r);
	return t;
}, L = (e) => e === "workbench.resource.type" || e === "workbench.resource.extensionId" || e === "workbench.resource.id" || e.startsWith(N("")), R = (e, t) => {
	let n = {};
	for (let [t, r] of Object.entries(e)) L(t) || (n[t] = r);
	return {
		...n,
		...I(t)
	};
}, z = (t) => {
	if (!t) return [];
	let n = t.metadata?.[P];
	return typeof n != "string" || n === e(t) ? [e(t)] : [e(t), n];
}, B = (n = {}) => {
	let r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Map(), o = crypto.getRandomValues(/* @__PURE__ */ new Uint32Array(4)).join("-"), s = 0, c = /* @__PURE__ */ new Set(), l = b({
		name: "workbench.resources",
		initialState: {
			kinds: {},
			providers: {},
			hierarchyProviders: {}
		}
	});
	return {
		store: l,
		preview: S(),
		getRemovalVersion: () => s,
		getRemovalEpoch: () => o,
		wasRemovedSince: (t, n) => (a.get(e(t)) ?? 0) > n,
		removed(t) {
			a.set(e(t), ++s);
			let o = [...r].flatMap((e) => e(t));
			try {
				n.remove?.(t, o);
			} finally {
				for (let e of i) e(t);
			}
		},
		onWillRemove(e) {
			return r.add(e), t(() => r.delete(e));
		},
		onDidRemove(e) {
			return i.add(e), t(() => i.delete(e));
		},
		registerKind(e, n) {
			let r = l.getState(), i = e.extensionId ? `${e.extensionId}:${e.kind}` : e.kind;
			if (r.kinds[i]) throw Error(`Resource kind already registered: ${i}`);
			let a = {
				...w(n),
				...e
			};
			return l.setState({
				...r,
				kinds: {
					...r.kinds,
					[i]: a
				}
			}, !1, "registerKind"), t(() => {
				let e = l.getState();
				if (e.kinds[i] !== a) return;
				let { [i]: t, ...n } = e.kinds;
				l.setState({
					...e,
					kinds: n
				}, !1, "unregisterKind");
			});
		},
		getKind(e, t) {
			let n = l.getState().kinds;
			return t ? n[`${t}:${e}`] ?? n[e] : n[e] ?? Object.values(n).find((t) => t.kind === e);
		},
		listKinds() {
			return Object.values(l.getState().kinds).sort(T);
		},
		registerProvider(e) {
			let n = l.getState();
			if (n.providers[e.id]) throw Error(`Resource provider already registered: ${e.id}`);
			return l.setState({
				...n,
				providers: {
					...n.providers,
					[e.id]: e
				}
			}, !1, "registerProvider"), t(() => {
				let t = l.getState();
				if (t.providers[e.id] !== e) return;
				let { [e.id]: n, ...r } = t.providers;
				l.setState({
					...t,
					providers: r
				}, !1, "unregisterProvider");
			});
		},
		listProviders() {
			return Object.values(l.getState().providers);
		},
		listResources(e) {
			let t = { primary: n.getPrimary?.() }, r = [];
			for (let n of Object.values(l.getState().providers)) r.push(...n.list(e, t));
			return r;
		},
		listRelatedResources(e) {
			return Object.values(l.getState().providers).flatMap((t) => t.related?.(e) ?? []);
		},
		registerHierarchyProvider(e) {
			let n = l.getState();
			if (n.hierarchyProviders[e.id]) throw Error(`Resource hierarchy provider already registered: ${e.id}`);
			let r = {
				...e,
				priority: e.priority ?? 0
			};
			return l.setState({
				...n,
				hierarchyProviders: {
					...n.hierarchyProviders,
					[e.id]: r
				}
			}, !1, "registerHierarchyProvider"), t(() => {
				let t = l.getState();
				if (t.hierarchyProviders[e.id] !== r) return;
				let { [e.id]: n, ...i } = t.hierarchyProviders;
				l.setState({
					...t,
					hierarchyProviders: i
				}, !1, "unregisterHierarchyProvider");
			});
		},
		listHierarchyProviders() {
			return O(Object.values(l.getState().hierarchyProviders));
		},
		walkHierarchy(e) {
			return e ? k(Object.values(l.getState().hierarchyProviders), e, (e) => {
				for (let t of c) t(e);
			}).map((e) => {
				if (!E(e)) return e;
				let t = n.resolveView?.(e.viewId);
				return t ? {
					...e,
					label: t.label,
					icon: t.icon
				} : e;
			}) : [];
		},
		onDidDetectHierarchyCycle(e) {
			return c.add(e), t(() => {
				c.delete(e);
			});
		}
	};
};
export { A as a, x as c, g as d, h as f, N as i, b as l, t as m, z as n, T as o, f as p, R as r, w as s, B as t, v as u };
