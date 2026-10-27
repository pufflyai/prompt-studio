// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./dist-lNAvsPoR.ts";
import { A as t, C as n, E as r, S as i, T as a, _ as o, b as s, g as c, h as l, m as u, p as ee, v as te, w as d, x as ne, y as re } from "./string-CzPPgV0r.ts";
import { n as f, t as ie } from "./src-Bie5yc-F.ts";
import { n as p } from "./chunk-Y2CYZVJY-DqH9smpi.ts";
import { R as ae, h as m, p as oe, r as se, s as h } from "./chunk-I66GZJ75-3HfQzheA.ts";
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bundle.js
function ce(e, t) {
	this._basis = new i(e), this._beta = t;
}
ce.prototype = {
	lineStart: function() {
		this._x = [], this._y = [], this._basis.lineStart();
	},
	lineEnd: function() {
		var e = this._x, t = this._y, n = e.length - 1;
		if (n > 0) for (var r = e[0], i = t[0], a = e[n] - r, o = t[n] - i, s = -1, c; ++s <= n;) c = s / n, this._basis.point(this._beta * e[s] + (1 - this._beta) * (r + c * a), this._beta * t[s] + (1 - this._beta) * (i + c * o));
		this._x = this._y = null, this._basis.lineEnd();
	},
	point: function(e, t) {
		this._x.push(+e), this._y.push(+t);
	}
};
var le = (function e(t) {
	function n(e) {
		return t === 1 ? new i(e) : new ce(e, t);
	}
	return n.beta = function(t) {
		return e(+t);
	}, n;
})(.85);
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinal.js
function g(e, t, n) {
	e._context.bezierCurveTo(e._x1 + e._k * (e._x2 - e._x0), e._y1 + e._k * (e._y2 - e._y0), e._x2 + e._k * (e._x1 - t), e._y2 + e._k * (e._y1 - n), e._x2, e._y2);
}
function _(e, t) {
	this._context = e, this._k = (1 - t) / 6;
}
_.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x2, this._y2);
				break;
			case 3: g(this, this._x1, this._y1);
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1:
				this._point = 2, this._x1 = e, this._y1 = t;
				break;
			case 2: this._point = 3;
			default: g(this, e, t);
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var ue = (function e(t) {
	function n(e) {
		return new _(e, t);
	}
	return n.tension = function(t) {
		return e(+t);
	}, n;
})(0);
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinalClosed.js
function v(e, t) {
	this._context = e, this._k = (1 - t) / 6;
}
v.prototype = {
	areaStart: d,
	areaEnd: d,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x3, this._y3), this._context.closePath();
				break;
			case 2:
				this._context.lineTo(this._x3, this._y3), this._context.closePath();
				break;
			case 3: this.point(this._x3, this._y3), this.point(this._x4, this._y4), this.point(this._x5, this._y5);
		}
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._x3 = e, this._y3 = t;
				break;
			case 1:
				this._point = 2, this._context.moveTo(this._x4 = e, this._y4 = t);
				break;
			case 2:
				this._point = 3, this._x5 = e, this._y5 = t;
				break;
			default: g(this, e, t);
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var de = (function e(t) {
	function n(e) {
		return new v(e, t);
	}
	return n.tension = function(t) {
		return e(+t);
	}, n;
})(0);
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinalOpen.js
function y(e, t) {
	this._context = e, this._k = (1 - t) / 6;
}
y.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._point = 0;
	},
	lineEnd: function() {
		(this._line || this._line !== 0 && this._point === 3) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1;
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3, this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
				break;
			case 3: this._point = 4;
			default: g(this, e, t);
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var fe = (function e(t) {
	function n(e) {
		return new y(e, t);
	}
	return n.tension = function(t) {
		return e(+t);
	}, n;
})(0);
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRom.js
function b(e, t, n) {
	var r = e._x1, i = e._y1, a = e._x2, o = e._y2;
	if (e._l01_a > 1e-12) {
		var s = 2 * e._l01_2a + 3 * e._l01_a * e._l12_a + e._l12_2a, c = 3 * e._l01_a * (e._l01_a + e._l12_a);
		r = (r * s - e._x0 * e._l12_2a + e._x2 * e._l01_2a) / c, i = (i * s - e._y0 * e._l12_2a + e._y2 * e._l01_2a) / c;
	}
	if (e._l23_a > 1e-12) {
		var l = 2 * e._l23_2a + 3 * e._l23_a * e._l12_a + e._l12_2a, u = 3 * e._l23_a * (e._l23_a + e._l12_a);
		a = (a * l + e._x1 * e._l23_2a - t * e._l12_2a) / u, o = (o * l + e._y1 * e._l23_2a - n * e._l12_2a) / u;
	}
	e._context.bezierCurveTo(r, i, a, o, e._x2, e._y2);
}
function x(e, t) {
	this._context = e, this._alpha = t;
}
x.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x2, this._y2);
				break;
			case 3: this.point(this._x2, this._y2);
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		if (e = +e, t = +t, this._point) {
			var n = this._x2 - e, r = this._y2 - t;
			this._l23_a = Math.sqrt(this._l23_2a = (n * n + r * r) ** +this._alpha);
		}
		switch (this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1:
				this._point = 2;
				break;
			case 2: this._point = 3;
			default: b(this, e, t);
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a, this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a, this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var pe = (function e(t) {
	function n(e) {
		return t ? new x(e, t) : new _(e, 0);
	}
	return n.alpha = function(t) {
		return e(+t);
	}, n;
})(.5);
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRomClosed.js
function me(e, t) {
	this._context = e, this._alpha = t;
}
me.prototype = {
	areaStart: d,
	areaEnd: d,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN, this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x3, this._y3), this._context.closePath();
				break;
			case 2:
				this._context.lineTo(this._x3, this._y3), this._context.closePath();
				break;
			case 3: this.point(this._x3, this._y3), this.point(this._x4, this._y4), this.point(this._x5, this._y5);
		}
	},
	point: function(e, t) {
		if (e = +e, t = +t, this._point) {
			var n = this._x2 - e, r = this._y2 - t;
			this._l23_a = Math.sqrt(this._l23_2a = (n * n + r * r) ** +this._alpha);
		}
		switch (this._point) {
			case 0:
				this._point = 1, this._x3 = e, this._y3 = t;
				break;
			case 1:
				this._point = 2, this._context.moveTo(this._x4 = e, this._y4 = t);
				break;
			case 2:
				this._point = 3, this._x5 = e, this._y5 = t;
				break;
			default: b(this, e, t);
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a, this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a, this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var he = (function e(t) {
	function n(e) {
		return t ? new me(e, t) : new v(e, 0);
	}
	return n.alpha = function(t) {
		return e(+t);
	}, n;
})(.5);
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRomOpen.js
function ge(e, t) {
	this._context = e, this._alpha = t;
}
ge.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		(this._line || this._line !== 0 && this._point === 3) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		if (e = +e, t = +t, this._point) {
			var n = this._x2 - e, r = this._y2 - t;
			this._l23_a = Math.sqrt(this._l23_2a = (n * n + r * r) ** +this._alpha);
		}
		switch (this._point) {
			case 0:
				this._point = 1;
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3, this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
				break;
			case 3: this._point = 4;
			default: b(this, e, t);
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a, this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a, this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var _e = (function e(t) {
	function n(e) {
		return t ? new ge(e, t) : new y(e, 0);
	}
	return n.alpha = function(t) {
		return e(+t);
	}, n;
})(.5);
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/predicate/isLength.mjs
function ve(e) {
	return Number.isSafeInteger(e) && e >= 0;
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/predicate/isArrayLike.mjs
function ye(e) {
	return e != null && typeof e != "function" && ve(e.length);
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/_internal/isUnsafeProperty.mjs
function be(e) {
	return e === "__proto__";
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/predicate/isPrimitive.mjs
function S(e) {
	return e == null || typeof e != "object" && typeof e != "function";
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/_internal/getSymbols.mjs
function xe(e) {
	return Object.getOwnPropertySymbols(e).filter((t) => Object.prototype.propertyIsEnumerable.call(e, t));
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/_internal/getTag.mjs
function C(e) {
	return e == null ? e === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(e);
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/_internal/tags.mjs
var Se = "[object RegExp]", w = "[object String]", T = "[object Number]", E = "[object Boolean]", D = "[object Arguments]", O = "[object Symbol]", k = "[object Date]", A = "[object Map]", j = "[object Set]", M = "[object Array]", N = "[object ArrayBuffer]", Ce = "[object Object]", we = "[object DataView]", Te = "[object Uint8Array]", Ee = "[object Uint8ClampedArray]", De = "[object Uint16Array]", Oe = "[object Uint32Array]", ke = "[object Int8Array]", Ae = "[object Int16Array]", je = "[object Int32Array]", Me = "[object Float32Array]", Ne = "[object Float64Array]";
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/predicate/isTypedArray.mjs
function P(e) {
	return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/object/cloneDeepWith.mjs
function Pe(e, t) {
	return F(e, void 0, e, /* @__PURE__ */ new Map(), t);
}
function F(e, t, n, r = /* @__PURE__ */ new Map(), i = void 0) {
	let a = i?.(e, t, n, r);
	if (a !== void 0) return a;
	if (S(e)) return e;
	if (r.has(e)) return r.get(e);
	if (Array.isArray(e)) {
		let t = Array(e.length);
		r.set(e, t);
		for (let a = 0; a < e.length; a++) t[a] = F(e[a], a, n, r, i);
		return Object.hasOwn(e, "index") && (t.index = e.index), Object.hasOwn(e, "input") && (t.input = e.input), t;
	}
	if (e instanceof Date) return new Date(e.getTime());
	if (e instanceof RegExp) {
		let t = new RegExp(e.source, e.flags);
		return t.lastIndex = e.lastIndex, t;
	}
	if (e instanceof Map) {
		let t = /* @__PURE__ */ new Map();
		r.set(e, t);
		for (let [a, o] of e) t.set(a, F(o, a, n, r, i));
		return t;
	}
	if (e instanceof Set) {
		let t = /* @__PURE__ */ new Set();
		r.set(e, t);
		for (let a of e) t.add(F(a, void 0, n, r, i));
		return t;
	}
	if (typeof Buffer < "u" && Buffer.isBuffer(e)) return e.subarray();
	if (P(e)) {
		let t = new (Object.getPrototypeOf(e)).constructor(e.length);
		r.set(e, t);
		for (let a = 0; a < e.length; a++) t[a] = F(e[a], a, n, r, i);
		return t;
	}
	if (e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer) return e.slice(0);
	if (e instanceof DataView) {
		let t = new DataView(e.buffer.slice(0), e.byteOffset, e.byteLength);
		return r.set(e, t), I(t, e, n, r, i), t;
	}
	if (typeof File < "u" && e instanceof File) {
		let t = new File([e], e.name, { type: e.type });
		return r.set(e, t), I(t, e, n, r, i), t;
	}
	if (typeof Blob < "u" && e instanceof Blob) {
		let t = new Blob([e], { type: e.type });
		return r.set(e, t), I(t, e, n, r, i), t;
	}
	if (e instanceof Error) {
		let t = structuredClone(e);
		return r.set(e, t), t.message = e.message, t.name = e.name, t.stack = e.stack, t.cause = e.cause, t.constructor = e.constructor, I(t, e, n, r, i), t;
	}
	if (e instanceof Boolean) {
		let t = new Boolean(e.valueOf());
		return r.set(e, t), I(t, e, n, r, i), t;
	}
	if (e instanceof Number) {
		let t = new Number(e.valueOf());
		return r.set(e, t), I(t, e, n, r, i), t;
	}
	if (e instanceof String) {
		let t = new String(e.valueOf());
		return r.set(e, t), I(t, e, n, r, i), t;
	}
	if (typeof e == "object" && Fe(e)) {
		let t = Object.create(Object.getPrototypeOf(e));
		return r.set(e, t), I(t, e, n, r, i), t;
	}
	return e;
}
function I(e, t, n = e, r, i) {
	let a = [...Object.keys(t), ...xe(t)];
	for (let o = 0; o < a.length; o++) {
		let s = a[o], c = Object.getOwnPropertyDescriptor(e, s);
		(c == null || c.writable) && (e[s] = F(t[s], s, n, r, i));
	}
}
function Fe(e) {
	switch (C(e)) {
		case D:
		case M:
		case N:
		case we:
		case E:
		case k:
		case Me:
		case Ne:
		case ke:
		case Ae:
		case je:
		case A:
		case T:
		case Ce:
		case Se:
		case j:
		case w:
		case O:
		case Te:
		case Ee:
		case De:
		case Oe: return !0;
		default: return !1;
	}
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/object/cloneDeepWith.mjs
function Ie(e, t) {
	return Pe(e, (n, r, i, a) => {
		let o = t?.(n, r, i, a);
		if (o !== void 0) return o;
		if (typeof e == "object") {
			if (C(e) === "[object Object]" && typeof e.constructor != "function") {
				let t = {};
				return a.set(e, t), I(t, e, i, a), t;
			}
			switch (Object.prototype.toString.call(e)) {
				case T:
				case w:
				case E: {
					let t = new e.constructor(e?.valueOf());
					return I(t, e), t;
				}
				case D: {
					let t = {};
					return I(t, e), t.length = e.length, t[Symbol.iterator] = e[Symbol.iterator], t;
				}
				default: return;
			}
		}
	});
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/object/cloneDeep.mjs
function L(e) {
	return Ie(e);
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/predicate/isArguments.mjs
function R(e) {
	return typeof e == "object" && !!e && C(e) === "[object Arguments]";
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/predicate/isObjectLike.mjs
function z(e) {
	return typeof e == "object" && !!e;
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/predicate/isArrayLikeObject.mjs
function Le(e) {
	return z(e) && ye(e);
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/function/memoize.mjs
function B(e, t) {
	if (typeof e != "function" || t != null && typeof t != "function") throw TypeError("Expected a function");
	let n = function(...r) {
		let i = t ? t.apply(this, r) : r[0], a = n.cache;
		if (a.has(i)) return a.get(i);
		let o = e.apply(this, r);
		return n.cache = a.set(i, o) || a, o;
	};
	return n.cache = new (B.Cache || Map)(), n;
}
B.Cache = Map;
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/function/noop.mjs
function Re() {}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/predicate/isTypedArray.mjs
function V(e) {
	return P(e);
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/predicate/isPlainObject.mjs
function H(e) {
	if (typeof e != "object" || !e) return !1;
	if (Object.getPrototypeOf(e) === null) return !0;
	if (Object.prototype.toString.call(e) !== "[object Object]") {
		let t = e[Symbol.toStringTag];
		return t == null || !Object.getOwnPropertyDescriptor(e, Symbol.toStringTag)?.writable ? !1 : e.toString() === `[object ${t}]`;
	}
	let t = e;
	for (; Object.getPrototypeOf(t) !== null;) t = Object.getPrototypeOf(t);
	return Object.getPrototypeOf(e) === t;
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/object/clone.mjs
function ze(e) {
	if (S(e)) return e;
	if (Array.isArray(e) || P(e) || e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer) return e.slice(0);
	let t = Object.getPrototypeOf(e);
	if (t == null) return Object.assign(Object.create(t), e);
	let n = t.constructor;
	if (e instanceof Date || e instanceof Map || e instanceof Set) return new n(e);
	if (e instanceof RegExp) {
		let t = new n(e);
		return t.lastIndex = e.lastIndex, t;
	}
	if (e instanceof DataView) return new n(e.buffer.slice(0));
	if (e instanceof Error) {
		let t;
		return t = e instanceof AggregateError ? new n(e.errors, e.message, { cause: e.cause }) : new n(e.message, { cause: e.cause }), t.stack = e.stack, Object.assign(t, e), t;
	}
	if (typeof File < "u" && e instanceof File) return new n([e], e.name, {
		type: e.type,
		lastModified: e.lastModified
	});
	if (typeof e == "object") {
		let n = Object.create(t);
		return Object.assign(n, e);
	}
	return e;
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/object/mergeWith.mjs
function Be(e, ...t) {
	let n = t.slice(0, -1), r = t[t.length - 1], i = e;
	for (let e = 0; e < n.length; e++) {
		let t = n[e];
		i = U(i, t, r, /* @__PURE__ */ new Map());
	}
	return i;
}
function U(e, t, n, r) {
	if (S(e) && (e = Object(e)), typeof t != "object" || !t) return e;
	if (r.has(t)) return ze(r.get(t));
	if (r.set(t, e), Array.isArray(t)) {
		t = t.slice();
		for (let e = 0; e < t.length; e++) t[e] = t[e] ?? void 0;
	}
	let i = [...Object.keys(t), ...xe(t)];
	for (let a = 0; a < i.length; a++) {
		let o = i[a];
		if (be(o)) continue;
		let s = t[o], c = e[o];
		if (R(s) && (s = { ...s }), R(c) && (c = { ...c }), typeof Buffer < "u" && Buffer.isBuffer(s) && (s = L(s)), Array.isArray(s)) {
			if (Array.isArray(c)) {
				let e = [], t = Reflect.ownKeys(c);
				for (let n = 0; n < t.length; n++) {
					let r = t[n];
					e[r] = c[r];
				}
				c = e;
			} else if (Le(c)) {
				let e = [];
				for (let t = 0; t < c.length; t++) e[t] = c[t];
				c = e;
			} else c = [];
		}
		let l = n(c, s, o, e, t, r);
		l === void 0 ? Array.isArray(s) || z(c) && z(s) && (H(c) || H(s) || V(c) || V(s)) ? e[o] = U(c, s, n, r) : c == null && H(s) ? e[o] = U({}, s, n, r) : c == null && V(s) ? e[o] = L(s) : (c === void 0 || s !== void 0) && (e[o] = s) : e[o] = l;
	}
	return e;
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/object/merge.mjs
function Ve(e, ...t) {
	return Be(e, ...t, Re);
}
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/chunk-NSK5VX7P.mjs
var He = e(), Ue = {
	curveBasis: n,
	curveBasisClosed: ne,
	curveBasisOpen: s,
	curveBumpX: a,
	curveBumpY: r,
	curveBundle: le,
	curveCardinalClosed: de,
	curveCardinalOpen: fe,
	curveCardinal: ue,
	curveCatmullRomClosed: he,
	curveCatmullRomOpen: _e,
	curveCatmullRom: pe,
	curveLinear: t,
	curveLinearClosed: re,
	curveMonotoneX: o,
	curveMonotoneY: te,
	curveNatural: c,
	curveStep: l,
	curveStepAfter: ee,
	curveStepBefore: u
}, We = /\s*(?:(\w+)(?=:):|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi, Ge = /* @__PURE__ */ p(function(e, t) {
	let n = Ke(e, /(?:init\b)|(?:initialize\b)/), r = {};
	if (Array.isArray(n)) {
		let e = n.map((e) => e.args);
		ae(e), r = se(r, [...e]);
	} else r = n.args;
	if (!r) return;
	let i = oe(e, t), a = "config";
	return r[a] !== void 0 && (i === "flowchart-v2" && (i = "flowchart"), r[i] = r[a], delete r[a]), r;
}, "detectInit"), Ke = /* @__PURE__ */ p(function(e, t = null) {
	try {
		let n = RegExp(`[%]{2}(?![{]${We.source})(?=[}][%]{2}).*
`, "ig");
		e = e.trim().replace(n, "").replace(/'/gm, "\""), f.debug(`Detecting diagram directive${t === null ? "" : " type:" + t} based on the text:${e}`);
		let r, i = [];
		for (; (r = m.exec(e)) !== null;) if (r.index === m.lastIndex && m.lastIndex++, r && !t || t && r[1]?.match(t) || t && r[2]?.match(t)) {
			let e = r[1] ? r[1] : r[2], t = r[3] ? r[3].trim() : r[4] ? JSON.parse(r[4].trim()) : null;
			i.push({
				type: e,
				args: t
			});
		}
		return i.length === 0 ? {
			type: e,
			args: null
		} : i.length === 1 ? i[0] : i;
	} catch (n) {
		return f.error(`ERROR: ${n.message} - Unable to parse directive type: '${t}' based on the text: '${e}'`), {
			type: void 0,
			args: null
		};
	}
}, "detectDirective"), qe = /* @__PURE__ */ p(function(e) {
	return e.replace(m, "");
}, "removeDirectives"), Je = /* @__PURE__ */ p(function(e, t) {
	for (let [n, r] of t.entries()) if (r.match(e)) return n;
	return -1;
}, "isSubstringInArray");
function W(e, t) {
	return e ? Ue[`curve${e.charAt(0).toUpperCase() + e.slice(1)}`] ?? t : t;
}
p(W, "interpolateToCurve");
function Ye(e, t) {
	let n = e.trim();
	if (n) return t.securityLevel === "loose" ? n : (0, He.sanitizeUrl)(n);
}
p(Ye, "formatUrl");
var Xe = /* @__PURE__ */ p((e, ...t) => {
	let n = e.split("."), r = n.length - 1, i = n[r], a = window;
	for (let t = 0; t < r; t++) if (a = a[n[t]], !a) {
		f.error(`Function name: ${e} not found in window`);
		return;
	}
	a[i](...t);
}, "runFunc");
function G(e, t) {
	return !e || !t ? 0 : Math.sqrt((t.x - e.x) ** 2 + (t.y - e.y) ** 2);
}
p(G, "distance");
function Ze(e) {
	let t, n = 0;
	return e.forEach((e) => {
		n += G(e, t), t = e;
	}), K(e, n / 2);
}
p(Ze, "traverseEdge");
function Qe(e) {
	return e.length === 1 ? e[0] : Ze(e);
}
p(Qe, "calcLabelPosition");
var $e = /* @__PURE__ */ p((e, t = 2) => {
	let n = 10 ** t;
	return Math.round(e * n) / n;
}, "roundNumber"), K = /* @__PURE__ */ p((e, t) => {
	let n, r = t;
	for (let t of e) {
		if (n) {
			let e = G(t, n);
			if (e === 0) return n;
			if (e < r) r -= e;
			else {
				let i = r / e;
				if (i <= 0) return n;
				if (i >= 1) return {
					x: t.x,
					y: t.y
				};
				if (i > 0 && i < 1) return {
					x: $e((1 - i) * n.x + i * t.x, 5),
					y: $e((1 - i) * n.y + i * t.y, 5)
				};
			}
		}
		n = t;
	}
	throw Error("Could not find a suitable point for the given distance");
}, "calculatePoint"), et = /* @__PURE__ */ p((e, t, n) => {
	f.info(`our points ${JSON.stringify(t)}`), t[0] !== n && (t = t.reverse());
	let r = K(t, 25), i = e ? 10 : 5, a = Math.atan2(t[0].y - r.y, t[0].x - r.x), o = {
		x: 0,
		y: 0
	};
	return o.x = Math.sin(a) * i + (t[0].x + r.x) / 2, o.y = -Math.cos(a) * i + (t[0].y + r.y) / 2, o;
}, "calcCardinalityPosition");
function tt(e, t, n) {
	let r = structuredClone(n);
	f.info("our points", r), t !== "start_left" && t !== "start_right" && r.reverse();
	let i = K(r, 25 + e), a = 10 + e * .5, o = Math.atan2(r[0].y - i.y, r[0].x - i.x), s = {
		x: 0,
		y: 0
	};
	return t === "start_left" ? (s.x = Math.sin(o + Math.PI) * a + (r[0].x + i.x) / 2, s.y = -Math.cos(o + Math.PI) * a + (r[0].y + i.y) / 2) : t === "end_right" ? (s.x = Math.sin(o - Math.PI) * a + (r[0].x + i.x) / 2 - 5, s.y = -Math.cos(o - Math.PI) * a + (r[0].y + i.y) / 2 - 5) : t === "end_left" ? (s.x = Math.sin(o) * a + (r[0].x + i.x) / 2 - 5, s.y = -Math.cos(o) * a + (r[0].y + i.y) / 2 - 5) : (s.x = Math.sin(o) * a + (r[0].x + i.x) / 2, s.y = -Math.cos(o) * a + (r[0].y + i.y) / 2), s;
}
p(tt, "calcTerminalLabelPosition");
function q(e) {
	let t = "", n = "";
	for (let r of e) r !== void 0 && (r.startsWith("color:") || r.startsWith("text-align:") ? n = n + r + ";" : t = t + r + ";");
	return {
		style: t,
		labelStyle: n
	};
}
p(q, "getStylesFromArray");
var nt = 0, rt = /* @__PURE__ */ p(() => (nt++, "id-" + Math.random().toString(36).substr(2, 12) + "-" + nt), "generateId");
function it(e) {
	let t = "";
	for (let n = 0; n < e; n++) t += "0123456789abcdef".charAt(Math.floor(Math.random() * 16));
	return t;
}
p(it, "makeRandomHex");
var at = /* @__PURE__ */ p((e) => it(e.length), "random"), ot = /* @__PURE__ */ p(function() {
	return {
		x: 0,
		y: 0,
		fill: void 0,
		anchor: "start",
		style: "#666",
		width: 100,
		height: 100,
		textMargin: 0,
		rx: 0,
		ry: 0,
		valign: void 0,
		text: ""
	};
}, "getTextObj"), st = /* @__PURE__ */ p(function(e, t) {
	let n = t.text.replace(h.lineBreakRegex, " "), [, r] = Q(t.fontSize), i = e.append("text");
	i.attr("x", t.x), i.attr("y", t.y), i.style("text-anchor", t.anchor), i.style("font-family", t.fontFamily), i.style("font-size", r), i.style("font-weight", t.fontWeight), i.attr("fill", t.fill), t.class !== void 0 && i.attr("class", t.class);
	let a = i.append("tspan");
	return a.attr("x", t.x + t.textMargin * 2), a.attr("fill", t.fill), a.text(n), i;
}, "drawSimpleText"), ct = B((e, t, n) => {
	if (!e || (n = Object.assign({
		fontSize: 12,
		fontWeight: 400,
		fontFamily: "Arial",
		joinWith: "<br/>"
	}, n), h.lineBreakRegex.test(e))) return e;
	let r = e.split(" ").filter(Boolean), i = [], a = "";
	return r.forEach((e, o) => {
		let s = Y(`${e} `, n), c = Y(a, n);
		if (s > t) {
			let { hyphenatedStrings: r, remainingWord: o } = lt(e, t, "-", n);
			i.push(a, ...r), a = o;
		} else c + s >= t ? (i.push(a), a = e) : a = [a, e].filter(Boolean).join(" ");
		o + 1 === r.length && i.push(a);
	}), i.filter((e) => e !== "").join(n.joinWith);
}, (e, t, n) => `${e}${t}${n.fontSize}${n.fontWeight}${n.fontFamily}${n.joinWith}`), lt = B((e, t, n = "-", r) => {
	r = Object.assign({
		fontSize: 12,
		fontWeight: 400,
		fontFamily: "Arial",
		margin: 0
	}, r);
	let i = [...e], a = [], o = "";
	return i.forEach((e, s) => {
		let c = `${o}${e}`;
		if (Y(c, r) >= t) {
			let e = s + 1, t = i.length === e, r = `${c}${n}`;
			a.push(t ? c : r), o = "";
		} else o = c;
	}), {
		hyphenatedStrings: a,
		remainingWord: o
	};
}, (e, t, n = "-", r) => `${e}${t}${n}${r.fontSize}${r.fontWeight}${r.fontFamily}`);
function J(e, t) {
	return X(e, t).height;
}
p(J, "calculateTextHeight");
function Y(e, t) {
	return X(e, t).width;
}
p(Y, "calculateTextWidth");
var X = B((e, t) => {
	let { fontSize: n = 12, fontFamily: r = "Arial", fontWeight: i = 400 } = t;
	if (!e) return {
		width: 0,
		height: 0
	};
	let [, a] = Q(n), o = ["sans-serif", r], s = e.split(h.lineBreakRegex), c = [], l = ie("body");
	if (!l.remove) return {
		width: 0,
		height: 0,
		lineHeight: 0
	};
	let u = l.append("svg");
	for (let e of o) {
		let t = 0, n = {
			width: 0,
			height: 0,
			lineHeight: 0
		};
		for (let r of s) {
			let o = ot();
			o.text = r || "​";
			let s = st(u, o).style("font-size", a).style("font-weight", i).style("font-family", e), c = (s._groups || s)[0][0].getBBox();
			if (c.width === 0 && c.height === 0) throw Error("svg element not in render tree");
			n.width = Math.round(Math.max(n.width, c.width)), t = Math.round(c.height), n.height += t, n.lineHeight = Math.round(Math.max(n.lineHeight, t));
		}
		c.push(n);
	}
	return u.remove(), c[isNaN(c[1].height) || isNaN(c[1].width) || isNaN(c[1].lineHeight) || c[0].height > c[1].height && c[0].width > c[1].width && c[0].lineHeight > c[1].lineHeight ? 0 : 1];
}, (e, t) => `${e}${t.fontSize}${t.fontWeight}${t.fontFamily}`), ut = class {
	constructor(e = !1, t) {
		this.count = 0, this.count = t ? t.length : 0, this.next = e ? () => this.count++ : () => Date.now();
	}
	static {
		p(this, "InitIDGenerator");
	}
}, Z, dt = /* @__PURE__ */ p(function(e) {
	return Z ||= document.createElement("div"), e = escape(e).replace(/%26/g, "&").replace(/%23/g, "#").replace(/%3B/g, ";"), Z.innerHTML = e, unescape(Z.textContent);
}, "entityDecode");
function ft(e) {
	return "str" in e;
}
p(ft, "isDetailedError");
var pt = /* @__PURE__ */ p((e, t, n, r) => {
	if (!r) return;
	let i = e.node()?.getBBox();
	i && e.append("text").text(r).attr("text-anchor", "middle").attr("x", i.x + i.width / 2).attr("y", -n).attr("class", t);
}, "insertTitle"), Q = /* @__PURE__ */ p((e) => {
	if (typeof e == "number") return [e, e + "px"];
	let t = parseInt(e ?? "", 10);
	return Number.isNaN(t) ? [void 0, void 0] : e === String(t) ? [t, e + "px"] : [t, e];
}, "parseFontSize");
function $(e, t) {
	return Ve({}, e, t);
}
p($, "cleanAndMerge");
var mt = {
	assignWithDepth: se,
	wrapLabel: ct,
	calculateTextHeight: J,
	calculateTextWidth: Y,
	calculateTextDimensions: X,
	cleanAndMerge: $,
	detectInit: Ge,
	detectDirective: Ke,
	isSubstringInArray: Je,
	interpolateToCurve: W,
	calcLabelPosition: Qe,
	calcCardinalityPosition: et,
	calcTerminalLabelPosition: tt,
	formatUrl: Ye,
	getStylesFromArray: q,
	generateId: rt,
	random: at,
	runFunc: Xe,
	entityDecode: dt,
	insertTitle: pt,
	isLabelCoordinateInPath: yt,
	parseFontSize: Q,
	InitIDGenerator: ut
}, ht = /* @__PURE__ */ p(function(e) {
	let t = e;
	return t = t.replace(/style.*:\S*#.*;/g, function(e) {
		return e.substring(0, e.length - 1);
	}), t = t.replace(/classDef.*:\S*#.*;/g, function(e) {
		return e.substring(0, e.length - 1);
	}), t = t.replace(/#\w+;/g, function(e) {
		let t = e.substring(1, e.length - 1);
		return /^\+?\d+$/.test(t) ? "ﬂ°°" + t + "¶ß" : "ﬂ°" + t + "¶ß";
	}), t;
}, "encodeEntities"), gt = /* @__PURE__ */ p(function(e) {
	return e.replace(/ﬂ°°/g, "&#").replace(/ﬂ°/g, "&").replace(/¶ß/g, ";");
}, "decodeEntities"), _t = /* @__PURE__ */ p((e, t, { counter: n = 0, prefix: r, suffix: i }, a) => a || `${r ? `${r}_` : ""}${e}_${t}_${n}${i ? `_${i}` : ""}`, "getEdgeId");
function vt(e) {
	return e ?? null;
}
p(vt, "handleUndefinedAttr");
function yt(e, t) {
	let n = Math.round(e.x), r = Math.round(e.y), i = t.replace(/(\d+\.\d+)/g, (e) => Math.round(parseFloat(e)).toString());
	return i.includes(n.toString()) || i.includes(r.toString());
}
p(yt, "isLabelCoordinateInPath");
export { ke as A, Te as B, E as C, Ne as D, Me as E, j as F, pe as G, C as H, w as I, ue as K, O as L, T as M, Ce as N, Ae as O, Se as P, De as R, M as S, k as T, S as U, Ee as V, ye as W, ct as _, gt as a, D as b, _t as c, W as d, ft as f, mt as g, qe as h, $ as i, A as j, je as k, q as l, at as m, J as n, ht as o, Q as p, Y as r, rt as s, X as t, vt as u, V as v, we as w, N as x, R as y, Oe as z };
