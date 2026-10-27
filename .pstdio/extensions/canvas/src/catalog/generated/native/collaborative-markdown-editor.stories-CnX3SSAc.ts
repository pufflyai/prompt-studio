// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { G as e, W as t, a as n, d as r, i, n as a, nt as o, r as s, t as c, tt as l } from "./list-marker-width-plugin-q77pywDH.ts";
import { Ft as u, H as d, It as f, Lt as p, M as m, N as h, Nt as g, Pn as _, Qt as ee, Rn as te, Rt as ne, Sn as v, U as re, Un as ie, Xn as ae, Yt as oe, _t as se, at as ce, bn as le, bt as ue, ct as de, en as fe, ft as pe, gt as me, it as he, jn as ge, jt as _e, lt as y, n as ve, nn as b, qn as ye, r as be, rn as xe, vn as Se, wn as Ce, xn as we } from "./rich-text-theme-C7PhYVHR.ts";
import { t as Te } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { a as Ee, t as De } from "./FloatingTextFormatToolbarPlugin-DFMFg0dp.ts";
import * as Oe from "react";
import { createContext as ke, useCallback as Ae, useContext as je, useEffect as x, useMemo as Me, useRef as Ne, useState as Pe } from "react";
import { Box as Fe, Flex as Ie, Heading as Le, VStack as Re } from "@chakra-ui/react";
import { Fragment as ze, jsx as S, jsxs as Be } from "react/jsx-runtime";
import { createPortal as Ve } from "react-dom";
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalCollaborationContext.prod.mjs
var He = [
	["Cat", "rgb(125, 50, 0)"],
	["Dog", "rgb(100, 0, 0)"],
	["Rabbit", "rgb(150, 0, 0)"],
	["Frog", "rgb(200, 0, 0)"],
	["Fox", "rgb(200, 75, 0)"],
	["Hedgehog", "rgb(0, 75, 0)"],
	["Pigeon", "rgb(0, 125, 0)"],
	["Squirrel", "rgb(75, 100, 0)"],
	["Bear", "rgb(125, 100, 0)"],
	["Tiger", "rgb(0, 0, 150)"],
	["Leopard", "rgb(0, 0, 200)"],
	["Zebra", "rgb(0, 0, 250)"],
	["Wolf", "rgb(0, 100, 150)"],
	["Owl", "rgb(0, 100, 100)"],
	["Gull", "rgb(100, 0, 100)"],
	["Squid", "rgb(150, 0, 150)"]
], Ue = He[Math.floor(Math.random() * He.length)], We = ke(null);
function Ge() {
	return {
		color: Ue[1],
		isCollabActive: !1,
		name: Ue[0],
		yjsDocMap: /* @__PURE__ */ new Map()
	};
}
var Ke = Ge();
function qe({ children: e }) {
	let t = Me(() => Ge(), []);
	return S(We.Provider, {
		value: t,
		children: e
	});
}
function Je(e, t) {
	let n = je(We);
	return n ?? function(e, ...t) {
		let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
		r.append("code", e);
		for (let e of t) r.append("v", e);
		n.search = r.toString(), console.warn(`Minified Lexical warning #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
	}(319), n ??= Ke, e != null && (n.name = e), t != null && (n.color = t), n;
}
// node_modules/.bun/lib0@0.2.117/node_modules/lib0/map.js
var C = () => /* @__PURE__ */ new Map(), Ye = (e) => {
	let t = C();
	return e.forEach((e, n) => {
		t.set(n, e);
	}), t;
}, Xe = (e, t, n) => {
	let r = e.get(t);
	return r === void 0 && e.set(t, r = n()), r;
}, Ze = (e, t) => {
	let n = [];
	for (let [r, i] of e) n.push(t(i, r));
	return n;
}, Qe = (e, t) => {
	for (let [n, r] of e) if (t(r, n)) return !0;
	return !1;
}, $e = () => /* @__PURE__ */ new Set(), et = (e) => e[e.length - 1], tt = (e, t) => {
	for (let n = 0; n < t.length; n++) e.push(t[n]);
}, nt = Array.from, rt = (e, t) => {
	for (let n = 0; n < e.length; n++) if (!t(e[n], n, e)) return !1;
	return !0;
}, it = (e, t) => {
	for (let n = 0; n < e.length; n++) if (t(e[n], n, e)) return !0;
	return !1;
}, at = (e, t) => {
	let n = Array(e);
	for (let r = 0; r < e; r++) n[r] = t(r, n);
	return n;
}, ot = Array.isArray, st = class {
	constructor() {
		this._observers = C();
	}
	on(e, t) {
		return Xe(this._observers, e, $e).add(t), t;
	}
	once(e, t) {
		let n = (...r) => {
			this.off(e, n), t(...r);
		};
		this.on(e, n);
	}
	off(e, t) {
		let n = this._observers.get(e);
		n !== void 0 && (n.delete(t), n.size === 0 && this._observers.delete(e));
	}
	emit(e, t) {
		return nt((this._observers.get(e) || C()).values()).forEach((e) => e(...t));
	}
	destroy() {
		this._observers = C();
	}
}, ct = class {
	constructor() {
		this._observers = C();
	}
	on(e, t) {
		Xe(this._observers, e, $e).add(t);
	}
	once(e, t) {
		let n = (...r) => {
			this.off(e, n), t(...r);
		};
		this.on(e, n);
	}
	off(e, t) {
		let n = this._observers.get(e);
		n !== void 0 && (n.delete(t), n.size === 0 && this._observers.delete(e));
	}
	emit(e, t) {
		return nt((this._observers.get(e) || C()).values()).forEach((e) => e(...t));
	}
	destroy() {
		this._observers = C();
	}
}, w = Math.floor, lt = Math.abs, ut = (e, t) => e < t ? e : t, dt = (e, t) => e > t ? e : t;
Number.isNaN;
var ft = Math.pow, pt = (e) => e === 0 ? 1 / e < 0 : e < 0, mt = 2 ** 53 - 1, ht = -(2 ** 53 - 1), gt = Number.isInteger || ((e) => typeof e == "number" && isFinite(e) && w(e) === e);
Number.isNaN, Number.parseInt;
// node_modules/.bun/lib0@0.2.117/node_modules/lib0/string.js
var _t = String.fromCharCode;
String.fromCodePoint, _t(65535);
var vt = (e) => e.toLowerCase(), yt = /^\s*/g, bt = (e) => e.replace(yt, ""), xt = /([A-Z])/g, St = (e, t) => bt(e.replace(xt, (e) => `${t}${vt(e)}`)), Ct = (e) => {
	let t = unescape(encodeURIComponent(e)), n = t.length, r = new Uint8Array(n);
	for (let e = 0; e < n; e++) r[e] = t.codePointAt(e);
	return r;
}, wt = typeof TextEncoder < "u" ? new TextEncoder() : null, Tt = wt ? (e) => wt.encode(e) : Ct, Et = typeof TextDecoder > "u" ? null : new TextDecoder("utf-8", {
	fatal: !0,
	ignoreBOM: !0
});
/* c8 ignore start */
Et && Et.decode(/* @__PURE__ */ new Uint8Array()).length === 1 && 
/* c8 ignore next */
(Et = null);
var Dt = (e, t) => at(t, () => e).join(""), Ot = class {
	constructor() {
		this.cpos = 0, this.cbuf = /* @__PURE__ */ new Uint8Array(100), this.bufs = [];
	}
}, T = () => new Ot(), kt = (e) => {
	let t = e.cpos;
	for (let n = 0; n < e.bufs.length; n++) t += e.bufs[n].length;
	return t;
}, E = (e) => {
	let t = new Uint8Array(kt(e)), n = 0;
	for (let r = 0; r < e.bufs.length; r++) {
		let i = e.bufs[r];
		t.set(i, n), n += i.length;
	}
	return t.set(new Uint8Array(e.cbuf.buffer, 0, e.cpos), n), t;
}, At = (e, t) => {
	let n = e.cbuf.length;
	n - e.cpos < t && (e.bufs.push(new Uint8Array(e.cbuf.buffer, 0, e.cpos)), e.cbuf = new Uint8Array(dt(n, t) * 2), e.cpos = 0);
}, D = (e, t) => {
	let n = e.cbuf.length;
	e.cpos === n && (e.bufs.push(e.cbuf), e.cbuf = new Uint8Array(n * 2), e.cpos = 0), e.cbuf[e.cpos++] = t;
}, jt = D, O = (e, t) => {
	for (; t > 127;) D(e, 128 | 127 & t), t = w(t / 128);
	D(e, 127 & t);
}, Mt = (e, t) => {
	let n = pt(t);
	for (n && (t = -t), D(e, (t > 63 ? 128 : 0) | (n ? 64 : 0) | 63 & t), t = w(t / 64); t > 0;) D(e, (t > 127 ? 128 : 0) | 127 & t), t = w(t / 128);
}, Nt = /* @__PURE__ */ new Uint8Array(3e4), Pt = Nt.length / 3, Ft = wt && wt.encodeInto ? (e, t) => {
	if (t.length < Pt) {
		/* c8 ignore next */
		let n = wt.encodeInto(t, Nt).written || 0;
		O(e, n);
		for (let t = 0; t < n; t++) D(e, Nt[t]);
	} else k(e, Tt(t));
} : (e, t) => {
	let n = unescape(encodeURIComponent(t)), r = n.length;
	O(e, r);
	for (let t = 0; t < r; t++) D(e, n.codePointAt(t));
}, It = (e, t) => {
	let n = e.cbuf.length, r = e.cpos, i = ut(n - r, t.length), a = t.length - i;
	e.cbuf.set(t.subarray(0, i), r), e.cpos += i, a > 0 && (e.bufs.push(e.cbuf), e.cbuf = new Uint8Array(dt(n * 2, a)), e.cbuf.set(t.subarray(i)), e.cpos = a);
}, k = (e, t) => {
	O(e, t.byteLength), It(e, t);
}, Lt = (e, t) => {
	At(e, t);
	let n = new DataView(e.cbuf.buffer, e.cpos, t);
	return e.cpos += t, n;
}, Rt = (e, t) => Lt(e, 4).setFloat32(0, t, !1), zt = (e, t) => Lt(e, 8).setFloat64(0, t, !1), Bt = (e, t) => Lt(e, 8).setBigInt64(0, t, !1), Vt = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(4)), Ht = (e) => (Vt.setFloat32(0, e), Vt.getFloat32(0) === e), Ut = (e, t) => {
	switch (typeof t) {
		case "string":
			D(e, 119), Ft(e, t);
			break;
		case "number":
			gt(t) && lt(t) <= 2147483647 ? (D(e, 125), Mt(e, t)) : Ht(t) ? (D(e, 124), Rt(e, t)) : (D(e, 123), zt(e, t));
			break;
		case "bigint":
			D(e, 122), Bt(e, t);
			break;
		case "object":
			if (t === null) D(e, 126);
			else if (ot(t)) {
				D(e, 117), O(e, t.length);
				for (let n = 0; n < t.length; n++) Ut(e, t[n]);
			} else if (t instanceof Uint8Array) D(e, 116), k(e, t);
			else {
				D(e, 118);
				let n = Object.keys(t);
				O(e, n.length);
				for (let r = 0; r < n.length; r++) {
					let i = n[r];
					Ft(e, i), Ut(e, t[i]);
				}
			}
			break;
		case "boolean":
			D(e, t ? 120 : 121);
			break;
		default: D(e, 127);
	}
}, Wt = class extends Ot {
	constructor(e) {
		super(), this.w = e, this.s = null, this.count = 0;
	}
	write(e) {
		this.s === e ? this.count++ : (this.count > 0 && O(this, this.count - 1), this.count = 1, this.w(this, e), this.s = e);
	}
}, Gt = (e) => {
	e.count > 0 && (Mt(e.encoder, e.count === 1 ? e.s : -e.s), e.count > 1 && O(e.encoder, e.count - 2));
}, Kt = class {
	constructor() {
		this.encoder = new Ot(), this.s = 0, this.count = 0;
	}
	write(e) {
		this.s === e ? this.count++ : (Gt(this), this.count = 1, this.s = e);
	}
	toUint8Array() {
		return Gt(this), E(this.encoder);
	}
}, qt = (e) => {
	if (e.count > 0) {
		let t = e.diff * 2 + (e.count === 1 ? 0 : 1);
		Mt(e.encoder, t), e.count > 1 && O(e.encoder, e.count - 2);
	}
}, Jt = class {
	constructor() {
		this.encoder = new Ot(), this.s = 0, this.count = 0, this.diff = 0;
	}
	write(e) {
		this.diff === e - this.s ? (this.s = e, this.count++) : (qt(this), this.count = 1, this.diff = e - this.s, this.s = e);
	}
	toUint8Array() {
		return qt(this), E(this.encoder);
	}
}, Yt = class {
	constructor() {
		this.sarr = [], this.s = "", this.lensE = new Kt();
	}
	write(e) {
		this.s += e, this.s.length > 19 && (this.sarr.push(this.s), this.s = ""), this.lensE.write(e.length);
	}
	toUint8Array() {
		let e = new Ot();
		return this.sarr.push(this.s), this.s = "", Ft(e, this.sarr.join("")), It(e, this.lensE.toUint8Array()), E(e);
	}
}, Xt = (e) => Error(e), A = () => {
	throw Xt("Method unimplemented");
}, j = () => {
	throw Xt("Unexpected case");
}, Zt = Xt("Unexpected end of array"), Qt = Xt("Integer out of Range"), $t = class {
	constructor(e) {
		this.arr = e, this.pos = 0;
	}
}, en = (e) => new $t(e), tn = (e) => e.pos !== e.arr.length, nn = (e, t) => {
	let n = new Uint8Array(e.arr.buffer, e.pos + e.arr.byteOffset, t);
	return e.pos += t, n;
}, M = (e) => nn(e, N(e)), rn = (e) => e.arr[e.pos++], N = (e) => {
	let t = 0, n = 1, r = e.arr.length;
	for (; e.pos < r;) {
		let r = e.arr[e.pos++];
		if (t += (r & 127) * n, n *= 128, r < 128) return t;
		/* c8 ignore start */
		if (t > mt) throw Qt;
	}
	throw Zt;
}, an = (e) => {
	let t = e.arr[e.pos++], n = t & 63, r = 64, i = (t & 64) > 0 ? -1 : 1;
	if (!(t & 128)) return i * n;
	let a = e.arr.length;
	for (; e.pos < a;) {
		if (t = e.arr[e.pos++], n += (t & 127) * r, r *= 128, t < 128) return i * n;
		/* c8 ignore start */
		if (n > mt) throw Qt;
	}
	throw Zt;
}, on = Et ? (e) => Et.decode(M(e)) : (e) => {
	let t = N(e);
	if (t === 0) return "";
	{
		let n = String.fromCodePoint(rn(e));
		if (--t < 100) for (; t--;) n += String.fromCodePoint(rn(e));
		else for (; t > 0;) {
			let r = t < 1e4 ? t : 1e4, i = e.arr.subarray(e.pos, e.pos + r);
			e.pos += r, n += String.fromCodePoint.apply(null, i), t -= r;
		}
		return decodeURIComponent(escape(n));
	}
}, sn = (e, t) => {
	let n = new DataView(e.arr.buffer, e.arr.byteOffset + e.pos, t);
	return e.pos += t, n;
}, cn = [
	(e) => void 0,
	(e) => null,
	an,
	(e) => sn(e, 4).getFloat32(0, !1),
	(e) => sn(e, 8).getFloat64(0, !1),
	(e) => sn(e, 8).getBigInt64(0, !1),
	(e) => !1,
	(e) => !0,
	on,
	(e) => {
		let t = N(e), n = {};
		for (let r = 0; r < t; r++) {
			let t = on(e);
			n[t] = ln(e);
		}
		return n;
	},
	(e) => {
		let t = N(e), n = [];
		for (let r = 0; r < t; r++) n.push(ln(e));
		return n;
	},
	M
], ln = (e) => cn[127 - rn(e)](e), un = class extends $t {
	constructor(e, t) {
		super(e), this.reader = t, this.s = null, this.count = 0;
	}
	read() {
		return this.count === 0 && (this.s = this.reader(this), this.count = tn(this) ? N(this) + 1 : -1), this.count--, this.s;
	}
}, dn = class extends $t {
	constructor(e) {
		super(e), this.s = 0, this.count = 0;
	}
	read() {
		if (this.count === 0) {
			this.s = an(this);
			let e = pt(this.s);
			this.count = 1, e && (this.s = -this.s, this.count = N(this) + 2);
		}
		return this.count--, this.s;
	}
}, fn = class extends $t {
	constructor(e) {
		super(e), this.s = 0, this.count = 0, this.diff = 0;
	}
	read() {
		if (this.count === 0) {
			let e = an(this), t = e & 1;
			this.diff = w(e / 2), this.count = 1, t && (this.count = N(this) + 2);
		}
		return this.s += this.diff, this.count--, this.s;
	}
}, pn = class {
	constructor(e) {
		this.decoder = new dn(e), this.str = on(this.decoder), this.spos = 0;
	}
	read() {
		let e = this.spos + this.decoder.read(), t = this.str.slice(this.spos, e);
		return this.spos = e, t;
	}
};
crypto.subtle;
var mn = crypto.getRandomValues.bind(crypto), hn = () => mn(/* @__PURE__ */ new Uint32Array(1))[0], gn = "10000000-1000-4000-8000-100000000000", _n = () => gn.replace(/[018]/g, (e) => (e ^ hn() & 15 >> e / 4).toString(16)), vn = Date.now, yn = (e) => new Promise(e);
Promise.all.bind(Promise);
// node_modules/.bun/lib0@0.2.117/node_modules/lib0/conditions.js
/* c8 ignore next */
var bn = (e) => e === void 0 ? null : e, xn = new class {
	constructor() {
		this.map = /* @__PURE__ */ new Map();
	}
	setItem(e, t) {
		this.map.set(e, t);
	}
	getItem(e) {
		return this.map.get(e);
	}
}(), Sn = !0;
/* c8 ignore start */
try {
	typeof localStorage < "u" && localStorage && (xn = localStorage, Sn = !1);
} catch {}
/* c8 ignore stop */
/* c8 ignore next */
var Cn = xn, wn = (e) => Sn || addEventListener("storage", e), Tn = (e) => Sn || removeEventListener("storage", e), En = Symbol("Equality"), Dn = (e, t) => e === t || !!e?.[En]?.(t) || !1, On = (e) => typeof e == "object", kn = Object.assign, An = Object.keys, jn = (e, t) => {
	for (let n in e) t(e[n], n);
}, Mn = (e, t) => {
	let n = [];
	for (let r in e) n.push(t(e[r], r));
	return n;
}, Nn = (e) => An(e).length, Pn = (e) => {
	for (let t in e) return !1;
	return !0;
}, Fn = (e, t) => {
	for (let n in e) if (!t(e[n], n)) return !1;
	return !0;
}, In = (e, t) => Object.prototype.hasOwnProperty.call(e, t), Ln = (e, t) => e === t || Nn(e) === Nn(t) && Fn(e, (e, n) => (e !== void 0 || In(t, n)) && Dn(t[n], e)), Rn = Object.freeze, zn = (e) => {
	for (let t in e) {
		let n = e[t];
		(typeof n == "object" || typeof n == "function") && zn(e[t]);
	}
	return Rn(e);
}, Bn = (e, t, n = 0) => {
	try {
		for (; n < e.length; n++) e[n](...t);
	} finally {
		n < e.length && Bn(e, t, n + 1);
	}
}, Vn = (e) => e, Hn = (e, t) => {
	if (e === t) return !0;
	if (e == null || t == null || e.constructor !== t.constructor && (e.constructor || Object) !== (t.constructor || Object)) return !1;
	if (e[En] != null) return e[En](t);
	switch (e.constructor) {
		case ArrayBuffer: e = new Uint8Array(e), t = new Uint8Array(t);
		case Uint8Array:
			if (e.byteLength !== t.byteLength) return !1;
			for (let n = 0; n < e.length; n++) if (e[n] !== t[n]) return !1;
			break;
		case Set:
			if (e.size !== t.size) return !1;
			for (let n of e) if (!t.has(n)) return !1;
			break;
		case Map:
			if (e.size !== t.size) return !1;
			for (let n of e.keys()) if (!t.has(n) || !Hn(e.get(n), t.get(n))) return !1;
			break;
		case void 0:
		case Object:
			if (Nn(e) !== Nn(t)) return !1;
			for (let n in e) if (!In(e, n) || !Hn(e[n], t[n])) return !1;
			break;
		case Array:
			if (e.length !== t.length) return !1;
			for (let n = 0; n < e.length; n++) if (!Hn(e[n], t[n])) return !1;
			break;
		default: return !1;
	}
	return !0;
}, Un = (e, t) => t.includes(e), Wn = typeof process < "u" && process.release && /node|io\.js/.test(process.release.name) && Object.prototype.toString.call(typeof process < "u" ? process : 0) === "[object process]", Gn = typeof window < "u" && typeof document < "u" && !Wn;
typeof navigator < "u" && /Mac/.test(navigator.platform);
var P, Kn = [], qn = () => {
	if (P === void 0) {
		if (Wn) {
			P = C();
			let e = process.argv, t = null;
			for (let n = 0; n < e.length; n++) {
				let r = e[n];
				r[0] === "-" ? (t !== null && P.set(t, ""), t = r) : t === null ? Kn.push(r) : (P.set(t, r), t = null);
			}
			t !== null && P.set(t, "");
		} else typeof location == "object" ? (P = C(), (location.search || "?").slice(1).split("&").forEach((e) => {
			if (e.length !== 0) {
				let [t, n] = e.split("=");
				P.set(`--${St(t, "-")}`, n), P.set(`-${St(t, "-")}`, n);
			}
		})) : P = C();
	}
	return P;
}, Jn = (e) => qn().has(e), Yn = (e) => bn(Wn ? process.env[e.toUpperCase().replaceAll("-", "_")] : Cn.getItem(e)), Xn = (e) => Jn("--" + e) || Yn(e) !== null, Zn = Xn("production"), Qn = Wn && Un(process.env.FORCE_COLOR, [
	"true",
	"1",
	"2"
]) || !Jn("--no-colors") && !Xn("no-color") && (!Wn || process.stdout.isTTY) && (!Wn || Jn("--color") || Yn("COLORTERM") !== null || (Yn("TERM") || "").includes("color")), $n = (e) => new Uint8Array(e), er = (e, t, n) => new Uint8Array(e, t, n), tr = (e) => new Uint8Array(e), nr = (e) => {
	let t = "";
	for (let n = 0; n < e.byteLength; n++) t += _t(e[n]);
	return btoa(t);
}, rr = (e) => Buffer.from(e.buffer, e.byteOffset, e.byteLength).toString("base64"), ir = (e) => {
	let t = atob(e), n = $n(t.length);
	for (let e = 0; e < t.length; e++) n[e] = t.charCodeAt(e);
	return n;
}, ar = (e) => {
	let t = Buffer.from(e, "base64");
	return er(t.buffer, t.byteOffset, t.byteLength);
}, or = Gn ? nr : rr, sr = Gn ? ir : ar, cr = (e) => {
	let t = $n(e.byteLength);
	return t.set(e), t;
}, lr = class {
	constructor(e, t) {
		this.left = e, this.right = t;
	}
}, ur = (e, t) => new lr(e, t), dr = (e) => e.next() >= .5, fr = (e, t, n) => w(e.next() * (n + 1 - t) + t), pr = (e, t, n) => w(e.next() * (n + 1 - t) + t), mr = (e, t, n) => pr(e, t, n), hr = (e) => _t(mr(e, 97, 122)), gr = (e, t = 0, n = 20) => {
	let r = mr(e, t, n), i = "";
	for (let t = 0; t < r; t++) i += hr(e);
	return i;
}, _r = (e, t) => t[mr(e, 0, t.length - 1)], vr = Symbol("0schema"), yr = class {
	constructor() {
		this._rerrs = [];
	}
	extend(e, t, n, r = null) {
		this._rerrs.push({
			path: e,
			expected: t,
			has: n,
			message: r
		});
	}
	toString() {
		let e = [];
		for (let t = this._rerrs.length - 1; t > 0; t--) {
			let n = this._rerrs[t];
			/* c8 ignore next */
			e.push(Dt(" ", (this._rerrs.length - t) * 2) + `${n.path == null ? "" : `[${n.path}] `}${n.has} doesn't match ${n.expected}. ${n.message}`);
		}
		return e.join("\n");
	}
}, br = (e, t) => e === t ? !0 : e == null || t == null || e.constructor !== t.constructor ? !1 : e[En] ? Dn(e, t) : ot(e) ? rt(e, (e) => it(t, (t) => br(e, t))) : On(e) ? Fn(e, (e, n) => br(e, t[n])) : !1, F = class {
	static _dilutes = !1;
	extends(e) {
		let [t, n] = [this.shape, e.shape];
		return this.constructor._dilutes && ([n, t] = [t, n]), br(t, n);
	}
	equals(e) {
		return this.constructor === e.constructor && Hn(this.shape, e.shape);
	}
	[vr]() {
		return !0;
	}
	[En](e) {
		return this.equals(e);
	}
	validate(e) {
		return this.check(e);
	}
	/* c8 ignore start */
	check(e, t) {
		A();
	}
	/* c8 ignore stop */
	get nullable() {
		return Zr(this, fi);
	}
	get optional() {
		return new kr(this);
	}
	cast(e) {
		return gi(e, this), e;
	}
	expect(e) {
		return gi(e, this), e;
	}
}, xr = class extends F {
	constructor(e, t) {
		super(), this.shape = e, this._c = t;
	}
	check(e, t = void 0) {
		let n = e?.constructor === this.shape && (this._c == null || this._c(e));
		return !n && t?.extend(null, this.shape.name, e?.constructor.name, e?.constructor === this.shape ? "Check failed" : "Constructor match failed"), n;
	}
}, I = (e, t = null) => new xr(e, t);
I(xr);
var Sr = class extends F {
	constructor(e) {
		super(), this.shape = e;
	}
	check(e, t) {
		let n = this.shape(e);
		return !n && t?.extend(null, "custom prop", e?.constructor.name, "failed to check custom prop"), n;
	}
}, L = (e) => new Sr(e);
I(Sr);
var Cr = class extends F {
	constructor(e) {
		super(), this.shape = e;
	}
	check(e, t) {
		let n = this.shape.some((t) => t === e);
		return !n && t?.extend(null, this.shape.join(" | "), e.toString()), n;
	}
}, wr = (...e) => new Cr(e), Tr = I(Cr), Er = RegExp.escape || ((e) => e.replace(/[().|&,$^[\]]/g, (e) => "\\" + e)), Dr = (e) => {
	if (si.check(e)) return [Er(e)];
	if (Tr.check(e)) return e.shape.map((e) => e + "");
	if (oi.check(e)) return ["[+-]?\\d+.?\\d*"];
	if (ci.check(e)) return [".*"];
	if (Qr.check(e)) return e.shape.map(Dr).flat(1);
	/* c8 ignore next 2 */
	j();
};
I(class extends F {
	constructor(e) {
		super(), this.shape = e, this._r = RegExp("^" + e.map(Dr).map((e) => `(${e.join("|")})`).join("") + "$");
	}
	check(e, t) {
		let n = this._r.exec(e) != null;
		return !n && t?.extend(null, this._r.toString(), e.toString(), "String doesn't match string template."), n;
	}
});
var Or = Symbol("optional"), kr = class extends F {
	constructor(e) {
		super(), this.shape = e;
	}
	check(e, t) {
		let n = e === void 0 || this.shape.check(e);
		return !n && t?.extend(null, "undefined (optional)", "()"), n;
	}
	get [Or]() {
		return !0;
	}
}, Ar = I(kr), jr = class extends F {
	check(e, t) {
		return t?.extend(null, "never", typeof e), !1;
	}
};
new jr(), I(jr);
var Mr = class e extends F {
	constructor(e, t = !1) {
		super(), this.shape = e, this._isPartial = t;
	}
	static _dilutes = !0;
	get partial() {
		return new e(this.shape, !0);
	}
	check(e, t) {
		return e == null ? 
		/* c8 ignore next */
		(t?.extend(null, "object", "null"), !1) : Fn(this.shape, (n, r) => {
			let i = this._isPartial && !In(e, r) || n.check(e[r], t);
			return !i && t?.extend(r.toString(), n.toString(), typeof e[r], "Object property does not match"), i;
		});
	}
}, Nr = (e) => new Mr(e), Pr = I(Mr), Fr = L((e) => e != null && (e.constructor === Object || e.constructor == null)), Ir = class extends F {
	constructor(e, t) {
		super(), this.shape = {
			keys: e,
			values: t
		};
	}
	check(e, t) {
		return e != null && Fn(e, (n, r) => {
			let i = this.shape.keys.check(r, t);
			return !i && t?.extend(r + "", "Record", typeof e, i ? "Key doesn't match schema" : "Value doesn't match value"), i && this.shape.values.check(n, t);
		});
	}
}, Lr = (e, t) => new Ir(e, t), Rr = I(Ir), zr = class extends F {
	constructor(e) {
		super(), this.shape = e;
	}
	check(e, t) {
		return e != null && Fn(this.shape, (n, r) => {
			let i = n.check(e[r], t);
			return !i && t?.extend(r.toString(), "Tuple", typeof n), i;
		});
	}
}, Br = (...e) => new zr(e);
I(zr);
var Vr = class extends F {
	constructor(e) {
		super(), this.shape = e.length === 1 ? e[0] : new Xr(e);
	}
	check(e, t) {
		let n = ot(e) && rt(e, (e) => this.shape.check(e));
		return !n && t?.extend(null, "Array", ""), n;
	}
}, Hr = (...e) => new Vr(e), Ur = I(Vr), Wr = L((e) => ot(e)), Gr = class extends F {
	constructor(e, t) {
		super(), this.shape = e, this._c = t;
	}
	check(e, t) {
		let n = e instanceof this.shape && (this._c == null || this._c(e));
		return !n && t?.extend(null, this.shape.name, e?.constructor.name), n;
	}
}, Kr = (e, t = null) => new Gr(e, t);
I(Gr);
var qr = Kr(F), Jr = I(class extends F {
	constructor(e) {
		super(), this.len = e.length - 1, this.args = Br(...e.slice(-1)), this.res = e[this.len];
	}
	check(e, t) {
		let n = e.constructor === Function && e.length <= this.len;
		return !n && t?.extend(null, "function", typeof e), n;
	}
}), Yr = L((e) => typeof e == "function");
I(class extends F {
	constructor(e) {
		super(), this.shape = e;
	}
	check(e, t) {
		let n = rt(this.shape, (n) => n.check(e, t));
		return !n && t?.extend(null, "Intersectinon", typeof e), n;
	}
}, (e) => e.shape.length > 0);
var Xr = class extends F {
	static _dilutes = !0;
	constructor(e) {
		super(), this.shape = e;
	}
	check(e, t) {
		let n = it(this.shape, (n) => n.check(e, t));
		return t?.extend(null, "Union", typeof e), n;
	}
}, Zr = (...e) => e.findIndex((e) => Qr.check(e)) >= 0 ? Zr(...e.map((e) => hi(e)).map((e) => Qr.check(e) ? e.shape : [e]).flat(1)) : e.length === 1 ? e[0] : new Xr(e), Qr = I(Xr), $r = () => !0, ei = L($r), ti = I(Sr, (e) => e.shape === $r), ni = L((e) => typeof e == "bigint"), ri = L((e) => e === ni), ii = L((e) => typeof e == "symbol");
L((e) => e === ii);
var ai = L((e) => typeof e == "number"), oi = L((e) => e === ai), si = L((e) => typeof e == "string"), ci = L((e) => e === si), li = L((e) => typeof e == "boolean"), ui = L((e) => e === li), di = wr(void 0);
I(Cr, (e) => e.shape.length === 1 && e.shape[0] === void 0), wr(void 0);
var fi = wr(null), pi = I(Cr, (e) => e.shape.length === 1 && e.shape[0] === null);
I(Uint8Array), I(xr, (e) => e.shape === Uint8Array);
var mi = Zr(ai, si, fi, di, ni, li, ii);
(() => {
	let e = Hr(ei), t = Lr(si, ei), n = Zr(ai, si, fi, li, e, t);
	return e.shape = n, t.shape.values = n, n;
})();
var hi = (e) => {
	if (qr.check(e)) return e;
	if (Fr.check(e)) {
		let t = {};
		for (let n in e) t[n] = hi(e[n]);
		return Nr(t);
	}
	if (Wr.check(e)) return Zr(...e.map(hi));
	if (mi.check(e)) return wr(e);
	if (Yr.check(e)) return I(e);
	/* c8 ignore next */
	j();
}, gi = Zn ? () => {} : (e, t) => {
	let n = new yr();
	if (!t.check(e, n)) throw Xt(`Expected value to be of type ${t.constructor.name}.\n${n.toString()}`);
}, _i = class {
	constructor(e) {
		this.patterns = [], this.$state = e;
	}
	if(e, t) {
		return this.patterns.push({
			if: hi(e),
			h: t
		}), this;
	}
	else(e) {
		return this.if(ei, e);
	}
	done() {
		return (e, t) => {
			for (let n = 0; n < this.patterns.length; n++) {
				let r = this.patterns[n];
				if (r.if.check(e)) return r.h(e, t);
			}
			throw Xt("Unhandled pattern");
		};
	}
}, vi = ((e) => new _i(e))(ei).if(oi, (e, t) => fr(t, ht, mt)).if(ci, (e, t) => gr(t)).if(ui, (e, t) => dr(t)).if(ri, (e, t) => BigInt(fr(t, ht, mt))).if(Qr, (e, t) => yi(t, _r(t, e.shape))).if(Pr, (e, t) => {
	let n = {};
	for (let r in e.shape) {
		let i = e.shape[r];
		if (Ar.check(i)) {
			if (dr(t)) continue;
			i = i.shape;
		}
		n[r] = vi(i, t);
	}
	return n;
}).if(Ur, (e, t) => {
	let n = [], r = pr(t, 0, 42);
	for (let i = 0; i < r; i++) n.push(yi(t, e.shape));
	return n;
}).if(Tr, (e, t) => _r(t, e.shape)).if(pi, (e, t) => null).if(Jr, (e, t) => {
	let n = yi(t, e.res);
	return () => n;
}).if(ti, (e, t) => yi(t, _r(t, [
	ai,
	si,
	fi,
	di,
	ni,
	li,
	Hr(ai),
	Lr(Zr("a", "b", "c"), ai)
]))).if(Rr, (e, t) => {
	let n = {}, r = fr(t, 0, 3);
	for (let i = 0; i < r; i++) {
		let r = yi(t, e.shape.keys);
		n[r] = yi(t, e.shape.values);
	}
	return n;
}).done(), yi = (e, t) => vi(hi(t), e), bi = typeof document < "u" ? document : {};
L((e) => e.nodeType === Ti), typeof DOMParser < "u" && new DOMParser(), L((e) => e.nodeType === Si), L((e) => e.nodeType === Ci);
var xi = (e) => Ze(e, (e, t) => `${t}:${e};`).join(""), Si = bi.ELEMENT_NODE, Ci = bi.TEXT_NODE;
bi.CDATA_SECTION_NODE, bi.COMMENT_NODE;
var wi = bi.DOCUMENT_NODE;
bi.DOCUMENT_TYPE_NODE;
var Ti = bi.DOCUMENT_FRAGMENT_NODE;
L((e) => e.nodeType === wi);
/* c8 ignore stop */
// node_modules/.bun/lib0@0.2.117/node_modules/lib0/symbol.js
var Ei = Symbol, Di = Ei(), Oi = Ei(), ki = Ei(), Ai = Ei(), ji = Ei(), Mi = Ei(), Ni = Ei(), Pi = Ei(), Fi = Ei(), Ii = (e) => {
	e.length === 1 && e[0]?.constructor === Function && (e = e[0]());
	let t = [], n = [], r = 0;
	for (; r < e.length; r++) {
		let n = e[r];
		if (n === void 0) break;
		if (n.constructor === String || n.constructor === Number) t.push(n);
		else if (n.constructor === Object) break;
	}
	for (r > 0 && n.push(t.join("")); r < e.length; r++) {
		let t = e[r];
		t instanceof Symbol || n.push(t);
	}
	return n;
};
vn();
/* c8 ignore stop */
// node_modules/.bun/lib0@0.2.117/node_modules/lib0/logging.js
var Li = {
	[Di]: ur("font-weight", "bold"),
	[Oi]: ur("font-weight", "normal"),
	[ki]: ur("color", "blue"),
	[ji]: ur("color", "green"),
	[Ai]: ur("color", "grey"),
	[Mi]: ur("color", "red"),
	[Ni]: ur("color", "purple"),
	[Pi]: ur("color", "orange"),
	[Fi]: ur("color", "black")
}, Ri = Qn ? (e) => {
	e.length === 1 && e[0]?.constructor === Function && (e = e[0]());
	let t = [], n = [], r = C(), i = [], a = 0;
	for (; a < e.length; a++) {
		let i = e[a], o = Li[i];
		if (o !== void 0) r.set(o.left, o.right);
		else {
			if (i === void 0) break;
			if (i.constructor === String || i.constructor === Number) {
				let e = xi(r);
				a > 0 || e.length > 0 ? (t.push("%c" + i), n.push(e)) : t.push(i);
			} else break;
		}
	}
	for (a > 0 && (i = n, i.unshift(t.join(""))); a < e.length; a++) {
		let t = e[a];
		t instanceof Symbol || i.push(t);
	}
	return i;
} : Ii, zi = (...e) => {
	/* c8 ignore next */
	console.log(...Ri(e)), Vi.forEach((t) => t.print(e));
}, Bi = (...e) => {
	console.warn(...Ri(e)), e.unshift(Pi), Vi.forEach((t) => t.print(e));
}, Vi = $e(), Hi = (e) => ({
	[Symbol.iterator]() {
		return this;
	},
	next: e
}), Ui = (e, t) => Hi(() => {
	let n;
	do
		n = e.next();
	while (!n.done && !t(n.value));
	return n;
}), Wi = (e, t) => Hi(() => {
	let { done: n, value: r } = e.next();
	return {
		done: n,
		value: n ? void 0 : t(r)
	};
}), Gi = class {
	constructor(e, t) {
		this.clock = e, this.len = t;
	}
}, Ki = class {
	constructor() {
		this.clients = /* @__PURE__ */ new Map();
	}
}, qi = (e, t, n) => t.clients.forEach((t, r) => {
	let i = e.doc.store.clients.get(r);
	if (i != null) {
		let r = i[i.length - 1], a = r.id.clock + r.length;
		for (let r = 0, o = t[r]; r < t.length && o.clock < a; o = t[++r]) co(e, i, o.clock, o.len, n);
	}
}), Ji = (e, t) => {
	let n = 0, r = e.length - 1;
	for (; n <= r;) {
		let i = w((n + r) / 2), a = e[i], o = a.clock;
		if (o <= t) {
			if (t < o + a.len) return i;
			n = i + 1;
		} else r = i - 1;
	}
	return null;
}, Yi = (e, t) => {
	let n = e.clients.get(t.client);
	return n !== void 0 && Ji(n, t.clock) !== null;
}, Xi = (e) => {
	e.clients.forEach((e) => {
		e.sort((e, t) => e.clock - t.clock);
		let t, n;
		for (t = 1, n = 1; t < e.length; t++) {
			let r = e[n - 1], i = e[t];
			r.clock + r.len >= i.clock ? r.len = dt(r.len, i.clock + i.len - r.clock) : (n < t && (e[n] = i), n++);
		}
		e.length = n;
	});
}, Zi = (e) => {
	let t = new Ki();
	for (let n = 0; n < e.length; n++) e[n].clients.forEach((r, i) => {
		if (!t.clients.has(i)) {
			let a = r.slice();
			for (let t = n + 1; t < e.length; t++) tt(a, e[t].clients.get(i) || []);
			t.clients.set(i, a);
		}
	});
	return Xi(t), t;
}, Qi = (e, t, n, r) => {
	Xe(e.clients, t, () => []).push(new Gi(n, r));
}, $i = () => new Ki(), ea = (e) => {
	let t = $i();
	return e.clients.forEach((e, n) => {
		let r = [];
		for (let t = 0; t < e.length; t++) {
			let n = e[t];
			if (n.deleted) {
				let i = n.id.clock, a = n.length;
				if (t + 1 < e.length) for (let n = e[t + 1]; t + 1 < e.length && n.deleted; n = e[++t + 1]) a += n.length;
				r.push(new Gi(i, a));
			}
		}
		r.length > 0 && t.clients.set(n, r);
	}), t;
}, ta = (e, t) => {
	O(e.restEncoder, t.clients.size), nt(t.clients.entries()).sort((e, t) => t[0] - e[0]).forEach(([t, n]) => {
		e.resetDsCurVal(), O(e.restEncoder, t);
		let r = n.length;
		O(e.restEncoder, r);
		for (let t = 0; t < r; t++) {
			let r = n[t];
			e.writeDsClock(r.clock), e.writeDsLen(r.len);
		}
	});
}, na = (e) => {
	let t = new Ki(), n = N(e.restDecoder);
	for (let r = 0; r < n; r++) {
		e.resetDsCurVal();
		let n = N(e.restDecoder), r = N(e.restDecoder);
		if (r > 0) {
			let i = Xe(t.clients, n, () => []);
			for (let t = 0; t < r; t++) i.push(new Gi(e.readDsClock(), e.readDsLen()));
		}
	}
	return t;
}, ra = (e, t, n) => {
	let r = new Ki(), i = N(e.restDecoder);
	for (let a = 0; a < i; a++) {
		e.resetDsCurVal();
		let i = N(e.restDecoder), a = N(e.restDecoder), o = n.clients.get(i) || [], s = B(n, i);
		for (let n = 0; n < a; n++) {
			let n = e.readDsClock(), a = n + e.readDsLen();
			if (n < s) {
				s < a && Qi(r, i, s, a - s);
				let e = ro(o, n), c = o[e];
				for (!c.deleted && c.id.clock < n && (o.splice(e + 1, 0, vc(t, c, n - c.id.clock)), e++); e < o.length && (c = o[e++], c.id.clock < a);) c.deleted || (a < c.id.clock + c.length && o.splice(e, 0, vc(t, c, a - c.id.clock)), c.delete(t));
			} else Qi(r, i, n, a - n);
		}
	}
	if (r.clients.size > 0) {
		let e = new fa();
		return O(e.restEncoder, 0), ta(e, r), e.toUint8Array();
	}
	return null;
}, ia = hn, R = class e extends st {
	constructor({ guid: e = _n(), collectionid: t = null, gc: n = !0, gcFilter: r = () => !0, meta: i = null, autoLoad: a = !1, shouldLoad: o = !0 } = {}) {
		super(), this.gc = n, this.gcFilter = r, this.clientID = ia(), this.guid = e, this.collectionid = t, this.share = /* @__PURE__ */ new Map(), this.store = new eo(), this._transaction = null, this._transactionCleanups = [], this.subdocs = /* @__PURE__ */ new Set(), this._item = null, this.shouldLoad = o, this.autoLoad = a, this.meta = i, this.isLoaded = !1, this.isSynced = !1, this.isDestroyed = !1, this.whenLoaded = yn((e) => {
			this.on("load", () => {
				this.isLoaded = !0, e(this);
			});
		});
		let s = () => yn((e) => {
			let t = (n) => {
				(n === void 0 || n === !0) && (this.off("sync", t), e());
			};
			this.on("sync", t);
		});
		this.on("sync", (e) => {
			e === !1 && this.isSynced && (this.whenSynced = s()), this.isSynced = e === void 0 || e === !0, this.isSynced && !this.isLoaded && this.emit("load", [this]);
		}), this.whenSynced = s();
	}
	load() {
		let e = this._item;
		e !== null && !this.shouldLoad && H(e.parent.doc, (e) => {
			e.subdocsLoaded.add(this);
		}, null, !0), this.shouldLoad = !0;
	}
	getSubdocs() {
		return this.subdocs;
	}
	getSubdocGuids() {
		return new Set(nt(this.subdocs).map((e) => e.guid));
	}
	transact(e, t = null) {
		return H(this, e, t);
	}
	get(e, t = W) {
		let n = Xe(this.share, e, () => {
			let e = new t();
			return e._integrate(this, null), e;
		}), r = n.constructor;
		if (t !== W && r !== t) {
			if (r === W) {
				let r = new t();
				r._map = n._map, n._map.forEach((e) => {
					for (; e !== null; e = e.left) e.parent = r;
				}), r._start = n._start;
				for (let e = r._start; e !== null; e = e.right) e.parent = r;
				return r._length = n._length, this.share.set(e, r), r._integrate(this, null), r;
			}
			throw Error(`Type with the name ${e} has already been defined with a different constructor`);
		}
		return n;
	}
	getArray(e = "") {
		return this.get(e, ds);
	}
	getText(e = "") {
		return this.get(e, js);
	}
	getMap(e = "") {
		return this.get(e, G);
	}
	getXmlElement(e = "") {
		return this.get(e, K);
	}
	getXmlFragment(e = "") {
		return this.get(e, Ps);
	}
	toJSON() {
		let e = {};
		return this.share.forEach((t, n) => {
			e[n] = t.toJSON();
		}), e;
	}
	destroy() {
		this.isDestroyed = !0, nt(this.subdocs).forEach((e) => e.destroy());
		let t = this._item;
		if (t !== null) {
			this._item = null;
			let n = t.content;
			n.doc = new e({
				guid: this.guid,
				...n.opts,
				shouldLoad: !1
			}), n.doc._item = t, H(t.parent.doc, (e) => {
				let r = n.doc;
				t.deleted || e.subdocsAdded.add(r), e.subdocsRemoved.add(this);
			}, null, !0);
		}
		this.emit("destroyed", [!0]), this.emit("destroy", [this]), super.destroy();
	}
}, aa = class {
	constructor(e) {
		this.restDecoder = e;
	}
	resetDsCurVal() {}
	readDsClock() {
		return N(this.restDecoder);
	}
	readDsLen() {
		return N(this.restDecoder);
	}
}, oa = class extends aa {
	readLeftID() {
		return z(N(this.restDecoder), N(this.restDecoder));
	}
	readRightID() {
		return z(N(this.restDecoder), N(this.restDecoder));
	}
	readClient() {
		return N(this.restDecoder);
	}
	readInfo() {
		return rn(this.restDecoder);
	}
	readString() {
		return on(this.restDecoder);
	}
	readParentInfo() {
		return N(this.restDecoder) === 1;
	}
	readTypeRef() {
		return N(this.restDecoder);
	}
	readLen() {
		return N(this.restDecoder);
	}
	readAny() {
		return ln(this.restDecoder);
	}
	readBuf() {
		return cr(M(this.restDecoder));
	}
	readJSON() {
		return JSON.parse(on(this.restDecoder));
	}
	readKey() {
		return on(this.restDecoder);
	}
}, sa = class {
	constructor(e) {
		this.dsCurrVal = 0, this.restDecoder = e;
	}
	resetDsCurVal() {
		this.dsCurrVal = 0;
	}
	readDsClock() {
		return this.dsCurrVal += N(this.restDecoder), this.dsCurrVal;
	}
	readDsLen() {
		let e = N(this.restDecoder) + 1;
		return this.dsCurrVal += e, e;
	}
}, ca = class extends sa {
	constructor(e) {
		super(e), this.keys = [], N(e), this.keyClockDecoder = new fn(M(e)), this.clientDecoder = new dn(M(e)), this.leftClockDecoder = new fn(M(e)), this.rightClockDecoder = new fn(M(e)), this.infoDecoder = new un(M(e), rn), this.stringDecoder = new pn(M(e)), this.parentInfoDecoder = new un(M(e), rn), this.typeRefDecoder = new dn(M(e)), this.lenDecoder = new dn(M(e));
	}
	readLeftID() {
		return new Fa(this.clientDecoder.read(), this.leftClockDecoder.read());
	}
	readRightID() {
		return new Fa(this.clientDecoder.read(), this.rightClockDecoder.read());
	}
	readClient() {
		return this.clientDecoder.read();
	}
	readInfo() {
		return this.infoDecoder.read();
	}
	readString() {
		return this.stringDecoder.read();
	}
	readParentInfo() {
		return this.parentInfoDecoder.read() === 1;
	}
	readTypeRef() {
		return this.typeRefDecoder.read();
	}
	readLen() {
		return this.lenDecoder.read();
	}
	readAny() {
		return ln(this.restDecoder);
	}
	readBuf() {
		return M(this.restDecoder);
	}
	readJSON() {
		return ln(this.restDecoder);
	}
	readKey() {
		let e = this.keyClockDecoder.read();
		if (e < this.keys.length) return this.keys[e];
		{
			let e = this.stringDecoder.read();
			return this.keys.push(e), e;
		}
	}
}, la = class {
	constructor() {
		this.restEncoder = T();
	}
	toUint8Array() {
		return E(this.restEncoder);
	}
	resetDsCurVal() {}
	writeDsClock(e) {
		O(this.restEncoder, e);
	}
	writeDsLen(e) {
		O(this.restEncoder, e);
	}
}, ua = class extends la {
	writeLeftID(e) {
		O(this.restEncoder, e.client), O(this.restEncoder, e.clock);
	}
	writeRightID(e) {
		O(this.restEncoder, e.client), O(this.restEncoder, e.clock);
	}
	writeClient(e) {
		O(this.restEncoder, e);
	}
	writeInfo(e) {
		jt(this.restEncoder, e);
	}
	writeString(e) {
		Ft(this.restEncoder, e);
	}
	writeParentInfo(e) {
		O(this.restEncoder, +!!e);
	}
	writeTypeRef(e) {
		O(this.restEncoder, e);
	}
	writeLen(e) {
		O(this.restEncoder, e);
	}
	writeAny(e) {
		Ut(this.restEncoder, e);
	}
	writeBuf(e) {
		k(this.restEncoder, e);
	}
	writeJSON(e) {
		Ft(this.restEncoder, JSON.stringify(e));
	}
	writeKey(e) {
		Ft(this.restEncoder, e);
	}
}, da = class {
	constructor() {
		this.restEncoder = T(), this.dsCurrVal = 0;
	}
	toUint8Array() {
		return E(this.restEncoder);
	}
	resetDsCurVal() {
		this.dsCurrVal = 0;
	}
	writeDsClock(e) {
		let t = e - this.dsCurrVal;
		this.dsCurrVal = e, O(this.restEncoder, t);
	}
	writeDsLen(e) {
		e === 0 && j(), O(this.restEncoder, e - 1), this.dsCurrVal += e;
	}
}, fa = class extends da {
	constructor() {
		super(), this.keyMap = /* @__PURE__ */ new Map(), this.keyClock = 0, this.keyClockEncoder = new Jt(), this.clientEncoder = new Kt(), this.leftClockEncoder = new Jt(), this.rightClockEncoder = new Jt(), this.infoEncoder = new Wt(jt), this.stringEncoder = new Yt(), this.parentInfoEncoder = new Wt(jt), this.typeRefEncoder = new Kt(), this.lenEncoder = new Kt();
	}
	toUint8Array() {
		let e = T();
		return O(e, 0), k(e, this.keyClockEncoder.toUint8Array()), k(e, this.clientEncoder.toUint8Array()), k(e, this.leftClockEncoder.toUint8Array()), k(e, this.rightClockEncoder.toUint8Array()), k(e, E(this.infoEncoder)), k(e, this.stringEncoder.toUint8Array()), k(e, E(this.parentInfoEncoder)), k(e, this.typeRefEncoder.toUint8Array()), k(e, this.lenEncoder.toUint8Array()), It(e, E(this.restEncoder)), E(e);
	}
	writeLeftID(e) {
		this.clientEncoder.write(e.client), this.leftClockEncoder.write(e.clock);
	}
	writeRightID(e) {
		this.clientEncoder.write(e.client), this.rightClockEncoder.write(e.clock);
	}
	writeClient(e) {
		this.clientEncoder.write(e);
	}
	writeInfo(e) {
		this.infoEncoder.write(e);
	}
	writeString(e) {
		this.stringEncoder.write(e);
	}
	writeParentInfo(e) {
		this.parentInfoEncoder.write(+!!e);
	}
	writeTypeRef(e) {
		this.typeRefEncoder.write(e);
	}
	writeLen(e) {
		this.lenEncoder.write(e);
	}
	writeAny(e) {
		Ut(this.restEncoder, e);
	}
	writeBuf(e) {
		k(this.restEncoder, e);
	}
	writeJSON(e) {
		Ut(this.restEncoder, e);
	}
	writeKey(e) {
		let t = this.keyMap.get(e);
		t === void 0 ? (this.keyClockEncoder.write(this.keyClock++), this.stringEncoder.write(e)) : this.keyClockEncoder.write(t);
	}
}, pa = (e, t, n, r) => {
	r = dt(r, t[0].id.clock);
	let i = ro(t, r);
	O(e.restEncoder, t.length - i), e.writeClient(n), O(e.restEncoder, r);
	let a = t[i];
	a.write(e, r - a.id.clock);
	for (let n = i + 1; n < t.length; n++) t[n].write(e, 0);
}, ma = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	n.forEach((e, n) => {
		B(t, n) > e && r.set(n, e);
	}), to(t).forEach((e, t) => {
		n.has(t) || r.set(t, 0);
	}), O(e.restEncoder, r.size), nt(r.entries()).sort((e, t) => t[0] - e[0]).forEach(([n, r]) => {
		pa(e, t.clients.get(n), n, r);
	});
}, ha = (e, t) => {
	let n = C(), r = N(e.restDecoder);
	for (let i = 0; i < r; i++) {
		let r = N(e.restDecoder), i = Array(r), a = e.readClient(), o = N(e.restDecoder);
		n.set(a, {
			i: 0,
			refs: i
		});
		for (let n = 0; n < r; n++) {
			let r = e.readInfo();
			switch (31 & r) {
				case 0: {
					let t = e.readLen();
					i[n] = new J(z(a, o), t), o += t;
					break;
				}
				case 10: {
					let t = N(e.restDecoder);
					i[n] = new Z(z(a, o), t), o += t;
					break;
				}
				default: {
					let s = !(r & 192), c = new X(z(a, o), null, (r & 128) == 128 ? e.readLeftID() : null, null, (r & 64) == 64 ? e.readRightID() : null, s ? e.readParentInfo() ? t.get(e.readString()) : e.readLeftID() : null, s && (r & 32) == 32 ? e.readString() : null, xc(e, r));
					i[n] = c, o += c.length;
				}
			}
		}
	}
	return n;
}, ga = (e, t, n) => {
	let r = [], i = nt(n.keys()).sort((e, t) => e - t);
	if (i.length === 0) return null;
	let a = () => {
		if (i.length === 0) return null;
		let e = n.get(i[i.length - 1]);
		for (; e.refs.length === e.i;) if (i.pop(), i.length > 0) e = n.get(i[i.length - 1]);
		else return null;
		return e;
	}, o = a();
	if (o === null) return null;
	let s = new eo(), c = /* @__PURE__ */ new Map(), l = (e, t) => {
		let n = c.get(e);
		(n == null || n > t) && c.set(e, t);
	}, u = o.refs[o.i++], d = /* @__PURE__ */ new Map(), f = () => {
		for (let e of r) {
			let t = e.id.client, r = n.get(t);
			r ? (r.i--, s.clients.set(t, r.refs.slice(r.i)), n.delete(t), r.i = 0, r.refs = []) : s.clients.set(t, [e]), i = i.filter((e) => e !== t);
		}
		r.length = 0;
	};
	for (;;) {
		if (u.constructor !== Z) {
			let i = Xe(d, u.id.client, () => B(t, u.id.client)) - u.id.clock;
			if (i < 0) r.push(u), l(u.id.client, u.id.clock - 1), f();
			else {
				let a = u.getMissing(e, t);
				if (a !== null) {
					r.push(u);
					let e = n.get(a) || {
						refs: [],
						i: 0
					};
					if (e.refs.length === e.i) l(a, B(t, a)), f();
					else {
						u = e.refs[e.i++];
						continue;
					}
				} else (i === 0 || i < u.length) && (u.integrate(e, i), d.set(u.id.client, u.id.clock + u.length));
			}
		}
		if (r.length > 0) u = r.pop();
		else if (o !== null && o.i < o.refs.length) u = o.refs[o.i++];
		else {
			if (o = a(), o === null) break;
			u = o.refs[o.i++];
		}
	}
	if (s.clients.size > 0) {
		let e = new fa();
		return ma(e, s, /* @__PURE__ */ new Map()), O(e.restEncoder, 0), {
			missing: c,
			update: e.toUint8Array()
		};
	}
	return null;
}, _a = (e, t) => ma(e, t.doc.store, t.beforeState), va = (e, t, n, r = new ca(e)) => H(t, (e) => {
	e.local = !1;
	let t = !1, n = e.doc, i = n.store, a = ga(e, i, ha(r, n)), o = i.pendingStructs;
	if (o) {
		for (let [e, n] of o.missing) if (n < B(i, e)) {
			t = !0;
			break;
		}
		if (a) {
			for (let [e, t] of a.missing) {
				let n = o.missing.get(e);
				(n == null || n > t) && o.missing.set(e, t);
			}
			o.update = Eo([o.update, a.update]);
		}
	} else i.pendingStructs = a;
	let s = ra(r, e, i);
	if (i.pendingDs) {
		let t = new ca(en(i.pendingDs));
		N(t.restDecoder);
		let n = ra(t, e, i);
		i.pendingDs = s && n ? Eo([s, n]) : s || n;
	} else i.pendingDs = s;
	if (t) {
		let t = i.pendingStructs.update;
		i.pendingStructs = null, ya(e.doc, t);
	}
}, n, !1), ya = (e, t, n, r = ca) => {
	let i = en(t);
	va(i, e, n, new r(i));
}, ba = (e, t, n) => ya(e, t, n, oa), xa = (e, t, n = /* @__PURE__ */ new Map()) => {
	ma(e, t.store, n), ta(e, ea(t.store));
}, Sa = (e, t = new Uint8Array([0]), n = new fa()) => {
	xa(n, e, Ta(t));
	let r = [n.toUint8Array()];
	if (e.store.pendingDs && r.push(e.store.pendingDs), e.store.pendingStructs && r.push(Do(e.store.pendingStructs.update, t)), r.length > 1) {
		if (n.constructor === ua) return wo(r.map((e, t) => t === 0 ? e : Mo(e)));
		if (n.constructor === fa) return Eo(r);
	}
	return r[0];
}, Ca = (e, t) => Sa(e, t, new ua()), wa = (e) => {
	let t = /* @__PURE__ */ new Map(), n = N(e.restDecoder);
	for (let r = 0; r < n; r++) {
		let n = N(e.restDecoder), r = N(e.restDecoder);
		t.set(n, r);
	}
	return t;
}, Ta = (e) => wa(new aa(en(e))), Ea = (e, t) => (O(e.restEncoder, t.size), nt(t.entries()).sort((e, t) => t[0] - e[0]).forEach(([t, n]) => {
	O(e.restEncoder, t), O(e.restEncoder, n);
}), e), Da = (e, t) => Ea(e, to(t.store)), Oa = (e, t = new da()) => (e instanceof Map ? Ea(t, e) : Da(t, e), t.toUint8Array()), ka = (e) => Oa(e, new la()), Aa = class {
	constructor() {
		this.l = [];
	}
}, ja = () => new Aa(), Ma = (e, t) => e.l.push(t), Na = (e, t) => {
	let n = e.l, r = n.length;
	e.l = n.filter((e) => t !== e), r === e.l.length && console.error("[yjs] Tried to remove event handler that doesn't exist.");
}, Pa = (e, t, n) => Bn(e.l, [t, n]), Fa = class {
	constructor(e, t) {
		this.client = e, this.clock = t;
	}
}, Ia = (e, t) => e === t || e !== null && t !== null && e.client === t.client && e.clock === t.clock, z = (e, t) => new Fa(e, t), La = (e) => {
	for (let [t, n] of e.doc.share.entries()) if (n === e) return t;
	throw j();
}, Ra = (e, t) => {
	for (; t !== null;) {
		if (t.parent === e) return !0;
		t = t.parent._item;
	}
	return !1;
}, za = class {
	constructor(e, t = e.getMap("users")) {
		let n = /* @__PURE__ */ new Map();
		this.yusers = t, this.doc = e, this.clients = /* @__PURE__ */ new Map(), this.dss = n;
		let r = (e, t) => {
			let n = e.get("ds"), r = e.get("ids"), i = (e) => this.clients.set(e, t);
			n.observe((e) => {
				e.changes.added.forEach((e) => {
					e.content.getContent().forEach((e) => {
						e instanceof Uint8Array && this.dss.set(t, Zi([this.dss.get(t) || $i(), na(new aa(en(e)))]));
					});
				});
			}), this.dss.set(t, Zi(n.map((e) => na(new aa(en(e)))))), r.observe((e) => e.changes.added.forEach((e) => e.content.getContent().forEach(i))), r.forEach(i);
		};
		t.observe((e) => {
			e.keysChanged.forEach((e) => r(t.get(e), e));
		}), t.forEach(r);
	}
	setUserMapping(e, t, n, { filter: r = () => !0 } = {}) {
		let i = this.yusers, a = i.get(n);
		a || (a = new G(), a.set("ids", new ds()), a.set("ds", new ds()), i.set(n, a)), a.get("ids").push([t]), i.observe((e) => {
			setTimeout(() => {
				let e = i.get(n);
				if (e !== a) {
					a = e, this.clients.forEach((e, t) => {
						n === e && a.get("ids").push([t]);
					});
					let t = new la(), r = this.dss.get(n);
					r && (ta(t, r), a.get("ds").push([t.toUint8Array()]));
				}
			}, 0);
		}), e.on("afterTransaction", (e) => {
			setTimeout(() => {
				let t = a.get("ds"), n = e.deleteSet;
				if (e.local && n.clients.size > 0 && r(e, n)) {
					let e = new la();
					ta(e, n), t.push([e.toUint8Array()]);
				}
			});
		});
	}
	getUserByClientId(e) {
		return this.clients.get(e) || null;
	}
	getUserByDeletedId(e) {
		for (let [t, n] of this.dss.entries()) if (Yi(n, e)) return t;
		return null;
	}
}, Ba = class {
	constructor(e, t, n, r = 0) {
		this.type = e, this.tname = t, this.item = n, this.assoc = r;
	}
}, Va = class {
	constructor(e, t, n = 0) {
		this.type = e, this.index = t, this.assoc = n;
	}
}, Ha = (e, t, n = 0) => new Va(e, t, n), Ua = (e, t, n) => {
	let r = null, i = null;
	return e._item === null ? i = La(e) : r = z(e._item.id.client, e._item.id.clock), new Ba(r, i, t, n);
}, Wa = (e, t, n = 0) => {
	let r = e._start;
	if (n < 0) {
		if (t === 0) return Ua(e, null, n);
		t--;
	}
	for (; r !== null;) {
		if (!r.deleted && r.countable) {
			if (r.length > t) return Ua(e, z(r.id.client, r.id.clock + t), n);
			t -= r.length;
		}
		if (r.right === null && n < 0) return Ua(e, r.lastId, n);
		r = r.right;
	}
	return Ua(e, null, n);
}, Ga = (e, t) => {
	let n = io(e, t);
	return {
		item: n,
		diff: t.clock - n.id.clock
	};
}, Ka = (e, t, n = !0) => {
	let r = t.store, i = e.item, a = e.type, o = e.tname, s = e.assoc, c = null, l = 0;
	if (i !== null) {
		if (B(r, i.client) <= i.clock) return null;
		let e = n ? gc(r, i) : Ga(r, i), t = e.item;
		if (!(t instanceof X)) return null;
		if (c = t.parent, c._item === null || !c._item.deleted) {
			l = t.deleted || !t.countable ? 0 : e.diff + (s >= 0 ? 0 : 1);
			let n = t.left;
			for (; n !== null;) !n.deleted && n.countable && (l += n.length), n = n.left;
		}
	} else {
		if (o !== null) c = t.get(o);
		else if (a !== null) {
			if (B(r, a.client) <= a.clock) return null;
			let { item: e } = n ? gc(r, a) : { item: io(r, a) };
			if (e instanceof X && e.content instanceof mc) c = e.content.type;
			else return null;
		} else throw j();
		l = s >= 0 ? c._length : 0;
	}
	return Ha(c, l, e.assoc);
}, qa = (e, t) => e === t || e !== null && t !== null && e.tname === t.tname && Ia(e.item, t.item) && Ia(e.type, t.type) && e.assoc === t.assoc, Ja = class {
	constructor(e, t) {
		this.ds = e, this.sv = t;
	}
}, Ya = (e, t) => new Ja(e, t), Xa = Ya($i(), /* @__PURE__ */ new Map()), Za = (e) => Ya(ea(e.store), to(e.store)), Qa = (e, t) => t === void 0 ? !e.deleted : t.sv.has(e.id.client) && (t.sv.get(e.id.client) || 0) > e.id.clock && !Yi(t.ds, e.id), $a = (e, t) => {
	let n = Xe(e.meta, $a, $e), r = e.doc.store;
	n.has(t) || (t.sv.forEach((t, n) => {
		t < B(r, n) && V(e, z(n, t));
	}), qi(e, t.ds, (e) => {}), n.add(t));
}, eo = class {
	constructor() {
		this.clients = /* @__PURE__ */ new Map(), this.pendingStructs = null, this.pendingDs = null;
	}
}, to = (e) => {
	let t = /* @__PURE__ */ new Map();
	return e.clients.forEach((e, n) => {
		let r = e[e.length - 1];
		t.set(n, r.id.clock + r.length);
	}), t;
}, B = (e, t) => {
	let n = e.clients.get(t);
	if (n === void 0) return 0;
	let r = n[n.length - 1];
	return r.id.clock + r.length;
}, no = (e, t) => {
	let n = e.clients.get(t.id.client);
	if (n === void 0) n = [], e.clients.set(t.id.client, n);
	else {
		let e = n[n.length - 1];
		if (e.id.clock + e.length !== t.id.clock) throw j();
	}
	n.push(t);
}, ro = (e, t) => {
	let n = 0, r = e.length - 1, i = e[r], a = i.id.clock;
	if (a === t) return r;
	let o = w(t / (a + i.length - 1) * r);
	for (; n <= r;) {
		if (i = e[o], a = i.id.clock, a <= t) {
			if (t < a + i.length) return o;
			n = o + 1;
		} else r = o - 1;
		o = w((n + r) / 2);
	}
	throw j();
}, io = (e, t) => {
	let n = e.clients.get(t.client);
	return n[ro(n, t.clock)];
}, ao = (e, t, n) => {
	let r = ro(t, n), i = t[r];
	return i.id.clock < n && i instanceof X ? (t.splice(r + 1, 0, vc(e, i, n - i.id.clock)), r + 1) : r;
}, V = (e, t) => {
	let n = e.doc.store.clients.get(t.client);
	return n[ao(e, n, t.clock)];
}, oo = (e, t, n) => {
	let r = t.clients.get(n.client), i = ro(r, n.clock), a = r[i];
	return n.clock !== a.id.clock + a.length - 1 && a.constructor !== J && r.splice(i + 1, 0, vc(e, a, n.clock - a.id.clock + 1)), a;
}, so = (e, t, n) => {
	let r = e.clients.get(t.id.client);
	r[ro(r, t.id.clock)] = n;
}, co = (e, t, n, r, i) => {
	if (r === 0) return;
	let a = n + r, o = ao(e, t, n), s;
	do
		s = t[o++], a < s.id.clock + s.length && ao(e, t, a), i(s);
	while (o < t.length && t[o].id.clock < a);
}, lo = class {
	constructor(e, t, n) {
		this.doc = e, this.deleteSet = new Ki(), this.beforeState = to(e.store), this.afterState = /* @__PURE__ */ new Map(), this.changed = /* @__PURE__ */ new Map(), this.changedParentTypes = /* @__PURE__ */ new Map(), this._mergeStructs = [], this.origin = t, this.meta = /* @__PURE__ */ new Map(), this.local = n, this.subdocsAdded = /* @__PURE__ */ new Set(), this.subdocsRemoved = /* @__PURE__ */ new Set(), this.subdocsLoaded = /* @__PURE__ */ new Set(), this._needFormattingCleanup = !1;
	}
}, uo = (e, t) => t.deleteSet.clients.size === 0 && !Qe(t.afterState, (e, n) => t.beforeState.get(n) !== e) ? !1 : (Xi(t.deleteSet), _a(e, t), ta(e, t.deleteSet), !0), fo = (e, t, n) => {
	let r = t._item;
	(r === null || r.id.clock < (e.beforeState.get(r.id.client) || 0) && !r.deleted) && Xe(e.changed, t, $e).add(n);
}, po = (e, t) => {
	let n = e[t], r = e[t - 1], i = t;
	for (; i > 0 && r.deleted === n.deleted && r.constructor === n.constructor && r.mergeWith(n); n = r, r = e[--i - 1]) n instanceof X && n.parentSub !== null && n.parent._map.get(n.parentSub) === n && n.parent._map.set(n.parentSub, r);
	let a = t - i;
	return a && e.splice(t + 1 - a, a), a;
}, mo = (e, t, n) => {
	for (let [r, i] of e.clients.entries()) {
		let e = t.clients.get(r);
		for (let r = i.length - 1; r >= 0; r--) {
			let a = i[r], o = a.clock + a.len;
			for (let r = ro(e, a.clock), i = e[r]; r < e.length && i.id.clock < o; i = e[++r]) {
				let i = e[r];
				if (a.clock + a.len <= i.id.clock) break;
				i instanceof X && i.deleted && !i.keep && n(i) && i.gc(t, !1);
			}
		}
	}
}, ho = (e, t) => {
	e.clients.forEach((e, n) => {
		let r = t.clients.get(n);
		for (let t = e.length - 1; t >= 0; t--) {
			let n = e[t], i = ut(r.length - 1, 1 + ro(r, n.clock + n.len - 1));
			for (let e = i, t = r[e]; e > 0 && t.id.clock >= n.clock; t = r[e]) e -= 1 + po(r, e);
		}
	});
}, go = (e, t) => {
	if (t < e.length) {
		let n = e[t], r = n.doc, i = r.store, a = n.deleteSet, o = n._mergeStructs;
		try {
			Xi(a), n.afterState = to(n.doc.store), r.emit("beforeObserverCalls", [n, r]);
			let e = [];
			n.changed.forEach((t, r) => e.push(() => {
				r._item !== null && r._item.deleted || r._callObserver(n, t);
			})), e.push(() => {
				n.changedParentTypes.forEach((t, r) => {
					r._dEH.l.length > 0 && (r._item === null || !r._item.deleted) && (t = t.filter((e) => e.target._item === null || !e.target._item.deleted), t.forEach((e) => {
						e.currentTarget = r, e._path = null;
					}), t.sort((e, t) => e.path.length - t.path.length), e.push(() => {
						Pa(r._dEH, t, n);
					}));
				}), e.push(() => r.emit("afterTransaction", [n, r])), e.push(() => {
					n._needFormattingCleanup && Os(n);
				});
			}), Bn(e, []);
		} finally {
			r.gc && mo(a, i, r.gcFilter), ho(a, i), n.afterState.forEach((e, t) => {
				let r = n.beforeState.get(t) || 0;
				if (r !== e) {
					let e = i.clients.get(t), n = dt(ro(e, r), 1);
					for (let t = e.length - 1; t >= n;) t -= 1 + po(e, t);
				}
			});
			for (let e = o.length - 1; e >= 0; e--) {
				let { client: t, clock: n } = o[e].id, r = i.clients.get(t), a = ro(r, n);
				a + 1 < r.length && po(r, a + 1) > 1 || a > 0 && po(r, a);
			}
			if (!n.local && n.afterState.get(r.clientID) !== n.beforeState.get(r.clientID) && (zi(Pi, Di, "[yjs] ", Oi, Mi, "Changed the client-id because another client seems to be using it."), r.clientID = ia()), r.emit("afterTransactionCleanup", [n, r]), r._observers.has("update")) {
				let e = new ua();
				uo(e, n) && r.emit("update", [
					e.toUint8Array(),
					n.origin,
					r,
					n
				]);
			}
			if (r._observers.has("updateV2")) {
				let e = new fa();
				uo(e, n) && r.emit("updateV2", [
					e.toUint8Array(),
					n.origin,
					r,
					n
				]);
			}
			let { subdocsAdded: s, subdocsLoaded: c, subdocsRemoved: l } = n;
			(s.size > 0 || l.size > 0 || c.size > 0) && (s.forEach((e) => {
				e.clientID = r.clientID, e.collectionid ??= r.collectionid, r.subdocs.add(e);
			}), l.forEach((e) => r.subdocs.delete(e)), r.emit("subdocs", [
				{
					loaded: c,
					added: s,
					removed: l
				},
				r,
				n
			]), l.forEach((e) => e.destroy())), e.length <= t + 1 ? (r._transactionCleanups = [], r.emit("afterAllTransactions", [r, e])) : go(e, t + 1);
		}
	}
}, H = (e, t, n = null, r = !0) => {
	let i = e._transactionCleanups, a = !1, o = null;
	e._transaction === null && (a = !0, e._transaction = new lo(e, n, r), i.push(e._transaction), i.length === 1 && e.emit("beforeAllTransactions", [e]), e.emit("beforeTransaction", [e._transaction, e]));
	try {
		o = t(e._transaction);
	} finally {
		if (a) {
			let t = e._transaction === i[0];
			e._transaction = null, t && go(i, 0);
		}
	}
	return o;
}, _o = class {
	constructor(e, t) {
		this.insertions = t, this.deletions = e, this.meta = /* @__PURE__ */ new Map();
	}
}, vo = (e, t, n) => {
	qi(e, n.deletions, (n) => {
		n instanceof X && t.scope.some((t) => t === e.doc || Ra(t, n)) && _c(n, !1);
	});
}, yo = (e, t, n) => {
	let r = null, i = e.doc, a = e.scope;
	H(i, (n) => {
		for (; t.length > 0 && e.currStackItem === null;) {
			let r = i.store, o = t.pop(), s = /* @__PURE__ */ new Set(), c = [], l = !1;
			qi(n, o.insertions, (e) => {
				if (e instanceof X) {
					if (e.redone !== null) {
						let { item: t, diff: i } = gc(r, e.id);
						i > 0 && (t = V(n, z(t.id.client, t.id.clock + i))), e = t;
					}
					!e.deleted && a.some((t) => t === n.doc || Ra(t, e)) && c.push(e);
				}
			}), qi(n, o.deletions, (e) => {
				e instanceof X && a.some((t) => t === n.doc || Ra(t, e)) && !Yi(o.insertions, e.id) && s.add(e);
			}), s.forEach((t) => {
				l = bc(n, t, s, o.insertions, e.ignoreRemoteMapChanges, e) !== null || l;
			});
			for (let t = c.length - 1; t >= 0; t--) {
				let r = c[t];
				e.deleteFilter(r) && (r.delete(n), l = !0);
			}
			e.currStackItem = l ? o : null;
		}
		n.changed.forEach((e, t) => {
			e.has(null) && t._searchMarker && (t._searchMarker.length = 0);
		}), r = n;
	}, e);
	let o = e.currStackItem;
	if (o != null) {
		let t = r.changedParentTypes;
		e.emit("stack-item-popped", [{
			stackItem: o,
			type: n,
			changedParentTypes: t,
			origin: e
		}, e]), e.currStackItem = null;
	}
	return o;
}, bo = class extends st {
	constructor(e, { captureTimeout: t = 500, captureTransaction: n = (e) => !0, deleteFilter: r = () => !0, trackedOrigins: i = /* @__PURE__ */ new Set([null]), ignoreRemoteMapChanges: a = !1, doc: o = ot(e) ? e[0].doc : e instanceof R ? e : e.doc } = {}) {
		super(), this.scope = [], this.doc = o, this.addToScope(e), this.deleteFilter = r, i.add(this), this.trackedOrigins = i, this.captureTransaction = n, this.undoStack = [], this.redoStack = [], this.undoing = !1, this.redoing = !1, this.currStackItem = null, this.lastChange = 0, this.ignoreRemoteMapChanges = a, this.captureTimeout = t, this.afterTransactionHandler = (e) => {
			if (!this.captureTransaction(e) || !this.scope.some((t) => e.changedParentTypes.has(t) || t === this.doc) || !this.trackedOrigins.has(e.origin) && (!e.origin || !this.trackedOrigins.has(e.origin.constructor))) return;
			let t = this.undoing, n = this.redoing, r = t ? this.redoStack : this.undoStack;
			t ? this.stopCapturing() : n || this.clear(!1, !0);
			let i = new Ki();
			e.afterState.forEach((t, n) => {
				let r = e.beforeState.get(n) || 0, a = t - r;
				a > 0 && Qi(i, n, r, a);
			});
			let a = vn(), o = !1;
			if (this.lastChange > 0 && a - this.lastChange < this.captureTimeout && r.length > 0 && !t && !n) {
				let t = r[r.length - 1];
				t.deletions = Zi([t.deletions, e.deleteSet]), t.insertions = Zi([t.insertions, i]);
			} else r.push(new _o(e.deleteSet, i)), o = !0;
			!t && !n && (this.lastChange = a), qi(e, e.deleteSet, (t) => {
				t instanceof X && this.scope.some((n) => n === e.doc || Ra(n, t)) && _c(t, !0);
			});
			let s = [{
				stackItem: r[r.length - 1],
				origin: e.origin,
				type: t ? "redo" : "undo",
				changedParentTypes: e.changedParentTypes
			}, this];
			o ? this.emit("stack-item-added", s) : this.emit("stack-item-updated", s);
		}, this.doc.on("afterTransaction", this.afterTransactionHandler), this.doc.on("destroy", () => {
			this.destroy();
		});
	}
	addToScope(e) {
		let t = new Set(this.scope);
		e = ot(e) ? e : [e], e.forEach((e) => {
			t.has(e) || (t.add(e), (e instanceof W ? e.doc !== this.doc : e !== this.doc) && Bi("[yjs#509] Not same Y.Doc"), this.scope.push(e));
		});
	}
	addTrackedOrigin(e) {
		this.trackedOrigins.add(e);
	}
	removeTrackedOrigin(e) {
		this.trackedOrigins.delete(e);
	}
	clear(e = !0, t = !0) {
		(e && this.canUndo() || t && this.canRedo()) && this.doc.transact((n) => {
			e && (this.undoStack.forEach((e) => vo(n, this, e)), this.undoStack = []), t && (this.redoStack.forEach((e) => vo(n, this, e)), this.redoStack = []), this.emit("stack-cleared", [{
				undoStackCleared: e,
				redoStackCleared: t
			}]);
		});
	}
	stopCapturing() {
		this.lastChange = 0;
	}
	undo() {
		this.undoing = !0;
		let e;
		try {
			e = yo(this, this.undoStack, "undo");
		} finally {
			this.undoing = !1;
		}
		return e;
	}
	redo() {
		this.redoing = !0;
		let e;
		try {
			e = yo(this, this.redoStack, "redo");
		} finally {
			this.redoing = !1;
		}
		return e;
	}
	canUndo() {
		return this.undoStack.length > 0;
	}
	canRedo() {
		return this.redoStack.length > 0;
	}
	destroy() {
		this.trackedOrigins.delete(this), this.doc.off("afterTransaction", this.afterTransactionHandler), super.destroy();
	}
};
function* xo(e) {
	let t = N(e.restDecoder);
	for (let n = 0; n < t; n++) {
		let t = N(e.restDecoder), n = e.readClient(), r = N(e.restDecoder);
		for (let i = 0; i < t; i++) {
			let t = e.readInfo();
			if (t === 10) {
				let t = N(e.restDecoder);
				yield new Z(z(n, r), t), r += t;
			} else if (31 & t) {
				let i = !(t & 192), a = new X(z(n, r), null, (t & 128) == 128 ? e.readLeftID() : null, null, (t & 64) == 64 ? e.readRightID() : null, i ? e.readParentInfo() ? e.readString() : e.readLeftID() : null, i && (t & 32) == 32 ? e.readString() : null, xc(e, t));
				yield a, r += a.length;
			} else {
				let t = e.readLen();
				yield new J(z(n, r), t), r += t;
			}
		}
	}
}
var So = class {
	constructor(e, t) {
		this.gen = xo(e), this.curr = null, this.done = !1, this.filterSkips = t, this.next();
	}
	next() {
		do
			this.curr = this.gen.next().value || null;
		while (this.filterSkips && this.curr !== null && this.curr.constructor === Z);
		return this.curr;
	}
}, Co = class {
	constructor(e) {
		this.currClient = 0, this.startClock = 0, this.written = 0, this.encoder = e, this.clientStructs = [];
	}
}, wo = (e) => Eo(e, oa, ua), To = (e, t) => {
	if (e.constructor === J) {
		let { client: n, clock: r } = e.id;
		return new J(z(n, r + t), e.length - t);
	}
	if (e.constructor === Z) {
		let { client: n, clock: r } = e.id;
		return new Z(z(n, r + t), e.length - t);
	}
	{
		let n = e, { client: r, clock: i } = n.id;
		return new X(z(r, i + t), null, z(r, i + t - 1), null, n.rightOrigin, n.parent, n.parentSub, n.content.splice(t));
	}
}, Eo = (e, t = ca, n = fa) => {
	if (e.length === 1) return e[0];
	let r = e.map((e) => new t(en(e))), i = r.map((e) => new So(e, !0)), a = null, o = new n(), s = new Co(o);
	for (; i = i.filter((e) => e.curr !== null), i.sort((e, t) => {
		if (e.curr.id.client === t.curr.id.client) {
			let n = e.curr.id.clock - t.curr.id.clock;
			return n === 0 ? e.curr.constructor === t.curr.constructor ? 0 : e.curr.constructor === Z ? 1 : -1 : n;
		}
		return t.curr.id.client - e.curr.id.client;
	}), i.length !== 0;) {
		let e = i[0], t = e.curr.id.client;
		if (a !== null) {
			let n = e.curr, r = !1;
			for (; n !== null && n.id.clock + n.length <= a.struct.id.clock + a.struct.length && n.id.client >= a.struct.id.client;) n = e.next(), r = !0;
			if (n === null || n.id.client !== t || r && n.id.clock > a.struct.id.clock + a.struct.length) continue;
			if (t !== a.struct.id.client) ko(s, a.struct, a.offset), a = {
				struct: n,
				offset: 0
			}, e.next();
			else if (a.struct.id.clock + a.struct.length < n.id.clock) {
				if (a.struct.constructor === Z) a.struct.length = n.id.clock + n.length - a.struct.id.clock;
				else {
					ko(s, a.struct, a.offset);
					let e = n.id.clock - a.struct.id.clock - a.struct.length;
					a = {
						struct: new Z(z(t, a.struct.id.clock + a.struct.length), e),
						offset: 0
					};
				}
			} else {
				let t = a.struct.id.clock + a.struct.length - n.id.clock;
				t > 0 && (a.struct.constructor === Z ? a.struct.length -= t : n = To(n, t)), a.struct.mergeWith(n) || (ko(s, a.struct, a.offset), a = {
					struct: n,
					offset: 0
				}, e.next());
			}
		} else a = {
			struct: e.curr,
			offset: 0
		}, e.next();
		for (let n = e.curr; n !== null && n.id.client === t && n.id.clock === a.struct.id.clock + a.struct.length && n.constructor !== Z; n = e.next()) ko(s, a.struct, a.offset), a = {
			struct: n,
			offset: 0
		};
	}
	return a !== null && (ko(s, a.struct, a.offset), a = null), Ao(s), ta(o, Zi(r.map((e) => na(e)))), o.toUint8Array();
}, Do = (e, t, n = ca, r = fa) => {
	let i = Ta(t), a = new r(), o = new Co(a), s = new n(en(e)), c = new So(s, !1);
	for (; c.curr;) {
		let e = c.curr, t = e.id.client, n = i.get(t) || 0;
		if (c.curr.constructor === Z) c.next();
		else if (e.id.clock + e.length > n) for (ko(o, e, dt(n - e.id.clock, 0)), c.next(); c.curr && c.curr.id.client === t;) ko(o, c.curr, 0), c.next();
		else for (; c.curr && c.curr.id.client === t && c.curr.id.clock + c.curr.length <= n;) c.next();
	}
	return Ao(o), ta(a, na(s)), a.toUint8Array();
}, Oo = (e) => {
	e.written > 0 && (e.clientStructs.push({
		written: e.written,
		restEncoder: E(e.encoder.restEncoder)
	}), e.encoder.restEncoder = T(), e.written = 0);
}, ko = (e, t, n) => {
	e.written > 0 && e.currClient !== t.id.client && Oo(e), e.written === 0 && (e.currClient = t.id.client, e.encoder.writeClient(t.id.client), O(e.encoder.restEncoder, t.id.clock + n)), t.write(e.encoder, n), e.written++;
}, Ao = (e) => {
	Oo(e);
	let t = e.encoder.restEncoder;
	O(t, e.clientStructs.length);
	for (let n = 0; n < e.clientStructs.length; n++) {
		let r = e.clientStructs[n];
		O(t, r.written), It(t, r.restEncoder);
	}
}, jo = (e, t, n, r) => {
	let i = new n(en(e)), a = new So(i, !1), o = new r(), s = new Co(o);
	for (let e = a.curr; e !== null; e = a.next()) ko(s, t(e), 0);
	return Ao(s), ta(o, na(i)), o.toUint8Array();
}, Mo = (e) => jo(e, Vn, ca, ua), No = "You must not compute changes after the event-handler fired.", Po = class {
	constructor(e, t) {
		this.target = e, this.currentTarget = e, this.transaction = t, this._changes = null, this._keys = null, this._delta = null, this._path = null;
	}
	get path() {
		return this._path ||= Fo(this.currentTarget, this.target);
	}
	deletes(e) {
		return Yi(this.transaction.deleteSet, e.id);
	}
	get keys() {
		if (this._keys === null) {
			if (this.transaction.doc._transactionCleanups.length === 0) throw Xt(No);
			let e = /* @__PURE__ */ new Map(), t = this.target;
			this.transaction.changed.get(t).forEach((n) => {
				if (n !== null) {
					let r = t._map.get(n), i, a;
					if (this.adds(r)) {
						let e = r.left;
						for (; e !== null && this.adds(e);) e = e.left;
						if (this.deletes(r)) {
							if (e !== null && this.deletes(e)) i = "delete", a = et(e.content.getContent());
							else return;
						} else e !== null && this.deletes(e) ? (i = "update", a = et(e.content.getContent())) : (i = "add", a = void 0);
					} else if (this.deletes(r)) i = "delete", a = et(r.content.getContent());
					else return;
					e.set(n, {
						action: i,
						oldValue: a
					});
				}
			}), this._keys = e;
		}
		return this._keys;
	}
	get delta() {
		return this.changes.delta;
	}
	adds(e) {
		return e.id.clock >= (this.transaction.beforeState.get(e.id.client) || 0);
	}
	get changes() {
		let e = this._changes;
		if (e === null) {
			if (this.transaction.doc._transactionCleanups.length === 0) throw Xt(No);
			let t = this.target, n = $e(), r = $e(), i = [];
			if (e = {
				added: n,
				deleted: r,
				delta: i,
				keys: this.keys
			}, this.transaction.changed.get(t).has(null)) {
				let e = null, a = () => {
					e && i.push(e);
				};
				for (let i = t._start; i !== null; i = i.right) i.deleted ? this.deletes(i) && !this.adds(i) && ((e === null || e.delete === void 0) && (a(), e = { delete: 0 }), e.delete += i.length, r.add(i)) : this.adds(i) ? ((e === null || e.insert === void 0) && (a(), e = { insert: [] }), e.insert = e.insert.concat(i.content.getContent()), n.add(i)) : ((e === null || e.retain === void 0) && (a(), e = { retain: 0 }), e.retain += i.length);
				e !== null && e.retain === void 0 && a();
			}
			this._changes = e;
		}
		return e;
	}
}, Fo = (e, t) => {
	let n = [];
	for (; t._item !== null && t !== e;) {
		if (t._item.parentSub !== null) n.unshift(t._item.parentSub);
		else {
			let e = 0, r = t._item.parent._start;
			for (; r !== t._item && r !== null;) !r.deleted && r.countable && (e += r.length), r = r.right;
			n.unshift(e);
		}
		t = t._item.parent;
	}
	return n;
}, U = () => {
	Bi("Invalid access: Add Yjs type to a document before reading data.");
}, Io = 80, Lo = 0, Ro = class {
	constructor(e, t) {
		e.marker = !0, this.p = e, this.index = t, this.timestamp = Lo++;
	}
}, zo = (e) => {
	e.timestamp = Lo++;
}, Bo = (e, t, n) => {
	e.p.marker = !1, e.p = t, t.marker = !0, e.index = n, e.timestamp = Lo++;
}, Vo = (e, t, n) => {
	if (e.length >= Io) {
		let r = e.reduce((e, t) => e.timestamp < t.timestamp ? e : t);
		return Bo(r, t, n), r;
	}
	{
		let r = new Ro(t, n);
		return e.push(r), r;
	}
}, Ho = (e, t) => {
	if (e._start === null || t === 0 || e._searchMarker === null) return null;
	let n = e._searchMarker.length === 0 ? null : e._searchMarker.reduce((e, n) => lt(t - e.index) < lt(t - n.index) ? e : n), r = e._start, i = 0;
	for (n !== null && (r = n.p, i = n.index, zo(n)); r.right !== null && i < t;) {
		if (!r.deleted && r.countable) {
			if (t < i + r.length) break;
			i += r.length;
		}
		r = r.right;
	}
	for (; r.left !== null && i > t;) r = r.left, !r.deleted && r.countable && (i -= r.length);
	for (; r.left !== null && r.left.id.client === r.id.client && r.left.id.clock + r.left.length === r.id.clock;) r = r.left, !r.deleted && r.countable && (i -= r.length);
	return n !== null && lt(n.index - i) < r.parent.length / Io ? (Bo(n, r, i), n) : Vo(e._searchMarker, r, i);
}, Uo = (e, t, n) => {
	for (let r = e.length - 1; r >= 0; r--) {
		let i = e[r];
		if (n > 0) {
			let t = i.p;
			for (t.marker = !1; t && (t.deleted || !t.countable);) t = t.left, t && !t.deleted && t.countable && (i.index -= t.length);
			if (t === null || t.marker === !0) {
				e.splice(r, 1);
				continue;
			}
			i.p = t, t.marker = !0;
		}
		(t < i.index || n > 0 && t === i.index) && (i.index = dt(t, i.index + n));
	}
}, Wo = (e, t, n) => {
	let r = e, i = t.changedParentTypes;
	for (; Xe(i, e, () => []).push(n), e._item !== null;) e = e._item.parent;
	Pa(r._eH, n, t);
}, W = class {
	constructor() {
		this._item = null, this._map = /* @__PURE__ */ new Map(), this._start = null, this.doc = null, this._length = 0, this._eH = ja(), this._dEH = ja(), this._searchMarker = null;
	}
	get parent() {
		return this._item ? this._item.parent : null;
	}
	_integrate(e, t) {
		this.doc = e, this._item = t;
	}
	_copy() {
		throw A();
	}
	clone() {
		throw A();
	}
	_write(e) {}
	get _first() {
		let e = this._start;
		for (; e !== null && e.deleted;) e = e.right;
		return e;
	}
	_callObserver(e, t) {
		!e.local && this._searchMarker && (this._searchMarker.length = 0);
	}
	observe(e) {
		Ma(this._eH, e);
	}
	observeDeep(e) {
		Ma(this._dEH, e);
	}
	unobserve(e) {
		Na(this._eH, e);
	}
	unobserveDeep(e) {
		Na(this._dEH, e);
	}
	toJSON() {}
}, Go = (e, t, n) => {
	e.doc ?? U(), t < 0 && (t = e._length + t), n < 0 && (n = e._length + n);
	let r = n - t, i = [], a = e._start;
	for (; a !== null && r > 0;) {
		if (a.countable && !a.deleted) {
			let e = a.content.getContent();
			if (e.length <= t) t -= e.length;
			else {
				for (let n = t; n < e.length && r > 0; n++) i.push(e[n]), r--;
				t = 0;
			}
		}
		a = a.right;
	}
	return i;
}, Ko = (e) => {
	e.doc ?? U();
	let t = [], n = e._start;
	for (; n !== null;) {
		if (n.countable && !n.deleted) {
			let e = n.content.getContent();
			for (let n = 0; n < e.length; n++) t.push(e[n]);
		}
		n = n.right;
	}
	return t;
}, qo = (e, t) => {
	let n = [], r = e._start;
	for (; r !== null;) {
		if (r.countable && Qa(r, t)) {
			let e = r.content.getContent();
			for (let t = 0; t < e.length; t++) n.push(e[t]);
		}
		r = r.right;
	}
	return n;
}, Jo = (e, t) => {
	let n = 0, r = e._start;
	for (e.doc ?? U(); r !== null;) {
		if (r.countable && !r.deleted) {
			let i = r.content.getContent();
			for (let r = 0; r < i.length; r++) t(i[r], n++, e);
		}
		r = r.right;
	}
}, Yo = (e, t) => {
	let n = [];
	return Jo(e, (r, i) => {
		n.push(t(r, i, e));
	}), n;
}, Xo = (e) => {
	let t = e._start, n = null, r = 0;
	return {
		[Symbol.iterator]() {
			return this;
		},
		next: () => {
			if (n === null) {
				for (; t !== null && t.deleted;) t = t.right;
				if (t === null) return {
					done: !0,
					value: void 0
				};
				n = t.content.getContent(), r = 0, t = t.right;
			}
			let e = n[r++];
			return n.length <= r && (n = null), {
				done: !1,
				value: e
			};
		}
	};
}, Zo = (e, t) => {
	e.doc ?? U();
	let n = Ho(e, t), r = e._start;
	for (n !== null && (r = n.p, t -= n.index); r !== null; r = r.right) if (!r.deleted && r.countable) {
		if (t < r.length) return r.content.getContent()[t];
		t -= r.length;
	}
}, Qo = (e, t, n, r) => {
	let i = n, a = e.doc, o = a.clientID, s = a.store, c = n === null ? t._start : n.right, l = [], u = () => {
		l.length > 0 && (i = new X(z(o, B(s, o)), i, i && i.lastId, c, c && c.id, t, null, new nc(l)), i.integrate(e, 0), l = []);
	};
	r.forEach((n) => {
		if (n === null) l.push(n);
		else switch (n.constructor) {
			case Number:
			case Object:
			case Boolean:
			case Array:
			case String:
				l.push(n);
				break;
			default: switch (u(), n.constructor) {
				case Uint8Array:
				case ArrayBuffer:
					i = new X(z(o, B(s, o)), i, i && i.lastId, c, c && c.id, t, null, new Us(new Uint8Array(n))), i.integrate(e, 0);
					break;
				case R:
					i = new X(z(o, B(s, o)), i, i && i.lastId, c, c && c.id, t, null, new Js(n)), i.integrate(e, 0);
					break;
				default: if (n instanceof W) i = new X(z(o, B(s, o)), i, i && i.lastId, c, c && c.id, t, null, new mc(n)), i.integrate(e, 0);
				else throw Error("Unexpected content type in insert operation");
			}
		}
	}), u();
}, $o = () => Xt("Length exceeded!"), es = (e, t, n, r) => {
	if (n > t._length) throw $o();
	if (n === 0) return t._searchMarker && Uo(t._searchMarker, n, r.length), Qo(e, t, null, r);
	let i = n, a = Ho(t, n), o = t._start;
	for (a !== null && (o = a.p, n -= a.index, n === 0 && (o = o.prev, n += o && o.countable && !o.deleted ? o.length : 0)); o !== null; o = o.right) if (!o.deleted && o.countable) {
		if (n <= o.length) {
			n < o.length && V(e, z(o.id.client, o.id.clock + n));
			break;
		}
		n -= o.length;
	}
	return t._searchMarker && Uo(t._searchMarker, i, r.length), Qo(e, t, o, r);
}, ts = (e, t, n) => {
	let r = (t._searchMarker || []).reduce((e, t) => t.index > e.index ? t : e, {
		index: 0,
		p: t._start
	}).p;
	if (r) for (; r.right;) r = r.right;
	return Qo(e, t, r, n);
}, ns = (e, t, n, r) => {
	if (r === 0) return;
	let i = n, a = r, o = Ho(t, n), s = t._start;
	for (o !== null && (s = o.p, n -= o.index); s !== null && n > 0; s = s.right) !s.deleted && s.countable && (n < s.length && V(e, z(s.id.client, s.id.clock + n)), n -= s.length);
	for (; r > 0 && s !== null;) s.deleted || (r < s.length && V(e, z(s.id.client, s.id.clock + r)), s.delete(e), r -= s.length), s = s.right;
	if (r > 0) throw $o();
	t._searchMarker && Uo(t._searchMarker, i, -a + r);
}, rs = (e, t, n) => {
	let r = t._map.get(n);
	r !== void 0 && r.delete(e);
}, is = (e, t, n, r) => {
	let i = t._map.get(n) || null, a = e.doc, o = a.clientID, s;
	if (r == null) s = new nc([r]);
	else switch (r.constructor) {
		case Number:
		case Object:
		case Boolean:
		case Array:
		case String:
		case Date:
		case BigInt:
			s = new nc([r]);
			break;
		case Uint8Array:
			s = new Us(r);
			break;
		case R:
			s = new Js(r);
			break;
		default: if (r instanceof W) s = new mc(r);
		else throw Error("Unexpected content type");
	}
	new X(z(o, B(a.store, o)), i, i && i.lastId, null, null, t, n, s).integrate(e, 0);
}, as = (e, t) => {
	e.doc ?? U();
	let n = e._map.get(t);
	return n !== void 0 && !n.deleted ? n.content.getContent()[n.length - 1] : void 0;
}, os = (e) => {
	let t = {};
	return e.doc ?? U(), e._map.forEach((e, n) => {
		e.deleted || (t[n] = e.content.getContent()[e.length - 1]);
	}), t;
}, ss = (e, t) => {
	e.doc ?? U();
	let n = e._map.get(t);
	return n !== void 0 && !n.deleted;
}, cs = (e, t) => {
	let n = {};
	return e._map.forEach((e, r) => {
		let i = e;
		for (; i !== null && (!t.sv.has(i.id.client) || i.id.clock >= (t.sv.get(i.id.client) || 0));) i = i.left;
		i !== null && Qa(i, t) && (n[r] = i.content.getContent()[i.length - 1]);
	}), n;
}, ls = (e) => (e.doc ?? U(), Ui(e._map.entries(), (e) => !e[1].deleted)), us = class extends Po {}, ds = class e extends W {
	constructor() {
		super(), this._prelimContent = [], this._searchMarker = [];
	}
	static from(t) {
		let n = new e();
		return n.push(t), n;
	}
	_integrate(e, t) {
		super._integrate(e, t), this.insert(0, this._prelimContent), this._prelimContent = null;
	}
	_copy() {
		return new e();
	}
	clone() {
		let t = new e();
		return t.insert(0, this.toArray().map((e) => e instanceof W ? e.clone() : e)), t;
	}
	get length() {
		return this.doc ?? U(), this._length;
	}
	_callObserver(e, t) {
		super._callObserver(e, t), Wo(this, e, new us(this, e));
	}
	insert(e, t) {
		this.doc === null ? this._prelimContent.splice(e, 0, ...t) : H(this.doc, (n) => {
			es(n, this, e, t);
		});
	}
	push(e) {
		this.doc === null ? this._prelimContent.push(...e) : H(this.doc, (t) => {
			ts(t, this, e);
		});
	}
	unshift(e) {
		this.insert(0, e);
	}
	delete(e, t = 1) {
		this.doc === null ? this._prelimContent.splice(e, t) : H(this.doc, (n) => {
			ns(n, this, e, t);
		});
	}
	get(e) {
		return Zo(this, e);
	}
	toArray() {
		return Ko(this);
	}
	slice(e = 0, t = this.length) {
		return Go(this, e, t);
	}
	toJSON() {
		return this.map((e) => e instanceof W ? e.toJSON() : e);
	}
	map(e) {
		return Yo(this, e);
	}
	forEach(e) {
		Jo(this, e);
	}
	[Symbol.iterator]() {
		return Xo(this);
	}
	_write(e) {
		e.writeTypeRef(sc);
	}
}, fs = (e) => new ds(), ps = class extends Po {
	constructor(e, t, n) {
		super(e, t), this.keysChanged = n;
	}
}, G = class e extends W {
	constructor(e) {
		super(), this._prelimContent = null, this._prelimContent = e === void 0 ? /* @__PURE__ */ new Map() : new Map(e);
	}
	_integrate(e, t) {
		super._integrate(e, t), this._prelimContent.forEach((e, t) => {
			this.set(t, e);
		}), this._prelimContent = null;
	}
	_copy() {
		return new e();
	}
	clone() {
		let t = new e();
		return this.forEach((e, n) => {
			t.set(n, e instanceof W ? e.clone() : e);
		}), t;
	}
	_callObserver(e, t) {
		Wo(this, e, new ps(this, e, t));
	}
	toJSON() {
		this.doc ?? U();
		let e = {};
		return this._map.forEach((t, n) => {
			if (!t.deleted) {
				let r = t.content.getContent()[t.length - 1];
				e[n] = r instanceof W ? r.toJSON() : r;
			}
		}), e;
	}
	get size() {
		return [...ls(this)].length;
	}
	keys() {
		return Wi(ls(this), (e) => e[0]);
	}
	values() {
		return Wi(ls(this), (e) => e[1].content.getContent()[e[1].length - 1]);
	}
	entries() {
		return Wi(ls(this), (e) => [e[0], e[1].content.getContent()[e[1].length - 1]]);
	}
	forEach(e) {
		this.doc ?? U(), this._map.forEach((t, n) => {
			t.deleted || e(t.content.getContent()[t.length - 1], n, this);
		});
	}
	[Symbol.iterator]() {
		return this.entries();
	}
	delete(e) {
		this.doc === null ? this._prelimContent.delete(e) : H(this.doc, (t) => {
			rs(t, this, e);
		});
	}
	set(e, t) {
		return this.doc === null ? this._prelimContent.set(e, t) : H(this.doc, (n) => {
			is(n, this, e, t);
		}), t;
	}
	get(e) {
		return as(this, e);
	}
	has(e) {
		return ss(this, e);
	}
	clear() {
		this.doc === null ? this._prelimContent.clear() : H(this.doc, (e) => {
			this.forEach(function(t, n, r) {
				rs(e, r, n);
			});
		});
	}
	_write(e) {
		e.writeTypeRef(cc);
	}
}, ms = (e) => new G(), hs = (e, t) => e === t || typeof e == "object" && typeof t == "object" && e && t && Ln(e, t), gs = class {
	constructor(e, t, n, r) {
		this.left = e, this.right = t, this.index = n, this.currentAttributes = r;
	}
	forward() {
		switch (this.right === null && j(), this.right.content.constructor) {
			case Y:
				this.right.deleted || bs(this.currentAttributes, this.right.content);
				break;
			default: this.right.deleted || (this.index += this.right.length);
		}
		this.left = this.right, this.right = this.right.right;
	}
}, _s = (e, t, n) => {
	for (; t.right !== null && n > 0;) {
		switch (t.right.content.constructor) {
			case Y:
				t.right.deleted || bs(t.currentAttributes, t.right.content);
				break;
			default: t.right.deleted || (n < t.right.length && V(e, z(t.right.id.client, t.right.id.clock + n)), t.index += t.right.length, n -= t.right.length);
		}
		t.left = t.right, t.right = t.right.right;
	}
	return t;
}, vs = (e, t, n, r) => {
	let i = /* @__PURE__ */ new Map(), a = r ? Ho(t, n) : null;
	return a ? _s(e, new gs(a.p.left, a.p, a.index, i), n - a.index) : _s(e, new gs(null, t._start, 0, i), n);
}, ys = (e, t, n, r) => {
	for (; n.right !== null && (n.right.deleted === !0 || n.right.content.constructor === Y && hs(r.get(n.right.content.key), n.right.content.value));) n.right.deleted || r.delete(n.right.content.key), n.forward();
	let i = e.doc, a = i.clientID;
	r.forEach((r, o) => {
		let s = n.left, c = n.right, l = new X(z(a, B(i.store, a)), s, s && s.lastId, c, c && c.id, t, null, new Y(o, r));
		l.integrate(e, 0), n.right = l, n.forward();
	});
}, bs = (e, t) => {
	let { key: n, value: r } = t;
	r === null ? e.delete(n) : e.set(n, r);
}, xs = (e, t) => {
	for (; e.right !== null && (e.right.deleted || e.right.content.constructor === Y && hs(t[e.right.content.key] ?? null, e.right.content.value));) e.forward();
}, Ss = (e, t, n, r) => {
	let i = e.doc, a = i.clientID, o = /* @__PURE__ */ new Map();
	for (let s in r) {
		let c = r[s], l = n.currentAttributes.get(s) ?? null;
		if (!hs(l, c)) {
			o.set(s, l);
			let { left: r, right: u } = n;
			n.right = new X(z(a, B(i.store, a)), r, r && r.lastId, u, u && u.id, t, null, new Y(s, c)), n.right.integrate(e, 0), n.forward();
		}
	}
	return o;
}, Cs = (e, t, n, r, i) => {
	n.currentAttributes.forEach((e, t) => {
		i[t] === void 0 && (i[t] = null);
	});
	let a = e.doc, o = a.clientID;
	xs(n, i);
	let s = Ss(e, t, n, i), c = r.constructor === String ? new ic(r) : r instanceof W ? new mc(r) : new Xs(r), { left: l, right: u, index: d } = n;
	t._searchMarker && Uo(t._searchMarker, n.index, c.getLength()), u = new X(z(o, B(a.store, o)), l, l && l.lastId, u, u && u.id, t, null, c), u.integrate(e, 0), n.right = u, n.index = d, n.forward(), ys(e, t, n, s);
}, ws = (e, t, n, r, i) => {
	let a = e.doc, o = a.clientID;
	xs(n, i);
	let s = Ss(e, t, n, i);
	iterationLoop: for (; n.right !== null && (r > 0 || s.size > 0 && (n.right.deleted || n.right.content.constructor === Y));) {
		if (!n.right.deleted) switch (n.right.content.constructor) {
			case Y: {
				let { key: t, value: a } = n.right.content, o = i[t];
				if (o !== void 0) {
					if (hs(o, a)) s.delete(t);
					else {
						if (r === 0) break iterationLoop;
						s.set(t, a);
					}
					n.right.delete(e);
				} else n.currentAttributes.set(t, a);
				break;
			}
			default: r < n.right.length && V(e, z(n.right.id.client, n.right.id.clock + r)), r -= n.right.length;
		}
		n.forward();
	}
	if (r > 0) {
		let i = "";
		for (; r > 0; r--) i += "\n";
		n.right = new X(z(o, B(a.store, o)), n.left, n.left && n.left.lastId, n.right, n.right && n.right.id, t, null, new ic(i)), n.right.integrate(e, 0), n.forward();
	}
	ys(e, t, n, s);
}, Ts = (e, t, n, r, i) => {
	let a = t, o = C();
	for (; a && (!a.countable || a.deleted);) {
		if (!a.deleted && a.content.constructor === Y) {
			let e = a.content;
			o.set(e.key, e);
		}
		a = a.right;
	}
	let s = 0, c = !1;
	for (; t !== a;) {
		if (n === t && (c = !0), !t.deleted) {
			let n = t.content;
			switch (n.constructor) {
				case Y: {
					let { key: a, value: l } = n, u = r.get(a) ?? null;
					(o.get(a) !== n || u === l) && (t.delete(e), s++, !c && (i.get(a) ?? null) === l && u !== l && (u === null ? i.delete(a) : i.set(a, u))), !c && !t.deleted && bs(i, n);
					break;
				}
			}
		}
		t = t.right;
	}
	return s;
}, Es = (e, t) => {
	for (; t && t.right && (t.right.deleted || !t.right.countable);) t = t.right;
	let n = /* @__PURE__ */ new Set();
	for (; t && (t.deleted || !t.countable);) {
		if (!t.deleted && t.content.constructor === Y) {
			let r = t.content.key;
			n.has(r) ? t.delete(e) : n.add(r);
		}
		t = t.left;
	}
}, Ds = (e) => {
	let t = 0;
	return H(e.doc, (n) => {
		let r = e._start, i = e._start, a = C(), o = Ye(a);
		for (; i;) {
			if (i.deleted === !1) switch (i.content.constructor) {
				case Y:
					bs(o, i.content);
					break;
				default: t += Ts(n, r, i, a, o), a = Ye(o), r = i;
			}
			i = i.right;
		}
	}), t;
}, Os = (e) => {
	let t = /* @__PURE__ */ new Set(), n = e.doc;
	for (let [r, i] of e.afterState.entries()) {
		let a = e.beforeState.get(r) || 0;
		i !== a && co(e, n.store.clients.get(r), a, i, (e) => {
			!e.deleted && e.content.constructor === Y && e.constructor !== J && t.add(e.parent);
		});
	}
	H(n, (n) => {
		qi(e, e.deleteSet, (e) => {
			if (e instanceof J || !e.parent._hasFormatting || t.has(e.parent)) return;
			let r = e.parent;
			e.content.constructor === Y ? t.add(r) : Es(n, e);
		});
		for (let e of t) Ds(e);
	});
}, ks = (e, t, n) => {
	let r = n, i = Ye(t.currentAttributes), a = t.right;
	for (; n > 0 && t.right !== null;) {
		if (t.right.deleted === !1) switch (t.right.content.constructor) {
			case mc:
			case Xs:
			case ic: n < t.right.length && V(e, z(t.right.id.client, t.right.id.clock + n)), n -= t.right.length, t.right.delete(e);
		}
		t.forward();
	}
	a && Ts(e, a, t.right, i, t.currentAttributes);
	let o = (t.left || t.right).parent;
	return o._searchMarker && Uo(o._searchMarker, t.index, -r + n), t;
}, As = class extends Po {
	constructor(e, t, n) {
		super(e, t), this.childListChanged = !1, this.keysChanged = /* @__PURE__ */ new Set(), n.forEach((e) => {
			e === null ? this.childListChanged = !0 : this.keysChanged.add(e);
		});
	}
	get changes() {
		if (this._changes === null) {
			let e = {
				keys: this.keys,
				delta: this.delta,
				added: /* @__PURE__ */ new Set(),
				deleted: /* @__PURE__ */ new Set()
			};
			this._changes = e;
		}
		return this._changes;
	}
	get delta() {
		if (this._delta === null) {
			let e = this.target.doc, t = [];
			H(e, (e) => {
				let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = this.target._start, a = null, o = {}, s = "", c = 0, l = 0, u = () => {
					if (a !== null) {
						let e = null;
						switch (a) {
							case "delete":
								l > 0 && (e = { delete: l }), l = 0;
								break;
							case "insert":
								(typeof s == "object" || s.length > 0) && (e = { insert: s }, n.size > 0 && (e.attributes = {}, n.forEach((t, n) => {
									t !== null && (e.attributes[n] = t);
								}))), s = "";
								break;
							case "retain": c > 0 && (e = { retain: c }, Pn(o) || (e.attributes = kn({}, o))), c = 0;
						}
						e && t.push(e), a = null;
					}
				};
				for (; i !== null;) {
					switch (i.content.constructor) {
						case mc:
						case Xs:
							this.adds(i) ? this.deletes(i) || (u(), a = "insert", s = i.content.getContent()[0], u()) : this.deletes(i) ? (a !== "delete" && (u(), a = "delete"), l += 1) : i.deleted || (a !== "retain" && (u(), a = "retain"), c += 1);
							break;
						case ic:
							this.adds(i) ? this.deletes(i) || (a !== "insert" && (u(), a = "insert"), s += i.content.str) : this.deletes(i) ? (a !== "delete" && (u(), a = "delete"), l += i.length) : i.deleted || (a !== "retain" && (u(), a = "retain"), c += i.length);
							break;
						case Y: {
							let { key: t, value: s } = i.content;
							if (this.adds(i)) this.deletes(i) || (hs(n.get(t) ?? null, s) ? s !== null && i.delete(e) : (a === "retain" && u(), hs(s, r.get(t) ?? null) ? delete o[t] : o[t] = s));
							else if (this.deletes(i)) {
								r.set(t, s);
								let e = n.get(t) ?? null;
								hs(e, s) || (a === "retain" && u(), o[t] = e);
							} else if (!i.deleted) {
								r.set(t, s);
								let n = o[t];
								n !== void 0 && (hs(n, s) ? n !== null && i.delete(e) : (a === "retain" && u(), s === null ? delete o[t] : o[t] = s));
							}
							i.deleted || (a === "insert" && u(), bs(n, i.content));
							break;
						}
					}
					i = i.right;
				}
				for (u(); t.length > 0;) {
					let e = t[t.length - 1];
					if (e.retain !== void 0 && e.attributes === void 0) t.pop();
					else break;
				}
			}), this._delta = t;
		}
		return this._delta;
	}
}, js = class e extends W {
	constructor(e) {
		super(), this._pending = e === void 0 ? [] : [() => this.insert(0, e)], this._searchMarker = [], this._hasFormatting = !1;
	}
	get length() {
		return this.doc ?? U(), this._length;
	}
	_integrate(e, t) {
		super._integrate(e, t);
		try {
			this._pending.forEach((e) => e());
		} catch (e) {
			console.error(e);
		}
		this._pending = null;
	}
	_copy() {
		return new e();
	}
	clone() {
		let t = new e();
		return t.applyDelta(this.toDelta()), t;
	}
	_callObserver(e, t) {
		super._callObserver(e, t);
		let n = new As(this, e, t);
		Wo(this, e, n), !e.local && this._hasFormatting && (e._needFormattingCleanup = !0);
	}
	toString() {
		this.doc ?? U();
		let e = "", t = this._start;
		for (; t !== null;) !t.deleted && t.countable && t.content.constructor === ic && (e += t.content.str), t = t.right;
		return e;
	}
	toJSON() {
		return this.toString();
	}
	applyDelta(e, { sanitize: t = !0 } = {}) {
		this.doc === null ? this._pending.push(() => this.applyDelta(e)) : H(this.doc, (n) => {
			let r = new gs(null, this._start, 0, /* @__PURE__ */ new Map());
			for (let i = 0; i < e.length; i++) {
				let a = e[i];
				if (a.insert !== void 0) {
					let o = !t && typeof a.insert == "string" && i === e.length - 1 && r.right === null && a.insert.slice(-1) === "\n" ? a.insert.slice(0, -1) : a.insert;
					(typeof o != "string" || o.length > 0) && Cs(n, this, r, o, a.attributes || {});
				} else a.retain === void 0 ? a.delete !== void 0 && ks(n, r, a.delete) : ws(n, this, r, a.retain, a.attributes || {});
			}
		});
	}
	toDelta(e, t, n) {
		this.doc ?? U();
		let r = [], i = /* @__PURE__ */ new Map(), a = this.doc, o = "", s = this._start;
		function c() {
			if (o.length > 0) {
				let e = {}, t = !1;
				i.forEach((n, r) => {
					t = !0, e[r] = n;
				});
				let n = { insert: o };
				t && (n.attributes = e), r.push(n), o = "";
			}
		}
		let l = () => {
			for (; s !== null;) {
				if (Qa(s, e) || t !== void 0 && Qa(s, t)) switch (s.content.constructor) {
					case ic: {
						let r = i.get("ychange");
						e !== void 0 && !Qa(s, e) ? (r === void 0 || r.user !== s.id.client || r.type !== "removed") && (c(), i.set("ychange", n ? n("removed", s.id) : { type: "removed" })) : t !== void 0 && !Qa(s, t) ? (r === void 0 || r.user !== s.id.client || r.type !== "added") && (c(), i.set("ychange", n ? n("added", s.id) : { type: "added" })) : r !== void 0 && (c(), i.delete("ychange")), o += s.content.str;
						break;
					}
					case mc:
					case Xs: {
						c();
						let e = { insert: s.content.getContent()[0] };
						if (i.size > 0) {
							let t = {};
							e.attributes = t, i.forEach((e, n) => {
								t[n] = e;
							});
						}
						r.push(e);
						break;
					}
					case Y: Qa(s, e) && (c(), bs(i, s.content));
				}
				s = s.right;
			}
			c();
		};
		return e || t ? H(a, (n) => {
			e && $a(n, e), t && $a(n, t), l();
		}, "cleanup") : l(), r;
	}
	insert(e, t, n) {
		if (t.length <= 0) return;
		let r = this.doc;
		r === null ? this._pending.push(() => this.insert(e, t, n)) : H(r, (r) => {
			let i = vs(r, this, e, !n);
			n || (n = {}, i.currentAttributes.forEach((e, t) => {
				n[t] = e;
			})), Cs(r, this, i, t, n);
		});
	}
	insertEmbed(e, t, n) {
		let r = this.doc;
		r === null ? this._pending.push(() => this.insertEmbed(e, t, n || {})) : H(r, (r) => {
			let i = vs(r, this, e, !n);
			Cs(r, this, i, t, n || {});
		});
	}
	delete(e, t) {
		if (t === 0) return;
		let n = this.doc;
		n === null ? this._pending.push(() => this.delete(e, t)) : H(n, (n) => {
			ks(n, vs(n, this, e, !0), t);
		});
	}
	format(e, t, n) {
		if (t === 0) return;
		let r = this.doc;
		r === null ? this._pending.push(() => this.format(e, t, n)) : H(r, (r) => {
			let i = vs(r, this, e, !1);
			i.right !== null && ws(r, this, i, t, n);
		});
	}
	removeAttribute(e) {
		this.doc === null ? this._pending.push(() => this.removeAttribute(e)) : H(this.doc, (t) => {
			rs(t, this, e);
		});
	}
	setAttribute(e, t) {
		this.doc === null ? this._pending.push(() => this.setAttribute(e, t)) : H(this.doc, (n) => {
			is(n, this, e, t);
		});
	}
	getAttribute(e) {
		return as(this, e);
	}
	getAttributes() {
		return os(this);
	}
	_write(e) {
		e.writeTypeRef(lc);
	}
}, Ms = (e) => new js(), Ns = class {
	constructor(e, t = () => !0) {
		this._filter = t, this._root = e, this._currentNode = e._start, this._firstCall = !0, e.doc ?? U();
	}
	[Symbol.iterator]() {
		return this;
	}
	next() {
		let e = this._currentNode, t = e && e.content && e.content.type;
		if (e !== null && (!this._firstCall || e.deleted || !this._filter(t))) do
			if (t = e.content.type, !e.deleted && (t.constructor === K || t.constructor === Ps) && t._start !== null) e = t._start;
			else for (; e !== null;) {
				let t = e.next;
				if (t !== null) {
					e = t;
					break;
				}
				e = e.parent === this._root ? null : e.parent._item;
			}
		while (e !== null && (e.deleted || !this._filter(e.content.type)));
		return this._firstCall = !1, e === null ? {
			value: void 0,
			done: !0
		} : (this._currentNode = e, {
			value: e.content.type,
			done: !1
		});
	}
}, Ps = class e extends W {
	constructor() {
		super(), this._prelimContent = [];
	}
	get firstChild() {
		let e = this._first;
		return e ? e.content.getContent()[0] : null;
	}
	_integrate(e, t) {
		super._integrate(e, t), this.insert(0, this._prelimContent), this._prelimContent = null;
	}
	_copy() {
		return new e();
	}
	clone() {
		let t = new e();
		return t.insert(0, this.toArray().map((e) => e instanceof W ? e.clone() : e)), t;
	}
	get length() {
		return this.doc ?? U(), this._prelimContent === null ? this._length : this._prelimContent.length;
	}
	createTreeWalker(e) {
		return new Ns(this, e);
	}
	querySelector(e) {
		e = e.toUpperCase();
		let t = new Ns(this, (t) => t.nodeName && t.nodeName.toUpperCase() === e).next();
		return t.done ? null : t.value;
	}
	querySelectorAll(e) {
		return e = e.toUpperCase(), nt(new Ns(this, (t) => t.nodeName && t.nodeName.toUpperCase() === e));
	}
	_callObserver(e, t) {
		Wo(this, e, new Ls(this, t, e));
	}
	toString() {
		return Yo(this, (e) => e.toString()).join("");
	}
	toJSON() {
		return this.toString();
	}
	toDOM(e = document, t = {}, n) {
		let r = e.createDocumentFragment();
		return n !== void 0 && n._createAssociation(r, this), Jo(this, (i) => {
			r.insertBefore(i.toDOM(e, t, n), null);
		}), r;
	}
	insert(e, t) {
		this.doc === null ? this._prelimContent.splice(e, 0, ...t) : H(this.doc, (n) => {
			es(n, this, e, t);
		});
	}
	insertAfter(e, t) {
		if (this.doc !== null) H(this.doc, (n) => {
			let r = e && e instanceof W ? e._item : e;
			Qo(n, this, r, t);
		});
		else {
			let n = this._prelimContent, r = e === null ? 0 : n.findIndex((t) => t === e) + 1;
			if (r === 0 && e !== null) throw Xt("Reference item not found");
			n.splice(r, 0, ...t);
		}
	}
	delete(e, t = 1) {
		this.doc === null ? this._prelimContent.splice(e, t) : H(this.doc, (n) => {
			ns(n, this, e, t);
		});
	}
	toArray() {
		return Ko(this);
	}
	push(e) {
		this.insert(this.length, e);
	}
	unshift(e) {
		this.insert(0, e);
	}
	get(e) {
		return Zo(this, e);
	}
	slice(e = 0, t = this.length) {
		return Go(this, e, t);
	}
	forEach(e) {
		Jo(this, e);
	}
	_write(e) {
		e.writeTypeRef(dc);
	}
}, Fs = (e) => new Ps(), K = class e extends Ps {
	constructor(e = "UNDEFINED") {
		super(), this.nodeName = e, this._prelimAttrs = /* @__PURE__ */ new Map();
	}
	get nextSibling() {
		let e = this._item ? this._item.next : null;
		return e ? e.content.type : null;
	}
	get prevSibling() {
		let e = this._item ? this._item.prev : null;
		return e ? e.content.type : null;
	}
	_integrate(e, t) {
		super._integrate(e, t), this._prelimAttrs.forEach((e, t) => {
			this.setAttribute(t, e);
		}), this._prelimAttrs = null;
	}
	_copy() {
		return new e(this.nodeName);
	}
	clone() {
		let t = new e(this.nodeName);
		return jn(this.getAttributes(), (e, n) => {
			t.setAttribute(n, e);
		}), t.insert(0, this.toArray().map((e) => e instanceof W ? e.clone() : e)), t;
	}
	toString() {
		let e = this.getAttributes(), t = [], n = [];
		for (let t in e) n.push(t);
		n.sort();
		let r = n.length;
		for (let i = 0; i < r; i++) {
			let r = n[i];
			t.push(r + "=\"" + e[r] + "\"");
		}
		let i = this.nodeName.toLocaleLowerCase();
		return `<${i}${t.length > 0 ? " " + t.join(" ") : ""}>${super.toString()}</${i}>`;
	}
	removeAttribute(e) {
		this.doc === null ? this._prelimAttrs.delete(e) : H(this.doc, (t) => {
			rs(t, this, e);
		});
	}
	setAttribute(e, t) {
		this.doc === null ? this._prelimAttrs.set(e, t) : H(this.doc, (n) => {
			is(n, this, e, t);
		});
	}
	getAttribute(e) {
		return as(this, e);
	}
	hasAttribute(e) {
		return ss(this, e);
	}
	getAttributes(e) {
		return e ? cs(this, e) : os(this);
	}
	toDOM(e = document, t = {}, n) {
		let r = e.createElement(this.nodeName), i = this.getAttributes();
		for (let e in i) {
			let t = i[e];
			typeof t == "string" && r.setAttribute(e, t);
		}
		return Jo(this, (i) => {
			r.appendChild(i.toDOM(e, t, n));
		}), n !== void 0 && n._createAssociation(r, this), r;
	}
	_write(e) {
		e.writeTypeRef(uc), e.writeKey(this.nodeName);
	}
}, Is = (e) => new K(e.readKey()), Ls = class extends Po {
	constructor(e, t, n) {
		super(e, n), this.childListChanged = !1, this.attributesChanged = /* @__PURE__ */ new Set(), t.forEach((e) => {
			e === null ? this.childListChanged = !0 : this.attributesChanged.add(e);
		});
	}
}, Rs = class e extends G {
	constructor(e) {
		super(), this.hookName = e;
	}
	_copy() {
		return new e(this.hookName);
	}
	clone() {
		let t = new e(this.hookName);
		return this.forEach((e, n) => {
			t.set(n, e);
		}), t;
	}
	toDOM(e = document, t = {}, n) {
		let r = t[this.hookName], i;
		return i = r === void 0 ? document.createElement(this.hookName) : r.createDom(this), i.setAttribute("data-yjs-hook", this.hookName), n !== void 0 && n._createAssociation(i, this), i;
	}
	_write(e) {
		e.writeTypeRef(fc), e.writeKey(this.hookName);
	}
}, zs = (e) => new Rs(e.readKey()), q = class e extends js {
	get nextSibling() {
		let e = this._item ? this._item.next : null;
		return e ? e.content.type : null;
	}
	get prevSibling() {
		let e = this._item ? this._item.prev : null;
		return e ? e.content.type : null;
	}
	_copy() {
		return new e();
	}
	clone() {
		let t = new e();
		return t.applyDelta(this.toDelta()), t;
	}
	toDOM(e = document, t, n) {
		let r = e.createTextNode(this.toString());
		return n !== void 0 && n._createAssociation(r, this), r;
	}
	toString() {
		return this.toDelta().map((e) => {
			let t = [];
			for (let n in e.attributes) {
				let r = [];
				for (let t in e.attributes[n]) r.push({
					key: t,
					value: e.attributes[n][t]
				});
				r.sort((e, t) => e.key < t.key ? -1 : 1), t.push({
					nodeName: n,
					attrs: r
				});
			}
			t.sort((e, t) => e.nodeName < t.nodeName ? -1 : 1);
			let n = "";
			for (let e = 0; e < t.length; e++) {
				let r = t[e];
				n += `<${r.nodeName}`;
				for (let e = 0; e < r.attrs.length; e++) {
					let t = r.attrs[e];
					n += ` ${t.key}="${t.value}"`;
				}
				n += ">";
			}
			n += e.insert;
			for (let e = t.length - 1; e >= 0; e--) n += `</${t[e].nodeName}>`;
			return n;
		}).join("");
	}
	toJSON() {
		return this.toString();
	}
	_write(e) {
		e.writeTypeRef(pc);
	}
}, Bs = (e) => new q(), Vs = class {
	constructor(e, t) {
		this.id = e, this.length = t;
	}
	get deleted() {
		throw A();
	}
	mergeWith(e) {
		return !1;
	}
	write(e, t, n) {
		throw A();
	}
	integrate(e, t) {
		throw A();
	}
}, Hs = 0, J = class extends Vs {
	get deleted() {
		return !0;
	}
	delete() {}
	mergeWith(e) {
		return this.constructor === e.constructor && (this.length += e.length, !0);
	}
	integrate(e, t) {
		t > 0 && (this.id.clock += t, this.length -= t), no(e.doc.store, this);
	}
	write(e, t) {
		e.writeInfo(Hs), e.writeLen(this.length - t);
	}
	getMissing(e, t) {
		return null;
	}
}, Us = class e {
	constructor(e) {
		this.content = e;
	}
	getLength() {
		return 1;
	}
	getContent() {
		return [this.content];
	}
	isCountable() {
		return !0;
	}
	copy() {
		return new e(this.content);
	}
	splice(e) {
		throw A();
	}
	mergeWith(e) {
		return !1;
	}
	integrate(e, t) {}
	delete(e) {}
	gc(e) {}
	write(e, t) {
		e.writeBuf(this.content);
	}
	getRef() {
		return 3;
	}
}, Ws = (e) => new Us(e.readBuf()), Gs = class e {
	constructor(e) {
		this.len = e;
	}
	getLength() {
		return this.len;
	}
	getContent() {
		return [];
	}
	isCountable() {
		return !1;
	}
	copy() {
		return new e(this.len);
	}
	splice(t) {
		let n = new e(this.len - t);
		return this.len = t, n;
	}
	mergeWith(e) {
		return this.len += e.len, !0;
	}
	integrate(e, t) {
		Qi(e.deleteSet, t.id.client, t.id.clock, this.len), t.markDeleted();
	}
	delete(e) {}
	gc(e) {}
	write(e, t) {
		e.writeLen(this.len - t);
	}
	getRef() {
		return 1;
	}
}, Ks = (e) => new Gs(e.readLen()), qs = (e, t) => new R({
	guid: e,
	...t,
	shouldLoad: t.shouldLoad || t.autoLoad || !1
}), Js = class e {
	constructor(e) {
		e._item && console.error("This document was already integrated as a sub-document. You should create a second instance instead with the same guid."), this.doc = e;
		let t = {};
		this.opts = t, e.gc || (t.gc = !1), e.autoLoad && (t.autoLoad = !0), e.meta !== null && (t.meta = e.meta);
	}
	getLength() {
		return 1;
	}
	getContent() {
		return [this.doc];
	}
	isCountable() {
		return !0;
	}
	copy() {
		return new e(qs(this.doc.guid, this.opts));
	}
	splice(e) {
		throw A();
	}
	mergeWith(e) {
		return !1;
	}
	integrate(e, t) {
		this.doc._item = t, e.subdocsAdded.add(this.doc), this.doc.shouldLoad && e.subdocsLoaded.add(this.doc);
	}
	delete(e) {
		e.subdocsAdded.has(this.doc) ? e.subdocsAdded.delete(this.doc) : e.subdocsRemoved.add(this.doc);
	}
	gc(e) {}
	write(e, t) {
		e.writeString(this.doc.guid), e.writeAny(this.opts);
	}
	getRef() {
		return 9;
	}
}, Ys = (e) => new Js(qs(e.readString(), e.readAny())), Xs = class e {
	constructor(e) {
		this.embed = e;
	}
	getLength() {
		return 1;
	}
	getContent() {
		return [this.embed];
	}
	isCountable() {
		return !0;
	}
	copy() {
		return new e(this.embed);
	}
	splice(e) {
		throw A();
	}
	mergeWith(e) {
		return !1;
	}
	integrate(e, t) {}
	delete(e) {}
	gc(e) {}
	write(e, t) {
		e.writeJSON(this.embed);
	}
	getRef() {
		return 5;
	}
}, Zs = (e) => new Xs(e.readJSON()), Y = class e {
	constructor(e, t) {
		this.key = e, this.value = t;
	}
	getLength() {
		return 1;
	}
	getContent() {
		return [];
	}
	isCountable() {
		return !1;
	}
	copy() {
		return new e(this.key, this.value);
	}
	splice(e) {
		throw A();
	}
	mergeWith(e) {
		return !1;
	}
	integrate(e, t) {
		let n = t.parent;
		n._searchMarker = null, n._hasFormatting = !0;
	}
	delete(e) {}
	gc(e) {}
	write(e, t) {
		e.writeKey(this.key), e.writeJSON(this.value);
	}
	getRef() {
		return 6;
	}
}, Qs = (e) => new Y(e.readKey(), e.readJSON()), $s = class e {
	constructor(e) {
		this.arr = e;
	}
	getLength() {
		return this.arr.length;
	}
	getContent() {
		return this.arr;
	}
	isCountable() {
		return !0;
	}
	copy() {
		return new e(this.arr);
	}
	splice(t) {
		let n = new e(this.arr.slice(t));
		return this.arr = this.arr.slice(0, t), n;
	}
	mergeWith(e) {
		return this.arr = this.arr.concat(e.arr), !0;
	}
	integrate(e, t) {}
	delete(e) {}
	gc(e) {}
	write(e, t) {
		let n = this.arr.length;
		e.writeLen(n - t);
		for (let r = t; r < n; r++) {
			let t = this.arr[r];
			e.writeString(t === void 0 ? "undefined" : JSON.stringify(t));
		}
	}
	getRef() {
		return 2;
	}
}, ec = (e) => {
	let t = e.readLen(), n = [];
	for (let r = 0; r < t; r++) {
		let t = e.readString();
		t === "undefined" ? n.push(void 0) : n.push(JSON.parse(t));
	}
	return new $s(n);
}, tc = Yn("node_env") === "development", nc = class e {
	constructor(e) {
		this.arr = e, tc && zn(e);
	}
	getLength() {
		return this.arr.length;
	}
	getContent() {
		return this.arr;
	}
	isCountable() {
		return !0;
	}
	copy() {
		return new e(this.arr);
	}
	splice(t) {
		let n = new e(this.arr.slice(t));
		return this.arr = this.arr.slice(0, t), n;
	}
	mergeWith(e) {
		return this.arr = this.arr.concat(e.arr), !0;
	}
	integrate(e, t) {}
	delete(e) {}
	gc(e) {}
	write(e, t) {
		let n = this.arr.length;
		e.writeLen(n - t);
		for (let r = t; r < n; r++) {
			let t = this.arr[r];
			e.writeAny(t);
		}
	}
	getRef() {
		return 8;
	}
}, rc = (e) => {
	let t = e.readLen(), n = [];
	for (let r = 0; r < t; r++) n.push(e.readAny());
	return new nc(n);
}, ic = class e {
	constructor(e) {
		this.str = e;
	}
	getLength() {
		return this.str.length;
	}
	getContent() {
		return this.str.split("");
	}
	isCountable() {
		return !0;
	}
	copy() {
		return new e(this.str);
	}
	splice(t) {
		let n = new e(this.str.slice(t));
		this.str = this.str.slice(0, t);
		let r = this.str.charCodeAt(t - 1);
		return r >= 55296 && r <= 56319 && (this.str = this.str.slice(0, t - 1) + "�", n.str = "�" + n.str.slice(1)), n;
	}
	mergeWith(e) {
		return this.str += e.str, !0;
	}
	integrate(e, t) {}
	delete(e) {}
	gc(e) {}
	write(e, t) {
		e.writeString(t === 0 ? this.str : this.str.slice(t));
	}
	getRef() {
		return 4;
	}
}, ac = (e) => new ic(e.readString()), oc = [
	fs,
	ms,
	Ms,
	Is,
	Fs,
	zs,
	Bs
], sc = 0, cc = 1, lc = 2, uc = 3, dc = 4, fc = 5, pc = 6, mc = class e {
	constructor(e) {
		this.type = e;
	}
	getLength() {
		return 1;
	}
	getContent() {
		return [this.type];
	}
	isCountable() {
		return !0;
	}
	copy() {
		return new e(this.type._copy());
	}
	splice(e) {
		throw A();
	}
	mergeWith(e) {
		return !1;
	}
	integrate(e, t) {
		this.type._integrate(e.doc, t);
	}
	delete(e) {
		let t = this.type._start;
		for (; t !== null;) t.deleted ? t.id.clock < (e.beforeState.get(t.id.client) || 0) && e._mergeStructs.push(t) : t.delete(e), t = t.right;
		this.type._map.forEach((t) => {
			t.deleted ? t.id.clock < (e.beforeState.get(t.id.client) || 0) && e._mergeStructs.push(t) : t.delete(e);
		}), e.changed.delete(this.type);
	}
	gc(e) {
		let t = this.type._start;
		for (; t !== null;) t.gc(e, !0), t = t.right;
		this.type._start = null, this.type._map.forEach((t) => {
			for (; t !== null;) t.gc(e, !0), t = t.left;
		}), this.type._map = /* @__PURE__ */ new Map();
	}
	write(e, t) {
		this.type._write(e);
	}
	getRef() {
		return 7;
	}
}, hc = (e) => new mc(oc[e.readTypeRef()](e)), gc = (e, t) => {
	let n = t, r = 0, i;
	do
		r > 0 && (n = z(n.client, n.clock + r)), i = io(e, n), r = n.clock - i.id.clock, n = i.redone;
	while (n !== null && i instanceof X);
	return {
		item: i,
		diff: r
	};
}, _c = (e, t) => {
	for (; e !== null && e.keep !== t;) e.keep = t, e = e.parent._item;
}, vc = (e, t, n) => {
	let { client: r, clock: i } = t.id, a = new X(z(r, i + n), t, z(r, i + n - 1), t.right, t.rightOrigin, t.parent, t.parentSub, t.content.splice(n));
	return t.deleted && a.markDeleted(), t.keep && (a.keep = !0), t.redone !== null && (a.redone = z(t.redone.client, t.redone.clock + n)), t.right = a, a.right !== null && (a.right.left = a), e._mergeStructs.push(a), a.parentSub !== null && a.right === null && a.parent._map.set(a.parentSub, a), t.length = n, a;
}, yc = (e, t) => it(e, (e) => Yi(e.deletions, t)), bc = (e, t, n, r, i, a) => {
	let o = e.doc, s = o.store, c = o.clientID, l = t.redone;
	if (l !== null) return V(e, l);
	let u = t.parent._item, d = null, f;
	if (u !== null && u.deleted === !0) {
		if (u.redone === null && (!n.has(u) || bc(e, u, n, r, i, a) === null)) return null;
		for (; u.redone !== null;) u = V(e, u.redone);
	}
	let p = u === null ? t.parent : u.content.type;
	if (t.parentSub === null) {
		for (d = t.left, f = t; d !== null;) {
			let t = d;
			for (; t !== null && t.parent._item !== u;) t = t.redone === null ? null : V(e, t.redone);
			if (t !== null && t.parent._item === u) {
				d = t;
				break;
			}
			d = d.left;
		}
		for (; f !== null;) {
			let t = f;
			for (; t !== null && t.parent._item !== u;) t = t.redone === null ? null : V(e, t.redone);
			if (t !== null && t.parent._item === u) {
				f = t;
				break;
			}
			f = f.right;
		}
	} else if (f = null, t.right && !i) {
		for (d = t; d !== null && d.right !== null && (d.right.redone || Yi(r, d.right.id) || yc(a.undoStack, d.right.id) || yc(a.redoStack, d.right.id));) for (d = d.right; d.redone;) d = V(e, d.redone);
		if (d && d.right !== null) return null;
	} else d = p._map.get(t.parentSub) || null;
	let m = z(c, B(s, c)), h = new X(m, d, d && d.lastId, f, f && f.id, p, t.parentSub, t.content.copy());
	return t.redone = m, _c(h, !0), h.integrate(e, 0), h;
}, X = class e extends Vs {
	constructor(e, t, n, r, i, a, o, s) {
		super(e, s.getLength()), this.origin = n, this.left = t, this.right = r, this.rightOrigin = i, this.parent = a, this.parentSub = o, this.redone = null, this.content = s, this.info = this.content.isCountable() ? 2 : 0;
	}
	set marker(e) {
		(this.info & 8) > 0 !== e && (this.info ^= 8);
	}
	get marker() {
		return (this.info & 8) > 0;
	}
	get keep() {
		return (this.info & 1) > 0;
	}
	set keep(e) {
		this.keep !== e && (this.info ^= 1);
	}
	get countable() {
		return (this.info & 2) > 0;
	}
	get deleted() {
		return (this.info & 4) > 0;
	}
	set deleted(e) {
		this.deleted !== e && (this.info ^= 4);
	}
	markDeleted() {
		this.info |= 4;
	}
	getMissing(t, n) {
		if (this.origin && this.origin.client !== this.id.client && this.origin.clock >= B(n, this.origin.client)) return this.origin.client;
		if (this.rightOrigin && this.rightOrigin.client !== this.id.client && this.rightOrigin.clock >= B(n, this.rightOrigin.client)) return this.rightOrigin.client;
		if (this.parent && this.parent.constructor === Fa && this.id.client !== this.parent.client && this.parent.clock >= B(n, this.parent.client)) return this.parent.client;
		if (this.origin &&= (this.left = oo(t, n, this.origin), this.left.lastId), this.rightOrigin &&= (this.right = V(t, this.rightOrigin), this.right.id), this.left && this.left.constructor === J || this.right && this.right.constructor === J) this.parent = null;
		else if (!this.parent) this.left && this.left.constructor === e ? (this.parent = this.left.parent, this.parentSub = this.left.parentSub) : this.right && this.right.constructor === e && (this.parent = this.right.parent, this.parentSub = this.right.parentSub);
		else if (this.parent.constructor === Fa) {
			let e = io(n, this.parent);
			this.parent = e.constructor === J ? null : e.content.type;
		}
		return null;
	}
	integrate(e, t) {
		if (t > 0 && (this.id.clock += t, this.left = oo(e, e.doc.store, z(this.id.client, this.id.clock - 1)), this.origin = this.left.lastId, this.content = this.content.splice(t), this.length -= t), this.parent) {
			if (!this.left && (!this.right || this.right.left !== null) || this.left && this.left.right !== this.right) {
				let t = this.left, n;
				if (t !== null) n = t.right;
				else if (this.parentSub !== null) for (n = this.parent._map.get(this.parentSub) || null; n !== null && n.left !== null;) n = n.left;
				else n = this.parent._start;
				let r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
				for (; n !== null && n !== this.right;) {
					if (i.add(n), r.add(n), Ia(this.origin, n.origin)) {
						if (n.id.client < this.id.client) t = n, r.clear();
						else if (Ia(this.rightOrigin, n.rightOrigin)) break;
					} else if (n.origin !== null && i.has(io(e.doc.store, n.origin))) r.has(io(e.doc.store, n.origin)) || (t = n, r.clear());
					else break;
					n = n.right;
				}
				this.left = t;
			}
			if (this.left !== null) {
				let e = this.left.right;
				this.right = e, this.left.right = this;
			} else {
				let e;
				if (this.parentSub !== null) for (e = this.parent._map.get(this.parentSub) || null; e !== null && e.left !== null;) e = e.left;
				else e = this.parent._start, this.parent._start = this;
				this.right = e;
			}
			this.right === null ? this.parentSub !== null && (this.parent._map.set(this.parentSub, this), this.left !== null && this.left.delete(e)) : this.right.left = this, this.parentSub === null && this.countable && !this.deleted && (this.parent._length += this.length), no(e.doc.store, this), this.content.integrate(e, this), fo(e, this.parent, this.parentSub), (this.parent._item !== null && this.parent._item.deleted || this.parentSub !== null && this.right !== null) && this.delete(e);
		} else new J(this.id, this.length).integrate(e, 0);
	}
	get next() {
		let e = this.right;
		for (; e !== null && e.deleted;) e = e.right;
		return e;
	}
	get prev() {
		let e = this.left;
		for (; e !== null && e.deleted;) e = e.left;
		return e;
	}
	get lastId() {
		return this.length === 1 ? this.id : z(this.id.client, this.id.clock + this.length - 1);
	}
	mergeWith(e) {
		if (this.constructor === e.constructor && Ia(e.origin, this.lastId) && this.right === e && Ia(this.rightOrigin, e.rightOrigin) && this.id.client === e.id.client && this.id.clock + this.length === e.id.clock && this.deleted === e.deleted && this.redone === null && e.redone === null && this.content.constructor === e.content.constructor && this.content.mergeWith(e.content)) {
			let t = this.parent._searchMarker;
			return t && t.forEach((t) => {
				t.p === e && (t.p = this, !this.deleted && this.countable && (t.index -= this.length));
			}), e.keep && (this.keep = !0), this.right = e.right, this.right !== null && (this.right.left = this), this.length += e.length, !0;
		}
		return !1;
	}
	delete(e) {
		if (!this.deleted) {
			let t = this.parent;
			this.countable && this.parentSub === null && (t._length -= this.length), this.markDeleted(), Qi(e.deleteSet, this.id.client, this.id.clock, this.length), fo(e, t, this.parentSub), this.content.delete(e);
		}
	}
	gc(e, t) {
		if (!this.deleted) throw j();
		this.content.gc(e), t ? so(e, this, new J(this.id, this.length)) : this.content = new Gs(this.length);
	}
	write(e, t) {
		let n = t > 0 ? z(this.id.client, this.id.clock + t - 1) : this.origin, r = this.rightOrigin, i = this.parentSub, a = this.content.getRef() & 31 | (n === null ? 0 : 128) | (r === null ? 0 : 64) | (i === null ? 0 : 32);
		if (e.writeInfo(a), n !== null && e.writeLeftID(n), r !== null && e.writeRightID(r), n === null && r === null) {
			let t = this.parent;
			if (t._item !== void 0) {
				let n = t._item;
				if (n === null) {
					let n = La(t);
					e.writeParentInfo(!0), e.writeString(n);
				} else e.writeParentInfo(!1), e.writeLeftID(n.id);
			} else t.constructor === String ? (e.writeParentInfo(!0), e.writeString(t)) : t.constructor === Fa ? (e.writeParentInfo(!1), e.writeLeftID(t)) : j();
			i !== null && e.writeString(i);
		}
		this.content.write(e, t);
	}
}, xc = (e, t) => Sc[t & 31](e), Sc = [
	() => {
		j();
	},
	Ks,
	ec,
	Ws,
	ac,
	Zs,
	Qs,
	hc,
	rc,
	Ys,
	() => {
		j();
	}
], Cc = 10, Z = class extends Vs {
	get deleted() {
		return !0;
	}
	delete() {}
	mergeWith(e) {
		return this.constructor === e.constructor && (this.length += e.length, !0);
	}
	integrate(e, t) {
		j();
	}
	write(e, t) {
		e.writeInfo(Cc), O(e.restEncoder, this.length - t);
	}
	getMissing(e, t) {
		return null;
	}
}, wc = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {}, Tc = "__ $YJS$ __";
wc[Tc] === !0 && console.error("Yjs was already imported. This breaks constructor checks and will lead to issues! - https://github.com/yjs/yjs/issues/438"), wc[Tc] = !0;
// node_modules/.bun/@lexical+offset@0.40.0/node_modules/@lexical/offset/LexicalOffset.prod.mjs
function Ec(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
function Dc(e, t) {
	let n = [], r = e.__first;
	for (; r !== null;) {
		let e = t === null ? ye(r) : t.get(r);
		e ?? Ec(174), n.push(r), r = e.__next;
	}
	return n;
}
// node_modules/.bun/@lexical+yjs@0.40.0+37c7afd0c39825fa/node_modules/@lexical/yjs/LexicalYjs.prod.mjs
function Q(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
function Oc(e, t, n) {
	let r = e.length, i = t.length, a = 0, o = 0;
	for (; a < r && a < i && e[a] === t[a] && a < n;) a++;
	for (; o + a < r && o + a < i && e[r - o - 1] === t[i - o - 1];) o++;
	for (; o + a < r && o + a < i && e[a] === t[a];) a++;
	return {
		index: a,
		insert: t.slice(a, i - o),
		remove: r - a - o
	};
}
var kc = class {
	_xmlElem;
	_key;
	_parent;
	_type;
	constructor(e, t, n) {
		this._key = "", this._xmlElem = e, this._parent = t, this._type = n;
	}
	getPrevNode(e) {
		if (e === null) return null;
		let t = e.get(this._key);
		return u(t) ? t : null;
	}
	getNode() {
		let e = ye(this._key);
		return u(e) ? e : null;
	}
	getSharedType() {
		return this._xmlElem;
	}
	getType() {
		return this._type;
	}
	getKey() {
		return this._key;
	}
	getSize() {
		return 1;
	}
	getOffset() {
		return this._parent.getChildOffset(this);
	}
	syncPropertiesFromLexical(e, t, n) {
		let r = this.getPrevNode(n);
		tl(e, this._xmlElem, r, t);
	}
	syncPropertiesFromYjs(e, t) {
		let n = this.getNode();
		n === null && Q(83), Zc(e, this._xmlElem, n, t);
	}
	destroy(e) {
		let t = e.collabNodeMap;
		t.get(this._key) === this && t.delete(this._key);
	}
};
function Ac(e, t, n) {
	let r = new kc(e, t, n);
	return e._collabNode = r, r;
}
var jc = class {
	_map;
	_key;
	_parent;
	_type;
	constructor(e, t) {
		this._key = "", this._map = e, this._parent = t, this._type = "linebreak";
	}
	getNode() {
		let e = ye(this._key);
		return ee(e) ? e : null;
	}
	getKey() {
		return this._key;
	}
	getSharedType() {
		return this._map;
	}
	getType() {
		return this._type;
	}
	getSize() {
		return 1;
	}
	getOffset() {
		return this._parent.getChildOffset(this);
	}
	destroy(e) {
		let t = e.collabNodeMap;
		t.get(this._key) === this && t.delete(this._key);
	}
};
function Mc(e, t) {
	let n = new jc(e, t);
	return e._collabNode = n, n;
}
var $ = class {
	_map;
	_key;
	_parent;
	_text;
	_type;
	_normalized;
	constructor(e, t, n, r) {
		this._key = "", this._map = e, this._parent = n, this._text = t, this._type = r, this._normalized = !1;
	}
	getPrevNode(e) {
		if (e === null) return null;
		let t = e.get(this._key);
		return b(t) ? t : null;
	}
	getNode() {
		let e = ye(this._key);
		return b(e) ? e : null;
	}
	getSharedType() {
		return this._map;
	}
	getType() {
		return this._type;
	}
	getKey() {
		return this._key;
	}
	getSize() {
		return this._text.length + +!this._normalized;
	}
	getOffset() {
		return this._parent.getChildOffset(this);
	}
	spliceText(e, t, n) {
		let r = this._parent._xmlText, i = this.getOffset() + 1 + e;
		t !== 0 && r.delete(i, t), n !== "" && r.insert(i, n);
	}
	syncPropertiesAndTextFromLexical(e, t, n) {
		let r = this.getPrevNode(n), i = t.__text;
		if (tl(e, this._map, r, t), r !== null) {
			let e = r.__text;
			e !== i && ((function(e, t, n, r) {
				let i = v(), a = r.length;
				if (_e(i) && i.isCollapsed()) {
					let e = i.anchor;
					e.key === t && (a = e.offset);
				}
				let o = Oc(n, r, a);
				e.spliceText(o.index, o.remove, o.insert);
			})(this, t.__key, e, i), this._text = i);
		}
	}
	syncPropertiesAndTextFromYjs(e, t) {
		let n = this.getNode();
		n === null && Q(84), Zc(e, this._map, n, t);
		let r = this._text;
		n.__text !== r && n.setTextContent(r);
	}
	destroy(e) {
		let t = e.collabNodeMap;
		t.get(this._key) === this && t.delete(this._key);
	}
};
function Nc(e, t, n, r) {
	let i = new $(e, t, n, r);
	return e._collabNode = i, i;
}
var Pc = class e {
	_key;
	_children;
	_xmlText;
	_type;
	_parent;
	constructor(e, t, n) {
		this._key = "", this._children = [], this._xmlText = e, this._type = n, this._parent = t;
	}
	getPrevNode(e) {
		if (e === null) return null;
		let t = e.get(this._key);
		return g(t) ? t : null;
	}
	getNode() {
		let e = ye(this._key);
		return g(e) ? e : null;
	}
	getSharedType() {
		return this._xmlText;
	}
	getType() {
		return this._type;
	}
	getKey() {
		return this._key;
	}
	isEmpty() {
		return this._children.length === 0;
	}
	getSize() {
		return 1;
	}
	getOffset() {
		let e = this._parent;
		return e === null && Q(90), e.getChildOffset(this);
	}
	syncPropertiesFromYjs(e, t) {
		let n = this.getNode();
		n === null && Q(91), Zc(e, this._xmlText, n, t);
	}
	applyChildrenYjsDelta(t, n) {
		let r = this._children, i = 0, a = null;
		for (let o = 0; o < n.length; o++) {
			let s = n[o], c = s.insert, l = s.delete;
			if (s.retain != null) i += s.retain;
			else if (typeof l == "number") {
				let t = l;
				for (; t > 0;) {
					let { node: n, nodeIndex: a, offset: o, length: s } = rl(this, i, !1);
					if (n instanceof e || n instanceof jc || n instanceof kc) r.splice(a, 1), --t;
					else {
						if (!(n instanceof $)) break;
						{
							let e = Math.min(t, s), i = a === 0 ? null : r[a - 1], c = n.getSize();
							if (o === 0 && s === c) {
								r.splice(a, 1);
								let t = nl(n._text, o, e - 1, "");
								t.length > 0 && (i instanceof $ ? i._text += t : this._xmlText.delete(o, t.length));
							} else n._text = nl(n._text, o, e, "");
							t -= e;
						}
					}
				}
			} else {
				if (c == null) throw Error("Unexpected delta format");
				if (typeof c == "string") {
					let { node: e, offset: t } = rl(this, i, !0);
					e instanceof $ ? e._text = nl(e._text, t, 0, c) : this._xmlText.delete(t, c.length), i += c.length;
				} else {
					let e = c, { node: n, nodeIndex: o, length: s } = rl(this, i, !1), l = Yc(t, e, this);
					if (n instanceof $ && s > 0 && s < n._text.length) {
						let e = n._text, t = e.length - s;
						n._text = nl(e, t, s, ""), r.splice(o + 1, 0, l), a = nl(e, 0, t, "");
					} else r.splice(o, 0, l);
					a !== null && l instanceof $ && (l._text = a + l._text, a = null), i += 1;
				}
			}
		}
	}
	syncChildrenFromYjs(t) {
		let n = this.getNode();
		n === null && Q(92);
		let r = n.__key, i = Dc(n, null), a = i.length, o = this._children, s = o.length, c = t.collabNodeMap, l = /* @__PURE__ */ new Set(), u, d, f = 0, p = null;
		s !== a && (d = n.getWritable());
		for (let a = 0; a < s; a++) {
			let m = i[f], h = o[a], g = h.getNode(), _ = h._key;
			if (g !== null && m === _) {
				let n = b(g);
				if (l.add(m), n) {
					if (h._key = m, h instanceof e) {
						let e = h._xmlText;
						h.syncPropertiesFromYjs(t, null), h.applyChildrenYjsDelta(t, e.toDelta()), h.syncChildrenFromYjs(t);
					} else h instanceof $ ? h.syncPropertiesAndTextFromYjs(t, null) : h instanceof kc ? h.syncPropertiesFromYjs(t, null) : h instanceof jc || Q(93);
				}
				p = g, f++;
			} else {
				if (u === void 0) {
					u = /* @__PURE__ */ new Set();
					for (let e = 0; e < s; e++) {
						let t = o[e]._key;
						t !== "" && u.add(t);
					}
				}
				if (g !== null && m !== void 0 && !u.has(m)) {
					let e = ce(m);
					Ce(e), a--, f++;
					continue;
				}
				d = n.getWritable();
				let e = Xc(t, h, r), i = e.__key;
				if (c.set(i, h), p === null) {
					let t = d.getFirstChild();
					if (d.__first = i, t !== null) {
						let n = t.getWritable();
						n.__prev = i, e.__next = n.__key;
					}
				} else {
					let t = p.getWritable(), n = p.getNextSibling();
					if (t.__next = i, e.__prev = p.__key, n !== null) {
						let t = n.getWritable();
						t.__prev = i, e.__next = t.__key;
					}
				}
				a === s - 1 && (d.__last = i), d.__size++, p = e;
			}
		}
		for (let e = 0; e < a; e++) {
			let n = i[e];
			if (!l.has(n)) {
				let e = ce(n), r = t.collabNodeMap.get(n);
				r !== void 0 && r.destroy(t), Ce(e);
			}
		}
	}
	syncPropertiesFromLexical(e, t, n) {
		tl(e, this._xmlText, this.getPrevNode(n), t);
	}
	_syncChildFromLexical(t, n, r, i, a, o) {
		let s = this._children[n], c = ce(r);
		s instanceof e && g(c) ? (s.syncPropertiesFromLexical(t, c, i), s.syncChildrenFromLexical(t, c, i, a, o)) : s instanceof $ && b(c) ? s.syncPropertiesAndTextFromLexical(t, c, i) : s instanceof kc && u(c) && s.syncPropertiesFromLexical(t, c, i);
	}
	syncChildrenFromLexical(e, t, n, r, i) {
		let a = this.getPrevNode(n), o = a === null ? [] : Dc(a, n), s = Dc(t, null), c = o.length - 1, l = s.length - 1, u = e.collabNodeMap, d, f, p = 0, m = 0;
		for (; p <= c && m <= l;) {
			let t = o[p], a = s[m];
			if (t === a) this._syncChildFromLexical(e, m, a, n, r, i), p++, m++;
			else {
				d === void 0 && (d = new Set(o)), f === void 0 && (f = new Set(s));
				let n = f.has(t), r = d.has(a);
				if (n) {
					let t = qc(e, ce(a), this);
					u.set(a, t), r ? (this.splice(e, m, 1, t), p++, m++) : (this.splice(e, m, 0, t), m++);
				} else this.splice(e, m, 1), p++;
			}
		}
		let h = p > c, g = m > l;
		if (h && !g) for (; m <= l; ++m) {
			let t = s[m], n = qc(e, ce(t), this);
			this.append(n), u.set(t, n);
		}
		else if (g && !h) for (let t = this._children.length - 1; t >= m; t--) this.splice(e, t, 1);
	}
	append(t) {
		let n = this._xmlText, r = this._children, i = r[r.length - 1], a = i === void 0 ? 0 : i.getOffset() + i.getSize();
		if (t instanceof e) n.insertEmbed(a, t._xmlText);
		else if (t instanceof $) {
			let e = t._map;
			e.parent === null && n.insertEmbed(a, e), n.insert(a + 1, t._text);
		} else t instanceof jc ? n.insertEmbed(a, t._map) : t instanceof kc && n.insertEmbed(a, t._xmlElem);
		this._children.push(t);
	}
	splice(t, n, r, i) {
		let a = this._children, o = a[n];
		if (o === void 0) return i === void 0 && Q(94), void this.append(i);
		let s = o.getOffset();
		s === -1 && Q(95);
		let c = this._xmlText;
		if (r !== 0 && c.delete(s, o.getSize()), i instanceof e) c.insertEmbed(s, i._xmlText);
		else if (i instanceof $) {
			let e = i._map;
			e.parent === null && c.insertEmbed(s, e), c.insert(s + 1, i._text);
		} else i instanceof jc ? c.insertEmbed(s, i._map) : i instanceof kc && c.insertEmbed(s, i._xmlElem);
		if (r !== 0) {
			let e = a.slice(n, n + r);
			for (let n = 0; n < e.length; n++) e[n].destroy(t);
		}
		i === void 0 ? a.splice(n, r) : a.splice(n, r, i);
	}
	getChildOffset(e) {
		let t = 0, n = this._children;
		for (let r = 0; r < n.length; r++) {
			let i = n[r];
			if (i === e) return t;
			t += i.getSize();
		}
		return -1;
	}
	destroy(e) {
		let t = e.collabNodeMap, n = this._children;
		for (let t = 0; t < n.length; t++) n[t].destroy(e);
		t.get(this._key) === this && t.delete(this._key);
	}
};
function Fc(e, t, n) {
	let r = new Pc(e, t, n);
	return e._collabNode = r, r;
}
var Ic = class {
	_nodeMap = /* @__PURE__ */ new Map();
	_sharedTypeToNodeKeys = /* @__PURE__ */ new Map();
	_nodeKeyToSharedType = /* @__PURE__ */ new Map();
	set(e, t) {
		let n = t instanceof Array;
		this.delete(e);
		let r = n ? t : [t];
		for (let e of r) {
			let t = e.getKey();
			if (this._nodeKeyToSharedType.has(t)) {
				let e = this._nodeKeyToSharedType.get(t), n = this._sharedTypeToNodeKeys.get(e).indexOf(t);
				n !== -1 && this._sharedTypeToNodeKeys.get(e).splice(n, 1), this._nodeKeyToSharedType.delete(t), this._nodeMap.delete(t);
			}
		}
		if (e instanceof q) {
			if (n || Q(331), t.length === 0) return;
			this._sharedTypeToNodeKeys.set(e, t.map((e) => e.getKey()));
			for (let n of t) this._nodeMap.set(n.getKey(), n), this._nodeKeyToSharedType.set(n.getKey(), e);
		} else n && Q(332), b(t) && Q(333), this._sharedTypeToNodeKeys.set(e, [t.getKey()]), this._nodeMap.set(t.getKey(), t), this._nodeKeyToSharedType.set(t.getKey(), e);
	}
	get(e) {
		let t = this._sharedTypeToNodeKeys.get(e);
		if (t !== void 0) {
			if (e instanceof q) {
				let e = Array.from(t.map((e) => this._nodeMap.get(e)));
				return e.length > 0 ? e : void 0;
			}
			return this._nodeMap.get(t[0]);
		}
	}
	getSharedType(e) {
		return this._nodeKeyToSharedType.get(e.getKey());
	}
	delete(e) {
		let t = this._sharedTypeToNodeKeys.get(e);
		if (t !== void 0) {
			for (let e of t) this._nodeMap.delete(e), this._nodeKeyToSharedType.delete(e);
			this._sharedTypeToNodeKeys.delete(e);
		}
	}
	deleteNode(e) {
		let t = this._nodeKeyToSharedType.get(e);
		t && this.delete(t), this._nodeMap.delete(e);
	}
	has(e) {
		return this._sharedTypeToNodeKeys.has(e);
	}
	clear() {
		this._nodeMap.clear(), this._sharedTypeToNodeKeys.clear(), this._nodeKeyToSharedType.clear();
	}
};
function Lc(e, t, n, r, i) {
	n ?? Q(81);
	let a = {
		clientID: n.clientID,
		cursors: /* @__PURE__ */ new Map(),
		cursorsContainer: null,
		doc: n,
		docMap: r,
		editor: e,
		excludedProperties: i || /* @__PURE__ */ new Map(),
		id: t,
		nodeProperties: /* @__PURE__ */ new Map()
	};
	return function(e) {
		let { editor: t, nodeProperties: n } = e;
		t.update(() => {
			t._nodes.forEach((t) => {
				let r = new t.klass(), i = {};
				for (let [t, n] of Object.entries(r)) Gc(t, r, e) || (i[t] = n);
				n.set(r.__type, Object.freeze(i));
			});
		});
	}(a), a;
}
function Rc(e, t, n, r, i, a) {
	r ?? Q(81);
	let o = Fc(r.get("root", q), null, "root");
	return o._key = "root", {
		...Lc(e, n, r, i, a),
		collabNodeMap: /* @__PURE__ */ new Map(),
		root: o
	};
}
function zc(e, t, n, r, i = {}) {
	n ?? Q(81);
	let { excludedProperties: a, rootName: o = "root-v2" } = i;
	return {
		...Lc(e, t, n, r, a),
		mapping: new Ic(),
		root: n.get(o, K)
	};
}
function Bc(e) {
	return Object.hasOwn(e, "collabNodeMap");
}
var Vc = /* @__PURE__ */ new Set([
	"__key",
	"__parent",
	"__next",
	"__prev",
	"__state"
]), Hc = /* @__PURE__ */ new Set([
	"__first",
	"__last",
	"__size"
]), Uc = /* @__PURE__ */ new Set(["__cachedText"]), Wc = /* @__PURE__ */ new Set(["__text"]);
function Gc(e, t, n) {
	if (Vc.has(e) || typeof t[e] == "function") return !0;
	if (b(t)) {
		if (Wc.has(e)) return !0;
	} else if (g(t) && (Hc.has(e) || me(t) && Uc.has(e))) return !0;
	let r = t.constructor, i = n.excludedProperties.get(r);
	return i != null && i.has(e);
}
function Kc(e, t) {
	let n = e.__type, { nodeProperties: r } = t, i = r.get(n);
	return i === void 0 && Q(330, n), i;
}
function qc(e, t, n) {
	let r = t.__type, i;
	if (g(t)) i = Fc(new q(), n, r), i.syncPropertiesFromLexical(e, t, null), i.syncChildrenFromLexical(e, t, null, null, null);
	else if (b(t)) i = Nc(new G(), t.__text, n, r), i.syncPropertiesAndTextFromLexical(e, t, null);
	else if (ee(t)) {
		let e = new G();
		e.set("__type", "linebreak"), i = Mc(e, n);
	} else u(t) ? (i = Ac(new K(), n, r), i.syncPropertiesFromLexical(e, t, null)) : Q(86);
	return i._key = t.__key, i;
}
function Jc(e) {
	let t = Qc(e, "__type");
	return typeof t != "string" && t !== void 0 && Q(87), t;
}
function Yc(e, t, n) {
	let r = t._collabNode;
	if (r === void 0) {
		let r = e.editor._nodes, i = Jc(t);
		typeof i != "string" && Q(87), r.get(i) === void 0 && Q(88, i);
		let a = t.parent, o = n === void 0 && a !== null ? Yc(e, a) : n || null;
		if (o instanceof Pc || Q(89), t instanceof q) return Fc(t, o, i);
		if (t instanceof G) return i === "linebreak" ? Mc(t, o) : Nc(t, "", o, i);
		if (t instanceof K) return Ac(t, o, i);
	}
	return r;
}
function Xc(e, t, n) {
	let r = t.getType(), i = e.editor._nodes.get(r);
	i === void 0 && Q(88, r);
	let a = new i.klass();
	if (a.__parent = n, t._key = a.__key, t instanceof Pc) {
		let n = t._xmlText;
		t.syncPropertiesFromYjs(e, null), t.applyChildrenYjsDelta(e, n.toDelta()), t.syncChildrenFromYjs(e);
	} else t instanceof $ ? t.syncPropertiesAndTextFromYjs(e, null) : t instanceof kc && t.syncPropertiesFromYjs(e, null);
	return e.collabNodeMap.set(a.__key, t), a;
}
function Zc(e, t, n, r) {
	let i = r === null ? t instanceof G ? Array.from(t.keys()) : t instanceof q || t instanceof K ? Object.keys(t.getAttributes()) : Object.keys(t) : Array.from(r), a;
	for (let r = 0; r < i.length; r++) {
		let o = i[r];
		if (Gc(o, n, e)) {
			o === "__state" && Bc(e) && (a ||= n.getWritable(), el(t, a));
			continue;
		}
		let s = n[o], c = Qc(t, o);
		if (s !== c) {
			if (c instanceof R) {
				let t = e.docMap;
				s instanceof R && t.delete(s.guid);
				let n = f(), r = c.guid;
				n._key = r, t.set(r, c), c = n;
			}
			a === void 0 && (a = n.getWritable()), a[o] = c;
		}
	}
}
function Qc(e, t) {
	return e instanceof G ? e.get(t) : e instanceof q || e instanceof K ? e.getAttribute(t) : e[t];
}
function $c(e, t, n) {
	e instanceof G ? e.set(t, n) : e.setAttribute(t, n);
}
function el(e, t) {
	let n = Qc(e, "__state");
	n instanceof G && ie(t).updateFromJSON(n.toJSON());
}
function tl(e, t, n, r) {
	let i = Object.keys(Kc(r, e)), a = e.editor.constructor;
	(function(e, t, n, r) {
		let i = r.__state, a = Qc(t, "__state");
		if (!i) return;
		let [o, s] = i.getInternalState(), c = n && n.__state, l = a instanceof G ? a : new G();
		if (c === i) return;
		let [u, d] = c && l.doc ? c.getInternalState() : [void 0, /* @__PURE__ */ new Map()];
		if (o) for (let [e, t] of Object.entries(o)) u && t !== u[e] && l.set(e, t);
		for (let [e, t] of s) d.get(e) !== t && l.set(e.key, e.unparse(t));
		a || $c(t, "__state", l);
	})(0, t, n, r);
	for (let o = 0; o < i.length; o++) {
		let s = i[o], c = n === null ? void 0 : n[s], l = r[s];
		if (c !== l) {
			if (l instanceof a) {
				let t = e.docMap, n;
				if (c instanceof a) {
					let e = c._key;
					n = t.get(e), t.delete(e);
				}
				let i = n || new R(), o = i.guid;
				l._key = o, t.set(o, i), l = i, e.editor.update(() => {
					r.markDirty();
				});
			}
			$c(t, s, l);
		}
	}
}
function nl(e, t, n, r) {
	return e.slice(0, t) + r + e.slice(t + n);
}
function rl(e, t, n) {
	let r = 0, i = 0, a = e._children, o = a.length;
	for (; i < o; i++) {
		let e = a[i], s = r;
		if (r += e.getSize(), (n ? r >= t : r > t) && e instanceof $) {
			let n = t - s - 1;
			return n < 0 && (n = 0), {
				length: r - t,
				node: e,
				nodeIndex: i,
				offset: n
			};
		}
		if (r > t) return {
			length: 0,
			node: e,
			nodeIndex: i,
			offset: s
		};
		if (i === o - 1) return {
			length: 0,
			node: null,
			nodeIndex: i + 1,
			offset: s + 1
		};
	}
	return {
		length: 0,
		node: null,
		nodeIndex: 0,
		offset: 0
	};
}
function il(e) {
	let t = e.anchor, n = e.focus, r = !1;
	try {
		let e = t.getNode(), i = n.getNode();
		(!e.isAttached() || !i.isAttached() || b(e) && t.offset > e.getTextContentSize() || b(i) && n.offset > i.getTextContentSize()) && (r = !0);
	} catch {
		r = !0;
	}
	return r;
}
function al(e, t) {
	e.doc.transact(t, e);
}
function ol(e, t) {
	let n = t._nodeMap.get(e);
	if (!n) return void y().selectStart();
	let r = n.__prev, i = null;
	r && (i = ye(r)), i === null && n.__parent !== null && (i = ye(n.__parent)), i === null ? y().selectStart() : i !== null && i.isAttached() ? i.selectEnd() : ol(i.__key, t);
}
var sl = (e) => e.nodeName === "UNDEFINED", cl = (e, t, n, r, i, a, o) => {
	let s = t.mapping.get(e);
	if (s && n && n.size === 0 && !r) return s;
	let c = sl(e) ? de.getType() : e.nodeName, l = t.editor._nodes.get(c);
	if (l === void 0) throw Error(`$createOrUpdateNodeFromYElement: Node ${c} is not registered`);
	if (s || (s = new l.klass(), n = null, r = !0), r && s instanceof pe) {
		let n = [], r = (e) => {
			if (e instanceof K) {
				let r = cl(e, t, /* @__PURE__ */ new Set(), !1, i, a, o);
				r !== null && n.push(r);
			} else if (e instanceof q) {
				let r = dl(e, t, i, a, o);
				r !== null && r.forEach((e) => {
					e !== null && n.push(e);
				});
			} else Q(329);
		};
		i === void 0 || a === void 0 ? e.toArray().forEach(r) : qo(e, new Ja(a.ds, i.sv)).filter((e) => !e._item.deleted || ul(e._item, i) || ul(e._item, a)).forEach(r), ll(s, n);
	}
	let u = e.getAttributes(i);
	sl(e) || i === void 0 || (ul(e._item, i) ? ul(e._item, a) || (u[wl("ychange")] = o ? o("added", e._item.id) : { type: "added" }) : u[wl("ychange")] = o ? o("removed", e._item.id) : { type: "removed" });
	let d = { ...Kc(s, t) }, f = {};
	for (let e in u) e.startsWith(Cl) ? f[Tl(e)] = u[e] : d[e] = u[e];
	if (Zc(t, d, s, n), n) {
		let e = Object.keys(f).filter((e) => n.has(wl(e)));
		if (e.length > 0) {
			let t = ie(s);
			for (let n of e) t.updateFromUnknown(n, f[n]);
		}
	} else ie(s).updateFromJSON(f);
	let p = s.getLatest();
	return t.mapping.set(e, p), p;
}, ll = (e, t) => {
	let n = e.getChildren(), r = new Set(n.map((e) => e.getKey())), i = new Set(t.map((e) => e.getKey())), a = n.length - 1, o = t.length - 1, s = 0, c = 0;
	for (; s <= a && c <= o;) {
		let a = n[s].getKey(), o = t[c].getKey();
		if (a === o) {
			s++, c++;
			continue;
		}
		let l = i.has(a), u = r.has(o);
		if (!l) {
			if (c === 0 && e.getChildrenSize() === 1) return void e.splice(c, 1, t.slice(c));
			e.splice(c, 1, []), s++;
			continue;
		}
		let d = t[c];
		u ? (e.splice(c, 1, [d]), s++, c++) : (e.splice(c, 0, [d]), c++);
	}
	let l = s > a, u = c > o;
	l && !u ? e.append(...t.slice(c)) : u && !l && e.splice(t.length, e.getChildrenSize() - t.length, []);
}, ul = (e, t) => t === void 0 ? !e.deleted : t.sv.has(e.id.client) && t.sv.get(e.id.client) > e.id.clock && !Yi(t.ds, e.id), dl = (e, t, n, r, i) => {
	let a = xl(e, n, r, i), o = t.mapping.get(e) ?? [], s = a.map((e) => e.attributes.t ?? _.getType());
	if (!(o.length === s.length && o.every((e, t) => e.getType() === s[t]))) {
		let e = t.editor._nodes;
		o = s.map((t) => {
			let n = e.get(t);
			if (n === void 0) throw Error(`$createTextNodesFromYText: Node ${t} is not registered`);
			let r = new n.klass();
			if (!b(r)) throw Error(`$createTextNodesFromYText: Node ${t} is not a TextNode`);
			return r;
		});
	}
	for (let e = 0; e < a.length; e++) {
		let n = o[e], { attributes: r, insert: i } = a[e];
		n.__text !== i && n.setTextContent(i);
		let s = {
			...Kc(n, t),
			...r.p
		}, c = Object.fromEntries(Object.entries(r).filter(([e]) => e.startsWith(Cl)).map(([e, t]) => [Tl(e), t]));
		Zc(t, s, n, null), ie(n).updateFromJSON(c);
	}
	let c = o.map((e) => e.getLatest());
	return t.mapping.set(e, c), c;
}, fl = (e, t) => e instanceof Array ? ((e, t) => {
	let n = new q();
	return bl(n, e, t), n;
})(e, t) : ((e, t) => {
	let n = new K(e.getType()), r = {
		...Sl(e, t),
		...El(e)
	};
	for (let e in r) {
		let t = r[e];
		t !== null && n.setAttribute(e, t);
	}
	return e instanceof pe && (n.insert(0, hl(e).map((e) => fl(e, t))), t.mapping.set(n, e)), n;
})(e, t), pl = (e) => typeof e == "object" && !!e, ml = (e, t) => {
	let n = Object.keys(e).filter((t) => e[t] !== null);
	if (t == null) return n.length === 0;
	let r = n.length === Object.keys(t).filter((e) => t[e] !== null).length;
	for (let i = 0; i < n.length && r; i++) {
		let a = n[i], o = e[a], s = t[a];
		r = a === "ychange" || o === s || pl(o) && pl(s) && ml(o, s);
	}
	return r;
}, hl = (e) => {
	if (!(e instanceof pe)) return [];
	let t = e.getChildren(), n = [];
	for (let e = 0; e < t.length; e++) {
		let r = t[e];
		if (b(r)) {
			let r = [];
			for (let n = t[e]; e < t.length && b(n); n = t[++e]) r.push(n);
			e--, n.push(r);
		} else n.push(r);
	}
	return n;
}, gl = (e, t, n) => {
	let r = xl(e);
	return r.length === t.length && r.every((e, r) => {
		let i = t[r], a = e.attributes.t ?? _.getType(), o = e.attributes.p ?? {}, s = Object.fromEntries(Object.entries(e.attributes).filter(([e]) => e.startsWith(Cl)));
		return e.insert === i.getTextContent() && a === i.getType() && ml(o, Sl(i, n)) && ml(s, El(i));
	});
}, _l = (e, t, n) => {
	if (e instanceof K && !(t instanceof Array) && Ol(e, t)) {
		let r = hl(t);
		return e._length === r.length && ml(e.getAttributes(), {
			...Sl(t, n),
			...El(t)
		}) && e.toArray().every((e, t) => _l(e, r[t], n));
	}
	return e instanceof q && t instanceof Array && gl(e, t, n);
}, vl = (e, t) => e === t || e instanceof Array && t instanceof Array && e.length === t.length && e.every((e, n) => t[n] === e), yl = (e, t, n) => {
	let r = e.toArray(), i = hl(t), a = i.length, o = r.length, s = Math.min(o, a), c = 0, l = 0, u = !1;
	for (; c < s; c++) {
		let e = r[c], t = i[c];
		if (e instanceof Rs) break;
		if (vl(n.mapping.get(e), t)) u = !0;
		else if (!_l(e, t, n)) break;
	}
	for (; c + l < s; l++) {
		let e = r[o - l - 1], t = i[a - l - 1];
		if (e instanceof Rs) break;
		if (vl(n.mapping.get(e), t)) u = !0;
		else if (!_l(e, t, n)) break;
	}
	return {
		equalityFactor: c + l,
		foundMappedChild: u
	};
}, bl = (e, t, n) => {
	n.mapping.set(e, t);
	let { nAttrs: r, str: i } = ((e) => {
		let t = "", n = e._start, r = {};
		for (; n !== null;) n.deleted || (n.countable && n.content instanceof ic ? t += n.content.str : n.content instanceof Y && (r[n.content.key] = null)), n = n.right;
		return {
			nAttrs: r,
			str: t
		};
	})(e), a = t.map((e, t) => {
		let i = e.getType(), a = Sl(e, n);
		return Object.keys(a).length === 0 && (a = null), {
			attributes: Object.assign({}, r, {
				...i !== _.getType() && { t: i },
				p: a,
				...El(e),
				...t > 0 && { i: t }
			}),
			insert: e.getTextContent(),
			nodeKey: e.getKey()
		};
	}), o = a.map((e) => e.insert).join(""), s = v(), c;
	if (_e(s) && s.isCollapsed()) {
		c = 0;
		for (let e of a) {
			if (e.nodeKey === s.anchor.key) {
				c += s.anchor.offset;
				break;
			}
			c += e.insert.length;
		}
	} else c = o.length;
	let { insert: l, remove: u, index: d } = Oc(i, o, c);
	e.delete(d, u), e.insert(d, l), e.applyDelta(a.map((e) => ({
		attributes: e.attributes,
		retain: e.insert.length
	})));
}, xl = (e, t, n, r) => e.toDelta(t, n, r).map((e) => {
	let t = e.attributes ?? {};
	return "ychange" in t && (t[wl("ychange")] = t.ychange, delete t.ychange), {
		...e,
		attributes: t
	};
}), Sl = (e, t) => {
	let n = Kc(e, t), r = {};
	return Object.entries(n).forEach(([t, n]) => {
		let i = e[t];
		i !== n && (r[t] = i);
	}), r;
}, Cl = "s_", wl = (e) => `s_${e}`, Tl = (e) => {
	if (!e.startsWith(Cl)) throw Error(`Invalid state key: ${e}`);
	return e.slice(2);
}, El = (e) => {
	let t = e.__state;
	if (!t) return {};
	let [n = {}, r] = t.getInternalState(), i = {};
	for (let [e, t] of Object.entries(n)) i[wl(e)] = t;
	for (let [e, t] of r) i[wl(e.key)] = e.unparse(t);
	return i;
}, Dl = (e, t, n, r, i) => {
	if (t instanceof K && t.nodeName !== n.getType() && (!sl(t) || n.getType() !== de.getType())) throw Error("node name mismatch!");
	if (r.mapping.set(t, n), t instanceof K) {
		let e = t.getAttributes(), i = {
			...Sl(n, r),
			...El(n)
		};
		for (let n in i) i[n] == null ? t.removeAttribute(n) : e[n] === i[n] || pl(e[n]) && pl(i[n]) && ml(e[n], i[n]) || n === "ychange" || t.setAttribute(n, i[n]);
		for (let n in e) i[n] === void 0 && t.removeAttribute(n);
	}
	let a = hl(n), o = a.length, s = t.toArray(), c = s.length, l = Math.min(o, c), u = 0, d = 0;
	for (; u < l; u++) {
		let t = s[u], n = a[u];
		if (t instanceof Rs) break;
		if (vl(r.mapping.get(t), n)) n instanceof pe && i.has(n.getKey()) && Dl(e, t, n, r, i);
		else {
			if (!_l(t, n, r)) break;
			r.mapping.set(t, n);
		}
	}
	for (; d + u < l; d++) {
		let t = s[c - d - 1], n = a[o - d - 1];
		if (t instanceof Rs) break;
		if (vl(r.mapping.get(t), n)) n instanceof pe && i.has(n.getKey()) && Dl(e, t, n, r, i);
		else {
			if (!_l(t, n, r)) break;
			r.mapping.set(t, n);
		}
	}
	for (; c - u - d > 0 && o - u - d > 0;) {
		let n = s[u], l = a[u], f = s[c - d - 1], p = a[o - d - 1];
		if (n instanceof q && l instanceof Array) gl(n, l, r) || bl(n, l, r), u += 1;
		else {
			let a = n instanceof K && Ol(n, l), o = f instanceof K && Ol(f, p);
			if (a && o) {
				let e = yl(n, l, r), t = yl(f, p, r);
				e.foundMappedChild && !t.foundMappedChild ? o = !1 : !e.foundMappedChild && t.foundMappedChild || e.equalityFactor < t.equalityFactor ? a = !1 : o = !1;
			}
			a ? (Dl(e, n, l, r, i), u += 1) : o ? (Dl(e, f, p, r, i), d += 1) : (r.mapping.delete(t.get(u)), t.delete(u, 1), t.insert(u, [fl(l, r)]), u += 1);
		}
	}
	let f = c - u - d;
	if (c === 1 && o === 0 && s[0] instanceof q ? (r.mapping.delete(s[0]), s[0].delete(0, s[0].length)) : f > 0 && (t.slice(u, u + f).forEach((e) => r.mapping.delete(e)), t.delete(u, f)), u + d < o) {
		let e = [];
		for (let t = u; t < o - d; t++) e.push(fl(a[t], r));
		t.insert(u, e);
	}
}, Ol = (e, t) => !(t instanceof Array) && e.nodeName === t.getType();
Se("ychange", {
	isEqual: (e, t) => e === t,
	parse: (e) => e ?? null
});
var kl = (e, t = Za(e.doc), n = Xa) => {
	let { doc: r } = e;
	r.gc && Q(325), r.transact((i) => {
		let a = new za(r);
		a && a.dss.forEach((e) => {
			qi(i, e, (e) => {});
		});
		let o = (e, t) => ({
			id: t,
			type: e,
			user: (e === "added" ? a.getUserByClientId(t.client) : a.getUserByDeletedId(t)) ?? null
		});
		e.mapping.clear(), e.editor.update(() => {
			y().clear(), cl(e.root, e, null, !0, t, n, o);
		});
	}, e);
};
function Al(e, t) {
	let n = t.collabNodeMap.get(e.key);
	if (n === void 0) return null;
	let r = e.offset, i = n.getSharedType();
	if (n instanceof $) {
		i = n._parent._xmlText;
		let e = n.getOffset();
		if (e === -1) return null;
		r = e + 1 + r;
	} else if (n instanceof Pc && e.type === "element") {
		let t = e.getNode();
		g(t) || Q(184);
		let n = 0, i = 0, a = t.getFirstChild();
		for (; a !== null && i++ < r;) b(a) ? n += a.getTextContentSize() + 1 : n++, a = a.getNextSibling();
		r = n;
	}
	return Wa(i, r);
}
function jl(e, t) {
	let { mapping: n } = t, { offset: r } = e, i = e.getNode(), a = n.getSharedType(i);
	if (a === void 0) return null;
	if (e.type === "text") {
		b(i) || Q(326);
		let e = i.getPreviousSibling(), t = r;
		for (; b(e);) t += e.getTextContentSize(), e = e.getPreviousSibling();
		return Wa(a, t);
	}
	if (e.type === "element") {
		g(i) || Q(184);
		let e = 0, t = i.getFirstChild();
		for (; t !== null && e < r;) {
			if (b(t)) {
				let e = t.getNextSibling();
				for (; b(e);) e = e.getNextSibling();
			}
			e++, t = t.getNextSibling();
		}
		return Wa(a, e);
	}
	return null;
}
function Ml(e, t) {
	return Ka(e, t.doc);
}
function Nl(e, t) {
	if (e == null) {
		if (t != null) return !0;
	} else if (t == null || !qa(e, t)) return !0;
	return !1;
}
function Pl(e, t) {
	return {
		color: t,
		name: e,
		selection: null
	};
}
function Fl(e, t) {
	let n = e.cursorsContainer;
	if (n !== null) {
		let e = t.selections, r = e.length;
		for (let t = 0; t < r; t++) n.removeChild(e[t]);
	}
}
function Il(e, t) {
	let n = t.selection;
	n !== null && Fl(e, n);
}
function Ll(e, t, n, r, i) {
	let a = e.color, o = document.createElement("span");
	o.style.cssText = `position:absolute;top:0;bottom:0;right:-1px;width:1px;background-color:${a};z-index:10;`;
	let s = document.createElement("span");
	return s.textContent = e.name, s.style.cssText = `position:absolute;left:-2px;top:-16px;background-color:${a};color:#fff;line-height:12px;font-size:12px;padding:2px;font-family:Arial;font-weight:bold;white-space:nowrap;`, o.appendChild(s), {
		anchor: {
			key: t,
			offset: n
		},
		caret: o,
		color: a,
		focus: {
			key: r,
			offset: i
		},
		name: s,
		selections: []
	};
}
function Rl(e, t, n, r) {
	let i = e.editor, a = i.getRootElement(), o = e.cursorsContainer;
	if (o === null || a === null) return;
	let s = o.offsetParent;
	if (s === null) return;
	let c = s.getBoundingClientRect(), l = t.selection;
	if (n === null) return l === null ? void 0 : (t.selection = null, void Fl(e, l));
	t.selection = n;
	let u = n.caret, f = n.color, p = n.selections, m = n.anchor, h = n.focus, g = m.key, _ = h.key, te = r.get(g), ne = r.get(_);
	if (te == null || ne == null) return;
	let v;
	if (te === ne && ee(te)) v = [i.getElementByKey(g).getBoundingClientRect()];
	else {
		let e = re(i, te, m.offset, ne, h.offset);
		if (e === null) return;
		v = d(i, e);
	}
	let ie = p.length, ae = v.length;
	for (let e = 0; e < ae; e++) {
		let t = v[e], n = p[e];
		if (n === void 0) {
			n = document.createElement("span"), p[e] = n;
			let t = document.createElement("span");
			n.appendChild(t), o.appendChild(n);
		}
		let r = `position:absolute;top:${t.top - c.top}px;left:${t.left - c.left}px;height:${t.height}px;width:${t.width}px;pointer-events:none;z-index:5;`;
		n.style.cssText = r, n.firstChild.style.cssText = `${r}left:0;top:0;background-color:${f};opacity:0.3;`, e === ae - 1 && u.parentNode !== n && n.appendChild(u);
	}
	for (let e = ie - 1; e >= ae; e--) {
		let t = p[e];
		o.removeChild(t), p.pop();
	}
}
function zl(e, t) {
	let { anchorPos: n, focusPos: r } = t, i = n ? Ml(n, e) : null, a = r ? Ml(r, e) : null;
	if (i === null || a === null) return {
		anchorKey: null,
		anchorOffset: 0,
		focusKey: null,
		focusOffset: 0
	};
	if (Bc(e)) {
		let [e, t] = Hl(i.type, i.index), [n, r] = Hl(a.type, a.index);
		return {
			anchorKey: e === null ? null : e.getKey(),
			anchorOffset: t,
			focusKey: n === null ? null : n.getKey(),
			focusOffset: r
		};
	}
	let [o, s] = Ul(e.mapping, i), [c, l] = Ul(e.mapping, a);
	if (c && o && (c !== o || l !== s)) {
		let e = c.isBefore(o), t = e ? c : o, n = e ? l : s;
		b(t) && b(t.getNextSibling()) && n === t.getTextContentSize() && (e ? (c = t.getNextSibling(), l = 0) : (o = t.getNextSibling(), s = 0));
	}
	return {
		anchorKey: o === null ? null : o.getKey(),
		anchorOffset: s,
		focusKey: c === null ? null : c.getKey(),
		focusOffset: l
	};
}
function Bl(e, t) {
	let n = t.awareness.getLocalState();
	if (n === null) return;
	let { anchorKey: r, anchorOffset: i, focusKey: a, focusOffset: o } = zl(e, n);
	if (r !== null && a !== null) {
		let e = v();
		if (!_e(e)) return;
		Vl(e.anchor, r, i), Vl(e.focus, a, o);
	}
}
function Vl(e, t, n) {
	if (e.key !== t || e.offset !== n) {
		let r = ye(t);
		if (r !== null && !g(r) && !b(r)) {
			let e = r.getParentOrThrow();
			t = e.getKey(), n = r.getIndexWithinParent(), r = e;
		}
		e.set(t, n, g(r) ? "element" : "text");
	}
}
function Hl(e, t) {
	let n = e._collabNode;
	if (n === void 0) return [null, 0];
	if (n instanceof Pc) {
		let { node: e, offset: r } = rl(n, t, !0);
		return e === null ? [n, 0] : [e, r];
	}
	return [null, 0];
}
function Ul(e, t) {
	let n = t.type, r = t.index;
	if (n instanceof K) {
		let t = e.get(n);
		if (t === void 0) return [null, 0];
		if (!g(t)) return [t, r];
		let i = r, a = 0, o = t.getChildren();
		for (; i > 0 && a < o.length;) {
			let e = o[a];
			if (--i, a += 1, b(e)) for (; a < o.length && b(o[a]);) a += 1;
		}
		return [t, a];
	}
	{
		let t = e.get(n);
		if (t === void 0) return [null, 0];
		let i = 0, a = r;
		for (; a > t[i].getTextContentSize() && i + 1 < t.length;) a -= t[i].getTextContentSize(), i++;
		let o = t[i];
		return [o, Math.min(a, o.getTextContentSize())];
	}
}
function Wl(e, t) {
	return t.awareness.getStates();
}
function Gl(e, t, n) {
	let { getAwarenessStates: r = Wl } = n ?? {}, i = Array.from(r(e, t)), a = e.clientID, o = e.cursors, s = e.editor, c = s._editorState._nodeMap, l = /* @__PURE__ */ new Set();
	for (let t = 0; t < i.length; t++) {
		let [n, r] = i[t];
		if (n !== 0 && n !== a) {
			l.add(n);
			let { name: t, color: i, focusing: a } = r, u = null, d = o.get(n);
			if (d === void 0 && (d = Pl(t, i), o.set(n, d)), a) {
				let { anchorKey: t, anchorOffset: n, focusKey: i, focusOffset: a } = s.read(() => zl(e, r));
				if (t !== null && i !== null) {
					if (u = d.selection, u === null) u = Ll(d, t, n, i, a);
					else {
						let e = u.anchor, r = u.focus;
						e.key = t, e.offset = n, r.key = i, r.offset = a;
					}
				}
			}
			Rl(e, d, u, c);
		}
	}
	let u = Array.from(o.keys());
	for (let t = 0; t < u.length; t++) {
		let n = u[t];
		if (!l.has(n)) {
			let t = o.get(n);
			t !== void 0 && (Il(e, t), o.delete(n));
		}
	}
}
function Kl(e, t, n, r) {
	let i = t.awareness, a = i.getLocalState();
	if (a === null) return;
	let { anchorPos: o, focusPos: s, name: c, color: l, focusing: u, awarenessData: d } = a, f = null, p = null;
	(r !== null && (o === null || r.is(n)) || n !== null) && (_e(r) && (Bc(e) ? (f = Al(r.anchor, e), p = Al(r.focus, e)) : (f = jl(r.anchor, e), p = jl(r.focus, e))), (Nl(o, f) || Nl(s, p)) && i.setLocalState({
		...a,
		anchorPos: f,
		awarenessData: d,
		color: l,
		focusPos: p,
		focusing: u,
		name: c
	}));
}
function ql(e, t) {
	if (t instanceof ps && function(e, t) {
		let { target: n } = t;
		if (!n._item || n._item.parentSub !== "__state" || Jc(n) !== void 0 || !(n.parent instanceof q || n.parent instanceof K || n.parent instanceof G)) return !1;
		let r = Yc(e, n.parent).getNode();
		if (r) {
			let e = ie(r.getWritable());
			for (let r of t.keysChanged) e.updateFromUnknown(r, n.get(r));
		}
		return !0;
	}(e, t)) return;
	let { target: n } = t, r = Yc(e, n);
	if (r instanceof Pc && t instanceof As) {
		let { keysChanged: n, childListChanged: i, delta: a } = t;
		n.size > 0 && r.syncPropertiesFromYjs(e, n), i && (r.applyChildrenYjsDelta(e, a), r.syncChildrenFromYjs(e));
	} else if (r instanceof $ && t instanceof ps) {
		let { keysChanged: n } = t;
		n.size > 0 && r.syncPropertiesAndTextFromYjs(e, n);
	} else if (r instanceof kc && t instanceof Ls) {
		let { attributesChanged: n } = t;
		n.size > 0 && r.syncPropertiesFromYjs(e, n);
	} else Q(82);
}
function Jl(e, t, n, r, i = Gl) {
	let a = e.editor, o = a._editorState;
	n.forEach((e) => e.delta), a.update(() => {
		for (let t = 0; t < n.length; t++) {
			let r = n[t];
			ql(e, r);
		}
		Yl(o, e, t), r || xe("skip-scroll-into-view");
	}, {
		onUpdate: () => {
			i(e, t), a.update(() => Xl());
		},
		skipTransforms: !0,
		tag: r ? ne : we
	});
}
function Yl(e, t, n) {
	let r = v();
	if (_e(r)) {
		if (il(r)) {
			let i = e._selection;
			_e(i) && (Bl(t, n), il(r)) && ol(r.anchor.key, e), Kl(t, n, i, v());
		} else Bl(t, n);
	}
}
function Xl() {
	y().getChildrenSize() === 0 && y().append(le());
}
function Zl(e, t, n, r, i, a, o, s) {
	al(e, () => {
		r.read(() => {
			if (s.has("collaboration") || s.has("historic")) return void (o.size > 0 && function(e, t) {
				let n = Array.from(t), r = e.collabNodeMap, i = [], a = [];
				for (let e = 0; e < n.length; e++) {
					let t = n[e], o = ye(t), s = r.get(t);
					if (s instanceof $) {
						if (b(o)) i.push([s, o.__text]);
						else {
							let e = s.getOffset();
							if (e === -1) continue;
							let t = s._parent;
							s._normalized = !0, t._xmlText.delete(e, 1), a.push(s);
						}
					}
				}
				for (let e = 0; e < a.length; e++) {
					let t = a[e], n = t.getKey();
					r.delete(n);
					let i = t._parent._children, o = i.indexOf(t);
					i.splice(o, 1);
				}
				for (let e = 0; e < i.length; e++) {
					let [t, n] = i[e];
					t._text = n;
				}
			}(e, o));
			if (i.has("root")) {
				let t = n._nodeMap, r = y(), o = e.root;
				o.syncPropertiesFromLexical(e, r, t), o.syncChildrenFromLexical(e, r, t, i, a);
			}
			let r = v(), c = n._selection;
			Kl(e, t, c, r);
		});
	});
}
function Ql(e, t) {
	let { target: n } = t;
	if (n instanceof K && t instanceof Ls) cl(n, e, t.attributesChanged, t.childListChanged);
	else if (n instanceof q && t instanceof As) {
		let t = n.parent;
		t instanceof K ? cl(t, e, /* @__PURE__ */ new Set(), !0) : Q(327);
	} else Q(328);
}
function $l(e, t, n, r, i) {
	let a = e.editor, o = a._editorState;
	qi(r, r.deleteSet, (t) => {
		if (t.constructor === X) {
			let n = t.content.type;
			n && e.mapping.delete(n);
		}
	}), n.forEach((e) => e.delta), a.update(() => {
		for (let t = 0; t < n.length; t++) {
			let r = n[t];
			Ql(e, r);
		}
		Yl(o, e, t), i || xe("skip-scroll-into-view");
	}, {
		discrete: !0,
		onUpdate: () => {
			Gl(e, t), a.update(() => Xl());
		},
		skipTransforms: !0,
		tag: i ? ne : we
	});
}
function eu(e, t) {
	e.mapping.clear();
	let n = e.editor;
	n.update(() => {
		y().clear(), cl(e.root, e, null, !0), xe(we);
	}, {
		discrete: !0,
		onUpdate: () => {
			Gl(e, t), n.update(() => Xl());
		},
		skipTransforms: !0,
		tag: we
	});
}
function tu(e, t, n, r, i, a, o) {
	(o.has("collaboration") || o.has("historic")) && a.size === 0 || (a.forEach((t) => {
		e.mapping.deleteNode(t);
	}), al(e, () => {
		r.read(() => {
			i.has("root") && Dl(e.doc, e.root, y(), e, new Set(i.keys()));
			let r = v(), a = n._selection;
			Kl(e, t, a, r);
		});
	}));
}
var nu = ge("CONNECTED_COMMAND"), ru = ge("TOGGLE_CONNECT_COMMAND"), iu = ge("DIFF_VERSIONS_COMMAND"), au = ge("CLEAR_DIFF_VERSIONS_COMMAND");
function ou(e, t) {
	return new bo(t, { trackedOrigins: /* @__PURE__ */ new Set([e, null]) });
}
function su(e, t, n, r, i) {
	e.awareness.setLocalState({
		anchorPos: null,
		awarenessData: i,
		color: n,
		focusPos: null,
		focusing: r,
		name: t
	});
}
function cu(e, t, n, r, i) {
	let { awareness: a } = e, o = a.getLocalState();
	o === null && (o = {
		anchorPos: null,
		awarenessData: i,
		color: n,
		focusPos: null,
		focusing: r,
		name: t
	}), o.focusing = r, a.setLocalState(o);
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalCollaborationPlugin.prod.mjs
function lu(e, t, n, r, i, a, o, s, c, l, u, d, f = Gl) {
	let p = Ne(!1), m = Ae(() => {
		let { root: t } = s;
		o && t.isEmpty() && t._xmlText._length === 0 && hu(e, u);
	}, [
		s,
		e,
		u,
		o
	]);
	return x(() => {
		let { root: t } = s, r = (e, t) => {
			let r = t.origin;
			r !== s && Jl(s, n, e, r instanceof bo, f);
		};
		t.getSharedType().observeDeep(r);
		let i = e.registerUpdateListener(({ prevEditorState: e, editorState: t, dirtyLeaves: r, dirtyElements: i, normalizedNodes: a, tags: o }) => {
			o.has("skip-collab") || Zl(s, n, e, t, i, r, a, o);
		});
		return () => {
			t.getSharedType().unobserveDeep(r), i();
		};
	}, [
		s,
		n,
		e,
		c,
		r,
		t,
		f
	]), x(() => {
		let i = (n) => {
			(function(e, t) {
				if (e.update(() => {
					let e = y();
					e.clear(), e.select();
				}, { tag: "skip-collab" }), t.cursors == null) return;
				let n = t.cursors;
				if (n == null) return;
				let r = t.cursorsContainer;
				if (r == null) return;
				let i = Array.from(n.values());
				for (let e = 0; e < i.length; e++) {
					let t = i[e].selection;
					if (t && t.selections != null) {
						let n = t.selections;
						for (let t = 0; t < n.length; t++) r.removeChild(n[e]);
					}
				}
			})(e, s), c(n), r.set(t, n), p.current = !0;
		}, a = () => {
			p.current = !1;
		};
		return n.on("reload", i), n.on("sync", a), () => {
			n.off("reload", i), n.off("sync", a);
		};
	}, [
		s,
		n,
		e,
		c,
		r,
		t
	]), uu(e, n, i, a, p, d, m), du(s, n), fu(s, l);
}
function uu(e, t, n, r, i, a, o) {
	let s = Ae(() => t.connect(), [t]), c = Ae(() => {
		try {
			t.disconnect();
		} catch {}
	}, [t]);
	x(() => {
		let l = ({ status: t }) => {
			e.dispatchCommand(nu, t === "connected");
		}, u = (e) => {
			e && !1 === i.current && o && o();
		};
		su(t, n, r, document.activeElement === e.getRootElement(), a || {}), t.on("status", l), t.on("sync", u);
		let d = s();
		return () => {
			!1 === i.current && (d ? d.then(c) : c()), t.off("sync", u), t.off("status", l);
		};
	}, [
		e,
		t,
		n,
		r,
		i,
		a,
		o,
		s,
		c
	]), x(() => e.registerCommand(ru, (e) => (e ? (console.log("Collaboration connected!"), s()) : (console.log("Collaboration disconnected!"), c()), !0), 0), [
		s,
		c,
		e
	]), x(() => {
		let e = () => {
			try {
				t.awareness.setLocalState(null);
			} catch {}
		};
		return window.addEventListener("beforeunload", e), window.addEventListener("pagehide", e), () => {
			window.removeEventListener("beforeunload", e), window.removeEventListener("pagehide", e);
		};
	}, [t]);
}
function du(e, t) {
	x(() => {
		let { awareness: n } = t, r = () => {
			Gl(e, t);
		};
		return n.on("update", r), () => {
			n.off("update", r);
		};
	}, [e, t]);
}
function fu(e, t) {
	return Me(() => Ve(S("div", { ref: (t) => {
		e.cursorsContainer = t;
	} }), t && t.current || document.body), [e, t]);
}
function pu(e, t, n, r, i) {
	x(() => p(e.registerCommand(ue, () => (cu(t, n, r, !0, i || {}), !1), 0), e.registerCommand(se, () => (cu(t, n, r, !1, i || {}), !1), 0)), [
		r,
		e,
		n,
		t,
		i
	]);
}
function mu(e, t) {
	x(() => p(e.registerCommand(ae, () => (t.undo(), !0), 0), e.registerCommand(he, () => (t.redo(), !0), 0)));
	let n = Ae(() => {
		t.clear();
	}, [t]);
	return Oe.useEffect(() => {
		let n = () => {
			e.dispatchCommand(te, t.undoStack.length > 0), e.dispatchCommand(fe, t.redoStack.length > 0);
		};
		return t.on("stack-item-added", n), t.on("stack-item-popped", n), t.on("stack-cleared", n), () => {
			t.off("stack-item-added", n), t.off("stack-item-popped", n), t.off("stack-cleared", n);
		};
	}, [e, t]), n;
}
function hu(e, t) {
	e.update(() => {
		let n = y();
		if (n.isEmpty()) {
			if (t) switch (typeof t) {
				case "string": {
					let n = e.parseEditorState(t);
					e.setEditorState(n, { tag: oe });
					break;
				}
				case "object":
					e.setEditorState(t, { tag: oe });
					break;
				case "function": e.update(() => {
					y().isEmpty() && t(e);
				}, { tag: oe });
			}
			else {
				let t = le();
				n.append(t);
				let { activeElement: r } = document;
				(v() !== null || r !== null && r === e.getRootElement()) && t.select();
			}
		}
	}, { tag: oe });
}
function gu({ id: e, providerFactory: t, shouldBootstrap: n, username: r, cursorColor: i, cursorsContainerRef: a, initialEditorState: o, excludedProperties: s, awarenessData: c, syncCursorPositionsFn: l }) {
	let u = Ne(!1), d = Ne(!1), f = Je(r, i), { yjsDocMap: p, name: m, color: h } = f, [g] = Te();
	yu(f, g);
	let [_, ee] = Pe(), [te, ne] = Pe();
	x(() => {
		if (d.current) return;
		d.current = !0;
		let n = t(e, p);
		return ee(n), ne(p.get(e)), () => {
			n.disconnect();
		};
	}, [
		e,
		t,
		p
	]);
	let [v, re] = Pe();
	return x(() => {
		if (!_ || u.current) return;
		u.current = !0;
		let t = Rc(g, _, e, te || p.get(e), p, s);
		return re(t), () => {
			t.root.destroy(t);
		};
	}, [
		g,
		_,
		e,
		p,
		te,
		s
	]), _ && v ? S(_u, {
		awarenessData: c,
		binding: v,
		collabContext: f,
		color: h,
		cursorsContainerRef: a,
		editor: g,
		id: e,
		initialEditorState: o,
		name: m,
		provider: _,
		setDoc: ne,
		shouldBootstrap: n,
		yjsDocMap: p,
		syncCursorPositionsFn: l
	}) : S(ze, {});
}
function _u({ editor: e, id: t, provider: n, yjsDocMap: r, name: i, color: a, shouldBootstrap: o, cursorsContainerRef: s, initialEditorState: c, awarenessData: l, collabContext: u, binding: d, setDoc: f, syncCursorPositionsFn: p }) {
	let m = lu(e, t, n, r, i, a, o, d, f, s, c, l, p);
	return function(e, t) {
		mu(e, Me(() => ou(t, t.root.getSharedType()), [t]));
	}(e, d), pu(e, n, i, a, l), m;
}
function vu({ id: e, doc: t, provider: n, __shouldBootstrapUnsafe: r, username: i, cursorColor: a, cursorsContainerRef: o, excludedProperties: s, awarenessData: c }) {
	let l = Je(i, a), { yjsDocMap: u, name: d, color: f } = l, [m] = Te();
	yu(l, m);
	let h = function(e, t, n, r, i, a, o, s = {}) {
		let { awarenessData: c, excludedProperties: l, rootName: u, __shouldBootstrapUnsafe: d } = s, f = Me(() => ({ current: !1 }), []), m = Me(() => zc(e, t, n, i, {
			excludedProperties: l,
			rootName: u
		}), [
			e,
			t,
			n,
			i,
			l,
			u
		]);
		x(() => (i.set(t, n), () => {
			i.delete(t);
		}), [
			n,
			i,
			t
		]);
		let h = Ae(() => {
			let { root: t } = m;
			d && t._length === 0 && hu(e);
		}, [
			m,
			e,
			d
		]), [g, _] = Pe();
		return x(() => {
			p(e.registerCommand(au, () => (_(null), eu(m, r), !0), 0), e.registerCommand(iu, ({ prevSnapshot: e, snapshot: t }) => (_({
				prevSnapshot: e,
				snapshot: t
			}), !0), 0));
		}, [
			e,
			m,
			r
		]), x(() => {
			let { root: t } = m;
			if (g) return void kl(m, g.snapshot, g.prevSnapshot);
			let n = (e, t) => {
				let n = t.origin;
				n !== m && $l(m, r, e, t, n instanceof bo);
			};
			t.observeDeep(n);
			let i = e.registerUpdateListener(({ prevEditorState: e, editorState: t, dirtyElements: n, normalizedNodes: i, tags: a }) => {
				a.has("skip-collab") || tu(m, r, e, t, n, i, a);
			});
			return () => {
				t.unobserveDeep(n), i();
			};
		}, [
			m,
			r,
			e,
			g
		]), uu(e, r, a, o, f, c, h), du(m, r), m;
	}(m, e, t, n, u, d, f, {
		__shouldBootstrapUnsafe: r,
		awarenessData: c,
		excludedProperties: s
	});
	return function(e, t) {
		mu(e, Me(() => ou(t, t.root), [t]));
	}(m, h), pu(m, n, d, f, c), fu(h, o);
}
var yu = (e, t) => {
	x(() => (e.isCollabActive = !0, () => {
		t._parentEditor ?? (e.isCollabActive = !1);
	}), [e, t]);
}, bu = /* @__PURE__ */ new Map(), xu = class {
	constructor(e) {
		this.room = e, this.onmessage = null, this._onChange = (t) => t.key === e && this.onmessage !== null && this.onmessage({ data: sr(t.newValue || "") }), wn(this._onChange);
	}
	postMessage(e) {
		Cn.setItem(this.room, or(tr(e)));
	}
	close() {
		Tn(this._onChange);
	}
}, Su = typeof BroadcastChannel > "u" ? xu : BroadcastChannel, Cu = (e) => Xe(bu, e, () => {
	let t = $e(), n = new Su(e);
	return n.onmessage = (e) => t.forEach((t) => t(e.data, "broadcastchannel")), {
		bc: n,
		subs: t
	};
}), wu = (e, t) => (Cu(e).subs.add(t), t), Tu = (e, t) => {
	let n = Cu(e), r = n.subs.delete(t);
	return r && n.subs.size === 0 && (n.bc.close(), bu.delete(e)), r;
}, Eu = (e, t, n = null) => {
	let r = Cu(e);
	r.bc.postMessage(t), r.subs.forEach((e) => e(t, n));
}, Du = (e, t) => {
	O(e, 0), k(e, ka(t));
}, Ou = (e, t, n) => {
	O(e, 1), k(e, Ca(t, n));
}, ku = (e, t, n) => Ou(t, n, M(e)), Au = (e, t, n, r) => {
	try {
		ba(t, M(e), n);
	} catch (e) {
		r?.(e), console.error("Caught error while handling a Yjs update", e);
	}
}, ju = (e, t) => {
	O(e, 2), k(e, t);
}, Mu = Au, Nu = (e, t, n, r, i) => {
	let a = N(e);
	switch (a) {
		case 0:
			ku(e, t, n);
			break;
		case 1:
			Au(e, n, r, i);
			break;
		case 2:
			Mu(e, n, r, i);
			break;
		default: throw Error("Unknown message type");
	}
	return a;
}, Pu = (e, t, n) => {
	N(e) === 0 && n(t, on(e));
}, Fu = 3e4, Iu = class extends ct {
	constructor(e) {
		super(), this.doc = e, this.clientID = e.clientID, this.states = /* @__PURE__ */ new Map(), this.meta = /* @__PURE__ */ new Map(), this._checkInterval = setInterval(() => {
			let e = vn();
			this.getLocalState() !== null && 15e3 <= e - this.meta.get(this.clientID).lastUpdated && this.setLocalState(this.getLocalState());
			let t = [];
			this.meta.forEach((n, r) => {
				r !== this.clientID && 3e4 <= e - n.lastUpdated && this.states.has(r) && t.push(r);
			}), t.length > 0 && Lu(this, t, "timeout");
		}, w(Fu / 10)), e.on("destroy", () => {
			this.destroy();
		}), this.setLocalState({});
	}
	destroy() {
		this.emit("destroy", [this]), this.setLocalState(null), super.destroy(), clearInterval(this._checkInterval);
	}
	getLocalState() {
		return this.states.get(this.clientID) || null;
	}
	setLocalState(e) {
		let t = this.clientID, n = this.meta.get(t), r = n === void 0 ? 0 : n.clock + 1, i = this.states.get(t);
		e === null ? this.states.delete(t) : this.states.set(t, e), this.meta.set(t, {
			clock: r,
			lastUpdated: vn()
		});
		let a = [], o = [], s = [], c = [];
		e === null ? c.push(t) : i == null ? e != null && a.push(t) : (o.push(t), Hn(i, e) || s.push(t)), (a.length > 0 || s.length > 0 || c.length > 0) && this.emit("change", [{
			added: a,
			updated: s,
			removed: c
		}, "local"]), this.emit("update", [{
			added: a,
			updated: o,
			removed: c
		}, "local"]);
	}
	setLocalStateField(e, t) {
		let n = this.getLocalState();
		n !== null && this.setLocalState({
			...n,
			[e]: t
		});
	}
	getStates() {
		return this.states;
	}
}, Lu = (e, t, n) => {
	let r = [];
	for (let n = 0; n < t.length; n++) {
		let i = t[n];
		if (e.states.has(i)) {
			if (e.states.delete(i), i === e.clientID) {
				let t = e.meta.get(i);
				e.meta.set(i, {
					clock: t.clock + 1,
					lastUpdated: vn()
				});
			}
			r.push(i);
		}
	}
	r.length > 0 && (e.emit("change", [{
		added: [],
		updated: [],
		removed: r
	}, n]), e.emit("update", [{
		added: [],
		updated: [],
		removed: r
	}, n]));
}, Ru = (e, t, n = e.states) => {
	let r = t.length, i = T();
	O(i, r);
	for (let a = 0; a < r; a++) {
		let r = t[a], o = n.get(r) || null, s = e.meta.get(r).clock;
		O(i, r), O(i, s), Ft(i, JSON.stringify(o));
	}
	return E(i);
}, zu = (e, t, n) => {
	let r = en(t), i = vn(), a = [], o = [], s = [], c = [], l = N(r);
	for (let t = 0; t < l; t++) {
		let t = N(r), n = N(r), l = JSON.parse(on(r)), u = e.meta.get(t), d = e.states.get(t), f = u === void 0 ? 0 : u.clock;
		(f < n || f === n && l === null && e.states.has(t)) && (l === null ? t === e.clientID && e.getLocalState() != null ? n++ : e.states.delete(t) : e.states.set(t, l), e.meta.set(t, {
			clock: n,
			lastUpdated: i
		}), u === void 0 && l !== null ? a.push(t) : u !== void 0 && l === null ? c.push(t) : l !== null && (Hn(l, d) || s.push(t), o.push(t)));
	}
	(a.length > 0 || s.length > 0 || c.length > 0) && e.emit("change", [{
		added: a,
		updated: s,
		removed: c
	}, n]), (a.length > 0 || o.length > 0 || c.length > 0) && e.emit("update", [{
		added: a,
		updated: o,
		removed: c
	}, n]);
}, Bu = (e) => Mn(e, (e, t) => `${encodeURIComponent(t)}=${encodeURIComponent(e)}`).join("&"), Vu = [];
Vu[0] = (e, t, n, r, i) => {
	O(e, 0);
	let a = Nu(t, e, n.doc, n);
	r && a === 1 && !n.synced && (n.synced = !0);
}, Vu[3] = (e, t, n, r, i) => {
	O(e, 1), k(e, Ru(n.awareness, Array.from(n.awareness.getStates().keys())));
}, Vu[1] = (e, t, n, r, i) => {
	zu(n.awareness, M(t), n);
}, Vu[2] = (e, t, n, r, i) => {
	Pu(t, n.doc, (e, t) => Uu(n, t));
};
var Hu = 3e4, Uu = (e, t) => console.warn(`Permission denied to access ${e.url}.\n${t}`), Wu = (e, t, n) => {
	let r = en(t), i = T(), a = N(r), o = e.messageHandlers[a];
	return o ? o(i, r, e, n, a) : console.error("Unable to compute message"), i;
}, Gu = (e, t, n) => {
	t === e.ws && (e.emit("connection-close", [n, e]), e.ws = null, t.close(), e.wsconnecting = !1, e.wsconnected ? (e.wsconnected = !1, e.synced = !1, Lu(e.awareness, Array.from(e.awareness.getStates().keys()).filter((t) => t !== e.doc.clientID), e), e.emit("status", [{ status: "disconnected" }])) : e.wsUnsuccessfulReconnects++, setTimeout(Ku, ut(ft(2, e.wsUnsuccessfulReconnects) * 100, e.maxBackoffTime), e));
}, Ku = (e) => {
	if (e.shouldConnect && e.ws === null) {
		let t = new e._WS(e.url, e.protocols);
		t.binaryType = "arraybuffer", e.ws = t, e.wsconnecting = !0, e.wsconnected = !1, e.synced = !1, t.onmessage = (n) => {
			e.wsLastMessageReceived = vn();
			let r = Wu(e, new Uint8Array(n.data), !0);
			kt(r) > 1 && t.send(E(r));
		}, t.onerror = (t) => {
			e.emit("connection-error", [t, e]);
		}, t.onclose = (n) => {
			Gu(e, t, n);
		}, t.onopen = () => {
			e.wsLastMessageReceived = vn(), e.wsconnecting = !1, e.wsconnected = !0, e.wsUnsuccessfulReconnects = 0, e.emit("status", [{ status: "connected" }]);
			let n = T();
			if (O(n, 0), Du(n, e.doc), t.send(E(n)), e.awareness.getLocalState() !== null) {
				let n = T();
				O(n, 1), k(n, Ru(e.awareness, [e.doc.clientID])), t.send(E(n));
			}
		}, e.emit("status", [{ status: "connecting" }]);
	}
}, qu = (e, t) => {
	let n = e.ws;
	e.wsconnected && n && n.readyState === n.OPEN && n.send(t), e.bcconnected && Eu(e.bcChannel, t, e);
}, Ju = class extends st {
	constructor(e, t, n, { connect: r = !0, awareness: i = new Iu(n), params: a = {}, protocols: o = [], WebSocketPolyfill: s = WebSocket, resyncInterval: c = -1, maxBackoffTime: l = 2500, disableBc: u = !1 } = {}) {
		for (super(); e[e.length - 1] === "/";) e = e.slice(0, e.length - 1);
		this.serverUrl = e, this.bcChannel = e + "/" + t, this.maxBackoffTime = l, this.params = a, this.protocols = o, this.roomname = t, this.doc = n, this._WS = s, this.awareness = i, this.wsconnected = !1, this.wsconnecting = !1, this.bcconnected = !1, this.disableBc = u, this.wsUnsuccessfulReconnects = 0, this.messageHandlers = Vu.slice(), this._synced = !1, this.ws = null, this.wsLastMessageReceived = 0, this.shouldConnect = r, this._resyncInterval = 0, c > 0 && (this._resyncInterval = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				let e = T();
				O(e, 0), Du(e, n), this.ws.send(E(e));
			}
		}, c)), this._bcSubscriber = (e, t) => {
			if (t !== this) {
				let t = Wu(this, new Uint8Array(e), !1);
				kt(t) > 1 && Eu(this.bcChannel, E(t), this);
			}
		}, this._updateHandler = (e, t) => {
			if (t !== this) {
				let t = T();
				O(t, 0), ju(t, e), qu(this, E(t));
			}
		}, this.doc.on("update", this._updateHandler), this._awarenessUpdateHandler = ({ added: e, updated: t, removed: n }, r) => {
			let a = e.concat(t).concat(n), o = T();
			O(o, 1), k(o, Ru(i, a)), qu(this, E(o));
		}, this._exitHandler = () => {
			Lu(this.awareness, [n.clientID], "app closed");
		}, Wn && typeof process < "u" && process.on("exit", this._exitHandler), i.on("update", this._awarenessUpdateHandler), this._checkInterval = setInterval(() => {
			this.wsconnected && Hu < vn() - this.wsLastMessageReceived && Gu(this, this.ws, null);
		}, Hu / 10), r && this.connect();
	}
	get url() {
		let e = Bu(this.params);
		return this.serverUrl + "/" + this.roomname + (e.length === 0 ? "" : "?" + e);
	}
	get synced() {
		return this._synced;
	}
	set synced(e) {
		this._synced !== e && (this._synced = e, this.emit("synced", [e]), this.emit("sync", [e]));
	}
	destroy() {
		this._resyncInterval !== 0 && clearInterval(this._resyncInterval), clearInterval(this._checkInterval), this.disconnect(), Wn && typeof process < "u" && process.off("exit", this._exitHandler), this.awareness.off("update", this._awarenessUpdateHandler), this.doc.off("update", this._updateHandler), super.destroy();
	}
	connectBc() {
		if (this.disableBc) return;
		this.bcconnected ||= (wu(this.bcChannel, this._bcSubscriber), !0);
		let e = T();
		O(e, 0), Du(e, this.doc), Eu(this.bcChannel, E(e), this);
		let t = T();
		O(t, 0), Ou(t, this.doc), Eu(this.bcChannel, E(t), this);
		let n = T();
		O(n, 3), Eu(this.bcChannel, E(n), this);
		let r = T();
		O(r, 1), k(r, Ru(this.awareness, [this.doc.clientID])), Eu(this.bcChannel, E(r), this);
	}
	disconnectBc() {
		let e = T();
		O(e, 1), k(e, Ru(this.awareness, [this.doc.clientID], /* @__PURE__ */ new Map())), qu(this, E(e)), this.bcconnected &&= (Tu(this.bcChannel, this._bcSubscriber), !1);
	}
	disconnect() {
		this.shouldConnect = !1, this.disconnectBc(), this.ws !== null && Gu(this, this.ws, null);
	}
	connect() {
		this.shouldConnect = !0, !this.wsconnected && this.ws === null && (Ku(this), this.connectBc());
	}
};
// packages/ui/src/components/rich-text/collaborative-markdown-editor/awareness-cursors.tsx
function Yu() {
	return /* @__PURE__ */ S("style", { children: "\n        .collaboration-cursor-container {\n          position: relative;\n          display: inline;\n        }\n\n        .collaboration-cursor-caret {\n          position: absolute;\n          top: 0;\n          bottom: 0;\n          width: 2px;\n          pointer-events: none;\n        }\n\n        .collaboration-cursor-label {\n          position: absolute;\n          top: -18px;\n          left: -2px;\n          padding: 1px 6px;\n          font-size: 11px;\n          font-weight: 600;\n          line-height: 16px;\n          white-space: nowrap;\n          border-radius: 4px 4px 4px 0;\n          color: #fff;\n          pointer-events: none;\n          user-select: none;\n        }\n\n        .collaboration-cursor-selection {\n          position: absolute;\n          pointer-events: none;\n          opacity: 0.25;\n        }\n      " });
}
// packages/ui/src/components/rich-text/collaborative-markdown-editor/collaborative-markdown-editor.tsx
function Xu(u) {
	let { roomId: d, wsUrl: f, wsParams: p = {}, userName: g = "Anonymous", userColor: _ = "#30bced", placeholder: ee } = u, te = Ne(null), [ne, v] = Pe(null), [re, ie] = Pe(!1), [ae] = Pe(() => new R()), [oe] = Pe(() => {
		let e = new Ju(f, d, ae, {
			params: p,
			connect: !1
		});
		return e.on("sync", (e) => {
			e && ie(!0);
		}), e;
	});
	return x(() => (oe.connect(), () => {
		oe.disconnect();
	}), [oe]), x(() => {
		v(te.current);
	}, []), /* @__PURE__ */ Be(Ie, {
		ref: te,
		className: "rich-text",
		justifyContent: "space-between",
		width: "100%",
		maxWidth: "100%",
		height: "100%",
		position: "relative",
		direction: "column",
		overflow: "visible",
		children: [/* @__PURE__ */ S(Yu, {}), /* @__PURE__ */ S(h, {
			initialConfig: {
				namespace: "COLLABORATIVE_EDITOR",
				nodes: i,
				editorState: null,
				onError: (e) => console.error(e),
				editable: !0,
				theme: n
			},
			children: /* @__PURE__ */ Be(qe, { children: [
				/* @__PURE__ */ S(vu, {
					id: d,
					doc: ae,
					provider: oe,
					__shouldBootstrapUnsafe: !1,
					username: g,
					cursorColor: _
				}),
				/* @__PURE__ */ S(l, {}),
				/* @__PURE__ */ S(e, {}),
				/* @__PURE__ */ S(c, {}),
				/* @__PURE__ */ S(t, { maxIndent: 7 }),
				/* @__PURE__ */ S(o, {}),
				/* @__PURE__ */ S(a, {}),
				/* @__PURE__ */ S(s, {}),
				/* @__PURE__ */ S(Ee, { anchorElem: ne }),
				/* @__PURE__ */ S(r, {}),
				/* @__PURE__ */ S(be, {
					contentEditable: /* @__PURE__ */ S(ve, {
						fullWidth: !1,
						layerStyle: "markdownEditorInset"
					}),
					placeholder: re && ee ? /* @__PURE__ */ S(Fe, {
						position: "absolute",
						top: "0",
						left: "0",
						right: "0",
						layerStyle: "markdownEditorInset",
						color: "fg.muted",
						pointerEvents: "none",
						userSelect: "none",
						textStyle: "paragraph/M/regular",
						children: ee
					}) : null,
					ErrorBoundary: m
				}),
				ne ? /* @__PURE__ */ S(De, { anchorElem: ne }) : null
			] })
		})]
	});
}
// packages/ui/src/components/rich-text/collaborative-markdown-editor/collaborative-markdown-editor.stories.tsx
var Zu = class {
	awareness;
	cbs = {};
	constructor(e) {
		this.awareness = new Iu(e);
	}
	connect() {
		queueMicrotask(() => {
			this.emit("sync", !0), this.emit("status", { status: "connected" });
		});
	}
	disconnect() {}
	on(e, t) {
		this.cbs[e] || (this.cbs[e] = /* @__PURE__ */ new Set()), this.cbs[e].add(t);
	}
	off(e, t) {
		this.cbs[e]?.delete(t);
	}
	emit(e, ...t) {
		for (let n of this.cbs[e] ?? []) n(...t);
	}
};
function Qu(e, t) {
	let n = !1;
	e.on("update", (e) => {
		n ||= (n = !0, ba(t, e), !1);
	}), t.on("update", (t) => {
		n ||= (n = !0, ba(e, t), !1);
	});
}
function $u(e, t) {
	e.on("update", ({ added: n, updated: r, removed: i }) => {
		zu(t, Ru(e, [
			...n,
			...r,
			...i
		]), e);
	}), t.on("update", ({ added: n, updated: r, removed: i }) => {
		zu(e, Ru(t, [
			...n,
			...r,
			...i
		]), t);
	});
}
function ed({ label: t, roomId: c, userName: u, userColor: d, provider: f, doc: p }) {
	let g = Ne(null), [_, ee] = Pe(null);
	x(() => {
		ee(g.current);
	}, []);
	let te = {
		namespace: `COLLAB_${t}`,
		nodes: i,
		editorState: null,
		onError: (e) => console.error(e),
		editable: !0,
		theme: n
	};
	return /* @__PURE__ */ Be(Re, {
		align: "stretch",
		flex: "1",
		minW: "0",
		children: [/* @__PURE__ */ Be(Le, {
			size: "sm",
			px: "2",
			py: "1",
			borderBottom: "1px solid",
			borderColor: "border",
			children: [/* @__PURE__ */ S(Fe, {
				as: "span",
				display: "inline-block",
				w: "10px",
				h: "10px",
				borderRadius: "full",
				bg: d,
				mr: "2"
			}), t]
		}), /* @__PURE__ */ S(Ie, {
			ref: g,
			className: "rich-text",
			flex: "1",
			direction: "column",
			overflow: "hidden",
			position: "relative",
			minH: "300px",
			children: /* @__PURE__ */ S(h, {
				initialConfig: te,
				children: /* @__PURE__ */ Be(qe, { children: [
					/* @__PURE__ */ S(gu, {
						id: c,
						providerFactory: (e, t) => (t.set(e, p), f),
						shouldBootstrap: !1,
						username: u,
						cursorColor: d
					}),
					/* @__PURE__ */ S(l, {}),
					/* @__PURE__ */ S(e, {}),
					/* @__PURE__ */ S(o, {}),
					/* @__PURE__ */ S(a, {}),
					/* @__PURE__ */ S(s, {}),
					/* @__PURE__ */ S(Ee, { anchorElem: _ }),
					/* @__PURE__ */ S(r, {}),
					/* @__PURE__ */ S(be, {
						contentEditable: /* @__PURE__ */ S(ve, { fullWidth: !0 }),
						placeholder: /* @__PURE__ */ S(Fe, {
							position: "absolute",
							top: "0",
							color: "fg.muted",
							pointerEvents: "none",
							userSelect: "none",
							children: "Type here..."
						}),
						ErrorBoundary: m
					}),
					_ ? /* @__PURE__ */ S(De, { anchorElem: _ }) : null
				] })
			})
		})]
	});
}
function td() {
	let e = "demo-room", [{ docA: t, docB: n, providerA: r, providerB: i }] = Pe(() => {
		let e = new R(), t = new R();
		Qu(e, t);
		let n = new Zu(e), r = new Zu(t);
		return $u(n.awareness, r.awareness), {
			docA: e,
			docB: t,
			providerA: n,
			providerB: r
		};
	});
	return /* @__PURE__ */ Be(Ie, {
		gap: "4",
		h: "500px",
		children: [
			/* @__PURE__ */ S(Yu, {}),
			/* @__PURE__ */ S(ed, {
				label: "Alice",
				roomId: e,
				userName: "Alice",
				userColor: "#30bced",
				provider: r,
				doc: t
			}),
			/* @__PURE__ */ S(ed, {
				label: "Bob",
				roomId: e,
				userName: "Bob",
				userColor: "#e06c75",
				provider: i,
				doc: n
			})
		]
	});
}
var nd = {
	title: "Patterns/Editors/Collaborative Markdown Editor",
	component: Xu,
	parameters: { layout: "padded" }
}, rd = { render: () => /* @__PURE__ */ S(td, {}) }, id = { args: {
	roomId: "todo:story-demo",
	wsUrl: "ws://localhost:3000/v1/docs",
	userName: "Storybook User",
	userColor: "#30bced",
	placeholder: "Start typing collaboratively..."
} };
export { id as SingleEditor, rd as SplitView, nd as default };
