// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./array-wEFLA1CZ.ts";
// node_modules/.bun/d3-path@3.1.0/node_modules/d3-path/src/path.js
var n = Math.PI, r = 2 * n, i = 1e-6, a = r - i;
function o(e) {
	this._ += e[0];
	for (let t = 1, n = e.length; t < n; ++t) this._ += arguments[t] + e[t];
}
function s(e) {
	let t = Math.floor(e);
	if (!(t >= 0)) throw Error(`invalid digits: ${e}`);
	if (t > 15) return o;
	let n = 10 ** t;
	return function(e) {
		this._ += e[0];
		for (let t = 1, r = e.length; t < r; ++t) this._ += Math.round(arguments[t] * n) / n + e[t];
	};
}
var c = class {
	constructor(e) {
		this._x0 = this._y0 = this._x1 = this._y1 = null, this._ = "", this._append = e == null ? o : s(e);
	}
	moveTo(e, t) {
		this._append`M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}`;
	}
	closePath() {
		this._x1 !== null && (this._x1 = this._x0, this._y1 = this._y0, this._append`Z`);
	}
	lineTo(e, t) {
		this._append`L${this._x1 = +e},${this._y1 = +t}`;
	}
	quadraticCurveTo(e, t, n, r) {
		this._append`Q${+e},${+t},${this._x1 = +n},${this._y1 = +r}`;
	}
	bezierCurveTo(e, t, n, r, i, a) {
		this._append`C${+e},${+t},${+n},${+r},${this._x1 = +i},${this._y1 = +a}`;
	}
	arcTo(e, t, r, a, o) {
		if (e = +e, t = +t, r = +r, a = +a, o = +o, o < 0) throw Error(`negative radius: ${o}`);
		let s = this._x1, c = this._y1, l = r - e, u = a - t, d = s - e, f = c - t, p = d * d + f * f;
		if (this._x1 === null) this._append`M${this._x1 = e},${this._y1 = t}`;
		else if (p > i) {
			if (!(Math.abs(f * l - u * d) > i) || !o) this._append`L${this._x1 = e},${this._y1 = t}`;
			else {
				let m = r - s, h = a - c, g = l * l + u * u, ee = m * m + h * h, _ = Math.sqrt(g), v = Math.sqrt(p), y = o * Math.tan((n - Math.acos((g + p - ee) / (2 * _ * v))) / 2), b = y / v, x = y / _;
				Math.abs(b - 1) > i && this._append`L${e + b * d},${t + b * f}`, this._append`A${o},${o},0,0,${+(f * m > d * h)},${this._x1 = e + x * l},${this._y1 = t + x * u}`;
			}
		}
	}
	arc(e, t, o, s, c, l) {
		if (e = +e, t = +t, o = +o, l = !!l, o < 0) throw Error(`negative radius: ${o}`);
		let u = o * Math.cos(s), d = o * Math.sin(s), f = e + u, p = t + d, m = 1 ^ l, h = l ? s - c : c - s;
		this._x1 === null ? this._append`M${f},${p}` : (Math.abs(this._x1 - f) > i || Math.abs(this._y1 - p) > i) && this._append`L${f},${p}`, o && (h < 0 && (h = h % r + r), h > a ? this._append`A${o},${o},0,1,${m},${e - u},${t - d}A${o},${o},0,1,${m},${this._x1 = f},${this._y1 = p}` : h > i && this._append`A${o},${o},0,${+(h >= n)},${m},${this._x1 = e + o * Math.cos(c)},${this._y1 = t + o * Math.sin(c)}`);
	}
	rect(e, t, n, r) {
		this._append`M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}h${n = +n}v${+r}h${-n}Z`;
	}
	toString() {
		return this._;
	}
};
c.prototype;
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/path.js
function l(e) {
	let t = 3;
	return e.digits = function(n) {
		if (!arguments.length) return t;
		if (n == null) t = null;
		else {
			let e = Math.floor(n);
			if (!(e >= 0)) throw RangeError(`invalid digits: ${n}`);
			t = e;
		}
		return e;
	}, () => new c(t);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/linear.js
function u(e) {
	this._context = e;
}
u.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1: this._point = 2;
			default: this._context.lineTo(e, t);
		}
	}
};
function d(e) {
	return new u(e);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/point.js
function f(e) {
	return e[0];
}
function p(e) {
	return e[1];
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/line.js
function m(n, r) {
	var i = e(!0), a = null, o = d, s = null, c = l(u);
	n = typeof n == "function" ? n : n === void 0 ? f : e(n), r = typeof r == "function" ? r : r === void 0 ? p : e(r);
	function u(e) {
		var l, u = (e = t(e)).length, d, f = !1, p;
		for (a ?? (s = o(p = c())), l = 0; l <= u; ++l) !(l < u && i(d = e[l], l, e)) === f && ((f = !f) ? s.lineStart() : s.lineEnd()), f && s.point(+n(d, l, e), +r(d, l, e));
		if (p) return s = null, p + "" || null;
	}
	return u.x = function(t) {
		return arguments.length ? (n = typeof t == "function" ? t : e(+t), u) : n;
	}, u.y = function(t) {
		return arguments.length ? (r = typeof t == "function" ? t : e(+t), u) : r;
	}, u.defined = function(t) {
		return arguments.length ? (i = typeof t == "function" ? t : e(!!t), u) : i;
	}, u.curve = function(e) {
		return arguments.length ? (o = e, a != null && (s = o(a)), u) : o;
	}, u.context = function(e) {
		return arguments.length ? (e == null ? a = s = null : s = o(a = e), u) : a;
	}, u;
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bump.js
var h = class {
	constructor(e, t) {
		this._context = e, this._x = t;
	}
	areaStart() {
		this._line = 0;
	}
	areaEnd() {
		this._line = NaN;
	}
	lineStart() {
		this._point = 0;
	}
	lineEnd() {
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	}
	point(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1: this._point = 2;
			default: this._x ? this._context.bezierCurveTo(this._x0 = (this._x0 + e) / 2, this._y0, this._x0, t, e, t) : this._context.bezierCurveTo(this._x0, this._y0 = (this._y0 + t) / 2, e, this._y0, e, t);
		}
		this._x0 = e, this._y0 = t;
	}
};
function g(e) {
	return new h(e, !0);
}
function ee(e) {
	return new h(e, !1);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/noop.js
function _() {}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basis.js
function v(e, t, n) {
	e._context.bezierCurveTo((2 * e._x0 + e._x1) / 3, (2 * e._y0 + e._y1) / 3, (e._x0 + 2 * e._x1) / 3, (e._y0 + 2 * e._y1) / 3, (e._x0 + 4 * e._x1 + t) / 6, (e._y0 + 4 * e._y1 + n) / 6);
}
function y(e) {
	this._context = e;
}
y.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 3: v(this, this._x1, this._y1);
			case 2: this._context.lineTo(this._x1, this._y1);
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1:
				this._point = 2;
				break;
			case 2: this._point = 3, this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6);
			default: v(this, e, t);
		}
		this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t;
	}
};
function b(e) {
	return new y(e);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basisClosed.js
function x(e) {
	this._context = e;
}
x.prototype = {
	areaStart: _,
	areaEnd: _,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x2, this._y2), this._context.closePath();
				break;
			case 2:
				this._context.moveTo((this._x2 + 2 * this._x3) / 3, (this._y2 + 2 * this._y3) / 3), this._context.lineTo((this._x3 + 2 * this._x2) / 3, (this._y3 + 2 * this._y2) / 3), this._context.closePath();
				break;
			case 3: this.point(this._x2, this._y2), this.point(this._x3, this._y3), this.point(this._x4, this._y4);
		}
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._x2 = e, this._y2 = t;
				break;
			case 1:
				this._point = 2, this._x3 = e, this._y3 = t;
				break;
			case 2:
				this._point = 3, this._x4 = e, this._y4 = t, this._context.moveTo((this._x0 + 4 * this._x1 + e) / 6, (this._y0 + 4 * this._y1 + t) / 6);
				break;
			default: v(this, e, t);
		}
		this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t;
	}
};
function te(e) {
	return new x(e);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basisOpen.js
function ne(e) {
	this._context = e;
}
ne.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = NaN, this._point = 0;
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
				this._point = 3;
				var n = (this._x0 + 4 * this._x1 + e) / 6, r = (this._y0 + 4 * this._y1 + t) / 6;
				this._line ? this._context.lineTo(n, r) : this._context.moveTo(n, r);
				break;
			case 3: this._point = 4;
			default: v(this, e, t);
		}
		this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t;
	}
};
function re(e) {
	return new ne(e);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/linearClosed.js
function S(e) {
	this._context = e;
}
S.prototype = {
	areaStart: _,
	areaEnd: _,
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		this._point && this._context.closePath();
	},
	point: function(e, t) {
		e = +e, t = +t, this._point ? this._context.lineTo(e, t) : (this._point = 1, this._context.moveTo(e, t));
	}
};
function ie(e) {
	return new S(e);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/monotone.js
function C(e) {
	return e < 0 ? -1 : 1;
}
function w(e, t, n) {
	var r = e._x1 - e._x0, i = t - e._x1, a = (e._y1 - e._y0) / (r || i < 0 && -0), o = (n - e._y1) / (i || r < 0 && -0), s = (a * i + o * r) / (r + i);
	return (C(a) + C(o)) * Math.min(Math.abs(a), Math.abs(o), .5 * Math.abs(s)) || 0;
}
function T(e, t) {
	var n = e._x1 - e._x0;
	return n ? (3 * (e._y1 - e._y0) / n - t) / 2 : t;
}
function E(e, t, n) {
	var r = e._x0, i = e._y0, a = e._x1, o = e._y1, s = (a - r) / 3;
	e._context.bezierCurveTo(r + s, i + s * t, a - s, o - s * n, a, o);
}
function D(e) {
	this._context = e;
}
D.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x1, this._y1);
				break;
			case 3: E(this, this._t0, T(this, this._t0));
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		var n = NaN;
		if (e = +e, t = +t, e !== this._x1 || t !== this._y1) {
			switch (this._point) {
				case 0:
					this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
					break;
				case 1:
					this._point = 2;
					break;
				case 2:
					this._point = 3, E(this, T(this, n = w(this, e, t)), n);
					break;
				default: E(this, this._t0, n = w(this, e, t));
			}
			this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t, this._t0 = n;
		}
	}
};
function ae(e) {
	this._context = new oe(e);
}
(ae.prototype = Object.create(D.prototype)).point = function(e, t) {
	D.prototype.point.call(this, t, e);
};
function oe(e) {
	this._context = e;
}
oe.prototype = {
	moveTo: function(e, t) {
		this._context.moveTo(t, e);
	},
	closePath: function() {
		this._context.closePath();
	},
	lineTo: function(e, t) {
		this._context.lineTo(t, e);
	},
	bezierCurveTo: function(e, t, n, r, i, a) {
		this._context.bezierCurveTo(t, e, r, n, a, i);
	}
};
function se(e) {
	return new D(e);
}
function ce(e) {
	return new ae(e);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/natural.js
function le(e) {
	this._context = e;
}
le.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x = [], this._y = [];
	},
	lineEnd: function() {
		var e = this._x, t = this._y, n = e.length;
		if (n) {
			if (this._line ? this._context.lineTo(e[0], t[0]) : this._context.moveTo(e[0], t[0]), n === 2) this._context.lineTo(e[1], t[1]);
			else for (var r = ue(e), i = ue(t), a = 0, o = 1; o < n; ++a, ++o) this._context.bezierCurveTo(r[0][a], i[0][a], r[1][a], i[1][a], e[o], t[o]);
		}
		(this._line || this._line !== 0 && n === 1) && this._context.closePath(), this._line = 1 - this._line, this._x = this._y = null;
	},
	point: function(e, t) {
		this._x.push(+e), this._y.push(+t);
	}
};
function ue(e) {
	var t, n = e.length - 1, r, i = Array(n), a = Array(n), o = Array(n);
	for (i[0] = 0, a[0] = 2, o[0] = e[0] + 2 * e[1], t = 1; t < n - 1; ++t) i[t] = 1, a[t] = 4, o[t] = 4 * e[t] + 2 * e[t + 1];
	for (i[n - 1] = 2, a[n - 1] = 7, o[n - 1] = 8 * e[n - 1] + e[n], t = 1; t < n; ++t) r = i[t] / a[t - 1], a[t] -= r, o[t] -= r * o[t - 1];
	for (i[n - 1] = o[n - 1] / a[n - 1], t = n - 2; t >= 0; --t) i[t] = (o[t] - i[t + 1]) / a[t];
	for (a[n - 1] = (e[n] + i[n - 1]) / 2, t = 0; t < n - 1; ++t) a[t] = 2 * e[t + 1] - i[t + 1];
	return [i, a];
}
function de(e) {
	return new le(e);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/curve/step.js
function O(e, t) {
	this._context = e, this._t = t;
}
O.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x = this._y = NaN, this._point = 0;
	},
	lineEnd: function() {
		0 < this._t && this._t < 1 && this._point === 2 && this._context.lineTo(this._x, this._y), (this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line >= 0 && (this._t = 1 - this._t, this._line = 1 - this._line);
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1: this._point = 2;
			default: if (this._t <= 0) this._context.lineTo(this._x, t), this._context.lineTo(e, t);
			else {
				var n = this._x * (1 - this._t) + e * this._t;
				this._context.lineTo(n, this._y), this._context.lineTo(n, t);
			}
		}
		this._x = e, this._y = t;
	}
};
function fe(e) {
	return new O(e, .5);
}
function pe(e) {
	return new O(e, 0);
}
function me(e) {
	return new O(e, 1);
}
// node_modules/.bun/d3-color@3.1.0/node_modules/d3-color/src/define.js
function k(e, t, n) {
	e.prototype = t.prototype = n, n.constructor = e;
}
function A(e, t) {
	var n = Object.create(e.prototype);
	for (var r in t) n[r] = t[r];
	return n;
}
// node_modules/.bun/d3-color@3.1.0/node_modules/d3-color/src/color.js
function j() {}
var M = .7, N = 1 / M, P = "\\s*([+-]?\\d+)\\s*", F = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", I = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", he = /^#([0-9a-f]{3,8})$/, ge = RegExp(`^rgb\\(${P},${P},${P}\\)$`), _e = RegExp(`^rgb\\(${I},${I},${I}\\)$`), ve = RegExp(`^rgba\\(${P},${P},${P},${F}\\)$`), ye = RegExp(`^rgba\\(${I},${I},${I},${F}\\)$`), be = RegExp(`^hsl\\(${F},${I},${I}\\)$`), xe = RegExp(`^hsla\\(${F},${I},${I},${F}\\)$`), L = {
	aliceblue: 15792383,
	antiquewhite: 16444375,
	aqua: 65535,
	aquamarine: 8388564,
	azure: 15794175,
	beige: 16119260,
	bisque: 16770244,
	black: 0,
	blanchedalmond: 16772045,
	blue: 255,
	blueviolet: 9055202,
	brown: 10824234,
	burlywood: 14596231,
	cadetblue: 6266528,
	chartreuse: 8388352,
	chocolate: 13789470,
	coral: 16744272,
	cornflowerblue: 6591981,
	cornsilk: 16775388,
	crimson: 14423100,
	cyan: 65535,
	darkblue: 139,
	darkcyan: 35723,
	darkgoldenrod: 12092939,
	darkgray: 11119017,
	darkgreen: 25600,
	darkgrey: 11119017,
	darkkhaki: 12433259,
	darkmagenta: 9109643,
	darkolivegreen: 5597999,
	darkorange: 16747520,
	darkorchid: 10040012,
	darkred: 9109504,
	darksalmon: 15308410,
	darkseagreen: 9419919,
	darkslateblue: 4734347,
	darkslategray: 3100495,
	darkslategrey: 3100495,
	darkturquoise: 52945,
	darkviolet: 9699539,
	deeppink: 16716947,
	deepskyblue: 49151,
	dimgray: 6908265,
	dimgrey: 6908265,
	dodgerblue: 2003199,
	firebrick: 11674146,
	floralwhite: 16775920,
	forestgreen: 2263842,
	fuchsia: 16711935,
	gainsboro: 14474460,
	ghostwhite: 16316671,
	gold: 16766720,
	goldenrod: 14329120,
	gray: 8421504,
	green: 32768,
	greenyellow: 11403055,
	grey: 8421504,
	honeydew: 15794160,
	hotpink: 16738740,
	indianred: 13458524,
	indigo: 4915330,
	ivory: 16777200,
	khaki: 15787660,
	lavender: 15132410,
	lavenderblush: 16773365,
	lawngreen: 8190976,
	lemonchiffon: 16775885,
	lightblue: 11393254,
	lightcoral: 15761536,
	lightcyan: 14745599,
	lightgoldenrodyellow: 16448210,
	lightgray: 13882323,
	lightgreen: 9498256,
	lightgrey: 13882323,
	lightpink: 16758465,
	lightsalmon: 16752762,
	lightseagreen: 2142890,
	lightskyblue: 8900346,
	lightslategray: 7833753,
	lightslategrey: 7833753,
	lightsteelblue: 11584734,
	lightyellow: 16777184,
	lime: 65280,
	limegreen: 3329330,
	linen: 16445670,
	magenta: 16711935,
	maroon: 8388608,
	mediumaquamarine: 6737322,
	mediumblue: 205,
	mediumorchid: 12211667,
	mediumpurple: 9662683,
	mediumseagreen: 3978097,
	mediumslateblue: 8087790,
	mediumspringgreen: 64154,
	mediumturquoise: 4772300,
	mediumvioletred: 13047173,
	midnightblue: 1644912,
	mintcream: 16121850,
	mistyrose: 16770273,
	moccasin: 16770229,
	navajowhite: 16768685,
	navy: 128,
	oldlace: 16643558,
	olive: 8421376,
	olivedrab: 7048739,
	orange: 16753920,
	orangered: 16729344,
	orchid: 14315734,
	palegoldenrod: 15657130,
	palegreen: 10025880,
	paleturquoise: 11529966,
	palevioletred: 14381203,
	papayawhip: 16773077,
	peachpuff: 16767673,
	peru: 13468991,
	pink: 16761035,
	plum: 14524637,
	powderblue: 11591910,
	purple: 8388736,
	rebeccapurple: 6697881,
	red: 16711680,
	rosybrown: 12357519,
	royalblue: 4286945,
	saddlebrown: 9127187,
	salmon: 16416882,
	sandybrown: 16032864,
	seagreen: 3050327,
	seashell: 16774638,
	sienna: 10506797,
	silver: 12632256,
	skyblue: 8900331,
	slateblue: 6970061,
	slategray: 7372944,
	slategrey: 7372944,
	snow: 16775930,
	springgreen: 65407,
	steelblue: 4620980,
	tan: 13808780,
	teal: 32896,
	thistle: 14204888,
	tomato: 16737095,
	turquoise: 4251856,
	violet: 15631086,
	wheat: 16113331,
	white: 16777215,
	whitesmoke: 16119285,
	yellow: 16776960,
	yellowgreen: 10145074
};
k(j, B, {
	copy(e) {
		return Object.assign(new this.constructor(), this, e);
	},
	displayable() {
		return this.rgb().displayable();
	},
	hex: R,
	formatHex: R,
	formatHex8: Se,
	formatHsl: Ce,
	formatRgb: z,
	toString: z
});
function R() {
	return this.rgb().formatHex();
}
function Se() {
	return this.rgb().formatHex8();
}
function Ce() {
	return Ae(this).formatHsl();
}
function z() {
	return this.rgb().formatRgb();
}
function B(e) {
	var t, n;
	return e = (e + "").trim().toLowerCase(), (t = he.exec(e)) ? (n = t[1].length, t = parseInt(t[1], 16), n === 6 ? we(t) : n === 3 ? new U(t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, (t & 15) << 4 | t & 15, 1) : n === 8 ? V(t >> 24 & 255, t >> 16 & 255, t >> 8 & 255, (t & 255) / 255) : n === 4 ? V(t >> 12 & 15 | t >> 8 & 240, t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, ((t & 15) << 4 | t & 15) / 255) : null) : (t = ge.exec(e)) ? new U(t[1], t[2], t[3], 1) : (t = _e.exec(e)) ? new U(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, 1) : (t = ve.exec(e)) ? V(t[1], t[2], t[3], t[4]) : (t = ye.exec(e)) ? V(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, t[4]) : (t = be.exec(e)) ? ke(t[1], t[2] / 100, t[3] / 100, 1) : (t = xe.exec(e)) ? ke(t[1], t[2] / 100, t[3] / 100, t[4]) : L.hasOwnProperty(e) ? we(L[e]) : e === "transparent" ? new U(NaN, NaN, NaN, 0) : null;
}
function we(e) {
	return new U(e >> 16 & 255, e >> 8 & 255, e & 255, 1);
}
function V(e, t, n, r) {
	return r <= 0 && (e = t = n = NaN), new U(e, t, n, r);
}
function Te(e) {
	return e instanceof j || (e = B(e)), e ? (e = e.rgb(), new U(e.r, e.g, e.b, e.opacity)) : new U();
}
function H(e, t, n, r) {
	return arguments.length === 1 ? Te(e) : new U(e, t, n, r ?? 1);
}
function U(e, t, n, r) {
	this.r = +e, this.g = +t, this.b = +n, this.opacity = +r;
}
k(U, H, A(j, {
	brighter(e) {
		return e = e == null ? N : N ** +e, new U(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? M : M ** +e, new U(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	rgb() {
		return this;
	},
	clamp() {
		return new U(G(this.r), G(this.g), G(this.b), W(this.opacity));
	},
	displayable() {
		return -.5 <= this.r && this.r < 255.5 && -.5 <= this.g && this.g < 255.5 && -.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
	},
	hex: Ee,
	formatHex: Ee,
	formatHex8: De,
	formatRgb: Oe,
	toString: Oe
}));
function Ee() {
	return `#${K(this.r)}${K(this.g)}${K(this.b)}`;
}
function De() {
	return `#${K(this.r)}${K(this.g)}${K(this.b)}${K((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function Oe() {
	let e = W(this.opacity);
	return `${e === 1 ? "rgb(" : "rgba("}${G(this.r)}, ${G(this.g)}, ${G(this.b)}${e === 1 ? ")" : `, ${e})`}`;
}
function W(e) {
	return isNaN(e) ? 1 : Math.max(0, Math.min(1, e));
}
function G(e) {
	return Math.max(0, Math.min(255, Math.round(e) || 0));
}
function K(e) {
	return e = G(e), (e < 16 ? "0" : "") + e.toString(16);
}
function ke(e, t, n, r) {
	return r <= 0 ? e = t = n = NaN : n <= 0 || n >= 1 ? e = t = NaN : t <= 0 && (e = NaN), new q(e, t, n, r);
}
function Ae(e) {
	if (e instanceof q) return new q(e.h, e.s, e.l, e.opacity);
	if (e instanceof j || (e = B(e)), !e) return new q();
	if (e instanceof q) return e;
	e = e.rgb();
	var t = e.r / 255, n = e.g / 255, r = e.b / 255, i = Math.min(t, n, r), a = Math.max(t, n, r), o = NaN, s = a - i, c = (a + i) / 2;
	return s ? (o = t === a ? (n - r) / s + (n < r) * 6 : n === a ? (r - t) / s + 2 : (t - n) / s + 4, s /= c < .5 ? a + i : 2 - a - i, o *= 60) : s = c > 0 && c < 1 ? 0 : o, new q(o, s, c, e.opacity);
}
function je(e, t, n, r) {
	return arguments.length === 1 ? Ae(e) : new q(e, t, n, r ?? 1);
}
function q(e, t, n, r) {
	this.h = +e, this.s = +t, this.l = +n, this.opacity = +r;
}
k(q, je, A(j, {
	brighter(e) {
		return e = e == null ? N : N ** +e, new q(this.h, this.s, this.l * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? M : M ** +e, new q(this.h, this.s, this.l * e, this.opacity);
	},
	rgb() {
		var e = this.h % 360 + (this.h < 0) * 360, t = isNaN(e) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < .5 ? n : 1 - n) * t, i = 2 * n - r;
		return new U(Y(e >= 240 ? e - 240 : e + 120, i, r), Y(e, i, r), Y(e < 120 ? e + 240 : e - 120, i, r), this.opacity);
	},
	clamp() {
		return new q(Me(this.h), J(this.s), J(this.l), W(this.opacity));
	},
	displayable() {
		return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
	},
	formatHsl() {
		let e = W(this.opacity);
		return `${e === 1 ? "hsl(" : "hsla("}${Me(this.h)}, ${J(this.s) * 100}%, ${J(this.l) * 100}%${e === 1 ? ")" : `, ${e})`}`;
	}
}));
function Me(e) {
	return e = (e || 0) % 360, e < 0 ? e + 360 : e;
}
function J(e) {
	return Math.max(0, Math.min(1, e || 0));
}
function Y(e, t, n) {
	return (e < 60 ? t + (n - t) * e / 60 : e < 180 ? n : e < 240 ? t + (n - t) * (240 - e) / 60 : t) * 255;
}
// node_modules/.bun/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/constant.js
var X = (e) => () => e;
// node_modules/.bun/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/color.js
function Ne(e, t) {
	return function(n) {
		return e + n * t;
	};
}
function Pe(e, t, n) {
	return e **= +n, t = t ** +n - e, n = 1 / n, function(r) {
		return (e + r * t) ** +n;
	};
}
function Fe(e, t) {
	var n = t - e;
	return n ? Ne(e, n > 180 || n < -180 ? n - 360 * Math.round(n / 360) : n) : X(isNaN(e) ? t : e);
}
function Ie(e) {
	return (e = +e) == 1 ? Z : function(t, n) {
		return n - t ? Pe(t, n, e) : X(isNaN(t) ? n : t);
	};
}
function Z(e, t) {
	var n = t - e;
	return n ? Ne(e, n) : X(isNaN(e) ? t : e);
}
// node_modules/.bun/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/rgb.js
var Le = (function e(t) {
	var n = Ie(t);
	function r(e, t) {
		var r = n((e = H(e)).r, (t = H(t)).r), i = n(e.g, t.g), a = n(e.b, t.b), o = Z(e.opacity, t.opacity);
		return function(t) {
			return e.r = r(t), e.g = i(t), e.b = a(t), e.opacity = o(t), e + "";
		};
	}
	return r.gamma = e, r;
})(1);
// node_modules/.bun/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/number.js
function Re(e, t) {
	return e = +e, t = +t, function(n) {
		return e * (1 - n) + t * n;
	};
}
// node_modules/.bun/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/string.js
var Q = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, $ = new RegExp(Q.source, "g");
function ze(e) {
	return function() {
		return e;
	};
}
function Be(e) {
	return function(t) {
		return e(t) + "";
	};
}
function Ve(e, t) {
	var n = Q.lastIndex = $.lastIndex = 0, r, i, a, o = -1, s = [], c = [];
	for (e += "", t += ""; (r = Q.exec(e)) && (i = $.exec(t));) (a = i.index) > n && (a = t.slice(n, a), s[o] ? s[o] += a : s[++o] = a), (r = r[0]) === (i = i[0]) ? s[o] ? s[o] += i : s[++o] = i : (s[++o] = null, c.push({
		i: o,
		x: Re(r, i)
	})), n = $.lastIndex;
	return n < t.length && (a = t.slice(n), s[o] ? s[o] += a : s[++o] = a), s.length < 2 ? c[0] ? Be(c[0].x) : ze(t) : (t = c.length, function(e) {
		for (var n = 0, r; n < t; ++n) s[(r = c[n]).i] = r.x(e);
		return s.join("");
	});
}
export { d as A, b as C, m as D, ee as E, f as O, y as S, g as T, se as _, Z as a, re as b, U as c, k as d, A as f, de as g, fe as h, Fe as i, l as j, p as k, B as l, pe as m, Re as n, X as o, me as p, Le as r, j as s, Ve as t, Te as u, ce as v, _ as w, te as x, ie as y };
