// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./dom.esm-CP053Ko5.ts";
// node_modules/.bun/storybook@10.6.0+5d98dd0e7509148a/node_modules/storybook/dist/_browser-chunks/chunk-QGGIYUMM.js
var r = Object.entries({
	reset: [0, 0],
	bold: [
		1,
		22,
		"\x1B[22m\x1B[1m"
	],
	dim: [
		2,
		22,
		"\x1B[22m\x1B[2m"
	],
	italic: [3, 23],
	underline: [4, 24],
	inverse: [7, 27],
	hidden: [8, 28],
	strikethrough: [9, 29],
	black: [30, 39],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
	blue: [34, 39],
	magenta: [35, 39],
	cyan: [36, 39],
	white: [37, 39],
	gray: [90, 39],
	bgBlack: [40, 49],
	bgRed: [41, 49],
	bgGreen: [42, 49],
	bgYellow: [43, 49],
	bgBlue: [44, 49],
	bgMagenta: [45, 49],
	bgCyan: [46, 49],
	bgWhite: [47, 49],
	blackBright: [90, 39],
	redBright: [91, 39],
	greenBright: [92, 39],
	yellowBright: [93, 39],
	blueBright: [94, 39],
	magentaBright: [95, 39],
	cyanBright: [96, 39],
	whiteBright: [97, 39],
	bgBlackBright: [100, 49],
	bgRedBright: [101, 49],
	bgGreenBright: [102, 49],
	bgYellowBright: [103, 49],
	bgBlueBright: [104, 49],
	bgMagentaBright: [105, 49],
	bgCyanBright: [106, 49],
	bgWhiteBright: [107, 49]
});
function i(e) {
	return String(e);
}
i.open = "", i.close = "", r.reduce((e, [t]) => (e[t] = i, e), { isColorSupported: !1 });
function a(e = !1) {
	let t = typeof process < "u" ? process : void 0, n = t?.env || {}, r = t?.argv || [];
	return !("NO_COLOR" in n || r.includes("--no-color")) && ("FORCE_COLOR" in n || r.includes("--color") || t?.platform === "win32" || e && n.TERM !== "dumb" || "CI" in n) || typeof window < "u" && !!window.chrome;
}
function o(e = !1) {
	let t = a(e), n = (e, t, n, r) => {
		let i = "", a = 0;
		do
			i += e.substring(a, r) + n, a = r + t.length, r = e.indexOf(t, a);
		while (~r);
		return i + e.substring(a);
	}, o = (e, t, r = e) => {
		let i = (i) => {
			let a = String(i), o = a.indexOf(t, e.length);
			return ~o ? e + n(a, t, r, o) + t : e + a + t;
		};
		return i.open = e, i.close = t, i;
	}, s = { isColorSupported: t }, c = (e) => `\x1B[${e}m`;
	for (let [e, n] of r) s[e] = t ? o(c(n[0]), c(n[1]), n[2]) : i;
	return s;
}
var s = o();
function c(e, t) {
	return t.forEach(function(t) {
		t && typeof t != "string" && !Array.isArray(t) && Object.keys(t).forEach(function(n) {
			if (n !== "default" && !(n in e)) {
				var r = Object.getOwnPropertyDescriptor(t, n);
				Object.defineProperty(e, n, r.get ? r : {
					enumerable: !0,
					get: function() {
						return t[n];
					}
				});
			}
		});
	}), Object.freeze(e);
}
function l(e, t) {
	let n = Object.keys(e), r = t === null ? n : n.sort(t);
	if (Object.getOwnPropertySymbols) for (let t of Object.getOwnPropertySymbols(e)) Object.getOwnPropertyDescriptor(e, t).enumerable && r.push(t);
	return r;
}
function u(e, t, n, r, i, a, o = ": ") {
	let s = "", c = 0, l = e.next();
	if (!l.done) {
		s += t.spacingOuter;
		let u = n + t.indent;
		for (; !l.done;) {
			if (s += u, c++ === t.maxWidth) {
				s += "…";
				break;
			}
			let n = a(l.value[0], t, u, r, i), d = a(l.value[1], t, u, r, i);
			s += n + o + d, l = e.next(), l.done ? t.min || (s += ",") : s += `,${t.spacingInner}`;
		}
		s += t.spacingOuter + n;
	}
	return s;
}
function d(e, t, n, r, i, a) {
	let o = "", s = 0, c = e.next();
	if (!c.done) {
		o += t.spacingOuter;
		let l = n + t.indent;
		for (; !c.done;) {
			if (o += l, s++ === t.maxWidth) {
				o += "…";
				break;
			}
			o += a(c.value, t, l, r, i), c = e.next(), c.done ? t.min || (o += ",") : o += `,${t.spacingInner}`;
		}
		o += t.spacingOuter + n;
	}
	return o;
}
function f(e, t, n, r, i, a) {
	let o = "";
	e = e instanceof ArrayBuffer ? new DataView(e) : e;
	let s = (e) => e instanceof DataView, c = s(e) ? e.byteLength : e.length;
	if (c > 0) {
		o += t.spacingOuter;
		let l = n + t.indent;
		for (let n = 0; n < c; n++) {
			if (o += l, n === t.maxWidth) {
				o += "…";
				break;
			}
			(s(e) || n in e) && (o += a(s(e) ? e.getInt8(n) : e[n], t, l, r, i)), n < c - 1 ? o += `,${t.spacingInner}` : t.min || (o += ",");
		}
		o += t.spacingOuter + n;
	}
	return o;
}
function p(e, t, n, r, i, a) {
	let o = "", s = l(e, t.compareKeys);
	if (s.length > 0) {
		o += t.spacingOuter;
		let c = n + t.indent;
		for (let n = 0; n < s.length; n++) {
			let l = s[n], u = a(l, t, c, r, i), d = a(e[l], t, c, r, i);
			o += `${c + u}: ${d}`, n < s.length - 1 ? o += `,${t.spacingInner}` : t.min || (o += ",");
		}
		o += t.spacingOuter + n;
	}
	return o;
}
var m = typeof Symbol == "function" && Symbol.for ? /* @__PURE__ */ Symbol.for("jest.asymmetricMatcher") : 1267621, h = " ", g = {
	serialize: (e, t, n, r, i, a) => {
		let o = e.toString();
		if (o === "ArrayContaining" || o === "ArrayNotContaining") return ++r > t.maxDepth ? `[${o}]` : `${o + h}[${f(e.sample, t, n, r, i, a)}]`;
		if (o === "ObjectContaining" || o === "ObjectNotContaining") return ++r > t.maxDepth ? `[${o}]` : `${o + h}{${p(e.sample, t, n, r, i, a)}}`;
		if (o === "StringMatching" || o === "StringNotMatching" || o === "StringContaining" || o === "StringNotContaining") return o + h + a(e.sample, t, n, r, i);
		if (typeof e.toAsymmetricMatcher != "function") throw TypeError(`Asymmetric matcher ${e.constructor.name} does not implement toAsymmetricMatcher()`);
		return e.toAsymmetricMatcher();
	},
	test: (e) => e && e.$$typeof === m
}, _ = " ", v = /* @__PURE__ */ new Set(["DOMStringMap", "NamedNodeMap"]), y = /^(?:HTML\w*Collection|NodeList)$/;
function b(e) {
	return v.has(e) || y.test(e);
}
var x = (e) => e && e.constructor && !!e.constructor.name && b(e.constructor.name);
function ee(e) {
	return e.constructor.name === "NamedNodeMap";
}
var te = {
	serialize: (e, t, n, r, i, a) => {
		let o = e.constructor.name;
		return ++r > t.maxDepth ? `[${o}]` : (t.min ? "" : o + _) + (v.has(o) ? `{${p(ee(e) ? [...e].reduce((e, t) => (e[t.name] = t.value, e), {}) : { ...e }, t, n, r, i, a)}}` : `[${f([...e], t, n, r, i, a)}]`);
	},
	test: x
};
function S(e) {
	return e.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function C(e, t, n, r, i, a, o) {
	let s = r + n.indent, c = n.colors;
	return e.map((e) => {
		let l = t[e], u = o(l, n, s, i, a);
		return typeof l != "string" && (u.includes("\n") && (u = n.spacingOuter + s + u + n.spacingOuter + r), u = `{${u}}`), `${n.spacingInner + r + c.prop.open + e + c.prop.close}=${c.value.open}${u}${c.value.close}`;
	}).join("");
}
function ne(e, t, n, r, i, a) {
	return e.map((e) => t.spacingOuter + n + (typeof e == "string" ? w(e, t) : a(e, t, n, r, i))).join("");
}
function w(e, t) {
	let n = t.colors.content;
	return n.open + S(e) + n.close;
}
function re(e, t) {
	let n = t.colors.comment;
	return `${n.open}<!--${S(e)}-->${n.close}`;
}
function ie(e, t, n, r, i) {
	let a = r.colors.tag;
	return `${a.open}<${e}${t && a.close + t + r.spacingOuter + i + a.open}${n ? `>${a.close}${n}${r.spacingOuter}${i}${a.open}</${e}` : `${t && !r.min ? "" : " "}/`}>${a.close}`;
}
function T(e, t) {
	let n = t.colors.tag;
	return `${n.open}<${e}${n.close} \u2026${n.open} />${n.close}`;
}
var ae = 1, E = 3, oe = 8, D = 11, se = /^(?:(?:HTML|SVG)\w*)?Element$/;
function ce(e) {
	try {
		return typeof e.hasAttribute == "function" && e.hasAttribute("is");
	} catch {
		return !1;
	}
}
function le(e) {
	let t = e.constructor.name, { nodeType: n, tagName: r } = e, i = typeof r == "string" && r.includes("-") || ce(e);
	return n === ae && (se.test(t) || i) || n === E && t === "Text" || n === oe && t === "Comment" || n === D && t === "DocumentFragment";
}
var ue = (e) => {
	var t;
	return (e == null || (t = e.constructor) == null ? void 0 : t.name) && le(e);
};
function de(e) {
	return e.nodeType === E;
}
function fe(e) {
	return e.nodeType === oe;
}
function pe(e) {
	return e.nodeType === D;
}
var O = {
	serialize: (e, t, n, r, i, a) => {
		if (de(e)) return w(e.data, t);
		if (fe(e)) return re(e.data, t);
		let o = pe(e) ? "DocumentFragment" : e.tagName.toLowerCase();
		return ++r > t.maxDepth ? T(o, t) : ie(o, C(pe(e) ? [] : Array.from(e.attributes, (e) => e.name).sort(), pe(e) ? {} : [...e.attributes].reduce((e, t) => (e[t.name] = t.value, e), {}), t, n + t.indent, r, i, a), ne(Array.prototype.slice.call(e.childNodes || e.children), t, n + t.indent, r, i, a), t, n);
	},
	test: ue
}, me = "@@__IMMUTABLE_ITERABLE__@@", he = "@@__IMMUTABLE_LIST__@@", ge = "@@__IMMUTABLE_KEYED__@@", _e = "@@__IMMUTABLE_MAP__@@", ve = "@@__IMMUTABLE_ORDERED__@@", ye = "@@__IMMUTABLE_RECORD__@@", be = "@@__IMMUTABLE_SEQ__@@", xe = "@@__IMMUTABLE_SET__@@", Se = "@@__IMMUTABLE_STACK__@@", Ce = (e) => `Immutable.${e}`, we = (e) => `[${e}]`, Te = " ", Ee = "…";
function De(e, t, n, r, i, a, o) {
	return ++r > t.maxDepth ? we(Ce(o)) : `${Ce(o) + Te}{${u(e.entries(), t, n, r, i, a)}}`;
}
function Oe(e) {
	let t = 0;
	return { next() {
		if (t < e._keys.length) {
			let n = e._keys[t++];
			return {
				done: !1,
				value: [n, e.get(n)]
			};
		}
		return {
			done: !0,
			value: void 0
		};
	} };
}
function ke(e, t, n, r, i, a) {
	let o = Ce(e._name || "Record");
	return ++r > t.maxDepth ? we(o) : `${o + Te}{${u(Oe(e), t, n, r, i, a)}}`;
}
function Ae(e, t, n, r, i, a) {
	let o = Ce("Seq");
	return ++r > t.maxDepth ? we(o) : e[ge] ? `${o + Te}{${e._iter || e._object ? u(e.entries(), t, n, r, i, a) : Ee}}` : `${o + Te}[${e._iter || e._array || e._collection || e._iterable ? d(e.values(), t, n, r, i, a) : Ee}]`;
}
function je(e, t, n, r, i, a, o) {
	return ++r > t.maxDepth ? we(Ce(o)) : `${Ce(o) + Te}[${d(e.values(), t, n, r, i, a)}]`;
}
var Me = {
	serialize: (e, t, n, r, i, a) => e[_e] ? De(e, t, n, r, i, a, e[ve] ? "OrderedMap" : "Map") : e[he] ? je(e, t, n, r, i, a, "List") : e[xe] ? je(e, t, n, r, i, a, e[ve] ? "OrderedSet" : "Set") : e[Se] ? je(e, t, n, r, i, a, "Stack") : e[be] ? Ae(e, t, n, r, i, a) : ke(e, t, n, r, i, a),
	test: (e) => e && (e[me] === !0 || e[ye] === !0)
};
function Ne(e) {
	return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Pe = { exports: {} }, k = {}, Fe;
function Ie() {
	if (Fe) return k;
	Fe = 1;
	var e = /* @__PURE__ */ Symbol.for("react.transitional.element"), t = /* @__PURE__ */ Symbol.for("react.portal"), n = /* @__PURE__ */ Symbol.for("react.fragment"), r = /* @__PURE__ */ Symbol.for("react.strict_mode"), i = /* @__PURE__ */ Symbol.for("react.profiler"), a = /* @__PURE__ */ Symbol.for("react.consumer"), o = /* @__PURE__ */ Symbol.for("react.context"), s = /* @__PURE__ */ Symbol.for("react.forward_ref"), c = /* @__PURE__ */ Symbol.for("react.suspense"), l = /* @__PURE__ */ Symbol.for("react.suspense_list"), u = /* @__PURE__ */ Symbol.for("react.memo"), d = /* @__PURE__ */ Symbol.for("react.lazy"), f = /* @__PURE__ */ Symbol.for("react.view_transition"), p = /* @__PURE__ */ Symbol.for("react.client.reference");
	function m(p) {
		if (typeof p == "object" && p) {
			var m = p.$$typeof;
			switch (m) {
				case e: switch (p = p.type, p) {
					case n:
					case i:
					case r:
					case c:
					case l:
					case f: return p;
					default: switch (p &&= p.$$typeof, p) {
						case o:
						case s:
						case d:
						case u: return p;
						case a: return p;
						default: return m;
					}
				}
				case t: return m;
			}
		}
	}
	return k.ContextConsumer = a, k.ContextProvider = o, k.Element = e, k.ForwardRef = s, k.Fragment = n, k.Lazy = d, k.Memo = u, k.Portal = t, k.Profiler = i, k.StrictMode = r, k.Suspense = c, k.SuspenseList = l, k.isContextConsumer = function(e) {
		return m(e) === a;
	}, k.isContextProvider = function(e) {
		return m(e) === o;
	}, k.isElement = function(t) {
		return typeof t == "object" && !!t && t.$$typeof === e;
	}, k.isForwardRef = function(e) {
		return m(e) === s;
	}, k.isFragment = function(e) {
		return m(e) === n;
	}, k.isLazy = function(e) {
		return m(e) === d;
	}, k.isMemo = function(e) {
		return m(e) === u;
	}, k.isPortal = function(e) {
		return m(e) === t;
	}, k.isProfiler = function(e) {
		return m(e) === i;
	}, k.isStrictMode = function(e) {
		return m(e) === r;
	}, k.isSuspense = function(e) {
		return m(e) === c;
	}, k.isSuspenseList = function(e) {
		return m(e) === l;
	}, k.isValidElementType = function(e) {
		return typeof e == "string" || typeof e == "function" || e === n || e === i || e === r || e === c || e === l || typeof e == "object" && !!e && (e.$$typeof === d || e.$$typeof === u || e.$$typeof === o || e.$$typeof === a || e.$$typeof === s || e.$$typeof === p || e.getModuleId !== void 0);
	}, k.typeOf = m, k;
}
var Le;
function Re() {
	return Le || (Le = 1, Pe.exports = Ie()), Pe.exports;
}
var ze = Re(), Be = c({
	__proto__: null,
	default: Ne(ze)
}, [ze]), Ve = { exports: {} }, A = {}, He;
function Ue() {
	if (He) return A;
	He = 1;
	var e = /* @__PURE__ */ Symbol.for("react.element"), t = /* @__PURE__ */ Symbol.for("react.portal"), n = /* @__PURE__ */ Symbol.for("react.fragment"), r = /* @__PURE__ */ Symbol.for("react.strict_mode"), i = /* @__PURE__ */ Symbol.for("react.profiler"), a = /* @__PURE__ */ Symbol.for("react.provider"), o = /* @__PURE__ */ Symbol.for("react.context"), s = /* @__PURE__ */ Symbol.for("react.server_context"), c = /* @__PURE__ */ Symbol.for("react.forward_ref"), l = /* @__PURE__ */ Symbol.for("react.suspense"), u = /* @__PURE__ */ Symbol.for("react.suspense_list"), d = /* @__PURE__ */ Symbol.for("react.memo"), f = /* @__PURE__ */ Symbol.for("react.lazy"), p = /* @__PURE__ */ Symbol.for("react.offscreen"), m = /* @__PURE__ */ Symbol.for("react.module.reference");
	function h(p) {
		if (typeof p == "object" && p) {
			var m = p.$$typeof;
			switch (m) {
				case e: switch (p = p.type, p) {
					case n:
					case i:
					case r:
					case l:
					case u: return p;
					default: switch (p &&= p.$$typeof, p) {
						case s:
						case o:
						case c:
						case f:
						case d:
						case a: return p;
						default: return m;
					}
				}
				case t: return m;
			}
		}
	}
	return A.ContextConsumer = o, A.ContextProvider = a, A.Element = e, A.ForwardRef = c, A.Fragment = n, A.Lazy = f, A.Memo = d, A.Portal = t, A.Profiler = i, A.StrictMode = r, A.Suspense = l, A.SuspenseList = u, A.isAsyncMode = function() {
		return !1;
	}, A.isConcurrentMode = function() {
		return !1;
	}, A.isContextConsumer = function(e) {
		return h(e) === o;
	}, A.isContextProvider = function(e) {
		return h(e) === a;
	}, A.isElement = function(t) {
		return typeof t == "object" && !!t && t.$$typeof === e;
	}, A.isForwardRef = function(e) {
		return h(e) === c;
	}, A.isFragment = function(e) {
		return h(e) === n;
	}, A.isLazy = function(e) {
		return h(e) === f;
	}, A.isMemo = function(e) {
		return h(e) === d;
	}, A.isPortal = function(e) {
		return h(e) === t;
	}, A.isProfiler = function(e) {
		return h(e) === i;
	}, A.isStrictMode = function(e) {
		return h(e) === r;
	}, A.isSuspense = function(e) {
		return h(e) === l;
	}, A.isSuspenseList = function(e) {
		return h(e) === u;
	}, A.isValidElementType = function(e) {
		return typeof e == "string" || typeof e == "function" || e === n || e === i || e === r || e === l || e === u || e === p || typeof e == "object" && !!e && (e.$$typeof === f || e.$$typeof === d || e.$$typeof === a || e.$$typeof === o || e.$$typeof === c || e.$$typeof === m || e.getModuleId !== void 0);
	}, A.typeOf = h, A;
}
var We;
function Ge() {
	return We || (We = 1, Ve.exports = Ue()), Ve.exports;
}
var Ke = Ge(), qe = c({
	__proto__: null,
	default: Ne(Ke)
}, [Ke]), Je = Object.fromEntries([
	"isAsyncMode",
	"isConcurrentMode",
	"isContextConsumer",
	"isContextProvider",
	"isElement",
	"isForwardRef",
	"isFragment",
	"isLazy",
	"isMemo",
	"isPortal",
	"isProfiler",
	"isStrictMode",
	"isSuspense",
	"isSuspenseList",
	"isValidElementType"
].map((e) => [e, (t) => qe[e](t) || Be[e](t)]));
function Ye(e, t = []) {
	if (Array.isArray(e)) for (let n of e) Ye(n, t);
	else e != null && e !== !1 && e !== "" && t.push(e);
	return t;
}
function Xe(e) {
	let t = e.type;
	if (typeof t == "string") return t;
	if (typeof t == "function") return t.displayName || t.name || "Unknown";
	if (Je.isFragment(e)) return "React.Fragment";
	if (Je.isSuspense(e)) return "React.Suspense";
	if (typeof t == "object" && t) {
		if (Je.isContextProvider(e)) return "Context.Provider";
		if (Je.isContextConsumer(e)) return "Context.Consumer";
		if (Je.isForwardRef(e)) {
			if (t.displayName) return t.displayName;
			let e = t.render.displayName || t.render.name || "";
			return e === "" ? "ForwardRef" : `ForwardRef(${e})`;
		}
		if (Je.isMemo(e)) {
			let e = t.displayName || t.type.displayName || t.type.name || "";
			return e === "" ? "Memo" : `Memo(${e})`;
		}
	}
	return "UNDEFINED";
}
function Ze(e) {
	let { props: t } = e;
	return Object.keys(t).filter((e) => e !== "children" && t[e] !== void 0).sort();
}
var Qe = {
	serialize: (e, t, n, r, i, a) => ++r > t.maxDepth ? T(Xe(e), t) : ie(Xe(e), C(Ze(e), e.props, t, n + t.indent, r, i, a), ne(Ye(e.props.children), t, n + t.indent, r, i, a), t, n),
	test: (e) => e != null && Je.isElement(e)
}, j = typeof Symbol == "function" && Symbol.for ? /* @__PURE__ */ Symbol.for("react.test.json") : 245830487;
function $e(e) {
	let { props: t } = e;
	return t ? Object.keys(t).filter((e) => t[e] !== void 0).sort() : [];
}
var et = {
	serialize: (e, t, n, r, i, a) => ++r > t.maxDepth ? T(e.type, t) : ie(e.type, e.props ? C($e(e), e.props, t, n + t.indent, r, i, a) : "", e.children ? ne(e.children, t, n + t.indent, r, i, a) : "", t, n),
	test: (e) => e && e.$$typeof === j
}, tt = Object.prototype.toString, nt = Date.prototype.toISOString, rt = Error.prototype.toString, it = RegExp.prototype.toString;
function at(e) {
	return typeof e.constructor == "function" && e.constructor.name || "Object";
}
function ot(e) {
	return typeof window < "u" && e === window;
}
var st = /^Symbol\((.*)\)(.*)$/, ct = /\n/g, lt = class extends Error {
	constructor(e, t) {
		super(e), this.stack = t, this.name = this.constructor.name;
	}
};
function ut(e) {
	return e === "[object Array]" || e === "[object ArrayBuffer]" || e === "[object DataView]" || e === "[object Float32Array]" || e === "[object Float64Array]" || e === "[object Int8Array]" || e === "[object Int16Array]" || e === "[object Int32Array]" || e === "[object Uint8Array]" || e === "[object Uint8ClampedArray]" || e === "[object Uint16Array]" || e === "[object Uint32Array]";
}
function dt(e) {
	return Object.is(e, -0) ? "-0" : String(e);
}
function ft(e) {
	return `${e}n`;
}
function pt(e, t) {
	return t ? `[Function ${e.name || "anonymous"}]` : "[Function]";
}
function mt(e) {
	return String(e).replace(st, "Symbol($1)");
}
function ht(e) {
	return `[${rt.call(e)}]`;
}
function gt(e, t, n, r) {
	if (e === !0 || e === !1) return `${e}`;
	if (e === void 0) return "undefined";
	if (e === null) return "null";
	let i = typeof e;
	if (i === "number") return dt(e);
	if (i === "bigint") return ft(e);
	if (i === "string") return r ? `"${e.replaceAll(/"|\\/g, "\\$&")}"` : `"${e}"`;
	if (i === "function") return pt(e, t);
	if (i === "symbol") return mt(e);
	let a = tt.call(e);
	return a === "[object WeakMap]" ? "WeakMap {}" : a === "[object WeakSet]" ? "WeakSet {}" : a === "[object Function]" || a === "[object GeneratorFunction]" ? pt(e, t) : a === "[object Symbol]" ? mt(e) : a === "[object Date]" ? Number.isNaN(+e) ? "Date { NaN }" : nt.call(e) : a === "[object Error]" ? ht(e) : a === "[object RegExp]" ? n ? it.call(e).replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&") : it.call(e) : e instanceof Error ? ht(e) : null;
}
function _t(e, t, n, r, i, a) {
	if (i.includes(e)) return "[Circular]";
	i = [...i], i.push(e);
	let o = ++r > t.maxDepth, s = t.min;
	if (t.callToJSON && !o && e.toJSON && typeof e.toJSON == "function" && !a) return St(e.toJSON(), t, n, r, i, !0);
	let c = tt.call(e);
	return c === "[object Arguments]" ? o ? "[Arguments]" : `${s ? "" : "Arguments "}[${f(e, t, n, r, i, St)}]` : ut(c) ? o ? `[${e.constructor.name}]` : `${s || !t.printBasicPrototype && e.constructor.name === "Array" ? "" : `${e.constructor.name} `}[${f(e, t, n, r, i, St)}]` : c === "[object Map]" ? o ? "[Map]" : `Map {${u(e.entries(), t, n, r, i, St, " => ")}}` : c === "[object Set]" ? o ? "[Set]" : `Set {${d(e.values(), t, n, r, i, St)}}` : o || ot(e) ? `[${at(e)}]` : `${s || !t.printBasicPrototype && at(e) === "Object" ? "" : `${at(e)} `}{${p(e, t, n, r, i, St)}}`;
}
var vt = {
	test: (e) => e && e instanceof Error,
	serialize(e, t, n, r, i, a) {
		if (i.includes(e)) return "[Circular]";
		i = [...i, e];
		let o = ++r > t.maxDepth, { message: s, cause: c, ...l } = e, d = {
			message: s,
			...typeof c < "u" ? { cause: c } : {},
			...e instanceof AggregateError ? { errors: e.errors } : {},
			...l
		}, f = e.name === "Error" ? at(e) : e.name;
		return o ? `[${f}]` : `${f} {${u(Object.entries(d).values(), t, n, r, i, a)}}`;
	}
};
function yt(e) {
	return e.serialize != null;
}
function bt(e, t, n, r, i, a) {
	let o;
	try {
		o = yt(e) ? e.serialize(t, n, r, i, a, St) : e.print(t, (e) => St(e, n, r, i, a), (e) => {
			let t = r + n.indent;
			return t + e.replaceAll(ct, `
${t}`);
		}, {
			edgeSpacing: n.spacingOuter,
			min: n.min,
			spacing: n.spacingInner
		}, n.colors);
	} catch (e) {
		throw new lt(e.message, e.stack);
	}
	if (typeof o != "string") throw TypeError(`pretty-format: Plugin must return type "string" but instead returned "${typeof o}".`);
	return o;
}
function xt(e, t) {
	for (let n of e) try {
		if (n.test(t)) return n;
	} catch (e) {
		throw new lt(e.message, e.stack);
	}
	return null;
}
function St(e, t, n, r, i, a) {
	let o = xt(t.plugins, e);
	if (o !== null) return bt(o, e, t, n, r, i);
	let s = gt(e, t.printFunctionName, t.escapeRegex, t.escapeString);
	return s === null ? _t(e, t, n, r, i, a) : s;
}
var Ct = {
	comment: "gray",
	content: "reset",
	prop: "yellow",
	tag: "cyan",
	value: "green"
}, wt = Object.keys(Ct), Tt = {
	callToJSON: !0,
	compareKeys: void 0,
	escapeRegex: !1,
	escapeString: !0,
	highlight: !1,
	indent: 2,
	maxDepth: Infinity,
	maxWidth: Infinity,
	min: !1,
	plugins: [],
	printBasicPrototype: !0,
	printFunctionName: !0,
	theme: Ct
};
function Et(e) {
	for (let t of Object.keys(e)) if (!Object.prototype.hasOwnProperty.call(Tt, t)) throw Error(`pretty-format: Unknown option "${t}".`);
	if (e.min && e.indent !== void 0 && e.indent !== 0) throw Error("pretty-format: Options \"min\" and \"indent\" cannot be used together.");
}
function Dt() {
	return wt.reduce((e, t) => {
		let n = Ct[t], r = n && s[n];
		if (r && typeof r.close == "string" && typeof r.open == "string") e[t] = r;
		else throw Error(`pretty-format: Option "theme" has a key "${t}" whose value "${n}" is undefined in ansi-styles.`);
		return e;
	}, /* @__PURE__ */ Object.create(null));
}
function Ot() {
	return wt.reduce((e, t) => (e[t] = {
		close: "",
		open: ""
	}, e), /* @__PURE__ */ Object.create(null));
}
function kt(e) {
	return e?.printFunctionName ?? Tt.printFunctionName;
}
function At(e) {
	return e?.escapeRegex ?? Tt.escapeRegex;
}
function jt(e) {
	return e?.escapeString ?? Tt.escapeString;
}
function Mt(e) {
	return {
		callToJSON: e?.callToJSON ?? Tt.callToJSON,
		colors: e?.highlight ? Dt() : Ot(),
		compareKeys: typeof e?.compareKeys == "function" || e?.compareKeys === null ? e.compareKeys : Tt.compareKeys,
		escapeRegex: At(e),
		escapeString: jt(e),
		indent: e?.min ? "" : Nt(e?.indent ?? Tt.indent),
		maxDepth: e?.maxDepth ?? Tt.maxDepth,
		maxWidth: e?.maxWidth ?? Tt.maxWidth,
		min: e?.min ?? Tt.min,
		plugins: e?.plugins ?? Tt.plugins,
		printBasicPrototype: e?.printBasicPrototype ?? !0,
		printFunctionName: kt(e),
		spacingInner: e?.min ? " " : "\n",
		spacingOuter: e?.min ? "" : "\n"
	};
}
function Nt(e) {
	return Array.from({ length: e + 1 }).join(" ");
}
function Pt(e, t) {
	if (t && (Et(t), t.plugins)) {
		let n = xt(t.plugins, e);
		if (n !== null) return bt(n, e, Mt(t), "", 0, []);
	}
	let n = gt(e, kt(t), At(t), jt(t));
	return n === null ? _t(e, Mt(t), "", 0, []) : n;
}
var Ft = {
	AsymmetricMatcher: g,
	DOMCollection: te,
	DOMElement: O,
	Immutable: Me,
	ReactElement: Qe,
	ReactTestComponent: et,
	Error: vt
}, It = {
	bold: ["1", "22"],
	dim: ["2", "22"],
	italic: ["3", "23"],
	underline: ["4", "24"],
	inverse: ["7", "27"],
	hidden: ["8", "28"],
	strike: ["9", "29"],
	black: ["30", "39"],
	red: ["31", "39"],
	green: ["32", "39"],
	yellow: ["33", "39"],
	blue: ["34", "39"],
	magenta: ["35", "39"],
	cyan: ["36", "39"],
	white: ["37", "39"],
	brightblack: ["30;1", "39"],
	brightred: ["31;1", "39"],
	brightgreen: ["32;1", "39"],
	brightyellow: ["33;1", "39"],
	brightblue: ["34;1", "39"],
	brightmagenta: ["35;1", "39"],
	brightcyan: ["36;1", "39"],
	brightwhite: ["37;1", "39"],
	grey: ["90", "39"]
}, Lt = {
	special: "cyan",
	number: "yellow",
	bigint: "yellow",
	boolean: "yellow",
	undefined: "grey",
	null: "bold",
	string: "green",
	symbol: "green",
	date: "magenta",
	regexp: "red"
}, Rt = "…";
function zt(e, t) {
	let n = It[Lt[t]] || It[t] || "";
	return n ? `\x1B[${n[0]}m${String(e)}\x1B[${n[1]}m` : String(e);
}
function Bt({ showHidden: e = !1, depth: t = 2, colors: n = !1, customInspect: r = !0, showProxy: i = !1, maxArrayLength: a = 1 / 0, breakLength: o = 1 / 0, seen: s = [], truncate: c = 1 / 0, stylize: l = String } = {}, u) {
	let d = {
		showHidden: !!e,
		depth: Number(t),
		colors: !!n,
		customInspect: !!r,
		showProxy: !!i,
		maxArrayLength: Number(a),
		breakLength: Number(o),
		truncate: Number(c),
		seen: s,
		inspect: u,
		stylize: l
	};
	return d.colors && (d.stylize = zt), d;
}
function Vt(e) {
	return e >= "\ud800" && e <= "\udbff";
}
function Ht(e, t, n = Rt) {
	e = String(e);
	let r = n.length, i = e.length;
	if (r > t && i > r) return n;
	if (i > t && i > r) {
		let i = t - r;
		return i > 0 && Vt(e[i - 1]) && --i, `${e.slice(0, i)}${n}`;
	}
	return e;
}
function Ut(e, t, n, r = ", ") {
	n ||= t.inspect;
	let i = e.length;
	if (i === 0) return "";
	let a = t.truncate, o = "", s = "", c = "";
	for (let l = 0; l < i; l += 1) {
		let i = l + 1 === e.length, u = l + 2 === e.length;
		c = `${Rt}(${e.length - l})`;
		let d = e[l];
		t.truncate = a - o.length - (i ? 0 : r.length);
		let f = s || n(d, t) + (i ? "" : r), p = o.length + f.length, m = p + c.length;
		if (i && p > a && o.length + c.length <= a || !i && !u && m > a || (s = i ? "" : n(e[l + 1], t) + (u ? "" : r), !i && u && m > a && p + s.length > a)) break;
		if (o += f, !i && !u && p + s.length >= a) {
			c = `${Rt}(${e.length - l - 1})`;
			break;
		}
		c = "";
	}
	return `${o}${c}`;
}
function Wt(e) {
	return e.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? e : JSON.stringify(e).replace(/'/g, "\\'").replace(/\\"/g, "\"").replace(/(^"|"$)/g, "'");
}
function Gt([e, t], n) {
	return n.truncate -= 2, typeof e == "string" ? e = Wt(e) : typeof e != "number" && (e = `[${n.inspect(e, n)}]`), n.truncate -= e.length, t = n.inspect(t, n), `${e}: ${t}`;
}
function Kt(e, t) {
	let n = Object.keys(e).slice(e.length);
	if (!e.length && !n.length) return "[]";
	t.truncate -= 4;
	let r = Ut(e, t);
	t.truncate -= r.length;
	let i = "";
	return n.length && (i = Ut(n.map((t) => [t, e[t]]), t, Gt)), `[ ${r}${i ? `, ${i}` : ""} ]`;
}
var qt = (e) => typeof Buffer == "function" && e instanceof Buffer ? "Buffer" : e[Symbol.toStringTag] ? e[Symbol.toStringTag] : e.constructor.name;
function Jt(e, t) {
	let n = qt(e);
	t.truncate -= n.length + 4;
	let r = Object.keys(e).slice(e.length);
	if (!e.length && !r.length) return `${n}[]`;
	let i = "";
	for (let n = 0; n < e.length; n++) {
		let r = `${t.stylize(Ht(e[n], t.truncate), "number")}${n === e.length - 1 ? "" : ", "}`;
		if (t.truncate -= r.length, e[n] !== e.length && t.truncate <= 3) {
			i += `${Rt}(${e.length - e[n] + 1})`;
			break;
		}
		i += r;
	}
	let a = "";
	return r.length && (a = Ut(r.map((t) => [t, e[t]]), t, Gt)), `${n}[ ${i}${a ? `, ${a}` : ""} ]`;
}
function Yt(e, t) {
	let n = e.toJSON();
	if (n === null) return "Invalid Date";
	let r = n.split("T"), i = r[0];
	return t.stylize(`${i}T${Ht(r[1], t.truncate - i.length - 1)}`, "date");
}
function Xt(e, t) {
	let n = e[Symbol.toStringTag] || "Function", r = e.name;
	return r ? t.stylize(`[${n} ${Ht(r, t.truncate - 11)}]`, "special") : t.stylize(`[${n}]`, "special");
}
function Zt([e, t], n) {
	return n.truncate -= 4, e = n.inspect(e, n), n.truncate -= e.length, t = n.inspect(t, n), `${e} => ${t}`;
}
function Qt(e) {
	let t = [];
	return e.forEach((e, n) => {
		t.push([n, e]);
	}), t;
}
function $t(e, t) {
	return e.size === 0 ? "Map{}" : (t.truncate -= 7, `Map{ ${Ut(Qt(e), t, Zt)} }`);
}
var en = Number.isNaN || ((e) => e !== e);
function tn(e, t) {
	return en(e) ? t.stylize("NaN", "number") : e === 1 / 0 ? t.stylize("Infinity", "number") : e === -1 / 0 ? t.stylize("-Infinity", "number") : e === 0 ? t.stylize(1 / e == 1 / 0 ? "+0" : "-0", "number") : t.stylize(Ht(String(e), t.truncate), "number");
}
function nn(e, t) {
	let n = Ht(e.toString(), t.truncate - 1);
	return n !== Rt && (n += "n"), t.stylize(n, "bigint");
}
function rn(e, t) {
	let n = e.toString().split("/")[2], r = t.truncate - (2 + n.length), i = e.source;
	return t.stylize(`/${Ht(i, r)}/${n}`, "regexp");
}
function an(e) {
	let t = [];
	return e.forEach((e) => {
		t.push(e);
	}), t;
}
function on(e, t) {
	return e.size === 0 ? "Set{}" : (t.truncate -= 7, `Set{ ${Ut(an(e), t)} }`);
}
var sn = /* @__PURE__ */ RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]", "g"), cn = {
	"\b": "\\b",
	"	": "\\t",
	"\n": "\\n",
	"\f": "\\f",
	"\r": "\\r",
	"'": "\\'",
	"\\": "\\\\"
}, ln = 16, un = 4;
function dn(e) {
	return cn[e] || `\\u${`0000${e.charCodeAt(0).toString(ln)}`.slice(-un)}`;
}
function fn(e, t) {
	return sn.test(e) && (e = e.replace(sn, dn)), t.stylize(`'${Ht(e, t.truncate - 2)}'`, "string");
}
function pn(e) {
	return "description" in Symbol.prototype ? e.description ? `Symbol(${e.description})` : "Symbol()" : e.toString();
}
var mn = () => "Promise{…}";
try {
	let { getPromiseDetails: e, kPending: t, kRejected: n } = process.binding("util");
	Array.isArray(e(Promise.resolve())) && (mn = (r, i) => {
		let [a, o] = e(r);
		return a === t ? "Promise{<pending>}" : `Promise${a === n ? "!" : ""}{${i.inspect(o, i)}}`;
	});
} catch {}
var hn = mn;
function gn(e, t) {
	let n = Object.getOwnPropertyNames(e), r = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(e) : [];
	if (n.length === 0 && r.length === 0) return "{}";
	if (t.truncate -= 4, t.seen = t.seen || [], t.seen.includes(e)) return "[Circular]";
	t.seen.push(e);
	let i = Ut(n.map((t) => [t, e[t]]), t, Gt), a = Ut(r.map((t) => [t, e[t]]), t, Gt);
	t.seen.pop();
	let o = "";
	return i && a && (o = ", "), `{ ${i}${o}${a} }`;
}
var _n = typeof Symbol < "u" && Symbol.toStringTag ? Symbol.toStringTag : !1;
function vn(e, t) {
	let n = "";
	return _n && _n in e && (n = e[_n]), n ||= e.constructor.name, n && n !== "_class" || (n = "<Anonymous Class>"), t.truncate -= n.length, `${n}${gn(e, t)}`;
}
function yn(e, t) {
	return e.length === 0 ? "Arguments[]" : (t.truncate -= 13, `Arguments[ ${Ut(e, t)} ]`);
}
var bn = [
	"stack",
	"line",
	"column",
	"name",
	"message",
	"fileName",
	"lineNumber",
	"columnNumber",
	"number",
	"description",
	"cause"
];
function xn(e, t) {
	let n = Object.getOwnPropertyNames(e).filter((e) => bn.indexOf(e) === -1), r = e.name;
	t.truncate -= r.length;
	let i = "";
	if (typeof e.message == "string" ? i = Ht(e.message, t.truncate) : n.unshift("message"), i = i ? `: ${i}` : "", t.truncate -= i.length + 5, t.seen = t.seen || [], t.seen.includes(e)) return "[Circular]";
	t.seen.push(e);
	let a = Ut(n.map((t) => [t, e[t]]), t, Gt);
	return `${r}${i}${a ? ` { ${a} }` : ""}`;
}
function Sn([e, t], n) {
	return n.truncate -= 3, t ? `${n.stylize(String(e), "yellow")}=${n.stylize(`"${t}"`, "string")}` : `${n.stylize(String(e), "yellow")}`;
}
function Cn(e, t) {
	return Ut(e, t, wn, "\n");
}
function wn(e, t) {
	switch (e.nodeType) {
		case 1: return Tn(e, t);
		case 3: return t.inspect(e.data, t);
		default: return t.inspect(e, t);
	}
}
function Tn(e, t) {
	let n = e.getAttributeNames(), r = e.tagName.toLowerCase(), i = t.stylize(`<${r}`, "special"), a = t.stylize(">", "special"), o = t.stylize(`</${r}>`, "special");
	t.truncate -= r.length * 2 + 5;
	let s = "";
	n.length > 0 && (s += " ", s += Ut(n.map((t) => [t, e.getAttribute(t)]), t, Sn, " ")), t.truncate -= s.length;
	let c = t.truncate, l = Cn(e.children, t);
	return l && l.length > c && (l = `${Rt}(${e.children.length})`), `${i}${s}${a}${l}${o}`;
}
var En = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("chai/inspect") : "@@chai/inspect", Dn = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom"), On = /* @__PURE__ */ new WeakMap(), kn = {}, An = {
	undefined: (e, t) => t.stylize("undefined", "undefined"),
	null: (e, t) => t.stylize("null", "null"),
	boolean: (e, t) => t.stylize(String(e), "boolean"),
	Boolean: (e, t) => t.stylize(String(e), "boolean"),
	number: tn,
	Number: tn,
	bigint: nn,
	BigInt: nn,
	string: fn,
	String: fn,
	function: Xt,
	Function: Xt,
	symbol: pn,
	Symbol: pn,
	Array: Kt,
	Date: Yt,
	Map: $t,
	Set: on,
	RegExp: rn,
	Promise: hn,
	WeakSet: (e, t) => t.stylize("WeakSet{…}", "special"),
	WeakMap: (e, t) => t.stylize("WeakMap{…}", "special"),
	Arguments: yn,
	Int8Array: Jt,
	Uint8Array: Jt,
	Uint8ClampedArray: Jt,
	Int16Array: Jt,
	Uint16Array: Jt,
	Int32Array: Jt,
	Uint32Array: Jt,
	Float32Array: Jt,
	Float64Array: Jt,
	Generator: () => "",
	DataView: () => "",
	ArrayBuffer: () => "",
	Error: xn,
	HTMLCollection: Cn,
	NodeList: Cn
}, jn = (e, t, n) => En in e && typeof e[En] == "function" ? e[En](t) : Dn in e && typeof e[Dn] == "function" ? e[Dn](t.depth, t) : "inspect" in e && typeof e.inspect == "function" ? e.inspect(t.depth, t) : "constructor" in e && On.has(e.constructor) ? On.get(e.constructor)(e, t) : kn[n] ? kn[n](e, t) : "", Mn = Object.prototype.toString;
function Nn(e, t = {}) {
	let n = Bt(t, Nn), { customInspect: r } = n, i = e === null ? "null" : typeof e;
	if (i === "object" && (i = Mn.call(e).slice(8, -1)), i in An) return An[i](e, n);
	if (r && e) {
		let t = jn(e, n, i);
		if (t) return typeof t == "string" ? t : Nn(t, n);
	}
	let a = e ? Object.getPrototypeOf(e) : !1;
	return a === Object.prototype || a === null ? gn(e, n) : e && typeof HTMLElement == "function" && e instanceof HTMLElement ? Tn(e, n) : "constructor" in e ? e.constructor === Object ? gn(e, n) : vn(e, n) : e === Object(e) ? gn(e, n) : n.stylize(String(e), i);
}
var { AsymmetricMatcher: Pn, DOMCollection: Fn, DOMElement: In, Immutable: Ln, ReactElement: Rn, ReactTestComponent: zn } = Ft, Bn = [
	zn,
	Rn,
	In,
	Fn,
	Ln,
	Pn
];
function Vn(e, t = 10, { maxLength: n, ...r } = {}) {
	let i = n ?? 1e4, a;
	try {
		a = Pt(e, {
			maxDepth: t,
			escapeString: !1,
			plugins: Bn,
			...r
		});
	} catch {
		a = Pt(e, {
			callToJSON: !1,
			maxDepth: t,
			escapeString: !1,
			plugins: Bn,
			...r
		});
	}
	return a.length >= i && t > 1 ? Vn(e, Math.floor(Math.min(t, 2 ** 53 - 1) / 2), {
		maxLength: n,
		...r
	}) : a;
}
var Hn = /%[sdjifoOc%]/g;
function Un(...e) {
	if (typeof e[0] != "string") {
		let t = [];
		for (let n = 0; n < e.length; n++) t.push(Wn(e[n], {
			depth: 0,
			colors: !1
		}));
		return t.join(" ");
	}
	let t = e.length, n = 1, r = e[0], i = String(r).replace(Hn, (r) => {
		if (r === "%%") return "%";
		if (n >= t) return r;
		switch (r) {
			case "%s": {
				let t = e[n++];
				return typeof t == "bigint" ? `${t.toString()}n` : typeof t == "number" && t === 0 && 1 / t < 0 ? "-0" : typeof t == "object" && t ? typeof t.toString == "function" && t.toString !== Object.prototype.toString ? t.toString() : Wn(t, {
					depth: 0,
					colors: !1
				}) : String(t);
			}
			case "%d": {
				let t = e[n++];
				return typeof t == "bigint" ? `${t.toString()}n` : Number(t).toString();
			}
			case "%i": {
				let t = e[n++];
				return typeof t == "bigint" ? `${t.toString()}n` : Number.parseInt(String(t)).toString();
			}
			case "%f": return Number.parseFloat(String(e[n++])).toString();
			case "%o": return Wn(e[n++], {
				showHidden: !0,
				showProxy: !0
			});
			case "%O": return Wn(e[n++]);
			case "%c": return n++, "";
			case "%j": try {
				return JSON.stringify(e[n++]);
			} catch (e) {
				let t = e.message;
				if (t.includes("circular structure") || t.includes("cyclic structures") || t.includes("cyclic object")) return "[Circular]";
				throw e;
			}
			default: return r;
		}
	});
	for (let r = e[n]; n < t; r = e[++n]) i += typeof r != "object" || !r ? ` ${r}` : ` ${Wn(r)}`;
	return i;
}
function Wn(e, t = {}) {
	return t.truncate === 0 && (t.truncate = Infinity), Nn(e, t);
}
function Gn(e) {
	return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
function Kn(e, t, n) {
	let r = typeof e;
	if (!n.includes(r)) throw TypeError(`${t} value must be ${n.join(" or ")}, received "${r}"`);
}
function qn(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function Jn(e) {
	return e === Object.prototype || e === Function.prototype || e === RegExp.prototype;
}
function Yn(e) {
	return Object.prototype.toString.apply(e).slice(8, -1);
}
function Xn(e, t) {
	let n = typeof t == "function" ? t : (e) => t.add(e);
	Object.getOwnPropertyNames(e).forEach(n), Object.getOwnPropertySymbols(e).forEach(n);
}
function Zn(e) {
	let t = /* @__PURE__ */ new Set();
	return Jn(e) ? [] : (Xn(e, t), Array.from(t));
}
var Qn = { forceWritable: !1 };
function $n(e, t = Qn) {
	return er(e, /* @__PURE__ */ new WeakMap(), t);
}
function er(e, t, n = Qn) {
	let r, i;
	if (t.has(e)) return t.get(e);
	if (Array.isArray(e)) {
		for (i = Array.from({ length: r = e.length }), t.set(e, i); r--;) i[r] = er(e[r], t, n);
		return i;
	}
	if (Object.prototype.toString.call(e) === "[object Object]") {
		i = Object.create(Object.getPrototypeOf(e)), t.set(e, i);
		let r = Zn(e);
		for (let a of r) {
			let r = Object.getOwnPropertyDescriptor(e, a);
			if (!r) continue;
			let o = er(e[a], t, n);
			n.forceWritable ? Object.defineProperty(i, a, {
				enumerable: r.enumerable,
				configurable: !0,
				writable: !0,
				value: o
			}) : "get" in r ? Object.defineProperty(i, a, {
				...r,
				get() {
					return o;
				}
			}) : Object.defineProperty(i, a, {
				...r,
				value: o
			});
		}
		return i;
	}
	return e;
}
function tr() {}
var M = -1, N = 1, P = 0, F = class {
	0;
	1;
	constructor(e, t) {
		this[0] = e, this[1] = t;
	}
};
function nr(e, t) {
	if (!e || !t || e.charAt(0) !== t.charAt(0)) return 0;
	let n = 0, r = Math.min(e.length, t.length), i = r, a = 0;
	for (; n < i;) e.substring(a, i) === t.substring(a, i) ? (n = i, a = n) : r = i, i = Math.floor((r - n) / 2 + n);
	return i;
}
function rr(e, t) {
	if (!e || !t || e.charAt(e.length - 1) !== t.charAt(t.length - 1)) return 0;
	let n = 0, r = Math.min(e.length, t.length), i = r, a = 0;
	for (; n < i;) e.substring(e.length - i, e.length - a) === t.substring(t.length - i, t.length - a) ? (n = i, a = n) : r = i, i = Math.floor((r - n) / 2 + n);
	return i;
}
function ir(e, t) {
	let n = e.length, r = t.length;
	if (n === 0 || r === 0) return 0;
	n > r ? e = e.substring(n - r) : n < r && (t = t.substring(0, n));
	let i = Math.min(n, r);
	if (e === t) return i;
	let a = 0, o = 1;
	for (;;) {
		let n = e.substring(i - o), r = t.indexOf(n);
		if (r === -1) return a;
		o += r, (r === 0 || e.substring(i - o) === t.substring(0, o)) && (a = o, o++);
	}
}
function ar(e) {
	let t = !1, n = [], r = 0, i = null, a = 0, o = 0, s = 0, c = 0, l = 0;
	for (; a < e.length;) e[a][0] === P ? (n[r++] = a, o = c, s = l, c = 0, l = 0, i = e[a][1]) : (e[a][0] === N ? c += e[a][1].length : l += e[a][1].length, i && i.length <= Math.max(o, s) && i.length <= Math.max(c, l) && (e.splice(n[r - 1], 0, new F(M, i)), e[n[r - 1] + 1][0] = N, r--, r--, a = r > 0 ? n[r - 1] : -1, o = 0, s = 0, c = 0, l = 0, i = null, t = !0)), a++;
	for (t && fr(e), dr(e), a = 1; a < e.length;) {
		if (e[a - 1][0] === M && e[a][0] === N) {
			let t = e[a - 1][1], n = e[a][1], r = ir(t, n), i = ir(n, t);
			r >= i ? (r >= t.length / 2 || r >= n.length / 2) && (e.splice(a, 0, new F(P, n.substring(0, r))), e[a - 1][1] = t.substring(0, t.length - r), e[a + 1][1] = n.substring(r), a++) : (i >= t.length / 2 || i >= n.length / 2) && (e.splice(a, 0, new F(P, t.substring(0, i))), e[a - 1][0] = N, e[a - 1][1] = n.substring(0, n.length - i), e[a + 1][0] = M, e[a + 1][1] = t.substring(i), a++), a++;
		}
		a++;
	}
}
var or = /[^a-z0-9]/i, sr = /\s/, cr = /[\r\n]/, lr = /\n\r?\n$/, ur = /^\r?\n\r?\n/;
function dr(e) {
	let t = 1;
	for (; t < e.length - 1;) {
		if (e[t - 1][0] === P && e[t + 1][0] === P) {
			let n = e[t - 1][1], r = e[t][1], i = e[t + 1][1], a = rr(n, r);
			if (a) {
				let e = r.substring(r.length - a);
				n = n.substring(0, n.length - a), r = e + r.substring(0, r.length - a), i = e + i;
			}
			let o = n, s = r, c = i, l = pr(n, r) + pr(r, i);
			for (; r.charAt(0) === i.charAt(0);) {
				n += r.charAt(0), r = r.substring(1) + i.charAt(0), i = i.substring(1);
				let e = pr(n, r) + pr(r, i);
				e >= l && (l = e, o = n, s = r, c = i);
			}
			e[t - 1][1] !== o && (o ? e[t - 1][1] = o : (e.splice(t - 1, 1), t--), e[t][1] = s, c ? e[t + 1][1] = c : (e.splice(t + 1, 1), t--));
		}
		t++;
	}
}
function fr(e) {
	e.push(new F(P, ""));
	let t = 0, n = 0, r = 0, i = "", a = "", o;
	for (; t < e.length;) switch (e[t][0]) {
		case N:
			r++, a += e[t][1], t++;
			break;
		case M:
			n++, i += e[t][1], t++;
			break;
		case P: n + r > 1 ? (n !== 0 && r !== 0 && (o = nr(a, i), o !== 0 && (t - n - r > 0 && e[t - n - r - 1][0] === P ? e[t - n - r - 1][1] += a.substring(0, o) : (e.splice(0, 0, new F(P, a.substring(0, o))), t++), a = a.substring(o), i = i.substring(o)), o = rr(a, i), o !== 0 && (e[t][1] = a.substring(a.length - o) + e[t][1], a = a.substring(0, a.length - o), i = i.substring(0, i.length - o))), t -= n + r, e.splice(t, n + r), i.length && (e.splice(t, 0, new F(M, i)), t++), a.length && (e.splice(t, 0, new F(N, a)), t++), t++) : t !== 0 && e[t - 1][0] === P ? (e[t - 1][1] += e[t][1], e.splice(t, 1)) : t++, r = 0, n = 0, i = "", a = "";
	}
	e[e.length - 1][1] === "" && e.pop();
	let s = !1;
	for (t = 1; t < e.length - 1;) e[t - 1][0] === P && e[t + 1][0] === P && (e[t][1].substring(e[t][1].length - e[t - 1][1].length) === e[t - 1][1] ? (e[t][1] = e[t - 1][1] + e[t][1].substring(0, e[t][1].length - e[t - 1][1].length), e[t + 1][1] = e[t - 1][1] + e[t + 1][1], e.splice(t - 1, 1), s = !0) : e[t][1].substring(0, e[t + 1][1].length) === e[t + 1][1] && (e[t - 1][1] += e[t + 1][1], e[t][1] = e[t][1].substring(e[t + 1][1].length) + e[t + 1][1], e.splice(t + 1, 1), s = !0)), t++;
	s && fr(e);
}
function pr(e, t) {
	if (!e || !t) return 6;
	let n = e.charAt(e.length - 1), r = t.charAt(0), i = n.match(or), a = r.match(or), o = i && n.match(sr), s = a && r.match(sr), c = o && n.match(cr), l = s && r.match(cr), u = c && e.match(lr), d = l && t.match(ur);
	return u || d ? 5 : c || l ? 4 : i && !o && s ? 3 : o || s ? 2 : i || a ? 1 : 0;
}
var mr = "Compared values have no visual difference.", hr = "Compared values serialize to the same structure.\nPrinting internal object structure without calling `toJSON` instead.", gr = {}, _r;
function vr() {
	if (_r) return gr;
	_r = 1, Object.defineProperty(gr, "__esModule", { value: !0 }), gr.default = d;
	let e = "diff-sequences", t = (e, t, n, r, i) => {
		let a = 0;
		for (; e < t && n < r && i(e, n);) e += 1, n += 1, a += 1;
		return a;
	}, n = (e, t, n, r, i) => {
		let a = 0;
		for (; e <= t && n <= r && i(t, r);) --t, --r, a += 1;
		return a;
	}, r = (e, n, r, i, a, o, s) => {
		let c = 0, l = -e, u = o[c], d = u;
		o[c] += t(u + 1, n, i + u - l + 1, r, a);
		let f = e < s ? e : s;
		for (c += 1, l += 2; c <= f; c += 1, l += 2) {
			if (c !== e && d < o[c]) u = o[c];
			else if (u = d + 1, n <= u) return c - 1;
			d = o[c], o[c] = u + t(u + 1, n, i + u - l + 1, r, a);
		}
		return s;
	}, i = (e, t, r, i, a, o, s) => {
		let c = 0, l = e, u = o[c], d = u;
		o[c] -= n(t, u - 1, r, i + u - l - 1, a);
		let f = e < s ? e : s;
		for (c += 1, l -= 2; c <= f; c += 1, l -= 2) {
			if (c !== e && o[c] < d) u = o[c];
			else if (u = d - 1, u < t) return c - 1;
			d = o[c], o[c] = u - n(t, u - 1, r, i + u - l - 1, a);
		}
		return s;
	}, a = (e, r, i, a, o, s, c, l, u, d, f) => {
		let p = a - r, m = i - r, h = o - a - m, g = -h - (e - 1), _ = -h + (e - 1), v = 0, y = e < l ? e : l;
		for (let l = 0, m = -e; l <= y; l += 1, m += 2) {
			let y = l === 0 || l !== e && v < c[l], b = y ? c[l] : v, x = y ? b : b + 1, ee = p + x - m, te = t(x + 1, i, ee + 1, o, s), S = x + te;
			if (v = c[l], c[l] = S, g <= m && m <= _) {
				let t = (e - 1 - (m + h)) / 2;
				if (t <= d && u[t] - 1 <= S) {
					let t = p + b - (y ? m + 1 : m - 1), c = n(r, b, a, t, s), l = b - c, u = t - c, d = l + 1, h = u + 1;
					f.nChangePreceding = e - 1, e - 1 === d + h - r - a ? (f.aEndPreceding = r, f.bEndPreceding = a) : (f.aEndPreceding = d, f.bEndPreceding = h), f.nCommonPreceding = c, c !== 0 && (f.aCommonPreceding = d, f.bCommonPreceding = h), f.nCommonFollowing = te, te !== 0 && (f.aCommonFollowing = x + 1, f.bCommonFollowing = ee + 1);
					let g = S + 1, _ = ee + te + 1;
					return f.nChangeFollowing = e - 1, e - 1 === i + o - g - _ ? (f.aStartFollowing = i, f.bStartFollowing = o) : (f.aStartFollowing = g, f.bStartFollowing = _), !0;
				}
			}
		}
		return !1;
	}, o = (e, r, i, a, o, s, c, l, u, d, f) => {
		let p = o - i, m = i - r, h = o - a - m, g = h - e, _ = h + e, v = 0, y = e < d ? e : d;
		for (let d = 0, m = e; d <= y; d += 1, m -= 2) {
			let y = d === 0 || d !== e && u[d] < v, b = y ? u[d] : v, x = y ? b : b - 1, ee = p + x - m, te = n(r, x - 1, a, ee - 1, s), S = x - te;
			if (v = u[d], u[d] = S, g <= m && m <= _) {
				let n = (e + (m - h)) / 2;
				if (n <= l && S - 1 <= c[n]) {
					let n = ee - te;
					if (f.nChangePreceding = e, e === S + n - r - a ? (f.aEndPreceding = r, f.bEndPreceding = a) : (f.aEndPreceding = S, f.bEndPreceding = n), f.nCommonPreceding = te, te !== 0 && (f.aCommonPreceding = S, f.bCommonPreceding = n), f.nChangeFollowing = e - 1, e === 1) f.nCommonFollowing = 0, f.aStartFollowing = i, f.bStartFollowing = o;
					else {
						let n = p + b - (y ? m - 1 : m + 1), r = t(b, i, n, o, s);
						f.nCommonFollowing = r, r !== 0 && (f.aCommonFollowing = b, f.bCommonFollowing = n);
						let a = b + r, c = n + r;
						e - 1 === i + o - a - c ? (f.aStartFollowing = i, f.bStartFollowing = o) : (f.aStartFollowing = a, f.bStartFollowing = c);
					}
					return !0;
				}
			}
		}
		return !1;
	}, s = (t, n, s, c, l, u, d, f, p) => {
		let m = c - n, h = l - s, g = s - n, _ = l - c, v = _ - g, y = g, b = g;
		if (d[0] = n - 1, f[0] = s, v % 2 == 0) {
			let e = (t || v) / 2, a = (g + _) / 2;
			for (let t = 1; t <= a; t += 1) if (y = r(t, s, l, m, u, d, y), t < e) b = i(t, n, c, h, u, f, b);
			else if (o(t, n, s, c, l, u, d, y, f, b, p)) return;
		} else {
			let e = ((t || v) + 1) / 2, o = (g + _ + 1) / 2, x = 1;
			for (y = r(x, s, l, m, u, d, y), x += 1; x <= o; x += 1) if (b = i(x - 1, n, c, h, u, f, b), x < e) y = r(x, s, l, m, u, d, y);
			else if (a(x, n, s, c, l, u, d, y, f, b, p)) return;
		}
		throw Error(`${e}: no overlap aStart=${n} aEnd=${s} bStart=${c} bEnd=${l}`);
	}, c = (e, t, n, r, i, a, o, l, u, d) => {
		if (i - r < n - t) {
			if (a = !a, a && o.length === 1) {
				let { foundSubsequence: e, isCommon: t } = o[0];
				o[1] = {
					foundSubsequence: (t, n, r) => {
						e(t, r, n);
					},
					isCommon: (e, n) => t(n, e)
				};
			}
			let e = t, s = n;
			t = r, n = i, r = e, i = s;
		}
		let { foundSubsequence: f, isCommon: p } = o[+!!a];
		s(e, t, n, r, i, p, l, u, d);
		let { nChangePreceding: m, aEndPreceding: h, bEndPreceding: g, nCommonPreceding: _, aCommonPreceding: v, bCommonPreceding: y, nCommonFollowing: b, aCommonFollowing: x, bCommonFollowing: ee, nChangeFollowing: te, aStartFollowing: S, bStartFollowing: C } = d;
		t < h && r < g && c(m, t, h, r, g, a, o, l, u, d), _ !== 0 && f(_, v, y), b !== 0 && f(b, x, ee), S < n && C < i && c(te, S, n, C, i, a, o, l, u, d);
	}, l = (t, n) => {
		if (typeof n != "number") throw TypeError(`${e}: ${t} typeof ${typeof n} is not a number`);
		if (!Number.isSafeInteger(n)) throw RangeError(`${e}: ${t} value ${n} is not a safe integer`);
		if (n < 0) throw RangeError(`${e}: ${t} value ${n} is a negative integer`);
	}, u = (t, n) => {
		let r = typeof n;
		if (r !== "function") throw TypeError(`${e}: ${t} typeof ${r} is not a function`);
	};
	function d(e, r, i, a) {
		l("aLength", e), l("bLength", r), u("isCommon", i), u("foundSubsequence", a);
		let o = t(0, e, 0, r, i);
		if (o !== 0 && a(o, 0, 0), e !== o || r !== o) {
			let t = o, s = o, l = n(t, e - 1, s, r - 1, i), u = e - l, d = r - l, f = o + l;
			e !== f && r !== f && c(0, t, u, s, d, !1, [{
				foundSubsequence: a,
				isCommon: i
			}], [0], [0], {
				aCommonFollowing: 0,
				aCommonPreceding: 0,
				aEndPreceding: 0,
				aStartFollowing: 0,
				bCommonFollowing: 0,
				bCommonPreceding: 0,
				bEndPreceding: 0,
				bStartFollowing: 0,
				nChangeFollowing: 0,
				nChangePreceding: 0,
				nCommonFollowing: 0,
				nCommonPreceding: 0
			}), l !== 0 && a(l, u, d);
		}
	}
	return gr;
}
var yr = Gn(vr());
function br(e, t) {
	return e.replace(/\s+$/, (e) => t(e));
}
function xr(e, t, n, r, i, a) {
	return e.length === 0 ? r === " " ? t && a.length !== 0 ? n(`${r} ${a}`) : "" : n(r) : n(`${r} ${br(e, i)}`);
}
function Sr(e, t, { aColor: n, aIndicator: r, changeLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
	return xr(e, t, n, r, i, a);
}
function Cr(e, t, { bColor: n, bIndicator: r, changeLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
	return xr(e, t, n, r, i, a);
}
function wr(e, t, { commonColor: n, commonIndicator: r, commonLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
	return xr(e, t, n, r, i, a);
}
function Tr(e, t, n, r, { patchColor: i }) {
	return i(`@@ -${e + 1},${t - e} +${n + 1},${r - n} @@`);
}
function Er(e, t) {
	let n = e.length, r = t.contextLines, i = r + r, a = n, o = !1, s = 0, c = 0;
	for (; c !== n;) {
		let t = c;
		for (; c !== n && e[c][0] === P;) c += 1;
		if (t !== c) {
			if (t === 0) c > r && (a -= c - r, o = !0);
			else if (c === n) {
				let e = c - t;
				e > r && (a -= e - r, o = !0);
			} else {
				let e = c - t;
				e > i && (a -= e - i, s += 1);
			}
		}
		for (; c !== n && e[c][0] !== P;) c += 1;
	}
	let l = s !== 0 || o;
	s === 0 ? o && (a += 1) : a += s + 1;
	let u = a - 1, d = [], f = 0;
	l && d.push("");
	let p = 0, m = 0, h = 0, g = 0, _ = (e) => {
		let n = d.length;
		d.push(wr(e, n === 0 || n === u, t)), h += 1, g += 1;
	}, v = (e) => {
		let n = d.length;
		d.push(Sr(e, n === 0 || n === u, t)), h += 1;
	}, y = (e) => {
		let n = d.length;
		d.push(Cr(e, n === 0 || n === u, t)), g += 1;
	};
	for (c = 0; c !== n;) {
		let a = c;
		for (; c !== n && e[c][0] === P;) c += 1;
		if (a !== c) {
			if (a === 0) {
				c > r && (a = c - r, p = a, m = a, h = p, g = m);
				for (let t = a; t !== c; t += 1) _(e[t][1]);
			} else if (c === n) {
				let t = c - a > r ? a + r : c;
				for (let n = a; n !== t; n += 1) _(e[n][1]);
			} else {
				let n = c - a;
				if (n > i) {
					let o = a + r;
					for (let t = a; t !== o; t += 1) _(e[t][1]);
					d[f] = Tr(p, h, m, g, t), f = d.length, d.push("");
					let s = n - i;
					p = h + s, m = g + s, h = p, g = m;
					for (let t = c - r; t !== c; t += 1) _(e[t][1]);
				} else for (let t = a; t !== c; t += 1) _(e[t][1]);
			}
		}
		for (; c !== n && e[c][0] === M;) v(e[c][1]), c += 1;
		for (; c !== n && e[c][0] === N;) y(e[c][1]), c += 1;
	}
	return l && (d[f] = Tr(p, h, m, g, t)), d.join("\n");
}
function Dr(e, t) {
	return e.map((e, n, r) => {
		let i = e[1], a = n === 0 || n === r.length - 1;
		switch (e[0]) {
			case M: return Sr(i, a, t);
			case N: return Cr(i, a, t);
			default: return wr(i, a, t);
		}
	}).join("\n");
}
var Or = (e) => e, kr = 5, Ar = 0;
function jr() {
	return {
		aAnnotation: "Expected",
		aColor: s.green,
		aIndicator: "-",
		bAnnotation: "Received",
		bColor: s.red,
		bIndicator: "+",
		changeColor: s.inverse,
		changeLineTrailingSpaceColor: Or,
		commonColor: s.dim,
		commonIndicator: " ",
		commonLineTrailingSpaceColor: Or,
		compareKeys: void 0,
		contextLines: kr,
		emptyFirstOrLastLinePlaceholder: "",
		expand: !1,
		includeChangeCounts: !1,
		omitAnnotationLines: !1,
		patchColor: s.yellow,
		printBasicPrototype: !1,
		truncateThreshold: Ar,
		truncateAnnotation: "... Diff result is truncated",
		truncateAnnotationColor: Or
	};
}
function Mr(e) {
	return e && typeof e == "function" ? e : void 0;
}
function Nr(e) {
	return typeof e == "number" && Number.isSafeInteger(e) && e >= 0 ? e : kr;
}
function Pr(e = {}) {
	return {
		...jr(),
		...e,
		compareKeys: Mr(e.compareKeys),
		contextLines: Nr(e.contextLines)
	};
}
function Fr(e) {
	return e.length === 1 && e[0].length === 0;
}
function Ir(e) {
	let t = 0, n = 0;
	return e.forEach((e) => {
		switch (e[0]) {
			case M:
				t += 1;
				break;
			case N: n += 1;
		}
	}), {
		a: t,
		b: n
	};
}
function Lr({ aAnnotation: e, aColor: t, aIndicator: n, bAnnotation: r, bColor: i, bIndicator: a, includeChangeCounts: o, omitAnnotationLines: s }, c) {
	if (s) return "";
	let l = "", u = "";
	if (o) {
		let t = String(c.a), i = String(c.b), o = r.length - e.length, s = " ".repeat(Math.max(0, o)), d = " ".repeat(Math.max(0, -o)), f = i.length - t.length, p = " ".repeat(Math.max(0, f)), m = " ".repeat(Math.max(0, -f));
		l = `${s}  ${n} ${p}${t}`, u = `${d}  ${a} ${m}${i}`;
	}
	let d = `${n} ${e}${l}`, f = `${a} ${r}${u}`;
	return `${t(d)}
${i(f)}

`;
}
function Rr(e, t, n) {
	return Lr(n, Ir(e)) + (n.expand ? Dr(e, n) : Er(e, n)) + (t ? n.truncateAnnotationColor(`
${n.truncateAnnotation}`) : "");
}
function zr(e, t, n) {
	let r = Pr(n), [i, a] = Vr(Fr(e) ? [] : e, Fr(t) ? [] : t, r);
	return Rr(i, a, r);
}
function Br(e, t, n, r, i) {
	if (Fr(e) && Fr(n) && (e = [], n = []), Fr(t) && Fr(r) && (t = [], r = []), e.length !== n.length || t.length !== r.length) return zr(e, t, i);
	let [a, o] = Vr(n, r, i), s = 0, c = 0;
	return a.forEach((n) => {
		switch (n[0]) {
			case M:
				n[1] = e[s], s += 1;
				break;
			case N:
				n[1] = t[c], c += 1;
				break;
			default: n[1] = t[c], s += 1, c += 1;
		}
	}), Rr(a, o, Pr(i));
}
function Vr(e, t, n) {
	let r = n?.truncateThreshold ?? !1, i = Math.max(Math.floor(n?.truncateThreshold ?? 0), 0), a = r ? Math.min(e.length, i) : e.length, o = r ? Math.min(t.length, i) : t.length, s = a !== e.length || o !== t.length, c = (n, r) => e[n] === t[r], l = [], u = 0, d = 0;
	for (yr(a, o, c, (n, r, i) => {
		for (; u !== r; u += 1) l.push(new F(M, e[u]));
		for (; d !== i; d += 1) l.push(new F(N, t[d]));
		for (; n !== 0; --n, u += 1, d += 1) l.push(new F(P, t[d]));
	}); u !== a; u += 1) l.push(new F(M, e[u]));
	for (; d !== o; d += 1) l.push(new F(N, t[d]));
	return [l, s];
}
function Hr(e) {
	if (e === void 0) return "undefined";
	if (e === null) return "null";
	if (Array.isArray(e)) return "array";
	if (typeof e == "boolean") return "boolean";
	if (typeof e == "function") return "function";
	if (typeof e == "number") return "number";
	if (typeof e == "string") return "string";
	if (typeof e == "bigint") return "bigint";
	if (typeof e == "object") {
		if (e != null) {
			if (e.constructor === RegExp) return "regexp";
			if (e.constructor === Map) return "map";
			if (e.constructor === Set) return "set";
			if (e.constructor === Date) return "date";
		}
		return "object";
	}
	if (typeof e == "symbol") return "symbol";
	throw Error(`value of unknown type: ${e}`);
}
function Ur(e) {
	return e.includes("\r\n") ? "\r\n" : "\n";
}
function Wr(e, t, n) {
	let r = n?.truncateThreshold ?? !1, i = Math.max(Math.floor(n?.truncateThreshold ?? 0), 0), a = e.length, o = t.length;
	if (r) {
		let n = e.includes("\n"), r = t.includes("\n"), s = Ur(e), c = Ur(t), l = n ? `${e.split(s, i).join(s)}
` : e, u = r ? `${t.split(c, i).join(c)}
` : t;
		a = l.length, o = u.length;
	}
	let s = a !== e.length || o !== t.length, c = (n, r) => e[n] === t[r], l = 0, u = 0, d = [];
	return yr(a, o, c, (n, r, i) => {
		l !== r && d.push(new F(M, e.slice(l, r))), u !== i && d.push(new F(N, t.slice(u, i))), l = r + n, u = i + n, d.push(new F(P, t.slice(i, u)));
	}), l !== a && d.push(new F(M, e.slice(l))), u !== o && d.push(new F(N, t.slice(u))), [d, s];
}
function Gr(e, t, n) {
	return t.reduce((t, r) => t + (r[0] === P ? r[1] : r[0] === e && r[1].length !== 0 ? n(r[1]) : ""), "");
}
var Kr = class {
	op;
	line;
	lines;
	changeColor;
	constructor(e, t) {
		this.op = e, this.line = [], this.lines = [], this.changeColor = t;
	}
	pushSubstring(e) {
		this.pushDiff(new F(this.op, e));
	}
	pushLine() {
		this.lines.push(this.line.length === 1 ? this.line[0][0] === this.op ? this.line[0] : new F(this.op, this.line[0][1]) : new F(this.op, Gr(this.op, this.line, this.changeColor))), this.line.length = 0;
	}
	isLineEmpty() {
		return this.line.length === 0;
	}
	pushDiff(e) {
		this.line.push(e);
	}
	align(e) {
		let t = e[1];
		if (t.includes("\n")) {
			let e = t.split("\n"), n = e.length - 1;
			e.forEach((e, t) => {
				t < n ? (this.pushSubstring(e), this.pushLine()) : e.length !== 0 && this.pushSubstring(e);
			});
		} else this.pushDiff(e);
	}
	moveLinesTo(e) {
		this.isLineEmpty() || this.pushLine(), e.push(...this.lines), this.lines.length = 0;
	}
}, qr = class {
	deleteBuffer;
	insertBuffer;
	lines;
	constructor(e, t) {
		this.deleteBuffer = e, this.insertBuffer = t, this.lines = [];
	}
	pushDiffCommonLine(e) {
		this.lines.push(e);
	}
	pushDiffChangeLines(e) {
		let t = e[1].length === 0;
		(!t || this.deleteBuffer.isLineEmpty()) && this.deleteBuffer.pushDiff(e), (!t || this.insertBuffer.isLineEmpty()) && this.insertBuffer.pushDiff(e);
	}
	flushChangeLines() {
		this.deleteBuffer.moveLinesTo(this.lines), this.insertBuffer.moveLinesTo(this.lines);
	}
	align(e) {
		let t = e[0], n = e[1];
		if (n.includes("\n")) {
			let e = n.split("\n"), r = e.length - 1;
			e.forEach((e, n) => {
				if (n === 0) {
					let n = new F(t, e);
					this.deleteBuffer.isLineEmpty() && this.insertBuffer.isLineEmpty() ? (this.flushChangeLines(), this.pushDiffCommonLine(n)) : (this.pushDiffChangeLines(n), this.flushChangeLines());
				} else n < r ? this.pushDiffCommonLine(new F(t, e)) : e.length !== 0 && this.pushDiffChangeLines(new F(t, e));
			});
		} else this.pushDiffChangeLines(e);
	}
	getLines() {
		return this.flushChangeLines(), this.lines;
	}
};
function Jr(e, t) {
	let n = new Kr(M, t), r = new Kr(N, t), i = new qr(n, r);
	return e.forEach((e) => {
		switch (e[0]) {
			case M:
				n.align(e);
				break;
			case N:
				r.align(e);
				break;
			default: i.align(e);
		}
	}), i.getLines();
}
function Yr(e, t) {
	if (t) {
		let t = e.length - 1;
		return e.some((e, n) => e[0] === P && (n !== t || e[1] !== "\n"));
	}
	return e.some((e) => e[0] === P);
}
function Xr(e, t, n) {
	if (e !== t && e.length !== 0 && t.length !== 0) {
		let r = e.includes("\n") || t.includes("\n"), [i, a] = Zr(r ? `${e}
` : e, r ? `${t}
` : t, !0, n);
		if (Yr(i, r)) {
			let e = Pr(n);
			return Rr(Jr(i, e.changeColor), a, e);
		}
	}
	return zr(e.split("\n"), t.split("\n"), n);
}
function Zr(e, t, n, r) {
	let [i, a] = Wr(e, t, r);
	return n && ar(i), [i, a];
}
function Qr(e, t) {
	let { commonColor: n } = Pr(t);
	return n(e);
}
var { AsymmetricMatcher: $r, DOMCollection: ei, DOMElement: ti, Immutable: ni, ReactElement: ri, ReactTestComponent: ii } = Ft, ai = [
	ii,
	ri,
	ti,
	ei,
	ni,
	$r,
	Ft.Error
], oi = {
	maxDepth: 20,
	plugins: ai
}, si = {
	callToJSON: !1,
	maxDepth: 8,
	plugins: ai
};
function ci(e, t, n) {
	if (Object.is(e, t)) return "";
	let r = Hr(e), i = r, a = !1;
	if (r === "object" && typeof e.asymmetricMatch == "function") {
		if (e.$$typeof !== /* @__PURE__ */ Symbol.for("jest.asymmetricMatcher") || typeof e.getExpectedType != "function") return;
		i = e.getExpectedType(), a = i === "string";
	}
	if (i !== Hr(t)) {
		let r = function(e) {
			return e.length <= p ? e : `${e.slice(0, p)}...`;
		}, { aAnnotation: i, aColor: a, aIndicator: o, bAnnotation: s, bColor: c, bIndicator: l } = Pr(n), u = pi(si, n), d = Pt(e, u), f = Pt(t, u), p = 1e5;
		return d = r(d), f = r(f), `${`${a(`${o} ${i}:`)} 
${d}`}

${`${c(`${l} ${s}:`)} 
${f}`}`;
	}
	if (!a) switch (r) {
		case "string": return zr(e.split("\n"), t.split("\n"), n);
		case "boolean":
		case "number": return li(e, t, n);
		case "map": return fi(ui(e), ui(t), n);
		case "set": return fi(di(e), di(t), n);
		default: return fi(e, t, n);
	}
}
function li(e, t, n) {
	let r = Pt(e, oi), i = Pt(t, oi);
	return r === i ? "" : zr(r.split("\n"), i.split("\n"), n);
}
function ui(e) {
	return new Map(Array.from(e.entries()).sort());
}
function di(e) {
	return new Set(Array.from(e.values()).sort());
}
function fi(e, t, n) {
	let r, i = !1;
	try {
		r = mi(e, t, pi(oi, n), n);
	} catch {
		i = !0;
	}
	let a = Qr(mr, n);
	return (r === void 0 || r === a) && (r = mi(e, t, pi(si, n), n), r !== a && !i && (r = `${Qr(hr, n)}

${r}`)), r;
}
function pi(e, t) {
	let { compareKeys: n, printBasicPrototype: r, maxDepth: i } = Pr(t);
	return {
		...e,
		compareKeys: n,
		printBasicPrototype: r,
		maxDepth: i ?? e.maxDepth
	};
}
function mi(e, t, n, r) {
	let i = {
		...n,
		indent: 0
	}, a = Pt(e, i), o = Pt(t, i);
	if (a === o) return Qr(mr, r);
	{
		let i = Pt(e, n), s = Pt(t, n);
		return Br(i.split("\n"), s.split("\n"), a.split("\n"), o.split("\n"), r);
	}
}
var hi = 2e4;
function gi(e) {
	return Yn(e) === "Object" && typeof e.asymmetricMatch == "function";
}
function _i(e, t) {
	let n = Yn(e);
	return n === Yn(t) && (n === "Object" || n === "Array");
}
function vi(e, t, n) {
	let { aAnnotation: r, bAnnotation: i } = Pr(n);
	if (typeof t == "string" && typeof e == "string" && t.length > 0 && e.length > 0 && t.length <= hi && e.length <= hi && t !== e) {
		if (t.includes("\n") || e.includes("\n")) return Xr(t, e, n);
		let [a] = Zr(t, e, !0), o = a.some((e) => e[0] === P), s = bi(r, i);
		return `${s(r) + wi(Ti(a, M, o))}
${s(i) + Ci(Ti(a, N, o))}`;
	}
	let a = $n(t, { forceWritable: !0 }), { replacedExpected: o, replacedActual: s } = yi($n(e, { forceWritable: !0 }), a);
	return ci(o, s, n);
}
function yi(e, t, n = /* @__PURE__ */ new WeakSet(), r = /* @__PURE__ */ new WeakSet()) {
	return e instanceof Error && t instanceof Error && typeof e.cause < "u" && typeof t.cause > "u" ? (delete e.cause, {
		replacedActual: e,
		replacedExpected: t
	}) : (_i(e, t) && (n.has(e) || r.has(t) || (n.add(e), r.add(t), Zn(t).forEach((i) => {
		let a = t[i], o = e[i];
		if (gi(a)) a.asymmetricMatch(o) && (e[i] = a);
		else if (gi(o)) o.asymmetricMatch(a) && (t[i] = o);
		else if (_i(o, a)) {
			let s = yi(o, a, n, r);
			e[i] = s.replacedActual, t[i] = s.replacedExpected;
		}
	}))), {
		replacedActual: e,
		replacedExpected: t
	});
}
function bi(...e) {
	let t = e.reduce((e, t) => t.length > e ? t.length : e, 0);
	return (e) => `${e}: ${" ".repeat(t - e.length)}`;
}
var xi = "·";
function Si(e) {
	return e.replace(/\s+$/gm, (e) => xi.repeat(e.length));
}
function Ci(e) {
	return s.red(Si(Vn(e)));
}
function wi(e) {
	return s.green(Si(Vn(e)));
}
function Ti(e, t, n) {
	return e.reduce((e, r) => e + (r[0] === P ? r[1] : r[0] === t ? n ? s.inverse(r[1]) : r[1] : ""), "");
}
var Ei = "@@__IMMUTABLE_RECORD__@@", Di = "@@__IMMUTABLE_ITERABLE__@@";
function Oi(e) {
	return e && (e[Di] || e[Ei]);
}
var ki = Object.getPrototypeOf({});
function Ai(e) {
	return e instanceof Error ? `<unserializable>: ${e.message}` : typeof e == "string" ? `<unserializable>: ${e}` : "<unserializable>";
}
function ji(e, t = /* @__PURE__ */ new WeakMap()) {
	if (!e || typeof e == "string") return e;
	if (e instanceof Error && "toJSON" in e && typeof e.toJSON == "function") {
		let n = e.toJSON();
		return n && n !== e && typeof n == "object" && (typeof e.message == "string" && Mi(() => n.message ??= e.message), typeof e.stack == "string" && Mi(() => n.stack ??= e.stack), typeof e.name == "string" && Mi(() => n.name ??= e.name), e.cause != null && Mi(() => n.cause ??= ji(e.cause, t))), ji(n, t);
	}
	if (typeof e == "function") return `Function<${e.name || "anonymous"}>`;
	if (typeof e == "symbol") return e.toString();
	if (typeof e != "object") return e;
	if (typeof Buffer < "u" && e instanceof Buffer) return `<Buffer(${e.length}) ...>`;
	if (typeof Uint8Array < "u" && e instanceof Uint8Array) return `<Uint8Array(${e.length}) ...>`;
	if (Oi(e)) return ji(e.toJSON(), t);
	if (e instanceof Promise || e.constructor && e.constructor.prototype === "AsyncFunction") return "Promise";
	if (typeof Element < "u" && e instanceof Element) return e.tagName;
	if (typeof e.asymmetricMatch == "function") return `${e.toString()} ${Un(e.sample)}`;
	if (typeof e.toJSON == "function") return ji(e.toJSON(), t);
	if (t.has(e)) return t.get(e);
	if (Array.isArray(e)) {
		let n = Array(e.length);
		return t.set(e, n), e.forEach((e, r) => {
			try {
				n[r] = ji(e, t);
			} catch (e) {
				n[r] = Ai(e);
			}
		}), n;
	}
	{
		let n = /* @__PURE__ */ Object.create(null);
		t.set(e, n);
		let r = e;
		for (; r && r !== ki;) Object.getOwnPropertyNames(r).forEach((r) => {
			if (!(r in n)) try {
				n[r] = ji(e[r], t);
			} catch (e) {
				delete n[r], n[r] = Ai(e);
			}
		}), r = Object.getPrototypeOf(r);
		return n;
	}
}
function Mi(e) {
	try {
		return e();
	} catch {}
}
function Ni(e) {
	return e.replace(/__(vite_ssr_import|vi_import)_\d+__\./g, "");
}
function Pi(e, t, n = /* @__PURE__ */ new WeakSet()) {
	if (!e || typeof e != "object") return { message: String(e) };
	let r = e;
	(r.showDiff || r.showDiff === void 0 && r.expected !== void 0 && r.actual !== void 0) && (r.diff = vi(r.actual, r.expected, {
		...t,
		...r.diffOptions
	})), "expected" in r && typeof r.expected != "string" && (r.expected = Vn(r.expected, 10)), "actual" in r && typeof r.actual != "string" && (r.actual = Vn(r.actual, 10));
	try {
		typeof r.message == "string" && (r.message = Ni(r.message));
	} catch {}
	try {
		!n.has(r) && typeof r.cause == "object" && (n.add(r), r.cause = Pi(r.cause, t, n));
	} catch {}
	try {
		return ji(r);
	} catch (e) {
		return ji(/* @__PURE__ */ Error(`Failed to fully serialize error: ${e?.message}
Inner error message: ${r?.message}`));
	}
}
// node_modules/.bun/storybook@10.6.0+5d98dd0e7509148a/node_modules/storybook/dist/_browser-chunks/chunk-IMSF75WX.js
var Fi = Object.create, Ii = Object.defineProperty, Li = Object.getOwnPropertyDescriptor, Ri = Object.getOwnPropertyNames, zi = Object.getPrototypeOf, Bi = Object.prototype.hasOwnProperty, I = (e, t) => function() {
	try {
		return t || (0, e[Ri(e)[0]])((t = { exports: {} }).exports, t), t.exports;
	} catch (e) {
		throw t = 0, e;
	}
}, Vi = (e, t) => {
	for (var n in t) Ii(e, n, {
		get: t[n],
		enumerable: !0
	});
}, Hi = (e, t, n, r) => {
	if (t && typeof t == "object" || typeof t == "function") for (let i of Ri(t)) !Bi.call(e, i) && i !== n && Ii(e, i, {
		get: () => t[i],
		enumerable: !(r = Li(t, i)) || r.enumerable
	});
	return e;
}, Ui = (e, t, n) => (n = e == null ? {} : Fi(zi(e)), Hi(t || !e || !e.__esModule ? Ii(n, "default", {
	value: e,
	enumerable: !0
}) : n, e)), Wi = I({ "../../node_modules/picocolors/picocolors.browser.ts"(e, t) {
	var n = String, r = function() {
		return {
			isColorSupported: !1,
			reset: n,
			bold: n,
			dim: n,
			italic: n,
			underline: n,
			inverse: n,
			hidden: n,
			strikethrough: n,
			black: n,
			red: n,
			green: n,
			yellow: n,
			blue: n,
			magenta: n,
			cyan: n,
			white: n,
			gray: n,
			bgBlack: n,
			bgRed: n,
			bgGreen: n,
			bgYellow: n,
			bgBlue: n,
			bgMagenta: n,
			bgCyan: n,
			bgWhite: n,
			blackBright: n,
			redBright: n,
			greenBright: n,
			yellowBright: n,
			blueBright: n,
			magentaBright: n,
			cyanBright: n,
			whiteBright: n,
			bgBlackBright: n,
			bgRedBright: n,
			bgGreenBright: n,
			bgYellowBright: n,
			bgBlueBright: n,
			bgMagentaBright: n,
			bgCyanBright: n,
			bgWhiteBright: n
		};
	};
	t.exports = r(), t.exports.createColors = r;
} });
// node_modules/.bun/storybook@10.6.0+5d98dd0e7509148a/node_modules/storybook/dist/_browser-chunks/chunk-3LY4VQVK.js
function Gi(e) {
	var t = [...arguments].slice(1), n = Array.from(typeof e == "string" ? [e] : e);
	n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
	var r = n.reduce(function(e, t) {
		var n = t.match(/\n([\t ]+|(?!\s).)/g);
		return n ? e.concat(n.map(function(e) {
			return e.match(/[\t ]/g)?.length ?? 0;
		})) : e;
	}, []);
	if (r.length) {
		var i = RegExp("\n[	 ]{" + Math.min.apply(Math, r) + "}", "g");
		n = n.map(function(e) {
			return e.replace(i, "\n");
		});
	}
	n[0] = n[0].replace(/^\r?\n/, "");
	var a = n[0];
	return t.forEach(function(e, t) {
		var r = a.match(/(?:^|\n)( *)$/), i = r ? r[1] : "", o = e;
		typeof e == "string" && e.includes("\n") && (o = String(e).split("\n").map(function(e, t) {
			return t === 0 ? e : "" + i + e;
		}).join("\n")), a += o + n[t + 1];
	}), a;
}
// node_modules/.bun/storybook@10.6.0+5d98dd0e7509148a/node_modules/storybook/dist/_browser-chunks/chunk-ZUWEVLDX.js
var Ki = {
	CALL: "storybook/instrumenter/call",
	SYNC: "storybook/instrumenter/sync",
	START: "storybook/instrumenter/start",
	BACK: "storybook/instrumenter/back",
	GOTO: "storybook/instrumenter/goto",
	NEXT: "storybook/instrumenter/next",
	END: "storybook/instrumenter/end"
}, { LOGLEVEL: qi } = t, Ji = {
	trace: 1,
	debug: 2,
	info: 3,
	warn: 4,
	error: 5,
	silent: 10
}, Yi = Ji[qi] || Ji.info, Xi = {
	trace: (e, ...t) => {
		Yi <= Ji.trace && console.trace(e, ...t);
	},
	debug: (e, ...t) => {
		Yi <= Ji.debug && console.debug(e, ...t);
	},
	info: (e, ...t) => {
		Yi <= Ji.info && console.info(e, ...t);
	},
	warn: (e, ...t) => {
		Yi <= Ji.warn && console.warn(e, ...t);
	},
	error: (e, ...t) => {
		Yi <= Ji.error && console.error(e, ...t);
	},
	log: (e, ...t) => {
		Yi < Ji.silent && console.log(e, ...t);
	}
}, Zi = /* @__PURE__ */ new Set(), Qi = (e) => (t, ...n) => {
	if (!Zi.has(t)) return Zi.add(t), Xi[e](t, ...n);
};
Qi.clear = () => Zi.clear(), Qi.trace = Qi("trace"), Qi.debug = Qi("debug"), Qi.info = Qi("info"), Qi.warn = Qi("warn"), Qi.error = Qi("error"), Qi.log = Qi("log");
var $i = (e) => (...t) => {
	let n = [];
	if (t.length) {
		let e = /<span\s+style=(['"])([^'"]*)\1\s*>/gi, r = /<\/span>/gi, i;
		for (n.push(t[0].replace(e, "%c").replace(r, "%c")); i = e.exec(t[0]);) n.push(i[2]), n.push("");
		for (let e = 1; e < t.length; e++) n.push(t[e]);
	}
	Xi[e].apply(Xi, n);
};
$i.trace = $i("trace"), $i.debug = $i("debug"), $i.info = $i("info"), $i.warn = $i("warn"), $i.error = $i("error");
// node_modules/.bun/storybook@10.6.0+5d98dd0e7509148a/node_modules/storybook/dist/core-events/index.js
var ea = /* @__PURE__ */ ((e) => (e.CHANNEL_WS_DISCONNECT = "channelWSDisconnect", e.CHANNEL_CREATED = "channelCreated", e.CONFIG_ERROR = "configError", e.STORY_INDEX_INVALIDATED = "storyIndexInvalidated", e.STORY_SPECIFIED = "storySpecified", e.SET_CONFIG = "setConfig", e.SET_STORIES = "setStories", e.SET_INDEX = "setIndex", e.SET_CURRENT_STORY = "setCurrentStory", e.CURRENT_STORY_WAS_SET = "currentStoryWasSet", e.FORCE_RE_RENDER = "forceReRender", e.FORCE_REMOUNT = "forceRemount", e.PRELOAD_ENTRIES = "preloadStories", e.STORY_PREPARED = "storyPrepared", e.DOCS_PREPARED = "docsPrepared", e.STORY_CHANGED = "storyChanged", e.STORY_UNCHANGED = "storyUnchanged", e.STORY_RENDERED = "storyRendered", e.STORY_FINISHED = "storyFinished", e.STORY_MISSING = "storyMissing", e.STORY_ERRORED = "storyErrored", e.STORY_THREW_EXCEPTION = "storyThrewException", e.STORY_RENDER_PHASE_CHANGED = "storyRenderPhaseChanged", e.STORY_HOT_UPDATED = "storyHotUpdated", e.PLAY_FUNCTION_THREW_EXCEPTION = "playFunctionThrewException", e.UNHANDLED_ERRORS_WHILE_PLAYING = "unhandledErrorsWhilePlaying", e.UPDATE_STORY_ARGS = "updateStoryArgs", e.STORY_ARGS_UPDATED = "storyArgsUpdated", e.RESET_STORY_ARGS = "resetStoryArgs", e.SET_FILTER = "setFilter", e.SET_GLOBALS = "setGlobals", e.UPDATE_GLOBALS = "updateGlobals", e.GLOBALS_UPDATED = "globalsUpdated", e.REGISTER_SUBSCRIPTION = "registerSubscription", e.PREVIEW_INITIALIZED = "previewInitialized", e.PREVIEW_KEYDOWN = "previewKeydown", e.PREVIEW_BUILDER_PROGRESS = "preview_builder_progress", e.SELECT_STORY = "selectStory", e.STORIES_COLLAPSE_ALL = "storiesCollapseAll", e.STORIES_EXPAND_ALL = "storiesExpandAll", e.DOCS_RENDERED = "docsRendered", e.SHARED_STATE_CHANGED = "sharedStateChanged", e.SHARED_STATE_SET = "sharedStateSet", e.NAVIGATE_URL = "navigateUrl", e.UPDATE_QUERY_PARAMS = "updateQueryParams", e.REQUEST_WHATS_NEW_DATA = "requestWhatsNewData", e.RESULT_WHATS_NEW_DATA = "resultWhatsNewData", e.SET_WHATS_NEW_CACHE = "setWhatsNewCache", e.TOGGLE_WHATS_NEW_NOTIFICATIONS = "toggleWhatsNewNotifications", e.TELEMETRY_ERROR = "telemetryError", e.FILE_COMPONENT_SEARCH_REQUEST = "fileComponentSearchRequest", e.FILE_COMPONENT_SEARCH_RESPONSE = "fileComponentSearchResponse", e.SAVE_STORY_REQUEST = "saveStoryRequest", e.SAVE_STORY_RESPONSE = "saveStoryResponse", e.ARGTYPES_INFO_REQUEST = "argtypesInfoRequest", e.ARGTYPES_INFO_RESPONSE = "argtypesInfoResponse", e.CREATE_NEW_STORYFILE_REQUEST = "createNewStoryfileRequest", e.CREATE_NEW_STORYFILE_RESPONSE = "createNewStoryfileResponse", e.GHOST_STORIES_REQUEST = "ghostStoriesRequest", e.GHOST_STORIES_RESPONSE = "ghostStoriesResponse", e.AI_SETUP_ANALYTICS_RESPONSE = "aiSetupAnalyticsResponse", e.AI_SETUP_ANALYTICS_REQUEST = "aiSetupAnalyticsRequest", e.OPEN_IN_EDITOR_REQUEST = "openInEditorRequest", e.OPEN_IN_EDITOR_RESPONSE = "openInEditorResponse", e.MANAGER_INERT_ATTRIBUTE_CHANGED = "managerInertAttributeChanged", e.SHARE_ISOLATE_MODE = "shareIsolateMode", e.AI_PROMPT_NUDGE = "aiPromptNudge", e.SIDEBAR_FILTER_CHANGED = "sidebarFilterChanged", e))(ea || {}), { CHANNEL_WS_DISCONNECT: ta, CHANNEL_CREATED: na, CONFIG_ERROR: ra, CREATE_NEW_STORYFILE_REQUEST: ia, CREATE_NEW_STORYFILE_RESPONSE: aa, CURRENT_STORY_WAS_SET: oa, DOCS_PREPARED: sa, DOCS_RENDERED: ca, FILE_COMPONENT_SEARCH_REQUEST: la, FILE_COMPONENT_SEARCH_RESPONSE: ua, FORCE_RE_RENDER: da, FORCE_REMOUNT: fa, GLOBALS_UPDATED: pa, NAVIGATE_URL: ma, PLAY_FUNCTION_THREW_EXCEPTION: ha, UNHANDLED_ERRORS_WHILE_PLAYING: ga, PRELOAD_ENTRIES: _a, PREVIEW_INITIALIZED: va, PREVIEW_BUILDER_PROGRESS: ya, PREVIEW_KEYDOWN: ba, REGISTER_SUBSCRIPTION: xa, RESET_STORY_ARGS: Sa, SELECT_STORY: Ca, SET_CONFIG: wa, SET_CURRENT_STORY: Ta, SET_FILTER: Ea, SET_GLOBALS: Da, SET_INDEX: Oa, SET_STORIES: ka, SHARED_STATE_CHANGED: Aa, SHARED_STATE_SET: ja, STORIES_COLLAPSE_ALL: Ma, STORIES_EXPAND_ALL: Na, STORY_ARGS_UPDATED: Pa, STORY_CHANGED: Fa, STORY_ERRORED: Ia, STORY_INDEX_INVALIDATED: La, STORY_MISSING: Ra, STORY_PREPARED: za, STORY_RENDER_PHASE_CHANGED: Ba, STORY_RENDERED: Va, STORY_FINISHED: Ha, STORY_SPECIFIED: Ua, STORY_THREW_EXCEPTION: Wa, STORY_UNCHANGED: Ga, STORY_HOT_UPDATED: Ka, UPDATE_GLOBALS: qa, UPDATE_QUERY_PARAMS: Ja, UPDATE_STORY_ARGS: Ya, REQUEST_WHATS_NEW_DATA: Xa, RESULT_WHATS_NEW_DATA: Za, SET_WHATS_NEW_CACHE: Qa, TOGGLE_WHATS_NEW_NOTIFICATIONS: $a, TELEMETRY_ERROR: eo, SAVE_STORY_REQUEST: to, SAVE_STORY_RESPONSE: no, ARGTYPES_INFO_REQUEST: ro, ARGTYPES_INFO_RESPONSE: io, GHOST_STORIES_REQUEST: ao, GHOST_STORIES_RESPONSE: oo, AI_SETUP_ANALYTICS_RESPONSE: so, AI_SETUP_ANALYTICS_REQUEST: co, OPEN_IN_EDITOR_REQUEST: lo, OPEN_IN_EDITOR_RESPONSE: uo, MANAGER_INERT_ATTRIBUTE_CHANGED: fo, SHARE_ISOLATE_MODE: po, AI_PROMPT_NUDGE: mo, SIDEBAR_FILTER_CHANGED: ho } = ea, go = globalThis.__STORYBOOK_ADDONS_PREVIEW, _o = /* @__PURE__ */ Error("This function ran after the play function completed. Did you forget to `await` it?"), vo = (e) => Object.prototype.toString.call(e) === "[object Object]", yo = (e) => Object.prototype.toString.call(e) === "[object Module]", bo = (e) => {
	if (!vo(e) && !yo(e)) return !1;
	if (e.constructor === void 0) return !0;
	let t = e.constructor.prototype;
	return !!vo(t);
}, xo = (e) => {
	try {
		return new e.constructor();
	} catch {
		return {};
	}
}, So = () => ({
	renderPhase: "preparing",
	isDebugging: !1,
	isPlaying: !1,
	isLocked: !1,
	cursor: 0,
	calls: [],
	shadowCalls: [],
	callRefsByResult: /* @__PURE__ */ new Map(),
	chainedCallIds: /* @__PURE__ */ new Set(),
	ancestors: [],
	playUntil: void 0,
	resolvers: {},
	syncTimeout: void 0
}), Co = (e, t = !1) => {
	let n = (t ? e.shadowCalls : e.calls).filter((e) => e.retain);
	if (!n.length) return;
	let r = new Map(Array.from(e.callRefsByResult.entries()).filter(([, e]) => e.retain));
	return {
		cursor: n.length,
		calls: n,
		callRefsByResult: r
	};
}, wo = class {
	constructor() {
		this.detached = !1, this.initialized = !1, this.state = {}, this.loadParentWindowState = () => {
			try {
				this.state = t.window?.parent?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ || {};
			} catch {
				this.detached = !0;
			}
		}, this.updateParentWindowState = () => {
			try {
				t.window.parent.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ = this.state;
			} catch {
				this.detached = !0;
			}
		}, this.loadParentWindowState();
		let e = ({ storyId: e, renderPhase: t, isPlaying: n = !0, isDebugging: r = !1 }) => {
			let i = this.getState(e);
			this.setState(e, {
				...So(),
				...Co(i, r),
				renderPhase: t || i.renderPhase,
				shadowCalls: r ? i.shadowCalls : [],
				chainedCallIds: r ? i.chainedCallIds : /* @__PURE__ */ new Set(),
				playUntil: r ? i.playUntil : void 0,
				isPlaying: n,
				isDebugging: r
			}), this.sync(e);
		}, n = (e) => ({ storyId: t, playUntil: n }) => {
			this.getState(t).isDebugging || this.setState(t, ({ calls: e }) => ({
				calls: [],
				shadowCalls: e.map((e) => ({
					...e,
					status: "waiting"
				})),
				isDebugging: !0
			}));
			let r = this.getLog(t);
			this.setState(t, ({ shadowCalls: e }) => {
				if (n || !r.length) return { playUntil: n };
				let t = e.findIndex((e) => e.id === r[0].callId);
				return { playUntil: e.slice(0, t).filter((e) => e.interceptable && !e.ancestors?.length).slice(-1)[0]?.id };
			}), e.emit(fa, {
				storyId: t,
				isDebugging: !0
			});
		}, r = (e) => ({ storyId: t }) => {
			let r = this.getLog(t).filter((e) => !e.ancestors?.length), i = r.reduceRight((e, t, n) => e >= 0 || t.status === "waiting" ? e : n, -1);
			n(e)({
				storyId: t,
				playUntil: r[i - 1]?.callId
			});
		}, i = (e) => ({ storyId: t, callId: r }) => {
			let { calls: i, shadowCalls: a, resolvers: o } = this.getState(t), s = i.find(({ id: e }) => e === r), c = a.find(({ id: e }) => e === r);
			if (!s && c && Object.values(o).length > 0) {
				let e = this.getLog(t).find((e) => e.status === "waiting")?.callId;
				c.id !== e && this.setState(t, { playUntil: c.id }), Object.values(o).forEach((e) => e());
			} else n(e)({
				storyId: t,
				playUntil: r
			});
		}, a = (e) => ({ storyId: t }) => {
			let { resolvers: r } = this.getState(t);
			if (Object.values(r).length > 0) Object.values(r).forEach((e) => e());
			else {
				let r = this.getLog(t).find((e) => e.status === "waiting")?.callId;
				r ? n(e)({
					storyId: t,
					playUntil: r
				}) : o({ storyId: t });
			}
		}, o = ({ storyId: e }) => {
			this.setState(e, {
				playUntil: void 0,
				isDebugging: !1
			}), Object.values(this.getState(e).resolvers).forEach((e) => e());
		}, s = ({ storyId: t, newPhase: n }) => {
			let { isDebugging: r } = this.getState(t);
			if (n === "preparing" && r || n === "playing") return e({
				storyId: t,
				renderPhase: n,
				isDebugging: r
			});
			n === "played" ? this.setState(t, {
				renderPhase: n,
				isLocked: !1,
				isPlaying: !1,
				isDebugging: !1
			}) : n === "errored" ? this.setState(t, {
				renderPhase: n,
				isLocked: !1,
				isPlaying: !1
			}) : n === "aborted" ? this.setState(t, {
				renderPhase: n,
				isLocked: !0,
				isPlaying: !1
			}) : this.setState(t, { renderPhase: n }), this.sync(t);
		};
		go && go.ready().then(() => {
			this.channel = go.getChannel(), this.channel.on(fa, e), this.channel.on(Ba, s), this.channel.on(Ta, () => {
				this.initialized ? this.cleanup() : this.initialized = !0;
			}), this.channel.on(Ki.START, n(this.channel)), this.channel.on(Ki.BACK, r(this.channel)), this.channel.on(Ki.GOTO, i(this.channel)), this.channel.on(Ki.NEXT, a(this.channel)), this.channel.on(Ki.END, o);
		});
	}
	getState(e) {
		return this.state[e] || So();
	}
	setState(e, t) {
		if (e) {
			let n = this.getState(e), r = typeof t == "function" ? t(n) : t;
			this.state = {
				...this.state,
				[e]: {
					...n,
					...r
				}
			}, this.updateParentWindowState();
		}
	}
	cleanup() {
		this.state = Object.entries(this.state).reduce((e, [t, n]) => {
			let r = Co(n);
			return r && (e[t] = Object.assign(So(), r)), e;
		}, {});
		let e = {
			controlStates: {
				detached: this.detached,
				start: !1,
				back: !1,
				goto: !1,
				next: !1,
				end: !1
			},
			logItems: []
		};
		this.channel?.emit(Ki.SYNC, e), this.updateParentWindowState();
	}
	getLog(e) {
		let { calls: t, shadowCalls: n } = this.getState(e), r = [...n];
		t.forEach((e, t) => {
			r[t] = e;
		});
		let i = /* @__PURE__ */ new Set();
		return r.reduceRight((e, t) => (t.args.forEach((e) => {
			e?.__callId__ && i.add(e.__callId__);
		}), t.path.forEach((e) => {
			e.__callId__ && i.add(e.__callId__);
		}), (t.interceptable || t.exception) && !i.has(t.id) && (e.unshift({
			callId: t.id,
			status: t.status,
			ancestors: t.ancestors
		}), i.add(t.id)), e), []);
	}
	instrument(e, t, n = 0) {
		if (!bo(e)) return e;
		let { mutate: r = !1, path: i = [] } = t, a = t.getKeys ? t.getKeys(e, n) : Object.keys(e);
		return n += 1, a.reduce((r, a) => {
			let o = Eo(e, a);
			if (typeof o?.get == "function") {
				if (o.configurable) {
					let s = () => o?.get?.bind(e)?.();
					Object.defineProperty(r, a, { get: () => this.instrument(s(), {
						...t,
						path: i.concat(a)
					}, n) });
				}
				return r;
			}
			let s = e[a];
			return typeof s == "function" ? "__originalFn__" in s && typeof s.__originalFn__ == "function" ? (r[a] = s, r) : (r[a] = (...n) => this.track(a, s, e, n, t), r[a].__originalFn__ = s, Object.defineProperty(r[a], "name", {
				value: a,
				writable: !1
			}), Object.keys(s).length > 0 && Object.assign(r[a], this.instrument({ ...s }, {
				...t,
				path: i.concat(a)
			}, n)), r) : (r[a] = this.instrument(s, {
				...t,
				path: i.concat(a)
			}, n), r);
		}, r ? e : xo(e));
	}
	track(e, n, r, i, a) {
		let o = i?.[0]?.__storyId__ || t.__STORYBOOK_PREVIEW__?.selectionStore?.selection?.storyId, { cursor: s, ancestors: c } = this.getState(o);
		this.setState(o, { cursor: s + 1 });
		let l = `${c.slice(-1)[0] || o} [${s}] ${e}`, { path: u = [], intercept: d = !1, retain: f = !1 } = a, p = typeof d == "function" ? d(e, u) : d, m = {
			id: l,
			cursor: s,
			storyId: o,
			ancestors: c,
			path: u,
			method: e,
			args: i,
			interceptable: p,
			retain: f
		}, h = (p && !c.length ? this.intercept : this.invoke).call(this, n, r, m, a);
		return this.instrument(h, {
			...a,
			mutate: !0,
			path: [{ __callId__: m.id }]
		});
	}
	intercept(e, t, n, r) {
		let { chainedCallIds: i, isDebugging: a, playUntil: o } = this.getState(n.storyId), s = i.has(n.id);
		return !a || s || o ? (o === n.id && this.setState(n.storyId, { playUntil: void 0 }), this.invoke(e, t, n, r)) : new Promise((e) => {
			this.setState(n.storyId, ({ resolvers: t }) => ({
				isLocked: !1,
				resolvers: {
					...t,
					[n.id]: e
				}
			}));
		}).then(() => (this.setState(n.storyId, (e) => {
			let { [n.id]: t, ...r } = e.resolvers;
			return {
				isLocked: !0,
				resolvers: r
			};
		}), this.invoke(e, t, n, r)));
	}
	invoke(e, n, r, i) {
		let { callRefsByResult: a, renderPhase: o } = this.getState(r.storyId), s = (e, n, r) => {
			if (r.includes(e)) return "[Circular]";
			if (r = [...r, e], n > 25) return "...";
			if (a.has(e)) return a.get(e);
			if (e instanceof Array) return e.map((e) => s(e, ++n, r));
			if (e instanceof Date) return { __date__: { value: e.toISOString() } };
			if (e instanceof Error) {
				let { name: t, message: n, stack: r } = e;
				return { __error__: {
					name: t,
					message: n,
					stack: r
				} };
			}
			if (e instanceof RegExp) {
				let { flags: t, source: n } = e;
				return { __regexp__: {
					flags: t,
					source: n
				} };
			}
			if (e instanceof t.window?.HTMLElement) {
				let { prefix: t, localName: n, id: r, classList: i, innerText: a } = e;
				return { __element__: {
					prefix: t,
					localName: n,
					id: r,
					classNames: Array.from(i),
					innerText: a
				} };
			}
			return typeof e == "function" ? { __function__: { name: "getMockName" in e ? e.getMockName() : e.name } } : typeof e == "symbol" ? { __symbol__: { description: e.description } } : typeof e == "object" && e?.constructor?.name && e?.constructor?.name !== "Object" ? { __class__: { name: e.constructor.name } } : Object.prototype.toString.call(e) === "[object Object]" ? Object.fromEntries(Object.entries(e).map(([e, t]) => [e, s(t, ++n, r)])) : e;
		}, c = {
			...r,
			args: r.args.map((e) => s(e, 0, []))
		};
		r.path.forEach((e) => {
			e?.__callId__ && this.setState(r.storyId, ({ chainedCallIds: t }) => ({ chainedCallIds: new Set(Array.from(t).concat(e.__callId__)) }));
		});
		let l = (e) => {
			if (e instanceof Error) {
				let { name: t, message: n, stack: i, callId: a = r.id } = e, { showDiff: o = void 0, diff: s = void 0, actual: l = void 0, expected: u = void 0 } = e.name === "AssertionError" ? Pi(e) : e, d = {
					name: t,
					message: n,
					stack: i,
					callId: a,
					showDiff: o,
					diff: s,
					actual: l,
					expected: u
				};
				if (this.update({
					...c,
					status: "error",
					exception: d
				}), this.setState(r.storyId, (t) => ({ callRefsByResult: new Map([...Array.from(t.callRefsByResult.entries()), [e, {
					__callId__: r.id,
					retain: r.retain
				}]]) })), r.ancestors?.length) throw Object.prototype.hasOwnProperty.call(e, "callId") || Object.defineProperty(e, "callId", { value: r.id }), e;
			}
			throw e;
		};
		try {
			if (o === "played" && !r.retain) throw _o;
			let t = (i.getArgs ? i.getArgs(r, this.getState(r.storyId)) : r.args).map((e) => typeof e != "function" || Do(e) || Object.keys(e).length ? e : (...t) => {
				let { cursor: n, ancestors: i } = this.getState(r.storyId);
				this.setState(r.storyId, {
					cursor: 0,
					ancestors: [...i, r.id]
				});
				let a = () => this.setState(r.storyId, {
					cursor: n,
					ancestors: i
				}), o = !1;
				try {
					let n = e(...t);
					return n instanceof Promise ? (o = !0, n.finally(a)) : n;
				} finally {
					o || a();
				}
			}), a = e.apply(n, t);
			return a && [
				"object",
				"function",
				"symbol"
			].includes(typeof a) && this.setState(r.storyId, (e) => ({ callRefsByResult: new Map([...Array.from(e.callRefsByResult.entries()), [a, {
				__callId__: r.id,
				retain: r.retain
			}]]) })), this.update({
				...c,
				status: a instanceof Promise ? "active" : "done"
			}), a instanceof Promise ? a.then((e) => (this.update({
				...c,
				status: "done"
			}), e), l) : a;
		} catch (e) {
			return l(e);
		}
	}
	update(e) {
		this.channel?.emit(Ki.CALL, e), this.setState(e.storyId, ({ calls: t }) => {
			let n = t.concat(e).reduce((e, t) => Object.assign(e, { [t.id]: t }), {});
			return { calls: Object.values(n).sort((e, t) => e.id.localeCompare(t.id, void 0, { numeric: !0 })) };
		}), this.sync(e.storyId);
	}
	sync(e) {
		let t = () => {
			let { isLocked: t, isPlaying: n } = this.getState(e), r = this.getLog(e), i = r.filter(({ ancestors: e }) => !e.length).find((e) => e.status === "waiting")?.callId, a = r.some((e) => e.status === "active");
			if (this.detached || t || a || r.length === 0) {
				let e = {
					controlStates: {
						detached: this.detached,
						start: !1,
						back: !1,
						goto: !1,
						next: !1,
						end: !1
					},
					logItems: r
				};
				this.channel?.emit(Ki.SYNC, e);
				return;
			}
			let o = r.some((e) => e.status === "done" || e.status === "error"), s = {
				controlStates: {
					detached: this.detached,
					start: o,
					back: o,
					goto: !0,
					next: n,
					end: n
				},
				logItems: r,
				pausedAt: i
			};
			this.channel?.emit(Ki.SYNC, s);
		};
		this.setState(e, ({ syncTimeout: e }) => (clearTimeout(e), { syncTimeout: setTimeout(t, 0) }));
	}
};
function To(e, n = {}) {
	try {
		let r = !1, i = !1;
		return t.window?.location?.search?.includes("instrument=true") ? r = !0 : t.window?.location?.search?.includes("instrument=false") && (i = !0), t.window?.parent === t.window && !r || i ? e : (t.window && !t.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ && (t.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ = new wo()), (t.window?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__).instrument(e, n));
	} catch (t) {
		return Qi.warn(t), e;
	}
}
function Eo(e, t) {
	let n = e;
	for (; n != null;) {
		let e = Object.getOwnPropertyDescriptor(n, t);
		if (e) return e;
		n = Object.getPrototypeOf(n);
	}
}
function Do(e) {
	if (typeof e != "function") return !1;
	let t = Object.getOwnPropertyDescriptor(e, "prototype");
	return t ? !t.writable : !1;
}
// node_modules/.bun/storybook@10.6.0+5d98dd0e7509148a/node_modules/storybook/dist/test/index.js
var Oo = I({ "../../node_modules/min-indent/index.ts"(e, t) {
	t.exports = (e) => {
		let t = e.match(/^[ \t]*(?=\S)/gm);
		return t ? t.reduce((e, t) => Math.min(e, t.length), 1 / 0) : 0;
	};
} }), ko = I({ "../../node_modules/strip-indent/index.ts"(e, t) {
	var n = Oo();
	t.exports = (e) => {
		let t = n(e);
		if (t === 0) return e;
		let r = RegExp(`^[ \\t]{${t}}`, "gm");
		return e.replace(r, "");
	};
} }), Ao = I({ "../../node_modules/indent-string/index.ts"(e, t) {
	t.exports = (e, t = 1, n) => {
		if (n = {
			indent: " ",
			includeEmptyLines: !1,
			...n
		}, typeof e != "string") throw TypeError(`Expected \`input\` to be a \`string\`, got \`${typeof e}\``);
		if (typeof t != "number") throw TypeError(`Expected \`count\` to be a \`number\`, got \`${typeof t}\``);
		if (typeof n.indent != "string") throw TypeError(`Expected \`options.indent\` to be a \`string\`, got \`${typeof n.indent}\``);
		if (t === 0) return e;
		let r = n.includeEmptyLines ? /^/gm : /^(?!\s*$)/gm;
		return e.replace(r, n.indent.repeat(t));
	};
} }), jo = I({ "../../node_modules/redent/index.ts"(e, t) {
	var n = ko(), r = Ao();
	t.exports = (e, t = 0, i) => r(n(e), t, i);
} }), Mo = I({ "../../node_modules/aria-query/lib/util/iteratorProxy.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	function t() {
		var e = this, t = 0, n = {
			"@@iterator": function() {
				return n;
			},
			next: function() {
				if (t < e.length) {
					var n = e[t];
					return t += 1, {
						done: !1,
						value: n
					};
				}
				return { done: !0 };
			}
		};
		return n;
	}
	e.default = t;
} }), No = I({ "../../node_modules/aria-query/lib/util/iterationDecorator.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = i;
	var t = n(Mo());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function r(e) {
		"@babel/helpers - typeof";
		return r = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
			return typeof e;
		} : function(e) {
			return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
		}, r(e);
	}
	function i(e, n) {
		return typeof Symbol == "function" && r(Symbol.iterator) === "symbol" && Object.defineProperty(e, Symbol.iterator, { value: t.default.bind(n) }), e;
	}
} }), Po = I({ "../../node_modules/aria-query/lib/ariaPropsMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = n(No());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function r(e, t) {
		return c(e) || s(e, t) || a(e, t) || i();
	}
	function i() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function a(e, t) {
		if (e) {
			if (typeof e == "string") return o(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? o(e, t) : void 0;
		}
	}
	function o(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function s(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
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
	function c(e) {
		if (Array.isArray(e)) return e;
	}
	var l = [
		["aria-activedescendant", { type: "id" }],
		["aria-atomic", { type: "boolean" }],
		["aria-autocomplete", {
			type: "token",
			values: [
				"inline",
				"list",
				"both",
				"none"
			]
		}],
		["aria-braillelabel", { type: "string" }],
		["aria-brailleroledescription", { type: "string" }],
		["aria-busy", { type: "boolean" }],
		["aria-checked", { type: "tristate" }],
		["aria-colcount", { type: "integer" }],
		["aria-colindex", { type: "integer" }],
		["aria-colspan", { type: "integer" }],
		["aria-controls", { type: "idlist" }],
		["aria-current", {
			type: "token",
			values: [
				"page",
				"step",
				"location",
				"date",
				"time",
				!0,
				!1
			]
		}],
		["aria-describedby", { type: "idlist" }],
		["aria-description", { type: "string" }],
		["aria-details", { type: "id" }],
		["aria-disabled", { type: "boolean" }],
		["aria-dropeffect", {
			type: "tokenlist",
			values: [
				"copy",
				"execute",
				"link",
				"move",
				"none",
				"popup"
			]
		}],
		["aria-errormessage", { type: "id" }],
		["aria-expanded", {
			type: "boolean",
			allowundefined: !0
		}],
		["aria-flowto", { type: "idlist" }],
		["aria-grabbed", {
			type: "boolean",
			allowundefined: !0
		}],
		["aria-haspopup", {
			type: "token",
			values: [
				!1,
				!0,
				"menu",
				"listbox",
				"tree",
				"grid",
				"dialog"
			]
		}],
		["aria-hidden", {
			type: "boolean",
			allowundefined: !0
		}],
		["aria-invalid", {
			type: "token",
			values: [
				"grammar",
				!1,
				"spelling",
				!0
			]
		}],
		["aria-keyshortcuts", { type: "string" }],
		["aria-label", { type: "string" }],
		["aria-labelledby", { type: "idlist" }],
		["aria-level", { type: "integer" }],
		["aria-live", {
			type: "token",
			values: [
				"assertive",
				"off",
				"polite"
			]
		}],
		["aria-modal", { type: "boolean" }],
		["aria-multiline", { type: "boolean" }],
		["aria-multiselectable", { type: "boolean" }],
		["aria-orientation", {
			type: "token",
			values: [
				"vertical",
				"undefined",
				"horizontal"
			]
		}],
		["aria-owns", { type: "idlist" }],
		["aria-placeholder", { type: "string" }],
		["aria-posinset", { type: "integer" }],
		["aria-pressed", { type: "tristate" }],
		["aria-readonly", { type: "boolean" }],
		["aria-relevant", {
			type: "tokenlist",
			values: [
				"additions",
				"all",
				"removals",
				"text"
			]
		}],
		["aria-required", { type: "boolean" }],
		["aria-roledescription", { type: "string" }],
		["aria-rowcount", { type: "integer" }],
		["aria-rowindex", { type: "integer" }],
		["aria-rowspan", { type: "integer" }],
		["aria-selected", {
			type: "boolean",
			allowundefined: !0
		}],
		["aria-setsize", { type: "integer" }],
		["aria-sort", {
			type: "token",
			values: [
				"ascending",
				"descending",
				"none",
				"other"
			]
		}],
		["aria-valuemax", { type: "number" }],
		["aria-valuemin", { type: "number" }],
		["aria-valuenow", { type: "number" }],
		["aria-valuetext", { type: "string" }]
	], u = {
		entries: function() {
			return l;
		},
		forEach: function(e) {
			for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, i = l; n < i.length; n++) {
				var a = r(i[n], 2), o = a[0], s = a[1];
				e.call(t, s, o, l);
			}
		},
		get: function(e) {
			var t = l.filter(function(t) {
				return t[0] === e;
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!u.get(e);
		},
		keys: function() {
			return l.map(function(e) {
				return r(e, 1)[0];
			});
		},
		values: function() {
			return l.map(function(e) {
				return r(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(u, u.entries());
} }), Fo = I({ "../../node_modules/aria-query/lib/domMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = n(No());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function r(e, t) {
		return c(e) || s(e, t) || a(e, t) || i();
	}
	function i() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function a(e, t) {
		if (e) {
			if (typeof e == "string") return o(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? o(e, t) : void 0;
		}
	}
	function o(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function s(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
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
	function c(e) {
		if (Array.isArray(e)) return e;
	}
	var l = [
		["a", { reserved: !1 }],
		["abbr", { reserved: !1 }],
		["acronym", { reserved: !1 }],
		["address", { reserved: !1 }],
		["applet", { reserved: !1 }],
		["area", { reserved: !1 }],
		["article", { reserved: !1 }],
		["aside", { reserved: !1 }],
		["audio", { reserved: !1 }],
		["b", { reserved: !1 }],
		["base", { reserved: !0 }],
		["bdi", { reserved: !1 }],
		["bdo", { reserved: !1 }],
		["big", { reserved: !1 }],
		["blink", { reserved: !1 }],
		["blockquote", { reserved: !1 }],
		["body", { reserved: !1 }],
		["br", { reserved: !1 }],
		["button", { reserved: !1 }],
		["canvas", { reserved: !1 }],
		["caption", { reserved: !1 }],
		["center", { reserved: !1 }],
		["cite", { reserved: !1 }],
		["code", { reserved: !1 }],
		["col", { reserved: !0 }],
		["colgroup", { reserved: !0 }],
		["content", { reserved: !1 }],
		["data", { reserved: !1 }],
		["datalist", { reserved: !1 }],
		["dd", { reserved: !1 }],
		["del", { reserved: !1 }],
		["details", { reserved: !1 }],
		["dfn", { reserved: !1 }],
		["dialog", { reserved: !1 }],
		["dir", { reserved: !1 }],
		["div", { reserved: !1 }],
		["dl", { reserved: !1 }],
		["dt", { reserved: !1 }],
		["em", { reserved: !1 }],
		["embed", { reserved: !1 }],
		["fieldset", { reserved: !1 }],
		["figcaption", { reserved: !1 }],
		["figure", { reserved: !1 }],
		["font", { reserved: !1 }],
		["footer", { reserved: !1 }],
		["form", { reserved: !1 }],
		["frame", { reserved: !1 }],
		["frameset", { reserved: !1 }],
		["h1", { reserved: !1 }],
		["h2", { reserved: !1 }],
		["h3", { reserved: !1 }],
		["h4", { reserved: !1 }],
		["h5", { reserved: !1 }],
		["h6", { reserved: !1 }],
		["head", { reserved: !0 }],
		["header", { reserved: !1 }],
		["hgroup", { reserved: !1 }],
		["hr", { reserved: !1 }],
		["html", { reserved: !0 }],
		["i", { reserved: !1 }],
		["iframe", { reserved: !1 }],
		["img", { reserved: !1 }],
		["input", { reserved: !1 }],
		["ins", { reserved: !1 }],
		["kbd", { reserved: !1 }],
		["keygen", { reserved: !1 }],
		["label", { reserved: !1 }],
		["legend", { reserved: !1 }],
		["li", { reserved: !1 }],
		["link", { reserved: !0 }],
		["main", { reserved: !1 }],
		["map", { reserved: !1 }],
		["mark", { reserved: !1 }],
		["marquee", { reserved: !1 }],
		["menu", { reserved: !1 }],
		["menuitem", { reserved: !1 }],
		["meta", { reserved: !0 }],
		["meter", { reserved: !1 }],
		["nav", { reserved: !1 }],
		["noembed", { reserved: !0 }],
		["noscript", { reserved: !0 }],
		["object", { reserved: !1 }],
		["ol", { reserved: !1 }],
		["optgroup", { reserved: !1 }],
		["option", { reserved: !1 }],
		["output", { reserved: !1 }],
		["p", { reserved: !1 }],
		["param", { reserved: !0 }],
		["picture", { reserved: !0 }],
		["pre", { reserved: !1 }],
		["progress", { reserved: !1 }],
		["q", { reserved: !1 }],
		["rp", { reserved: !1 }],
		["rt", { reserved: !1 }],
		["rtc", { reserved: !1 }],
		["ruby", { reserved: !1 }],
		["s", { reserved: !1 }],
		["samp", { reserved: !1 }],
		["script", { reserved: !0 }],
		["section", { reserved: !1 }],
		["select", { reserved: !1 }],
		["small", { reserved: !1 }],
		["source", { reserved: !0 }],
		["spacer", { reserved: !1 }],
		["span", { reserved: !1 }],
		["strike", { reserved: !1 }],
		["strong", { reserved: !1 }],
		["style", { reserved: !0 }],
		["sub", { reserved: !1 }],
		["summary", { reserved: !1 }],
		["sup", { reserved: !1 }],
		["table", { reserved: !1 }],
		["tbody", { reserved: !1 }],
		["td", { reserved: !1 }],
		["textarea", { reserved: !1 }],
		["tfoot", { reserved: !1 }],
		["th", { reserved: !1 }],
		["thead", { reserved: !1 }],
		["time", { reserved: !1 }],
		["title", { reserved: !0 }],
		["tr", { reserved: !1 }],
		["track", { reserved: !0 }],
		["tt", { reserved: !1 }],
		["u", { reserved: !1 }],
		["ul", { reserved: !1 }],
		["var", { reserved: !1 }],
		["video", { reserved: !1 }],
		["wbr", { reserved: !1 }],
		["xmp", { reserved: !1 }]
	], u = {
		entries: function() {
			return l;
		},
		forEach: function(e) {
			for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, i = l; n < i.length; n++) {
				var a = r(i[n], 2), o = a[0], s = a[1];
				e.call(t, s, o, l);
			}
		},
		get: function(e) {
			var t = l.filter(function(t) {
				return t[0] === e;
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!u.get(e);
		},
		keys: function() {
			return l.map(function(e) {
				return r(e, 1)[0];
			});
		},
		values: function() {
			return l.map(function(e) {
				return r(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(u, u.entries());
} }), Io = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/commandRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "widget"]]
	};
} }), Lo = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/compositeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-disabled": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "widget"]]
	};
} }), Ro = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/inputRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-disabled": null },
		relatedConcepts: [{
			concept: { name: "input" },
			module: "XForms"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "widget"]]
	};
} }), zo = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/landmarkRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Bo = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/rangeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-valuemax": null,
			"aria-valuemin": null,
			"aria-valuenow": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), Vo = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/roletypeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {
			"aria-atomic": null,
			"aria-busy": null,
			"aria-controls": null,
			"aria-current": null,
			"aria-describedby": null,
			"aria-details": null,
			"aria-dropeffect": null,
			"aria-flowto": null,
			"aria-grabbed": null,
			"aria-hidden": null,
			"aria-keyshortcuts": null,
			"aria-label": null,
			"aria-labelledby": null,
			"aria-live": null,
			"aria-owns": null,
			"aria-relevant": null,
			"aria-roledescription": null
		},
		relatedConcepts: [{
			concept: { name: "role" },
			module: "XHTML"
		}, {
			concept: { name: "type" },
			module: "Dublin Core"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: []
	};
} }), Ho = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/sectionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: { name: "frontmatter" },
				module: "DTB"
			},
			{
				concept: { name: "level" },
				module: "DTB"
			},
			{
				concept: { name: "level" },
				module: "SMIL"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), Uo = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/sectionheadRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), Wo = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/selectRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-orientation": null },
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite"
		], [
			"roletype",
			"structure",
			"section",
			"group"
		]]
	};
} }), Go = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/structureRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype"]]
	};
} }), Ko = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/widgetRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype"]]
	};
} }), qo = I({ "../../node_modules/aria-query/lib/etc/roles/abstract/windowRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-modal": null },
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype"]]
	};
} }), Jo = I({ "../../node_modules/aria-query/lib/etc/roles/ariaAbstractRoles.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = p(Io()), n = p(Lo()), r = p(Ro()), i = p(zo()), a = p(Bo()), o = p(Vo()), s = p(Ho()), c = p(Uo()), l = p(Wo()), u = p(Go()), d = p(Ko()), f = p(qo());
	function p(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["command", t.default],
		["composite", n.default],
		["input", r.default],
		["landmark", i.default],
		["range", a.default],
		["roletype", o.default],
		["section", s.default],
		["sectionhead", c.default],
		["select", l.default],
		["structure", u.default],
		["widget", d.default],
		["window", f.default]
	];
} }), Yo = I({ "../../node_modules/aria-query/lib/etc/roles/literal/alertRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-atomic": "true",
			"aria-live": "assertive"
		},
		relatedConcepts: [{
			concept: { name: "alert" },
			module: "XForms"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Xo = I({ "../../node_modules/aria-query/lib/etc/roles/literal/alertdialogRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "alert" },
			module: "XForms"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"alert"
		], [
			"roletype",
			"window",
			"dialog"
		]]
	};
} }), Zo = I({ "../../node_modules/aria-query/lib/etc/roles/literal/applicationRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{ concept: { name: "Device Independence Delivery Unit" } }],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), Qo = I({ "../../node_modules/aria-query/lib/etc/roles/literal/articleRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-posinset": null,
			"aria-setsize": null
		},
		relatedConcepts: [{
			concept: { name: "article" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"document"
		]]
	};
} }), $o = I({ "../../node_modules/aria-query/lib/etc/roles/literal/bannerRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: {
				constraints: ["scoped to the body element"],
				name: "header"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), es = I({ "../../node_modules/aria-query/lib/etc/roles/literal/blockquoteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "blockquote" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), ts = I({ "../../node_modules/aria-query/lib/etc/roles/literal/buttonRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-pressed": null
		},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						name: "type",
						value: "button"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "type",
						value: "image"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "type",
						value: "reset"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "type",
						value: "submit"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: { name: "button" },
				module: "HTML"
			},
			{
				concept: { name: "trigger" },
				module: "XForms"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command"
		]]
	};
} }), ns = I({ "../../node_modules/aria-query/lib/etc/roles/literal/captionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "caption" },
			module: "HTML"
		}],
		requireContextRole: [
			"figure",
			"grid",
			"table"
		],
		requiredContextRole: [
			"figure",
			"grid",
			"table"
		],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), rs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/cellRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-colindex": null,
			"aria-colspan": null,
			"aria-rowindex": null,
			"aria-rowspan": null
		},
		relatedConcepts: [{
			concept: {
				constraints: ["ancestor table element has table role"],
				name: "td"
			},
			module: "HTML"
		}],
		requireContextRole: ["row"],
		requiredContextRole: ["row"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), is = I({ "../../node_modules/aria-query/lib/etc/roles/literal/checkboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-checked": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "type",
					value: "checkbox"
				}],
				name: "input"
			},
			module: "HTML"
		}, {
			concept: { name: "option" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), as = I({ "../../node_modules/aria-query/lib/etc/roles/literal/codeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "code" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), os = I({ "../../node_modules/aria-query/lib/etc/roles/literal/columnheaderRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: { "aria-sort": null },
		relatedConcepts: [
			{
				concept: { name: "th" },
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "scope",
						value: "col"
					}],
					name: "th"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "scope",
						value: "colgroup"
					}],
					name: "th"
				},
				module: "HTML"
			}
		],
		requireContextRole: ["row"],
		requiredContextRole: ["row"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [
			[
				"roletype",
				"structure",
				"section",
				"cell"
			],
			[
				"roletype",
				"structure",
				"section",
				"cell",
				"gridcell"
			],
			[
				"roletype",
				"widget",
				"gridcell"
			],
			[
				"roletype",
				"structure",
				"sectionhead"
			]
		]
	};
} }), ss = I({ "../../node_modules/aria-query/lib/etc/roles/literal/comboboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-autocomplete": null,
			"aria-errormessage": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null,
			"aria-expanded": "false",
			"aria-haspopup": "listbox"
		},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "email"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "search"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "tel"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "text"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "url"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "url"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "multiple"
					}, {
						constraints: ["undefined"],
						name: "size"
					}],
					constraints: ["the multiple attribute is not set and the size attribute does not have a value greater than 1"],
					name: "select"
				},
				module: "HTML"
			},
			{
				concept: { name: "select" },
				module: "XForms"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {
			"aria-controls": null,
			"aria-expanded": "false"
		},
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), cs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/complementaryRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: {
					constraints: ["scoped to the body element", "scoped to the main element"],
					name: "aside"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-label"
					}],
					constraints: ["scoped to a sectioning content element", "scoped to a sectioning root element other than body"],
					name: "aside"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-labelledby"
					}],
					constraints: ["scoped to a sectioning content element", "scoped to a sectioning root element other than body"],
					name: "aside"
				},
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), ls = I({ "../../node_modules/aria-query/lib/etc/roles/literal/contentinfoRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: {
				constraints: ["scoped to the body element"],
				name: "footer"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), us = I({ "../../node_modules/aria-query/lib/etc/roles/literal/definitionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "dd" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), ds = I({ "../../node_modules/aria-query/lib/etc/roles/literal/deletionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "del" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), fs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/dialogRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "dialog" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "window"]]
	};
} }), ps = I({ "../../node_modules/aria-query/lib/etc/roles/literal/directoryRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{ module: "DAISY Guide" }],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"list"
		]]
	};
} }), ms = I({ "../../node_modules/aria-query/lib/etc/roles/literal/documentRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{ concept: { name: "Device Independence Delivery Unit" } }, {
			concept: { name: "html" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), hs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/emphasisRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "em" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), gs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/feedRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["article"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"list"
		]]
	};
} }), _s = I({ "../../node_modules/aria-query/lib/etc/roles/literal/figureRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "figure" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), vs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/formRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-label"
					}],
					name: "form"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-labelledby"
					}],
					name: "form"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "name"
					}],
					name: "form"
				},
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), ys = I({ "../../node_modules/aria-query/lib/etc/roles/literal/genericRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [
			{
				concept: { name: "a" },
				module: "HTML"
			},
			{
				concept: { name: "area" },
				module: "HTML"
			},
			{
				concept: { name: "aside" },
				module: "HTML"
			},
			{
				concept: { name: "b" },
				module: "HTML"
			},
			{
				concept: { name: "bdo" },
				module: "HTML"
			},
			{
				concept: { name: "body" },
				module: "HTML"
			},
			{
				concept: { name: "data" },
				module: "HTML"
			},
			{
				concept: { name: "div" },
				module: "HTML"
			},
			{
				concept: {
					constraints: [
						"scoped to the main element",
						"scoped to a sectioning content element",
						"scoped to a sectioning root element other than body"
					],
					name: "footer"
				},
				module: "HTML"
			},
			{
				concept: {
					constraints: [
						"scoped to the main element",
						"scoped to a sectioning content element",
						"scoped to a sectioning root element other than body"
					],
					name: "header"
				},
				module: "HTML"
			},
			{
				concept: { name: "hgroup" },
				module: "HTML"
			},
			{
				concept: { name: "i" },
				module: "HTML"
			},
			{
				concept: { name: "pre" },
				module: "HTML"
			},
			{
				concept: { name: "q" },
				module: "HTML"
			},
			{
				concept: { name: "samp" },
				module: "HTML"
			},
			{
				concept: { name: "section" },
				module: "HTML"
			},
			{
				concept: { name: "small" },
				module: "HTML"
			},
			{
				concept: { name: "span" },
				module: "HTML"
			},
			{
				concept: { name: "u" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), bs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/gridRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-multiselectable": null,
			"aria-readonly": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["row"], ["row", "rowgroup"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite"
		], [
			"roletype",
			"structure",
			"section",
			"table"
		]]
	};
} }), xs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/gridcellRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null,
			"aria-selected": null
		},
		relatedConcepts: [{
			concept: {
				constraints: ["ancestor table element has grid role", "ancestor table element has treegrid role"],
				name: "td"
			},
			module: "HTML"
		}],
		requireContextRole: ["row"],
		requiredContextRole: ["row"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"cell"
		], ["roletype", "widget"]]
	};
} }), Ss = I({ "../../node_modules/aria-query/lib/etc/roles/literal/groupRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-disabled": null
		},
		relatedConcepts: [
			{
				concept: { name: "details" },
				module: "HTML"
			},
			{
				concept: { name: "fieldset" },
				module: "HTML"
			},
			{
				concept: { name: "optgroup" },
				module: "HTML"
			},
			{
				concept: { name: "address" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Cs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/headingRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: { "aria-level": "2" },
		relatedConcepts: [
			{
				concept: { name: "h1" },
				module: "HTML"
			},
			{
				concept: { name: "h2" },
				module: "HTML"
			},
			{
				concept: { name: "h3" },
				module: "HTML"
			},
			{
				concept: { name: "h4" },
				module: "HTML"
			},
			{
				concept: { name: "h5" },
				module: "HTML"
			},
			{
				concept: { name: "h6" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-level": "2" },
		superClass: [[
			"roletype",
			"structure",
			"sectionhead"
		]]
	};
} }), ws = I({ "../../node_modules/aria-query/lib/etc/roles/literal/imgRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "alt"
					}],
					name: "img"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "alt"
					}],
					name: "img"
				},
				module: "HTML"
			},
			{
				concept: { name: "imggroup" },
				module: "DTB"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ts = I({ "../../node_modules/aria-query/lib/etc/roles/literal/insertionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "ins" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Es = I({ "../../node_modules/aria-query/lib/etc/roles/literal/linkRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-expanded": null,
			"aria-haspopup": null
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					constraints: ["set"],
					name: "href"
				}],
				name: "a"
			},
			module: "HTML"
		}, {
			concept: {
				attributes: [{
					constraints: ["set"],
					name: "href"
				}],
				name: "area"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command"
		]]
	};
} }), Ds = I({ "../../node_modules/aria-query/lib/etc/roles/literal/listRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: { name: "menu" },
				module: "HTML"
			},
			{
				concept: { name: "ol" },
				module: "HTML"
			},
			{
				concept: { name: "ul" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["listitem"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Os = I({ "../../node_modules/aria-query/lib/etc/roles/literal/listboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-invalid": null,
			"aria-multiselectable": null,
			"aria-readonly": null,
			"aria-required": null,
			"aria-orientation": "vertical"
		},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: [">1"],
						name: "size"
					}],
					constraints: ["the size attribute value is greater than 1"],
					name: "select"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{ name: "multiple" }],
					name: "select"
				},
				module: "HTML"
			},
			{
				concept: { name: "datalist" },
				module: "HTML"
			},
			{
				concept: { name: "list" },
				module: "ARIA"
			},
			{
				concept: { name: "select" },
				module: "XForms"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["option", "group"], ["option"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select"
		]]
	};
} }), ks = I({ "../../node_modules/aria-query/lib/etc/roles/literal/listitemRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-level": null,
			"aria-posinset": null,
			"aria-setsize": null
		},
		relatedConcepts: [{
			concept: {
				constraints: [
					"direct descendant of ol",
					"direct descendant of ul",
					"direct descendant of menu"
				],
				name: "li"
			},
			module: "HTML"
		}, {
			concept: { name: "item" },
			module: "XForms"
		}],
		requireContextRole: ["directory", "list"],
		requiredContextRole: ["directory", "list"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), As = I({ "../../node_modules/aria-query/lib/etc/roles/literal/logRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-live": "polite" },
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), js = I({ "../../node_modules/aria-query/lib/etc/roles/literal/mainRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "main" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Ms = I({ "../../node_modules/aria-query/lib/etc/roles/literal/markRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: [],
		props: {
			"aria-braillelabel": null,
			"aria-brailleroledescription": null,
			"aria-description": null
		},
		relatedConcepts: [{
			concept: { name: "mark" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ns = I({ "../../node_modules/aria-query/lib/etc/roles/literal/marqueeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ps = I({ "../../node_modules/aria-query/lib/etc/roles/literal/mathRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "math" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Fs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/menuRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-orientation": "vertical" },
		relatedConcepts: [
			{
				concept: { name: "MENU" },
				module: "JAPI"
			},
			{
				concept: { name: "list" },
				module: "ARIA"
			},
			{
				concept: { name: "select" },
				module: "XForms"
			},
			{
				concept: { name: "sidebar" },
				module: "DTB"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [
			["menuitem", "group"],
			["menuitemradio", "group"],
			["menuitemcheckbox", "group"],
			["menuitem"],
			["menuitemcheckbox"],
			["menuitemradio"]
		],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select"
		]]
	};
} }), Is = I({ "../../node_modules/aria-query/lib/etc/roles/literal/menubarRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-orientation": "horizontal" },
		relatedConcepts: [{
			concept: { name: "toolbar" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [
			["menuitem", "group"],
			["menuitemradio", "group"],
			["menuitemcheckbox", "group"],
			["menuitem"],
			["menuitemcheckbox"],
			["menuitemradio"]
		],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select",
			"menu"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select",
			"menu"
		]]
	};
} }), Ls = I({ "../../node_modules/aria-query/lib/etc/roles/literal/menuitemRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-posinset": null,
			"aria-setsize": null
		},
		relatedConcepts: [
			{
				concept: { name: "MENU_ITEM" },
				module: "JAPI"
			},
			{
				concept: { name: "listitem" },
				module: "ARIA"
			},
			{
				concept: { name: "option" },
				module: "ARIA"
			}
		],
		requireContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command"
		]]
	};
} }), Rs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/menuitemcheckboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "menuitem" },
			module: "ARIA"
		}],
		requireContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [[
			"roletype",
			"widget",
			"input",
			"checkbox"
		], [
			"roletype",
			"widget",
			"command",
			"menuitem"
		]]
	};
} }), zs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/menuitemradioRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "menuitem" },
			module: "ARIA"
		}],
		requireContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [
			[
				"roletype",
				"widget",
				"input",
				"checkbox",
				"menuitemcheckbox"
			],
			[
				"roletype",
				"widget",
				"command",
				"menuitem",
				"menuitemcheckbox"
			],
			[
				"roletype",
				"widget",
				"input",
				"radio"
			]
		]
	};
} }), Bs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/meterRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-valuetext": null,
			"aria-valuemax": "100",
			"aria-valuemin": "0"
		},
		relatedConcepts: [{
			concept: { name: "meter" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-valuenow": null },
		superClass: [[
			"roletype",
			"structure",
			"range"
		]]
	};
} }), Vs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/navigationRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "nav" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Hs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/noneRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: []
	};
} }), Us = I({ "../../node_modules/aria-query/lib/etc/roles/literal/noteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ws = I({ "../../node_modules/aria-query/lib/etc/roles/literal/optionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-checked": null,
			"aria-posinset": null,
			"aria-setsize": null,
			"aria-selected": "false"
		},
		relatedConcepts: [
			{
				concept: { name: "item" },
				module: "XForms"
			},
			{
				concept: { name: "listitem" },
				module: "ARIA"
			},
			{
				concept: { name: "option" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-selected": "false" },
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), Gs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/paragraphRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "p" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ks = I({ "../../node_modules/aria-query/lib/etc/roles/literal/presentationRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "alt",
					value: ""
				}],
				name: "img"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), qs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/progressbarRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-valuetext": null },
		relatedConcepts: [{
			concept: { name: "progress" },
			module: "HTML"
		}, {
			concept: { name: "status" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"range"
		], ["roletype", "widget"]]
	};
} }), Js = I({ "../../node_modules/aria-query/lib/etc/roles/literal/radioRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-checked": null,
			"aria-posinset": null,
			"aria-setsize": null
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "type",
					value: "radio"
				}],
				name: "input"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), Ys = I({ "../../node_modules/aria-query/lib/etc/roles/literal/radiogroupRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null
		},
		relatedConcepts: [{
			concept: { name: "list" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["radio"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select"
		]]
	};
} }), Xs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/regionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-label"
					}],
					name: "section"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-labelledby"
					}],
					name: "section"
				},
				module: "HTML"
			},
			{ concept: { name: "Device Independence Glossart perceivable unit" } }
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Zs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/rowRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-colindex": null,
			"aria-expanded": null,
			"aria-level": null,
			"aria-posinset": null,
			"aria-rowindex": null,
			"aria-selected": null,
			"aria-setsize": null
		},
		relatedConcepts: [{
			concept: { name: "tr" },
			module: "HTML"
		}],
		requireContextRole: [
			"grid",
			"rowgroup",
			"table",
			"treegrid"
		],
		requiredContextRole: [
			"grid",
			"rowgroup",
			"table",
			"treegrid"
		],
		requiredOwnedElements: [
			["cell"],
			["columnheader"],
			["gridcell"],
			["rowheader"]
		],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"group"
		], ["roletype", "widget"]]
	};
} }), Qs = I({ "../../node_modules/aria-query/lib/etc/roles/literal/rowgroupRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: { name: "tbody" },
				module: "HTML"
			},
			{
				concept: { name: "tfoot" },
				module: "HTML"
			},
			{
				concept: { name: "thead" },
				module: "HTML"
			}
		],
		requireContextRole: [
			"grid",
			"table",
			"treegrid"
		],
		requiredContextRole: [
			"grid",
			"table",
			"treegrid"
		],
		requiredOwnedElements: [["row"]],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), $s = I({ "../../node_modules/aria-query/lib/etc/roles/literal/rowheaderRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: { "aria-sort": null },
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "scope",
					value: "row"
				}],
				name: "th"
			},
			module: "HTML"
		}, {
			concept: {
				attributes: [{
					name: "scope",
					value: "rowgroup"
				}],
				name: "th"
			},
			module: "HTML"
		}],
		requireContextRole: ["row", "rowgroup"],
		requiredContextRole: ["row", "rowgroup"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [
			[
				"roletype",
				"structure",
				"section",
				"cell"
			],
			[
				"roletype",
				"structure",
				"section",
				"cell",
				"gridcell"
			],
			[
				"roletype",
				"widget",
				"gridcell"
			],
			[
				"roletype",
				"structure",
				"sectionhead"
			]
		]
	};
} }), ec = I({ "../../node_modules/aria-query/lib/etc/roles/literal/scrollbarRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-valuetext": null,
			"aria-orientation": "vertical",
			"aria-valuemax": "100",
			"aria-valuemin": "0"
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {
			"aria-controls": null,
			"aria-valuenow": null
		},
		superClass: [[
			"roletype",
			"structure",
			"range"
		], ["roletype", "widget"]]
	};
} }), tc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/searchRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), nc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/searchboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: {
				attributes: [{
					constraints: ["undefined"],
					name: "list"
				}, {
					name: "type",
					value: "search"
				}],
				constraints: ["the list attribute is not set"],
				name: "input"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"input",
			"textbox"
		]]
	};
} }), rc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/separatorRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-orientation": "horizontal",
			"aria-valuemax": "100",
			"aria-valuemin": "0",
			"aria-valuenow": null,
			"aria-valuetext": null
		},
		relatedConcepts: [{
			concept: { name: "hr" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), ic = I({ "../../node_modules/aria-query/lib/etc/roles/literal/sliderRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-haspopup": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-valuetext": null,
			"aria-orientation": "horizontal",
			"aria-valuemax": "100",
			"aria-valuemin": "0"
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "type",
					value: "range"
				}],
				name: "input"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-valuenow": null },
		superClass: [[
			"roletype",
			"widget",
			"input"
		], [
			"roletype",
			"structure",
			"range"
		]]
	};
} }), ac = I({ "../../node_modules/aria-query/lib/etc/roles/literal/spinbuttonRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null,
			"aria-valuetext": null,
			"aria-valuenow": "0"
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "type",
					value: "number"
				}],
				name: "input"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [
			[
				"roletype",
				"widget",
				"composite"
			],
			[
				"roletype",
				"widget",
				"input"
			],
			[
				"roletype",
				"structure",
				"range"
			]
		]
	};
} }), oc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/statusRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-atomic": "true",
			"aria-live": "polite"
		},
		relatedConcepts: [{
			concept: { name: "output" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), sc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/strongRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "strong" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), cc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/subscriptRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "sub" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), lc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/superscriptRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "sup" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), uc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/switchRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "button" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [[
			"roletype",
			"widget",
			"input",
			"checkbox"
		]]
	};
} }), dc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/tabRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-posinset": null,
			"aria-setsize": null,
			"aria-selected": "false"
		},
		relatedConcepts: [],
		requireContextRole: ["tablist"],
		requiredContextRole: ["tablist"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"sectionhead"
		], ["roletype", "widget"]]
	};
} }), fc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/tableRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-colcount": null,
			"aria-rowcount": null
		},
		relatedConcepts: [{
			concept: { name: "table" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["row"], ["row", "rowgroup"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), pc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/tablistRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-level": null,
			"aria-multiselectable": null,
			"aria-orientation": "horizontal"
		},
		relatedConcepts: [{
			module: "DAISY",
			concept: { name: "guide" }
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["tab"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite"
		]]
	};
} }), mc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/tabpanelRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), hc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/termRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "dfn" },
			module: "HTML"
		}, {
			concept: { name: "dt" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), gc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/textboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-autocomplete": null,
			"aria-errormessage": null,
			"aria-haspopup": null,
			"aria-invalid": null,
			"aria-multiline": null,
			"aria-placeholder": null,
			"aria-readonly": null,
			"aria-required": null
		},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "type"
					}, {
						constraints: ["undefined"],
						name: "list"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "list"
					}, {
						name: "type",
						value: "email"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "list"
					}, {
						name: "type",
						value: "tel"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "list"
					}, {
						name: "type",
						value: "text"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "list"
					}, {
						name: "type",
						value: "url"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: { name: "input" },
				module: "XForms"
			},
			{
				concept: { name: "textarea" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), _c = I({ "../../node_modules/aria-query/lib/etc/roles/literal/timeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "time" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), vc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/timerRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"status"
		]]
	};
} }), yc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/toolbarRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-orientation": "horizontal" },
		relatedConcepts: [{
			concept: { name: "menubar" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"group"
		]]
	};
} }), bc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/tooltipRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), xc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/treeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null,
			"aria-multiselectable": null,
			"aria-required": null,
			"aria-orientation": "vertical"
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["treeitem", "group"], ["treeitem"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select"
		]]
	};
} }), Sc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/treegridRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["row"], ["row", "rowgroup"]],
		requiredProps: {},
		superClass: [
			[
				"roletype",
				"widget",
				"composite",
				"grid"
			],
			[
				"roletype",
				"structure",
				"section",
				"table",
				"grid"
			],
			[
				"roletype",
				"widget",
				"composite",
				"select",
				"tree"
			],
			[
				"roletype",
				"structure",
				"section",
				"group",
				"select",
				"tree"
			]
		]
	};
} }), Cc = I({ "../../node_modules/aria-query/lib/etc/roles/literal/treeitemRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-expanded": null,
			"aria-haspopup": null
		},
		relatedConcepts: [],
		requireContextRole: ["group", "tree"],
		requiredContextRole: ["group", "tree"],
		requiredOwnedElements: [],
		requiredProps: { "aria-selected": null },
		superClass: [[
			"roletype",
			"structure",
			"section",
			"listitem"
		], [
			"roletype",
			"widget",
			"input",
			"option"
		]]
	};
} }), wc = I({ "../../node_modules/aria-query/lib/etc/roles/ariaLiteralRoles.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = j(Yo()), n = j(Xo()), r = j(Zo()), i = j(Qo()), a = j($o()), o = j(es()), s = j(ts()), c = j(ns()), l = j(rs()), u = j(is()), d = j(as()), f = j(os()), p = j(ss()), m = j(cs()), h = j(ls()), g = j(us()), _ = j(ds()), v = j(fs()), y = j(ps()), b = j(ms()), x = j(hs()), ee = j(gs()), te = j(_s()), S = j(vs()), C = j(ys()), ne = j(bs()), w = j(xs()), re = j(Ss()), ie = j(Cs()), T = j(ws()), ae = j(Ts()), E = j(Es()), oe = j(Ds()), D = j(Os()), se = j(ks()), ce = j(As()), le = j(js()), ue = j(Ms()), de = j(Ns()), fe = j(Ps()), pe = j(Fs()), O = j(Is()), me = j(Ls()), he = j(Rs()), ge = j(zs()), _e = j(Bs()), ve = j(Vs()), ye = j(Hs()), be = j(Us()), xe = j(Ws()), Se = j(Gs()), Ce = j(Ks()), we = j(qs()), Te = j(Js()), Ee = j(Ys()), De = j(Xs()), Oe = j(Zs()), ke = j(Qs()), Ae = j($s()), je = j(ec()), Me = j(tc()), Ne = j(nc()), Pe = j(rc()), k = j(ic()), Fe = j(ac()), Ie = j(oc()), Le = j(sc()), Re = j(cc()), ze = j(lc()), Be = j(uc()), Ve = j(dc()), A = j(fc()), He = j(pc()), Ue = j(mc()), We = j(hc()), Ge = j(gc()), Ke = j(_c()), qe = j(vc()), Je = j(yc()), Ye = j(bc()), Xe = j(xc()), Ze = j(Sc()), Qe = j(Cc());
	function j(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["alert", t.default],
		["alertdialog", n.default],
		["application", r.default],
		["article", i.default],
		["banner", a.default],
		["blockquote", o.default],
		["button", s.default],
		["caption", c.default],
		["cell", l.default],
		["checkbox", u.default],
		["code", d.default],
		["columnheader", f.default],
		["combobox", p.default],
		["complementary", m.default],
		["contentinfo", h.default],
		["definition", g.default],
		["deletion", _.default],
		["dialog", v.default],
		["directory", y.default],
		["document", b.default],
		["emphasis", x.default],
		["feed", ee.default],
		["figure", te.default],
		["form", S.default],
		["generic", C.default],
		["grid", ne.default],
		["gridcell", w.default],
		["group", re.default],
		["heading", ie.default],
		["img", T.default],
		["insertion", ae.default],
		["link", E.default],
		["list", oe.default],
		["listbox", D.default],
		["listitem", se.default],
		["log", ce.default],
		["main", le.default],
		["mark", ue.default],
		["marquee", de.default],
		["math", fe.default],
		["menu", pe.default],
		["menubar", O.default],
		["menuitem", me.default],
		["menuitemcheckbox", he.default],
		["menuitemradio", ge.default],
		["meter", _e.default],
		["navigation", ve.default],
		["none", ye.default],
		["note", be.default],
		["option", xe.default],
		["paragraph", Se.default],
		["presentation", Ce.default],
		["progressbar", we.default],
		["radio", Te.default],
		["radiogroup", Ee.default],
		["region", De.default],
		["row", Oe.default],
		["rowgroup", ke.default],
		["rowheader", Ae.default],
		["scrollbar", je.default],
		["search", Me.default],
		["searchbox", Ne.default],
		["separator", Pe.default],
		["slider", k.default],
		["spinbutton", Fe.default],
		["status", Ie.default],
		["strong", Le.default],
		["subscript", Re.default],
		["superscript", ze.default],
		["switch", Be.default],
		["tab", Ve.default],
		["table", A.default],
		["tablist", He.default],
		["tabpanel", Ue.default],
		["term", We.default],
		["textbox", Ge.default],
		["time", Ke.default],
		["timer", qe.default],
		["toolbar", Je.default],
		["tooltip", Ye.default],
		["tree", Xe.default],
		["treegrid", Ze.default],
		["treeitem", Qe.default]
	];
} }), Tc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docAbstractRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "abstract [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ec = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docAcknowledgmentsRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "acknowledgments [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Dc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docAfterwordRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "afterword [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Oc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docAppendixRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "appendix [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), kc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docBacklinkRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "referrer [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command",
			"link"
		]]
	};
} }), Ac = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docBiblioentryRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "EPUB biblioentry [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: ["doc-bibliography"],
		requiredContextRole: ["doc-bibliography"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"listitem"
		]]
	};
} }), jc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docBibliographyRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "bibliography [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["doc-biblioentry"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Mc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docBibliorefRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "biblioref [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command",
			"link"
		]]
	};
} }), Nc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docChapterRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "chapter [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Pc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docColophonRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "colophon [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Fc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docConclusionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "conclusion [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Ic = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docCoverRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "cover [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"img"
		]]
	};
} }), Lc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docCreditRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "credit [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Rc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docCreditsRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "credits [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), zc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docDedicationRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "dedication [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Bc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docEndnoteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "rearnote [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: ["doc-endnotes"],
		requiredContextRole: ["doc-endnotes"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"listitem"
		]]
	};
} }), Vc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docEndnotesRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "rearnotes [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["doc-endnote"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Hc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docEpigraphRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "epigraph [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Uc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docEpilogueRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "epilogue [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Wc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docErrataRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "errata [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Gc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docExampleRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Kc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docFootnoteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "footnote [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), qc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docForewordRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "foreword [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Jc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docGlossaryRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "glossary [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["definition"], ["term"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Yc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docGlossrefRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "glossref [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command",
			"link"
		]]
	};
} }), Xc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docIndexRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "index [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark",
			"navigation"
		]]
	};
} }), Zc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docIntroductionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "introduction [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Qc = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docNoterefRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "noteref [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command",
			"link"
		]]
	};
} }), $c = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docNoticeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "notice [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"note"
		]]
	};
} }), el = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPagebreakRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "pagebreak [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"separator"
		]]
	};
} }), tl = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPagefooterRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: [],
		props: {
			"aria-braillelabel": null,
			"aria-brailleroledescription": null,
			"aria-description": null,
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), nl = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPageheaderRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: [],
		props: {
			"aria-braillelabel": null,
			"aria-brailleroledescription": null,
			"aria-description": null,
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), rl = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPagelistRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "page-list [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark",
			"navigation"
		]]
	};
} }), il = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPartRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "part [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), al = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPrefaceRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "preface [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), ol = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPrologueRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "prologue [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), sl = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPullquoteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "pullquote [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["none"]]
	};
} }), cl = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docQnaRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "qna [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), ll = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docSubtitleRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "subtitle [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"sectionhead"
		]]
	};
} }), ul = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docTipRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "help [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"note"
		]]
	};
} }), dl = I({ "../../node_modules/aria-query/lib/etc/roles/dpub/docTocRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "toc [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark",
			"navigation"
		]]
	};
} }), fl = I({ "../../node_modules/aria-query/lib/etc/roles/ariaDpubRoles.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = O(Tc()), n = O(Ec()), r = O(Dc()), i = O(Oc()), a = O(kc()), o = O(Ac()), s = O(jc()), c = O(Mc()), l = O(Nc()), u = O(Pc()), d = O(Fc()), f = O(Ic()), p = O(Lc()), m = O(Rc()), h = O(zc()), g = O(Bc()), _ = O(Vc()), v = O(Hc()), y = O(Uc()), b = O(Wc()), x = O(Gc()), ee = O(Kc()), te = O(qc()), S = O(Jc()), C = O(Yc()), ne = O(Xc()), w = O(Zc()), re = O(Qc()), ie = O($c()), T = O(el()), ae = O(tl()), E = O(nl()), oe = O(rl()), D = O(il()), se = O(al()), ce = O(ol()), le = O(sl()), ue = O(cl()), de = O(ll()), fe = O(ul()), pe = O(dl());
	function O(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["doc-abstract", t.default],
		["doc-acknowledgments", n.default],
		["doc-afterword", r.default],
		["doc-appendix", i.default],
		["doc-backlink", a.default],
		["doc-biblioentry", o.default],
		["doc-bibliography", s.default],
		["doc-biblioref", c.default],
		["doc-chapter", l.default],
		["doc-colophon", u.default],
		["doc-conclusion", d.default],
		["doc-cover", f.default],
		["doc-credit", p.default],
		["doc-credits", m.default],
		["doc-dedication", h.default],
		["doc-endnote", g.default],
		["doc-endnotes", _.default],
		["doc-epigraph", v.default],
		["doc-epilogue", y.default],
		["doc-errata", b.default],
		["doc-example", x.default],
		["doc-footnote", ee.default],
		["doc-foreword", te.default],
		["doc-glossary", S.default],
		["doc-glossref", C.default],
		["doc-index", ne.default],
		["doc-introduction", w.default],
		["doc-noteref", re.default],
		["doc-notice", ie.default],
		["doc-pagebreak", T.default],
		["doc-pagefooter", ae.default],
		["doc-pageheader", E.default],
		["doc-pagelist", oe.default],
		["doc-part", D.default],
		["doc-preface", se.default],
		["doc-prologue", ce.default],
		["doc-pullquote", le.default],
		["doc-qna", ue.default],
		["doc-subtitle", de.default],
		["doc-tip", fe.default],
		["doc-toc", pe.default]
	];
} }), pl = I({ "../../node_modules/aria-query/lib/etc/roles/graphics/graphicsDocumentRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [
			{
				module: "GRAPHICS",
				concept: { name: "graphics-object" }
			},
			{
				module: "ARIA",
				concept: { name: "img" }
			},
			{
				module: "ARIA",
				concept: { name: "article" }
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"document"
		]]
	};
} }), ml = I({ "../../node_modules/aria-query/lib/etc/roles/graphics/graphicsObjectRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [
			{
				module: "GRAPHICS",
				concept: { name: "graphics-document" }
			},
			{
				module: "ARIA",
				concept: { name: "group" }
			},
			{
				module: "ARIA",
				concept: { name: "img" }
			},
			{
				module: "GRAPHICS",
				concept: { name: "graphics-symbol" }
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"group"
		]]
	};
} }), hl = I({ "../../node_modules/aria-query/lib/etc/roles/graphics/graphicsSymbolRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"img"
		]]
	};
} }), gl = I({ "../../node_modules/aria-query/lib/etc/roles/ariaGraphicsRoles.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = i(pl()), n = i(ml()), r = i(hl());
	function i(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["graphics-document", t.default],
		["graphics-object", n.default],
		["graphics-symbol", r.default]
	];
} }), _l = I({ "../../node_modules/aria-query/lib/rolesMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = o(Jo()), n = o(wc()), r = o(fl()), i = o(gl()), a = o(No());
	function o(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function s(e, t) {
		var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (!n) {
			if (Array.isArray(e) || (n = u(e)) || t && e && typeof e.length == "number") {
				n && (e = n);
				var r = 0, i = function() {};
				return {
					s: i,
					n: function() {
						return r >= e.length ? { done: !0 } : {
							done: !1,
							value: e[r++]
						};
					},
					e: function(e) {
						throw e;
					},
					f: i
				};
			}
			throw TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
		}
		var a, o = !0, s = !1;
		return {
			s: function() {
				n = n.call(e);
			},
			n: function() {
				var e = n.next();
				return o = e.done, e;
			},
			e: function(e) {
				s = !0, a = e;
			},
			f: function() {
				try {
					o || n.return == null || n.return();
				} finally {
					if (s) throw a;
				}
			}
		};
	}
	function c(e, t) {
		return p(e) || f(e, t) || u(e, t) || l();
	}
	function l() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function u(e, t) {
		if (e) {
			if (typeof e == "string") return d(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? d(e, t) : void 0;
		}
	}
	function d(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function f(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
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
	function p(e) {
		if (Array.isArray(e)) return e;
	}
	var m = [].concat(t.default, n.default, r.default, i.default);
	m.forEach(function(e) {
		var t = c(e, 2)[1], n = s(t.superClass), r;
		try {
			for (n.s(); !(r = n.n()).done;) {
				var i = r.value, a = s(i), o;
				try {
					var l = function() {
						var e = o.value, n = m.filter(function(t) {
							return c(t, 1)[0] === e;
						})[0];
						if (n) for (var r = n[1], i = 0, a = Object.keys(r.props); i < a.length; i++) {
							var s = a[i];
							Object.prototype.hasOwnProperty.call(t.props, s) || (t.props[s] = r.props[s]);
						}
					};
					for (a.s(); !(o = a.n()).done;) l();
				} catch (e) {
					a.e(e);
				} finally {
					a.f();
				}
			}
		} catch (e) {
			n.e(e);
		} finally {
			n.f();
		}
	});
	var h = {
		entries: function() {
			return m;
		},
		forEach: function(e) {
			var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = s(m), r;
			try {
				for (n.s(); !(r = n.n()).done;) {
					var i = c(r.value, 2), a = i[0], o = i[1];
					e.call(t, o, a, m);
				}
			} catch (e) {
				n.e(e);
			} finally {
				n.f();
			}
		},
		get: function(e) {
			var t = m.filter(function(t) {
				return t[0] === e;
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!h.get(e);
		},
		keys: function() {
			return m.map(function(e) {
				return c(e, 1)[0];
			});
		},
		values: function() {
			return m.map(function(e) {
				return c(e, 2)[1];
			});
		}
	};
	e.default = (0, a.default)(h, h.entries());
} }), vl = I({ "../../node_modules/aria-query/lib/elementRoleMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = r(No()), n = r(_l());
	function r(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function i(e, t) {
		return l(e) || c(e, t) || o(e, t) || a();
	}
	function a() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function o(e, t) {
		if (e) {
			if (typeof e == "string") return s(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? s(e, t) : void 0;
		}
	}
	function s(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function c(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
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
	function l(e) {
		if (Array.isArray(e)) return e;
	}
	var u = [], d = n.default.keys();
	for (_ = 0; _ < d.length; _++) if (f = d[_], p = n.default.get(f), p) for (m = [].concat(p.baseConcepts, p.relatedConcepts), h = function() {
		var e = m[g];
		if (e.module === "HTML") {
			var t = e.concept;
			if (t) {
				for (var n = u.filter(function(e) {
					return y(e[0], t);
				})[0], r = n ? n[1] : [], i = !0, a = 0; a < r.length; a++) if (r[a] === f) {
					i = !1;
					break;
				}
				i && r.push(f), n || u.push([t, r]);
			}
		}
	}, g = 0; g < m.length; g++) h();
	var f, p, m, h, g, _, v = {
		entries: function() {
			return u;
		},
		forEach: function(e) {
			for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, r = u; n < r.length; n++) {
				var a = i(r[n], 2), o = a[0], s = a[1];
				e.call(t, s, o, u);
			}
		},
		get: function(e) {
			var t = u.filter(function(t) {
				return e.name === t[0].name && x(e.attributes, t[0].attributes);
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!v.get(e);
		},
		keys: function() {
			return u.map(function(e) {
				return i(e, 1)[0];
			});
		},
		values: function() {
			return u.map(function(e) {
				return i(e, 2)[1];
			});
		}
	};
	function y(e, t) {
		return e.name === t.name && b(e.constraints, t.constraints) && x(e.attributes, t.attributes);
	}
	function b(e, t) {
		if (e === void 0 && t !== void 0 || e !== void 0 && t === void 0) return !1;
		if (e !== void 0 && t !== void 0) {
			if (e.length !== t.length) return !1;
			for (var n = 0; n < e.length; n++) if (e[n] !== t[n]) return !1;
		}
		return !0;
	}
	function x(e, t) {
		if (e === void 0 && t !== void 0 || e !== void 0 && t === void 0) return !1;
		if (e !== void 0 && t !== void 0) {
			if (e.length !== t.length) return !1;
			for (var n = 0; n < e.length; n++) {
				if (e[n].name !== t[n].name || e[n].value !== t[n].value || e[n].constraints === void 0 && t[n].constraints !== void 0 || e[n].constraints !== void 0 && t[n].constraints === void 0) return !1;
				if (e[n].constraints !== void 0 && t[n].constraints !== void 0) {
					if (e[n].constraints.length !== t[n].constraints.length) return !1;
					for (var r = 0; r < e[n].constraints.length; r++) if (e[n].constraints[r] !== t[n].constraints[r]) return !1;
				}
			}
		}
		return !0;
	}
	e.default = (0, t.default)(v, v.entries());
} }), yl = I({ "../../node_modules/aria-query/lib/roleElementMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = r(No()), n = r(_l());
	function r(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function i(e, t) {
		return l(e) || c(e, t) || o(e, t) || a();
	}
	function a() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function o(e, t) {
		if (e) {
			if (typeof e == "string") return s(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? s(e, t) : void 0;
		}
	}
	function s(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function c(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
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
	function l(e) {
		if (Array.isArray(e)) return e;
	}
	var u = [], d = n.default.keys();
	for (y = 0; y < d.length; y++) if (f = d[y], p = n.default.get(f), m = [], p) {
		for (h = [].concat(p.baseConcepts, p.relatedConcepts), v = 0; v < h.length; v++) g = h[v], g.module === "HTML" && (_ = g.concept, _ != null && m.push(_));
		m.length > 0 && u.push([f, m]);
	}
	var f, p, m, h, g, _, v, y, b = {
		entries: function() {
			return u;
		},
		forEach: function(e) {
			for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, r = u; n < r.length; n++) {
				var a = i(r[n], 2), o = a[0], s = a[1];
				e.call(t, s, o, u);
			}
		},
		get: function(e) {
			var t = u.filter(function(t) {
				return t[0] === e;
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!b.get(e);
		},
		keys: function() {
			return u.map(function(e) {
				return i(e, 1)[0];
			});
		},
		values: function() {
			return u.map(function(e) {
				return i(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(b, b.entries());
} }), bl = I({ "../../node_modules/aria-query/lib/index.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.roles = e.roleElements = e.elementRoles = e.dom = e.aria = void 0;
	var t = o(Po()), n = o(Fo()), r = o(_l()), i = o(vl()), a = o(yl());
	function o(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.aria = t.default, e.dom = n.default, e.roles = r.default, e.elementRoles = i.default, e.roleElements = a.default;
} }), xl = I({ "../../node_modules/css.escape/css.escape.ts"(e, t) {
	(function(n, r) {
		typeof e == "object" ? t.exports = r(n) : typeof define == "function" && define.amd ? define([], r.bind(n, n)) : r(n);
	})(typeof globalThis < "u" ? globalThis : e, function(e) {
		if (e.CSS && e.CSS.escape) return e.CSS.escape;
		var t = function(e) {
			if (arguments.length == 0) throw TypeError("`CSS.escape` requires an argument.");
			for (var t = String(e), n = t.length, r = -1, i, a = "", o = t.charCodeAt(0); ++r < n;) i = t.charCodeAt(r), a += i == 0 ? "�" : i >= 1 && i <= 31 || i == 127 || r == 0 && i >= 48 && i <= 57 || r == 1 && i >= 48 && i <= 57 && o == 45 ? "\\" + i.toString(16) + " " : r == 0 && n == 1 && i == 45 ? "\\" + t.charAt(r) : i >= 128 || i == 45 || i == 95 || i >= 48 && i <= 57 || i >= 65 && i <= 90 || i >= 97 && i <= 122 ? t.charAt(r) : "\\" + t.charAt(r);
			return a;
		};
		return e.CSS ||= {}, e.CSS.escape = t, t;
	});
} }), Sl = Object.defineProperty, L = (e, t) => Sl(e, "name", {
	value: t,
	configurable: !0
}), Cl = (e, t) => {
	for (var n in t) Sl(e, n, {
		get: t[n],
		enumerable: !0
	});
}, wl = {};
Cl(wl, {
	addChainableMethod: () => Od,
	addLengthGuard: () => hd,
	addMethod: () => bd,
	addProperty: () => pd,
	checkError: () => Tl,
	compareByInspect: () => Ad,
	eql: () => Uu,
	expectTypes: () => Il,
	flag: () => R,
	getActual: () => Ll,
	getMessage: () => Iu,
	getName: () => Id,
	getOperator: () => Fd,
	getOwnEnumerableProperties: () => Md,
	getOwnEnumerablePropertySymbols: () => jd,
	getPathInfo: () => ud,
	hasProperty: () => sd,
	inspect: () => V,
	isNaN: () => Nd,
	isNumeric: () => U,
	isProxyEnabled: () => fd,
	isRegExp: () => Ld,
	objDisplay: () => Fu,
	overwriteChainableMethod: () => kd,
	overwriteMethod: () => Sd,
	overwriteProperty: () => xd,
	proxify: () => vd,
	test: () => Nl,
	transferFlags: () => Lu,
	type: () => z
});
var Tl = {};
Cl(Tl, {
	compatibleConstructor: () => kl,
	compatibleInstance: () => Ol,
	compatibleMessage: () => Al,
	getConstructorName: () => jl,
	getMessage: () => Ml
});
function El(e) {
	return e instanceof Error || Object.prototype.toString.call(e) === "[object Error]";
}
L(El, "isErrorInstance");
function Dl(e) {
	return Object.prototype.toString.call(e) === "[object RegExp]";
}
L(Dl, "isRegExp");
function Ol(e, t) {
	return El(t) && e === t;
}
L(Ol, "compatibleInstance");
function kl(e, t) {
	return El(t) ? e.constructor === t.constructor || e instanceof t.constructor : (typeof t == "object" || typeof t == "function") && t.prototype ? e.constructor === t || e instanceof t : !1;
}
L(kl, "compatibleConstructor");
function Al(e, t) {
	let n = typeof e == "string" ? e : e.message;
	return Dl(t) ? t.test(n) : typeof t == "string" && n.indexOf(t) !== -1;
}
L(Al, "compatibleMessage");
function jl(e) {
	let t = e;
	return El(e) ? t = e.constructor.name : typeof e == "function" && (t = e.name, t === "" && (t = new e().name || t)), t;
}
L(jl, "getConstructorName");
function Ml(e) {
	let t = "";
	return e && e.message ? t = e.message : typeof e == "string" && (t = e), t;
}
L(Ml, "getMessage");
function R(e, t, n) {
	let r = e.__flags ||= /* @__PURE__ */ Object.create(null);
	if (arguments.length === 3) r[t] = n;
	else return r[t];
}
L(R, "flag");
function Nl(e, t) {
	let n = R(e, "negate"), r = t[0];
	return n ? !r : r;
}
L(Nl, "test");
function z(e) {
	if (typeof e > "u") return "undefined";
	if (e === null) return "null";
	let t = e[Symbol.toStringTag];
	return typeof t == "string" ? t : Object.prototype.toString.call(e).slice(8, -1);
}
L(z, "type");
var Pl = "captureStackTrace" in Error, Fl = class extends Error {
	message;
	get name() {
		return "AssertionError";
	}
	get ok() {
		return !1;
	}
	constructor(e = "Unspecified AssertionError", t, n) {
		super(e), this.message = e, Pl && Error.captureStackTrace(this, n || Fl);
		for (let e in t) e in this || (this[e] = t[e]);
	}
	toJSON(e) {
		return {
			...this,
			name: this.name,
			message: this.message,
			ok: !1,
			stack: e === !1 ? void 0 : this.stack
		};
	}
}, B = (L(Fl, "AssertionError"), Fl);
function Il(e, t) {
	let n = R(e, "message"), r = R(e, "ssfi");
	n = n ? n + ": " : "", e = R(e, "object"), t = t.map(function(e) {
		return e.toLowerCase();
	}), t.sort();
	let i = t.map(function(e, n) {
		let r = ~[
			"a",
			"e",
			"i",
			"o",
			"u"
		].indexOf(e.charAt(0)) ? "an" : "a";
		return (t.length > 1 && n === t.length - 1 ? "or " : "") + r + " " + e;
	}).join(", "), a = z(e).toLowerCase();
	if (!t.some(function(e) {
		return a === e;
	})) throw new B(n + "object tested must be " + i + ", but " + a + " given", void 0, r);
}
L(Il, "expectTypes");
function Ll(e, t) {
	return t.length > 4 ? t[4] : e._obj;
}
L(Ll, "getActual");
var Rl = {
	bold: ["1", "22"],
	dim: ["2", "22"],
	italic: ["3", "23"],
	underline: ["4", "24"],
	inverse: ["7", "27"],
	hidden: ["8", "28"],
	strike: ["9", "29"],
	black: ["30", "39"],
	red: ["31", "39"],
	green: ["32", "39"],
	yellow: ["33", "39"],
	blue: ["34", "39"],
	magenta: ["35", "39"],
	cyan: ["36", "39"],
	white: ["37", "39"],
	brightblack: ["30;1", "39"],
	brightred: ["31;1", "39"],
	brightgreen: ["32;1", "39"],
	brightyellow: ["33;1", "39"],
	brightblue: ["34;1", "39"],
	brightmagenta: ["35;1", "39"],
	brightcyan: ["36;1", "39"],
	brightwhite: ["37;1", "39"],
	grey: ["90", "39"]
}, zl = {
	special: "cyan",
	number: "yellow",
	bigint: "yellow",
	boolean: "yellow",
	undefined: "grey",
	null: "bold",
	string: "green",
	symbol: "green",
	date: "magenta",
	regexp: "red"
}, Bl = "…";
function Vl(e, t) {
	let n = Rl[zl[t]] || Rl[t] || "";
	return n ? `\x1B[${n[0]}m${String(e)}\x1B[${n[1]}m` : String(e);
}
L(Vl, "colorise");
function Hl({ showHidden: e = !1, depth: t = 2, colors: n = !1, customInspect: r = !0, showProxy: i = !1, maxArrayLength: a = 1 / 0, breakLength: o = 1 / 0, seen: s = [], truncate: c = 1 / 0, stylize: l = String } = {}, u) {
	let d = {
		showHidden: !!e,
		depth: Number(t),
		colors: !!n,
		customInspect: !!r,
		showProxy: !!i,
		maxArrayLength: Number(a),
		breakLength: Number(o),
		truncate: Number(c),
		seen: s,
		inspect: u,
		stylize: l
	};
	return d.colors && (d.stylize = Vl), d;
}
L(Hl, "normaliseOptions");
function Ul(e) {
	return e >= "\ud800" && e <= "\udbff";
}
L(Ul, "isHighSurrogate");
function Wl(e, t, n = Bl) {
	e = String(e);
	let r = n.length, i = e.length;
	if (r > t && i > r) return n;
	if (i > t && i > r) {
		let i = t - r;
		return i > 0 && Ul(e[i - 1]) && --i, `${e.slice(0, i)}${n}`;
	}
	return e;
}
L(Wl, "truncate");
function Gl(e, t, n, r = ", ") {
	n ||= t.inspect;
	let i = e.length;
	if (i === 0) return "";
	let a = t.truncate, o = "", s = "", c = "";
	for (let l = 0; l < i; l += 1) {
		let i = l + 1 === e.length, u = l + 2 === e.length;
		c = `${Bl}(${e.length - l})`;
		let d = e[l];
		t.truncate = a - o.length - (i ? 0 : r.length);
		let f = s || n(d, t) + (i ? "" : r), p = o.length + f.length, m = p + c.length;
		if (i && p > a && o.length + c.length <= a || !i && !u && m > a || (s = i ? "" : n(e[l + 1], t) + (u ? "" : r), !i && u && m > a && p + s.length > a)) break;
		if (o += f, !i && !u && p + s.length >= a) {
			c = `${Bl}(${e.length - l - 1})`;
			break;
		}
		c = "";
	}
	return `${o}${c}`;
}
L(Gl, "inspectList");
function Kl(e) {
	return e.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? e : JSON.stringify(e).replace(/'/g, "\\'").replace(/\\"/g, "\"").replace(/(^"|"$)/g, "'");
}
L(Kl, "quoteComplexKey");
function ql([e, t], n) {
	return n.truncate -= 2, typeof e == "string" ? e = Kl(e) : typeof e != "number" && (e = `[${n.inspect(e, n)}]`), n.truncate -= e.length, t = n.inspect(t, n), `${e}: ${t}`;
}
L(ql, "inspectProperty");
function Jl(e, t) {
	let n = Object.keys(e).slice(e.length);
	if (!e.length && !n.length) return "[]";
	t.truncate -= 4;
	let r = Gl(e, t);
	t.truncate -= r.length;
	let i = "";
	return n.length && (i = Gl(n.map((t) => [t, e[t]]), t, ql)), `[ ${r}${i ? `, ${i}` : ""} ]`;
}
L(Jl, "inspectArray");
var Yl = L((e) => typeof Buffer == "function" && e instanceof Buffer ? "Buffer" : e[Symbol.toStringTag] ? e[Symbol.toStringTag] : e.constructor.name, "getArrayName");
function Xl(e, t) {
	let n = Yl(e);
	t.truncate -= n.length + 4;
	let r = Object.keys(e).slice(e.length);
	if (!e.length && !r.length) return `${n}[]`;
	let i = "";
	for (let n = 0; n < e.length; n++) {
		let r = `${t.stylize(Wl(e[n], t.truncate), "number")}${n === e.length - 1 ? "" : ", "}`;
		if (t.truncate -= r.length, e[n] !== e.length && t.truncate <= 3) {
			i += `${Bl}(${e.length - e[n] + 1})`;
			break;
		}
		i += r;
	}
	let a = "";
	return r.length && (a = Gl(r.map((t) => [t, e[t]]), t, ql)), `${n}[ ${i}${a ? `, ${a}` : ""} ]`;
}
L(Xl, "inspectTypedArray");
function Zl(e, t) {
	let n = e.toJSON();
	if (n === null) return "Invalid Date";
	let r = n.split("T"), i = r[0];
	return t.stylize(`${i}T${Wl(r[1], t.truncate - i.length - 1)}`, "date");
}
L(Zl, "inspectDate");
function Ql(e, t) {
	let n = e[Symbol.toStringTag] || "Function", r = e.name;
	return r ? t.stylize(`[${n} ${Wl(r, t.truncate - 11)}]`, "special") : t.stylize(`[${n}]`, "special");
}
L(Ql, "inspectFunction");
function $l([e, t], n) {
	return n.truncate -= 4, e = n.inspect(e, n), n.truncate -= e.length, t = n.inspect(t, n), `${e} => ${t}`;
}
L($l, "inspectMapEntry");
function eu(e) {
	let t = [];
	return e.forEach((e, n) => {
		t.push([n, e]);
	}), t;
}
L(eu, "mapToEntries");
function tu(e, t) {
	return e.size === 0 ? "Map{}" : (t.truncate -= 7, `Map{ ${Gl(eu(e), t, $l)} }`);
}
L(tu, "inspectMap");
var nu = Number.isNaN || ((e) => e !== e);
function ru(e, t) {
	return nu(e) ? t.stylize("NaN", "number") : e === 1 / 0 ? t.stylize("Infinity", "number") : e === -1 / 0 ? t.stylize("-Infinity", "number") : e === 0 ? t.stylize(1 / e == 1 / 0 ? "+0" : "-0", "number") : t.stylize(Wl(String(e), t.truncate), "number");
}
L(ru, "inspectNumber");
function iu(e, t) {
	let n = Wl(e.toString(), t.truncate - 1);
	return n !== Bl && (n += "n"), t.stylize(n, "bigint");
}
L(iu, "inspectBigInt");
function au(e, t) {
	let n = e.toString().split("/")[2], r = t.truncate - (2 + n.length), i = e.source;
	return t.stylize(`/${Wl(i, r)}/${n}`, "regexp");
}
L(au, "inspectRegExp");
function ou(e) {
	let t = [];
	return e.forEach((e) => {
		t.push(e);
	}), t;
}
L(ou, "arrayFromSet");
function su(e, t) {
	return e.size === 0 ? "Set{}" : (t.truncate -= 7, `Set{ ${Gl(ou(e), t)} }`);
}
L(su, "inspectSet");
var cu = /* @__PURE__ */ RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]", "g"), lu = {
	"\b": "\\b",
	"	": "\\t",
	"\n": "\\n",
	"\f": "\\f",
	"\r": "\\r",
	"'": "\\'",
	"\\": "\\\\"
}, uu = 16, du = 4;
function fu(e) {
	return lu[e] || `\\u${`0000${e.charCodeAt(0).toString(uu)}`.slice(-du)}`;
}
L(fu, "escape");
function pu(e, t) {
	return cu.test(e) && (e = e.replace(cu, fu)), t.stylize(`'${Wl(e, t.truncate - 2)}'`, "string");
}
L(pu, "inspectString");
function mu(e) {
	return "description" in Symbol.prototype ? e.description ? `Symbol(${e.description})` : "Symbol()" : e.toString();
}
L(mu, "inspectSymbol");
var hu = L(() => "Promise{…}", "getPromiseValue");
function gu(e, t) {
	let n = Object.getOwnPropertyNames(e), r = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(e) : [];
	if (n.length === 0 && r.length === 0) return "{}";
	if (t.truncate -= 4, t.seen = t.seen || [], t.seen.includes(e)) return "[Circular]";
	t.seen.push(e);
	let i = Gl(n.map((t) => [t, e[t]]), t, ql), a = Gl(r.map((t) => [t, e[t]]), t, ql);
	t.seen.pop();
	let o = "";
	return i && a && (o = ", "), `{ ${i}${o}${a} }`;
}
L(gu, "inspectObject");
var _u = typeof Symbol < "u" && Symbol.toStringTag ? Symbol.toStringTag : !1;
function vu(e, t) {
	let n = "";
	return _u && _u in e && (n = e[_u]), n ||= e.constructor.name, n && n !== "_class" || (n = "<Anonymous Class>"), t.truncate -= n.length, `${n}${gu(e, t)}`;
}
L(vu, "inspectClass");
function yu(e, t) {
	return e.length === 0 ? "Arguments[]" : (t.truncate -= 13, `Arguments[ ${Gl(e, t)} ]`);
}
L(yu, "inspectArguments");
var bu = [
	"stack",
	"line",
	"column",
	"name",
	"message",
	"fileName",
	"lineNumber",
	"columnNumber",
	"number",
	"description",
	"cause"
];
function xu(e, t) {
	let n = Object.getOwnPropertyNames(e).filter((e) => bu.indexOf(e) === -1), r = e.name;
	t.truncate -= r.length;
	let i = "";
	if (typeof e.message == "string" ? i = Wl(e.message, t.truncate) : n.unshift("message"), i = i ? `: ${i}` : "", t.truncate -= i.length + 5, t.seen = t.seen || [], t.seen.includes(e)) return "[Circular]";
	t.seen.push(e);
	let a = Gl(n.map((t) => [t, e[t]]), t, ql);
	return `${r}${i}${a ? ` { ${a} }` : ""}`;
}
L(xu, "inspectObject");
function Su([e, t], n) {
	return n.truncate -= 3, t ? `${n.stylize(String(e), "yellow")}=${n.stylize(`"${t}"`, "string")}` : `${n.stylize(String(e), "yellow")}`;
}
L(Su, "inspectAttribute");
function Cu(e, t) {
	return Gl(e, t, wu, "\n");
}
L(Cu, "inspectNodeCollection");
function wu(e, t) {
	switch (e.nodeType) {
		case 1: return Tu(e, t);
		case 3: return t.inspect(e.data, t);
		default: return t.inspect(e, t);
	}
}
L(wu, "inspectNode");
function Tu(e, t) {
	let n = e.getAttributeNames(), r = e.tagName.toLowerCase(), i = t.stylize(`<${r}`, "special"), a = t.stylize(">", "special"), o = t.stylize(`</${r}>`, "special");
	t.truncate -= r.length * 2 + 5;
	let s = "";
	n.length > 0 && (s += " ", s += Gl(n.map((t) => [t, e.getAttribute(t)]), t, Su, " ")), t.truncate -= s.length;
	let c = t.truncate, l = Cu(e.children, t);
	return l && l.length > c && (l = `${Bl}(${e.children.length})`), `${i}${s}${a}${l}${o}`;
}
L(Tu, "inspectHTML");
var Eu = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("chai/inspect") : "@@chai/inspect", Du = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom"), Ou = /* @__PURE__ */ new WeakMap(), ku = {}, Au = {
	undefined: L((e, t) => t.stylize("undefined", "undefined"), "undefined"),
	null: L((e, t) => t.stylize("null", "null"), "null"),
	boolean: L((e, t) => t.stylize(String(e), "boolean"), "boolean"),
	Boolean: L((e, t) => t.stylize(String(e), "boolean"), "Boolean"),
	number: ru,
	Number: ru,
	bigint: iu,
	BigInt: iu,
	string: pu,
	String: pu,
	function: Ql,
	Function: Ql,
	symbol: mu,
	Symbol: mu,
	Array: Jl,
	Date: Zl,
	Map: tu,
	Set: su,
	RegExp: au,
	Promise: hu,
	WeakSet: L((e, t) => t.stylize("WeakSet{…}", "special"), "WeakSet"),
	WeakMap: L((e, t) => t.stylize("WeakMap{…}", "special"), "WeakMap"),
	Arguments: yu,
	Int8Array: Xl,
	Uint8Array: Xl,
	Uint8ClampedArray: Xl,
	Int16Array: Xl,
	Uint16Array: Xl,
	Int32Array: Xl,
	Uint32Array: Xl,
	Float32Array: Xl,
	Float64Array: Xl,
	Generator: L(() => "", "Generator"),
	DataView: L(() => "", "DataView"),
	ArrayBuffer: L(() => "", "ArrayBuffer"),
	Error: xu,
	HTMLCollection: Cu,
	NodeList: Cu
}, ju = L((e, t, n) => Eu in e && typeof e[Eu] == "function" ? e[Eu](t) : Du in e && typeof e[Du] == "function" ? e[Du](t.depth, t) : "inspect" in e && typeof e.inspect == "function" ? e.inspect(t.depth, t) : "constructor" in e && Ou.has(e.constructor) ? Ou.get(e.constructor)(e, t) : ku[n] ? ku[n](e, t) : "", "inspectCustom"), Mu = Object.prototype.toString;
function Nu(e, t = {}) {
	let n = Hl(t, Nu), { customInspect: r } = n, i = e === null ? "null" : typeof e;
	if (i === "object" && (i = Mu.call(e).slice(8, -1)), i in Au) return Au[i](e, n);
	if (r && e) {
		let t = ju(e, n, i);
		if (t) return typeof t == "string" ? t : Nu(t, n);
	}
	let a = e ? Object.getPrototypeOf(e) : !1;
	return a === Object.prototype || a === null ? gu(e, n) : e && typeof HTMLElement == "function" && e instanceof HTMLElement ? Tu(e, n) : "constructor" in e ? e.constructor === Object ? gu(e, n) : vu(e, n) : e === Object(e) ? gu(e, n) : n.stylize(String(e), i);
}
L(Nu, "inspect");
var Pu = {
	includeStack: !1,
	showDiff: !0,
	truncateThreshold: 40,
	useProxy: !0,
	proxyExcludedKeys: [
		"then",
		"catch",
		"inspect",
		"toJSON"
	],
	deepEqual: null
};
function V(e, t, n, r) {
	return Nu(e, {
		colors: r,
		depth: typeof n > "u" ? 2 : n,
		showHidden: t,
		truncate: Pu.truncateThreshold ? Pu.truncateThreshold : 1 / 0
	});
}
L(V, "inspect");
function Fu(e) {
	let t = V(e), n = Object.prototype.toString.call(e);
	if (Pu.truncateThreshold && t.length >= Pu.truncateThreshold) {
		if (n === "[object Function]") return !e.name || e.name === "" ? "[Function]" : "[Function: " + e.name + "]";
		if (n === "[object Array]") return "[ Array(" + e.length + ") ]";
		if (n === "[object Object]") {
			let t = Object.keys(e);
			return "{ Object (" + (t.length > 2 ? t.splice(0, 2).join(", ") + ", ..." : t.join(", ")) + ") }";
		}
		return t;
	}
	return t;
}
L(Fu, "objDisplay");
function Iu(e, t) {
	let n = R(e, "negate"), r = R(e, "object"), i = t[3], a = Ll(e, t), o = n ? t[2] : t[1], s = R(e, "message");
	return typeof o == "function" && (o = o()), o ||= "", o = o.replace(/#\{this\}/g, function() {
		return Fu(r);
	}).replace(/#\{act\}/g, function() {
		return Fu(a);
	}).replace(/#\{exp\}/g, function() {
		return Fu(i);
	}), s ? s + ": " + o : o;
}
L(Iu, "getMessage");
function Lu(e, t, n) {
	let r = e.__flags ||= /* @__PURE__ */ Object.create(null);
	t.__flags ||= /* @__PURE__ */ Object.create(null), n = arguments.length !== 3 || n;
	for (let e in r) (n || e !== "object" && e !== "ssfi" && e !== "lockSsfi" && e != "message") && (t.__flags[e] = r[e]);
}
L(Lu, "transferFlags");
function Ru(e) {
	if (typeof e > "u") return "undefined";
	if (e === null) return "null";
	let t = e[Symbol.toStringTag];
	return typeof t == "string" ? t : Object.prototype.toString.call(e).slice(8, -1);
}
L(Ru, "type");
function zu() {
	this._key = "chai/deep-eql__" + Math.random() + Date.now();
}
L(zu, "FakeMap"), zu.prototype = {
	get: L(function(e) {
		return e[this._key];
	}, "get"),
	set: L(function(e, t) {
		Object.isExtensible(e) && Object.defineProperty(e, this._key, {
			value: t,
			configurable: !0
		});
	}, "set")
};
var Bu = typeof WeakMap == "function" ? WeakMap : zu;
function Vu(e, t, n) {
	if (!n || ad(e) || ad(t)) return null;
	var r = n.get(e);
	if (r) {
		var i = r.get(t);
		if (typeof i == "boolean") return i;
	}
	return null;
}
L(Vu, "memoizeCompare");
function Hu(e, t, n, r) {
	if (!(!n || ad(e) || ad(t))) {
		var i = n.get(e);
		i ? i.set(t, r) : (i = new Bu(), i.set(t, r), n.set(e, i));
	}
}
L(Hu, "memoizeSet");
var Uu = Wu;
function Wu(e, t, n) {
	if (n && n.comparator) return Ku(e, t, n);
	var r = Gu(e, t);
	return r === null ? Ku(e, t, n) : r;
}
L(Wu, "deepEqual");
function Gu(e, t) {
	return e === t ? e !== 0 || 1 / e == 1 / t : e !== e && t !== t ? !0 : ad(e) || ad(t) ? !1 : null;
}
L(Gu, "simpleEqual");
function Ku(e, t, n) {
	n ||= {}, n.memoize = n.memoize === !1 ? !1 : n.memoize || new Bu();
	var r = n && n.comparator, i = Vu(e, t, n.memoize);
	if (i !== null) return i;
	var a = Vu(t, e, n.memoize);
	if (a !== null) return a;
	if (r) {
		var o = r(e, t);
		if (o === !1 || o === !0) return Hu(e, t, n.memoize, o), o;
		var s = Gu(e, t);
		if (s !== null) return s;
	}
	var c = Ru(e);
	if (c !== Ru(t)) return Hu(e, t, n.memoize, !1), !1;
	Hu(e, t, n.memoize, !0);
	var l = qu(e, t, c, n);
	return Hu(e, t, n.memoize, l), l;
}
L(Ku, "extensiveDeepEqual");
function qu(e, t, n, r) {
	switch (n) {
		case "String":
		case "Number":
		case "Boolean":
		case "Date": return Wu(e.valueOf(), t.valueOf());
		case "Promise":
		case "Symbol":
		case "function":
		case "WeakMap":
		case "WeakSet": return e === t;
		case "Error": return rd(e, t, [
			"name",
			"message",
			"code"
		], r);
		case "Arguments":
		case "Int8Array":
		case "Uint8Array":
		case "Uint8ClampedArray":
		case "Int16Array":
		case "Uint16Array":
		case "Int32Array":
		case "Uint32Array":
		case "Float32Array":
		case "Float64Array":
		case "Array": return Xu(e, t, r);
		case "RegExp": return Ju(e, t);
		case "Generator": return Zu(e, t, r);
		case "DataView": return Xu(new Uint8Array(e.buffer), new Uint8Array(t.buffer), r);
		case "ArrayBuffer": return Xu(new Uint8Array(e), new Uint8Array(t), r);
		case "Set": return Yu(e, t, r);
		case "Map": return Yu(e, t, r);
		case "Temporal.PlainDate":
		case "Temporal.PlainTime":
		case "Temporal.PlainDateTime":
		case "Temporal.Instant":
		case "Temporal.ZonedDateTime":
		case "Temporal.PlainYearMonth":
		case "Temporal.PlainMonthDay": return e.equals(t);
		case "Temporal.Duration": return e.total("nanoseconds") === t.total("nanoseconds");
		case "Temporal.TimeZone":
		case "Temporal.Calendar": return e.toString() === t.toString();
		default: return id(e, t, r);
	}
}
L(qu, "extensiveDeepEqualByType");
function Ju(e, t) {
	return e.toString() === t.toString();
}
L(Ju, "regexpEqual");
function Yu(e, t, n) {
	try {
		if (e.size !== t.size) return !1;
		if (e.size === 0) return !0;
	} catch {
		return !1;
	}
	var r = [], i = [];
	return e.forEach(L(function(e, t) {
		r.push([e, t]);
	}, "gatherEntries")), t.forEach(L(function(e, t) {
		i.push([e, t]);
	}, "gatherEntries")), Xu(r.sort(), i.sort(), n);
}
L(Yu, "entriesEqual");
function Xu(e, t, n) {
	var r = e.length;
	if (r !== t.length) return !1;
	if (r === 0) return !0;
	for (var i = -1; ++i < r;) if (Wu(e[i], t[i], n) === !1) return !1;
	return !0;
}
L(Xu, "iterableEqual");
function Zu(e, t, n) {
	return Xu(ed(e), ed(t), n);
}
L(Zu, "generatorEqual");
function Qu(e) {
	return typeof Symbol < "u" && typeof e == "object" && typeof Symbol.iterator < "u" && typeof e[Symbol.iterator] == "function";
}
L(Qu, "hasIteratorFunction");
function $u(e) {
	if (Qu(e)) try {
		return ed(e[Symbol.iterator]());
	} catch {
		return [];
	}
	return [];
}
L($u, "getIteratorEntries");
function ed(e) {
	for (var t = e.next(), n = [t.value]; t.done === !1;) t = e.next(), n.push(t.value);
	return n;
}
L(ed, "getGeneratorEntries");
function td(e) {
	var t = [];
	for (var n in e) t.push(n);
	return t;
}
L(td, "getEnumerableKeys");
function nd(e) {
	for (var t = [], n = Object.getOwnPropertySymbols(e), r = 0; r < n.length; r += 1) {
		var i = n[r];
		Object.getOwnPropertyDescriptor(e, i).enumerable && t.push(i);
	}
	return t;
}
L(nd, "getEnumerableSymbols");
function rd(e, t, n, r) {
	var i = n.length;
	if (i === 0) return !0;
	for (var a = 0; a < i; a += 1) if (Wu(e[n[a]], t[n[a]], r) === !1) return !1;
	return !0;
}
L(rd, "keysEqual");
function id(e, t, n) {
	var r = td(e), i = td(t), a = nd(e), o = nd(t);
	if (r = r.concat(a), i = i.concat(o), r.length && r.length === i.length) return Xu(od(r).sort(), od(i).sort()) !== !1 && rd(e, t, r, n);
	var s = $u(e), c = $u(t);
	return s.length && s.length === c.length ? (s.sort(), c.sort(), Xu(s, c, n)) : r.length === 0 && s.length === 0 && i.length === 0 && c.length === 0;
}
L(id, "objectEqual");
function ad(e) {
	return typeof e != "object" || !e;
}
L(ad, "isPrimitive");
function od(e) {
	return e.map(L(function(e) {
		return typeof e == "symbol" ? e.toString() : e;
	}, "mapSymbol"));
}
L(od, "mapSymbols");
function sd(e, t) {
	return typeof e > "u" || e === null ? !1 : t in Object(e);
}
L(sd, "hasProperty");
function cd(e) {
	return e.replace(/([^\\])\[/g, "$1.[").match(/(\\\.|[^.]+?)+/g).map((e) => {
		if (e === "constructor" || e === "__proto__" || e === "prototype") return {};
		let t = /^\[(\d+)\]$/.exec(e), n = null;
		return n = t ? { i: parseFloat(t[1]) } : { p: e.replace(/\\([.[\]])/g, "$1") }, n;
	});
}
L(cd, "parsePath");
function ld(e, t, n) {
	let r = e, i = null;
	n = typeof n > "u" ? t.length : n;
	for (let e = 0; e < n; e++) {
		let a = t[e];
		r && (r = typeof a.p > "u" ? r[a.i] : r[a.p], e === n - 1 && (i = r));
	}
	return i;
}
L(ld, "internalGetPathValue");
function ud(e, t) {
	let n = cd(t), r = n[n.length - 1], i = {
		parent: n.length > 1 ? ld(e, n, n.length - 1) : e,
		name: r.p || r.i,
		value: ld(e, n)
	};
	return i.exists = sd(i.parent, i.name), i;
}
L(ud, "getPathInfo");
var dd = class {
	__flags = {};
	constructor(e, t, n, r) {
		return R(this, "ssfi", n || dd), R(this, "lockSsfi", r), R(this, "object", e), R(this, "message", t), R(this, "eql", Pu.deepEqual || Uu), vd(this);
	}
	static get includeStack() {
		return console.warn("Assertion.includeStack is deprecated, use chai.config.includeStack instead."), Pu.includeStack;
	}
	static set includeStack(e) {
		console.warn("Assertion.includeStack is deprecated, use chai.config.includeStack instead."), Pu.includeStack = e;
	}
	static get showDiff() {
		return console.warn("Assertion.showDiff is deprecated, use chai.config.showDiff instead."), Pu.showDiff;
	}
	static set showDiff(e) {
		console.warn("Assertion.showDiff is deprecated, use chai.config.showDiff instead."), Pu.showDiff = e;
	}
	static addProperty(e, t) {
		pd(this.prototype, e, t);
	}
	static addMethod(e, t) {
		bd(this.prototype, e, t);
	}
	static addChainableMethod(e, t, n) {
		Od(this.prototype, e, t, n);
	}
	static overwriteProperty(e, t) {
		xd(this.prototype, e, t);
	}
	static overwriteMethod(e, t) {
		Sd(this.prototype, e, t);
	}
	static overwriteChainableMethod(e, t, n) {
		kd(this.prototype, e, t, n);
	}
	assert(e, t, n, r, i, a) {
		let o = Nl(this, arguments);
		if (a !== !1 && (a = !0), r === void 0 && i === void 0 && (a = !1), Pu.showDiff !== !0 && (a = !1), !o) {
			t = Iu(this, arguments);
			let e = {
				actual: Ll(this, arguments),
				expected: r,
				showDiff: a
			}, n = Fd(this, arguments);
			throw n && (e.operator = n), new B(t, e, Pu.includeStack ? this.assert : R(this, "ssfi"));
		}
	}
	get _obj() {
		return R(this, "object");
	}
	set _obj(e) {
		R(this, "object", e);
	}
}, H = (L(dd, "Assertion"), dd);
function fd() {
	return Pu.useProxy && typeof Proxy < "u" && typeof Reflect < "u";
}
L(fd, "isProxyEnabled");
function pd(e, t, n) {
	n = n === void 0 ? function() {} : n, Object.defineProperty(e, t, {
		get: L(function e() {
			!fd() && !R(this, "lockSsfi") && R(this, "ssfi", e);
			let t = n.call(this);
			if (t !== void 0) return t;
			let r = new H();
			return Lu(this, r), r;
		}, "propertyGetter"),
		configurable: !0
	});
}
L(pd, "addProperty");
var md = Object.getOwnPropertyDescriptor(function() {}, "length");
function hd(e, t, n) {
	return md.configurable && Object.defineProperty(e, "length", { get: L(function() {
		throw Error(n ? "Invalid Chai property: " + t + ".length. Due to a compatibility issue, \"length\" cannot directly follow \"" + t + "\". Use \"" + t + ".lengthOf\" instead." : "Invalid Chai property: " + t + ".length. See docs for proper usage of \"" + t + "\".");
	}, "get") }), e;
}
L(hd, "addLengthGuard");
function gd(e) {
	let t = Object.getOwnPropertyNames(e);
	function n(e) {
		t.indexOf(e) === -1 && t.push(e);
	}
	L(n, "addProperty");
	let r = Object.getPrototypeOf(e);
	for (; r !== null;) Object.getOwnPropertyNames(r).forEach(n), r = Object.getPrototypeOf(r);
	return t;
}
L(gd, "getProperties");
var _d = [
	"__flags",
	"__methods",
	"_obj",
	"assert"
];
function vd(e, t) {
	return fd() ? new Proxy(e, { get: L(function e(n, r) {
		if (typeof r == "string" && Pu.proxyExcludedKeys.indexOf(r) === -1 && !Reflect.has(n, r)) {
			if (t) throw Error("Invalid Chai property: " + t + "." + r + ". See docs for proper usage of \"" + t + "\".");
			let e = null, i = 4;
			throw gd(n).forEach(function(t) {
				if (!Object.prototype.hasOwnProperty(t) && _d.indexOf(t) === -1) {
					let n = yd(r, t, i);
					n < i && (e = t, i = n);
				}
			}), Error(e === null ? "Invalid Chai property: " + r : "Invalid Chai property: " + r + ". Did you mean \"" + e + "\"?");
		}
		return _d.indexOf(r) === -1 && !R(n, "lockSsfi") && R(n, "ssfi", e), Reflect.get(n, r);
	}, "proxyGetter") }) : e;
}
L(vd, "proxify");
function yd(e, t, n) {
	if (Math.abs(e.length - t.length) >= n) return n;
	let r = [];
	for (let n = 0; n <= e.length; n++) r[n] = Array(t.length + 1).fill(0), r[n][0] = n;
	for (let e = 0; e < t.length; e++) r[0][e] = e;
	for (let i = 1; i <= e.length; i++) {
		let a = e.charCodeAt(i - 1);
		for (let e = 1; e <= t.length; e++) Math.abs(i - e) >= n ? r[i][e] = n : r[i][e] = Math.min(r[i - 1][e] + 1, r[i][e - 1] + 1, r[i - 1][e - 1] + (a === t.charCodeAt(e - 1) ? 0 : 1));
	}
	return r[e.length][t.length];
}
L(yd, "stringDistanceCapped");
function bd(e, t, n) {
	let r = L(function() {
		R(this, "lockSsfi") || R(this, "ssfi", r);
		let e = n.apply(this, arguments);
		if (e !== void 0) return e;
		let t = new H();
		return Lu(this, t), t;
	}, "methodWrapper");
	hd(r, t, !1), e[t] = vd(r, t);
}
L(bd, "addMethod");
function xd(e, t, n) {
	let r = Object.getOwnPropertyDescriptor(e, t), i = L(function() {}, "_super");
	r && typeof r.get == "function" && (i = r.get), Object.defineProperty(e, t, {
		get: L(function e() {
			!fd() && !R(this, "lockSsfi") && R(this, "ssfi", e);
			let t = R(this, "lockSsfi");
			R(this, "lockSsfi", !0);
			let r = n(i).call(this);
			if (R(this, "lockSsfi", t), r !== void 0) return r;
			let a = new H();
			return Lu(this, a), a;
		}, "overwritingPropertyGetter"),
		configurable: !0
	});
}
L(xd, "overwriteProperty");
function Sd(e, t, n) {
	let r = e[t], i = L(function() {
		throw Error(t + " is not a function");
	}, "_super");
	r && typeof r == "function" && (i = r);
	let a = L(function() {
		R(this, "lockSsfi") || R(this, "ssfi", a);
		let e = R(this, "lockSsfi");
		R(this, "lockSsfi", !0);
		let t = n(i).apply(this, arguments);
		if (R(this, "lockSsfi", e), t !== void 0) return t;
		let r = new H();
		return Lu(this, r), r;
	}, "overwritingMethodWrapper");
	hd(a, t, !1), e[t] = vd(a, t);
}
L(Sd, "overwriteMethod");
var Cd = typeof Object.setPrototypeOf == "function", wd = L(function() {}, "testFn"), Td = Object.getOwnPropertyNames(wd).filter(function(e) {
	let t = Object.getOwnPropertyDescriptor(wd, e);
	return typeof t != "object" || !t.configurable;
}), Ed = Function.prototype.call, Dd = Function.prototype.apply;
function Od(e, t, n, r) {
	typeof r != "function" && (r = L(function() {}, "chainingBehavior"));
	let i = {
		method: n,
		chainingBehavior: r
	};
	e.__methods ||= {}, e.__methods[t] = i, Object.defineProperty(e, t, {
		get: L(function() {
			i.chainingBehavior.call(this);
			let n = L(function() {
				R(this, "lockSsfi") || R(this, "ssfi", n);
				let e = i.method.apply(this, arguments);
				if (e !== void 0) return e;
				let t = new H();
				return Lu(this, t), t;
			}, "chainableMethodWrapper");
			if (hd(n, t, !0), Cd) {
				let e = Object.create(this);
				e.call = Ed, e.apply = Dd, Object.setPrototypeOf(n, e);
			} else Object.getOwnPropertyNames(e).forEach(function(t) {
				if (Td.indexOf(t) !== -1) return;
				let r = Object.getOwnPropertyDescriptor(e, t);
				Object.defineProperty(n, t, r);
			});
			return Lu(this, n), vd(n);
		}, "chainableMethodGetter"),
		configurable: !0
	});
}
L(Od, "addChainableMethod");
function kd(e, t, n, r) {
	let i = e.__methods[t], a = i.chainingBehavior;
	i.chainingBehavior = L(function() {
		let e = r(a).call(this);
		if (e !== void 0) return e;
		let t = new H();
		return Lu(this, t), t;
	}, "overwritingChainableMethodGetter");
	let o = i.method;
	i.method = L(function() {
		let e = n(o).apply(this, arguments);
		if (e !== void 0) return e;
		let t = new H();
		return Lu(this, t), t;
	}, "overwritingChainableMethodWrapper");
}
L(kd, "overwriteChainableMethod");
function Ad(e, t) {
	return V(e) < V(t) ? -1 : 1;
}
L(Ad, "compareByInspect");
function jd(e) {
	return typeof Object.getOwnPropertySymbols == "function" ? Object.getOwnPropertySymbols(e).filter(function(t) {
		return Object.getOwnPropertyDescriptor(e, t).enumerable;
	}) : [];
}
L(jd, "getOwnEnumerablePropertySymbols");
function Md(e) {
	return Object.keys(e).concat(jd(e));
}
L(Md, "getOwnEnumerableProperties");
var Nd = Number.isNaN;
function Pd(e) {
	let t = z(e);
	return [
		"Array",
		"Object",
		"Function"
	].indexOf(t) !== -1;
}
L(Pd, "isObjectType");
function Fd(e, t) {
	let n = R(e, "operator"), r = R(e, "negate"), i = t[3], a = r ? t[2] : t[1];
	if (n) return n;
	if (typeof a == "function" && (a = a()), a ||= "", !a || /\shave\s/.test(a)) return;
	let o = Pd(i);
	return /\snot\s/.test(a) ? o ? "notDeepStrictEqual" : "notStrictEqual" : o ? "deepStrictEqual" : "strictEqual";
}
L(Fd, "getOperator");
function Id(e) {
	return e.name;
}
L(Id, "getName");
function Ld(e) {
	return Object.prototype.toString.call(e) === "[object RegExp]";
}
L(Ld, "isRegExp");
function U(e) {
	return ["Number", "BigInt"].includes(z(e));
}
L(U, "isNumeric");
var { flag: W } = wl;
[
	"to",
	"be",
	"been",
	"is",
	"and",
	"has",
	"have",
	"with",
	"that",
	"which",
	"at",
	"of",
	"same",
	"but",
	"does",
	"still",
	"also"
].forEach(function(e) {
	H.addProperty(e);
}), H.addProperty("not", function() {
	W(this, "negate", !0);
}), H.addProperty("deep", function() {
	W(this, "deep", !0);
}), H.addProperty("nested", function() {
	W(this, "nested", !0);
}), H.addProperty("own", function() {
	W(this, "own", !0);
}), H.addProperty("ordered", function() {
	W(this, "ordered", !0);
}), H.addProperty("any", function() {
	W(this, "any", !0), W(this, "all", !1);
}), H.addProperty("all", function() {
	W(this, "all", !0), W(this, "any", !1);
});
var Rd = {
	function: [
		"function",
		"asyncfunction",
		"generatorfunction",
		"asyncgeneratorfunction"
	],
	asyncfunction: ["asyncfunction", "asyncgeneratorfunction"],
	generatorfunction: ["generatorfunction", "asyncgeneratorfunction"],
	asyncgeneratorfunction: ["asyncgeneratorfunction"]
};
function zd(e, t) {
	t && W(this, "message", t), e = e.toLowerCase();
	let n = W(this, "object"), r = ~[
		"a",
		"e",
		"i",
		"o",
		"u"
	].indexOf(e.charAt(0)) ? "an " : "a ", i = z(n).toLowerCase();
	Rd.function.includes(e) ? this.assert(Rd[e].includes(i), "expected #{this} to be " + r + e, "expected #{this} not to be " + r + e) : this.assert(e === i, "expected #{this} to be " + r + e, "expected #{this} not to be " + r + e);
}
L(zd, "an"), H.addChainableMethod("an", zd), H.addChainableMethod("a", zd);
function Bd(e, t) {
	return Nd(e) && Nd(t) || e === t;
}
L(Bd, "SameValueZero");
function Vd() {
	W(this, "contains", !0);
}
L(Vd, "includeChainingBehavior");
function Hd(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = z(n).toLowerCase(), i = W(this, "message"), a = W(this, "negate"), o = W(this, "ssfi"), s = W(this, "deep"), c = s ? "deep " : "", l = s ? W(this, "eql") : Bd;
	i = i ? i + ": " : "";
	let u = !1;
	switch (r) {
		case "string":
			u = n.indexOf(e) !== -1;
			break;
		case "weakset":
			if (s) throw new B(i + "unable to use .deep.include with WeakSet", void 0, o);
			u = n.has(e);
			break;
		case "map":
			n.forEach(function(t) {
				u ||= l(t, e);
			});
			break;
		case "set":
			s ? n.forEach(function(t) {
				u ||= l(t, e);
			}) : u = n.has(e);
			break;
		case "array":
			u = s ? n.some(function(t) {
				return l(t, e);
			}) : n.indexOf(e) !== -1;
			break;
		default: {
			if (e !== Object(e)) throw new B(i + "the given combination of arguments (" + r + " and " + z(e).toLowerCase() + ") is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a " + z(e).toLowerCase(), void 0, o);
			let t = Object.keys(e), s = null, c = 0;
			if (t.forEach(function(r) {
				let i = new H(n);
				if (Lu(this, i, !0), W(i, "lockSsfi", !0), !a || t.length === 1) i.property(r, e[r]);
				else try {
					i.property(r, e[r]);
				} catch (e) {
					if (!Tl.compatibleConstructor(e, B)) throw e;
					s === null && (s = e), c++;
				}
			}, this), a && t.length > 1 && c === t.length) throw s;
			return;
		}
	}
	this.assert(u, "expected #{this} to " + c + "include " + V(e), "expected #{this} to not " + c + "include " + V(e));
}
L(Hd, "include"), H.addChainableMethod("include", Hd, Vd), H.addChainableMethod("contain", Hd, Vd), H.addChainableMethod("contains", Hd, Vd), H.addChainableMethod("includes", Hd, Vd), H.addProperty("ok", function() {
	this.assert(W(this, "object"), "expected #{this} to be truthy", "expected #{this} to be falsy");
}), H.addProperty("true", function() {
	this.assert(W(this, "object") === !0, "expected #{this} to be true", "expected #{this} to be false", !W(this, "negate"));
}), H.addProperty("numeric", function() {
	let e = W(this, "object");
	this.assert(["Number", "BigInt"].includes(z(e)), "expected #{this} to be numeric", "expected #{this} to not be numeric", !W(this, "negate"));
}), H.addProperty("callable", function() {
	let e = W(this, "object"), t = W(this, "ssfi"), n = W(this, "message"), r = n ? `${n}: ` : "", i = W(this, "negate"), a = i ? `${r}expected ${V(e)} not to be a callable function` : `${r}expected ${V(e)} to be a callable function`, o = [
		"Function",
		"AsyncFunction",
		"GeneratorFunction",
		"AsyncGeneratorFunction"
	].includes(z(e));
	if (o && i || !o && !i) throw new B(a, void 0, t);
}), H.addProperty("false", function() {
	this.assert(W(this, "object") === !1, "expected #{this} to be false", "expected #{this} to be true", !!W(this, "negate"));
}), H.addProperty("null", function() {
	this.assert(W(this, "object") === null, "expected #{this} to be null", "expected #{this} not to be null");
}), H.addProperty("undefined", function() {
	this.assert(W(this, "object") === void 0, "expected #{this} to be undefined", "expected #{this} not to be undefined");
}), H.addProperty("NaN", function() {
	this.assert(Nd(W(this, "object")), "expected #{this} to be NaN", "expected #{this} not to be NaN");
});
function Ud() {
	let e = W(this, "object");
	this.assert(e != null, "expected #{this} to exist", "expected #{this} to not exist");
}
L(Ud, "assertExist"), H.addProperty("exist", Ud), H.addProperty("exists", Ud), H.addProperty("empty", function() {
	let e = W(this, "object"), t = W(this, "ssfi"), n = W(this, "message"), r;
	switch (n = n ? n + ": " : "", z(e).toLowerCase()) {
		case "array":
		case "string":
			r = e.length;
			break;
		case "map":
		case "set":
			r = e.size;
			break;
		case "weakmap":
		case "weakset": throw new B(n + ".empty was passed a weak collection", void 0, t);
		case "function": throw new B((n + ".empty was passed a function " + Id(e)).trim(), void 0, t);
		default:
			if (e !== Object(e)) throw new B(n + ".empty was passed non-string primitive " + V(e), void 0, t);
			r = Object.keys(e).length;
	}
	this.assert(r === 0, "expected #{this} to be empty", "expected #{this} not to be empty");
});
function Wd() {
	let e = z(W(this, "object"));
	this.assert(e === "Arguments", "expected #{this} to be arguments but got " + e, "expected #{this} to not be arguments");
}
L(Wd, "checkArguments"), H.addProperty("arguments", Wd), H.addProperty("Arguments", Wd);
function Gd(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object");
	if (W(this, "deep")) {
		let t = W(this, "lockSsfi");
		W(this, "lockSsfi", !0), this.eql(e), W(this, "lockSsfi", t);
	} else this.assert(e === n, "expected #{this} to equal #{exp}", "expected #{this} to not equal #{exp}", e, this._obj, !0);
}
L(Gd, "assertEqual"), H.addMethod("equal", Gd), H.addMethod("equals", Gd), H.addMethod("eq", Gd);
function Kd(e, t) {
	t && W(this, "message", t);
	let n = W(this, "eql");
	this.assert(n(e, W(this, "object")), "expected #{this} to deeply equal #{exp}", "expected #{this} to not deeply equal #{exp}", e, this._obj, !0);
}
L(Kd, "assertEql"), H.addMethod("eql", Kd), H.addMethod("eqls", Kd);
function qd(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = W(this, "doLength"), i = W(this, "message"), a = i ? i + ": " : "", o = W(this, "ssfi"), s = z(n).toLowerCase(), c = z(e).toLowerCase();
	if (r && s !== "map" && s !== "set" && new H(n, i, o, !0).to.have.property("length"), !r && s === "date" && c !== "date") throw new B(a + "the argument to above must be a date", void 0, o);
	if (!U(e) && (r || U(n))) throw new B(a + "the argument to above must be a number", void 0, o);
	if (!r && s !== "date" && !U(n)) {
		let e = s === "string" ? "'" + n + "'" : n;
		throw new B(a + "expected " + e + " to be a number or a date", void 0, o);
	}
	if (r) {
		let t = "length", r;
		s === "map" || s === "set" ? (t = "size", r = n.size) : r = n.length, this.assert(r > e, "expected #{this} to have a " + t + " above #{exp} but got #{act}", "expected #{this} to not have a " + t + " above #{exp}", e, r);
	} else this.assert(n > e, "expected #{this} to be above #{exp}", "expected #{this} to be at most #{exp}", e);
}
L(qd, "assertAbove"), H.addMethod("above", qd), H.addMethod("gt", qd), H.addMethod("greaterThan", qd);
function Jd(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = W(this, "doLength"), i = W(this, "message"), a = i ? i + ": " : "", o = W(this, "ssfi"), s = z(n).toLowerCase(), c = z(e).toLowerCase(), l, u = !0;
	if (r && s !== "map" && s !== "set" && new H(n, i, o, !0).to.have.property("length"), !r && s === "date" && c !== "date") l = a + "the argument to least must be a date";
	else if (!U(e) && (r || U(n))) l = a + "the argument to least must be a number";
	else if (!r && s !== "date" && !U(n)) {
		let e = s === "string" ? "'" + n + "'" : n;
		l = a + "expected " + e + " to be a number or a date";
	} else u = !1;
	if (u) throw new B(l, void 0, o);
	if (r) {
		let t = "length", r;
		s === "map" || s === "set" ? (t = "size", r = n.size) : r = n.length, this.assert(r >= e, "expected #{this} to have a " + t + " at least #{exp} but got #{act}", "expected #{this} to have a " + t + " below #{exp}", e, r);
	} else this.assert(n >= e, "expected #{this} to be at least #{exp}", "expected #{this} to be below #{exp}", e);
}
L(Jd, "assertLeast"), H.addMethod("least", Jd), H.addMethod("gte", Jd), H.addMethod("greaterThanOrEqual", Jd);
function Yd(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = W(this, "doLength"), i = W(this, "message"), a = i ? i + ": " : "", o = W(this, "ssfi"), s = z(n).toLowerCase(), c = z(e).toLowerCase(), l, u = !0;
	if (r && s !== "map" && s !== "set" && new H(n, i, o, !0).to.have.property("length"), !r && s === "date" && c !== "date") l = a + "the argument to below must be a date";
	else if (!U(e) && (r || U(n))) l = a + "the argument to below must be a number";
	else if (!r && s !== "date" && !U(n)) {
		let e = s === "string" ? "'" + n + "'" : n;
		l = a + "expected " + e + " to be a number or a date";
	} else u = !1;
	if (u) throw new B(l, void 0, o);
	if (r) {
		let t = "length", r;
		s === "map" || s === "set" ? (t = "size", r = n.size) : r = n.length, this.assert(r < e, "expected #{this} to have a " + t + " below #{exp} but got #{act}", "expected #{this} to not have a " + t + " below #{exp}", e, r);
	} else this.assert(n < e, "expected #{this} to be below #{exp}", "expected #{this} to be at least #{exp}", e);
}
L(Yd, "assertBelow"), H.addMethod("below", Yd), H.addMethod("lt", Yd), H.addMethod("lessThan", Yd);
function Xd(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = W(this, "doLength"), i = W(this, "message"), a = i ? i + ": " : "", o = W(this, "ssfi"), s = z(n).toLowerCase(), c = z(e).toLowerCase(), l, u = !0;
	if (r && s !== "map" && s !== "set" && new H(n, i, o, !0).to.have.property("length"), !r && s === "date" && c !== "date") l = a + "the argument to most must be a date";
	else if (!U(e) && (r || U(n))) l = a + "the argument to most must be a number";
	else if (!r && s !== "date" && !U(n)) {
		let e = s === "string" ? "'" + n + "'" : n;
		l = a + "expected " + e + " to be a number or a date";
	} else u = !1;
	if (u) throw new B(l, void 0, o);
	if (r) {
		let t = "length", r;
		s === "map" || s === "set" ? (t = "size", r = n.size) : r = n.length, this.assert(r <= e, "expected #{this} to have a " + t + " at most #{exp} but got #{act}", "expected #{this} to have a " + t + " above #{exp}", e, r);
	} else this.assert(n <= e, "expected #{this} to be at most #{exp}", "expected #{this} to be above #{exp}", e);
}
L(Xd, "assertMost"), H.addMethod("most", Xd), H.addMethod("lte", Xd), H.addMethod("lessThanOrEqual", Xd), H.addMethod("within", function(e, t, n) {
	n && W(this, "message", n);
	let r = W(this, "object"), i = W(this, "doLength"), a = W(this, "message"), o = a ? a + ": " : "", s = W(this, "ssfi"), c = z(r).toLowerCase(), l = z(e).toLowerCase(), u = z(t).toLowerCase(), d, f = !0, p = l === "date" && u === "date" ? e.toISOString() + ".." + t.toISOString() : e + ".." + t;
	if (i && c !== "map" && c !== "set" && new H(r, a, s, !0).to.have.property("length"), !i && c === "date" && (l !== "date" || u !== "date")) d = o + "the arguments to within must be dates";
	else if ((!U(e) || !U(t)) && (i || U(r))) d = o + "the arguments to within must be numbers";
	else if (!i && c !== "date" && !U(r)) {
		let e = c === "string" ? "'" + r + "'" : r;
		d = o + "expected " + e + " to be a number or a date";
	} else f = !1;
	if (f) throw new B(d, void 0, s);
	if (i) {
		let n = "length", i;
		c === "map" || c === "set" ? (n = "size", i = r.size) : i = r.length, this.assert(i >= e && i <= t, "expected #{this} to have a " + n + " within " + p, "expected #{this} to not have a " + n + " within " + p);
	} else this.assert(r >= e && r <= t, "expected #{this} to be within " + p, "expected #{this} to not be within " + p);
});
function Zd(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = W(this, "ssfi"), i = W(this, "message"), a;
	try {
		a = n instanceof e;
	} catch (t) {
		throw t instanceof TypeError ? (i = i ? i + ": " : "", new B(i + "The instanceof assertion needs a constructor but " + z(e) + " was given.", void 0, r)) : t;
	}
	let o = Id(e);
	o ??= "an unnamed constructor", this.assert(a, "expected #{this} to be an instance of " + o, "expected #{this} to not be an instance of " + o);
}
L(Zd, "assertInstanceOf"), H.addMethod("instanceof", Zd), H.addMethod("instanceOf", Zd);
function Qd(e, t, n) {
	n && W(this, "message", n);
	let r = W(this, "nested"), i = W(this, "own"), a = W(this, "message"), o = W(this, "object"), s = W(this, "ssfi"), c = typeof e;
	if (a = a ? a + ": " : "", r) {
		if (c !== "string") throw new B(a + "the argument to property must be a string when using nested syntax", void 0, s);
	} else if (c !== "string" && c !== "number" && c !== "symbol") throw new B(a + "the argument to property must be a string, number, or symbol", void 0, s);
	if (r && i) throw new B(a + "The \"nested\" and \"own\" flags cannot be combined.", void 0, s);
	if (o == null) throw new B(a + "Target cannot be null or undefined.", void 0, s);
	let l = W(this, "deep"), u = W(this, "negate"), d = r ? ud(o, e) : null, f = r ? d.value : o[e], p = l ? W(this, "eql") : (e, t) => e === t, m = "";
	l && (m += "deep "), i && (m += "own "), r && (m += "nested "), m += "property ";
	let h;
	h = i ? Object.prototype.hasOwnProperty.call(o, e) : r ? d.exists : sd(o, e), u && arguments.length !== 1 || this.assert(h, "expected #{this} to have " + m + V(e), "expected #{this} to not have " + m + V(e)), arguments.length > 1 && this.assert(h && p(t, f), "expected #{this} to have " + m + V(e) + " of #{exp}, but got #{act}", "expected #{this} to not have " + m + V(e) + " of #{act}", t, f), W(this, "object", f);
}
L(Qd, "assertProperty"), H.addMethod("property", Qd);
function $d(e, t, n) {
	W(this, "own", !0), Qd.apply(this, arguments);
}
L($d, "assertOwnProperty"), H.addMethod("ownProperty", $d), H.addMethod("haveOwnProperty", $d);
function ef(e, t, n) {
	typeof t == "string" && (n = t, t = null), n && W(this, "message", n);
	let r = W(this, "object"), i = Object.getOwnPropertyDescriptor(Object(r), e), a = W(this, "eql");
	i && t ? this.assert(a(t, i), "expected the own property descriptor for " + V(e) + " on #{this} to match " + V(t) + ", got " + V(i), "expected the own property descriptor for " + V(e) + " on #{this} to not match " + V(t), t, i, !0) : this.assert(i, "expected #{this} to have an own property descriptor for " + V(e), "expected #{this} to not have an own property descriptor for " + V(e)), W(this, "object", i);
}
L(ef, "assertOwnPropertyDescriptor"), H.addMethod("ownPropertyDescriptor", ef), H.addMethod("haveOwnPropertyDescriptor", ef);
function tf() {
	W(this, "doLength", !0);
}
L(tf, "assertLengthChain");
function nf(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = z(n).toLowerCase(), i = W(this, "message"), a = W(this, "ssfi"), o = "length", s;
	switch (r) {
		case "map":
		case "set":
			o = "size", s = n.size;
			break;
		default: new H(n, i, a, !0).to.have.property("length"), s = n.length;
	}
	this.assert(s == e, "expected #{this} to have a " + o + " of #{exp} but got #{act}", "expected #{this} to not have a " + o + " of #{act}", e, s);
}
L(nf, "assertLength"), H.addChainableMethod("length", nf, tf), H.addChainableMethod("lengthOf", nf, tf);
function rf(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object");
	this.assert(e.exec(n), "expected #{this} to match " + e, "expected #{this} not to match " + e);
}
L(rf, "assertMatch"), H.addMethod("match", rf), H.addMethod("matches", rf), H.addMethod("string", function(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object");
	new H(n, W(this, "message"), W(this, "ssfi"), !0).is.a("string"), this.assert(~n.indexOf(e), "expected #{this} to contain " + V(e), "expected #{this} to not contain " + V(e));
});
function af(e) {
	let t = W(this, "object"), n = z(t), r = z(e), i = W(this, "ssfi"), a = W(this, "deep"), o, s = "", c, l = !0, u = W(this, "message");
	u = u ? u + ": " : "";
	let d = u + "when testing keys against an object or an array you must give a single Array|Object|String argument or multiple String arguments";
	if (n === "Map" || n === "Set") s = a ? "deeply " : "", c = [], t.forEach(function(e, t) {
		c.push(t);
	}), r !== "Array" && (e = Array.prototype.slice.call(arguments));
	else {
		switch (c = Md(t), r) {
			case "Array":
				if (arguments.length > 1) throw new B(d, void 0, i);
				break;
			case "Object":
				if (arguments.length > 1) throw new B(d, void 0, i);
				e = Object.keys(e);
				break;
			default: e = Array.prototype.slice.call(arguments);
		}
		e = e.map(function(e) {
			return typeof e == "symbol" ? e : String(e);
		});
	}
	if (!e.length) throw new B(u + "keys required", void 0, i);
	let f = e.length, p = W(this, "any"), m = W(this, "all"), h = e, g = a ? W(this, "eql") : (e, t) => e === t;
	if (!p && !m && (m = !0), p && (l = h.some(function(e) {
		return c.some(function(t) {
			return g(e, t);
		});
	})), m && (l = h.every(function(e) {
		return c.some(function(t) {
			return g(e, t);
		});
	}), W(this, "contains") || (l &&= e.length == c.length)), f > 1) {
		e = e.map(function(e) {
			return V(e);
		});
		let t = e.pop();
		m && (o = e.join(", ") + ", and " + t), p && (o = e.join(", ") + ", or " + t);
	} else o = V(e[0]);
	o = (f > 1 ? "keys " : "key ") + o, o = (W(this, "contains") ? "contain " : "have ") + o, this.assert(l, "expected #{this} to " + s + o, "expected #{this} to not " + s + o, h.slice(0).sort(Ad), c.sort(Ad), !0);
}
L(af, "assertKeys"), H.addMethod("keys", af), H.addMethod("key", af);
function of(e, t, n) {
	n && W(this, "message", n);
	let r = W(this, "object"), i = W(this, "ssfi"), a = W(this, "message"), o = W(this, "negate") || !1;
	new H(r, a, i, !0).is.a("function"), (Ld(e) || typeof e == "string") && (t = e, e = null);
	let s, c = !1;
	try {
		r();
	} catch (e) {
		c = !0, s = e;
	}
	let l = e === void 0 && t === void 0, u = !!(e && t), d = !1, f = !1;
	if (l || !l && !o) {
		let t = "an error";
		e instanceof Error ? t = "#{exp}" : e && (t = Tl.getConstructorName(e));
		let n = s;
		if (s instanceof Error) n = s.toString();
		else if (typeof s == "string") n = s;
		else if (s && (typeof s == "object" || typeof s == "function")) try {
			n = Tl.getConstructorName(s);
		} catch {}
		this.assert(c, "expected #{this} to throw " + t, "expected #{this} to not throw an error but #{act} was thrown", e && e.toString(), n);
	}
	if (e && s && (e instanceof Error && Tl.compatibleInstance(s, e) === o && (u && o ? d = !0 : this.assert(o, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (s && !o ? " but #{act} was thrown" : ""), e.toString(), s.toString())), Tl.compatibleConstructor(s, e) === o && (u && o ? d = !0 : this.assert(o, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (s ? " but #{act} was thrown" : ""), e instanceof Error ? e.toString() : e && Tl.getConstructorName(e), s instanceof Error ? s.toString() : s && Tl.getConstructorName(s)))), s && t != null) {
		let e = "including";
		Ld(t) && (e = "matching"), Tl.compatibleMessage(s, t) === o && (u && o ? f = !0 : this.assert(o, "expected #{this} to throw error " + e + " #{exp} but got #{act}", "expected #{this} to throw error not " + e + " #{exp}", t, Tl.getMessage(s)));
	}
	d && f && this.assert(o, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (s ? " but #{act} was thrown" : ""), e instanceof Error ? e.toString() : e && Tl.getConstructorName(e), s instanceof Error ? s.toString() : s && Tl.getConstructorName(s)), W(this, "object", s);
}
L(of, "assertThrows"), H.addMethod("throw", of), H.addMethod("throws", of), H.addMethod("Throw", of);
function sf(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = W(this, "itself"), i = typeof n == "function" && !r ? n.prototype[e] : n[e];
	this.assert(typeof i == "function", "expected #{this} to respond to " + V(e), "expected #{this} to not respond to " + V(e));
}
L(sf, "respondTo"), H.addMethod("respondTo", sf), H.addMethod("respondsTo", sf), H.addProperty("itself", function() {
	W(this, "itself", !0);
});
function cf(e, t) {
	t && W(this, "message", t);
	let n = e(W(this, "object"));
	this.assert(n, "expected #{this} to satisfy " + Fu(e), "expected #{this} to not satisfy" + Fu(e), !W(this, "negate"), n);
}
L(cf, "satisfy"), H.addMethod("satisfy", cf), H.addMethod("satisfies", cf);
function lf(e, t, n) {
	n && W(this, "message", n);
	let r = W(this, "object"), i = W(this, "message"), a = W(this, "ssfi");
	new H(r, i, a, !0).is.numeric;
	let o = "A `delta` value is required for `closeTo`";
	if (t == null || (new H(t, i, a, !0).is.numeric, o = "A `expected` value is required for `closeTo`", e == null)) throw new B(i ? `${i}: ${o}` : o, void 0, a);
	new H(e, i, a, !0).is.numeric;
	let s = L((e) => e < 0n ? -e : e, "abs"), c = L((e) => parseFloat(parseFloat(e).toPrecision(12)), "strip");
	this.assert(c(s(r - e)) <= t, "expected #{this} to be close to " + e + " +/- " + t, "expected #{this} not to be close to " + e + " +/- " + t);
}
L(lf, "closeTo"), H.addMethod("closeTo", lf), H.addMethod("approximately", lf);
function uf(e, t, n, r, i) {
	let a = Array.from(t), o = Array.from(e);
	if (!r) {
		if (o.length !== a.length) return !1;
		a = a.slice();
	}
	return o.every(function(e, t) {
		if (i) return n ? n(e, a[t]) : e === a[t];
		if (!n) {
			let t = a.indexOf(e);
			return t !== -1 && (r || a.splice(t, 1), !0);
		}
		return a.some(function(t, i) {
			return n(e, t) ? (r || a.splice(i, 1), !0) : !1;
		});
	});
}
L(uf, "isSubsetOf"), H.addMethod("members", function(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = W(this, "message"), i = W(this, "ssfi");
	new H(n, r, i, !0).to.be.iterable, new H(e, r, i, !0).to.be.iterable;
	let a = W(this, "contains"), o = W(this, "ordered"), s, c, l;
	a ? (s = o ? "an ordered superset" : "a superset", c = "expected #{this} to be " + s + " of #{exp}", l = "expected #{this} to not be " + s + " of #{exp}") : (s = o ? "ordered members" : "members", c = "expected #{this} to have the same " + s + " as #{exp}", l = "expected #{this} to not have the same " + s + " as #{exp}");
	let u = W(this, "deep") ? W(this, "eql") : void 0;
	this.assert(uf(e, n, u, a, o), c, l, e, n, !0);
}), H.addProperty("iterable", function(e) {
	e && W(this, "message", e);
	let t = W(this, "object");
	this.assert(t != null && t[Symbol.iterator], "expected #{this} to be an iterable", "expected #{this} to not be an iterable", t);
});
function df(e, t) {
	t && W(this, "message", t);
	let n = W(this, "object"), r = W(this, "message"), i = W(this, "ssfi"), a = W(this, "contains"), o = W(this, "deep"), s = W(this, "eql");
	new H(e, r, i, !0).to.be.an("array"), a ? this.assert(e.some(function(e) {
		return n.indexOf(e) > -1;
	}), "expected #{this} to contain one of #{exp}", "expected #{this} to not contain one of #{exp}", e, n) : o ? this.assert(e.some(function(e) {
		return s(n, e);
	}), "expected #{this} to deeply equal one of #{exp}", "expected #{this} to deeply equal one of #{exp}", e, n) : this.assert(e.indexOf(n) > -1, "expected #{this} to be one of #{exp}", "expected #{this} to not be one of #{exp}", e, n);
}
L(df, "oneOf"), H.addMethod("oneOf", df);
function ff(e, t, n) {
	n && W(this, "message", n);
	let r = W(this, "object"), i = W(this, "message"), a = W(this, "ssfi");
	new H(r, i, a, !0).is.a("function");
	let o;
	t ? (new H(e, i, a, !0).to.have.property(t), o = e[t]) : (new H(e, i, a, !0).is.a("function"), o = e()), r();
	let s = t == null ? e() : e[t], c = t == null ? o : "." + t;
	W(this, "deltaMsgObj", c), W(this, "initialDeltaValue", o), W(this, "finalDeltaValue", s), W(this, "deltaBehavior", "change"), W(this, "realDelta", s !== o), this.assert(o !== s, "expected " + c + " to change", "expected " + c + " to not change");
}
L(ff, "assertChanges"), H.addMethod("change", ff), H.addMethod("changes", ff);
function pf(e, t, n) {
	n && W(this, "message", n);
	let r = W(this, "object"), i = W(this, "message"), a = W(this, "ssfi");
	new H(r, i, a, !0).is.a("function");
	let o;
	t ? (new H(e, i, a, !0).to.have.property(t), o = e[t]) : (new H(e, i, a, !0).is.a("function"), o = e()), new H(o, i, a, !0).is.a("number"), r();
	let s = t == null ? e() : e[t], c = t == null ? o : "." + t;
	W(this, "deltaMsgObj", c), W(this, "initialDeltaValue", o), W(this, "finalDeltaValue", s), W(this, "deltaBehavior", "increase"), W(this, "realDelta", s - o), this.assert(s - o > 0, "expected " + c + " to increase", "expected " + c + " to not increase");
}
L(pf, "assertIncreases"), H.addMethod("increase", pf), H.addMethod("increases", pf);
function mf(e, t, n) {
	n && W(this, "message", n);
	let r = W(this, "object"), i = W(this, "message"), a = W(this, "ssfi");
	new H(r, i, a, !0).is.a("function");
	let o;
	t ? (new H(e, i, a, !0).to.have.property(t), o = e[t]) : (new H(e, i, a, !0).is.a("function"), o = e()), new H(o, i, a, !0).is.a("number"), r();
	let s = t == null ? e() : e[t], c = t == null ? o : "." + t;
	W(this, "deltaMsgObj", c), W(this, "initialDeltaValue", o), W(this, "finalDeltaValue", s), W(this, "deltaBehavior", "decrease"), W(this, "realDelta", o - s), this.assert(s - o < 0, "expected " + c + " to decrease", "expected " + c + " to not decrease");
}
L(mf, "assertDecreases"), H.addMethod("decrease", mf), H.addMethod("decreases", mf);
function hf(e, t) {
	t && W(this, "message", t);
	let n = W(this, "deltaMsgObj"), r = W(this, "initialDeltaValue"), i = W(this, "finalDeltaValue"), a = W(this, "deltaBehavior"), o = W(this, "realDelta"), s;
	s = a === "change" ? Math.abs(i - r) === Math.abs(e) : o === Math.abs(e), this.assert(s, "expected " + n + " to " + a + " by " + e, "expected " + n + " to not " + a + " by " + e);
}
L(hf, "assertDelta"), H.addMethod("by", hf), H.addProperty("extensible", function() {
	let e = W(this, "object"), t = e === Object(e) && Object.isExtensible(e);
	this.assert(t, "expected #{this} to be extensible", "expected #{this} to not be extensible");
}), H.addProperty("sealed", function() {
	let e = W(this, "object"), t = e !== Object(e) || Object.isSealed(e);
	this.assert(t, "expected #{this} to be sealed", "expected #{this} to not be sealed");
}), H.addProperty("frozen", function() {
	let e = W(this, "object"), t = e !== Object(e) || Object.isFrozen(e);
	this.assert(t, "expected #{this} to be frozen", "expected #{this} to not be frozen");
}), H.addProperty("finite", function(e) {
	let t = W(this, "object");
	this.assert(typeof t == "number" && isFinite(t), "expected #{this} to be a finite number", "expected #{this} to not be a finite number");
});
function gf(e, t) {
	return e === t ? !0 : typeof t == typeof e ? typeof e != "object" || !e ? e === t : t ? Array.isArray(e) ? Array.isArray(t) ? e.every(function(e) {
		return t.some(function(t) {
			return gf(e, t);
		});
	}) : !1 : e instanceof Date ? t instanceof Date && e.getTime() === t.getTime() : Object.keys(e).every(function(n) {
		let r = e[n], i = t[n];
		return typeof r == "object" && r && i !== null ? gf(r, i) : typeof r == "function" ? r(i) : i === r;
	}) : !1 : !1;
}
L(gf, "compareSubset"), H.addMethod("containSubset", function(e) {
	let t = R(this, "object"), n = Pu.showDiff;
	this.assert(gf(e, t), "expected #{act} to contain subset #{exp}", "expected #{act} to not contain subset #{exp}", e, t, n);
});
function _f(e, t) {
	return new H(e, t);
}
L(_f, "expect"), _f.fail = function(e, t, n, r) {
	throw arguments.length < 2 && (n = e, e = void 0), n ||= "expect.fail()", new B(n, {
		actual: e,
		expected: t,
		operator: r
	}, _f.fail);
};
var vf = {};
Cl(vf, {
	Should: () => xf,
	should: () => bf
});
function yf() {
	function e() {
		return this instanceof String || this instanceof Number || this instanceof Boolean || typeof Symbol == "function" && this instanceof Symbol || typeof BigInt == "function" && this instanceof BigInt ? new H(this.valueOf(), null, e) : new H(this, null, e);
	}
	L(e, "shouldGetter");
	function t(e) {
		Object.defineProperty(this, "should", {
			value: e,
			enumerable: !0,
			configurable: !0,
			writable: !0
		});
	}
	L(t, "shouldSetter"), Object.defineProperty(Object.prototype, "should", {
		set: t,
		get: e,
		configurable: !0
	});
	let n = {};
	return n.fail = function(e, t, r, i) {
		throw arguments.length < 2 && (r = e, e = void 0), r ||= "should.fail()", new B(r, {
			actual: e,
			expected: t,
			operator: i
		}, n.fail);
	}, n.equal = function(e, t, n) {
		new H(e, n).to.equal(t);
	}, n.Throw = function(e, t, n, r) {
		new H(e, r).to.Throw(t, n);
	}, n.exist = function(e, t) {
		new H(e, t).to.exist;
	}, n.not = {}, n.not.equal = function(e, t, n) {
		new H(e, n).to.not.equal(t);
	}, n.not.Throw = function(e, t, n, r) {
		new H(e, r).to.not.Throw(t, n);
	}, n.not.exist = function(e, t) {
		new H(e, t).to.not.exist;
	}, n.throw = n.Throw, n.not.throw = n.not.Throw, n;
}
L(yf, "loadShould");
var bf = yf, xf = yf;
function G(e, t) {
	new H(null, null, G, !0).assert(e, t, "[ negation message unavailable ]");
}
L(G, "assert"), G.fail = function(e, t, n, r) {
	throw arguments.length < 2 && (n = e, e = void 0), n ||= "assert.fail()", new B(n, {
		actual: e,
		expected: t,
		operator: r
	}, G.fail);
}, G.isOk = function(e, t) {
	new H(e, t, G.isOk, !0).is.ok;
}, G.isNotOk = function(e, t) {
	new H(e, t, G.isNotOk, !0).is.not.ok;
}, G.equal = function(e, t, n) {
	let r = new H(e, n, G.equal, !0);
	r.assert(t == R(r, "object"), "expected #{this} to equal #{exp}", "expected #{this} to not equal #{act}", t, e, !0);
}, G.notEqual = function(e, t, n) {
	let r = new H(e, n, G.notEqual, !0);
	r.assert(t != R(r, "object"), "expected #{this} to not equal #{exp}", "expected #{this} to equal #{act}", t, e, !0);
}, G.strictEqual = function(e, t, n) {
	new H(e, n, G.strictEqual, !0).to.equal(t);
}, G.notStrictEqual = function(e, t, n) {
	new H(e, n, G.notStrictEqual, !0).to.not.equal(t);
}, G.deepEqual = G.deepStrictEqual = function(e, t, n) {
	new H(e, n, G.deepEqual, !0).to.eql(t);
}, G.notDeepEqual = function(e, t, n) {
	new H(e, n, G.notDeepEqual, !0).to.not.eql(t);
}, G.isAbove = function(e, t, n) {
	new H(e, n, G.isAbove, !0).to.be.above(t);
}, G.isAtLeast = function(e, t, n) {
	new H(e, n, G.isAtLeast, !0).to.be.least(t);
}, G.isBelow = function(e, t, n) {
	new H(e, n, G.isBelow, !0).to.be.below(t);
}, G.isAtMost = function(e, t, n) {
	new H(e, n, G.isAtMost, !0).to.be.most(t);
}, G.isTrue = function(e, t) {
	new H(e, t, G.isTrue, !0).is.true;
}, G.isNotTrue = function(e, t) {
	new H(e, t, G.isNotTrue, !0).to.not.equal(!0);
}, G.isFalse = function(e, t) {
	new H(e, t, G.isFalse, !0).is.false;
}, G.isNotFalse = function(e, t) {
	new H(e, t, G.isNotFalse, !0).to.not.equal(!1);
}, G.isNull = function(e, t) {
	new H(e, t, G.isNull, !0).to.equal(null);
}, G.isNotNull = function(e, t) {
	new H(e, t, G.isNotNull, !0).to.not.equal(null);
}, G.isNaN = function(e, t) {
	new H(e, t, G.isNaN, !0).to.be.NaN;
}, G.isNotNaN = function(e, t) {
	new H(e, t, G.isNotNaN, !0).not.to.be.NaN;
}, G.exists = function(e, t) {
	new H(e, t, G.exists, !0).to.exist;
}, G.notExists = function(e, t) {
	new H(e, t, G.notExists, !0).to.not.exist;
}, G.isUndefined = function(e, t) {
	new H(e, t, G.isUndefined, !0).to.equal(void 0);
}, G.isDefined = function(e, t) {
	new H(e, t, G.isDefined, !0).to.not.equal(void 0);
}, G.isCallable = function(e, t) {
	new H(e, t, G.isCallable, !0).is.callable;
}, G.isNotCallable = function(e, t) {
	new H(e, t, G.isNotCallable, !0).is.not.callable;
}, G.isObject = function(e, t) {
	new H(e, t, G.isObject, !0).to.be.a("object");
}, G.isNotObject = function(e, t) {
	new H(e, t, G.isNotObject, !0).to.not.be.a("object");
}, G.isArray = function(e, t) {
	new H(e, t, G.isArray, !0).to.be.an("array");
}, G.isNotArray = function(e, t) {
	new H(e, t, G.isNotArray, !0).to.not.be.an("array");
}, G.isString = function(e, t) {
	new H(e, t, G.isString, !0).to.be.a("string");
}, G.isNotString = function(e, t) {
	new H(e, t, G.isNotString, !0).to.not.be.a("string");
}, G.isNumber = function(e, t) {
	new H(e, t, G.isNumber, !0).to.be.a("number");
}, G.isNotNumber = function(e, t) {
	new H(e, t, G.isNotNumber, !0).to.not.be.a("number");
}, G.isNumeric = function(e, t) {
	new H(e, t, G.isNumeric, !0).is.numeric;
}, G.isNotNumeric = function(e, t) {
	new H(e, t, G.isNotNumeric, !0).is.not.numeric;
}, G.isFinite = function(e, t) {
	new H(e, t, G.isFinite, !0).to.be.finite;
}, G.isBoolean = function(e, t) {
	new H(e, t, G.isBoolean, !0).to.be.a("boolean");
}, G.isNotBoolean = function(e, t) {
	new H(e, t, G.isNotBoolean, !0).to.not.be.a("boolean");
}, G.typeOf = function(e, t, n) {
	new H(e, n, G.typeOf, !0).to.be.a(t);
}, G.notTypeOf = function(e, t, n) {
	new H(e, n, G.notTypeOf, !0).to.not.be.a(t);
}, G.instanceOf = function(e, t, n) {
	new H(e, n, G.instanceOf, !0).to.be.instanceOf(t);
}, G.notInstanceOf = function(e, t, n) {
	new H(e, n, G.notInstanceOf, !0).to.not.be.instanceOf(t);
}, G.include = function(e, t, n) {
	new H(e, n, G.include, !0).include(t);
}, G.notInclude = function(e, t, n) {
	new H(e, n, G.notInclude, !0).not.include(t);
}, G.deepInclude = function(e, t, n) {
	new H(e, n, G.deepInclude, !0).deep.include(t);
}, G.notDeepInclude = function(e, t, n) {
	new H(e, n, G.notDeepInclude, !0).not.deep.include(t);
}, G.nestedInclude = function(e, t, n) {
	new H(e, n, G.nestedInclude, !0).nested.include(t);
}, G.notNestedInclude = function(e, t, n) {
	new H(e, n, G.notNestedInclude, !0).not.nested.include(t);
}, G.deepNestedInclude = function(e, t, n) {
	new H(e, n, G.deepNestedInclude, !0).deep.nested.include(t);
}, G.notDeepNestedInclude = function(e, t, n) {
	new H(e, n, G.notDeepNestedInclude, !0).not.deep.nested.include(t);
}, G.ownInclude = function(e, t, n) {
	new H(e, n, G.ownInclude, !0).own.include(t);
}, G.notOwnInclude = function(e, t, n) {
	new H(e, n, G.notOwnInclude, !0).not.own.include(t);
}, G.deepOwnInclude = function(e, t, n) {
	new H(e, n, G.deepOwnInclude, !0).deep.own.include(t);
}, G.notDeepOwnInclude = function(e, t, n) {
	new H(e, n, G.notDeepOwnInclude, !0).not.deep.own.include(t);
}, G.match = function(e, t, n) {
	new H(e, n, G.match, !0).to.match(t);
}, G.notMatch = function(e, t, n) {
	new H(e, n, G.notMatch, !0).to.not.match(t);
}, G.property = function(e, t, n) {
	new H(e, n, G.property, !0).to.have.property(t);
}, G.notProperty = function(e, t, n) {
	new H(e, n, G.notProperty, !0).to.not.have.property(t);
}, G.propertyVal = function(e, t, n, r) {
	new H(e, r, G.propertyVal, !0).to.have.property(t, n);
}, G.notPropertyVal = function(e, t, n, r) {
	new H(e, r, G.notPropertyVal, !0).to.not.have.property(t, n);
}, G.deepPropertyVal = function(e, t, n, r) {
	new H(e, r, G.deepPropertyVal, !0).to.have.deep.property(t, n);
}, G.notDeepPropertyVal = function(e, t, n, r) {
	new H(e, r, G.notDeepPropertyVal, !0).to.not.have.deep.property(t, n);
}, G.ownProperty = function(e, t, n) {
	new H(e, n, G.ownProperty, !0).to.have.own.property(t);
}, G.notOwnProperty = function(e, t, n) {
	new H(e, n, G.notOwnProperty, !0).to.not.have.own.property(t);
}, G.ownPropertyVal = function(e, t, n, r) {
	new H(e, r, G.ownPropertyVal, !0).to.have.own.property(t, n);
}, G.notOwnPropertyVal = function(e, t, n, r) {
	new H(e, r, G.notOwnPropertyVal, !0).to.not.have.own.property(t, n);
}, G.deepOwnPropertyVal = function(e, t, n, r) {
	new H(e, r, G.deepOwnPropertyVal, !0).to.have.deep.own.property(t, n);
}, G.notDeepOwnPropertyVal = function(e, t, n, r) {
	new H(e, r, G.notDeepOwnPropertyVal, !0).to.not.have.deep.own.property(t, n);
}, G.nestedProperty = function(e, t, n) {
	new H(e, n, G.nestedProperty, !0).to.have.nested.property(t);
}, G.notNestedProperty = function(e, t, n) {
	new H(e, n, G.notNestedProperty, !0).to.not.have.nested.property(t);
}, G.nestedPropertyVal = function(e, t, n, r) {
	new H(e, r, G.nestedPropertyVal, !0).to.have.nested.property(t, n);
}, G.notNestedPropertyVal = function(e, t, n, r) {
	new H(e, r, G.notNestedPropertyVal, !0).to.not.have.nested.property(t, n);
}, G.deepNestedPropertyVal = function(e, t, n, r) {
	new H(e, r, G.deepNestedPropertyVal, !0).to.have.deep.nested.property(t, n);
}, G.notDeepNestedPropertyVal = function(e, t, n, r) {
	new H(e, r, G.notDeepNestedPropertyVal, !0).to.not.have.deep.nested.property(t, n);
}, G.lengthOf = function(e, t, n) {
	new H(e, n, G.lengthOf, !0).to.have.lengthOf(t);
}, G.hasAnyKeys = function(e, t, n) {
	new H(e, n, G.hasAnyKeys, !0).to.have.any.keys(t);
}, G.hasAllKeys = function(e, t, n) {
	new H(e, n, G.hasAllKeys, !0).to.have.all.keys(t);
}, G.containsAllKeys = function(e, t, n) {
	new H(e, n, G.containsAllKeys, !0).to.contain.all.keys(t);
}, G.doesNotHaveAnyKeys = function(e, t, n) {
	new H(e, n, G.doesNotHaveAnyKeys, !0).to.not.have.any.keys(t);
}, G.doesNotHaveAllKeys = function(e, t, n) {
	new H(e, n, G.doesNotHaveAllKeys, !0).to.not.have.all.keys(t);
}, G.hasAnyDeepKeys = function(e, t, n) {
	new H(e, n, G.hasAnyDeepKeys, !0).to.have.any.deep.keys(t);
}, G.hasAllDeepKeys = function(e, t, n) {
	new H(e, n, G.hasAllDeepKeys, !0).to.have.all.deep.keys(t);
}, G.containsAllDeepKeys = function(e, t, n) {
	new H(e, n, G.containsAllDeepKeys, !0).to.contain.all.deep.keys(t);
}, G.doesNotHaveAnyDeepKeys = function(e, t, n) {
	new H(e, n, G.doesNotHaveAnyDeepKeys, !0).to.not.have.any.deep.keys(t);
}, G.doesNotHaveAllDeepKeys = function(e, t, n) {
	new H(e, n, G.doesNotHaveAllDeepKeys, !0).to.not.have.all.deep.keys(t);
}, G.throws = function(e, t, n, r) {
	return (typeof t == "string" || t instanceof RegExp) && (n = t, t = null), R(new H(e, r, G.throws, !0).to.throw(t, n), "object");
}, G.doesNotThrow = function(e, t, n, r) {
	(typeof t == "string" || t instanceof RegExp) && (n = t, t = null), new H(e, r, G.doesNotThrow, !0).to.not.throw(t, n);
}, G.operator = function(e, t, n, r) {
	let i;
	switch (t) {
		case "==":
			i = e == n;
			break;
		case "===":
			i = e === n;
			break;
		case ">":
			i = e > n;
			break;
		case ">=":
			i = e >= n;
			break;
		case "<":
			i = e < n;
			break;
		case "<=":
			i = e <= n;
			break;
		case "!=":
			i = e != n;
			break;
		case "!==":
			i = e !== n;
			break;
		default: throw r &&= r + ": ", new B(r + "Invalid operator \"" + t + "\"", void 0, G.operator);
	}
	let a = new H(i, r, G.operator, !0);
	a.assert(R(a, "object") === !0, "expected " + V(e) + " to be " + t + " " + V(n), "expected " + V(e) + " to not be " + t + " " + V(n));
}, G.closeTo = function(e, t, n, r) {
	new H(e, r, G.closeTo, !0).to.be.closeTo(t, n);
}, G.approximately = function(e, t, n, r) {
	new H(e, r, G.approximately, !0).to.be.approximately(t, n);
}, G.sameMembers = function(e, t, n) {
	new H(e, n, G.sameMembers, !0).to.have.same.members(t);
}, G.notSameMembers = function(e, t, n) {
	new H(e, n, G.notSameMembers, !0).to.not.have.same.members(t);
}, G.sameDeepMembers = function(e, t, n) {
	new H(e, n, G.sameDeepMembers, !0).to.have.same.deep.members(t);
}, G.notSameDeepMembers = function(e, t, n) {
	new H(e, n, G.notSameDeepMembers, !0).to.not.have.same.deep.members(t);
}, G.sameOrderedMembers = function(e, t, n) {
	new H(e, n, G.sameOrderedMembers, !0).to.have.same.ordered.members(t);
}, G.notSameOrderedMembers = function(e, t, n) {
	new H(e, n, G.notSameOrderedMembers, !0).to.not.have.same.ordered.members(t);
}, G.sameDeepOrderedMembers = function(e, t, n) {
	new H(e, n, G.sameDeepOrderedMembers, !0).to.have.same.deep.ordered.members(t);
}, G.notSameDeepOrderedMembers = function(e, t, n) {
	new H(e, n, G.notSameDeepOrderedMembers, !0).to.not.have.same.deep.ordered.members(t);
}, G.includeMembers = function(e, t, n) {
	new H(e, n, G.includeMembers, !0).to.include.members(t);
}, G.notIncludeMembers = function(e, t, n) {
	new H(e, n, G.notIncludeMembers, !0).to.not.include.members(t);
}, G.includeDeepMembers = function(e, t, n) {
	new H(e, n, G.includeDeepMembers, !0).to.include.deep.members(t);
}, G.notIncludeDeepMembers = function(e, t, n) {
	new H(e, n, G.notIncludeDeepMembers, !0).to.not.include.deep.members(t);
}, G.includeOrderedMembers = function(e, t, n) {
	new H(e, n, G.includeOrderedMembers, !0).to.include.ordered.members(t);
}, G.notIncludeOrderedMembers = function(e, t, n) {
	new H(e, n, G.notIncludeOrderedMembers, !0).to.not.include.ordered.members(t);
}, G.includeDeepOrderedMembers = function(e, t, n) {
	new H(e, n, G.includeDeepOrderedMembers, !0).to.include.deep.ordered.members(t);
}, G.notIncludeDeepOrderedMembers = function(e, t, n) {
	new H(e, n, G.notIncludeDeepOrderedMembers, !0).to.not.include.deep.ordered.members(t);
}, G.oneOf = function(e, t, n) {
	new H(e, n, G.oneOf, !0).to.be.oneOf(t);
}, G.isIterable = function(e, t) {
	if (e == null || !e[Symbol.iterator]) throw t = t ? `${t} expected ${V(e)} to be an iterable` : `expected ${V(e)} to be an iterable`, new B(t, void 0, G.isIterable);
}, G.changes = function(e, t, n, r) {
	arguments.length === 3 && typeof t == "function" && (r = n, n = null), new H(e, r, G.changes, !0).to.change(t, n);
}, G.changesBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new H(e, i, G.changesBy, !0).to.change(t, n).by(r);
}, G.doesNotChange = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new H(e, r, G.doesNotChange, !0).to.not.change(t, n);
}, G.changesButNotBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new H(e, i, G.changesButNotBy, !0).to.change(t, n).but.not.by(r);
}, G.increases = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new H(e, r, G.increases, !0).to.increase(t, n);
}, G.increasesBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new H(e, i, G.increasesBy, !0).to.increase(t, n).by(r);
}, G.doesNotIncrease = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new H(e, r, G.doesNotIncrease, !0).to.not.increase(t, n);
}, G.increasesButNotBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new H(e, i, G.increasesButNotBy, !0).to.increase(t, n).but.not.by(r);
}, G.decreases = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new H(e, r, G.decreases, !0).to.decrease(t, n);
}, G.decreasesBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new H(e, i, G.decreasesBy, !0).to.decrease(t, n).by(r);
}, G.doesNotDecrease = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new H(e, r, G.doesNotDecrease, !0).to.not.decrease(t, n);
}, G.doesNotDecreaseBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	return new H(e, i, G.doesNotDecreaseBy, !0).to.not.decrease(t, n).by(r);
}, G.decreasesButNotBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new H(e, i, G.decreasesButNotBy, !0).to.decrease(t, n).but.not.by(r);
}, G.ifError = function(e) {
	if (e) throw e;
}, G.isExtensible = function(e, t) {
	new H(e, t, G.isExtensible, !0).to.be.extensible;
}, G.isNotExtensible = function(e, t) {
	new H(e, t, G.isNotExtensible, !0).to.not.be.extensible;
}, G.isSealed = function(e, t) {
	new H(e, t, G.isSealed, !0).to.be.sealed;
}, G.isNotSealed = function(e, t) {
	new H(e, t, G.isNotSealed, !0).to.not.be.sealed;
}, G.isFrozen = function(e, t) {
	new H(e, t, G.isFrozen, !0).to.be.frozen;
}, G.isNotFrozen = function(e, t) {
	new H(e, t, G.isNotFrozen, !0).to.not.be.frozen;
}, G.isEmpty = function(e, t) {
	new H(e, t, G.isEmpty, !0).to.be.empty;
}, G.isNotEmpty = function(e, t) {
	new H(e, t, G.isNotEmpty, !0).to.not.be.empty;
}, G.containsSubset = function(e, t, n) {
	new H(e, n).to.containSubset(t);
}, G.doesNotContainSubset = function(e, t, n) {
	new H(e, n).to.not.containSubset(t);
};
for (let [e, t] of [
	["isOk", "ok"],
	["isNotOk", "notOk"],
	["throws", "throw"],
	["throws", "Throw"],
	["isExtensible", "extensible"],
	["isNotExtensible", "notExtensible"],
	["isSealed", "sealed"],
	["isNotSealed", "notSealed"],
	["isFrozen", "frozen"],
	["isNotFrozen", "notFrozen"],
	["isEmpty", "empty"],
	["isNotEmpty", "notEmpty"],
	["isCallable", "isFunction"],
	["isNotCallable", "isNotFunction"],
	["containsSubset", "containSubset"]
]) G[t] = G[e];
var Sf = [];
function Cf(e) {
	let t = {
		use: Cf,
		AssertionError: B,
		util: wl,
		config: Pu,
		expect: _f,
		assert: G,
		Assertion: H,
		...vf
	};
	return ~Sf.indexOf(e) || (e(t, wl), Sf.push(e)), t;
}
L(Cf, "use");
var wf = {};
Vi(wf, {
	toAppearAfter: () => Qh,
	toAppearBefore: () => Zh,
	toBeChecked: () => jh,
	toBeDisabled: () => dh,
	toBeEmpty: () => vm,
	toBeEmptyDOMElement: () => ym,
	toBeEnabled: () => fh,
	toBeInTheDOM: () => gm,
	toBeInTheDocument: () => _m,
	toBeInvalid: () => Th,
	toBePartiallyChecked: () => Fh,
	toBePartiallyPressed: () => Vh,
	toBePressed: () => Bh,
	toBeRequired: () => bh,
	toBeValid: () => Eh,
	toBeVisible: () => nh,
	toContainElement: () => xm,
	toContainHTML: () => Cm,
	toHaveAccessibleDescription: () => Tm,
	toHaveAccessibleErrorMessage: () => Om,
	toHaveAccessibleName: () => Pm,
	toHaveAttribute: () => Lm,
	toHaveClass: () => Vm,
	toHaveDescription: () => Ih,
	toHaveDisplayValue: () => Oh,
	toHaveErrorMessage: () => Lh,
	toHaveFocus: () => qm,
	toHaveFormValues: () => Qm,
	toHaveRole: () => Am,
	toHaveSelection: () => zh,
	toHaveStyle: () => Km,
	toHaveTextContent: () => wm,
	toHaveValue: () => Dh
});
var Tf = Ui(jo(), 1);
function Ef(e) {
	Object.defineProperty(e, "__esModule", {
		value: !0,
		configurable: !0
	});
}
function Df(e, t, n, r) {
	Object.defineProperty(e, t, {
		get: n,
		set: r,
		enumerable: !0,
		configurable: !0
	});
}
var Of = {};
Ef(Of), Df(Of, "default", () => kf);
var kf = class extends Error {
	constructor(e, t, n, r, i) {
		super(e + ":" + n + ":" + r + ": " + t), this.reason = t, this.filename = e, this.line = n, this.column = r, this.source = i;
	}
}, Af = {};
Ef(Af), Df(Af, "default", () => jf);
var jf = class {
	constructor(e, t, n) {
		this.start = e, this.end = t, this.source = n;
	}
};
Df({}, "CssTypes", () => K);
var K;
(function(e) {
	e.stylesheet = "stylesheet", e.rule = "rule", e.declaration = "declaration", e.comment = "comment", e.container = "container", e.charset = "charset", e.document = "document", e.customMedia = "custom-media", e.fontFace = "font-face", e.host = "host", e.import = "import", e.keyframes = "keyframes", e.keyframe = "keyframe", e.layer = "layer", e.media = "media", e.namespace = "namespace", e.page = "page", e.startingStyle = "starting-style", e.supports = "supports";
})(K ||= {});
var Mf = /\/\*[^]*?(?:\*\/|$)/g, Nf = (e, t) => {
	t ||= {};
	let n = 1, r = 1;
	function i(e) {
		let t = e.match(/\n/g);
		t && (n += t.length);
		let i = e.lastIndexOf("\n");
		r = ~i ? e.length - i : r + e.length;
	}
	function a() {
		let e = {
			line: n,
			column: r
		};
		return function(i) {
			return i.position = new jf(e, {
				line: n,
				column: r
			}, t?.source || ""), p(), i;
		};
	}
	let o = [];
	function s(i) {
		let a = new kf(t?.source || "", i, n, r, e);
		if (t?.silent) o.push(a);
		else throw a;
	}
	function c() {
		let e = d();
		return {
			type: K.stylesheet,
			stylesheet: {
				source: t?.source,
				rules: e,
				parsingErrors: o
			}
		};
	}
	function l() {
		return f(/^{\s*/);
	}
	function u() {
		return f(/^}/);
	}
	function d() {
		let t, n = [];
		for (p(), m(n); e.length && e.charAt(0) !== "}" && (t = ce() || le());) t && (n.push(t), m(n));
		return n;
	}
	function f(t) {
		let n = t.exec(e);
		if (!n) return;
		let r = n[0];
		return i(r), e = e.slice(r.length), n;
	}
	function p() {
		f(/^\s*/);
	}
	function m(e) {
		let t;
		for (e ||= []; t = h();) t && e.push(t);
		return e;
	}
	function h() {
		let t = a();
		if (e.charAt(0) !== "/" || e.charAt(1) !== "*") return;
		let n = f(/^\/\*[^]*?\*\//);
		return n ? t({
			type: K.comment,
			comment: n[0].slice(2, -2)
		}) : s("End of comment missing");
	}
	function g(e, t, n) {
		let r = t + 1, i = !1, a = e.indexOf(")", r);
		for (; !i && a !== -1;) {
			let t = e.indexOf("(", r);
			t !== -1 && t < a ? (r = g(e, t + 1, n + 1) + 1, a = e.indexOf(")", r)) : i = !0;
		}
		return i && a !== -1 ? a : -1;
	}
	function _() {
		let e = f(/^([^{]+)/);
		if (!e) return;
		let t = Pf(e[0]).replace(Mf, "");
		if (t.indexOf(",") === -1) return [t];
		let n = 0, r = t.indexOf("(", n);
		for (; r !== -1;) {
			let e = g(t, r, 0);
			if (e === -1) break;
			n = e + 1, t = t.substring(0, r) + t.substring(r, e).replace(/,/g, "‌") + t.substring(e), r = t.indexOf("(", n);
		}
		return t = t.replace(/("|')(?:\\\1|.)*?\1/g, (e) => e.replace(/,/g, "‌")), t.split(",").map((e) => Pf(e.replace(/\u200C/g, ",")));
	}
	function v() {
		let e = a(), t = f(/^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/);
		if (!t) return;
		let n = Pf(t[0]);
		if (!f(/^:\s*/)) return s("property missing ':'");
		let r = f(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/), i = e({
			type: K.declaration,
			property: n.replace(Mf, ""),
			value: r ? Pf(r[0]).replace(Mf, "") : ""
		});
		return f(/^[;\s]*/), i;
	}
	function y() {
		let e = [];
		if (!l()) return s("missing '{'");
		m(e);
		let t;
		for (; t = v();) t && (e.push(t), m(e));
		return u() ? e : s("missing '}'");
	}
	function b() {
		let e, t = [], n = a();
		for (; e = f(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/);) t.push(e[1]), f(/^,\s*/);
		if (t.length) return n({
			type: K.keyframe,
			values: t,
			declarations: y() || []
		});
	}
	function x() {
		let e = a(), t = f(/^@([-\w]+)?keyframes\s*/);
		if (!t) return;
		let n = t[1], r = f(/^([-\w]+)\s*/);
		if (!r) return s("@keyframes missing name");
		let i = r[1];
		if (!l()) return s("@keyframes missing '{'");
		let o, c = m();
		for (; o = b();) c.push(o), c = c.concat(m());
		return u() ? e({
			type: K.keyframes,
			name: i,
			vendor: n,
			keyframes: c
		}) : s("@keyframes missing '}'");
	}
	function ee() {
		let e = a(), t = f(/^@supports *([^{]+)/);
		if (!t) return;
		let n = Pf(t[1]);
		if (!l()) return s("@supports missing '{'");
		let r = m().concat(d());
		return u() ? e({
			type: K.supports,
			supports: n,
			rules: r
		}) : s("@supports missing '}'");
	}
	function te() {
		let e = a();
		if (!f(/^@host\s*/)) return;
		if (!l()) return s("@host missing '{'");
		let t = m().concat(d());
		return u() ? e({
			type: K.host,
			rules: t
		}) : s("@host missing '}'");
	}
	function S() {
		let e = a(), t = f(/^@container *([^{]+)/);
		if (!t) return;
		let n = Pf(t[1]);
		if (!l()) return s("@container missing '{'");
		let r = m().concat(d());
		return u() ? e({
			type: K.container,
			container: n,
			rules: r
		}) : s("@container missing '}'");
	}
	function C() {
		let e = a(), t = f(/^@layer *([^{;@]+)/);
		if (!t) return;
		let n = Pf(t[1]);
		if (!l()) return f(/^[;\s]*/), e({
			type: K.layer,
			layer: n
		});
		let r = m().concat(d());
		return u() ? e({
			type: K.layer,
			layer: n,
			rules: r
		}) : s("@layer missing '}'");
	}
	function ne() {
		let e = a(), t = f(/^@media *([^{]+)/);
		if (!t) return;
		let n = Pf(t[1]);
		if (!l()) return s("@media missing '{'");
		let r = m().concat(d());
		return u() ? e({
			type: K.media,
			media: n,
			rules: r
		}) : s("@media missing '}'");
	}
	function w() {
		let e = a(), t = f(/^@custom-media\s+(--\S+)\s*([^{;\s][^{;]*);/);
		if (t) return e({
			type: K.customMedia,
			name: Pf(t[1]),
			media: Pf(t[2])
		});
	}
	function re() {
		let e = a();
		if (!f(/^@page */)) return;
		let t = _() || [];
		if (!l()) return s("@page missing '{'");
		let n = m(), r;
		for (; r = v();) n.push(r), n = n.concat(m());
		return u() ? e({
			type: K.page,
			selectors: t,
			declarations: n
		}) : s("@page missing '}'");
	}
	function ie() {
		let e = a(), t = f(/^@([-\w]+)?document *([^{]+)/);
		if (!t) return;
		let n = Pf(t[1]), r = Pf(t[2]);
		if (!l()) return s("@document missing '{'");
		let i = m().concat(d());
		return u() ? e({
			type: K.document,
			document: r,
			vendor: n,
			rules: i
		}) : s("@document missing '}'");
	}
	function T() {
		let e = a();
		if (!f(/^@font-face\s*/)) return;
		if (!l()) return s("@font-face missing '{'");
		let t = m(), n;
		for (; n = v();) t.push(n), t = t.concat(m());
		return u() ? e({
			type: K.fontFace,
			declarations: t
		}) : s("@font-face missing '}'");
	}
	function ae() {
		let e = a();
		if (!f(/^@starting-style\s*/)) return;
		if (!l()) return s("@starting-style missing '{'");
		let t = m().concat(d());
		return u() ? e({
			type: K.startingStyle,
			rules: t
		}) : s("@starting-style missing '}'");
	}
	let E = se("import"), oe = se("charset"), D = se("namespace");
	function se(e) {
		let t = RegExp("^@" + e + "\\s*((?::?[^;'\"]|\"(?:\\\\\"|[^\"])*?\"|'(?:\\\\'|[^'])*?')+)(?:;|$)");
		return function() {
			let n = a(), r = f(t);
			if (!r) return;
			let i = { type: e };
			return i[e] = r[1].trim(), n(i);
		};
	}
	function ce() {
		if (e[0] === "@") return x() || ne() || w() || ee() || E() || oe() || D() || ie() || re() || te() || T() || S() || ae() || C();
	}
	function le() {
		let e = a(), t = _();
		return t ? (m(), e({
			type: K.rule,
			selectors: t,
			declarations: y() || []
		})) : s("selector missing");
	}
	return Ff(c());
};
function Pf(e) {
	return e ? e.trim() : "";
}
function Ff(e, t) {
	let n = e && typeof e.type == "string", r = n ? e : t;
	for (let t in e) {
		let n = e[t];
		Array.isArray(n) ? n.forEach((e) => {
			Ff(e, r);
		}) : n && typeof n == "object" && Ff(n, r);
	}
	return n && Object.defineProperty(e, "parent", {
		configurable: !0,
		writable: !0,
		enumerable: !1,
		value: t || null
	}), e;
}
var If = Nf, Lf = Object.prototype.toString;
function Rf(e) {
	return typeof e == "function" || Lf.call(e) === "[object Function]";
}
function zf(e) {
	var t = Number(e);
	return isNaN(t) ? 0 : t === 0 || !isFinite(t) ? t : (t > 0 ? 1 : -1) * Math.floor(Math.abs(t));
}
var Bf = 2 ** 53 - 1;
function Vf(e) {
	var t = zf(e);
	return Math.min(Math.max(t, 0), Bf);
}
function Hf(e, t) {
	var n = Array, r = Object(e);
	if (e == null) throw TypeError("Array.from requires an array-like object - not null or undefined");
	if (typeof t < "u" && !Rf(t)) throw TypeError("Array.from: when provided, the second argument must be a function");
	for (var i = Vf(r.length), a = Rf(n) ? Object(new n(i)) : Array(i), o = 0, s; o < i;) s = r[o], t ? a[o] = t(s, o) : a[o] = s, o += 1;
	return a.length = i, a;
}
function Uf(e) {
	"@babel/helpers - typeof";
	return Uf = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Uf(e);
}
function Wf(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Gf(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Jf(r.key), r);
	}
}
function Kf(e, t, n) {
	return t && Gf(e.prototype, t), n && Gf(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function qf(e, t, n) {
	return t = Jf(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Jf(e) {
	var t = Yf(e, "string");
	return Uf(t) === "symbol" ? t : String(t);
}
function Yf(e, t) {
	if (Uf(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Uf(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Xf = (function() {
	function e() {
		var t = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
		Wf(this, e), qf(this, "items", void 0), this.items = t;
	}
	return Kf(e, [
		{
			key: "add",
			value: function(e) {
				return this.has(e) === !1 && this.items.push(e), this;
			}
		},
		{
			key: "clear",
			value: function() {
				this.items = [];
			}
		},
		{
			key: "delete",
			value: function(e) {
				var t = this.items.length;
				return this.items = this.items.filter(function(t) {
					return t !== e;
				}), t !== this.items.length;
			}
		},
		{
			key: "forEach",
			value: function(e) {
				var t = this;
				this.items.forEach(function(n) {
					e(n, n, t);
				});
			}
		},
		{
			key: "has",
			value: function(e) {
				return this.items.indexOf(e) !== -1;
			}
		},
		{
			key: "size",
			get: function() {
				return this.items.length;
			}
		}
	]), e;
})(), Zf = typeof Set > "u" ? Set : Xf;
function q(e) {
	return e.localName ?? e.tagName.toLowerCase();
}
var Qf = {
	article: "article",
	aside: "complementary",
	button: "button",
	datalist: "listbox",
	dd: "definition",
	details: "group",
	dialog: "dialog",
	dt: "term",
	fieldset: "group",
	figure: "figure",
	form: "form",
	footer: "contentinfo",
	h1: "heading",
	h2: "heading",
	h3: "heading",
	h4: "heading",
	h5: "heading",
	h6: "heading",
	header: "banner",
	hr: "separator",
	html: "document",
	legend: "legend",
	li: "listitem",
	math: "math",
	main: "main",
	menu: "list",
	nav: "navigation",
	ol: "list",
	optgroup: "group",
	option: "option",
	output: "status",
	progress: "progressbar",
	section: "region",
	summary: "button",
	table: "table",
	tbody: "rowgroup",
	textarea: "textbox",
	tfoot: "rowgroup",
	td: "cell",
	th: "columnheader",
	thead: "rowgroup",
	tr: "row",
	ul: "list"
}, $f = {
	caption: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	code: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	deletion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	emphasis: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	generic: /* @__PURE__ */ new Set([
		"aria-label",
		"aria-labelledby",
		"aria-roledescription"
	]),
	insertion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	none: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	paragraph: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	presentation: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	strong: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	subscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	superscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"])
};
function ep(e, t) {
	return [
		"aria-atomic",
		"aria-busy",
		"aria-controls",
		"aria-current",
		"aria-description",
		"aria-describedby",
		"aria-details",
		"aria-dropeffect",
		"aria-flowto",
		"aria-grabbed",
		"aria-hidden",
		"aria-keyshortcuts",
		"aria-label",
		"aria-labelledby",
		"aria-live",
		"aria-owns",
		"aria-relevant",
		"aria-roledescription"
	].some(function(n) {
		var r;
		return e.hasAttribute(n) && !((r = $f[t]) != null && r.has(n));
	});
}
function tp(e, t) {
	return ep(e, t);
}
function np(e) {
	var t = ip(e);
	if (t === null || ap.indexOf(t) !== -1) {
		var n = rp(e);
		if (ap.indexOf(t || "") === -1 || tp(e, n || "")) return n;
	}
	return t;
}
function rp(e) {
	var t = Qf[q(e)];
	if (t !== void 0) return t;
	switch (q(e)) {
		case "a":
		case "area":
		case "link":
			if (e.hasAttribute("href")) return "link";
			break;
		case "img": return e.getAttribute("alt") === "" && !tp(e, "img") ? "presentation" : "img";
		case "input":
			var n = e.type;
			switch (n) {
				case "button":
				case "image":
				case "reset":
				case "submit": return "button";
				case "checkbox":
				case "radio": return n;
				case "range": return "slider";
				case "email":
				case "tel":
				case "text":
				case "url": return e.hasAttribute("list") ? "combobox" : "textbox";
				case "search": return e.hasAttribute("list") ? "combobox" : "searchbox";
				case "number": return "spinbutton";
				default: return null;
			}
		case "select": return e.hasAttribute("multiple") || e.size > 1 ? "listbox" : "combobox";
	}
	return null;
}
function ip(e) {
	var t = e.getAttribute("role");
	if (t !== null) {
		var n = t.trim().split(" ")[0];
		if (n.length > 0) return n;
	}
	return null;
}
var ap = ["presentation", "none"];
function J(e) {
	return e !== null && e.nodeType === e.ELEMENT_NODE;
}
function op(e) {
	return J(e) && q(e) === "caption";
}
function sp(e) {
	return J(e) && q(e) === "input";
}
function cp(e) {
	return J(e) && q(e) === "optgroup";
}
function lp(e) {
	return J(e) && q(e) === "select";
}
function up(e) {
	return J(e) && q(e) === "table";
}
function dp(e) {
	return J(e) && q(e) === "textarea";
}
function fp(e) {
	var t = (e.ownerDocument === null ? e : e.ownerDocument).defaultView;
	if (t === null) throw TypeError("no window available");
	return t;
}
function pp(e) {
	return J(e) && q(e) === "fieldset";
}
function mp(e) {
	return J(e) && q(e) === "legend";
}
function hp(e) {
	return J(e) && q(e) === "slot";
}
function gp(e) {
	return J(e) && e.ownerSVGElement !== void 0;
}
function _p(e) {
	return J(e) && q(e) === "svg";
}
function vp(e) {
	return gp(e) && q(e) === "title";
}
function yp(e, t) {
	if (J(e) && e.hasAttribute(t)) {
		var n = e.getAttribute(t).split(" "), r = e.getRootNode ? e.getRootNode() : e.ownerDocument;
		return n.map(function(e) {
			return r.getElementById(e);
		}).filter(function(e) {
			return e !== null;
		});
	}
	return [];
}
function bp(e, t) {
	return J(e) ? t.indexOf(np(e)) !== -1 : !1;
}
function xp(e) {
	return e.trim().replace(/\s\s+/g, " ");
}
function Sp(e, t) {
	if (!J(e)) return !1;
	if (e.hasAttribute("hidden") || e.getAttribute("aria-hidden") === "true") return !0;
	var n = t(e);
	return n.getPropertyValue("display") === "none" || n.getPropertyValue("visibility") === "hidden";
}
function Cp(e) {
	return bp(e, [
		"button",
		"combobox",
		"listbox",
		"textbox"
	]) || wp(e, "range");
}
function wp(e, t) {
	if (!J(e)) return !1;
	if (t === "range") return bp(e, [
		"meter",
		"progressbar",
		"scrollbar",
		"slider",
		"spinbutton"
	]);
	throw TypeError(`No knowledge about abstract role '${t}'. This is likely a bug :(`);
}
function Tp(e, t) {
	var n = Hf(e.querySelectorAll(t));
	return yp(e, "aria-owns").forEach(function(e) {
		n.push.apply(n, Hf(e.querySelectorAll(t)));
	}), n;
}
function Ep(e) {
	return lp(e) ? e.selectedOptions || Tp(e, "[selected]") : Tp(e, "[aria-selected=\"true\"]");
}
function Dp(e) {
	return bp(e, ap);
}
function Op(e) {
	return op(e);
}
function kp(e) {
	return bp(e, [
		"button",
		"cell",
		"checkbox",
		"columnheader",
		"gridcell",
		"heading",
		"label",
		"legend",
		"link",
		"menuitem",
		"menuitemcheckbox",
		"menuitemradio",
		"option",
		"radio",
		"row",
		"rowheader",
		"switch",
		"tab",
		"tooltip",
		"treeitem"
	]);
}
function Ap(e) {
	return !1;
}
function jp(e) {
	return sp(e) || dp(e) ? e.value : e.textContent || "";
}
function Mp(e) {
	var t = e.getPropertyValue("content");
	return /^["'].*["']$/.test(t) ? t.slice(1, -1) : "";
}
function Np(e) {
	var t = q(e);
	return t === "button" || t === "input" && e.getAttribute("type") !== "hidden" || t === "meter" || t === "output" || t === "progress" || t === "select" || t === "textarea";
}
function Pp(e) {
	if (Np(e)) return e;
	var t = null;
	return e.childNodes.forEach(function(e) {
		if (t === null && J(e)) {
			var n = Pp(e);
			n !== null && (t = n);
		}
	}), t;
}
function Fp(e) {
	if (e.control !== void 0) return e.control;
	var t = e.getAttribute("for");
	return t === null ? Pp(e) : e.ownerDocument.getElementById(t);
}
function Ip(e) {
	var t = e.labels;
	if (t === null) return t;
	if (t !== void 0) return Hf(t);
	if (!Np(e)) return null;
	var n = e.ownerDocument;
	return Hf(n.querySelectorAll("label")).filter(function(t) {
		return Fp(t) === e;
	});
}
function Lp(e) {
	var t = e.assignedNodes();
	return t.length === 0 ? Hf(e.childNodes) : t;
}
function Rp(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, n = new Zf(), r = fp(e), i = t.compute, a = i === void 0 ? "name" : i, o = t.computedStyleSupportsPseudoElements, s = o === void 0 ? t.getComputedStyle !== void 0 : o, c = t.getComputedStyle, l = c === void 0 ? r.getComputedStyle.bind(r) : c, u = t.hidden, d = u !== void 0 && u;
	function f(e, t) {
		var n = "";
		if (J(e) && s && (n = `${Mp(l(e, "::before"))} ${n}`), (hp(e) ? Lp(e) : Hf(e.childNodes).concat(yp(e, "aria-owns"))).forEach(function(e) {
			var r = g(e, {
				isEmbeddedInLabel: t.isEmbeddedInLabel,
				isReferenced: !1,
				recursion: !0
			}), i = (J(e) ? l(e).getPropertyValue("display") : "inline") === "inline" ? "" : " ";
			n += `${i}${r}${i}`;
		}), J(e) && s) {
			var r = Mp(l(e, "::after"));
			n = `${n} ${r}`;
		}
		return n.trim();
	}
	function p(e, t) {
		var r = e.getAttributeNode(t);
		return r !== null && !n.has(r) && r.value.trim() !== "" ? (n.add(r), r.value) : null;
	}
	function m(e) {
		return J(e) ? p(e, "title") : null;
	}
	function h(e) {
		if (!J(e)) return null;
		if (pp(e)) {
			n.add(e);
			for (var t = Hf(e.childNodes), r = 0; r < t.length; r += 1) {
				var i = t[r];
				if (mp(i)) return g(i, {
					isEmbeddedInLabel: !1,
					isReferenced: !1,
					recursion: !1
				});
			}
		} else if (up(e)) {
			n.add(e);
			for (var a = Hf(e.childNodes), o = 0; o < a.length; o += 1) {
				var s = a[o];
				if (op(s)) return g(s, {
					isEmbeddedInLabel: !1,
					isReferenced: !1,
					recursion: !1
				});
			}
		} else if (_p(e)) {
			n.add(e);
			for (var c = Hf(e.childNodes), l = 0; l < c.length; l += 1) {
				var u = c[l];
				if (vp(u)) return u.textContent;
			}
			return null;
		} else if (q(e) === "img" || q(e) === "area") {
			var d = p(e, "alt");
			if (d !== null) return d;
		} else if (cp(e)) {
			var m = p(e, "label");
			if (m !== null) return m;
		}
		if (sp(e) && (e.type === "button" || e.type === "submit" || e.type === "reset")) {
			var h = p(e, "value");
			if (h !== null) return h;
			if (e.type === "submit") return "Submit";
			if (e.type === "reset") return "Reset";
		}
		var _ = Ip(e);
		if (_ !== null && _.length !== 0) return n.add(e), Hf(_).map(function(e) {
			return g(e, {
				isEmbeddedInLabel: !0,
				isReferenced: !1,
				recursion: !0
			});
		}).filter(function(e) {
			return e.length > 0;
		}).join(" ");
		if (sp(e) && e.type === "image") {
			var v = p(e, "alt");
			if (v !== null) return v;
			var y = p(e, "title");
			return y === null ? "Submit Query" : y;
		}
		if (bp(e, ["button"])) {
			var b = f(e, {
				isEmbeddedInLabel: !1,
				isReferenced: !1
			});
			if (b !== "") return b;
		}
		return null;
	}
	function g(e, t) {
		if (n.has(e)) return "";
		if (!d && Sp(e, l) && !t.isReferenced) return n.add(e), "";
		var r = J(e) ? e.getAttributeNode("aria-labelledby") : null, i = r !== null && !n.has(r) ? yp(e, "aria-labelledby") : [];
		if (a === "name" && !t.isReferenced && i.length > 0) return n.add(r), i.map(function(e) {
			return g(e, {
				isEmbeddedInLabel: t.isEmbeddedInLabel,
				isReferenced: !0,
				recursion: !1
			});
		}).join(" ");
		var o = t.recursion && Cp(e) && a === "name";
		if (!o) {
			var s = (J(e) && e.getAttribute("aria-label") || "").trim();
			if (s !== "" && a === "name") return n.add(e), s;
			if (!Dp(e)) {
				var c = h(e);
				if (c !== null) return n.add(e), c;
			}
		}
		if (bp(e, ["menu"])) return n.add(e), "";
		if (o || t.isEmbeddedInLabel || t.isReferenced) {
			if (bp(e, ["combobox", "listbox"])) {
				n.add(e);
				var u = Ep(e);
				return u.length === 0 ? sp(e) ? e.value : "" : Hf(u).map(function(e) {
					return g(e, {
						isEmbeddedInLabel: t.isEmbeddedInLabel,
						isReferenced: !1,
						recursion: !0
					});
				}).join(" ");
			}
			if (wp(e, "range")) return n.add(e), e.hasAttribute("aria-valuetext") ? e.getAttribute("aria-valuetext") : e.hasAttribute("aria-valuenow") ? e.getAttribute("aria-valuenow") : e.getAttribute("value") || "";
			if (bp(e, ["textbox"])) return n.add(e), jp(e);
		}
		if (kp(e) || J(e) && t.isReferenced || Op(e) || Ap(e)) {
			var p = f(e, {
				isEmbeddedInLabel: t.isEmbeddedInLabel,
				isReferenced: !1
			});
			if (p !== "") return n.add(e), p;
		}
		if (e.nodeType === e.TEXT_NODE) return n.add(e), e.textContent || "";
		if (t.recursion) return n.add(e), f(e, {
			isEmbeddedInLabel: t.isEmbeddedInLabel,
			isReferenced: !1
		});
		var _ = m(e);
		return _ === null ? (n.add(e), "") : (n.add(e), _);
	}
	return xp(g(e, {
		isEmbeddedInLabel: !1,
		isReferenced: a === "description",
		recursion: !1
	}));
}
function zp(e) {
	"@babel/helpers - typeof";
	return zp = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, zp(e);
}
function Bp(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Vp(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Bp(Object(n), !0).forEach(function(t) {
			Hp(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Bp(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Hp(e, t, n) {
	return t = Up(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Up(e) {
	var t = Wp(e, "string");
	return zp(t) === "symbol" ? t : String(t);
}
function Wp(e, t) {
	if (zp(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (zp(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Gp(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, n = yp(e, "aria-describedby").map(function(e) {
		return Rp(e, Vp(Vp({}, t), {}, { compute: "description" }));
	}).join(" ");
	if (n === "") {
		var r = e.getAttribute("aria-description");
		n = r === null ? "" : r;
	}
	if (n === "") {
		var i = e.getAttribute("title");
		n = i === null ? "" : i;
	}
	return n;
}
function Kp(e) {
	return bp(e, [
		"caption",
		"code",
		"deletion",
		"emphasis",
		"generic",
		"insertion",
		"none",
		"paragraph",
		"presentation",
		"strong",
		"subscript",
		"superscript"
	]);
}
function qp(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
	return Kp(e) ? "" : Rp(e, t);
}
var Jp = Ui(bl(), 1), Yp = Ui(Wi(), 1), Xp = Ui(xl(), 1), Zp = class extends Error {
	constructor(e, t, n, r) {
		super(), Error.captureStackTrace && Error.captureStackTrace(this, n);
		let i = "";
		try {
			i = r.utils.printWithType("Received", t, r.utils.printReceived);
		} catch {}
		this.message = [
			r.utils.matcherHint(`${r.isNot ? ".not" : ""}.${n.name}`, "received", ""),
			"",
			`${r.utils.RECEIVED_COLOR("received")} value must ${e}.`,
			i
		].join("\n");
	}
}, Qp = class extends Zp {
	constructor(...e) {
		super("be an HTMLElement or an SVGElement", ...e);
	}
}, $p = class extends Zp {
	constructor(...e) {
		super("be a Node", ...e);
	}
};
function em(e, t, ...n) {
	if (!e || !e.ownerDocument || !e.ownerDocument.defaultView) throw new t(e, ...n);
}
function tm(e, ...t) {
	if (em(e, $p, ...t), !(e instanceof e.ownerDocument.defaultView.Node)) throw new $p(e, ...t);
}
function Y(e, ...t) {
	em(e, Qp, ...t);
	let n = e.ownerDocument.defaultView;
	if (!(e instanceof n.HTMLElement) && !(e instanceof n.SVGElement)) throw new Qp(e, ...t);
}
var nm = class extends Error {
	constructor(e, t, n) {
		super(), Error.captureStackTrace && Error.captureStackTrace(this, t), this.message = [
			e.message,
			"",
			n.utils.RECEIVED_COLOR("Failing css:"),
			n.utils.RECEIVED_COLOR(`${e.css}`)
		].join("\n");
	}
};
function rm(e, ...t) {
	let n = If(`selector { ${e} }`, { silent: !0 }).stylesheet;
	if (n.parsingErrors && n.parsingErrors.length > 0) {
		let { reason: r, line: i } = n.parsingErrors[0];
		throw new nm({
			css: e,
			message: `Syntax error parsing expected css: ${r} on line: ${i}`
		}, ...t);
	}
	return n.rules[0].declarations.filter((e) => e.type === "declaration").reduce((e, { property: t, value: n }) => Object.assign(e, { [t]: n }), {});
}
function im(e, t) {
	return typeof t == "string" ? t : e.utils.stringify(t);
}
function X(e, t, n, r, i, a) {
	return [
		`${t}
`,
		`${n}:
${e.utils.EXPECTED_COLOR((0, Tf.default)(im(e, r), 2))}`,
		`${i}:
${e.utils.RECEIVED_COLOR((0, Tf.default)(im(e, a), 2))}`
	].join("\n");
}
function am(e, t) {
	return t instanceof RegExp ? t.test(e) : e.includes(String(t));
}
function om(e, t) {
	console.warn(`Warning: ${e} has been deprecated and will be removed in future updates.`, t);
}
function sm(e) {
	return e.replace(/\s+/g, " ").trim();
}
function cm(e) {
	return e.tagName && e.tagName.toLowerCase();
}
function lm({ multiple: e, options: t }) {
	let n = [...t].filter((e) => e.selected);
	if (e) return [...n].map((e) => e.value);
	if (n.length !== 0) return n[0].value;
}
function um(e) {
	switch (e.type) {
		case "number": return e.value === "" ? null : Number(e.value);
		case "checkbox": return e.checked;
		default: return e.value;
	}
}
var dm = [
	"meter",
	"progressbar",
	"slider",
	"spinbutton"
];
function fm(e) {
	if (dm.includes(e.getAttribute("role"))) return Number(e.getAttribute("aria-valuenow"));
}
function pm(e) {
	if (e) switch (e.tagName.toLowerCase()) {
		case "input": return um(e);
		case "select": return lm(e);
		default: return e.value ?? fm(e);
	}
}
function mm(e, { wordConnector: t = ", ", lastWordConnector: n = " and " } = {}) {
	return [e.slice(0, -1).join(t), e[e.length - 1]].join(e.length > 1 ? n : "");
}
function hm(e, t) {
	return Array.isArray(e) && Array.isArray(t) ? [...new Set(e)].every((e) => new Set(t).has(e)) : e === t;
}
function gm(e, t) {
	return om("toBeInTheDOM", "Please use toBeInTheDocument for searching the entire document and toContainElement for searching a specific container."), e && Y(e, gm, this), t && Y(t, gm, this), {
		pass: t ? t.contains(e) : !!e,
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeInTheDOM`, "element", ""),
			"",
			"Received:",
			`  ${this.utils.printReceived(e && e.cloneNode(!1))}`
		].join("\n")
	};
}
function _m(e) {
	e === null && this.isNot || Y(e, _m, this);
	let t = e !== null && e.ownerDocument === e.getRootNode({ composed: !0 }), n = () => `expected document not to contain element, found ${this.utils.stringify(e.cloneNode(!0))} instead`, r = () => "element could not be found in the document";
	return {
		pass: t,
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeInTheDocument`, "element", ""),
			"",
			this.utils.RECEIVED_COLOR(this.isNot ? n() : r())
		].join("\n")
	};
}
function vm(e) {
	return om("toBeEmpty", "Please use instead toBeEmptyDOMElement for finding empty nodes in the DOM."), Y(e, vm, this), {
		pass: e.innerHTML === "",
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeEmpty`, "element", ""),
			"",
			"Received:",
			`  ${this.utils.printReceived(e.innerHTML)}`
		].join("\n")
	};
}
function ym(e) {
	return Y(e, ym, this), {
		pass: bm(e),
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeEmptyDOMElement`, "element", ""),
			"",
			"Received:",
			`  ${this.utils.printReceived(e.innerHTML)}`
		].join("\n")
	};
}
function bm(e) {
	return [...e.childNodes].filter((e) => e.nodeType !== 8).length === 0;
}
function xm(e, t) {
	return Y(e, xm, this), t !== null && Y(t, xm, this), {
		pass: e.contains(t),
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toContainElement`, "element", "element"),
			"",
			this.utils.RECEIVED_COLOR(`${this.utils.stringify(e.cloneNode(!1))} ${this.isNot ? "contains:" : "does not contain:"} ${this.utils.stringify(t && t.cloneNode(!1))}
        `)
		].join("\n")
	};
}
function Sm(e, t) {
	let n = e.ownerDocument.createElement("div");
	return n.innerHTML = t, n.innerHTML;
}
function Cm(e, t) {
	if (Y(e, Cm, this), typeof t != "string") throw Error(`.toContainHTML() expects a string value, got ${t}`);
	return {
		pass: e.outerHTML.includes(Sm(e, t)),
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toContainHTML`, "element", ""),
			"Expected:",
			`  ${this.utils.EXPECTED_COLOR(t)}`,
			"Received:",
			`  ${this.utils.printReceived(e.cloneNode(!0))}`
		].join("\n")
	};
}
function wm(e, t, n = { normalizeWhitespace: !0 }) {
	tm(e, wm, this);
	let r = n.normalizeWhitespace ? sm(e.textContent) : e.textContent.replace(/\u00a0/g, " "), i = r !== "" && t === "";
	return {
		pass: !i && am(r, t),
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveTextContent`, "element", ""), i ? "Checking with empty string will always match, use .toBeEmptyDOMElement() instead" : `Expected element ${e} have text content`, t, "Received", r);
		}
	};
}
function Tm(e, t) {
	Y(e, Tm, this);
	let n = Gp(e), r = arguments.length === 1, i = !1;
	return i = r ? n !== "" : t instanceof RegExp ? t.test(n) : this.equals(n, t), {
		pass: i,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.${Tm.name}`, "element", ""), `Expected element ${e} have accessible description`, t, "Received", n);
		}
	};
}
var Em = "aria-invalid", Dm = ["false"];
function Om(e, t) {
	Y(e, Om, this);
	let n = this.isNot ? "not to" : "to", r = this.isNot ? ".not.toHaveAccessibleErrorMessage" : ".toHaveAccessibleErrorMessage", i = e.getAttribute("aria-errormessage");
	if (i && /\s+/.test(i)) return {
		pass: !1,
		message: () => X(this, this.utils.matcherHint(r, "element"), "Expected element's `aria-errormessage` attribute to be empty or a single, valid ID", "", "Received", `aria-errormessage="${i}"`)
	};
	let a = e.getAttribute(Em);
	if (!e.hasAttribute(Em) || Dm.includes(a)) return {
		pass: !1,
		message: () => X(this, this.utils.matcherHint(r, "element"), "Expected element to be marked as invalid with attribute", `${Em}="true"`, "Received", e.hasAttribute("aria-invalid") ? `${Em}="${e.getAttribute(Em)}` : null)
	};
	let o = sm(e.ownerDocument.getElementById(i)?.textContent ?? "");
	return {
		pass: t === void 0 ? !!o : t instanceof RegExp ? t.test(o) : this.equals(o, t),
		message: () => X(this, this.utils.matcherHint(r, "element"), `Expected element ${n} have accessible error message`, t ?? "", "Received", o)
	};
}
var km = Nm(Jp.elementRoles);
function Am(e, t) {
	Y(e, Am, this);
	let n = jm(e);
	return {
		pass: n.some((e) => e === t),
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.${Am.name}`, "element", ""), `Expected element ${e} have role`, t, "Received", n.join(", "));
		}
	};
}
function jm(e) {
	return e.hasAttribute("role") ? e.getAttribute("role").split(" ").filter(Boolean) : Mm(e);
}
function Mm(e) {
	for (let { match: t, roles: n } of km) if (t(e)) return [...n];
	return [];
}
function Nm(e) {
	function t({ name: e, attributes: t }) {
		return `${e}${t.map(({ name: e, value: t, constraints: n = [] }) => n.indexOf("undefined") === -1 ? t ? `[${e}="${t}"]` : `[${e}]` : `:not([${e}])`).join("")}`;
	}
	function n({ attributes: e = [] }) {
		return e.length;
	}
	function r({ specificity: e }, { specificity: t }) {
		return t - e;
	}
	function i(e) {
		let { attributes: n = [] } = e, r = n.findIndex((e) => e.value && e.name === "type" && e.value === "text");
		r >= 0 && (n = [...n.slice(0, r), ...n.slice(r + 1)]);
		let i = t({
			...e,
			attributes: n
		});
		return (e) => r >= 0 && e.type !== "text" ? !1 : e.matches(i);
	}
	let a = [];
	for (let [t, r] of e.entries()) a = [...a, {
		match: i(t),
		roles: Array.from(r),
		specificity: n(t)
	}];
	return a.sort(r);
}
function Pm(e, t) {
	Y(e, Pm, this);
	let n = qp(e), r = arguments.length === 1, i = !1;
	return i = r ? n !== "" : t instanceof RegExp ? t.test(n) : this.equals(n, t), {
		pass: i,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.${Pm.name}`, "element", ""), `Expected element ${e} have accessible name`, t, "Received", n);
		}
	};
}
function Fm(e, t, n) {
	return n === void 0 ? t : `${t}=${e(n)}`;
}
function Im(e, t, n) {
	return n === void 0 ? `element.hasAttribute(${e(t)})` : `element.getAttribute(${e(t)}) === ${e(n)}`;
}
function Lm(e, t, n) {
	Y(e, Lm, this);
	let r = n !== void 0, i = e.hasAttribute(t), a = e.getAttribute(t);
	return {
		pass: r ? i && this.equals(a, n) : i,
		message: () => {
			let e = this.isNot ? "not to" : "to", o = i ? Fm(this.utils.stringify, t, a) : null, s = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveAttribute`, "element", this.utils.printExpected(t), {
				secondArgument: r ? this.utils.printExpected(n) : void 0,
				comment: Im(this.utils.stringify, t, n)
			});
			return X(this, s, `Expected the element ${e} have attribute`, Fm(this.utils.stringify, t, n), "Received", o);
		}
	};
}
function Rm(e) {
	let t = e.pop(), n, r;
	return typeof t == "object" && !(t instanceof RegExp) ? (n = e, r = t) : (n = e.concat(t), r = { exact: !1 }), {
		expectedClassNames: n,
		options: r
	};
}
function zm(e) {
	return e ? e.split(/\s+/).filter((e) => e.length > 0) : [];
}
function Bm(e, t) {
	return e.every((e) => typeof e == "string" ? t.includes(e) : t.some((t) => e.test(t)));
}
function Vm(e, ...t) {
	Y(e, Vm, this);
	let { expectedClassNames: n, options: r } = Rm(t), i = zm(e.getAttribute("class")), a = n.reduce((e, t) => e.concat(typeof t == "string" || !t ? zm(t) : t), []), o = a.some((e) => e instanceof RegExp);
	if (r.exact && o) throw Error("Exact option does not support RegExp expected class names");
	return r.exact ? {
		pass: Bm(a, i) && a.length === i.length,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveClass`, "element", this.utils.printExpected(a.join(" "))), `Expected the element ${e} have EXACTLY defined classes`, a.join(" "), "Received", i.join(" "));
		}
	} : a.length > 0 ? {
		pass: Bm(a, i),
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveClass`, "element", this.utils.printExpected(a.join(" "))), `Expected the element ${e} have class`, a.join(" "), "Received", i.join(" "));
		}
	} : {
		pass: this.isNot ? i.length > 0 : !1,
		message: () => this.isNot ? X(this, this.utils.matcherHint(".not.toHaveClass", "element", ""), "Expected the element to have classes", "(none)", "Received", i.join(" ")) : [this.utils.matcherHint(".toHaveClass", "element"), "At least one expected class must be provided."].join("\n")
	};
}
function Hm(e, t) {
	let n = {}, r = e.createElement("div");
	return Object.keys(t).forEach((e) => {
		r.style[e] = t[e], n[e] = r.style[e];
	}), n;
}
function Um(e, t) {
	return !!Object.keys(e).length && Object.entries(e).every(([e, n]) => {
		let r = e.startsWith("--"), i = [e];
		return r || i.push(e.toLowerCase()), i.some((e) => t[e] === n || t.getPropertyValue(e) === n);
	});
}
function Wm(e) {
	return Object.keys(e).sort().map((t) => `${t}: ${e[t]};`).join("\n");
}
function Gm(e, t, n) {
	let r = Array.from(n).filter((e) => t[e] !== void 0).reduce((e, t) => Object.assign(e, { [t]: n.getPropertyValue(t) }), {});
	return e(Wm(t), Wm(r)).replace(`${Yp.default.red("+ Received")}
`, "");
}
function Km(e, t) {
	Y(e, Km, this);
	let n = typeof t == "object" ? t : rm(t, Km, this), { getComputedStyle: r } = e.ownerDocument.defaultView, i = Hm(e.ownerDocument, n), a = r(e);
	return {
		pass: Um(i, a),
		message: () => {
			let e = `${this.isNot ? ".not" : ""}.toHaveStyle`;
			return [this.utils.matcherHint(e, "element", ""), Gm(this.utils.diff, i, a)].join("\n\n");
		}
	};
}
function qm(e) {
	return Y(e, qm, this), {
		pass: e.ownerDocument.activeElement === e,
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveFocus`, "element", ""),
			"",
			...this.isNot ? ["Received element is focused:", `  ${this.utils.printReceived(e)}`] : [
				"Expected element with focus:",
				`  ${this.utils.printExpected(e)}`,
				"Received element with focus:",
				`  ${this.utils.printReceived(e.ownerDocument.activeElement)}`
			]
		].join("\n")
	};
}
function Jm(e) {
	let t = [...new Set(e.map((e) => e.type))];
	if (t.length !== 1) throw Error("Multiple form elements with the same name must be of the same type");
	switch (t[0]) {
		case "radio": {
			let t = e.find((e) => e.checked);
			return t ? t.value : void 0;
		}
		case "checkbox": return e.filter((e) => e.checked).map((e) => e.value);
		default: return e.map((e) => e.value);
	}
}
function Ym(e, t) {
	let n = [...e.querySelectorAll(`[name="${(0, Xp.default)(t)}"]`)];
	if (n.length !== 0) return n.length === 1 ? pm(n[0]) : Jm(n);
}
function Xm(e) {
	return /\[\]$/.test(e) ? e.slice(0, -2) : e;
}
function Zm(e) {
	return Array.from(e.elements).map((e) => e.name).reduce((t, n) => ({
		...t,
		[Xm(n)]: Ym(e, n)
	}), {});
}
function Qm(e, t) {
	if (Y(e, Qm, this), !e.elements) throw Error("toHaveFormValues must be called on a form or a fieldset");
	let n = Zm(e);
	return {
		pass: Object.entries(t).every(([e, t]) => hm(n[e], t)),
		message: () => {
			let e = this.isNot ? "not to" : "to", r = `${this.isNot ? ".not" : ""}.toHaveFormValues`, i = Object.keys(n).filter((e) => t.hasOwnProperty(e)).reduce((e, t) => ({
				...e,
				[t]: n[t]
			}), {});
			return [
				this.utils.matcherHint(r, "element", ""),
				`Expected the element ${e} have form values`,
				this.utils.diff(t, i)
			].join("\n\n");
		}
	};
}
function $m(e) {
	let { getComputedStyle: t } = e.ownerDocument.defaultView, { display: n, visibility: r, opacity: i } = t(e);
	return n !== "none" && r !== "hidden" && r !== "collapse" && i !== "0" && i !== 0;
}
function eh(e, t) {
	let n;
	return n = t ? e.nodeName === "DETAILS" && t.nodeName !== "SUMMARY" ? e.hasAttribute("open") : !0 : e.nodeName !== "DETAILS" || e.hasAttribute("open"), !e.hasAttribute("hidden") && n;
}
function th(e, t) {
	return $m(e) && eh(e, t) && (!e.parentElement || th(e.parentElement, e));
}
function nh(e) {
	Y(e, nh, this);
	let t = e.ownerDocument === e.getRootNode({ composed: !0 }), n = t && th(e);
	return {
		pass: n,
		message: () => {
			let r = n ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeVisible`, "element", ""),
				"",
				`Received element ${r} visible${t ? "" : " (element is not in the document)"}:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
var rh = [
	"fieldset",
	"input",
	"select",
	"optgroup",
	"option",
	"button",
	"textarea"
];
function ih(e, t) {
	return cm(e) === "legend" && cm(t) === "fieldset" && e.isSameNode(Array.from(t.children).find((e) => cm(e) === "legend"));
}
function ah(e, t) {
	return ch(t) && !ih(e, t);
}
function oh(e) {
	return e.includes("-");
}
function sh(e) {
	let t = cm(e);
	return rh.includes(t) || oh(t);
}
function ch(e) {
	return sh(e) && e.hasAttribute("disabled");
}
function lh(e) {
	let t = e.parentElement;
	return !!t && (ah(e, t) || lh(t));
}
function uh(e) {
	return sh(e) && (ch(e) || lh(e));
}
function dh(e) {
	Y(e, dh, this);
	let t = uh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeDisabled`, "element", ""),
				"",
				`Received element ${n} disabled:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function fh(e) {
	Y(e, fh, this);
	let t = !uh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeEnabled`, "element", ""),
				"",
				`Received element ${n} enabled:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
var ph = ["select", "textarea"], mh = [
	"input",
	"select",
	"textarea"
], hh = [
	"color",
	"hidden",
	"range",
	"submit",
	"image",
	"reset"
], gh = [
	"checkbox",
	"combobox",
	"gridcell",
	"listbox",
	"radiogroup",
	"spinbutton",
	"textbox",
	"tree"
];
function _h(e) {
	return ph.includes(cm(e)) && e.hasAttribute("required");
}
function vh(e) {
	return cm(e) === "input" && e.hasAttribute("required") && (e.hasAttribute("type") && !hh.includes(e.getAttribute("type")) || !e.hasAttribute("type"));
}
function yh(e) {
	return e.hasAttribute("aria-required") && e.getAttribute("aria-required") === "true" && (mh.includes(cm(e)) || e.hasAttribute("role") && gh.includes(e.getAttribute("role")));
}
function bh(e) {
	Y(e, bh, this);
	let t = _h(e) || vh(e) || yh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeRequired`, "element", ""),
				"",
				`Received element ${n} required:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
var xh = [
	"form",
	"input",
	"select",
	"textarea"
];
function Sh(e) {
	return e.hasAttribute("aria-invalid") && e.getAttribute("aria-invalid") !== "false";
}
function Ch(e) {
	return xh.includes(cm(e));
}
function wh(e) {
	let t = Sh(e);
	return Ch(e) ? t || !e.checkValidity() : t;
}
function Th(e) {
	Y(e, Th, this);
	let t = wh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeInvalid`, "element", ""),
				"",
				`Received element ${n} currently invalid:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function Eh(e) {
	Y(e, Eh, this);
	let t = !wh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeValid`, "element", ""),
				"",
				`Received element ${n} currently valid:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function Dh(e, t) {
	if (Y(e, Dh, this), e.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(e.type)) throw Error("input with type=checkbox or type=radio cannot be used with .toHaveValue(). Use .toBeChecked() for type=checkbox or .toHaveFormValues() instead");
	let n = pm(e), r = t !== void 0, i = t, a = n;
	return t == n && t !== n && (i = `${t} (${typeof t})`, a = `${n} (${typeof n})`), {
		pass: r ? hm(n, t) : !!n,
		message: () => {
			let e = this.isNot ? "not to" : "to", n = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveValue`, "element", t);
			return X(this, n, `Expected the element ${e} have value`, r ? i : "(any)", "Received", a);
		}
	};
}
function Oh(e, t) {
	Y(e, Oh, this);
	let n = e.tagName.toLowerCase();
	if (![
		"select",
		"input",
		"textarea"
	].includes(n)) throw Error(".toHaveDisplayValue() currently supports only input, textarea or select elements, try with another matcher instead.");
	if (n === "input" && ["radio", "checkbox"].includes(e.type)) throw Error(`.toHaveDisplayValue() currently does not support input[type="${e.type}"], try with another matcher instead.`);
	let r = kh(n, e), i = Ah(t), a = i.filter((e) => r.some((t) => e instanceof RegExp ? e.test(t) : this.equals(t, String(e)))).length, o = a === r.length, s = a === i.length;
	return {
		pass: o && s,
		message: () => X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveDisplayValue`, "element", ""), `Expected element ${this.isNot ? "not " : ""}to have display value`, t, "Received", r)
	};
}
function kh(e, t) {
	return e === "select" ? Array.from(t).filter((e) => e.selected).map((e) => e.textContent) : [t.value];
}
function Ah(e) {
	return e instanceof Array ? e : [e];
}
function jh(e) {
	Y(e, jh, this);
	let t = () => e.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(e.type);
	if (!t() && !(Ph(e.getAttribute("role")) && ["true", "false"].includes(e.getAttribute("aria-checked")))) return {
		pass: !1,
		message: () => `only inputs with type="checkbox" or type="radio" or elements with ${Mh()} and a valid aria-checked attribute can be used with .toBeChecked(). Use .toHaveValue() instead`
	};
	let n = () => t() ? e.checked : e.getAttribute("aria-checked") === "true";
	return {
		pass: n(),
		message: () => {
			let t = n() ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeChecked`, "element", ""),
				"",
				`Received element ${t} checked:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function Mh() {
	return mm(Nh().map((e) => `role="${e}"`), { lastWordConnector: " or " });
}
function Nh() {
	return Jp.roles.keys().filter(Ph);
}
function Ph(e) {
	return Jp.roles.get(e)?.props["aria-checked"] !== void 0;
}
function Fh(e) {
	Y(e, Fh, this);
	let t = () => e.tagName.toLowerCase() === "input" && e.type === "checkbox";
	if (!t() && e.getAttribute("role") !== "checkbox") return {
		pass: !1,
		message: () => "only inputs with type=\"checkbox\" or elements with role=\"checkbox\" and a valid aria-checked attribute can be used with .toBePartiallyChecked(). Use .toHaveValue() instead"
	};
	let n = () => {
		let n = e.getAttribute("aria-checked") === "mixed";
		return t() && e.indeterminate || n;
	};
	return {
		pass: n(),
		message: () => {
			let t = n() ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBePartiallyChecked`, "element", ""),
				"",
				`Received element ${t} partially checked:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function Ih(e, t) {
	om("toHaveDescription", "Please use toHaveAccessibleDescription."), Y(e, Ih, this);
	let n = t !== void 0, r = (e.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean), i = "";
	if (r.length > 0) {
		let t = e.ownerDocument;
		i = sm(r.map((e) => t.getElementById(e)).filter(Boolean).map((e) => e.textContent).join(" "));
	}
	return {
		pass: n ? t instanceof RegExp ? t.test(i) : this.equals(i, t) : !!i,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveDescription`, "element", ""), `Expected the element ${e} have description`, this.utils.printExpected(t), "Received", this.utils.printReceived(i));
		}
	};
}
function Lh(e, t) {
	if (om("toHaveErrorMessage", "Please use toHaveAccessibleErrorMessage."), Y(e, Lh, this), !e.hasAttribute("aria-invalid") || e.getAttribute("aria-invalid") === "false") {
		let t = this.isNot ? ".not" : "";
		return {
			pass: !1,
			message: () => X(this, this.utils.matcherHint(`${t}.toHaveErrorMessage`, "element", ""), "Expected the element to have invalid state indicated by", "aria-invalid=\"true\"", "Received", e.hasAttribute("aria-invalid") ? `aria-invalid="${e.getAttribute("aria-invalid")}"` : this.utils.printReceived(""))
		};
	}
	let n = t !== void 0, r = (e.getAttribute("aria-errormessage") || "").split(/\s+/).filter(Boolean), i = "";
	if (r.length > 0) {
		let t = e.ownerDocument;
		i = sm(r.map((e) => t.getElementById(e)).filter(Boolean).map((e) => e.textContent).join(" "));
	}
	return {
		pass: n ? t instanceof RegExp ? t.test(i) : this.equals(i, t) : !!i,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return X(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveErrorMessage`, "element", ""), `Expected the element ${e} have error message`, this.utils.printExpected(t), "Received", this.utils.printReceived(i));
		}
	};
}
function Rh(e) {
	let t = e.ownerDocument.getSelection();
	if (["input", "textarea"].includes(e.tagName.toLowerCase())) return ["radio", "checkbox"].includes(e.type) ? "" : e.value.toString().substring(e.selectionStart, e.selectionEnd);
	if (t.anchorNode === null || t.focusNode === null) return "";
	let n = t.getRangeAt(0), r = e.ownerDocument.createRange();
	if (t.containsNode(e, !1)) r.selectNodeContents(e), t.removeAllRanges(), t.addRange(r);
	else if (!(e.contains(t.anchorNode) && e.contains(t.focusNode))) {
		let i = e === n.startContainer || e.contains(n.startContainer), a = e === n.endContainer || e.contains(n.endContainer);
		t.removeAllRanges(), (i || a) && (r.selectNodeContents(e), i && r.setStart(n.startContainer, n.startOffset), a && r.setEnd(n.endContainer, n.endOffset), t.addRange(r));
	}
	let i = t.toString();
	return t.removeAllRanges(), t.addRange(n), i;
}
function zh(e, t) {
	Y(e, zh, this);
	let n = t !== void 0;
	if (n && typeof t != "string") throw Error("expected selection must be a string or undefined");
	let r = Rh(e);
	return {
		pass: n ? hm(r, t) : !!r,
		message: () => {
			let e = this.isNot ? "not to" : "to", i = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveSelection`, "element", t);
			return X(this, i, `Expected the element ${e} have selection`, n ? t : "(any)", "Received", r);
		}
	};
}
function Bh(e) {
	Y(e, Bh, this);
	let t = (e.getAttribute("role") || "").split(" ").map((e) => e.trim()), n = e.tagName.toLowerCase() === "button" || e.tagName.toLowerCase() === "input" && e.type === "button" || t.includes("button"), r = e.getAttribute("aria-pressed");
	return !n || r !== "true" && r !== "false" ? {
		pass: !1,
		message: () => "Only button or input with type=\"button\" or element with role=\"button\" and a valid aria-pressed attribute can be used with .toBePressed()"
	} : {
		pass: n && r === "true",
		message: () => {
			let e = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBePressed`, "element", "");
			return X(this, e, "Expected element to have", `aria-pressed="${this.isNot ? "false" : "true"}"`, "Received", `aria-pressed="${r}"`);
		}
	};
}
function Vh(e) {
	Y(e, Vh, this);
	let t = (e.getAttribute("role") || "").split(" ").map((e) => e.trim()), n = e.tagName.toLowerCase() === "button" || e.tagName.toLowerCase() === "input" && e.type === "button" || t.includes("button"), r = e.getAttribute("aria-pressed");
	return !n || r !== "true" && r !== "false" && r !== "mixed" ? {
		pass: !1,
		message: () => "Only button or input with type=\"button\" or element with role=\"button\" and a valid aria-pressed attribute can be used with .toBePartiallyPressed()"
	} : {
		pass: n && r === "mixed",
		message: () => {
			let e = this.isNot ? "not to" : "to", t = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBePartiallyPressed`, "element", "");
			return X(this, t, `Expected element ${e} have`, "aria-pressed=\"mixed\"", "Received", `aria-pressed="${r}"`);
		}
	};
}
var Hh = 1, Uh = 2, Wh = 4, Gh = 8, Kh = 16, qh = 32, Jh = {
	[Hh]: "Node.DOCUMENT_POSITION_DISCONNECTED",
	[Uh]: "Node.DOCUMENT_POSITION_PRECEDING",
	[Wh]: "Node.DOCUMENT_POSITION_FOLLOWING",
	[Gh]: "Node.DOCUMENT_POSITION_CONTAINS",
	[Kh]: "Node.DOCUMENT_POSITION_CONTAINED_BY",
	[qh]: "Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC"
};
function Yh(e) {
	return e in Jh ? `${Jh[e]} (${e})` : `Unknown document position (${e})`;
}
function Xh(e, t) {
	return function(n, r) {
		Y(n, Zh, this), Y(r, Zh, this);
		let i = n.compareDocumentPosition(r);
		return {
			pass: i === t,
			message: () => [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.${e}`, "element", "secondElement"),
				"",
				`Received: ${Yh(i)}`
			].join("\n")
		};
	};
}
function Zh(e, t) {
	return Xh("toAppearBefore", Wh).apply(this, [e, t]);
}
function Qh(e, t) {
	return Xh("toAppearAfter", Uh).apply(this, [e, t]);
}
Object.freeze({
	__proto__: null,
	toAppearAfter: Qh,
	toAppearBefore: Zh,
	toBeChecked: jh,
	toBeDisabled: dh,
	toBeEmpty: vm,
	toBeEmptyDOMElement: ym,
	toBeEnabled: fh,
	toBeInTheDOM: gm,
	toBeInTheDocument: _m,
	toBeInvalid: Th,
	toBePartiallyChecked: Fh,
	toBePartiallyPressed: Vh,
	toBePressed: Bh,
	toBeRequired: bh,
	toBeValid: Eh,
	toBeVisible: nh,
	toContainElement: xm,
	toContainHTML: Cm,
	toHaveAccessibleDescription: Tm,
	toHaveAccessibleErrorMessage: Om,
	toHaveAccessibleName: Pm,
	toHaveAttribute: Lm,
	toHaveClass: Vm,
	toHaveDescription: Ih,
	toHaveDisplayValue: Oh,
	toHaveErrorMessage: Lh,
	toHaveFocus: qm,
	toHaveFormValues: Qm,
	toHaveRole: Am,
	toHaveSelection: zh,
	toHaveStyle: Km,
	toHaveTextContent: wm,
	toHaveValue: Dh
}), Ui(jo(), 1), Ui(bl(), 1), Ui(Wi(), 1), Ui(xl(), 1);
var $h, eg;
function tg() {
	if (eg) return $h;
	eg = 1;
	var e, t, n, r, i, a, o, s, c, l, u, d, f = /\/(?![*\/])(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\\]).|\\.)*(\/[$_\u200C\u200D\p{ID_Continue}]*|\\)?/uy, p, m, h, g, _, v;
	return d = /--|\+\+|=>|\.{3}|\??\.(?!\d)|(?:&&|\|\||\?\?|[+\-%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2}|\/(?![\/*]))=?|[?~,:;[\](){}]/y, e = /(\x23?)(?=[$_\p{ID_Start}\\])(?:[$_\u200C\u200D\p{ID_Continue}]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+/uy, m = /(['"])(?:(?!\1)[^\\\n\r]|\\(?:\r\n|[^]))*(\1)?/y, u = /(?:0[xX][\da-fA-F](?:_?[\da-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*)n?|0n|[1-9](?:_?\d)*n|(?:(?:0(?!\d)|0\d*[89]\d*|[1-9](?:_?\d)*)(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?|0[0-7]+/y, h = /[`}](?:[^`\\$]|\\[^]|\$(?!\{))*(`|\$\{)?/y, v = /[\t\v\f\ufeff\p{Zs}]+/uy, s = /\r?\n|[\r\u2028\u2029]/y, c = /\/\*(?:[^*]|\*(?!\/))*(\*\/)?/y, p = /\/\/.*/y, n = /[<>.:={}]|\/(?![\/*])/y, t = /[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}-]*/uy, r = /(['"])(?:(?!\1)[^])*(\1)?/y, i = /[^<>{}]+/y, _ = /^(?:[\/+-]|\.{3}|\?(?:InterpolationIn(?:JSX|Template)|NoLineTerminatorHere|NonExpressionParenEnd|UnaryIncDec))?$|[{}([,;<>=*%&|^!~?:]$/, g = /^(?:=>|[;\]){}]|else|\?(?:NoLineTerminatorHere|NonExpressionParenEnd))?$/, a = /^(?:await|case|default|delete|do|else|instanceof|new|return|throw|typeof|void|yield)$/, o = /^(?:return|throw|yield)$/, l = RegExp(s.source), $h = function* (y, { jsx: b = !1 } = {}) {
		var x, ee, te, S, C, ne, w, re, ie, T, ae, E, oe, D;
		for ({length: ne} = y, S = 0, C = "", D = [{ tag: "JS" }], x = [], ae = 0, E = !1; S < ne;) {
			switch (re = D[D.length - 1], re.tag) {
				case "JS":
				case "JSNonExpressionParen":
				case "InterpolationInTemplate":
				case "InterpolationInJSX":
					if (y[S] === "/" && (_.test(C) || a.test(C)) && (f.lastIndex = S, w = f.exec(y))) {
						S = f.lastIndex, C = w[0], E = !0, yield {
							type: "RegularExpressionLiteral",
							value: w[0],
							closed: w[1] !== void 0 && w[1] !== "\\"
						};
						continue;
					}
					if (d.lastIndex = S, w = d.exec(y)) {
						switch (oe = w[0], ie = d.lastIndex, T = oe, oe) {
							case "(":
								C === "?NonExpressionParenKeyword" && D.push({
									tag: "JSNonExpressionParen",
									nesting: ae
								}), ae++, E = !1;
								break;
							case ")":
								ae--, E = !0, re.tag === "JSNonExpressionParen" && ae === re.nesting && (D.pop(), T = "?NonExpressionParenEnd", E = !1);
								break;
							case "{":
								d.lastIndex = 0, te = !g.test(C) && (_.test(C) || a.test(C)), x.push(te), E = !1;
								break;
							case "}":
								switch (re.tag) {
									case "InterpolationInTemplate":
										if (x.length === re.nesting) {
											h.lastIndex = S, w = h.exec(y), S = h.lastIndex, C = w[0], w[1] === "${" ? (C = "?InterpolationInTemplate", E = !1, yield {
												type: "TemplateMiddle",
												value: w[0]
											}) : (D.pop(), E = !0, yield {
												type: "TemplateTail",
												value: w[0],
												closed: w[1] === "`"
											});
											continue;
										}
										break;
									case "InterpolationInJSX": if (x.length === re.nesting) {
										D.pop(), S += 1, C = "}", yield {
											type: "JSXPunctuator",
											value: "}"
										};
										continue;
									}
								}
								E = x.pop(), T = E ? "?ExpressionBraceEnd" : "}";
								break;
							case "]":
								E = !0;
								break;
							case "++":
							case "--":
								T = E ? "?PostfixIncDec" : "?UnaryIncDec";
								break;
							case "<":
								if (b && (_.test(C) || a.test(C))) {
									D.push({ tag: "JSXTag" }), S += 1, C = "<", yield {
										type: "JSXPunctuator",
										value: oe
									};
									continue;
								}
								E = !1;
								break;
							default: E = !1;
						}
						S = ie, C = T, yield {
							type: "Punctuator",
							value: oe
						};
						continue;
					}
					if (e.lastIndex = S, w = e.exec(y)) {
						switch (S = e.lastIndex, T = w[0], w[0]) {
							case "for":
							case "if":
							case "while":
							case "with": C !== "." && C !== "?." && (T = "?NonExpressionParenKeyword");
						}
						C = T, E = !a.test(w[0]), yield {
							type: w[1] === "#" ? "PrivateIdentifier" : "IdentifierName",
							value: w[0]
						};
						continue;
					}
					if (m.lastIndex = S, w = m.exec(y)) {
						S = m.lastIndex, C = w[0], E = !0, yield {
							type: "StringLiteral",
							value: w[0],
							closed: w[2] !== void 0
						};
						continue;
					}
					if (u.lastIndex = S, w = u.exec(y)) {
						S = u.lastIndex, C = w[0], E = !0, yield {
							type: "NumericLiteral",
							value: w[0]
						};
						continue;
					}
					if (h.lastIndex = S, w = h.exec(y)) {
						S = h.lastIndex, C = w[0], w[1] === "${" ? (C = "?InterpolationInTemplate", D.push({
							tag: "InterpolationInTemplate",
							nesting: x.length
						}), E = !1, yield {
							type: "TemplateHead",
							value: w[0]
						}) : (E = !0, yield {
							type: "NoSubstitutionTemplate",
							value: w[0],
							closed: w[1] === "`"
						});
						continue;
					}
					break;
				case "JSXTag":
				case "JSXTagEnd":
					if (n.lastIndex = S, w = n.exec(y)) {
						switch (S = n.lastIndex, T = w[0], w[0]) {
							case "<":
								D.push({ tag: "JSXTag" });
								break;
							case ">":
								D.pop(), C === "/" || re.tag === "JSXTagEnd" ? (T = "?JSX", E = !0) : D.push({ tag: "JSXChildren" });
								break;
							case "{":
								D.push({
									tag: "InterpolationInJSX",
									nesting: x.length
								}), T = "?InterpolationInJSX", E = !1;
								break;
							case "/": C === "<" && (D.pop(), D[D.length - 1].tag === "JSXChildren" && D.pop(), D.push({ tag: "JSXTagEnd" }));
						}
						C = T, yield {
							type: "JSXPunctuator",
							value: w[0]
						};
						continue;
					}
					if (t.lastIndex = S, w = t.exec(y)) {
						S = t.lastIndex, C = w[0], yield {
							type: "JSXIdentifier",
							value: w[0]
						};
						continue;
					}
					if (r.lastIndex = S, w = r.exec(y)) {
						S = r.lastIndex, C = w[0], yield {
							type: "JSXString",
							value: w[0],
							closed: w[2] !== void 0
						};
						continue;
					}
					break;
				case "JSXChildren":
					if (i.lastIndex = S, w = i.exec(y)) {
						S = i.lastIndex, C = w[0], yield {
							type: "JSXText",
							value: w[0]
						};
						continue;
					}
					switch (y[S]) {
						case "<":
							D.push({ tag: "JSXTag" }), S++, C = "<", yield {
								type: "JSXPunctuator",
								value: "<"
							};
							continue;
						case "{":
							D.push({
								tag: "InterpolationInJSX",
								nesting: x.length
							}), S++, C = "?InterpolationInJSX", E = !1, yield {
								type: "JSXPunctuator",
								value: "{"
							};
							continue;
					}
			}
			v.lastIndex = S, (w = v.exec(y)) ? (S = v.lastIndex, yield {
				type: "WhiteSpace",
				value: w[0]
			}) : (s.lastIndex = S, (w = s.exec(y)) ? (S = s.lastIndex, E = !1, o.test(C) && (C = "?NoLineTerminatorHere"), yield {
				type: "LineTerminatorSequence",
				value: w[0]
			}) : (c.lastIndex = S, (w = c.exec(y)) ? (S = c.lastIndex, l.test(w[0]) && (E = !1, o.test(C) && (C = "?NoLineTerminatorHere")), yield {
				type: "MultiLineComment",
				value: w[0],
				closed: w[1] !== void 0
			}) : (p.lastIndex = S, (w = p.exec(y)) ? (S = p.lastIndex, E = !1, yield {
				type: "SingleLineComment",
				value: w[0]
			}) : (ee = String.fromCodePoint(y.codePointAt(S)), S += ee.length, C = ee, E = !1, yield {
				type: re.tag.startsWith("JSX") ? "JSXInvalid" : "Invalid",
				value: ee
			}))));
		}
	}, $h;
}
Gn(tg());
var ng = {
	keyword: /* @__PURE__ */ "break.case.catch.continue.debugger.default.do.else.finally.for.function.if.return.switch.throw.try.var.const.while.with.new.this.super.class.extends.export.import.null.true.false.in.instanceof.typeof.void.delete".split("."),
	strict: [
		"implements",
		"interface",
		"let",
		"package",
		"private",
		"protected",
		"public",
		"static",
		"yield"
	]
};
new Set(ng.keyword), new Set(ng.strict);
var rg = Object.entries({
	reset: [0, 0],
	bold: [
		1,
		22,
		"\x1B[22m\x1B[1m"
	],
	dim: [
		2,
		22,
		"\x1B[22m\x1B[2m"
	],
	italic: [3, 23],
	underline: [4, 24],
	inverse: [7, 27],
	hidden: [8, 28],
	strikethrough: [9, 29],
	black: [30, 39],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
	blue: [34, 39],
	magenta: [35, 39],
	cyan: [36, 39],
	white: [37, 39],
	gray: [90, 39],
	bgBlack: [40, 49],
	bgRed: [41, 49],
	bgGreen: [42, 49],
	bgYellow: [43, 49],
	bgBlue: [44, 49],
	bgMagenta: [45, 49],
	bgCyan: [46, 49],
	bgWhite: [47, 49],
	blackBright: [90, 39],
	redBright: [91, 39],
	greenBright: [92, 39],
	yellowBright: [93, 39],
	blueBright: [94, 39],
	magentaBright: [95, 39],
	cyanBright: [96, 39],
	whiteBright: [97, 39],
	bgBlackBright: [100, 49],
	bgRedBright: [101, 49],
	bgGreenBright: [102, 49],
	bgYellowBright: [103, 49],
	bgBlueBright: [104, 49],
	bgMagentaBright: [105, 49],
	bgCyanBright: [106, 49],
	bgWhiteBright: [107, 49]
});
function ig(e) {
	return String(e);
}
ig.open = "", ig.close = "", rg.reduce((e, [t]) => (e[t] = ig, e), { isColorSupported: !1 });
function ag(e = !1) {
	let t = typeof process < "u" ? process : void 0, n = t?.env || {}, r = t?.argv || [];
	return !("NO_COLOR" in n || r.includes("--no-color")) && ("FORCE_COLOR" in n || r.includes("--color") || t?.platform === "win32" || e && n.TERM !== "dumb" || "CI" in n) || typeof window < "u" && !!window.chrome;
}
function og(e = !1) {
	let t = ag(e), n = (e, t, n, r) => {
		let i = "", a = 0;
		do
			i += e.substring(a, r) + n, a = r + t.length, r = e.indexOf(t, a);
		while (~r);
		return i + e.substring(a);
	}, r = (e, t, r = e) => {
		let i = (i) => {
			let a = String(i), o = a.indexOf(t, e.length);
			return ~o ? e + n(a, t, r, o) + t : e + a + t;
		};
		return i.open = e, i.close = t, i;
	}, i = { isColorSupported: t }, a = (e) => `\x1B[${e}m`;
	for (let [e, n] of rg) i[e] = t ? r(a(n[0]), a(n[1]), n[2]) : ig;
	return i;
}
var sg = og();
function cg(e, t) {
	if (!e) throw Error(t);
}
function lg(e, t) {
	return typeof t === e;
}
function ug(e) {
	return e instanceof Promise;
}
function dg(e, t, n) {
	Object.defineProperty(e, t, n);
}
function fg(e, t, n) {
	dg(e, t, {
		value: n,
		configurable: !0,
		writable: !0
	});
}
var pg = /* @__PURE__ */ Symbol.for("tinyspy:spy"), mg = /* @__PURE__ */ new Set(), hg = (e) => {
	e.called = !1, e.callCount = 0, e.calls = [], e.results = [], e.resolves = [], e.next = [];
}, gg = (e) => (dg(e, pg, { value: { reset: () => hg(e[pg]) } }), e[pg]), _g = (e) => e[pg] || gg(e);
function vg(e) {
	cg(lg("function", e) || lg("undefined", e), "cannot spy on a non-function value");
	let t = function(...e) {
		let n = _g(t);
		n.called = !0, n.callCount++, n.calls.push(e);
		let r = n.next.shift();
		if (r) {
			n.results.push(r);
			let [e, t] = r;
			if (e === "ok") return t;
			throw t;
		}
		let i, a = "ok", o = n.results.length;
		if (n.impl) try {
			i = new.target ? Reflect.construct(n.impl, e, new.target) : n.impl.apply(this, e), a = "ok";
		} catch (e) {
			throw i = e, a = "error", n.results.push([a, e]), e;
		}
		let s = [a, i];
		return ug(i) && i.then((e) => n.resolves[o] = ["ok", e], (e) => n.resolves[o] = ["error", e]), n.results.push(s), i;
	};
	fg(t, "_isMockFunction", !0), fg(t, "length", e ? e.length : 0), fg(t, "name", e && e.name || "spy");
	let n = _g(t);
	return n.reset(), n.impl = e, t;
}
function yg(e) {
	return !!e && e._isMockFunction === !0;
}
var bg = (e, t) => {
	let n = Object.getOwnPropertyDescriptor(e, t);
	if (n) return [e, n];
	let r = Object.getPrototypeOf(e);
	for (; r !== null;) {
		let e = Object.getOwnPropertyDescriptor(r, t);
		if (e) return [r, e];
		r = Object.getPrototypeOf(r);
	}
}, xg = (e, t) => {
	t != null && typeof t == "function" && t.prototype != null && Object.setPrototypeOf(e.prototype, t.prototype);
};
function Sg(e, t, n) {
	cg(!lg("undefined", e), "spyOn could not find an object to spy upon"), cg(lg("object", e) || lg("function", e), "cannot spyOn on a primitive value");
	let [r, i] = (() => {
		if (!lg("object", t)) return [t, "value"];
		if ("getter" in t && "setter" in t) throw Error("cannot spy on both getter and setter");
		if ("getter" in t) return [t.getter, "get"];
		if ("setter" in t) return [t.setter, "set"];
		throw Error("specify getter or setter to spy on");
	})(), [a, o] = bg(e, r) || [];
	cg(o || r in e, `${String(r)} does not exist`);
	let s = !1;
	i === "value" && o && !o.value && o.get && (i = "get", s = !0, n = o.get());
	let c;
	c = o ? o[i] : i === "value" ? e[r] : () => e[r], c && Eg(c) && (c = c[pg].getOriginal());
	let l = (t) => {
		let { value: n, ...a } = o || {
			configurable: !0,
			writable: !0
		};
		i !== "value" && delete a.writable, a[i] = t, dg(e, r, a);
	}, u = () => {
		a === e ? o && !c ? dg(e, r, o) : l(c) : Reflect.deleteProperty(e, r);
	};
	n ||= c;
	let d = Tg(vg(n), n);
	i === "value" && xg(d, c);
	let f = d[pg];
	return fg(f, "restore", u), fg(f, "getOriginal", () => s ? c() : c), fg(f, "willCall", (e) => (f.impl = e, d)), l(s ? () => (xg(d, n), d) : d), mg.add(d), d;
}
var Cg = /* @__PURE__ */ new Set([
	"length",
	"name",
	"prototype"
]);
function wg(e) {
	let t = /* @__PURE__ */ new Set(), n = {};
	for (; e && e !== Object.prototype && e !== Function.prototype;) {
		let r = [...Object.getOwnPropertyNames(e), ...Object.getOwnPropertySymbols(e)];
		for (let i of r) n[i] || Cg.has(i) || (t.add(i), n[i] = Object.getOwnPropertyDescriptor(e, i));
		e = Object.getPrototypeOf(e);
	}
	return {
		properties: t,
		descriptors: n
	};
}
function Tg(e, t) {
	if (!t || pg in t) return e;
	let { properties: n, descriptors: r } = wg(t);
	for (let t of n) {
		let n = r[t];
		bg(e, t) || dg(e, t, n);
	}
	return e;
}
function Eg(e) {
	return yg(e) && "getOriginal" in e[pg];
}
var Dg = /* @__PURE__ */ new Set();
function Og(e) {
	return typeof e == "function" && "_isMockFunction" in e && e._isMockFunction;
}
var kg = 0;
function Ag(e) {
	let t = e, n, r = [], i = !1, a = [], o = [], s = [], c = _g(e), l = {
		get calls() {
			return c.calls;
		},
		get contexts() {
			return o;
		},
		get instances() {
			return a;
		},
		get invocationCallOrder() {
			return s;
		},
		get results() {
			return c.results.map(([e, t]) => ({
				type: e === "error" ? "throw" : "return",
				value: t
			}));
		},
		get settledResults() {
			return c.resolves.map(([e, t]) => ({
				type: e === "error" ? "rejected" : "fulfilled",
				value: t
			}));
		},
		get lastCall() {
			return c.calls[c.calls.length - 1];
		},
		_state(e) {
			return e && (n = e.implementation, r = e.onceImplementations, i = e.implementationChangedTemporarily), {
				implementation: n,
				onceImplementations: r,
				implementationChangedTemporarily: i
			};
		}
	};
	function u(...e) {
		return a.push(this), o.push(this), s.push(++kg), (i ? n : r.shift() || n || c.getOriginal() || (() => {})).apply(this, e);
	}
	let d = t.name;
	t.getMockName = () => d || "vi.fn()", t.mockName = (e) => (d = e, t), t.mockClear = () => (c.reset(), a = [], o = [], s = [], t), t.mockReset = () => (t.mockClear(), n = void 0, r = [], t), t.mockRestore = () => (t.mockReset(), c.restore(), t), Symbol.dispose && (t[Symbol.dispose] = () => t.mockRestore()), t.getMockImplementation = () => i ? n : r.at(0) || n, t.mockImplementation = (e) => (n = e, c.willCall(u), t), t.mockImplementationOnce = (e) => (r.push(e), t);
	function f(e, r) {
		let a = n;
		n = e, c.willCall(u), i = !0;
		let o = () => {
			n = a, i = !1;
		}, s = r();
		return typeof s == "object" && s && typeof s.then == "function" ? s.then(() => (o(), t)) : (o(), t);
	}
	return t.withImplementation = f, t.mockReturnThis = () => t.mockImplementation(function() {
		return this;
	}), t.mockReturnValue = (e) => t.mockImplementation(() => e), t.mockReturnValueOnce = (e) => t.mockImplementationOnce(() => e), t.mockResolvedValue = (e) => t.mockImplementation(() => Promise.resolve(e)), t.mockResolvedValueOnce = (e) => t.mockImplementationOnce(() => Promise.resolve(e)), t.mockRejectedValue = (e) => t.mockImplementation(() => Promise.reject(e)), t.mockRejectedValueOnce = (e) => t.mockImplementationOnce(() => Promise.reject(e)), Object.defineProperty(t, "mock", { get: () => l }), c.willCall(u), Dg.add(t), t;
}
function jg(e) {
	let t = Ag(Sg({ spy: e || function() {} }, "spy"));
	return e && t.mockImplementation(e), t;
}
var Mg = /* @__PURE__ */ Symbol.for("matchers-object"), Ng = /* @__PURE__ */ Symbol.for("$$jest-matchers-object-storybook"), Pg = /* @__PURE__ */ Symbol.for("expect-global"), Fg = /* @__PURE__ */ Symbol.for("asymmetric-matchers-object"), Ig = {
	toSatisfy(e, t, n) {
		let { printReceived: r, printExpected: i, matcherHint: a } = this.utils, o = t(e);
		return {
			pass: o,
			message: () => o ? `${a(".not.toSatisfy", "received", "")}

Expected value to not satisfy:
${n || i(t)}
Received:
${r(e)}` : `${a(".toSatisfy", "received", "")}

Expected value to satisfy:
${n || i(t)}

Received:
${r(e)}`
		};
	},
	toBeOneOf(e, t) {
		let { equals: n, customTesters: r } = this, { printReceived: i, printExpected: a, matcherHint: o } = this.utils;
		if (!Array.isArray(t)) throw TypeError(`You must provide an array to ${o(".toBeOneOf")}, not '${typeof t}'.`);
		let s = t.length === 0 || t.some((t) => n(t, e, r));
		return {
			pass: s,
			message: () => s ? `${o(".not.toBeOneOf", "received", "")}

Expected value to not be one of:
${a(t)}
Received:
${i(e)}` : `${o(".toBeOneOf", "received", "")}

Expected value to be one of:
${a(t)}

Received:
${i(e)}`
		};
	}
}, Lg = sg.green, Rg = sg.red, zg = sg.inverse, Bg = sg.bold, Vg = sg.dim;
function Hg(e, t = "received", n = "expected", r = {}) {
	let { comment: i = "", isDirectExpectCall: a = !1, isNot: o = !1, promise: s = "", secondArgument: c = "", expectedColor: l = Lg, receivedColor: u = Rg, secondArgumentColor: d = Lg } = r, f = "", p = "expect";
	return !a && t !== "" && (f += Vg(`${p}(`) + u(t), p = ")"), s !== "" && (f += Vg(`${p}.`) + s, p = ""), o && (f += `${Vg(`${p}.`)}not`, p = ""), e.includes(".") ? p += e : (f += Vg(`${p}.`) + e, p = ""), n === "" ? p += "()" : (f += Vg(`${p}(`) + l(n), c && (f += Vg(", ") + d(c)), p = ")"), i !== "" && (p += ` // ${i}`), p !== "" && (f += Vg(p)), f;
}
var Ug = "·";
function Wg(e) {
	return e.replace(/\s+$/gm, (e) => Ug.repeat(e.length));
}
function Gg(e) {
	return Rg(Wg(Vn(e)));
}
function Kg(e) {
	return Lg(Wg(Vn(e)));
}
function qg() {
	return {
		EXPECTED_COLOR: Lg,
		RECEIVED_COLOR: Rg,
		INVERTED_COLOR: zg,
		BOLD_WEIGHT: Bg,
		DIM_COLOR: Vg,
		diff: ci,
		matcherHint: Hg,
		printReceived: Gg,
		printExpected: Kg,
		printDiffOrStringify: vi,
		printWithType: Jg
	};
}
function Jg(e, t, n) {
	let r = Yn(t);
	return (r !== "null" && r !== "undefined" ? `${e} has type:  ${r}
` : "") + `${e} has value: ${n(t)}`;
}
function Yg() {
	return globalThis[Ng].customEqualityTesters;
}
function Z(e, t, n, r) {
	return n ||= [], Qg(e, t, [], [], n, r ? n_ : t_);
}
Function.prototype.toString;
function Xg(e) {
	return !!e && typeof e == "object" && "asymmetricMatch" in e && r_("Function", e.asymmetricMatch);
}
function Zg(e, t) {
	let n = Xg(e), r = Xg(t);
	if (!(n && r)) {
		if (n) return e.asymmetricMatch(t);
		if (r) return t.asymmetricMatch(e);
	}
}
function Qg(e, t, n, r, i, a) {
	let o = !0, s = Zg(e, t);
	if (s !== void 0) return s;
	let c = { equals: Z };
	for (let n = 0; n < i.length; n++) {
		let r = i[n].call(c, e, t, i);
		if (r !== void 0) return r;
	}
	if (typeof URL == "function" && e instanceof URL && t instanceof URL) return e.href === t.href;
	if (Object.is(e, t)) return !0;
	if (e === null || t === null) return e === t;
	let l = Object.prototype.toString.call(e);
	if (l !== Object.prototype.toString.call(t)) return !1;
	switch (l) {
		case "[object Boolean]":
		case "[object String]":
		case "[object Number]": return typeof e == typeof t ? typeof e != "object" && typeof t != "object" ? Object.is(e, t) : Object.is(e.valueOf(), t.valueOf()) : !1;
		case "[object Date]": {
			let n = +e, r = +t;
			return n === r || Number.isNaN(n) && Number.isNaN(r);
		}
		case "[object RegExp]": return e.source === t.source && e.flags === t.flags;
		case "[object Temporal.Instant]":
		case "[object Temporal.ZonedDateTime]":
		case "[object Temporal.PlainDateTime]":
		case "[object Temporal.PlainDate]":
		case "[object Temporal.PlainTime]":
		case "[object Temporal.PlainYearMonth]":
		case "[object Temporal.PlainMonthDay]": return e.equals(t);
		case "[object Temporal.Duration]": return e.toString() === t.toString();
	}
	if (typeof e != "object" || typeof t != "object") return !1;
	if (i_(e) && i_(t)) return e.isEqualNode(t);
	let u = n.length;
	for (; u--;) {
		if (n[u] === e) return r[u] === t;
		if (r[u] === t) return !1;
	}
	if (n.push(e), r.push(t), l === "[object Array]" && e.length !== t.length) return !1;
	if (e instanceof Error && t instanceof Error) try {
		return $g(e, t, n, r, i, a);
	} finally {
		n.pop(), r.pop();
	}
	let d = e_(e, a), f, p = d.length;
	if (e_(t, a).length !== p) return !1;
	for (; p--;) if (f = d[p], o = a(t, f) && Qg(e[f], t[f], n, r, i, a), !o) return !1;
	return n.pop(), r.pop(), o;
}
function $g(e, t, n, r, i, a) {
	let o = Object.getPrototypeOf(e) === Object.getPrototypeOf(t) && e.name === t.name && e.message === t.message;
	return typeof t.cause < "u" && o && (o = Qg(e.cause, t.cause, n, r, i, a)), e instanceof AggregateError && t instanceof AggregateError && o && (o = Qg(e.errors, t.errors, n, r, i, a)), o &&= Qg({ ...e }, { ...t }, n, r, i, a), o;
}
function e_(e, t) {
	let n = [];
	for (let r in e) t(e, r) && n.push(r);
	return n.concat(Object.getOwnPropertySymbols(e).filter((t) => Object.getOwnPropertyDescriptor(e, t).enumerable));
}
function t_(e, t) {
	return n_(e, t) && e[t] !== void 0;
}
function n_(e, t) {
	return Object.prototype.hasOwnProperty.call(e, t);
}
function r_(e, t) {
	return Object.prototype.toString.apply(t) === `[object ${e}]`;
}
function i_(e) {
	return typeof e == "object" && !!e && "nodeType" in e && typeof e.nodeType == "number" && "nodeName" in e && typeof e.nodeName == "string" && "isEqualNode" in e && typeof e.isEqualNode == "function";
}
var a_ = "@@__IMMUTABLE_KEYED__@@", o_ = "@@__IMMUTABLE_SET__@@", s_ = "@@__IMMUTABLE_LIST__@@", c_ = "@@__IMMUTABLE_ORDERED__@@", l_ = "@@__IMMUTABLE_RECORD__@@";
function u_(e) {
	return !!(e && e[a_] && !e[c_]);
}
function d_(e) {
	return !!(e && e[o_] && !e[c_]);
}
function f_(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function p_(e) {
	return !!(e && f_(e) && e[s_]);
}
function m_(e) {
	return !!(e && f_(e) && e[a_] && e[c_]);
}
function h_(e) {
	return !!(e && f_(e) && e[o_] && e[c_]);
}
function g_(e) {
	return !!(e && f_(e) && e[l_]);
}
var __ = Symbol.iterator;
function v_(e) {
	return !!(e != null && e[__]);
}
function y_(e, t, n = [], r = [], i = []) {
	if (typeof e != "object" || typeof t != "object" || Array.isArray(e) || Array.isArray(t) || !v_(e) || !v_(t)) return;
	if (e.constructor !== t.constructor) return !1;
	let a = r.length;
	for (; a--;) if (r[a] === e) return i[a] === t;
	r.push(e), i.push(t);
	let o = [...n.filter((e) => e !== y_), s];
	function s(e, t) {
		return y_(e, t, [...n], [...r], [...i]);
	}
	if (e.size !== void 0) {
		if (e.size !== t.size) return !1;
		if (r_("Set", e) || d_(e)) {
			let n = !0;
			for (let r of e) if (!t.has(r)) {
				let e = !1;
				for (let n of t) Z(r, n, o) === !0 && (e = !0);
				if (e === !1) {
					n = !1;
					break;
				}
			}
			return r.pop(), i.pop(), n;
		}
		if (r_("Map", e) || u_(e)) {
			let n = !0;
			for (let r of e) if (!t.has(r[0]) || !Z(r[1], t.get(r[0]), o)) {
				let e = !1;
				for (let n of t) {
					let t = Z(r[0], n[0], o), i = !1;
					t === !0 && (i = Z(r[1], n[1], o)), i === !0 && (e = !0);
				}
				if (e === !1) {
					n = !1;
					break;
				}
			}
			return r.pop(), i.pop(), n;
		}
	}
	let c = t[__]();
	for (let t of e) {
		let e = c.next();
		if (e.done || !Z(t, e.value, o)) return !1;
	}
	return !c.next().done || !p_(e) && !m_(e) && !h_(e) && !g_(e) && !Z(Object.entries(e), Object.entries(t), o) ? !1 : (r.pop(), i.pop(), !0);
}
function b_(e, t) {
	return !e || typeof e != "object" || e === Object.prototype ? !1 : Object.prototype.hasOwnProperty.call(e, t) || b_(Object.getPrototypeOf(e), t);
}
function x_(e) {
	return qn(e) && !(e instanceof Error) && !Array.isArray(e) && !(e instanceof Date);
}
function S_(e, t, n = []) {
	let r = n.filter((e) => e !== S_), i = (e = /* @__PURE__ */ new WeakMap()) => (t, n) => {
		if (x_(n)) return Object.keys(n).every((a) => {
			if (n[a] != null && typeof n[a] == "object") {
				if (e.has(n[a])) return Z(t[a], n[a], r);
				e.set(n[a], !0);
			}
			let o = t != null && b_(t, a) && Z(t[a], n[a], [...r, i(e)]);
			return e.delete(n[a]), o;
		});
	};
	return i()(e, t);
}
function C_(e, t) {
	if (e != null && t != null && e.constructor !== t.constructor) return !1;
}
function w_(e, t) {
	let n = e, r = t;
	if (!(e instanceof DataView && t instanceof DataView)) {
		if (!(e instanceof ArrayBuffer) || !(t instanceof ArrayBuffer)) return;
		try {
			n = new DataView(e), r = new DataView(t);
		} catch {
			return;
		}
	}
	if (n.byteLength !== r.byteLength) return !1;
	for (let e = 0; e < n.byteLength; e++) if (n.getUint8(e) !== r.getUint8(e)) return !1;
	return !0;
}
function T_(e, t, n = []) {
	if (!Array.isArray(e) || !Array.isArray(t)) return;
	let r = Object.keys(e), i = Object.keys(t);
	return Z(e, t, n.filter((e) => e !== T_), !0) && Z(r, i);
}
function E_(e, t = "#{this}", n = "#{exp}") {
	let r = `expected ${t} to be ${n} // Object.is equality`;
	return ["toStrictEqual", "toEqual"].includes(e) ? `${r}

If it should pass with deep equality, replace "toBe" with "${e}"

Expected: ${t}
Received: serializes to the same string
` : r;
}
function D_(e, t) {
	return `${t} ${e}${t === 1 ? "" : "s"}`;
}
function O_(e) {
	return [...Object.keys(e), ...Object.getOwnPropertySymbols(e).filter((t) => Object.getOwnPropertyDescriptor(e, t)?.enumerable)];
}
function k_(e, t, n) {
	let r = 0, i = (e = /* @__PURE__ */ new WeakMap()) => (t, a) => {
		if (Array.isArray(t)) {
			if (Array.isArray(a) && a.length === t.length) return a.map((n, r) => i(e)(t[r], n));
		} else {
			if (t instanceof Date) return t;
			if (qn(t) && qn(a)) {
				if (Z(t, a, [
					...n,
					y_,
					S_
				])) return a;
				let o = {};
				e.set(t, o), typeof t.constructor == "function" && typeof t.constructor.name == "string" && Object.defineProperty(o, "constructor", {
					enumerable: !1,
					value: t.constructor
				});
				for (let n of O_(t)) b_(a, n) ? o[n] = e.has(t[n]) ? e.get(t[n]) : i(e)(t[n], a[n]) : e.has(t[n]) || (r += 1, qn(t[n]) && (r += O_(t[n]).length), i(e)(t[n], a[n]));
				if (O_(o).length > 0) return o;
			}
		}
		return t;
	};
	return {
		subset: i()(e, t),
		stripped: r
	};
}
if (!Object.prototype.hasOwnProperty.call(globalThis, Mg)) {
	let e = /* @__PURE__ */ new WeakMap();
	Object.defineProperty(globalThis, Mg, { get: () => e });
}
if (!Object.prototype.hasOwnProperty.call(globalThis, Ng)) {
	let e = /* @__PURE__ */ Object.create(null), t = [];
	Object.defineProperty(globalThis, Ng, {
		configurable: !0,
		get: () => ({
			state: globalThis[Mg].get(globalThis[Pg]),
			matchers: e,
			customEqualityTesters: t
		})
	});
}
if (!Object.prototype.hasOwnProperty.call(globalThis, Fg)) {
	let e = /* @__PURE__ */ Object.create(null);
	Object.defineProperty(globalThis, Fg, { get: () => e });
}
function A_(e) {
	return globalThis[Mg].get(e);
}
function j_(e, t) {
	let n = globalThis[Mg], r = n.get(t) || {}, i = Object.defineProperties(r, {
		...Object.getOwnPropertyDescriptors(r),
		...Object.getOwnPropertyDescriptors(e)
	});
	n.set(t, i);
}
var M_ = class {
	$$typeof = /* @__PURE__ */ Symbol.for("jest.asymmetricMatcher");
	constructor(e, t = !1) {
		this.sample = e, this.inverse = t;
	}
	getMatcherContext(e) {
		return {
			...A_(e || globalThis[Pg]),
			equals: Z,
			isNot: this.inverse,
			customTesters: Yg(),
			utils: {
				...qg(),
				diff: ci,
				stringify: Vn,
				iterableEquality: y_,
				subsetEquality: S_
			}
		};
	}
};
M_.prototype[/* @__PURE__ */ Symbol.for("chai/inspect")] = function(e) {
	let t = Vn(this, e.depth, { min: !0 });
	return t.length <= e.truncate ? t : `${this.toString()}{\u2026}`;
};
var N_ = class extends M_ {
	constructor(e, t = !1) {
		if (!r_("String", e)) throw Error("Expected is not a string");
		super(e, t);
	}
	asymmetricMatch(e) {
		let t = r_("String", e) && e.includes(this.sample);
		return this.inverse ? !t : t;
	}
	toString() {
		return `String${this.inverse ? "Not" : ""}Containing`;
	}
	getExpectedType() {
		return "string";
	}
}, P_ = class extends M_ {
	asymmetricMatch(e) {
		return e != null;
	}
	toString() {
		return "Anything";
	}
	toAsymmetricMatcher() {
		return "Anything";
	}
}, F_ = class extends M_ {
	constructor(e, t = !1) {
		super(e, t);
	}
	getPrototype(e) {
		return Object.getPrototypeOf ? Object.getPrototypeOf(e) : e.constructor.prototype === e ? null : e.constructor.prototype;
	}
	hasProperty(e, t) {
		return e ? Object.prototype.hasOwnProperty.call(e, t) ? !0 : this.hasProperty(this.getPrototype(e), t) : !1;
	}
	asymmetricMatch(e) {
		if (typeof this.sample != "object") throw TypeError(`You must provide an object to ${this.toString()}, not '${typeof this.sample}'.`);
		let t = !0, n = this.getMatcherContext();
		for (let r in this.sample) if (!this.hasProperty(e, r) || !Z(this.sample[r], e[r], n.customTesters)) {
			t = !1;
			break;
		}
		return this.inverse ? !t : t;
	}
	toString() {
		return `Object${this.inverse ? "Not" : ""}Containing`;
	}
	getExpectedType() {
		return "object";
	}
}, I_ = class extends M_ {
	constructor(e, t = !1) {
		super(e, t);
	}
	asymmetricMatch(e) {
		if (!Array.isArray(this.sample)) throw TypeError(`You must provide an array to ${this.toString()}, not '${typeof this.sample}'.`);
		let t = this.getMatcherContext(), n = this.sample.length === 0 || Array.isArray(e) && this.sample.every((n) => e.some((e) => Z(n, e, t.customTesters)));
		return this.inverse ? !n : n;
	}
	toString() {
		return `Array${this.inverse ? "Not" : ""}Containing`;
	}
	getExpectedType() {
		return "array";
	}
}, L_ = class extends M_ {
	constructor(e) {
		if (typeof e > "u") throw TypeError("any() expects to be passed a constructor function. Please pass one or use anything() to match any object.");
		super(e);
	}
	fnNameFor(e) {
		if (e.name) return e.name;
		let t = Function.prototype.toString.call(e).match(/^(?:async)?\s*function\s*(?:\*\s*)?([\w$]+)\s*\(/);
		return t ? t[1] : "<anonymous>";
	}
	asymmetricMatch(e) {
		return this.sample === String ? typeof e == "string" || e instanceof String : this.sample === Number ? typeof e == "number" || e instanceof Number : this.sample === Function ? typeof e == "function" || typeof e == "function" : this.sample === Boolean ? typeof e == "boolean" || e instanceof Boolean : this.sample === BigInt ? typeof e == "bigint" || e instanceof BigInt : this.sample === Symbol ? typeof e == "symbol" || e instanceof Symbol : this.sample === Object ? typeof e == "object" : e instanceof this.sample;
	}
	toString() {
		return "Any";
	}
	getExpectedType() {
		return this.sample === String ? "string" : this.sample === Number ? "number" : this.sample === Function ? "function" : this.sample === Object ? "object" : this.sample === Boolean ? "boolean" : this.fnNameFor(this.sample);
	}
	toAsymmetricMatcher() {
		return `Any<${this.fnNameFor(this.sample)}>`;
	}
}, R_ = class extends M_ {
	constructor(e, t = !1) {
		if (!r_("String", e) && !r_("RegExp", e)) throw Error("Expected is not a String or a RegExp");
		super(new RegExp(e), t);
	}
	asymmetricMatch(e) {
		let t = r_("String", e) && this.sample.test(e);
		return this.inverse ? !t : t;
	}
	toString() {
		return `String${this.inverse ? "Not" : ""}Matching`;
	}
	getExpectedType() {
		return "string";
	}
}, z_ = class extends M_ {
	precision;
	constructor(e, t = 2, n = !1) {
		if (!r_("Number", e)) throw Error("Expected is not a Number");
		if (!r_("Number", t)) throw Error("Precision is not a Number");
		super(e), this.inverse = n, this.precision = t;
	}
	asymmetricMatch(e) {
		if (!r_("Number", e)) return !1;
		let t = !1;
		return t = e === Infinity && this.sample === Infinity || e === -Infinity && this.sample === -Infinity || Math.abs(this.sample - e) < 10 ** -this.precision / 2, this.inverse ? !t : t;
	}
	toString() {
		return `Number${this.inverse ? "Not" : ""}CloseTo`;
	}
	getExpectedType() {
		return "number";
	}
	toAsymmetricMatcher() {
		return [
			this.toString(),
			this.sample,
			`(${D_("digit", this.precision)})`
		].join(" ");
	}
}, B_ = (e, t) => {
	t.addMethod(e.expect, "anything", () => new P_()), t.addMethod(e.expect, "any", (e) => new L_(e)), t.addMethod(e.expect, "stringContaining", (e) => new N_(e)), t.addMethod(e.expect, "objectContaining", (e) => new F_(e)), t.addMethod(e.expect, "arrayContaining", (e) => new I_(e)), t.addMethod(e.expect, "stringMatching", (e) => new R_(e)), t.addMethod(e.expect, "closeTo", (e, t) => new z_(e, t)), e.expect.not = {
		stringContaining: (e) => new N_(e, !0),
		objectContaining: (e) => new F_(e, !0),
		arrayContaining: (e) => new I_(e, !0),
		stringMatching: (e) => new R_(e, !0),
		closeTo: (e, t) => new z_(e, t, !0)
	};
};
function V_(e, t, n) {
	let r = e.flag(t, "negate") ? "not." : "", i = `${e.flag(t, "_name")}(${n ? "expected" : ""})`, a = e.flag(t, "promise");
	return `expect(actual)${a ? `.${a}` : ""}.${r}${i}`;
}
function H_(e, t, n, r) {
	let i = e;
	if (i && t instanceof Promise) {
		t = t.finally(() => {
			if (!i.promises) return;
			let e = i.promises.indexOf(t);
			e !== -1 && i.promises.splice(e, 1);
		}), i.promises ||= [], i.promises.push(t);
		let e = !1;
		return i.onFinished ??= [], i.onFinished.push(() => {
			if (!e) {
				let e = (globalThis.__vitest_worker__?.onFilterStackTrace || ((e) => e || ""))(r.stack);
				console.warn([
					`Promise returned by \`${n}\` was not awaited. `,
					"Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. ",
					"Please remember to await the assertion.\n",
					e
				].join(""));
			}
		}), {
			then(n, r) {
				return e = !0, t.then(n, r);
			},
			catch(e) {
				return t.catch(e);
			},
			finally(e) {
				return t.finally(e);
			},
			[Symbol.toStringTag]: "Promise"
		};
	}
	return t;
}
function U_(e, t) {
	var n;
	e.result ||= { state: "fail" }, e.result.state = "fail", (n = e.result).errors || (n.errors = []), e.result.errors.push(Pi(t));
}
function W_(e, t, n) {
	return function(...r) {
		if (t !== "withTest" && e.flag(this, "_name", t), !e.flag(this, "soft")) return n.apply(this, r);
		let i = e.flag(this, "vitest-test");
		if (!i) throw Error("expect.soft() can only be used inside a test");
		try {
			let e = n.apply(this, r);
			return e && typeof e == "object" && typeof e.then == "function" ? e.then(tr, (e) => {
				U_(i, e);
			}) : e;
		} catch (e) {
			U_(i, e);
		}
	};
}
var G_ = (e, t) => {
	let { AssertionError: n } = e, r = Yg();
	function i(n, r) {
		let i = (n) => {
			let i = W_(t, n, r);
			t.addMethod(e.Assertion.prototype, n, i), t.addMethod(globalThis[Ng].matchers, n, i);
		};
		Array.isArray(n) ? n.forEach((e) => i(e)) : i(n);
	}
	[
		"throw",
		"throws",
		"Throw"
	].forEach((r) => {
		t.overwriteMethod(e.Assertion.prototype, r, (e) => function(...r) {
			let i = t.flag(this, "promise"), a = t.flag(this, "object"), o = t.flag(this, "negate");
			if (i === "rejects") t.flag(this, "object", () => {
				throw a;
			});
			else if (i === "resolves" && typeof a != "function") {
				if (o) return;
				{
					let e = t.flag(this, "message") || "expected promise to throw an error, but it didn't";
					throw new n(e, { showDiff: !1 }, t.flag(this, "ssfi"));
				}
			}
			e.apply(this, r);
		});
	}), i("withTest", function(e) {
		return t.flag(this, "vitest-test", e), this;
	}), i("toEqual", function(e) {
		let n = t.flag(this, "object"), i = Z(n, e, [...r, y_]);
		return this.assert(i, "expected #{this} to deeply equal #{exp}", "expected #{this} to not deeply equal #{exp}", e, n);
	}), i("toStrictEqual", function(e) {
		let n = t.flag(this, "object"), i = Z(n, e, [
			...r,
			y_,
			C_,
			T_,
			w_
		], !0);
		return this.assert(i, "expected #{this} to strictly equal #{exp}", "expected #{this} to not strictly equal #{exp}", e, n);
	}), i("toBe", function(e) {
		let t = this._obj, n = Object.is(t, e), i = "";
		return n || (Z(t, e, [
			...r,
			y_,
			C_,
			T_,
			w_
		], !0) ? i = "toStrictEqual" : Z(t, e, [...r, y_]) && (i = "toEqual")), this.assert(n, E_(i), "expected #{this} not to be #{exp} // Object.is equality", e, t);
	}), i("toMatchObject", function(e) {
		let i = this._obj, a = Z(i, e, [
			...r,
			y_,
			S_
		]), o = t.flag(this, "negate"), { subset: s, stripped: c } = k_(i, e, r);
		if (a && o || !a && !o) {
			let r = t.getMessage(this, [
				a,
				"expected #{this} to match object #{exp}",
				"expected #{this} to not match object #{exp}",
				e,
				s,
				!1
			]), i = c === 0 ? r : `${r}
(${c} matching ${c === 1 ? "property" : "properties"} omitted from actual)`;
			throw new n(i, {
				showDiff: !0,
				expected: e,
				actual: s
			});
		}
	}), i("toMatch", function(e) {
		let t = this._obj;
		if (typeof t != "string") throw TypeError(`.toMatch() expects to receive a string, but got ${typeof t}`);
		return this.assert(typeof e == "string" ? t.includes(e) : t.match(e), "expected #{this} to match #{exp}", "expected #{this} not to match #{exp}", e, t);
	}), i("toContain", function(e) {
		let n = this._obj;
		if (typeof Node < "u" && n instanceof Node) {
			if (!(e instanceof Node)) throw TypeError(`toContain() expected a DOM node as the argument, but got ${typeof e}`);
			return this.assert(n.contains(e), "expected #{this} to contain element #{exp}", "expected #{this} not to contain element #{exp}", e, n);
		}
		if (typeof DOMTokenList < "u" && n instanceof DOMTokenList) {
			Kn(e, "class name", ["string"]);
			let r = t.flag(this, "negate") ? n.value.replace(e, "").trim() : `${n.value} ${e}`;
			return this.assert(n.contains(e), `expected "${n.value}" to contain "${e}"`, `expected "${n.value}" not to contain "${e}"`, r, n.value);
		}
		return typeof n == "string" && typeof e == "string" ? this.assert(n.includes(e), "expected #{this} to contain #{exp}", "expected #{this} not to contain #{exp}", e, n) : (n != null && typeof n != "string" && t.flag(this, "object", Array.from(n)), this.contain(e));
	}), i("toContainEqual", function(e) {
		let n = t.flag(this, "object"), i = Array.from(n).findIndex((t) => Z(t, e, r));
		this.assert(i !== -1, "expected #{this} to deep equally contain #{exp}", "expected #{this} to not deep equally contain #{exp}", e);
	}), i("toBeTruthy", function() {
		let e = t.flag(this, "object");
		this.assert(!!e, "expected #{this} to be truthy", "expected #{this} to not be truthy", !0, e);
	}), i("toBeFalsy", function() {
		let e = t.flag(this, "object");
		this.assert(!e, "expected #{this} to be falsy", "expected #{this} to not be falsy", !1, e);
	}), i("toBeGreaterThan", function(e) {
		let t = this._obj;
		return Kn(t, "actual", ["number", "bigint"]), Kn(e, "expected", ["number", "bigint"]), this.assert(t > e, `expected ${t} to be greater than ${e}`, `expected ${t} to be not greater than ${e}`, e, t, !1);
	}), i("toBeGreaterThanOrEqual", function(e) {
		let t = this._obj;
		return Kn(t, "actual", ["number", "bigint"]), Kn(e, "expected", ["number", "bigint"]), this.assert(t >= e, `expected ${t} to be greater than or equal to ${e}`, `expected ${t} to be not greater than or equal to ${e}`, e, t, !1);
	}), i("toBeLessThan", function(e) {
		let t = this._obj;
		return Kn(t, "actual", ["number", "bigint"]), Kn(e, "expected", ["number", "bigint"]), this.assert(t < e, `expected ${t} to be less than ${e}`, `expected ${t} to be not less than ${e}`, e, t, !1);
	}), i("toBeLessThanOrEqual", function(e) {
		let t = this._obj;
		return Kn(t, "actual", ["number", "bigint"]), Kn(e, "expected", ["number", "bigint"]), this.assert(t <= e, `expected ${t} to be less than or equal to ${e}`, `expected ${t} to be not less than or equal to ${e}`, e, t, !1);
	}), i("toBeNaN", function() {
		let e = t.flag(this, "object");
		this.assert(Number.isNaN(e), "expected #{this} to be NaN", "expected #{this} not to be NaN", NaN, e);
	}), i("toBeUndefined", function() {
		let e = t.flag(this, "object");
		this.assert(e === void 0, "expected #{this} to be undefined", "expected #{this} not to be undefined", void 0, e);
	}), i("toBeNull", function() {
		let e = t.flag(this, "object");
		this.assert(e === null, "expected #{this} to be null", "expected #{this} not to be null", null, e);
	}), i("toBeDefined", function() {
		let e = t.flag(this, "object");
		this.assert(typeof e < "u", "expected #{this} to be defined", "expected #{this} to be undefined", e);
	}), i("toBeTypeOf", function(e) {
		let t = typeof this._obj, n = e === t;
		return this.assert(n, "expected #{this} to be type of #{exp}", "expected #{this} not to be type of #{exp}", e, t);
	}), i("toBeInstanceOf", function(e) {
		return this.instanceOf(e);
	}), i("toHaveLength", function(e) {
		return this.have.length(e);
	}), i("toHaveProperty", function(...e) {
		Array.isArray(e[0]) && (e[0] = e[0].map((e) => String(e).replace(/([.[\]])/g, "\\$1")).join("."));
		let n = this._obj, [i, a] = e, { value: o, exists: s } = Object.prototype.hasOwnProperty.call(n, i) ? {
			value: n[i],
			exists: !0
		} : t.getPathInfo(n, i), c = s && (e.length === 1 || Z(a, o, r)), l = e.length === 1 ? "" : ` with value ${t.objDisplay(a)}`;
		return this.assert(c, `expected #{this} to have property "${i}"${l}`, `expected #{this} to not have property "${i}"${l}`, a, s ? o : void 0);
	}), i("toBeCloseTo", function(e, t = 2) {
		let n = this._obj, r = !1, i = 0, a = 0;
		return e === Infinity && n === Infinity || e === -Infinity && n === -Infinity ? r = !0 : (i = 10 ** -t / 2, a = Math.abs(n - e), r = a < i), this.assert(r, `expected #{this} to be close to #{exp}, received difference is ${a}, but expected ${i}`, `expected #{this} to not be close to #{exp}, received difference is ${a}, but expected ${i}`, e, n, !1);
	});
	function a(e) {
		if (!Og(e._obj)) throw TypeError(`${t.inspect(e._obj)} is not a spy or a call to a spy!`);
	}
	function o(e) {
		return a(e), e._obj;
	}
	i(["toHaveBeenCalledTimes", "toBeCalledTimes"], function(e) {
		let t = o(this), n = t.getMockName(), r = t.mock.calls.length;
		return this.assert(r === e, `expected "${n}" to be called #{exp} times, but got ${r} times`, `expected "${n}" to not be called #{exp} times`, e, r, !1);
	}), i("toHaveBeenCalledOnce", function() {
		let e = o(this), t = e.getMockName(), n = e.mock.calls.length;
		return this.assert(n === 1, `expected "${t}" to be called once, but got ${n} times`, `expected "${t}" to not be called once`, 1, n, !1);
	}), i(["toHaveBeenCalled", "toBeCalled"], function() {
		let e = o(this), r = e.getMockName(), i = e.mock.calls.length, a = i > 0, s = t.flag(this, "negate"), c = t.getMessage(this, [
			a,
			`expected "${r}" to be called at least once`,
			`expected "${r}" to not be called at all, but actually been called ${i} times`,
			!0,
			a
		]);
		if (a && s && (c = q_(e, c)), a && s || !a && !s) throw new n(c);
	});
	function s(e, t) {
		return e.length === t.length && e.every((e, n) => Z(e, t[n], [...r, y_]));
	}
	i(["toHaveBeenCalledWith", "toBeCalledWith"], function(...e) {
		let r = o(this), i = r.getMockName(), a = r.mock.calls.some((t) => s(t, e)), c = t.flag(this, "negate"), l = t.getMessage(this, [
			a,
			`expected "${i}" to be called with arguments: #{exp}`,
			`expected "${i}" to not be called with arguments: #{exp}`,
			e
		]);
		if (a && c || !a && !c) throw new n(q_(r, l, e));
	}), i("toHaveBeenCalledExactlyOnceWith", function(...e) {
		let r = o(this), i = r.getMockName(), a = r.mock.calls.length, c = r.mock.calls.some((t) => s(t, e)) && a === 1, l = t.flag(this, "negate"), u = t.getMessage(this, [
			c,
			`expected "${i}" to be called once with arguments: #{exp}`,
			`expected "${i}" to not be called once with arguments: #{exp}`,
			e
		]);
		if (c && l || !c && !l) throw new n(q_(r, u, e));
	}), i(["toHaveBeenNthCalledWith", "nthCalledWith"], function(e, ...t) {
		let n = o(this), r = n.getMockName(), i = n.mock.calls[e - 1], a = n.mock.calls.length, c = e <= a;
		this.assert(i && s(i, t), `expected ${K_(e)} "${r}" call to have been called with #{exp}${c ? "" : `, but called only ${a} times`}`, `expected ${K_(e)} "${r}" call to not have been called with #{exp}`, t, i, c);
	}), i(["toHaveBeenLastCalledWith", "lastCalledWith"], function(...e) {
		let t = o(this), n = t.getMockName(), r = t.mock.calls[t.mock.calls.length - 1];
		this.assert(r && s(r, e), `expected last "${n}" call to have been called with #{exp}`, `expected last "${n}" call to not have been called with #{exp}`, e, r);
	});
	function c(e, t, n) {
		let r = e.mock.invocationCallOrder, i = t.mock.invocationCallOrder;
		return r.length === 0 ? !n : i.length !== 0 && r[0] < i[0];
	}
	i(["toHaveBeenCalledBefore"], function(e, n = !0) {
		let r = o(this);
		if (!Og(e)) throw TypeError(`${t.inspect(e)} is not a spy or a call to a spy`);
		this.assert(c(r, e, n), `expected "${r.getMockName()}" to have been called before "${e.getMockName()}"`, `expected "${r.getMockName()}" to not have been called before "${e.getMockName()}"`, e, r);
	}), i(["toHaveBeenCalledAfter"], function(e, n = !0) {
		let r = o(this);
		if (!Og(e)) throw TypeError(`${t.inspect(e)} is not a spy or a call to a spy`);
		this.assert(c(e, r, n), `expected "${r.getMockName()}" to have been called after "${e.getMockName()}"`, `expected "${r.getMockName()}" to not have been called after "${e.getMockName()}"`, e, r);
	}), i(["toThrow", "toThrowError"], function(e) {
		if (typeof e == "string" || typeof e > "u" || e instanceof RegExp) return this.throws(e === "" ? /^$/ : e);
		let i = this._obj, a = t.flag(this, "promise"), o = t.flag(this, "negate"), s = null;
		if (a === "rejects") s = i;
		else if (a === "resolves" && typeof i != "function") {
			if (o) return;
			{
				let e = t.flag(this, "message") || "expected promise to throw an error, but it didn't";
				throw new n(e, { showDiff: !1 }, t.flag(this, "ssfi"));
			}
		} else {
			let e = !1;
			try {
				i();
			} catch (t) {
				e = !0, s = t;
			}
			if (!e && !o) {
				let e = t.flag(this, "message") || "expected function to throw an error, but it didn't";
				throw new n(e, { showDiff: !1 }, t.flag(this, "ssfi"));
			}
		}
		if (typeof e == "function") {
			let t = e.name || e.prototype.constructor.name;
			return this.assert(s && s instanceof e, `expected error to be instance of ${t}`, `expected error not to be instance of ${t}`, e, s);
		}
		if (e instanceof Error) {
			let t = Z(s, e, [...r, y_]);
			return this.assert(t, "expected a thrown error to be #{exp}", "expected a thrown error not to be #{exp}", e, s);
		}
		if (typeof e == "object" && "asymmetricMatch" in e && typeof e.asymmetricMatch == "function") {
			let t = e;
			return this.assert(s && t.asymmetricMatch(s), "expected error to match asymmetric matcher", "expected error not to match asymmetric matcher", t, s);
		}
		throw Error(`"toThrow" expects string, RegExp, function, Error instance or asymmetric matcher, got "${typeof e}"`);
	}), [{
		name: "toHaveResolved",
		condition: (e) => e.mock.settledResults.length > 0 && e.mock.settledResults.some(({ type: e }) => e === "fulfilled"),
		action: "resolved"
	}, {
		name: ["toHaveReturned", "toReturn"],
		condition: (e) => e.mock.calls.length > 0 && e.mock.results.some(({ type: e }) => e !== "throw"),
		action: "called"
	}].forEach(({ name: e, condition: t, action: n }) => {
		i(e, function() {
			let e = o(this), r = e.getMockName(), i = t(e);
			this.assert(i, `expected "${r}" to be successfully ${n} at least once`, `expected "${r}" to not be successfully ${n}`, i, !i, !1);
		});
	}), [{
		name: "toHaveResolvedTimes",
		condition: (e, t) => e.mock.settledResults.reduce((e, { type: t }) => t === "fulfilled" ? ++e : e, 0) === t,
		action: "resolved"
	}, {
		name: ["toHaveReturnedTimes", "toReturnTimes"],
		condition: (e, t) => e.mock.results.reduce((e, { type: t }) => t === "throw" ? e : ++e, 0) === t,
		action: "called"
	}].forEach(({ name: e, condition: t, action: n }) => {
		i(e, function(e) {
			let r = o(this), i = r.getMockName(), a = t(r, e);
			this.assert(a, `expected "${i}" to be successfully ${n} ${e} times`, `expected "${i}" to not be successfully ${n} ${e} times`, `expected resolved times: ${e}`, `received resolved times: ${a}`, !1);
		});
	}), [{
		name: "toHaveResolvedWith",
		condition: (e, t) => e.mock.settledResults.some(({ type: e, value: n }) => e === "fulfilled" && Z(t, n)),
		action: "resolve"
	}, {
		name: ["toHaveReturnedWith", "toReturnWith"],
		condition: (e, t) => e.mock.results.some(({ type: e, value: n }) => e === "return" && Z(t, n)),
		action: "return"
	}].forEach(({ name: e, condition: r, action: a }) => {
		i(e, function(e) {
			let i = o(this), s = r(i, e), c = t.flag(this, "negate");
			if (s && c || !s && !c) {
				let r = i.getMockName(), o = t.getMessage(this, [
					s,
					`expected "${r}" to ${a} with: #{exp} at least once`,
					`expected "${r}" to not ${a} with: #{exp}`,
					e
				]), c = a === "return" ? i.mock.results : i.mock.settledResults;
				throw new n(J_(i, c, o, e));
			}
		});
	}), [{
		name: "toHaveLastResolvedWith",
		condition: (e, t) => {
			let n = e.mock.settledResults[e.mock.settledResults.length - 1];
			return n && n.type === "fulfilled" && Z(n.value, t);
		},
		action: "resolve"
	}, {
		name: ["toHaveLastReturnedWith", "lastReturnedWith"],
		condition: (e, t) => {
			let n = e.mock.results[e.mock.results.length - 1];
			return n && n.type === "return" && Z(n.value, t);
		},
		action: "return"
	}].forEach(({ name: e, condition: t, action: n }) => {
		i(e, function(e) {
			let r = o(this), i = n === "return" ? r.mock.results : r.mock.settledResults, a = i[i.length - 1], s = r.getMockName();
			this.assert(t(r, e), `expected last "${s}" call to ${n} #{exp}`, `expected last "${s}" call to not ${n} #{exp}`, e, a?.value);
		});
	}), [{
		name: "toHaveNthResolvedWith",
		condition: (e, t, n) => {
			let r = e.mock.settledResults[t - 1];
			return r && r.type === "fulfilled" && Z(r.value, n);
		},
		action: "resolve"
	}, {
		name: ["toHaveNthReturnedWith", "nthReturnedWith"],
		condition: (e, t, n) => {
			let r = e.mock.results[t - 1];
			return r && r.type === "return" && Z(r.value, n);
		},
		action: "return"
	}].forEach(({ name: e, condition: t, action: n }) => {
		i(e, function(e, r) {
			let i = o(this), a = i.getMockName(), s = (n === "return" ? i.mock.results : i.mock.settledResults)[e - 1], c = `${K_(e)} call`;
			this.assert(t(i, e, r), `expected ${c} "${a}" call to ${n} #{exp}`, `expected ${c} "${a}" call to not ${n} #{exp}`, r, s?.value);
		});
	}), i("withContext", function(e) {
		for (let n in e) t.flag(this, n, e[n]);
		return this;
	}), t.addProperty(e.Assertion.prototype, "resolves", function() {
		let r = /* @__PURE__ */ Error("resolves");
		t.flag(this, "promise", "resolves"), t.flag(this, "error", r);
		let i = t.flag(this, "vitest-test"), a = t.flag(this, "object");
		if (t.flag(this, "poll")) throw SyntaxError("expect.poll() is not supported in combination with .resolves");
		if (typeof a?.then != "function") throw TypeError(`You must provide a Promise to expect() when using .resolves, not '${typeof a}'.`);
		let o = new Proxy(this, { get: (s, c, l) => {
			let u = Reflect.get(s, c, l);
			return typeof u == "function" ? (...e) => {
				t.flag(this, "_name", c);
				let o = a.then((n) => (t.flag(this, "object", n), u.call(this, ...e)), (e) => {
					let i = new n(`promise rejected "${t.inspect(e)}" instead of resolving`, { showDiff: !1 });
					throw i.cause = e, i.stack = r.stack.replace(r.message, i.message), i;
				});
				return H_(i, o, V_(t, this, !!e.length), r);
			} : u instanceof e.Assertion ? o : u;
		} });
		return o;
	}), t.addProperty(e.Assertion.prototype, "rejects", function() {
		let r = /* @__PURE__ */ Error("rejects");
		t.flag(this, "promise", "rejects"), t.flag(this, "error", r);
		let i = t.flag(this, "vitest-test"), a = t.flag(this, "object"), o = typeof a == "function" ? a() : a;
		if (t.flag(this, "poll")) throw SyntaxError("expect.poll() is not supported in combination with .rejects");
		if (typeof o?.then != "function") throw TypeError(`You must provide a Promise to expect() when using .rejects, not '${typeof o}'.`);
		let s = new Proxy(this, { get: (a, c, l) => {
			let u = Reflect.get(a, c, l);
			return typeof u == "function" ? (...e) => {
				t.flag(this, "_name", c);
				let a = o.then((e) => {
					let i = new n(`promise resolved "${t.inspect(e)}" instead of rejecting`, {
						showDiff: !0,
						expected: /* @__PURE__ */ Error("rejected promise"),
						actual: e
					});
					throw i.stack = r.stack.replace(r.message, i.message), i;
				}, (n) => (t.flag(this, "object", n), u.call(this, ...e)));
				return H_(i, a, V_(t, this, !!e.length), r);
			} : u instanceof e.Assertion ? s : u;
		} });
		return s;
	});
};
function K_(e) {
	let t = e % 10, n = e % 100;
	return t === 1 && n !== 11 ? `${e}st` : t === 2 && n !== 12 ? `${e}nd` : t === 3 && n !== 13 ? `${e}rd` : `${e}th`;
}
function q_(e, t, n) {
	return e.mock.calls.length && (t += sg.gray(`

Received: 

${e.mock.calls.map((t, r) => {
		let i = sg.bold(`  ${K_(r + 1)} ${e.getMockName()} call:

`);
		return i += n ? ci(n, t, { omitAnnotationLines: !0 }) : Vn(t).split("\n").map((e) => `    ${e}`).join("\n"), i += "\n", i;
	}).join("\n")}`)), t += sg.gray(`

Number of calls: ${sg.bold(e.mock.calls.length)}
`), t;
}
function J_(e, t, n, r) {
	return t.length && (n += sg.gray(`

Received: 

${t.map((t, n) => {
		let i = sg.bold(`  ${K_(n + 1)} ${e.getMockName()} call return:

`);
		return i += r ? ci(r, t.value, { omitAnnotationLines: !0 }) : Vn(t).split("\n").map((e) => `    ${e}`).join("\n"), i += "\n", i;
	}).join("\n")}`)), n += sg.gray(`

Number of calls: ${sg.bold(e.mock.calls.length)}
`), n;
}
function Y_(e, t) {
	let n = e._obj, r = wl.flag(e, "negate"), i = wl.flag(e, "promise") || "", a = {
		...qg(),
		diff: ci,
		stringify: Vn,
		iterableEquality: y_,
		subsetEquality: S_
	};
	return {
		state: {
			...A_(t),
			customTesters: Yg(),
			isNot: r,
			utils: a,
			promise: i,
			equals: Z,
			suppressedErrors: [],
			soft: wl.flag(e, "soft"),
			poll: wl.flag(e, "poll")
		},
		isNot: r,
		obj: n
	};
}
var X_ = class extends Error {
	constructor(e, t, n) {
		super(e), this.actual = t, this.expected = n;
	}
};
function Z_(e, t, n) {
	return (r, i) => {
		Object.entries(n).forEach(([n, r]) => {
			function a(...e) {
				let { state: n, isNot: i, obj: a } = Y_(this, t), o = r.call(n, a, ...e);
				if (o && typeof o == "object" && typeof o.then == "function") return o.then(({ pass: e, message: t, actual: n, expected: r }) => {
					if (e && i || !e && !i) throw new X_(t(), n, r);
				});
				let { pass: s, message: c, actual: l, expected: u } = o;
				if (s && i || !s && !i) throw new X_(c(), l, u);
			}
			let o = W_(i, n, a);
			i.addMethod(globalThis[Ng].matchers, n, o), i.addMethod(e.Assertion.prototype, n, o);
			class s extends M_ {
				constructor(e = !1, ...t) {
					super(t, e);
				}
				asymmetricMatch(e) {
					let { pass: n } = r.call(this.getMatcherContext(t), e, ...this.sample);
					return this.inverse ? !n : n;
				}
				toString() {
					return `${this.inverse ? "not." : ""}${n}`;
				}
				getExpectedType() {
					return "any";
				}
				toAsymmetricMatcher() {
					return `${this.toString()}<${this.sample.map((e) => Vn(e)).join(", ")}>`;
				}
			}
			let c = (...e) => new s(!1, ...e);
			Object.defineProperty(t, n, {
				configurable: !0,
				enumerable: !0,
				value: c,
				writable: !0
			}), Object.defineProperty(t.not, n, {
				configurable: !0,
				enumerable: !0,
				value: (...e) => new s(!0, ...e),
				writable: !0
			}), Object.defineProperty(globalThis[Fg], n, {
				configurable: !0,
				enumerable: !0,
				value: c,
				writable: !0
			});
		});
	};
}
var Q_ = (e, t) => {
	t.addMethod(e.expect, "extend", (t, n) => {
		Cf(Z_(e, t, n));
	});
};
function $_() {
	Cf(Q_), Cf(G_), Cf(B_);
	let e = ((t, n) => {
		let { assertionCalls: r } = A_(e);
		return j_({
			assertionCalls: r + 1,
			soft: !1
		}, e), _f(t, n);
	});
	Object.assign(e, _f), e.getState = () => A_(e), e.setState = (t) => j_(t, e), e.extend = (t) => _f.extend(e, t), e.soft = (...t) => {
		let n = e(...t);
		return e.setState({ soft: !0 }), n;
	}, e.extend(Ig), e.unreachable = (e) => {
		G.fail(`expected${e ? ` "${e}" ` : " "}not to be reached`);
	};
	function t(n) {
		let r = () => /* @__PURE__ */ Error(`expected number of assertions to be ${n}, but got ${e.getState().assertionCalls}`);
		"captureStackTrace" in Error && typeof Error.captureStackTrace == "function" && Error.captureStackTrace(r(), t), e.setState({
			expectedAssertionsNumber: n,
			expectedAssertionsNumberErrorGen: r
		});
	}
	function n() {
		let t = /* @__PURE__ */ Error("expected any number of assertion, but got none");
		"captureStackTrace" in Error && typeof Error.captureStackTrace == "function" && Error.captureStackTrace(t, n), e.setState({
			isExpectingAssertions: !0,
			isExpectingAssertionsError: t
		});
	}
	return j_({
		assertionCalls: 0,
		isExpectingAssertions: !1,
		isExpectingAssertionsError: null,
		expectedAssertionsNumber: null,
		expectedAssertionsNumberErrorGen: null
	}, e), wl.addMethod(e, "assertions", t), wl.addMethod(e, "hasAssertions", n), e.extend(wf), e;
}
var ev = $_();
Object.defineProperty(globalThis, Pg, {
	value: ev,
	writable: !0,
	configurable: !0
});
function tv(e, t, n) {
	Object.defineProperty(e, t, n);
}
var nv = /* @__PURE__ */ Symbol.for("tinyspy:spy"), rv = (e) => {
	e.called = !1, e.callCount = 0, e.calls = [], e.results = [], e.resolves = [], e.next = [];
}, iv = (e) => (tv(e, nv, { value: { reset: () => rv(e[nv]) } }), e[nv]), av = (e) => e[nv] || iv(e);
globalThis.__STORYBOOK_MODULE_MOCK_SPIES__ ??= /* @__PURE__ */ new Set();
var ov = /* @__PURE__ */ new Set();
function sv(e) {
	return cv(e ? jg(e) : jg());
}
function cv(e) {
	let t = lv(e), n = t.mockImplementation.bind(null);
	return t.mockImplementation = (e) => lv(n(e)), t;
}
function lv(e) {
	let t = av(e), n = t.impl;
	return t.willCall(function(...t) {
		return ov.forEach((n) => n(e, t)), n?.apply(this, t);
	}), e;
}
function Q(e, t, n) {
	return e.namespaceURI && e.namespaceURI !== "http://www.w3.org/1999/xhtml" || (t = Array.isArray(t) ? t : [t], !t.includes(e.tagName.toLowerCase())) ? !1 : !n || Object.entries(n).every(([t, n]) => e[t] === n);
}
function uv(e) {
	var t;
	if (dv(e) && e.defaultView) return e.defaultView;
	if ((t = e.ownerDocument) != null && t.defaultView) return e.ownerDocument.defaultView;
	throw Error(`Could not determine window of node. Node was ${fv(e)}`);
}
function dv(e) {
	return e.nodeType === 9;
}
function fv(e) {
	return typeof e == "function" ? `function ${e.name}` : e === null ? "null" : String(e);
}
function pv(e, t) {
	return new Promise((n, r) => {
		let i = new t();
		i.onerror = r, i.onabort = r, i.onload = () => {
			n(String(i.result));
		}, i.readAsText(e);
	});
}
function mv(e, t) {
	let n = {
		...t,
		length: t.length,
		item: (e) => n[e],
		[Symbol.iterator]: function* () {
			for (let e = 0; e < n.length; e++) yield n[e];
		}
	};
	return n.constructor = e.FileList, e.FileList && Object.setPrototypeOf(n, e.FileList.prototype), Object.freeze(n), n;
}
function hv(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var gv = class {
	getAsFile() {
		return this.file;
	}
	getAsString(e) {
		typeof this.data == "string" && e(this.data);
	}
	/* istanbul ignore next */
	webkitGetAsEntry() {
		throw Error("not implemented");
	}
	constructor(e, t) {
		hv(this, "kind", void 0), hv(this, "type", void 0), hv(this, "file", null), hv(this, "data", void 0), typeof e == "string" ? (this.kind = "string", this.type = String(t), this.data = e) : (this.kind = "file", this.type = e.type, this.file = e);
	}
}, _v = class extends Array {
	add(...e) {
		let t = new gv(e[0], e[1]);
		return this.push(t), t;
	}
	clear() {
		this.splice(0, this.length);
	}
	remove(e) {
		this.splice(e, 1);
	}
};
function vv(e, t) {
	let [n, r] = e.split("/"), i = !r || r === "*";
	return (r) => t ? r.type === (i ? n : e) : i ? r.type.startsWith(`${n}/`) : r.type === n;
}
function yv(e) {
	return new class {
		getData(e) {
			let t = this.items.find(vv(e, !0)) ?? this.items.find(vv(e, !1)), n = "";
			return t?.getAsString((e) => {
				n = e;
			}), n;
		}
		setData(e, t) {
			let n = this.items.findIndex(vv(e, !0)), r = new gv(t, e);
			n >= 0 ? this.items.splice(n, 1, r) : this.items.push(r);
		}
		clearData(e) {
			if (e) {
				let t = this.items.findIndex(vv(e, !0));
				t >= 0 && this.items.remove(t);
			} else this.items.clear();
		}
		get types() {
			let e = [];
			return this.files.length && e.push("Files"), this.items.forEach((t) => e.push(t.type)), Object.freeze(e), e;
		}
		/* istanbul ignore next */
		setDragImage() {}
		constructor() {
			hv(this, "dropEffect", "none"), hv(this, "effectAllowed", "uninitialized"), hv(this, "items", new _v()), hv(this, "files", mv(e, []));
		}
	}();
}
function bv(e, t = []) {
	let n = typeof e.DataTransfer > "u" ? yv(e) : 
	/* istanbul ignore next */
	new e.DataTransfer();
	return Object.defineProperty(n, "files", { get: () => mv(e, t) }), n;
}
async function xv(e, t) {
	return t.kind === "file" ? t.getAsFile() : new e.Blob([await new Promise((e) => t.getAsString(e))], { type: t.type });
}
function Sv(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Cv(e, ...t) {
	let n = Object.fromEntries(t.map((e) => [typeof e == "string" ? "text/plain" : e.type, Promise.resolve(e)]));
	return typeof e.ClipboardItem < "u" ? new e.ClipboardItem(n) : new class {
		get types() {
			return Array.from(Object.keys(this.data));
		}
		async getType(t) {
			let n = await this.data[t];
			if (!n) throw Error(`${t} is not one of the available MIME types on this item.`);
			return n instanceof e.Blob ? n : new e.Blob([n], { type: t });
		}
		constructor(e) {
			Sv(this, "data", void 0), this.data = e;
		}
	}(n);
}
var wv = /* @__PURE__ */ Symbol("Manage ClipboardSub");
function Tv(e, t) {
	return Object.assign(new class extends e.EventTarget {
		async read() {
			return Array.from(this.items);
		}
		async readText() {
			let t = "";
			for (let n of this.items) {
				let r = n.types.includes("text/plain") ? "text/plain" : n.types.find((e) => e.startsWith("text/"));
				r && (t += await n.getType(r).then((t) => pv(t, e.FileReader)));
			}
			return t;
		}
		async write(e) {
			this.items = e;
		}
		async writeText(t) {
			this.items = [Cv(e, t)];
		}
		constructor(...e) {
			super(...e), Sv(this, "items", []);
		}
	}(), { [wv]: t });
}
function Ev(e) {
	return !!e?.[wv];
}
function Dv(e) {
	if (Ev(e.navigator.clipboard)) return e.navigator.clipboard[wv];
	let t = Object.getOwnPropertyDescriptor(e.navigator, "clipboard"), n, r = {
		resetClipboardStub: () => {
			n = Tv(e, r);
		},
		detachClipboardStub: () => {
			t ? Object.defineProperty(e.navigator, "clipboard", t) : Object.defineProperty(e.navigator, "clipboard", {
				value: void 0,
				configurable: !0
			});
		}
	};
	return n = Tv(e, r), Object.defineProperty(e.navigator, "clipboard", {
		get: () => n,
		configurable: !0
	}), n[wv];
}
function Ov(e) {
	Ev(e.navigator.clipboard) && e.navigator.clipboard[wv].resetClipboardStub();
}
function kv(e) {
	Ev(e.navigator.clipboard) && e.navigator.clipboard[wv].detachClipboardStub();
}
async function Av(e) {
	let t = e.defaultView, n = t?.navigator.clipboard, r = n && await n.read();
	if (!r) throw Error("The Clipboard API is unavailable.");
	let i = bv(t);
	for (let e of r) for (let n of e.types) i.setData(n, await e.getType(n).then((e) => pv(e, t.FileReader)));
	return i;
}
async function jv(e, t) {
	let n = uv(e), r = n.navigator.clipboard, i = [];
	for (let e = 0; e < t.items.length; e++) {
		let r = t.items[e], a = await xv(n, r);
		i.push(Cv(n, a));
	}
	if (!(r && await r.write(i).then(
		() => !0,
		/* istanbul ignore next */
		() => !1
	))) throw Error("The Clipboard API is unavailable.");
}
var Mv = globalThis;
typeof Mv.afterEach == "function" && Mv.afterEach(() => {
	typeof globalThis.window < "u" && Ov(globalThis.window);
}), typeof Mv.afterAll == "function" && Mv.afterAll(() => {
	typeof globalThis.window < "u" && kv(globalThis.window);
});
var Nv = "input:not([type=hidden]):not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable=\"\"], [contenteditable=\"true\"], a[href], [tabindex]:not([disabled]), details > summary";
function Pv(e) {
	return e.matches(Nv);
}
function Fv(e) {
	return new e.constructor(e.type, e);
}
function Iv(e) {
	for (let n = e; n; n = n.parentElement) if (Q(n, [
		"button",
		"input",
		"select",
		"textarea",
		"optgroup",
		"option"
	])) {
		if (n.hasAttribute("disabled")) return !0;
	} else if (Q(n, "fieldset")) {
		var t;
		if (n.hasAttribute("disabled") && !((t = n.querySelector(":scope > legend")) != null && t.contains(e))) return !0;
	} else if (n.tagName.includes("-") && n.constructor.formAssociated && n.hasAttribute("disabled")) return !0;
	return !1;
}
function Lv(e) {
	let t = e.activeElement;
	if (t?.shadowRoot) {
		let e = Lv(t.shadowRoot);
		if (e) return e;
	}
	return Iv(t) ? e.ownerDocument ? 
	/* istanbul ignore next */
	e.ownerDocument.body : e.body : t;
}
function Rv(e) {
	return Lv(e) ?? 
	/* istanbul ignore next */
	e.body;
}
function zv(e, t) {
	let n = e;
	do {
		if (t(n)) return n;
		n = n.parentElement;
	} while (n && n !== e.ownerDocument.body);
}
function Bv(e) {
	return e.hasAttribute("contenteditable") && (e.getAttribute("contenteditable") == "true" || e.getAttribute("contenteditable") == "");
}
function Vv(e) {
	let t = Hv(e);
	return t && (t.closest("[contenteditable=\"\"]") || t.closest("[contenteditable=\"true\"]"));
}
function Hv(e) {
	return e.nodeType === 1 ? e : e.parentElement;
}
var Uv = (function(e) {
	return e.button = "button", e.color = "color", e.file = "file", e.image = "image", e.reset = "reset", e.submit = "submit", e.checkbox = "checkbox", e.radio = "radio", e;
})(Uv || {});
function Wv(e) {
	return Q(e, "button") || Q(e, "input") && e.type in Uv;
}
function Gv(e) {
	return qv(e) && !e.readOnly || Bv(e);
}
var Kv = (function(e) {
	return e.text = "text", e.date = "date", e["datetime-local"] = "datetime-local", e.email = "email", e.month = "month", e.number = "number", e.password = "password", e.search = "search", e.tel = "tel", e.time = "time", e.url = "url", e.week = "week", e;
})(Kv || {});
function qv(e) {
	return Q(e, "textarea") || Q(e, "input") && e.type in Kv;
}
function Jv(e) {
	return Xv(e) && qv(e);
}
function Yv(e) {
	return Xv(e) && Wv(e);
}
function Xv(e) {
	return e.nodeType === 1;
}
function Zv(e) {
	let t = e.ownerDocument.getSelection();
	if (t?.focusNode && Jv(e)) {
		let n = Vv(t.focusNode);
		if (n) {
			if (!t.isCollapsed) {
				let e = n.firstChild?.nodeType === 3 ? n.firstChild : n;
				t.setBaseAndExtent(e, 0, e, 0);
			}
		} else t.setBaseAndExtent(e, 0, e, 0);
	}
}
function Qv(t, n) {
	return e().eventWrapper(t);
}
function $v(e) {
	let t = zv(e, Pv), n = Lv(e.ownerDocument);
	(t ?? e.ownerDocument.body) !== n && (Qv(t ? () => t.focus() : () => n?.blur()), Zv(t ?? e.ownerDocument.body));
}
function ey(e) {
	!Pv(e) || Lv(e.ownerDocument) !== e || Qv(() => e.blur());
}
var ty = {};
ty.click = (e, t, n) => {
	let r = t.closest("button,input,label,select,textarea"), i = r && Q(r, "label") && r.control;
	if (i && i !== t) return () => {
		Pv(i) && ($v(i), n.dispatchEvent(i, Fv(e)));
	};
	if (Q(t, "input", { type: "file" })) return () => {
		ey(t), t.dispatchEvent(new (uv(t)).Event("fileDialog")), $v(t);
	};
};
var ny = /* @__PURE__ */ Symbol("Displayed value in UI"), ry = /* @__PURE__ */ Symbol("Displayed selection in UI"), iy = /* @__PURE__ */ Symbol("Initial value to compare on blur");
function ay(e) {
	return typeof e == "object" && ny in e;
}
function oy(e) {
	return !!e && typeof e == "object" && ry in e;
}
function sy(e, t) {
	e[iy] === void 0 && (e[iy] = e.value), e[ny] = t, e.value = Object.assign(new String(t), { [ny]: !0 });
}
function cy(e) {
	return e[ny] === void 0 ? e.value : String(e[ny]);
}
function ly(e) {
	e[ny] = void 0;
}
function uy(e) {
	e[iy] = void 0;
}
function dy(e) {
	return e[iy];
}
function fy(e, t) {
	e[ry] = t;
}
function py(e, { focusOffset: t, anchorOffset: n = t }, r = "replace") {
	let i = cy(e).length, a = (e) => Math.max(0, Math.min(i, e)), o = r === "replace" || e[ry] === void 0 ? a(n) : e[ry].anchorOffset, s = a(t), c = Math.min(o, s), l = Math.max(o, s);
	if (e[ry] = {
		anchorOffset: o,
		focusOffset: s
	}, e.selectionStart === c && e.selectionEnd === l) return;
	let u = Object.assign(new Number(c), { [ry]: !0 });
	try {
		e.setSelectionRange(u, l);
	} catch {}
}
function my(e) {
	let t = e[ry] ?? {
		anchorOffset: e.selectionStart ?? 0,
		focusOffset: e.selectionEnd ?? 0
	};
	return {
		...t,
		startOffset: Math.min(t.anchorOffset, t.focusOffset),
		endOffset: Math.max(t.anchorOffset, t.focusOffset)
	};
}
function hy(e) {
	return !!e[ry];
}
function gy(e) {
	e[ry] = void 0;
}
var _y = globalThis.parseInt;
function vy(e) {
	let t = e.replace(/\D/g, "");
	if (t.length < 2) return e;
	let n = _y(t[0], 10), r = _y(t[1], 10);
	if (n >= 3 || n === 2 && r >= 4) {
		let e;
		return e = n >= 3 ? 1 : 2, yy(t, e);
	}
	return e.length === 2 ? e : yy(t, 2);
}
function yy(e, t) {
	let n = e.slice(0, t), r = Math.min(_y(n, 10), 23), i = _y(e.slice(t), 10), a = Math.min(i, 59);
	return `${r.toString().padStart(2, "0")}:${a.toString().padStart(2, "0")}`;
}
function by(e, t) {
	let n = e.cloneNode();
	return n.value = t, n.value === t;
}
var xy = (function(e) {
	return e.email = "email", e.password = "password", e.search = "search", e.telephone = "telephone", e.text = "text", e.url = "url", e;
})(xy || {});
function Sy(e) {
	let t = e.getAttribute("maxlength") ?? "";
	return /^\d+$/.test(t) && Number(t) >= 0 ? Number(t) : void 0;
}
function Cy(e) {
	return Q(e, "textarea") || Q(e, "input") && e.type in xy;
}
function wy(e, t, n, r) {
	if (ky(e) && t + n >= 0 && t + n <= e.nodeValue.length) return {
		node: e,
		offset: t + n
	};
	let i = Ty(e, t, n);
	if (i) {
		if (ky(i)) return {
			node: i,
			offset: n > 0 ? Math.min(1, i.nodeValue.length) : Math.max(i.nodeValue.length - 1, 0)
		};
		if (Q(i, "br")) {
			let e = Ty(i, void 0, n);
			return e ? ky(e) ? {
				node: e,
				offset: n > 0 ? 0 : e.nodeValue.length
			} : n < 0 && Q(e, "br") ? {
				node: i.parentNode,
				offset: Dy(i)
			} : {
				node: e.parentNode,
				offset: Dy(e) + (n > 0 ? 0 : 1)
			} : n < 0 && r === "deleteContentBackward" ? {
				node: i.parentNode,
				offset: Dy(i)
			} : void 0;
		}
		return {
			node: i.parentNode,
			offset: Dy(i) + +(n > 0)
		};
	}
}
function Ty(e, t, n) {
	let r = Number(t) + (n < 0 ? -1 : 0);
	return t !== void 0 && Oy(e) && r >= 0 && r < e.children.length && (e = e.children[r]), Ay(e, n === 1 ? "next" : "previous", Ey);
}
function Ey(e) {
	if (ky(e)) return !0;
	if (Oy(e)) {
		if (Q(e, ["input", "textarea"])) return e.type !== "hidden";
		if (Q(e, "br")) return !0;
	}
	return !1;
}
function Dy(e) {
	let t = 0;
	for (; e.previousSibling;) t++, e = e.previousSibling;
	return t;
}
function Oy(e) {
	return e.nodeType === 1;
}
function ky(e) {
	return e.nodeType === 3;
}
function Ay(e, t, n) {
	for (;;) {
		let r = e[`${t}Sibling`];
		if (r) {
			if (e = jy(r, t === "next" ? "first" : "last"), n(e)) return e;
		} else if (e.parentNode && (!Oy(e.parentNode) || !Bv(e.parentNode) && e.parentNode !== e.ownerDocument?.body)) e = e.parentNode;
		else break;
	}
}
function jy(e, t) {
	for (; e.hasChildNodes();) e = e[`${t}Child`];
	return e;
}
var My = /* @__PURE__ */ Symbol("Track programmatic changes for React workaround");
function Ny(e) {
	return Object.getOwnPropertyNames(e).some((e) => e.startsWith("__react")) && uv(e).REACT_VERSION === 17;
}
function Py(e) {
	Ny(e) && (e[My] = {
		previousValue: String(e.value),
		tracked: []
	});
}
function Fy(e, t) {
	var n, r;
	(r = e[My]) == null || (n = r.tracked) == null || n.push(t), e[My] || (ly(e), py(e, { focusOffset: t.length }));
}
function Iy(e, t) {
	var n;
	let r = e[My];
	if (e[My] = void 0, !(r != null && (n = r.tracked) != null && n.length)) return;
	let i = r.tracked.length === 2 && r.tracked[0] === r.previousValue && r.tracked[1] === e.value;
	i || ly(e), hy(e) && py(e, { focusOffset: i ? t : e.value.length });
}
function Ly(e) {
	let t = Ry(e);
	if (t && Jv(t)) return {
		type: "input",
		selection: my(t)
	};
	let n = t?.ownerDocument.getSelection();
	return {
		type: Vv(e) && n?.anchorNode && Vv(n.anchorNode) ? "contenteditable" : "default",
		selection: n
	};
}
function Ry(e) {
	return e.nodeType === 1 ? e : e.parentElement;
}
function zy(e) {
	let t = Ly(e);
	if (t.type === "input") return t.selection;
	if (t.type === "contenteditable") return t.selection?.getRangeAt(0);
}
function By({ focusNode: e, focusOffset: t, anchorNode: n = e, anchorOffset: r = t }) {
	var i, a;
	if (Ly(e).type === "input") return py(e, {
		anchorOffset: r,
		focusOffset: t
	});
	(a = n.ownerDocument) == null || (i = a.getSelection()) == null || i.setBaseAndExtent(n, r, e, t);
}
function Vy(e) {
	return Q(e, "input") && ["date", "time"].includes(e.type);
}
function Hy(e, t, n, r = "insertText") {
	let i = zy(t);
	i && (!Vy(t) && !e.dispatchUIEvent(t, "beforeinput", {
		inputType: r,
		data: n
	}) || ("startContainer" in i ? Uy(e, t, i, n, r) : Wy(e, t, i, n, r)));
}
function Uy(e, t, n, r, i) {
	let a = !1;
	if (!n.collapsed) a = !0, n.deleteContents();
	else if (["deleteContentBackward", "deleteContentForward"].includes(i)) {
		let e = wy(n.startContainer, n.startOffset, i === "deleteContentBackward" ? -1 : 1, i);
		if (e) {
			a = !0;
			let t = n.cloneRange();
			t.comparePoint(e.node, e.offset) < 0 ? t.setStart(e.node, e.offset) : t.setEnd(e.node, e.offset), t.deleteContents();
		}
	}
	if (r) {
		if (n.endContainer.nodeType === 3) {
			let e = n.endOffset;
			n.endContainer.insertData(e, r), n.setStart(n.endContainer, e + r.length), n.setEnd(n.endContainer, e + r.length);
		} else {
			let e = t.ownerDocument.createTextNode(r);
			n.insertNode(e), n.setStart(e, r.length), n.setEnd(e, r.length);
		}
	}
	(a || r) && e.dispatchUIEvent(t, "input", { inputType: i });
}
function Wy(e, t, n, r, i) {
	let a = r;
	if (Cy(t)) {
		let e = Sy(t);
		if (e !== void 0 && r.length > 0) {
			let i = n.endOffset - n.startOffset, o = e - t.value.length + i;
			if (o > 0) a = r.substring(0, o);
			else return;
		}
	}
	let { newValue: o, newOffset: s, oldValue: c } = Gy(a, t, n, i);
	o === c && s === n.startOffset && s === n.endOffset || Q(t, "input", { type: "number" }) && !qy(o) || (sy(t, o), By({
		focusNode: t,
		anchorOffset: s,
		focusOffset: s
	}), Vy(t) ? by(t, o) && (Ky(e, t, s, {}), e.dispatchUIEvent(t, "change"), uy(t)) : Ky(e, t, s, {
		data: r,
		inputType: i
	}));
}
function Gy(e, t, { startOffset: n, endOffset: r }, i) {
	let a = cy(t), o = Math.max(0, n === r && i === "deleteContentBackward" ? n - 1 : n), s = a.substring(0, o), c = Math.min(a.length, n === r && i === "deleteContentForward" ? n + 1 : r), l = `${s}${e}${a.substring(c, a.length)}`, u = o + e.length;
	if (Q(t, "input", { type: "time" })) {
		let e = vy(l);
		e !== "" && by(t, e) && (l = e, u = e.length);
	}
	return {
		oldValue: a,
		newValue: l,
		newOffset: u
	};
}
function Ky(e, t, n, r) {
	e.dispatchUIEvent(t, "input", r), Iy(t, n);
}
function qy(e) {
	let t = e.split("e", 2);
	return !(/[^\d.\-e]/.test(e) || Number(e.match(/-/g)?.length) > 2 || Number(e.match(/\./g)?.length) > 1 || t[1] && !/^-?\d*$/.test(t[1]));
}
ty.cut = (e, t, n) => () => {
	Gv(t) && Hy(n, t, "", "deleteByCut");
};
function Jy(e) {
	return e ? Bv(e) ? e.textContent : cy(e) : null;
}
function Yy(e) {
	let t = uv(e);
	for (let n = e; n?.ownerDocument; n = n.parentElement) {
		let { display: e, visibility: r } = t.getComputedStyle(n);
		if (e === "none" || r === "hidden") return !1;
	}
	return !0;
}
function Xy(e, t) {
	let n = e.ownerDocument, r = n.querySelectorAll(Nv), i = Array.from(r).filter((t) => t === e || !(Number(t.getAttribute("tabindex")) < 0 || Iv(t)));
	Number(e.getAttribute("tabindex")) >= 0 && i.sort((e, t) => {
		let n = Number(e.getAttribute("tabindex")), r = Number(t.getAttribute("tabindex"));
		return n === r ? 0 : n === 0 ? 1 : r === 0 ? -1 : n - r;
	});
	let a = {}, o = [n.body], s = Q(e, "input", { type: "radio" }) ? e.name : void 0;
	i.forEach((t) => {
		let n = t;
		if (Q(n, "input", { type: "radio" }) && n.name) {
			if (n === e) {
				o.push(n);
				return;
			}
			if (n.name === s) return;
			if (n.checked) {
				o = o.filter((e) => !Q(e, "input", {
					type: "radio",
					name: n.name
				})), o.push(n), a[n.name] = n;
				return;
			}
			if (typeof a[n.name] < "u") return;
		}
		o.push(n);
	});
	for (let r = o.findIndex((t) => t === e);;) if (r += t ? -1 : 1, r === o.length ? r = 0 : r === -1 && (r = o.length - 1), o[r] === e || o[r] === n.body || Yy(o[r])) return o[r];
}
function Zy(e, t) {
	if (Jv(e)) {
		let n = my(e);
		By({
			focusNode: e,
			focusOffset: n.startOffset === n.endOffset ? n.focusOffset + t : t < 0 ? n.startOffset : n.endOffset
		});
	} else {
		let n = e.ownerDocument.getSelection();
		if (!n?.focusNode) return;
		if (n.isCollapsed) {
			let e = wy(n.focusNode, n.focusOffset, t);
			e && By({
				focusNode: e.node,
				focusOffset: e.offset
			});
		} else n[t < 0 ? "collapseToStart" : "collapseToEnd"]();
	}
}
function Qy(e) {
	if (Jv(e)) return By({
		focusNode: e,
		anchorOffset: 0,
		focusOffset: cy(e).length
	});
	let t = Vv(e) ?? e.ownerDocument.body;
	By({
		focusNode: t,
		anchorOffset: 0,
		focusOffset: t.childNodes.length
	});
}
function $y(e) {
	if (Jv(e)) return my(e).startOffset === 0 && my(e).endOffset === cy(e).length;
	let t = Vv(e) ?? e.ownerDocument.body, n = e.ownerDocument.getSelection();
	return n?.anchorNode === t && n.focusNode === t && n.anchorOffset === 0 && n.focusOffset === t.childNodes.length;
}
function eb(e, t, n) {
	if (Jv(e)) return By({
		focusNode: e,
		anchorOffset: t,
		focusOffset: n
	});
	if (Bv(e) && e.firstChild?.nodeType === 3) return By({
		focusNode: e.firstChild,
		anchorOffset: t,
		focusOffset: n
	});
	throw Error("Not implemented. The result of this interaction is unreliable.");
}
function tb(e, t, n) {
	let r = uv(t), i = Array.from(t.ownerDocument.querySelectorAll(t.name ? `input[type="radio"][name="${r.CSS.escape(t.name)}"]` : "input[type=\"radio\"][name=\"\"], input[type=\"radio\"]:not([name])"));
	for (let r = i.findIndex((e) => e === t) + n;; r += n) {
		if (i[r] || (r = n > 0 ? 0 : i.length - 1), i[r] === t) return;
		if (!Iv(i[r])) {
			$v(i[r]), e.dispatchUIEvent(i[r], "click");
			return;
		}
	}
}
ty.keydown = (e, t, n) => nb[e.key]?.call(nb, e, t, n) ?? rb(e, t, n);
var nb = {
	ArrowDown: (e, t, n) => {
		if (Q(t, "input", { type: "radio" })) return () => tb(n, t, 1);
	},
	ArrowLeft: (e, t, n) => Q(t, "input", { type: "radio" }) ? () => tb(n, t, -1) : () => Zy(t, -1),
	ArrowRight: (e, t, n) => Q(t, "input", { type: "radio" }) ? () => tb(n, t, 1) : () => Zy(t, 1),
	ArrowUp: (e, t, n) => {
		if (Q(t, "input", { type: "radio" })) return () => tb(n, t, -1);
	},
	Backspace: (e, t, n) => {
		if (Gv(t)) return () => {
			Hy(n, t, "", "deleteContentBackward");
		};
	},
	Delete: (e, t, n) => {
		if (Gv(t)) return () => {
			Hy(n, t, "", "deleteContentForward");
		};
	},
	End: (e, t) => {
		if (Q(t, ["input", "textarea"]) || Bv(t)) return () => {
			let e = Jy(t)?.length ?? 
			/* istanbul ignore next */
			0;
			eb(t, e, e);
		};
	},
	Home: (e, t) => {
		if (Q(t, ["input", "textarea"]) || Bv(t)) return () => {
			eb(t, 0, 0);
		};
	},
	PageDown: (e, t) => {
		if (Q(t, ["input"])) return () => {
			let e = cy(t).length;
			eb(t, e, e);
		};
	},
	PageUp: (e, t) => {
		if (Q(t, ["input"])) return () => {
			eb(t, 0, 0);
		};
	},
	Tab: (e, t, n) => () => {
		let e = Xy(t, n.system.keyboard.modifiers.Shift);
		$v(e), Jv(e) && py(e, {
			anchorOffset: 0,
			focusOffset: e.value.length
		});
	}
}, rb = (e, t, n) => {
	if (e.code === "KeyA" && n.system.keyboard.modifiers.Control) return () => Qy(t);
};
ty.keypress = (e, t, n) => {
	if (e.key === "Enter") {
		if (Q(t, "button") || Q(t, "input") && ib.includes(t.type) || Q(t, "a") && t.href) return () => {
			n.dispatchUIEvent(t, "click");
		};
		if (Q(t, "input")) {
			let e = t.form, r = e?.querySelector("input[type=\"submit\"], button:not([type]), button[type=\"submit\"]");
			return r ? () => n.dispatchUIEvent(r, "click") : e && ab.includes(t.type) && e.querySelectorAll("input").length === 1 ? () => n.dispatchUIEvent(e, "submit") : void 0;
		}
	}
	if (Gv(t)) {
		let r = e.key === "Enter" ? Bv(t) && !n.system.keyboard.modifiers.Shift ? "insertParagraph" : "insertLineBreak" : "insertText", i = e.key === "Enter" ? "\n" : e.key;
		return () => Hy(n, t, i, r);
	}
};
var ib = [
	"button",
	"color",
	"file",
	"image",
	"reset",
	"submit"
], ab = [
	"email",
	"month",
	"password",
	"search",
	"tel",
	"text",
	"url",
	"week"
];
ty.keyup = (e, t, n) => ob[e.key]?.call(ob, e, t, n);
var ob = { " ": (e, t, n) => {
	if (Wv(t)) return () => n.dispatchUIEvent(t, "click");
} };
ty.paste = (e, t, n) => {
	if (Gv(t)) return () => {
		let r = e.clipboardData?.getData("text");
		r && Hy(n, t, r, "insertFromPaste");
	};
};
var sb = {
	auxclick: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	beforeinput: {
		EventType: "InputEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	blur: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	click: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	contextmenu: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	copy: {
		EventType: "ClipboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	change: {
		EventType: "Event",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	cut: {
		EventType: "ClipboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	dblclick: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	focus: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	focusin: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	focusout: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	keydown: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	keypress: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	keyup: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	paste: {
		EventType: "ClipboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	input: {
		EventType: "InputEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	mousedown: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseenter: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	mouseleave: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	mousemove: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseout: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseover: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseup: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerover: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerenter: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	pointerdown: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointermove: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerup: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointercancel: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	pointerout: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerleave: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	submit: {
		EventType: "Event",
		defaultInit: {
			bubbles: !0,
			cancelable: !0
		}
	}
};
function cb(e) {
	return sb[e].EventType;
}
var lb = ["MouseEvent", "PointerEvent"];
function ub(e) {
	return lb.includes(cb(e));
}
function db(e) {
	return cb(e) === "KeyboardEvent";
}
var fb = {
	ClipboardEvent: [gb],
	Event: [],
	FocusEvent: [yb, _b],
	InputEvent: [yb, vb],
	MouseEvent: [
		yb,
		bb,
		Sb
	],
	PointerEvent: [
		yb,
		bb,
		Sb,
		Cb
	],
	KeyboardEvent: [
		yb,
		bb,
		xb
	]
};
function pb(e, t, n) {
	let r = uv(t), { EventType: i, defaultInit: a } = sb[e], o = new (mb(r))[i](e, a);
	var s = {};
	for (var c in n) Object.prototype.hasOwnProperty.call(n, c) && (s[c] = n[c]);
	return s.view = r, fb[i].forEach(function(e) {
		e(o, s);
	}), o;
}
function mb(e) {
	let t = e.Event ?? class {}, n = e.AnimationEvent ?? class extends t {}, r = e.ClipboardEvent ?? class extends t {}, i = e.PopStateEvent ?? class extends t {}, a = e.ProgressEvent ?? class extends t {}, o = e.TransitionEvent ?? class extends t {}, s = e.UIEvent ?? class extends t {}, c = e.CompositionEvent ?? class extends s {}, l = e.FocusEvent ?? class extends s {}, u = e.InputEvent ?? class extends s {}, d = e.KeyboardEvent ?? class extends s {}, f = e.MouseEvent ?? class extends s {};
	return {
		Event: t,
		AnimationEvent: n,
		ClipboardEvent: r,
		PopStateEvent: i,
		ProgressEvent: a,
		TransitionEvent: o,
		UIEvent: s,
		CompositionEvent: c,
		FocusEvent: l,
		InputEvent: u,
		KeyboardEvent: d,
		MouseEvent: f,
		DragEvent: e.DragEvent ?? class extends f {},
		PointerEvent: e.PointerEvent ?? class extends f {},
		TouchEvent: e.TouchEvent ?? class extends s {}
	};
}
function hb(e, t) {
	for (let [n, r] of Object.entries(t)) Object.defineProperty(e, n, { get: () => r ?? null });
}
function $(e) {
	return Number(e ?? 0);
}
function gb(e, { clipboardData: t }) {
	hb(e, { clipboardData: t });
}
function _b(e, { relatedTarget: t }) {
	hb(e, { relatedTarget: t });
}
function vb(e, { data: t, inputType: n, isComposing: r }) {
	hb(e, {
		data: t,
		isComposing: !!r,
		inputType: String(n)
	});
}
function yb(e, { view: t, detail: n }) {
	hb(e, {
		view: t,
		detail: $(n ?? 0)
	});
}
function bb(e, { altKey: t, ctrlKey: n, metaKey: r, shiftKey: i, modifierAltGraph: a, modifierCapsLock: o, modifierFn: s, modifierFnLock: c, modifierNumLock: l, modifierScrollLock: u, modifierSymbol: d, modifierSymbolLock: f }) {
	hb(e, {
		altKey: !!t,
		ctrlKey: !!n,
		metaKey: !!r,
		shiftKey: !!i,
		getModifierState(e) {
			return !!{
				Alt: t,
				AltGraph: a,
				CapsLock: o,
				Control: n,
				Fn: s,
				FnLock: c,
				Meta: r,
				NumLock: l,
				ScrollLock: u,
				Shift: i,
				Symbol: d,
				SymbolLock: f
			}[e];
		}
	});
}
function xb(e, { key: t, code: n, location: r, repeat: i, isComposing: a, charCode: o }) {
	hb(e, {
		key: String(t),
		code: String(n),
		location: $(r),
		repeat: !!i,
		isComposing: !!a,
		charCode: o
	});
}
function Sb(e, { x: t, y: n, screenX: r, screenY: i, clientX: a = t, clientY: o = n, button: s, buttons: c, relatedTarget: l, offsetX: u, offsetY: d, pageX: f, pageY: p }) {
	hb(e, {
		screenX: $(r),
		screenY: $(i),
		clientX: $(a),
		x: $(a),
		clientY: $(o),
		y: $(o),
		button: $(s),
		buttons: $(c),
		relatedTarget: l,
		offsetX: $(u),
		offsetY: $(d),
		pageX: $(f),
		pageY: $(p)
	});
}
function Cb(e, { pointerId: t, width: n, height: r, pressure: i, tangentialPressure: a, tiltX: o, tiltY: s, twist: c, pointerType: l, isPrimary: u, buttons: d }) {
	hb(e, {
		pointerId: $(t),
		width: $(n ?? 1),
		height: $(r ?? 1),
		pressure: $(i ?? (d ? .5 : 0)),
		tangentialPressure: $(a),
		tiltX: $(o),
		tiltY: $(s),
		twist: $(c),
		pointerType: String(l),
		isPrimary: !!u
	});
}
function wb(e, t, n, r = !1) {
	(ub(t) || db(t)) && (n = {
		...n,
		...this.system.getUIEventModifiers()
	});
	let i = pb(t, e, n);
	return Tb.call(this, e, i, r);
}
function Tb(e, t, n = !1) {
	let r = t.type, i = n ? () => {} : ty[r]?.call(ty, t, e, this);
	if (i) {
		t.preventDefault();
		let n = !1;
		return Object.defineProperty(t, "defaultPrevented", { get: () => n }), Object.defineProperty(t, "preventDefault", { value: () => {
			n = t.cancelable;
		} }), Qv(() => e.dispatchEvent(t)), n || i(), !n;
	}
	return Qv(() => e.dispatchEvent(t));
}
function Eb(e, t, n) {
	let r = pb(t, e, n);
	Qv(() => e.dispatchEvent(r));
}
var Db = /* @__PURE__ */ Symbol("patched focus/blur methods");
function Ob(e) {
	if (e.prototype[Db]) return;
	let { focus: t, blur: n } = e.prototype;
	Object.defineProperties(e.prototype, {
		focus: {
			configurable: !0,
			value: i,
			writable: !0
		},
		blur: {
			configurable: !0,
			value: a,
			writable: !0
		},
		[Db]: {
			configurable: !0,
			get: () => ({
				focus: t,
				blur: n
			})
		}
	});
	let r;
	function i(e) {
		if (this.ownerDocument.visibilityState !== "hidden") return t.call(this, e);
		let i = kb(this.ownerDocument);
		if (i === this) return;
		let a = /* @__PURE__ */ Symbol("focus call");
		r = a, i && (n.call(i), Eb(i, "blur", { relatedTarget: this }), Eb(i, "focusout", { relatedTarget: r === a ? this : null })), r === a && (t.call(this, e), Eb(this, "focus", { relatedTarget: i })), r === a && Eb(this, "focusin", { relatedTarget: i });
	}
	function a() {
		if (this.ownerDocument.visibilityState !== "hidden") return n.call(this);
		let e = kb(this.ownerDocument);
		e === this && (r = /* @__PURE__ */ Symbol("blur call"), n.call(this), Eb(e, "blur", { relatedTarget: null }), Eb(e, "focusout", { relatedTarget: null }));
	}
}
function kb(e) {
	let t = Lv(e);
	return t?.tagName === "BODY" ? null : t;
}
var Ab = /* @__PURE__ */ Symbol("Interceptor for programmatical calls");
function jb(e, t, n) {
	let r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t), i = Object.getOwnPropertyDescriptor(e, t), a = r?.set ? "set" : "value";
	if (typeof r?.[a] != "function" || r[a][Ab]) throw Error(`Element ${e.tagName} does not implement "${String(t)}".`);
	function o(...e) {
		let { applyNative: t = !1, realArgs: o, then: s } = n.call(this, ...e), c = (!t && i || r)[a];
		a === "set" ? c.call(this, o) : c.call(this, ...o), s?.();
	}
	o[Ab] = Ab, Object.defineProperty(e, t, {
		...i ?? r,
		[a]: o
	});
}
function Mb(e) {
	jb(e, "value", function(e) {
		let t = ay(e);
		return t && Py(this), {
			applyNative: !!t,
			realArgs: Nb(this, e),
			then: t ? void 0 : () => Fy(this, String(e))
		};
	});
}
function Nb(e, t) {
	return Q(e, "input", { type: "number" }) && String(t) !== "" && !Number.isNaN(Number(t)) ? String(Number(t)) : String(t);
}
function Pb(e) {
	jb(e, "setSelectionRange", function(t, ...n) {
		let r = oy(t);
		return {
			applyNative: !!r,
			realArgs: [Number(t), ...n],
			then: () => r ? void 0 : gy(e)
		};
	}), jb(e, "selectionStart", function(t) {
		return {
			realArgs: t,
			then: () => gy(e)
		};
	}), jb(e, "selectionEnd", function(t) {
		return {
			realArgs: t,
			then: () => gy(e)
		};
	}), jb(e, "select", function() {
		return {
			realArgs: [],
			then: () => fy(e, {
				anchorOffset: 0,
				focusOffset: cy(e).length
			})
		};
	});
}
function Fb(e) {
	jb(e, "setRangeText", function(...t) {
		return {
			realArgs: t,
			then: () => {
				ly(e), gy(e);
			}
		};
	});
}
var Ib = /* @__PURE__ */ Symbol("Node prepared with document state workarounds");
function Lb(e) {
	e[Ib] || (e.addEventListener("focus", (e) => {
		let t = e.target;
		Rb(t);
	}, {
		capture: !0,
		passive: !0
	}), e.activeElement && Rb(e.activeElement), e.addEventListener("blur", (e) => {
		let t = e.target, n = dy(t);
		n !== void 0 && (t.value !== n && Eb(t, "change"), uy(t));
	}, {
		capture: !0,
		passive: !0
	}), e[Ib] = Ib);
}
function Rb(e) {
	e[Ib] || (Q(e, ["input", "textarea"]) && (Mb(e), Pb(e), Fb(e)), e[Ib] = Ib);
}
function zb(e) {
	return Bb(e) ? e : e.ownerDocument;
}
function Bb(e) {
	return e.nodeType === 9;
}
var Vb = (function(e) {
	return e[e.Trigger = 2] = "Trigger", e[e.Call = 1] = "Call", e;
})({});
function Hb(e, t) {
	e.levelRefs[t] = {};
}
function Ub(e, t) {
	return e.levelRefs[t];
}
function Wb(e) {
	let t = e.delay;
	if (typeof t == "number") return Promise.all([new Promise((e) => globalThis.setTimeout(() => e(), t)), e.advanceTimers(t)]);
}
var Gb = (function(e) {
	return e[e.EachTrigger = 4] = "EachTrigger", e[e.EachApiCall = 2] = "EachApiCall", e[e.EachTarget = 1] = "EachTarget", e[e.Never = 0] = "Never", e;
})({});
function Kb(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var qb = (function(e) {
	return e[e.STANDARD = 0] = "STANDARD", e[e.LEFT = 1] = "LEFT", e[e.RIGHT = 2] = "RIGHT", e[e.NUMPAD = 3] = "NUMPAD", e;
})({}), Jb = [
	"Alt",
	"AltGraph",
	"Control",
	"Fn",
	"Meta",
	"Shift",
	"Symbol"
];
function Yb(e) {
	return Jb.includes(e);
}
var Xb = [
	"CapsLock",
	"FnLock",
	"NumLock",
	"ScrollLock",
	"SymbolLock"
];
function Zb(e) {
	return Xb.includes(e);
}
var Qb = class {
	isKeyPressed(e) {
		return this.pressed.has(String(e.code));
	}
	getPressedKeys() {
		return this.pressed.values().map((e) => e.keyDef);
	}
	async keydown(e, t) {
		let n = String(t.key), r = String(t.code), i = Rv(e.config.document);
		this.setKeydownTarget(i), this.pressed.add(r, t), Yb(n) && (this.modifiers[n] = !0);
		let a = e.dispatchUIEvent(i, "keydown", {
			key: n,
			code: r
		});
		Zb(n) && !this.modifiers[n] && (this.modifiers[n] = !0, this.modifierLockStart[n] = !0), a && this.pressed.setUnprevented(r), a && this.hasKeyPress(n) && e.dispatchUIEvent(Rv(e.config.document), "keypress", {
			key: n,
			code: r,
			charCode: t.key === "Enter" ? 13 : String(t.key).charCodeAt(0)
		});
	}
	async keyup(e, t) {
		let n = String(t.key), r = String(t.code), i = this.pressed.isUnprevented(r);
		this.pressed.delete(r), Yb(n) && !this.pressed.values().find((e) => e.keyDef.key === n) && (this.modifiers[n] = !1), e.dispatchUIEvent(Rv(e.config.document), "keyup", {
			key: n,
			code: r
		}, !i), Zb(n) && this.modifiers[n] && (this.modifierLockStart[n] ? this.modifierLockStart[n] = !1 : this.modifiers[n] = !1);
	}
	setKeydownTarget(e) {
		e !== this.lastKeydownTarget && (this.carryChar = ""), this.lastKeydownTarget = e;
	}
	hasKeyPress(e) {
		return (e.length === 1 || e === "Enter") && !this.modifiers.Control && !this.modifiers.Alt;
	}
	constructor(e) {
		Kb(this, "system", void 0), Kb(this, "modifiers", {
			Alt: !1,
			AltGraph: !1,
			CapsLock: !1,
			Control: !1,
			Fn: !1,
			FnLock: !1,
			Meta: !1,
			NumLock: !1,
			ScrollLock: !1,
			Shift: !1,
			Symbol: !1,
			SymbolLock: !1
		}), Kb(this, "pressed", new class {
			add(e, t) {
				var n, r;
				(n = this.registry)[r = e] ?? (n[r] = {
					keyDef: t,
					unpreventedDefault: !1
				});
			}
			has(e) {
				return !!this.registry[e];
			}
			setUnprevented(e) {
				let t = this.registry[e];
				t && (t.unpreventedDefault = !0);
			}
			isUnprevented(e) {
				var t;
				return !!((t = this.registry[e]) != null && t.unpreventedDefault);
			}
			delete(e) {
				delete this.registry[e];
			}
			values() {
				return Object.values(this.registry);
			}
			constructor() {
				Kb(this, "registry", {});
			}
		}()), Kb(this, "carryChar", ""), Kb(this, "lastKeydownTarget", void 0), Kb(this, "modifierLockStart", {}), this.system = e;
	}
}, $b = [
	..."0123456789".split("").map((e) => ({
		code: `Digit${e}`,
		key: e
	})),
	...")!@#$%^&*(".split("").map((e, t) => ({
		code: `Digit${t}`,
		key: e,
		shiftKey: !0
	})),
	..."abcdefghijklmnopqrstuvwxyz".split("").map((e) => ({
		code: `Key${e.toUpperCase()}`,
		key: e
	})),
	..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((e) => ({
		code: `Key${e}`,
		key: e,
		shiftKey: !0
	})),
	{
		code: "BracketLeft",
		key: "["
	},
	{
		code: "BracketLeft",
		key: "{",
		shiftKey: !0
	},
	{
		code: "BracketRight",
		key: "]"
	},
	{
		code: "BracketRight",
		key: "}",
		shiftKey: !0
	},
	{
		code: "Space",
		key: " "
	},
	{
		code: "AltLeft",
		key: "Alt",
		location: qb.LEFT
	},
	{
		code: "AltRight",
		key: "Alt",
		location: qb.RIGHT
	},
	{
		code: "ShiftLeft",
		key: "Shift",
		location: qb.LEFT
	},
	{
		code: "ShiftRight",
		key: "Shift",
		location: qb.RIGHT
	},
	{
		code: "ControlLeft",
		key: "Control",
		location: qb.LEFT
	},
	{
		code: "ControlRight",
		key: "Control",
		location: qb.RIGHT
	},
	{
		code: "MetaLeft",
		key: "Meta",
		location: qb.LEFT
	},
	{
		code: "MetaRight",
		key: "Meta",
		location: qb.RIGHT
	},
	{
		code: "OSLeft",
		key: "OS",
		location: qb.LEFT
	},
	{
		code: "OSRight",
		key: "OS",
		location: qb.RIGHT
	},
	{
		code: "ContextMenu",
		key: "ContextMenu"
	},
	{
		code: "Tab",
		key: "Tab"
	},
	{
		code: "CapsLock",
		key: "CapsLock"
	},
	{
		code: "Backspace",
		key: "Backspace"
	},
	{
		code: "Enter",
		key: "Enter"
	},
	{
		code: "Escape",
		key: "Escape"
	},
	{
		code: "ArrowUp",
		key: "ArrowUp"
	},
	{
		code: "ArrowDown",
		key: "ArrowDown"
	},
	{
		code: "ArrowLeft",
		key: "ArrowLeft"
	},
	{
		code: "ArrowRight",
		key: "ArrowRight"
	},
	{
		code: "Home",
		key: "Home"
	},
	{
		code: "End",
		key: "End"
	},
	{
		code: "Delete",
		key: "Delete"
	},
	{
		code: "PageUp",
		key: "PageUp"
	},
	{
		code: "PageDown",
		key: "PageDown"
	},
	{
		code: "Fn",
		key: "Fn"
	},
	{
		code: "Symbol",
		key: "Symbol"
	},
	{
		code: "AltRight",
		key: "AltGraph"
	}
], ex = [
	{
		name: "MouseLeft",
		pointerType: "mouse",
		button: "primary"
	},
	{
		name: "MouseRight",
		pointerType: "mouse",
		button: "secondary"
	},
	{
		name: "MouseMiddle",
		pointerType: "mouse",
		button: "auxiliary"
	},
	{
		name: "TouchA",
		pointerType: "touch"
	},
	{
		name: "TouchB",
		pointerType: "touch"
	},
	{
		name: "TouchC",
		pointerType: "touch"
	}
];
function tx(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var nx = class {
	getButtons() {
		let e = 0;
		for (let t of Object.keys(this.pressed)) e |= 2 ** Number(t);
		return e;
	}
	down(e) {
		let t = ix(e.button);
		if (t in this.pressed) this.pressed[t].push(e);
		else return this.pressed[t] = [e], t;
	}
	up(e) {
		let t = ix(e.button);
		if (t in this.pressed && (this.pressed[t] = this.pressed[t].filter((t) => t.name !== e.name), this.pressed[t].length === 0)) return delete this.pressed[t], t;
	}
	constructor() {
		tx(this, "pressed", {});
	}
}, rx = {
	primary: 0,
	secondary: 1,
	auxiliary: 2,
	back: 3,
	X1: 3,
	forward: 4,
	X2: 4
};
function ix(e = 0) {
	return e in rx ? rx[e] : Number(e);
}
var ax = {
	1: 2,
	2: 1
};
function ox(e) {
	return e = ix(e), e in ax ? ax[e] : e;
}
function sx(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var cx = class {
	get countPressed() {
		return this.pressedKeys.size;
	}
	isPressed(e) {
		return this.pressedKeys.has(e.name);
	}
	addPressed(e) {
		return this.pressedKeys.add(e.name);
	}
	removePressed(e) {
		return this.pressedKeys.delete(e.name);
	}
	constructor() {
		sx(this, "pressedKeys", /* @__PURE__ */ new Set());
	}
};
function lx(e, t) {
	let n = [];
	for (let t = e; t; t = t.parentElement) n.push(t);
	let r = [];
	for (let e = t; e; e = e.parentElement) r.push(e);
	let i = 0;
	for (; !(i >= n.length || i >= r.length || n[n.length - 1 - i] !== r[r.length - 1 - i]); i++);
	return [
		n.slice(0, n.length - i),
		r.slice(0, r.length - i),
		r.slice(r.length - i)
	];
}
function ux({ target: e, node: t, offset: n }) {
	return Jv(e) ? {
		node: e,
		offset: n ?? cy(e).length
	} : t ? {
		node: t,
		offset: n ?? (t.nodeType === 3 ? t.nodeValue.length : t.childNodes.length)
	} : dx(e, n);
}
function dx(e, t, n = !0) {
	let r = t === void 0 ? e.childNodes.length - 1 : 0, i = t === void 0 ? -1 : 1;
	for (; t === void 0 ? r >= (n ? Math.max(e.childNodes.length - 1, 0) : 0) : r <= e.childNodes.length;) {
		if (t && r === e.childNodes.length) throw Error("The given offset is out of bounds.");
		let n = e.childNodes.item(r), a = String(n.textContent);
		if (a.length) {
			if (t !== void 0 && a.length < t) t -= a.length;
			else {
				if (n.nodeType === 1) return dx(n, t, !1);
				if (n.nodeType === 3) return {
					node: n,
					offset: t ?? n.nodeValue.length
				};
			}
		}
		r += i;
	}
	return {
		node: e,
		offset: e.childNodes.length
	};
}
function fx({ document: e, target: t, clickCount: n, node: r, offset: i }) {
	if (Yv(t)) return;
	let a = Jv(t), o = String(a ? cy(t) : t.textContent), [s, c] = r ? [i, i] : px(o, i, n);
	if (a) return py(t, {
		anchorOffset: s ?? o.length,
		focusOffset: c ?? o.length
	}), {
		node: t,
		start: s ?? 0,
		end: c ?? o.length
	};
	{
		let { node: n, offset: i } = ux({
			target: t,
			node: r,
			offset: s
		}), { node: a, offset: o } = ux({
			target: t,
			node: r,
			offset: c
		}), l = t.ownerDocument.createRange();
		try {
			l.setStart(n, i), l.setEnd(a, o);
		} catch {
			throw Error("The given offset is out of bounds.");
		}
		let u = e.getSelection();
		return u?.removeAllRanges(), u?.addRange(l.cloneRange()), l;
	}
}
function px(e, t, n) {
	if (n % 3 == 1 || e.length === 0) return [t, t];
	let r = t ?? e.length;
	return n % 3 == 2 ? [r - e.substr(0, t).match(/(\w+|\s+|\W)?$/)[0].length, t === void 0 ? t : t + e.substr(t).match(/^(\w+|\s+|\W)?/)[0].length] : [r - e.substr(0, t).match(/[^\r\n]*$/)[0].length, t === void 0 ? t : t + e.substr(t).match(/^[^\r\n]*/)[0].length];
}
function mx(e, { document: t, target: n, node: r, offset: i }) {
	let a = ux({
		target: n,
		node: r,
		offset: i
	});
	if ("node" in e) {
		if (a.node === e.node) {
			let t = a.offset < e.start ? e.end : e.start, n = a.offset > e.end || a.offset < e.start ? a.offset : e.end;
			py(e.node, {
				anchorOffset: t,
				focusOffset: n
			});
		}
	} else {
		let n = e.cloneRange(), r = n.comparePoint(a.node, a.offset);
		r < 0 ? n.setStart(a.node, a.offset) : r > 0 && n.setEnd(a.node, a.offset);
		let i = t.getSelection();
		i?.removeAllRanges(), i?.addRange(n.cloneRange());
	}
}
function hx(e, t) {
	return e.target !== t.target || e.coords?.x !== t.coords?.x || e.coords?.y !== t.coords?.y || e.coords?.clientX !== t.coords?.clientX || e.coords?.clientY !== t.coords?.clientY || e.coords?.offsetX !== t.coords?.offsetX || e.coords?.offsetY !== t.coords?.offsetY || e.coords?.pageX !== t.coords?.pageX || e.coords?.pageY !== t.coords?.pageY || e.coords?.screenX !== t.coords?.screenX || e.coords?.screenY !== t.coords?.screenY || e.caret?.node !== t.caret?.node || e.caret?.offset !== t.caret?.offset;
}
function gx(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var _x = class {
	move(e, t, n) {
		let r = this.position, i = this.getTarget(e);
		if (this.position = t, !hx(r, t)) return;
		let a = this.getTarget(e), o = this.getEventInit("mousemove"), [s, c] = lx(i, a);
		return {
			leave: () => {
				i !== a && (e.dispatchUIEvent(i, "mouseout", o), s.forEach((t) => e.dispatchUIEvent(t, "mouseleave", o)));
			},
			enter: () => {
				i !== a && (e.dispatchUIEvent(a, "mouseover", o), c.forEach((t) => e.dispatchUIEvent(t, "mouseenter", o)));
			},
			move: () => {
				n || (e.dispatchUIEvent(a, "mousemove", o), this.modifySelecting(e));
			}
		};
	}
	down(e, t, n) {
		let r = this.buttons.down(t);
		if (r === void 0) return;
		let i = this.getTarget(e);
		this.buttonDownTarget[r] = i;
		let a = this.getEventInit("mousedown", t.button), o = Iv(i);
		!n && (o || e.dispatchUIEvent(i, "mousedown", a)) && (this.startSelecting(e, a.detail), $v(i)), !o && ox(t.button) === 2 && e.dispatchUIEvent(i, "contextmenu", this.getEventInit("contextmenu", t.button));
	}
	up(e, t, n) {
		let r = this.buttons.up(t);
		if (r === void 0) return;
		let i = this.getTarget(e);
		if (!Iv(i)) {
			if (!n) {
				let n = this.getEventInit("mouseup", t.button);
				e.dispatchUIEvent(i, "mouseup", n), this.endSelecting();
			}
			let a = lx(this.buttonDownTarget[r], i)[2][0];
			if (a) {
				let n = this.getEventInit("click", t.button);
				n.detail && (e.dispatchUIEvent(a, n.button === 0 ? "click" : "auxclick", n), n.button === 0 && n.detail === 2 && e.dispatchUIEvent(a, "dblclick", {
					...this.getEventInit("dblclick", t.button),
					detail: n.detail
				}));
			}
		}
	}
	resetClickCount() {
		this.clickCount.reset();
	}
	getEventInit(e, t) {
		let n = { ...this.position.coords };
		return n.button = ox(t), n.buttons = this.buttons.getButtons(), e === "mousedown" ? n.detail = this.clickCount.getOnDown(n.button) : e === "mouseup" ? n.detail = this.clickCount.getOnUp(n.button) : (e === "click" || e === "auxclick") && (n.detail = this.clickCount.incOnClick(n.button)), n;
	}
	getTarget(e) {
		return this.position.target ?? e.config.document.body;
	}
	startSelecting(e, t) {
		this.selecting = fx({
			document: e.config.document,
			target: this.getTarget(e),
			node: this.position.caret?.node,
			offset: this.position.caret?.offset,
			clickCount: t
		});
	}
	modifySelecting(e) {
		this.selecting && mx(this.selecting, {
			document: e.config.document,
			target: this.getTarget(e),
			node: this.position.caret?.node,
			offset: this.position.caret?.offset
		});
	}
	endSelecting() {
		this.selecting = void 0;
	}
	constructor() {
		gx(this, "position", {}), gx(this, "buttons", new nx()), gx(this, "selecting", void 0), gx(this, "buttonDownTarget", {}), gx(this, "clickCount", new class {
			incOnClick(e) {
				let t = this.down[e] === void 0 ? void 0 : Number(this.down[e]) + 1;
				return this.count = this.count[e] === void 0 ? {} : { [e]: Number(this.count[e]) + 1 }, t;
			}
			getOnDown(e) {
				return this.down = { [e]: this.count[e] ?? 0 }, this.count = { [e]: this.count[e] ?? 0 }, Number(this.count[e]) + 1;
			}
			getOnUp(e) {
				return this.down[e] === void 0 ? void 0 : Number(this.down[e]) + 1;
			}
			reset() {
				this.count = {};
			}
			constructor() {
				gx(this, "down", {}), gx(this, "count", {});
			}
		}());
	}
};
function vx(e, t) {
	return xx(e, t)?.pointerEvents !== "none";
}
function yx(e) {
	let t = uv(e);
	for (let n = e, r = []; n?.ownerDocument; n = n.parentElement) {
		r.push(n);
		let e = t.getComputedStyle(n).pointerEvents;
		if (e && !["inherit", "unset"].includes(e)) return {
			pointerEvents: e,
			tree: r
		};
	}
}
var bx = /* @__PURE__ */ Symbol("Last check for pointer-events");
function xx(e, t) {
	let n = t[bx];
	if (!(e.config.pointerEventsCheck !== Gb.Never && (!n || Tx(e.config.pointerEventsCheck, Gb.EachApiCall) && n[Vb.Call] !== Ub(e, Vb.Call) || Tx(e.config.pointerEventsCheck, Gb.EachTrigger) && n[Vb.Trigger] !== Ub(e, Vb.Trigger)))) return n?.result;
	let r = yx(t);
	return t[bx] = {
		[Vb.Call]: Ub(e, Vb.Call),
		[Vb.Trigger]: Ub(e, Vb.Trigger),
		result: r
	}, r;
}
function Sx(e, t) {
	let n = xx(e, t);
	if (n?.pointerEvents === "none") throw Error([
		`Unable to perform pointer interaction as the element ${n.tree.length > 1 ? "inherits" : "has"} \`pointer-events: none\`:`,
		"",
		Cx(n.tree)
	].join("\n"));
}
function Cx(e) {
	return e.reverse().map((t, n) => [
		"".padEnd(n),
		t.tagName,
		t.id && `#${t.id}`,
		t.hasAttribute("data-testid") && `(testId=${t.getAttribute("data-testid")})`,
		wx(t),
		e.length > 1 && n === 0 && "  <-- This element declared `pointer-events: none`",
		e.length > 1 && n === e.length - 1 && "  <-- Asserted pointer events here"
	].filter(Boolean).join("")).join("\n");
}
function wx(e) {
	var t;
	let n;
	if (e.hasAttribute("aria-label")) n = e.getAttribute("aria-label");
	else if (e.hasAttribute("aria-labelledby")) {
		var r, i;
		n = (i = e.ownerDocument.getElementById(e.getAttribute("aria-labelledby"))) == null || (r = i.textContent) == null ? void 0 : r.trim();
	} else Q(e, [
		"button",
		"input",
		"meter",
		"output",
		"progress",
		"select",
		"textarea"
	]) && (t = e.labels) != null && t.length ? n = Array.from(e.labels).map((e) => e.textContent?.trim()).join("|") : Q(e, "button") && (n = e.textContent?.trim());
	return n = n?.replace(/\n/g, "  "), Number(n?.length) > 30 && (n = `${n?.substring(0, 29)}\u2026`), n ? `(label=${n})` : "";
}
function Tx(e, t) {
	return (e & t) > 0;
}
function Ex(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var Dx = class {
	init(e) {
		let t = this.getTarget(e), [, n] = lx(null, t), r = this.getEventInit();
		return Sx(e, t), e.dispatchUIEvent(t, "pointerover", r), n.forEach((t) => e.dispatchUIEvent(t, "pointerenter", r)), this;
	}
	move(e, t) {
		let n = this.position, r = this.getTarget(e);
		if (this.position = t, !hx(n, t)) return;
		let i = this.getTarget(e), a = this.getEventInit(-1), [o, s] = lx(r, i);
		return {
			leave: () => {
				vx(e, r) && r !== i && (e.dispatchUIEvent(r, "pointerout", a), o.forEach((t) => e.dispatchUIEvent(t, "pointerleave", a)));
			},
			enter: () => {
				Sx(e, i), r !== i && (e.dispatchUIEvent(i, "pointerover", a), s.forEach((t) => e.dispatchUIEvent(t, "pointerenter", a)));
			},
			move: () => {
				e.dispatchUIEvent(i, "pointermove", a);
			}
		};
	}
	down(e, t = 0) {
		if (this.isDown) return;
		let n = this.getTarget(e);
		Sx(e, n), this.isDown = !0, this.isPrevented = !e.dispatchUIEvent(n, "pointerdown", this.getEventInit(t));
	}
	up(e, t = 0) {
		if (!this.isDown) return;
		let n = this.getTarget(e);
		Sx(e, n), this.isPrevented = !1, this.isDown = !1, e.dispatchUIEvent(n, "pointerup", this.getEventInit(t));
	}
	release(e) {
		let t = this.getTarget(e), [n] = lx(t, null), r = this.getEventInit();
		vx(e, t) && (e.dispatchUIEvent(t, "pointerout", r), n.forEach((t) => e.dispatchUIEvent(t, "pointerleave", r))), this.isCancelled = !0;
	}
	getTarget(e) {
		return this.position.target ?? e.config.document.body;
	}
	getEventInit(e) {
		return {
			...this.position.coords,
			pointerId: this.pointerId,
			pointerType: this.pointerType,
			isPrimary: this.isPrimary,
			button: ox(e),
			buttons: this.buttons.getButtons()
		};
	}
	constructor({ pointerId: e, pointerType: t, isPrimary: n }, r) {
		Ex(this, "pointerId", void 0), Ex(this, "pointerType", void 0), Ex(this, "isPrimary", void 0), Ex(this, "buttons", void 0), Ex(this, "isMultitouch", !1), Ex(this, "isCancelled", !1), Ex(this, "isDown", !1), Ex(this, "isPrevented", !1), Ex(this, "position", {}), this.pointerId = e, this.pointerType = t, this.isPrimary = n, this.isMultitouch = !n, this.buttons = r;
	}
};
function Ox(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var kx = class {
	isKeyPressed(e) {
		return this.devices.get(e.pointerType).isPressed(e);
	}
	async press(e, t, n) {
		this.devices.get(t.pointerType).addPressed(t), this.buttons.down(t);
		let r = this.getPointerName(t), i = t.pointerType === "touch" ? this.pointers.new(r, t.pointerType, this.buttons) : this.pointers.get(r);
		i.position = n, i.pointerType !== "touch" && (this.mouse.position = n), i.pointerType === "touch" && i.init(e), i.down(e, t.button), i.pointerType !== "touch" && this.mouse.down(e, t, i.isPrevented);
	}
	async move(e, t, n) {
		let r = this.pointers.get(t), i = r.move(e, n), a = r.pointerType === "touch" ? void 0 : this.mouse.move(e, n, r.isPrevented);
		i?.leave(), a?.leave(), i?.enter(), a?.enter(), i?.move(), a?.move();
	}
	async release(e, t, n) {
		let r = this.devices.get(t.pointerType);
		r.removePressed(t), this.buttons.up(t);
		let i = this.pointers.get(this.getPointerName(t)), a = i.isPrevented;
		if (i.position = n, i.pointerType !== "touch" && (this.mouse.position = n), r.countPressed === 0 && i.up(e, t.button), i.pointerType === "touch" && i.release(e), i.pointerType === "touch" && !i.isMultitouch) {
			let r = this.mouse.move(e, n, a);
			r?.leave(), r?.enter(), r?.move(), this.mouse.down(e, t, a);
		}
		if (!i.isMultitouch) {
			let r = this.mouse.move(e, n, a);
			r?.leave(), r?.enter(), r?.move(), this.mouse.up(e, t, a);
		}
	}
	getPointerName(e) {
		return e.pointerType === "touch" ? e.name : e.pointerType;
	}
	getPreviousPosition(e) {
		return this.pointers.has(e) ? this.pointers.get(e).position : void 0;
	}
	resetClickCount() {
		this.mouse.resetClickCount();
	}
	getMouseTarget(e) {
		return this.mouse.position.target ?? e.config.document.body;
	}
	setMousePosition(e) {
		this.mouse.position = e, this.pointers.get("mouse").position = e;
	}
	constructor(e) {
		Ox(this, "system", void 0), Ox(this, "mouse", void 0), Ox(this, "buttons", void 0), Ox(this, "devices", new class {
			get(e) {
				var t, n;
				return (t = this.registry)[n = e] ?? (t[n] = new cx());
			}
			constructor() {
				Ox(this, "registry", {});
			}
		}()), Ox(this, "pointers", new class {
			new(e, t, n) {
				let r = t !== "touch" || !Object.values(this.registry).some((e) => e.pointerType === "touch" && !e.isCancelled);
				return r || Object.values(this.registry).forEach((e) => {
					e.pointerType === t && !e.isCancelled && (e.isMultitouch = !0);
				}), this.registry[e] = new Dx({
					pointerId: this.nextId++,
					pointerType: t,
					isPrimary: r
				}, n), this.registry[e];
			}
			get(e) {
				if (!this.has(e)) throw Error(`Trying to access pointer "${e}" which does not exist.`);
				return this.registry[e];
			}
			has(e) {
				return e in this.registry;
			}
			constructor() {
				Ox(this, "registry", {}), Ox(this, "nextId", 1);
			}
		}()), this.system = e, this.buttons = new nx(), this.mouse = new _x(), this.pointers.new("mouse", "mouse", this.buttons);
	}
};
function Ax(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var jx = class {
	getUIEventModifiers() {
		return {
			altKey: this.keyboard.modifiers.Alt,
			ctrlKey: this.keyboard.modifiers.Control,
			metaKey: this.keyboard.modifiers.Meta,
			shiftKey: this.keyboard.modifiers.Shift,
			modifierAltGraph: this.keyboard.modifiers.AltGraph,
			modifierCapsLock: this.keyboard.modifiers.CapsLock,
			modifierFn: this.keyboard.modifiers.Fn,
			modifierFnLock: this.keyboard.modifiers.FnLock,
			modifierNumLock: this.keyboard.modifiers.NumLock,
			modifierScrollLock: this.keyboard.modifiers.ScrollLock,
			modifierSymbol: this.keyboard.modifiers.Symbol,
			modifierSymbolLock: this.keyboard.modifiers.SymbolLock
		};
	}
	constructor() {
		Ax(this, "keyboard", new Qb(this)), Ax(this, "pointer", new kx(this));
	}
};
async function Mx(e) {
	let t = [];
	return this.config.skipHover || t.push({ target: e }), t.push({
		keys: "[MouseLeft]",
		target: e
	}), this.pointer(t);
}
async function Nx(e) {
	return this.pointer([{ target: e }, "[MouseLeft][MouseLeft]"]);
}
async function Px(e) {
	return this.pointer([{ target: e }, "[MouseLeft][MouseLeft][MouseLeft]"]);
}
async function Fx(e) {
	return this.pointer({ target: e });
}
async function Ix(e) {
	return Sx(this, this.system.pointer.getMouseTarget(this)), this.pointer({ target: e.ownerDocument.body });
}
async function Lx({ shift: e } = {}) {
	return this.keyboard(e === !0 ? "{Shift>}{Tab}{/Shift}" : e === !1 ? "[/ShiftLeft][/ShiftRight]{Tab}" : "{Tab}");
}
var Rx = {
	"{": "}",
	"[": "]"
};
function zx(e, t) {
	let n = 0, r = e[n] in Rx ? e[n] : "";
	n += r.length;
	let i = RegExp(`^\\${r}{2}`).test(e) ? "" : r;
	return {
		type: i,
		...i === "" ? Bx(e, n, t) : Vx(e, n, i, t)
	};
}
function Bx(e, t, n) {
	let r = e[t];
	return Hx(r, e, t, n), t += r.length, {
		consumedLength: t,
		descriptor: r,
		releasePrevious: !1,
		releaseSelf: !0,
		repeat: 1
	};
}
function Vx(e, t, n, r) {
	let i = e[t] === "/" ? "/" : "";
	t += i.length;
	let a = n === "{" && e[t] === "\\";
	t += Number(a);
	let o = a ? e[t] : e.slice(t).match(n === "{" ? /^\w+|^[^}>/]/ : /^\w+/)?.[0];
	Hx(o, e, t, r), t += o.length;
	let s = e.slice(t).match(/^>\d+/)?.[0] ?? "";
	t += s.length;
	let c = e[t] === "/" || !s && e[t] === ">" ? e[t] : "";
	t += c.length;
	let l = Rx[n], u = e[t] === l ? l : "";
	if (!u) throw Error(Wx([
		!s && "repeat modifier",
		!c && "release modifier",
		`"${l}"`
	].filter(Boolean).join(" or "), e[t], e, r));
	return t += u.length, {
		consumedLength: t,
		descriptor: o,
		releasePrevious: !!i,
		repeat: s ? Math.max(Number(s.substr(1)), 1) : 1,
		releaseSelf: Ux(c, s)
	};
}
function Hx(e, t, n, r) {
	if (!e) throw Error(Wx("key descriptor", t[n], t, r));
}
function Ux(e, t) {
	if (e) return e === "/";
	if (t) return !1;
}
function Wx(e, t, n, r) {
	return `Expected ${e} but found "${t ?? ""}" in "${n}"
    See ${r === "pointer" ? "https://testing-library.com/docs/user-event/pointer#pressing-a-button-or-touching-the-screen" : "https://testing-library.com/docs/user-event/keyboard"}
    for more information about how userEvent parses your input.`;
}
function Gx(e, t) {
	let n = [];
	do {
		let { type: r, descriptor: i, consumedLength: a, releasePrevious: o, releaseSelf: s = !0, repeat: c } = zx(t, "keyboard"), l = e.find((e) => r === "[" ? e.code?.toLowerCase() === i.toLowerCase() : r === "{" ? e.key?.toLowerCase() === i.toLowerCase() : e.key === i) ?? {
			key: "Unknown",
			code: "Unknown",
			[r === "[" ? "code" : "key"]: i
		};
		n.push({
			keyDef: l,
			releasePrevious: o,
			releaseSelf: s,
			repeat: c
		}), t = t.slice(a);
	} while (t);
	return n;
}
async function Kx(e) {
	let t = Gx(this.config.keyboardMap, e);
	for (let e = 0; e < t.length; e++) await Wb(this.config), await qx(this, t[e]);
}
async function qx(e, { keyDef: t, releasePrevious: n, releaseSelf: r, repeat: i }) {
	let { system: a } = e;
	if (a.keyboard.isKeyPressed(t) && await a.keyboard.keyup(e, t), !n) {
		for (let n = 1; n <= i; n++) await a.keyboard.keydown(e, t), n < i && await Wb(e.config);
		r && await a.keyboard.keyup(e, t);
	}
}
async function Jx(e) {
	for (let t of e.system.keyboard.getPressedKeys()) await e.system.keyboard.keyup(e, t);
}
function Yx(e) {
	let t = Jv(e) ? { "text/plain": Xx(e) } : { "text/plain": String(e.ownerDocument.getSelection()) }, n = bv(uv(e));
	for (let e in t) t[e] && n.setData(e, t[e]);
	return n;
}
function Xx(e) {
	let t = my(e);
	return cy(e).substring(t.startOffset, t.endOffset);
}
async function Zx() {
	let e = this.config.document, t = e.activeElement ?? 
	/* istanbul ignore next */
	e.body, n = Yx(t);
	if (n.items.length !== 0) return this.dispatchUIEvent(t, "copy", { clipboardData: n }) && this.config.writeToClipboard && await jv(e, n), n;
}
async function Qx() {
	let e = this.config.document, t = e.activeElement ?? 
	/* istanbul ignore next */
	e.body, n = Yx(t);
	if (n.items.length !== 0) return this.dispatchUIEvent(t, "cut", { clipboardData: n }) && this.config.writeToClipboard && await jv(t.ownerDocument, n), n;
}
async function $x(e) {
	let t = this.config.document, n = t.activeElement ?? 
	/* istanbul ignore next */
	t.body, r = (typeof e == "string" ? eS(t, e) : e) ?? await Av(t).catch(() => {
		throw Error("`userEvent.paste()` without `clipboardData` requires the `ClipboardAPI` to be available.");
	});
	this.dispatchUIEvent(n, "paste", { clipboardData: r });
}
function eS(e, t) {
	let n = bv(uv(e));
	return n.setData("text", t), n;
}
function tS(e, t) {
	let n = [];
	do {
		let { descriptor: r, consumedLength: i, releasePrevious: a, releaseSelf: o = !0 } = zx(t, "pointer"), s = e.find((e) => e.name === r);
		s && n.push({
			keyDef: s,
			releasePrevious: a,
			releaseSelf: o
		}), t = t.slice(i);
	} while (t);
	return n;
}
async function nS(e) {
	let { pointerMap: t } = this.config, n = [];
	(Array.isArray(e) ? e : [e]).forEach((e) => {
		typeof e == "string" ? n.push(...tS(t, e)) : "keys" in e ? n.push(...tS(t, e.keys).map((t) => ({
			...e,
			...t
		}))) : n.push(e);
	});
	for (let e = 0; e < n.length; e++) await Wb(this.config), await rS(this, n[e]);
	this.system.pointer.resetClickCount();
}
async function rS(e, t) {
	var n, r;
	let i = "pointerName" in t && t.pointerName ? t.pointerName : "keyDef" in t ? e.system.pointer.getPointerName(t.keyDef) : "mouse", a = e.system.pointer.getPreviousPosition(i), o = {
		target: t.target ?? aS(e, a),
		coords: t.coords ?? a?.coords,
		caret: {
			node: t.node ?? (iS(t) || a == null || (n = a.caret) == null ? void 0 : n.node),
			offset: t.offset ?? (iS(t) || a == null || (r = a.caret) == null ? void 0 : r.offset)
		}
	};
	"keyDef" in t ? (e.system.pointer.isKeyPressed(t.keyDef) && (Hb(e, Vb.Trigger), await e.system.pointer.release(e, t.keyDef, o)), t.releasePrevious || (Hb(e, Vb.Trigger), await e.system.pointer.press(e, t.keyDef, o), t.releaseSelf && (Hb(e, Vb.Trigger), await e.system.pointer.release(e, t.keyDef, o)))) : (Hb(e, Vb.Trigger), await e.system.pointer.move(e, i, o));
}
function iS(e) {
	return !!(e.target ?? e.node ?? e.offset !== void 0);
}
function aS(e, t) {
	if (!t) throw Error("This pointer has no previous position. Provide a target property!");
	return t.target ?? e.config.document.body;
}
async function oS(e) {
	if (!Gv(e) || Iv(e)) throw Error("clear()` is only supported on editable elements.");
	if ($v(e), e.ownerDocument.activeElement !== e) throw Error("The element to be cleared could not be focused.");
	if (Qy(e), !$y(e)) throw Error("The element content to be cleared could not be selected.");
	Hy(this, e, "", "deleteContentBackward");
}
async function sS(e, t) {
	return lS.call(this, !0, e, t);
}
async function cS(e, t) {
	return lS.call(this, !1, e, t);
}
async function lS(t, n, r) {
	if (!t && !n.multiple) throw e().getElementError("Unable to deselect an option in a non-multiple select. Use selectOptions to change the selection instead.", n);
	let i = Array.isArray(r) ? r : [r], a = Array.from(n.querySelectorAll("option, [role=\"option\"]")), o = i.map((t) => {
		if (typeof t != "string" && a.includes(t)) return t;
		{
			let r = a.find((e) => e.value === t || e.innerHTML === t);
			if (r) return r;
			throw e().getElementError(`Value "${String(t)}" not found in options`, n);
		}
	}).filter((e) => !Iv(e));
	if (Iv(n) || !o.length) return;
	let s = (e) => {
		e.selected = t, this.dispatchUIEvent(n, "input", {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}), this.dispatchUIEvent(n, "change");
	};
	if (Q(n, "select")) {
		if (n.multiple) for (let e of o) {
			let t = this.config.pointerEventsCheck === 0 || vx(this, e);
			t && (this.dispatchUIEvent(e, "pointerover"), this.dispatchUIEvent(n, "pointerenter"), this.dispatchUIEvent(e, "mouseover"), this.dispatchUIEvent(n, "mouseenter"), this.dispatchUIEvent(e, "pointermove"), this.dispatchUIEvent(e, "mousemove"), this.dispatchUIEvent(e, "pointerdown"), this.dispatchUIEvent(e, "mousedown")), $v(n), t && (this.dispatchUIEvent(e, "pointerup"), this.dispatchUIEvent(e, "mouseup")), s(e), t && this.dispatchUIEvent(e, "click"), await Wb(this.config);
		}
		else if (o.length === 1) {
			let e = this.config.pointerEventsCheck === 0 || vx(this, n);
			e ? await this.click(n) : $v(n), s(o[0]), e && (this.dispatchUIEvent(n, "pointerover"), this.dispatchUIEvent(n, "pointerenter"), this.dispatchUIEvent(n, "mouseover"), this.dispatchUIEvent(n, "mouseenter"), this.dispatchUIEvent(n, "pointerup"), this.dispatchUIEvent(n, "mouseup"), this.dispatchUIEvent(n, "click")), await Wb(this.config);
		} else throw e().getElementError("Cannot select multiple options on a non-multiple select", n);
	} else if (n.getAttribute("role") === "listbox") for (let e of o) await this.click(e), await this.unhover(e);
	else throw e().getElementError("Cannot select options on elements that are neither select nor listbox elements", n);
}
async function uS(e, t, { skipClick: n = this.config.skipClick, skipAutoClose: r = this.config.skipAutoClose, initialSelectionStart: i, initialSelectionEnd: a } = {}) {
	e.disabled || (n || await this.click(e), i !== void 0 && eb(e, i, a ?? i), await this.keyboard(t), r || await Jx(this));
}
var dS = /* @__PURE__ */ Symbol("files and value properties are mocked");
function fS(e, t, n) {
	n ? Object.defineProperty(e, t, n) : delete e[t];
}
function pS(e, t) {
	var n;
	(n = e[dS]) == null || n.restore();
	let r = Object.getOwnPropertyDescriptor(e, "type"), i = Object.getOwnPropertyDescriptor(e, "value"), a = Object.getOwnPropertyDescriptor(e, "files");
	function o() {
		fS(e, "type", r), fS(e, "value", i), fS(e, "files", a);
	}
	e[dS] = { restore: o }, Object.defineProperties(e, {
		files: {
			configurable: !0,
			get: () => t
		},
		value: {
			configurable: !0,
			get: () => t.length ? `C:\\fakepath\\${t[0].name}` : "",
			set(t) {
				if (t === "") o();
				else {
					var n;
					i == null || (n = i.set) == null || n.call(e, t);
				}
			}
		},
		type: {
			configurable: !0,
			get: () => "file",
			set(t) {
				t !== "file" && (o(), e.type = t);
			}
		}
	});
}
async function mS(e, t) {
	let n = Q(e, "label") ? e.control : e;
	if (!n || !Q(n, "input", { type: "file" })) throw TypeError(`The ${n === e ? "given" : "associated"} ${n?.tagName} element does not accept file uploads`);
	if (Iv(e)) return;
	let r = (Array.isArray(t) ? t : [t]).filter((e) => !this.config.applyAccept || gS(e, n.accept)).slice(0, n.multiple ? void 0 : 1), i = () => {
		r.length === n.files?.length && r.every((e, t) => e === n.files?.item(t)) || (pS(n, mv(uv(e), r)), this.dispatchUIEvent(n, "input"), this.dispatchUIEvent(n, "change"));
	};
	n.addEventListener("fileDialog", i), await this.click(e), n.removeEventListener("fileDialog", i);
}
function hS(e) {
	return e.toLowerCase().replace(/(\.|\/)jpg\b/g, "$1jpeg");
}
function gS(e, t) {
	if (!t) return !0;
	let n = [
		"audio/*",
		"image/*",
		"video/*"
	];
	return hS(t).trim().split(/\s*,\s*/).some((t) => t.startsWith(".") ? hS(e.name).endsWith(t) : n.includes(t) ? hS(e.type).startsWith(t.replace("*", "")) : hS(e.type) === t);
}
var _S = {
	click: Mx,
	dblClick: Nx,
	tripleClick: Px,
	hover: Fx,
	unhover: Ix,
	tab: Lx,
	keyboard: Kx,
	copy: Zx,
	cut: Qx,
	paste: $x,
	pointer: nS,
	clear: oS,
	deselectOptions: cS,
	selectOptions: sS,
	type: uS,
	upload: mS
};
function vS(t) {
	return e().asyncWrapper(t);
}
var yS = {
	applyAccept: !0,
	autoModify: !0,
	delay: 0,
	document: globalThis.document,
	keyboardMap: $b,
	pointerMap: ex,
	pointerEventsCheck: Gb.EachApiCall,
	skipAutoClose: !1,
	skipClick: !1,
	skipHover: !1,
	writeToClipboard: !1,
	advanceTimers: () => Promise.resolve()
}, bS = {
	...yS,
	writeToClipboard: !0
};
function xS(e = {}, t = bS, n) {
	let r = DS(e, n, t);
	return {
		...t,
		...e,
		document: r
	};
}
function SS(e = {}) {
	let t = xS(e);
	return Lb(t.document), Ob(uv(t.document).HTMLElement), Dv(t.document.defaultView ?? 
	/* istanbul ignore next */
	globalThis.window), ES(t).api;
}
function CS({ keyboardState: e, pointerState: t, ...n } = {}, r) {
	let i = xS(n, yS, r);
	Lb(i.document), Ob(uv(i.document).HTMLElement);
	let a = t ?? e ?? new jx();
	return {
		api: ES(i, a).api,
		system: a
	};
}
function wS(e) {
	return ES({
		...this.config,
		...e
	}, this.system).api;
}
function TS(e, t) {
	function n(...n) {
		return Hb(e, Vb.Call), vS(() => t.apply(e, n).then(async (t) => (await Wb(e.config), t)));
	}
	return Object.defineProperty(n, "name", { get: () => t.name }), n;
}
function ES(e, t = new jx()) {
	let n = {};
	return Object.assign(n, {
		config: e,
		dispatchEvent: Tb.bind(n),
		dispatchUIEvent: wb.bind(n),
		system: t,
		levelRefs: {},
		..._S
	}), {
		instance: n,
		api: {
			...Object.fromEntries(Object.entries(_S).map(([e, t]) => [e, TS(n, t)])),
			setup: wS.bind(n)
		}
	};
}
function DS(e, t, n) {
	return e.document ?? (t && zb(t)) ?? n.document;
}
var OS = {};
Vi(OS, {
	clear: () => kS,
	click: () => AS,
	copy: () => jS,
	cut: () => MS,
	dblClick: () => NS,
	deselectOptions: () => PS,
	hover: () => FS,
	keyboard: () => IS,
	paste: () => RS,
	pointer: () => LS,
	selectOptions: () => zS,
	tab: () => WS,
	tripleClick: () => BS,
	type: () => VS,
	unhover: () => HS,
	upload: () => US
});
function kS(e) {
	return CS().api.clear(e);
}
function AS(e, t = {}) {
	return CS(t, e).api.click(e);
}
function jS(e = {}) {
	return CS(e).api.copy();
}
function MS(e = {}) {
	return CS(e).api.cut();
}
function NS(e, t = {}) {
	return CS(t).api.dblClick(e);
}
function PS(e, t, n = {}) {
	return CS(n).api.deselectOptions(e, t);
}
function FS(e, t = {}) {
	return CS(t).api.hover(e);
}
async function IS(e, t = {}) {
	let { api: n, system: r } = CS(t);
	return n.keyboard(e).then(() => r);
}
async function LS(e, t = {}) {
	let { api: n, system: r } = CS(t);
	return n.pointer(e).then(() => r);
}
function RS(e, t) {
	return CS(t).api.paste(e);
}
function zS(e, t, n = {}) {
	return CS(n).api.selectOptions(e, t);
}
function BS(e, t = {}) {
	return CS(t).api.tripleClick(e);
}
function VS(e, t, n = {}) {
	return CS(n, e).api.type(e, t, n);
}
function HS(e, t = {}) {
	let { api: n, system: r } = CS(t);
	return r.pointer.setMousePosition({ target: e }), n.unhover(e);
}
function US(e, t, n = {}) {
	return CS(n).api.upload(e, t);
}
function WS(e = {}) {
	return CS().api.tab(e);
}
var GS = {
	...OS,
	setup: SS
}, KS = To({ ...n }, {
	getKeys: (e) => Object.keys(e).filter((e) => e !== "eventWrapper"),
	intercept: (e, t) => t[0] === "fireEvent" || e.startsWith("find") || e.startsWith("waitFor")
});
KS.screen = new Proxy(KS.screen, { get(e, t, n) {
	return typeof window < "u" && globalThis.location?.href?.includes("viewMode=docs") && Qi.warn(Gi`
        You are using Testing Library's \`screen\` object while the story is rendered in docs mode. This will likely lead to issues, as multiple stories are rendered in the same page and therefore screen will potentially find multiple elements. Use the \`canvas\` utility from the story context instead, which will scope the queries to each story's canvas.

        More info: https://storybook.js.org/docs/writing-tests/interaction-testing?ref=error#querying-the-canvas
      `), Reflect.get(e, t, n);
} });
var { buildQueries: qS, configure: JS, createEvent: YS, fireEvent: XS, findAllByAltText: ZS, findAllByDisplayValue: QS, findAllByLabelText: $S, findAllByPlaceholderText: eC, findAllByRole: tC, findAllByTestId: nC, findAllByText: rC, findAllByTitle: iC, findByAltText: aC, findByDisplayValue: oC, findByLabelText: sC, findByPlaceholderText: cC, findByRole: lC, findByTestId: uC, findByText: dC, findByTitle: fC, getAllByAltText: pC, getAllByDisplayValue: mC, getAllByLabelText: hC, getAllByPlaceholderText: gC, getAllByRole: _C, getAllByTestId: vC, getAllByText: yC, getAllByTitle: bC, getByAltText: xC, getByDisplayValue: SC, getByLabelText: CC, getByPlaceholderText: wC, getByRole: TC, getByTestId: EC, getByText: DC, getByTitle: OC, getConfig: kC, getDefaultNormalizer: AC, getElementError: jC, getNodeText: MC, getQueriesForElement: NC, getRoles: PC, getSuggestedQuery: FC, isInaccessible: IC, logDOM: LC, logRoles: RC, prettyDOM: zC, queries: BC, queryAllByAltText: VC, queryAllByAttribute: HC, queryAllByDisplayValue: UC, queryAllByLabelText: WC, queryAllByPlaceholderText: GC, queryAllByRole: KC, queryAllByTestId: qC, queryAllByText: JC, queryAllByTitle: YC, queryByAltText: XC, queryByAttribute: ZC, queryByDisplayValue: QC, queryByLabelText: $C, queryByPlaceholderText: ew, queryByRole: tw, queryByTestId: nw, queryByText: rw, queryByTitle: iw, queryHelpers: aw, screen: ow, waitFor: sw, waitForElementToBeRemoved: cw, within: lw, prettyFormat: uw } = KS, { userEvent: dw } = To({ userEvent: GS }, {
	intercept: !0,
	getKeys: (e) => Object.keys(e).filter((e) => e !== "eventWrapper")
}), { expect: fw } = To({ expect: ev }, {
	getKeys: (e, t) => {
		if ("constructor" in e && e.constructor === H) {
			let n = [
				"assert",
				"__methods",
				"__flags",
				"_obj"
			], r = Object.keys(Object.getPrototypeOf(e)).filter((e) => !n.includes(e));
			return t > 2 ? r : [...r, "not"];
		}
		return "any" in e ? Object.keys(e).filter((e) => e !== "any") : Object.keys(e);
	},
	mutate: !0,
	intercept: (e) => e !== "expect"
});
export { dw as a, ow as i, XS as n, sw as o, sv as r, lw as s, fw as t };
