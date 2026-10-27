// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useEffect as e, useRef as t, useState as n } from "react";
import { jsx as r } from "react/jsx-runtime";
// packages/pstdio-api-contracts/src/extension-kernel/types/webview-capabilities.ts
var i = /* @__PURE__ */ "clipboard.write,commands.execute,commands.stream,editing.session,harnesses.read,resources.actions,navigation.open,page.params.update,placement.close,notification.show,notification.action,notification.resolve,notification.dismiss,preferences.get,preferences.set,extension.settings.all,extension.settings.get,extension.settings.set,extension.settings.delete,terminal.session,files.upload,files.list,files.delete,account.read,account.manage,performance.read,performance.control".split(","), a = ["artifacts.read"], o = [...i.filter((e) => e !== "clipboard.write"), ...a];
// node_modules/.bun/rimless@0.8.3/node_modules/rimless/lib/rimless.js
function s() {
	let e = globalThis;
	if (e.window !== void 0 && e.document !== void 0) return "browser";
	if (e.WorkerGlobalScope !== void 0 && e.self !== void 0 && e.self instanceof e.WorkerGlobalScope || e.window === void 0 && e.self !== void 0 && typeof e.importScripts == "function") return "worker";
	let t = e.process;
	if (t && typeof t == "object") {
		let n = t.versions ?? {}, r = t.release?.name;
		if (n.bun || r === "bun" || e.Bun !== void 0) return "bun";
		if (n.node && r === "node") return "node";
	}
	return e.Bun === void 0 ? "browser" : "bun";
}
function c() {
	return s();
}
function l() {
	return c() === "worker";
}
function u() {
	let e = c();
	return e === "node" || e === "bun";
}
function d(e) {
	let t = {};
	return (function e(n, r = "") {
		Object.keys(n).forEach((i) => {
			let a = r ? `${r}.${i}` : i;
			n[i] === Object(n[i]) && e(n[i], a), typeof n[i] == "function" && (t[a] = n[i], delete n[i]);
		});
	})(e), t;
}
var f = /^(https?:|file:)?\/\/([^/:]+)?(:(\d+))?/, p = {
	"http:": "80",
	"https:": "443"
};
function m(e) {
	if (!e) return null;
	let t = f.exec(e);
	if (!t) return null;
	let [, n = "http:", r, , i] = t;
	return n === "file:" ? "file://" : `${n}//${r}${i && i !== p[n] ? `:${i}` : ""}`;
}
function h(e) {
	return !e || e === "null" ? "*" : e;
}
function g(e, t, n) {
	if (!e || typeof e != "object") return e;
	let r = Array.isArray(t) ? t : t.split(".").map((e) => e.match(/^\d+$/) ? Number(e) : e), i = e;
	for (let e = 0; e < r.length; e++) {
		let t = r[e];
		e === r.length - 1 ? i[t] = n : (i[t] && typeof i[t] == "object" || (i[t] = typeof r[e + 1] == "number" ? [] : {}), i = i[t]);
	}
	return e;
}
function _(e = 10) {
	let t = "";
	for (let n = 0; n < e; n++) t += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 62));
	return t;
}
var v = c(), y = null;
if (v === "node" || v === "bun") try {
	let e = globalThis.require;
	y = e?.("node:worker_threads")?.parentPort ?? null;
} catch {}
function b(e, t, n, r) {
	if (!e) throw Error("Rimless Error: No target specified for postMessage");
	if (u() && e === y) e.postMessage(t, { transfer: r });
	else if (l()) e.postMessage(t, { transfer: r });
	else if (e.postMessage) e.postMessage(t, {
		targetOrigin: h(n),
		transfer: r
	});
	else throw Error("Rimless Error: Invalid target for postMessage");
}
function x(e) {
	return y !== null && e === y;
}
function S(e) {
	return x(e) || typeof Worker < "u" && e instanceof Worker;
}
function C(e, t, n) {
	x(e) ? e.on(t, n) : "addEventListener" in e && e.addEventListener(t, n);
}
function w(e, t, n) {
	x(e) ? e.off(t, n) : "removeEventListener" in e && e.removeEventListener(t, n);
}
function T(e) {
	return e.data || e;
}
var E = /* @__PURE__ */ function(e) {
	return e.MESSAGE = "message", e;
}({}), D = /* @__PURE__ */ function(e) {
	return e.HANDSHAKE_REQUEST = "RIMLESS/HANDSHAKE_REQUEST", e.HANDSHAKE_REPLY = "RIMLESS/HANDSHAKE_REPLY", e.RPC_REQUEST = "RIMLESS/RPC_REQUEST", e.RPC_RESOLVE = "RIMLESS/RPC_RESOLVE", e.RPC_REJECT = "RIMLESS/RPC_REJECT", e;
}({}), O = Symbol();
function k(e = {}, t, n, r, i) {
	let a = [];
	for (let [o, s] of Object.entries(e)) {
		async function e(e) {
			let { action: n, callID: a, connectionID: c, callName: l, args: u = [] } = T(e);
			if (n !== D.RPC_REQUEST || !a || !l || l !== o || c !== t) return;
			let d = {
				action: D.RPC_RESOLVE,
				callID: a,
				callName: l,
				connectionID: c,
				error: null,
				result: null
			}, f;
			try {
				d.result = await s(...u, i), d.result?.[O] && (f = d.result[O] ?? [], delete d.result[O]);
			} catch (e) {
				d.action = D.RPC_REJECT, d.error = JSON.parse(JSON.stringify(e, Object.getOwnPropertyNames(e)));
			}
			b(r, d, e?.origin, f);
		}
		C(n, E.MESSAGE, e), a.push(() => w(n, E.MESSAGE, e));
	}
	return () => a.forEach((e) => e());
}
function A(e, t, n, r = /* @__PURE__ */ new Set(), i, a) {
	return (...o) => new Promise((s, c) => {
		let l = _();
		function u() {
			w(i, E.MESSAGE, d), r.delete(u);
		}
		function d(n) {
			let { callID: r, connectionID: i, callName: a, result: o, error: d, action: f } = T(n);
			if (r && a && a === e && r === l && i === t) {
				if (f === D.RPC_RESOLVE) return u(), s(o);
				if (f === D.RPC_REJECT) return u(), c(d);
			}
		}
		let f = {
			action: D.RPC_REQUEST,
			args: o,
			callID: l,
			callName: e,
			connectionID: t
		}, p = o.reduce((e, t) => t[O]?.length ? e.concat(t[O]) : e, o[O] ?? []);
		C(i, E.MESSAGE, d), r.add(u), b(a, f, n?.origin, p);
	});
}
function j(e = {}, t = [], n, r, i, a) {
	let o = { ...e }, s = /* @__PURE__ */ new Set();
	for (let e of t) g(o, e, A(e, n, r, s, i, a));
	return {
		remote: o,
		unregisterRemote: () => s.forEach((e) => e())
	};
}
var M = {};
function N(e, t) {
	if (x(e) || typeof Worker < "u" && e instanceof Worker) return !0;
	let n = e;
	try {
		let e = n.src, r = typeof n.srcdoc == "string" && n.srcdoc.length > 0, i = m(e), a = t.origin === i, o = t.source === n.contentWindow;
		return t.origin === "null" && n.hasAttribute("sandbox") && !n.sandbox.contains("allow-same-origin") || r || e === "about:blank" ? o : a && o || !e;
	} catch (e) {
		return console.warn("Error checking iframe target:", e), !1;
	}
}
function P(e, t = {}) {
	if (!e) throw Error("a target is required");
	let n = S(e), r = n || u() ? e : window;
	return new Promise((i) => {
		let a = _();
		function o(i) {
			let c = n || u() ? e : i.source;
			if (!n && !u() && !N(e, i)) return;
			let l = T(i);
			if (l?.action !== D.HANDSHAKE_REQUEST || M[a]) return;
			let f = d(t), { remote: p, unregisterRemote: m } = j(l.schema, l.methodNames, a, i, r, c), h = k(f, a, r, c, p);
			b(c, {
				action: D.HANDSHAKE_REPLY,
				connectionID: a,
				schema: t,
				methodNames: Object.keys(f)
			}, i.origin), M[a] = {
				remote: p,
				close: () => {
					delete M[a], w(r, E.MESSAGE, o), w(r, E.MESSAGE, s), m(), h(), n && e.terminate();
				},
				id: a
			};
		}
		C(r, E.MESSAGE, o);
		function s(e) {
			let t = T(e);
			if (t?.action === D.HANDSHAKE_REPLY && a === t.connectionID) {
				if (!M[t.connectionID]) throw Error("Rimless Error: No connection found for this connectionID");
				return i(M[t.connectionID]);
			}
		}
		C(r, E.MESSAGE, s);
	});
}
var ee = { connect: P }, F = /* @__PURE__ */ new Set([...o, ...i]), I = new Set(a), L = (e) => F.has(e), R = (e) => I.has(e), z = (e) => {
	let [t = "", n] = e.split("@"), r = t.indexOf(":");
	return {
		capability: e,
		name: r === -1 ? t : t.slice(0, r),
		scope: r === -1 ? void 0 : t.slice(r + 1),
		version: n === void 0 ? 1 : Number(n)
	};
}, B = (e) => R(e.name) ? !!e.scope : e.scope === void 0, V = (e) => ({
	capability: e,
	code: "unsupported_webview_capability",
	message: `Unsupported webview capability: ${e}`,
	severity: "error"
}), H = (e, t, n) => ({
	capability: e,
	code: "unsupported_webview_capability_version",
	message: `Unsupported webview capability version: ${t}@${n.toString()} (supported: 1)`,
	severity: "error"
}), U = (e) => ({
	capability: e,
	code: "undeclared_webview_capability",
	message: `Webview did not declare host capability: ${e}`,
	severity: "error"
}), W = (e, t = {}) => {
	let n = [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Map();
	for (let a of e ?? []) {
		let e = z(a);
		if (!L(e.name) || !B(e)) {
			n.push(V(a));
			continue;
		}
		if (e.version !== 1) {
			n.push(H(a, e.name, e.version));
			continue;
		}
		if (e.name === "clipboard.write") continue;
		if (!t[e.name]) {
			n.push(V(a));
			continue;
		}
		if (e.scope === void 0) {
			r.add(e.name);
			continue;
		}
		let o = i.get(e.name) ?? /* @__PURE__ */ new Set();
		o.add(e.scope), i.set(e.name, o);
	}
	return {
		allowed: r,
		allowedScopes: i,
		diagnostics: n
	};
}, G = (e) => {
	let t = e.params;
	return typeof t?.mount == "string" && t.mount.length > 0 ? t.mount : void 0;
}, K = (e) => {
	let { allowed: t, allowedScopes: n, diagnostics: r } = W(e.declaredCapabilities, e.capabilities), i = (t) => {
		e.onDiagnostic?.(t);
	}, a = (e) => (i(e), Object.assign(Error(e.message), {
		code: e.code,
		data: { capability: e.capability }
	}));
	return {
		diagnostics: r,
		async call(r) {
			if (!L(r.method) || r.method === "clipboard.write") throw a(V(r.method));
			if (R(r.method)) {
				let e = G(r);
				if (!e) throw a(V(r.method));
				if (!n.get(r.method)?.has(e)) throw a(U(`${r.method}:${e}`));
			} else if (!t.has(r.method)) throw a(U(r.method));
			let i = e.capabilities[r.method];
			if (!i) throw a(V(r.method));
			return await i(r.params);
		}
	};
}, q = (e = {}) => {
	let t = e.locale ?? "en";
	return {
		...e,
		projectId: e.projectId,
		themePreference: e.themePreference ?? "system",
		locale: t,
		resource: e.resource,
		pageLocation: e.pageLocation,
		pageParams: e.pageParams ?? {},
		translations: e.translations ?? {
			locale: t,
			defaultLocale: t,
			bundle: {},
			defaultBundle: {}
		}
	};
}, J = (e) => typeof e == "object" && !!e, Y = (e) => {
	try {
		let t = JSON.stringify(e);
		if (typeof t == "string" && t.length > 0) return t;
	} catch {}
	try {
		return String(e);
	} catch {
		return "Unknown error";
	}
}, X = (e) => {
	if (e instanceof Error) return {
		message: e.message,
		stack: e.stack
	};
	if (typeof e == "string") return { message: e };
	if (J(e)) {
		let t = typeof e.message == "string" ? e.message : null, n = typeof e.stack == "string" ? e.stack : void 0;
		return t ? n ? {
			message: t,
			stack: n
		} : { message: t } : { message: Y(e) };
	}
	return e == null ? { message: "Unknown error" } : { message: Y(e) };
}, Z = async (e) => {
	try {
		return {
			ok: !0,
			value: await e()
		};
	} catch (e) {
		let t = typeof e == "object" && e ? e : {};
		return {
			ok: !1,
			error: {
				code: "code" in t && typeof t.code == "string" ? t.code : "webview_capability_failed",
				message: X(e).message,
				..."data" in t ? { data: t.data } : {}
			}
		};
	}
}, te = (e = []) => e.some((e) => e === "clipboard.write" || e === "clipboard.write@1") ? "fullscreen; clipboard-write" : "fullscreen", Q = () => {
	if (typeof document > "u") return {};
	let e = getComputedStyle(document.documentElement), t = {};
	for (let n = 0; n < e.length; n += 1) {
		let r = e.item(n);
		r.startsWith("--chakra-") && (t[r] = e.getPropertyValue(r).trim());
	}
	return t;
}, $ = (e) => {
	if (typeof document > "u") return e;
	let t = document.documentElement.getAttribute("data-theme");
	if (t === "dark" || t === "light") return t;
	let n = document.documentElement.getAttribute("data-color-mode");
	return n === "dark" || n === "light" ? n : e;
}, ne = {
	border: 0,
	display: "block",
	flex: "1 1 0%",
	height: "100%",
	minHeight: 0,
	width: "100%"
}, re = {
	display: "flex",
	height: "100%",
	minHeight: 0,
	position: "relative",
	width: "100%"
}, ie = "allow-scripts allow-forms allow-popups", ae = (i) => {
	let { view: a, props: o, theme: s, capabilities: c, onKeyboardEvent: l, hostEvents: u, onReady: d, onError: f, onDiagnostics: p, title: m, sizing: h } = i, g = t(null), _ = t(null), v = t(!1), y = t(null), b = t(q(o)), x = t(s), S = t(c), C = t(l), w = t(u), T = t(a.webview.capabilities), E = t(d), D = t(f), O = t(p), [k, A] = n(0), [j, M] = n(0), [N, P] = n(0);
	return b.current = q(o), x.current = s, S.current = c, C.current = l, w.current = u, T.current = a.webview.capabilities, E.current = d, D.current = f, O.current = p, e(() => {
		let e = g.current;
		if (!e) return;
		let t = () => {
			e.contentWindow !== y.current && A((e) => e + 1);
		};
		e.addEventListener("load", t);
		let n = () => e.removeEventListener("load", t);
		if (e.contentWindow === y.current) return n;
		y.current = e.contentWindow;
		let r = a.webview.styles, i = a.webview.moduleUrl, o = (e) => {
			e.length > 0 && O.current?.(e);
		}, s = () => K({
			capabilities: S.current ?? {},
			declaredCapabilities: T.current,
			onDiagnostic: (e) => o([e])
		});
		o(s().diagnostics);
		let c = {
			dispatchPointerEvent: (t) => {
				if (g.current !== e || !e.isConnected || t.type !== "pointerdown" && t.type !== "click") return;
				let n = e.getBoundingClientRect();
				n.width && n.height && e.dispatchEvent(new PointerEvent(t.type, {
					...t,
					bubbles: !0,
					composed: !0,
					cancelable: !0,
					clientX: n.left + t.clientX * (n.width / e.clientWidth),
					clientY: n.top + t.clientY * (n.height / e.clientHeight)
				}));
			},
			contentHeightChanged: (e) => {
				h === "content-height" && Number.isFinite(e) && e >= 0 && P(e);
			},
			contentWidthChanged: (e) => {
				h === "content-width" && Number.isFinite(e) && e >= 0 && M(e);
			},
			dispatchKeyboardEvent: async (e) => {
				if (C.current) return C.current(e);
				document.dispatchEvent(new KeyboardEvent("keydown", {
					...e,
					bubbles: !0,
					cancelable: !0
				}));
			},
			ready: () => {},
			runtimeError: (e) => {
				D.current?.(e);
			},
			call: async (e) => await Z(() => s().call(e))
		};
		return (() => {
			v.current = !1, _.current = null;
			let t = ee.connect(e, c);
			e.contentWindow?.location.replace(a.webview.runtimeUrl), t.then(async (t) => {
				if (g.current !== e) return;
				let n = t.remote;
				_.current = n, w.current?.bind((e) => n.hostEvent?.(e)), await n.init({
					sizing: h,
					moduleUrl: i,
					styles: r,
					props: b.current,
					theme: $(x.current),
					themeVariables: Q(),
					extensionId: a.extensionId
				}), g.current === e && (v.current = !0, E.current?.());
			}).catch((t) => {
				g.current === e && D.current?.(X(t));
			});
		})(), n;
	}, [
		k,
		h,
		a.extensionId,
		a.webview.runtimeUrl,
		a.webview.moduleUrl,
		a.webview.styles
	]), e(() => {
		let e = _.current;
		return e && u?.bind((t) => e.hostEvent?.(t)), () => u?.unbind();
	}, [u, k]), e(() => {
		v.current && _.current?.propsUpdate({ props: q(o) });
	}, [o]), e(() => {
		v.current && _.current?.themeUpdate({
			theme: $(s),
			variables: Q()
		});
	}, [s]), e(() => {
		if (typeof window > "u" || typeof MutationObserver > "u") return;
		let e = null, t = new MutationObserver(() => {
			e !== null && cancelAnimationFrame(e), e = requestAnimationFrame(() => {
				e = null, v.current && _.current?.themeUpdate({
					theme: $(x.current),
					variables: Q()
				});
			});
		}), n = {
			attributeFilter: [
				"class",
				"data-color-mode",
				"data-theme",
				"style"
			],
			attributes: !0
		};
		return t.observe(document.documentElement, n), t.observe(document.body, n), () => {
			t.disconnect(), e !== null && cancelAnimationFrame(e);
		};
	}, []), /* @__PURE__ */ r("div", {
		style: {
			...re,
			width: h === "content-width" ? j : "100%",
			height: h === "content-height" ? N : "100%"
		},
		children: /* @__PURE__ */ r("iframe", {
			ref: g,
			title: m ?? a.label,
			allow: te(a.webview.capabilities),
			sandbox: ie,
			style: {
				...ne,
				colorScheme: s
			},
			onError: () => {
				D.current?.({ message: `Failed to load extension runtime at ${a.webview.runtimeUrl}` });
			}
		}, `${k}\n${a.webview.runtimeUrl}\n${a.webview.moduleUrl}`)
	});
};
export { K as n, ae as t };
