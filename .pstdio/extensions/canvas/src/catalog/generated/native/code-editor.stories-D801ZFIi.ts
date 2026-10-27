// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { h as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { n as a, t as o } from "./theme-preference-Blf4BFb2.ts";
import { t as s } from "./theme-DixNI82Q.ts";
import c, { Suspense as l, lazy as u, memo as d, useCallback as f, useEffect as p, useId as m, useRef as h, useState as g } from "react";
import { Box as _, Button as v, Stack as y } from "@chakra-ui/react";
import { jsx as b, jsxs as x } from "react/jsx-runtime";
// node_modules/.bun/@monaco-editor+loader@1.7.0/node_modules/@monaco-editor/loader/lib/es/_virtual/_rollupPluginBabelHelpers.js
function S(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function C(e) {
	if (Array.isArray(e)) return e;
}
function w(e, t, n) {
	return (t = N(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function T(e, t) {
	var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n != null) {
		var r, i, a, o, s = [], c = !0, l = !1;
		try {
			if (a = (n = n.call(e)).next, t !== 0) for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
		} catch (e) {
			l = !0, i = e;
		} finally {
			try {
				if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
			} finally {
				if (l) throw i;
			}
		}
		return s;
	}
}
function E() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function D(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function O(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? D(Object(n), !0).forEach(function(t) {
			w(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : D(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function k(e, t) {
	if (e == null) return {};
	var n, r, i = A(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function A(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function j(e, t) {
	return C(e) || T(e, t) || P(e, t) || E();
}
function M(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t);
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function N(e) {
	var t = M(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function P(e, t) {
	if (e) {
		if (typeof e == "string") return S(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? S(e, t) : void 0;
	}
}
// node_modules/.bun/state-local@1.0.7/node_modules/state-local/lib/es/state-local.js
function F(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function I(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function L(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? I(Object(n), !0).forEach(function(t) {
			F(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : I(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function R() {
	var e = [...arguments];
	return function(t) {
		return e.reduceRight(function(e, t) {
			return t(e);
		}, t);
	};
}
function z(e) {
	return function t() {
		var n = this, r = [...arguments];
		return r.length >= e.length ? e.apply(this, r) : function() {
			var e = [...arguments];
			return t.apply(n, [].concat(r, e));
		};
	};
}
function B(e) {
	return {}.toString.call(e).includes("Object");
}
function ee(e) {
	return !Object.keys(e).length;
}
function V(e) {
	return typeof e == "function";
}
function te(e, t) {
	return Object.prototype.hasOwnProperty.call(e, t);
}
function ne(e, t) {
	return B(t) || H("changeType"), Object.keys(t).some(function(t) {
		return !te(e, t);
	}) && H("changeField"), t;
}
function re(e) {
	V(e) || H("selectorType");
}
function ie(e) {
	V(e) || B(e) || H("handlerType"), B(e) && Object.values(e).some(function(e) {
		return !V(e);
	}) && H("handlersType");
}
function ae(e) {
	e || H("initialIsRequired"), B(e) || H("initialType"), ee(e) && H("initialContent");
}
function oe(e, t) {
	throw Error(e[t] || e.default);
}
var H = z(oe)({
	initialIsRequired: "initial state is required",
	initialType: "initial state should be an object",
	initialContent: "initial state shouldn't be an empty object",
	handlerType: "handler should be an object or a function",
	handlersType: "all handlers should be a functions",
	selectorType: "selector should be a function",
	changeType: "provided value of changes should be an object",
	changeField: "it seams you want to change a field in the state which is not specified in the \"initial\" state",
	default: "an unknown error accured in `state-local` package"
}), U = {
	changes: ne,
	selector: re,
	handler: ie,
	initial: ae
};
function se(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
	U.initial(e), U.handler(t);
	var n = { current: e }, r = z(ue)(n, t), i = z(le)(n), a = z(U.changes)(e), o = z(ce)(n);
	function s() {
		var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : function(e) {
			return e;
		};
		return U.selector(e), e(n.current);
	}
	function c(e) {
		R(r, i, a, o)(e);
	}
	return [s, c];
}
function ce(e, t) {
	return V(t) ? t(e.current) : t;
}
function le(e, t) {
	return e.current = L(L({}, e.current), t), t;
}
function ue(e, t, n) {
	return V(t) ? t(e.current) : Object.keys(n).forEach(function(n) {
		return t[n]?.call(t, e.current[n]);
	}), n;
}
var de = { create: se }, fe = { paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs" } };
// node_modules/.bun/@monaco-editor+loader@1.7.0/node_modules/@monaco-editor/loader/lib/es/utils/curry.js
function pe(e) {
	return function t() {
		var n = this, r = [...arguments];
		return r.length >= e.length ? e.apply(this, r) : function() {
			var e = [...arguments];
			return t.apply(n, [].concat(r, e));
		};
	};
}
// node_modules/.bun/@monaco-editor+loader@1.7.0/node_modules/@monaco-editor/loader/lib/es/utils/isObject.js
function me(e) {
	return {}.toString.call(e).includes("Object");
}
// node_modules/.bun/@monaco-editor+loader@1.7.0/node_modules/@monaco-editor/loader/lib/es/validators/index.js
function he(e) {
	return e || ye("configIsRequired"), me(e) || ye("configType"), e.urls ? (ge(), { paths: { vs: e.urls.monacoBase } }) : e;
}
function ge() {
	console.warn(ve.deprecation);
}
function _e(e, t) {
	throw Error(e[t] || e.default);
}
var ve = {
	configIsRequired: "the configuration object is required",
	configType: "the configuration object should be an object",
	default: "an unknown error accured in `@monaco-editor/loader` package",
	deprecation: "Deprecation warning!\n    You are using deprecated way of configuration.\n\n    Instead of using\n      monaco.config({ urls: { monacoBase: '...' } })\n    use\n      monaco.config({ paths: { vs: '...' } })\n\n    For more please check the link https://github.com/suren-atoyan/monaco-loader#config\n  "
}, ye = pe(_e)(ve), be = { config: he }, xe = function() {
	var e = [...arguments];
	return function(t) {
		return e.reduceRight(function(e, t) {
			return t(e);
		}, t);
	};
};
// node_modules/.bun/@monaco-editor+loader@1.7.0/node_modules/@monaco-editor/loader/lib/es/utils/deepMerge.js
function Se(e, t) {
	return Object.keys(t).forEach(function(n) {
		t[n] instanceof Object && e[n] && Object.assign(t[n], Se(e[n], t[n]));
	}), O(O({}, e), t);
}
// node_modules/.bun/@monaco-editor+loader@1.7.0/node_modules/@monaco-editor/loader/lib/es/utils/makeCancelable.js
var Ce = {
	type: "cancelation",
	msg: "operation is manually canceled"
};
function W(e) {
	var t = !1, n = new Promise(function(n, r) {
		e.then(function(e) {
			return t ? r(Ce) : n(e);
		}), e.catch(r);
	});
	return n.cancel = function() {
		return t = !0;
	}, n;
}
// node_modules/.bun/@monaco-editor+loader@1.7.0/node_modules/@monaco-editor/loader/lib/es/loader/index.js
var we = ["monaco"], Te = j(de.create({
	config: fe,
	isInitialized: !1,
	resolve: null,
	reject: null,
	monaco: null
}), 2), G = Te[0], K = Te[1];
function Ee(e) {
	var t = be.config(e), n = t.monaco, r = k(t, we);
	K(function(e) {
		return {
			config: Se(e.config, r),
			monaco: n
		};
	});
}
function De() {
	var e = G(function(e) {
		return {
			monaco: e.monaco,
			isInitialized: e.isInitialized,
			resolve: e.resolve
		};
	});
	if (!e.isInitialized) {
		if (K({ isInitialized: !0 }), e.monaco) return e.resolve(e.monaco), W(Pe);
		if (window.monaco && window.monaco.editor) return Me(window.monaco), e.resolve(window.monaco), W(Pe);
		xe(Oe, Ae)(je);
	}
	return W(Pe);
}
function Oe(e) {
	return document.body.appendChild(e);
}
function ke(e) {
	var t = document.createElement("script");
	return e && (t.src = e), t;
}
function Ae(e) {
	var t = G(function(e) {
		return {
			config: e.config,
			reject: e.reject
		};
	}), n = ke(`${t.config.paths.vs}/loader.js`);
	return n.onload = function() {
		return e();
	}, n.onerror = t.reject, n;
}
function je() {
	var e = G(function(e) {
		return {
			config: e.config,
			resolve: e.resolve,
			reject: e.reject
		};
	}), t = window.require;
	t.config(e.config), t(["vs/editor/editor.main"], function(t) {
		var n = t.m || t;
		Me(n), e.resolve(n);
	}, function(t) {
		e.reject(t);
	});
}
function Me(e) {
	G().monaco || K({ monaco: e });
}
function Ne() {
	return G(function(e) {
		return e.monaco;
	});
}
var Pe = new Promise(function(e, t) {
	return K({
		resolve: e,
		reject: t
	});
}), q = {
	config: Ee,
	init: De,
	__getMonacoInstance: Ne
}, Fe = {
	wrapper: {
		display: "flex",
		position: "relative",
		textAlign: "initial"
	},
	fullWidth: { width: "100%" },
	hide: { display: "none" }
}, Ie = { container: {
	display: "flex",
	height: "100%",
	width: "100%",
	justifyContent: "center",
	alignItems: "center"
} };
function Le({ children: e }) {
	return c.createElement("div", { style: Ie.container }, e);
}
var Re = Le;
function ze({ width: e, height: t, isEditorReady: n, loading: r, _ref: i, className: a, wrapperProps: o }) {
	return c.createElement("section", {
		style: {
			...Fe.wrapper,
			width: e,
			height: t
		},
		...o
	}, !n && c.createElement(Re, null, r), c.createElement("div", {
		ref: i,
		style: {
			...Fe.fullWidth,
			...!n && Fe.hide
		},
		className: a
	}));
}
var Be = d(ze);
function Ve(e) {
	p(e, []);
}
var He = Ve;
function Ue(e, t, n = !0) {
	let r = h(!0);
	p(r.current || !n ? () => {
		r.current = !1;
	} : e, t);
}
var J = Ue;
function Y() {}
function X(e, t, n, r) {
	return We(e, r) || Ge(e, t, n, r);
}
function We(e, t) {
	return e.editor.getModel(Ke(e, t));
}
function Ge(e, t, n, r) {
	return e.editor.createModel(t, n, r ? Ke(e, r) : void 0);
}
function Ke(e, t) {
	return e.Uri.parse(t);
}
function qe({ original: e, modified: t, language: n, originalLanguage: r, modifiedLanguage: i, originalModelPath: a, modifiedModelPath: o, keepCurrentOriginalModel: s = !1, keepCurrentModifiedModel: l = !1, theme: u = "light", loading: d = "Loading...", options: m = {}, height: _ = "100%", width: v = "100%", className: y, wrapperProps: b = {}, beforeMount: x = Y, onMount: S = Y }) {
	let [C, w] = g(!1), [T, E] = g(!0), D = h(null), O = h(null), k = h(null), A = h(S), j = h(x), M = h(!1);
	He(() => {
		let e = q.init();
		return e.then((e) => (O.current = e) && E(!1)).catch((e) => e?.type !== "cancelation" && console.error("Monaco initialization: error:", e)), () => D.current ? F() : e.cancel();
	}), J(() => {
		if (D.current && O.current) {
			let t = D.current.getOriginalEditor(), i = X(O.current, e || "", r || n || "text", a || "");
			i !== t.getModel() && t.setModel(i);
		}
	}, [a], C), J(() => {
		if (D.current && O.current) {
			let e = D.current.getModifiedEditor(), r = X(O.current, t || "", i || n || "text", o || "");
			r !== e.getModel() && e.setModel(r);
		}
	}, [o], C), J(() => {
		let e = D.current.getModifiedEditor();
		e.getOption(O.current.editor.EditorOption.readOnly) ? e.setValue(t || "") : t !== e.getValue() && (e.executeEdits("", [{
			range: e.getModel().getFullModelRange(),
			text: t || "",
			forceMoveMarkers: !0
		}]), e.pushUndoStop());
	}, [t], C), J(() => {
		D.current?.getModel()?.original.setValue(e || "");
	}, [e], C), J(() => {
		let { original: e, modified: t } = D.current.getModel();
		O.current.editor.setModelLanguage(e, r || n || "text"), O.current.editor.setModelLanguage(t, i || n || "text");
	}, [
		n,
		r,
		i
	], C), J(() => {
		O.current?.editor.setTheme(u);
	}, [u], C), J(() => {
		D.current?.updateOptions(m);
	}, [m], C);
	let N = f(() => {
		if (!O.current) return;
		j.current(O.current);
		let s = X(O.current, e || "", r || n || "text", a || ""), c = X(O.current, t || "", i || n || "text", o || "");
		D.current?.setModel({
			original: s,
			modified: c
		});
	}, [
		n,
		t,
		i,
		e,
		r,
		a,
		o
	]), P = f(() => {
		!M.current && k.current && (D.current = O.current.editor.createDiffEditor(k.current, {
			automaticLayout: !0,
			...m
		}), N(), O.current?.editor.setTheme(u), w(!0), M.current = !0);
	}, [
		m,
		u,
		N
	]);
	p(() => {
		C && A.current(D.current, O.current);
	}, [C]), p(() => {
		!T && !C && P();
	}, [
		T,
		C,
		P
	]);
	function F() {
		let e = D.current?.getModel();
		s || e?.original?.dispose(), l || e?.modified?.dispose(), D.current?.dispose();
	}
	return c.createElement(Be, {
		width: v,
		height: _,
		isEditorReady: C,
		loading: d,
		_ref: k,
		className: y,
		wrapperProps: b
	});
}
var Je = d(qe);
function Ye(e) {
	let t = h();
	return p(() => {
		t.current = e;
	}, [e]), t.current;
}
var Xe = Ye, Z = /* @__PURE__ */ new Map();
function Ze({ defaultValue: e, defaultLanguage: t, defaultPath: n, value: r, language: i, path: a, theme: o = "light", line: s, loading: l = "Loading...", options: u = {}, overrideServices: d = {}, saveViewState: m = !0, keepCurrentModel: _ = !1, width: v = "100%", height: y = "100%", className: b, wrapperProps: x = {}, beforeMount: S = Y, onMount: C = Y, onChange: w, onValidate: T = Y }) {
	let [E, D] = g(!1), [O, k] = g(!0), A = h(null), j = h(null), M = h(null), N = h(C), P = h(S), F = h(), I = h(r), L = Xe(a), R = h(!1), z = h(!1);
	He(() => {
		let e = q.init();
		return e.then((e) => (A.current = e) && k(!1)).catch((e) => e?.type !== "cancelation" && console.error("Monaco initialization: error:", e)), () => j.current ? ee() : e.cancel();
	}), J(() => {
		let o = X(A.current, e || r || "", t || i || "", a || n || "");
		o !== j.current?.getModel() && (m && Z.set(L, j.current?.saveViewState()), j.current?.setModel(o), m && j.current?.restoreViewState(Z.get(a)));
	}, [a], E), J(() => {
		j.current?.updateOptions(u);
	}, [u], E), J(() => {
		!j.current || r === void 0 || (j.current.getOption(A.current.editor.EditorOption.readOnly) ? j.current.setValue(r) : r !== j.current.getValue() && (z.current = !0, j.current.executeEdits("", [{
			range: j.current.getModel().getFullModelRange(),
			text: r,
			forceMoveMarkers: !0
		}]), j.current.pushUndoStop(), z.current = !1));
	}, [r], E), J(() => {
		let e = j.current?.getModel();
		e && i && A.current?.editor.setModelLanguage(e, i);
	}, [i], E), J(() => {
		s !== void 0 && j.current?.revealLine(s);
	}, [s], E), J(() => {
		A.current?.editor.setTheme(o);
	}, [o], E);
	let B = f(() => {
		if (M.current && A.current && !R.current) {
			P.current(A.current);
			let c = a || n, l = X(A.current, r || e || "", t || i || "", c || "");
			j.current = A.current?.editor.create(M.current, {
				model: l,
				automaticLayout: !0,
				...u
			}, d), m && j.current.restoreViewState(Z.get(c)), A.current.editor.setTheme(o), s !== void 0 && j.current.revealLine(s), D(!0), R.current = !0;
		}
	}, [
		e,
		t,
		n,
		r,
		i,
		a,
		u,
		d,
		m,
		o,
		s
	]);
	p(() => {
		E && N.current(j.current, A.current);
	}, [E]), p(() => {
		!O && !E && B();
	}, [
		O,
		E,
		B
	]), I.current = r, p(() => {
		E && w && (F.current?.dispose(), F.current = j.current?.onDidChangeModelContent((e) => {
			z.current || w(j.current.getValue(), e);
		}));
	}, [E, w]), p(() => {
		if (E) {
			let e = A.current.editor.onDidChangeMarkers((e) => {
				let t = j.current.getModel()?.uri;
				if (t && e.find((e) => e.path === t.path)) {
					let e = A.current.editor.getModelMarkers({ resource: t });
					T?.(e);
				}
			});
			return () => {
				e?.dispose();
			};
		}
		return () => {};
	}, [E, T]);
	function ee() {
		F.current?.dispose(), _ ? m && Z.set(a, j.current.saveViewState()) : j.current.getModel()?.dispose(), j.current.dispose();
	}
	return c.createElement(Be, {
		width: v,
		height: y,
		isEditorReady: E,
		loading: l,
		_ref: M,
		className: b,
		wrapperProps: x
	});
}
var Qe = d(Ze), $e = (e, t) => {
	let n = (e) => Math.min(e, t.getLineCount()), r = n(e.line), i = n(e.endLine ?? e.line), a = Math.min(e.column ?? 1, t.getLineMaxColumn(r)), o = Math.min(e.endColumn ?? (e.endLine === void 0 ? e.column : void 0) ?? 1, t.getLineMaxColumn(i));
	return {
		startLineNumber: r,
		startColumn: a,
		endLineNumber: i,
		endColumn: i === r ? Math.max(a, o) : o
	};
}, Q = ((e) => {
	let t;
	return () => (t ??= e(), t);
})(() => import("./monaco-browser-BBGKds9E.ts").then((e) => e.initializeMonaco())), et = u(async () => (await Q(), { default: Qe })), tt = u(async () => (await Q(), { default: Je })), nt = {
	base: "vs-dark",
	inherit: !0,
	rules: [],
	colors: {
		"editor.background": s.token("colors.codeEditor.background"),
		"editor.foreground": s.token("colors.codeEditor.foreground"),
		"editor.lineHighlightBackground": s.token("colors.codeEditor.lineHighlightBackground"),
		"editorCursor.foreground": s.token("colors.codeEditor.cursor"),
		"editorWhitespace.foreground": s.token("colors.codeEditor.whitespace"),
		"editorIndentGuide.background": s.token("colors.codeEditor.indentGuide"),
		"editorIndentGuide.activeBackground": s.token("colors.codeEditor.indentGuideActive")
	}
}, rt = {
	base: "vs",
	inherit: !0,
	rules: [],
	colors: {
		"editor.background": s.token("colors.blacks.50"),
		"editor.foreground": s.token("colors.blacks.800"),
		"editor.lineHighlightBackground": s.token("colors.blacks.100"),
		"editorCursor.foreground": s.token("colors.blacks.600"),
		"editorWhitespace.foreground": s.token("colors.blacks.300"),
		"editorIndentGuide.background": s.token("colors.blacks.300"),
		"editorIndentGuide.activeBackground": s.token("colors.blacks.450")
	}
}, it = (e) => typeof e == "object" && !!e && "base" in e && "colors" in e, $ = "ps-theme", at = () => {
	let { themePreference: e, themePreferences: t } = a(), n = t.find((t) => t.id === e);
	return it(n?.monacoTheme) ? n.monacoTheme : n?.mode === "dark" ? nt : rt;
}, ot = (e) => {
	let t = h(null);
	return p(() => {
		let n = t.current;
		n && (n.editor.defineTheme($, e), n.editor.setTheme($));
	}, [e]), (n) => {
		t.current = n, n.editor.defineTheme($, e), n.editor.setTheme($);
	};
}, st = (e, t) => {
	e.addCommand(t.KeyMod.CtrlCmd | t.KeyCode.KeyS, async () => {
		await e.getAction("editor.action.formatDocument")?.run();
	});
}, ct = (e, t) => {
	let n = e.getModel();
	if (!n || !t) return;
	let r = $e(t, n);
	e.setSelection(r), e.revealRangeInCenter(r);
}, lt = (e) => {
	let { defaultCode: t, code: n, showLineNumbers: r, isEditable: i, language: a = "javascript", fileName: o, onChange: s, disableScroll: c, position: u } = e, d = h(null), f = h(u);
	f.current = u, p(() => {
		d.current && ct(d.current, u);
	}, [u]);
	let g = m(), _ = o ? `inmemory://editor/${encodeURIComponent(g)}/${encodeURIComponent(o)}` : void 0, v = ot(at()), y = {
		tabSize: 2,
		fixedOverflowWidgets: !0,
		minimap: { enabled: !1 },
		fontSize: 12,
		readOnly: !i,
		lineNumbers: r ? "on" : "off",
		...c ? {
			scrollbar: {
				vertical: "hidden",
				horizontal: "hidden",
				useShadows: !1,
				alwaysConsumeMouseWheel: !1
			},
			scrollBeyondLastLine: !1,
			mouseWheelScrollSensitivity: 0,
			overviewRulerLanes: 0
		} : {}
	};
	return /* @__PURE__ */ b(l, {
		fallback: null,
		children: /* @__PURE__ */ b(et, {
			width: "100%",
			height: "100%",
			language: a,
			path: _,
			defaultValue: t,
			value: n,
			theme: $,
			options: y,
			onChange: (e) => {
				s?.(e || "");
			},
			beforeMount: (e) => {
				v(e);
			},
			onMount: (e, t) => {
				v(t), st(e, t), d.current = e, ct(e, f.current);
			}
		})
	});
}, ut = (e) => {
	let { original: t, modified: n, showLineNumbers: r, language: i = "javascript", disableScroll: a } = e, o = ot(at()), s = {
		tabSize: 2,
		minimap: { enabled: !1 },
		fontSize: 12,
		readOnly: !0,
		originalEditable: !1,
		renderSideBySide: !0,
		useInlineViewWhenSpaceIsTooSmall: !0,
		lineNumbers: r ? "on" : "off",
		...a ? {
			scrollbar: {
				vertical: "hidden",
				horizontal: "hidden",
				useShadows: !1,
				alwaysConsumeMouseWheel: !1
			},
			scrollBeyondLastLine: !1,
			mouseWheelScrollSensitivity: 0,
			overviewRulerLanes: 0
		} : {}
	};
	return /* @__PURE__ */ b(l, {
		fallback: null,
		children: /* @__PURE__ */ b(tt, {
			width: "100%",
			height: "100%",
			language: i,
			original: t,
			modified: n,
			theme: $,
			options: s,
			beforeMount: (e) => {
				o(e);
			},
			onMount: (e, t) => {
				o(t);
			}
		})
	});
}, dt = /* @__PURE__ */ e({
	ConstrainedContainer: () => ht,
	Diff: () => _t,
	Editable: () => pt,
	ReadOnly: () => mt,
	ThemeSwitching: () => yt,
	Tsx: () => gt,
	default: () => ft
}), ft = {
	title: "Patterns/Editors/Code Editor",
	component: lt,
	decorators: [(e) => /* @__PURE__ */ b(_, {
		height: "2xl",
		width: "full",
		children: /* @__PURE__ */ b(e, {})
	})],
	args: {
		language: "typescript",
		defaultCode: "export const greeting = 'Hello';\n",
		isEditable: !0,
		showLineNumbers: !0
	}
}, pt = {}, mt = { args: { isEditable: !1 } }, ht = {
	tags: ["!manifest"],
	args: { defaultCode: "export const greeting: number = \"Hello\";\n" },
	decorators: [(e) => /* @__PURE__ */ b(_, {
		width: "xs",
		height: "2xs",
		overflow: "hidden",
		borderWidth: "1px",
		borderColor: "border.subtle",
		children: /* @__PURE__ */ b(e, {})
	})],
	play: async ({ canvasElement: e }) => {
		await Q();
		let t = await q.init(), r = await n(() => {
			let n = t.editor.getEditors().find((t) => e.contains(t.getDomNode()));
			return i(n).toBeDefined(), i(t.editor.getModelMarkers({ resource: n.getModel().uri }).length).toBeGreaterThan(0), n;
		}, { timeout: 5e3 });
		r.setPosition({
			lineNumber: 1,
			column: 15
		}), await r.getAction("editor.action.showHover").run(), await n(() => {
			let t = e.querySelector(".monaco-hover");
			i(t).toBeVisible();
			let n = t.getBoundingClientRect();
			i(n.right).toBeGreaterThan(r.getDomNode().getBoundingClientRect().right);
			let a = e.ownerDocument;
			for (let e of [n.left + 5, n.right - 5]) for (let r of [n.top + 5, n.bottom - 5]) i(t.contains(a.elementFromPoint(e, r))).toBe(!0);
		});
	}
}, gt = {
	args: {
		fileName: "icon.tsx",
		defaultCode: "declare const React: any;\nexport const Icon = () => <svg width={24}><path d=\"M0 0\" /></svg>;\n"
	},
	play: async ({ canvasElement: e }) => {
		await Q();
		let t = await q.init(), r = (await n(() => {
			let n = t.editor.getEditors().find((t) => e.contains(t.getDomNode()));
			return i(n).toBeDefined(), n;
		}, { timeout: 5e3 })).getModel(), a = r.getValue(), o = r.uri.toString(), s = await (await t.typescript.getTypeScriptWorker())(r.uri);
		await n(async () => {
			i(await s.getSyntacticDiagnostics(o)).toEqual([]), i(await s.getSemanticDiagnostics(o)).toEqual([]);
		});
		try {
			r.setValue(`${a}\nexport const invalid: number = "wrong";`), await n(async () => {
				let e = await s.getSemanticDiagnostics(o);
				i(e.map((e) => e.code)).toContain(2322);
			});
		} finally {
			r.setValue(a);
		}
		await n(async () => {
			i(await s.getSemanticDiagnostics(o)).toEqual([]);
		});
	}
}, _t = { render: () => /* @__PURE__ */ b(ut, {
	language: "typescript",
	original: "export const greeting = 'Hello';\n",
	modified: "export const greeting = 'Welcome';\n",
	showLineNumbers: !0
}) }, vt = () => {
	let { toggleThemePreference: e } = a();
	return /* @__PURE__ */ x(y, {
		height: "full",
		children: [
			/* @__PURE__ */ b(v, {
				alignSelf: "start",
				onClick: e,
				children: "Toggle theme"
			}),
			/* @__PURE__ */ b(_, {
				flex: "1",
				minHeight: "0",
				children: /* @__PURE__ */ b(lt, {
					language: "typescript",
					defaultCode: "const greeting = 'Hello';",
					isEditable: !0
				})
			}),
			/* @__PURE__ */ b(_, {
				flex: "1",
				minHeight: "0",
				children: /* @__PURE__ */ b(ut, {
					language: "typescript",
					original: "const greeting = 'Hello';",
					modified: "const greeting = 'Welcome';"
				})
			})
		]
	});
}, yt = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ b(o, {
		initialPreference: "pstdio-light",
		children: /* @__PURE__ */ b(vt, {})
	}),
	play: async ({ canvasElement: e }) => {
		let a = t(e), o = e.ownerDocument, s = async (t) => {
			await n(() => {
				let n = e.querySelectorAll(".monaco-editor:not(.gutter)");
				i(n).toHaveLength(3);
				for (let e of n) {
					let n = o.defaultView.getComputedStyle(e).backgroundColor.match(/\d+/g).map(Number);
					i(n.slice(0, 3).every((e) => t === "light" ? e > 200 : e < 60)).toBe(!0), i(e).toHaveClass(t === "light" ? "vs" : "vs-dark");
				}
			}, { timeout: 5e3 });
		};
		await s("light"), await r.click(a.getByRole("button", { name: "Toggle theme" })), await s("dark"), await r.click(a.getByRole("button", { name: "Toggle theme" })), await s("light");
	}
};
export { ht as ConstrainedContainer, _t as Diff, pt as Editable, mt as ReadOnly, yt as ThemeSwitching, gt as Tsx, ft as default, q as n, dt as t };
