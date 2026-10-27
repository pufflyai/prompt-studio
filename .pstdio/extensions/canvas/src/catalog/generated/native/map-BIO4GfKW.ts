// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { $ as e, F as t, G as n, H as r, I as i, M as a, P as o, Q as s, R as c, S as ee, Z as l, _ as u, b as d, f, g as p, it as m, j as h, k as g, l as _, q as v, rt as y, tt as b, v as te, w as ne, x as re, y as ie, z as x } from "./graphlib-DXFnjeo9.ts";
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_baseCreate.js
var S = Object.create, ae = function() {
	function e() {}
	return function(t) {
		if (!l(t)) return {};
		if (S) return S(t);
		e.prototype = t;
		var n = new e();
		return e.prototype = void 0, n;
	};
}();
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_copyArray.js
function C(e, t) {
	var n = -1, r = e.length;
	for (t ||= Array(r); ++n < r;) t[n] = e[n];
	return t;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_baseAssignValue.js
function w(e, t, n) {
	t == "__proto__" && v ? v(e, t, {
		configurable: !0,
		enumerable: !0,
		value: n,
		writable: !0
	}) : e[t] = n;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_assignValue.js
var oe = Object.prototype.hasOwnProperty;
function T(e, t, n) {
	var i = e[t];
	(!(oe.call(e, t) && r(i, n)) || n === void 0 && !(t in e)) && w(e, t, n);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_copyObject.js
function E(e, t, n, r) {
	var i = !n;
	n ||= {};
	for (var a = -1, o = t.length; ++a < o;) {
		var s = t[a], c = r ? r(n[s], e[s], s, n, e) : void 0;
		c === void 0 && (c = e[s]), i ? w(n, s, c) : T(n, s, c);
	}
	return n;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_nativeKeysIn.js
function se(e) {
	var t = [];
	if (e != null) for (var n in Object(e)) t.push(n);
	return t;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_baseKeysIn.js
var D = Object.prototype.hasOwnProperty;
function ce(e) {
	if (!l(e)) return se(e);
	var t = c(e), n = [];
	for (var r in e) (r != "constructor" || !t && D.call(e, r)) && n.push(r);
	return n;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/keysIn.js
function O(e) {
	return x(e) ? a(e, !0) : ce(e);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_getPrototype.js
var k = h(Object.getPrototypeOf, Object);
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_baseAssign.js
function le(e, t) {
	return e && E(t, g(t), e);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_baseAssignIn.js
function ue(e, t) {
	return e && E(t, O(t), e);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_cloneBuffer.js
var A = typeof exports == "object" && exports && !exports.nodeType && exports, j = A && typeof module == "object" && module && !module.nodeType && module, M = j && j.exports === A ? m.Buffer : void 0, N = M ? M.allocUnsafe : void 0;
function P(e, t) {
	if (t) return e.slice();
	var n = e.length, r = N ? N(n) : new e.constructor(n);
	return e.copy(r), r;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_copySymbols.js
function de(e, t) {
	return E(e, d(e), t);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_getSymbolsIn.js
var F = Object.getOwnPropertySymbols ? function(e) {
	for (var t = []; e;) ne(t, d(e)), e = k(e);
	return t;
} : re;
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_copySymbolsIn.js
function fe(e, t) {
	return E(e, F(e), t);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_getAllKeysIn.js
function pe(e) {
	return ie(e, O, F);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_initCloneArray.js
var I = Object.prototype.hasOwnProperty;
function L(e) {
	var t = e.length, n = new e.constructor(t);
	return t && typeof e[0] == "string" && I.call(e, "index") && (n.index = e.index, n.input = e.input), n;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_cloneArrayBuffer.js
function R(e) {
	var t = new e.constructor(e.byteLength);
	return new p(t).set(new p(e)), t;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_cloneDataView.js
function z(e, t) {
	var n = t ? R(e.buffer) : e.buffer;
	return new e.constructor(n, e.byteOffset, e.byteLength);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_cloneRegExp.js
var B = /\w*$/;
function me(e) {
	var t = new e.constructor(e.source, B.exec(e));
	return t.lastIndex = e.lastIndex, t;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_cloneSymbol.js
var V = y ? y.prototype : void 0, H = V ? V.valueOf : void 0;
function he(e) {
	return H ? Object(H.call(e)) : {};
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_cloneTypedArray.js
function U(e, t) {
	var n = t ? R(e.buffer) : e.buffer;
	return new e.constructor(n, e.byteOffset, e.length);
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_initCloneByTag.js
var ge = "[object Boolean]", _e = "[object Date]", ve = "[object Map]", ye = "[object Number]", be = "[object RegExp]", xe = "[object Set]", Se = "[object String]", Ce = "[object Symbol]", we = "[object ArrayBuffer]", Te = "[object DataView]", Ee = "[object Float32Array]", De = "[object Float64Array]", Oe = "[object Int8Array]", ke = "[object Int16Array]", Ae = "[object Int32Array]", je = "[object Uint8Array]", Me = "[object Uint8ClampedArray]", Ne = "[object Uint16Array]", Pe = "[object Uint32Array]";
function Fe(e, t, n) {
	var r = e.constructor;
	switch (t) {
		case we: return R(e);
		case ge:
		case _e: return new r(+e);
		case Te: return z(e, n);
		case Ee:
		case De:
		case Oe:
		case ke:
		case Ae:
		case je:
		case Me:
		case Ne:
		case Pe: return U(e, n);
		case ve: return new r();
		case ye:
		case Se: return new r(e);
		case be: return me(e);
		case xe: return new r();
		case Ce: return he(e);
	}
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_initCloneObject.js
function W(e) {
	return typeof e.constructor == "function" && !c(e) ? ae(k(e)) : {};
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_baseIsMap.js
var Ie = "[object Map]";
function Le(e) {
	return b(e) && u(e) == Ie;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/isMap.js
var G = o && o.isMap, Re = G ? t(G) : Le, ze = "[object Set]";
function Be(e) {
	return b(e) && u(e) == ze;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/isSet.js
var K = o && o.isSet, Ve = K ? t(K) : Be, He = 1, Ue = 2, We = 4, q = "[object Arguments]", Ge = "[object Array]", Ke = "[object Boolean]", qe = "[object Date]", Je = "[object Error]", J = "[object Function]", Ye = "[object GeneratorFunction]", Xe = "[object Map]", Ze = "[object Number]", Y = "[object Object]", Qe = "[object RegExp]", $e = "[object Set]", et = "[object String]", tt = "[object Symbol]", nt = "[object WeakMap]", rt = "[object ArrayBuffer]", it = "[object DataView]", X = "[object Float32Array]", at = "[object Float64Array]", ot = "[object Int8Array]", st = "[object Int16Array]", ct = "[object Int32Array]", lt = "[object Uint8Array]", ut = "[object Uint8ClampedArray]", dt = "[object Uint16Array]", ft = "[object Uint32Array]", Z = {};
Z[q] = Z[Ge] = Z[rt] = Z[it] = Z[Ke] = Z[qe] = Z[X] = Z[at] = Z[ot] = Z[st] = Z[ct] = Z[Xe] = Z[Ze] = Z[Y] = Z[Qe] = Z[$e] = Z[et] = Z[tt] = Z[lt] = Z[ut] = Z[dt] = Z[ft] = !0, Z[Je] = Z[J] = Z[nt] = !1;
function Q(e, t, r, a, o, c) {
	var d, f = t & He, p = t & Ue, m = t & We;
	if (r && (d = o ? r(e, a, o, c) : r(e)), d !== void 0) return d;
	if (!l(e)) return e;
	var h = s(e);
	if (h) {
		if (d = L(e), !f) return C(e, d);
	} else {
		var _ = u(e), v = _ == J || _ == Ye;
		if (i(e)) return P(e, f);
		if (_ == Y || _ == q || v && !o) {
			if (d = p || v ? {} : W(e), !f) return p ? fe(e, ue(d, e)) : de(e, le(d, e));
		} else {
			if (!Z[_]) return o ? e : {};
			d = Fe(e, _, f);
		}
	}
	c ||= new ee();
	var y = c.get(e);
	if (y) return y;
	c.set(e, d), Ve(e) ? e.forEach(function(n) {
		d.add(Q(n, t, r, n, e, c));
	}) : Re(e) && e.forEach(function(n, i) {
		d.set(i, Q(n, t, r, i, e, c));
	});
	var b = h ? void 0 : (m ? p ? pe : te : p ? O : g)(e);
	return n(b || e, function(n, i) {
		b && (i = n, n = e[i]), T(d, i, Q(n, t, r, i, e, c));
	}), d;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/_baseMap.js
function $(e, t) {
	var n = -1, r = x(e) ? Array(e.length) : [];
	return _(e, function(e, i, a) {
		r[++n] = t(e, i, a);
	}), r;
}
// node_modules/.bun/lodash-es@4.18.1/node_modules/lodash-es/map.js
function pt(t, n) {
	return (s(t) ? e : $)(t, f(n, 3));
}
export { U as a, O as c, w as d, C as f, W as i, E as l, $ as n, P as o, Q as r, k as s, pt as t, T as u };
