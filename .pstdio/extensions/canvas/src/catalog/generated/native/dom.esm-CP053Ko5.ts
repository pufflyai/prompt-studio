// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, t as n } from "./rolldown-runtime-CwxnZyOB.ts";
// node_modules/.bun/@storybook+global@5.0.0/node_modules/@storybook/global/dist/index.mjs
var r = (() => {
	let e;
	return e = typeof window < "u" ? window : typeof globalThis < "u" || typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : {}, e;
})(), i = /* @__PURE__ */ n(((e, t) => {
	var n = (e = 0) => (t) => `\u001B[${38 + e};5;${t}m`, r = (e = 0) => (t, n, r) => `\u001B[${38 + e};2;${t};${n};${r}m`;
	function i() {
		let e = /* @__PURE__ */ new Map(), t = {
			modifier: {
				reset: [0, 0],
				bold: [1, 22],
				dim: [2, 22],
				italic: [3, 23],
				underline: [4, 24],
				overline: [53, 55],
				inverse: [7, 27],
				hidden: [8, 28],
				strikethrough: [9, 29]
			},
			color: {
				black: [30, 39],
				red: [31, 39],
				green: [32, 39],
				yellow: [33, 39],
				blue: [34, 39],
				magenta: [35, 39],
				cyan: [36, 39],
				white: [37, 39],
				blackBright: [90, 39],
				redBright: [91, 39],
				greenBright: [92, 39],
				yellowBright: [93, 39],
				blueBright: [94, 39],
				magentaBright: [95, 39],
				cyanBright: [96, 39],
				whiteBright: [97, 39]
			},
			bgColor: {
				bgBlack: [40, 49],
				bgRed: [41, 49],
				bgGreen: [42, 49],
				bgYellow: [43, 49],
				bgBlue: [44, 49],
				bgMagenta: [45, 49],
				bgCyan: [46, 49],
				bgWhite: [47, 49],
				bgBlackBright: [100, 49],
				bgRedBright: [101, 49],
				bgGreenBright: [102, 49],
				bgYellowBright: [103, 49],
				bgBlueBright: [104, 49],
				bgMagentaBright: [105, 49],
				bgCyanBright: [106, 49],
				bgWhiteBright: [107, 49]
			}
		};
		t.color.gray = t.color.blackBright, t.bgColor.bgGray = t.bgColor.bgBlackBright, t.color.grey = t.color.blackBright, t.bgColor.bgGrey = t.bgColor.bgBlackBright;
		for (let [n, r] of Object.entries(t)) {
			for (let [n, i] of Object.entries(r)) t[n] = {
				open: `\u001B[${i[0]}m`,
				close: `\u001B[${i[1]}m`
			}, r[n] = t[n], e.set(i[0], i[1]);
			Object.defineProperty(t, n, {
				value: r,
				enumerable: !1
			});
		}
		return Object.defineProperty(t, "codes", {
			value: e,
			enumerable: !1
		}), t.color.close = "\x1B[39m", t.bgColor.close = "\x1B[49m", t.color.ansi256 = n(), t.color.ansi16m = r(), t.bgColor.ansi256 = n(10), t.bgColor.ansi16m = r(10), Object.defineProperties(t, {
			rgbToAnsi256: {
				value: (e, t, n) => e === t && t === n ? e < 8 ? 16 : e > 248 ? 231 : Math.round((e - 8) / 247 * 24) + 232 : 16 + 36 * Math.round(e / 255 * 5) + 6 * Math.round(t / 255 * 5) + Math.round(n / 255 * 5),
				enumerable: !1
			},
			hexToRgb: {
				value: (e) => {
					let t = /(?<colorString>[a-f\d]{6}|[a-f\d]{3})/i.exec(e.toString(16));
					if (!t) return [
						0,
						0,
						0
					];
					let { colorString: n } = t.groups;
					n.length === 3 && (n = n.split("").map((e) => e + e).join(""));
					let r = Number.parseInt(n, 16);
					return [
						r >> 16 & 255,
						r >> 8 & 255,
						r & 255
					];
				},
				enumerable: !1
			},
			hexToAnsi256: {
				value: (e) => t.rgbToAnsi256(...t.hexToRgb(e)),
				enumerable: !1
			}
		}), t;
	}
	Object.defineProperty(t, "exports", {
		enumerable: !0,
		get: i
	});
})), a = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.printIteratorEntries = n, e.printIteratorValues = r, e.printListItems = i, e.printObjectProperties = a;
	var t = (e, t) => {
		let n = Object.keys(e).sort(t);
		return Object.getOwnPropertySymbols && Object.getOwnPropertySymbols(e).forEach((t) => {
			Object.getOwnPropertyDescriptor(e, t).enumerable && n.push(t);
		}), n;
	};
	function n(e, t, n, r, i, a, o = ": ") {
		let s = "", c = e.next();
		if (!c.done) {
			s += t.spacingOuter;
			let l = n + t.indent;
			for (; !c.done;) {
				let n = a(c.value[0], t, l, r, i), u = a(c.value[1], t, l, r, i);
				s += l + n + o + u, c = e.next(), c.done ? t.min || (s += ",") : s += "," + t.spacingInner;
			}
			s += t.spacingOuter + n;
		}
		return s;
	}
	function r(e, t, n, r, i, a) {
		let o = "", s = e.next();
		if (!s.done) {
			o += t.spacingOuter;
			let c = n + t.indent;
			for (; !s.done;) o += c + a(s.value, t, c, r, i), s = e.next(), s.done ? t.min || (o += ",") : o += "," + t.spacingInner;
			o += t.spacingOuter + n;
		}
		return o;
	}
	function i(e, t, n, r, i, a) {
		let o = "";
		if (e.length) {
			o += t.spacingOuter;
			let s = n + t.indent;
			for (let n = 0; n < e.length; n++) o += s, n in e && (o += a(e[n], t, s, r, i)), n < e.length - 1 ? o += "," + t.spacingInner : t.min || (o += ",");
			o += t.spacingOuter + n;
		}
		return o;
	}
	function a(e, n, r, i, a, o) {
		let s = "", c = t(e, n.compareKeys);
		if (c.length) {
			s += n.spacingOuter;
			let t = r + n.indent;
			for (let r = 0; r < c.length; r++) {
				let l = c[r], u = o(l, n, t, i, a), d = o(e[l], n, t, i, a);
				s += t + u + ": " + d, r < c.length - 1 ? s += "," + n.spacingInner : n.min || (s += ",");
			}
			s += n.spacingOuter + r;
		}
		return s;
	}
})), o = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.test = e.serialize = e.default = void 0;
	var t = a(), n = (function() {
		return typeof globalThis < "u" ? globalThis : n === void 0 ? typeof self < "u" ? self : typeof window < "u" ? window : Function("return this")() : n;
	})(), r = n["jest-symbol-do-not-touch"] || n.Symbol, i = typeof r == "function" && r.for ? r.for("jest.asymmetricMatcher") : 1267621, o = " ", s = (e, n, r, i, a, s) => {
		let c = e.toString();
		return c === "ArrayContaining" || c === "ArrayNotContaining" ? ++i > n.maxDepth ? "[" + c + "]" : c + " [" + (0, t.printListItems)(e.sample, n, r, i, a, s) + "]" : c === "ObjectContaining" || c === "ObjectNotContaining" ? ++i > n.maxDepth ? "[" + c + "]" : c + " {" + (0, t.printObjectProperties)(e.sample, n, r, i, a, s) + "}" : c === "StringMatching" || c === "StringNotMatching" || c === "StringContaining" || c === "StringNotContaining" ? c + o + s(e.sample, n, r, i, a) : e.toAsymmetricMatcher();
	};
	e.serialize = s;
	var c = (e) => e && e.$$typeof === i;
	e.test = c, e.default = {
		serialize: s,
		test: c
	};
})), s = /* @__PURE__ */ n(((e, t) => {
	t.exports = ({ onlyFirst: e = !1 } = {}) => RegExp("[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", e ? void 0 : "g");
})), c = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.test = e.serialize = e.default = void 0;
	var t = r(s()), n = r(i());
	function r(e) {
		return e && e.__esModule ? e : { default: e };
	}
	var a = (e) => e.replace((0, t.default)(), (e) => {
		switch (e) {
			case n.default.red.close:
			case n.default.green.close:
			case n.default.cyan.close:
			case n.default.gray.close:
			case n.default.white.close:
			case n.default.yellow.close:
			case n.default.bgRed.close:
			case n.default.bgGreen.close:
			case n.default.bgYellow.close:
			case n.default.inverse.close:
			case n.default.dim.close:
			case n.default.bold.close:
			case n.default.reset.open:
			case n.default.reset.close: return "</>";
			case n.default.red.open: return "<red>";
			case n.default.green.open: return "<green>";
			case n.default.cyan.open: return "<cyan>";
			case n.default.gray.open: return "<gray>";
			case n.default.white.open: return "<white>";
			case n.default.yellow.open: return "<yellow>";
			case n.default.bgRed.open: return "<bgRed>";
			case n.default.bgGreen.open: return "<bgGreen>";
			case n.default.bgYellow.open: return "<bgYellow>";
			case n.default.inverse.open: return "<inverse>";
			case n.default.dim.open: return "<dim>";
			case n.default.bold.open: return "<bold>";
			default: return "";
		}
	}), o = (e) => typeof e == "string" && !!e.match((0, t.default)());
	e.test = o;
	var c = (e, t, n, r, i, o) => o(a(e), t, n, r, i);
	e.serialize = c, e.default = {
		serialize: c,
		test: o
	};
})), l = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.test = e.serialize = e.default = void 0;
	var t = a(), n = " ", r = ["DOMStringMap", "NamedNodeMap"], i = /^(HTML\w*Collection|NodeList)$/, o = (e) => r.indexOf(e) !== -1 || i.test(e), s = (e) => e && e.constructor && !!e.constructor.name && o(e.constructor.name);
	e.test = s;
	var c = (e) => e.constructor.name === "NamedNodeMap", l = (e, i, a, o, s, l) => {
		let u = e.constructor.name;
		return ++o > i.maxDepth ? "[" + u + "]" : (i.min ? "" : u + n) + (r.indexOf(u) === -1 ? "[" + (0, t.printListItems)(Array.from(e), i, a, o, s, l) + "]" : "{" + (0, t.printObjectProperties)(c(e) ? Array.from(e).reduce((e, t) => (e[t.name] = t.value, e), {}) : { ...e }, i, a, o, s, l) + "}");
	};
	e.serialize = l, e.default = {
		serialize: l,
		test: s
	};
})), u = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = t;
	function t(e) {
		return e.replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
})), d = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.printText = e.printProps = e.printElementAsLeaf = e.printElement = e.printComment = e.printChildren = void 0;
	var t = n(u());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.printProps = (e, t, n, r, i, a, o) => {
		let s = r + n.indent, c = n.colors;
		return e.map((e) => {
			let l = t[e], u = o(l, n, s, i, a);
			return typeof l != "string" && (u.indexOf("\n") !== -1 && (u = n.spacingOuter + s + u + n.spacingOuter + r), u = "{" + u + "}"), n.spacingInner + r + c.prop.open + e + c.prop.close + "=" + c.value.open + u + c.value.close;
		}).join("");
	}, e.printChildren = (e, t, n, i, a, o) => e.map((e) => t.spacingOuter + n + (typeof e == "string" ? r(e, t) : o(e, t, n, i, a))).join("");
	var r = (e, n) => {
		let r = n.colors.content;
		return r.open + (0, t.default)(e) + r.close;
	};
	e.printText = r, e.printComment = (e, n) => {
		let r = n.colors.comment;
		return r.open + "<!--" + (0, t.default)(e) + "-->" + r.close;
	}, e.printElement = (e, t, n, r, i) => {
		let a = r.colors.tag;
		return a.open + "<" + e + (t && a.close + t + r.spacingOuter + i + a.open) + (n ? ">" + a.close + n + r.spacingOuter + i + a.open + "</" + e : (t && !r.min ? "" : " ") + "/") + ">" + a.close;
	}, e.printElementAsLeaf = (e, t) => {
		let n = t.colors.tag;
		return n.open + "<" + e + n.close + " …" + n.open + " />" + n.close;
	};
})), f = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.test = e.serialize = e.default = void 0;
	var t = d(), n = 1, r = 3, i = 8, a = 11, o = /^((HTML|SVG)\w*)?Element$/, s = (e) => {
		try {
			return typeof e.hasAttribute == "function" && e.hasAttribute("is");
		} catch {
			return !1;
		}
	}, c = (e) => {
		let t = e.constructor.name, { nodeType: c, tagName: l } = e, u = typeof l == "string" && l.includes("-") || s(e);
		return c === n && (o.test(t) || u) || c === r && t === "Text" || c === i && t === "Comment" || c === a && t === "DocumentFragment";
	}, l = (e) => e?.constructor?.name && c(e);
	e.test = l;
	function u(e) {
		return e.nodeType === r;
	}
	function f(e) {
		return e.nodeType === i;
	}
	function p(e) {
		return e.nodeType === a;
	}
	var m = (e, n, r, i, a, o) => {
		if (u(e)) return (0, t.printText)(e.data, n);
		if (f(e)) return (0, t.printComment)(e.data, n);
		let s = p(e) ? "DocumentFragment" : e.tagName.toLowerCase();
		return ++i > n.maxDepth ? (0, t.printElementAsLeaf)(s, n) : (0, t.printElement)(s, (0, t.printProps)(p(e) ? [] : Array.from(e.attributes).map((e) => e.name).sort(), p(e) ? {} : Array.from(e.attributes).reduce((e, t) => (e[t.name] = t.value, e), {}), n, r + n.indent, i, a, o), (0, t.printChildren)(Array.prototype.slice.call(e.childNodes || e.children), n, r + n.indent, i, a, o), n, r);
	};
	e.serialize = m, e.default = {
		serialize: m,
		test: l
	};
})), p = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.test = e.serialize = e.default = void 0;
	var t = a(), n = "@@__IMMUTABLE_ITERABLE__@@", r = "@@__IMMUTABLE_LIST__@@", i = "@@__IMMUTABLE_KEYED__@@", o = "@@__IMMUTABLE_MAP__@@", s = "@@__IMMUTABLE_ORDERED__@@", c = "@@__IMMUTABLE_RECORD__@@", l = "@@__IMMUTABLE_SEQ__@@", u = "@@__IMMUTABLE_SET__@@", d = "@@__IMMUTABLE_STACK__@@", f = (e) => "Immutable." + e, p = (e) => "[" + e + "]", m = "…", h = (e, n, r, i, a, o, s) => ++i > n.maxDepth ? p(f(s)) : f(s) + " {" + (0, t.printIteratorEntries)(e.entries(), n, r, i, a, o) + "}";
	function g(e) {
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
	var _ = (e, n, r, i, a, o) => {
		let s = f(e._name || "Record");
		return ++i > n.maxDepth ? p(s) : s + " {" + (0, t.printIteratorEntries)(g(e), n, r, i, a, o) + "}";
	}, v = (e, n, r, a, o, s) => {
		let c = f("Seq");
		return ++a > n.maxDepth ? p(c) : e[i] ? c + " {" + (e._iter || e._object ? (0, t.printIteratorEntries)(e.entries(), n, r, a, o, s) : m) + "}" : c + " [" + (e._iter || e._array || e._collection || e._iterable ? (0, t.printIteratorValues)(e.values(), n, r, a, o, s) : m) + "]";
	}, y = (e, n, r, i, a, o, s) => ++i > n.maxDepth ? p(f(s)) : f(s) + " [" + (0, t.printIteratorValues)(e.values(), n, r, i, a, o) + "]", b = (e, t, n, i, a, c) => e[o] ? h(e, t, n, i, a, c, e[s] ? "OrderedMap" : "Map") : e[r] ? y(e, t, n, i, a, c, "List") : e[u] ? y(e, t, n, i, a, c, e[s] ? "OrderedSet" : "Set") : e[d] ? y(e, t, n, i, a, c, "Stack") : e[l] ? v(e, t, n, i, a, c) : _(e, t, n, i, a, c);
	e.serialize = b;
	var x = (e) => e && (e[n] === !0 || e[c] === !0);
	e.test = x, e.default = {
		serialize: b,
		test: x
	};
})), m = /* @__PURE__ */ n(((e) => {
	var t = 60103, n = 60106, r = 60107, i = 60108, a = 60114, o = 60109, s = 60110, c = 60112, l = 60113, u = 60120, d = 60115, f = 60116, p = 60121, m = 60122, h = 60117, g = 60129, _ = 60131;
	if (typeof Symbol == "function" && Symbol.for) {
		var v = Symbol.for;
		t = v("react.element"), n = v("react.portal"), r = v("react.fragment"), i = v("react.strict_mode"), a = v("react.profiler"), o = v("react.provider"), s = v("react.context"), c = v("react.forward_ref"), l = v("react.suspense"), u = v("react.suspense_list"), d = v("react.memo"), f = v("react.lazy"), p = v("react.block"), m = v("react.server.block"), h = v("react.fundamental"), g = v("react.debug_trace_mode"), _ = v("react.legacy_hidden");
	}
	function y(e) {
		if (typeof e == "object" && e) {
			var p = e.$$typeof;
			switch (p) {
				case t: switch (e = e.type, e) {
					case r:
					case a:
					case i:
					case l:
					case u: return e;
					default: switch (e &&= e.$$typeof, e) {
						case s:
						case c:
						case f:
						case d:
						case o: return e;
						default: return p;
					}
				}
				case n: return p;
			}
		}
	}
	var b = o, x = t, S = c, C = r, w = f, T = d, ee = n, E = a, D = i, te = l;
	e.ContextConsumer = s, e.ContextProvider = b, e.Element = x, e.ForwardRef = S, e.Fragment = C, e.Lazy = w, e.Memo = T, e.Portal = ee, e.Profiler = E, e.StrictMode = D, e.Suspense = te, e.isAsyncMode = function() {
		return !1;
	}, e.isConcurrentMode = function() {
		return !1;
	}, e.isContextConsumer = function(e) {
		return y(e) === s;
	}, e.isContextProvider = function(e) {
		return y(e) === o;
	}, e.isElement = function(e) {
		return typeof e == "object" && !!e && e.$$typeof === t;
	}, e.isForwardRef = function(e) {
		return y(e) === c;
	}, e.isFragment = function(e) {
		return y(e) === r;
	}, e.isLazy = function(e) {
		return y(e) === f;
	}, e.isMemo = function(e) {
		return y(e) === d;
	}, e.isPortal = function(e) {
		return y(e) === n;
	}, e.isProfiler = function(e) {
		return y(e) === a;
	}, e.isStrictMode = function(e) {
		return y(e) === i;
	}, e.isSuspense = function(e) {
		return y(e) === l;
	}, e.isValidElementType = function(e) {
		return !!(typeof e == "string" || typeof e == "function" || e === r || e === a || e === g || e === i || e === l || e === u || e === _ || typeof e == "object" && e && (e.$$typeof === f || e.$$typeof === d || e.$$typeof === o || e.$$typeof === s || e.$$typeof === c || e.$$typeof === h || e.$$typeof === p || e[0] === m));
	}, e.typeOf = y;
})), h = /* @__PURE__ */ n(((e, t) => {
	t.exports = m();
})), g = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.test = e.serialize = e.default = void 0;
	var t = i(h()), n = d();
	function r(e) {
		if (typeof WeakMap != "function") return null;
		var t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap();
		return (r = function(e) {
			return e ? n : t;
		})(e);
	}
	function i(e, t) {
		if (!t && e && e.__esModule) return e;
		if (e === null || typeof e != "object" && typeof e != "function") return { default: e };
		var n = r(t);
		if (n && n.has(e)) return n.get(e);
		var i = {}, a = Object.defineProperty && Object.getOwnPropertyDescriptor;
		for (var o in e) if (o !== "default" && Object.prototype.hasOwnProperty.call(e, o)) {
			var s = a ? Object.getOwnPropertyDescriptor(e, o) : null;
			s && (s.get || s.set) ? Object.defineProperty(i, o, s) : i[o] = e[o];
		}
		return i.default = e, n && n.set(e, i), i;
	}
	var a = (e, t = []) => (Array.isArray(e) ? e.forEach((e) => {
		a(e, t);
	}) : e != null && e !== !1 && t.push(e), t), o = (e) => {
		let n = e.type;
		if (typeof n == "string") return n;
		if (typeof n == "function") return n.displayName || n.name || "Unknown";
		if (t.isFragment(e)) return "React.Fragment";
		if (t.isSuspense(e)) return "React.Suspense";
		if (typeof n == "object" && n) {
			if (t.isContextProvider(e)) return "Context.Provider";
			if (t.isContextConsumer(e)) return "Context.Consumer";
			if (t.isForwardRef(e)) {
				if (n.displayName) return n.displayName;
				let e = n.render.displayName || n.render.name || "";
				return e === "" ? "ForwardRef" : "ForwardRef(" + e + ")";
			}
			if (t.isMemo(e)) {
				let e = n.displayName || n.type.displayName || n.type.name || "";
				return e === "" ? "Memo" : "Memo(" + e + ")";
			}
		}
		return "UNDEFINED";
	}, s = (e) => {
		let { props: t } = e;
		return Object.keys(t).filter((e) => e !== "children" && t[e] !== void 0).sort();
	}, c = (e, t, r, i, c, l) => ++i > t.maxDepth ? (0, n.printElementAsLeaf)(o(e), t) : (0, n.printElement)(o(e), (0, n.printProps)(s(e), e.props, t, r + t.indent, i, c, l), (0, n.printChildren)(a(e.props.children), t, r + t.indent, i, c, l), t, r);
	e.serialize = c;
	var l = (e) => e != null && t.isElement(e);
	e.test = l, e.default = {
		serialize: c,
		test: l
	};
})), _ = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.test = e.serialize = e.default = void 0;
	var t = d(), n = (function() {
		return typeof globalThis < "u" ? globalThis : n === void 0 ? typeof self < "u" ? self : typeof window < "u" ? window : Function("return this")() : n;
	})(), r = n["jest-symbol-do-not-touch"] || n.Symbol, i = typeof r == "function" && r.for ? r.for("react.test.json") : 245830487, a = (e) => {
		let { props: t } = e;
		return t ? Object.keys(t).filter((e) => t[e] !== void 0).sort() : [];
	}, o = (e, n, r, i, o, s) => ++i > n.maxDepth ? (0, t.printElementAsLeaf)(e.type, n) : (0, t.printElement)(e.type, e.props ? (0, t.printProps)(a(e), e.props, n, r + n.indent, i, o, s) : "", e.children ? (0, t.printChildren)(e.children, n, r + n.indent, i, o, s) : "", n, r);
	e.serialize = o;
	var s = (e) => e && e.$$typeof === i;
	e.test = s, e.default = {
		serialize: o,
		test: s
	};
})), v = /* @__PURE__ */ e((/* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = e.DEFAULT_OPTIONS = void 0, e.format = ye, e.plugins = void 0;
	var t = y(i()), n = a(), r = y(o()), s = y(c()), u = y(l()), d = y(f()), m = y(p()), h = y(g()), v = y(_());
	function y(e) {
		return e && e.__esModule ? e : { default: e };
	}
	var b = Object.prototype.toString, x = Date.prototype.toISOString, S = Error.prototype.toString, C = RegExp.prototype.toString, w = (e) => typeof e.constructor == "function" && e.constructor.name || "Object", T = (e) => typeof window < "u" && e === window, ee = /^Symbol\((.*)\)(.*)$/, E = /\n/gi, D = class extends Error {
		constructor(e, t) {
			super(e), this.stack = t, this.name = this.constructor.name;
		}
	};
	function te(e) {
		return e === "[object Array]" || e === "[object ArrayBuffer]" || e === "[object DataView]" || e === "[object Float32Array]" || e === "[object Float64Array]" || e === "[object Int8Array]" || e === "[object Int16Array]" || e === "[object Int32Array]" || e === "[object Uint8Array]" || e === "[object Uint8ClampedArray]" || e === "[object Uint16Array]" || e === "[object Uint32Array]";
	}
	function ne(e) {
		return Object.is(e, -0) ? "-0" : String(e);
	}
	function re(e) {
		return String(`${e}n`);
	}
	function O(e, t) {
		return t ? "[Function " + (e.name || "anonymous") + "]" : "[Function]";
	}
	function k(e) {
		return String(e).replace(ee, "Symbol($1)");
	}
	function ie(e) {
		return "[" + S.call(e) + "]";
	}
	function ae(e, t, n, r) {
		if (e === !0 || e === !1) return "" + e;
		if (e === void 0) return "undefined";
		if (e === null) return "null";
		let i = typeof e;
		if (i === "number") return ne(e);
		if (i === "bigint") return re(e);
		if (i === "string") return r ? "\"" + e.replace(/"|\\/g, "\\$&") + "\"" : "\"" + e + "\"";
		if (i === "function") return O(e, t);
		if (i === "symbol") return k(e);
		let a = b.call(e);
		return a === "[object WeakMap]" ? "WeakMap {}" : a === "[object WeakSet]" ? "WeakSet {}" : a === "[object Function]" || a === "[object GeneratorFunction]" ? O(e, t) : a === "[object Symbol]" ? k(e) : a === "[object Date]" ? isNaN(+e) ? "Date { NaN }" : x.call(e) : a === "[object Error]" ? ie(e) : a === "[object RegExp]" ? n ? C.call(e).replace(/[\\^$*+?.()|[\]{}]/g, "\\$&") : C.call(e) : e instanceof Error ? ie(e) : null;
	}
	function oe(e, t, r, i, a, o) {
		if (a.indexOf(e) !== -1) return "[Circular]";
		a = a.slice(), a.push(e);
		let s = ++i > t.maxDepth, c = t.min;
		if (t.callToJSON && !s && e.toJSON && typeof e.toJSON == "function" && !o) return A(e.toJSON(), t, r, i, a, !0);
		let l = b.call(e);
		return l === "[object Arguments]" ? s ? "[Arguments]" : (c ? "" : "Arguments ") + "[" + (0, n.printListItems)(e, t, r, i, a, A) + "]" : te(l) ? s ? "[" + e.constructor.name + "]" : (c || !t.printBasicPrototype && e.constructor.name === "Array" ? "" : e.constructor.name + " ") + "[" + (0, n.printListItems)(e, t, r, i, a, A) + "]" : l === "[object Map]" ? s ? "[Map]" : "Map {" + (0, n.printIteratorEntries)(e.entries(), t, r, i, a, A, " => ") + "}" : l === "[object Set]" ? s ? "[Set]" : "Set {" + (0, n.printIteratorValues)(e.values(), t, r, i, a, A) + "}" : s || T(e) ? "[" + w(e) + "]" : (c || !t.printBasicPrototype && w(e) === "Object" ? "" : w(e) + " ") + "{" + (0, n.printObjectProperties)(e, t, r, i, a, A) + "}";
	}
	function se(e) {
		return e.serialize != null;
	}
	function ce(e, t, n, r, i, a) {
		let o;
		try {
			o = se(e) ? e.serialize(t, n, r, i, a, A) : e.print(t, (e) => A(e, n, r, i, a), (e) => {
				let t = r + n.indent;
				return t + e.replace(E, "\n" + t);
			}, {
				edgeSpacing: n.spacingOuter,
				min: n.min,
				spacing: n.spacingInner
			}, n.colors);
		} catch (e) {
			throw new D(e.message, e.stack);
		}
		if (typeof o != "string") throw Error(`pretty-format: Plugin must return type "string" but instead returned "${typeof o}".`);
		return o;
	}
	function le(e, t) {
		for (let n = 0; n < e.length; n++) try {
			if (e[n].test(t)) return e[n];
		} catch (e) {
			throw new D(e.message, e.stack);
		}
		return null;
	}
	function A(e, t, n, r, i, a) {
		let o = le(t.plugins, e);
		if (o !== null) return ce(o, e, t, n, r, i);
		let s = ae(e, t.printFunctionName, t.escapeRegex, t.escapeString);
		return s === null ? oe(e, t, n, r, i, a) : s;
	}
	var j = {
		comment: "gray",
		content: "reset",
		prop: "yellow",
		tag: "cyan",
		value: "green"
	}, ue = Object.keys(j), M = {
		callToJSON: !0,
		compareKeys: void 0,
		escapeRegex: !1,
		escapeString: !0,
		highlight: !1,
		indent: 2,
		maxDepth: Infinity,
		min: !1,
		plugins: [],
		printBasicPrototype: !0,
		printFunctionName: !0,
		theme: j
	};
	e.DEFAULT_OPTIONS = M;
	function de(e) {
		if (Object.keys(e).forEach((e) => {
			if (!M.hasOwnProperty(e)) throw Error(`pretty-format: Unknown option "${e}".`);
		}), e.min && e.indent !== void 0 && e.indent !== 0) throw Error("pretty-format: Options \"min\" and \"indent\" cannot be used together.");
		if (e.theme !== void 0) {
			if (e.theme === null) throw Error("pretty-format: Option \"theme\" must not be null.");
			if (typeof e.theme != "object") throw Error(`pretty-format: Option "theme" must be of type "object" but instead received "${typeof e.theme}".`);
		}
	}
	var fe = (e) => ue.reduce((n, r) => {
		let i = e.theme && e.theme[r] !== void 0 ? e.theme[r] : j[r], a = i && t.default[i];
		if (a && typeof a.close == "string" && typeof a.open == "string") n[r] = a;
		else throw Error(`pretty-format: Option "theme" has a key "${r}" whose value "${i}" is undefined in ansi-styles.`);
		return n;
	}, Object.create(null)), pe = () => ue.reduce((e, t) => (e[t] = {
		close: "",
		open: ""
	}, e), Object.create(null)), me = (e) => e && e.printFunctionName !== void 0 ? e.printFunctionName : M.printFunctionName, he = (e) => e && e.escapeRegex !== void 0 ? e.escapeRegex : M.escapeRegex, ge = (e) => e && e.escapeString !== void 0 ? e.escapeString : M.escapeString, _e = (e) => ({
		callToJSON: e && e.callToJSON !== void 0 ? e.callToJSON : M.callToJSON,
		colors: e && e.highlight ? fe(e) : pe(),
		compareKeys: e && typeof e.compareKeys == "function" ? e.compareKeys : M.compareKeys,
		escapeRegex: he(e),
		escapeString: ge(e),
		indent: e && e.min ? "" : ve(e && e.indent !== void 0 ? e.indent : M.indent),
		maxDepth: e && e.maxDepth !== void 0 ? e.maxDepth : M.maxDepth,
		min: e && e.min !== void 0 ? e.min : M.min,
		plugins: e && e.plugins !== void 0 ? e.plugins : M.plugins,
		printBasicPrototype: e?.printBasicPrototype ?? !0,
		printFunctionName: me(e),
		spacingInner: e && e.min ? " " : "\n",
		spacingOuter: e && e.min ? "" : "\n"
	});
	function ve(e) {
		return Array(e + 1).join(" ");
	}
	function ye(e, t) {
		if (t && (de(t), t.plugins)) {
			let n = le(t.plugins, e);
			if (n !== null) return ce(n, e, _e(t), "", 0, []);
		}
		let n = ae(e, me(t), he(t), ge(t));
		return n === null ? oe(e, _e(t), "", 0, []) : n;
	}
	e.plugins = {
		AsymmetricMatcher: r.default,
		ConvertAnsi: s.default,
		DOMCollection: u.default,
		DOMElement: d.default,
		Immutable: m.default,
		ReactElement: h.default,
		ReactTestComponent: v.default
	}, e.default = ye;
})))()), y = Object.prototype.toString;
function b(e) {
	return typeof e == "function" || y.call(e) === "[object Function]";
}
function x(e) {
	var t = Number(e);
	return isNaN(t) ? 0 : t === 0 || !isFinite(t) ? t : (t > 0 ? 1 : -1) * Math.floor(Math.abs(t));
}
var S = 2 ** 53 - 1;
function C(e) {
	var t = x(e);
	return Math.min(Math.max(t, 0), S);
}
function w(e, t) {
	var n = Array, r = Object(e);
	if (e == null) throw TypeError("Array.from requires an array-like object - not null or undefined");
	if (t !== void 0 && !b(t)) throw TypeError("Array.from: when provided, the second argument must be a function");
	for (var i = C(r.length), a = b(n) ? Object(new n(i)) : Array(i), o = 0, s; o < i;) s = r[o], t ? a[o] = t(s, o) : a[o] = s, o += 1;
	return a.length = i, a;
}
// node_modules/.bun/dom-accessibility-api@0.5.16/node_modules/dom-accessibility-api/dist/polyfills/SetLike.mjs
function T(e) {
	"@babel/helpers - typeof";
	return T = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, T(e);
}
function ee(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function E(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, ne(r.key), r);
	}
}
function D(e, t, n) {
	return t && E(e.prototype, t), n && E(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function te(e, t, n) {
	return t = ne(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function ne(e) {
	var t = re(e, "string");
	return T(t) === "symbol" ? t : String(t);
}
function re(e, t) {
	if (T(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (T(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var O = typeof Set > "u" ? Set : /* @__PURE__ */ function() {
	function e() {
		var t = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
		ee(this, e), te(this, "items", void 0), this.items = t;
	}
	return D(e, [
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
}();
// node_modules/.bun/dom-accessibility-api@0.5.16/node_modules/dom-accessibility-api/dist/getRole.mjs
function k(e) {
	return e.localName ?? e.tagName.toLowerCase();
}
var ie = {
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
}, ae = {
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
	paragraph: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	presentation: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	strong: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	subscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	superscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"])
};
function oe(e, t) {
	return [
		"aria-atomic",
		"aria-busy",
		"aria-controls",
		"aria-current",
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
		return e.hasAttribute(n) && !((r = ae[t]) != null && r.has(n));
	});
}
function se(e, t) {
	return oe(e, t);
}
function ce(e) {
	var t = A(e);
	if (t === null || t === "presentation") {
		var n = le(e);
		if (t !== "presentation" || se(e, n || "")) return n;
	}
	return t;
}
function le(e) {
	var t = ie[k(e)];
	if (t !== void 0) return t;
	switch (k(e)) {
		case "a":
		case "area":
		case "link":
			if (e.hasAttribute("href")) return "link";
			break;
		case "img": return e.getAttribute("alt") === "" && !se(e, "img") ? "presentation" : "img";
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
function A(e) {
	var t = e.getAttribute("role");
	if (t !== null) {
		var n = t.trim().split(" ")[0];
		if (n.length > 0) return n;
	}
	return null;
}
// node_modules/.bun/dom-accessibility-api@0.5.16/node_modules/dom-accessibility-api/dist/util.mjs
function j(e) {
	return e !== null && e.nodeType === e.ELEMENT_NODE;
}
function ue(e) {
	return j(e) && k(e) === "caption";
}
function M(e) {
	return j(e) && k(e) === "input";
}
function de(e) {
	return j(e) && k(e) === "optgroup";
}
function fe(e) {
	return j(e) && k(e) === "select";
}
function pe(e) {
	return j(e) && k(e) === "table";
}
function me(e) {
	return j(e) && k(e) === "textarea";
}
function he(e) {
	var t = (e.ownerDocument === null ? e : e.ownerDocument).defaultView;
	if (t === null) throw TypeError("no window available");
	return t;
}
function ge(e) {
	return j(e) && k(e) === "fieldset";
}
function _e(e) {
	return j(e) && k(e) === "legend";
}
function ve(e) {
	return j(e) && k(e) === "slot";
}
function ye(e) {
	return j(e) && e.ownerSVGElement !== void 0;
}
function be(e) {
	return j(e) && k(e) === "svg";
}
function xe(e) {
	return ye(e) && k(e) === "title";
}
function N(e, t) {
	if (j(e) && e.hasAttribute(t)) {
		var n = e.getAttribute(t).split(" "), r = e.getRootNode ? e.getRootNode() : e.ownerDocument;
		return n.map(function(e) {
			return r.getElementById(e);
		}).filter(function(e) {
			return e !== null;
		});
	}
	return [];
}
function P(e, t) {
	return j(e) ? t.indexOf(ce(e)) !== -1 : !1;
}
// node_modules/.bun/dom-accessibility-api@0.5.16/node_modules/dom-accessibility-api/dist/accessible-name-and-description.mjs
function Se(e) {
	return e.trim().replace(/\s\s+/g, " ");
}
function Ce(e, t) {
	if (!j(e)) return !1;
	if (e.hasAttribute("hidden") || e.getAttribute("aria-hidden") === "true") return !0;
	var n = t(e);
	return n.getPropertyValue("display") === "none" || n.getPropertyValue("visibility") === "hidden";
}
function we(e) {
	return P(e, [
		"button",
		"combobox",
		"listbox",
		"textbox"
	]) || Te(e, "range");
}
function Te(e, t) {
	if (!j(e)) return !1;
	switch (t) {
		case "range": return P(e, [
			"meter",
			"progressbar",
			"scrollbar",
			"slider",
			"spinbutton"
		]);
		default: throw TypeError(`No knowledge about abstract role '${t}'. This is likely a bug :(`);
	}
}
function Ee(e, t) {
	var n = w(e.querySelectorAll(t));
	return N(e, "aria-owns").forEach(function(e) {
		n.push.apply(n, w(e.querySelectorAll(t)));
	}), n;
}
function De(e) {
	return fe(e) ? e.selectedOptions || Ee(e, "[selected]") : Ee(e, "[aria-selected=\"true\"]");
}
function Oe(e) {
	return P(e, ["none", "presentation"]);
}
function ke(e) {
	return ue(e);
}
function Ae(e) {
	return P(e, [
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
function je(e) {
	return !1;
}
function Me(e) {
	return M(e) || me(e) ? e.value : e.textContent || "";
}
function Ne(e) {
	var t = e.getPropertyValue("content");
	return /^["'].*["']$/.test(t) ? t.slice(1, -1) : "";
}
function Pe(e) {
	var t = k(e);
	return t === "button" || t === "input" && e.getAttribute("type") !== "hidden" || t === "meter" || t === "output" || t === "progress" || t === "select" || t === "textarea";
}
function Fe(e) {
	if (Pe(e)) return e;
	var t = null;
	return e.childNodes.forEach(function(e) {
		if (t === null && j(e)) {
			var n = Fe(e);
			n !== null && (t = n);
		}
	}), t;
}
function Ie(e) {
	if (e.control !== void 0) return e.control;
	var t = e.getAttribute("for");
	return t === null ? Fe(e) : e.ownerDocument.getElementById(t);
}
function Le(e) {
	var t = e.labels;
	if (t === null) return t;
	if (t !== void 0) return w(t);
	if (!Pe(e)) return null;
	var n = e.ownerDocument;
	return w(n.querySelectorAll("label")).filter(function(t) {
		return Ie(t) === e;
	});
}
function Re(e) {
	var t = e.assignedNodes();
	return t.length === 0 ? w(e.childNodes) : t;
}
function ze(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, n = new O(), r = he(e), i = t.compute, a = i === void 0 ? "name" : i, o = t.computedStyleSupportsPseudoElements, s = o === void 0 ? t.getComputedStyle !== void 0 : o, c = t.getComputedStyle, l = c === void 0 ? r.getComputedStyle.bind(r) : c, u = t.hidden, d = u !== void 0 && u;
	function f(e, t) {
		var n = "";
		if (j(e) && s && (n = `${Ne(l(e, "::before"))} ${n}`), (ve(e) ? Re(e) : w(e.childNodes).concat(N(e, "aria-owns"))).forEach(function(e) {
			var r = g(e, {
				isEmbeddedInLabel: t.isEmbeddedInLabel,
				isReferenced: !1,
				recursion: !0
			}), i = (j(e) ? l(e).getPropertyValue("display") : "inline") === "inline" ? "" : " ";
			n += `${i}${r}${i}`;
		}), j(e) && s) {
			var r = Ne(l(e, "::after"));
			n = `${n} ${r}`;
		}
		return n.trim();
	}
	function p(e, t) {
		var r = e.getAttributeNode(t);
		return r !== null && !n.has(r) && r.value.trim() !== "" ? (n.add(r), r.value) : null;
	}
	function m(e) {
		return j(e) ? p(e, "title") : null;
	}
	function h(e) {
		if (!j(e)) return null;
		if (ge(e)) {
			n.add(e);
			for (var t = w(e.childNodes), r = 0; r < t.length; r += 1) {
				var i = t[r];
				if (_e(i)) return g(i, {
					isEmbeddedInLabel: !1,
					isReferenced: !1,
					recursion: !1
				});
			}
		} else if (pe(e)) {
			n.add(e);
			for (var a = w(e.childNodes), o = 0; o < a.length; o += 1) {
				var s = a[o];
				if (ue(s)) return g(s, {
					isEmbeddedInLabel: !1,
					isReferenced: !1,
					recursion: !1
				});
			}
		} else if (be(e)) {
			n.add(e);
			for (var c = w(e.childNodes), l = 0; l < c.length; l += 1) {
				var u = c[l];
				if (xe(u)) return u.textContent;
			}
			return null;
		} else if (k(e) === "img" || k(e) === "area") {
			var d = p(e, "alt");
			if (d !== null) return d;
		} else if (de(e)) {
			var m = p(e, "label");
			if (m !== null) return m;
		}
		if (M(e) && (e.type === "button" || e.type === "submit" || e.type === "reset")) {
			var h = p(e, "value");
			if (h !== null) return h;
			if (e.type === "submit") return "Submit";
			if (e.type === "reset") return "Reset";
		}
		var _ = Le(e);
		if (_ !== null && _.length !== 0) return n.add(e), w(_).map(function(e) {
			return g(e, {
				isEmbeddedInLabel: !0,
				isReferenced: !1,
				recursion: !0
			});
		}).filter(function(e) {
			return e.length > 0;
		}).join(" ");
		if (M(e) && e.type === "image") {
			var v = p(e, "alt");
			if (v !== null) return v;
			var y = p(e, "title");
			return y === null ? "Submit Query" : y;
		}
		if (P(e, ["button"])) {
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
		if (!d && Ce(e, l) && !t.isReferenced) return n.add(e), "";
		var r = j(e) ? e.getAttributeNode("aria-labelledby") : null, i = r !== null && !n.has(r) ? N(e, "aria-labelledby") : [];
		if (a === "name" && !t.isReferenced && i.length > 0) return n.add(r), i.map(function(e) {
			return g(e, {
				isEmbeddedInLabel: t.isEmbeddedInLabel,
				isReferenced: !0,
				recursion: !1
			});
		}).join(" ");
		var o = t.recursion && we(e) && a === "name";
		if (!o) {
			var s = (j(e) && e.getAttribute("aria-label") || "").trim();
			if (s !== "" && a === "name") return n.add(e), s;
			if (!Oe(e)) {
				var c = h(e);
				if (c !== null) return n.add(e), c;
			}
		}
		if (P(e, ["menu"])) return n.add(e), "";
		if (o || t.isEmbeddedInLabel || t.isReferenced) {
			if (P(e, ["combobox", "listbox"])) {
				n.add(e);
				var u = De(e);
				return u.length === 0 ? M(e) ? e.value : "" : w(u).map(function(e) {
					return g(e, {
						isEmbeddedInLabel: t.isEmbeddedInLabel,
						isReferenced: !1,
						recursion: !0
					});
				}).join(" ");
			}
			if (Te(e, "range")) return n.add(e), e.hasAttribute("aria-valuetext") ? e.getAttribute("aria-valuetext") : e.hasAttribute("aria-valuenow") ? e.getAttribute("aria-valuenow") : e.getAttribute("value") || "";
			if (P(e, ["textbox"])) return n.add(e), Me(e);
		}
		if (Ae(e) || j(e) && t.isReferenced || ke(e) || je(e)) {
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
	return Se(g(e, {
		isEmbeddedInLabel: !1,
		isReferenced: a === "description",
		recursion: !1
	}));
}
// node_modules/.bun/dom-accessibility-api@0.5.16/node_modules/dom-accessibility-api/dist/accessible-description.mjs
function F(e) {
	"@babel/helpers - typeof";
	return F = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, F(e);
}
function Be(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Ve(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Be(Object(n), !0).forEach(function(t) {
			He(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Be(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function He(e, t, n) {
	return t = Ue(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Ue(e) {
	var t = We(e, "string");
	return F(t) === "symbol" ? t : String(t);
}
function We(e, t) {
	if (F(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (F(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Ge(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, n = N(e, "aria-describedby").map(function(e) {
		return ze(e, Ve(Ve({}, t), {}, { compute: "description" }));
	}).join(" ");
	if (n === "") {
		var r = e.getAttribute("title");
		n = r === null ? "" : r;
	}
	return n;
}
// node_modules/.bun/dom-accessibility-api@0.5.16/node_modules/dom-accessibility-api/dist/accessible-name.mjs
function Ke(e) {
	return P(e, [
		"caption",
		"code",
		"deletion",
		"emphasis",
		"generic",
		"insertion",
		"paragraph",
		"presentation",
		"strong",
		"subscript",
		"superscript"
	]);
}
function qe(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
	return Ke(e) ? "" : ze(e, t);
}
// node_modules/.bun/aria-query@5.3.0/node_modules/aria-query/lib/util/iteratorProxy.js
var I = /* @__PURE__ */ n(((e) => {
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
})), Je = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = i;
	var t = n(I());
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
})), Ye = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = n(Je());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function r(e, t) {
		return o(e) || a(e, t) || c(e, t) || i();
	}
	function i() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function a(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r = [], i = !0, a = !1, o, s;
			try {
				for (n = n.call(e); !(i = (o = n.next()).done) && (r.push(o.value), !(t && r.length === t)); i = !0);
			} catch (e) {
				a = !0, s = e;
			} finally {
				try {
					!i && n.return != null && n.return();
				} finally {
					if (a) throw s;
				}
			}
			return r;
		}
	}
	function o(e) {
		if (Array.isArray(e)) return e;
	}
	function s(e, t) {
		var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (!n) {
			if (Array.isArray(e) || (n = c(e)) || t && e && typeof e.length == "number") {
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
		var a = !0, o = !1, s;
		return {
			s: function() {
				n = n.call(e);
			},
			n: function() {
				var e = n.next();
				return a = e.done, e;
			},
			e: function(e) {
				o = !0, s = e;
			},
			f: function() {
				try {
					!a && n.return != null && n.return();
				} finally {
					if (o) throw s;
				}
			}
		};
	}
	function c(e, t) {
		if (e) {
			if (typeof e == "string") return l(e, t);
			var n = Object.prototype.toString.call(e).slice(8, -1);
			if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
			if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return l(e, t);
		}
	}
	function l(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	var u = [
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
	], d = {
		entries: function() {
			return u;
		},
		forEach: function(e) {
			var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = s(u), i;
			try {
				for (n.s(); !(i = n.n()).done;) {
					var a = r(i.value, 2), o = a[0], c = a[1];
					e.call(t, c, o, u);
				}
			} catch (e) {
				n.e(e);
			} finally {
				n.f();
			}
		},
		get: function(e) {
			var t = u.find(function(t) {
				return t[0] === e;
			});
			return t && t[1];
		},
		has: function(e) {
			return !!d.get(e);
		},
		keys: function() {
			return u.map(function(e) {
				return r(e, 1)[0];
			});
		},
		values: function() {
			return u.map(function(e) {
				return r(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(d, d.entries());
})), Xe = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = n(Je());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function r(e, t) {
		return o(e) || a(e, t) || c(e, t) || i();
	}
	function i() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function a(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r = [], i = !0, a = !1, o, s;
			try {
				for (n = n.call(e); !(i = (o = n.next()).done) && (r.push(o.value), !(t && r.length === t)); i = !0);
			} catch (e) {
				a = !0, s = e;
			} finally {
				try {
					!i && n.return != null && n.return();
				} finally {
					if (a) throw s;
				}
			}
			return r;
		}
	}
	function o(e) {
		if (Array.isArray(e)) return e;
	}
	function s(e, t) {
		var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (!n) {
			if (Array.isArray(e) || (n = c(e)) || t && e && typeof e.length == "number") {
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
		var a = !0, o = !1, s;
		return {
			s: function() {
				n = n.call(e);
			},
			n: function() {
				var e = n.next();
				return a = e.done, e;
			},
			e: function(e) {
				o = !0, s = e;
			},
			f: function() {
				try {
					!a && n.return != null && n.return();
				} finally {
					if (o) throw s;
				}
			}
		};
	}
	function c(e, t) {
		if (e) {
			if (typeof e == "string") return l(e, t);
			var n = Object.prototype.toString.call(e).slice(8, -1);
			if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
			if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return l(e, t);
		}
	}
	function l(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	var u = [
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
	], d = {
		entries: function() {
			return u;
		},
		forEach: function(e) {
			var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = s(u), i;
			try {
				for (n.s(); !(i = n.n()).done;) {
					var a = r(i.value, 2), o = a[0], c = a[1];
					e.call(t, c, o, u);
				}
			} catch (e) {
				n.e(e);
			} finally {
				n.f();
			}
		},
		get: function(e) {
			var t = u.find(function(t) {
				return t[0] === e;
			});
			return t && t[1];
		},
		has: function(e) {
			return !!d.get(e);
		},
		keys: function() {
			return u.map(function(e) {
				return r(e, 1)[0];
			});
		},
		values: function() {
			return u.map(function(e) {
				return r(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(d, d.entries());
})), Ze = /* @__PURE__ */ n(((e) => {
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
})), Qe = /* @__PURE__ */ n(((e) => {
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
})), $e = /* @__PURE__ */ n(((e) => {
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
})), et = /* @__PURE__ */ n(((e) => {
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
})), tt = /* @__PURE__ */ n(((e) => {
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
})), nt = /* @__PURE__ */ n(((e) => {
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
})), rt = /* @__PURE__ */ n(((e) => {
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
})), it = /* @__PURE__ */ n(((e) => {
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
})), at = /* @__PURE__ */ n(((e) => {
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
})), ot = /* @__PURE__ */ n(((e) => {
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
})), st = /* @__PURE__ */ n(((e) => {
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
})), ct = /* @__PURE__ */ n(((e) => {
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
})), lt = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = p(Ze()), n = p(Qe()), r = p($e()), i = p(et()), a = p(tt()), o = p(nt()), s = p(rt()), c = p(it()), l = p(at()), u = p(ot()), d = p(st()), f = p(ct());
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
})), ut = /* @__PURE__ */ n(((e) => {
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
})), dt = /* @__PURE__ */ n(((e) => {
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
})), ft = /* @__PURE__ */ n(((e) => {
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
})), pt = /* @__PURE__ */ n(((e) => {
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
})), mt = /* @__PURE__ */ n(((e) => {
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
})), ht = /* @__PURE__ */ n(((e) => {
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
})), gt = /* @__PURE__ */ n(((e) => {
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
})), _t = /* @__PURE__ */ n(((e) => {
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
})), vt = /* @__PURE__ */ n(((e) => {
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
})), yt = /* @__PURE__ */ n(((e) => {
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
})), bt = /* @__PURE__ */ n(((e) => {
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
})), xt = /* @__PURE__ */ n(((e) => {
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
})), St = /* @__PURE__ */ n(((e) => {
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
})), Ct = /* @__PURE__ */ n(((e) => {
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
				concept: { name: "aside" },
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
})), wt = /* @__PURE__ */ n(((e) => {
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
})), Tt = /* @__PURE__ */ n(((e) => {
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
})), Et = /* @__PURE__ */ n(((e) => {
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
})), Dt = /* @__PURE__ */ n(((e) => {
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
})), Ot = /* @__PURE__ */ n(((e) => {
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
})), kt = /* @__PURE__ */ n(((e) => {
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
})), At = /* @__PURE__ */ n(((e) => {
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
})), jt = /* @__PURE__ */ n(((e) => {
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
})), Mt = /* @__PURE__ */ n(((e) => {
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
})), Nt = /* @__PURE__ */ n(((e) => {
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
})), Pt = /* @__PURE__ */ n(((e) => {
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
})), Ft = /* @__PURE__ */ n(((e) => {
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
})), It = /* @__PURE__ */ n(((e) => {
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
})), Lt = /* @__PURE__ */ n(((e) => {
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
})), Rt = /* @__PURE__ */ n(((e) => {
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
})), zt = /* @__PURE__ */ n(((e) => {
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
})), Bt = /* @__PURE__ */ n(((e) => {
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
})), Vt = /* @__PURE__ */ n(((e) => {
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
})), Ht = /* @__PURE__ */ n(((e) => {
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
})), Ut = /* @__PURE__ */ n(((e) => {
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
})), Wt = /* @__PURE__ */ n(((e) => {
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
})), Gt = /* @__PURE__ */ n(((e) => {
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
})), Kt = /* @__PURE__ */ n(((e) => {
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
})), qt = /* @__PURE__ */ n(((e) => {
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
})), Jt = /* @__PURE__ */ n(((e) => {
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
})), Yt = /* @__PURE__ */ n(((e) => {
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
})), Xt = /* @__PURE__ */ n(((e) => {
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
})), Zt = /* @__PURE__ */ n(((e) => {
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
})), Qt = /* @__PURE__ */ n(((e) => {
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
})), $t = /* @__PURE__ */ n(((e) => {
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
})), en = /* @__PURE__ */ n(((e) => {
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
})), tn = /* @__PURE__ */ n(((e) => {
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
})), nn = /* @__PURE__ */ n(((e) => {
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
})), rn = /* @__PURE__ */ n(((e) => {
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
})), an = /* @__PURE__ */ n(((e) => {
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
})), on = /* @__PURE__ */ n(((e) => {
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
})), sn = /* @__PURE__ */ n(((e) => {
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
})), cn = /* @__PURE__ */ n(((e) => {
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
})), ln = /* @__PURE__ */ n(((e) => {
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
})), un = /* @__PURE__ */ n(((e) => {
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
})), dn = /* @__PURE__ */ n(((e) => {
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
})), fn = /* @__PURE__ */ n(((e) => {
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
})), pn = /* @__PURE__ */ n(((e) => {
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
})), mn = /* @__PURE__ */ n(((e) => {
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
})), hn = /* @__PURE__ */ n(((e) => {
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
})), gn = /* @__PURE__ */ n(((e) => {
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
})), _n = /* @__PURE__ */ n(((e) => {
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
})), vn = /* @__PURE__ */ n(((e) => {
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
})), yn = /* @__PURE__ */ n(((e) => {
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
})), bn = /* @__PURE__ */ n(((e) => {
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
})), xn = /* @__PURE__ */ n(((e) => {
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
})), Sn = /* @__PURE__ */ n(((e) => {
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
})), Cn = /* @__PURE__ */ n(((e) => {
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
})), wn = /* @__PURE__ */ n(((e) => {
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
})), Tn = /* @__PURE__ */ n(((e) => {
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
})), En = /* @__PURE__ */ n(((e) => {
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
})), Dn = /* @__PURE__ */ n(((e) => {
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
})), On = /* @__PURE__ */ n(((e) => {
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
})), kn = /* @__PURE__ */ n(((e) => {
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
})), An = /* @__PURE__ */ n(((e) => {
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
})), jn = /* @__PURE__ */ n(((e) => {
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
})), Mn = /* @__PURE__ */ n(((e) => {
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
})), Nn = /* @__PURE__ */ n(((e) => {
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
})), Pn = /* @__PURE__ */ n(((e) => {
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
})), Fn = /* @__PURE__ */ n(((e) => {
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
})), In = /* @__PURE__ */ n(((e) => {
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
})), Ln = /* @__PURE__ */ n(((e) => {
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
})), Rn = /* @__PURE__ */ n(((e) => {
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
})), zn = /* @__PURE__ */ n(((e) => {
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
})), Bn = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = I(ut()), n = I(dt()), r = I(ft()), i = I(pt()), a = I(mt()), o = I(ht()), s = I(gt()), c = I(_t()), l = I(vt()), u = I(yt()), d = I(bt()), f = I(xt()), p = I(St()), m = I(Ct()), h = I(wt()), g = I(Tt()), _ = I(Et()), v = I(Dt()), y = I(Ot()), b = I(kt()), x = I(At()), S = I(jt()), C = I(Mt()), w = I(Nt()), T = I(Pt()), ee = I(Ft()), E = I(It()), D = I(Lt()), te = I(Rt()), ne = I(zt()), re = I(Bt()), O = I(Vt()), k = I(Ht()), ie = I(Ut()), ae = I(Wt()), oe = I(Gt()), se = I(Kt()), ce = I(qt()), le = I(Jt()), A = I(Yt()), j = I(Xt()), ue = I(Zt()), M = I(Qt()), de = I($t()), fe = I(en()), pe = I(tn()), me = I(nn()), he = I(rn()), ge = I(an()), _e = I(on()), ve = I(sn()), ye = I(cn()), be = I(ln()), xe = I(un()), N = I(dn()), P = I(fn()), Se = I(pn()), Ce = I(mn()), we = I(hn()), Te = I(gn()), Ee = I(_n()), De = I(vn()), Oe = I(yn()), ke = I(bn()), Ae = I(xn()), je = I(Sn()), Me = I(Cn()), Ne = I(wn()), Pe = I(Tn()), Fe = I(En()), Ie = I(Dn()), Le = I(On()), Re = I(kn()), ze = I(An()), F = I(jn()), Be = I(Mn()), Ve = I(Nn()), He = I(Pn()), Ue = I(Fn()), We = I(In()), Ge = I(Ln()), Ke = I(Rn()), qe = I(zn());
	function I(e) {
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
		["feed", S.default],
		["figure", C.default],
		["form", w.default],
		["generic", T.default],
		["grid", ee.default],
		["gridcell", E.default],
		["group", D.default],
		["heading", te.default],
		["img", ne.default],
		["insertion", re.default],
		["link", O.default],
		["list", k.default],
		["listbox", ie.default],
		["listitem", ae.default],
		["log", oe.default],
		["main", se.default],
		["mark", ce.default],
		["marquee", le.default],
		["math", A.default],
		["menu", j.default],
		["menubar", ue.default],
		["menuitem", M.default],
		["menuitemcheckbox", de.default],
		["menuitemradio", fe.default],
		["meter", pe.default],
		["navigation", me.default],
		["none", he.default],
		["note", ge.default],
		["option", _e.default],
		["paragraph", ve.default],
		["presentation", ye.default],
		["progressbar", be.default],
		["radio", xe.default],
		["radiogroup", N.default],
		["region", P.default],
		["row", Se.default],
		["rowgroup", Ce.default],
		["rowheader", we.default],
		["scrollbar", Te.default],
		["search", Ee.default],
		["searchbox", De.default],
		["separator", Oe.default],
		["slider", ke.default],
		["spinbutton", Ae.default],
		["status", je.default],
		["strong", Me.default],
		["subscript", Ne.default],
		["superscript", Pe.default],
		["switch", Fe.default],
		["tab", Ie.default],
		["table", Le.default],
		["tablist", Re.default],
		["tabpanel", ze.default],
		["term", F.default],
		["textbox", Be.default],
		["time", Ve.default],
		["timer", He.default],
		["toolbar", Ue.default],
		["tooltip", We.default],
		["tree", Ge.default],
		["treegrid", Ke.default],
		["treeitem", qe.default]
	];
})), Vn = /* @__PURE__ */ n(((e) => {
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
})), Hn = /* @__PURE__ */ n(((e) => {
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
})), Un = /* @__PURE__ */ n(((e) => {
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
})), Wn = /* @__PURE__ */ n(((e) => {
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
})), Gn = /* @__PURE__ */ n(((e) => {
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
})), Kn = /* @__PURE__ */ n(((e) => {
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
})), qn = /* @__PURE__ */ n(((e) => {
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
})), Jn = /* @__PURE__ */ n(((e) => {
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
})), Yn = /* @__PURE__ */ n(((e) => {
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
})), Xn = /* @__PURE__ */ n(((e) => {
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
})), Zn = /* @__PURE__ */ n(((e) => {
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
})), Qn = /* @__PURE__ */ n(((e) => {
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
})), $n = /* @__PURE__ */ n(((e) => {
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
})), er = /* @__PURE__ */ n(((e) => {
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
})), tr = /* @__PURE__ */ n(((e) => {
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
})), nr = /* @__PURE__ */ n(((e) => {
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
})), rr = /* @__PURE__ */ n(((e) => {
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
})), ir = /* @__PURE__ */ n(((e) => {
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
})), ar = /* @__PURE__ */ n(((e) => {
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
})), or = /* @__PURE__ */ n(((e) => {
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
})), sr = /* @__PURE__ */ n(((e) => {
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
})), cr = /* @__PURE__ */ n(((e) => {
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
})), lr = /* @__PURE__ */ n(((e) => {
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
})), ur = /* @__PURE__ */ n(((e) => {
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
})), dr = /* @__PURE__ */ n(((e) => {
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
})), fr = /* @__PURE__ */ n(((e) => {
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
})), pr = /* @__PURE__ */ n(((e) => {
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
})), mr = /* @__PURE__ */ n(((e) => {
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
})), hr = /* @__PURE__ */ n(((e) => {
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
})), gr = /* @__PURE__ */ n(((e) => {
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
})), _r = /* @__PURE__ */ n(((e) => {
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
})), vr = /* @__PURE__ */ n(((e) => {
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
})), yr = /* @__PURE__ */ n(((e) => {
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
})), br = /* @__PURE__ */ n(((e) => {
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
})), xr = /* @__PURE__ */ n(((e) => {
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
})), Sr = /* @__PURE__ */ n(((e) => {
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
})), Cr = /* @__PURE__ */ n(((e) => {
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
})), wr = /* @__PURE__ */ n(((e) => {
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
})), Tr = /* @__PURE__ */ n(((e) => {
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
})), Er = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = A(Vn()), n = A(Hn()), r = A(Un()), i = A(Wn()), a = A(Gn()), o = A(Kn()), s = A(qn()), c = A(Jn()), l = A(Yn()), u = A(Xn()), d = A(Zn()), f = A(Qn()), p = A($n()), m = A(er()), h = A(tr()), g = A(nr()), _ = A(rr()), v = A(ir()), y = A(ar()), b = A(or()), x = A(sr()), S = A(cr()), C = A(lr()), w = A(ur()), T = A(dr()), ee = A(fr()), E = A(pr()), D = A(mr()), te = A(hr()), ne = A(gr()), re = A(_r()), O = A(vr()), k = A(yr()), ie = A(br()), ae = A(xr()), oe = A(Sr()), se = A(Cr()), ce = A(wr()), le = A(Tr());
	function A(e) {
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
		["doc-footnote", S.default],
		["doc-foreword", C.default],
		["doc-glossary", w.default],
		["doc-glossref", T.default],
		["doc-index", ee.default],
		["doc-introduction", E.default],
		["doc-noteref", D.default],
		["doc-notice", te.default],
		["doc-pagebreak", ne.default],
		["doc-pagelist", re.default],
		["doc-part", O.default],
		["doc-preface", k.default],
		["doc-prologue", ie.default],
		["doc-pullquote", ae.default],
		["doc-qna", oe.default],
		["doc-subtitle", se.default],
		["doc-tip", ce.default],
		["doc-toc", le.default]
	];
})), Dr = /* @__PURE__ */ n(((e) => {
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
})), Or = /* @__PURE__ */ n(((e) => {
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
})), kr = /* @__PURE__ */ n(((e) => {
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
})), Ar = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = i(Dr()), n = i(Or()), r = i(kr());
	function i(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["graphics-document", t.default],
		["graphics-object", n.default],
		["graphics-symbol", r.default]
	];
})), jr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = o(lt()), n = o(Bn()), r = o(Er()), i = o(Ar()), a = o(Je());
	function o(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function s(e, t, n) {
		return t in e ? Object.defineProperty(e, t, {
			value: n,
			enumerable: !0,
			configurable: !0,
			writable: !0
		}) : e[t] = n, e;
	}
	function c(e, t) {
		var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (!n) {
			if (Array.isArray(e) || (n = d(e)) || t && e && typeof e.length == "number") {
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
		var a = !0, o = !1, s;
		return {
			s: function() {
				n = n.call(e);
			},
			n: function() {
				var e = n.next();
				return a = e.done, e;
			},
			e: function(e) {
				o = !0, s = e;
			},
			f: function() {
				try {
					!a && n.return != null && n.return();
				} finally {
					if (o) throw s;
				}
			}
		};
	}
	function l(e, t) {
		return m(e) || p(e, t) || d(e, t) || u();
	}
	function u() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function d(e, t) {
		if (e) {
			if (typeof e == "string") return f(e, t);
			var n = Object.prototype.toString.call(e).slice(8, -1);
			if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
			if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return f(e, t);
		}
	}
	function f(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function p(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r = [], i = !0, a = !1, o, s;
			try {
				for (n = n.call(e); !(i = (o = n.next()).done) && (r.push(o.value), !(t && r.length === t)); i = !0);
			} catch (e) {
				a = !0, s = e;
			} finally {
				try {
					!i && n.return != null && n.return();
				} finally {
					if (a) throw s;
				}
			}
			return r;
		}
	}
	function m(e) {
		if (Array.isArray(e)) return e;
	}
	var h = [].concat(t.default, n.default, r.default, i.default);
	h.forEach(function(e) {
		var t = l(e, 2)[1], n = c(t.superClass), r;
		try {
			for (n.s(); !(r = n.n()).done;) {
				var i = r.value, a = c(i), o;
				try {
					var u = function() {
						var e = o.value, n = h.find(function(t) {
							return l(t, 1)[0] === e;
						});
						if (n) for (var r = n[1], i = 0, a = Object.keys(r.props); i < a.length; i++) {
							var c = a[i];
							Object.prototype.hasOwnProperty.call(t.props, c) || Object.assign(t.props, s({}, c, r.props[c]));
						}
					};
					for (a.s(); !(o = a.n()).done;) u();
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
	var g = {
		entries: function() {
			return h;
		},
		forEach: function(e) {
			var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = c(h), r;
			try {
				for (n.s(); !(r = n.n()).done;) {
					var i = l(r.value, 2), a = i[0], o = i[1];
					e.call(t, o, a, h);
				}
			} catch (e) {
				n.e(e);
			} finally {
				n.f();
			}
		},
		get: function(e) {
			var t = h.find(function(t) {
				return t[0] === e;
			});
			return t && t[1];
		},
		has: function(e) {
			return !!g.get(e);
		},
		keys: function() {
			return h.map(function(e) {
				return l(e, 1)[0];
			});
		},
		values: function() {
			return h.map(function(e) {
				return l(e, 2)[1];
			});
		}
	};
	e.default = (0, a.default)(g, g.entries());
})), Mr = /* @__PURE__ */ n(((e) => {
	var t = Object.prototype.hasOwnProperty;
	function n(e, r) {
		var i, a;
		if (e === r) return !0;
		if (e && r && (i = e.constructor) === r.constructor) {
			if (i === Date) return e.getTime() === r.getTime();
			if (i === RegExp) return e.toString() === r.toString();
			if (i === Array) {
				if ((a = e.length) === r.length) for (; a-- && n(e[a], r[a]););
				return a === -1;
			}
			if (!i || typeof e == "object") {
				for (i in a = 0, e) if (t.call(e, i) && ++a && !t.call(r, i) || !(i in r) || !n(e[i], r[i])) return !1;
				return Object.keys(r).length === a;
			}
		}
		return e !== e && r !== r;
	}
	e.dequal = n;
})), Nr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = Mr(), n = i(Je()), r = i(jr());
	function i(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function a(e, t) {
		return c(e) || s(e, t) || u(e, t) || o();
	}
	function o() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function s(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r = [], i = !0, a = !1, o, s;
			try {
				for (n = n.call(e); !(i = (o = n.next()).done) && (r.push(o.value), !(t && r.length === t)); i = !0);
			} catch (e) {
				a = !0, s = e;
			} finally {
				try {
					!i && n.return != null && n.return();
				} finally {
					if (a) throw s;
				}
			}
			return r;
		}
	}
	function c(e) {
		if (Array.isArray(e)) return e;
	}
	function l(e, t) {
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
		var a = !0, o = !1, s;
		return {
			s: function() {
				n = n.call(e);
			},
			n: function() {
				var e = n.next();
				return a = e.done, e;
			},
			e: function(e) {
				o = !0, s = e;
			},
			f: function() {
				try {
					!a && n.return != null && n.return();
				} finally {
					if (o) throw s;
				}
			}
		};
	}
	function u(e, t) {
		if (e) {
			if (typeof e == "string") return d(e, t);
			var n = Object.prototype.toString.call(e).slice(8, -1);
			if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
			if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return d(e, t);
		}
	}
	function d(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	for (var f = [], p = r.default.keys(), m = 0; m < p.length; m++) {
		var h = p[m], g = r.default.get(h);
		if (g) for (var _ = [].concat(g.baseConcepts, g.relatedConcepts), v = 0; v < _.length; v++) {
			var y = _[v];
			y.module === "HTML" && (function() {
				var e = y.concept;
				if (e) {
					for (var n = f.find(function(n) {
						return (0, t.dequal)(n, e);
					}), r = n ? n[1] : [], i = !0, a = 0; a < r.length; a++) if (r[a] === h) {
						i = !1;
						break;
					}
					i && r.push(h), f.push([e, r]);
				}
			})();
		}
	}
	var b = {
		entries: function() {
			return f;
		},
		forEach: function(e) {
			var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = l(f), r;
			try {
				for (n.s(); !(r = n.n()).done;) {
					var i = a(r.value, 2), o = i[0], s = i[1];
					e.call(t, s, o, f);
				}
			} catch (e) {
				n.e(e);
			} finally {
				n.f();
			}
		},
		get: function(e) {
			var n = f.find(function(n) {
				return e.name === n[0].name && (0, t.dequal)(e.attributes, n[0].attributes);
			});
			return n && n[1];
		},
		has: function(e) {
			return !!b.get(e);
		},
		keys: function() {
			return f.map(function(e) {
				return a(e, 1)[0];
			});
		},
		values: function() {
			return f.map(function(e) {
				return a(e, 2)[1];
			});
		}
	};
	e.default = (0, n.default)(b, b.entries());
})), Pr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = r(Je()), n = r(jr());
	function r(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function i(e, t) {
		return s(e) || o(e, t) || l(e, t) || a();
	}
	function a() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function o(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r = [], i = !0, a = !1, o, s;
			try {
				for (n = n.call(e); !(i = (o = n.next()).done) && (r.push(o.value), !(t && r.length === t)); i = !0);
			} catch (e) {
				a = !0, s = e;
			} finally {
				try {
					!i && n.return != null && n.return();
				} finally {
					if (a) throw s;
				}
			}
			return r;
		}
	}
	function s(e) {
		if (Array.isArray(e)) return e;
	}
	function c(e, t) {
		var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (!n) {
			if (Array.isArray(e) || (n = l(e)) || t && e && typeof e.length == "number") {
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
		var a = !0, o = !1, s;
		return {
			s: function() {
				n = n.call(e);
			},
			n: function() {
				var e = n.next();
				return a = e.done, e;
			},
			e: function(e) {
				o = !0, s = e;
			},
			f: function() {
				try {
					!a && n.return != null && n.return();
				} finally {
					if (o) throw s;
				}
			}
		};
	}
	function l(e, t) {
		if (e) {
			if (typeof e == "string") return u(e, t);
			var n = Object.prototype.toString.call(e).slice(8, -1);
			if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
			if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return u(e, t);
		}
	}
	function u(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	for (var d = [], f = n.default.keys(), p = 0; p < f.length; p++) {
		var m = f[p], h = n.default.get(m), g = [];
		if (h) {
			for (var _ = [].concat(h.baseConcepts, h.relatedConcepts), v = 0; v < _.length; v++) {
				var y = _[v];
				if (y.module === "HTML") {
					var b = y.concept;
					b != null && g.push(b);
				}
			}
			g.length > 0 && d.push([m, g]);
		}
	}
	var x = {
		entries: function() {
			return d;
		},
		forEach: function(e) {
			var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = c(d), r;
			try {
				for (n.s(); !(r = n.n()).done;) {
					var a = i(r.value, 2), o = a[0], s = a[1];
					e.call(t, s, o, d);
				}
			} catch (e) {
				n.e(e);
			} finally {
				n.f();
			}
		},
		get: function(e) {
			var t = d.find(function(t) {
				return t[0] === e;
			});
			return t && t[1];
		},
		has: function(e) {
			return !!x.get(e);
		},
		keys: function() {
			return d.map(function(e) {
				return i(e, 1)[0];
			});
		},
		values: function() {
			return d.map(function(e) {
				return i(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(x, x.entries());
})), Fr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.roles = e.roleElements = e.elementRoles = e.dom = e.aria = void 0;
	var t = o(Ye()), n = o(Xe()), r = o(jr()), i = o(Nr()), a = o(Pr());
	function o(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.aria = t.default, e.dom = n.default, e.roles = r.default, e.elementRoles = i.default, e.roleElements = a.default;
})), Ir = /* @__PURE__ */ n(((e, t) => {
	var n = (function() {
		var e = String.fromCharCode, t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$", r = {};
		function i(e, t) {
			if (!r[e]) {
				r[e] = {};
				for (var n = 0; n < e.length; n++) r[e][e.charAt(n)] = n;
			}
			return r[e][t];
		}
		var a = {
			compressToBase64: function(e) {
				if (e == null) return "";
				var n = a._compress(e, 6, function(e) {
					return t.charAt(e);
				});
				switch (n.length % 4) {
					default:
					case 0: return n;
					case 1: return n + "===";
					case 2: return n + "==";
					case 3: return n + "=";
				}
			},
			decompressFromBase64: function(e) {
				return e == null ? "" : e == "" ? null : a._decompress(e.length, 32, function(n) {
					return i(t, e.charAt(n));
				});
			},
			compressToUTF16: function(t) {
				return t == null ? "" : a._compress(t, 15, function(t) {
					return e(t + 32);
				}) + " ";
			},
			decompressFromUTF16: function(e) {
				return e == null ? "" : e == "" ? null : a._decompress(e.length, 16384, function(t) {
					return e.charCodeAt(t) - 32;
				});
			},
			compressToUint8Array: function(e) {
				for (var t = a.compress(e), n = new Uint8Array(t.length * 2), r = 0, i = t.length; r < i; r++) {
					var o = t.charCodeAt(r);
					n[r * 2] = o >>> 8, n[r * 2 + 1] = o % 256;
				}
				return n;
			},
			decompressFromUint8Array: function(t) {
				if (t == null) return a.decompress(t);
				for (var n = Array(t.length / 2), r = 0, i = n.length; r < i; r++) n[r] = t[r * 2] * 256 + t[r * 2 + 1];
				var o = [];
				return n.forEach(function(t) {
					o.push(e(t));
				}), a.decompress(o.join(""));
			},
			compressToEncodedURIComponent: function(e) {
				return e == null ? "" : a._compress(e, 6, function(e) {
					return n.charAt(e);
				});
			},
			decompressFromEncodedURIComponent: function(e) {
				return e == null ? "" : e == "" ? null : (e = e.replace(/ /g, "+"), a._decompress(e.length, 32, function(t) {
					return i(n, e.charAt(t));
				}));
			},
			compress: function(t) {
				return a._compress(t, 16, function(t) {
					return e(t);
				});
			},
			_compress: function(e, t, n) {
				if (e == null) return "";
				for (var r, i, a = {}, o = {}, s = "", c = "", l = "", u = 2, d = 3, f = 2, p = [], m = 0, h = 0, g = 0; g < e.length; g += 1) if (s = e.charAt(g), Object.prototype.hasOwnProperty.call(a, s) || (a[s] = d++, o[s] = !0), c = l + s, Object.prototype.hasOwnProperty.call(a, c)) l = c;
				else {
					if (Object.prototype.hasOwnProperty.call(o, l)) {
						if (l.charCodeAt(0) < 256) {
							for (r = 0; r < f; r++) m <<= 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++;
							for (i = l.charCodeAt(0), r = 0; r < 8; r++) m = m << 1 | i & 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i >>= 1;
						} else {
							for (i = 1, r = 0; r < f; r++) m = m << 1 | i, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i = 0;
							for (i = l.charCodeAt(0), r = 0; r < 16; r++) m = m << 1 | i & 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i >>= 1;
						}
						u--, u == 0 && (u = 2 ** f, f++), delete o[l];
					} else for (i = a[l], r = 0; r < f; r++) m = m << 1 | i & 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i >>= 1;
					u--, u == 0 && (u = 2 ** f, f++), a[c] = d++, l = String(s);
				}
				if (l !== "") {
					if (Object.prototype.hasOwnProperty.call(o, l)) {
						if (l.charCodeAt(0) < 256) {
							for (r = 0; r < f; r++) m <<= 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++;
							for (i = l.charCodeAt(0), r = 0; r < 8; r++) m = m << 1 | i & 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i >>= 1;
						} else {
							for (i = 1, r = 0; r < f; r++) m = m << 1 | i, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i = 0;
							for (i = l.charCodeAt(0), r = 0; r < 16; r++) m = m << 1 | i & 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i >>= 1;
						}
						u--, u == 0 && (u = 2 ** f, f++), delete o[l];
					} else for (i = a[l], r = 0; r < f; r++) m = m << 1 | i & 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i >>= 1;
					u--, u == 0 && (u = 2 ** f, f++);
				}
				for (i = 2, r = 0; r < f; r++) m = m << 1 | i & 1, h == t - 1 ? (h = 0, p.push(n(m)), m = 0) : h++, i >>= 1;
				for (;;) {
					if (m <<= 1, h == t - 1) {
						p.push(n(m));
						break;
					}
					h++;
				}
				return p.join("");
			},
			decompress: function(e) {
				return e == null ? "" : e == "" ? null : a._decompress(e.length, 32768, function(t) {
					return e.charCodeAt(t);
				});
			},
			_decompress: function(t, n, r) {
				var i = [], a = 4, o = 4, s = 3, c = "", l = [], u, d, f, p, m, h, g, _ = {
					val: r(0),
					position: n,
					index: 1
				};
				for (u = 0; u < 3; u += 1) i[u] = u;
				for (f = 0, m = 4, h = 1; h != m;) p = _.val & _.position, _.position >>= 1, _.position == 0 && (_.position = n, _.val = r(_.index++)), f |= +(p > 0) * h, h <<= 1;
				switch (f) {
					case 0:
						for (f = 0, m = 256, h = 1; h != m;) p = _.val & _.position, _.position >>= 1, _.position == 0 && (_.position = n, _.val = r(_.index++)), f |= +(p > 0) * h, h <<= 1;
						g = e(f);
						break;
					case 1:
						for (f = 0, m = 2 ** 16, h = 1; h != m;) p = _.val & _.position, _.position >>= 1, _.position == 0 && (_.position = n, _.val = r(_.index++)), f |= +(p > 0) * h, h <<= 1;
						g = e(f);
						break;
					case 2: return "";
				}
				for (i[3] = g, d = g, l.push(g);;) {
					if (_.index > t) return "";
					for (f = 0, m = 2 ** s, h = 1; h != m;) p = _.val & _.position, _.position >>= 1, _.position == 0 && (_.position = n, _.val = r(_.index++)), f |= +(p > 0) * h, h <<= 1;
					switch (g = f) {
						case 0:
							for (f = 0, m = 256, h = 1; h != m;) p = _.val & _.position, _.position >>= 1, _.position == 0 && (_.position = n, _.val = r(_.index++)), f |= +(p > 0) * h, h <<= 1;
							i[o++] = e(f), g = o - 1, a--;
							break;
						case 1:
							for (f = 0, m = 2 ** 16, h = 1; h != m;) p = _.val & _.position, _.position >>= 1, _.position == 0 && (_.position = n, _.val = r(_.index++)), f |= +(p > 0) * h, h <<= 1;
							i[o++] = e(f), g = o - 1, a--;
							break;
						case 2: return l.join("");
					}
					if (a == 0 && (a = 2 ** s, s++), i[g]) c = i[g];
					else if (g === o) c = d + d.charAt(0);
					else return null;
					l.push(c), i[o++] = d + c.charAt(0), a--, d = c, a == 0 && (a = 2 ** s, s++);
				}
			}
		};
		return a;
	})();
	typeof define == "function" && define.amd ? define(function() {
		return n;
	}) : t !== void 0 && t != null ? t.exports = n : typeof angular < "u" && angular != null && angular.module("LZString", []).factory("LZString", function() {
		return n;
	});
})), Lr = /* @__PURE__ */ t({
	buildQueries: () => Z,
	configure: () => xi,
	createEvent: () => Go,
	findAllByAltText: () => ro,
	findAllByDisplayValue: () => qa,
	findAllByLabelText: () => _a,
	findAllByPlaceholderText: () => ka,
	findAllByRole: () => To,
	findAllByTestId: () => Fo,
	findAllByText: () => Ra,
	findAllByTitle: () => mo,
	findByAltText: () => io,
	findByDisplayValue: () => Ja,
	findByLabelText: () => va,
	findByPlaceholderText: () => Aa,
	findByRole: () => Eo,
	findByTestId: () => Io,
	findByText: () => za,
	findByTitle: () => ho,
	fireEvent: () => Wo,
	getAllByAltText: () => to,
	getAllByDisplayValue: () => Ga,
	getAllByLabelText: () => ya,
	getAllByPlaceholderText: () => Da,
	getAllByRole: () => Co,
	getAllByTestId: () => No,
	getAllByText: () => Ia,
	getAllByTitle: () => fo,
	getByAltText: () => no,
	getByDisplayValue: () => Ka,
	getByLabelText: () => ba,
	getByPlaceholderText: () => Oa,
	getByRole: () => wo,
	getByTestId: () => Po,
	getByText: () => La,
	getByTitle: () => po,
	getConfig: () => B,
	getDefaultNormalizer: () => ki,
	getElementError: () => aa,
	getMultipleElementsFoundError: () => oa,
	getNodeText: () => ji,
	getQueriesForElement: () => Ro,
	getRoles: () => Li,
	getSuggestedQuery: () => ta,
	isInaccessible: () => Pi,
	logDOM: () => yi,
	logRoles: () => zi,
	makeFindQuery: () => J,
	makeGetAllQuery: () => la,
	makeSingleQuery: () => q,
	prettyDOM: () => vi,
	prettyFormat: () => v,
	queries: () => Lo,
	queryAllByAltText: () => $a,
	queryAllByAttribute: () => K,
	queryAllByDisplayValue: () => Ua,
	queryAllByLabelText: () => xa,
	queryAllByPlaceholderText: () => Ta,
	queryAllByRole: () => xo,
	queryAllByTestId: () => jo,
	queryAllByText: () => Pa,
	queryAllByTitle: () => lo,
	queryByAltText: () => eo,
	queryByAttribute: () => sa,
	queryByDisplayValue: () => Wa,
	queryByLabelText: () => ha,
	queryByPlaceholderText: () => Ea,
	queryByRole: () => So,
	queryByTestId: () => Mo,
	queryByText: () => Fa,
	queryByTitle: () => uo,
	queryHelpers: () => ua,
	screen: () => Zo,
	waitFor: () => ia,
	waitForElementToBeRemoved: () => Vo,
	within: () => Ro,
	wrapAllByQueryWithSuggestion: () => X,
	wrapSingleQueryWithSuggestion: () => Y
}), L = Fr(), Rr = /* @__PURE__ */ e(Ir());
/* istanbul ignore file */
function zr(e) {
	return e.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var Br = (e, t, n, r, i, a, o) => {
	let s = r + n.indent, c = n.colors;
	return e.map((e) => {
		let l = t[e], u = o(l, n, s, i, a);
		return typeof l != "string" && (u.indexOf("\n") !== -1 && (u = n.spacingOuter + s + u + n.spacingOuter + r), u = "{" + u + "}"), n.spacingInner + r + c.prop.open + e + c.prop.close + "=" + c.value.open + u + c.value.close;
	}).join("");
}, Vr = 3, Hr = (e, t, n, r, i, a) => e.map((e) => {
	let o = typeof e == "string" ? Ur(e, t) : a(e, t, n, r, i);
	return o === "" && typeof e == "object" && e && e.nodeType !== Vr ? "" : t.spacingOuter + n + o;
}).join(""), Ur = (e, t) => {
	let n = t.colors.content;
	return n.open + zr(e) + n.close;
}, Wr = (e, t) => {
	let n = t.colors.comment;
	return n.open + "<!--" + zr(e) + "-->" + n.close;
}, Gr = (e, t, n, r, i) => {
	let a = r.colors.tag;
	return a.open + "<" + e + (t && a.close + t + r.spacingOuter + i + a.open) + (n ? ">" + a.close + n + r.spacingOuter + i + a.open + "</" + e : (t && !r.min ? "" : " ") + "/") + ">" + a.close;
}, Kr = (e, t) => {
	let n = t.colors.tag;
	return n.open + "<" + e + n.close + " …" + n.open + " />" + n.close;
}, qr = 1, Jr = 3, Yr = 8, Xr = 11, Zr = /^((HTML|SVG)\w*)?Element$/, Qr = (e) => {
	let { tagName: t } = e;
	return !!(typeof t == "string" && t.includes("-") || typeof e.hasAttribute == "function" && e.hasAttribute("is"));
}, $r = (e) => {
	let t = e.constructor.name, { nodeType: n } = e;
	return n === qr && (Zr.test(t) || Qr(e)) || n === Jr && t === "Text" || n === Yr && t === "Comment" || n === Xr && t === "DocumentFragment";
};
function ei(e) {
	return e.nodeType === Jr;
}
function ti(e) {
	return e.nodeType === Yr;
}
function ni(e) {
	return e.nodeType === Xr;
}
function ri(e) {
	return {
		test: (e) => {
			var t;
			return ((e == null || (t = e.constructor) == null ? void 0 : t.name) || Qr(e)) && $r(e);
		},
		serialize: (t, n, r, i, a, o) => {
			if (ei(t)) return Ur(t.data, n);
			if (ti(t)) return Wr(t.data, n);
			let s = ni(t) ? "DocumentFragment" : t.tagName.toLowerCase();
			return ++i > n.maxDepth ? Kr(s, n) : Gr(s, Br(ni(t) ? [] : Array.from(t.attributes).map((e) => e.name).sort(), ni(t) ? {} : Array.from(t.attributes).reduce((e, t) => (e[t.name] = t.value, e), {}), n, r + n.indent, i, a, o), Hr(Array.prototype.slice.call(t.childNodes || t.children).filter(e), n, r + n.indent, i, a, o), n, r);
		}
	};
}
var ii = null, ai = null, oi = null;
try {
	let e = module && module.require;
	ai = e.call(module, "fs").readFileSync, oi = e.call(module, "@babel/code-frame").codeFrameColumns, ii = e.call(module, "picocolors");
} catch {}
function si(e) {
	let t = e.indexOf("(") + 1, n = e.indexOf(")"), r = e.slice(t, n), i = r.split(":"), [a, o, s] = [
		i[0],
		parseInt(i[1], 10),
		parseInt(i[2], 10)
	], c = "";
	try {
		c = ai(a, "utf-8");
	} catch {
		return "";
	}
	let l = oi(c, { start: {
		line: o,
		column: s
	} }, {
		highlightCode: !0,
		linesBelow: 0
	});
	return ii.dim(r) + "\n" + l + "\n";
}
function ci() {
	return !ai || !oi ? "" : si((/* @__PURE__ */ Error()).stack.split("\n").slice(1).find((e) => !e.includes("node_modules/")));
}
var li = 3;
function ui() {
	// istanbul ignore next
	return typeof jest < "u" && jest !== null ? setTimeout._isMockFunction === !0 || Object.prototype.hasOwnProperty.call(setTimeout, "clock") : !1;
}
function di() {
	/* istanbul ignore if */
	if (typeof window > "u") throw Error("Could not find default container");
	return window.document;
}
function fi(e) {
	if (e.defaultView) return e.defaultView;
	if (e.ownerDocument && e.ownerDocument.defaultView) return e.ownerDocument.defaultView;
	if (e.window) return e.window;
	throw e.ownerDocument && e.ownerDocument.defaultView === null ? Error("It looks like the window object is not available for the provided node.") : e.then instanceof Function ? Error("It looks like you passed a Promise object instead of a DOM node. Did you do something like `fireEvent.click(screen.findBy...` when you meant to use a `getBy` query `fireEvent.click(screen.getBy...`, or await the findBy query `fireEvent.click(await screen.findBy...`?") : Array.isArray(e) ? Error("It looks like you passed an Array instead of a DOM node. Did you do something like `fireEvent.click(screen.getAllBy...` when you meant to use a `getBy` query `fireEvent.click(screen.getBy...`?") : typeof e.debug == "function" && typeof e.logTestingPlaygroundURL == "function" ? Error("It looks like you passed a `screen` object. Did you do something like `fireEvent.click(screen, ...` when you meant to use a query, e.g. `fireEvent.click(screen.getBy..., `?") : Error("The given node is not an Element, the node type is: " + typeof e + ".");
}
function R(e) {
	if (!e || typeof e.querySelector != "function" || typeof e.querySelectorAll != "function") throw TypeError("Expected container to be an Element, a Document or a DocumentFragment but got " + t(e) + ".");
	function t(e) {
		return typeof e == "object" ? e === null ? "null" : e.constructor.name : typeof e;
	}
}
var pi = () => {
	if (typeof process > "u") return !1;
	let e;
	try {
		let t = process.env?.COLORS;
		t && (e = JSON.parse(t));
	} catch {}
	return typeof e == "boolean" ? e : process.versions !== void 0 && process.versions.node !== void 0;
}, { DOMCollection: mi } = v.plugins, hi = 1, gi = 8;
function _i(e) {
	return e.nodeType !== gi && (e.nodeType !== hi || !e.matches(B().defaultIgnore));
}
function vi(e, t, n) {
	if (n === void 0 && (n = {}), e ||= di().body, typeof t != "number" && (t = typeof process < "u" && process.env !== void 0 && process.env.DEBUG_PRINT_LIMIT || 7e3), t === 0) return "";
	e.documentElement && (e = e.documentElement);
	let r = typeof e;
	if (r === "object" ? r = e.constructor.name : e = {}, !("outerHTML" in e)) throw TypeError("Expected an element or document but got " + r);
	let { filterNode: i = _i, ...a } = n, o = v.format(e, {
		plugins: [ri(i), mi],
		printFunctionName: !1,
		highlight: pi(),
		...a
	});
	return t !== void 0 && e.outerHTML.length > t ? o.slice(0, t) + "..." : o;
}
var yi = function() {
	let e = ci();
	console.log(e ? vi(...arguments) + "\n\n" + e : vi(...arguments));
}, z = {
	testIdAttribute: "data-testid",
	asyncUtilTimeout: 1e3,
	asyncWrapper: (e) => e(),
	unstable_advanceTimersWrapper: (e) => e(),
	eventWrapper: (e) => e(),
	defaultHidden: !1,
	defaultIgnore: "script, style",
	showOriginalStackTrace: !1,
	throwSuggestions: !1,
	getElementError(e, t) {
		let n = vi(t), r = Error([e, "Ignored nodes: comments, " + z.defaultIgnore + "\n" + n].filter(Boolean).join("\n\n"));
		return r.name = "TestingLibraryElementError", r;
	},
	_disableExpensiveErrorDiagnostics: !1,
	computedStyleSupportsPseudoElements: !1
};
function bi(e) {
	try {
		return z._disableExpensiveErrorDiagnostics = !0, e();
	} finally {
		z._disableExpensiveErrorDiagnostics = !1;
	}
}
function xi(e) {
	typeof e == "function" && (e = e(z)), z = {
		...z,
		...e
	};
}
function B() {
	return z;
}
var Si = [
	"button",
	"meter",
	"output",
	"progress",
	"select",
	"textarea",
	"input"
];
function Ci(e) {
	return Si.includes(e.nodeName.toLowerCase()) ? "" : e.nodeType === li ? e.textContent : Array.from(e.childNodes).map((e) => Ci(e)).join("");
}
function wi(e) {
	let t;
	return t = e.tagName.toLowerCase() === "label" ? Ci(e) : e.value || e.textContent, t;
}
function Ti(e) {
	if (e.labels !== void 0) return e.labels ?? [];
	if (!Ei(e)) return [];
	let t = e.ownerDocument.querySelectorAll("label");
	return Array.from(t).filter((t) => t.control === e);
}
function Ei(e) {
	return /BUTTON|METER|OUTPUT|PROGRESS|SELECT|TEXTAREA/.test(e.tagName) || e.tagName === "INPUT" && e.getAttribute("type") !== "hidden";
}
function Di(e, t, n) {
	let { selector: r = "*" } = n === void 0 ? {} : n, i = t.getAttribute("aria-labelledby"), a = i ? i.split(" ") : [];
	return a.length ? a.map((t) => {
		let n = e.querySelector("[id=\"" + t + "\"]");
		return n ? {
			content: wi(n),
			formControl: null
		} : {
			content: "",
			formControl: null
		};
	}) : Array.from(Ti(t)).map((e) => ({
		content: wi(e),
		formControl: Array.from(e.querySelectorAll("button, input, meter, output, progress, select, textarea")).filter((e) => e.matches(r))[0]
	}));
}
function Oi(e) {
	if (e == null) throw Error("It looks like " + e + " was passed instead of a matcher. Did you do something like getByText(" + e + ")?");
}
function V(e, t, n, r) {
	if (typeof e != "string") return !1;
	Oi(n);
	let i = r(e);
	return typeof n == "string" || typeof n == "number" ? i.toLowerCase().includes(n.toString().toLowerCase()) : typeof n == "function" ? n(i, t) : Ai(n, i);
}
function H(e, t, n, r) {
	if (typeof e != "string") return !1;
	Oi(n);
	let i = r(e);
	return n instanceof Function ? n(i, t) : n instanceof RegExp ? Ai(n, i) : i === String(n);
}
function ki(e) {
	let { trim: t = !0, collapseWhitespace: n = !0 } = e === void 0 ? {} : e;
	return (e) => {
		let r = e;
		return r = t ? r.trim() : r, r = n ? r.replace(/\s+/g, " ") : r, r;
	};
}
function U(e) {
	let { trim: t, collapseWhitespace: n, normalizer: r } = e;
	if (!r) return ki({
		trim: t,
		collapseWhitespace: n
	});
	if (t !== void 0 || n !== void 0) throw Error("trim and collapseWhitespace are not supported with a normalizer. If you want to use the default trim and collapseWhitespace logic in your normalizer, use \"getDefaultNormalizer({trim, collapseWhitespace})\" and compose that into your normalizer");
	return r;
}
function Ai(e, t) {
	let n = e.test(t);
	return e.global && e.lastIndex !== 0 && (console.warn("To match all elements we had to reset the lastIndex of the RegExp because the global flag is enabled. We encourage to remove the global flag from the RegExp."), e.lastIndex = 0), n;
}
function ji(e) {
	return e.matches("input[type=submit], input[type=button], input[type=reset]") ? e.value : Array.from(e.childNodes).filter((e) => e.nodeType === li && !!e.textContent).map((e) => e.textContent).join("");
}
var Mi = Ii(L.elementRoles);
function Ni(e) {
	return e.hidden === !0 || e.getAttribute("aria-hidden") === "true" || e.ownerDocument.defaultView.getComputedStyle(e).display === "none";
}
function Pi(e, t) {
	t === void 0 && (t = {});
	let { isSubtreeInaccessible: n = Ni } = t;
	if (e.ownerDocument.defaultView.getComputedStyle(e).visibility === "hidden") return !0;
	let r = e;
	for (; r;) {
		if (n(r)) return !0;
		r = r.parentElement;
	}
	return !1;
}
function Fi(e) {
	for (let { match: t, roles: n } of Mi) if (t(e)) return [...n];
	return [];
}
function Ii(e) {
	function t(e) {
		let { name: t, attributes: n } = e;
		return "" + t + n.map((e) => {
			let { name: t, value: n, constraints: r = [] } = e, i = r.indexOf("undefined") !== -1, a = r.indexOf("set") !== -1;
			return n === void 0 ? i ? ":not([" + t + "])" : a ? "[" + t + "]:not([" + t + "=\"\"])" : "[" + t + "]" : "[" + t + "=\"" + n + "\"]";
		}).join("");
	}
	function n(e) {
		let { attributes: t = [] } = e;
		return t.length;
	}
	function r(e, t) {
		let { specificity: n } = e, { specificity: r } = t;
		return r - n;
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
function Li(e, t) {
	let { hidden: n = !1 } = t === void 0 ? {} : t;
	function r(e) {
		return [e, ...Array.from(e.children).reduce((e, t) => [...e, ...r(t)], [])];
	}
	return r(e).filter((e) => n !== !1 || Pi(e) === !1).reduce((e, t) => {
		let n = [];
		return n = t.hasAttribute("role") ? t.getAttribute("role").split(" ").slice(0, 1) : Fi(t), n.reduce((e, n) => Array.isArray(e[n]) ? {
			...e,
			[n]: [...e[n], t]
		} : {
			...e,
			[n]: [t]
		}, e);
	}, {});
}
function Ri(e, t) {
	let { hidden: n, includeDescription: r } = t, i = Li(e, { hidden: n });
	return Object.entries(i).filter((e) => {
		let [t] = e;
		return t !== "generic";
	}).map((e) => {
		let [t, n] = e, i = "-".repeat(50), a = n.map((e) => {
			let t = "Name \"" + qe(e, { computedStyleSupportsPseudoElements: B().computedStyleSupportsPseudoElements }) + "\":\n", n = vi(e.cloneNode(!1));
			if (r) {
				let r = "Description \"" + Ge(e, { computedStyleSupportsPseudoElements: B().computedStyleSupportsPseudoElements }) + "\":\n";
				return "" + t + r + n;
			}
			return "" + t + n;
		}).join("\n\n");
		return t + ":\n\n" + a + "\n\n" + i;
	}).join("\n");
}
var zi = function(e, t) {
	let { hidden: n = !1 } = t === void 0 ? {} : t;
	return console.log(Ri(e, { hidden: n }));
};
function Bi(e) {
	return e.tagName === "OPTION" ? e.selected : Ki(e, "aria-selected");
}
function Vi(e) {
	return e.getAttribute("aria-busy") === "true";
}
function Hi(e) {
	if (!("indeterminate" in e && e.indeterminate)) return "checked" in e ? e.checked : Ki(e, "aria-checked");
}
function Ui(e) {
	return Ki(e, "aria-pressed");
}
function Wi(e) {
	return Ki(e, "aria-current") ?? e.getAttribute("aria-current") ?? !1;
}
function Gi(e) {
	return Ki(e, "aria-expanded");
}
function Ki(e, t) {
	let n = e.getAttribute(t);
	if (n === "true") return !0;
	if (n === "false") return !1;
}
function qi(e) {
	return e.getAttribute("aria-level") && Number(e.getAttribute("aria-level")) || {
		H1: 1,
		H2: 2,
		H3: 3,
		H4: 4,
		H5: 5,
		H6: 6
	}[e.tagName];
}
function Ji(e) {
	let t = e.getAttribute("aria-valuenow");
	return t === null ? void 0 : +t;
}
function Yi(e) {
	let t = e.getAttribute("aria-valuemax");
	return t === null ? void 0 : +t;
}
function Xi(e) {
	let t = e.getAttribute("aria-valuemin");
	return t === null ? void 0 : +t;
}
function Zi(e) {
	let t = e.getAttribute("aria-valuetext");
	return t === null ? void 0 : t;
}
var Qi = ki();
function $i(e) {
	return e.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&");
}
function ea(e) {
	return new RegExp($i(e.toLowerCase()), "i");
}
function W(e, t, n, r) {
	let { variant: i, name: a } = r, o = "", s = {}, c = [["Role", "TestId"].includes(e) ? n : ea(n)];
	a && (s.name = ea(a)), e === "Role" && Pi(t) && (s.hidden = !0, o = "Element is inaccessible. This means that the element and all its children are invisible to screen readers.\n    If you are using the aria-hidden prop, make sure this is the right choice for your case.\n    "), Object.keys(s).length > 0 && c.push(s);
	let l = i + "By" + e;
	return {
		queryName: e,
		queryMethod: l,
		queryArgs: c,
		variant: i,
		warning: o,
		toString() {
			o && console.warn(o);
			let [e, t] = c;
			return e = typeof e == "string" ? "'" + e + "'" : e, t = t ? ", { " + Object.entries(t).map((e) => {
				let [t, n] = e;
				return t + ": " + n;
			}).join(", ") + " }" : "", l + "(" + e + t + ")";
		}
	};
}
function G(e, t, n) {
	return n && (!t || t.toLowerCase() === e.toLowerCase());
}
function ta(e, t, n) {
	if (t === void 0 && (t = "get"), e.matches(B().defaultIgnore)) return;
	let r = e.getAttribute("role") ?? Fi(e)?.[0];
	if (r !== "generic" && G("Role", n, r)) return W("Role", e, r, {
		variant: t,
		name: qe(e, { computedStyleSupportsPseudoElements: B().computedStyleSupportsPseudoElements })
	});
	let i = Di(document, e).map((e) => e.content).join(" ");
	if (G("LabelText", n, i)) return W("LabelText", e, i, { variant: t });
	let a = e.getAttribute("placeholder");
	if (G("PlaceholderText", n, a)) return W("PlaceholderText", e, a, { variant: t });
	let o = Qi(ji(e));
	if (G("Text", n, o)) return W("Text", e, o, { variant: t });
	if (G("DisplayValue", n, e.value)) return W("DisplayValue", e, Qi(e.value), { variant: t });
	let s = e.getAttribute("alt");
	if (G("AltText", n, s)) return W("AltText", e, s, { variant: t });
	let c = e.getAttribute("title");
	if (G("Title", n, c)) return W("Title", e, c, { variant: t });
	let l = e.getAttribute(B().testIdAttribute);
	if (G("TestId", n, l)) return W("TestId", e, l, { variant: t });
}
function na(e, t) {
	e.stack = t.stack.replace(t.message, e.message);
}
function ra(e, t) {
	let { container: n = di(), timeout: r = B().asyncUtilTimeout, showOriginalStackTrace: i = B().showOriginalStackTrace, stackTraceError: a, interval: o = 50, onTimeout: s = (e) => (Object.defineProperty(e, "message", { value: B().getElementError(e.message, n).message }), e), mutationObserverOptions: c = {
		subtree: !0,
		childList: !0,
		attributes: !0,
		characterData: !0
	} } = t;
	if (typeof e != "function") throw TypeError("Received `callback` arg must be a function");
	return new Promise(async (t, l) => {
		let u, d, f, p = !1, m = "idle", h = setTimeout(b, r), g = ui();
		if (g) {
			let { unstable_advanceTimersWrapper: e } = B();
			for (y(); !p;) {
				if (!ui()) {
					let e = /* @__PURE__ */ Error("Changed from using fake timers to real timers while using waitFor. This is not allowed and will result in very strange behavior. Please ensure you're awaiting all async things your test is doing before changing to real timers. For more info, please go to https://github.com/testing-library/dom-testing-library/issues/830");
					i || na(e, a), l(e);
					return;
				}
				if (await e(async () => {
					jest.advanceTimersByTime(o);
				}), p) break;
				y();
			}
		} else {
			try {
				R(n);
			} catch (e) {
				l(e);
				return;
			}
			d = setInterval(v, o);
			let { MutationObserver: e } = fi(n);
			f = new e(v), f.observe(n, c), y();
		}
		function _(e, n) {
			p = !0, clearTimeout(h), g || (clearInterval(d), f.disconnect()), e ? l(e) : t(n);
		}
		function v() {
			if (ui()) {
				let e = /* @__PURE__ */ Error("Changed from using real timers to fake timers while using waitFor. This is not allowed and will result in very strange behavior. Please ensure you're awaiting all async things your test is doing before changing to fake timers. For more info, please go to https://github.com/testing-library/dom-testing-library/issues/830");
				return i || na(e, a), l(e);
			}
			return y();
		}
		function y() {
			if (m !== "pending") try {
				let t = bi(e);
				typeof t?.then == "function" ? (m = "pending", t.then((e) => {
					m = "resolved", _(null, e);
				}, (e) => {
					m = "rejected", u = e;
				})) : _(null, t);
			} catch (e) {
				u = e;
			}
		}
		function b() {
			let e;
			u ? (e = u, !i && e.name === "TestingLibraryElementError" && na(e, a)) : (e = /* @__PURE__ */ Error("Timed out in waitFor."), i || na(e, a)), _(s(e), null);
		}
	});
}
function ia(e, t) {
	let n = /* @__PURE__ */ Error("STACK_TRACE_MESSAGE");
	return B().asyncWrapper(() => ra(e, {
		stackTraceError: n,
		...t
	}));
}
function aa(e, t) {
	return B().getElementError(e, t);
}
function oa(e, t) {
	return aa(e + "\n\n(If this is intentional, then use the `*AllBy*` variant of the query (like `queryAllByText`, `getAllByText`, or `findAllByText`)).", t);
}
function K(e, t, n, r) {
	let { exact: i = !0, collapseWhitespace: a, trim: o, normalizer: s } = r === void 0 ? {} : r, c = i ? H : V, l = U({
		collapseWhitespace: a,
		trim: o,
		normalizer: s
	});
	return Array.from(t.querySelectorAll("[" + e + "]")).filter((t) => c(t.getAttribute(e), t, n, l));
}
function sa(e, t, n, r) {
	let i = K(e, t, n, r);
	if (i.length > 1) throw oa("Found multiple elements by [" + e + "=" + n + "]", t);
	return i[0] || null;
}
function q(e, t) {
	return function(n) {
		var r = [...arguments].slice(1);
		let i = e(n, ...r);
		if (i.length > 1) {
			let e = i.map((e) => aa(null, e).message).join("\n\n");
			throw oa(t(n, ...r) + "\n\nHere are the matching elements:\n\n" + e, n);
		}
		return i[0] || null;
	};
}
function ca(e, t) {
	return B().getElementError("A better query is available, try this:\n" + e.toString() + "\n", t);
}
function la(e, t) {
	return function(n) {
		var r = [...arguments].slice(1);
		let i = e(n, ...r);
		if (!i.length) throw B().getElementError(t(n, ...r), n);
		return i;
	};
}
function J(e) {
	return (t, n, r, i) => ia(() => e(t, n, r), {
		container: t,
		...i
	});
}
var Y = (e, t, n) => function(r) {
	var i = [...arguments].slice(1);
	let a = e(r, ...i), [{ suggest: o = B().throwSuggestions } = {}] = i.slice(-1);
	if (a && o) {
		let e = ta(a, n);
		if (e && !t.endsWith(e.queryName)) throw ca(e.toString(), r);
	}
	return a;
}, X = (e, t, n) => function(r) {
	var i = [...arguments].slice(1);
	let a = e(r, ...i), [{ suggest: o = B().throwSuggestions } = {}] = i.slice(-1);
	if (a.length && o) {
		let e = [...new Set(a.map((e) => ta(e, n)?.toString()))];
		if (e.length === 1 && !t.endsWith(ta(a[0], n).queryName)) throw ca(e[0], r);
	}
	return a;
};
function Z(e, t, n) {
	let r = Y(q(e, t), e.name, "query"), i = la(e, n), a = q(i, t), o = Y(a, e.name, "get");
	return [
		r,
		X(i, e.name.replace("query", "get"), "getAll"),
		o,
		J(X(i, e.name, "findAll")),
		J(Y(a, e.name, "find"))
	];
}
var ua = /*#__PURE__*/ Object.freeze({
	__proto__: null,
	getElementError: aa,
	wrapAllByQueryWithSuggestion: X,
	wrapSingleQueryWithSuggestion: Y,
	getMultipleElementsFoundError: oa,
	queryAllByAttribute: K,
	queryByAttribute: sa,
	makeSingleQuery: q,
	makeGetAllQuery: la,
	makeFindQuery: J,
	buildQueries: Z
});
function da(e) {
	return Array.from(e.querySelectorAll("label,input")).map((e) => ({
		node: e,
		textToMatch: wi(e)
	})).filter((e) => {
		let { textToMatch: t } = e;
		return t !== null;
	});
}
var fa = function(e, t, n) {
	let { exact: r = !0, trim: i, collapseWhitespace: a, normalizer: o } = n === void 0 ? {} : n, s = r ? H : V, c = U({
		collapseWhitespace: a,
		trim: i,
		normalizer: o
	});
	return da(e).filter((e) => {
		let { node: n, textToMatch: r } = e;
		return s(r, n, t, c);
	}).map((e) => {
		let { node: t } = e;
		return t;
	});
}, Q = function(e, t, n) {
	let { selector: r = "*", exact: i = !0, collapseWhitespace: a, trim: o, normalizer: s } = n === void 0 ? {} : n;
	R(e);
	let c = i ? H : V, l = U({
		collapseWhitespace: a,
		trim: o,
		normalizer: s
	}), u = Array.from(e.querySelectorAll("*")).filter((e) => Ti(e).length || e.hasAttribute("aria-labelledby")).reduce((n, i) => {
		let a = Di(e, i, { selector: r });
		a.filter((e) => !!e.formControl).forEach((e) => {
			c(e.content, e.formControl, t, l) && e.formControl && n.push(e.formControl);
		});
		let o = a.filter((e) => !!e.content).map((e) => e.content);
		return c(o.join(" "), i, t, l) && n.push(i), o.length > 1 && o.forEach((e, r) => {
			c(e, i, t, l) && n.push(i);
			let a = [...o];
			a.splice(r, 1), a.length > 1 && c(a.join(" "), i, t, l) && n.push(i);
		}), n;
	}, []).concat(K("aria-label", e, t, {
		exact: i,
		normalizer: l
	}));
	return Array.from(new Set(u)).filter((e) => e.matches(r));
}, $ = function(e, t) {
	var n = [...arguments].slice(2);
	let r = Q(e, t, ...n);
	if (!r.length) {
		let r = fa(e, t, ...n);
		if (r.length) {
			let n = r.map((t) => pa(e, t)).filter((e) => !!e);
			throw n.length ? B().getElementError(n.map((e) => "Found a label with the text of: " + t + ", however the element associated with this label (<" + e + " />) is non-labellable [https://html.spec.whatwg.org/multipage/forms.html#category-label]. If you really need to label a <" + e + " />, you can use aria-label or aria-labelledby instead.").join("\n\n"), e) : B().getElementError("Found a label with the text of: " + t + ", however no form control was found associated to that label. Make sure you're using the \"for\" attribute or \"aria-labelledby\" attribute correctly.", e);
		}
		throw B().getElementError("Unable to find a label with the text of: " + t, e);
	}
	return r;
};
function pa(e, t) {
	let n = t.getAttribute("for");
	if (!n) return null;
	let r = e.querySelector("[id=\"" + n + "\"]");
	return r ? r.tagName.toLowerCase() : null;
}
var ma = (e, t) => "Found multiple elements with the text of: " + t, ha = Y(q(Q, ma), Q.name, "query"), ga = q($, ma), _a = J(X($, $.name, "findAll")), va = J(Y(ga, $.name, "find")), ya = X($, $.name, "getAll"), ba = Y(ga, $.name, "get"), xa = X(Q, Q.name, "queryAll"), Sa = function() {
	var e = [...arguments];
	return R(e[0]), K("placeholder", ...e);
}, Ca = (e, t) => "Found multiple elements with the placeholder text of: " + t, wa = (e, t) => "Unable to find an element with the placeholder text of: " + t, Ta = X(Sa, Sa.name, "queryAll"), [Ea, Da, Oa, ka, Aa] = Z(Sa, Ca, wa), ja = function(e, t, n) {
	let { selector: r = "*", exact: i = !0, collapseWhitespace: a, trim: o, ignore: s = B().defaultIgnore, normalizer: c } = n === void 0 ? {} : n;
	R(e);
	let l = i ? H : V, u = U({
		collapseWhitespace: a,
		trim: o,
		normalizer: c
	}), d = [];
	return typeof e.matches == "function" && e.matches(r) && (d = [e]), [...d, ...Array.from(e.querySelectorAll(r))].filter((e) => !s || !e.matches(s)).filter((e) => l(ji(e), e, t, u));
}, Ma = (e, t) => "Found multiple elements with the text: " + t, Na = function(e, t, n) {
	n === void 0 && (n = {});
	let { collapseWhitespace: r, trim: i, normalizer: a, selector: o } = n, s = U({
		collapseWhitespace: r,
		trim: i,
		normalizer: a
	})(t.toString()), c = s !== t.toString(), l = (o ?? "*") !== "*";
	return "Unable to find an element with the text: " + (c ? s + " (normalized from '" + t + "')" : t) + (l ? ", which matches selector '" + o + "'" : "") + ". This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.";
}, Pa = X(ja, ja.name, "queryAll"), [Fa, Ia, La, Ra, za] = Z(ja, Ma, Na), Ba = function(e, t, n) {
	let { exact: r = !0, collapseWhitespace: i, trim: a, normalizer: o } = n === void 0 ? {} : n;
	R(e);
	let s = r ? H : V, c = U({
		collapseWhitespace: i,
		trim: a,
		normalizer: o
	});
	return Array.from(e.querySelectorAll("input,textarea,select")).filter((e) => e.tagName === "SELECT" ? Array.from(e.options).filter((e) => e.selected).some((e) => s(ji(e), e, t, c)) : s(e.value, e, t, c));
}, Va = (e, t) => "Found multiple elements with the display value: " + t + ".", Ha = (e, t) => "Unable to find an element with the display value: " + t + ".", Ua = X(Ba, Ba.name, "queryAll"), [Wa, Ga, Ka, qa, Ja] = Z(Ba, Va, Ha), Ya = /^(img|input|area|.+-.+)$/i, Xa = function(e, t, n) {
	return n === void 0 && (n = {}), R(e), K("alt", e, t, n).filter((e) => Ya.test(e.tagName));
}, Za = (e, t) => "Found multiple elements with the alt text: " + t, Qa = (e, t) => "Unable to find an element with the alt text: " + t, $a = X(Xa, Xa.name, "queryAll"), [eo, to, no, ro, io] = Z(Xa, Za, Qa), ao = (e) => e.tagName.toLowerCase() === "title" && e.parentElement?.tagName.toLowerCase() === "svg", oo = function(e, t, n) {
	let { exact: r = !0, collapseWhitespace: i, trim: a, normalizer: o } = n === void 0 ? {} : n;
	R(e);
	let s = r ? H : V, c = U({
		collapseWhitespace: i,
		trim: a,
		normalizer: o
	});
	return Array.from(e.querySelectorAll("[title], svg > title")).filter((e) => s(e.getAttribute("title"), e, t, c) || ao(e) && s(ji(e), e, t, c));
}, so = (e, t) => "Found multiple elements with the title: " + t + ".", co = (e, t) => "Unable to find an element with the title: " + t + ".", lo = X(oo, oo.name, "queryAll"), [uo, fo, po, mo, ho] = Z(oo, so, co), go = function(e, t, n) {
	let { hidden: r = B().defaultHidden, name: i, description: a, queryFallbacks: o = !1, selected: s, busy: c, checked: l, pressed: u, current: d, level: f, expanded: p, value: { now: m, min: h, max: g, text: _ } = {} } = n === void 0 ? {} : n;
	if (R(e), s !== void 0 && L.roles.get(t)?.props["aria-selected"] === void 0) throw Error("\"aria-selected\" is not supported on role \"" + t + "\".");
	if (c !== void 0 && L.roles.get(t)?.props["aria-busy"] === void 0) throw Error("\"aria-busy\" is not supported on role \"" + t + "\".");
	if (l !== void 0 && L.roles.get(t)?.props["aria-checked"] === void 0) throw Error("\"aria-checked\" is not supported on role \"" + t + "\".");
	if (u !== void 0 && L.roles.get(t)?.props["aria-pressed"] === void 0) throw Error("\"aria-pressed\" is not supported on role \"" + t + "\".");
	if (d !== void 0 && L.roles.get(t)?.props["aria-current"] === void 0) throw Error("\"aria-current\" is not supported on role \"" + t + "\".");
	if (f !== void 0 && t !== "heading") throw Error("Role \"" + t + "\" cannot have \"level\" property.");
	if (m !== void 0 && L.roles.get(t)?.props["aria-valuenow"] === void 0) throw Error("\"aria-valuenow\" is not supported on role \"" + t + "\".");
	if (g !== void 0 && L.roles.get(t)?.props["aria-valuemax"] === void 0) throw Error("\"aria-valuemax\" is not supported on role \"" + t + "\".");
	if (h !== void 0 && L.roles.get(t)?.props["aria-valuemin"] === void 0) throw Error("\"aria-valuemin\" is not supported on role \"" + t + "\".");
	if (_ !== void 0 && L.roles.get(t)?.props["aria-valuetext"] === void 0) throw Error("\"aria-valuetext\" is not supported on role \"" + t + "\".");
	if (p !== void 0 && L.roles.get(t)?.props["aria-expanded"] === void 0) throw Error("\"aria-expanded\" is not supported on role \"" + t + "\".");
	let v = /* @__PURE__ */ new WeakMap();
	function y(e) {
		return v.has(e) || v.set(e, Ni(e)), v.get(e);
	}
	return Array.from(e.querySelectorAll(_o(t))).filter((e) => {
		if (e.hasAttribute("role")) {
			let n = e.getAttribute("role");
			if (o) return n.split(" ").filter(Boolean).some((e) => e === t);
			let [r] = n.split(" ");
			return r === t;
		}
		return Fi(e).some((e) => e === t);
	}).filter((e) => {
		if (s !== void 0) return s === Bi(e);
		if (c !== void 0) return c === Vi(e);
		if (l !== void 0) return l === Hi(e);
		if (u !== void 0) return u === Ui(e);
		if (d !== void 0) return d === Wi(e);
		if (p !== void 0) return p === Gi(e);
		if (f !== void 0) return f === qi(e);
		if (m !== void 0 || g !== void 0 || h !== void 0 || _ !== void 0) {
			let t = !0;
			return m !== void 0 && (t &&= m === Ji(e)), g !== void 0 && (t &&= g === Yi(e)), h !== void 0 && (t &&= h === Xi(e)), _ !== void 0 && (t &&= H(Zi(e) ?? null, e, _, (e) => e)), t;
		}
		return !0;
	}).filter((e) => i === void 0 || H(qe(e, { computedStyleSupportsPseudoElements: B().computedStyleSupportsPseudoElements }), e, i, (e) => e)).filter((e) => a === void 0 || H(Ge(e, { computedStyleSupportsPseudoElements: B().computedStyleSupportsPseudoElements }), e, a, (e) => e)).filter((e) => r !== !1 || Pi(e, { isSubtreeInaccessible: y }) === !1);
};
function _o(e) {
	let t = "*[role~=\"" + e + "\"]", n = L.roleElements.get(e) ?? /* @__PURE__ */ new Set(), r = new Set(Array.from(n).map((e) => {
		let { name: t } = e;
		return t;
	}));
	return [t].concat(Array.from(r)).join(",");
}
var vo = (e) => {
	let t = "";
	return t = e === void 0 ? "" : typeof e == "string" ? " and name \"" + e + "\"" : " and name `" + e + "`", t;
}, yo = function(e, t, n) {
	let { name: r } = n === void 0 ? {} : n;
	return "Found multiple elements with the role \"" + t + "\"" + vo(r);
}, bo = function(e, t, n) {
	let { hidden: r = B().defaultHidden, name: i, description: a } = n === void 0 ? {} : n;
	if (B()._disableExpensiveErrorDiagnostics) return "Unable to find role=\"" + t + "\"" + vo(i);
	let o = "";
	Array.from(e.children).forEach((e) => {
		o += Ri(e, {
			hidden: r,
			includeDescription: a !== void 0
		});
	});
	let s;
	s = o.length === 0 ? r === !1 ? "There are no accessible roles. But there might be some inaccessible roles. If you wish to access them, then set the `hidden` option to `true`. Learn more about this here: https://testing-library.com/docs/dom-testing-library/api-queries#byrole" : "There are no available roles." : ("\nHere are the " + (r === !1 ? "accessible" : "available") + " roles:\n\n  " + o.replace(/\n/g, "\n  ").replace(/\n\s\s\n/g, "\n\n") + "\n").trim();
	let c = "";
	c = i === void 0 ? "" : typeof i == "string" ? " and name \"" + i + "\"" : " and name `" + i + "`";
	let l = "";
	return l = a === void 0 ? "" : typeof a == "string" ? " and description \"" + a + "\"" : " and description `" + a + "`", ("\nUnable to find an " + (r === !1 ? "accessible " : "") + "element with the role \"" + t + "\"" + c + l + "\n\n" + s).trim();
}, xo = X(go, go.name, "queryAll"), [So, Co, wo, To, Eo] = Z(go, yo, bo), Do = () => B().testIdAttribute, Oo = function() {
	var e = [...arguments];
	return R(e[0]), K(Do(), ...e);
}, ko = (e, t) => "Found multiple elements by: [" + Do() + "=\"" + t + "\"]", Ao = (e, t) => "Unable to find an element by: [" + Do() + "=\"" + t + "\"]", jo = X(Oo, Oo.name, "queryAll"), [Mo, No, Po, Fo, Io] = Z(Oo, ko, Ao), Lo = /*#__PURE__*/ Object.freeze({
	__proto__: null,
	queryAllByLabelText: xa,
	queryByLabelText: ha,
	getAllByLabelText: ya,
	getByLabelText: ba,
	findAllByLabelText: _a,
	findByLabelText: va,
	queryByPlaceholderText: Ea,
	queryAllByPlaceholderText: Ta,
	getByPlaceholderText: Oa,
	getAllByPlaceholderText: Da,
	findAllByPlaceholderText: ka,
	findByPlaceholderText: Aa,
	queryByText: Fa,
	queryAllByText: Pa,
	getByText: La,
	getAllByText: Ia,
	findAllByText: Ra,
	findByText: za,
	queryByDisplayValue: Wa,
	queryAllByDisplayValue: Ua,
	getByDisplayValue: Ka,
	getAllByDisplayValue: Ga,
	findAllByDisplayValue: qa,
	findByDisplayValue: Ja,
	queryByAltText: eo,
	queryAllByAltText: $a,
	getByAltText: no,
	getAllByAltText: to,
	findAllByAltText: ro,
	findByAltText: io,
	queryByTitle: uo,
	queryAllByTitle: lo,
	getByTitle: po,
	getAllByTitle: fo,
	findAllByTitle: mo,
	findByTitle: ho,
	queryByRole: So,
	queryAllByRole: xo,
	getAllByRole: Co,
	getByRole: wo,
	findAllByRole: To,
	findByRole: Eo,
	queryByTestId: Mo,
	queryAllByTestId: jo,
	getByTestId: Po,
	getAllByTestId: No,
	findAllByTestId: Fo,
	findByTestId: Io
});
function Ro(e, t, n) {
	return t === void 0 && (t = Lo), n === void 0 && (n = {}), Object.keys(t).reduce((n, r) => (n[r] = t[r].bind(null, e), n), n);
}
var zo = (e) => !e || Array.isArray(e) && !e.length;
function Bo(e) {
	if (zo(e)) throw Error("The element(s) given to waitForElementToBeRemoved are already removed. waitForElementToBeRemoved requires that the element(s) exist(s) before waiting for removal.");
}
async function Vo(e, t) {
	let n = /* @__PURE__ */ Error("Timed out in waitForElementToBeRemoved.");
	if (typeof e != "function") {
		Bo(e);
		let t = (Array.isArray(e) ? e : [e]).map((e) => {
			let t = e.parentElement;
			if (t === null) return () => null;
			for (; t.parentElement;) t = t.parentElement;
			return () => t.contains(e) ? e : null;
		});
		e = () => t.map((e) => e()).filter(Boolean);
	}
	return Bo(e()), ia(() => {
		let t;
		try {
			t = e();
		} catch (e) {
			if (e.name === "TestingLibraryElementError") return;
			throw e;
		}
		if (!zo(t)) throw n;
	}, t);
}
var Ho = {
	copy: {
		EventType: "ClipboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
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
	paste: {
		EventType: "ClipboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	compositionEnd: {
		EventType: "CompositionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	compositionStart: {
		EventType: "CompositionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	compositionUpdate: {
		EventType: "CompositionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	keyDown: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			charCode: 0,
			composed: !0
		}
	},
	keyPress: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			charCode: 0,
			composed: !0
		}
	},
	keyUp: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			charCode: 0,
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
	blur: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	focusIn: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	focusOut: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
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
	input: {
		EventType: "InputEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	invalid: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !0
		}
	},
	submit: {
		EventType: "Event",
		defaultInit: {
			bubbles: !0,
			cancelable: !0
		}
	},
	reset: {
		EventType: "Event",
		defaultInit: {
			bubbles: !0,
			cancelable: !0
		}
	},
	click: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			button: 0,
			composed: !0
		}
	},
	contextMenu: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	dblClick: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	drag: {
		EventType: "DragEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	dragEnd: {
		EventType: "DragEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	dragEnter: {
		EventType: "DragEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	dragExit: {
		EventType: "DragEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	dragLeave: {
		EventType: "DragEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	dragOver: {
		EventType: "DragEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	dragStart: {
		EventType: "DragEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	drop: {
		EventType: "DragEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseDown: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseEnter: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	mouseLeave: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	mouseMove: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseOut: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseOver: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseUp: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	select: {
		EventType: "Event",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	touchCancel: {
		EventType: "TouchEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	touchEnd: {
		EventType: "TouchEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	touchMove: {
		EventType: "TouchEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	touchStart: {
		EventType: "TouchEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	resize: {
		EventType: "UIEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	scroll: {
		EventType: "UIEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	wheel: {
		EventType: "WheelEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	abort: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	canPlay: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	canPlayThrough: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	durationChange: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	emptied: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	encrypted: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	ended: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	loadedData: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	loadedMetadata: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	loadStart: {
		EventType: "ProgressEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	pause: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	play: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	playing: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	progress: {
		EventType: "ProgressEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	rateChange: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	seeked: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	seeking: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	stalled: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	suspend: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	timeUpdate: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	volumeChange: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	waiting: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	load: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	error: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	animationStart: {
		EventType: "AnimationEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	animationEnd: {
		EventType: "AnimationEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	animationIteration: {
		EventType: "AnimationEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	transitionCancel: {
		EventType: "TransitionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	transitionEnd: {
		EventType: "TransitionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0
		}
	},
	transitionRun: {
		EventType: "TransitionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	transitionStart: {
		EventType: "TransitionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	pointerOver: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerEnter: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	pointerDown: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerMove: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerUp: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerCancel: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	pointerOut: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerLeave: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	gotPointerCapture: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	lostPointerCapture: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	popState: {
		EventType: "PopStateEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	offline: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	online: {
		EventType: "Event",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	pageHide: {
		EventType: "PageTransitionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0
		}
	},
	pageShow: {
		EventType: "PageTransitionEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0
		}
	}
}, Uo = { doubleClick: "dblClick" };
function Wo(e, t) {
	return B().eventWrapper(() => {
		if (!t) throw Error("Unable to fire an event - please provide an event object.");
		if (!e) throw Error("Unable to fire a \"" + t.type + "\" event - please provide a DOM element.");
		return e.dispatchEvent(t);
	});
}
function Go(e, t, n, r) {
	let { EventType: i = "Event", defaultInit: a = {} } = r === void 0 ? {} : r;
	if (!t) throw Error("Unable to fire a \"" + e + "\" event - please provide a DOM element.");
	let o = {
		...a,
		...n
	}, { target: { value: s, files: c, ...l } = {} } = o;
	s !== void 0 && Ko(t, s), c !== void 0 && Object.defineProperty(t, "files", {
		configurable: !0,
		enumerable: !0,
		writable: !0,
		value: c
	}), Object.assign(t, l);
	let u = fi(t), d = u[i] || u.Event, f;
	/* istanbul ignore else  */
	if (typeof d == "function") f = new d(e, o);
	else {
		f = u.document.createEvent(i);
		let { bubbles: t, cancelable: n, detail: r, ...a } = o;
		f.initEvent(e, t, n, r), Object.keys(a).forEach((e) => {
			f[e] = a[e];
		});
	}
	return ["dataTransfer", "clipboardData"].forEach((e) => {
		let t = o[e];
		typeof t == "object" && 
		/* istanbul ignore if  */
		(typeof u.DataTransfer == "function" ? Object.defineProperty(f, e, { value: Object.getOwnPropertyNames(t).reduce((e, n) => (Object.defineProperty(e, n, { value: t[n] }), e), new u.DataTransfer()) }) : Object.defineProperty(f, e, { value: t }));
	}), f;
}
Object.keys(Ho).forEach((e) => {
	let { EventType: t, defaultInit: n } = Ho[e], r = e.toLowerCase();
	Go[e] = (e, i) => Go(r, e, i, {
		EventType: t,
		defaultInit: n
	}), Wo[e] = (t, n) => Wo(t, Go[e](t, n));
});
function Ko(e, t) {
	let { set: n } = Object.getOwnPropertyDescriptor(e, "value") || {}, r = Object.getPrototypeOf(e), { set: i } = Object.getOwnPropertyDescriptor(r, "value") || {};
	if (i && n !== i) i.call(e, t);
	else if (n) n.call(e, t);
	else throw Error("The given element does not have a value setter");
}
Object.keys(Uo).forEach((e) => {
	let t = Uo[e];
	Wo[e] = function() {
		return Wo[t](...arguments);
	};
});
function qo(e) {
	return e.replace(/[ \t]*[\n][ \t]*/g, "\n");
}
function Jo(e) {
	return Rr.default.compressToEncodedURIComponent(qo(e));
}
function Yo(e) {
	return "https://testing-playground.com/#markup=" + Jo(e);
}
var Xo = {
	debug: (e, t, n) => Array.isArray(e) ? e.forEach((e) => yi(e, t, n)) : yi(e, t, n),
	logTestingPlaygroundURL: function(e) {
		if (e === void 0 && (e = di().body), !e || !("innerHTML" in e)) {
			console.log("The element you're providing isn't a valid DOM element.");
			return;
		}
		if (!e.innerHTML) {
			console.log("The provided element doesn't have any children.");
			return;
		}
		let t = Yo(e.innerHTML);
		return console.log("Open this URL in your browser\n\n" + t), t;
	}
}, Zo = typeof document < "u" && document.body ? Ro(document.body, Lo, Xo) : Object.keys(Lo).reduce((e, t) => (e[t] = () => {
	throw TypeError("For queries bound to document.body a global document has to be available... Learn more: https://testing-library.com/s/screen-global-error");
}, e), Xo);
export { B as n, r, Lr as t };
