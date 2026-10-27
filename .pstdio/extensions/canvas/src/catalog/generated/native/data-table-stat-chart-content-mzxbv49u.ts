// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, t as n } from "./rolldown-runtime-CwxnZyOB.ts";
import { n as r, t as i } from "./array-wEFLA1CZ.ts";
import { A as a, C as o, D as s, E as c, O as l, T as u, _ as d, b as f, g as p, h as m, j as h, k as g, m as _, p as v, v as y, x as b, y as x } from "./string-CzPPgV0r.ts";
import { a as S, i as C, n as w, o as T, r as E, t as D } from "./wiggle-K39oXP_x.ts";
import { _ as O, a as k, c as A, f as j, h as M, i as N, l as ee, m as te, n as ne, o as re, p as ie, r as ae, s as oe, t as se, u as ce } from "./linear-CFwOaCHx.ts";
import { n as le, t as ue } from "./ordinal-6KBqe2wL.ts";
import { C as de, D as fe, E as pe, O as me, _ as he, a as ge, i as _e, l as ve, n as ye, o as be, s as xe, t as Se, w as Ce, x as we, y as Te } from "./time-BLlglk2-.ts";
import { n as Ee, t as De } from "./band-Daw32bCA.ts";
import { n as Oe, t as ke } from "./init-TtQIWAwY.ts";
import { r as Ae, t as je } from "./defaultLocale-f1CsQLg-.ts";
import { n as Me, t as Ne } from "./shim-BO2YVxVE.ts";
import * as P from "react";
import { Children as Pe, PureComponent as Fe, cloneElement as Ie, createContext as Le, createElement as Re, forwardRef as ze, isValidElement as Be, memo as Ve, useCallback as F, useContext as He, useEffect as I, useImperativeHandle as Ue, useLayoutEffect as We, useMemo as Ge, useRef as L, useState as Ke } from "react";
import { Box as qe, ColorSwatch as Je, Flex as Ye, HStack as Xe, Separator as Ze, Span as Qe, Stack as $e, Text as et, defineStyle as tt, useChakraContext as nt, useLocaleContext as rt } from "@chakra-ui/react";
import { Fragment as it, jsx as R, jsxs as at } from "react/jsx-runtime";
import { createPortal as ot } from "react-dom";
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/area.js
function st(e, t, n) {
	var o = null, c = r(!0), u = null, d = a, f = null, p = h(m);
	e = typeof e == "function" ? e : e === void 0 ? l : r(+e), t = typeof t == "function" ? t : r(t === void 0 ? 0 : +t), n = typeof n == "function" ? n : n === void 0 ? g : r(+n);
	function m(r) {
		var a, s, l, m = (r = i(r)).length, h, g = !1, _, v = Array(m), y = Array(m);
		for (u ?? (f = d(_ = p())), a = 0; a <= m; ++a) {
			if (!(a < m && c(h = r[a], a, r)) === g) {
				if (g = !g) s = a, f.areaStart(), f.lineStart();
				else {
					for (f.lineEnd(), f.lineStart(), l = a - 1; l >= s; --l) f.point(v[l], y[l]);
					f.lineEnd(), f.areaEnd();
				}
			}
			g && (v[a] = +e(h, a, r), y[a] = +t(h, a, r), f.point(o ? +o(h, a, r) : v[a], n ? +n(h, a, r) : y[a]));
		}
		if (_) return f = null, _ + "" || null;
	}
	function _() {
		return s().defined(c).curve(d).context(u);
	}
	return m.x = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : r(+t), o = null, m) : e;
	}, m.x0 = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : r(+t), m) : e;
	}, m.x1 = function(e) {
		return arguments.length ? (o = e == null ? null : typeof e == "function" ? e : r(+e), m) : o;
	}, m.y = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : r(+e), n = null, m) : t;
	}, m.y0 = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : r(+e), m) : t;
	}, m.y1 = function(e) {
		return arguments.length ? (n = e == null ? null : typeof e == "function" ? e : r(+e), m) : n;
	}, m.lineX0 = m.lineY0 = function() {
		return _().x(e).y(t);
	}, m.lineY1 = function() {
		return _().x(e).y(n);
	}, m.lineX1 = function() {
		return _().x(o).y(t);
	}, m.defined = function(e) {
		return arguments.length ? (c = typeof e == "function" ? e : r(!!e), m) : c;
	}, m.curve = function(e) {
		return arguments.length ? (d = e, u != null && (f = d(u)), m) : d;
	}, m.context = function(e) {
		return arguments.length ? (e == null ? u = f = null : f = d(u = e), m) : u;
	}, m;
}
// node_modules/.bun/d3-array@3.2.4/node_modules/d3-array/src/sort.js
function ct(e = O) {
	if (e === O) return lt;
	if (typeof e != "function") throw TypeError("compare is not a function");
	return (t, n) => {
		let r = e(t, n);
		return r || r === 0 ? r : (e(n, n) === 0) - (e(t, t) === 0);
	};
}
function lt(e, t) {
	return (e == null || !(e >= e)) - (t == null || !(t >= t)) || (e < t ? -1 : +(e > t));
}
// node_modules/.bun/d3-array@3.2.4/node_modules/d3-array/src/quickselect.js
function ut(e, t, n = 0, r = Infinity, i) {
	if (t = Math.floor(t), n = Math.floor(Math.max(0, n)), r = Math.floor(Math.min(e.length - 1, r)), !(n <= t && t <= r)) return e;
	for (i = i === void 0 ? lt : ct(i); r > n;) {
		if (r - n > 600) {
			let a = r - n + 1, o = t - n + 1, s = Math.log(a), c = .5 * Math.exp(2 * s / 3), l = .5 * Math.sqrt(s * c * (a - c) / a) * (o - a / 2 < 0 ? -1 : 1), u = Math.max(n, Math.floor(t - o * c / a + l)), d = Math.min(r, Math.floor(t + (a - o) * c / a + l));
			ut(e, t, u, d, i);
		}
		let a = e[t], o = n, s = r;
		for (dt(e, n, t), i(e[r], a) > 0 && dt(e, n, r); o < s;) {
			for (dt(e, o, s), ++o, --s; i(e[o], a) < 0;) ++o;
			for (; i(e[s], a) > 0;) --s;
		}
		i(e[n], a) === 0 ? dt(e, n, s) : (++s, dt(e, s, r)), s <= t && (n = s + 1), t <= s && (r = s - 1);
	}
	return e;
}
function dt(e, t, n) {
	let r = e[t];
	e[t] = e[n], e[n] = r;
}
// node_modules/.bun/d3-array@3.2.4/node_modules/d3-array/src/quantile.js
function ft(e, t, n) {
	if (e = Float64Array.from(M(e, n)), (r = e.length) && !isNaN(t = +t)) {
		if (t <= 0 || r < 2) return fe(e);
		if (t >= 1) return me(e);
		var r, i = (r - 1) * t, a = Math.floor(i), o = me(ut(e, a).subarray(0, a + 1));
		return o + (fe(e.subarray(a + 1)) - o) * (i - a);
	}
}
function pt(e, t, n = te) {
	if ((r = e.length) && !isNaN(t = +t)) {
		if (t <= 0 || r < 2) return +n(e[0], 0, e);
		if (t >= 1) return +n(e[r - 1], r - 1, e);
		var r, i = (r - 1) * t, a = Math.floor(i), o = +n(e[a], a, e);
		return o + (+n(e[a + 1], a + 1, e) - o) * (i - a);
	}
}
// node_modules/.bun/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/piecewise.js
function mt(e, t) {
	t === void 0 && (t = e, e = ce);
	for (var n = 0, r = t.length - 1, i = t[0], a = Array(r < 0 ? 0 : r); n < r;) a[n] = e(i, i = t[++n]);
	return function(e) {
		var t = Math.max(0, Math.min(r - 1, Math.floor(e *= r)));
		return a[t](e - t);
	};
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/identity.js
function ht(e) {
	var t;
	function n(e) {
		return e == null || isNaN(e = +e) ? t : e;
	}
	return n.invert = n, n.domain = n.range = function(t) {
		return arguments.length ? (e = Array.from(t, A), n) : e.slice();
	}, n.unknown = function(e) {
		return arguments.length ? (t = e, n) : t;
	}, n.copy = function() {
		return ht(e).unknown(t);
	}, e = arguments.length ? Array.from(e, A) : [0, 1], ne(n);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/log.js
function gt(e) {
	return Math.log(e);
}
function _t(e) {
	return Math.exp(e);
}
function vt(e) {
	return -Math.log(-e);
}
function yt(e) {
	return -Math.exp(-e);
}
function bt(e) {
	return isFinite(e) ? +("1e" + e) : e < 0 ? 0 : e;
}
function xt(e) {
	return e === 10 ? bt : e === Math.E ? Math.exp : (t) => e ** +t;
}
function St(e) {
	return e === Math.E ? Math.log : e === 10 && Math.log10 || e === 2 && Math.log2 || (e = Math.log(e), (t) => Math.log(t) / e);
}
function Ct(e) {
	return (t, n) => -e(-t, n);
}
function wt(e) {
	let t = e(gt, _t), n = t.domain, r = 10, i, a;
	function o() {
		return i = St(r), a = xt(r), n()[0] < 0 ? (i = Ct(i), a = Ct(a), e(vt, yt)) : e(gt, _t), t;
	}
	return t.base = function(e) {
		return arguments.length ? (r = +e, o()) : r;
	}, t.domain = function(e) {
		return arguments.length ? (n(e), o()) : n();
	}, t.ticks = (e) => {
		let t = n(), o = t[0], s = t[t.length - 1], c = s < o;
		c && ([o, s] = [s, o]);
		let l = i(o), u = i(s), d, f, p = e == null ? 10 : +e, m = [];
		if (!(r % 1) && u - l < p) {
			if (l = Math.floor(l), u = Math.ceil(u), o > 0) {
				for (; l <= u; ++l) for (d = 1; d < r; ++d) if (f = l < 0 ? d / a(-l) : d * a(l), !(f < o)) {
					if (f > s) break;
					m.push(f);
				}
			} else for (; l <= u; ++l) for (d = r - 1; d >= 1; --d) if (f = l > 0 ? d / a(-l) : d * a(l), !(f < o)) {
				if (f > s) break;
				m.push(f);
			}
			m.length * 2 < p && (m = j(o, s, p));
		} else m = j(l, u, Math.min(u - l, p)).map(a);
		return c ? m.reverse() : m;
	}, t.tickFormat = (e, n) => {
		if (e ??= 10, n ??= r === 10 ? "s" : ",", typeof n != "function" && (!(r % 1) && (n = Ae(n)).precision == null && (n.trim = !0), n = je(n)), e === Infinity) return n;
		let o = Math.max(1, r * e / t.ticks().length);
		return (e) => {
			let t = e / a(Math.round(i(e)));
			return t * r < r - .5 && (t *= r), t <= o ? n(e) : "";
		};
	}, t.nice = () => n(pe(n(), {
		floor: (e) => a(Math.floor(i(e))),
		ceil: (e) => a(Math.ceil(i(e)))
	})), t;
}
function Tt() {
	let e = wt(oe()).domain([1, 10]);
	return e.copy = () => k(e, Tt()).base(e.base()), Oe.apply(e, arguments), e;
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/symlog.js
function Et(e) {
	return function(t) {
		return Math.sign(t) * Math.log1p(Math.abs(t / e));
	};
}
function Dt(e) {
	return function(t) {
		return Math.sign(t) * Math.expm1(Math.abs(t)) * e;
	};
}
function Ot(e) {
	var t = 1, n = e(Et(t), Dt(t));
	return n.constant = function(n) {
		return arguments.length ? e(Et(t = +n), Dt(t)) : t;
	}, ne(n);
}
function kt() {
	var e = Ot(oe());
	return e.copy = function() {
		return k(e, kt()).constant(e.constant());
	}, Oe.apply(e, arguments);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/pow.js
function At(e) {
	return function(t) {
		return t < 0 ? -((-t) ** +e) : t ** +e;
	};
}
function jt(e) {
	return e < 0 ? -Math.sqrt(-e) : Math.sqrt(e);
}
function Mt(e) {
	return e < 0 ? -e * e : e * e;
}
function Nt(e) {
	var t = e(re, re), n = 1;
	function r() {
		return n === 1 ? e(re, re) : n === .5 ? e(jt, Mt) : e(At(n), At(1 / n));
	}
	return t.exponent = function(e) {
		return arguments.length ? (n = +e, r()) : n;
	}, ne(t);
}
function Pt() {
	var e = Nt(oe());
	return e.copy = function() {
		return k(e, Pt()).exponent(e.exponent());
	}, Oe.apply(e, arguments), e;
}
function Ft() {
	return Pt.apply(null, arguments).exponent(.5);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/radial.js
function It(e) {
	return Math.sign(e) * e * e;
}
function Lt(e) {
	return Math.sign(e) * Math.sqrt(Math.abs(e));
}
function Rt() {
	var e = N(), t = [0, 1], n = !1, r;
	function i(t) {
		var i = Lt(e(t));
		return isNaN(i) ? r : n ? Math.round(i) : i;
	}
	return i.invert = function(t) {
		return e.invert(It(t));
	}, i.domain = function(t) {
		return arguments.length ? (e.domain(t), i) : e.domain();
	}, i.range = function(n) {
		return arguments.length ? (e.range((t = Array.from(n, A)).map(It)), i) : t.slice();
	}, i.rangeRound = function(e) {
		return i.range(e).round(!0);
	}, i.round = function(e) {
		return arguments.length ? (n = !!e, i) : n;
	}, i.clamp = function(t) {
		return arguments.length ? (e.clamp(t), i) : e.clamp();
	}, i.unknown = function(e) {
		return arguments.length ? (r = e, i) : r;
	}, i.copy = function() {
		return Rt(e.domain(), t).round(n).clamp(e.clamp()).unknown(r);
	}, Oe.apply(i, arguments), ne(i);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/quantile.js
function zt() {
	var e = [], t = [], n = [], r;
	function i() {
		var r = 0, i = Math.max(1, t.length);
		for (n = Array(i - 1); ++r < i;) n[r - 1] = pt(e, r / i);
		return a;
	}
	function a(e) {
		return e == null || isNaN(e = +e) ? r : t[ie(n, e)];
	}
	return a.invertExtent = function(r) {
		var i = t.indexOf(r);
		return i < 0 ? [NaN, NaN] : [i > 0 ? n[i - 1] : e[0], i < n.length ? n[i] : e[e.length - 1]];
	}, a.domain = function(t) {
		if (!arguments.length) return e.slice();
		e = [];
		for (let n of t) n != null && !isNaN(n = +n) && e.push(n);
		return e.sort(O), i();
	}, a.range = function(e) {
		return arguments.length ? (t = Array.from(e), i()) : t.slice();
	}, a.unknown = function(e) {
		return arguments.length ? (r = e, a) : r;
	}, a.quantiles = function() {
		return n.slice();
	}, a.copy = function() {
		return zt().domain(e).range(t).unknown(r);
	}, Oe.apply(a, arguments);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/quantize.js
function Bt() {
	var e = 0, t = 1, n = 1, r = [.5], i = [0, 1], a;
	function o(e) {
		return e != null && e <= e ? i[ie(r, e, 0, n)] : a;
	}
	function s() {
		var i = -1;
		for (r = Array(n); ++i < n;) r[i] = ((i + 1) * t - (i - n) * e) / (n + 1);
		return o;
	}
	return o.domain = function(n) {
		return arguments.length ? ([e, t] = n, e = +e, t = +t, s()) : [e, t];
	}, o.range = function(e) {
		return arguments.length ? (n = (i = Array.from(e)).length - 1, s()) : i.slice();
	}, o.invertExtent = function(a) {
		var o = i.indexOf(a);
		return o < 0 ? [NaN, NaN] : o < 1 ? [e, r[0]] : o >= n ? [r[n - 1], t] : [r[o - 1], r[o]];
	}, o.unknown = function(e) {
		return arguments.length && (a = e), o;
	}, o.thresholds = function() {
		return r.slice();
	}, o.copy = function() {
		return Bt().domain([e, t]).range(i).unknown(a);
	}, Oe.apply(ne(o), arguments);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/threshold.js
function Vt() {
	var e = [.5], t = [0, 1], n, r = 1;
	function i(i) {
		return i != null && i <= i ? t[ie(e, i, 0, r)] : n;
	}
	return i.domain = function(n) {
		return arguments.length ? (e = Array.from(n), r = Math.min(e.length, t.length - 1), i) : e.slice();
	}, i.range = function(n) {
		return arguments.length ? (t = Array.from(n), r = Math.min(e.length, t.length - 1), i) : t.slice();
	}, i.invertExtent = function(n) {
		var r = t.indexOf(n);
		return [e[r - 1], e[r]];
	}, i.unknown = function(e) {
		return arguments.length ? (n = e, i) : n;
	}, i.copy = function() {
		return Vt().domain(e).range(t).unknown(n);
	}, Oe.apply(i, arguments);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/utcTime.js
function Ht() {
	return Oe.apply(Se(be, ge, xe, ve, he, Te, we, de, Ce, _e).domain([Date.UTC(2e3, 0, 1), Date.UTC(2e3, 0, 2)]), arguments);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/sequential.js
function Ut() {
	var e = 0, t = 1, n, r, i, a, o = re, s = !1, c;
	function l(e) {
		return e == null || isNaN(e = +e) ? c : o(i === 0 ? .5 : (e = (a(e) - n) * i, s ? Math.max(0, Math.min(1, e)) : e));
	}
	l.domain = function(o) {
		return arguments.length ? ([e, t] = o, n = a(e = +e), r = a(t = +t), i = n === r ? 0 : 1 / (r - n), l) : [e, t];
	}, l.clamp = function(e) {
		return arguments.length ? (s = !!e, l) : s;
	}, l.interpolator = function(e) {
		return arguments.length ? (o = e, l) : o;
	};
	function u(e) {
		return function(t) {
			var n, r;
			return arguments.length ? ([n, r] = t, o = e(n, r), l) : [o(0), o(1)];
		};
	}
	return l.range = u(ce), l.rangeRound = u(ee), l.unknown = function(e) {
		return arguments.length ? (c = e, l) : c;
	}, function(o) {
		return a = o, n = o(e), r = o(t), i = n === r ? 0 : 1 / (r - n), l;
	};
}
function Wt(e, t) {
	return t.domain(e.domain()).interpolator(e.interpolator()).clamp(e.clamp()).unknown(e.unknown());
}
function Gt() {
	var e = ne(Ut()(re));
	return e.copy = function() {
		return Wt(e, Gt());
	}, ke.apply(e, arguments);
}
function Kt() {
	var e = wt(Ut()).domain([1, 10]);
	return e.copy = function() {
		return Wt(e, Kt()).base(e.base());
	}, ke.apply(e, arguments);
}
function qt() {
	var e = Ot(Ut());
	return e.copy = function() {
		return Wt(e, qt()).constant(e.constant());
	}, ke.apply(e, arguments);
}
function Jt() {
	var e = Nt(Ut());
	return e.copy = function() {
		return Wt(e, Jt()).exponent(e.exponent());
	}, ke.apply(e, arguments);
}
function Yt() {
	return Jt.apply(null, arguments).exponent(.5);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/sequentialQuantile.js
function Xt() {
	var e = [], t = re;
	function n(n) {
		if (n != null && !isNaN(n = +n)) return t((ie(e, n, 1) - 1) / (e.length - 1));
	}
	return n.domain = function(t) {
		if (!arguments.length) return e.slice();
		e = [];
		for (let n of t) n != null && !isNaN(n = +n) && e.push(n);
		return e.sort(O), n;
	}, n.interpolator = function(e) {
		return arguments.length ? (t = e, n) : t;
	}, n.range = function() {
		return e.map((n, r) => t(r / (e.length - 1)));
	}, n.quantiles = function(t) {
		return Array.from({ length: t + 1 }, (n, r) => ft(e, r / t));
	}, n.copy = function() {
		return Xt(t).domain(e);
	}, ke.apply(n, arguments);
}
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/diverging.js
function Zt() {
	var e = 0, t = .5, n = 1, r = 1, i, a, o, s, c, l = re, u, d = !1, f;
	function p(e) {
		return isNaN(e = +e) ? f : (e = .5 + ((e = +u(e)) - a) * (r * e < r * a ? s : c), l(d ? Math.max(0, Math.min(1, e)) : e));
	}
	p.domain = function(l) {
		return arguments.length ? ([e, t, n] = l, i = u(e = +e), a = u(t = +t), o = u(n = +n), s = i === a ? 0 : .5 / (a - i), c = a === o ? 0 : .5 / (o - a), r = a < i ? -1 : 1, p) : [
			e,
			t,
			n
		];
	}, p.clamp = function(e) {
		return arguments.length ? (d = !!e, p) : d;
	}, p.interpolator = function(e) {
		return arguments.length ? (l = e, p) : l;
	};
	function m(e) {
		return function(t) {
			var n, r, i;
			return arguments.length ? ([n, r, i] = t, l = mt(e, [
				n,
				r,
				i
			]), p) : [
				l(0),
				l(.5),
				l(1)
			];
		};
	}
	return p.range = m(ce), p.rangeRound = m(ee), p.unknown = function(e) {
		return arguments.length ? (f = e, p) : f;
	}, function(l) {
		return u = l, i = l(e), a = l(t), o = l(n), s = i === a ? 0 : .5 / (a - i), c = a === o ? 0 : .5 / (o - a), r = a < i ? -1 : 1, p;
	};
}
function Qt() {
	var e = ne(Zt()(re));
	return e.copy = function() {
		return Wt(e, Qt());
	}, ke.apply(e, arguments);
}
function $t() {
	var e = wt(Zt()).domain([
		.1,
		1,
		10
	]);
	return e.copy = function() {
		return Wt(e, $t()).base(e.base());
	}, ke.apply(e, arguments);
}
function en() {
	var e = Ot(Zt());
	return e.copy = function() {
		return Wt(e, en()).constant(e.constant());
	}, ke.apply(e, arguments);
}
function tn() {
	var e = Nt(Zt());
	return e.copy = function() {
		return Wt(e, tn()).exponent(e.exponent());
	}, ke.apply(e, arguments);
}
function nn() {
	return tn.apply(null, arguments).exponent(.5);
}
// node_modules/.bun/use-sync-external-store@1.6.0+b1ab299f0a400331/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js
var rn = /* @__PURE__ */ n(((e) => {
	var t = Me(), n = Ne();
	function r(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var i = typeof Object.is == "function" ? Object.is : r, a = n.useSyncExternalStore, o = t.useRef, s = t.useEffect, c = t.useMemo, l = t.useDebugValue;
	e.useSyncExternalStoreWithSelector = function(e, t, n, r, u) {
		var d = o(null);
		if (d.current === null) {
			var f = {
				hasValue: !1,
				value: null
			};
			d.current = f;
		} else f = d.current;
		d = c(function() {
			function e(e) {
				if (!a) {
					if (a = !0, o = e, e = r(e), u !== void 0 && f.hasValue) {
						var t = f.value;
						if (u(t, e)) return s = t;
					}
					return s = e;
				}
				if (t = s, i(o, e)) return t;
				var n = r(e);
				return u !== void 0 && u(t, n) ? (o = e, t) : (o = e, s = n);
			}
			var a = !1, o, s, c = n === void 0 ? null : n;
			return [function() {
				return e(t());
			}, c === null ? void 0 : function() {
				return e(c());
			}];
		}, [
			t,
			n,
			r,
			u
		]);
		var p = a(e, d[0], d[1]);
		return s(function() {
			f.hasValue = !0, f.value = p;
		}, [p]), l(p), p;
	};
})), an = /* @__PURE__ */ n(((e, t) => {
	t.exports = rn();
}));
// node_modules/.bun/@chakra-ui+charts@3.36.0+490543e69527c81c/node_modules/@chakra-ui/charts/dist/esm/use-chart.js
function on(e) {
	let { data: t, series: n = [], sort: r } = e, i = P.useId(), [a, o] = P.useState(null), s = (e) => a === e, c = rt(), l = nt(), u = (e) => l.token(`colors.${e}`, e), d = (e) => l.token(`sizes.${e}`, e), f = (e) => l.token(`spacing.${e}`, e), p = (e) => e ?? "value", m = P.useCallback((e) => {
		let t = new Intl.NumberFormat(c.locale, e);
		return (e) => t.format(e);
	}, [c.locale]), h = P.useCallback((e) => (t) => new Date(t).toLocaleDateString(c.locale, e), [c.locale]), g = (e) => {
		if (!sn(e)) return;
		let t = n.find((t) => t.name === e.name || t.name === cn(e.payload, "name") || t.name === e.dataKey || t.name === cn(e.payload, "dataKey")) || { color: void 0 };
		return t.color ||= cn(e.payload, "color"), t.label ||= t.name?.toLocaleString() || cn(e.payload, "name"), t;
	}, _ = (e) => t.reduce((t, n) => t + Number(n[e]), 0);
	function v(e) {
		return e?.reduce((e, t) => {
			if (!t.value) return e;
			let n = Number(t.value);
			return e + (Number.isNaN(n) ? 0 : n);
		}, 0);
	}
	function y(e) {
		return Math.min(...t.map((t) => Number(t[e])));
	}
	function b(e) {
		return Math.max(...t.map((t) => Number(t[e])));
	}
	function x(e, t, n) {
		let r = y(e), i = b(e);
		if (n) {
			let e = typeof n == "function" ? n({
				min: r,
				max: i
			}) : n;
			return (t - e[0]) / (e[1] - e[0]) * 100;
		}
		return t / _(e) * 100;
	}
	return {
		id: i,
		key: p,
		data: P.useMemo(() => r ? t.sort((e, t) => {
			let n = Number(e[r.by]), i = Number(t[r.by]);
			return r.direction === "desc" ? i - n : n - i;
		}) : t, [t, r]),
		groupBy: (e) => ln(t, e),
		series: n,
		getSeries: g,
		color: u,
		size: d,
		spacing: f,
		formatNumber: m,
		formatDate: h,
		highlightedSeries: a,
		setHighlightedSeries: o,
		isHighlightedSeries: s,
		getSeriesOpacity: (e, t = .2) => {
			if (e && a) return s(e) ? 1 : t;
		},
		getTotal: _,
		getMin: y,
		getMax: b,
		getPayloadTotal: v,
		getValuePercent: x
	};
}
var sn = (e) => typeof e == "object" && !!e;
function cn(e, t) {
	if (t && sn(e)) return Reflect.get(e, t);
}
function ln(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = r[t], i = n.get(e) || [];
		i.push(r), n.set(e, i);
	}
	return Array.from(n.values());
}
// node_modules/.bun/@chakra-ui+charts@3.36.0+490543e69527c81c/node_modules/@chakra-ui/charts/dist/esm/chart/chart.js
var un = Le({}), dn = () => He(un), fn = tt({
	width: "100%",
	"& :where(.recharts-cartesian-axis-tick-value, .recharts-polar-angle-axis-tick-value, .recharts-polar-radius-axis-tick-value, .recharts-pie-label-text)": { fill: "fg.muted" },
	"& .recharts-cartesian-axis .recharts-label": {
		fill: "fg",
		fontWeight: "medium"
	},
	"& *": { outline: "none" },
	"& svg": { overflow: "visible" },
	"& .recharts-wrapper": {
		width: "100%",
		height: "100%"
	}
});
function pn(e) {
	let { children: t, css: n, chart: r, ...i } = e;
	return /* @__PURE__ */ R(un.Provider, {
		value: r,
		children: /* @__PURE__ */ R(qe, {
			aspectRatio: "landscape",
			textStyle: "xs",
			css: [fn, n],
			...i,
			children: t
		})
	});
}
function mn(e) {
	let { payload: t, label: n, labelFormatter: r, hideLabel: i, hideIndicator: a, hideSeriesLabel: o, showTotal: s, fitContent: c, nameKey: l, formatter: u, render: d } = e, f = dn(), p = t?.filter((e) => e.color !== "none" || e.type !== "none"), m = Ge(() => f.getPayloadTotal(p), [p, f]), h = Ge(() => {
		let e = p?.[0], t = `${cn(e?.payload, l) || n || e?.dataKey || "value"}`;
		return r?.(t, p ?? []) ?? t;
	}, [
		p,
		r,
		n,
		l
	]);
	return p?.length ? /* @__PURE__ */ at($e, {
		minW: c ? void 0 : "8rem",
		gap: "1",
		rounded: "l2",
		bg: "bg.panel",
		px: "2.5",
		py: "1",
		textStyle: "xs",
		shadow: "md",
		children: [
			!i && /* @__PURE__ */ R(et, {
				fontWeight: "medium",
				children: h
			}),
			/* @__PURE__ */ R(qe, { children: p.map((e, t) => {
				let n = f.getSeries(e);
				if (d) return d(e.payload);
				let r = u ? u(e.value, n?.label || e.name) : e.value?.toLocaleString(), [i, s] = Array.isArray(r) ? r : [r, n?.label || e.name];
				return /* @__PURE__ */ at(Ye, {
					gap: "1.5",
					wrap: "wrap",
					align: "center",
					_icon: { boxSize: "2.5" },
					children: [
						n?.icon,
						n?.color && !n?.icon && !a && /* @__PURE__ */ R(Je, {
							rounded: "full",
							boxSize: "2",
							value: f.color(n.color)
						}),
						/* @__PURE__ */ at(Xe, {
							justify: "space-between",
							flex: "1",
							children: [!o && /* @__PURE__ */ R(Qe, {
								color: "fg.muted",
								children: s
							}), e.value && /* @__PURE__ */ R(et, {
								fontFamily: "mono",
								fontWeight: "medium",
								fontVariantNumeric: "tabular-nums",
								children: i
							})]
						})
					]
				}, t);
			}) }),
			s && m != null && /* @__PURE__ */ at(it, { children: [/* @__PURE__ */ R(Ze, { mt: "1" }), /* @__PURE__ */ at(Xe, {
				gap: "1",
				justify: "space-between",
				pb: "1",
				children: [/* @__PURE__ */ R(Qe, {
					color: "fg.muted",
					children: "Total"
				}), /* @__PURE__ */ R(et, {
					fontFamily: "mono",
					fontWeight: "medium",
					fontVariantNumeric: "tabular-nums",
					children: (() => {
						if (!u) return m.toLocaleString();
						let e = u(m, "");
						return Array.isArray(e) ? e[0] : e;
					})()
				})]
			})] })
		]
	}) : null;
}
// node_modules/.bun/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
function hn(e) {
	var t, n, r = "";
	if (typeof e == "string" || typeof e == "number") r += e;
	else if (typeof e == "object") {
		if (Array.isArray(e)) {
			var i = e.length;
			for (t = 0; t < i; t++) e[t] && (n = hn(e[t])) && (r && (r += " "), r += n);
		} else for (n in e) e[n] && (r && (r += " "), r += n);
	}
	return r;
}
function z() {
	for (var e, t, n = 0, r = "", i = arguments.length; n < i; n++) (e = arguments[n]) && (t = hn(e)) && (r && (r += " "), r += t);
	return r;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/excludeEventProps.js
var gn = /* @__PURE__ */ "dangerouslySetInnerHTML.onCopy.onCopyCapture.onCut.onCutCapture.onPaste.onPasteCapture.onCompositionEnd.onCompositionEndCapture.onCompositionStart.onCompositionStartCapture.onCompositionUpdate.onCompositionUpdateCapture.onFocus.onFocusCapture.onBlur.onBlurCapture.onChange.onChangeCapture.onBeforeInput.onBeforeInputCapture.onInput.onInputCapture.onReset.onResetCapture.onSubmit.onSubmitCapture.onInvalid.onInvalidCapture.onLoad.onLoadCapture.onError.onErrorCapture.onKeyDown.onKeyDownCapture.onKeyPress.onKeyPressCapture.onKeyUp.onKeyUpCapture.onAbort.onAbortCapture.onCanPlay.onCanPlayCapture.onCanPlayThrough.onCanPlayThroughCapture.onDurationChange.onDurationChangeCapture.onEmptied.onEmptiedCapture.onEncrypted.onEncryptedCapture.onEnded.onEndedCapture.onLoadedData.onLoadedDataCapture.onLoadedMetadata.onLoadedMetadataCapture.onLoadStart.onLoadStartCapture.onPause.onPauseCapture.onPlay.onPlayCapture.onPlaying.onPlayingCapture.onProgress.onProgressCapture.onRateChange.onRateChangeCapture.onSeeked.onSeekedCapture.onSeeking.onSeekingCapture.onStalled.onStalledCapture.onSuspend.onSuspendCapture.onTimeUpdate.onTimeUpdateCapture.onVolumeChange.onVolumeChangeCapture.onWaiting.onWaitingCapture.onAuxClick.onAuxClickCapture.onClick.onClickCapture.onContextMenu.onContextMenuCapture.onDoubleClick.onDoubleClickCapture.onDrag.onDragCapture.onDragEnd.onDragEndCapture.onDragEnter.onDragEnterCapture.onDragExit.onDragExitCapture.onDragLeave.onDragLeaveCapture.onDragOver.onDragOverCapture.onDragStart.onDragStartCapture.onDrop.onDropCapture.onMouseDown.onMouseDownCapture.onMouseEnter.onMouseLeave.onMouseMove.onMouseMoveCapture.onMouseOut.onMouseOutCapture.onMouseOver.onMouseOverCapture.onMouseUp.onMouseUpCapture.onSelect.onSelectCapture.onTouchCancel.onTouchCancelCapture.onTouchEnd.onTouchEndCapture.onTouchMove.onTouchMoveCapture.onTouchStart.onTouchStartCapture.onPointerDown.onPointerDownCapture.onPointerMove.onPointerMoveCapture.onPointerUp.onPointerUpCapture.onPointerCancel.onPointerCancelCapture.onPointerEnter.onPointerEnterCapture.onPointerLeave.onPointerLeaveCapture.onPointerOver.onPointerOverCapture.onPointerOut.onPointerOutCapture.onGotPointerCapture.onGotPointerCaptureCapture.onLostPointerCapture.onLostPointerCaptureCapture.onScroll.onScrollCapture.onWheel.onWheelCapture.onAnimationStart.onAnimationStartCapture.onAnimationEnd.onAnimationEndCapture.onAnimationIteration.onAnimationIterationCapture.onTransitionEnd.onTransitionEndCapture".split(".");
function _n(e) {
	return typeof e == "string" && gn.includes(e);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/svgPropertiesNoEvents.js
var vn = /* @__PURE__ */ new Set(/* @__PURE__ */ "aria-activedescendant.aria-atomic.aria-autocomplete.aria-busy.aria-checked.aria-colcount.aria-colindex.aria-colspan.aria-controls.aria-current.aria-describedby.aria-details.aria-disabled.aria-errormessage.aria-expanded.aria-flowto.aria-haspopup.aria-hidden.aria-invalid.aria-keyshortcuts.aria-label.aria-labelledby.aria-level.aria-live.aria-modal.aria-multiline.aria-multiselectable.aria-orientation.aria-owns.aria-placeholder.aria-posinset.aria-pressed.aria-readonly.aria-relevant.aria-required.aria-roledescription.aria-rowcount.aria-rowindex.aria-rowspan.aria-selected.aria-setsize.aria-sort.aria-valuemax.aria-valuemin.aria-valuenow.aria-valuetext.className.color.height.id.lang.max.media.method.min.name.style.target.width.role.tabIndex.accentHeight.accumulate.additive.alignmentBaseline.allowReorder.alphabetic.amplitude.arabicForm.ascent.attributeName.attributeType.autoReverse.azimuth.baseFrequency.baselineShift.baseProfile.bbox.begin.bias.by.calcMode.capHeight.clip.clipPath.clipPathUnits.clipRule.colorInterpolation.colorInterpolationFilters.colorProfile.colorRendering.contentScriptType.contentStyleType.cursor.cx.cy.d.decelerate.descent.diffuseConstant.direction.display.divisor.dominantBaseline.dur.dx.dy.edgeMode.elevation.enableBackground.end.exponent.externalResourcesRequired.fill.fillOpacity.fillRule.filter.filterRes.filterUnits.floodColor.floodOpacity.focusable.fontFamily.fontSize.fontSizeAdjust.fontStretch.fontStyle.fontVariant.fontWeight.format.from.fx.fy.g1.g2.glyphName.glyphOrientationHorizontal.glyphOrientationVertical.glyphRef.gradientTransform.gradientUnits.hanging.horizAdvX.horizOriginX.href.ideographic.imageRendering.in2.in.intercept.k1.k2.k3.k4.k.kernelMatrix.kernelUnitLength.kerning.keyPoints.keySplines.keyTimes.lengthAdjust.letterSpacing.lightingColor.limitingConeAngle.local.markerEnd.markerHeight.markerMid.markerStart.markerUnits.markerWidth.mask.maskContentUnits.maskUnits.mathematical.mode.numOctaves.offset.opacity.operator.order.orient.orientation.origin.overflow.overlinePosition.overlineThickness.paintOrder.panose1.pathLength.patternContentUnits.patternTransform.patternUnits.pointerEvents.pointsAtX.pointsAtY.pointsAtZ.preserveAlpha.preserveAspectRatio.primitiveUnits.r.radius.refX.refY.renderingIntent.repeatCount.repeatDur.requiredExtensions.requiredFeatures.restart.result.rotate.rx.ry.seed.shapeRendering.slope.spacing.specularConstant.specularExponent.speed.spreadMethod.startOffset.stdDeviation.stemh.stemv.stitchTiles.stopColor.stopOpacity.strikethroughPosition.strikethroughThickness.string.stroke.strokeDasharray.strokeDashoffset.strokeLinecap.strokeLinejoin.strokeMiterlimit.strokeOpacity.strokeWidth.surfaceScale.systemLanguage.tableValues.targetX.targetY.textAnchor.textDecoration.textLength.textRendering.to.transform.u1.u2.underlinePosition.underlineThickness.unicode.unicodeBidi.unicodeRange.unitsPerEm.vAlphabetic.values.vectorEffect.version.vertAdvY.vertOriginX.vertOriginY.vHanging.vIdeographic.viewTarget.visibility.vMathematical.widths.wordSpacing.writingMode.x1.x2.x.xChannelSelector.xHeight.xlinkActuate.xlinkArcrole.xlinkHref.xlinkRole.xlinkShow.xlinkTitle.xlinkType.xmlBase.xmlLang.xmlns.xmlnsXlink.xmlSpace.y1.y2.y.yChannelSelector.z.zoomAndPan.ref.key.angle".split("."));
function yn(e) {
	return typeof e == "string" && vn.has(e);
}
function bn(e) {
	return typeof e == "string" && e.startsWith("data-");
}
function xn(e) {
	if (typeof e != "object" || !e) return {};
	var t = {};
	for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (yn(n) || bn(n)) && (t[n] = e[n]);
	return t;
}
function Sn(e) {
	if (e == null) return null;
	if (/*#__PURE__*/ Be(e) && typeof e.props == "object" && e.props !== null) {
		var t = e.props;
		return xn(t);
	}
	return typeof e == "object" && !Array.isArray(e) ? xn(e) : null;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/svgPropertiesAndEvents.js
function Cn(e) {
	var t = {};
	for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (yn(n) || bn(n) || _n(n)) && (t[n] = e[n]);
	return t;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/container/Surface.js
var wn = [
	"children",
	"width",
	"height",
	"viewBox",
	"className",
	"style",
	"title",
	"desc"
];
function Tn() {
	return Tn = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, Tn.apply(null, arguments);
}
function En(e, t) {
	if (e == null) return {};
	var n, r, i = Dn(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Dn(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var On = /*#__PURE__*/ ze((e, t) => {
	var n = e.children, r = e.width, i = e.height, a = e.viewBox, o = e.className, s = e.style, c = e.title, l = e.desc, u = En(e, wn), d = a || {
		width: r,
		height: i,
		x: 0,
		y: 0
	}, f = z("recharts-surface", o);
	return /*#__PURE__*/ P.createElement("svg", Tn({}, Cn(u), {
		className: f,
		width: r,
		height: i,
		style: s,
		viewBox: `${d.x} ${d.y} ${d.width} ${d.height}`,
		ref: t
	}), /*#__PURE__*/ P.createElement("title", null, c), /*#__PURE__*/ P.createElement("desc", null, l), n);
}), kn = ["children", "className"];
function An() {
	return An = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, An.apply(null, arguments);
}
function jn(e, t) {
	if (e == null) return {};
	var n, r, i = Mn(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Mn(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var Nn = /*#__PURE__*/ P.forwardRef((e, t) => {
	var n = e.children, r = e.className, i = jn(e, kn), a = z("recharts-layer", r);
	return /*#__PURE__*/ P.createElement("g", An({ className: a }, Cn(i), { ref: t }), n);
}), Pn = /*#__PURE__*/ Le(null), Fn = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return e === "__proto__";
	}
	e.isUnsafeProperty = t;
})), In = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		switch (typeof e) {
			case "number":
			case "symbol": return !1;
			case "string": return e.includes(".") || e.includes("[") || e.includes("]");
		}
	}
	e.isDeepKey = t;
})), Ln = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return typeof e == "string" || typeof e == "symbol" ? e : Object.is(e?.valueOf?.(), -0) ? "-0" : String(e);
	}
	e.toKey = t;
})), Rn = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		if (e == null) return "";
		if (typeof e == "string") return e;
		if (Array.isArray(e)) return e.map(t).join(",");
		let n = String(e);
		return n === "0" && Object.is(Number(e), -0) ? "-0" : n;
	}
	e.toString = t;
})), zn = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Rn(), n = Ln();
	function r(e) {
		if (Array.isArray(e)) return e.map(n.toKey);
		if (typeof e == "symbol") return [e];
		e = t.toString(e);
		let r = [], i = e.length;
		if (i === 0) return r;
		let a = 0, o = "", s = "", c = !1;
		for (e.charCodeAt(0) === 46 && (r.push(""), a++); a < i;) {
			let t = e[a];
			s ? t === "\\" && a + 1 < i ? (a++, o += e[a]) : t === s ? s = "" : o += t : c ? t === "\"" || t === "'" ? s = t : t === "]" ? (c = !1, r.push(o), o = "") : o += t : t === "[" ? (c = !0, o &&= (r.push(o), "")) : t === "." ? o &&= (r.push(o), "") : o += t, a++;
		}
		return o && r.push(o), r;
	}
	e.toPath = r;
})), Bn = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Fn(), n = In(), r = Ln(), i = zn();
	function a(e, s, c) {
		if (e == null) return c;
		switch (typeof s) {
			case "string": {
				if (t.isUnsafeProperty(s)) return c;
				let r = e[s];
				return r === void 0 ? n.isDeepKey(s) ? a(e, i.toPath(s), c) : c : r;
			}
			case "number":
			case "symbol": {
				typeof s == "number" && (s = r.toKey(s));
				let t = e[s];
				return t === void 0 ? c : t;
			}
			default: {
				if (Array.isArray(s)) return o(e, s, c);
				if (s = Object.is(s?.valueOf(), -0) ? "-0" : String(s), t.isUnsafeProperty(s)) return c;
				let n = e[s];
				return n === void 0 ? c : n;
			}
		}
	}
	function o(e, n, r) {
		if (n.length === 0) return r;
		let i = e;
		for (let e = 0; e < n.length; e++) {
			if (i == null || t.isUnsafeProperty(n[e])) return r;
			i = i[n[e]];
		}
		return i === void 0 ? r : i;
	}
	e.get = a;
})), Vn = /* @__PURE__ */ n(((e, t) => {
	t.exports = Bn().get;
})), Hn = 4;
function Un(e) {
	var t = 10 ** (arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Hn), n = Math.round(e * t) / t;
	return Object.is(n, -0) ? 0 : n;
}
function Wn(e) {
	var t = [...arguments].slice(1);
	return e.reduce((e, n, r) => {
		var i = t[r - 1];
		return typeof i == "string" ? e + i + n : i === void 0 ? e + n : e + Un(i) + n;
	}, "");
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/DataUtils.js
var Gn = /* @__PURE__ */ e(Vn()), Kn = (e) => e === 0 ? 0 : e > 0 ? 1 : -1, qn = (e) => typeof e == "number" && e != +e, Jn = (e) => typeof e == "string" && e.length > 1 && e.indexOf("%") === e.length - 1, B = (e) => (typeof e == "number" || e instanceof Number) && !qn(e), Yn = (e) => B(e) || typeof e == "string", Xn = 0, Zn = (e) => {
	var t = ++Xn;
	return `${e || ""}${t}`;
}, Qn = function(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0, r = arguments.length > 3 && arguments[3] !== void 0 && arguments[3];
	if (!B(e) && typeof e != "string") return n;
	var i;
	if (Jn(e)) {
		if (t == null) return n;
		var a = e.indexOf("%");
		i = t * parseFloat(e.slice(0, a)) / 100;
	} else i = +e;
	return qn(i) && (i = n), r && t != null && i > t && (i = t), i;
}, $n = (e) => {
	if (!Array.isArray(e)) return !1;
	for (var t = e.length, n = {}, r = 0; r < t; r++) if (!n[String(e[r])]) n[String(e[r])] = !0;
	else return !0;
	return !1;
};
function er(e, t, n) {
	return B(e) && B(t) ? Un(e + n * (t - e)) : t;
}
function tr(e, t, n) {
	if (e && e.length) return e.find((e) => e && (typeof t == "function" ? t(e) : (0, Gn.default)(e, t)) === n);
}
var V = (e) => e == null, nr = (e) => V(e) ? e : `${e.charAt(0).toUpperCase()}${e.slice(1)}`;
function rr(e) {
	return e != null;
}
function ir() {}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/types.js
var ar = (e) => "radius" in e && "startAngle" in e && "endAngle" in e, or = (e, t) => {
	if (!e || typeof e == "function" || typeof e == "boolean") return null;
	var n = e;
	if (/*#__PURE__*/ Be(e) && (n = e.props), typeof n != "object" && typeof n != "function") return null;
	var r = {};
	return Object.keys(n).forEach((e) => {
		_n(e) && typeof n[e] == "function" && (r[e] = t || ((t) => n[e](n, t)));
	}), r;
}, sr = (e, t, n) => (r) => (e(t, n, r), null), cr = (e, t, n) => {
	if (e === null || typeof e != "object" && typeof e != "function") return null;
	var r = null;
	return Object.keys(e).forEach((i) => {
		var a = e[i];
		_n(i) && typeof a == "function" && (r ||= {}, r[i] = sr(a, t, n));
	}), r;
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/resolveDefaultProps.js
function lr(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function ur(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? lr(Object(n), !0).forEach(function(t) {
			dr(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : lr(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function dr(e, t, n) {
	return (t = fr(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function fr(e) {
	var t = pr(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function pr(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function mr(e, t) {
	var n = ur({}, e), r = t;
	return Object.keys(t).reduce((e, t) => (e[t] === void 0 && r[t] !== void 0 && (e[t] = r[t]), e), n);
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/array/uniqBy.js
var hr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e, t) {
		let n = /* @__PURE__ */ new Map();
		for (let r = 0; r < e.length; r++) {
			let i = e[r], a = t(i, r, e);
			n.has(a) || n.set(a, i);
		}
		return Array.from(n.values());
	}
	e.uniqBy = t;
})), gr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e, t) {
		return function(...n) {
			return e.apply(this, n.slice(0, t));
		};
	}
	e.ary = t;
})), _r = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return e;
	}
	e.identity = t;
})), vr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return Number.isSafeInteger(e) && e >= 0;
	}
	e.isLength = t;
})), yr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = vr();
	function n(e) {
		return e != null && typeof e != "function" && t.isLength(e.length);
	}
	e.isArrayLike = n;
})), br = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return typeof e == "object" && !!e;
	}
	e.isObjectLike = t;
})), xr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = yr(), n = br();
	function r(e) {
		return n.isObjectLike(e) && t.isArrayLike(e);
	}
	e.isArrayLikeObject = r;
})), Sr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Bn();
	function n(e) {
		return function(n) {
			return t.get(n, e);
		};
	}
	e.property = n;
})), Cr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return e !== null && (typeof e == "object" || typeof e == "function");
	}
	e.isObject = t;
})), wr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return e == null || typeof e != "object" && typeof e != "function";
	}
	e.isPrimitive = t;
})), Tr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e, t) {
		return e === t || Number.isNaN(e) && Number.isNaN(t);
	}
	e.isEqualsSameValueZero = t;
})), Er = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Cr(), n = wr(), r = Tr();
	function i(e, t, n) {
		return typeof n == "function" ? a(e, t, function e(t, r, i, o, s, c) {
			let l = n(t, r, i, o, s, c);
			return l === void 0 ? a(t, r, e, c) : !!l;
		}, /* @__PURE__ */ new Map()) : i(e, t, () => void 0);
	}
	function a(e, n, i, s) {
		if (n === e) return !0;
		switch (typeof n) {
			case "object": return o(e, n, i, s);
			case "function": return Object.keys(n).length > 0 ? a(e, { ...n }, i, s) : r.isEqualsSameValueZero(e, n);
			default: return t.isObject(e) ? typeof n != "string" || n === "" : r.isEqualsSameValueZero(e, n);
		}
	}
	function o(e, t, r, i) {
		if (t == null) return !0;
		if (Array.isArray(t)) return c(e, t, r, i);
		if (t instanceof Map) return s(e, t, r, i);
		if (t instanceof Set) return l(e, t, r, i);
		let a = Object.keys(t);
		if (e == null || n.isPrimitive(e)) return a.length === 0;
		if (a.length === 0) return !0;
		if (i?.has(t)) return i.get(t) === e;
		i?.set(t, e);
		try {
			for (let o = 0; o < a.length; o++) {
				let s = a[o];
				if (!n.isPrimitive(e) && !(s in e) || t[s] === void 0 && e[s] !== void 0 || t[s] === null && e[s] !== null || !r(e[s], t[s], s, e, t, i)) return !1;
			}
			return !0;
		} finally {
			i?.delete(t);
		}
	}
	function s(e, t, n, r) {
		if (t.size === 0) return !0;
		if (!(e instanceof Map)) return !1;
		for (let [i, a] of t.entries()) if (n(e.get(i), a, i, e, t, r) === !1) return !1;
		return !0;
	}
	function c(e, t, n, r) {
		if (t.length === 0) return !0;
		if (!Array.isArray(e)) return !1;
		let i = /* @__PURE__ */ new Set();
		for (let a = 0; a < t.length; a++) {
			let o = t[a], s = !1;
			for (let c = 0; c < e.length; c++) {
				if (i.has(c)) continue;
				let l = e[c], u = !1;
				if (n(l, o, a, e, t, r) && (u = !0), u) {
					i.add(c), s = !0;
					break;
				}
			}
			if (!s) return !1;
		}
		return !0;
	}
	function l(e, t, n, r) {
		return t.size === 0 || e instanceof Set && c([...e], [...t], n, r);
	}
	e.isMatchWith = i, e.isSetMatch = l;
})), Dr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Er();
	function n(e, n) {
		return t.isMatchWith(e, n, () => void 0);
	}
	e.isMatch = n;
})), Or = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return Object.getOwnPropertySymbols(e).filter((t) => Object.prototype.propertyIsEnumerable.call(e, t));
	}
	e.getSymbols = t;
})), kr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return e == null ? e === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(e);
	}
	e.getTag = t;
})), Ar = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }), e.argumentsTag = "[object Arguments]", e.arrayBufferTag = "[object ArrayBuffer]", e.arrayTag = "[object Array]", e.bigInt64ArrayTag = "[object BigInt64Array]", e.bigUint64ArrayTag = "[object BigUint64Array]", e.booleanTag = "[object Boolean]", e.dataViewTag = "[object DataView]", e.dateTag = "[object Date]", e.errorTag = "[object Error]", e.float32ArrayTag = "[object Float32Array]", e.float64ArrayTag = "[object Float64Array]", e.functionTag = "[object Function]", e.int16ArrayTag = "[object Int16Array]", e.int32ArrayTag = "[object Int32Array]", e.int8ArrayTag = "[object Int8Array]", e.mapTag = "[object Map]", e.numberTag = "[object Number]", e.objectTag = "[object Object]", e.regexpTag = "[object RegExp]", e.setTag = "[object Set]", e.stringTag = "[object String]", e.symbolTag = "[object Symbol]", e.uint16ArrayTag = "[object Uint16Array]", e.uint32ArrayTag = "[object Uint32Array]", e.uint8ArrayTag = "[object Uint8Array]", e.uint8ClampedArrayTag = "[object Uint8ClampedArray]";
})), jr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return ArrayBuffer.isView(e) && !(e instanceof DataView);
	}
	e.isTypedArray = t;
})), Mr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Or(), n = kr(), r = Ar(), i = wr(), a = jr();
	function o(e, t) {
		return s(e, void 0, e, /* @__PURE__ */ new Map(), t);
	}
	function s(e, t, n, r = /* @__PURE__ */ new Map(), o = void 0) {
		let u = o?.(e, t, n, r);
		if (u !== void 0) return u;
		if (i.isPrimitive(e)) return e;
		if (r.has(e)) return r.get(e);
		if (Array.isArray(e)) {
			let t = Array(e.length);
			r.set(e, t);
			for (let i = 0; i < e.length; i++) t[i] = s(e[i], i, n, r, o);
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
			for (let [i, a] of e) t.set(i, s(a, i, n, r, o));
			return t;
		}
		if (e instanceof Set) {
			let t = /* @__PURE__ */ new Set();
			r.set(e, t);
			for (let i of e) t.add(s(i, void 0, n, r, o));
			return t;
		}
		if (typeof Buffer < "u" && Buffer.isBuffer(e)) return e.subarray();
		if (a.isTypedArray(e)) {
			let t = new (Object.getPrototypeOf(e)).constructor(e.length);
			r.set(e, t);
			for (let i = 0; i < e.length; i++) t[i] = s(e[i], i, n, r, o);
			return t;
		}
		if (e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer) return e.slice(0);
		if (e instanceof DataView) {
			let t = new DataView(e.buffer.slice(0), e.byteOffset, e.byteLength);
			return r.set(e, t), c(t, e, n, r, o), t;
		}
		if (typeof File < "u" && e instanceof File) {
			let t = new File([e], e.name, { type: e.type });
			return r.set(e, t), c(t, e, n, r, o), t;
		}
		if (typeof Blob < "u" && e instanceof Blob) {
			let t = new Blob([e], { type: e.type });
			return r.set(e, t), c(t, e, n, r, o), t;
		}
		if (e instanceof Error) {
			let t = structuredClone(e);
			return r.set(e, t), t.message = e.message, t.name = e.name, t.stack = e.stack, t.cause = e.cause, t.constructor = e.constructor, c(t, e, n, r, o), t;
		}
		if (e instanceof Boolean) {
			let t = new Boolean(e.valueOf());
			return r.set(e, t), c(t, e, n, r, o), t;
		}
		if (e instanceof Number) {
			let t = new Number(e.valueOf());
			return r.set(e, t), c(t, e, n, r, o), t;
		}
		if (e instanceof String) {
			let t = new String(e.valueOf());
			return r.set(e, t), c(t, e, n, r, o), t;
		}
		if (typeof e == "object" && l(e)) {
			let t = Object.create(Object.getPrototypeOf(e));
			return r.set(e, t), c(t, e, n, r, o), t;
		}
		return e;
	}
	function c(e, n, r = e, i, a) {
		let o = [...Object.keys(n), ...t.getSymbols(n)];
		for (let t = 0; t < o.length; t++) {
			let c = o[t], l = Object.getOwnPropertyDescriptor(e, c);
			(l == null || l.writable) && (e[c] = s(n[c], c, r, i, a));
		}
	}
	function l(e) {
		switch (n.getTag(e)) {
			case r.argumentsTag:
			case r.arrayTag:
			case r.arrayBufferTag:
			case r.dataViewTag:
			case r.booleanTag:
			case r.dateTag:
			case r.float32ArrayTag:
			case r.float64ArrayTag:
			case r.int8ArrayTag:
			case r.int16ArrayTag:
			case r.int32ArrayTag:
			case r.mapTag:
			case r.numberTag:
			case r.objectTag:
			case r.regexpTag:
			case r.setTag:
			case r.stringTag:
			case r.symbolTag:
			case r.uint8ArrayTag:
			case r.uint8ClampedArrayTag:
			case r.uint16ArrayTag:
			case r.uint32ArrayTag: return !0;
			default: return !1;
		}
	}
	e.cloneDeepWith = o, e.cloneDeepWithImpl = s, e.copyProperties = c;
})), Nr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Mr();
	function n(e) {
		return t.cloneDeepWithImpl(e, void 0, e, /* @__PURE__ */ new Map(), void 0);
	}
	e.cloneDeep = n;
})), Pr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Dr(), n = Nr();
	function r(e) {
		return e = n.cloneDeep(e), (n) => t.isMatch(n, e);
	}
	e.matches = r;
})), Fr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Mr(), n = kr(), r = Ar();
	function i(e, i) {
		return t.cloneDeepWith(e, (a, o, s, c) => {
			let l = i?.(a, o, s, c);
			if (l !== void 0) return l;
			if (typeof e == "object") {
				if (n.getTag(e) === r.objectTag && typeof e.constructor != "function") {
					let n = {};
					return c.set(e, n), t.copyProperties(n, e, s, c), n;
				}
				switch (Object.prototype.toString.call(e)) {
					case r.numberTag:
					case r.stringTag:
					case r.booleanTag: {
						let n = new e.constructor(e?.valueOf());
						return t.copyProperties(n, e), n;
					}
					case r.argumentsTag: {
						let n = {};
						return t.copyProperties(n, e), n.length = e.length, n[Symbol.iterator] = e[Symbol.iterator], n;
					}
					default: return;
				}
			}
		});
	}
	e.cloneDeepWith = i;
})), Ir = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Fr();
	function n(e) {
		return t.cloneDeepWith(e);
	}
	e.cloneDeep = n;
})), Lr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = /^(?:0|[1-9]\d*)$/;
	function n(e, n = 2 ** 53 - 1) {
		switch (typeof e) {
			case "number": return Number.isInteger(e) && e >= 0 && e < n;
			case "symbol": return !1;
			case "string": return t.test(e);
		}
	}
	e.isIndex = n;
})), Rr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = kr();
	function n(e) {
		return typeof e == "object" && !!e && t.getTag(e) === "[object Arguments]";
	}
	e.isArguments = n;
})), zr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = In(), n = Lr(), r = Rr(), i = zn();
	function a(e, a) {
		let o;
		if (o = Array.isArray(a) ? a : typeof a == "string" && t.isDeepKey(a) && e?.[a] == null ? i.toPath(a) : [a], o.length === 0) return !1;
		let s = e;
		for (let e = 0; e < o.length; e++) {
			let t = o[e];
			if ((s == null || !Object.hasOwn(s, t)) && !((Array.isArray(s) || r.isArguments(s)) && n.isIndex(t) && t < s.length)) return !1;
			s = s[t];
		}
		return !0;
	}
	e.has = a;
})), Br = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Dr(), n = Ln(), r = Ir(), i = Bn(), a = zr();
	function o(e, o) {
		switch (typeof e) {
			case "object":
				Object.is(e?.valueOf(), -0) && (e = "-0");
				break;
			case "number": e = n.toKey(e);
		}
		return o = r.cloneDeep(o), function(n) {
			let r = i.get(n, e);
			return r === void 0 ? a.has(n, e) : o === void 0 ? r === void 0 : t.isMatch(r, o);
		};
	}
	e.matchesProperty = o;
})), Vr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = _r(), n = Sr(), r = Pr(), i = Br();
	function a(e) {
		if (e == null) return t.identity;
		switch (typeof e) {
			case "function": return e;
			case "object": return Array.isArray(e) && e.length === 2 ? i.matchesProperty(e[0], e[1]) : r.matches(e);
			case "string":
			case "symbol":
			case "number": return n.property(e);
		}
	}
	e.iteratee = a;
})), Hr = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = hr(), n = gr(), r = _r(), i = xr(), a = Vr();
	function o(e, o = r.identity) {
		return i.isArrayLikeObject(e) ? t.uniqBy(Array.from(e), n.ary(a.iteratee(o), 1)) : [];
	}
	e.uniqBy = o;
})), Ur = /* @__PURE__ */ e((/* @__PURE__ */ n(((e, t) => {
	t.exports = Hr().uniqBy;
})))());
function Wr(e, t, n) {
	return t === !0 ? (0, Ur.default)(e, n) : typeof t == "function" ? (0, Ur.default)(e, t) : e;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/RechartsReduxContext.js
var Gr = /*#__PURE__*/ Le(null), Kr = an(), qr = (e) => e, H = () => {
	var e = He(Gr);
	return e ? e.store.dispatch : qr;
}, Jr = () => {}, Yr = () => Jr, Xr = (e, t) => e === t;
function U(e) {
	var t = He(Gr), n = Ge(() => t ? (t) => {
		if (t != null) return e(t);
	} : Jr, [t, e]);
	return (0, Kr.useSyncExternalStoreWithSelector)(t ? t.subscription.addNestedSub : Yr, t ? t.store.getState : Jr, t ? t.store.getState : Jr, n, Xr);
}
// node_modules/.bun/reselect@5.2.0/node_modules/reselect/dist/reselect.mjs
function Zr(e, t = `expected a function, instead received ${typeof e}`) {
	if (typeof e != "function") throw TypeError(t);
}
function Qr(e, t = "expected all items to be functions, instead received the following types: ") {
	if (!e.every((e) => typeof e == "function")) {
		let n = e.map((e) => typeof e == "function" ? `function ${e.name || "unnamed"}()` : typeof e).join(", ");
		throw TypeError(`${t}[${n}]`);
	}
}
var $r = (e) => Array.isArray(e) ? e : [e];
function ei(e) {
	let t = Array.isArray(e[0]) ? e[0] : e;
	return Qr(t, "createSelector expects all input-selectors to be functions, but received the following types: "), t;
}
function ti(e, t) {
	let n = [], { length: r } = e;
	for (let i = 0; i < r; i++) n.push(e[i].apply(null, t));
	return n;
}
var ni = class {
	constructor(e) {
		this.value = e;
	}
	deref() {
		return this.value;
	}
}, ri = typeof WeakRef > "u" ? ni : WeakRef, ii = 0, ai = 1;
function oi() {
	return {
		s: ii,
		v: void 0,
		o: null,
		p: null
	};
}
function si(e) {
	return e instanceof ri ? e.deref() : e;
}
function ci(e, t = {}) {
	let n = oi(), { resultEqualityCheck: r } = t, i, a = 0;
	function o() {
		let t = n, { length: o } = arguments;
		for (let e = 0, n = o; e < n; e++) {
			let n = arguments[e];
			if (typeof n == "function" || typeof n == "object" && n) {
				let e = t.o;
				e === null && (t.o = e = /* @__PURE__ */ new WeakMap());
				let r = e.get(n);
				r === void 0 ? (t = oi(), e.set(n, t)) : t = r;
			} else {
				let e = t.p;
				e === null && (t.p = e = /* @__PURE__ */ new Map());
				let r = e.get(n);
				r === void 0 ? (t = oi(), e.set(n, t)) : t = r;
			}
		}
		let s = t, c;
		if (t.s === ai) c = t.v;
		else if (c = e.apply(null, arguments), a++, r) {
			let e = si(i);
			e != null && r(e, c) && (c = e, a !== 0 && a--), i = typeof c == "object" && c || typeof c == "function" ? /* @__PURE__ */ new ri(c) : c;
		}
		return s.s = ai, s.v = c, c;
	}
	return o.clearCache = () => {
		n = oi(), o.resetResultsCount();
	}, o.resultsCount = () => a, o.resetResultsCount = () => {
		a = 0;
	}, o;
}
function li(e, ...t) {
	let n = typeof e == "function" ? {
		memoize: e,
		memoizeOptions: t
	} : e, r = (...e) => {
		let t = 0, r = 0, i, a = {}, o = e.pop();
		typeof o == "object" && (a = o, o = e.pop()), Zr(o, `createSelector expects an output function after the inputs, but received: [${typeof o}]`);
		let { memoize: s, memoizeOptions: c = [], argsMemoize: l = ci, argsMemoizeOptions: u = [] } = {
			...n,
			...a
		}, d = $r(c), f = $r(u), p = ei(e), m = s(function() {
			return t++, o.apply(null, arguments);
		}, ...d), h = l(function() {
			r++;
			let e = ti(p, arguments);
			return i = m.apply(null, e), i;
		}, ...f);
		return Object.assign(h, {
			resultFunc: o,
			memoizedResultFunc: m,
			dependencies: p,
			dependencyRecomputations: () => r,
			resetDependencyRecomputations: () => {
				r = 0;
			},
			lastResult: () => i,
			recomputations: () => t,
			resetRecomputations: () => {
				t = 0;
			},
			memoize: s,
			argsMemoize: l
		});
	};
	return Object.assign(r, { withTypes: () => r }), r;
}
var W = /* @__PURE__ */ li(ci), ui = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return typeof e == "symbol" ? 1 : e === null ? 2 : e === void 0 ? 3 : e === e ? 0 : 4;
	}
	e.compareValues = (e, n, r) => {
		if (e !== n) {
			let i = t(e), a = t(n);
			if (i === a && i === 0) {
				if (e < n) return r === "desc" ? 1 : -1;
				if (e > n) return r === "desc" ? -1 : 1;
			}
			return r === "desc" ? a - i : i - a;
		}
		return 0;
	};
})), di = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e) {
		return typeof e == "symbol" || e instanceof Symbol;
	}
	e.isSymbol = t;
})), fi = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = di(), n = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, r = /^\w*$/;
	function i(e, i) {
		return Array.isArray(e) ? !1 : typeof e == "number" || typeof e == "boolean" || e == null || t.isSymbol(e) ? !0 : typeof e == "string" && (r.test(e) || !n.test(e)) || i != null && Object.hasOwn(i, e);
	}
	e.isKey = i;
})), pi = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = ui(), n = fi(), r = zn();
	function i(e, i, a, o) {
		if (e == null) return [];
		a = o ? void 0 : a, Array.isArray(e) || (e = Object.values(e)), Array.isArray(i) || (i = i == null ? [null] : [i]), i.length === 0 && (i = [null]), Array.isArray(a) || (a = a == null ? [] : [a]), a = a.map((e) => String(e));
		let s = (e, t) => {
			let n = e;
			for (let e = 0; e < t.length && n != null; ++e) n = n[t[e]];
			return n;
		}, c = (e, t) => t == null || e == null ? t : typeof e == "object" && "key" in e ? Object.hasOwn(t, e.key) ? t[e.key] : s(t, e.path) : typeof e == "function" ? e(t) : Array.isArray(e) ? s(t, e) : typeof t == "object" ? t[e] : t, l = i.map((e) => (Array.isArray(e) && e.length === 1 && (e = e[0]), e == null || typeof e == "function" || Array.isArray(e) || n.isKey(e) ? e : {
			key: e,
			path: r.toPath(e)
		}));
		return e.map((e) => ({
			original: e,
			criteria: l.map((t) => c(t, e))
		})).slice().sort((e, n) => {
			for (let r = 0; r < l.length; r++) {
				let i = t.compareValues(e.criteria[r], n.criteria[r], a[r]);
				if (i !== 0) return i;
			}
			return 0;
		}).map((e) => e.original);
	}
	e.orderBy = i;
})), mi = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	function t(e, t = 1) {
		let n = [], r = Math.floor(t), i = (e, t) => {
			for (let a = 0; a < e.length; a++) {
				let o = e[a];
				Array.isArray(o) && t < r ? i(o, t + 1) : n.push(o);
			}
		};
		return i(e, 0), n;
	}
	e.flatten = t;
})), hi = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = Lr(), n = yr(), r = Cr(), i = Tr();
	function a(e, a, o) {
		return r.isObject(o) && (typeof a == "number" && n.isArrayLike(o) && t.isIndex(a) && a < o.length || typeof a == "string" && a in o) ? i.isEqualsSameValueZero(o[a], e) : !1;
	}
	e.isIterateeCall = a;
})), gi = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = pi(), n = mi(), r = hi();
	function i(e, ...i) {
		let a = i.length;
		return a > 1 && r.isIterateeCall(e, i[0], i[1]) ? i = [] : a > 2 && r.isIterateeCall(i[0], i[1], i[2]) && (i = [i[0]]), t.orderBy(e, n.flatten(i), ["asc"]);
	}
	e.sortBy = i;
})), _i = /* @__PURE__ */ e((/* @__PURE__ */ n(((e, t) => {
	t.exports = gi().sortBy;
})))()), vi = (e) => e.legend.settings, yi = (e) => e.legend.size;
W([(e) => e.legend.payload, vi], (e, t) => {
	var n = t.itemSorter, r = e.flat(1);
	return n ? (0, _i.default)(r, n) : r;
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/useElementOffset.js
function bi(e, t) {
	return Ti(e) || wi(e, t) || Si(e, t) || xi();
}
function xi() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Si(e, t) {
	if (e) {
		if (typeof e == "string") return Ci(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? Ci(e, t) : void 0;
	}
}
function Ci(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function wi(e, t) {
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
function Ti(e) {
	if (Array.isArray(e)) return e;
}
var Ei = 1;
function Di(e, t) {
	return Math.abs(e.height - t.height) > Ei || Math.abs(e.left - t.left) > Ei || Math.abs(e.top - t.top) > Ei || Math.abs(e.width - t.width) > Ei;
}
function Oi(e) {
	var t = e.getBoundingClientRect();
	return {
		height: t.height,
		left: t.left,
		top: t.top,
		width: t.width
	};
}
function ki() {
	var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [], t = bi(Ke({
		height: 0,
		left: 0,
		top: 0,
		width: 0
	}), 2), n = t[0], r = t[1], i = L(null), a = L(n);
	a.current = n;
	var o = F((e) => {
		if (i.current != null && (i.current.disconnect(), i.current = null), e != null) {
			var t = Oi(e);
			if (Di(t, a.current) && r(t), typeof ResizeObserver < "u") {
				var n = new ResizeObserver(() => {
					var t = Oi(e);
					Di(t, a.current) && r(t);
				});
				n.observe(e), i.current = n;
			}
		}
	}, [...e]);
	return I(() => () => {
		var e;
		(e = i.current) == null || e.disconnect();
	}, []), [n, o];
}
// node_modules/.bun/redux@5.0.1/node_modules/redux/dist/redux.mjs
function Ai(e) {
	return `Minified Redux error #${e}; visit https://redux.js.org/Errors?code=${e} for the full message or use the non-minified dev environment for full errors. `;
}
var ji = typeof Symbol == "function" && Symbol.observable || "@@observable", Mi = () => Math.random().toString(36).substring(7).split("").join("."), Ni = {
	INIT: `@@redux/INIT${/* @__PURE__ */ Mi()}`,
	REPLACE: `@@redux/REPLACE${/* @__PURE__ */ Mi()}`,
	PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${Mi()}`
};
function Pi(e) {
	if (typeof e != "object" || !e) return !1;
	let t = e;
	for (; Object.getPrototypeOf(t) !== null;) t = Object.getPrototypeOf(t);
	return Object.getPrototypeOf(e) === t || Object.getPrototypeOf(e) === null;
}
function Fi(e, t, n) {
	if (typeof e != "function") throw Error(Ai(2));
	if (typeof t == "function" && typeof n == "function" || typeof n == "function" && typeof arguments[3] == "function") throw Error(Ai(0));
	if (typeof t == "function" && n === void 0 && (n = t, t = void 0), n !== void 0) {
		if (typeof n != "function") throw Error(Ai(1));
		return n(Fi)(e, t);
	}
	let r = e, i = t, a = /* @__PURE__ */ new Map(), o = a, s = 0, c = !1;
	function l() {
		o === a && (o = /* @__PURE__ */ new Map(), a.forEach((e, t) => {
			o.set(t, e);
		}));
	}
	function u() {
		if (c) throw Error(Ai(3));
		return i;
	}
	function d(e) {
		if (typeof e != "function") throw Error(Ai(4));
		if (c) throw Error(Ai(5));
		let t = !0;
		l();
		let n = s++;
		return o.set(n, e), function() {
			if (t) {
				if (c) throw Error(Ai(6));
				t = !1, l(), o.delete(n), a = null;
			}
		};
	}
	function f(e) {
		if (!Pi(e)) throw Error(Ai(7));
		if (e.type === void 0) throw Error(Ai(8));
		if (typeof e.type != "string") throw Error(Ai(17));
		if (c) throw Error(Ai(9));
		try {
			c = !0, i = r(i, e);
		} finally {
			c = !1;
		}
		return (a = o).forEach((e) => {
			e();
		}), e;
	}
	function p(e) {
		if (typeof e != "function") throw Error(Ai(10));
		r = e, f({ type: Ni.REPLACE });
	}
	function m() {
		let e = d;
		return {
			subscribe(t) {
				if (typeof t != "object" || !t) throw Error(Ai(11));
				function n() {
					let e = t;
					e.next && e.next(u());
				}
				return n(), { unsubscribe: e(n) };
			},
			[ji]() {
				return this;
			}
		};
	}
	return f({ type: Ni.INIT }), {
		dispatch: f,
		subscribe: d,
		getState: u,
		replaceReducer: p,
		[ji]: m
	};
}
function Ii(e) {
	Object.keys(e).forEach((t) => {
		let n = e[t];
		if (n(void 0, { type: Ni.INIT }) === void 0) throw Error(Ai(12));
		if (n(void 0, { type: Ni.PROBE_UNKNOWN_ACTION() }) === void 0) throw Error(Ai(13));
	});
}
function Li(e) {
	let t = Object.keys(e), n = {};
	for (let r = 0; r < t.length; r++) {
		let i = t[r];
		typeof e[i] == "function" && (n[i] = e[i]);
	}
	let r = Object.keys(n), i;
	try {
		Ii(n);
	} catch (e) {
		i = e;
	}
	return function(e = {}, t) {
		if (i) throw i;
		let a = !1, o = {};
		for (let i = 0; i < r.length; i++) {
			let s = r[i], c = n[s], l = e[s], u = c(l, t);
			if (u === void 0) throw t && t.type, Error(Ai(14));
			o[s] = u, a ||= u !== l;
		}
		return a ||= r.length !== Object.keys(e).length, a ? o : e;
	};
}
function Ri(...e) {
	return e.length === 0 ? (e) => e : e.length === 1 ? e[0] : e.reduce((e, t) => (...n) => e(t(...n)));
}
function zi(...e) {
	return (t) => (n, r) => {
		let i = t(n, r), a = () => {
			throw Error(Ai(15));
		}, o = {
			getState: i.getState,
			dispatch: (e, ...t) => a(e, ...t)
		};
		return a = Ri(...e.map((e) => e(o)))(i.dispatch), {
			...i,
			dispatch: a
		};
	};
}
function Bi(e) {
	return Pi(e) && "type" in e && typeof e.type == "string";
}
// node_modules/.bun/immer@11.1.11/node_modules/immer/dist/immer.mjs
var Vi = Symbol.for("immer-nothing"), Hi = Symbol.for("immer-draftable"), Ui = Symbol.for("immer-state");
function Wi(e, ...t) {
	throw Error(`[Immer] minified error nr: ${e}. Full error at: https://bit.ly/3cXEKWf`);
}
var Gi = Object, Ki = Gi.getPrototypeOf, qi = "constructor", Ji = "prototype", Yi = "configurable", Xi = "enumerable", Zi = "writable", Qi = "value", $i = (e) => !!e && !!e[Ui];
function ea(e) {
	return e ? ra(e) || ua(e) || !!e[Hi] || !!e[qi]?.[Hi] || da(e) || fa(e) : !1;
}
var ta = Gi[Ji][qi].toString(), na = /* @__PURE__ */ new WeakMap();
function ra(e) {
	if (!e || !pa(e)) return !1;
	let t = Ki(e);
	if (t === null || t === Gi[Ji]) return !0;
	let n = Gi.hasOwnProperty.call(t, qi) && t[qi];
	if (n === Object) return !0;
	if (!ma(n)) return !1;
	let r = na.get(n);
	return r === void 0 && (r = Function.toString.call(n), na.set(n, r)), r === ta;
}
function ia(e, t, n = !0) {
	aa(e) === 0 ? (n ? Reflect.ownKeys(e) : Gi.keys(e)).forEach((n) => {
		t(n, e[n], e);
	}) : e.forEach((n, r) => t(r, n, e));
}
function aa(e) {
	let t = e[Ui];
	return t ? t.type_ : ua(e) ? 1 : da(e) ? 2 : fa(e) ? 3 : 0;
}
var oa = (e, t, n = aa(e)) => n === 2 ? e.has(t) : Gi[Ji].hasOwnProperty.call(e, t), sa = (e, t, n = aa(e)) => n === 2 ? e.get(t) : e[t], ca = (e, t, n, r = aa(e)) => {
	r === 2 ? e.set(t, n) : r === 3 ? e.add(n) : e[t] = n;
};
function la(e, t) {
	return e === t ? e !== 0 || 1 / e == 1 / t : e !== e && t !== t;
}
var ua = Array.isArray, da = (e) => e instanceof Map, fa = (e) => e instanceof Set, pa = (e) => typeof e == "object", ma = (e) => typeof e == "function", ha = (e) => typeof e == "boolean";
function ga(e) {
	let t = +e;
	return Number.isInteger(t) && String(t) === e;
}
var _a = (e) => e.copy_ || e.base_, va = (e) => e.modified_ ? e.copy_ : e.base_;
function ya(e, t) {
	if (da(e)) return new Map(e);
	if (fa(e)) return new Set(e);
	if (ua(e)) return Array[Ji].slice.call(e);
	let n = ra(e);
	if (t === !0 || t === "class_only" && !n) {
		let t = Gi.getOwnPropertyDescriptors(e);
		delete t[Ui];
		let n = Reflect.ownKeys(t);
		for (let r = 0; r < n.length; r++) {
			let i = n[r], a = t[i];
			a[Zi] === !1 && (a[Zi] = !0, a[Yi] = !0), (a.get || a.set) && (t[i] = {
				[Yi]: !0,
				[Zi]: !0,
				[Xi]: a[Xi],
				[Qi]: e[i]
			});
		}
		return Gi.create(Ki(e), t);
	}
	{
		let t = Ki(e);
		if (t !== null && n) return { ...e };
		let r = Gi.create(t);
		return Gi.assign(r, e);
	}
}
function ba(e, t = !1) {
	return Ca(e) || $i(e) || !ea(e) || (aa(e) > 1 && Gi.defineProperties(e, {
		set: Sa,
		add: Sa,
		clear: Sa,
		delete: Sa
	}), Gi.freeze(e), t && ia(e, (e, t) => {
		ba(t, !0);
	}, !1)), e;
}
function xa() {
	Wi(2);
}
var Sa = { [Qi]: xa };
function Ca(e) {
	return e === null || !pa(e) || Gi.isFrozen(e);
}
var wa = "MapSet", Ta = "Patches", Ea = "ArrayMethods", Da = {};
function Oa(e) {
	let t = Da[e];
	return t || Wi(0, e), t;
}
var ka = (e) => !!Da[e], Aa, ja = () => Aa, Ma = (e, t) => ({
	drafts_: [],
	parent_: e,
	immer_: t,
	canAutoFreeze_: !0,
	unfinalizedDrafts_: 0,
	handledSet_: /* @__PURE__ */ new Set(),
	processedForPatches_: /* @__PURE__ */ new Set(),
	mapSetPlugin_: ka(wa) ? Oa(wa) : void 0,
	arrayMethodsPlugin_: ka(Ea) ? Oa(Ea) : void 0
});
function Na(e, t) {
	t && (e.patchPlugin_ = Oa(Ta), e.patches_ = [], e.inversePatches_ = [], e.patchListener_ = t);
}
function Pa(e) {
	Fa(e), e.drafts_.forEach(La), e.drafts_ = null;
}
function Fa(e) {
	e === Aa && (Aa = e.parent_);
}
var Ia = (e) => Aa = Ma(Aa, e);
function La(e) {
	let t = e[Ui];
	t.type_ === 0 || t.type_ === 1 ? t.revoke_() : t.revoked_ = !0;
}
function Ra(e, t) {
	t.unfinalizedDrafts_ = t.drafts_.length;
	let n = t.drafts_[0];
	if (e !== void 0 && e !== n) {
		n[Ui].modified_ && (Pa(t), Wi(4)), ea(e) && (e = za(t, e));
		let { patchPlugin_: r } = t;
		r && r.generateReplacementPatches_(n[Ui].base_, e, t);
	} else e = za(t, n);
	return Ba(t, e, !0), Pa(t), t.patches_ && t.patchListener_(t.patches_, t.inversePatches_), e === Vi ? void 0 : e;
}
function za(e, t) {
	if (Ca(t)) return t;
	let n = t[Ui];
	if (!n) return Ja(t, e.handledSet_, e);
	if (!Ha(n, e)) return t;
	if (!n.modified_) return n.base_;
	if (!n.finalized_) {
		let { callbacks_: t } = n;
		if (t) for (; t.length > 0;) t.pop()(e);
		Ka(n, e);
	}
	return n.copy_;
}
function Ba(e, t, n = !1) {
	!e.parent_ && e.immer_.autoFreeze_ && e.canAutoFreeze_ && ba(t, n);
}
function Va(e) {
	e.finalized_ = !0, e.scope_.unfinalizedDrafts_--;
}
var Ha = (e, t) => e.scope_ === t, Ua = [];
function Wa(e, t, n, r) {
	let i = _a(e), a = e.type_;
	if (r !== void 0 && sa(i, r, a) === t) {
		ca(i, r, n, a);
		return;
	}
	if (!e.draftLocations_) {
		let t = e.draftLocations_ = /* @__PURE__ */ new Map();
		ia(i, (e, n) => {
			if ($i(n)) {
				let r = t.get(n) || [];
				r.push(e), t.set(n, r);
			}
		});
	}
	let o = e.draftLocations_.get(t) ?? Ua;
	for (let e of o) ca(i, e, n, a);
}
function Ga(e, t, n) {
	e.callbacks_.push(function(r) {
		let i = t;
		if (!i || !Ha(i, r)) return;
		r.mapSetPlugin_?.fixSetContents(i);
		let a = va(i);
		Wa(e, i.draft_ ?? i, a, n), Ka(i, r);
	});
}
function Ka(e, t) {
	if (e.modified_ && !e.finalized_ && (e.type_ === 3 || e.type_ === 1 && e.allIndicesReassigned_ || (e.assigned_?.size ?? 0) > 0)) {
		let { patchPlugin_: n } = t;
		if (n) {
			let r = n.getPath(e);
			r && n.generatePatches_(e, r, t);
		}
		Va(e);
	}
}
function qa(e, t, n) {
	let { scope_: r } = e;
	if ($i(n)) {
		let i = n[Ui];
		Ha(i, r) && i.callbacks_.push(function() {
			no(e), Wa(e, n, va(i), t);
		});
	} else ea(n) && e.callbacks_.push(function() {
		let i = _a(e);
		e.type_ === 3 ? i.has(n) && Ja(n, r.handledSet_, r) : sa(i, t, e.type_) === n && r.drafts_.length > 1 && (e.assigned_.get(t) ?? !1) === !0 && e.copy_ && Ja(sa(e.copy_, t, e.type_), r.handledSet_, r);
	});
}
function Ja(e, t, n) {
	return !n.immer_.autoFreeze_ && n.unfinalizedDrafts_ < 1 || $i(e) || t.has(e) || !ea(e) || Ca(e) || (t.add(e), ia(e, (r, i) => {
		if ($i(i)) {
			let t = i[Ui];
			Ha(t, n) && (ca(e, r, va(t), e.type_), Va(t));
		} else ea(i) && Ja(i, t, n);
	})), e;
}
function Ya(e, t) {
	let n = ua(e), r = {
		type_: +!!n,
		scope_: t ? t.scope_ : ja(),
		modified_: !1,
		finalized_: !1,
		assigned_: void 0,
		parent_: t,
		base_: e,
		draft_: null,
		copy_: null,
		revoke_: null,
		isManual_: !1,
		callbacks_: void 0
	}, i = r, a = Xa;
	n && (i = [r], a = Za);
	let { revoke: o, proxy: s } = Proxy.revocable(i, a);
	return r.draft_ = s, r.revoke_ = o, [s, r];
}
var Xa = {
	get(e, t) {
		if (t === Ui) return e;
		if (t === "constructor" || t === "__proto__") {
			let n = _a(e)[t];
			return new Proxy(n || {}, {
				get: (e, t) => t === "__proto__" || t === "prototype" ? Object.freeze(/* @__PURE__ */ Object.create(null)) : Reflect.get(e, t),
				set: () => !0,
				apply: (e, t, n) => Reflect.apply(e, t, n)
			});
		}
		let n = e.scope_.arrayMethodsPlugin_, r = e.type_ === 1 && typeof t == "string";
		if (r && n?.isArrayOperationMethod(t)) return n.createMethodInterceptor(e, t);
		let i = _a(e);
		if (!oa(i, t, e.type_)) return $a(e, i, t);
		let a = i[t];
		if (e.finalized_ || !ea(a) || r && e.operationMethod && n?.isMutatingArrayMethod(e.operationMethod) && ga(t)) return a;
		if (a === Qa(e.base_, t)) {
			no(e);
			let n = e.type_ === 1 ? +t : t, r = io(e.scope_, a, e, n);
			return e.copy_[n] = r;
		}
		return a;
	},
	has(e, t) {
		return t === "constructor" || t === "__proto__" || t === "prototype" ? !1 : t in _a(e);
	},
	ownKeys(e) {
		return Reflect.ownKeys(_a(e));
	},
	set(e, t, n) {
		if (t === "constructor" || t === "__proto__" || t === "prototype") return !0;
		let r = eo(_a(e), t);
		if (r?.set) return r.set.call(e.draft_, n), !0;
		if (!e.modified_) {
			let r = Qa(_a(e), t), i = r?.[Ui];
			if (i && i.base_ === n) return e.copy_[t] = n, e.assigned_.set(t, !1), !0;
			if (la(n, r) && (n !== void 0 || oa(e.base_, t, e.type_))) return !0;
			no(e), to(e);
		}
		return e.copy_[t] === n && (n !== void 0 || oa(e.copy_, t, e.type_)) || Number.isNaN(n) && Number.isNaN(e.copy_[t]) || (e.copy_[t] = n, e.assigned_.set(t, !0), qa(e, t, n)), !0;
	},
	deleteProperty(e, t) {
		return no(e), Qa(e.base_, t) !== void 0 || t in e.base_ ? (e.assigned_.set(t, !1), to(e)) : e.assigned_.delete(t), e.copy_ && delete e.copy_[t], !0;
	},
	getOwnPropertyDescriptor(e, t) {
		let n = _a(e), r = Reflect.getOwnPropertyDescriptor(n, t);
		return r && {
			[Zi]: !0,
			[Yi]: e.type_ !== 1 || t !== "length",
			[Xi]: r[Xi],
			[Qi]: n[t]
		};
	},
	defineProperty() {
		Wi(11);
	},
	getPrototypeOf(e) {
		return Ki(e.base_);
	},
	setPrototypeOf() {
		Wi(12);
	}
}, Za = {};
for (let e in Xa) {
	let t = Xa[e];
	Za[e] = function() {
		let e = arguments;
		return e[0] = e[0][0], t.apply(this, e);
	};
}
Za.deleteProperty = function(e, t) {
	return Za.set.call(this, e, t, void 0);
}, Za.set = function(e, t, n) {
	return Xa.set.call(this, e[0], t, n, e[0]);
};
function Qa(e, t) {
	let n = e[Ui];
	return (n ? _a(n) : e)[t];
}
function $a(e, t, n) {
	let r = eo(t, n);
	return r ? Qi in r ? r[Qi] : r.get?.call(e.draft_) : void 0;
}
function eo(e, t) {
	if (!(t in e)) return;
	let n = Ki(e);
	for (; n;) {
		let e = Object.getOwnPropertyDescriptor(n, t);
		if (e) return e;
		n = Ki(n);
	}
}
function to(e) {
	e.modified_ || (e.modified_ = !0, e.parent_ && to(e.parent_));
}
function no(e) {
	e.copy_ ||= (e.assigned_ = /* @__PURE__ */ new Map(), ya(e.base_, e.scope_.immer_.useStrictShallowCopy_));
}
var ro = class {
	constructor(e) {
		this.autoFreeze_ = !0, this.useStrictShallowCopy_ = !1, this.useStrictIteration_ = !1, this.produce = (e, t, n) => {
			if (ma(e) && !ma(t)) {
				let n = t;
				t = e;
				let r = this;
				return function(e = n, ...i) {
					return r.produce(e, (e) => t.call(this, e, ...i));
				};
			}
			ma(t) || Wi(6), n !== void 0 && !ma(n) && Wi(7);
			let r;
			if (ea(e)) {
				let i = Ia(this), a = io(i, e, void 0), o = !0;
				try {
					r = t(a), o = !1;
				} finally {
					o ? Pa(i) : Fa(i);
				}
				return Na(i, n), Ra(r, i);
			}
			if (!e || !pa(e)) {
				if (r = t(e), r === void 0 && (r = e), r === Vi && (r = void 0), this.autoFreeze_ && ba(r, !0), n) {
					let t = [], i = [];
					Oa(Ta).generateReplacementPatches_(e, r, {
						patches_: t,
						inversePatches_: i
					}), n(t, i);
				}
				return r;
			}
			Wi(1, e);
		}, this.produceWithPatches = (e, t) => {
			if (ma(e)) return (t, ...n) => this.produceWithPatches(t, (t) => e(t, ...n));
			let n, r;
			return [
				this.produce(e, t, (e, t) => {
					n = e, r = t;
				}),
				n,
				r
			];
		}, ha(e?.autoFreeze) && this.setAutoFreeze(e.autoFreeze), ha(e?.useStrictShallowCopy) && this.setUseStrictShallowCopy(e.useStrictShallowCopy), ha(e?.useStrictIteration) && this.setUseStrictIteration(e.useStrictIteration);
	}
	createDraft(e) {
		ea(e) || Wi(8), $i(e) && (e = ao(e));
		let t = Ia(this), n = io(t, e, void 0);
		return n[Ui].isManual_ = !0, Fa(t), n;
	}
	finishDraft(e, t) {
		let n = e && e[Ui];
		n && n.isManual_ || Wi(9);
		let { scope_: r } = n;
		return Na(r, t), Ra(void 0, r);
	}
	setAutoFreeze(e) {
		this.autoFreeze_ = e;
	}
	setUseStrictShallowCopy(e) {
		this.useStrictShallowCopy_ = e;
	}
	setUseStrictIteration(e) {
		this.useStrictIteration_ = e;
	}
	shouldUseStrictIteration() {
		return this.useStrictIteration_;
	}
	applyPatches(e, t) {
		let n;
		for (n = t.length - 1; n >= 0; n--) {
			let r = t[n];
			if (r.path.length === 0 && r.op === "replace") {
				e = r.value;
				break;
			}
		}
		n > -1 && (t = t.slice(n + 1));
		let r = Oa(Ta).applyPatches_;
		return $i(e) ? r(e, t) : this.produce(e, (e) => r(e, t));
	}
};
function io(e, t, n, r) {
	let [i, a] = da(t) ? Oa(wa).proxyMap_(t, n) : fa(t) ? Oa(wa).proxySet_(t, n) : Ya(t, n);
	return (n?.scope_ ?? ja()).drafts_.push(i), a.callbacks_ = n?.callbacks_ ?? [], a.key_ = r, n && r !== void 0 ? Ga(n, a, r) : a.callbacks_.push(function(e) {
		e.mapSetPlugin_?.fixSetContents(a);
		let { patchPlugin_: t } = e;
		a.modified_ && t && t.generatePatches_(a, [], e);
	}), i;
}
function ao(e) {
	return $i(e) || Wi(10, e), oo(e);
}
function oo(e) {
	if (!ea(e) || Ca(e)) return e;
	let t = e[Ui], n, r = !0;
	if (t) {
		if (!t.modified_) return t.base_;
		t.finalized_ = !0, n = ya(e, t.scope_.immer_.useStrictShallowCopy_), r = t.scope_.immer_.shouldUseStrictIteration();
	} else n = ya(e, !0);
	return ia(n, (e, t) => {
		ca(n, e, oo(t));
	}, r), t && (t.finalized_ = !1), n;
}
var so = new ro().produce, G = (e) => e;
// node_modules/.bun/redux-thunk@3.1.0+bc2e82c311c56ef9/node_modules/redux-thunk/dist/redux-thunk.mjs
function co(e) {
	return ({ dispatch: t, getState: n }) => (r) => (i) => typeof i == "function" ? i(t, n, e) : r(i);
}
var lo = co(), uo = co, fo = typeof window < "u" && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ : function() {
	if (arguments.length !== 0) return typeof arguments[0] == "object" ? Ri : Ri.apply(null, arguments);
};
typeof window < "u" && window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__;
function po(e, t) {
	function n(...n) {
		if (t) {
			let r = t(...n);
			if (!r) throw Error(xs(0));
			return {
				type: e,
				payload: r.payload,
				..."meta" in r && { meta: r.meta },
				..."error" in r && { error: r.error }
			};
		}
		return {
			type: e,
			payload: n[0]
		};
	}
	return n.toString = () => `${e}`, n.type = e, n.match = (t) => Bi(t) && t.type === e, n;
}
var mo = class e extends Array {
	constructor(...t) {
		super(...t), Object.setPrototypeOf(this, e.prototype);
	}
	static get [Symbol.species]() {
		return e;
	}
	concat(...e) {
		return super.concat.apply(this, e);
	}
	prepend(...t) {
		return t.length === 1 && Array.isArray(t[0]) ? new e(...t[0].concat(this)) : new e(...t.concat(this));
	}
};
function ho(e) {
	return ea(e) ? so(e, () => {}) : e;
}
function go(e, t, n) {
	return e.has(t) ? e.get(t) : e.set(t, n(t)).get(t);
}
function _o(e) {
	return typeof e == "boolean";
}
var vo = () => function(e) {
	let { thunk: t = !0, immutableCheck: n = !0, serializableCheck: r = !0, actionCreatorCheck: i = !0 } = e ?? {}, a = new mo();
	return t && (_o(t) ? a.push(lo) : a.push(uo(t.extraArgument))), a;
}, yo = "RTK_autoBatch", K = () => (e) => ({
	payload: e,
	meta: { [yo]: !0 }
}), bo = (e) => (t) => {
	setTimeout(t, e);
}, xo = (e, t) => (n) => {
	let r = !1, i = () => {
		r || (r = !0, cancelAnimationFrame(a), clearTimeout(o), n());
	}, a = e(i), o = setTimeout(i, t);
}, So = (e = { type: "raf" }) => (t) => (...n) => {
	let r = t(...n), i = !0, a = !1, o = !1, s = /* @__PURE__ */ new Set(), c = e.type === "tick" ? queueMicrotask : e.type === "raf" ? typeof window < "u" && window.requestAnimationFrame ? xo(window.requestAnimationFrame, 100) : bo(10) : e.type === "callback" ? e.queueNotification : bo(e.timeout), l = () => {
		o = !1, a && (a = !1, s.forEach((e) => e()));
	};
	return Object.assign({}, r, {
		subscribe(e) {
			let t = r.subscribe(() => i && e());
			return s.add(e), () => {
				t(), s.delete(e);
			};
		},
		dispatch(e) {
			try {
				return i = !e?.meta?.[yo], a = !i, a && (o || (o = !0, c(l))), r.dispatch(e);
			} finally {
				i = !0;
			}
		}
	});
}, Co = (e) => function(t) {
	let { autoBatch: n = !0 } = t ?? {}, r = new mo(e);
	return n && r.push(So(typeof n == "object" ? n : void 0)), r;
};
function wo(e) {
	let t = vo(), { reducer: n = void 0, middleware: r, devTools: i = !0, duplicateMiddlewareCheck: a = !0, preloadedState: o = void 0, enhancers: s = void 0 } = e || {}, c;
	if (typeof n == "function") c = n;
	else if (Pi(n)) c = Li(n);
	else throw Error(xs(1));
	let l;
	l = typeof r == "function" ? r(t) : t();
	let u = Ri;
	i && (u = fo({
		trace: !1,
		...typeof i == "object" && i
	}));
	let d = Co(zi(...l)), f = typeof s == "function" ? s(d) : d(), p = u(...f);
	return Fi(c, o, p);
}
function To(e) {
	let t = {}, n = [], r, i = {
		addCase(e, n) {
			let r = typeof e == "string" ? e : e.type;
			if (!r) throw Error(xs(28));
			if (r in t) throw Error(xs(29));
			return t[r] = n, i;
		},
		addAsyncThunk(e, r) {
			return r.pending && (t[e.pending.type] = r.pending), r.rejected && (t[e.rejected.type] = r.rejected), r.fulfilled && (t[e.fulfilled.type] = r.fulfilled), r.settled && n.push({
				matcher: e.settled,
				reducer: r.settled
			}), i;
		},
		addMatcher(e, t) {
			return n.push({
				matcher: e,
				reducer: t
			}), i;
		},
		addDefaultCase(e) {
			return r = e, i;
		}
	};
	return e(i), [
		t,
		n,
		r
	];
}
function Eo(e) {
	return typeof e == "function";
}
function Do(e, t) {
	let [n, r, i] = To(t), a;
	if (Eo(e)) a = () => ho(e());
	else {
		let t = ho(e);
		a = () => t;
	}
	function o(e = a(), t) {
		let o = [n[t.type], ...r.filter(({ matcher: e }) => e(t)).map(({ reducer: e }) => e)];
		return o.filter((e) => !!e).length === 0 && (o = [i]), o.reduce((e, n) => {
			if (n) {
				if ($i(e)) {
					let r = n(e, t);
					return r === void 0 ? e : r;
				}
				if (ea(e)) return so(e, (e) => n(e, t));
				{
					let r = n(e, t);
					if (r === void 0) {
						if (e === null) return e;
						throw Error("A case reducer on a non-draftable value must not return undefined");
					}
					return r;
				}
			}
			return e;
		}, e);
	}
	return o.getInitialState = a, o;
}
var Oo = "ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW", ko = (e = 21) => {
	let t = "", n = e;
	for (; n--;) t += Oo[Math.random() * 64 | 0];
	return t;
}, Ao = /* @__PURE__ */ Symbol.for("rtk-slice-createasyncthunk");
function jo(e, t) {
	return `${e}/${t}`;
}
function Mo({ creators: e } = {}) {
	let t = e?.asyncThunk?.[Ao];
	return function(e) {
		let { name: n, reducerPath: r = n } = e;
		if (!n) throw Error(xs(11));
		let i = (typeof e.reducers == "function" ? e.reducers(Fo()) : e.reducers) || {}, a = Object.keys(i), o = {
			sliceCaseReducersByName: {},
			sliceCaseReducersByType: {},
			actionCreators: {},
			sliceMatchers: []
		}, s = {
			addCase(e, t) {
				let n = typeof e == "string" ? e : e.type;
				if (!n) throw Error(xs(12));
				if (n in o.sliceCaseReducersByType) throw Error(xs(13));
				return o.sliceCaseReducersByType[n] = t, s;
			},
			addMatcher(e, t) {
				return o.sliceMatchers.push({
					matcher: e,
					reducer: t
				}), s;
			},
			exposeAction(e, t) {
				return o.actionCreators[e] = t, s;
			},
			exposeCaseReducer(e, t) {
				return o.sliceCaseReducersByName[e] = t, s;
			}
		};
		a.forEach((r) => {
			let a = i[r], o = {
				reducerName: r,
				type: jo(n, r),
				createNotation: typeof e.reducers == "function"
			};
			Lo(a) ? zo(o, a, s, t) : Io(o, a, s);
		});
		function c() {
			let [t = {}, n = [], r = void 0] = typeof e.extraReducers == "function" ? To(e.extraReducers) : [e.extraReducers], i = {
				...t,
				...o.sliceCaseReducersByType
			};
			return Do(e.initialState, (e) => {
				for (let t in i) e.addCase(t, i[t]);
				for (let t of o.sliceMatchers) e.addMatcher(t.matcher, t.reducer);
				for (let t of n) e.addMatcher(t.matcher, t.reducer);
				r && e.addDefaultCase(r);
			});
		}
		let l = (e) => e, u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new WeakMap(), f;
		function p(e, t) {
			return f ||= c(), f(e, t);
		}
		function m() {
			return f ||= c(), f.getInitialState();
		}
		function h(t, n = !1) {
			function r(e) {
				let i = e[t];
				return i === void 0 && n && (i = go(d, r, m)), i;
			}
			function i(t = l) {
				return go(go(u, n, () => /* @__PURE__ */ new WeakMap()), t, () => {
					let r = {};
					for (let [i, a] of Object.entries(e.selectors ?? {})) r[i] = No(a, t, () => go(d, t, m), n);
					return r;
				});
			}
			return {
				reducerPath: t,
				getSelectors: i,
				get selectors() {
					return i(r);
				},
				selectSlice: r
			};
		}
		let g = {
			name: n,
			reducer: p,
			actions: o.actionCreators,
			caseReducers: o.sliceCaseReducersByName,
			getInitialState: m,
			...h(r),
			injectInto(e, { reducerPath: t, ...n } = {}) {
				let i = t ?? r;
				return e.inject({
					reducerPath: i,
					reducer: p
				}, n), {
					...g,
					...h(i, !0)
				};
			}
		};
		return g;
	};
}
function No(e, t, n, r) {
	function i(i, ...a) {
		let o = t(i);
		return o === void 0 && r && (o = n()), e(o, ...a);
	}
	return i.unwrapped = e, i;
}
var Po = /* @__PURE__ */ Mo();
function Fo() {
	function e(e, t) {
		return {
			_reducerDefinitionType: "asyncThunk",
			payloadCreator: e,
			...t
		};
	}
	return e.withTypes = () => e, {
		reducer(e) {
			return Object.assign({ [e.name](...t) {
				return e(...t);
			} }[e.name], { _reducerDefinitionType: "reducer" });
		},
		preparedReducer(e, t) {
			return {
				_reducerDefinitionType: "reducerWithPrepare",
				prepare: e,
				reducer: t
			};
		},
		asyncThunk: e
	};
}
function Io({ type: e, reducerName: t, createNotation: n }, r, i) {
	let a, o;
	if ("reducer" in r) {
		if (n && !Ro(r)) throw Error(xs(17));
		a = r.reducer, o = r.prepare;
	} else a = r;
	i.addCase(e, a).exposeCaseReducer(t, a).exposeAction(t, o ? po(e, o) : po(e));
}
function Lo(e) {
	return e._reducerDefinitionType === "asyncThunk";
}
function Ro(e) {
	return e._reducerDefinitionType === "reducerWithPrepare";
}
function zo({ type: e, reducerName: t }, n, r, i) {
	if (!i) throw Error(xs(18));
	let { payloadCreator: a, fulfilled: o, pending: s, rejected: c, settled: l, options: u } = n, d = i(e, a, u);
	r.exposeAction(t, d), o && r.addCase(d.fulfilled, o), s && r.addCase(d.pending, s), c && r.addCase(d.rejected, c), l && r.addMatcher(d.settled, l), r.exposeCaseReducer(t, {
		fulfilled: o || Bo,
		pending: s || Bo,
		rejected: c || Bo,
		settled: l || Bo
	});
}
function Bo() {}
var Vo = "task", Ho = "listener", Uo = "completed", Wo = "cancelled", Go = `task-${Wo}`, Ko = `task-${Uo}`, qo = `${Ho}-${Wo}`, Jo = `${Ho}-${Uo}`, Yo = class {
	constructor(e) {
		this.code = e, this.message = `${Vo} ${Wo} (reason: ${e})`;
	}
	code;
	name = "TaskAbortError";
	message;
}, Xo = (e, t) => {
	if (typeof e != "function") throw TypeError(xs(32));
}, Zo = () => {}, Qo = (e, t = Zo) => (e.catch(t), e), $o = (e, t) => (e.addEventListener("abort", t, { once: !0 }), () => e.removeEventListener("abort", t)), es = (e) => {
	if (e.aborted) throw new Yo(e.reason);
};
function ts(e, t) {
	let n = Zo;
	return new Promise((r, i) => {
		let a = () => i(new Yo(e.reason));
		e.aborted ? a() : (n = $o(e, a), t.finally(() => n()).then(r, i));
	}).finally(() => {
		n = Zo;
	});
}
var ns = async (e, t) => {
	try {
		return await Promise.resolve(), {
			status: "ok",
			value: await e()
		};
	} catch (e) {
		return {
			status: e instanceof Yo ? "cancelled" : "rejected",
			error: e
		};
	} finally {
		t?.();
	}
}, rs = (e) => (t) => Qo(ts(e, t).then((t) => (es(e), t))), is = (e) => {
	let t = rs(e);
	return (e) => t(new Promise((t) => setTimeout(t, e)));
}, { assign: as } = Object, os = {}, ss = "listenerMiddleware", cs = (e, t) => {
	let n = (t) => $o(e, () => t.abort(e.reason));
	return (r, i) => {
		Xo(r, "taskExecutor");
		let a = new AbortController();
		n(a);
		let o = ns(async () => {
			es(e), es(a.signal);
			let t = await r({
				pause: rs(a.signal),
				delay: is(a.signal),
				signal: a.signal
			});
			return es(a.signal), t;
		}, () => a.abort(Ko));
		return i?.autoJoin && t.push(o.catch(Zo)), {
			result: rs(e)(o),
			cancel() {
				a.abort(Go);
			}
		};
	};
}, ls = (e, t) => {
	let n = async (n, r) => {
		es(t);
		let i = () => {}, a = [new Promise((t, r) => {
			let a = e({
				predicate: n,
				effect: (e, n) => {
					n.unsubscribe(), t([
						e,
						n.getState(),
						n.getOriginalState()
					]);
				}
			});
			i = () => {
				a(), r();
			};
		})];
		r != null && a.push(new Promise((e) => setTimeout(e, r, null)));
		try {
			let e = await ts(t, Promise.race(a));
			return es(t), e;
		} finally {
			i();
		}
	};
	return ((e, t) => Qo(n(e, t)));
}, us = (e) => {
	let { type: t, actionCreator: n, matcher: r, predicate: i, effect: a } = e;
	if (t) i = po(t).match;
	else if (n) t = n.type, i = n.match;
	else if (r) i = r;
	else if (!i) throw Error(xs(21));
	return Xo(a, "options.listener"), {
		predicate: i,
		type: t,
		effect: a
	};
}, ds = /* @__PURE__ */ as((e) => {
	let { type: t, predicate: n, effect: r } = us(e);
	return {
		id: ko(),
		effect: r,
		type: t,
		predicate: n,
		pending: /* @__PURE__ */ new Set(),
		unsubscribe: () => {
			throw Error(xs(22));
		}
	};
}, { withTypes: () => ds }), fs = (e, t) => {
	let { type: n, effect: r, predicate: i } = us(t);
	return Array.from(e.values()).find((e) => (typeof n == "string" ? e.type === n : e.predicate === i) && e.effect === r);
}, ps = (e) => {
	e.pending.forEach((e) => {
		e.abort(qo);
	});
}, ms = (e, t) => () => {
	for (let e of t.keys()) ps(e);
	e.clear();
}, hs = (e, t, n) => {
	try {
		e(t, n);
	} catch (e) {
		setTimeout(() => {
			throw e;
		}, 0);
	}
}, gs = /* @__PURE__ */ as(/* @__PURE__ */ po(`${ss}/add`), { withTypes: () => gs }), _s = /* @__PURE__ */ po(`${ss}/removeAll`), vs = /* @__PURE__ */ as(/* @__PURE__ */ po(`${ss}/remove`), { withTypes: () => vs }), ys = (...e) => {
	console.error(`${ss}/error`, ...e);
}, bs = (e = {}) => {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = (e) => {
		let t = n.get(e) ?? 0;
		n.set(e, t + 1);
	}, i = (e) => {
		let t = n.get(e) ?? 1;
		t === 1 ? n.delete(e) : n.set(e, t - 1);
	}, { extra: a, onError: o = ys } = e;
	Xo(o, "onError");
	let s = (e) => (e.unsubscribe = () => t.delete(e.id), t.set(e.id, e), (t) => {
		e.unsubscribe(), t?.cancelActive && ps(e);
	}), c = ((e) => {
		let n = fs(t, e) ?? ds(e);
		return s(n);
	});
	as(c, { withTypes: () => c });
	let l = (e) => {
		let n = fs(t, e);
		return n && (n.unsubscribe(), e.cancelActive && ps(n)), !!n;
	};
	as(l, { withTypes: () => l });
	let u = async (e, n, s, l) => {
		let u = new AbortController(), d = ls(c, u.signal), f = [];
		try {
			e.pending.add(u), r(e), await Promise.resolve(e.effect(n, as({}, s, {
				getOriginalState: l,
				condition: (e, t) => d(e, t).then(Boolean),
				take: d,
				delay: is(u.signal),
				pause: rs(u.signal),
				extra: a,
				signal: u.signal,
				fork: cs(u.signal, f),
				unsubscribe: e.unsubscribe,
				subscribe: () => {
					t.set(e.id, e);
				},
				cancelActiveListeners: () => {
					e.pending.forEach((e, t, n) => {
						e !== u && (e.abort(qo), n.delete(e));
					});
				},
				cancel: () => {
					u.abort(qo), e.pending.delete(u);
				},
				throwIfCancelled: () => {
					es(u.signal);
				}
			})));
		} catch (e) {
			e instanceof Yo || hs(o, e, { raisedBy: "effect" });
		} finally {
			await Promise.all(f), u.abort(Jo), i(e), e.pending.delete(u);
		}
	}, d = ms(t, n);
	return {
		middleware: (e) => (n) => (r) => {
			if (!Bi(r)) return n(r);
			if (gs.match(r)) return c(r.payload);
			if (_s.match(r)) {
				d();
				return;
			}
			if (vs.match(r)) return l(r.payload);
			let i = e.getState(), a = () => {
				if (i === os) throw Error(xs(23));
				return i;
			}, s;
			try {
				if (s = n(r), t.size > 0) {
					let n = e.getState(), s = Array.from(t.values());
					for (let t of s) {
						let s = !1;
						try {
							s = t.predicate(r, n, i);
						} catch (e) {
							s = !1, hs(o, e, { raisedBy: "predicate" });
						}
						s && u(t, r, e, a);
					}
				}
			} finally {
				i = os;
			}
			return s;
		},
		startListening: c,
		stopListening: l,
		clearListeners: d
	};
};
function xs(e) {
	return `Minified Redux Toolkit error #${e}; visit https://redux-toolkit.js.org/Errors?code=${e} for the full message or use the non-minified dev environment for full errors. `;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/layoutSlice.js
var Ss = Po({
	name: "chartLayout",
	initialState: {
		layoutType: "horizontal",
		width: 0,
		height: 0,
		margin: {
			top: 5,
			right: 5,
			bottom: 5,
			left: 5
		},
		scale: 1
	},
	reducers: {
		setLayout(e, t) {
			e.layoutType = t.payload;
		},
		setChartSize(e, t) {
			e.width = t.payload.width, e.height = t.payload.height;
		},
		setMargin(e, t) {
			e.margin.top = t.payload.top ?? 0, e.margin.right = t.payload.right ?? 0, e.margin.bottom = t.payload.bottom ?? 0, e.margin.left = t.payload.left ?? 0;
		},
		setScale(e, t) {
			e.scale = t.payload;
		}
	}
}), Cs = Ss.actions, ws = Cs.setMargin, Ts = Cs.setLayout, Es = Cs.setChartSize, Ds = Cs.setScale, Os = Ss.reducer;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/getSliced.js
function ks(e, t, n) {
	return Array.isArray(e) && e && t + n !== 0 ? e.slice(t, n + 1) : e;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/isWellBehavedNumber.js
function q(e) {
	return Number.isFinite(e);
}
function As(e) {
	return typeof e == "number" && e > 0 && Number.isFinite(e);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/ChartUtils.js
function js(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Ms(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? js(Object(n), !0).forEach(function(t) {
			Ns(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : js(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Ns(e, t, n) {
	return (t = Ps(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Ps(e) {
	var t = Fs(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Fs(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Is(e, t, n) {
	return V(e) || V(t) ? n : Yn(t) ? (0, Gn.default)(e, t, n) : typeof t == "function" ? t(e) : n;
}
var Ls = (e, t, n) => {
	if (t && n) {
		var r = n.width, i = n.height, a = t.align, o = t.verticalAlign, s = t.layout;
		if ((s === "vertical" || s === "horizontal" && o === "middle") && a !== "center" && B(e[a])) return Ms(Ms({}, e), {}, { [a]: e[a] + (r || 0) });
		if ((s === "horizontal" || s === "vertical" && a === "center") && o !== "middle" && B(e[o])) return Ms(Ms({}, e), {}, { [o]: e[o] + (i || 0) });
	}
	return e;
}, Rs = (e, t) => e === "horizontal" && t === "xAxis" || e === "vertical" && t === "yAxis" || e === "centric" && t === "angleAxis" || e === "radial" && t === "radiusAxis", zs = (e, t) => {
	if (!t || t.length !== 2 || !B(t[0]) || !B(t[1])) return e;
	var n = Math.min(t[0], t[1]), r = Math.max(t[0], t[1]), i = [e[0], e[1]];
	return (!B(e[0]) || e[0] < n) && (i[0] = n), (!B(e[1]) || e[1] > r) && (i[1] = r), i[0] > r && (i[0] = r), i[1] < n && (i[1] = n), i;
}, Bs = {
	sign: (e) => {
		var t = e.length;
		if (!(t <= 0)) {
			var n = e[0]?.length;
			if (!(n == null || n <= 0)) for (var r = 0; r < n; ++r) for (var i = 0, a = 0, o = 0; o < t; ++o) {
				var s = e[o]?.[r];
				if (s != null) {
					var c = s[1], l = s[0], u = qn(c) ? l : c;
					u >= 0 ? (s[0] = i, i += u, s[1] = i) : (s[0] = a, a += u, s[1] = a);
				}
			}
		}
	},
	expand: E,
	none: T,
	silhouette: w,
	wiggle: D,
	positive: (e) => {
		var t = e.length;
		if (!(t <= 0)) {
			var n = e[0]?.length;
			if (!(n == null || n <= 0)) for (var r = 0; r < n; ++r) for (var i = 0, a = 0; a < t; ++a) {
				var o = e[a]?.[r];
				if (o != null) {
					var s = qn(o[1]) ? o[0] : o[1];
					s >= 0 ? (o[0] = i, i += s, o[1] = i) : (o[0] = 0, o[1] = 0);
				}
			}
		}
	}
}, Vs = (e, t, n) => {
	var r = Bs[n] ?? T, i = C().keys(t).value((e, t) => Number(Is(e, t, 0))).order(S).offset(r)(e);
	return i.forEach((n, r) => {
		n.forEach((n, i) => {
			var a = Is(e[i], t[r], 0);
			Array.isArray(a) && a.length === 2 && B(a[0]) && B(a[1]) && (n[0] = a[0], n[1] = a[1]);
		});
	}), i;
};
function Hs(e) {
	return e == null ? void 0 : String(e);
}
var Us = (e) => {
	var t = e.axis, n = e.ticks, r = e.offset, i = e.bandSize, a = e.entry, o = e.index;
	if (t.type === "category") return n[o] ? n[o].coordinate + r : null;
	var s = Is(a, t.dataKey, t.scale.domain()[o]);
	if (V(s)) return null;
	var c = t.scale.map(s);
	return B(c) ? c - i / 2 + r : null;
}, Ws = (e) => {
	var t = e.numericAxis, n = t.scale.domain();
	if (t.type === "number") {
		var r = Math.min(n[0], n[1]), i = Math.max(n[0], n[1]);
		return r <= 0 && i >= 0 ? 0 : i < 0 ? i : r;
	}
	return n[0];
}, Gs = (e) => {
	var t = e.flat(2).filter(B);
	return [Math.min(...t), Math.max(...t)];
}, Ks = (e) => [e[0] === Infinity ? 0 : e[0], e[1] === -Infinity ? 0 : e[1]], qs = (e, t, n) => {
	if (e != null && Object.keys(e).length !== 0) return Ks(Object.keys(e).reduce((r, i) => {
		var a = e[i];
		if (!a) return r;
		var o = a.stackedData.reduce((e, r) => {
			var i = Gs(ks(r, t, n));
			return !q(i[0]) || !q(i[1]) ? e : [Math.min(e[0], i[0]), Math.max(e[1], i[1])];
		}, [Infinity, -Infinity]);
		return [Math.min(o[0], r[0]), Math.max(o[1], r[1])];
	}, [Infinity, -Infinity]));
}, Js = /^dataMin[\s]*-[\s]*([0-9]+([.]{1}[0-9]+){0,1})$/, Ys = /^dataMax[\s]*\+[\s]*([0-9]+([.]{1}[0-9]+){0,1})$/, Xs = (e, t, n) => {
	if (e && e.scale && e.scale.bandwidth) {
		var r = e.scale.bandwidth();
		if (!n || r > 0) return r;
	}
	if (e && t && t.length >= 2) {
		for (var i = (0, _i.default)(t, (e) => e.coordinate), a = Infinity, o = 1, s = i.length; o < s; o++) {
			var c = i[o], l = i[o - 1];
			a = Math.min((c?.coordinate || 0) - (l?.coordinate || 0), a);
		}
		return a === Infinity ? 0 : a;
	}
	return n ? void 0 : 0;
};
function Zs(e) {
	var t = e.tooltipEntrySettings, n = e.dataKey, r = e.payload, i = e.value, a = e.name;
	return Ms(Ms({}, t), {}, {
		dataKey: n,
		payload: r,
		value: i,
		name: a
	});
}
function Qs(e, t) {
	if (e != null) return String(e);
	if (typeof t == "string") return t;
}
var $s = (e, t) => {
	if (t === "horizontal") return e.relativeX;
	if (t === "vertical") return e.relativeY;
}, ec = (e, t) => t === "centric" ? e.angle : e.radius, tc = (e) => e.layout.width, nc = (e) => e.layout.height, rc = (e) => e.layout.scale, ic = (e) => e.layout.margin, ac = W((e) => e.cartesianAxis.xAxis, (e) => Object.values(e)), oc = W((e) => e.cartesianAxis.yAxis, (e) => Object.values(e)), sc = "data-recharts-item-index";
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/selectChartOffsetInternal.js
function cc(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function lc(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? cc(Object(n), !0).forEach(function(t) {
			uc(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : cc(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function uc(e, t, n) {
	return (t = dc(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function dc(e) {
	var t = fc(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function fc(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var pc = (e) => e.brush.height;
function mc(e) {
	return oc(e).reduce((e, t) => t.orientation === "left" && !t.mirror && !t.hide ? e + (typeof t.width == "number" ? t.width : 60) : e, 0);
}
function hc(e) {
	return oc(e).reduce((e, t) => t.orientation === "right" && !t.mirror && !t.hide ? e + (typeof t.width == "number" ? t.width : 60) : e, 0);
}
function gc(e) {
	return ac(e).reduce((e, t) => t.orientation === "top" && !t.mirror && !t.hide ? e + t.height : e, 0);
}
function _c(e) {
	return ac(e).reduce((e, t) => t.orientation === "bottom" && !t.mirror && !t.hide ? e + t.height : e, 0);
}
var vc = W([
	tc,
	nc,
	ic,
	pc,
	mc,
	hc,
	gc,
	_c,
	vi,
	yi
], (e, t, n, r, i, a, o, s, c, l) => {
	var u = {
		left: (n.left || 0) + i,
		right: (n.right || 0) + a
	}, d = lc(lc({}, {
		top: (n.top || 0) + o,
		bottom: (n.bottom || 0) + s
	}), u), f = d.bottom;
	d.bottom += r, d = Ls(d, c, l);
	var p = e - d.left - d.right, m = t - d.top - d.bottom;
	return lc(lc({ brushBottom: f }, d), {}, {
		width: Math.max(p, 0),
		height: Math.max(m, 0)
	});
}), yc = W(vc, (e) => ({
	x: e.left,
	y: e.top,
	width: e.width,
	height: e.height
})), bc = W(tc, nc, (e, t) => ({
	x: 0,
	y: 0,
	width: e,
	height: t
})), xc = /*#__PURE__*/ Le(null), Sc = () => He(xc) != null, Cc = (e) => e.brush, wc = W([
	Cc,
	vc,
	ic
], (e, t, n) => ({
	height: e.height,
	x: B(e.x) ? e.x : t.left,
	y: B(e.y) ? e.y : t.top + t.height + t.brushBottom - (n?.bottom || 0),
	width: B(e.width) ? e.width : t.width
})), Tc = /*#__PURE__*/ Le({
	width: "100%",
	height: "100%",
	debounce: 0,
	minWidth: 0,
	initialDimension: {
		width: -1,
		height: -1
	}
}.initialDimension), Ec = () => He(Tc);
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/context/chartLayoutContext.js
function Dc(e) {
	if (e) return {
		x: e.x,
		y: e.y,
		upperWidth: "upperWidth" in e ? e.upperWidth : e.width,
		lowerWidth: "lowerWidth" in e ? e.lowerWidth : e.width,
		width: e.width,
		height: e.height
	};
}
var Oc = () => {
	var e = Sc(), t = U(yc), n = U(wc), r = U(Cc)?.padding;
	return !e || !n || !r ? t : {
		width: n.width - r.left - r.right,
		height: n.height - r.top - r.bottom,
		x: r.left,
		y: r.top
	};
}, kc = {
	top: 0,
	bottom: 0,
	left: 0,
	right: 0,
	width: 0,
	height: 0,
	brushBottom: 0
}, Ac = () => U(vc) ?? kc, jc = () => U(tc), Mc = () => U(nc), J = (e) => e.layout.layoutType, Nc = () => U(J), Pc = () => {
	var e = Nc();
	if (e === "horizontal" || e === "vertical") return e;
}, Fc = (e) => {
	var t = e.layout.layoutType;
	if (t === "centric" || t === "radial") return t;
}, Ic = () => Nc() !== void 0, Lc = (e) => {
	var t = H(), n = Sc(), r = e.width, i = e.height, a = Ec(), o = r, s = i;
	return a && (o = a.width > 0 ? a.width : r, s = a.height > 0 ? a.height : i), I(() => {
		!n && As(o) && As(s) && t(Es({
			width: o,
			height: s
		}));
	}, [
		t,
		n,
		o,
		s
	]), null;
}, Rc = Po({
	name: "legend",
	initialState: {
		settings: {
			layout: "horizontal",
			align: "center",
			verticalAlign: "bottom",
			itemSorter: "value"
		},
		size: {
			width: 0,
			height: 0
		},
		payload: []
	},
	reducers: {
		setLegendSize(e, t) {
			e.size.width = t.payload.width, e.size.height = t.payload.height;
		},
		setLegendSettings(e, t) {
			e.settings.align = t.payload.align, e.settings.layout = t.payload.layout, e.settings.verticalAlign = t.payload.verticalAlign, e.settings.itemSorter = t.payload.itemSorter;
		},
		addLegendPayload: {
			reducer(e, t) {
				e.payload.push(G(t.payload));
			},
			prepare: K()
		},
		replaceLegendPayload: {
			reducer(e, t) {
				var n = t.payload, r = n.prev, i = n.next, a = ao(e).payload.indexOf(G(r));
				a > -1 && (e.payload[a] = G(i));
			},
			prepare: K()
		},
		removeLegendPayload: {
			reducer(e, t) {
				var n = ao(e).payload.indexOf(G(t.payload));
				n > -1 && e.payload.splice(n, 1);
			},
			prepare: K()
		}
	}
}), zc = Rc.actions;
zc.setLegendSize, zc.setLegendSettings;
var Bc = zc.addLegendPayload, Vc = zc.replaceLegendPayload, Hc = zc.removeLegendPayload, Uc = Rc.reducer, Wc = /* @__PURE__ */ n(((e) => {
	var t = Me();
	t.useSyncExternalStore, t.useRef, t.useEffect, t.useMemo, t.useDebugValue;
}));
(/* @__PURE__ */ n(((e, t) => {
	t.exports = Wc();
})))();
function Gc(e) {
	e();
}
function Kc() {
	let e = null, t = null;
	return {
		clear() {
			e = null, t = null;
		},
		notify() {
			Gc(() => {
				let t = e;
				for (; t;) t.callback(), t = t.next;
			});
		},
		get() {
			let t = [], n = e;
			for (; n;) t.push(n), n = n.next;
			return t;
		},
		subscribe(n) {
			let r = !0, i = t = {
				callback: n,
				next: null,
				prev: t
			};
			return i.prev ? i.prev.next = i : e = i, function() {
				r && e !== null && (r = !1, i.next ? i.next.prev = i.prev : t = i.prev, i.prev ? i.prev.next = i.next : e = i.next);
			};
		}
	};
}
var qc = {
	notify() {},
	get: () => []
};
function Jc(e, t) {
	let n, r = qc, i = 0, a = !1;
	function o(e) {
		u();
		let t = r.subscribe(e), n = !1;
		return () => {
			n || (n = !0, t(), d());
		};
	}
	function s() {
		r.notify();
	}
	function c() {
		m.onStateChange && m.onStateChange();
	}
	function l() {
		return a;
	}
	function u() {
		i++, n || (n = t ? t.addNestedSub(c) : e.subscribe(c), r = Kc());
	}
	function d() {
		i--, n && i === 0 && (n(), n = void 0, r.clear(), r = qc);
	}
	function f() {
		a || (a = !0, u());
	}
	function p() {
		a && (a = !1, d());
	}
	let m = {
		addNestedSub: o,
		notifyNestedSubs: s,
		handleChangeWrapper: c,
		isSubscribed: l,
		trySubscribe: f,
		tryUnsubscribe: p,
		getListeners: () => r
	};
	return m;
}
var Yc = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, Xc = typeof navigator < "u" && navigator.product === "ReactNative", Zc = Yc || Xc ? P.useLayoutEffect : P.useEffect;
function Qc(e, t) {
	return e === t ? e !== 0 || t !== 0 || 1 / e == 1 / t : e !== e && t !== t;
}
function $c(e, t) {
	if (Qc(e, t)) return !0;
	if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
	let n = Object.keys(e), r = Object.keys(t);
	if (n.length !== r.length) return !1;
	for (let r = 0; r < n.length; r++) if (!Object.prototype.hasOwnProperty.call(t, n[r]) || !Qc(e[n[r]], t[n[r]])) return !1;
	return !0;
}
var el = /* @__PURE__ */ Symbol.for("react-redux-context"), tl = typeof globalThis < "u" ? globalThis : {};
function nl() {
	if (!P.createContext) return {};
	let e = tl[el] ??= /* @__PURE__ */ new Map(), t = e.get(P.createContext);
	return t || (t = P.createContext(null), e.set(P.createContext, t)), t;
}
var rl = /* @__PURE__ */ nl();
function il(e) {
	let { children: t, context: n, serverState: r, store: i } = e, a = P.useMemo(() => {
		let e = Jc(i);
		return {
			store: i,
			subscription: e,
			getServerState: r ? () => r : void 0
		};
	}, [i, r]), o = P.useMemo(() => i.getState(), [i]);
	Zc(() => {
		let { subscription: e } = a;
		return e.onStateChange = e.notifyNestedSubs, e.trySubscribe(), o !== i.getState() && e.notifyNestedSubs(), () => {
			e.tryUnsubscribe(), e.onStateChange = void 0;
		};
	}, [a, o]);
	let s = n || rl;
	return /* @__PURE__ */ P.createElement(s.Provider, { value: a }, t);
}
var al = il, ol = /* @__PURE__ */ new Set([
	"axisLine",
	"tickLine",
	"activeBar",
	"activeDot",
	"activeLabel",
	"activeShape",
	"allowEscapeViewBox",
	"background",
	"cursor",
	"dot",
	"label",
	"line",
	"margin",
	"padding",
	"position",
	"shape",
	"style",
	"tick",
	"wrapperStyle",
	"radius",
	"throttledEvents"
]);
function sl(e, t) {
	return e == null && t == null ? !0 : typeof e == "number" && typeof t == "number" ? e === t || e !== e && t !== t : e === t;
}
function cl(e, t) {
	for (var n of /* @__PURE__ */ new Set([...Object.keys(e), ...Object.keys(t)])) if (ol.has(n)) {
		if (e[n] == null && t[n] == null) continue;
		if (!$c(e[n], t[n])) return !1;
	} else if (!sl(e[n], t[n])) return !1;
	return !0;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/component/DefaultTooltipContent.js
function ll() {
	return ll = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, ll.apply(null, arguments);
}
function ul(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function dl(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? ul(Object(n), !0).forEach(function(t) {
			fl(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : ul(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function fl(e, t, n) {
	return (t = pl(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function pl(e) {
	var t = ml(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function ml(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function hl(e, t) {
	return bl(e) || yl(e, t) || _l(e, t) || gl();
}
function gl() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _l(e, t) {
	if (e) {
		if (typeof e == "string") return vl(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? vl(e, t) : void 0;
	}
}
function vl(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function yl(e, t) {
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
function bl(e) {
	if (Array.isArray(e)) return e;
}
function xl(e) {
	return Array.isArray(e) && Yn(e[0]) && Yn(e[1]) ? e.join(" ~ ") : e;
}
var Sl = {
	separator: " : ",
	contentStyle: {
		margin: 0,
		padding: 10,
		backgroundColor: "#fff",
		border: "1px solid #ccc",
		whiteSpace: "nowrap"
	},
	itemStyle: {
		display: "block",
		paddingTop: 4,
		paddingBottom: 4,
		color: "#000"
	},
	labelStyle: {},
	accessibilityLayer: !1
};
function Cl(e, t) {
	return t == null ? e : (0, _i.default)(e, t);
}
var wl = (e) => {
	var t = e.separator, n = t === void 0 ? Sl.separator : t, r = e.contentStyle, i = e.itemStyle, a = e.labelStyle, o = a === void 0 ? Sl.labelStyle : a, s = e.payload, c = e.formatter, l = e.itemSorter, u = e.wrapperClassName, d = e.labelClassName, f = e.label, p = e.labelFormatter, m = e.accessibilityLayer, h = m === void 0 ? Sl.accessibilityLayer : m, g = () => {
		if (s && s.length) {
			var e = {
				padding: 0,
				margin: 0
			}, t = Cl(s, l).map((e, t) => {
				if (!e || e.type === "none") return null;
				var r = e.formatter || c || xl, a = e.value, o = e.name, l = a, u = o;
				if (r) {
					var d = r(a, o, e, t, s);
					if (Array.isArray(d)) {
						var f = hl(d, 2);
						l = f[0], u = f[1];
					} else if (d != null) l = d;
					else return null;
				}
				var p = dl(dl({}, Sl.itemStyle), {}, { color: e.color || Sl.itemStyle.color }, i);
				return /*#__PURE__*/ P.createElement("li", {
					className: "recharts-tooltip-item",
					key: `tooltip-item-${t}`,
					style: p
				}, Yn(u) ? /*#__PURE__*/ P.createElement("span", { className: "recharts-tooltip-item-name" }, u) : null, Yn(u) ? /*#__PURE__*/ P.createElement("span", { className: "recharts-tooltip-item-separator" }, n) : null, /*#__PURE__*/ P.createElement("span", { className: "recharts-tooltip-item-value" }, l), /*#__PURE__*/ P.createElement("span", { className: "recharts-tooltip-item-unit" }, e.unit || ""));
			});
			return /*#__PURE__*/ P.createElement("ul", {
				className: "recharts-tooltip-item-list",
				style: e
			}, t);
		}
		return null;
	}, _ = dl(dl({}, Sl.contentStyle), r), v = dl({ margin: 0 }, o), y = !V(f), b = y ? f : "", x = z("recharts-default-tooltip", u), S = z("recharts-tooltip-label", d);
	y && p && s != null && (b = p(f, s));
	var C = h ? {
		role: "status",
		"aria-live": "assertive"
	} : {};
	return /*#__PURE__*/ P.createElement("div", ll({
		className: x,
		style: _
	}, C), /*#__PURE__*/ P.createElement("p", {
		className: S,
		style: v
	}, /*#__PURE__*/ P.isValidElement(b) ? b : `${b}`), g());
}, Tl = "recharts-tooltip-wrapper", El = { visibility: "hidden" };
function Dl(e) {
	var t = e.coordinate, n = e.translateX, r = e.translateY;
	return z(Tl, {
		[`${Tl}-right`]: B(n) && t && B(t.x) && n >= t.x,
		[`${Tl}-left`]: B(n) && t && B(t.x) && n < t.x,
		[`${Tl}-bottom`]: B(r) && t && B(t.y) && r >= t.y,
		[`${Tl}-top`]: B(r) && t && B(t.y) && r < t.y
	});
}
function Ol(e) {
	var t = e.allowEscapeViewBox, n = e.coordinate, r = e.key, i = e.offset, a = e.position, o = e.reverseDirection, s = e.tooltipDimension, c = e.viewBox, l = e.viewBoxDimension;
	if (a && B(a[r])) return a[r];
	var u = n[r] - s - (i > 0 ? i : 0), d = n[r] + i;
	if (t[r]) return o[r] ? u : d;
	var f = c[r];
	return f == null ? 0 : o[r] ? Math.max(u < f ? d : u, f) : l == null ? 0 : d + s > f + l ? Math.max(u, f) : Math.max(d, f);
}
function kl(e) {
	var t = e.translateX, n = e.translateY;
	return { transform: e.useTranslate3d ? `translate3d(${t}px, ${n}px, 0)` : `translate(${t}px, ${n}px)` };
}
function Al(e) {
	var t = e.allowEscapeViewBox, n = e.coordinate, r = e.offsetTop, i = e.offsetLeft, a = e.position, o = e.reverseDirection, s = e.tooltipBox, c = e.useTranslate3d, l = e.viewBox, u, d, f;
	return s.height > 0 && s.width > 0 && n ? (d = Ol({
		allowEscapeViewBox: t,
		coordinate: n,
		key: "x",
		offset: i,
		position: a,
		reverseDirection: o,
		tooltipDimension: s.width,
		viewBox: l,
		viewBoxDimension: l.width
	}), f = Ol({
		allowEscapeViewBox: t,
		coordinate: n,
		key: "y",
		offset: r,
		position: a,
		reverseDirection: o,
		tooltipDimension: s.height,
		viewBox: l,
		viewBoxDimension: l.height
	}), u = kl({
		translateX: d,
		translateY: f,
		useTranslate3d: c
	})) : u = El, {
		cssProperties: u,
		cssClasses: Dl({
			translateX: d,
			translateY: f,
			coordinate: n
		})
	};
}
var jl = {
	devToolsEnabled: !0,
	isSsr: !(typeof window < "u" && window.document && window.document.createElement && window.setTimeout)
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/usePrefersReducedMotion.js
function Ml(e, t) {
	return Ll(e) || Il(e, t) || Pl(e, t) || Nl();
}
function Nl() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Pl(e, t) {
	if (e) {
		if (typeof e == "string") return Fl(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? Fl(e, t) : void 0;
	}
}
function Fl(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Il(e, t) {
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
function Ll(e) {
	if (Array.isArray(e)) return e;
}
function Rl() {
	var e = Ml(Ke(() => jl.isSsr || !window.matchMedia ? !1 : window.matchMedia("(prefers-reduced-motion: reduce)").matches), 2), t = e[0], n = e[1];
	return I(() => {
		if (window.matchMedia) {
			var e = window.matchMedia("(prefers-reduced-motion: reduce)"), t = () => {
				n(e.matches);
			};
			return e.addEventListener("change", t), () => {
				e.removeEventListener("change", t);
			};
		}
	}, []), t;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/component/TooltipBoundingBox.js
function zl(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Bl(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? zl(Object(n), !0).forEach(function(t) {
			Vl(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : zl(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Vl(e, t, n) {
	return (t = Hl(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Hl(e) {
	var t = Ul(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Ul(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Wl(e, t) {
	return Yl(e) || Jl(e, t) || Kl(e, t) || Gl();
}
function Gl() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Kl(e, t) {
	if (e) {
		if (typeof e == "string") return ql(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? ql(e, t) : void 0;
	}
}
function ql(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Jl(e, t) {
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
function Yl(e) {
	if (Array.isArray(e)) return e;
}
function Xl(e) {
	if (!(e.prefersReducedMotion && e.isAnimationActive === "auto") && e.isAnimationActive && e.active) {
		var t = typeof e.animationEasing == "string" ? e.animationEasing : "ease";
		return `transform ${e.animationDuration}ms ${t}`;
	}
}
function Zl(e) {
	var t = Rl(), n = Wl(P.useState(() => ({
		dismissed: !1,
		dismissedAtCoordinate: {
			x: 0,
			y: 0
		}
	})), 2), r = n[0], i = n[1];
	P.useEffect(() => {
		var t = (t) => {
			t.key === "Escape" && i({
				dismissed: !0,
				dismissedAtCoordinate: {
					x: e.coordinate?.x ?? 0,
					y: e.coordinate?.y ?? 0
				}
			});
		};
		return document.addEventListener("keydown", t), () => {
			document.removeEventListener("keydown", t);
		};
	}, [e.coordinate?.x, e.coordinate?.y]), r.dismissed && ((e.coordinate?.x ?? 0) !== r.dismissedAtCoordinate.x || (e.coordinate?.y ?? 0) !== r.dismissedAtCoordinate.y) && i(Bl(Bl({}, r), {}, { dismissed: !1 }));
	var a = Al({
		allowEscapeViewBox: e.allowEscapeViewBox,
		coordinate: e.coordinate,
		offsetLeft: typeof e.offset == "number" ? e.offset : e.offset.x,
		offsetTop: typeof e.offset == "number" ? e.offset : e.offset.y,
		position: e.position,
		reverseDirection: e.reverseDirection,
		tooltipBox: {
			height: e.lastBoundingBox.height,
			width: e.lastBoundingBox.width
		},
		useTranslate3d: e.useTranslate3d,
		viewBox: e.viewBox
	}), o = a.cssClasses, s = a.cssProperties, c = Bl(Bl({}, e.hasPortalFromProps ? {} : Bl(Bl({ transition: Xl({
		prefersReducedMotion: t,
		isAnimationActive: e.isAnimationActive,
		active: e.active,
		animationDuration: e.animationDuration,
		animationEasing: e.animationEasing
	}) }, s), {}, {
		pointerEvents: "none",
		position: "absolute",
		top: 0,
		left: 0
	})), {}, { visibility: !r.dismissed && e.active && e.hasPayload ? "visible" : "hidden" }, e.wrapperStyle);
	return /*#__PURE__*/ P.createElement("div", {
		xmlns: "http://www.w3.org/1999/xhtml",
		tabIndex: -1,
		className: o,
		style: c,
		ref: e.innerRef
	}, e.children);
}
var Ql = /*#__PURE__*/ P.memo(Zl), $l = () => U((e) => e.rootProps.accessibilityLayer) ?? !0;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/shape/Curve.js
function eu() {
	return eu = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, eu.apply(null, arguments);
}
function tu(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function nu(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? tu(Object(n), !0).forEach(function(t) {
			ru(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : tu(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function ru(e, t, n) {
	return (t = iu(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function iu(e) {
	var t = au(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function au(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var ou = {
	curveBasisClosed: b,
	curveBasisOpen: f,
	curveBasis: o,
	curveBumpX: u,
	curveBumpY: c,
	curveLinearClosed: x,
	curveLinear: a,
	curveMonotoneX: d,
	curveMonotoneY: y,
	curveNatural: p,
	curveStep: m,
	curveStepAfter: v,
	curveStepBefore: _
}, su = (e) => q(e.x) && q(e.y), cu = (e) => e.base != null && su(e.base) && su(e), lu = (e) => e.x, uu = (e) => e.y, du = (e, t) => {
	if (typeof e == "function") return e;
	var n = `curve${nr(e)}`;
	if ((n === "curveMonotone" || n === "curveBump") && t) {
		var r = ou[`${n}${t === "vertical" ? "Y" : "X"}`];
		if (r) return r;
	}
	return ou[n] || a;
}, fu = {
	connectNulls: !1,
	type: "linear"
}, pu = (e) => {
	var t = e.type, n = t === void 0 ? fu.type : t, r = e.points, i = r === void 0 ? [] : r, a = e.baseLine, o = e.layout, c = e.connectNulls, l = c === void 0 ? fu.connectNulls : c, u = du(n, o), d = l ? i.filter(su) : i;
	if (Array.isArray(a)) {
		var f, p = i.map((e, t) => nu(nu({}, e), {}, { base: a[t] }));
		return f = o === "vertical" ? st().y(uu).x1(lu).x0((e) => e.base.x) : st().x(lu).y1(uu).y0((e) => e.base.y), f.defined(cu).curve(u)(l ? p.filter(cu) : p);
	}
	return (o === "vertical" && B(a) ? st().y(uu).x1(lu).x0(a) : B(a) ? st().x(lu).y1(uu).y0(a) : s().x(lu).y(uu)).defined(su).curve(u)(d);
}, mu = (e) => {
	var t = e.className, n = e.points, r = e.path, i = e.pathRef, a = Nc();
	if ((!n || !n.length) && !r) return null;
	var o = {
		type: e.type,
		points: e.points,
		baseLine: e.baseLine,
		layout: e.layout || a,
		connectNulls: e.connectNulls
	}, s = n && n.length ? pu(o) : r;
	return /*#__PURE__*/ P.createElement("path", eu({}, xn(e), or(e), {
		className: z("recharts-curve", t),
		d: s === null ? void 0 : s,
		ref: i
	}));
}, hu = [
	"x",
	"y",
	"top",
	"left",
	"width",
	"height",
	"className"
];
function gu() {
	return gu = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, gu.apply(null, arguments);
}
function _u(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function vu(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? _u(Object(n), !0).forEach(function(t) {
			yu(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : _u(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function yu(e, t, n) {
	return (t = bu(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function bu(e) {
	var t = xu(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function xu(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Su(e, t) {
	if (e == null) return {};
	var n, r, i = Cu(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Cu(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var wu = (e, t, n, r, i, a) => `M${e},${i}v${r}M${a},${t}h${n}`, Tu = (e) => {
	var t = e.x, n = t === void 0 ? 0 : t, r = e.y, i = r === void 0 ? 0 : r, a = e.top, o = a === void 0 ? 0 : a, s = e.left, c = s === void 0 ? 0 : s, l = e.width, u = l === void 0 ? 0 : l, d = e.height, f = d === void 0 ? 0 : d, p = e.className, m = Su(e, hu), h = vu({
		x: n,
		y: i,
		top: o,
		left: c,
		width: u,
		height: f
	}, m);
	return !B(n) || !B(i) || !B(u) || !B(f) || !B(o) || !B(c) ? null : /*#__PURE__*/ P.createElement("path", gu({}, Cn(h), {
		className: z("recharts-cross", p),
		d: wu(n, i, u, f, o, c)
	}));
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/cursor/getCursorRectangle.js
function Eu(e, t, n, r) {
	var i = r / 2;
	return {
		stroke: "none",
		fill: "#ccc",
		x: e === "horizontal" ? t.x - i : n.left + .5,
		y: e === "horizontal" ? n.top + .5 : t.y - i,
		width: e === "horizontal" ? r : n.width - 1,
		height: e === "horizontal" ? n.height - 1 : r
	};
}
var Du = (e, t) => [
	0,
	3 * e,
	3 * t - 6 * e,
	3 * e - 3 * t + 1
], Ou = (e, t) => e.map((e, n) => e * t ** n).reduce((e, t) => e + t), ku = (e, t) => (n) => Ou(Du(e, t), n), Au = (e, t) => (n) => Ou([...Du(e, t).map((e, t) => e * t).slice(1), 0], n), ju = (e) => {
	var t, n = e.split("(");
	if (n.length !== 2 || n[0] !== "cubic-bezier") return null;
	var r = (t = n[1]) == null || (t = t.split(")")[0]) == null ? void 0 : t.split(",");
	if (r == null || r.length !== 4) return null;
	var i = r.map((e) => parseFloat(e));
	return [
		i[0],
		i[1],
		i[2],
		i[3]
	];
}, Mu = function() {
	var e = [...arguments];
	if (e.length === 1) switch (e[0]) {
		case "linear": return [
			0,
			0,
			1,
			1
		];
		case "ease": return [
			.25,
			.1,
			.25,
			1
		];
		case "ease-in": return [
			.42,
			0,
			1,
			1
		];
		case "ease-out": return [
			.42,
			0,
			.58,
			1
		];
		case "ease-in-out": return [
			0,
			0,
			.58,
			1
		];
		default:
			var t = ju(e[0]);
			if (t) return t;
	}
	return e.length === 4 ? e : [
		0,
		0,
		1,
		1
	];
}, Nu = (e, t, n, r) => {
	var i = ku(e, n), a = ku(t, r), o = Au(e, n), s = (e) => e > 1 ? 1 : e < 0 ? 0 : e, c = (e) => {
		for (var t = e > 1 ? 1 : e, n = t, r = 0; r < 8; ++r) {
			var c = i(n) - t, l = o(n);
			if (Math.abs(c - t) < 1e-4 || l < 1e-4) return a(n);
			n = s(n - c / l);
		}
		return a(n);
	};
	return c.isStepper = !1, c;
}, Pu = function() {
	return Nu(...Mu(...arguments));
}, Fu = function() {
	for (var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, t = e.stiff, n = t === void 0 ? 100 : t, r = e.damping, i = r === void 0 ? 8 : r, a = e.dt, o = a === void 0 ? 16.67 : a, s = 1, c = [0], l = 0, u = 0, d = 1e4, f = 0; f < d;) {
		var p = -(l - s) * n, m = u * i;
		if (u += (p - m) * o / 1e3, l += u * o / 1e3, c.push(l), Math.abs(l - s) < 1e-4 && Math.abs(u) < 1e-4) break;
		f++;
	}
	c[c.length - 1] = s;
	var h = c.length - 1;
	return (e) => {
		if (e <= 0) return 0;
		if (e >= 1) return s;
		var t = e * h, n = Math.floor(t), r = t - n;
		return (c[n] ?? 0) + ((c[n + 1] ?? 0) - (c[n] ?? 0)) * r;
	};
}, Iu = (e) => {
	if (typeof e == "string") switch (e) {
		case "ease":
		case "ease-in-out":
		case "ease-out":
		case "ease-in":
		case "linear": return Pu(e);
		case "spring": return Fu();
		default: if (e.split("(")[0] === "cubic-bezier") return Pu(e);
	}
	return typeof e == "function" ? e : null;
}, Lu = /*#__PURE__*/ Le((e, t, n) => {
	var r, i = (a) => {
		var o = t.tick(a);
		if (t.getState() === "active") {
			if (n(t.getInterpolated()), t.getProgress() === 1) {
				t.complete(), r = void 0;
				return;
			}
			r = e.setTimeout(i, o);
		} else r = e.setTimeout(i, o);
	};
	return r = e.setTimeout(i, 0), () => r?.();
});
Lu.Provider;
function Ru(e) {
	var t = He(Lu);
	return Ge(() => e ?? t, [e, t]);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/animation/AnimationHandle.js
function zu(e, t, n) {
	return (t = Bu(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Bu(e) {
	var t = Vu(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Vu(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Hu = "init", Uu = "pending", Wu = "active", Gu = "completed";
function Ku(e) {
	return Math.max(0, e);
}
var qu = class {
	getAnimationStartedTime() {
		return this.animationStartedTime;
	}
	getBeginStartedTime() {
		return this.beginStartedTime;
	}
	constructor(e) {
		var t;
		zu(this, "state", Hu), this.animationId = e.animationId, this.onAnimationEnd = e.onAnimationEnd, this.animationDuration = Ku(e.animationDuration), this.animationBegin = Ku(e.animationBegin), this.progress = 0, this.from = e.from, this.to = e.to, this.easing = e.easing, (t = e.onAnimationStart) == null || t.call(e);
	}
	getState() {
		return this.state;
	}
	getEasing() {
		return this.easing;
	}
	getAnimationDuration() {
		return this.animationDuration;
	}
	tick(e) {
		if (this.getState() === Hu) return this.state = Uu, this.beginStartedTime = e, this.animationBegin;
		if (this.getState() === Uu) {
			if (this.beginStartedTime == null) throw Error();
			var t = e - this.beginStartedTime;
			return t >= this.animationBegin ? (this.state = Wu, this.animationStartedTime = e, this.nextAnimationUpdate(0)) : Ku(this.animationBegin - t);
		}
		if (this.getState() === Wu) {
			if (this.animationStartedTime == null) throw Error();
			var n = e - this.animationStartedTime;
			return this.setProgress(n / this.animationDuration), this.nextAnimationUpdate(n);
		}
		return 0;
	}
	setProgress(e) {
		this.progress = Math.min(1, Math.max(0, e));
	}
	getProgress() {
		return this.progress;
	}
	complete() {
		if (this.progress = 1, this.state === "active") {
			var e;
			(e = this.onAnimationEnd) == null || e.call(this);
		}
		this.state = Gu;
	}
	getFrom() {
		return this.from;
	}
	getTo() {
		return this.to;
	}
	getAnimationId() {
		return this.animationId;
	}
	getAnimationBegin() {
		return this.animationBegin;
	}
}, Ju = class extends qu {
	nextAnimationUpdate() {
		return 0;
	}
	getInterpolated() {
		return this.easing(er(this.getFrom(), this.getTo(), this.getProgress()));
	}
}, Yu = class {
	setTimeout(e) {
		var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0, n = performance.now(), r = null, i = (a) => {
			a - n >= t ? e(a) : r = requestAnimationFrame(i);
		};
		return r = requestAnimationFrame(i), () => {
			r != null && cancelAnimationFrame(r);
		};
	}
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/animation/JavascriptAnimate.js
function Xu(e, t) {
	return td(e) || ed(e, t) || Qu(e, t) || Zu();
}
function Zu() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Qu(e, t) {
	if (e) {
		if (typeof e == "string") return $u(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? $u(e, t) : void 0;
	}
}
function $u(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function ed(e, t) {
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
function td(e) {
	if (Array.isArray(e)) return e;
}
var nd = {
	begin: 0,
	duration: 1e3,
	easing: "ease",
	isActive: !0,
	canBegin: !0,
	onAnimationEnd: () => {},
	onAnimationStart: () => {}
}, rd = 0, id = 1;
function ad(e) {
	var t = mr(e, nd), n = t.animationId, r = t.isActive, i = t.canBegin, a = t.duration, o = t.easing, s = t.begin, c = t.onAnimationEnd, l = t.onAnimationStart, u = t.children, d = Rl(), f = r === "auto" ? !jl.isSsr && !d : r, p = Ru(t.animationController), m = Xu(Ke(f ? rd : id), 2), h = m[0], g = m[1];
	return I(() => {
		f || g(id);
	}, [f]), I(() => {
		var e = Iu(o);
		return !f || !i || e == null ? ir : p(new Yu(), new Ju({
			animationId: n,
			easing: e,
			animationDuration: a,
			animationBegin: s,
			onAnimationStart: l,
			onAnimationEnd: c,
			from: rd,
			to: id
		}), g);
	}, [
		p,
		n,
		f,
		i,
		a,
		o,
		s,
		l,
		c
	]), u(Number(h));
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/useAnimationId.js
function od(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "animation-", n = L(Zn(t)), r = L(e);
	return r.current !== e && (n.current = Zn(t), r.current = e), n.current;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/animation/util.js
var sd = (e) => e.replace(/([A-Z])/g, (e) => `-${e.toLowerCase()}`), cd = (e, t, n) => e.map((e) => `${sd(e)} ${t}ms ${n}`).join(","), ld = ["radius"], ud = ["radius"], dd, fd, pd, md, hd, gd, _d, vd, yd, bd;
function xd(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Sd(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? xd(Object(n), !0).forEach(function(t) {
			Cd(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : xd(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Cd(e, t, n) {
	return (t = wd(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function wd(e) {
	var t = Td(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Td(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Ed() {
	return Ed = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, Ed.apply(null, arguments);
}
function Dd(e, t) {
	if (e == null) return {};
	var n, r, i = Od(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Od(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function kd(e, t) {
	return Pd(e) || Nd(e, t) || jd(e, t) || Ad();
}
function Ad() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function jd(e, t) {
	if (e) {
		if (typeof e == "string") return Md(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? Md(e, t) : void 0;
	}
}
function Md(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Nd(e, t) {
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
function Pd(e) {
	if (Array.isArray(e)) return e;
}
function Fd(e, t) {
	return t ||= e.slice(0), Object.freeze(Object.defineProperties(e, { raw: { value: Object.freeze(t) } }));
}
var Id = (e, t, n, r, i) => {
	var a = Un(n), o = Un(r), s = Math.min(Math.abs(a) / 2, Math.abs(o) / 2), c = o >= 0 ? 1 : -1, l = a >= 0 ? 1 : -1, u = +(o >= 0 && a >= 0 || o < 0 && a < 0), d;
	if (s > 0 && Array.isArray(i)) {
		for (var f = [
			0,
			0,
			0,
			0
		], p = 0, m = 4; p < m; p++) {
			var h = i[p] ?? 0;
			f[p] = h > s ? s : h;
		}
		d = Wn(dd ||= Fd([
			"M",
			",",
			""
		]), e, t + c * f[0]), f[0] > 0 && (d += Wn(fd ||= Fd([
			"A ",
			",",
			",0,0,",
			",",
			",",
			""
		]), f[0], f[0], u, e + l * f[0], t)), d += Wn(pd ||= Fd([
			"L ",
			",",
			""
		]), e + n - l * f[1], t), f[1] > 0 && (d += Wn(md ||= Fd([
			"A ",
			",",
			",0,0,",
			",\n        ",
			",",
			""
		]), f[1], f[1], u, e + n, t + c * f[1])), d += Wn(hd ||= Fd([
			"L ",
			",",
			""
		]), e + n, t + r - c * f[2]), f[2] > 0 && (d += Wn(gd ||= Fd([
			"A ",
			",",
			",0,0,",
			",\n        ",
			",",
			""
		]), f[2], f[2], u, e + n - l * f[2], t + r)), d += Wn(_d ||= Fd([
			"L ",
			",",
			""
		]), e + l * f[3], t + r), f[3] > 0 && (d += Wn(vd ||= Fd([
			"A ",
			",",
			",0,0,",
			",\n        ",
			",",
			""
		]), f[3], f[3], u, e, t + r - c * f[3])), d += "Z";
	} else if (s > 0 && i === +i && i > 0) {
		var g = Math.min(s, i);
		d = Wn(yd ||= Fd(/* @__PURE__ */ "M .,.\n            A .,.,0,0,.,.,.\n            L .,.\n            A .,.,0,0,.,.,.\n            L .,.\n            A .,.,0,0,.,.,.\n            L .,.\n            A .,.,0,0,.,.,. Z".split(".")), e, t + c * g, g, g, u, e + l * g, t, e + n - l * g, t, g, g, u, e + n, t + c * g, e + n, t + r - c * g, g, g, u, e + n - l * g, t + r, e + l * g, t + r, g, g, u, e, t + r - c * g);
	} else d = Wn(bd ||= Fd([
		"M ",
		",",
		" h ",
		" v ",
		" h ",
		" Z"
	]), e, t, n, r, -n);
	return d;
}, Ld = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	radius: 0,
	isAnimationActive: !1,
	isUpdateAnimationActive: !1,
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease"
}, Rd = (e) => {
	var t = mr(e, Ld), n = L(null), r = kd(Ke(-1), 2), i = r[0], a = r[1];
	I(() => {
		if (n.current && n.current.getTotalLength) try {
			var e = n.current.getTotalLength();
			e && a(e);
		} catch {}
	}, []);
	var o = t.x, s = t.y, c = t.width, l = t.height, u = t.radius, d = t.className, f = t.animationEasing, p = t.animationDuration, m = t.animationBegin, h = t.isAnimationActive, g = t.isUpdateAnimationActive, _ = L(c), v = L(l), y = L(o), b = L(s), x = od(Ge(() => ({
		x: o,
		y: s,
		width: c,
		height: l,
		radius: u
	}), [
		o,
		s,
		c,
		l,
		u
	]), "rectangle-");
	if (o !== +o || s !== +s || c !== +c || l !== +l || c === 0 || l === 0) return null;
	var S = z("recharts-rectangle", d);
	if (!g) {
		var C = Cn(t);
		C.radius;
		var w = Dd(C, ld);
		return /*#__PURE__*/ P.createElement("path", Ed({}, w, {
			x: Un(o),
			y: Un(s),
			width: Un(c),
			height: Un(l),
			radius: typeof u == "number" ? u : void 0,
			className: S,
			d: Id(o, s, c, l, u)
		}));
	}
	var T = _.current, E = v.current, D = y.current, O = b.current, k = `0px ${i === -1 ? 1 : i}px`, A = `${i}px ${i}px`, j = cd(["strokeDasharray"], p, typeof f == "string" ? f : Ld.animationEasing);
	return /*#__PURE__*/ P.createElement(ad, {
		animationId: x,
		key: x,
		canBegin: i > 0,
		duration: p,
		easing: f,
		isActive: g,
		begin: m
	}, (e) => {
		var r = er(T, c, e), i = er(E, l, e), a = er(D, o, e), d = er(O, s, e);
		n.current && (_.current = r, v.current = i, y.current = a, b.current = d);
		var f = h ? e > 0 ? {
			transition: j,
			strokeDasharray: A
		} : { strokeDasharray: k } : { strokeDasharray: A }, p = Cn(t);
		p.radius;
		var m = Dd(p, ud);
		return /*#__PURE__*/ P.createElement("path", Ed({}, m, {
			radius: typeof u == "number" ? u : void 0,
			className: S,
			d: Id(a, d, r, i, u),
			ref: n,
			style: Sd(Sd({}, f), t.style)
		}));
	});
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/PolarUtils.js
function zd(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Bd(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? zd(Object(n), !0).forEach(function(t) {
			Vd(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : zd(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Vd(e, t, n) {
	return (t = Hd(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Hd(e) {
	var t = Ud(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Ud(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Wd = Math.PI / 180, Gd = (e) => e * 180 / Math.PI, Kd = (e, t, n, r) => ({
	x: e + Math.cos(-Wd * r) * n,
	y: t + Math.sin(-Wd * r) * n
}), qd = function(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		width: 0,
		height: 0,
		brushBottom: 0
	};
	return Math.min(Math.abs(e - (n.left || 0) - (n.right || 0)), Math.abs(t - (n.top || 0) - (n.bottom || 0))) / 2;
}, Jd = (e, t) => {
	var n = e.x, r = e.y, i = t.x, a = t.y;
	return Math.sqrt((n - i) ** 2 + (r - a) ** 2);
}, Yd = (e, t) => {
	var n = e.x, r = e.y, i = t.cx, a = t.cy, o = Jd({
		x: n,
		y: r
	}, {
		x: i,
		y: a
	});
	if (o <= 0) return {
		radius: o,
		angle: 0
	};
	var s = (n - i) / o, c = Math.acos(s);
	return r > a && (c = 2 * Math.PI - c), {
		radius: o,
		angle: Gd(c),
		angleInRadian: c
	};
}, Xd = (e) => {
	var t = e.startAngle, n = e.endAngle, r = Math.floor(t / 360), i = Math.floor(n / 360), a = Math.min(r, i);
	return {
		startAngle: t - a * 360,
		endAngle: n - a * 360
	};
}, Zd = (e, t) => {
	var n = t.startAngle, r = t.endAngle, i = Math.floor(n / 360), a = Math.floor(r / 360);
	return e + Math.min(i, a) * 360;
}, Qd = (e, t) => {
	var n = e.relativeX, r = e.relativeY, i = Yd({
		x: n,
		y: r
	}, t), a = i.radius, o = i.angle, s = t.innerRadius, c = t.outerRadius;
	if (a < s || a > c || a === 0) return null;
	var l = Xd(t), u = l.startAngle, d = l.endAngle, f = o, p;
	if (u <= d) {
		for (; f > d;) f -= 360;
		for (; f < u;) f += 360;
		p = f >= u && f <= d;
	} else {
		for (; f > u;) f -= 360;
		for (; f < d;) f += 360;
		p = f >= d && f <= u;
	}
	return p ? Bd(Bd({}, t), {}, {
		radius: a,
		angle: Zd(f, t)
	}) : null;
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/cursor/getRadialCursorPoints.js
function $d(e) {
	var t = e.cx, n = e.cy, r = e.radius, i = e.startAngle, a = e.endAngle;
	return {
		points: [Kd(t, n, r, i), Kd(t, n, r, a)],
		cx: t,
		cy: n,
		radius: r,
		startAngle: i,
		endAngle: a
	};
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/shape/Sector.js
var ef, tf, nf, rf, af, of, sf;
function cf() {
	return cf = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, cf.apply(null, arguments);
}
function lf(e, t) {
	return t ||= e.slice(0), Object.freeze(Object.defineProperties(e, { raw: { value: Object.freeze(t) } }));
}
var uf = (e, t) => Kn(t - e) * Math.min(Math.abs(t - e), 359.999), df = (e) => {
	var t = e.cx, n = e.cy, r = e.radius, i = e.angle, a = e.sign, o = e.isExternal, s = e.cornerRadius, c = e.cornerIsExternal, l = s * (o ? 1 : -1) + r, u = Math.asin(s / l) / Wd, d = c ? i : i + a * u, f = Kd(t, n, l, d), p = Kd(t, n, r, d), m = c ? i - a * u : i;
	return {
		center: f,
		circleTangency: p,
		lineTangency: Kd(t, n, l * Math.cos(u * Wd), m),
		theta: u
	};
}, ff = (e) => {
	var t = e.cx, n = e.cy, r = e.innerRadius, i = e.outerRadius, a = e.startAngle, o = e.endAngle, s = uf(a, o), c = a + s, l = Kd(t, n, i, a), u = Kd(t, n, i, c), d = Wn(ef ||= lf([
		"M ",
		",",
		"\n    A ",
		",",
		",0,\n    ",
		",",
		",\n    ",
		",",
		"\n  "
	]), l.x, l.y, i, i, +(Math.abs(s) > 180), +(a > c), u.x, u.y);
	if (r > 0) {
		var f = Kd(t, n, r, a), p = Kd(t, n, r, c);
		d += Wn(tf ||= lf([
			"L ",
			",",
			"\n            A ",
			",",
			",0,\n            ",
			",",
			",\n            ",
			",",
			" Z"
		]), p.x, p.y, r, r, +(Math.abs(s) > 180), +(a <= c), f.x, f.y);
	} else d += Wn(nf ||= lf([
		"L ",
		",",
		" Z"
	]), t, n);
	return d;
}, pf = (e) => {
	var t = e.cx, n = e.cy, r = e.innerRadius, i = e.outerRadius, a = e.cornerRadius, o = e.forceCornerRadius, s = e.cornerIsExternal, c = e.startAngle, l = e.endAngle, u = Kn(l - c), d = df({
		cx: t,
		cy: n,
		radius: i,
		angle: c,
		sign: u,
		cornerRadius: a,
		cornerIsExternal: s
	}), f = d.circleTangency, p = d.lineTangency, m = d.theta, h = df({
		cx: t,
		cy: n,
		radius: i,
		angle: l,
		sign: -u,
		cornerRadius: a,
		cornerIsExternal: s
	}), g = h.circleTangency, _ = h.lineTangency, v = h.theta, y = s ? Math.abs(c - l) : Math.abs(c - l) - m - v;
	if (y < 0) return o ? Wn(rf ||= lf([
		"M ",
		",",
		"\n        a",
		",",
		",0,0,1,",
		",0\n        a",
		",",
		",0,0,1,",
		",0\n      "
	]), p.x, p.y, a, a, a * 2, a, a, -a * 2) : ff({
		cx: t,
		cy: n,
		innerRadius: r,
		outerRadius: i,
		startAngle: c,
		endAngle: l
	});
	var b = Wn(af ||= lf([
		"M ",
		",",
		"\n    A",
		",",
		",0,0,",
		",",
		",",
		"\n    A",
		",",
		",0,",
		",",
		",",
		",",
		"\n    A",
		",",
		",0,0,",
		",",
		",",
		"\n  "
	]), p.x, p.y, a, a, +(u < 0), f.x, f.y, i, i, +(y > 180), +(u < 0), g.x, g.y, a, a, +(u < 0), _.x, _.y);
	if (r > 0) {
		var x = df({
			cx: t,
			cy: n,
			radius: r,
			angle: c,
			sign: u,
			isExternal: !0,
			cornerRadius: a,
			cornerIsExternal: s
		}), S = x.circleTangency, C = x.lineTangency, w = x.theta, T = df({
			cx: t,
			cy: n,
			radius: r,
			angle: l,
			sign: -u,
			isExternal: !0,
			cornerRadius: a,
			cornerIsExternal: s
		}), E = T.circleTangency, D = T.lineTangency, O = T.theta, k = s ? Math.abs(c - l) : Math.abs(c - l) - w - O;
		if (k < 0 && a === 0) return `${b}L${t},${n}Z`;
		b += Wn(of ||= lf([
			"L",
			",",
			"\n      A",
			",",
			",0,0,",
			",",
			",",
			"\n      A",
			",",
			",0,",
			",",
			",",
			",",
			"\n      A",
			",",
			",0,0,",
			",",
			",",
			"Z"
		]), D.x, D.y, a, a, +(u < 0), E.x, E.y, r, r, +(k > 180), +(u > 0), S.x, S.y, a, a, +(u < 0), C.x, C.y);
	} else b += Wn(sf ||= lf([
		"L",
		",",
		"Z"
	]), t, n);
	return b;
}, mf = {
	cx: 0,
	cy: 0,
	innerRadius: 0,
	outerRadius: 0,
	startAngle: 0,
	endAngle: 0,
	cornerRadius: 0,
	forceCornerRadius: !1,
	cornerIsExternal: !1
}, hf = (e) => {
	var t = mr(e, mf), n = t.cx, r = t.cy, i = t.innerRadius, a = t.outerRadius, o = t.cornerRadius, s = t.forceCornerRadius, c = t.cornerIsExternal, l = t.startAngle, u = t.endAngle, d = t.className;
	if (a < i || l === u) return null;
	var f = z("recharts-sector", d), p = a - i, m = Qn(o, p, 0, !0), h = m > 0 && Math.abs(l - u) < 360 ? pf({
		cx: n,
		cy: r,
		innerRadius: i,
		outerRadius: a,
		cornerRadius: Math.min(m, p / 2),
		forceCornerRadius: s,
		cornerIsExternal: c,
		startAngle: l,
		endAngle: u
	}) : ff({
		cx: n,
		cy: r,
		innerRadius: i,
		outerRadius: a,
		startAngle: l,
		endAngle: u
	});
	return /*#__PURE__*/ P.createElement("path", cf({}, Cn(t), {
		className: f,
		d: h
	}));
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/cursor/getCursorPoints.js
function gf(e, t, n) {
	if (e === "horizontal") return [{
		x: t.x,
		y: n.top
	}, {
		x: t.x,
		y: n.top + n.height
	}];
	if (e === "vertical") return [{
		x: n.left,
		y: t.y
	}, {
		x: n.left + n.width,
		y: t.y
	}];
	if (ar(t)) {
		if (e === "centric") {
			var r = t.cx, i = t.cy, a = t.innerRadius, o = t.outerRadius, s = t.angle, c = Kd(r, i, a, s), l = Kd(r, i, o, s);
			return [{
				x: c.x,
				y: c.y
			}, {
				x: l.x,
				y: l.y
			}];
		}
		return $d(t);
	}
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/util/toNumber.js
var _f = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = di();
	function n(e) {
		return t.isSymbol(e) ? NaN : Number(e);
	}
	e.toNumber = n;
})), vf = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = _f();
	function n(e) {
		return e ? (e = t.toNumber(e), e === Infinity || e === -Infinity ? (e < 0 ? -1 : 1) * Number.MAX_VALUE : e === e ? e : 0) : e === 0 ? e : 0;
	}
	e.toFinite = n;
})), yf = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, Symbol.toStringTag, { value: "Module" });
	var t = hi(), n = vf();
	function r(e, r, i) {
		i && typeof i != "number" && t.isIterateeCall(e, r, i) && (r = i = void 0), e = n.toFinite(e), r === void 0 ? (r = e, e = 0) : r = n.toFinite(r), i = i === void 0 ? e < r ? 1 : -1 : n.toFinite(i);
		let a = Math.max(Math.ceil((r - e) / (i || 1)), 0), o = Array(a);
		for (let t = 0; t < a; t++) o[t] = e, e += i;
		return o;
	}
	e.range = r;
})), bf = /* @__PURE__ */ n(((e, t) => {
	t.exports = yf().range;
})), xf = (e) => e.chartData, Sf = W([xf], (e) => {
	var t = e.chartData == null ? 0 : e.chartData.length - 1;
	return {
		chartData: e.chartData,
		computedData: e.computedData,
		dataEndIndex: t,
		dataStartIndex: 0
	};
}), Cf = (e, t, n, r) => r ? Sf(e) : xf(e), wf = (e, t, n) => n ? Sf(e) : xf(e), Tf = W([Cf], (e) => {
	var t = e.chartData, n = e.dataStartIndex, r = e.dataEndIndex;
	return t == null ? [] : t.slice(n, r + 1);
});
W([Sf], (e) => {
	var t = e.chartData, n = e.dataStartIndex, r = e.dataEndIndex;
	return t == null ? [] : t.slice(n, r + 1);
});
var Ef = W([xf], (e) => {
	var t = e.chartData, n = e.dataStartIndex, r = e.dataEndIndex;
	return t == null ? [] : t.slice(n, r + 1);
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/isDomainSpecifiedByUser.js
function Df(e, t) {
	return Mf(e) || jf(e, t) || kf(e, t) || Of();
}
function Of() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function kf(e, t) {
	if (e) {
		if (typeof e == "string") return Af(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? Af(e, t) : void 0;
	}
}
function Af(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function jf(e, t) {
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
function Mf(e) {
	if (Array.isArray(e)) return e;
}
function Nf(e) {
	if (Array.isArray(e) && e.length === 2) {
		var t = Df(e, 2), n = t[0], r = t[1];
		if (q(n) && q(r)) return !0;
	}
	return !1;
}
function Pf(e, t, n) {
	return n ? e : [Math.min(e[0], t[0]), Math.max(e[1], t[1])];
}
function Ff(e, t) {
	if (t && typeof e != "function" && Array.isArray(e) && e.length === 2) {
		var n = Df(e, 2), r = n[0], i = n[1], a, o;
		if (q(r)) a = r;
		else if (typeof r == "function") return;
		if (q(i)) o = i;
		else if (typeof i == "function") return;
		var s = [a, o];
		if (Nf(s)) return s;
	}
}
function If(e, t, n) {
	if (n || t != null) {
		if (typeof e == "function" && t != null) try {
			var r = e(t, n);
			if (Nf(r)) return Pf(r, t, n);
		} catch {}
		if (Array.isArray(e) && e.length === 2) {
			var i = Df(e, 2), a = i[0], o = i[1], s, c;
			if (a === "auto") t != null && (s = Math.min(...t));
			else if (B(a)) s = a;
			else if (typeof a == "function") try {
				t != null && (s = a(t?.[0]));
			} catch {}
			else if (typeof a == "string" && Js.test(a)) {
				var l = Js.exec(a);
				if (l == null || l[1] == null || t == null) s = void 0;
				else {
					var u = +l[1];
					s = t[0] - u;
				}
			} else s = t?.[0];
			if (o === "auto") t != null && (c = Math.max(...t));
			else if (B(o)) c = o;
			else if (typeof o == "function") try {
				t != null && (c = o(t?.[1]));
			} catch {}
			else if (typeof o == "string" && Ys.test(o)) {
				var d = Ys.exec(o);
				if (d == null || d[1] == null || t == null) c = void 0;
				else {
					var f = +d[1];
					c = t[1] + f;
				}
			} else c = t?.[1];
			var p = [s, c];
			if (Nf(p)) return t == null ? p : Pf(p, t, n);
		}
	}
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/scale/util/arithmetic.js
var Y = /* @__PURE__ */ e((/* @__PURE__ */ n(((e, t, n) => {
	(function(e) {
		var n = 1e9, r = {
			precision: 20,
			rounding: 4,
			toExpNeg: -7,
			toExpPos: 21,
			LN10: "2.302585092994045684017991454684364207601101488628772976033327900967572609677352480235997205089598298341967784042286"
		}, i = !0, a = "[DecimalError] ", o = a + "Invalid argument: ", s = a + "Exponent out of range: ", c = Math.floor, l = Math.pow, u = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i, d, f = 1e7, p = 7, m = 9007199254740991, h = c(m / p), g = {};
		g.absoluteValue = g.abs = function() {
			var e = new this.constructor(this);
			return e.s &&= 1, e;
		}, g.comparedTo = g.cmp = function(e) {
			var t, n, r, i, a = this;
			if (e = new a.constructor(e), a.s !== e.s) return a.s || -e.s;
			if (a.e !== e.e) return a.e > e.e ^ a.s < 0 ? 1 : -1;
			for (r = a.d.length, i = e.d.length, t = 0, n = r < i ? r : i; t < n; ++t) if (a.d[t] !== e.d[t]) return a.d[t] > e.d[t] ^ a.s < 0 ? 1 : -1;
			return r === i ? 0 : r > i ^ a.s < 0 ? 1 : -1;
		}, g.decimalPlaces = g.dp = function() {
			var e = this, t = e.d.length - 1, n = (t - e.e) * p;
			if (t = e.d[t], t) for (; t % 10 == 0; t /= 10) n--;
			return n < 0 ? 0 : n;
		}, g.dividedBy = g.div = function(e) {
			return b(this, new this.constructor(e));
		}, g.dividedToIntegerBy = g.idiv = function(e) {
			var t = this, n = t.constructor;
			return D(b(t, new n(e), 0, 1), n.precision);
		}, g.equals = g.eq = function(e) {
			return !this.cmp(e);
		}, g.exponent = function() {
			return S(this);
		}, g.greaterThan = g.gt = function(e) {
			return this.cmp(e) > 0;
		}, g.greaterThanOrEqualTo = g.gte = function(e) {
			return this.cmp(e) >= 0;
		}, g.isInteger = g.isint = function() {
			return this.e > this.d.length - 2;
		}, g.isNegative = g.isneg = function() {
			return this.s < 0;
		}, g.isPositive = g.ispos = function() {
			return this.s > 0;
		}, g.isZero = function() {
			return this.s === 0;
		}, g.lessThan = g.lt = function(e) {
			return this.cmp(e) < 0;
		}, g.lessThanOrEqualTo = g.lte = function(e) {
			return this.cmp(e) < 1;
		}, g.logarithm = g.log = function(e) {
			var t, n = this, r = n.constructor, o = r.precision, s = o + 5;
			if (e === void 0) e = new r(10);
			else if (e = new r(e), e.s < 1 || e.eq(d)) throw Error(a + "NaN");
			if (n.s < 1) throw Error(a + (n.s ? "NaN" : "-Infinity"));
			return n.eq(d) ? new r(0) : (i = !1, t = b(T(n, s), T(e, s), s), i = !0, D(t, o));
		}, g.minus = g.sub = function(e) {
			var t = this;
			return e = new t.constructor(e), t.s == e.s ? O(t, e) : _(t, (e.s = -e.s, e));
		}, g.modulo = g.mod = function(e) {
			var t, n = this, r = n.constructor, o = r.precision;
			if (e = new r(e), !e.s) throw Error(a + "NaN");
			return n.s ? (i = !1, t = b(n, e, 0, 1).times(e), i = !0, n.minus(t)) : D(new r(n), o);
		}, g.naturalExponential = g.exp = function() {
			return x(this);
		}, g.naturalLogarithm = g.ln = function() {
			return T(this);
		}, g.negated = g.neg = function() {
			var e = new this.constructor(this);
			return e.s = -e.s || 0, e;
		}, g.plus = g.add = function(e) {
			var t = this;
			return e = new t.constructor(e), t.s == e.s ? _(t, e) : O(t, (e.s = -e.s, e));
		}, g.precision = g.sd = function(e) {
			var t, n, r, i = this;
			if (e !== void 0 && e !== !!e && e !== 1 && e !== 0) throw Error(o + e);
			if (t = S(i) + 1, r = i.d.length - 1, n = r * p + 1, r = i.d[r], r) {
				for (; r % 10 == 0; r /= 10) n--;
				for (r = i.d[0]; r >= 10; r /= 10) n++;
			}
			return e && t > n ? t : n;
		}, g.squareRoot = g.sqrt = function() {
			var e, t, n, r, o, s, l, u = this, d = u.constructor;
			if (u.s < 1) {
				if (!u.s) return new d(0);
				throw Error(a + "NaN");
			}
			for (e = S(u), i = !1, o = Math.sqrt(+u), o == 0 || o == 1 / 0 ? (t = y(u.d), (t.length + e) % 2 == 0 && (t += "0"), o = Math.sqrt(t), e = c((e + 1) / 2) - (e < 0 || e % 2), o == 1 / 0 ? t = "5e" + e : (t = o.toExponential(), t = t.slice(0, t.indexOf("e") + 1) + e), r = new d(t)) : r = new d(o.toString()), n = d.precision, o = l = n + 3;;) if (s = r, r = s.plus(b(u, s, l + 2)).times(.5), y(s.d).slice(0, l) === (t = y(r.d)).slice(0, l)) {
				if (t = t.slice(l - 3, l + 1), o == l && t == "4999") {
					if (D(s, n + 1, 0), s.times(s).eq(u)) {
						r = s;
						break;
					}
				} else if (t != "9999") break;
				l += 4;
			}
			return i = !0, D(r, n);
		}, g.times = g.mul = function(e) {
			var t, n, r, a, o, s, c, l, u, d = this, p = d.constructor, m = d.d, h = (e = new p(e)).d;
			if (!d.s || !e.s) return new p(0);
			for (e.s *= d.s, n = d.e + e.e, l = m.length, u = h.length, l < u && (o = m, m = h, h = o, s = l, l = u, u = s), o = [], s = l + u, r = s; r--;) o.push(0);
			for (r = u; --r >= 0;) {
				for (t = 0, a = l + r; a > r;) c = o[a] + h[r] * m[a - r - 1] + t, o[a--] = c % f | 0, t = c / f | 0;
				o[a] = (o[a] + t) % f | 0;
			}
			for (; !o[--s];) o.pop();
			return t ? ++n : o.shift(), e.d = o, e.e = n, i ? D(e, p.precision) : e;
		}, g.toDecimalPlaces = g.todp = function(e, t) {
			var r = this, i = r.constructor;
			return r = new i(r), e === void 0 ? r : (v(e, 0, n), t === void 0 ? t = i.rounding : v(t, 0, 8), D(r, e + S(r) + 1, t));
		}, g.toExponential = function(e, t) {
			var r, i = this, a = i.constructor;
			return e === void 0 ? r = k(i, !0) : (v(e, 0, n), t === void 0 ? t = a.rounding : v(t, 0, 8), i = D(new a(i), e + 1, t), r = k(i, !0, e + 1)), r;
		}, g.toFixed = function(e, t) {
			var r, i, a = this, o = a.constructor;
			return e === void 0 ? k(a) : (v(e, 0, n), t === void 0 ? t = o.rounding : v(t, 0, 8), i = D(new o(a), e + S(a) + 1, t), r = k(i.abs(), !1, e + S(i) + 1), a.isneg() && !a.isZero() ? "-" + r : r);
		}, g.toInteger = g.toint = function() {
			var e = this, t = e.constructor;
			return D(new t(e), S(e) + 1, t.rounding);
		}, g.toNumber = function() {
			return +this;
		}, g.toPower = g.pow = function(e) {
			var t, n, r, o, s, l, u = this, f = u.constructor, h = 12, g = +(e = new f(e));
			if (!e.s) return new f(d);
			if (u = new f(u), !u.s) {
				if (e.s < 1) throw Error(a + "Infinity");
				return u;
			}
			if (u.eq(d)) return u;
			if (r = f.precision, e.eq(d)) return D(u, r);
			if (t = e.e, n = e.d.length - 1, l = t >= n, s = u.s, !l) {
				if (s < 0) throw Error(a + "NaN");
			} else if ((n = g < 0 ? -g : g) <= m) {
				for (o = new f(d), t = Math.ceil(r / p + 4), i = !1; n % 2 && (o = o.times(u), A(o.d, t)), n = c(n / 2), n !== 0;) u = u.times(u), A(u.d, t);
				return i = !0, e.s < 0 ? new f(d).div(o) : D(o, r);
			}
			return s = s < 0 && e.d[Math.max(t, n)] & 1 ? -1 : 1, u.s = 1, i = !1, o = e.times(T(u, r + h)), i = !0, o = x(o), o.s = s, o;
		}, g.toPrecision = function(e, t) {
			var r, i, a = this, o = a.constructor;
			return e === void 0 ? (r = S(a), i = k(a, r <= o.toExpNeg || r >= o.toExpPos)) : (v(e, 1, n), t === void 0 ? t = o.rounding : v(t, 0, 8), a = D(new o(a), e, t), r = S(a), i = k(a, e <= r || r <= o.toExpNeg, e)), i;
		}, g.toSignificantDigits = g.tosd = function(e, t) {
			var r = this, i = r.constructor;
			return e === void 0 ? (e = i.precision, t = i.rounding) : (v(e, 1, n), t === void 0 ? t = i.rounding : v(t, 0, 8)), D(new i(r), e, t);
		}, g.toString = g.valueOf = g.val = g.toJSON = function() {
			var e = this, t = S(e), n = e.constructor;
			return k(e, t <= n.toExpNeg || t >= n.toExpPos);
		};
		function _(e, t) {
			var n, r, a, o, s, c, l, u, d = e.constructor, m = d.precision;
			if (!e.s || !t.s) return t.s || (t = new d(e)), i ? D(t, m) : t;
			if (l = e.d, u = t.d, s = e.e, a = t.e, l = l.slice(), o = s - a, o) {
				for (o < 0 ? (r = l, o = -o, c = u.length) : (r = u, a = s, c = l.length), s = Math.ceil(m / p), c = s > c ? s + 1 : c + 1, o > c && (o = c, r.length = 1), r.reverse(); o--;) r.push(0);
				r.reverse();
			}
			for (c = l.length, o = u.length, c - o < 0 && (o = c, r = u, u = l, l = r), n = 0; o;) n = (l[--o] = l[o] + u[o] + n) / f | 0, l[o] %= f;
			for (n && (l.unshift(n), ++a), c = l.length; l[--c] == 0;) l.pop();
			return t.d = l, t.e = a, i ? D(t, m) : t;
		}
		function v(e, t, n) {
			if (e !== ~~e || e < t || e > n) throw Error(o + e);
		}
		function y(e) {
			var t, n, r, i = e.length - 1, a = "", o = e[0];
			if (i > 0) {
				for (a += o, t = 1; t < i; t++) r = e[t] + "", n = p - r.length, n && (a += w(n)), a += r;
				o = e[t], r = o + "", n = p - r.length, n && (a += w(n));
			} else if (o === 0) return "0";
			for (; o % 10 == 0;) o /= 10;
			return a + o;
		}
		var b = (function() {
			function e(e, t) {
				var n, r = 0, i = e.length;
				for (e = e.slice(); i--;) n = e[i] * t + r, e[i] = n % f | 0, r = n / f | 0;
				return r && e.unshift(r), e;
			}
			function t(e, t, n, r) {
				var i, a;
				if (n != r) a = n > r ? 1 : -1;
				else for (i = a = 0; i < n; i++) if (e[i] != t[i]) {
					a = e[i] > t[i] ? 1 : -1;
					break;
				}
				return a;
			}
			function n(e, t, n) {
				for (var r = 0; n--;) e[n] -= r, r = +(e[n] < t[n]), e[n] = r * f + e[n] - t[n];
				for (; !e[0] && e.length > 1;) e.shift();
			}
			return function(r, i, o, s) {
				var c, l, u, d, m, h, g, _, v, y, b, x, C, w, T, E, O, k, A = r.constructor, j = r.s == i.s ? 1 : -1, M = r.d, N = i.d;
				if (!r.s) return new A(r);
				if (!i.s) throw Error(a + "Division by zero");
				for (l = r.e - i.e, O = N.length, T = M.length, g = new A(j), _ = g.d = [], u = 0; N[u] == (M[u] || 0);) ++u;
				if (N[u] > (M[u] || 0) && --l, x = o == null ? o = A.precision : s ? o + (S(r) - S(i)) + 1 : o, x < 0) return new A(0);
				if (x = x / p + 2 | 0, u = 0, O == 1) for (d = 0, N = N[0], x++; (u < T || d) && x--; u++) C = d * f + (M[u] || 0), _[u] = C / N | 0, d = C % N | 0;
				else {
					for (d = f / (N[0] + 1) | 0, d > 1 && (N = e(N, d), M = e(M, d), O = N.length, T = M.length), w = O, v = M.slice(0, O), y = v.length; y < O;) v[y++] = 0;
					k = N.slice(), k.unshift(0), E = N[0], N[1] >= f / 2 && ++E;
					do
						d = 0, c = t(N, v, O, y), c < 0 ? (b = v[0], O != y && (b = b * f + (v[1] || 0)), d = b / E | 0, d > 1 ? (d >= f && (d = f - 1), m = e(N, d), h = m.length, y = v.length, c = t(m, v, h, y), c == 1 && (d--, n(m, O < h ? k : N, h))) : (d == 0 && (c = d = 1), m = N.slice()), h = m.length, h < y && m.unshift(0), n(v, m, y), c == -1 && (y = v.length, c = t(N, v, O, y), c < 1 && (d++, n(v, O < y ? k : N, y))), y = v.length) : c === 0 && (d++, v = [0]), _[u++] = d, c && v[0] ? v[y++] = M[w] || 0 : (v = [M[w]], y = 1);
					while ((w++ < T || v[0] !== void 0) && x--);
				}
				return _[0] || _.shift(), g.e = l, D(g, s ? o + S(g) + 1 : o);
			};
		})();
		function x(e, t) {
			var n, r, a, o, c, u, f = 0, p = 0, m = e.constructor, h = m.precision;
			if (S(e) > 16) throw Error(s + S(e));
			if (!e.s) return new m(d);
			for (t == null ? (i = !1, u = h) : u = t, c = new m(.03125); e.abs().gte(.1);) e = e.times(c), p += 5;
			for (r = Math.log(l(2, p)) / Math.LN10 * 2 + 5 | 0, u += r, n = a = o = new m(d), m.precision = u;;) {
				if (a = D(a.times(e), u), n = n.times(++f), c = o.plus(b(a, n, u)), y(c.d).slice(0, u) === y(o.d).slice(0, u)) {
					for (; p--;) o = D(o.times(o), u);
					return m.precision = h, t == null ? (i = !0, D(o, h)) : o;
				}
				o = c;
			}
		}
		function S(e) {
			for (var t = e.e * p, n = e.d[0]; n >= 10; n /= 10) t++;
			return t;
		}
		function C(e, t, n) {
			if (t > e.LN10.sd()) throw i = !0, n && (e.precision = n), Error(a + "LN10 precision limit exceeded");
			return D(new e(e.LN10), t);
		}
		function w(e) {
			for (var t = ""; e--;) t += "0";
			return t;
		}
		function T(e, t) {
			var n, r, o, s, c, l, u, f, p, m = 1, h = 10, g = e, _ = g.d, v = g.constructor, x = v.precision;
			if (g.s < 1) throw Error(a + (g.s ? "NaN" : "-Infinity"));
			if (g.eq(d)) return new v(0);
			if (t == null ? (i = !1, f = x) : f = t, g.eq(10)) return t ?? (i = !0), C(v, f);
			if (f += h, v.precision = f, n = y(_), r = n.charAt(0), s = S(g), Math.abs(s) < 0x5543df729c000) {
				for (; r < 7 && r != 1 || r == 1 && n.charAt(1) > 3;) g = g.times(e), n = y(g.d), r = n.charAt(0), m++;
				s = S(g), r > 1 ? (g = new v("0." + n), s++) : g = new v(r + "." + n.slice(1));
			} else return u = C(v, f + 2, x).times(s + ""), g = T(new v(r + "." + n.slice(1)), f - h).plus(u), v.precision = x, t == null ? (i = !0, D(g, x)) : g;
			for (l = c = g = b(g.minus(d), g.plus(d), f), p = D(g.times(g), f), o = 3;;) {
				if (c = D(c.times(p), f), u = l.plus(b(c, new v(o), f)), y(u.d).slice(0, f) === y(l.d).slice(0, f)) return l = l.times(2), s !== 0 && (l = l.plus(C(v, f + 2, x).times(s + ""))), l = b(l, new v(m), f), v.precision = x, t == null ? (i = !0, D(l, x)) : l;
				l = u, o += 2;
			}
		}
		function E(e, t) {
			var n, r, a;
			for ((n = t.indexOf(".")) > -1 && (t = t.replace(".", "")), (r = t.search(/e/i)) > 0 ? (n < 0 && (n = r), n += +t.slice(r + 1), t = t.substring(0, r)) : n < 0 && (n = t.length), r = 0; t.charCodeAt(r) === 48;) ++r;
			for (a = t.length; t.charCodeAt(a - 1) === 48;) --a;
			if (t = t.slice(r, a), t) {
				if (a -= r, n = n - r - 1, e.e = c(n / p), e.d = [], r = (n + 1) % p, n < 0 && (r += p), r < a) {
					for (r && e.d.push(+t.slice(0, r)), a -= p; r < a;) e.d.push(+t.slice(r, r += p));
					t = t.slice(r), r = p - t.length;
				} else r -= a;
				for (; r--;) t += "0";
				if (e.d.push(+t), i && (e.e > h || e.e < -h)) throw Error(s + n);
			} else e.s = 0, e.e = 0, e.d = [0];
			return e;
		}
		function D(e, t, n) {
			var r, a, o, u, d, m, g, _, v = e.d;
			for (u = 1, o = v[0]; o >= 10; o /= 10) u++;
			if (r = t - u, r < 0) r += p, a = t, g = v[_ = 0];
			else {
				if (_ = Math.ceil((r + 1) / p), o = v.length, _ >= o) return e;
				for (g = o = v[_], u = 1; o >= 10; o /= 10) u++;
				r %= p, a = r - p + u;
			}
			if (n !== void 0 && (o = l(10, u - a - 1), d = g / o % 10 | 0, m = t < 0 || v[_ + 1] !== void 0 || g % o, m = n < 4 ? (d || m) && (n == 0 || n == (e.s < 0 ? 3 : 2)) : d > 5 || d == 5 && (n == 4 || m || n == 6 && (r > 0 ? a > 0 ? g / l(10, u - a) : 0 : v[_ - 1]) % 10 & 1 || n == (e.s < 0 ? 8 : 7))), t < 1 || !v[0]) return m ? (o = S(e), v.length = 1, t = t - o - 1, v[0] = l(10, (p - t % p) % p), e.e = c(-t / p) || 0) : (v.length = 1, v[0] = e.e = e.s = 0), e;
			if (r == 0 ? (v.length = _, o = 1, _--) : (v.length = _ + 1, o = l(10, p - r), v[_] = a > 0 ? (g / l(10, u - a) % l(10, a) | 0) * o : 0), m) for (;;) if (_ == 0) {
				(v[0] += o) == f && (v[0] = 1, ++e.e);
				break;
			} else {
				if (v[_] += o, v[_] != f) break;
				v[_--] = 0, o = 1;
			}
			for (r = v.length; v[--r] === 0;) v.pop();
			if (i && (e.e > h || e.e < -h)) throw Error(s + S(e));
			return e;
		}
		function O(e, t) {
			var n, r, a, o, s, c, l, u, d, m, h = e.constructor, g = h.precision;
			if (!e.s || !t.s) return t.s ? t.s = -t.s : t = new h(e), i ? D(t, g) : t;
			if (l = e.d, m = t.d, r = t.e, u = e.e, l = l.slice(), s = u - r, s) {
				for (d = s < 0, d ? (n = l, s = -s, c = m.length) : (n = m, r = u, c = l.length), a = Math.max(Math.ceil(g / p), c) + 2, s > a && (s = a, n.length = 1), n.reverse(), a = s; a--;) n.push(0);
				n.reverse();
			} else {
				for (a = l.length, c = m.length, d = a < c, d && (c = a), a = 0; a < c; a++) if (l[a] != m[a]) {
					d = l[a] < m[a];
					break;
				}
				s = 0;
			}
			for (d && (n = l, l = m, m = n, t.s = -t.s), c = l.length, a = m.length - c; a > 0; --a) l[c++] = 0;
			for (a = m.length; a > s;) {
				if (l[--a] < m[a]) {
					for (o = a; o && l[--o] === 0;) l[o] = f - 1;
					--l[o], l[a] += f;
				}
				l[a] -= m[a];
			}
			for (; l[--c] === 0;) l.pop();
			for (; l[0] === 0; l.shift()) --r;
			return l[0] ? (t.d = l, t.e = r, i ? D(t, g) : t) : new h(0);
		}
		function k(e, t, n) {
			var r, i = S(e), a = y(e.d), o = a.length;
			return t ? (n && (r = n - o) > 0 ? a = a.charAt(0) + "." + a.slice(1) + w(r) : o > 1 && (a = a.charAt(0) + "." + a.slice(1)), a = a + (i < 0 ? "e" : "e+") + i) : i < 0 ? (a = "0." + w(-i - 1) + a, n && (r = n - o) > 0 && (a += w(r))) : i >= o ? (a += w(i + 1 - o), n && (r = n - i - 1) > 0 && (a = a + "." + w(r))) : ((r = i + 1) < o && (a = a.slice(0, r) + "." + a.slice(r)), n && (r = n - o) > 0 && (i + 1 === o && (a += "."), a += w(r))), e.s < 0 ? "-" + a : a;
		}
		function A(e, t) {
			if (e.length > t) return e.length = t, !0;
		}
		function j(e) {
			var t, n, r;
			function i(e) {
				var t = this;
				if (!(t instanceof i)) return new i(e);
				if (t.constructor = i, e instanceof i) t.s = e.s, t.e = e.e, t.d = (e = e.d) ? e.slice() : e;
				else {
					if (typeof e == "number") {
						if (e * 0 != 0) throw Error(o + e);
						if (e > 0) t.s = 1;
						else if (e < 0) e = -e, t.s = -1;
						else {
							t.s = 0, t.e = 0, t.d = [0];
							return;
						}
						if (e === ~~e && e < 1e7) {
							t.e = 0, t.d = [e];
							return;
						}
						return E(t, e.toString());
					}
					if (typeof e != "string") throw Error(o + e);
					if (e.charCodeAt(0) === 45 ? (e = e.slice(1), t.s = -1) : t.s = 1, u.test(e)) E(t, e);
					else throw Error(o + e);
				}
			}
			if (i.prototype = g, i.ROUND_UP = 0, i.ROUND_DOWN = 1, i.ROUND_CEIL = 2, i.ROUND_FLOOR = 3, i.ROUND_HALF_UP = 4, i.ROUND_HALF_DOWN = 5, i.ROUND_HALF_EVEN = 6, i.ROUND_HALF_CEIL = 7, i.ROUND_HALF_FLOOR = 8, i.clone = j, i.config = i.set = M, e === void 0 && (e = {}), e) for (r = [
				"precision",
				"rounding",
				"toExpNeg",
				"toExpPos",
				"LN10"
			], t = 0; t < r.length;) e.hasOwnProperty(n = r[t++]) || (e[n] = this[n]);
			return i.config(e), i;
		}
		function M(e) {
			if (!e || typeof e != "object") throw Error(a + "Object expected");
			var t, r, i, s = [
				"precision",
				1,
				n,
				"rounding",
				0,
				8,
				"toExpNeg",
				-1 / 0,
				0,
				"toExpPos",
				0,
				1 / 0
			];
			for (t = 0; t < s.length; t += 3) if ((i = e[r = s[t]]) !== void 0) {
				if (c(i) === i && i >= s[t + 1] && i <= s[t + 2]) this[r] = i;
				else throw Error(o + r + ": " + i);
			}
			if ((i = e[r = "LN10"]) !== void 0) {
				if (i == Math.LN10) this[r] = new this(i);
				else throw Error(o + r + ": " + i);
			}
			return this;
		}
		r = j(r), r.default = r.Decimal = r, d = new r(1), typeof define == "function" && define.amd ? define(function() {
			return r;
		}) : t !== void 0 && t.exports ? t.exports = r : (e ||= typeof self < "u" && self && self.self == self ? self : Function("return this")(), e.Decimal = r);
	})(n);
})))());
function Lf(e) {
	return e === 0 ? 1 : Math.floor(new Y.default(e).abs().log(10).toNumber()) + 1;
}
function Rf(e, t, n) {
	for (var r = new Y.default(e), i = 0, a = []; r.lt(t) && i < 1e5;) a.push(r.toNumber()), r = r.add(n), i++;
	return a;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/scale/getNiceTickValues.js
function zf(e, t) {
	return Wf(e) || Uf(e, t) || Vf(e, t) || Bf();
}
function Bf() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Vf(e, t) {
	if (e) {
		if (typeof e == "string") return Hf(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? Hf(e, t) : void 0;
	}
}
function Hf(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Uf(e, t) {
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
function Wf(e) {
	if (Array.isArray(e)) return e;
}
var Gf = (e) => {
	var t = zf(e, 2), n = t[0], r = t[1], i = n, a = r;
	return n > r && (i = r, a = n), [i, a];
}, Kf = (e, t, n) => {
	if (e.lte(0)) return new Y.default(0);
	var r = Lf(e.toNumber()), i = new Y.default(10).pow(r), a = e.div(i), o = r === 1 ? .1 : .05, s = new Y.default(Math.ceil(a.div(o).toNumber())).add(n).mul(o).mul(i);
	return t ? new Y.default(s.toNumber()) : new Y.default(Math.ceil(s.toNumber()));
}, qf = (e, t, n) => {
	if (e.lte(0)) return new Y.default(0);
	var r = [
		1,
		2,
		2.5,
		5
	], i = e.toNumber(), a = Math.floor(new Y.default(i).abs().log(10).toNumber()), o = new Y.default(10).pow(a), s = e.div(o).toNumber(), c = r.findIndex((e) => e >= s - 1e-10);
	if (c === -1 && (o = o.mul(10), c = 0), c += n, c >= r.length) {
		var l = Math.floor(c / r.length);
		c %= r.length, o = o.mul(new Y.default(10).pow(l));
	}
	var u = r[c] ?? 1, d = new Y.default(u).mul(o);
	return t ? d : new Y.default(Math.ceil(d.toNumber()));
}, Jf = (e, t, n) => {
	var r = new Y.default(1), i = new Y.default(e);
	if (!i.isint() && n) {
		var a = Math.abs(e);
		a < 1 ? (r = new Y.default(10).pow(Lf(e) - 1), i = new Y.default(Math.floor(i.div(r).toNumber())).mul(r)) : a > 1 && (i = new Y.default(Math.floor(e)));
	} else e === 0 ? i = new Y.default(Math.floor((t - 1) / 2)) : n || (i = new Y.default(Math.floor(e)));
	for (var o = Math.floor((t - 1) / 2), s = [], c = 0; c < t; c++) s.push(i.add(new Y.default(c - o).mul(r)).toNumber());
	return s;
}, Yf = function(e, t, n, r) {
	var i = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : 0, a = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : Kf;
	if (!Number.isFinite((t - e) / (n - 1))) return {
		step: new Y.default(0),
		tickMin: new Y.default(0),
		tickMax: new Y.default(0)
	};
	var o = a(new Y.default(t).sub(e).div(n - 1), r, i), s;
	e <= 0 && t >= 0 ? s = new Y.default(0) : (s = new Y.default(e).add(t).div(2), s = s.sub(new Y.default(s).mod(o)));
	var c = Math.ceil(s.sub(e).div(o).toNumber()), l = Math.ceil(new Y.default(t).sub(s).div(o).toNumber()), u = c + l + 1;
	return u > n ? Yf(e, t, n, r, i + 1, a) : (u < n && (l = t > 0 ? l + (n - u) : l, c = t > 0 ? c : c + (n - u)), {
		step: o,
		tickMin: s.sub(new Y.default(c).mul(o)),
		tickMax: s.add(new Y.default(l).mul(o))
	});
}, Xf = function(e) {
	var t = zf(e, 2), n = t[0], r = t[1], i = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 6, a = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : !0, o = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : "auto", s = Math.max(i, 2), c = zf(Gf([n, r]), 2), l = c[0], u = c[1];
	if (l === -Infinity || u === Infinity) {
		var d = u === Infinity ? [l, ...Array(i - 1).fill(Infinity)] : [...Array(i - 1).fill(-Infinity), u];
		return n > r ? d.reverse() : d;
	}
	if (l === u) return Jf(l, i, a);
	var f = Yf(l, u, s, a, 0, o === "snap125" ? qf : Kf), p = f.step, m = f.tickMin, h = f.tickMax, g = Rf(m, h.add(new Y.default(.1).mul(p)), p);
	return n > r ? g.reverse() : g;
}, Zf = function(e, t) {
	var n = zf(e, 2), r = n[0], i = n[1], a = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : !0, o = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : "auto", s = zf(Gf([r, i]), 2), c = s[0], l = s[1];
	if (c === -Infinity || l === Infinity) return [r, i];
	if (c === l) return [c];
	var u = o === "snap125" ? qf : Kf, d = Math.max(t, 2), f = u(new Y.default(l).sub(c).div(d - 1), a, 0), p = [...Rf(new Y.default(c), new Y.default(l), f), l];
	if (a === !1) {
		p = p.map((e) => Math.round(e));
		var m = p.length - 1;
		m > 0 && p[m] === p[m - 1] && (p = p.slice(0, m));
	}
	return r > i ? p.reverse() : p;
}, Qf = (e) => e.rootProps.maxBarSize, $f = (e) => e.rootProps.barGap, ep = (e) => e.rootProps.barCategoryGap, tp = (e) => e.rootProps.barSize, np = (e) => e.rootProps.stackOffset, rp = (e) => e.rootProps.reverseStackOrder, ip = (e) => e.options.chartName, ap = (e) => e.rootProps.syncId, op = (e) => e.rootProps.syncMethod, sp = (e) => e.options.eventEmitter, cp = {
	grid: -100,
	barBackground: -50,
	area: 100,
	cursorRectangle: 200,
	bar: 300,
	line: 400,
	axis: 500,
	scatter: 600,
	activeBar: 1e3,
	cursorLine: 1100,
	activeDot: 1200,
	label: 2e3
}, lp = {
	allowDecimals: !1,
	allowDuplicatedCategory: !0,
	allowDataOverflow: !1,
	angle: 0,
	angleAxisId: 0,
	axisLine: !0,
	axisLineType: "polygon",
	cx: 0,
	cy: 0,
	hide: !1,
	includeHidden: !1,
	label: !1,
	niceTicks: "auto",
	orientation: "outer",
	reversed: !1,
	scale: "auto",
	tick: !0,
	tickLine: !0,
	tickSize: 8,
	type: "auto",
	zIndex: cp.axis
}, up = {
	allowDataOverflow: !1,
	allowDecimals: !1,
	allowDuplicatedCategory: !0,
	angle: 0,
	axisLine: !0,
	includeHidden: !1,
	hide: !1,
	niceTicks: "auto",
	label: !1,
	orientation: "right",
	radiusAxisId: 0,
	reversed: !1,
	scale: "auto",
	stroke: "#ccc",
	tick: !0,
	tickCount: 5,
	tickLine: !0,
	type: "auto",
	zIndex: cp.axis
}, dp = (e, t) => {
	if (e && t) return e != null && e.reversed ? [t[1], t[0]] : t;
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/getAxisTypeBasedOnLayout.js
function fp(e, t, n) {
	if (n !== "auto") return n;
	if (e != null) return Rs(e, t) ? "category" : "number";
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/polarAxisSelectors.js
function pp(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function mp(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? pp(Object(n), !0).forEach(function(t) {
			hp(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : pp(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function hp(e, t, n) {
	return (t = gp(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function gp(e) {
	var t = _p(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function _p(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var vp = {
	allowDataOverflow: lp.allowDataOverflow,
	allowDecimals: lp.allowDecimals,
	allowDuplicatedCategory: !1,
	dataKey: void 0,
	domain: void 0,
	id: lp.angleAxisId,
	includeHidden: !1,
	name: void 0,
	reversed: lp.reversed,
	scale: lp.scale,
	tick: lp.tick,
	tickCount: void 0,
	ticks: void 0,
	type: lp.type,
	unit: void 0,
	niceTicks: "auto"
}, yp = {
	allowDataOverflow: up.allowDataOverflow,
	allowDecimals: up.allowDecimals,
	allowDuplicatedCategory: up.allowDuplicatedCategory,
	dataKey: void 0,
	domain: void 0,
	id: up.radiusAxisId,
	includeHidden: up.includeHidden,
	name: void 0,
	reversed: up.reversed,
	scale: up.scale,
	tick: up.tick,
	tickCount: up.tickCount,
	ticks: void 0,
	type: up.type,
	unit: void 0,
	niceTicks: "auto"
}, bp = W([(e, t) => {
	if (t != null) return e.polarAxis.angleAxis[t];
}, Fc], (e, t) => {
	if (e != null) return e;
	var n = fp(t, "angleAxis", vp.type) ?? "category";
	return mp(mp({}, vp), {}, { type: n });
}), xp = W([(e, t) => e.polarAxis.radiusAxis[t], Fc], (e, t) => {
	if (e != null) return e;
	var n = fp(t, "radiusAxis", yp.type) ?? "category";
	return mp(mp({}, yp), {}, { type: n });
}), Sp = (e) => e.polarOptions, Cp = W([
	tc,
	nc,
	vc
], qd), wp = W([Sp, Cp], (e, t) => {
	if (e != null) return Qn(e.innerRadius, t, 0);
}), Tp = W([Sp, Cp], (e, t) => {
	if (e != null) return Qn(e.outerRadius, t, t * .8);
}), Ep = W([Sp], (e) => e == null ? [0, 0] : [e.startAngle, e.endAngle]);
W([bp, Ep], dp);
var Dp = W([
	Cp,
	wp,
	Tp
], (e, t, n) => {
	if (e != null && t != null && n != null) return [t, n];
});
W([xp, Dp], dp);
var Op = W([
	J,
	Sp,
	wp,
	Tp,
	tc,
	nc
], (e, t, n, r, i, a) => {
	if (!(e !== "centric" && e !== "radial" || t == null || n == null || r == null)) {
		var o = t.cx, s = t.cy, c = t.startAngle, l = t.endAngle;
		return {
			cx: Qn(o, i, i / 2),
			cy: Qn(s, a, a / 2),
			innerRadius: n,
			outerRadius: r,
			startAngle: c,
			endAngle: l,
			clockWise: !1
		};
	}
}), kp = (e, t) => t, Ap = (e, t, n) => n;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/stacks/getStackSeriesIdentifier.js
function jp(e) {
	return e?.id;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineDisplayedStackedData.js
function Mp(e, t, n) {
	var r = t.chartData, i = r === void 0 ? [] : r, a = n.allowDuplicatedCategory, o = n.dataKey, s = /* @__PURE__ */ new Map();
	return e.forEach((e) => {
		var t = e.data ?? i;
		if (t != null && t.length !== 0) {
			var n = jp(e);
			t.forEach((t, r) => {
				var i = o == null || a ? r : String(Is(t, o, null)), c = Is(t, e.dataKey, 0), l = s.has(i) ? s.get(i) : {};
				Object.assign(l, { [n]: c }), s.set(i, l);
			});
		}
	}), Array.from(s.values());
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/types/StackedGraphicalItem.js
function Np(e) {
	return "stackId" in e && e.stackId != null && e.dataKey != null;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/numberDomainEqualityCheck.js
var Pp = (e, t) => e === t ? !0 : e == null || t == null ? !1 : e[0] === t[0] && e[1] === t[1];
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/arrayEqualityCheck.js
function Fp(e, t) {
	return Array.isArray(e) && Array.isArray(t) && e.length === 0 && t.length === 0 ? !0 : e === t;
}
function Ip(e, t) {
	if (e.length === t.length) {
		for (var n = 0; n < e.length; n++) if (e[n] !== t[n]) return !1;
		return !0;
	}
	return !1;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/selectTooltipAxisType.js
var Lp = (e) => {
	var t = J(e);
	return t === "horizontal" ? "xAxis" : t === "vertical" ? "yAxis" : t === "centric" ? "angleAxis" : "radiusAxis";
}, Rp = (e) => e.tooltip.settings.axisId;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/scale/RechartsScale.js
function zp(e) {
	if (e != null) {
		var t = e.ticks, n = e.bandwidth, r = e.range(), i = [Math.min(...r), Math.max(...r)];
		return {
			domain: () => e.domain(),
			range: function(e) {
				function t() {
					return e.apply(this, arguments);
				}
				return t.toString = function() {
					return e.toString();
				}, t;
			}(() => i),
			rangeMin: () => i[0],
			rangeMax: () => i[1],
			isInRange(e) {
				var t = i[0], n = i[1];
				return t <= n ? e >= t && e <= n : e >= n && e <= t;
			},
			bandwidth: n ? () => n.call(e) : void 0,
			ticks: t ? (n) => t.call(e, n) : void 0,
			map: (t, n) => {
				var r = e(t);
				if (r != null) {
					if (e.bandwidth && n != null && n.position) {
						var i = e.bandwidth();
						switch (n.position) {
							case "middle":
								r += i / 2;
								break;
							case "end": r += i;
						}
					}
					return r;
				}
			}
		};
	}
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineCheckedDomain.js
var Bp = (e, t) => {
	if (t != null) switch (e) {
		case "linear":
			if (!Nf(t)) {
				for (var n, r, i = 0; i < t.length; i++) {
					var a = t[i];
					q(a) && ((n === void 0 || a < n) && (n = a), (r === void 0 || a > r) && (r = a));
				}
				return n !== void 0 && r !== void 0 ? [n, r] : void 0;
			}
			return t;
		default: return t;
	}
}, Vp = /* @__PURE__ */ t({
	scaleBand: () => De,
	scaleDiverging: () => Qt,
	scaleDivergingLog: () => $t,
	scaleDivergingPow: () => tn,
	scaleDivergingSqrt: () => nn,
	scaleDivergingSymlog: () => en,
	scaleIdentity: () => ht,
	scaleImplicit: () => ue,
	scaleLinear: () => se,
	scaleLog: () => Tt,
	scaleOrdinal: () => le,
	scalePoint: () => Ee,
	scalePow: () => Pt,
	scaleQuantile: () => zt,
	scaleQuantize: () => Bt,
	scaleRadial: () => Rt,
	scaleSequential: () => Gt,
	scaleSequentialLog: () => Kt,
	scaleSequentialPow: () => Jt,
	scaleSequentialQuantile: () => Xt,
	scaleSequentialSqrt: () => Yt,
	scaleSequentialSymlog: () => qt,
	scaleSqrt: () => Ft,
	scaleSymlog: () => kt,
	scaleThreshold: () => Vt,
	scaleTime: () => ye,
	scaleUtc: () => Ht,
	tickFormat: () => ae
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineConfiguredScale.js
function Hp(e) {
	var t = Vp;
	if (e in t && typeof t[e] == "function") return t[e]();
	var n = `scale${nr(e)}`;
	if (n in t && typeof t[n] == "function") return t[n]();
}
function Up(e, t, n) {
	if (typeof e == "function") return e.copy().domain(t).range(n);
	if (e != null) {
		var r = Hp(e);
		if (r != null) return r.domain(t).range(n), r;
	}
}
function Wp(e, t, n, r) {
	if (n != null && r != null) return typeof e.scale == "function" ? Up(e.scale, n, r) : Up(t, n, r);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineRealScaleType.js
function Gp(e) {
	return `scale${nr(e)}`;
}
function Kp(e) {
	return Gp(e) in Vp;
}
var qp = (e, t, n) => {
	if (e != null) {
		var r = e.scale, i = e.type;
		if (r === "auto") return i === "category" && n && (n.indexOf("LineChart") >= 0 || n.indexOf("AreaChart") >= 0 || n.indexOf("ComposedChart") >= 0 && !t) ? "point" : i === "category" ? "band" : "linear";
		if (typeof r == "string") return Kp(r) ? r : "point";
	}
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/scale/createCategoricalInverse.js
function Jp(e, t) {
	for (var n = 0, r = e.length, i = e[0] < e[e.length - 1]; n < r;) {
		var a = Math.floor((n + r) / 2);
		(i ? e[a] < t : e[a] > t) ? n = a + 1 : r = a;
	}
	return n;
}
function Yp(e, t) {
	if (e) {
		var n = t ?? e.domain(), r = n.map((t) => e(t) ?? 0), i = e.range();
		if (!(n.length === 0 || i.length < 2)) return (e) => {
			var t = Jp(r, e);
			if (t <= 0) return n[0];
			if (t >= n.length) return n[n.length - 1];
			var i = r[t - 1] ?? 0, a = r[t] ?? 0;
			return Math.abs(e - i) <= Math.abs(e - a) ? n[t - 1] : n[t];
		};
	}
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineInverseScaleFunction.js
function Xp(e) {
	if (e != null) return "invert" in e && typeof e.invert == "function" ? e.invert.bind(e) : Yp(e, void 0);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/axisSelectors.js
var Zp = /* @__PURE__ */ e(bf());
function Qp(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function $p(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Qp(Object(n), !0).forEach(function(t) {
			em(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Qp(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function em(e, t, n) {
	return (t = tm(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function tm(e) {
	var t = nm(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function nm(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function rm(e, t) {
	return cm(e) || sm(e, t) || am(e, t) || im();
}
function im() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function am(e, t) {
	if (e) {
		if (typeof e == "string") return om(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? om(e, t) : void 0;
	}
}
function om(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function sm(e, t) {
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
function cm(e) {
	if (Array.isArray(e)) return e;
}
var lm = [0, "auto"], X = {
	allowDataOverflow: !1,
	allowDecimals: !0,
	allowDuplicatedCategory: !0,
	angle: 0,
	dataKey: void 0,
	domain: void 0,
	height: 30,
	hide: !0,
	id: 0,
	includeHidden: !1,
	interval: "preserveEnd",
	minTickGap: 5,
	mirror: !1,
	name: void 0,
	orientation: "bottom",
	padding: {
		left: 0,
		right: 0
	},
	reversed: !1,
	scale: "auto",
	tick: !0,
	tickCount: 5,
	tickFormatter: void 0,
	ticks: void 0,
	type: "category",
	unit: void 0,
	niceTicks: "auto"
}, um = (e, t) => e.cartesianAxis.xAxis[t], dm = (e, t) => um(e, t) ?? X, Z = {
	allowDataOverflow: !1,
	allowDecimals: !0,
	allowDuplicatedCategory: !0,
	angle: 0,
	dataKey: void 0,
	domain: lm,
	hide: !0,
	id: 0,
	includeHidden: !1,
	interval: "preserveEnd",
	minTickGap: 5,
	mirror: !1,
	name: void 0,
	orientation: "left",
	padding: {
		top: 0,
		bottom: 0
	},
	reversed: !1,
	scale: "auto",
	tick: !0,
	tickCount: 5,
	tickFormatter: void 0,
	ticks: void 0,
	type: "number",
	unit: void 0,
	niceTicks: "auto",
	width: 60
}, fm = (e, t) => e.cartesianAxis.yAxis[t], pm = (e, t) => fm(e, t) ?? Z, mm = {
	domain: [0, "auto"],
	includeHidden: !1,
	reversed: !1,
	allowDataOverflow: !1,
	allowDuplicatedCategory: !1,
	dataKey: void 0,
	id: 0,
	name: "",
	range: [64, 64],
	scale: "auto",
	type: "number",
	unit: ""
}, hm = (e, t) => e.cartesianAxis.zAxis[t] ?? mm, gm = (e, t, n) => {
	switch (t) {
		case "xAxis": return dm(e, n);
		case "yAxis": return pm(e, n);
		case "zAxis": return hm(e, n);
		case "angleAxis": return bp(e, n);
		case "radiusAxis": return xp(e, n);
		default: throw Error(`Unexpected axis type: ${t}`);
	}
}, _m = (e, t, n) => {
	switch (t) {
		case "xAxis": return dm(e, n);
		case "yAxis": return pm(e, n);
		default: throw Error(`Unexpected axis type: ${t}`);
	}
}, vm = (e, t, n) => {
	switch (t) {
		case "xAxis": return dm(e, n);
		case "yAxis": return pm(e, n);
		case "angleAxis": return bp(e, n);
		case "radiusAxis": return xp(e, n);
		default: throw Error(`Unexpected axis type: ${t}`);
	}
}, ym = (e) => e.graphicalItems.cartesianItems.some((e) => e.type === "bar") || e.graphicalItems.polarItems.some((e) => e.type === "radialBar");
function bm(e, t) {
	return (n) => {
		switch (e) {
			case "xAxis": return "xAxisId" in n && n.xAxisId === t;
			case "yAxis": return "yAxisId" in n && n.yAxisId === t;
			case "zAxis": return "zAxisId" in n && n.zAxisId === t;
			case "angleAxis": return "angleAxisId" in n && n.angleAxisId === t;
			case "radiusAxis": return "radiusAxisId" in n && n.radiusAxisId === t;
			default: return !1;
		}
	};
}
var xm = (e) => e.graphicalItems.cartesianItems, Sm = W([kp, Ap], bm), Cm = (e, t, n) => e.filter(n).filter((e) => t?.includeHidden === !0 || !e.hide), wm = W([
	xm,
	gm,
	Sm
], Cm, { memoizeOptions: { resultEqualityCheck: Fp } }), Tm = W([wm], (e) => e.filter((e) => e.type === "area" || e.type === "bar").filter(Np)), Em = (e) => e.filter((e) => !("stackId" in e) || e.stackId === void 0), Dm = W([wm], Em), Om = (e) => e.map((e) => e.data).filter(Boolean).flat(1), km = W([wm], (e) => e.some((e) => !e.data)), Am = W([wm], Om, { memoizeOptions: { resultEqualityCheck: Fp } }), jm = (e, t) => {
	var n = t.chartData, r = n === void 0 ? [] : n, i = t.dataStartIndex, a = t.dataEndIndex;
	return e.length > 0 ? e : r.slice(i, a + 1);
}, Mm = W([Am, Cf], jm), Nm = (e, t, n) => t?.dataKey == null ? n.length > 0 ? n.map((e) => e.dataKey).flatMap((t) => e.map((e) => ({ value: Is(e, t) }))) : e.map((e) => ({ value: e })) : e.map((e) => ({ value: Is(e, t.dataKey) })), Pm = (e, t, n, r, i, a) => {
	var o = r.chartData, s = o === void 0 ? [] : o, c = r.dataStartIndex, l = r.dataEndIndex, u = Nm(e, t, n);
	return i && t?.dataKey != null && a.length > 0 ? [...s.slice(c, l + 1).map((e) => ({ value: Is(e, t.dataKey) })).filter((e) => e.value != null), ...u] : u;
}, Fm = W([
	Mm,
	gm,
	wm,
	Cf,
	km,
	Am
], Pm);
function Im(e) {
	if (Yn(e) || e instanceof Date) {
		var t = Number(e);
		if (q(t)) return t;
	}
}
function Lm(e) {
	if (Array.isArray(e)) {
		var t = [Im(e[0]), Im(e[1])];
		return Nf(t) ? t : void 0;
	}
	var n = Im(e);
	if (n != null) return [n, n];
}
function Rm(e) {
	return e.map(Im).filter(rr);
}
function zm(e, t) {
	var n = Im(e), r = Im(t);
	return n == null && r == null ? 0 : n == null ? -1 : r == null ? 1 : n - r;
}
var Bm = W([Fm], (e) => e?.map((e) => e.value).sort(zm));
function Vm(e, t) {
	switch (e) {
		case "xAxis": return t.direction === "x";
		case "yAxis": return t.direction === "y";
		default: return !1;
	}
}
function Hm(e, t, n) {
	if (!n || !n.length) return [];
	var r;
	if (typeof t == "number" && !qn(t)) r = t;
	else if (Array.isArray(t)) {
		var i = Rm(t);
		i.length > 0 && (r = Math.max(...i));
	}
	return r == null ? [] : Rm(n.flatMap((t) => {
		var n = Is(e, t.dataKey), i, a;
		if (Array.isArray(n)) {
			var o = rm(n, 2);
			i = o[0], a = o[1];
		} else i = a = n;
		if (q(i) && q(a)) return [r - i, r + a];
	}));
}
var Q = (e) => vm(e, Lp(e), Rp(e)), Um = W([Q], (e) => e?.dataKey), Wm = W([
	Tm,
	Cf,
	Q
], Mp), Gm = (e, t, n, r) => {
	var i = t.reduce((e, t) => {
		if (t.stackId == null) return e;
		var n = e[t.stackId];
		return n ??= [], n.push(t), e[t.stackId] = n, e;
	}, {});
	return Object.fromEntries(Object.entries(i).map((t) => {
		var i = rm(t, 2), a = i[0], o = i[1], s = r ? [...o].reverse() : o;
		return [a, {
			stackedData: Vs(e, s.map(jp), n),
			graphicalItems: s
		}];
	}));
}, Km = W([
	Wm,
	Tm,
	np,
	rp
], Gm), qm = (e, t, n, r) => {
	var i = t.dataStartIndex, a = t.dataEndIndex;
	if (r == null && n !== "zAxis") return qs(e, i, a);
}, Jm = W([gm], (e) => e.allowDataOverflow), Ym = (e) => {
	if (e == null || !("domain" in e)) return lm;
	if (e.domain != null) return e.domain;
	if ("ticks" in e && e.ticks != null) {
		if (e.type === "number") {
			var t = Rm(e.ticks);
			return [Math.min(...t), Math.max(...t)];
		}
		if (e.type === "category") return e.ticks.map(String);
	}
	return e?.domain ?? lm;
}, Xm = W([gm], Ym), Zm = W([Xm, Jm], Ff), Qm = W([
	Km,
	xf,
	kp,
	Zm
], qm, { memoizeOptions: { resultEqualityCheck: Pp } }), $m = (e) => e.errorBars, eh = (e, t, n) => e.flatMap((e) => t[e.id]).filter(Boolean).filter((e) => Vm(n, e)), th = function() {
	var e = [...arguments].filter(Boolean);
	if (e.length !== 0) {
		var t = e.flat();
		return [Math.min(...t), Math.max(...t)];
	}
}, nh = function(e, t, n, r, i) {
	var a = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : [], o, s;
	if (n.length > 0 && n.forEach((e) => {
		var n = e.data == null ? a : [...e.data], c = r[e.id]?.filter((e) => Vm(i, e));
		n.forEach((n) => {
			var r = Is(n, t.dataKey ?? e.dataKey), i = Hm(n, r, c);
			if (i.length >= 2) {
				var a = Math.min(...i), l = Math.max(...i);
				(o == null || a < o) && (o = a), (s == null || l > s) && (s = l);
			}
			var u = Lm(r);
			u != null && (o = o == null ? u[0] : Math.min(o, u[0]), s = s == null ? u[1] : Math.max(s, u[1]));
		});
	}), t?.dataKey != null && n.length === 0 && e.forEach((e) => {
		var n = Lm(Is(e, t.dataKey));
		n != null && (o = o == null ? n[0] : Math.min(o, n[0]), s = s == null ? n[1] : Math.max(s, n[1]));
	}), q(o) && q(s)) return [o, s];
}, rh = W([
	Mm,
	gm,
	Dm,
	$m,
	kp,
	Tf
], nh, { memoizeOptions: { resultEqualityCheck: Pp } });
function ih(e) {
	var t = e.value;
	if (Yn(t) || t instanceof Date) return t;
}
var ah = (e, t, n) => {
	var r = e.map(ih).filter((e) => e != null);
	return n && (t.dataKey == null || t.allowDuplicatedCategory && $n(r)) ? (0, Zp.default)(0, e.length) : t.allowDuplicatedCategory ? r : Array.from(new Set(r));
}, oh = (e) => e.referenceElements.dots, sh = (e, t, n) => e.filter((e) => e.ifOverflow === "extendDomain").filter((e) => t === "xAxis" ? e.xAxisId === n : e.yAxisId === n), ch = W([
	oh,
	kp,
	Ap
], sh), lh = (e) => e.referenceElements.areas, uh = W([
	lh,
	kp,
	Ap
], sh), dh = (e) => e.referenceElements.lines, fh = W([
	dh,
	kp,
	Ap
], sh), ph = (e, t) => {
	if (e != null) {
		var n = Rm(e.map((e) => t === "xAxis" ? e.x : e.y));
		if (n.length !== 0) return [Math.min(...n), Math.max(...n)];
	}
}, mh = W(ch, kp, ph), hh = (e, t) => {
	if (e != null) {
		var n = Rm(e.flatMap((e) => [t === "xAxis" ? e.x1 : e.y1, t === "xAxis" ? e.x2 : e.y2]));
		if (n.length !== 0) return [Math.min(...n), Math.max(...n)];
	}
}, gh = W([uh, kp], hh);
function _h(e) {
	if (e.x != null) return Rm([e.x]);
	var t = e.segment?.map((e) => e.x);
	return t == null || t.length === 0 ? [] : Rm(t);
}
function vh(e) {
	if (e.y != null) return Rm([e.y]);
	var t = e.segment?.map((e) => e.y);
	return t == null || t.length === 0 ? [] : Rm(t);
}
var yh = (e, t) => {
	if (e != null) {
		var n = e.flatMap((e) => t === "xAxis" ? _h(e) : vh(e));
		if (n.length !== 0) return [Math.min(...n), Math.max(...n)];
	}
}, bh = W(mh, W([fh, kp], yh), gh, (e, t, n) => th(e, n, t)), xh = (e, t, n, r, i, a, o, s, c) => {
	if (n != null) return n;
	var l = o === "vertical" && s === "xAxis" || o === "horizontal" && s === "yAxis" ? th(r, a, i) : th(a, i), u = If(t, l, e.allowDataOverflow);
	return u == null && e.allowDataOverflow && l == null && c != null ? c : u;
}, Sh = W([
	gm,
	Xm,
	Zm,
	Qm,
	rh,
	bh,
	J,
	kp,
	W([gm], (e) => {
		if (e != null && e.type === "number" && "ticks" in e && e.ticks != null) {
			var t = Rm(e.ticks);
			if (t.length !== 0) return [Math.min(...t), Math.max(...t)];
		}
	}, { memoizeOptions: { resultEqualityCheck: Pp } })
], xh, { memoizeOptions: { resultEqualityCheck: Pp } }), Ch = [0, 1], wh = (e, t, n, r, i, a, o) => {
	if (e != null && n != null && n.length !== 0 || o !== void 0) {
		var s = e.dataKey, c = e.type, l = Rs(t, a);
		return l && s == null ? (0, Zp.default)(0, n?.length ?? 0) : c === "category" ? ah(r, e, l) : i === "expand" && !l ? Ch : o;
	}
}, Th = W([
	gm,
	J,
	Mm,
	Fm,
	np,
	kp,
	Sh
], wh), Eh = W([
	gm,
	ym,
	ip
], qp), Dh = (e, t, n) => {
	var r = t.niceTicks;
	if (r !== "none") {
		var i = Ym(t), a = Array.isArray(i) && (i[0] === "auto" || i[1] === "auto");
		if ((r === "snap125" || r === "adaptive") && t != null && t.tickCount && Nf(e)) {
			if (a) return Xf(e, t.tickCount, t.allowDecimals, r);
			if (t.type === "number") return Zf(e, t.tickCount, t.allowDecimals, r);
		}
		if (r === "auto" && n === "linear" && t != null && t.tickCount) {
			if (a && Nf(e)) return Xf(e, t.tickCount, t.allowDecimals, "adaptive");
			if (t.type === "number" && Nf(e)) return Zf(e, t.tickCount, t.allowDecimals, "adaptive");
		}
	}
}, Oh = W([
	Th,
	vm,
	Eh
], Dh), kh = (e, t, n, r) => {
	if (r !== "angleAxis" && e?.type === "number" && Nf(t) && Array.isArray(n) && n.length > 0) {
		var i = t[0], a = n[0] ?? 0, o = t[1], s = n[n.length - 1] ?? 0;
		return [Math.min(i, a), Math.max(o, s)];
	}
	return t;
}, Ah = W([
	gm,
	Th,
	Oh,
	kp
], kh), jh = W(W(Fm, gm, (e, t) => {
	if (t && t.type === "number") {
		var n = Infinity, r = Array.from(Rm(e.map((e) => e.value))).sort((e, t) => e - t), i = r[0], a = r[r.length - 1];
		if (i == null || a == null) return Infinity;
		var o = a - i;
		if (o === 0) return Infinity;
		for (var s = 0; s < r.length - 1; s++) {
			var c = r[s], l = r[s + 1];
			if (c != null && l != null) {
				var u = l - c;
				n = Math.min(n, u);
			}
		}
		return n / o;
	}
}), J, ep, vc, (e, t, n, r, i) => i, (e, t, n, r, i) => {
	if (!q(e)) return 0;
	var a = t === "vertical" ? r.height : r.width;
	if (i === "gap") return e * a / 2;
	if (i === "no-gap") {
		var o = Qn(n, e * a), s = e * a / 2;
		return s - o - (s - o) / a * o;
	}
	return 0;
}), Mh = (e, t, n) => {
	var r = dm(e, t);
	return r == null || typeof r.padding != "string" ? 0 : jh(e, "xAxis", t, n, r.padding);
}, Nh = (e, t, n) => {
	var r = pm(e, t);
	return r == null || typeof r.padding != "string" ? 0 : jh(e, "yAxis", t, n, r.padding);
}, Ph = W(dm, Mh, (e, t) => {
	if (e == null) return {
		left: 0,
		right: 0
	};
	var n = e.padding;
	return typeof n == "string" ? {
		left: t,
		right: t
	} : {
		left: (n.left ?? 0) + t,
		right: (n.right ?? 0) + t
	};
}), Fh = W(pm, Nh, (e, t) => {
	if (e == null) return {
		top: 0,
		bottom: 0
	};
	var n = e.padding;
	return typeof n == "string" ? {
		top: t,
		bottom: t
	} : {
		top: (n.top ?? 0) + t,
		bottom: (n.bottom ?? 0) + t
	};
}), Ih = W([
	vc,
	Ph,
	wc,
	Cc,
	(e, t, n) => n
], (e, t, n, r, i) => {
	var a = r.padding;
	return i ? [a.left, n.width - a.right] : [e.left + t.left, e.left + e.width - t.right];
}), Lh = W([
	vc,
	J,
	Fh,
	wc,
	Cc,
	(e, t, n) => n
], (e, t, n, r, i, a) => {
	var o = i.padding;
	return a ? [r.height - o.bottom, o.top] : t === "horizontal" ? [e.top + e.height - n.bottom, e.top + n.top] : [e.top + n.top, e.top + e.height - n.bottom];
}), Rh = (e, t, n, r) => {
	switch (t) {
		case "xAxis": return Ih(e, n, r);
		case "yAxis": return Lh(e, n, r);
		case "zAxis": return hm(e, n)?.range;
		case "angleAxis": return Ep(e);
		case "radiusAxis": return Dp(e, n);
		default: return;
	}
}, zh = W([gm, Rh], dp), Bh = W([
	gm,
	Eh,
	W([Eh, Ah], Bp),
	zh
], Wp), Vh = (e, t, n, r) => {
	if (n != null && n.dataKey != null) {
		var i = n.type, a = n.scale;
		if (Rs(e, r) && (i === "number" || a !== "auto")) return t.map((e) => e.value);
	}
}, Hh = W([
	J,
	Fm,
	vm,
	kp
], Vh), Uh = W([Bh], zp);
W([Bh], Xp), W([Bh, Bm], Yp), W([
	wm,
	$m,
	kp
], eh);
function Wh(e, t) {
	return e.id < t.id ? -1 : +(e.id > t.id);
}
var Gh = (e, t) => t, Kh = (e, t, n) => n, qh = W(ac, Gh, Kh, (e, t, n) => e.filter((e) => e.orientation === t).filter((e) => e.mirror === n).sort(Wh)), Jh = W(oc, Gh, Kh, (e, t, n) => e.filter((e) => e.orientation === t).filter((e) => e.mirror === n).sort(Wh)), Yh = (e, t) => ({
	width: e.width,
	height: t.height
}), Xh = (e, t) => ({
	width: typeof t.width == "number" ? t.width : 60,
	height: e.height
}), Zh = W(vc, dm, Yh), Qh = (e, t, n) => {
	switch (t) {
		case "top": return e.top;
		case "bottom": return n - e.bottom;
		default: return 0;
	}
}, $h = (e, t, n) => {
	switch (t) {
		case "left": return e.left;
		case "right": return n - e.right;
		default: return 0;
	}
}, eg = W(nc, vc, qh, Gh, Kh, (e, t, n, r, i) => {
	var a = {}, o;
	return n.forEach((n) => {
		var s = Yh(t, n);
		o ??= Qh(t, r, e);
		var c = r === "top" && !i || r === "bottom" && i;
		a[n.id] = o - Number(c) * s.height, o += (c ? -1 : 1) * s.height;
	}), a;
}), tg = W(tc, vc, Jh, Gh, Kh, (e, t, n, r, i) => {
	var a = {}, o;
	return n.forEach((n) => {
		var s = Xh(t, n);
		o ??= $h(t, r, e);
		var c = r === "left" && !i || r === "right" && i;
		a[n.id] = o - Number(c) * s.width, o += (c ? -1 : 1) * s.width;
	}), a;
}), ng = W([
	vc,
	dm,
	(e, t) => {
		var n = dm(e, t);
		if (n != null) return eg(e, n.orientation, n.mirror);
	},
	(e, t) => t
], (e, t, n, r) => {
	if (t != null) {
		var i = n?.[r];
		return i == null ? {
			x: e.left,
			y: 0
		} : {
			x: e.left,
			y: i
		};
	}
}), rg = W([
	vc,
	pm,
	(e, t) => {
		var n = pm(e, t);
		if (n != null) return tg(e, n.orientation, n.mirror);
	},
	(e, t) => t
], (e, t, n, r) => {
	if (t != null) {
		var i = n?.[r];
		return i == null ? {
			x: 0,
			y: e.top
		} : {
			x: i,
			y: e.top
		};
	}
}), ig = W(vc, pm, (e, t) => ({
	width: typeof t.width == "number" ? t.width : 60,
	height: e.height
})), ag = (e, t, n) => {
	switch (t) {
		case "xAxis": return Zh(e, n).width;
		case "yAxis": return ig(e, n).height;
		default: return;
	}
}, og = (e, t, n, r) => {
	if (n != null) {
		var i = n.allowDuplicatedCategory, a = n.type, o = n.dataKey, s = Rs(e, r), c = t.map((e) => e.value), l = c.filter((e) => e != null);
		if (o && s && a === "category" && i && $n(l)) return c;
	}
}, sg = W([
	J,
	Fm,
	gm,
	kp
], og);
W([
	J,
	_m,
	Eh,
	Uh,
	sg,
	Hh,
	Rh,
	Oh,
	kp
], (e, t, n, r, i, a, o, s, c) => {
	if (t != null) {
		var l = Rs(e, c);
		return {
			angle: t.angle,
			interval: t.interval,
			minTickGap: t.minTickGap,
			orientation: t.orientation,
			tick: t.tick,
			tickCount: t.tickCount,
			tickFormatter: t.tickFormatter,
			ticks: t.ticks,
			type: t.type,
			unit: t.unit,
			axisType: c,
			categoricalDomain: a,
			duplicateDomain: i,
			isCategorical: l,
			niceTicks: s,
			range: o,
			realScaleType: n,
			scale: r
		};
	}
});
var cg = W([
	J,
	vm,
	Eh,
	Uh,
	Oh,
	Rh,
	sg,
	Hh,
	kp
], (e, t, n, r, i, a, o, s, c) => {
	if (t != null && r != null) {
		var l = Rs(e, c), u = t.type, d = t.ticks, f = t.tickCount, p = n === "scaleBand" && typeof r.bandwidth == "function" ? r.bandwidth() / 2 : 2, m = u === "category" && r.bandwidth ? r.bandwidth() / p : 0;
		m = c === "angleAxis" && a != null && a.length >= 2 ? Kn(a[0] - a[1]) * 2 * m : m;
		var h = d || i;
		return h ? h.map((e, t) => {
			var n = o ? o.indexOf(e) : e, i = r.map(n);
			return q(i) ? {
				index: t,
				coordinate: i + m,
				value: e,
				offset: m
			} : null;
		}).filter(rr) : l && s ? s.map((e, t) => {
			var n = r.map(e);
			return q(n) ? {
				coordinate: n + m,
				value: e,
				index: t,
				offset: m
			} : null;
		}).filter(rr) : r.ticks ? r.ticks(f).map((e, t) => {
			var n = r.map(e);
			return q(n) ? {
				coordinate: n + m,
				value: e,
				index: t,
				offset: m
			} : null;
		}).filter(rr) : r.domain().map((e, t) => {
			var n = r.map(e);
			return q(n) ? {
				coordinate: n + m,
				value: o ? o[e] : e,
				index: t,
				offset: m
			} : null;
		}).filter(rr);
	}
}), lg = W([
	J,
	vm,
	Uh,
	Rh,
	sg,
	Hh,
	kp
], (e, t, n, r, i, a, o) => {
	if (t != null && n != null && r != null && r[0] !== r[1]) {
		var s = Rs(e, o), c = t.tickCount, l = 0;
		return l = o === "angleAxis" && r?.length >= 2 ? Kn(r[0] - r[1]) * 2 * l : l, s && a ? a.map((e, t) => {
			var r = n.map(e);
			return q(r) ? {
				coordinate: r + l,
				value: e,
				index: t,
				offset: l
			} : null;
		}).filter(rr) : n.ticks ? n.ticks(c).map((e, t) => {
			var r = n.map(e);
			return q(r) ? {
				coordinate: r + l,
				value: e,
				index: t,
				offset: l
			} : null;
		}).filter(rr) : n.domain().map((e, t) => {
			var r = n.map(e);
			return q(r) ? {
				coordinate: r + l,
				value: i ? i[e] : e,
				index: t,
				offset: l
			} : null;
		}).filter(rr);
	}
}), ug = W(gm, Uh, (e, t) => {
	if (e != null && t != null) return $p($p({}, e), {}, { scale: t });
});
W((e, t, n) => hm(e, n), W([W([
	gm,
	Eh,
	Th,
	zh
], Wp)], zp), (e, t) => {
	if (e != null && t != null) return $p($p({}, e), {}, { scale: t });
});
var dg = W([
	J,
	ac,
	oc
], (e, t, n) => {
	switch (e) {
		case "horizontal": return t.some((e) => e.reversed) ? "right-to-left" : "left-to-right";
		case "vertical": return n.some((e) => e.reversed) ? "bottom-to-top" : "top-to-bottom";
		case "centric":
		case "radial": return "left-to-right";
		default: return;
	}
});
W([(e, t, n) => e.renderedTicks[t]?.[n]], (e) => {
	if (e && e.length !== 0) return (t) => {
		var n = Infinity, r = e[0];
		for (var i of e) {
			var a = Math.abs(i.coordinate - t);
			a < n && (n = a, r = i);
		}
		return r?.value;
	};
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/selectTooltipEventType.js
var fg = (e) => e.options.defaultTooltipEventType, pg = (e) => e.options.validateTooltipEventTypes;
function mg(e, t, n) {
	if (e == null) return t;
	var r = e ? "axis" : "item";
	return n == null ? t : n.includes(r) ? r : t;
}
function hg(e, t) {
	return mg(t, fg(e), pg(e));
}
function gg(e) {
	return U((t) => hg(t, e));
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineActiveLabel.js
var _g = (e, t) => {
	var n, r = Number(t);
	if (!(qn(r) || t == null)) return r >= 0 ? e == null || (n = e[r]) == null ? void 0 : n.value : void 0;
}, vg = (e) => e.tooltip.settings, yg = {
	active: !1,
	index: null,
	dataKey: void 0,
	graphicalItemId: void 0,
	coordinate: void 0
}, bg = Po({
	name: "tooltip",
	initialState: {
		itemInteraction: {
			click: yg,
			hover: yg
		},
		axisInteraction: {
			click: yg,
			hover: yg
		},
		keyboardInteraction: yg,
		syncInteraction: {
			active: !1,
			index: null,
			dataKey: void 0,
			label: void 0,
			coordinate: void 0,
			sourceViewBox: void 0,
			graphicalItemId: void 0
		},
		tooltipItemPayloads: [],
		settings: {
			shared: void 0,
			trigger: "hover",
			axisId: 0,
			active: !1,
			defaultIndex: void 0
		}
	},
	reducers: {
		addTooltipEntrySettings: {
			reducer(e, t) {
				e.tooltipItemPayloads.push(G(t.payload));
			},
			prepare: K()
		},
		replaceTooltipEntrySettings: {
			reducer(e, t) {
				var n = t.payload, r = n.prev, i = n.next, a = ao(e).tooltipItemPayloads.indexOf(G(r));
				a > -1 && (e.tooltipItemPayloads[a] = G(i));
			},
			prepare: K()
		},
		removeTooltipEntrySettings: {
			reducer(e, t) {
				var n = ao(e).tooltipItemPayloads.indexOf(G(t.payload));
				n > -1 && e.tooltipItemPayloads.splice(n, 1);
			},
			prepare: K()
		},
		setTooltipSettingsState(e, t) {
			e.settings = t.payload;
		},
		setActiveMouseOverItemIndex(e, t) {
			e.syncInteraction.active = !1, e.syncInteraction.sourceViewBox = void 0, e.keyboardInteraction.active = !1, e.itemInteraction.hover.active = !0, e.itemInteraction.hover.index = t.payload.activeIndex, e.itemInteraction.hover.dataKey = t.payload.activeDataKey, e.itemInteraction.hover.graphicalItemId = t.payload.activeGraphicalItemId, e.itemInteraction.hover.coordinate = t.payload.activeCoordinate;
		},
		mouseLeaveChart(e) {
			e.itemInteraction.hover.active = !1, e.axisInteraction.hover.active = !1;
		},
		mouseLeaveItem(e) {
			e.itemInteraction.hover.active = !1;
		},
		setActiveClickItemIndex(e, t) {
			e.syncInteraction.active = !1, e.syncInteraction.sourceViewBox = void 0, e.itemInteraction.click.active = !0, e.keyboardInteraction.active = !1, e.itemInteraction.click.index = t.payload.activeIndex, e.itemInteraction.click.dataKey = t.payload.activeDataKey, e.itemInteraction.click.graphicalItemId = t.payload.activeGraphicalItemId, e.itemInteraction.click.coordinate = t.payload.activeCoordinate;
		},
		setMouseOverAxisIndex(e, t) {
			e.syncInteraction.active = !1, e.syncInteraction.sourceViewBox = void 0, e.axisInteraction.hover.active = !0, e.keyboardInteraction.active = !1, e.axisInteraction.hover.index = t.payload.activeIndex, e.axisInteraction.hover.dataKey = t.payload.activeDataKey, e.axisInteraction.hover.coordinate = t.payload.activeCoordinate;
		},
		setMouseClickAxisIndex(e, t) {
			e.syncInteraction.active = !1, e.syncInteraction.sourceViewBox = void 0, e.keyboardInteraction.active = !1, e.axisInteraction.click.active = !0, e.axisInteraction.click.index = t.payload.activeIndex, e.axisInteraction.click.dataKey = t.payload.activeDataKey, e.axisInteraction.click.coordinate = t.payload.activeCoordinate;
		},
		setSyncInteraction(e, t) {
			e.syncInteraction = t.payload;
		},
		setKeyboardInteraction(e, t) {
			e.keyboardInteraction.active = t.payload.active, e.keyboardInteraction.index = t.payload.activeIndex, e.keyboardInteraction.coordinate = t.payload.activeCoordinate;
		}
	}
}), xg = bg.actions, Sg = xg.addTooltipEntrySettings, Cg = xg.replaceTooltipEntrySettings, wg = xg.removeTooltipEntrySettings, Tg = xg.setTooltipSettingsState, Eg = xg.setActiveMouseOverItemIndex, Dg = xg.mouseLeaveItem, Og = xg.mouseLeaveChart, kg = xg.setActiveClickItemIndex, Ag = xg.setMouseOverAxisIndex, jg = xg.setMouseClickAxisIndex, Mg = xg.setSyncInteraction, Ng = xg.setKeyboardInteraction, Pg = bg.reducer;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineTooltipInteractionState.js
function Fg(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Ig(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Fg(Object(n), !0).forEach(function(t) {
			Lg(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Fg(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Lg(e, t, n) {
	return (t = Rg(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Rg(e) {
	var t = zg(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function zg(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Bg(e, t, n) {
	return t === "axis" ? n === "click" ? e.axisInteraction.click : e.axisInteraction.hover : n === "click" ? e.itemInteraction.click : e.itemInteraction.hover;
}
function Vg(e) {
	return e.index != null;
}
var Hg = (e, t, n, r) => {
	if (t == null) return yg;
	var i = Bg(e, t, n);
	if (i == null) return yg;
	if (i.active) return i;
	if (e.keyboardInteraction.active) return e.keyboardInteraction;
	if (e.syncInteraction.active && e.syncInteraction.index != null) return e.syncInteraction;
	var a = e.settings.active === !0;
	if (Vg(i)) {
		if (a) return Ig(Ig({}, i), {}, { active: !0 });
	} else if (r != null) return {
		active: !0,
		coordinate: void 0,
		dataKey: void 0,
		index: r,
		graphicalItemId: void 0
	};
	return Ig(Ig({}, yg), {}, { coordinate: i.coordinate });
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineActiveTooltipIndex.js
function Ug(e) {
	if (typeof e == "number") return Number.isFinite(e) ? e : void 0;
	if (e instanceof Date) {
		var t = e.valueOf();
		return Number.isFinite(t) ? t : void 0;
	}
	var n = Number(e);
	return Number.isFinite(n) ? n : void 0;
}
function Wg(e, t) {
	var n = Ug(e), r = t[0], i = t[1];
	return n !== void 0 && n >= Math.min(r, i) && n <= Math.max(r, i);
}
function Gg(e, t, n) {
	if (n == null || t == null) return !0;
	var r = Is(e, t);
	return r == null || !Nf(n) || Wg(r, n);
}
var Kg = (e, t, n, r) => {
	var i = e?.index;
	if (i == null) return null;
	var a = Number(i);
	if (!q(a)) return i;
	var o = 0, s = Infinity;
	t.length > 0 && (s = t.length - 1);
	var c = Math.max(o, Math.min(a, s)), l = t[c];
	return l == null || Gg(l, n, r) ? String(c) : null;
}, qg = (e, t, n, r, i, a, o) => {
	if (a != null) {
		var s = o[0]?.getPosition(a);
		if (s != null) return s;
		var c = i?.[Number(a)];
		if (c) switch (n) {
			case "horizontal": return {
				x: c.coordinate,
				y: (r.top + t) / 2
			};
			default: return {
				x: (r.left + e) / 2,
				y: c.coordinate
			};
		}
	}
}, Jg = (e, t, n, r) => {
	if (t === "axis") return e.tooltipItemPayloads;
	if (e.tooltipItemPayloads.length === 0) return [];
	var i = n === "hover" ? e.itemInteraction.hover.graphicalItemId : e.itemInteraction.click.graphicalItemId;
	if (e.syncInteraction.active && i == null) return e.tooltipItemPayloads;
	if (i == null && (r != null || e.keyboardInteraction.active)) {
		var a = e.tooltipItemPayloads[0];
		return a == null ? [] : [a];
	}
	return e.tooltipItemPayloads.filter((e) => e.settings?.graphicalItemId === i);
}, Yg = (e) => e.options.tooltipPayloadSearcher, Xg = (e) => e.tooltip;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineTooltipPayload.js
function Zg(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Qg(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Zg(Object(n), !0).forEach(function(t) {
			$g(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Zg(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function $g(e, t, n) {
	return (t = e_(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function e_(e) {
	var t = t_(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function t_(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function n_(e) {
	if (typeof e == "string" || typeof e == "number") return e;
}
function r_(e) {
	if (typeof e == "string" || typeof e == "number" || typeof e == "boolean") return e;
}
function i_(e) {
	if (typeof e == "string" || typeof e == "number") return e;
	if (typeof e == "function") return (t) => e(t);
}
function a_(e) {
	if (typeof e == "string") return e;
}
function o_(e) {
	if (typeof e == "object" && e) return {
		name: "name" in e ? n_(e.name) : void 0,
		unit: "unit" in e ? r_(e.unit) : void 0,
		dataKey: "dataKey" in e ? i_(e.dataKey) : void 0,
		payload: "payload" in e ? e.payload : void 0,
		color: "color" in e ? a_(e.color) : void 0,
		fill: "fill" in e ? a_(e.fill) : void 0
	};
}
function s_(e, t) {
	return e ?? t;
}
var c_ = (e, t, n, r, i, a, o) => {
	if (t != null && a != null) {
		var s = n.chartData, c = n.computedData, l = n.dataStartIndex, u = n.dataEndIndex;
		return e.reduce((e, n) => {
			var d = n.dataDefinedOnItem, f = n.settings, p = s_(d, s), m = Array.isArray(p) ? ks(p, l, u) : p, h = f?.dataKey ?? r, g = f?.nameKey, _ = r && Array.isArray(m) && !Array.isArray(m[0]) && o === "axis" ? tr(m, r, i) : a(m, t, c, g);
			return Array.isArray(_) ? _.forEach((t) => {
				var n = o_(t), r = n?.name, i = n?.dataKey, a = n?.payload, o = Qg(Qg({}, f), {}, {
					name: r,
					unit: n?.unit,
					color: n?.color ?? f?.color,
					fill: n?.fill ?? f?.fill
				});
				e.push(Zs({
					tooltipEntrySettings: o,
					dataKey: i,
					payload: a,
					value: Is(a, i),
					name: r == null ? void 0 : String(r)
				}));
			}) : e.push(Zs({
				tooltipEntrySettings: f,
				dataKey: h,
				payload: _,
				value: Is(_, h),
				name: Is(_, g) ?? f?.name
			})), e;
		}, []);
	}
}, l_ = W([
	Q,
	ym,
	ip
], qp), u_ = W([
	W([(e) => e.graphicalItems.cartesianItems, (e) => e.graphicalItems.polarItems], (e, t) => [...e, ...t]),
	Q,
	W([Lp, Rp], bm)
], Cm, { memoizeOptions: { resultEqualityCheck: Fp } }), d_ = W([u_], (e) => e.filter(Np)), f_ = W([u_], Om, { memoizeOptions: { resultEqualityCheck: Fp } }), p_ = W([u_], (e) => e.some((e) => !e.data)), m_ = W([f_, xf], jm), h_ = W([
	d_,
	xf,
	Q
], Mp), g_ = W([
	m_,
	Q,
	u_,
	xf,
	p_,
	f_
], Pm), __ = W([Q], Ym), v_ = W([__, W([Q], (e) => e.allowDataOverflow)], Ff), y_ = W([
	W([
		h_,
		W([u_], (e) => e.filter(Np)),
		np,
		rp
	], Gm),
	xf,
	Lp,
	v_
], qm), b_ = W([
	m_,
	Q,
	W([u_], Em),
	$m,
	Lp,
	Ef
], nh, { memoizeOptions: { resultEqualityCheck: Pp } }), x_ = W([W([
	oh,
	Lp,
	Rp
], sh), Lp], ph), S_ = W([W([
	lh,
	Lp,
	Rp
], sh), Lp], hh), C_ = W([
	Q,
	J,
	m_,
	g_,
	np,
	Lp,
	W([
		Q,
		__,
		v_,
		y_,
		b_,
		W([
			x_,
			W([W([
				dh,
				Lp,
				Rp
			], sh), Lp], yh),
			S_
		], th),
		J,
		Lp
	], xh)
], wh), w_ = W([
	Q,
	C_,
	W([
		C_,
		Q,
		l_
	], Dh),
	Lp
], kh), T_ = (e) => Rh(e, Lp(e), Rp(e), !1), E_ = W([Q, T_], dp), D_ = W([W([
	Q,
	l_,
	w_,
	E_
], Wp)], zp), O_ = W([
	J,
	Q,
	l_,
	D_,
	T_,
	W([
		J,
		g_,
		Q,
		Lp
	], og),
	W([
		J,
		g_,
		Q,
		Lp
	], Vh),
	Lp
], (e, t, n, r, i, a, o, s) => {
	if (t) {
		var c = t.type, l = Rs(e, s);
		if (r) {
			var u = n === "scaleBand" && r.bandwidth ? r.bandwidth() / 2 : 2, d = c === "category" && r.bandwidth ? r.bandwidth() / u : 0;
			return d = s === "angleAxis" && i != null && i?.length >= 2 ? Kn(i[0] - i[1]) * 2 * d : d, l && o ? o.map((e, t) => {
				var n = r.map(e);
				return q(n) ? {
					coordinate: n + d,
					value: e,
					index: t,
					offset: d
				} : null;
			}).filter(rr) : r.domain().map((e, t) => {
				var n = r.map(e);
				return q(n) ? {
					coordinate: n + d,
					value: a ? a[e] : e,
					index: t,
					offset: d
				} : null;
			}).filter(rr);
		}
	}
}), k_ = W([
	fg,
	pg,
	vg
], (e, t, n) => mg(n.shared, e, t)), A_ = (e) => e.tooltip.settings.trigger, j_ = (e) => e.tooltip.settings.defaultIndex, M_ = W([
	Xg,
	k_,
	A_,
	j_
], Hg), N_ = W([
	M_,
	m_,
	Um,
	C_
], Kg), P_ = W([O_, N_], _g), F_ = W([M_], (e) => {
	if (e) return e.dataKey;
}), I_ = W([M_], (e) => {
	if (e) return e.graphicalItemId;
}), L_ = W([
	Xg,
	k_,
	A_,
	j_
], Jg), R_ = W([M_, W([
	tc,
	nc,
	J,
	vc,
	O_,
	j_,
	L_
], qg)], (e, t) => e != null && e.coordinate ? e.coordinate : t), z_ = W([M_], (e) => e?.active ?? !1);
W([W([
	L_,
	N_,
	xf,
	Um,
	P_,
	Yg,
	k_
], c_)], (e) => {
	if (e != null) {
		var t = e.map((e) => e.payload).filter((e) => e != null);
		return Array.from(new Set(t));
	}
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/context/useTooltipAxis.js
function B_(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function V_(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? B_(Object(n), !0).forEach(function(t) {
			H_(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : B_(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function H_(e, t, n) {
	return (t = U_(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function U_(e) {
	var t = W_(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function W_(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var G_ = () => U(Q), K_ = () => {
	var e = G_(), t = U(O_), n = U(D_);
	return Xs(!e || !n ? void 0 : V_(V_({}, e), {}, { scale: n }), t);
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/getActiveCoordinate.js
function q_(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function J_(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? q_(Object(n), !0).forEach(function(t) {
			Y_(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : q_(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Y_(e, t, n) {
	return (t = X_(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function X_(e) {
	var t = Z_(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Z_(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Q_ = (e, t, n, r) => {
	var i = t.find((e) => e && e.index === n);
	if (i) {
		if (e === "horizontal") return {
			x: i.coordinate,
			y: r.relativeY
		};
		if (e === "vertical") return {
			x: r.relativeX,
			y: i.coordinate
		};
	}
	return {
		x: 0,
		y: 0
	};
}, $_ = (e, t, n, r) => {
	var i = t.find((e) => e && e.index === n);
	if (i) {
		if (e === "centric") {
			var a = i.coordinate, o = r.radius;
			return J_(J_(J_({}, r), Kd(r.cx, r.cy, o, a)), {}, {
				angle: a,
				radius: o
			});
		}
		var s = i.coordinate, c = r.angle;
		return J_(J_(J_({}, r), Kd(r.cx, r.cy, s, c)), {}, {
			angle: c,
			radius: s
		});
	}
	return {
		angle: 0,
		clockWise: !1,
		cx: 0,
		cy: 0,
		endAngle: 0,
		innerRadius: 0,
		outerRadius: 0,
		radius: 0,
		startAngle: 0,
		x: 0,
		y: 0
	};
};
function ev(e, t) {
	var n = e.relativeX, r = e.relativeY;
	return n >= t.left && n <= t.left + t.width && r >= t.top && r <= t.top + t.height;
}
var tv = (e, t, n, r, i) => {
	var a = t?.length ?? 0;
	if (a <= 1 || e == null) return 0;
	if (r === "angleAxis" && i != null && Math.abs(Math.abs(i[1] - i[0]) - 360) <= 1e-6) for (var o = 0; o < a; o++) {
		var s = o > 0 ? n[o - 1]?.coordinate : n[a - 1]?.coordinate, c = n[o]?.coordinate, l = o >= a - 1 ? n[0]?.coordinate : n[o + 1]?.coordinate, u = void 0;
		if (s != null && c != null && l != null) {
			if (Kn(c - s) !== Kn(l - c)) {
				var d = [];
				if (Kn(l - c) === Kn(i[1] - i[0])) {
					u = l;
					var f = c + i[1] - i[0];
					d[0] = Math.min(f, (f + s) / 2), d[1] = Math.max(f, (f + s) / 2);
				} else {
					u = s;
					var p = l + i[1] - i[0];
					d[0] = Math.min(c, (p + c) / 2), d[1] = Math.max(c, (p + c) / 2);
				}
				var m = [Math.min(c, (u + c) / 2), Math.max(c, (u + c) / 2)];
				if (e > m[0] && e <= m[1] || e >= d[0] && e <= d[1]) return n[o]?.index;
			} else {
				var h = Math.min(s, l), g = Math.max(s, l);
				if (e > (h + c) / 2 && e <= (g + c) / 2) return n[o]?.index;
			}
		}
	}
	else if (t) for (var _ = 0; _ < a; _++) {
		var v = t[_];
		if (v != null) {
			var y = t[_ + 1], b = t[_ - 1];
			if (_ === 0 && y != null && e <= (v.coordinate + y.coordinate) / 2 || _ === a - 1 && b != null && e > (v.coordinate + b.coordinate) / 2 || _ > 0 && _ < a - 1 && b != null && y != null && e > (v.coordinate + b.coordinate) / 2 && e <= (v.coordinate + y.coordinate) / 2) return v.index;
		}
	}
	return -1;
}, nv = () => U(ip), rv = (e, t) => t, iv = (e, t, n) => n, av = (e, t, n, r) => r, ov = W(O_, (e) => (0, _i.default)(e, (e) => e.coordinate)), sv = W([
	Xg,
	rv,
	iv,
	av
], Hg), cv = W([
	sv,
	m_,
	Um,
	C_
], Kg), lv = (e, t, n) => {
	if (t != null) {
		var r = Xg(e);
		return t === "axis" ? n === "hover" ? r.axisInteraction.hover.dataKey : r.axisInteraction.click.dataKey : n === "hover" ? r.itemInteraction.hover.dataKey : r.itemInteraction.click.dataKey;
	}
}, uv = W([
	Xg,
	rv,
	iv,
	av
], Jg), dv = W([
	tc,
	nc,
	J,
	vc,
	O_,
	av,
	uv
], qg), fv = W([sv, dv], (e, t) => e.coordinate ?? t), pv = W([O_, cv], _g), mv = W([
	uv,
	cv,
	xf,
	Um,
	pv,
	Yg,
	rv
], c_), hv = W([sv, cv], (e, t) => ({
	isActive: e.active && t != null,
	activeIndex: t
})), gv = (e, t, n, r, i, a, o) => {
	if (e && n && r && i && ev(e, o)) {
		var s = tv($s(e, t), a, i, n, r), c = Q_(t, i, s, e);
		return {
			activeIndex: String(s),
			activeCoordinate: c
		};
	}
}, _v = (e, t, n, r, i, a, o) => {
	if (e && r && i && a && n) {
		var s = Qd(e, n);
		if (s) {
			var c = tv(ec(s, t), o, a, r, i), l = $_(t, a, c, s);
			return {
				activeIndex: String(c),
				activeCoordinate: l
			};
		}
	}
}, vv = (e, t, n, r, i, a, o, s) => {
	if (e && t && r && i && a) return t === "horizontal" || t === "vertical" ? gv(e, t, r, i, a, o, s) : _v(e, t, n, r, i, a, o);
}, yv = W((e) => e.zIndex.zIndexMap, (e, t) => t, (e, t, n) => n, (e, t, n) => {
	if (t != null) {
		var r = e[t];
		if (r != null) return n ? r.panoramaElement : r.element;
	}
}), bv = W((e) => e.zIndex.zIndexMap, (e) => {
	var t = Object.keys(e).map((e) => parseInt(e, 10)).concat(Object.values(cp));
	return Array.from(new Set(t)).sort((e, t) => e - t);
}, { memoizeOptions: { resultEqualityCheck: Ip } });
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/zIndexSlice.js
function xv(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Sv(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? xv(Object(n), !0).forEach(function(t) {
			Cv(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : xv(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Cv(e, t, n) {
	return (t = wv(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function wv(e) {
	var t = Tv(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Tv(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Ev = { zIndexMap: Object.values(cp).reduce((e, t) => Sv(Sv({}, e), {}, { [t]: {
	element: void 0,
	panoramaElement: void 0,
	consumers: 0
} }), {}) }, Dv = new Set(Object.values(cp));
function Ov(e) {
	return Dv.has(e);
}
var kv = Po({
	name: "zIndex",
	initialState: Ev,
	reducers: {
		registerZIndexPortal: {
			reducer: (e, t) => {
				var n = t.payload.zIndex;
				e.zIndexMap[n] ? e.zIndexMap[n].consumers += 1 : e.zIndexMap[n] = {
					consumers: 1,
					element: void 0,
					panoramaElement: void 0
				};
			},
			prepare: K()
		},
		unregisterZIndexPortal: {
			reducer: (e, t) => {
				var n = t.payload.zIndex;
				e.zIndexMap[n] && (--e.zIndexMap[n].consumers, e.zIndexMap[n].consumers <= 0 && !Ov(n) && delete e.zIndexMap[n]);
			},
			prepare: K()
		},
		registerZIndexPortalElement: {
			reducer: (e, t) => {
				var n = t.payload, r = n.zIndex, i = n.element, a = n.isPanorama;
				e.zIndexMap[r] ? a ? e.zIndexMap[r].panoramaElement = G(i) : e.zIndexMap[r].element = G(i) : e.zIndexMap[r] = {
					consumers: 0,
					element: a ? void 0 : G(i),
					panoramaElement: a ? G(i) : void 0
				};
			},
			prepare: K()
		},
		unregisterZIndexPortalElement: {
			reducer: (e, t) => {
				var n = t.payload.zIndex;
				e.zIndexMap[n] && (t.payload.isPanorama ? e.zIndexMap[n].panoramaElement = void 0 : e.zIndexMap[n].element = void 0);
			},
			prepare: K()
		}
	}
}), Av = kv.actions, jv = Av.registerZIndexPortal, Mv = Av.unregisterZIndexPortal, Nv = Av.registerZIndexPortalElement, Pv = Av.unregisterZIndexPortalElement, Fv = kv.reducer;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/zIndex/ZIndexLayer.js
function Iv(e) {
	var t = e.zIndex, n = e.children, r = Ic() && t !== void 0 && t !== 0, i = Sc(), a = L(void 0), o = L(/* @__PURE__ */ new Set()), s = H(), c = U((e) => yv(e, t, i));
	if (We(() => {
		if (!r) {
			var e = o.current;
			e.forEach((e) => {
				s(Mv({ zIndex: e }));
			}), e.clear(), a.current = void 0;
		} else if (o.current.has(t) || (s(jv({ zIndex: t })), o.current.add(t)), c) {
			a.current = c;
			var n = o.current;
			n.forEach((e) => {
				e !== t && (s(Mv({ zIndex: e })), n.delete(e));
			});
		}
	}, [
		s,
		t,
		r,
		c
	]), We(() => {
		var e = o.current;
		return () => {
			e.forEach((e) => {
				s(Mv({ zIndex: e }));
			}), e.clear();
		};
	}, [s]), !r) return n;
	var l = c ?? a.current;
	return l ? /*#__PURE__*/ ot(n, l) : null;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/component/Cursor.js
function Lv() {
	return Lv = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, Lv.apply(null, arguments);
}
function Rv(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function zv(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Rv(Object(n), !0).forEach(function(t) {
			Bv(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Rv(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Bv(e, t, n) {
	return (t = Vv(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Vv(e) {
	var t = Hv(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Hv(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Uv(e) {
	var t = e.cursor, n = e.cursorComp, r = e.cursorProps;
	return /*#__PURE__*/ Be(t) ? /*#__PURE__*/ Ie(t, r) : /*#__PURE__*/ Re(n, r);
}
function Wv(e) {
	var t = e.coordinate, n = e.payload, r = e.index, i = e.offset, a = e.tooltipAxisBandSize, o = e.layout, s = e.cursor, c = e.tooltipEventType, l = e.chartName, u = t, d = n, f = r;
	if (!s || !u || l !== "ScatterChart" && c !== "axis") return null;
	var p, m, h;
	if (l === "ScatterChart") p = u, m = Tu, h = cp.cursorLine;
	else if (l === "BarChart") p = Eu(o, u, i, a), m = Rd, h = cp.cursorRectangle;
	else if (o === "radial" && ar(u)) {
		var g = $d(u), _ = g.cx, v = g.cy, y = g.radius;
		p = {
			cx: _,
			cy: v,
			startAngle: g.startAngle,
			endAngle: g.endAngle,
			innerRadius: y,
			outerRadius: y
		}, m = hf, h = cp.cursorLine;
	} else p = { points: gf(o, u, i) }, m = mu, h = cp.cursorLine;
	var b = typeof s == "object" && "className" in s ? s.className : void 0, x = zv(zv(zv(zv({
		stroke: "#ccc",
		pointerEvents: "none"
	}, i), p), Sn(s)), {}, {
		payload: d,
		payloadIndex: f,
		className: z("recharts-tooltip-cursor", b)
	});
	return /*#__PURE__*/ P.createElement(Iv, { zIndex: e.zIndex ?? h }, /*#__PURE__*/ P.createElement(Uv, {
		cursor: s,
		cursorComp: m,
		cursorProps: x
	}));
}
function Gv(e) {
	var t = K_(), n = Ac(), r = Nc(), i = nv();
	return t == null || n == null || r == null || i == null ? null : /*#__PURE__*/ P.createElement(Wv, Lv({}, e, {
		offset: n,
		layout: r,
		tooltipAxisBandSize: t,
		chartName: i
	}));
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/context/tooltipPortalContext.js
var Kv = /*#__PURE__*/ Le(null), qv = () => He(Kv), Jv = (/* @__PURE__ */ e((/* @__PURE__ */ n(((e, t) => {
	var n = Object.prototype.hasOwnProperty, r = "~";
	function i() {}
	Object.create && (i.prototype = Object.create(null), new i().__proto__ || (r = !1));
	function a(e, t, n) {
		this.fn = e, this.context = t, this.once = n || !1;
	}
	function o(e, t, n, i, o) {
		if (typeof n != "function") throw TypeError("The listener must be a function");
		var s = new a(n, i || e, o), c = r ? r + t : t;
		return e._events[c] ? e._events[c].fn ? e._events[c] = [e._events[c], s] : e._events[c].push(s) : (e._events[c] = s, e._eventsCount++), e;
	}
	function s(e, t) {
		--e._eventsCount === 0 ? e._events = new i() : delete e._events[t];
	}
	function c() {
		this._events = new i(), this._eventsCount = 0;
	}
	c.prototype.eventNames = function() {
		var e = [], t, i;
		if (this._eventsCount === 0) return e;
		for (i in t = this._events) n.call(t, i) && e.push(r ? i.slice(1) : i);
		return Object.getOwnPropertySymbols ? e.concat(Object.getOwnPropertySymbols(t)) : e;
	}, c.prototype.listeners = function(e) {
		var t = r ? r + e : e, n = this._events[t];
		if (!n) return [];
		if (n.fn) return [n.fn];
		for (var i = 0, a = n.length, o = Array(a); i < a; i++) o[i] = n[i].fn;
		return o;
	}, c.prototype.listenerCount = function(e) {
		var t = r ? r + e : e, n = this._events[t];
		return n ? n.fn ? 1 : n.length : 0;
	}, c.prototype.emit = function(e, t, n, i, a, o) {
		var s = r ? r + e : e;
		if (!this._events[s]) return !1;
		var c = this._events[s], l = arguments.length, u, d;
		if (c.fn) {
			switch (c.once && this.removeListener(e, c.fn, void 0, !0), l) {
				case 1: return c.fn.call(c.context), !0;
				case 2: return c.fn.call(c.context, t), !0;
				case 3: return c.fn.call(c.context, t, n), !0;
				case 4: return c.fn.call(c.context, t, n, i), !0;
				case 5: return c.fn.call(c.context, t, n, i, a), !0;
				case 6: return c.fn.call(c.context, t, n, i, a, o), !0;
			}
			for (d = 1, u = Array(l - 1); d < l; d++) u[d - 1] = arguments[d];
			c.fn.apply(c.context, u);
		} else {
			var f = c.length, p;
			for (d = 0; d < f; d++) switch (c[d].once && this.removeListener(e, c[d].fn, void 0, !0), l) {
				case 1:
					c[d].fn.call(c[d].context);
					break;
				case 2:
					c[d].fn.call(c[d].context, t);
					break;
				case 3:
					c[d].fn.call(c[d].context, t, n);
					break;
				case 4:
					c[d].fn.call(c[d].context, t, n, i);
					break;
				default:
					if (!u) for (p = 1, u = Array(l - 1); p < l; p++) u[p - 1] = arguments[p];
					c[d].fn.apply(c[d].context, u);
			}
		}
		return !0;
	}, c.prototype.on = function(e, t, n) {
		return o(this, e, t, n, !1);
	}, c.prototype.once = function(e, t, n) {
		return o(this, e, t, n, !0);
	}, c.prototype.removeListener = function(e, t, n, i) {
		var a = r ? r + e : e;
		if (!this._events[a]) return this;
		if (!t) return s(this, a), this;
		var o = this._events[a];
		if (o.fn) o.fn !== t || i && !o.once || n && o.context !== n || s(this, a);
		else {
			for (var c = 0, l = [], u = o.length; c < u; c++) (o[c].fn !== t || i && !o[c].once || n && o[c].context !== n) && l.push(o[c]);
			l.length ? this._events[a] = l.length === 1 ? l[0] : l : s(this, a);
		}
		return this;
	}, c.prototype.removeAllListeners = function(e) {
		var t;
		return e ? (t = r ? r + e : e, this._events[t] && s(this, t)) : (this._events = new i(), this._eventsCount = 0), this;
	}, c.prototype.off = c.prototype.removeListener, c.prototype.addListener = c.prototype.on, c.prefixed = r, c.EventEmitter = c, t !== void 0 && (t.exports = c);
})))(), 1)).default, Yv = new Jv(), Xv = "recharts.syncEvent.tooltip", Zv = "recharts.syncEvent.brush", Qv = (e, t) => {
	if (t && Array.isArray(e)) {
		var n = Number.parseInt(t, 10);
		if (!qn(n)) return e[n];
	}
}, $v = Po({
	name: "options",
	initialState: {
		chartName: "",
		tooltipPayloadSearcher: () => void 0,
		eventEmitter: void 0,
		defaultTooltipEventType: "axis"
	},
	reducers: { createEventEmitter: (e) => {
		e.eventEmitter ??= Symbol("rechartsEventEmitter");
	} }
}), ey = $v.reducer, ty = $v.actions.createEventEmitter;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/synchronisation/syncSelectors.js
function ny(e) {
	return e.tooltip.syncInteraction;
}
var ry = Po({
	name: "chartData",
	initialState: {
		chartData: void 0,
		computedData: void 0,
		dataStartIndex: 0,
		dataEndIndex: 0
	},
	reducers: {
		setChartData(e, t) {
			e.chartData = G(t.payload), t.payload == null ? (e.dataStartIndex = 0, e.dataEndIndex = 0) : t.payload.length > 0 && e.dataEndIndex !== t.payload.length - 1 && (e.dataEndIndex = t.payload.length - 1);
		},
		setComputedData(e, t) {
			e.computedData = t.payload;
		},
		setDataStartEndIndexes(e, t) {
			var n = t.payload, r = n.startIndex, i = n.endIndex;
			r != null && (e.dataStartIndex = r), i != null && (e.dataEndIndex = i);
		}
	}
}), iy = ry.actions, ay = iy.setChartData, oy = iy.setDataStartEndIndexes;
iy.setComputedData;
var sy = ry.reducer, cy = ["x", "y"];
function ly(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function uy(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? ly(Object(n), !0).forEach(function(t) {
			dy(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : ly(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function dy(e, t, n) {
	return (t = fy(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function fy(e) {
	var t = py(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function py(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function my(e, t) {
	if (e == null) return {};
	var n, r, i = hy(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function hy(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function gy() {
	var e = U(ap), t = U(sp), n = H(), r = U(op), i = U(O_), a = Nc(), o = Oc(), s = U((e) => e.rootProps.className);
	I(() => {
		if (e == null) return ir;
		var s = (s, c, l) => {
			if (t !== l && e === s) {
				if (c.payload.active === !1) n(Mg({
					active: !1,
					coordinate: void 0,
					dataKey: void 0,
					index: null,
					label: void 0,
					sourceViewBox: void 0,
					graphicalItemId: void 0
				}));
				else if (r === "index") {
					var u;
					if (o && c != null && (u = c.payload) != null && u.coordinate && c.payload.sourceViewBox) {
						var d = c.payload.coordinate, f = d.x, p = d.y, m = my(d, cy), h = c.payload.sourceViewBox, g = h.x, _ = h.y, v = h.width, y = h.height, b = uy(uy({}, m), {}, {
							x: o.x + (v ? (f - g) / v : 0) * o.width,
							y: o.y + (y ? (p - _) / y : 0) * o.height
						});
						n(uy(uy({}, c), {}, { payload: uy(uy({}, c.payload), {}, { coordinate: b }) }));
					} else n(c);
				} else if (i != null) {
					var x;
					typeof r == "function" ? x = i[r(i, {
						activeTooltipIndex: c.payload.index == null ? void 0 : Number(c.payload.index),
						isTooltipActive: c.payload.active,
						activeIndex: c.payload.index == null ? void 0 : Number(c.payload.index),
						activeLabel: c.payload.label,
						activeDataKey: c.payload.dataKey,
						activeCoordinate: c.payload.coordinate
					})] : r === "value" && (x = i.find((e) => String(e.value) === c.payload.label));
					var S = c.payload.coordinate;
					if (S == null || o == null) n(Mg({
						active: !1,
						coordinate: void 0,
						dataKey: void 0,
						index: null,
						label: void 0,
						sourceViewBox: void 0,
						graphicalItemId: void 0
					}));
					else if (x == null) n(Mg({
						active: !1,
						coordinate: void 0,
						dataKey: void 0,
						index: null,
						label: void 0,
						sourceViewBox: c.payload.sourceViewBox,
						graphicalItemId: void 0
					}));
					else {
						var C = S.x, w = S.y, T = Math.min(C, o.x + o.width), E = Math.min(w, o.y + o.height), D = {
							x: a === "horizontal" ? x.coordinate : T,
							y: a === "horizontal" ? E : x.coordinate
						};
						n(Mg({
							active: c.payload.active,
							coordinate: D,
							dataKey: c.payload.dataKey,
							index: String(x.index),
							label: c.payload.label,
							sourceViewBox: c.payload.sourceViewBox,
							graphicalItemId: c.payload.graphicalItemId
						}));
					}
				}
			}
		};
		return Yv.on(Xv, s), () => {
			Yv.off(Xv, s);
		};
	}, [
		s,
		n,
		t,
		e,
		r,
		i,
		a,
		o
	]);
}
function _y() {
	var e = U(ap), t = U(sp), n = H();
	I(() => {
		if (e == null) return ir;
		var r = (r, i, a) => {
			t !== a && e === r && n(oy(i));
		};
		return Yv.on(Zv, r), () => {
			Yv.off(Zv, r);
		};
	}, [
		n,
		t,
		e
	]);
}
function vy() {
	var e = H();
	I(() => {
		e(ty());
	}, [e]), gy(), _y();
}
function yy(e, t, n, r, i, a) {
	var o = U((n) => lv(n, e, t)), s = U(I_), c = U(sp), l = U(ap), u = U(op), d = U(ny)?.sourceViewBox != null, f = Oc();
	I(() => {
		if (!d && l != null && c != null) {
			var e = Mg({
				active: a,
				coordinate: n,
				dataKey: o,
				index: i,
				label: typeof r == "number" ? String(r) : r,
				sourceViewBox: f,
				graphicalItemId: s
			});
			Yv.emit(Xv, l, e, c);
		}
	}, [
		d,
		n,
		o,
		s,
		i,
		r,
		c,
		l,
		u,
		a,
		f
	]);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/component/Tooltip.js
function by(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function xy(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? by(Object(n), !0).forEach(function(t) {
			Sy(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : by(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Sy(e, t, n) {
	return (t = Cy(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Cy(e) {
	var t = wy(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function wy(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Ty(e, t) {
	return Ay(e) || ky(e, t) || Dy(e, t) || Ey();
}
function Ey() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Dy(e, t) {
	if (e) {
		if (typeof e == "string") return Oy(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? Oy(e, t) : void 0;
	}
}
function Oy(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function ky(e, t) {
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
function Ay(e) {
	if (Array.isArray(e)) return e;
}
function jy(e) {
	return e.dataKey;
}
function My(e, t) {
	return /*#__PURE__*/ P.isValidElement(e) ? /*#__PURE__*/ P.cloneElement(e, t) : typeof e == "function" ? /*#__PURE__*/ P.createElement(e, t) : /*#__PURE__*/ P.createElement(wl, t);
}
var Ny = [], Py = {
	allowEscapeViewBox: {
		x: !1,
		y: !1
	},
	animationDuration: 400,
	animationEasing: "ease",
	axisId: 0,
	contentStyle: {},
	cursor: !0,
	filterNull: !0,
	includeHidden: !1,
	isAnimationActive: "auto",
	itemSorter: "name",
	itemStyle: {},
	labelStyle: {},
	offset: 10,
	reverseDirection: {
		x: !1,
		y: !1
	},
	separator: " : ",
	trigger: "hover",
	useTranslate3d: !1,
	wrapperStyle: {}
};
function Fy(e) {
	var t = mr(e, Py), n = t.active, r = t.allowEscapeViewBox, i = t.animationDuration, a = t.animationEasing, o = t.content, s = t.filterNull, c = t.isAnimationActive, l = t.offset, u = t.payloadUniqBy, d = t.position, f = t.reverseDirection, p = t.useTranslate3d, m = t.wrapperStyle, h = t.cursor, g = t.shared, _ = t.trigger, v = t.defaultIndex, y = t.portal, b = t.axisId, x = H(), S = typeof v == "number" ? String(v) : v;
	I(() => {
		x(Tg({
			shared: g,
			trigger: _,
			axisId: b,
			active: n,
			defaultIndex: S
		}));
	}, [
		x,
		g,
		_,
		b,
		n,
		S
	]);
	var C = Oc(), w = $l(), T = gg(g), E = U((e) => hv(e, T, _, S)) ?? {}, D = E.activeIndex, O = E.isActive, k = U((e) => mv(e, T, _, S)), A = U((e) => pv(e, T, _, S)), j = U((e) => fv(e, T, _, S)), M = k, N = qv(), ee = n ?? O ?? !1, te = Ty(ki([M, ee]), 2), ne = te[0], re = te[1], ie = T === "axis" ? A : void 0;
	yy(T, _, j, ie, D, ee);
	var ae = y ?? N;
	if (ae == null || C == null || T == null) return null;
	var oe = M ?? Ny;
	ee || (oe = Ny), s && oe.length && (oe = Wr(oe.filter((e) => e.value != null && (e.hide !== !0 || t.includeHidden)), u, jy));
	var se = oe.length > 0, ce = xy(xy({}, t), {}, {
		payload: oe,
		label: ie,
		active: ee,
		activeIndex: D,
		coordinate: j,
		accessibilityLayer: w
	}), le = /*#__PURE__*/ P.createElement(Ql, {
		allowEscapeViewBox: r,
		animationDuration: i,
		animationEasing: a,
		isAnimationActive: c,
		active: ee,
		coordinate: j,
		hasPayload: se,
		offset: l,
		position: d,
		reverseDirection: f,
		useTranslate3d: p,
		viewBox: C,
		wrapperStyle: m,
		lastBoundingBox: ne,
		innerRef: re,
		hasPortalFromProps: !!y
	}, My(o, ce));
	return /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ ot(le, ae), ee && /*#__PURE__*/ P.createElement(Gv, {
		cursor: h,
		tooltipEventType: T,
		coordinate: j,
		payload: oe,
		index: D
	}));
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/component/Cell.js
var Iy = (e) => null;
Iy.displayName = "Cell";
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/LRUCache.js
function Ly(e, t, n) {
	return (t = Ry(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Ry(e) {
	var t = zy(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function zy(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var By = class {
	constructor(e) {
		Ly(this, "cache", /* @__PURE__ */ new Map()), this.maxSize = e;
	}
	get(e) {
		var t = this.cache.get(e);
		return t !== void 0 && (this.cache.delete(e), this.cache.set(e, t)), t;
	}
	set(e, t) {
		if (this.cache.has(e)) this.cache.delete(e);
		else if (this.cache.size >= this.maxSize) {
			var n = this.cache.keys().next().value;
			n != null && this.cache.delete(n);
		}
		this.cache.set(e, t);
	}
	clear() {
		this.cache.clear();
	}
	size() {
		return this.cache.size;
	}
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/DOMUtils.js
function Vy(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Hy(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Vy(Object(n), !0).forEach(function(t) {
			Uy(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Vy(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Uy(e, t, n) {
	return (t = Wy(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Wy(e) {
	var t = Gy(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Gy(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Ky = Hy({}, {
	cacheSize: 2e3,
	enableCache: !0
}), qy = new By(Ky.cacheSize), Jy = {
	position: "absolute",
	top: "-20000px",
	left: 0,
	padding: 0,
	margin: 0,
	border: "none",
	whiteSpace: "pre"
}, Yy = "recharts_measurement_span";
function Xy(e, t) {
	return `${e}|${t.fontSize || ""}|${t.fontFamily || ""}|${t.fontWeight || ""}|${t.fontStyle || ""}|${t.letterSpacing || ""}|${t.textTransform || ""}`;
}
var Zy = (e, t) => {
	try {
		var n = document.getElementById(Yy);
		n || (n = document.createElement("span"), n.setAttribute("id", Yy), n.setAttribute("aria-hidden", "true"), document.body.appendChild(n)), Object.assign(n.style, Jy, t), n.textContent = `${e}`;
		var r = n.getBoundingClientRect();
		return {
			width: r.width,
			height: r.height
		};
	} catch {
		return {
			width: 0,
			height: 0
		};
	}
}, Qy = function(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
	if (e == null || jl.isSsr) return {
		width: 0,
		height: 0
	};
	if (!Ky.enableCache) return Zy(e, t);
	var n = Xy(e, t), r = qy.get(n);
	if (r) return r;
	var i = Zy(e, t);
	return qy.set(n, i), i;
}, $y;
function eb(e, t) {
	return ab(e) || ib(e, t) || nb(e, t) || tb();
}
function tb() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function nb(e, t) {
	if (e) {
		if (typeof e == "string") return rb(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? rb(e, t) : void 0;
	}
}
function rb(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function ib(e, t) {
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
function ab(e) {
	if (Array.isArray(e)) return e;
}
function ob(e, t, n) {
	return (t = sb(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function sb(e) {
	var t = cb(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function cb(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var lb = /(-?\d+(?:\.\d+)?[a-zA-Z%]*)([*/])(-?\d+(?:\.\d+)?[a-zA-Z%]*)/, ub = /(-?\d+(?:\.\d+)?[a-zA-Z%]*)([+-])(-?\d+(?:\.\d+)?[a-zA-Z%]*)/, db = /^(px|cm|vh|vw|em|rem|%|mm|in|pt|pc|ex|ch|vmin|vmax|Q)$/, fb = /(-?\d+(?:\.\d+)?)([a-zA-Z%]+)?/, pb = {
	cm: 96 / 2.54,
	mm: 96 / 25.4,
	pt: 96 / 72,
	pc: 16,
	in: 96,
	Q: 96 / 101.6,
	px: 1
}, mb = [
	"cm",
	"mm",
	"pt",
	"pc",
	"in",
	"Q",
	"px"
];
function hb(e) {
	return mb.includes(e);
}
var gb = "NaN";
function _b(e, t) {
	return e * pb[t];
}
var vb = class e {
	static parse(t) {
		var n = eb(fb.exec(t) ?? [], 3), r = n[1], i = n[2];
		return r == null ? e.NaN : new e(parseFloat(r), i ?? "");
	}
	constructor(e, t) {
		this.num = e, this.unit = t, this.num = e, this.unit = t, qn(e) && (this.unit = ""), t !== "" && !db.test(t) && (this.num = NaN, this.unit = ""), hb(t) && (this.num = _b(e, t), this.unit = "px");
	}
	add(t) {
		return this.unit === t.unit ? new e(this.num + t.num, this.unit) : new e(NaN, "");
	}
	subtract(t) {
		return this.unit === t.unit ? new e(this.num - t.num, this.unit) : new e(NaN, "");
	}
	multiply(t) {
		return this.unit !== "" && t.unit !== "" && this.unit !== t.unit ? new e(NaN, "") : new e(this.num * t.num, this.unit || t.unit);
	}
	divide(t) {
		return this.unit !== "" && t.unit !== "" && this.unit !== t.unit ? new e(NaN, "") : new e(this.num / t.num, this.unit || t.unit);
	}
	toString() {
		return `${this.num}${this.unit}`;
	}
	isNaN() {
		return qn(this.num);
	}
};
$y = vb, ob(vb, "NaN", new $y(NaN, ""));
function yb(e) {
	if (e == null || e.includes(gb)) return gb;
	for (var t = e; t.includes("*") || t.includes("/");) {
		var n = eb(lb.exec(t) ?? [], 4), r = n[1], i = n[2], a = n[3], o = vb.parse(r ?? ""), s = vb.parse(a ?? ""), c = i === "*" ? o.multiply(s) : o.divide(s);
		if (c.isNaN()) return gb;
		t = t.replace(lb, c.toString());
	}
	for (; t.includes("+") || /.-\d+(?:\.\d+)?/.test(t);) {
		var l = eb(ub.exec(t) ?? [], 4), u = l[1], d = l[2], f = l[3], p = vb.parse(u ?? ""), m = vb.parse(f ?? ""), h = d === "+" ? p.add(m) : p.subtract(m);
		if (h.isNaN()) return gb;
		t = t.replace(ub, h.toString());
	}
	return t;
}
var bb = /\(([^()]*)\)/;
function xb(e) {
	for (var t = e, n; (n = bb.exec(t)) != null;) {
		var r = eb(n, 2)[1];
		t = t.replace(bb, yb(r));
	}
	return t;
}
function Sb(e) {
	var t = e.replace(/\s+/g, "");
	return t = xb(t), t = yb(t), t;
}
function Cb(e) {
	try {
		return Sb(e);
	} catch {
		return gb;
	}
}
function wb(e) {
	var t = Cb(e.slice(5, -1));
	return t === gb ? "" : t;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/component/Text.js
var Tb = [
	"x",
	"y",
	"lineHeight",
	"capHeight",
	"fill",
	"scaleToFit",
	"textAnchor",
	"verticalAnchor"
], Eb = [
	"dx",
	"dy",
	"angle",
	"className",
	"breakAll"
];
function Db() {
	return Db = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, Db.apply(null, arguments);
}
function Ob(e, t) {
	if (e == null) return {};
	var n, r, i = kb(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function kb(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function Ab(e, t) {
	return Fb(e) || Pb(e, t) || Mb(e, t) || jb();
}
function jb() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Mb(e, t) {
	if (e) {
		if (typeof e == "string") return Nb(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? Nb(e, t) : void 0;
	}
}
function Nb(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Pb(e, t) {
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
function Fb(e) {
	if (Array.isArray(e)) return e;
}
var Ib = /[ \f\n\r\t\v\u2028\u2029]+/, Lb = (e) => {
	var t = e.children, n = e.breakAll, r = e.style;
	try {
		var i = [];
		return V(t) || (i = n ? t.toString().split("") : t.toString().split(Ib)), {
			wordsWithComputedWidth: i.map((e) => ({
				word: e,
				width: Qy(e, r).width
			})),
			spaceWidth: n ? 0 : Qy("\xA0", r).width
		};
	} catch {
		return null;
	}
};
function Rb(e) {
	return e === "start" || e === "middle" || e === "end" || e === "inherit";
}
function zb(e) {
	return V(e) || typeof e == "string" || typeof e == "number" || typeof e == "boolean";
}
var Bb = (e, t, n, r) => e.reduce((e, i) => {
	var a = i.word, o = i.width, s = e[e.length - 1];
	if (s && o != null && (t == null || r || s.width + o + n < Number(t))) s.words.push(a), s.width += o + n;
	else {
		var c = {
			words: [a],
			width: o
		};
		e.push(c);
	}
	return e;
}, []), Vb = (e) => e.reduce((e, t) => e.width > t.width ? e : t), Hb = "…", Ub = (e, t, n, r, i, a, o, s) => {
	var c = Lb({
		breakAll: n,
		style: r,
		children: e.slice(0, t) + Hb
	});
	if (!c) return [!1, []];
	var l = Bb(c.wordsWithComputedWidth, a, o, s);
	return [l.length > i || Vb(l).width > Number(a), l];
}, Wb = (e, t, n, r, i) => {
	var a = e.maxLines, o = e.children, s = e.style, c = e.breakAll, l = B(a), u = String(o), d = Bb(t, r, n, i);
	if (!l || i || !(d.length > a || Vb(d).width > Number(r))) return d;
	for (var f = 0, p = u.length - 1, m = 0, h; f <= p && m <= u.length - 1;) {
		var g = Math.floor((f + p) / 2), _ = Ab(Ub(u, g - 1, c, s, a, r, n, i), 2), v = _[0], y = _[1], b = Ab(Ub(u, g, c, s, a, r, n, i), 1)[0];
		if (!v && !b && (f = g + 1), v && b && (p = g - 1), !v && b) {
			h = y;
			break;
		}
		m++;
	}
	return h || d;
}, Gb = (e) => [{
	words: V(e) ? [] : e.toString().split(Ib),
	width: void 0
}], Kb = (e) => {
	var t = e.width, n = e.scaleToFit, r = e.children, i = e.style, a = e.breakAll, o = e.maxLines;
	if ((t || n) && !jl.isSsr) {
		var s, c, l = Lb({
			breakAll: a,
			children: r,
			style: i
		});
		if (l) {
			var u = l.wordsWithComputedWidth, d = l.spaceWidth;
			s = u, c = d;
		} else return Gb(r);
		return Wb({
			breakAll: a,
			children: r,
			maxLines: o,
			style: i
		}, s, c, t, !!n);
	}
	return Gb(r);
}, qb = "#808080", Jb = {
	angle: 0,
	breakAll: !1,
	capHeight: "0.71em",
	fill: qb,
	lineHeight: "1em",
	scaleToFit: !1,
	textAnchor: "start",
	verticalAnchor: "end",
	x: 0,
	y: 0
}, Yb = /*#__PURE__*/ ze((e, t) => {
	var n = mr(e, Jb), r = n.x, i = n.y, a = n.lineHeight, o = n.capHeight, s = n.fill, c = n.scaleToFit, l = n.textAnchor, u = n.verticalAnchor, d = Ob(n, Tb), f = Ge(() => Kb({
		breakAll: d.breakAll,
		children: d.children,
		maxLines: d.maxLines,
		scaleToFit: c,
		style: d.style,
		width: d.width
	}), [
		d.breakAll,
		d.children,
		d.maxLines,
		c,
		d.style,
		d.width
	]), p = d.dx, m = d.dy, h = d.angle, g = d.className, _ = d.breakAll, v = Ob(d, Eb);
	if (!Yn(r) || !Yn(i) || f.length === 0) return null;
	var y = Number(r) + (B(p) ? p : 0), b = Number(i) + (B(m) ? m : 0);
	if (!q(y) || !q(b)) return null;
	var x;
	switch (u) {
		case "start":
			x = wb(`calc(${o})`);
			break;
		case "middle":
			x = wb(`calc(${(f.length - 1) / 2} * -${a} + (${o} / 2))`);
			break;
		default: x = wb(`calc(${f.length - 1} * -${a})`);
	}
	var S = [], C = f[0];
	if (c && C != null) {
		var w = C.width, T = d.width;
		S.push(`scale(${B(T) && B(w) ? T / w : 1})`);
	}
	return h && S.push(`rotate(${h}, ${y}, ${b})`), S.length && (v.transform = S.join(" ")), /*#__PURE__*/ P.createElement("text", Db({}, Cn(v), {
		ref: t,
		x: y,
		y: b,
		className: z("recharts-text", g),
		textAnchor: l,
		fill: s.includes("url") ? qb : s
	}), f.map((e, t) => {
		var n = e.words.join(_ ? "" : " ");
		return /*#__PURE__*/ P.createElement("tspan", {
			x: y,
			dy: t === 0 ? x : a,
			key: `${n}-${t}`
		}, n);
	}));
});
Yb.displayName = "Text";
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/cartesian/getCartesianPosition.js
function Xb(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Zb(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Xb(Object(n), !0).forEach(function(t) {
			Qb(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Xb(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Qb(e, t, n) {
	return (t = $b(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function $b(e) {
	var t = ex(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function ex(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var tx = (e) => {
	var t = e.viewBox, n = e.position, r = e.offset, i = r === void 0 ? 0 : r, a = e.parentViewBox, o = e.clamp, s = Dc(t), c = s.x, l = s.y, u = s.height, d = s.upperWidth, f = s.lowerWidth, p = c, m = c + (d - f) / 2, h = (p + m) / 2, g = (d + f) / 2, _ = p + d / 2, v = u >= 0 ? 1 : -1, y = v * i, b = v > 0 ? "end" : "start", x = v > 0 ? "start" : "end", S = d >= 0 ? 1 : -1, C = S * i, w = S > 0 ? "end" : "start", T = S > 0 ? "start" : "end", E = a;
	if (n === "top") {
		var D = {
			x: p + d / 2,
			y: l - y,
			horizontalAnchor: "middle",
			verticalAnchor: b
		};
		return o && E && (D.height = Math.max(l - E.y, 0), D.width = d), D;
	}
	if (n === "bottom") {
		var O = {
			x: m + f / 2,
			y: l + u + y,
			horizontalAnchor: "middle",
			verticalAnchor: x
		};
		return o && E && (O.height = Math.max(E.y + E.height - (l + u), 0), O.width = f), O;
	}
	if (n === "left") {
		var k = {
			x: h - C,
			y: l + u / 2,
			horizontalAnchor: w,
			verticalAnchor: "middle"
		};
		return o && E && (k.width = Math.max(k.x - E.x, 0), k.height = u), k;
	}
	if (n === "right") {
		var A = {
			x: h + g + C,
			y: l + u / 2,
			horizontalAnchor: T,
			verticalAnchor: "middle"
		};
		return o && E && (A.width = Math.max(E.x + E.width - A.x, 0), A.height = u), A;
	}
	var j = o && E ? {
		width: g,
		height: u
	} : {};
	return n === "insideLeft" ? Zb({
		x: h + C,
		y: l + u / 2,
		horizontalAnchor: T,
		verticalAnchor: "middle"
	}, j) : n === "insideRight" ? Zb({
		x: h + g - C,
		y: l + u / 2,
		horizontalAnchor: w,
		verticalAnchor: "middle"
	}, j) : n === "insideTop" ? Zb({
		x: p + d / 2,
		y: l + y,
		horizontalAnchor: "middle",
		verticalAnchor: x
	}, j) : n === "insideBottom" ? Zb({
		x: m + f / 2,
		y: l + u - y,
		horizontalAnchor: "middle",
		verticalAnchor: b
	}, j) : n === "insideTopLeft" ? Zb({
		x: p + C,
		y: l + y,
		horizontalAnchor: T,
		verticalAnchor: x
	}, j) : n === "insideTopRight" ? Zb({
		x: p + d - C,
		y: l + y,
		horizontalAnchor: w,
		verticalAnchor: x
	}, j) : n === "insideBottomLeft" ? Zb({
		x: m + C,
		y: l + u - y,
		horizontalAnchor: T,
		verticalAnchor: b
	}, j) : n === "insideBottomRight" ? Zb({
		x: m + f - C,
		y: l + u - y,
		horizontalAnchor: w,
		verticalAnchor: b
	}, j) : n && typeof n == "object" && (B(n.x) || Jn(n.x)) && (B(n.y) || Jn(n.y)) ? Zb({
		x: c + Qn(n.x, g),
		y: l + Qn(n.y, u),
		horizontalAnchor: "end",
		verticalAnchor: "end"
	}, j) : Zb({
		x: _,
		y: l + u / 2,
		horizontalAnchor: "middle",
		verticalAnchor: "middle"
	}, j);
}, nx = ["labelRef"], rx = ["content"];
function ix(e, t) {
	if (e == null) return {};
	var n, r, i = ax(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function ax(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function ox(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function sx(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? ox(Object(n), !0).forEach(function(t) {
			cx(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : ox(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function cx(e, t, n) {
	return (t = lx(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function lx(e) {
	var t = ux(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function ux(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function dx() {
	return dx = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, dx.apply(null, arguments);
}
var fx = /*#__PURE__*/ Le(null), px = (e) => {
	var t = e.x, n = e.y, r = e.upperWidth, i = e.lowerWidth, a = e.width, o = e.height, s = e.children, c = Ge(() => ({
		x: t,
		y: n,
		upperWidth: r,
		lowerWidth: i,
		width: a,
		height: o
	}), [
		t,
		n,
		r,
		i,
		a,
		o
	]);
	return /*#__PURE__*/ P.createElement(fx.Provider, { value: c }, s);
}, mx = () => {
	var e = He(fx), t = Oc();
	return e || (t ? Dc(t) : void 0);
}, hx = /*#__PURE__*/ Le(null), gx = () => {
	var e = He(hx), t = U(Op);
	return e || t;
}, _x = (e) => {
	var t = e.value, n = e.formatter, r = V(e.children) ? t : e.children;
	return typeof n == "function" ? n(r) : r;
}, vx = (e) => e != null && typeof e == "function", yx = (e, t) => Kn(t - e) * Math.min(Math.abs(t - e), 360), bx = (e, t, n, r, i) => {
	var a = e.offset, o = e.className, s = i.cx, c = i.cy, l = i.innerRadius, u = i.outerRadius, d = i.startAngle, f = i.endAngle, p = i.clockWise, m = (l + u) / 2, h = yx(d, f), g = h >= 0 ? 1 : -1, _, v;
	switch (t) {
		case "insideStart":
			_ = d + g * a, v = p;
			break;
		case "insideEnd":
			_ = f - g * a, v = !p;
			break;
		case "end":
			_ = f + g * a, v = p;
			break;
		default: throw Error(`Unsupported position ${t}`);
	}
	v = h <= 0 ? v : !v;
	var y = Kd(s, c, m, _), b = Kd(s, c, m, _ + (v ? 1 : -1) * 359), x = `M${y.x},${y.y}
    A${m},${m},0,1,${+!v},
    ${b.x},${b.y}`, S = V(e.id) ? Zn("recharts-radial-line-") : e.id;
	return /*#__PURE__*/ P.createElement("text", dx({}, r, {
		dominantBaseline: "central",
		className: z("recharts-radial-bar-label", o)
	}), /*#__PURE__*/ P.createElement("defs", null, /*#__PURE__*/ P.createElement("path", {
		id: S,
		d: x
	})), /*#__PURE__*/ P.createElement("textPath", { xlinkHref: `#${S}` }, n));
}, xx = (e, t, n) => {
	var r = e.cx, i = e.cy, a = e.innerRadius, o = e.outerRadius, s = (e.startAngle + e.endAngle) / 2;
	if (n === "outside") {
		var c = Kd(r, i, o + t, s), l = c.x;
		return {
			x: l,
			y: c.y,
			textAnchor: l >= r ? "start" : "end",
			verticalAnchor: "middle"
		};
	}
	if (n === "center") return {
		x: r,
		y: i,
		textAnchor: "middle",
		verticalAnchor: "middle"
	};
	if (n === "centerTop") return {
		x: r,
		y: i,
		textAnchor: "middle",
		verticalAnchor: "start"
	};
	if (n === "centerBottom") return {
		x: r,
		y: i,
		textAnchor: "middle",
		verticalAnchor: "end"
	};
	var u = Kd(r, i, (a + o) / 2, s);
	return {
		x: u.x,
		y: u.y,
		textAnchor: "middle",
		verticalAnchor: "middle"
	};
}, Sx = (e) => e != null && "cx" in e && B(e.cx), Cx = {
	angle: 0,
	offset: 5,
	zIndex: cp.label,
	position: "middle",
	textBreakAll: !1
};
function wx(e) {
	if (!Sx(e)) return e;
	var t = e.cx, n = e.cy, r = e.outerRadius, i = r * 2;
	return {
		x: t - r,
		y: n - r,
		width: i,
		upperWidth: i,
		lowerWidth: i,
		height: i
	};
}
function Tx(e) {
	var t = mr(e, Cx), n = t.viewBox, r = t.parentViewBox, i = t.position, a = t.value, o = t.children, s = t.content, c = t.className, l = c === void 0 ? "" : c, u = t.textBreakAll, d = t.labelRef, f = gx(), p = mx(), m = n == null ? i === "center" ? p : f ?? p : Sx(n) ? n : Dc(n), h, g, _ = wx(m);
	if (!m || V(a) && V(o) && !/*#__PURE__*/ Be(s) && typeof s != "function") return null;
	var v = sx(sx({}, t), {}, { viewBox: m });
	if (/*#__PURE__*/ Be(s)) {
		v.labelRef;
		var y = ix(v, nx);
		return /*#__PURE__*/ Ie(s, y);
	}
	if (typeof s == "function") {
		v.content;
		var b = ix(v, rx);
		if (h = /*#__PURE__*/ Re(s, b), /*#__PURE__*/ Be(h)) return h;
	} else h = _x(t);
	var x = Cn(t);
	if (Sx(m)) {
		if (i === "insideStart" || i === "insideEnd" || i === "end") return bx(t, i, h, x, m);
		g = xx(m, t.offset, t.position);
	} else {
		if (!_) return null;
		var S = tx({
			viewBox: _,
			position: i,
			offset: t.offset,
			parentViewBox: Sx(r) ? void 0 : r,
			clamp: !0
		});
		g = sx(sx({
			x: S.x,
			y: S.y,
			textAnchor: S.horizontalAnchor,
			verticalAnchor: S.verticalAnchor
		}, S.width === void 0 ? {} : { width: S.width }), S.height === void 0 ? {} : { height: S.height });
	}
	return /*#__PURE__*/ P.createElement(Iv, { zIndex: t.zIndex }, /*#__PURE__*/ P.createElement(Yb, dx({
		ref: d,
		className: z("recharts-label", l)
	}, x, g, {
		textAnchor: Rb(x.textAnchor) ? x.textAnchor : g.textAnchor,
		breakAll: u
	}), h));
}
Tx.displayName = "Label";
var Ex = (e, t, n) => {
	if (!e) return null;
	var r = {
		viewBox: t,
		labelRef: n
	};
	return e === !0 ? /*#__PURE__*/ P.createElement(Tx, dx({ key: "label-implicit" }, r)) : Yn(e) ? /*#__PURE__*/ P.createElement(Tx, dx({
		key: "label-implicit",
		value: e
	}, r)) : /*#__PURE__*/ Be(e) ? e.type === Tx ? /*#__PURE__*/ Ie(e, sx({ key: "label-implicit" }, r)) : /*#__PURE__*/ P.createElement(Tx, dx({
		key: "label-implicit",
		content: e
	}, r)) : vx(e) ? /*#__PURE__*/ P.createElement(Tx, dx({
		key: "label-implicit",
		content: e
	}, r)) : e && typeof e == "object" ? /*#__PURE__*/ P.createElement(Tx, dx({}, e, { key: "label-implicit" }, r)) : null;
};
function Dx(e) {
	var t = e.label, n = e.labelRef;
	return Ex(t, mx(), n) || null;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/component/LabelList.js
var Ox = ["valueAccessor"], kx = [
	"dataKey",
	"clockWise",
	"id",
	"textBreakAll",
	"zIndex"
];
function Ax() {
	return Ax = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, Ax.apply(null, arguments);
}
function jx(e, t) {
	if (e == null) return {};
	var n, r, i = Mx(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Mx(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var Nx = (e) => {
	var t = Array.isArray(e.value) ? e.value[e.value.length - 1] : e.value;
	if (zb(t)) return t;
}, Px = /*#__PURE__*/ Le(void 0), Fx = Px.Provider, Ix = /*#__PURE__*/ Le(void 0);
Ix.Provider;
function Lx() {
	return He(Px);
}
function Rx() {
	return He(Ix);
}
function zx(e) {
	var t = e.valueAccessor, n = t === void 0 ? Nx : t, r = jx(e, Ox), i = r.dataKey;
	r.clockWise;
	var a = r.id, o = r.textBreakAll, s = r.zIndex, c = jx(r, kx), l = Lx(), u = Rx(), d = l || u;
	return !d || !d.length ? null : /*#__PURE__*/ P.createElement(Iv, { zIndex: s ?? cp.label }, /*#__PURE__*/ P.createElement(Nn, { className: "recharts-label-list" }, d.map((e, t) => {
		var s = V(i) ? n(e, t) : Is(e.payload, i), l = V(a) ? {} : { id: `${a}-${t}` };
		return /*#__PURE__*/ P.createElement(Tx, Ax({ key: `label-${t}` }, Cn(e), c, l, {
			fill: r.fill ?? e.fill,
			parentViewBox: e.parentViewBox,
			value: s,
			textBreakAll: o,
			viewBox: e.viewBox,
			index: t,
			zIndex: 0
		}));
	})));
}
zx.displayName = "LabelList";
function Bx(e) {
	var t = e.label;
	return t ? t === !0 ? /*#__PURE__*/ P.createElement(zx, { key: "labelList-implicit" }) : /*#__PURE__*/ P.isValidElement(t) || vx(t) ? /*#__PURE__*/ P.createElement(zx, {
		key: "labelList-implicit",
		content: t
	}) : typeof t == "object" ? /*#__PURE__*/ P.createElement(zx, Ax({ key: "labelList-implicit" }, t, { type: String(t.type) })) : null : null;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/polarAxisSlice.js
var Vx = Po({
	name: "polarAxis",
	initialState: {
		radiusAxis: {},
		angleAxis: {}
	},
	reducers: {
		addRadiusAxis(e, t) {
			e.radiusAxis[t.payload.id] = G(t.payload);
		},
		removeRadiusAxis(e, t) {
			delete e.radiusAxis[t.payload.id];
		},
		addAngleAxis(e, t) {
			e.angleAxis[t.payload.id] = G(t.payload);
		},
		removeAngleAxis(e, t) {
			delete e.angleAxis[t.payload.id];
		}
	}
}), Hx = Vx.actions;
Hx.addRadiusAxis, Hx.removeRadiusAxis, Hx.addAngleAxis, Hx.removeAngleAxis;
var Ux = Vx.reducer;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/getClassNameFromUnknown.js
function Wx(e) {
	return e && typeof e == "object" && "className" in e && typeof e.className == "string" ? e.className : "";
}
// node_modules/.bun/react-is@19.2.7/node_modules/react-is/cjs/react-is.production.js
var Gx = /* @__PURE__ */ n(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), a = Symbol.for("react.profiler"), o = Symbol.for("react.consumer"), s = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.suspense_list"), d = Symbol.for("react.memo"), f = Symbol.for("react.lazy"), p = Symbol.for("react.view_transition");
	function m(e) {
		if (typeof e == "object" && e) {
			var m = e.$$typeof;
			switch (m) {
				case t: switch (e = e.type, e) {
					case r:
					case a:
					case i:
					case l:
					case u:
					case p: return e;
					default: switch (e &&= e.$$typeof, e) {
						case s:
						case c:
						case f:
						case d: return e;
						case o: return e;
						default: return m;
					}
				}
				case n: return m;
			}
		}
	}
	e.isFragment = function(e) {
		return m(e) === r;
	};
})), Kx = (/* @__PURE__ */ n(((e, t) => {
	t.exports = Gx();
})))(), qx = (e) => typeof e == "string" ? e : e ? e.displayName || e.name || "Component" : "", Jx = null, Yx = null, Xx = (e) => {
	if (e === Jx && Array.isArray(Yx)) return Yx;
	var t = [];
	return Pe.forEach(e, (e) => {
		V(e) || ((0, Kx.isFragment)(e) ? t = t.concat(Xx(e.props.children)) : t.push(e));
	}), Yx = t, Jx = e, t;
};
function Zx(e, t) {
	var n = [], r = [];
	return r = Array.isArray(t) ? t.map((e) => qx(e)) : [qx(t)], Xx(e).forEach((e) => {
		var t = (0, Gn.default)(e, "type.displayName") || (0, Gn.default)(e, "type.name");
		t && r.indexOf(t) !== -1 && n.push(e);
	}), n;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/ActiveShapeUtils.js
function Qx(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function $x(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Qx(Object(n), !0).forEach(function(t) {
			eS(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Qx(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function eS(e, t, n) {
	return (t = tS(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function tS(e) {
	var t = nS(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function nS(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function rS(e, t) {
	return $x($x({}, t), e);
}
function iS(e) {
	return /*#__PURE__*/ Be(e) ? e.props : e;
}
function aS(e, t) {
	return /*#__PURE__*/ Ie(e, rS(iS(e), t));
}
function oS(e) {
	if ("index" in e) {
		var t = e.index;
		return typeof t == "number" || typeof t == "string" ? t : void 0;
	}
}
function sS(e) {
	return "isActive" in e && e.isActive === !0;
}
function cS(e) {
	var t = e.option, n = e.DefaultShape, r = e.shapeProps, i = e.activeClassName, a = i === void 0 ? "recharts-active-shape" : i, o = e.inActiveClassName, s = o === void 0 ? "recharts-shape" : o, c = oS(r), l = /*#__PURE__*/ Be(t) ? aS(t, r) : t === n ? /*#__PURE__*/ P.createElement(n, r) : typeof t == "function" ? t(r, c) : typeof t == "object" ? /*#__PURE__*/ P.createElement(n, rS(t, r)) : /*#__PURE__*/ P.createElement(n, r);
	return sS(r) ? /*#__PURE__*/ P.createElement(Nn, { className: a }, l) : /*#__PURE__*/ P.createElement(Nn, { className: s }, l);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/context/tooltipContext.js
var lS = (e, t, n) => {
	var r = H();
	return (i, a) => (o) => {
		e?.(i, a, o), r(Eg({
			activeIndex: String(a),
			activeDataKey: t,
			activeCoordinate: i.tooltipPosition,
			activeGraphicalItemId: n
		}));
	};
}, uS = (e) => {
	var t = H();
	return (n, r) => (i) => {
		e?.(n, r, i), t(Dg());
	};
}, dS = (e, t, n) => {
	var r = H();
	return (i, a) => (o) => {
		e?.(i, a, o), r(kg({
			activeIndex: String(a),
			activeDataKey: t,
			activeCoordinate: i.tooltipPosition,
			activeGraphicalItemId: n
		}));
	};
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/SetTooltipEntrySettings.js
function fS(e) {
	var t = e.tooltipEntrySettings, n = H(), r = Sc(), i = L(null);
	return We(() => {
		r || (i.current === null ? n(Sg(t)) : i.current !== t && n(Cg({
			prev: i.current,
			next: t
		})), i.current = t);
	}, [
		t,
		n,
		r
	]), We(() => () => {
		i.current &&= (n(wg(i.current)), null);
	}, [n]), null;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/SetLegendPayload.js
function pS(e) {
	var t = e.legendPayload, n = H(), r = Sc(), i = L(null);
	return We(() => {
		r || (i.current === null ? n(Bc(t)) : i.current !== t && n(Vc({
			prev: i.current,
			next: t
		})), i.current = t);
	}, [
		n,
		r,
		t
	]), We(() => () => {
		i.current &&= (n(Hc(i.current)), null);
	}, [n]), null;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/animation/matchBy.js
function mS(e, t) {
	return yS(e) || vS(e, t) || gS(e, t) || hS();
}
function hS() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function gS(e, t) {
	if (e) {
		if (typeof e == "string") return _S(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? _S(e, t) : void 0;
	}
}
function _S(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function vS(e, t) {
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
function yS(e) {
	if (Array.isArray(e)) return e;
}
var bS = "index", xS = "append";
function SS(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [], r = [];
	for (var i of n) r.push({
		status: "removed",
		prev: i
	});
	for (var a = 0; a < t.length; a++) {
		var o = e[a], s = t[a];
		o == null ? r.push({
			status: "added",
			next: s
		}) : r.push({
			status: "matched",
			prev: o,
			next: s
		});
	}
	return r;
}
function CS(e, t) {
	var n = e.length / t.length;
	return SS(t.map((t, r) => e[Math.floor(r * n)]), t);
}
function wS(e, t) {
	return SS(t.map((t, n) => e[n]), t);
}
function TS(e, t) {
	for (var n = /* @__PURE__ */ new Map(), r = 0; r < e.length; r++) {
		var i = e[r];
		if (i != null) {
			var a = t(i, r);
			a != null && !n.has(a) && n.set(a, i);
		}
	}
	return n;
}
function ES(e, t, n) {
	var r = TS(e, n), i = /* @__PURE__ */ new Set(), a = t.map((e, t) => {
		var a = n(e, t);
		if (a != null) {
			var o = r.get(a);
			if (o !== void 0) return i.add(a), o;
		}
	}), o = [];
	for (var s of r) {
		var c = mS(s, 2), l = c[0], u = c[1];
		i.has(l) || o.push(u);
	}
	return SS(a, t, o);
}
function DS(e, t, n) {
	return t == null ? null : e == null ? t.map((e) => ({
		status: "added",
		next: e
	})) : n === "index" ? CS(e, t) : n === "append" ? wS(e, t) : ES(e, t, n);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/animation/useAnimationStartSnapshot.js
function OS(e, t) {
	var n = L(e), r = L(t.current), i = L(!0);
	n.current !== e && (n.current = e, r.current = t.current, i.current = !1);
	var a = F(function(e, n) {
		var a = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : !0;
		n === 0 ? i.current = !0 : (n === 1 && (r.current = e), n > 0 && i.current && a && (t.current = e));
	}, [t]);
	return {
		startValue: r.current,
		syncStepValue: a
	};
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/animation/AnimatedItems.js
function kS(e, t) {
	return PS(e) || NS(e, t) || jS(e, t) || AS();
}
function AS() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function jS(e, t) {
	if (e) {
		if (typeof e == "string") return MS(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? MS(e, t) : void 0;
	}
}
function MS(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function NS(e, t) {
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
function PS(e) {
	if (Array.isArray(e)) return e;
}
function FS(e, t) {
	var n = kS(Ke(!1), 2), r = n[0], i = n[1];
	return {
		isAnimating: r,
		handleAnimationStart: F(() => {
			typeof e == "function" && e(), i(!0);
		}, [e]),
		handleAnimationEnd: F(() => {
			typeof t == "function" && t(), i(!1);
		}, [t])
	};
}
function IS(e) {
	var t = e.animationInput, n = e.animationIdPrefix, r = e.items, i = e.previousItemsRef, a = e.isAnimationActive, o = e.animationBegin, s = e.animationDuration, c = e.animationEasing, l = e.onAnimationStart, u = e.onAnimationEnd, d = e.animationInterpolateFn, f = e.animationMatchBy, p = e.shouldUpdatePreviousRef, m = e.children, h = e.layout, g = od(t, n), _ = OS(g, i), v = _.startValue ?? null, y = DS(v, r, f ?? bS);
	return /*#__PURE__*/ P.createElement(ad, {
		animationId: g,
		begin: o,
		duration: s,
		isActive: a,
		easing: c,
		onAnimationEnd: u,
		onAnimationStart: l,
		key: g
	}, (e) => {
		var t = v == null, n = r == null ? r : d(y, e, h), i = p ? p(e) : e > 0;
		return _.syncStepValue(n, e, i), n == null ? null : m(n, e, t);
	});
}
function LS(e, t) {
	return HS(e) || VS(e, t) || zS(e, t) || RS();
}
function RS() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function zS(e, t) {
	if (e) {
		if (typeof e == "string") return BS(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? BS(e, t) : void 0;
	}
}
function BS(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function VS(e, t) {
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
function HS(e) {
	if (Array.isArray(e)) return e;
}
var US = P.useId ?? (() => LS(P.useState(() => Zn("uid-")), 1)[0]);
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/useUniqueId.js
function WS(e, t) {
	var n = US();
	return t || (e ? `${e}-${n}` : n);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/context/RegisterGraphicalItemId.js
var GS = /*#__PURE__*/ Le(void 0), KS = (e) => {
	var t = e.id, n = e.type, r = e.children, i = WS(`recharts-${n}`, t);
	return /*#__PURE__*/ P.createElement(GS.Provider, { value: i }, r(i));
}, qS = Po({
	name: "graphicalItems",
	initialState: {
		cartesianItems: [],
		polarItems: []
	},
	reducers: {
		addCartesianGraphicalItem: {
			reducer(e, t) {
				e.cartesianItems.push(G(t.payload));
			},
			prepare: K()
		},
		replaceCartesianGraphicalItem: {
			reducer(e, t) {
				var n = t.payload, r = n.prev, i = n.next, a = ao(e).cartesianItems.indexOf(G(r));
				a > -1 && (e.cartesianItems[a] = G(i));
			},
			prepare: K()
		},
		removeCartesianGraphicalItem: {
			reducer(e, t) {
				var n = ao(e).cartesianItems.indexOf(G(t.payload));
				n > -1 && e.cartesianItems.splice(n, 1);
			},
			prepare: K()
		},
		addPolarGraphicalItem: {
			reducer(e, t) {
				e.polarItems.push(G(t.payload));
			},
			prepare: K()
		},
		removePolarGraphicalItem: {
			reducer(e, t) {
				var n = ao(e).polarItems.indexOf(G(t.payload));
				n > -1 && e.polarItems.splice(n, 1);
			},
			prepare: K()
		},
		replacePolarGraphicalItem: {
			reducer(e, t) {
				var n = t.payload, r = n.prev, i = n.next, a = ao(e).polarItems.indexOf(G(r));
				a > -1 && (e.polarItems[a] = G(i));
			},
			prepare: K()
		}
	}
}), JS = qS.actions, YS = JS.addCartesianGraphicalItem, XS = JS.replaceCartesianGraphicalItem, ZS = JS.removeCartesianGraphicalItem;
JS.addPolarGraphicalItem, JS.removePolarGraphicalItem, JS.replacePolarGraphicalItem;
var QS = qS.reducer, $S = /*#__PURE__*/ Ve((e) => {
	var t = H(), n = L(null);
	return We(() => {
		n.current === null ? t(YS(e)) : n.current !== e && t(XS({
			prev: n.current,
			next: e
		})), n.current = e;
	}, [t, e]), We(() => () => {
		n.current &&= (t(ZS(n.current)), null);
	}, [t]), null;
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/cartesianAxisSlice.js
function eC(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function tC(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? eC(Object(n), !0).forEach(function(t) {
			nC(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : eC(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function nC(e, t, n) {
	return (t = rC(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function rC(e) {
	var t = iC(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function iC(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var aC = Po({
	name: "cartesianAxis",
	initialState: {
		xAxis: {},
		yAxis: {},
		zAxis: {}
	},
	reducers: {
		addXAxis: {
			reducer(e, t) {
				e.xAxis[t.payload.id] = G(t.payload);
			},
			prepare: K()
		},
		replaceXAxis: {
			reducer(e, t) {
				var n = t.payload, r = n.prev, i = n.next;
				e.xAxis[r.id] !== void 0 && (r.id !== i.id && delete e.xAxis[r.id], e.xAxis[i.id] = G(i));
			},
			prepare: K()
		},
		removeXAxis: {
			reducer(e, t) {
				delete e.xAxis[t.payload.id];
			},
			prepare: K()
		},
		addYAxis: {
			reducer(e, t) {
				e.yAxis[t.payload.id] = G(t.payload);
			},
			prepare: K()
		},
		replaceYAxis: {
			reducer(e, t) {
				var n = t.payload, r = n.prev, i = n.next;
				e.yAxis[r.id] !== void 0 && (r.id !== i.id && delete e.yAxis[r.id], e.yAxis[i.id] = G(i));
			},
			prepare: K()
		},
		removeYAxis: {
			reducer(e, t) {
				delete e.yAxis[t.payload.id];
			},
			prepare: K()
		},
		addZAxis: {
			reducer(e, t) {
				e.zAxis[t.payload.id] = G(t.payload);
			},
			prepare: K()
		},
		replaceZAxis: {
			reducer(e, t) {
				var n = t.payload, r = n.prev, i = n.next;
				e.zAxis[r.id] !== void 0 && (r.id !== i.id && delete e.zAxis[r.id], e.zAxis[i.id] = G(i));
			},
			prepare: K()
		},
		removeZAxis: {
			reducer(e, t) {
				delete e.zAxis[t.payload.id];
			},
			prepare: K()
		},
		updateYAxisWidth(e, t) {
			var n = t.payload, r = n.id, i = n.width, a = e.yAxis[r];
			if (a) {
				var o = a.widthHistory || [];
				if (o.length === 3 && o[0] === o[2] && i === o[1] && i !== a.width && Math.abs(i - (o[0] ?? 0)) <= 1) return;
				var s = [...o, i].slice(-3);
				e.yAxis[r] = tC(tC({}, a), {}, {
					width: i,
					widthHistory: s
				});
			}
		}
	}
}), oC = aC.actions, sC = oC.addXAxis, cC = oC.replaceXAxis, lC = oC.removeXAxis, uC = oC.addYAxis, dC = oC.replaceYAxis, fC = oC.removeYAxis;
oC.addZAxis, oC.replaceZAxis, oC.removeZAxis;
var pC = oC.updateYAxisWidth, mC = aC.reducer, hC = W([
	W([vc], (e) => ({
		top: e.top,
		bottom: e.bottom,
		left: e.left,
		right: e.right
	})),
	tc,
	nc
], (e, t, n) => {
	if (e && t != null && n != null) return {
		x: e.left,
		y: e.top,
		width: Math.max(0, t - e.left - e.right),
		height: Math.max(0, n - e.top - e.bottom)
	};
}), gC = () => U(hC), _C = () => {
	var e = U(R_);
	if (e != null) return {
		x: e.x,
		y: e.y
	};
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineBarSizeList.js
function vC(e, t) {
	return CC(e) || SC(e, t) || bC(e, t) || yC();
}
function yC() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function bC(e, t) {
	if (e) {
		if (typeof e == "string") return xC(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? xC(e, t) : void 0;
	}
}
function xC(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function SC(e, t) {
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
function CC(e) {
	if (Array.isArray(e)) return e;
}
var wC = (e, t, n) => {
	var r = n ?? e;
	if (!V(r)) return Qn(r, t, 0);
}, TC = (e, t, n) => {
	var r = {}, i = e.filter(Np), a = e.filter((e) => e.stackId == null), o = i.reduce((e, t) => {
		var n = e[t.stackId];
		return n ??= [], n.push(t), e[t.stackId] = n, e;
	}, r), s = Object.entries(o).map((e) => {
		var r = vC(e, 2), i = r[0], a = r[1];
		return {
			stackId: i,
			dataKeys: a.map((e) => e.dataKey),
			barSize: wC(t, n, a[0]?.barSize)
		};
	}), c = a.map((e) => ({
		stackId: void 0,
		dataKeys: [e.dataKey].filter((e) => e != null),
		barSize: wC(t, n, e.barSize)
	}));
	return [...s, ...c];
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/combiners/combineAllBarPositions.js
function EC(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function DC(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? EC(Object(n), !0).forEach(function(t) {
			OC(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : EC(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function OC(e, t, n) {
	return (t = kC(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function kC(e) {
	var t = AC(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function AC(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function jC(e, t, n, r, i) {
	var a = r.length;
	if (!(a < 1)) {
		var o = Qn(e, n, 0, !0), s, c = [];
		if (q(r[0]?.barSize)) {
			var l = !1, u = n / a, d = r.reduce((e, t) => e + (t.barSize || 0), 0);
			d += (a - 1) * o, d >= n && (d -= (a - 1) * o, o = 0), d >= n && u > 0 && (l = !0, u *= .9, d = a * u);
			var f = {
				offset: Math.round((n - d) / 2) - o,
				size: 0
			};
			s = r.reduce((e, t) => {
				var n = {
					stackId: t.stackId,
					dataKeys: t.dataKeys,
					position: {
						offset: f.offset + f.size + o,
						size: l ? u : t.barSize ?? 0
					}
				}, r = [...e, n];
				return f = n.position, r;
			}, c);
		} else {
			var p = Qn(t, n, 0, !0);
			n - 2 * p - (a - 1) * o <= 0 && (o = 0);
			var m = (n - 2 * p - (a - 1) * o) / a;
			m > 1 && (m = Math.round(m));
			var h = q(i) ? Math.min(m, i) : m;
			s = r.reduce((e, t, n) => [...e, {
				stackId: t.stackId,
				dataKeys: t.dataKeys,
				position: {
					offset: p + (m + o) * n + (m - h) / 2,
					size: h
				}
			}], c);
		}
		return s;
	}
}
var MC = (e, t, n, r, i, a, o) => {
	var s = V(o) ? t : o, c = jC(n, r, i === a ? a : i, e, s);
	return i !== a && c != null && (c = c.map((e) => DC(DC({}, e), {}, { position: DC(DC({}, e.position), {}, { offset: e.position.offset - i / 2 }) }))), c;
}, NC = (e, t) => {
	var n = jp(t);
	if (e && n != null && t != null) {
		var r = t.stackId;
		if (r != null) {
			var i = e[r];
			if (i) {
				var a = i.stackedData;
				if (a) return a.find((e) => e.key === n);
			}
		}
	}
}, PC = (e, t) => {
	if (e != null && t != null) {
		var n = e.find((e) => e.stackId === t.stackId && t.dataKey != null && e.dataKeys.includes(t.dataKey));
		if (n != null) return n.position;
	}
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/zIndex/getZIndexFromUnknown.js
function FC(e, t) {
	return e && typeof e == "object" && "zIndex" in e && typeof e.zIndex == "number" && q(e.zIndex) ? e.zIndex : t;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/context/chartDataContext.js
var IC = (e) => {
	var t = e.chartData, n = H(), r = Sc();
	return I(() => r ? () => {} : (n(ay(t)), () => {
		n(ay(void 0));
	}), [
		t,
		n,
		r
	]), null;
}, LC = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	padding: {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	}
}, RC = Po({
	name: "brush",
	initialState: LC,
	reducers: { setBrushSettings(e, t) {
		return t.payload == null ? LC : t.payload;
	} }
});
RC.actions.setBrushSettings;
var zC = RC.reducer;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/CartesianUtils.js
function BC(e) {
	return (e % 180 + 180) % 180;
}
var VC = function(e) {
	var t = e.width, n = e.height, r = BC(arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0) * Math.PI / 180, i = Math.atan(n / t), a = r > i && r < Math.PI - i ? n / Math.sin(r) : t / Math.cos(r);
	return Math.abs(a);
}, HC = Po({
	name: "referenceElements",
	initialState: {
		dots: [],
		areas: [],
		lines: []
	},
	reducers: {
		addDot: (e, t) => {
			e.dots.push(t.payload);
		},
		removeDot: (e, t) => {
			var n = ao(e).dots.findIndex((e) => e === t.payload);
			n !== -1 && e.dots.splice(n, 1);
		},
		addArea: (e, t) => {
			e.areas.push(t.payload);
		},
		removeArea: (e, t) => {
			var n = ao(e).areas.findIndex((e) => e === t.payload);
			n !== -1 && e.areas.splice(n, 1);
		},
		addLine: (e, t) => {
			e.lines.push(G(t.payload));
		},
		removeLine: (e, t) => {
			var n = ao(e).lines.findIndex((e) => e === t.payload);
			n !== -1 && e.lines.splice(n, 1);
		}
	}
}), UC = HC.actions;
UC.addDot, UC.removeDot, UC.addArea, UC.removeArea, UC.addLine, UC.removeLine;
var WC = HC.reducer;
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/container/ClipPathProvider.js
function GC(e, t) {
	return XC(e) || YC(e, t) || qC(e, t) || KC();
}
function KC() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function qC(e, t) {
	if (e) {
		if (typeof e == "string") return JC(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? JC(e, t) : void 0;
	}
}
function JC(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function YC(e, t) {
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
function XC(e) {
	if (Array.isArray(e)) return e;
}
var ZC = /*#__PURE__*/ Le(void 0), QC = (e) => {
	var t = e.children, n = GC(Ke(`${Zn("recharts")}-clip`), 1)[0], r = gC();
	if (r == null) return null;
	var i = r.x, a = r.y, o = r.width, s = r.height;
	return /*#__PURE__*/ P.createElement(ZC.Provider, { value: n }, /*#__PURE__*/ P.createElement("defs", null, /*#__PURE__*/ P.createElement("clipPath", { id: n }, /*#__PURE__*/ P.createElement("rect", {
		x: i,
		y: a,
		height: s,
		width: o
	}))), t);
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/getEveryNth.js
function $C(e, t) {
	if (t < 1) return [];
	if (t === 1) return e;
	for (var n = [], r = 0; r < e.length; r += t) {
		var i = e[r];
		i !== void 0 && n.push(i);
	}
	return n;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/TickUtils.js
function ew(e, t, n) {
	return VC({
		width: e.width + t.width,
		height: e.height + t.height
	}, n);
}
function tw(e, t, n) {
	var r = n === "width", i = e.x, a = e.y, o = e.width, s = e.height;
	return t === 1 ? {
		start: r ? i : a,
		end: r ? i + o : a + s
	} : {
		start: r ? i + o : a + s,
		end: r ? i : a
	};
}
function nw(e, t, n, r, i) {
	if (e * t < e * r || e * t > e * i) return !1;
	var a = n();
	return e * (t - e * a / 2 - r) >= 0 && e * (t + e * a / 2 - i) <= 0;
}
function rw(e, t) {
	return $C(e, t + 1);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/cartesian/getEquidistantTicks.js
function iw(e, t, n, r, i) {
	for (var a = (r || []).slice(), o = t.start, s = t.end, c = 0, l = 1, u = o, d = function() {
		var t = r?.[c];
		if (t === void 0) return { v: $C(r, l) };
		var a = c, d, f = () => (d === void 0 && (d = n(t, a)), d), p = t.coordinate, m = c === 0 || nw(e, p, f, u, s);
		m || (c = 0, u = o, l += 1), m && (u = p + e * (f() / 2 + i), c += l);
	}, f; l <= a.length;) if (f = d(), f) return f.v;
	return [];
}
function aw(e, t, n, r, i) {
	var a = (r || []).slice().length;
	if (a === 0) return [];
	for (var o = t.start, s = t.end, c = 1; c <= a; c++) {
		for (var l = (a - 1) % c, u = o, d = !0, f = function() {
			var t = r[m];
			if (t == null) return 0;
			var a = m, o, c = () => (o === void 0 && (o = n(t, a)), o), f = t.coordinate, p = m === l || nw(e, f, c, u, s);
			if (!p) return d = !1, 1;
			p && (u = f + e * (c() / 2 + i));
		}, p, m = l; m < a && (p = f(), p === 0 || p !== 1); m += c);
		if (d) {
			for (var h = [], g = l; g < a; g += c) {
				var _ = r[g];
				_ != null && h.push(_);
			}
			return h;
		}
	}
	return [];
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/cartesian/getTicks.js
function ow(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function sw(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? ow(Object(n), !0).forEach(function(t) {
			cw(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : ow(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function cw(e, t, n) {
	return (t = lw(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function lw(e) {
	var t = uw(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function uw(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function dw(e, t, n, r, i) {
	for (var a = (r || []).slice(), o = a.length, s = t.start, c = t.end, l = function(t) {
		var r = a[t];
		if (r == null) return 1;
		var l = r, u, d = () => (u === void 0 && (u = n(r, t)), u);
		if (t === o - 1) {
			var f = e * (l.coordinate + e * d() / 2 - c);
			a[t] = l = sw(sw({}, l), {}, { tickCoord: f > 0 ? l.coordinate - f * e : l.coordinate });
		} else a[t] = l = sw(sw({}, l), {}, { tickCoord: l.coordinate });
		l.tickCoord != null && nw(e, l.tickCoord, d, s, c) && (c = l.tickCoord - e * (d() / 2 + i), a[t] = sw(sw({}, l), {}, { isShow: !0 }));
	}, u = o - 1; u >= 0; u--) if (l(u)) continue;
	return a;
}
function fw(e, t, n, r, i, a) {
	var o = (r || []).slice(), s = o.length, c = t.start, l = t.end;
	if (a) {
		var u = r[s - 1];
		if (u != null) {
			var d = n(u, s - 1), f = e * (u.coordinate + e * d / 2 - l);
			o[s - 1] = u = sw(sw({}, u), {}, { tickCoord: f > 0 ? u.coordinate - f * e : u.coordinate }), u.tickCoord != null && nw(e, u.tickCoord, () => d, c, l) && (l = u.tickCoord - e * (d / 2 + i), o[s - 1] = sw(sw({}, u), {}, { isShow: !0 }));
		}
	}
	for (var p = a ? s - 1 : s, m = function(t) {
		var r = o[t];
		if (r == null) return 1;
		var a = r, s, u = () => (s === void 0 && (s = n(r, t)), s);
		if (t === 0) {
			var d = e * (a.coordinate - e * u() / 2 - c);
			o[t] = a = sw(sw({}, a), {}, { tickCoord: d < 0 ? a.coordinate - d * e : a.coordinate });
		} else o[t] = a = sw(sw({}, a), {}, { tickCoord: a.coordinate });
		a.tickCoord != null && nw(e, a.tickCoord, u, c, l) && (c = a.tickCoord + e * (u() / 2 + i), o[t] = sw(sw({}, a), {}, { isShow: !0 }));
	}, h = 0; h < p; h++) if (m(h)) continue;
	return o;
}
function pw(e, t, n) {
	var r = e.tick, i = e.ticks, a = e.viewBox, o = e.minTickGap, s = e.orientation, c = e.interval, l = e.tickFormatter, u = e.unit, d = e.angle;
	if (!i || !i.length || !r) return [];
	if (B(c) || jl.isSsr) return rw(i, B(c) ? c : 0) ?? [];
	var f = [], p = s === "top" || s === "bottom" ? "width" : "height", m = u && p === "width" ? Qy(u, {
		fontSize: t,
		letterSpacing: n
	}) : {
		width: 0,
		height: 0
	}, h = (e, r) => {
		var i = typeof l == "function" ? l(e.value, r) : e.value;
		return p === "width" ? ew(Qy(i, {
			fontSize: t,
			letterSpacing: n
		}), m, d) : Qy(i, {
			fontSize: t,
			letterSpacing: n
		})[p];
	}, g = i[0], _ = i[1], v = i.length >= 2 && g != null && _ != null ? Kn(_.coordinate - g.coordinate) : 1, y = tw(a, v, p);
	return c === "equidistantPreserveStart" ? iw(v, y, h, i, o) : c === "equidistantPreserveEnd" ? aw(v, y, h, i, o) : (f = c === "preserveStart" || c === "preserveStartEnd" ? fw(v, y, h, i, o, c === "preserveStartEnd") : dw(v, y, h, i, o), f.filter((e) => e.isShow));
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/YAxisUtils.js
var mw = (e) => {
	var t = e.ticks, n = e.label, r = e.labelGapWithTick, i = r === void 0 ? 5 : r, a = e.tickSize, o = a === void 0 ? 0 : a, s = e.tickMargin, c = s === void 0 ? 0 : s, l = 0;
	if (t) {
		Array.from(t).forEach((e) => {
			if (e) {
				var t = e.getBoundingClientRect();
				t.width > l && (l = t.width);
			}
		});
		var u = n ? n.getBoundingClientRect().width : 0, d = o + c, f = l + d + u + (n ? i : 0);
		return Math.round(f);
	}
	return 0;
}, hw = Po({
	name: "renderedTicks",
	initialState: {
		xAxis: {},
		yAxis: {}
	},
	reducers: {
		setRenderedTicks: (e, t) => {
			var n = t.payload, r = n.axisType, i = n.axisId, a = n.ticks;
			e[r][i] = G(a);
		},
		removeRenderedTicks: (e, t) => {
			var n = t.payload, r = n.axisType, i = n.axisId;
			delete e[r][i];
		}
	}
}), gw = hw.actions, _w = gw.setRenderedTicks, vw = gw.removeRenderedTicks, yw = hw.reducer, bw = [
	"axisLine",
	"width",
	"height",
	"className",
	"hide",
	"ticks",
	"axisType",
	"axisId"
];
function xw(e, t) {
	return Ew(e) || Tw(e, t) || Cw(e, t) || Sw();
}
function Sw() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Cw(e, t) {
	if (e) {
		if (typeof e == "string") return ww(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? ww(e, t) : void 0;
	}
}
function ww(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Tw(e, t) {
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
function Ew(e) {
	if (Array.isArray(e)) return e;
}
function Dw(e, t) {
	if (e == null) return {};
	var n, r, i = Ow(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Ow(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function kw() {
	return kw = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, kw.apply(null, arguments);
}
function Aw(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function $(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Aw(Object(n), !0).forEach(function(t) {
			jw(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Aw(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function jw(e, t, n) {
	return (t = Mw(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Mw(e) {
	var t = Nw(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Nw(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Pw = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	viewBox: {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	},
	orientation: "bottom",
	ticks: [],
	stroke: "#666",
	tickLine: !0,
	axisLine: !0,
	tick: !0,
	mirror: !1,
	minTickGap: 5,
	tickSize: 6,
	tickMargin: 2,
	interval: "preserveEnd",
	zIndex: cp.axis
};
function Fw(e) {
	var t = e.x, n = e.y, r = e.width, i = e.height, a = e.orientation, o = e.mirror, s = e.axisLine, c = e.otherSvgProps;
	if (!s) return null;
	var l = $($($({}, c), xn(s)), {}, { fill: "none" });
	if (a === "top" || a === "bottom") {
		var u = +(a === "top" && !o || a === "bottom" && o);
		l = $($({}, l), {}, {
			x1: t,
			y1: n + u * i,
			x2: t + r,
			y2: n + u * i
		});
	} else {
		var d = +(a === "left" && !o || a === "right" && o);
		l = $($({}, l), {}, {
			x1: t + d * r,
			y1: n,
			x2: t + d * r,
			y2: n + i
		});
	}
	return /*#__PURE__*/ P.createElement("line", kw({}, l, { className: z("recharts-cartesian-axis-line", (0, Gn.default)(s, "className")) }));
}
function Iw(e, t, n, r, i, a, o, s, c) {
	var l, u, d, f, p, m, h = s ? -1 : 1, g = e.tickSize || o, _ = B(e.tickCoord) ? e.tickCoord : e.coordinate;
	switch (a) {
		case "top":
			l = u = e.coordinate, f = n + +!s * i, d = f - h * g, m = d - h * c, p = _;
			break;
		case "left":
			d = f = e.coordinate, u = t + +!s * r, l = u - h * g, p = l - h * c, m = _;
			break;
		case "right":
			d = f = e.coordinate, u = t + +s * r, l = u + h * g, p = l + h * c, m = _;
			break;
		default: l = u = e.coordinate, f = n + +s * i, d = f + h * g, m = d + h * c, p = _;
	}
	return {
		line: {
			x1: l,
			y1: d,
			x2: u,
			y2: f
		},
		tick: {
			x: p,
			y: m
		}
	};
}
function Lw(e, t) {
	switch (e) {
		case "left": return t ? "start" : "end";
		case "right": return t ? "end" : "start";
		default: return "middle";
	}
}
function Rw(e, t) {
	switch (e) {
		case "left":
		case "right": return "middle";
		case "top": return t ? "start" : "end";
		default: return t ? "end" : "start";
	}
}
function zw(e) {
	var t = e.option, n = e.tickProps, r = e.value, i, a = z(n.className, "recharts-cartesian-axis-tick-value");
	if (/*#__PURE__*/ P.isValidElement(t)) i = /*#__PURE__*/ P.cloneElement(t, $($({}, n), {}, { className: a }));
	else if (typeof t == "function") i = t($($({}, n), {}, { className: a }));
	else {
		var o = "recharts-cartesian-axis-tick-value";
		typeof t != "boolean" && (o = z(o, Wx(t))), i = /*#__PURE__*/ P.createElement(Yb, kw({}, n, { className: o }), r);
	}
	return i;
}
function Bw(e) {
	var t = e.ticks, n = e.axisType, r = e.axisId, i = H();
	return I(() => r == null || n == null ? ir : (i(_w({
		ticks: t.map((e) => ({
			value: e.value,
			coordinate: e.coordinate,
			offset: e.offset,
			index: e.index
		})),
		axisId: r,
		axisType: n
	})), () => {
		i(vw({
			axisId: r,
			axisType: n
		}));
	}), [
		i,
		t,
		r,
		n
	]), null;
}
var Vw = /*#__PURE__*/ ze((e, t) => {
	var n = e.ticks, r = n === void 0 ? [] : n, i = e.tick, a = e.tickLine, o = e.stroke, s = e.tickFormatter, c = e.unit, l = e.padding, u = e.tickTextProps, d = e.orientation, f = e.mirror, p = e.x, m = e.y, h = e.width, g = e.height, _ = e.tickSize, v = e.tickMargin, y = e.fontSize, b = e.letterSpacing, x = e.getTicksConfig, S = e.events, C = e.axisType, w = e.axisId, T = pw($($({}, x), {}, { ticks: r }), y, b), E = xn(x), D = Sn(i), O = Rb(E.textAnchor) ? E.textAnchor : Lw(d, f), k = Rw(d, f), A = {};
	typeof a == "object" && (A = a);
	var j = $($({}, E), {}, { fill: "none" }, A), M = T.map((e) => $({ entry: e }, Iw(e, p, m, h, g, d, _, f, v))), N = M.map((e) => {
		var t = e.entry, n = e.line;
		return /*#__PURE__*/ P.createElement(Nn, {
			className: "recharts-cartesian-axis-tick",
			key: `tick-${t.value}-${t.coordinate}-${t.tickCoord}`
		}, a && /*#__PURE__*/ P.createElement("line", kw({}, j, n, { className: z("recharts-cartesian-axis-tick-line", (0, Gn.default)(a, "className")) })));
	}), ee = M.map((e, t) => {
		var n = e.entry, r = e.tick, a = $($({}, $($($($({ verticalAnchor: k }, E), {}, {
			textAnchor: O,
			stroke: "none",
			fill: o
		}, r), {}, {
			index: t,
			payload: n,
			visibleTicksCount: T.length,
			tickFormatter: s,
			padding: l
		}, u), {}, { angle: u?.angle ?? E.angle ?? 0 })), D);
		return /*#__PURE__*/ P.createElement(Nn, kw({
			className: "recharts-cartesian-axis-tick-label",
			key: `tick-label-${n.value}-${n.coordinate}-${n.tickCoord}`
		}, cr(S, n, t)), i && /*#__PURE__*/ P.createElement(zw, {
			option: i,
			tickProps: a,
			value: `${typeof s == "function" ? s(n.value, t) : n.value}${c || ""}`
		}));
	});
	return /*#__PURE__*/ P.createElement("g", { className: `recharts-cartesian-axis-ticks recharts-${C}-ticks` }, /*#__PURE__*/ P.createElement(Bw, {
		ticks: T,
		axisId: w,
		axisType: C
	}), ee.length > 0 && /*#__PURE__*/ P.createElement(Iv, { zIndex: cp.label }, /*#__PURE__*/ P.createElement("g", {
		className: `recharts-cartesian-axis-tick-labels recharts-${C}-tick-labels`,
		ref: t
	}, ee)), N.length > 0 && /*#__PURE__*/ P.createElement("g", { className: `recharts-cartesian-axis-tick-lines recharts-${C}-tick-lines` }, N));
}), Hw = /*#__PURE__*/ ze((e, t) => {
	var n = e.axisLine, r = e.width, i = e.height, a = e.className, o = e.hide, s = e.ticks, c = e.axisType, l = e.axisId, u = Dw(e, bw), d = xw(Ke(""), 2), f = d[0], p = d[1], m = xw(Ke(""), 2), h = m[0], g = m[1], _ = L(null);
	Ue(t, () => ({ getCalculatedWidth: () => mw({
		ticks: _.current,
		label: e.labelRef?.current,
		labelGapWithTick: 5,
		tickSize: e.tickSize,
		tickMargin: e.tickMargin
	}) }));
	var v = F((e) => {
		if (e) {
			var t = e.getElementsByClassName("recharts-cartesian-axis-tick-value");
			_.current = t;
			var n = t[0];
			if (n) {
				var r = window.getComputedStyle(n), i = r.fontSize, a = r.letterSpacing;
				(i !== f || a !== h) && (p(i), g(a));
			}
		}
	}, [f, h]);
	return o || r != null && r <= 0 || i != null && i <= 0 ? null : /*#__PURE__*/ P.createElement(Iv, { zIndex: e.zIndex }, /*#__PURE__*/ P.createElement(Nn, { className: z("recharts-cartesian-axis", a) }, /*#__PURE__*/ P.createElement(Fw, {
		x: e.x,
		y: e.y,
		width: r,
		height: i,
		orientation: e.orientation,
		mirror: e.mirror,
		axisLine: n,
		otherSvgProps: xn(e)
	}), /*#__PURE__*/ P.createElement(Vw, {
		ref: v,
		axisType: c,
		events: u,
		fontSize: f,
		getTicksConfig: e,
		height: e.height,
		letterSpacing: h,
		mirror: e.mirror,
		orientation: e.orientation,
		padding: e.padding,
		stroke: e.stroke,
		tick: e.tick,
		tickFormatter: e.tickFormatter,
		tickLine: e.tickLine,
		tickMargin: e.tickMargin,
		tickSize: e.tickSize,
		tickTextProps: e.tickTextProps,
		ticks: s,
		unit: e.unit,
		width: e.width,
		x: e.x,
		y: e.y,
		axisId: l
	}), /*#__PURE__*/ P.createElement(px, {
		x: e.x,
		y: e.y,
		width: e.width,
		height: e.height,
		lowerWidth: e.width,
		upperWidth: e.width
	}, /*#__PURE__*/ P.createElement(Dx, {
		label: e.label,
		labelRef: e.labelRef
	}), e.children)));
}), Uw = /*#__PURE__*/ P.forwardRef((e, t) => {
	var n = mr(e, Pw);
	return /*#__PURE__*/ P.createElement(Hw, kw({}, n, { ref: t }));
});
Uw.displayName = "CartesianAxis";
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/errorBarSlice.js
var Ww = Po({
	name: "errorBars",
	initialState: {},
	reducers: {
		addErrorBar: (e, t) => {
			var n = t.payload, r = n.itemId, i = n.errorBar;
			e[r] || (e[r] = []), e[r].push(i);
		},
		replaceErrorBar: (e, t) => {
			var n = t.payload, r = n.itemId, i = n.prev, a = n.next;
			e[r] && (e[r] = e[r].map((e) => e.dataKey === i.dataKey && e.direction === i.direction ? a : e));
		},
		removeErrorBar: (e, t) => {
			var n = t.payload, r = n.itemId, i = n.errorBar;
			e[r] && (e[r] = e[r].filter((e) => e.dataKey !== i.dataKey || e.direction !== i.direction));
		}
	}
}), Gw = Ww.actions;
Gw.addErrorBar, Gw.replaceErrorBar, Gw.removeErrorBar;
var Kw = Ww.reducer, qw = ["children"];
function Jw(e, t) {
	if (e == null) return {};
	var n, r, i = Yw(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Yw(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var Xw = /*#__PURE__*/ Le({
	data: [],
	xAxisId: "xAxis-0",
	yAxisId: "yAxis-0",
	dataPointFormatter: () => ({
		x: 0,
		y: 0,
		value: 0
	}),
	errorBarOffset: 0
});
function Zw(e) {
	var t = e.children, n = Jw(e, qw);
	return /*#__PURE__*/ P.createElement(Xw.Provider, { value: n }, t);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/cartesian/GraphicalItemClipPath.js
function Qw(e, t) {
	var n = U((t) => dm(t, e)), r = U((e) => pm(e, t)), i = n?.allowDataOverflow ?? X.allowDataOverflow, a = r?.allowDataOverflow ?? Z.allowDataOverflow;
	return {
		needClip: i || a,
		needClipX: i,
		needClipY: a
	};
}
function $w(e) {
	var t = e.xAxisId, n = e.yAxisId, r = e.clipPathId, i = gC(), a = Qw(t, n), o = a.needClipX, s = a.needClipY, c = a.needClip, l = U((e) => Ih(e, t, !1)), u = U((e) => Lh(e, n, !1));
	if (!c || !i) return null;
	var d = i.x, f = i.y, p = i.width, m = i.height, h = o && l ? Math.min(l[0], l[1]) : d - p / 2, g = s && u ? Math.min(u[0], u[1]) : f - m / 2, _ = o && l ? Math.abs(l[1] - l[0]) : p * 2, v = s && u ? Math.abs(u[1] - u[0]) : m * 2;
	return /*#__PURE__*/ P.createElement("clipPath", { id: `clipPath-${r}` }, /*#__PURE__*/ P.createElement("rect", {
		x: h,
		y: g,
		width: _,
		height: v
	}));
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/selectors/graphicalItemSelectors.js
function eT(e, t) {
	return e.graphicalItems.cartesianItems.find((e) => e.id === t)?.xAxisId ?? 0;
}
function tT(e, t) {
	return e.graphicalItems.cartesianItems.find((e) => e.id === t)?.yAxisId ?? 0;
}
// node_modules/.bun/tiny-invariant@1.3.3/node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var nT = "Invariant failed";
function rT(e, t) {
	if (!e) throw Error(nT);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/BarUtils.js
var iT = ["option"];
function aT(e, t) {
	if (e == null) return {};
	var n, r, i = oT(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function oT(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var sT = Rd;
function cT(e) {
	var t = e.option, n = aT(e, iT);
	return /*#__PURE__*/ P.createElement(cS, {
		option: t,
		DefaultShape: sT,
		shapeProps: n,
		activeClassName: "recharts-active-bar",
		inActiveClassName: "recharts-inactive-bar"
	});
}
var lT = function(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
	return (n, r) => {
		if (B(e)) return e;
		var i = B(n) || V(n);
		return i ? e(n, r) : (!i && rT(!1, `minPointSize callback function received a value with type of ${typeof n}. Currently only numbers or null/undefined are supported.`), t);
	};
}, uT = (e, t, n) => n, dT = W([xm, (e, t) => t], (e, t) => e.filter((e) => e.type === "bar").find((e) => e.id === t)), fT = W([dT], (e) => e?.maxBarSize), pT = (e, t, n, r) => r, mT = W([
	J,
	xm,
	eT,
	tT,
	uT
], (e, t, n, r, i) => t.filter((t) => e === "horizontal" ? t.xAxisId === n : t.yAxisId === r).filter((e) => e.isPanorama === i).filter((e) => e.hide === !1).filter((e) => e.type === "bar")), hT = (e, t, n) => {
	var r = J(e), i = eT(e, t), a = tT(e, t);
	if (i != null && a != null) return r === "horizontal" ? Km(e, "yAxis", a, n) : Km(e, "xAxis", i, n);
}, gT = W([
	mT,
	tp,
	(e, t) => {
		var n = J(e), r = eT(e, t), i = tT(e, t);
		if (r != null && i != null) return n === "horizontal" ? ag(e, "xAxis", r) : ag(e, "yAxis", i);
	}
], TC), _T = (e, t, n) => {
	var r = dT(e, t);
	if (r == null) return 0;
	var i = eT(e, t), a = tT(e, t);
	if (i == null || a == null) return 0;
	var o = J(e), s = Qf(e), c = r.maxBarSize, l = V(c) ? s : c, u, d;
	return o === "horizontal" ? (u = ug(e, "xAxis", i, n), d = lg(e, "xAxis", i, n)) : (u = ug(e, "yAxis", a, n), d = lg(e, "yAxis", a, n)), Xs(u, d, !0) ?? l ?? 0;
}, vT = (e, t, n) => {
	var r = J(e), i = eT(e, t), a = tT(e, t);
	if (i != null && a != null) {
		var o, s;
		return r === "horizontal" ? (o = ug(e, "xAxis", i, n), s = lg(e, "xAxis", i, n)) : (o = ug(e, "yAxis", a, n), s = lg(e, "yAxis", a, n)), Xs(o, s);
	}
}, yT = W([
	vc,
	bc,
	(e, t, n) => {
		var r = eT(e, t);
		if (r != null) return ug(e, "xAxis", r, n);
	},
	(e, t, n) => {
		var r = tT(e, t);
		if (r != null) return ug(e, "yAxis", r, n);
	},
	(e, t, n) => {
		var r = eT(e, t);
		if (r != null) return lg(e, "xAxis", r, n);
	},
	(e, t, n) => {
		var r = tT(e, t);
		if (r != null) return lg(e, "yAxis", r, n);
	},
	W([W([
		gT,
		Qf,
		$f,
		ep,
		_T,
		vT,
		fT
	], MC), dT], PC),
	J,
	wf,
	vT,
	W([hT, dT], NC),
	dT,
	pT
], (e, t, n, r, i, a, o, s, c, l, u, d, f) => {
	var p = c.chartData, m = c.dataStartIndex, h = c.dataEndIndex;
	if (!(d == null || o == null || t == null || s !== "horizontal" && s !== "vertical" || n == null || r == null || i == null || a == null || l == null)) {
		var g = d.data, _ = g != null && g.length > 0 ? g : p?.slice(m, h + 1);
		if (_ != null) return cE({
			layout: s,
			barSettings: d,
			pos: o,
			parentViewBox: t,
			bandSize: l,
			xAxis: n,
			yAxis: r,
			xAxisTicks: i,
			yAxisTicks: a,
			stackedData: u,
			displayedData: _,
			offset: e,
			cells: f,
			dataStartIndex: m
		});
	}
}), bT = ["index"];
function xT() {
	return xT = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, xT.apply(null, arguments);
}
function ST(e, t) {
	if (e == null) return {};
	var n, r, i = CT(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function CT(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var wT = /*#__PURE__*/ Le(void 0), TT = (e) => {
	var t = He(wT);
	if (t != null) return t.stackId;
	if (e != null) return Hs(e);
}, ET = (e, t) => `recharts-bar-stack-clip-path-${e}-${t}`, DT = (e) => {
	var t = He(wT);
	if (t != null) {
		var n = t.stackId;
		return `url(#${ET(n, e)})`;
	}
}, OT = (e) => {
	var t = e.index, n = ST(e, bT), r = DT(t);
	return /*#__PURE__*/ P.createElement(Nn, xT({
		className: "recharts-bar-stack-layer",
		clipPath: r
	}, n));
}, kT = [
	"onMouseEnter",
	"onMouseLeave",
	"onClick"
], AT = [
	"value",
	"background",
	"tooltipPosition"
], jT = ["id"], MT = [
	"onMouseEnter",
	"onClick",
	"onMouseLeave"
];
function NT(e, t) {
	return RT(e) || LT(e, t) || FT(e, t) || PT();
}
function PT() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function FT(e, t) {
	if (e) {
		if (typeof e == "string") return IT(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? IT(e, t) : void 0;
	}
}
function IT(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function LT(e, t) {
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
function RT(e) {
	if (Array.isArray(e)) return e;
}
function zT() {
	return zT = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, zT.apply(null, arguments);
}
function BT(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function VT(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? BT(Object(n), !0).forEach(function(t) {
			HT(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : BT(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function HT(e, t, n) {
	return (t = UT(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function UT(e) {
	var t = WT(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function WT(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function GT(e, t) {
	if (e == null) return {};
	var n, r, i = KT(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function KT(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var qT = (e) => {
	var t = e.dataKey, n = e.name, r = e.fill, i = e.legendType;
	return [{
		inactive: e.hide,
		dataKey: t,
		type: i,
		color: r,
		value: Qs(n, t),
		payload: e
	}];
}, JT = /*#__PURE__*/ P.memo((e) => {
	var t = e.dataKey, n = e.stroke, r = e.strokeWidth, i = e.fill, a = e.name, o = e.hide, s = e.unit, c = e.formatter, l = e.tooltipType, u = e.id, d = {
		dataDefinedOnItem: void 0,
		getPosition: ir,
		settings: {
			stroke: n,
			strokeWidth: r,
			fill: i,
			dataKey: t,
			nameKey: void 0,
			name: Qs(a, t),
			hide: o,
			type: l,
			color: i,
			unit: s,
			formatter: c,
			graphicalItemId: u
		}
	};
	return /*#__PURE__*/ P.createElement(fS, { tooltipEntrySettings: d });
});
function YT(e) {
	var t = U(N_), n = e.data, r = e.dataKey, i = e.background, a = e.allOtherBarProps, o = a.onMouseEnter, s = a.onMouseLeave, c = a.onClick, l = GT(a, kT), u = lS(o, r, a.id), d = uS(s), f = dS(c, r, a.id);
	if (!i || n == null) return null;
	var p = Sn(i);
	return /*#__PURE__*/ P.createElement(Iv, { zIndex: FC(i, cp.barBackground) }, n.map((e, n) => {
		e.value;
		var a = e.background;
		e.tooltipPosition;
		var o = GT(e, AT);
		if (!a) return null;
		var s = u(e, e.originalDataIndex), c = d(e, e.originalDataIndex), m = f(e, e.originalDataIndex), h = VT(VT(VT(VT(VT({
			option: i,
			isActive: String(e.originalDataIndex) === t
		}, o), {}, { fill: "#eee" }, a), p), cr(l, e, n)), {}, {
			onMouseEnter: s,
			onMouseLeave: c,
			onClick: m,
			dataKey: r,
			index: n,
			className: "recharts-bar-background-rectangle"
		});
		return /*#__PURE__*/ P.createElement(cT, zT({ key: `background-bar-${n}` }, h));
	}));
}
function XT(e) {
	var t = e.showLabels, n = e.children, r = e.rects?.map((e) => {
		var t = {
			x: e.x,
			y: e.y,
			width: e.width,
			lowerWidth: e.width,
			upperWidth: e.width,
			height: e.height
		};
		return VT(VT({}, t), {}, {
			value: e.value,
			payload: e.payload,
			parentViewBox: e.parentViewBox,
			viewBox: t,
			fill: e.fill
		});
	});
	return /*#__PURE__*/ P.createElement(Fx, { value: t ? r : void 0 }, n);
}
function ZT(e) {
	var t = e.shape, n = e.activeBar, r = e.baseProps, i = e.entry, a = e.index, o = e.dataKey, s = U(N_), c = U(F_), l = n && String(i.originalDataIndex) === s && (c == null || o === c), u = NT(Ke(!1), 2), d = u[0], f = u[1], p = NT(Ke(!1), 2), m = p[0], h = p[1];
	I(() => {
		var e;
		return l ? (f(!0), e = requestAnimationFrame(() => {
			h(!0);
		})) : h(!1), () => {
			cancelAnimationFrame(e);
		};
	}, [l]);
	var g = F(() => {
		l || f(!1);
	}, [l]), _ = l && m, v = l || d, y = l ? n === !0 ? t : n : t, b = /*#__PURE__*/ P.createElement(cT, zT({}, r, { name: String(r.name) }, i, {
		isActive: _,
		option: y,
		index: a,
		dataKey: o,
		animationElapsedTime: e.animationElapsedTime,
		isAnimating: e.isAnimating,
		isEntrance: e.isEntrance,
		onTransitionEnd: g
	}));
	return v ? /*#__PURE__*/ P.createElement(Iv, { zIndex: cp.activeBar }, /*#__PURE__*/ P.createElement(OT, { index: i.originalDataIndex }, b)) : b;
}
function QT(e) {
	var t = e.shape, n = e.baseProps, r = e.entry, i = e.index, a = e.dataKey;
	return /*#__PURE__*/ P.createElement(cT, zT({}, n, { name: String(n.name) }, r, {
		isActive: !1,
		option: t,
		index: i,
		dataKey: a,
		animationElapsedTime: e.animationElapsedTime,
		isAnimating: e.isAnimating,
		isEntrance: e.isEntrance
	}));
}
function $T(e) {
	var t = e.data, n = e.props, r = e.animationElapsedTime, i = e.isAnimating, a = e.isEntrance, o = xn(n) ?? {}, s = o.id, c = GT(o, jT), l = n.shape, u = n.dataKey, d = n.activeBar, f = n.onMouseEnter, p = n.onClick, m = n.onMouseLeave, h = GT(n, MT), g = lS(f, u, s), _ = uS(m), v = dS(p, u, s);
	return t ? /*#__PURE__*/ P.createElement(P.Fragment, null, t.map((e, t) => /*#__PURE__*/ P.createElement(OT, zT({
		index: e.originalDataIndex,
		key: `rectangle-${e?.x}-${e?.y}-${e?.value}-${t}`,
		className: "recharts-bar-rectangle"
	}, cr(h, e, t), {
		onMouseEnter: g(e, e.originalDataIndex),
		onMouseLeave: _(e, e.originalDataIndex),
		onClick: v(e, e.originalDataIndex)
	}), d ? /*#__PURE__*/ P.createElement(ZT, {
		shape: l,
		activeBar: d,
		baseProps: c,
		entry: e,
		index: t,
		dataKey: u,
		animationElapsedTime: r,
		isAnimating: i,
		isEntrance: a
	}) : /*#__PURE__*/ P.createElement(QT, {
		shape: l,
		baseProps: c,
		entry: e,
		index: t,
		dataKey: u,
		animationElapsedTime: r,
		isAnimating: i,
		isEntrance: a
	})))) : null;
}
var eE = (e, t, n) => e == null ? [] : t === 1 ? e.flatMap((e) => e.status === "removed" ? [] : [e.next]) : e.flatMap((e) => {
	if (e.status === "removed") return n === "horizontal" ? [VT(VT({}, e.prev), {}, {
		height: er(e.prev.height, 0, t),
		y: er(e.prev.y, e.prev.y + e.prev.height, t)
	})] : [VT(VT({}, e.prev), {}, { width: er(e.prev.width, 0, t) })];
	if (e.status === "matched") return [VT(VT({}, e.next), {}, {
		x: er(e.prev.x, e.next.x, t),
		y: er(e.prev.y, e.next.y, t),
		width: er(e.prev.width, e.next.width, t),
		height: er(e.prev.height, e.next.height, t)
	})];
	var r = e.next;
	return n === "horizontal" ? [VT(VT({}, r), {}, {
		height: er(0, r.height, t),
		y: er(r.stackedBarStart, r.y, t)
	})] : [VT(VT({}, r), {}, {
		width: er(0, r.width, t),
		x: er(r.stackedBarStart, r.x, t)
	})];
});
function tE(e) {
	var t = e.props, n = e.previousRectanglesRef, r = t.data, i = t.isAnimationActive, a = t.animationBegin, o = t.animationDuration, s = t.animationEasing, c = t.animationInterpolateFn, l = t.layout, u = FS(t.onAnimationStart, t.onAnimationEnd), d = u.isAnimating, f = u.handleAnimationStart, p = u.handleAnimationEnd;
	return /*#__PURE__*/ P.createElement(XT, {
		showLabels: !d,
		rects: r
	}, /*#__PURE__*/ P.createElement(IS, {
		animationInput: r,
		animationIdPrefix: "recharts-bar-",
		items: r,
		previousItemsRef: n,
		isAnimationActive: i,
		animationBegin: a,
		animationDuration: o,
		animationEasing: s,
		onAnimationStart: f,
		onAnimationEnd: p,
		animationInterpolateFn: c,
		animationMatchBy: t.animationMatchBy,
		layout: l
	}, (e, n, r) => /*#__PURE__*/ P.createElement(Nn, null, /*#__PURE__*/ P.createElement($T, {
		props: t,
		data: e,
		animationElapsedTime: n,
		isAnimating: d || n < 1,
		isEntrance: r
	}))), /*#__PURE__*/ P.createElement(Bx, { label: t.label }), t.children);
}
function nE(e) {
	var t = L(null);
	return /*#__PURE__*/ P.createElement(tE, {
		previousRectanglesRef: t,
		props: e
	});
}
var rE = 0, iE = (e, t) => {
	var n = Array.isArray(e.value) ? e.value[1] : e.value;
	return {
		x: e.x,
		y: e.y,
		value: n,
		errorVal: Is(e, t)
	};
}, aE = class extends Fe {
	render() {
		var e = this.props, t = e.hide, n = e.data, r = e.dataKey, i = e.className, a = e.xAxisId, o = e.yAxisId, s = e.needClip, c = e.background, l = e.id;
		if (t || n == null) return null;
		var u = z("recharts-bar", i), d = l;
		return /*#__PURE__*/ P.createElement(Nn, {
			className: u,
			id: l
		}, s && /*#__PURE__*/ P.createElement("defs", null, /*#__PURE__*/ P.createElement($w, {
			clipPathId: d,
			xAxisId: a,
			yAxisId: o
		})), /*#__PURE__*/ P.createElement(Nn, {
			className: "recharts-bar-rectangles",
			clipPath: s ? `url(#clipPath-${d})` : void 0
		}, /*#__PURE__*/ P.createElement(YT, {
			data: n,
			dataKey: r,
			background: c,
			allOtherBarProps: this.props
		}), /*#__PURE__*/ P.createElement(nE, this.props)));
	}
}, oE = {
	activeBar: !1,
	animationBegin: 0,
	animationDuration: 400,
	animationEasing: "ease",
	animationInterpolateFn: eE,
	animationMatchBy: xS,
	background: !1,
	hide: !1,
	isAnimationActive: "auto",
	label: !1,
	legendType: "rect",
	minPointSize: rE,
	shape: sT,
	xAxisId: 0,
	yAxisId: 0,
	zIndex: cp.bar
};
function sE(e) {
	var t = e.xAxisId, n = e.yAxisId, r = e.hide, i = e.legendType, a = e.minPointSize, o = e.activeBar, s = e.animationBegin, c = e.animationDuration, l = e.animationEasing, u = e.isAnimationActive, d = Qw(t, n).needClip, f = Nc(), p = Sc(), m = Zx(e.children, Iy), h = U((t) => yT(t, e.id, p, m));
	if (f !== "vertical" && f !== "horizontal") return null;
	var g, _ = h?.[0];
	return g = _ == null || _.height == null || _.width == null ? 0 : f === "vertical" ? _.height / 2 : _.width / 2, /*#__PURE__*/ P.createElement(Zw, {
		xAxisId: t,
		yAxisId: n,
		data: h,
		dataPointFormatter: iE,
		errorBarOffset: g
	}, /*#__PURE__*/ P.createElement(aE, zT({}, e, {
		layout: f,
		needClip: d,
		data: h,
		xAxisId: t,
		yAxisId: n,
		hide: r,
		legendType: i,
		minPointSize: a,
		activeBar: o,
		animationBegin: s,
		animationDuration: c,
		animationEasing: l,
		isAnimationActive: u
	})));
}
function cE(e) {
	var t = e.layout, n = e.barSettings, r = n.dataKey, i = n.minPointSize, a = n.hasCustomShape, o = e.pos, s = e.bandSize, c = e.xAxis, l = e.yAxis, u = e.xAxisTicks, d = e.yAxisTicks, f = e.stackedData, p = e.displayedData, m = e.offset, h = e.cells, g = e.parentViewBox, _ = e.dataStartIndex, v = t === "horizontal" ? l : c, y = f ? v.scale.domain() : null, b = Ws({ numericAxis: v }), x = v.scale.map(b);
	return p.map((e, n) => {
		var p, v, S, C, w, T;
		if (f) {
			var E = f[n + _];
			if (E == null) return null;
			p = zs(E, y);
		} else p = Is(e, r), Array.isArray(p) || (p = [b, p]);
		var D = lT(i, rE)(p[1], n);
		if (t === "horizontal") {
			var O = l.scale.map(p[0]), k = l.scale.map(p[1]);
			if (O == null || k == null) return null;
			v = Us({
				axis: c,
				ticks: u,
				bandSize: s,
				offset: o.offset,
				entry: e,
				index: n
			}), S = k ?? O ?? void 0, C = o.size;
			var A = O - k;
			if (w = qn(A) ? 0 : A, T = {
				x: v,
				y: m.top,
				width: C,
				height: m.height
			}, Math.abs(D) > 0 && Math.abs(w) < Math.abs(D)) {
				var j = Kn(w || D) * (Math.abs(D) - Math.abs(w));
				S -= j, w += j;
			}
		} else {
			var M = c.scale.map(p[0]), N = c.scale.map(p[1]);
			if (M == null || N == null) return null;
			if (v = M, S = Us({
				axis: l,
				ticks: d,
				bandSize: s,
				offset: o.offset,
				entry: e,
				index: n
			}), C = N - M, w = o.size, T = {
				x: m.left,
				y: S,
				width: m.width,
				height: w
			}, Math.abs(D) > 0 && Math.abs(C) < Math.abs(D)) {
				var ee = Kn(C || D) * (Math.abs(D) - Math.abs(C));
				C += ee;
			}
		}
		return v == null || S == null || C == null || w == null || !a && (C === 0 || w === 0) ? null : VT(VT({}, e), {}, {
			stackedBarStart: x,
			x: v,
			y: S,
			width: C,
			height: w,
			value: f ? p : p[1],
			payload: e,
			background: T,
			tooltipPosition: {
				x: v + C / 2,
				y: S + w / 2
			},
			parentViewBox: g,
			originalDataIndex: n
		}, h && h[n] && h[n].props);
	}).filter(Boolean);
}
function lE(e) {
	var t = mr(e, oE), n = TT(t.stackId), r = Sc();
	return /*#__PURE__*/ P.createElement(KS, {
		id: t.id,
		type: "bar"
	}, (e) => /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ P.createElement(pS, { legendPayload: qT(t) }), /*#__PURE__*/ P.createElement(JT, {
		dataKey: t.dataKey,
		stroke: t.stroke,
		strokeWidth: t.strokeWidth,
		fill: t.fill,
		name: t.name,
		hide: t.hide,
		unit: t.unit,
		formatter: t.formatter,
		tooltipType: t.tooltipType,
		id: e
	}), /*#__PURE__*/ P.createElement($S, {
		type: "bar",
		id: e,
		data: void 0,
		xAxisId: t.xAxisId,
		yAxisId: t.yAxisId,
		zAxisId: 0,
		dataKey: t.dataKey,
		stackId: n,
		hide: t.hide,
		barSize: t.barSize,
		minPointSize: t.minPointSize,
		maxBarSize: t.maxBarSize,
		isPanorama: r,
		hasCustomShape: t.shape != null && t.shape !== sT
	}), /*#__PURE__*/ P.createElement(Iv, { zIndex: t.zIndex }, /*#__PURE__*/ P.createElement(sE, zT({}, t, { id: e })))));
}
var uE = /*#__PURE__*/ P.memo(lE, cl);
uE.displayName = "Bar";
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/axisPropsAreEqual.js
var dE = ["domain", "range"], fE = ["domain", "range"];
function pE(e, t) {
	if (e == null) return {};
	var n, r, i = mE(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function mE(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function hE(e, t) {
	return e === t ? !0 : Array.isArray(e) && e.length === 2 && Array.isArray(t) && t.length === 2 ? e[0] === t[0] && e[1] === t[1] : !1;
}
function gE(e, t) {
	if (e === t) return !0;
	var n = e.domain, r = e.range, i = pE(e, dE), a = t.domain, o = t.range, s = pE(t, fE);
	return !hE(n, a) || !hE(r, o) ? !1 : cl(i, s);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/cartesian/XAxis.js
var _E = ["type"], vE = [
	"dangerouslySetInnerHTML",
	"ticks",
	"scale"
], yE = ["id", "scale"];
function bE() {
	return bE = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, bE.apply(null, arguments);
}
function xE(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function SE(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? xE(Object(n), !0).forEach(function(t) {
			CE(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : xE(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function CE(e, t, n) {
	return (t = wE(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function wE(e) {
	var t = TE(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function TE(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function EE(e, t) {
	if (e == null) return {};
	var n, r, i = DE(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function DE(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function OE(e) {
	var t = H(), n = L(null), r = Pc(), i = e.type, a = EE(e, _E), o = fp(r, "xAxis", i), s = Ge(() => {
		if (o != null) return SE(SE({}, a), {}, { type: o });
	}, [a, o]);
	return We(() => {
		s != null && (n.current === null ? t(sC(s)) : n.current !== s && t(cC({
			prev: n.current,
			next: s
		})), n.current = s);
	}, [s, t]), We(() => () => {
		n.current &&= (t(lC(n.current)), null);
	}, [t]), null;
}
var kE = (e) => {
	var t = e.xAxisId, n = e.className, r = U(bc), i = Sc(), a = "xAxis", o = U((e) => cg(e, a, t, i)), s = U((e) => Zh(e, t)), c = U((e) => ng(e, t)), l = U((e) => um(e, t));
	if (s == null || c == null || l == null) return null;
	e.dangerouslySetInnerHTML, e.ticks, e.scale;
	var u = EE(e, vE);
	l.id, l.scale;
	var d = EE(l, yE);
	return /*#__PURE__*/ P.createElement(Uw, bE({}, u, d, {
		x: c.x,
		y: c.y,
		width: s.width,
		height: s.height,
		className: z(`recharts-${a} ${a}`, n),
		viewBox: r,
		ticks: o,
		axisType: a,
		axisId: t
	}));
}, AE = {
	allowDataOverflow: X.allowDataOverflow,
	allowDecimals: X.allowDecimals,
	allowDuplicatedCategory: X.allowDuplicatedCategory,
	angle: X.angle,
	axisLine: Pw.axisLine,
	height: X.height,
	hide: !1,
	includeHidden: X.includeHidden,
	interval: X.interval,
	label: !1,
	minTickGap: X.minTickGap,
	mirror: X.mirror,
	orientation: X.orientation,
	padding: X.padding,
	reversed: X.reversed,
	scale: X.scale,
	tick: X.tick,
	tickCount: X.tickCount,
	tickLine: Pw.tickLine,
	tickSize: Pw.tickSize,
	type: X.type,
	niceTicks: X.niceTicks,
	xAxisId: 0
}, jE = /*#__PURE__*/ P.memo((e) => {
	var t = mr(e, AE);
	return /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ P.createElement(OE, {
		allowDataOverflow: t.allowDataOverflow,
		allowDecimals: t.allowDecimals,
		allowDuplicatedCategory: t.allowDuplicatedCategory,
		angle: t.angle,
		dataKey: t.dataKey,
		domain: t.domain,
		height: t.height,
		hide: t.hide,
		id: t.xAxisId,
		includeHidden: t.includeHidden,
		interval: t.interval,
		minTickGap: t.minTickGap,
		mirror: t.mirror,
		name: t.name,
		orientation: t.orientation,
		padding: t.padding,
		reversed: t.reversed,
		scale: t.scale,
		tick: t.tick,
		tickCount: t.tickCount,
		tickFormatter: t.tickFormatter,
		ticks: t.ticks,
		type: t.type,
		unit: t.unit,
		niceTicks: t.niceTicks
	}), /*#__PURE__*/ P.createElement(kE, t));
}, gE);
jE.displayName = "XAxis";
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/cartesian/YAxis.js
var ME = ["type"], NE = [
	"dangerouslySetInnerHTML",
	"ticks",
	"scale"
], PE = ["id", "scale"];
function FE() {
	return FE = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, FE.apply(null, arguments);
}
function IE(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function LE(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? IE(Object(n), !0).forEach(function(t) {
			RE(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : IE(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function RE(e, t, n) {
	return (t = zE(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function zE(e) {
	var t = BE(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function BE(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function VE(e, t) {
	if (e == null) return {};
	var n, r, i = HE(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function HE(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function UE(e) {
	var t = H(), n = L(null), r = Pc(), i = e.type, a = VE(e, ME), o = fp(r, "yAxis", i), s = Ge(() => {
		if (o != null) return LE(LE({}, a), {}, { type: o });
	}, [o, a]);
	return We(() => {
		s != null && (n.current === null ? t(uC(s)) : n.current !== s && t(dC({
			prev: n.current,
			next: s
		})), n.current = s);
	}, [s, t]), We(() => () => {
		n.current &&= (t(fC(n.current)), null);
	}, [t]), null;
}
function WE(e) {
	var t = e.yAxisId, n = e.className, r = e.width, i = e.label, a = L(null), o = L(null), s = U(bc), c = Sc(), l = H(), u = "yAxis", d = U((e) => ig(e, t)), f = U((e) => rg(e, t)), p = U((e) => cg(e, u, t, c)), m = U((e) => fm(e, t));
	if (We(() => {
		if (!(r !== "auto" || !d || vx(i) || /*#__PURE__*/ Be(i) || m == null)) {
			var e = a.current;
			if (e) {
				var n = e.getCalculatedWidth();
				Math.round(d.width) !== Math.round(n) && l(pC({
					id: t,
					width: n
				}));
			}
		}
	}, [
		p,
		d,
		l,
		i,
		t,
		r,
		m
	]), d == null || f == null || m == null) return null;
	e.dangerouslySetInnerHTML, e.ticks, e.scale;
	var h = VE(e, NE);
	m.id, m.scale;
	var g = VE(m, PE);
	return /*#__PURE__*/ P.createElement(Uw, FE({}, h, g, {
		ref: a,
		labelRef: o,
		x: f.x,
		y: f.y,
		tickTextProps: r === "auto" ? { width: void 0 } : { width: r },
		width: d.width,
		height: d.height,
		className: z(`recharts-${u} ${u}`, n),
		viewBox: s,
		ticks: p,
		axisType: u,
		axisId: t
	}));
}
var GE = {
	allowDataOverflow: Z.allowDataOverflow,
	allowDecimals: Z.allowDecimals,
	allowDuplicatedCategory: Z.allowDuplicatedCategory,
	angle: Z.angle,
	axisLine: Pw.axisLine,
	hide: !1,
	includeHidden: Z.includeHidden,
	interval: Z.interval,
	label: !1,
	minTickGap: Z.minTickGap,
	mirror: Z.mirror,
	orientation: Z.orientation,
	padding: Z.padding,
	reversed: Z.reversed,
	scale: Z.scale,
	tick: Z.tick,
	tickCount: Z.tickCount,
	tickLine: Pw.tickLine,
	tickSize: Pw.tickSize,
	type: Z.type,
	niceTicks: Z.niceTicks,
	width: Z.width,
	yAxisId: 0
}, KE = /*#__PURE__*/ P.memo((e) => {
	var t = mr(e, GE);
	return /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ P.createElement(UE, {
		interval: t.interval,
		id: t.yAxisId,
		scale: t.scale,
		type: t.type,
		domain: t.domain,
		allowDataOverflow: t.allowDataOverflow,
		dataKey: t.dataKey,
		allowDuplicatedCategory: t.allowDuplicatedCategory,
		allowDecimals: t.allowDecimals,
		tickCount: t.tickCount,
		padding: t.padding,
		includeHidden: t.includeHidden,
		reversed: t.reversed,
		ticks: t.ticks,
		width: t.width,
		orientation: t.orientation,
		mirror: t.mirror,
		hide: t.hide,
		unit: t.unit,
		name: t.name,
		angle: t.angle,
		minTickGap: t.minTickGap,
		tick: t.tick,
		tickFormatter: t.tickFormatter,
		niceTicks: t.niceTicks
	}), /*#__PURE__*/ P.createElement(WE, t));
}, gE);
KE.displayName = "YAxis";
var qE = W([
	(e, t) => t,
	J,
	Op,
	Lp,
	E_,
	O_,
	ov,
	vc
], vv);
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/getRelativeCoordinate.js
function JE(e) {
	return "getBBox" in e.currentTarget && typeof e.currentTarget.getBBox == "function";
}
function YE(e) {
	var t = e.currentTarget.getBoundingClientRect(), n, r;
	if (JE(e)) {
		var i = e.currentTarget.getBBox();
		n = i.width > 0 ? t.width / i.width : 1, r = i.height > 0 ? t.height / i.height : 1;
	} else {
		var a = e.currentTarget;
		n = a.offsetWidth > 0 ? t.width / a.offsetWidth : 1, r = a.offsetHeight > 0 ? t.height / a.offsetHeight : 1;
	}
	var o = (e, i) => ({
		relativeX: Math.round((e - t.left) / n),
		relativeY: Math.round((i - t.top) / r)
	});
	return "touches" in e ? Array.from(e.touches).map((e) => o(e.clientX, e.clientY)) : o(e.clientX, e.clientY);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/mouseEventsMiddleware.js
var XE = po("mouseClick"), ZE = bs();
ZE.startListening({
	actionCreator: XE,
	effect: (e, t) => {
		var n = e.payload, r = qE(t.getState(), YE(n));
		r?.activeIndex != null && t.dispatch(jg({
			activeIndex: r.activeIndex,
			activeDataKey: void 0,
			activeCoordinate: r.activeCoordinate
		}));
	}
});
var QE = po("mouseMove"), $E = bs(), eD = null, tD = null, nD = null;
$E.startListening({
	actionCreator: QE,
	effect: (e, t) => {
		var n = e.payload, r = t.getState().eventSettings, i = r.throttleDelay, a = r.throttledEvents, o = a === "all" || a?.includes("mousemove");
		eD !== null && (cancelAnimationFrame(eD), eD = null), tD === null || typeof i == "number" && o || (clearTimeout(tD), tD = null), nD = YE(n);
		var s = () => {
			var e = t.getState(), n = hg(e, e.tooltip.settings.shared);
			if (!nD) eD = null, tD = null;
			else {
				if (n === "axis") {
					var r = qE(e, nD);
					r?.activeIndex == null ? t.dispatch(Og()) : t.dispatch(Ag({
						activeIndex: r.activeIndex,
						activeDataKey: void 0,
						activeCoordinate: r.activeCoordinate
					}));
				}
				eD = null, tD = null;
			}
		};
		o ? i === "raf" ? eD = requestAnimationFrame(s) : typeof i == "number" && tD === null && (tD = setTimeout(s, i)) : s();
	}
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/reduxDevtoolsJsonStringifyReplacer.js
function rD(e, t) {
	return t instanceof HTMLElement ? `HTMLElement <${t.tagName} class="${t.className}">` : t === window ? "global.window" : e === "children" && typeof t == "object" && t ? "<<CHILDREN>>" : t;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/rootPropsSlice.js
var iD = {
	accessibilityLayer: !0,
	barCategoryGap: "10%",
	barGap: 4,
	barSize: void 0,
	className: void 0,
	maxBarSize: void 0,
	stackOffset: "none",
	syncId: void 0,
	syncMethod: "index",
	baseValue: void 0,
	reverseStackOrder: !1
}, aD = Po({
	name: "rootProps",
	initialState: iD,
	reducers: { updateOptions: (e, t) => {
		e.accessibilityLayer = t.payload.accessibilityLayer, e.barCategoryGap = t.payload.barCategoryGap, e.barGap = t.payload.barGap ?? iD.barGap, e.barSize = t.payload.barSize, e.maxBarSize = t.payload.maxBarSize, e.stackOffset = t.payload.stackOffset, e.syncId = t.payload.syncId, e.syncMethod = t.payload.syncMethod, e.className = t.payload.className, e.baseValue = t.payload.baseValue, e.reverseStackOrder = t.payload.reverseStackOrder;
	} }
}), oD = aD.reducer, sD = aD.actions.updateOptions, cD = Po({
	name: "polarOptions",
	initialState: null,
	reducers: { updatePolarOptions: (e, t) => e === null ? t.payload : (e.startAngle = t.payload.startAngle, e.endAngle = t.payload.endAngle, e.cx = t.payload.cx, e.cy = t.payload.cy, e.innerRadius = t.payload.innerRadius, e.outerRadius = t.payload.outerRadius, e) }
});
cD.actions.updatePolarOptions;
var lD = cD.reducer, uD = po("keyDown"), dD = po("focus"), fD = po("blur"), pD = bs(), mD = null, hD = null, gD = null;
pD.startListening({
	actionCreator: uD,
	effect: (e, t) => {
		gD = e.payload, mD !== null && (cancelAnimationFrame(mD), mD = null);
		var n = t.getState().eventSettings, r = n.throttleDelay, i = n.throttledEvents, a = i === "all" || i.includes("keydown");
		hD === null || typeof r == "number" && a || (clearTimeout(hD), hD = null);
		var o = () => {
			try {
				var e = t.getState();
				if (e.rootProps.accessibilityLayer === !1) return;
				var n = e.tooltip.keyboardInteraction, r = gD;
				if (r !== "ArrowRight" && r !== "ArrowLeft" && r !== "Enter") return;
				var i = Kg(n, m_(e), Um(e), C_(e)), a = i == null ? -1 : Number(i), o = !Number.isFinite(a) || a < 0, s = O_(e), c = m_(e), l = hg(e, e.tooltip.settings.shared);
				if (r === "Enter") {
					if (o) return;
					var u = dv(e, l, "hover", String(n.index));
					t.dispatch(Ng({
						active: !n.active,
						activeIndex: n.index,
						activeCoordinate: u
					}));
					return;
				}
				var d = dg(e) === "left-to-right" ? 1 : -1, f = r === "ArrowRight" ? 1 : -1, p;
				if (o) {
					var m = Um(e), h = C_(e), g = f * d, _ = (e) => ({
						active: !1,
						index: String(e),
						dataKey: void 0,
						graphicalItemId: void 0,
						coordinate: void 0
					});
					if (p = -1, g > 0) {
						for (var v = 0; v < c.length; v++) if (Kg(_(v), c, m, h) != null) {
							p = v;
							break;
						}
					} else for (var y = c.length - 1; y >= 0; y--) if (Kg(_(y), c, m, h) != null) {
						p = y;
						break;
					}
					if (p < 0) return;
				} else {
					p = a + f * d;
					var b = s?.length || c.length;
					if (b === 0 || p >= b || p < 0) return;
				}
				var x = dv(e, l, "hover", String(p));
				t.dispatch(Ng({
					active: !0,
					activeIndex: p.toString(),
					activeCoordinate: x
				}));
			} finally {
				mD = null, hD = null;
			}
		};
		a ? r === "raf" ? mD = requestAnimationFrame(o) : typeof r == "number" && hD === null && (o(), gD = null, hD = setTimeout(() => {
			gD ? o() : (hD = null, mD = null);
		}, r)) : o();
	}
}), pD.startListening({
	actionCreator: dD,
	effect: (e, t) => {
		var n = t.getState();
		if (n.rootProps.accessibilityLayer !== !1) {
			var r = n.tooltip.keyboardInteraction;
			if (!r.active && r.index == null) {
				var i = "0", a = dv(n, hg(n, n.tooltip.settings.shared), "hover", String(i));
				t.dispatch(Ng({
					active: !0,
					activeIndex: i,
					activeCoordinate: a
				}));
			}
		}
	}
}), pD.startListening({
	actionCreator: fD,
	effect: (e, t) => {
		var n = t.getState();
		if (n.rootProps.accessibilityLayer !== !1) {
			var r = n.tooltip.keyboardInteraction;
			r.active && t.dispatch(Ng({
				active: !1,
				activeIndex: r.index,
				activeCoordinate: r.coordinate
			}));
		}
	}
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/createEventProxy.js
function _D(e) {
	e.persist();
	var t = e.currentTarget;
	return new Proxy(e, { get: (e, n) => {
		if (n === "currentTarget") return t;
		var r = Reflect.get(e, n);
		return typeof r == "function" ? r.bind(e) : r;
	} });
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/externalEventsMiddleware.js
var vD = po("externalEvent"), yD = bs(), bD = /* @__PURE__ */ new Map(), xD = /* @__PURE__ */ new Map(), SD = /* @__PURE__ */ new Map();
yD.startListening({
	actionCreator: vD,
	effect: (e, t) => {
		var n = e.payload, r = n.handler, i = n.reactEvent;
		if (r != null) {
			var a = i.type, o = _D(i);
			SD.set(a, {
				handler: r,
				reactEvent: o
			});
			var s = bD.get(a);
			s !== void 0 && (cancelAnimationFrame(s), bD.delete(a));
			var c = t.getState().eventSettings, l = c.throttleDelay, u = c.throttledEvents, d = u === "all" || u?.includes(a), f = xD.get(a);
			f === void 0 || typeof l == "number" && d || (clearTimeout(f), xD.delete(a));
			var p = () => {
				var e = SD.get(a);
				try {
					if (!e) return;
					var n = e.handler, r = e.reactEvent, i = t.getState(), o = {
						activeCoordinate: R_(i),
						activeDataKey: F_(i),
						activeIndex: N_(i),
						activeLabel: P_(i),
						activeTooltipIndex: N_(i),
						isTooltipActive: z_(i)
					};
					n && n(o, r);
				} finally {
					bD.delete(a), xD.delete(a), SD.delete(a);
				}
			};
			if (!d) p();
			else if (l === "raf") {
				var m = requestAnimationFrame(p);
				bD.set(a, m);
			} else if (typeof l == "number") {
				if (!xD.has(a)) {
					p();
					var h = setTimeout(p, l);
					xD.set(a, h);
				}
			} else p();
		}
	}
});
var CD = W([
	W([Xg], (e) => e.tooltipItemPayloads),
	(e, t) => t,
	(e, t, n) => n
], (e, t, n) => {
	if (t != null) {
		var r = e.find((e) => e.settings.graphicalItemId === n);
		if (r != null) {
			var i = r.getPosition;
			if (i != null) return i(t);
		}
	}
}), wD = po("touchMove"), TD = bs(), ED = null, DD = null, OD = null, kD = null;
TD.startListening({
	actionCreator: wD,
	effect: (e, t) => {
		var n = e.payload;
		if (n.touches != null && n.touches.length !== 0) {
			kD = _D(n);
			var r = t.getState().eventSettings, i = r.throttleDelay, a = r.throttledEvents, o = a === "all" || a.includes("touchmove");
			ED !== null && (cancelAnimationFrame(ED), ED = null), DD === null || typeof i == "number" && o || (clearTimeout(DD), DD = null), OD = Array.from(n.touches).map((e) => YE({
				clientX: e.clientX,
				clientY: e.clientY,
				currentTarget: n.currentTarget
			}));
			var s = () => {
				if (kD != null) {
					var e = t.getState(), n = hg(e, e.tooltip.settings.shared);
					if (n === "axis") {
						var r = OD?.[0];
						if (r == null) {
							ED = null, DD = null;
							return;
						}
						var i = qE(e, r);
						i?.activeIndex != null && t.dispatch(Ag({
							activeIndex: i.activeIndex,
							activeDataKey: void 0,
							activeCoordinate: i.activeCoordinate
						}));
					} else if (n === "item") {
						var a = kD.touches[0];
						if (document.elementFromPoint == null || a == null) return;
						var o = document.elementFromPoint(a.clientX, a.clientY);
						if (!o || !o.getAttribute) return;
						var s = o.getAttribute(sc), c = o.getAttribute("data-recharts-item-id") ?? void 0, l = u_(e).find((e) => e.id === c);
						if (s == null || l == null || c == null) return;
						var u = l.dataKey, d = CD(e, s, c);
						t.dispatch(Eg({
							activeDataKey: u,
							activeIndex: s,
							activeCoordinate: d,
							activeGraphicalItemId: c
						}));
					}
					ED = null, DD = null;
				}
			};
			o ? i === "raf" ? ED = requestAnimationFrame(s) : typeof i == "number" && DD === null && (s(), kD = null, DD = setTimeout(() => {
				kD ? s() : (DD = null, ED = null);
			}, i)) : s();
		}
	}
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/eventSettingsSlice.js
var AD = {
	throttleDelay: "raf",
	throttledEvents: [
		"mousemove",
		"touchmove",
		"pointermove",
		"scroll",
		"wheel"
	]
}, jD = Po({
	name: "eventSettings",
	initialState: AD,
	reducers: { setEventSettings: (e, t) => {
		t.payload.throttleDelay != null && (e.throttleDelay = t.payload.throttleDelay), t.payload.throttledEvents != null && (e.throttledEvents = G(t.payload.throttledEvents));
	} }
}), MD = jD.actions.setEventSettings, ND = jD.reducer, PD = Li({
	brush: zC,
	cartesianAxis: mC,
	chartData: sy,
	errorBars: Kw,
	eventSettings: ND,
	graphicalItems: QS,
	layout: Os,
	legend: Uc,
	options: ey,
	polarAxis: Ux,
	polarOptions: lD,
	referenceElements: WC,
	renderedTicks: yw,
	rootProps: oD,
	tooltip: Pg,
	zIndex: Fv
}), FD = function(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "Chart";
	return wo({
		reducer: PD,
		preloadedState: e,
		middleware: (e) => e({
			serializableCheck: !1,
			immutableCheck: ![
				"commonjs",
				"es6",
				"production"
			].includes("es6")
		}).concat([
			ZE.middleware,
			$E.middleware,
			pD.middleware,
			yD.middleware,
			TD.middleware
		]),
		enhancers: (e) => {
			var t = e;
			return typeof e == "function" && (t = e()), t.concat(So({ type: "raf" }));
		},
		devTools: jl.devToolsEnabled && {
			serialize: { replacer: rD },
			name: `recharts-${t}`
		}
	});
};
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/RechartsStoreProvider.js
function ID(e) {
	var t = e.preloadedState, n = e.children, r = e.reduxStoreName, i = Sc(), a = L(null);
	if (i) return n;
	a.current ??= FD(t, r);
	var o = Gr;
	return /*#__PURE__*/ P.createElement(al, {
		context: o,
		store: a.current
	}, n);
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/ReportMainChartProps.js
function LD(e) {
	var t = e.layout, n = e.margin, r = H(), i = Sc();
	return I(() => {
		i || (r(Ts(t)), r(ws(n)));
	}, [
		r,
		i,
		t,
		n
	]), null;
}
var RD = /*#__PURE__*/ Ve(LD, cl);
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/state/ReportChartProps.js
function zD(e) {
	var t = H();
	return I(() => {
		t(sD(e));
	}, [t, e]), null;
}
var BD = /*#__PURE__*/ Ve((e) => {
	var t = H();
	return I(() => {
		t(MD(e));
	}, [t, e]), null;
}, cl);
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/zIndex/ZIndexPortal.js
function VD(e) {
	var t = e.zIndex, n = e.isPanorama, r = L(null), i = H();
	return We(() => (r.current && i(Nv({
		zIndex: t,
		element: r.current,
		isPanorama: n
	})), () => {
		i(Pv({
			zIndex: t,
			isPanorama: n
		}));
	}), [
		i,
		t,
		n
	]), /*#__PURE__*/ P.createElement("g", {
		tabIndex: -1,
		ref: r,
		className: `recharts-zIndex-layer_${t}`
	});
}
function HD(e) {
	var t = e.children, n = e.isPanorama, r = U(bv);
	if (!r || r.length === 0) return t;
	var i = r.filter((e) => e < 0), a = r.filter((e) => e > 0);
	return /*#__PURE__*/ P.createElement(P.Fragment, null, i.map((e) => /*#__PURE__*/ P.createElement(VD, {
		key: e,
		zIndex: e,
		isPanorama: n
	})), t, a.map((e) => /*#__PURE__*/ P.createElement(VD, {
		key: e,
		zIndex: e,
		isPanorama: n
	})));
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/container/RootSurface.js
var UD = ["children"];
function WD(e, t) {
	if (e == null) return {};
	var n, r, i = GD(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function GD(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function KD() {
	return KD = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, KD.apply(null, arguments);
}
var qD = {
	width: "100%",
	height: "100%",
	display: "block"
}, JD = /*#__PURE__*/ ze((e, t) => {
	var n = jc(), r = Mc(), i = $l();
	if (!As(n) || !As(r)) return null;
	var a = e.children, o = e.otherAttributes, s = e.title, c = e.desc, l, u;
	return o != null && (l = typeof o.tabIndex == "number" ? o.tabIndex : i ? 0 : void 0, u = typeof o.role == "string" ? o.role : i ? "application" : void 0), /*#__PURE__*/ P.createElement(On, KD({}, o, {
		title: s,
		desc: c,
		role: u,
		tabIndex: l,
		width: n,
		height: r,
		style: qD,
		ref: t
	}), a);
}), YD = (e) => {
	var t = e.children, n = U(wc);
	if (!n) return null;
	var r = n.width, i = n.height, a = n.y, o = n.x;
	return /*#__PURE__*/ P.createElement(On, {
		width: r,
		height: i,
		x: o,
		y: a
	}, t);
}, XD = /*#__PURE__*/ ze((e, t) => {
	var n = e.children, r = WD(e, UD);
	return Sc() ? /*#__PURE__*/ P.createElement(YD, null, /*#__PURE__*/ P.createElement(HD, { isPanorama: !0 }, n)) : /*#__PURE__*/ P.createElement(JD, KD({ ref: t }, r), /*#__PURE__*/ P.createElement(HD, { isPanorama: !1 }, n));
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/util/useReportScale.js
function ZD(e, t) {
	return nO(e) || tO(e, t) || $D(e, t) || QD();
}
function QD() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function $D(e, t) {
	if (e) {
		if (typeof e == "string") return eO(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? eO(e, t) : void 0;
	}
}
function eO(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function tO(e, t) {
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
function nO(e) {
	if (Array.isArray(e)) return e;
}
function rO() {
	var e = H(), t = ZD(Ke(null), 2), n = t[0], r = t[1], i = U(rc);
	return I(() => {
		if (n != null) {
			var t = n.getBoundingClientRect().width / n.offsetWidth;
			q(t) && t !== i && e(Ds(t));
		}
	}, [
		n,
		e,
		i
	]), r;
}
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/chart/RechartsWrapper.js
function iO(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function aO(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? iO(Object(n), !0).forEach(function(t) {
			oO(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : iO(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function oO(e, t, n) {
	return (t = sO(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function sO(e) {
	var t = cO(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function cO(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function lO() {
	return lO = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, lO.apply(null, arguments);
}
function uO(e, t) {
	return hO(e) || mO(e, t) || fO(e, t) || dO();
}
function dO() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function fO(e, t) {
	if (e) {
		if (typeof e == "string") return pO(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? pO(e, t) : void 0;
	}
}
function pO(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function mO(e, t) {
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
function hO(e) {
	if (Array.isArray(e)) return e;
}
var gO = () => (vy(), null);
function _O(e) {
	if (typeof e == "number") return e;
	if (typeof e == "string") {
		var t = parseFloat(e);
		if (!Number.isNaN(t)) return t;
	}
	return 0;
}
var vO = /*#__PURE__*/ ze((e, t) => {
	var n = L(null), r = uO(Ke({
		containerWidth: _O(e.style?.width),
		containerHeight: _O(e.style?.height)
	}), 2), i = r[0], a = r[1], o = F((e, t) => {
		a((n) => {
			var r = Math.round(e), i = Math.round(t);
			return n.containerWidth === r && n.containerHeight === i ? n : {
				containerWidth: r,
				containerHeight: i
			};
		});
	}, []), s = F((e) => {
		if (typeof t == "function" && t(e), n.current != null && (n.current.disconnect(), n.current = null), e != null && typeof ResizeObserver < "u") {
			var r = e.getBoundingClientRect(), i = r.width, a = r.height;
			o(i, a);
			var s = new ResizeObserver((e) => {
				var t = e[0];
				if (t != null) {
					var n = t.contentRect, r = n.width, i = n.height;
					o(r, i);
				}
			});
			s.observe(e), n.current = s;
		}
	}, [t, o]);
	return I(() => () => {
		n.current?.disconnect();
	}, [o]), /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ P.createElement(Lc, {
		width: i.containerWidth,
		height: i.containerHeight
	}), /*#__PURE__*/ P.createElement("div", lO({ ref: s }, e)));
}), yO = /*#__PURE__*/ ze((e, t) => {
	var n = e.width, r = e.height, i = uO(Ke({
		containerWidth: _O(n),
		containerHeight: _O(r)
	}), 2), a = i[0], o = i[1], s = F((e, t) => {
		o((n) => {
			var r = Math.round(e), i = Math.round(t);
			return n.containerWidth === r && n.containerHeight === i ? n : {
				containerWidth: r,
				containerHeight: i
			};
		});
	}, []), c = F((e) => {
		if (typeof t == "function" && t(e), e != null) {
			var n = e.getBoundingClientRect(), r = n.width, i = n.height;
			s(r, i);
		}
	}, [t, s]);
	return /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ P.createElement(Lc, {
		width: a.containerWidth,
		height: a.containerHeight
	}), /*#__PURE__*/ P.createElement("div", lO({ ref: c }, e)));
}), bO = /*#__PURE__*/ ze((e, t) => {
	var n = e.width, r = e.height;
	return /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ P.createElement(Lc, {
		width: n,
		height: r
	}), /*#__PURE__*/ P.createElement("div", lO({ ref: t }, e)));
}), xO = /*#__PURE__*/ ze((e, t) => {
	var n = e.width, r = e.height;
	return typeof n == "string" || typeof r == "string" ? /*#__PURE__*/ P.createElement(yO, lO({}, e, { ref: t })) : typeof n == "number" && typeof r == "number" ? /*#__PURE__*/ P.createElement(bO, lO({}, e, {
		width: n,
		height: r,
		ref: t
	})) : /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ P.createElement(Lc, {
		width: n,
		height: r
	}), /*#__PURE__*/ P.createElement("div", lO({ ref: t }, e)));
});
function SO(e) {
	return e ? vO : xO;
}
var CO = /*#__PURE__*/ ze((e, t) => {
	var n = e.children, r = e.className, i = e.height, a = e.onClick, o = e.onContextMenu, s = e.onDoubleClick, c = e.onMouseDown, l = e.onMouseEnter, u = e.onMouseLeave, d = e.onMouseMove, f = e.onMouseUp, p = e.onTouchEnd, m = e.onTouchMove, h = e.onTouchStart, g = e.style, _ = e.width, v = e.responsive, y = e.dispatchTouchEvents, b = y === void 0 || y, x = L(null), S = H(), C = uO(Ke(null), 2), w = C[0], T = C[1], E = uO(Ke(null), 2), D = E[0], O = E[1], k = rO(), A = Ec(), j = A?.width > 0 ? A.width : _, M = A?.height > 0 ? A.height : i, N = F((e) => {
		k(e), typeof t == "function" && t(e), T(e), O(e), e != null && (x.current = e);
	}, [
		k,
		t,
		T,
		O
	]), ee = F((e) => {
		S(XE(e)), S(vD({
			handler: a,
			reactEvent: e
		}));
	}, [S, a]), te = F((e) => {
		S(QE(e)), S(vD({
			handler: l,
			reactEvent: e
		}));
	}, [S, l]), ne = F((e) => {
		S(Og()), S(vD({
			handler: u,
			reactEvent: e
		}));
	}, [S, u]), re = F((e) => {
		S(QE(e)), S(vD({
			handler: d,
			reactEvent: e
		}));
	}, [S, d]), ie = F(() => {
		S(dD());
	}, [S]), ae = F(() => {
		S(fD());
	}, [S]), oe = F((e) => {
		S(uD(e.key));
	}, [S]), se = F((e) => {
		S(vD({
			handler: o,
			reactEvent: e
		}));
	}, [S, o]), ce = F((e) => {
		S(vD({
			handler: s,
			reactEvent: e
		}));
	}, [S, s]), le = F((e) => {
		S(vD({
			handler: c,
			reactEvent: e
		}));
	}, [S, c]), ue = F((e) => {
		S(vD({
			handler: f,
			reactEvent: e
		}));
	}, [S, f]), de = F((e) => {
		S(vD({
			handler: h,
			reactEvent: e
		}));
	}, [S, h]), fe = F((e) => {
		b && S(wD(e)), S(vD({
			handler: m,
			reactEvent: e
		}));
	}, [
		S,
		b,
		m
	]), pe = F((e) => {
		S(vD({
			handler: p,
			reactEvent: e
		}));
	}, [S, p]), me = SO(v);
	return /*#__PURE__*/ P.createElement(Kv.Provider, { value: w }, /*#__PURE__*/ P.createElement(Pn.Provider, { value: D }, /*#__PURE__*/ P.createElement(me, {
		width: j ?? g?.width,
		height: M ?? g?.height,
		className: z("recharts-wrapper", r),
		style: aO({
			position: "relative",
			cursor: "default",
			width: j,
			height: M
		}, g),
		onClick: ee,
		onContextMenu: se,
		onDoubleClick: ce,
		onFocus: ie,
		onBlur: ae,
		onKeyDown: oe,
		onMouseDown: le,
		onMouseEnter: te,
		onMouseLeave: ne,
		onMouseMove: re,
		onMouseUp: ue,
		onTouchEnd: pe,
		onTouchMove: fe,
		onTouchStart: de,
		ref: N
	}, /*#__PURE__*/ P.createElement(gO, null), n)));
}), wO = [
	"width",
	"height",
	"responsive",
	"children",
	"className",
	"style",
	"compact",
	"title",
	"desc"
];
function TO(e, t) {
	if (e == null) return {};
	var n, r, i = EO(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function EO(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var DO = /*#__PURE__*/ ze((e, t) => {
	var n = e.width, r = e.height, i = e.responsive, a = e.children, o = e.className, s = e.style, c = e.compact, l = e.title, u = e.desc, d = xn(TO(e, wO));
	return c ? /*#__PURE__*/ P.createElement(P.Fragment, null, /*#__PURE__*/ P.createElement(Lc, {
		width: n,
		height: r
	}), /*#__PURE__*/ P.createElement(XD, {
		otherAttributes: d,
		title: l,
		desc: u
	}, a)) : /*#__PURE__*/ P.createElement(CO, {
		className: o,
		style: s,
		width: n,
		height: r,
		responsive: i ?? !1,
		onClick: e.onClick,
		onMouseLeave: e.onMouseLeave,
		onMouseEnter: e.onMouseEnter,
		onMouseMove: e.onMouseMove,
		onMouseDown: e.onMouseDown,
		onMouseUp: e.onMouseUp,
		onContextMenu: e.onContextMenu,
		onDoubleClick: e.onDoubleClick,
		onTouchStart: e.onTouchStart,
		onTouchMove: e.onTouchMove,
		onTouchEnd: e.onTouchEnd
	}, /*#__PURE__*/ P.createElement(XD, {
		otherAttributes: d,
		title: l,
		desc: u,
		ref: t
	}, /*#__PURE__*/ P.createElement(QC, null, a)));
});
// node_modules/.bun/recharts@3.9.2+4c06fdf3d78e17b5/node_modules/recharts/es6/chart/CartesianChart.js
function OO() {
	return OO = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, OO.apply(null, arguments);
}
function kO(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function AO(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? kO(Object(n), !0).forEach(function(t) {
			jO(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : kO(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function jO(e, t, n) {
	return (t = MO(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function MO(e) {
	var t = NO(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function NO(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var PO = AO({
	accessibilityLayer: !0,
	barCategoryGap: "10%",
	barGap: 4,
	layout: "horizontal",
	margin: {
		top: 5,
		right: 5,
		bottom: 5,
		left: 5
	},
	responsive: !1,
	reverseStackOrder: !1,
	stackOffset: "none",
	syncMethod: "index"
}, AD), FO = /*#__PURE__*/ ze(function(e, t) {
	var n = mr(e.categoricalChartProps, PO), r = e.chartName, i = e.defaultTooltipEventType, a = e.validateTooltipEventTypes, o = e.tooltipPayloadSearcher, s = e.categoricalChartProps, c = {
		chartName: r,
		defaultTooltipEventType: i,
		validateTooltipEventTypes: a,
		tooltipPayloadSearcher: o,
		eventEmitter: void 0
	};
	return /*#__PURE__*/ P.createElement(ID, {
		preloadedState: { options: c },
		reduxStoreName: s.id ?? r
	}, /*#__PURE__*/ P.createElement(IC, { chartData: s.data }), /*#__PURE__*/ P.createElement(RD, {
		layout: n.layout,
		margin: n.margin
	}), /*#__PURE__*/ P.createElement(BD, {
		throttleDelay: n.throttleDelay,
		throttledEvents: n.throttledEvents
	}), /*#__PURE__*/ P.createElement(zD, {
		baseValue: n.baseValue,
		accessibilityLayer: n.accessibilityLayer,
		barCategoryGap: n.barCategoryGap,
		maxBarSize: n.maxBarSize,
		stackOffset: n.stackOffset,
		barGap: n.barGap,
		barSize: n.barSize,
		syncId: n.syncId,
		syncMethod: n.syncMethod,
		className: n.className,
		reverseStackOrder: n.reverseStackOrder
	}), /*#__PURE__*/ P.createElement(DO, OO({}, n, { ref: t })));
}), IO = ["axis", "item"], LO = /*#__PURE__*/ ze((e, t) => /*#__PURE__*/ P.createElement(FO, {
	chartName: "BarChart",
	defaultTooltipEventType: "axis",
	validateTooltipEventTypes: IO,
	tooltipPayloadSearcher: Qv,
	categoricalChartProps: e,
	ref: t
})), RO = () => {
	let e = _C(), t = gC();
	return !e || !t ? null : /* @__PURE__ */ at("g", {
		pointerEvents: "none",
		stroke: "var(--chakra-colors-border-emphasized)",
		strokeWidth: "1",
		children: [/* @__PURE__ */ R("line", {
			x1: e.x,
			x2: e.x,
			y1: t.y,
			y2: t.y + t.height
		}), /* @__PURE__ */ R("line", {
			x1: t.x,
			x2: t.x + t.width,
			y1: e.y,
			y2: e.y
		})]
	});
}, zO = (e) => {
	let { data: t, dataKey: n, color: r, height: i, tooltipLabel: a, tooltipValue: o, tooltipSeriesLabel: s, layout: c = "horizontal", categoryKey: l, domain: u, barSize: d, barCategoryGap: f = 1 } = e, p = on({
		data: t,
		series: [{
			name: n,
			color: r
		}]
	}), m = (e) => e[n], h = l ? (e) => e[l] : void 0;
	return /* @__PURE__ */ R(pn, {
		chart: p,
		height: i,
		aspectRatio: "auto",
		cursor: "crosshair",
		children: /* @__PURE__ */ at(LO, {
			responsive: !0,
			data: p.data,
			layout: c,
			margin: {
				top: 2,
				right: 0,
				bottom: 0,
				left: 0
			},
			barCategoryGap: f,
			children: [
				c === "vertical" ? /* @__PURE__ */ at(it, { children: [/* @__PURE__ */ R(jE, {
					type: "number",
					domain: u,
					hide: !0
				}), /* @__PURE__ */ R(KE, {
					type: "category",
					dataKey: h,
					hide: !0
				})] }) : null,
				/* @__PURE__ */ R(uE, {
					dataKey: m,
					fill: p.color(r),
					barSize: d,
					isAnimationActive: !1
				}),
				/* @__PURE__ */ R(Fy, {
					allowEscapeViewBox: {
						x: !0,
						y: !0
					},
					content: /* @__PURE__ */ R(mn, {
						labelFormatter: (e, t) => {
							let n = t[0]?.payload;
							return n ? a(n) : e;
						},
						formatter: (e) => [o(e), s]
					}),
					cursor: /* @__PURE__ */ R(RO, {}),
					isAnimationActive: !1,
					wrapperStyle: { zIndex: 1800 }
				})
			]
		})
	});
};
export { zO as DataTableStatChart };
