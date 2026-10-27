// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { W as e, a as t, d as n, f as r, g as i, h as a, i as o, o as s, v as c, y as l } from "./chunk-NSK5VX7P-5Ni3mhvK.ts";
import { n as u, r as d, t as f } from "./src-Bie5yc-F.ts";
import { t as p } from "./download-B4RJJThF.ts";
import { t as m } from "./maximize-2-YC7VD5Yz.ts";
import { t as h } from "./minus-BdT0RA0-.ts";
import { t as g } from "./pencil-DsB6zW8x.ts";
import { t as _ } from "./plus-CYkLGSPS.ts";
import { t as v } from "./x-DqEAa6-d.ts";
import { n as y } from "./chunk-Y2CYZVJY-DqH9smpi.ts";
import { $ as b, C as ee, E as x, I as S, L as C, N as te, P as ne, Q as re, S as ie, T as ae, V as oe, W as w, X as se, Z as ce, _ as le, b as ue, c as de, g as fe, l as pe, m as me, n as he, p as ge, q as _e, r as ve, s as ye, t as be, u as xe, x as Se } from "./chunk-I66GZJ75-3HfQzheA.ts";
import { r as Ce } from "./chunk-4I5QYGJK-BX5Vi4LT.ts";
import { r as we } from "./chunk-WRU74C26-qwyKgycS.ts";
import "./chunk-7BUUIJ7U-DPsau0cB.ts";
import "./chunk-UBXNYLIW-BqxfGCsV.ts";
import "./chunk-W5SLKNZC-BF1fQi72.ts";
import { a as Te, i as Ee, s as De } from "./chunk-QR6OTTB3-CMAC0lOx.ts";
import { a as Oe, i as ke, o as Ae, r as je } from "./chunk-7Z6QIM7H-D4gpaSAe.ts";
import { t as Me } from "./scroll-area-I7hjn89T.ts";
import { t as Ne } from "./tooltip-BweQW627.ts";
import { n as Pe } from "./theme-preference-Blf4BFb2.ts";
import { r as Fe } from "./apply-theme-preference-DzXMh3mV.ts";
import { useEffect as Ie, useRef as Le, useState as T } from "react";
import { Box as E, Button as Re, Dialog as D, Icon as ze, IconButton as Be, Portal as Ve, Stack as He, Text as Ue } from "@chakra-ui/react";
import { jsx as O, jsxs as k } from "react/jsx-runtime";
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/chunk-3NCLNEKW.mjs
var We = /* @__PURE__ */ y((e) => {
	let { securityLevel: t } = Se(), n = f("body");
	if (t === "sandbox") {
		let t = f(`#i${e}`).node()?.contentDocument ?? document;
		n = f(t.body);
	}
	return n.select(`#${e}`);
}, "selectSvgElement");
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/_internal/isPrototype.mjs
function Ge(e) {
	let t = e?.constructor;
	return e === (typeof t == "function" ? t.prototype : Object.prototype);
}
// node_modules/.bun/es-toolkit@1.45.1/node_modules/es-toolkit/dist/compat/predicate/isEmpty.mjs
function Ke(t) {
	if (t == null) return !0;
	if (e(t)) return typeof t.splice != "function" && typeof t != "string" && (typeof Buffer > "u" || !Buffer.isBuffer(t)) && !c(t) && !l(t) ? !1 : t.length === 0;
	if (typeof t == "object") {
		if (t instanceof Map || t instanceof Set) return t.size === 0;
		let e = Object.keys(t);
		return Ge(t) ? e.filter((e) => e !== "constructor").length === 0 : e.length === 0;
	}
	return !0;
}
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/chunk-J7OUQ5F2.mjs
var qe = {
	common: ye,
	getConfig: ue,
	insertCluster: Ee,
	insertEdge: je,
	insertEdgeLabel: ke,
	insertMarkers: Oe,
	insertNode: Te,
	interpolateToCurve: n,
	labelHelper: De,
	log: u,
	positionEdgeLabel: Ae
}, Je = {}, Ye = /* @__PURE__ */ y((e) => {
	for (let t of e) Je[t.name] = t;
}, "registerLayoutLoaders");
(/* @__PURE__ */ y(() => {
	Ye([
		{
			name: "dagre",
			loader: /* @__PURE__ */ y(async () => await import("./dagre-VZM6K2ZE-Cu8vZXvI.ts"), "loader")
		},
		{
			name: "swimlane",
			loader: /* @__PURE__ */ y(async () => await import("./swimlanes-SLNWSIFB-CGUzHGk2.ts"), "loader")
		},
		{
			name: "cose-bilkent",
			loader: /* @__PURE__ */ y(async () => await import("./cose-bilkent-JH36ORCC-Bywz5rts.ts"), "loader")
		}
	]);
}, "registerDefaultLayoutLoaders"))();
var Xe = /* @__PURE__ */ y(async (e, t, n) => {
	if (!(e.layoutAlgorithm in Je)) throw Error(`Unknown layout algorithm: ${e.layoutAlgorithm}`);
	if (e.diagramId) for (let t of e.nodes) {
		let n = t.domId || t.id;
		t.domId = `${e.diagramId}-${n}`;
	}
	let r = Je[e.layoutAlgorithm], i = await r.loader(), { theme: a, themeVariables: o } = e.config, { useGradient: s, gradientStart: c, gradientStop: l } = o, u = t.attr("id");
	if (t.append("defs").append("filter").attr("id", `${u}-drop-shadow`).attr("height", "130%").attr("width", "130%").append("feDropShadow").attr("dx", "4").attr("dy", "4").attr("stdDeviation", 0).attr("flood-opacity", "0.06").attr("flood-color", `${a?.includes("dark") ? "#FFFFFF" : "#000000"}`), t.append("defs").append("filter").attr("id", `${u}-drop-shadow-small`).attr("height", "150%").attr("width", "150%").append("feDropShadow").attr("dx", "2").attr("dy", "2").attr("stdDeviation", 0).attr("flood-opacity", "0.06").attr("flood-color", `${a?.includes("dark") ? "#FFFFFF" : "#000000"}`), s) {
		let e = t.append("linearGradient").attr("id", t.attr("id") + "-gradient").attr("gradientUnits", "objectBoundingBox").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
		e.append("svg:stop").attr("offset", "0%").attr("stop-color", c).attr("stop-opacity", 1), e.append("svg:stop").attr("offset", "100%").attr("stop-color", l).attr("stop-opacity", 1);
	}
	return i.render(e, t, qe, { algorithm: r.algorithm }, n);
}, "render"), Ze = /* @__PURE__ */ y((e = "", { fallback: t = "dagre" } = {}) => {
	if (e in Je) return e;
	if (t in Je) return u.warn(`Layout algorithm ${e} is not registered. Using ${t} as fallback.`), t;
	throw Error(`Both layout algorithms ${e} and ${t} are not registered.`);
}, "getRegisteredLayoutAlgorithm");
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ZIRB5QZD.mjs
function Qe(e) {
	return e == null;
}
y(Qe, "isNothing");
function $e(e) {
	return typeof e == "object" && !!e;
}
y($e, "isObject");
function et(e) {
	return Array.isArray(e) ? e : Qe(e) ? [] : [e];
}
y(et, "toArray");
function tt(e, t) {
	var n, r, i, a;
	if (t) for (a = Object.keys(t), n = 0, r = a.length; n < r; n += 1) i = a[n], e[i] = t[i];
	return e;
}
y(tt, "extend");
function nt(e, t) {
	for (var n = "", r = 0; r < t; r += 1) n += e;
	return n;
}
y(nt, "repeat");
function rt(e) {
	return e === 0 && 1 / e == -Infinity;
}
y(rt, "isNegativeZero");
var A = {
	isNothing: Qe,
	isObject: $e,
	toArray: et,
	repeat: nt,
	isNegativeZero: rt,
	extend: tt
};
function it(e, t) {
	var n = "", r = e.reason || "(unknown reason)";
	return e.mark ? (e.mark.name && (n += "in \"" + e.mark.name + "\" "), n += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")", !t && e.mark.snippet && (n += "\n\n" + e.mark.snippet), r + " " + n) : r;
}
y(it, "formatError");
function at(e, t) {
	Error.call(this), this.name = "YAMLException", this.reason = e, this.mark = t, this.message = it(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = (/* @__PURE__ */ Error()).stack || "";
}
y(at, "YAMLException$1"), at.prototype = Object.create(Error.prototype), at.prototype.constructor = at, at.prototype.toString = /* @__PURE__ */ y(function(e) {
	return this.name + ": " + it(this, e);
}, "toString");
var j = at;
function ot(e, t, n, r, i) {
	var a = "", o = "", s = Math.floor(i / 2) - 1;
	return r - t > s && (a = " ... ", t = r - s + a.length), n - r > s && (o = " ...", n = r + s - o.length), {
		str: a + e.slice(t, n).replace(/\t/g, "→") + o,
		pos: r - t + a.length
	};
}
y(ot, "getLine");
function st(e, t) {
	return A.repeat(" ", t - e.length) + e;
}
y(st, "padStart");
function ct(e, t) {
	if (t = Object.create(t || null), !e.buffer) return null;
	t.maxLength || (t.maxLength = 79), typeof t.indent != "number" && (t.indent = 1), typeof t.linesBefore != "number" && (t.linesBefore = 3), typeof t.linesAfter != "number" && (t.linesAfter = 2);
	for (var n = /\r?\n|\r|\0/g, r = [0], i = [], a, o = -1; a = n.exec(e.buffer);) i.push(a.index), r.push(a.index + a[0].length), e.position <= a.index && o < 0 && (o = r.length - 2);
	o < 0 && (o = r.length - 1);
	var s = "", c, l, u = Math.min(e.line + t.linesAfter, i.length).toString().length, d = t.maxLength - (t.indent + u + 3);
	for (c = 1; c <= t.linesBefore && !(o - c < 0); c++) l = ot(e.buffer, r[o - c], i[o - c], e.position - (r[o] - r[o - c]), d), s = A.repeat(" ", t.indent) + st((e.line - c + 1).toString(), u) + " | " + l.str + "\n" + s;
	for (l = ot(e.buffer, r[o], i[o], e.position, d), s += A.repeat(" ", t.indent) + st((e.line + 1).toString(), u) + " | " + l.str + "\n", s += A.repeat("-", t.indent + u + 3 + l.pos) + "^\n", c = 1; c <= t.linesAfter && !(o + c >= i.length); c++) l = ot(e.buffer, r[o + c], i[o + c], e.position - (r[o] - r[o + c]), d), s += A.repeat(" ", t.indent) + st((e.line + c + 1).toString(), u) + " | " + l.str + "\n";
	return s.replace(/\n$/, "");
}
y(ct, "makeSnippet");
var lt = ct, ut = [
	"kind",
	"multi",
	"resolve",
	"construct",
	"instanceOf",
	"predicate",
	"represent",
	"representName",
	"defaultStyle",
	"styleAliases"
], dt = [
	"scalar",
	"sequence",
	"mapping"
];
function ft(e) {
	var t = {};
	return e !== null && Object.keys(e).forEach(function(n) {
		e[n].forEach(function(e) {
			t[String(e)] = n;
		});
	}), t;
}
y(ft, "compileStyleAliases");
function pt(e, t) {
	if (t ||= {}, Object.keys(t).forEach(function(t) {
		if (ut.indexOf(t) === -1) throw new j("Unknown option \"" + t + "\" is met in definition of \"" + e + "\" YAML type.");
	}), this.options = t, this.tag = e, this.kind = t.kind || null, this.resolve = t.resolve || function() {
		return !0;
	}, this.construct = t.construct || function(e) {
		return e;
	}, this.instanceOf = t.instanceOf || null, this.predicate = t.predicate || null, this.represent = t.represent || null, this.representName = t.representName || null, this.defaultStyle = t.defaultStyle || null, this.multi = t.multi || !1, this.styleAliases = ft(t.styleAliases || null), dt.indexOf(this.kind) === -1) throw new j("Unknown kind \"" + this.kind + "\" is specified for \"" + e + "\" YAML type.");
}
y(pt, "Type$1");
var M = pt;
function mt(e, t) {
	var n = [];
	return e[t].forEach(function(e) {
		var t = n.length;
		n.forEach(function(n, r) {
			n.tag === e.tag && n.kind === e.kind && n.multi === e.multi && (t = r);
		}), n[t] = e;
	}), n;
}
y(mt, "compileList");
function ht() {
	var e = {
		scalar: {},
		sequence: {},
		mapping: {},
		fallback: {},
		multi: {
			scalar: [],
			sequence: [],
			mapping: [],
			fallback: []
		}
	}, t, n;
	function r(t) {
		t.multi ? (e.multi[t.kind].push(t), e.multi.fallback.push(t)) : e[t.kind][t.tag] = e.fallback[t.tag] = t;
	}
	for (y(r, "collectType"), t = 0, n = arguments.length; t < n; t += 1) arguments[t].forEach(r);
	return e;
}
y(ht, "compileMap");
function gt(e) {
	return this.extend(e);
}
y(gt, "Schema$1"), gt.prototype.extend = /* @__PURE__ */ y(function(e) {
	var t = [], n = [];
	if (e instanceof M) n.push(e);
	else if (Array.isArray(e)) n = n.concat(e);
	else if (e && (Array.isArray(e.implicit) || Array.isArray(e.explicit))) e.implicit && (t = t.concat(e.implicit)), e.explicit && (n = n.concat(e.explicit));
	else throw new j("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
	t.forEach(function(e) {
		if (!(e instanceof M)) throw new j("Specified list of YAML types (or a single Type object) contains a non-Type object.");
		if (e.loadKind && e.loadKind !== "scalar") throw new j("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
		if (e.multi) throw new j("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
	}), n.forEach(function(e) {
		if (!(e instanceof M)) throw new j("Specified list of YAML types (or a single Type object) contains a non-Type object.");
	});
	var r = Object.create(gt.prototype);
	return r.implicit = (this.implicit || []).concat(t), r.explicit = (this.explicit || []).concat(n), r.compiledImplicit = mt(r, "implicit"), r.compiledExplicit = mt(r, "explicit"), r.compiledTypeMap = ht(r.compiledImplicit, r.compiledExplicit), r;
}, "extend");
var _t = new gt({ explicit: [
	new M("tag:yaml.org,2002:str", {
		kind: "scalar",
		construct: /* @__PURE__ */ y(function(e) {
			return e === null ? "" : e;
		}, "construct")
	}),
	new M("tag:yaml.org,2002:seq", {
		kind: "sequence",
		construct: /* @__PURE__ */ y(function(e) {
			return e === null ? [] : e;
		}, "construct")
	}),
	new M("tag:yaml.org,2002:map", {
		kind: "mapping",
		construct: /* @__PURE__ */ y(function(e) {
			return e === null ? {} : e;
		}, "construct")
	})
] });
function vt(e) {
	if (e === null) return !0;
	var t = e.length;
	return t === 1 && e === "~" || t === 4 && (e === "null" || e === "Null" || e === "NULL");
}
y(vt, "resolveYamlNull");
function yt() {
	return null;
}
y(yt, "constructYamlNull");
function bt(e) {
	return e === null;
}
y(bt, "isNull");
var xt = new M("tag:yaml.org,2002:null", {
	kind: "scalar",
	resolve: vt,
	construct: yt,
	predicate: bt,
	represent: {
		canonical: /* @__PURE__ */ y(function() {
			return "~";
		}, "canonical"),
		lowercase: /* @__PURE__ */ y(function() {
			return "null";
		}, "lowercase"),
		uppercase: /* @__PURE__ */ y(function() {
			return "NULL";
		}, "uppercase"),
		camelcase: /* @__PURE__ */ y(function() {
			return "Null";
		}, "camelcase"),
		empty: /* @__PURE__ */ y(function() {
			return "";
		}, "empty")
	},
	defaultStyle: "lowercase"
});
function St(e) {
	if (e === null) return !1;
	var t = e.length;
	return t === 4 && (e === "true" || e === "True" || e === "TRUE") || t === 5 && (e === "false" || e === "False" || e === "FALSE");
}
y(St, "resolveYamlBoolean");
function Ct(e) {
	return e === "true" || e === "True" || e === "TRUE";
}
y(Ct, "constructYamlBoolean");
function wt(e) {
	return Object.prototype.toString.call(e) === "[object Boolean]";
}
y(wt, "isBoolean");
var Tt = new M("tag:yaml.org,2002:bool", {
	kind: "scalar",
	resolve: St,
	construct: Ct,
	predicate: wt,
	represent: {
		lowercase: /* @__PURE__ */ y(function(e) {
			return e ? "true" : "false";
		}, "lowercase"),
		uppercase: /* @__PURE__ */ y(function(e) {
			return e ? "TRUE" : "FALSE";
		}, "uppercase"),
		camelcase: /* @__PURE__ */ y(function(e) {
			return e ? "True" : "False";
		}, "camelcase")
	},
	defaultStyle: "lowercase"
});
function Et(e) {
	return 48 <= e && e <= 57 || 65 <= e && e <= 70 || 97 <= e && e <= 102;
}
y(Et, "isHexCode");
function Dt(e) {
	return 48 <= e && e <= 55;
}
y(Dt, "isOctCode");
function Ot(e) {
	return 48 <= e && e <= 57;
}
y(Ot, "isDecCode");
function kt(e) {
	if (e === null) return !1;
	var t = e.length, n = 0, r = !1, i;
	if (!t) return !1;
	if (i = e[n], (i === "-" || i === "+") && (i = e[++n]), i === "0") {
		if (n + 1 === t) return !0;
		if (i = e[++n], i === "b") {
			for (n++; n < t; n++) if (i = e[n], i !== "_") {
				if (i !== "0" && i !== "1") return !1;
				r = !0;
			}
			return r && i !== "_";
		}
		if (i === "x") {
			for (n++; n < t; n++) if (i = e[n], i !== "_") {
				if (!Et(e.charCodeAt(n))) return !1;
				r = !0;
			}
			return r && i !== "_";
		}
		if (i === "o") {
			for (n++; n < t; n++) if (i = e[n], i !== "_") {
				if (!Dt(e.charCodeAt(n))) return !1;
				r = !0;
			}
			return r && i !== "_";
		}
	}
	if (i === "_") return !1;
	for (; n < t; n++) if (i = e[n], i !== "_") {
		if (!Ot(e.charCodeAt(n))) return !1;
		r = !0;
	}
	return !(!r || i === "_");
}
y(kt, "resolveYamlInteger");
function At(e) {
	var t = e, n = 1, r;
	if (t.indexOf("_") !== -1 && (t = t.replace(/_/g, "")), r = t[0], (r === "-" || r === "+") && (r === "-" && (n = -1), t = t.slice(1), r = t[0]), t === "0") return 0;
	if (r === "0") {
		if (t[1] === "b") return n * parseInt(t.slice(2), 2);
		if (t[1] === "x") return n * parseInt(t.slice(2), 16);
		if (t[1] === "o") return n * parseInt(t.slice(2), 8);
	}
	return n * parseInt(t, 10);
}
y(At, "constructYamlInteger");
function jt(e) {
	return Object.prototype.toString.call(e) === "[object Number]" && e % 1 == 0 && !A.isNegativeZero(e);
}
y(jt, "isInteger");
var Mt = new M("tag:yaml.org,2002:int", {
	kind: "scalar",
	resolve: kt,
	construct: At,
	predicate: jt,
	represent: {
		binary: /* @__PURE__ */ y(function(e) {
			return e >= 0 ? "0b" + e.toString(2) : "-0b" + e.toString(2).slice(1);
		}, "binary"),
		octal: /* @__PURE__ */ y(function(e) {
			return e >= 0 ? "0o" + e.toString(8) : "-0o" + e.toString(8).slice(1);
		}, "octal"),
		decimal: /* @__PURE__ */ y(function(e) {
			return e.toString(10);
		}, "decimal"),
		hexadecimal: /* @__PURE__ */ y(function(e) {
			return e >= 0 ? "0x" + e.toString(16).toUpperCase() : "-0x" + e.toString(16).toUpperCase().slice(1);
		}, "hexadecimal")
	},
	defaultStyle: "decimal",
	styleAliases: {
		binary: [2, "bin"],
		octal: [8, "oct"],
		decimal: [10, "dec"],
		hexadecimal: [16, "hex"]
	}
}), Nt = /* @__PURE__ */ RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
function Pt(e) {
	return !(e === null || !Nt.test(e) || e[e.length - 1] === "_");
}
y(Pt, "resolveYamlFloat");
function Ft(e) {
	var t = e.replace(/_/g, "").toLowerCase(), n = t[0] === "-" ? -1 : 1;
	return "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)), t === ".inf" ? n === 1 ? Infinity : -Infinity : t === ".nan" ? NaN : n * parseFloat(t, 10);
}
y(Ft, "constructYamlFloat");
var It = /^[-+]?[0-9]+e/;
function Lt(e, t) {
	var n;
	if (isNaN(e)) switch (t) {
		case "lowercase": return ".nan";
		case "uppercase": return ".NAN";
		case "camelcase": return ".NaN";
	}
	else if (e === Infinity) switch (t) {
		case "lowercase": return ".inf";
		case "uppercase": return ".INF";
		case "camelcase": return ".Inf";
	}
	else if (e === -Infinity) switch (t) {
		case "lowercase": return "-.inf";
		case "uppercase": return "-.INF";
		case "camelcase": return "-.Inf";
	}
	else if (A.isNegativeZero(e)) return "-0.0";
	return n = e.toString(10), It.test(n) ? n.replace("e", ".e") : n;
}
y(Lt, "representYamlFloat");
function Rt(e) {
	return Object.prototype.toString.call(e) === "[object Number]" && (e % 1 != 0 || A.isNegativeZero(e));
}
y(Rt, "isFloat");
var zt = new M("tag:yaml.org,2002:float", {
	kind: "scalar",
	resolve: Pt,
	construct: Ft,
	predicate: Rt,
	represent: Lt,
	defaultStyle: "lowercase"
}), Bt = _t.extend({ implicit: [
	xt,
	Tt,
	Mt,
	zt
] }), Vt = Bt, Ht = /* @__PURE__ */ RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"), Ut = /* @__PURE__ */ RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
function Wt(e) {
	return e === null ? !1 : Ht.exec(e) !== null || Ut.exec(e) !== null;
}
y(Wt, "resolveYamlTimestamp");
function Gt(e) {
	var t, n, r, i, a, o, s, c = 0, l = null, u, d, f;
	if (t = Ht.exec(e), t === null && (t = Ut.exec(e)), t === null) throw Error("Date resolve error");
	if (n = +t[1], r = t[2] - 1, i = +t[3], !t[4]) return new Date(Date.UTC(n, r, i));
	if (a = +t[4], o = +t[5], s = +t[6], t[7]) {
		for (c = t[7].slice(0, 3); c.length < 3;) c += "0";
		c = +c;
	}
	return t[9] && (u = +t[10], d = +(t[11] || 0), l = (u * 60 + d) * 6e4, t[9] === "-" && (l = -l)), f = new Date(Date.UTC(n, r, i, a, o, s, c)), l && f.setTime(f.getTime() - l), f;
}
y(Gt, "constructYamlTimestamp");
function Kt(e) {
	return e.toISOString();
}
y(Kt, "representYamlTimestamp");
var qt = new M("tag:yaml.org,2002:timestamp", {
	kind: "scalar",
	resolve: Wt,
	construct: Gt,
	instanceOf: Date,
	represent: Kt
});
function Jt(e) {
	return e === "<<" || e === null;
}
y(Jt, "resolveYamlMerge");
var Yt = new M("tag:yaml.org,2002:merge", {
	kind: "scalar",
	resolve: Jt
}), Xt = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
function Zt(e) {
	if (e === null) return !1;
	var t, n, r = 0, i = e.length, a = Xt;
	for (n = 0; n < i; n++) if (t = a.indexOf(e.charAt(n)), !(t > 64)) {
		if (t < 0) return !1;
		r += 6;
	}
	return r % 8 == 0;
}
y(Zt, "resolveYamlBinary");
function Qt(e) {
	var t, n, r = e.replace(/[\r\n=]/g, ""), i = r.length, a = Xt, o = 0, s = [];
	for (t = 0; t < i; t++) t % 4 == 0 && t && (s.push(o >> 16 & 255), s.push(o >> 8 & 255), s.push(o & 255)), o = o << 6 | a.indexOf(r.charAt(t));
	return n = i % 4 * 6, n === 0 ? (s.push(o >> 16 & 255), s.push(o >> 8 & 255), s.push(o & 255)) : n === 18 ? (s.push(o >> 10 & 255), s.push(o >> 2 & 255)) : n === 12 && s.push(o >> 4 & 255), new Uint8Array(s);
}
y(Qt, "constructYamlBinary");
function $t(e) {
	var t = "", n = 0, r, i, a = e.length, o = Xt;
	for (r = 0; r < a; r++) r % 3 == 0 && r && (t += o[n >> 18 & 63], t += o[n >> 12 & 63], t += o[n >> 6 & 63], t += o[n & 63]), n = (n << 8) + e[r];
	return i = a % 3, i === 0 ? (t += o[n >> 18 & 63], t += o[n >> 12 & 63], t += o[n >> 6 & 63], t += o[n & 63]) : i === 2 ? (t += o[n >> 10 & 63], t += o[n >> 4 & 63], t += o[n << 2 & 63], t += o[64]) : i === 1 && (t += o[n >> 2 & 63], t += o[n << 4 & 63], t += o[64], t += o[64]), t;
}
y($t, "representYamlBinary");
function en(e) {
	return Object.prototype.toString.call(e) === "[object Uint8Array]";
}
y(en, "isBinary");
var tn = new M("tag:yaml.org,2002:binary", {
	kind: "scalar",
	resolve: Zt,
	construct: Qt,
	predicate: en,
	represent: $t
}), nn = Object.prototype.hasOwnProperty, rn = Object.prototype.toString;
function an(e) {
	if (e === null) return !0;
	var t = [], n, r, i, a, o, s = e;
	for (n = 0, r = s.length; n < r; n += 1) {
		if (i = s[n], o = !1, rn.call(i) !== "[object Object]") return !1;
		for (a in i) if (nn.call(i, a)) {
			if (!o) o = !0;
			else return !1;
		}
		if (!o) return !1;
		if (t.indexOf(a) === -1) t.push(a);
		else return !1;
	}
	return !0;
}
y(an, "resolveYamlOmap");
function on(e) {
	return e === null ? [] : e;
}
y(on, "constructYamlOmap");
var sn = new M("tag:yaml.org,2002:omap", {
	kind: "sequence",
	resolve: an,
	construct: on
}), cn = Object.prototype.toString;
function ln(e) {
	if (e === null) return !0;
	var t, n, r, i, a, o = e;
	for (a = Array(o.length), t = 0, n = o.length; t < n; t += 1) {
		if (r = o[t], cn.call(r) !== "[object Object]" || (i = Object.keys(r), i.length !== 1)) return !1;
		a[t] = [i[0], r[i[0]]];
	}
	return !0;
}
y(ln, "resolveYamlPairs");
function un(e) {
	if (e === null) return [];
	var t, n, r, i, a, o = e;
	for (a = Array(o.length), t = 0, n = o.length; t < n; t += 1) r = o[t], i = Object.keys(r), a[t] = [i[0], r[i[0]]];
	return a;
}
y(un, "constructYamlPairs");
var dn = new M("tag:yaml.org,2002:pairs", {
	kind: "sequence",
	resolve: ln,
	construct: un
}), fn = Object.prototype.hasOwnProperty;
function pn(e) {
	if (e === null) return !0;
	var t, n = e;
	for (t in n) if (fn.call(n, t) && n[t] !== null) return !1;
	return !0;
}
y(pn, "resolveYamlSet");
function mn(e) {
	return e === null ? {} : e;
}
y(mn, "constructYamlSet");
var hn = new M("tag:yaml.org,2002:set", {
	kind: "mapping",
	resolve: pn,
	construct: mn
}), gn = Vt.extend({
	implicit: [qt, Yt],
	explicit: [
		tn,
		sn,
		dn,
		hn
	]
}), N = Object.prototype.hasOwnProperty, _n = 1, vn = 2, yn = 3, bn = 4, xn = 1, Sn = 2, Cn = 3, wn = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/, Tn = /[\x85\u2028\u2029]/, En = /[,\[\]\{\}]/, Dn = /^(?:!|!!|![a-z\-]+!)$/i, On = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function kn(e) {
	return Object.prototype.toString.call(e);
}
y(kn, "_class");
function P(e) {
	return e === 10 || e === 13;
}
y(P, "is_EOL");
function F(e) {
	return e === 9 || e === 32;
}
y(F, "is_WHITE_SPACE");
function I(e) {
	return e === 9 || e === 32 || e === 10 || e === 13;
}
y(I, "is_WS_OR_EOL");
function L(e) {
	return e === 44 || e === 91 || e === 93 || e === 123 || e === 125;
}
y(L, "is_FLOW_INDICATOR");
function An(e) {
	var t;
	return 48 <= e && e <= 57 ? e - 48 : (t = e | 32, 97 <= t && t <= 102 ? t - 97 + 10 : -1);
}
y(An, "fromHexCode");
function jn(e) {
	return e === 120 ? 2 : e === 117 ? 4 : e === 85 ? 8 : 0;
}
y(jn, "escapedHexLen");
function Mn(e) {
	return 48 <= e && e <= 57 ? e - 48 : -1;
}
y(Mn, "fromDecimalCode");
function Nn(e) {
	return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? "\n" : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? "\"" : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? "\xA0" : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
}
y(Nn, "simpleEscapeSequence");
function Pn(e) {
	return e <= 65535 ? String.fromCharCode(e) : String.fromCharCode((e - 65536 >> 10) + 55296, (e - 65536 & 1023) + 56320);
}
y(Pn, "charFromCodepoint");
function Fn(e, t, n) {
	t === "__proto__" ? Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !0,
		writable: !0,
		value: n
	}) : e[t] = n;
}
y(Fn, "setProperty");
var In = Array(256), Ln = Array(256);
for (R = 0; R < 256; R++) In[R] = +!!Nn(R), Ln[R] = Nn(R);
var R;
function Rn(e, t) {
	this.input = e, this.filename = t.filename || null, this.schema = t.schema || gn, this.onWarning = t.onWarning || null, this.legacy = t.legacy || !1, this.json = t.json || !1, this.listener = t.listener || null, this.implicitTypes = this.schema.compiledImplicit, this.typeMap = this.schema.compiledTypeMap, this.length = e.length, this.position = 0, this.line = 0, this.lineStart = 0, this.lineIndent = 0, this.firstTabInLine = -1, this.documents = [];
}
y(Rn, "State$1");
function zn(e, t) {
	var n = {
		name: e.filename,
		buffer: e.input.slice(0, -1),
		position: e.position,
		line: e.line,
		column: e.position - e.lineStart
	};
	return n.snippet = lt(n), new j(t, n);
}
y(zn, "generateError");
function z(e, t) {
	throw zn(e, t);
}
y(z, "throwError");
function Bn(e, t) {
	e.onWarning && e.onWarning.call(null, zn(e, t));
}
y(Bn, "throwWarning");
var Vn = {
	YAML: /* @__PURE__ */ y(function(e, t, n) {
		var r, i, a;
		e.version !== null && z(e, "duplication of %YAML directive"), n.length !== 1 && z(e, "YAML directive accepts exactly one argument"), r = /^([0-9]+)\.([0-9]+)$/.exec(n[0]), r === null && z(e, "ill-formed argument of the YAML directive"), i = parseInt(r[1], 10), a = parseInt(r[2], 10), i !== 1 && z(e, "unacceptable YAML version of the document"), e.version = n[0], e.checkLineBreaks = a < 2, a !== 1 && a !== 2 && Bn(e, "unsupported YAML version of the document");
	}, "handleYamlDirective"),
	TAG: /* @__PURE__ */ y(function(e, t, n) {
		var r, i;
		n.length !== 2 && z(e, "TAG directive accepts exactly two arguments"), r = n[0], i = n[1], Dn.test(r) || z(e, "ill-formed tag handle (first argument) of the TAG directive"), N.call(e.tagMap, r) && z(e, "there is a previously declared suffix for \"" + r + "\" tag handle"), On.test(i) || z(e, "ill-formed tag prefix (second argument) of the TAG directive");
		try {
			i = decodeURIComponent(i);
		} catch {
			z(e, "tag prefix is malformed: " + i);
		}
		e.tagMap[r] = i;
	}, "handleTagDirective")
};
function B(e, t, n, r) {
	var i, a, o, s;
	if (t < n) {
		if (s = e.input.slice(t, n), r) for (i = 0, a = s.length; i < a; i += 1) o = s.charCodeAt(i), o === 9 || 32 <= o && o <= 1114111 || z(e, "expected valid JSON character");
		else wn.test(s) && z(e, "the stream contains non-printable characters");
		e.result += s;
	}
}
y(B, "captureSegment");
function Hn(e, t, n, r) {
	var i, a, o, s;
	for (A.isObject(n) || z(e, "cannot merge mappings; the provided source object is unacceptable"), i = Object.keys(n), o = 0, s = i.length; o < s; o += 1) a = i[o], N.call(t, a) || (Fn(t, a, n[a]), r[a] = !0);
}
y(Hn, "mergeMappings");
function V(e, t, n, r, i, a, o, s, c) {
	var l, u;
	if (Array.isArray(i)) for (i = Array.prototype.slice.call(i), l = 0, u = i.length; l < u; l += 1) Array.isArray(i[l]) && z(e, "nested arrays are not supported inside keys"), typeof i == "object" && kn(i[l]) === "[object Object]" && (i[l] = "[object Object]");
	if (typeof i == "object" && kn(i) === "[object Object]" && (i = "[object Object]"), i = String(i), t === null && (t = {}), r === "tag:yaml.org,2002:merge") {
		if (Array.isArray(a)) for (l = 0, u = a.length; l < u; l += 1) Hn(e, t, a[l], n);
		else Hn(e, t, a, n);
	} else !e.json && !N.call(n, i) && N.call(t, i) && (e.line = o || e.line, e.lineStart = s || e.lineStart, e.position = c || e.position, z(e, "duplicated mapping key")), Fn(t, i, a), delete n[i];
	return t;
}
y(V, "storeMappingPair");
function Un(e) {
	var t = e.input.charCodeAt(e.position);
	t === 10 ? e.position++ : t === 13 ? (e.position++, e.input.charCodeAt(e.position) === 10 && e.position++) : z(e, "a line break is expected"), e.line += 1, e.lineStart = e.position, e.firstTabInLine = -1;
}
y(Un, "readLineBreak");
function H(e, t, n) {
	for (var r = 0, i = e.input.charCodeAt(e.position); i !== 0;) {
		for (; F(i);) i === 9 && e.firstTabInLine === -1 && (e.firstTabInLine = e.position), i = e.input.charCodeAt(++e.position);
		if (t && i === 35) do
			i = e.input.charCodeAt(++e.position);
		while (i !== 10 && i !== 13 && i !== 0);
		if (P(i)) for (Un(e), i = e.input.charCodeAt(e.position), r++, e.lineIndent = 0; i === 32;) e.lineIndent++, i = e.input.charCodeAt(++e.position);
		else break;
	}
	return n !== -1 && r !== 0 && e.lineIndent < n && Bn(e, "deficient indentation"), r;
}
y(H, "skipSeparationSpace");
function Wn(e) {
	var t = e.position, n = e.input.charCodeAt(t);
	return !!((n === 45 || n === 46) && n === e.input.charCodeAt(t + 1) && n === e.input.charCodeAt(t + 2) && (t += 3, n = e.input.charCodeAt(t), n === 0 || I(n)));
}
y(Wn, "testDocumentSeparator");
function Gn(e, t) {
	t === 1 ? e.result += " " : t > 1 && (e.result += A.repeat("\n", t - 1));
}
y(Gn, "writeFoldedLines");
function Kn(e, t, n) {
	var r, i, a, o, s, c, l, u, d = e.kind, f = e.result, p = e.input.charCodeAt(e.position);
	if (I(p) || L(p) || p === 35 || p === 38 || p === 42 || p === 33 || p === 124 || p === 62 || p === 39 || p === 34 || p === 37 || p === 64 || p === 96 || (p === 63 || p === 45) && (i = e.input.charCodeAt(e.position + 1), I(i) || n && L(i))) return !1;
	for (e.kind = "scalar", e.result = "", a = o = e.position, s = !1; p !== 0;) {
		if (p === 58) {
			if (i = e.input.charCodeAt(e.position + 1), I(i) || n && L(i)) break;
		} else if (p === 35) {
			if (r = e.input.charCodeAt(e.position - 1), I(r)) break;
		} else if (e.position === e.lineStart && Wn(e) || n && L(p)) break;
		else if (P(p)) {
			if (c = e.line, l = e.lineStart, u = e.lineIndent, H(e, !1, -1), e.lineIndent >= t) {
				s = !0, p = e.input.charCodeAt(e.position);
				continue;
			}
			e.position = o, e.line = c, e.lineStart = l, e.lineIndent = u;
			break;
		}
		s &&= (B(e, a, o, !1), Gn(e, e.line - c), a = o = e.position, !1), F(p) || (o = e.position + 1), p = e.input.charCodeAt(++e.position);
	}
	return B(e, a, o, !1), e.result ? !0 : (e.kind = d, e.result = f, !1);
}
y(Kn, "readPlainScalar");
function qn(e, t) {
	var n = e.input.charCodeAt(e.position), r, i;
	if (n !== 39) return !1;
	for (e.kind = "scalar", e.result = "", e.position++, r = i = e.position; (n = e.input.charCodeAt(e.position)) !== 0;) if (n === 39) {
		if (B(e, r, e.position, !0), n = e.input.charCodeAt(++e.position), n === 39) r = e.position, e.position++, i = e.position;
		else return !0;
	} else P(n) ? (B(e, r, i, !0), Gn(e, H(e, !1, t)), r = i = e.position) : e.position === e.lineStart && Wn(e) ? z(e, "unexpected end of the document within a single quoted scalar") : (e.position++, i = e.position);
	z(e, "unexpected end of the stream within a single quoted scalar");
}
y(qn, "readSingleQuotedScalar");
function Jn(e, t) {
	var n, r, i, a, o, s = e.input.charCodeAt(e.position);
	if (s !== 34) return !1;
	for (e.kind = "scalar", e.result = "", e.position++, n = r = e.position; (s = e.input.charCodeAt(e.position)) !== 0;) if (s === 34) return B(e, n, e.position, !0), e.position++, !0;
	else if (s === 92) {
		if (B(e, n, e.position, !0), s = e.input.charCodeAt(++e.position), P(s)) H(e, !1, t);
		else if (s < 256 && In[s]) e.result += Ln[s], e.position++;
		else if ((o = jn(s)) > 0) {
			for (i = o, a = 0; i > 0; i--) s = e.input.charCodeAt(++e.position), (o = An(s)) >= 0 ? a = (a << 4) + o : z(e, "expected hexadecimal character");
			e.result += Pn(a), e.position++;
		} else z(e, "unknown escape sequence");
		n = r = e.position;
	} else P(s) ? (B(e, n, r, !0), Gn(e, H(e, !1, t)), n = r = e.position) : e.position === e.lineStart && Wn(e) ? z(e, "unexpected end of the document within a double quoted scalar") : (e.position++, r = e.position);
	z(e, "unexpected end of the stream within a double quoted scalar");
}
y(Jn, "readDoubleQuotedScalar");
function Yn(e, t) {
	var n = !0, r, i, a, o = e.tag, s, c = e.anchor, l, u, d, f, p, m = /* @__PURE__ */ Object.create(null), h, g, _, v = e.input.charCodeAt(e.position);
	if (v === 91) u = 93, p = !1, s = [];
	else if (v === 123) u = 125, p = !0, s = {};
	else return !1;
	for (e.anchor !== null && (e.anchorMap[e.anchor] = s), v = e.input.charCodeAt(++e.position); v !== 0;) {
		if (H(e, !0, t), v = e.input.charCodeAt(e.position), v === u) return e.position++, e.tag = o, e.anchor = c, e.kind = p ? "mapping" : "sequence", e.result = s, !0;
		n ? v === 44 && z(e, "expected the node content, but found ','") : z(e, "missed comma between flow collection entries"), g = h = _ = null, d = f = !1, v === 63 && (l = e.input.charCodeAt(e.position + 1), I(l) && (d = f = !0, e.position++, H(e, !0, t))), r = e.line, i = e.lineStart, a = e.position, U(e, t, _n, !1, !0), g = e.tag, h = e.result, H(e, !0, t), v = e.input.charCodeAt(e.position), (f || e.line === r) && v === 58 && (d = !0, v = e.input.charCodeAt(++e.position), H(e, !0, t), U(e, t, _n, !1, !0), _ = e.result), p ? V(e, s, m, g, h, _, r, i, a) : d ? s.push(V(e, null, m, g, h, _, r, i, a)) : s.push(h), H(e, !0, t), v = e.input.charCodeAt(e.position), v === 44 ? (n = !0, v = e.input.charCodeAt(++e.position)) : n = !1;
	}
	z(e, "unexpected end of the stream within a flow collection");
}
y(Yn, "readFlowCollection");
function Xn(e, t) {
	var n, r, i = xn, a = !1, o = !1, s = t, c = 0, l = !1, u, d = e.input.charCodeAt(e.position);
	if (d === 124) r = !1;
	else if (d === 62) r = !0;
	else return !1;
	for (e.kind = "scalar", e.result = ""; d !== 0;) if (d = e.input.charCodeAt(++e.position), d === 43 || d === 45) xn === i ? i = d === 43 ? Cn : Sn : z(e, "repeat of a chomping mode identifier");
	else if ((u = Mn(d)) >= 0) u === 0 ? z(e, "bad explicit indentation width of a block scalar; it cannot be less than one") : o ? z(e, "repeat of an indentation width identifier") : (s = t + u - 1, o = !0);
	else break;
	if (F(d)) {
		do
			d = e.input.charCodeAt(++e.position);
		while (F(d));
		if (d === 35) do
			d = e.input.charCodeAt(++e.position);
		while (!P(d) && d !== 0);
	}
	for (; d !== 0;) {
		for (Un(e), e.lineIndent = 0, d = e.input.charCodeAt(e.position); (!o || e.lineIndent < s) && d === 32;) e.lineIndent++, d = e.input.charCodeAt(++e.position);
		if (!o && e.lineIndent > s && (s = e.lineIndent), P(d)) c++;
		else {
			if (e.lineIndent < s) {
				i === Cn ? e.result += A.repeat("\n", a ? 1 + c : c) : i === xn && a && (e.result += "\n");
				break;
			}
			for (r ? F(d) ? (l = !0, e.result += A.repeat("\n", a ? 1 + c : c)) : l ? (l = !1, e.result += A.repeat("\n", c + 1)) : c === 0 ? a && (e.result += " ") : e.result += A.repeat("\n", c) : e.result += A.repeat("\n", a ? 1 + c : c), a = !0, o = !0, c = 0, n = e.position; !P(d) && d !== 0;) d = e.input.charCodeAt(++e.position);
			B(e, n, e.position, !1);
		}
	}
	return !0;
}
y(Xn, "readBlockScalar");
function Zn(e, t) {
	var n, r = e.tag, i = e.anchor, a = [], o, s = !1, c;
	if (e.firstTabInLine !== -1) return !1;
	for (e.anchor !== null && (e.anchorMap[e.anchor] = a), c = e.input.charCodeAt(e.position); c !== 0 && (e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, z(e, "tab characters must not be used in indentation")), !(c !== 45 || (o = e.input.charCodeAt(e.position + 1), !I(o))));) if (s = !0, e.position++, H(e, !0, -1) && e.lineIndent <= t) a.push(null), c = e.input.charCodeAt(e.position);
	else if (n = e.line, U(e, t, yn, !1, !0), a.push(e.result), H(e, !0, -1), c = e.input.charCodeAt(e.position), (e.line === n || e.lineIndent > t) && c !== 0) z(e, "bad indentation of a sequence entry");
	else if (e.lineIndent < t) break;
	return s ? (e.tag = r, e.anchor = i, e.kind = "sequence", e.result = a, !0) : !1;
}
y(Zn, "readBlockSequence");
function Qn(e, t, n) {
	var r, i, a, o, s, c, l = e.tag, u = e.anchor, d = {}, f = /* @__PURE__ */ Object.create(null), p = null, m = null, h = null, g = !1, _ = !1, v;
	if (e.firstTabInLine !== -1) return !1;
	for (e.anchor !== null && (e.anchorMap[e.anchor] = d), v = e.input.charCodeAt(e.position); v !== 0;) {
		if (!g && e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, z(e, "tab characters must not be used in indentation")), r = e.input.charCodeAt(e.position + 1), a = e.line, (v === 63 || v === 58) && I(r)) v === 63 ? (g && (V(e, d, f, p, m, null, o, s, c), p = m = h = null), _ = !0, g = !0, i = !0) : g ? (g = !1, i = !0) : z(e, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"), e.position += 1, v = r;
		else {
			if (o = e.line, s = e.lineStart, c = e.position, !U(e, n, vn, !1, !0)) break;
			if (e.line === a) {
				for (v = e.input.charCodeAt(e.position); F(v);) v = e.input.charCodeAt(++e.position);
				if (v === 58) v = e.input.charCodeAt(++e.position), I(v) || z(e, "a whitespace character is expected after the key-value separator within a block mapping"), g && (V(e, d, f, p, m, null, o, s, c), p = m = h = null), _ = !0, g = !1, i = !1, p = e.tag, m = e.result;
				else if (_) z(e, "can not read an implicit mapping pair; a colon is missed");
				else return e.tag = l, e.anchor = u, !0;
			} else if (_) z(e, "can not read a block mapping entry; a multiline key may not be an implicit key");
			else return e.tag = l, e.anchor = u, !0;
		}
		if ((e.line === a || e.lineIndent > t) && (g && (o = e.line, s = e.lineStart, c = e.position), U(e, t, bn, !0, i) && (g ? m = e.result : h = e.result), g || (V(e, d, f, p, m, h, o, s, c), p = m = h = null), H(e, !0, -1), v = e.input.charCodeAt(e.position)), (e.line === a || e.lineIndent > t) && v !== 0) z(e, "bad indentation of a mapping entry");
		else if (e.lineIndent < t) break;
	}
	return g && V(e, d, f, p, m, null, o, s, c), _ && (e.tag = l, e.anchor = u, e.kind = "mapping", e.result = d), _;
}
y(Qn, "readBlockMapping");
function $n(e) {
	var t, n = !1, r = !1, i, a, o = e.input.charCodeAt(e.position);
	if (o !== 33) return !1;
	if (e.tag !== null && z(e, "duplication of a tag property"), o = e.input.charCodeAt(++e.position), o === 60 ? (n = !0, o = e.input.charCodeAt(++e.position)) : o === 33 ? (r = !0, i = "!!", o = e.input.charCodeAt(++e.position)) : i = "!", t = e.position, n) {
		do
			o = e.input.charCodeAt(++e.position);
		while (o !== 0 && o !== 62);
		e.position < e.length ? (a = e.input.slice(t, e.position), o = e.input.charCodeAt(++e.position)) : z(e, "unexpected end of the stream within a verbatim tag");
	} else {
		for (; o !== 0 && !I(o);) o === 33 && (r ? z(e, "tag suffix cannot contain exclamation marks") : (i = e.input.slice(t - 1, e.position + 1), Dn.test(i) || z(e, "named tag handle cannot contain such characters"), r = !0, t = e.position + 1)), o = e.input.charCodeAt(++e.position);
		a = e.input.slice(t, e.position), En.test(a) && z(e, "tag suffix cannot contain flow indicator characters");
	}
	a && !On.test(a) && z(e, "tag name cannot contain such characters: " + a);
	try {
		a = decodeURIComponent(a);
	} catch {
		z(e, "tag name is malformed: " + a);
	}
	return n ? e.tag = a : N.call(e.tagMap, i) ? e.tag = e.tagMap[i] + a : i === "!" ? e.tag = "!" + a : i === "!!" ? e.tag = "tag:yaml.org,2002:" + a : z(e, "undeclared tag handle \"" + i + "\""), !0;
}
y($n, "readTagProperty");
function er(e) {
	var t, n = e.input.charCodeAt(e.position);
	if (n !== 38) return !1;
	for (e.anchor !== null && z(e, "duplication of an anchor property"), n = e.input.charCodeAt(++e.position), t = e.position; n !== 0 && !I(n) && !L(n);) n = e.input.charCodeAt(++e.position);
	return e.position === t && z(e, "name of an anchor node must contain at least one character"), e.anchor = e.input.slice(t, e.position), !0;
}
y(er, "readAnchorProperty");
function tr(e) {
	var t, n, r = e.input.charCodeAt(e.position);
	if (r !== 42) return !1;
	for (r = e.input.charCodeAt(++e.position), t = e.position; r !== 0 && !I(r) && !L(r);) r = e.input.charCodeAt(++e.position);
	return e.position === t && z(e, "name of an alias node must contain at least one character"), n = e.input.slice(t, e.position), N.call(e.anchorMap, n) || z(e, "unidentified alias \"" + n + "\""), e.result = e.anchorMap[n], H(e, !0, -1), !0;
}
y(tr, "readAlias");
function U(e, t, n, r, i) {
	var a, o, s, c = 1, l = !1, u = !1, d, f, p, m, h, g;
	if (e.listener !== null && e.listener("open", e), e.tag = null, e.anchor = null, e.kind = null, e.result = null, a = o = s = bn === n || yn === n, r && H(e, !0, -1) && (l = !0, e.lineIndent > t ? c = 1 : e.lineIndent === t ? c = 0 : e.lineIndent < t && (c = -1)), c === 1) for (; $n(e) || er(e);) H(e, !0, -1) ? (l = !0, s = a, e.lineIndent > t ? c = 1 : e.lineIndent === t ? c = 0 : e.lineIndent < t && (c = -1)) : s = !1;
	if (s &&= l || i, (c === 1 || bn === n) && (h = _n === n || vn === n ? t : t + 1, g = e.position - e.lineStart, c === 1 ? s && (Zn(e, g) || Qn(e, g, h)) || Yn(e, h) ? u = !0 : (o && Xn(e, h) || qn(e, h) || Jn(e, h) ? u = !0 : tr(e) ? (u = !0, (e.tag !== null || e.anchor !== null) && z(e, "alias node should not have any properties")) : Kn(e, h, _n === n) && (u = !0, e.tag === null && (e.tag = "?")), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : c === 0 && (u = s && Zn(e, g))), e.tag === null) e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
	else if (e.tag === "?") {
		for (e.result !== null && e.kind !== "scalar" && z(e, "unacceptable node kind for !<?> tag; it should be \"scalar\", not \"" + e.kind + "\""), d = 0, f = e.implicitTypes.length; d < f; d += 1) if (m = e.implicitTypes[d], m.resolve(e.result)) {
			e.result = m.construct(e.result), e.tag = m.tag, e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
			break;
		}
	} else if (e.tag !== "!") {
		if (N.call(e.typeMap[e.kind || "fallback"], e.tag)) m = e.typeMap[e.kind || "fallback"][e.tag];
		else for (m = null, p = e.typeMap.multi[e.kind || "fallback"], d = 0, f = p.length; d < f; d += 1) if (e.tag.slice(0, p[d].tag.length) === p[d].tag) {
			m = p[d];
			break;
		}
		m || z(e, "unknown tag !<" + e.tag + ">"), e.result !== null && m.kind !== e.kind && z(e, "unacceptable node kind for !<" + e.tag + "> tag; it should be \"" + m.kind + "\", not \"" + e.kind + "\""), m.resolve(e.result, e.tag) ? (e.result = m.construct(e.result, e.tag), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : z(e, "cannot resolve a node with !<" + e.tag + "> explicit tag");
	}
	return e.listener !== null && e.listener("close", e), e.tag !== null || e.anchor !== null || u;
}
y(U, "composeNode");
function nr(e) {
	var t = e.position, n, r, i, a = !1, o;
	for (e.version = null, e.checkLineBreaks = e.legacy, e.tagMap = /* @__PURE__ */ Object.create(null), e.anchorMap = /* @__PURE__ */ Object.create(null); (o = e.input.charCodeAt(e.position)) !== 0 && (H(e, !0, -1), o = e.input.charCodeAt(e.position), !(e.lineIndent > 0 || o !== 37));) {
		for (a = !0, o = e.input.charCodeAt(++e.position), n = e.position; o !== 0 && !I(o);) o = e.input.charCodeAt(++e.position);
		for (r = e.input.slice(n, e.position), i = [], r.length < 1 && z(e, "directive name must not be less than one character in length"); o !== 0;) {
			for (; F(o);) o = e.input.charCodeAt(++e.position);
			if (o === 35) {
				do
					o = e.input.charCodeAt(++e.position);
				while (o !== 0 && !P(o));
				break;
			}
			if (P(o)) break;
			for (n = e.position; o !== 0 && !I(o);) o = e.input.charCodeAt(++e.position);
			i.push(e.input.slice(n, e.position));
		}
		o !== 0 && Un(e), N.call(Vn, r) ? Vn[r](e, r, i) : Bn(e, "unknown document directive \"" + r + "\"");
	}
	if (H(e, !0, -1), e.lineIndent === 0 && e.input.charCodeAt(e.position) === 45 && e.input.charCodeAt(e.position + 1) === 45 && e.input.charCodeAt(e.position + 2) === 45 ? (e.position += 3, H(e, !0, -1)) : a && z(e, "directives end mark is expected"), U(e, e.lineIndent - 1, bn, !1, !0), H(e, !0, -1), e.checkLineBreaks && Tn.test(e.input.slice(t, e.position)) && Bn(e, "non-ASCII line breaks are interpreted as content"), e.documents.push(e.result), e.position === e.lineStart && Wn(e)) e.input.charCodeAt(e.position) === 46 && (e.position += 3, H(e, !0, -1));
	else if (e.position < e.length - 1) z(e, "end of the stream or a document separator is expected");
	else return;
}
y(nr, "readDocument");
function rr(e, t) {
	e = String(e), t ||= {}, e.length !== 0 && (e.charCodeAt(e.length - 1) !== 10 && e.charCodeAt(e.length - 1) !== 13 && (e += "\n"), e.charCodeAt(0) === 65279 && (e = e.slice(1)));
	var n = new Rn(e, t), r = e.indexOf("\0");
	for (r !== -1 && (n.position = r, z(n, "null byte is not allowed in input")), n.input += "\0"; n.input.charCodeAt(n.position) === 32;) n.lineIndent += 1, n.position += 1;
	for (; n.position < n.length - 1;) nr(n);
	return n.documents;
}
y(rr, "loadDocuments");
function ir(e, t, n) {
	typeof t == "object" && t && n === void 0 && (n = t, t = null);
	var r = rr(e, n);
	if (typeof t != "function") return r;
	for (var i = 0, a = r.length; i < a; i += 1) t(r[i]);
}
y(ir, "loadAll$1");
function ar(e, t) {
	var n = rr(e, t);
	if (n.length !== 0) {
		if (n.length === 1) return n[0];
		throw new j("expected a single document in the stream, but found more");
	}
}
y(ar, "load$1");
var or = {
	loadAll: ir,
	load: ar
}, sr = Object.prototype.toString, cr = Object.prototype.hasOwnProperty, lr = 65279, ur = 9, dr = 10, fr = 13, pr = 32, mr = 33, hr = 34, gr = 35, _r = 37, vr = 38, yr = 39, br = 42, xr = 44, Sr = 45, Cr = 58, wr = 61, Tr = 62, Er = 63, Dr = 64, Or = 91, kr = 93, Ar = 96, jr = 123, Mr = 124, Nr = 125, W = {};
W[0] = "\\0", W[7] = "\\a", W[8] = "\\b", W[9] = "\\t", W[10] = "\\n", W[11] = "\\v", W[12] = "\\f", W[13] = "\\r", W[27] = "\\e", W[34] = "\\\"", W[92] = "\\\\", W[133] = "\\N", W[160] = "\\_", W[8232] = "\\L", W[8233] = "\\P";
var Pr = [
	"y",
	"Y",
	"yes",
	"Yes",
	"YES",
	"on",
	"On",
	"ON",
	"n",
	"N",
	"no",
	"No",
	"NO",
	"off",
	"Off",
	"OFF"
], Fr = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function Ir(e, t) {
	var n, r, i, a, o, s, c;
	if (t === null) return {};
	for (n = {}, r = Object.keys(t), i = 0, a = r.length; i < a; i += 1) o = r[i], s = String(t[o]), o.slice(0, 2) === "!!" && (o = "tag:yaml.org,2002:" + o.slice(2)), c = e.compiledTypeMap.fallback[o], c && cr.call(c.styleAliases, s) && (s = c.styleAliases[s]), n[o] = s;
	return n;
}
y(Ir, "compileStyleMap");
function Lr(e) {
	var t = e.toString(16).toUpperCase(), n, r;
	if (e <= 255) n = "x", r = 2;
	else if (e <= 65535) n = "u", r = 4;
	else if (e <= 4294967295) n = "U", r = 8;
	else throw new j("code point within a string may not be greater than 0xFFFFFFFF");
	return "\\" + n + A.repeat("0", r - t.length) + t;
}
y(Lr, "encodeHex");
var Rr = 1, zr = 2;
function Br(e) {
	this.schema = e.schema || gn, this.indent = Math.max(1, e.indent || 2), this.noArrayIndent = e.noArrayIndent || !1, this.skipInvalid = e.skipInvalid || !1, this.flowLevel = A.isNothing(e.flowLevel) ? -1 : e.flowLevel, this.styleMap = Ir(this.schema, e.styles || null), this.sortKeys = e.sortKeys || !1, this.lineWidth = e.lineWidth || 80, this.noRefs = e.noRefs || !1, this.noCompatMode = e.noCompatMode || !1, this.condenseFlow = e.condenseFlow || !1, this.quotingType = e.quotingType === "\"" ? zr : Rr, this.forceQuotes = e.forceQuotes || !1, this.replacer = typeof e.replacer == "function" ? e.replacer : null, this.implicitTypes = this.schema.compiledImplicit, this.explicitTypes = this.schema.compiledExplicit, this.tag = null, this.result = "", this.duplicates = [], this.usedDuplicates = null;
}
y(Br, "State");
function Vr(e, t) {
	for (var n = A.repeat(" ", t), r = 0, i = -1, a = "", o, s = e.length; r < s;) i = e.indexOf("\n", r), i === -1 ? (o = e.slice(r), r = s) : (o = e.slice(r, i + 1), r = i + 1), o.length && o !== "\n" && (a += n), a += o;
	return a;
}
y(Vr, "indentString");
function Hr(e, t) {
	return "\n" + A.repeat(" ", e.indent * t);
}
y(Hr, "generateNextLine");
function Ur(e, t) {
	for (var n = 0, r = e.implicitTypes.length, i; n < r; n += 1) if (i = e.implicitTypes[n], i.resolve(t)) return !0;
	return !1;
}
y(Ur, "testImplicitResolving");
function Wr(e) {
	return e === pr || e === ur;
}
y(Wr, "isWhitespace");
function Gr(e) {
	return 32 <= e && e <= 126 || 161 <= e && e <= 55295 && e !== 8232 && e !== 8233 || 57344 <= e && e <= 65533 && e !== lr || 65536 <= e && e <= 1114111;
}
y(Gr, "isPrintable");
function Kr(e) {
	return Gr(e) && e !== lr && e !== fr && e !== dr;
}
y(Kr, "isNsCharOrWhitespace");
function qr(e, t, n) {
	var r = Kr(e), i = r && !Wr(e);
	return (n ? r : r && e !== xr && e !== Or && e !== kr && e !== jr && e !== Nr) && e !== gr && !(t === Cr && !i) || Kr(t) && !Wr(t) && e === gr || t === Cr && i;
}
y(qr, "isPlainSafe");
function Jr(e) {
	return Gr(e) && e !== lr && !Wr(e) && e !== Sr && e !== Er && e !== Cr && e !== xr && e !== Or && e !== kr && e !== jr && e !== Nr && e !== gr && e !== vr && e !== br && e !== mr && e !== Mr && e !== wr && e !== Tr && e !== yr && e !== hr && e !== _r && e !== Dr && e !== Ar;
}
y(Jr, "isPlainSafeFirst");
function Yr(e) {
	return !Wr(e) && e !== Cr;
}
y(Yr, "isPlainSafeLast");
function G(e, t) {
	var n = e.charCodeAt(t), r;
	return n >= 55296 && n <= 56319 && t + 1 < e.length && (r = e.charCodeAt(t + 1), r >= 56320 && r <= 57343) ? (n - 55296) * 1024 + r - 56320 + 65536 : n;
}
y(G, "codePointAt");
function Xr(e) {
	return /^\n* /.test(e);
}
y(Xr, "needIndentIndicator");
var Zr = 1, Qr = 2, $r = 3, ei = 4, ti = 5;
function ni(e, t, n, r, i, a, o, s) {
	var c, l = 0, u = null, d = !1, f = !1, p = r !== -1, m = -1, h = Jr(G(e, 0)) && Yr(G(e, e.length - 1));
	if (t || o) for (c = 0; c < e.length; l >= 65536 ? c += 2 : c++) {
		if (l = G(e, c), !Gr(l)) return ti;
		h &&= qr(l, u, s), u = l;
	}
	else {
		for (c = 0; c < e.length; l >= 65536 ? c += 2 : c++) {
			if (l = G(e, c), l === dr) d = !0, p && (f ||= c - m - 1 > r && e[m + 1] !== " ", m = c);
			else if (!Gr(l)) return ti;
			h &&= qr(l, u, s), u = l;
		}
		f ||= p && c - m - 1 > r && e[m + 1] !== " ";
	}
	return !d && !f ? h && !o && !i(e) ? Zr : a === zr ? ti : Qr : n > 9 && Xr(e) ? ti : o ? a === zr ? ti : Qr : f ? ei : $r;
}
y(ni, "chooseScalarStyle");
function ri(e, t, n, r, i) {
	e.dump = (function() {
		if (t.length === 0) return e.quotingType === zr ? "\"\"" : "''";
		if (!e.noCompatMode && (Pr.indexOf(t) !== -1 || Fr.test(t))) return e.quotingType === zr ? "\"" + t + "\"" : "'" + t + "'";
		var a = e.indent * Math.max(1, n), o = e.lineWidth === -1 ? -1 : Math.max(Math.min(e.lineWidth, 40), e.lineWidth - a), s = r || e.flowLevel > -1 && n >= e.flowLevel;
		function c(t) {
			return Ur(e, t);
		}
		switch (y(c, "testAmbiguity"), ni(t, s, e.indent, o, c, e.quotingType, e.forceQuotes && !r, i)) {
			case Zr: return t;
			case Qr: return "'" + t.replace(/'/g, "''") + "'";
			case $r: return "|" + ii(t, e.indent) + ai(Vr(t, a));
			case ei: return ">" + ii(t, e.indent) + ai(Vr(oi(t, o), a));
			case ti: return "\"" + ci(t) + "\"";
			default: throw new j("impossible error: invalid scalar style");
		}
	})();
}
y(ri, "writeScalar");
function ii(e, t) {
	var n = Xr(e) ? String(t) : "", r = e[e.length - 1] === "\n";
	return n + (r && (e[e.length - 2] === "\n" || e === "\n") ? "+" : r ? "" : "-") + "\n";
}
y(ii, "blockHeader");
function ai(e) {
	return e[e.length - 1] === "\n" ? e.slice(0, -1) : e;
}
y(ai, "dropEndingNewline");
function oi(e, t) {
	for (var n = /(\n+)([^\n]*)/g, r = (function() {
		var r = e.indexOf("\n");
		return r = r === -1 ? e.length : r, n.lastIndex = r, si(e.slice(0, r), t);
	})(), i = e[0] === "\n" || e[0] === " ", a, o; o = n.exec(e);) {
		var s = o[1], c = o[2];
		a = c[0] === " ", r += s + (!i && !a && c !== "" ? "\n" : "") + si(c, t), i = a;
	}
	return r;
}
y(oi, "foldString");
function si(e, t) {
	if (e === "" || e[0] === " ") return e;
	for (var n = / [^ ]/g, r, i = 0, a, o = 0, s = 0, c = ""; r = n.exec(e);) s = r.index, s - i > t && (a = o > i ? o : s, c += "\n" + e.slice(i, a), i = a + 1), o = s;
	return c += "\n", e.length - i > t && o > i ? c += e.slice(i, o) + "\n" + e.slice(o + 1) : c += e.slice(i), c.slice(1);
}
y(si, "foldLine");
function ci(e) {
	for (var t = "", n = 0, r, i = 0; i < e.length; n >= 65536 ? i += 2 : i++) n = G(e, i), r = W[n], !r && Gr(n) ? (t += e[i], n >= 65536 && (t += e[i + 1])) : t += r || Lr(n);
	return t;
}
y(ci, "escapeString");
function li(e, t, n) {
	for (var r = "", i = e.tag, a = 0, o = n.length, s; a < o; a += 1) s = n[a], e.replacer && (s = e.replacer.call(n, String(a), s)), (K(e, t, s, !1, !1) || s === void 0 && K(e, t, null, !1, !1)) && (r !== "" && (r += "," + (e.condenseFlow ? "" : " ")), r += e.dump);
	e.tag = i, e.dump = "[" + r + "]";
}
y(li, "writeFlowSequence");
function ui(e, t, n, r) {
	for (var i = "", a = e.tag, o = 0, s = n.length, c; o < s; o += 1) c = n[o], e.replacer && (c = e.replacer.call(n, String(o), c)), (K(e, t + 1, c, !0, !0, !1, !0) || c === void 0 && K(e, t + 1, null, !0, !0, !1, !0)) && (r && i === "" || (i += Hr(e, t)), e.dump && dr === e.dump.charCodeAt(0) ? i += "-" : i += "- ", i += e.dump);
	e.tag = a, e.dump = i || "[]";
}
y(ui, "writeBlockSequence");
function di(e, t, n) {
	for (var r = "", i = e.tag, a = Object.keys(n), o = 0, s = a.length, c, l, u; o < s; o += 1) u = "", r !== "" && (u += ", "), e.condenseFlow && (u += "\""), c = a[o], l = n[c], e.replacer && (l = e.replacer.call(n, c, l)), K(e, t, c, !1, !1) && (e.dump.length > 1024 && (u += "? "), u += e.dump + (e.condenseFlow ? "\"" : "") + ":" + (e.condenseFlow ? "" : " "), K(e, t, l, !1, !1) && (u += e.dump, r += u));
	e.tag = i, e.dump = "{" + r + "}";
}
y(di, "writeFlowMapping");
function fi(e, t, n, r) {
	var i = "", a = e.tag, o = Object.keys(n), s, c, l, u, d, f;
	if (e.sortKeys === !0) o.sort();
	else if (typeof e.sortKeys == "function") o.sort(e.sortKeys);
	else if (e.sortKeys) throw new j("sortKeys must be a boolean or a function");
	for (s = 0, c = o.length; s < c; s += 1) f = "", r && i === "" || (f += Hr(e, t)), l = o[s], u = n[l], e.replacer && (u = e.replacer.call(n, l, u)), K(e, t + 1, l, !0, !0, !0) && (d = e.tag !== null && e.tag !== "?" || e.dump && e.dump.length > 1024, d && (e.dump && dr === e.dump.charCodeAt(0) ? f += "?" : f += "? "), f += e.dump, d && (f += Hr(e, t)), K(e, t + 1, u, !0, d) && (e.dump && dr === e.dump.charCodeAt(0) ? f += ":" : f += ": ", f += e.dump, i += f));
	e.tag = a, e.dump = i || "{}";
}
y(fi, "writeBlockMapping");
function pi(e, t, n) {
	for (var r, i = n ? e.explicitTypes : e.implicitTypes, a = 0, o = i.length, s, c; a < o; a += 1) if (s = i[a], (s.instanceOf || s.predicate) && (!s.instanceOf || typeof t == "object" && t instanceof s.instanceOf) && (!s.predicate || s.predicate(t))) {
		if (e.tag = n ? s.multi && s.representName ? s.representName(t) : s.tag : "?", s.represent) {
			if (c = e.styleMap[s.tag] || s.defaultStyle, sr.call(s.represent) === "[object Function]") r = s.represent(t, c);
			else if (cr.call(s.represent, c)) r = s.represent[c](t, c);
			else throw new j("!<" + s.tag + "> tag resolver accepts not \"" + c + "\" style");
			e.dump = r;
		}
		return !0;
	}
	return !1;
}
y(pi, "detectType");
function K(e, t, n, r, i, a, o) {
	e.tag = null, e.dump = n, pi(e, n, !1) || pi(e, n, !0);
	var s = sr.call(e.dump), c = r, l;
	r &&= e.flowLevel < 0 || e.flowLevel > t;
	var u = s === "[object Object]" || s === "[object Array]", d, f;
	if (u && (d = e.duplicates.indexOf(n), f = d !== -1), (e.tag !== null && e.tag !== "?" || f || e.indent !== 2 && t > 0) && (i = !1), f && e.usedDuplicates[d]) e.dump = "*ref_" + d;
	else {
		if (u && f && !e.usedDuplicates[d] && (e.usedDuplicates[d] = !0), s === "[object Object]") r && Object.keys(e.dump).length !== 0 ? (fi(e, t, e.dump, i), f && (e.dump = "&ref_" + d + e.dump)) : (di(e, t, e.dump), f && (e.dump = "&ref_" + d + " " + e.dump));
		else if (s === "[object Array]") r && e.dump.length !== 0 ? (e.noArrayIndent && !o && t > 0 ? ui(e, t - 1, e.dump, i) : ui(e, t, e.dump, i), f && (e.dump = "&ref_" + d + e.dump)) : (li(e, t, e.dump), f && (e.dump = "&ref_" + d + " " + e.dump));
		else if (s === "[object String]") e.tag !== "?" && ri(e, e.dump, t, a, c);
		else if (s === "[object Undefined]") return !1;
		else {
			if (e.skipInvalid) return !1;
			throw new j("unacceptable kind of an object to dump " + s);
		}
		e.tag !== null && e.tag !== "?" && (l = encodeURI(e.tag[0] === "!" ? e.tag.slice(1) : e.tag).replace(/!/g, "%21"), l = e.tag[0] === "!" ? "!" + l : l.slice(0, 18) === "tag:yaml.org,2002:" ? "!!" + l.slice(18) : "!<" + l + ">", e.dump = l + " " + e.dump);
	}
	return !0;
}
y(K, "writeNode");
function mi(e, t) {
	var n = [], r = [], i, a;
	for (hi(e, n, r), i = 0, a = r.length; i < a; i += 1) t.duplicates.push(n[r[i]]);
	t.usedDuplicates = Array(a);
}
y(mi, "getDuplicateReferences");
function hi(e, t, n) {
	var r, i, a;
	if (typeof e == "object" && e) {
		if (i = t.indexOf(e), i !== -1) n.indexOf(i) === -1 && n.push(i);
		else if (t.push(e), Array.isArray(e)) for (i = 0, a = e.length; i < a; i += 1) hi(e[i], t, n);
		else for (r = Object.keys(e), i = 0, a = r.length; i < a; i += 1) hi(e[r[i]], t, n);
	}
}
y(hi, "inspectNode");
function gi(e, t) {
	t ||= {};
	var n = new Br(t);
	n.noRefs || mi(e, n);
	var r = e;
	return n.replacer && (r = n.replacer.call({ "": r }, "", r)), K(n, 0, r, !0, !0) ? n.dump + "\n" : "";
}
y(gi, "dump$1");
var _i = { dump: gi };
function vi(e, t) {
	return function() {
		throw Error("Function yaml." + e + " is removed in js-yaml 4. Use yaml." + t + " instead, which is now safe by default.");
	};
}
y(vi, "renamed");
var yi = Bt, bi = or.load;
or.loadAll, _i.dump;
// packages/ui/src/components/mermaid-renderer/mermaid-zoom.ts
var xi = .5, Si = .25, Ci = (e) => Number(Math.min(3, Math.max(xi, e)).toFixed(2)), wi = (e) => Ci(e + Si), Ti = (e) => Ci(e - Si), Ei = (e) => {
	if (!e) return 0;
	let t = Number.parseFloat(e);
	return Number.isFinite(t) ? t : 0;
}, Di = (e, t) => e.match(RegExp(`\\s${t}="([^"]+)"`))?.[1], Oi = (e) => {
	let t = Di(e, "viewBox")?.split(/\s+/).map(Number) ?? [], n = t[2] ?? 0, r = t[3] ?? 0;
	return n > 0 && r > 0 ? {
		width: n,
		height: r
	} : {
		width: Math.max(Ei(Di(e, "width")), 1),
		height: Math.max(Ei(Di(e, "height")), 1)
	};
}, ki = (e) => e.replace(/<br(\s[^>]*)?>/g, "<br$1/>"), Ai = (e) => {
	let { width: t, height: n } = Oi(e);
	return ki(e.replace(/<svg\b[^>]*>/, (e) => {
		let r = /\swidth=/.test(e) ? e.replace(/\swidth="[^"]*"/, ` width="${t}"`) : e.replace("<svg", `<svg width="${t}"`);
		return /\sheight=/.test(r) ? r.replace(/\sheight="[^"]*"/, ` height="${n}"`) : r.replace("<svg", `<svg height="${n}"`);
	}));
}, ji = (e) => {
	let t = new TextEncoder().encode(Ai(e)), n = "";
	for (let e of t) n += String.fromCharCode(e);
	return `data:image/svg+xml;base64,${btoa(n)}`;
}, Mi = (e) => new Promise((t, n) => {
	let r = new Image();
	r.style.position = "fixed", r.style.left = "-10000px", r.style.top = "0", r.style.pointerEvents = "none", r.onload = () => t({
		image: r,
		cleanup: () => r.remove()
	}), r.onerror = () => {
		r.remove(), n(/* @__PURE__ */ Error("Failed to load rendered Mermaid SVG for PNG export."));
	}, document.body.append(r), r.src = e;
}), Ni = (e) => new Promise((t, n) => {
	e.toBlob((e) => {
		e ? t(e) : n(/* @__PURE__ */ Error("Failed to encode Mermaid diagram as PNG."));
	}, "image/png");
}), Pi = (e, t) => {
	let n = URL.createObjectURL(e), r = document.createElement("a");
	r.href = n, r.download = t, document.body.append(r), r.click(), r.remove(), window.setTimeout(() => URL.revokeObjectURL(n), 0);
}, Fi = async (e) => {
	let { svg: t, zoom: n, filename: r = "mermaid-diagram.png" } = e, { image: i, cleanup: a } = await Mi(ji(t));
	try {
		let { width: e, height: a } = Oi(t), o = Ci(n), s = document.createElement("canvas");
		s.width = Math.ceil(e * o), s.height = Math.ceil(a * o);
		let c = s.getContext("2d");
		if (!c) throw Error("Canvas rendering is unavailable for Mermaid PNG export.");
		c.scale(o, o), c.drawImage(i, 0, 0, e, a), Pi(await Ni(s), r);
	} finally {
		a();
	}
}, Ii = (e) => {
	let { code: t, error: n } = e;
	return /* @__PURE__ */ k(E, {
		role: "alert",
		borderRadius: "sm",
		bg: "bg.panel",
		p: "sm",
		children: [
			/* @__PURE__ */ O(Ue, {
				color: "fg.error",
				textStyle: "label/S/medium",
				children: "Mermaid parse failed"
			}),
			/* @__PURE__ */ O(Ue, {
				color: "fg.muted",
				textStyle: "label/S/regular",
				mt: "2xs",
				whiteSpace: "pre-wrap",
				children: n
			}),
			/* @__PURE__ */ O(Me, {
				mt: "sm",
				borderRadius: "sm",
				bg: "bg.muted",
				showHorizontalScrollbar: !0,
				showVerticalScrollbar: !1,
				contentProps: { p: "sm" },
				children: /* @__PURE__ */ O(E, {
					as: "pre",
					m: "0",
					fontSize: "sm",
					children: t
				})
			})
		]
	});
}, Li = (e) => {
	let { children: t, canDownload: n, open: r, onClose: i, onDownload: a } = e;
	return /* @__PURE__ */ O(D.Root, {
		lazyMount: !0,
		unmountOnExit: !0,
		open: r,
		onOpenChange: (e) => !e.open && i(),
		children: /* @__PURE__ */ k(Ve, { children: [/* @__PURE__ */ O(D.Backdrop, {}), /* @__PURE__ */ O(D.Positioner, {
			padding: {
				base: "sm",
				md: "lg"
			},
			children: /* @__PURE__ */ k(D.Content, {
				width: "min(72rem, calc(100vw - 2rem))",
				height: "min(48rem, calc(100dvh - 2rem))",
				maxW: "none",
				borderRadius: "xs",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				children: [/* @__PURE__ */ O(D.Header, {
					"data-testid": "mermaid-fullscreen-header",
					p: "sm",
					borderBottomWidth: "1px",
					borderColor: "border.subtle",
					children: /* @__PURE__ */ k(He, {
						direction: "row",
						align: "center",
						justify: "space-between",
						width: "100%",
						gap: "sm",
						children: [/* @__PURE__ */ O(D.Title, {
							asChild: !0,
							children: /* @__PURE__ */ O(Ue, {
								textStyle: "heading/S",
								children: "Mermaid diagram"
							})
						}), /* @__PURE__ */ k(He, {
							direction: "row",
							align: "center",
							gap: "xs",
							children: [/* @__PURE__ */ k(Re, {
								size: "sm",
								variant: "subtle",
								onClick: a,
								disabled: !n,
								children: [/* @__PURE__ */ O(ze, {
									as: p,
									boxSize: "16px"
								}), "Download as PNG"]
							}), /* @__PURE__ */ O(Be, {
								"aria-label": "Close",
								size: "sm",
								variant: "ghost",
								onClick: i,
								children: /* @__PURE__ */ O(ze, {
									as: v,
									boxSize: "16px"
								})
							})]
						})]
					})
				}), /* @__PURE__ */ O(D.Body, {
					"data-testid": "mermaid-fullscreen-body",
					p: "0",
					flex: "1",
					minH: "0",
					children: t
				})]
			})
		})] })
	});
}, Ri = (e) => {
	let { isEditable: t, onRequestEdit: n, onOpenFullscreen: r } = e;
	return /* @__PURE__ */ k(He, {
		"data-testid": "mermaid-inline-toolbar",
		direction: "row",
		justify: "flex-end",
		align: "center",
		gap: "xs",
		position: "absolute",
		top: "sm",
		right: "sm",
		zIndex: "1",
		onPointerDown: (e) => e.stopPropagation(),
		children: [t && n ? /* @__PURE__ */ O(Ne, {
			content: "Edit source",
			children: /* @__PURE__ */ O(Be, {
				"aria-label": "Edit",
				size: "xs",
				variant: "subtle",
				onClick: n,
				children: /* @__PURE__ */ O(ze, {
					as: g,
					boxSize: "14px"
				})
			})
		}) : null, /* @__PURE__ */ O(Ne, {
			content: "Open diagram",
			children: /* @__PURE__ */ O(Be, {
				"aria-label": "Open diagram",
				size: "xs",
				variant: "subtle",
				onClick: r,
				children: /* @__PURE__ */ O(ze, {
					as: m,
					boxSize: "14px"
				})
			})
		})]
	});
}, zi = (e) => {
	let { zoom: t, onZoomChange: n } = e;
	return /* @__PURE__ */ k(He, {
		"data-testid": "mermaid-zoom-controls",
		gap: "2xs",
		position: "absolute",
		right: "sm",
		bottom: "sm",
		zIndex: "1",
		onPointerDown: (e) => e.stopPropagation(),
		children: [/* @__PURE__ */ O(Ne, {
			content: "Zoom in",
			children: /* @__PURE__ */ O(Be, {
				"aria-label": "Zoom in",
				size: "xs",
				variant: "subtle",
				onClick: () => n(wi(t)),
				disabled: t >= 3,
				children: /* @__PURE__ */ O(ze, {
					as: _,
					boxSize: "14px"
				})
			})
		}), /* @__PURE__ */ O(Ne, {
			content: "Zoom out",
			children: /* @__PURE__ */ O(Be, {
				"aria-label": "Zoom out",
				size: "xs",
				variant: "subtle",
				onClick: () => n(Ti(t)),
				disabled: t <= xi,
				children: /* @__PURE__ */ O(ze, {
					as: h,
					boxSize: "14px"
				})
			})
		})]
	});
}, Bi = (e) => {
	let { allowPanAtDefaultZoom: t = !1, maxHeight: n = "420px", minHeight: r = "220px", overlayActions: i, svg: a, zoom: o, onZoomChange: s } = e, [c, l] = T({
		x: 0,
		y: 0
	}), [u, d] = T(!1), f = Le({
		pointerId: -1,
		x: 0,
		y: 0
	}), p = t || o > 1, m = (e) => {
		p && (f.current = {
			pointerId: e.pointerId,
			x: e.clientX - c.x,
			y: e.clientY - c.y
		}, d(!0), e.currentTarget.setPointerCapture(e.pointerId));
	}, h = (e) => {
		p && u && f.current.pointerId === e.pointerId && l({
			x: e.clientX - f.current.x,
			y: e.clientY - f.current.y
		});
	}, g = (e) => {
		p && f.current.pointerId === e.pointerId && (d(!1), e.currentTarget.releasePointerCapture(e.pointerId));
	}, _ = p ? u ? "grabbing" : "grab" : "default";
	return Ie(() => {
		p || (l({
			x: 0,
			y: 0
		}), d(!1));
	}, [p]), /* @__PURE__ */ k(E, {
		"data-testid": "mermaid-diagram-surface",
		position: "relative",
		minHeight: r,
		maxHeight: n,
		overflow: "hidden",
		cursor: _,
		touchAction: p ? "none" : "auto",
		onPointerDown: m,
		onPointerMove: h,
		onPointerUp: g,
		onPointerCancel: () => {
			d(!1);
		},
		children: [
			/* @__PURE__ */ O(E, {
				"data-testid": "mermaid-diagram-transform",
				"data-pan-enabled": p ? "true" : "false",
				width: "100%",
				maxHeight: n,
				textAlign: "center",
				transform: `translate3d(${c.x}px, ${c.y}px, 0) scale(${o})`,
				transformOrigin: "top left",
				cursor: _,
				css: { "& img": {
					display: "inline-block",
					width: "auto",
					maxWidth: "100%",
					maxHeight: n,
					height: "auto",
					userSelect: "none"
				} },
				children: /* @__PURE__ */ O("img", {
					alt: "Mermaid diagram",
					draggable: !1,
					src: ji(a)
				})
			}),
			i,
			/* @__PURE__ */ O(zi, {
				zoom: o,
				onZoomChange: s
			})
		]
	});
}, Vi = "comm", Hi = "rule", Ui = "decl", Wi = "@import", Gi = "@namespace", Ki = "@keyframes", qi = "@layer", Ji = Math.abs, Yi = String.fromCharCode;
function Xi(e) {
	return e.trim();
}
function Zi(e, t, n) {
	return e.replace(t, n);
}
function Qi(e, t) {
	return e.charCodeAt(t) | 0;
}
function $i(e, t, n) {
	return e.slice(t, n);
}
function q(e) {
	return e.length;
}
function ea(e) {
	return e.length;
}
function ta(e, t) {
	return t.push(e), e;
}
// node_modules/.bun/stylis@4.4.0/node_modules/stylis/src/Tokenizer.js
var na = 1, ra = 1, ia = 0, J = 0, Y = 0, aa = "";
function oa(e, t, n, r, i, a, o, s) {
	return {
		value: e,
		root: t,
		parent: n,
		type: r,
		props: i,
		children: a,
		line: na,
		column: ra,
		length: o,
		return: "",
		siblings: s
	};
}
function sa() {
	return Y;
}
function ca() {
	return Y = J > 0 ? Qi(aa, --J) : 0, ra--, Y === 10 && (ra = 1, na--), Y;
}
function X() {
	return Y = J < ia ? Qi(aa, J++) : 0, ra++, Y === 10 && (ra = 1, na++), Y;
}
function Z() {
	return Qi(aa, J);
}
function la() {
	return J;
}
function ua(e, t) {
	return $i(aa, e, t);
}
function da(e) {
	switch (e) {
		case 0:
		case 9:
		case 10:
		case 13:
		case 32: return 5;
		case 33:
		case 43:
		case 44:
		case 47:
		case 62:
		case 64:
		case 126:
		case 59:
		case 123:
		case 125: return 4;
		case 58: return 3;
		case 34:
		case 39:
		case 40:
		case 91: return 2;
		case 41:
		case 93: return 1;
	}
	return 0;
}
function fa(e) {
	return na = ra = 1, ia = q(aa = e), J = 0, [];
}
function pa(e) {
	return aa = "", e;
}
function ma(e) {
	return Xi(ua(J - 1, _a(e === 91 ? e + 2 : e === 40 ? e + 1 : e)));
}
function ha(e) {
	for (; (Y = Z()) && Y < 33;) X();
	return da(e) > 2 || da(Y) > 3 ? "" : " ";
}
function ga(e, t) {
	for (; --t && X() && !(Y < 48 || Y > 102 || Y > 57 && Y < 65 || Y > 70 && Y < 97););
	return ua(e, la() + (t < 6 && Z() == 32 && X() == 32));
}
function _a(e) {
	for (; X();) switch (Y) {
		case e: return J;
		case 34:
		case 39:
			e !== 34 && e !== 39 && _a(Y);
			break;
		case 40:
			e === 41 && _a(e);
			break;
		case 92: X();
	}
	return J;
}
function va(e, t) {
	for (; X() && e + Y !== 57 && (e + Y !== 84 || Z() !== 47););
	return "/*" + ua(t, J - 1) + "*" + Yi(e === 47 ? e : X());
}
function ya(e) {
	for (; !da(Z());) X();
	return ua(e, J);
}
// node_modules/.bun/stylis@4.4.0/node_modules/stylis/src/Parser.js
function ba(e) {
	return pa(xa("", null, null, null, [""], e = fa(e), 0, [0], e));
}
function xa(e, t, n, r, i, a, o, s, c) {
	for (var l = 0, u = 0, d = o, f = 0, p = 0, m = 0, h = 1, g = 1, _ = 1, v = 0, y = 0, b = "", ee = i, x = a, S = r, C = b; g;) switch (m = y, y = X()) {
		case 40:
			m != 108 && Qi(C, d - 1) == 58 ? (v++, C += "(") : C += ma(y);
			break;
		case 41:
			v--, C += ")";
			break;
		case 34:
		case 39:
		case 91:
			C += ma(y);
			break;
		case 9:
		case 10:
		case 13:
		case 32:
			if (v > 0) {
				C += Yi(y);
				break;
			}
			C += ha(m);
			break;
		case 92:
			C += ga(la() - 1, 7);
			continue;
		case 47:
			switch (Z()) {
				case 42:
				case 47:
					ta(Ca(va(X(), la()), t, n, c), c), (da(m || 1) == 5 || da(Z() || 1) == 5) && q(C) && $i(C, -1, void 0) !== " " && (C += " ");
					break;
				default: C += "/";
			}
			break;
		case 123 * h: s[l++] = q(C) * _;
		case 125 * h:
		case 59:
		case 0:
			if (v > 0 && y) {
				C += Yi(y);
				break;
			}
			switch (y) {
				case 0:
				case 125: g = 0;
				case 59 + u:
					_ == -1 && (C = Zi(C, /\f/g, "")), p > 0 && (q(C) - d || h === 0) && ta(p > 32 ? wa(C + ";", r, n, d - 1, c) : wa(Zi(C, " ", "") + ";", r, n, d - 2, c), c);
					break;
				case 59: C += ";";
				default: if (ta(S = Sa(C, t, n, l, u, i, s, b, ee = [], x = [], d, a), a), y === 123) {
					if (u === 0) xa(C, t, S, S, ee, a, d, s, x);
					else {
						switch (f) {
							case 99: if (Qi(C, 3) === 110) break;
							case 108: if (Qi(C, 2) === 97) break;
							default: u = 0;
							case 100:
							case 109:
							case 115:
						}
						u ? xa(e, S, S, r && ta(Sa(e, S, S, 0, 0, i, s, b, i, ee = [], d, x), x), i, x, d, s, r ? ee : x) : xa(C, S, S, S, [""], x, 0, s, x);
					}
				}
			}
			l = u = p = 0, h = _ = 1, b = C = "", d = o;
			break;
		case 58: d = 1 + q(C), p = m;
		default:
			if (h < 1) {
				if (y == 123) --h;
				else if (y == 125 && h++ == 0 && ca() == 125) continue;
			}
			switch (C += Yi(y), y * h) {
				case 38:
					_ = u > 0 ? 1 : (C += "\f", -1);
					break;
				case 44:
					if (v > 0) break;
					s[l++] = (q(C) - 1) * _, _ = 1;
					break;
				case 64:
					Z() === 45 && (C += ma(X())), f = Z(), u = d = q(b = C += ya(la())), y++;
					break;
				case 45: m === 45 && q(C) == 2 && (h = 0);
			}
	}
	return a;
}
function Sa(e, t, n, r, i, a, o, s, c, l, u, d) {
	for (var f = i - 1, p = i === 0 ? a : [""], m = ea(p), h = 0, g = 0, _ = 0; h < r; ++h) for (var v = 0, y = $i(e, f + 1, f = Ji(g = o[h])), b = e; v < m; ++v) (b = Xi(g > 0 ? p[v] + " " + y : Zi(y, /&\f/g, p[v]))) && (c[_++] = b);
	return oa(e, t, n, i === 0 ? Hi : s, c, l, u, d);
}
function Ca(e, t, n, r) {
	return oa(e, t, n, Vi, Yi(sa()), $i(e, 2, -2), 0, r);
}
function wa(e, t, n, r, i) {
	return oa(e, t, n, Ui, $i(e, 0, r), $i(e, r + 1, -1), r, i);
}
// node_modules/.bun/stylis@4.4.0/node_modules/stylis/src/Serializer.js
function Ta(e, t) {
	for (var n = "", r = 0; r < e.length; r++) n += t(e[r], r, e, t) || "";
	return n;
}
function Ea(e, t, n, r) {
	switch (e.type) {
		case qi: if (e.children.length) break;
		case Wi:
		case Gi:
		case Ui: return e.return = e.return || e.value;
		case Vi: return "";
		case Ki: return e.return = e.value + "{" + Ta(e.children, r) + "}";
		case Hi: if (!q(e.value = e.props.join(","))) return "";
	}
	return q(n = Ta(e.children, r)) ? e.return = e.value + "{" + n + "}" : "";
}
// node_modules/.bun/stylis@4.4.0/node_modules/stylis/src/Middleware.js
function Da(e) {
	var t = ea(e);
	return function(n, r, i, a) {
		for (var o = "", s = 0; s < t; s++) o += e[s](n, r, i, a) || "";
		return o;
	};
}
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/mermaid.core.mjs
var Oa = "c4", ka = {
	id: Oa,
	detector: /* @__PURE__ */ y((e) => /^\s*C4Context|C4Container|C4Component|C4Dynamic|C4Deployment/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./c4Diagram-5PPSVZJV-14a1E6m0.ts");
		return {
			id: Oa,
			diagram: e
		};
	}, "loader")
}, Aa = "flowchart", ja = {
	id: Aa,
	detector: /* @__PURE__ */ y((e, t) => t?.flowchart?.defaultRenderer === "dagre-wrapper" || t?.flowchart?.defaultRenderer === "elk" ? !1 : /^\s*graph/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./flowDiagram-UKHOOZJN-Dvlr7U49.ts");
		return {
			id: Aa,
			diagram: e
		};
	}, "loader")
}, Ma = "flowchart-v2", Na = {
	id: Ma,
	detector: /* @__PURE__ */ y((e, t) => t?.flowchart?.defaultRenderer !== "dagre-d3" && (t?.flowchart?.defaultRenderer === "elk" && (t.layout = "elk"), /^\s*graph/.test(e) && t?.flowchart?.defaultRenderer === "dagre-wrapper" ? !0 : /^\s*flowchart/.test(e)), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./flowDiagram-UKHOOZJN-Dvlr7U49.ts");
		return {
			id: Ma,
			diagram: e
		};
	}, "loader")
}, Pa = "swimlane", Fa = {
	id: Pa,
	detector: /* @__PURE__ */ y((e) => /^\s*swimlane-beta\b/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./swimlanesDiagram-ULZ7WXOC-BgOWsp2i.ts");
		return {
			id: Pa,
			diagram: e
		};
	}, "loader")
}, Ia = "er", La = {
	id: Ia,
	detector: /* @__PURE__ */ y((e) => /^\s*erDiagram/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./erDiagram-JOGREHBK-t2ci0E-e.ts");
		return {
			id: Ia,
			diagram: e
		};
	}, "loader")
}, Ra = "gitGraph", za = {
	id: Ra,
	detector: /* @__PURE__ */ y((e) => /^\s*gitGraph/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./gitGraphDiagram-DS77QQ5N-Cv4Mx2Vc.ts");
		return {
			id: Ra,
			diagram: e
		};
	}, "loader")
}, Ba = "gantt", Va = {
	id: Ba,
	detector: /* @__PURE__ */ y((e) => /^\s*gantt/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./ganttDiagram-PKOTCBZU-BAX8ZnJ2.ts");
		return {
			id: Ba,
			diagram: e
		};
	}, "loader")
}, Ha = "info", Ua = {
	id: Ha,
	detector: /* @__PURE__ */ y((e) => /^\s*info/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./infoDiagram-6WML65LV-HahaDCk4.ts");
		return {
			id: Ha,
			diagram: e
		};
	}, "loader")
}, Wa = "pie", Ga = {
	id: Wa,
	detector: /* @__PURE__ */ y((e) => /^\s*pie/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./pieDiagram-7S7Q4E2Y-BaevO668.ts");
		return {
			id: Wa,
			diagram: e
		};
	}, "loader")
}, Ka = "quadrantChart", qa = {
	id: Ka,
	detector: /* @__PURE__ */ y((e) => /^\s*quadrantChart/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./quadrantDiagram-CIZ2JOQS-D5cCzfGj.ts");
		return {
			id: Ka,
			diagram: e
		};
	}, "loader")
}, Ja = "xychart", Ya = {
	id: Ja,
	detector: /* @__PURE__ */ y((e) => /^\s*xychart(-beta)?/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./xychartDiagram-ELKLHX3M-DPZ4G3uo.ts");
		return {
			id: Ja,
			diagram: e
		};
	}, "loader")
}, Xa = "requirement", Za = {
	id: Xa,
	detector: /* @__PURE__ */ y((e) => /^\s*requirement(Diagram)?/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./requirementDiagram-LRYGKXZP-xN8gVwUr.ts");
		return {
			id: Xa,
			diagram: e
		};
	}, "loader")
}, Qa = "sequence", $a = {
	id: Qa,
	detector: /* @__PURE__ */ y((e) => /^\s*sequenceDiagram/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./sequenceDiagram-SI44F4Z6-BiZzKaJs.ts");
		return {
			id: Qa,
			diagram: e
		};
	}, "loader")
}, eo = "class", to = {
	id: eo,
	detector: /* @__PURE__ */ y((e, t) => t?.class?.defaultRenderer !== "dagre-wrapper" && /^\s*classDiagram/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./classDiagram-JCYQIIEL-Dmgb0GIt.ts");
		return {
			id: eo,
			diagram: e
		};
	}, "loader")
}, no = "classDiagram", ro = {
	id: no,
	detector: /* @__PURE__ */ y((e, t) => /^\s*classDiagram/.test(e) && t?.class?.defaultRenderer === "dagre-wrapper" ? !0 : /^\s*classDiagram-v2/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./classDiagram-v2-OCEON4UE-DdmM2Gli.ts");
		return {
			id: no,
			diagram: e
		};
	}, "loader")
}, io = "state", ao = {
	id: io,
	detector: /* @__PURE__ */ y((e, t) => t?.state?.defaultRenderer !== "dagre-wrapper" && /^\s*stateDiagram/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./stateDiagram-OKZ733FA-VYGe1dit.ts");
		return {
			id: io,
			diagram: e
		};
	}, "loader")
}, oo = "stateDiagram", so = {
	id: oo,
	detector: /* @__PURE__ */ y((e, t) => !!(/^\s*stateDiagram-v2/.test(e) || /^\s*stateDiagram/.test(e) && t?.state?.defaultRenderer === "dagre-wrapper"), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./stateDiagram-v2-UEYNNEHI-CIFVOwwH.ts");
		return {
			id: oo,
			diagram: e
		};
	}, "loader")
}, co = "journey", lo = {
	id: co,
	detector: /* @__PURE__ */ y((e) => /^\s*journey/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./journeyDiagram-NVQOT4AX-DJXphdvp.ts");
		return {
			id: co,
			diagram: e
		};
	}, "loader")
}, uo = { draw: /* @__PURE__ */ y((e, t, n) => {
	u.debug("rendering svg for syntax error\n");
	let r = We(t), i = r.append("g");
	r.attr("viewBox", "0 0 2412 512"), de(r, 100, 512, !0), i.append("path").attr("class", "error-icon").attr("d", "m411.313,123.313c6.25-6.25 6.25-16.375 0-22.625s-16.375-6.25-22.625,0l-32,32-9.375,9.375-20.688-20.688c-12.484-12.5-32.766-12.5-45.25,0l-16,16c-1.261,1.261-2.304,2.648-3.31,4.051-21.739-8.561-45.324-13.426-70.065-13.426-105.867,0-192,86.133-192,192s86.133,192 192,192 192-86.133 192-192c0-24.741-4.864-48.327-13.426-70.065 1.402-1.007 2.79-2.049 4.051-3.31l16-16c12.5-12.492 12.5-32.758 0-45.25l-20.688-20.688 9.375-9.375 32.001-31.999zm-219.313,100.687c-52.938,0-96,43.063-96,96 0,8.836-7.164,16-16,16s-16-7.164-16-16c0-70.578 57.422-128 128-128 8.836,0 16,7.164 16,16s-7.164,16-16,16z"), i.append("path").attr("class", "error-icon").attr("d", "m459.02,148.98c-6.25-6.25-16.375-6.25-22.625,0s-6.25,16.375 0,22.625l16,16c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688 6.25-6.25 6.25-16.375 0-22.625l-16.001-16z"), i.append("path").attr("class", "error-icon").attr("d", "m340.395,75.605c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688 6.25-6.25 6.25-16.375 0-22.625l-16-16c-6.25-6.25-16.375-6.25-22.625,0s-6.25,16.375 0,22.625l15.999,16z"), i.append("path").attr("class", "error-icon").attr("d", "m400,64c8.844,0 16-7.164 16-16v-32c0-8.836-7.156-16-16-16-8.844,0-16,7.164-16,16v32c0,8.836 7.156,16 16,16z"), i.append("path").attr("class", "error-icon").attr("d", "m496,96.586h-32c-8.844,0-16,7.164-16,16 0,8.836 7.156,16 16,16h32c8.844,0 16-7.164 16-16 0-8.836-7.156-16-16-16z"), i.append("path").attr("class", "error-icon").attr("d", "m436.98,75.605c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688l32-32c6.25-6.25 6.25-16.375 0-22.625s-16.375-6.25-22.625,0l-32,32c-6.251,6.25-6.251,16.375-0.001,22.625z"), i.append("text").attr("class", "error-text").attr("x", 1440).attr("y", 250).attr("font-size", "150px").style("text-anchor", "middle").text("Syntax error in text"), i.append("text").attr("class", "error-text").attr("x", 1250).attr("y", 400).attr("font-size", "100px").style("text-anchor", "middle").text(`mermaid version ${n}`);
}, "draw") }, fo = uo, po = {
	db: {},
	renderer: uo,
	parser: { parse: /* @__PURE__ */ y(() => {}, "parse") }
}, mo = "flowchart-elk", ho = {
	id: mo,
	detector: /* @__PURE__ */ y((e, t = {}) => /^\s*flowchart-elk/.test(e) || /^\s*(flowchart|graph)/.test(e) && t?.flowchart?.defaultRenderer === "elk" ? (t.layout = "elk", !0) : !1, "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./flowDiagram-UKHOOZJN-Dvlr7U49.ts");
		return {
			id: mo,
			diagram: e
		};
	}, "loader")
}, go = "timeline", _o = {
	id: go,
	detector: /* @__PURE__ */ y((e) => /^\s*timeline/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./timeline-definition-Z64GVDOM-CaCQOGiS.ts");
		return {
			id: go,
			diagram: e
		};
	}, "loader")
}, vo = "mindmap", yo = {
	id: vo,
	detector: /* @__PURE__ */ y((e) => /^\s*mindmap/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./mindmap-definition-FAOFIHXS-DEt1krcG.ts");
		return {
			id: vo,
			diagram: e
		};
	}, "loader")
}, bo = "kanban", xo = {
	id: bo,
	detector: /* @__PURE__ */ y((e) => /^\s*kanban/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./kanban-definition-27J2QSJJ-DFKlDjYg.ts");
		return {
			id: bo,
			diagram: e
		};
	}, "loader")
}, So = "sankey", Co = {
	id: So,
	detector: /* @__PURE__ */ y((e) => /^\s*sankey(-beta)?/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./sankeyDiagram-W5VNT64P-LajmMNiY.ts");
		return {
			id: So,
			diagram: e
		};
	}, "loader")
}, wo = "packet", To = {
	id: wo,
	detector: /* @__PURE__ */ y((e) => /^\s*packet(-beta)?/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./diagram-LBJQPF4R-DhNHG2yY.ts");
		return {
			id: wo,
			diagram: e
		};
	}, "loader")
}, Eo = "radar", Do = {
	id: Eo,
	detector: /* @__PURE__ */ y((e) => /^\s*radar-beta/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./diagram-UB23O5K3-CEpGIqKV.ts");
		return {
			id: Eo,
			diagram: e
		};
	}, "loader")
}, Oo = "block", ko = {
	id: Oo,
	detector: /* @__PURE__ */ y((e) => /^\s*block(-beta)?/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./blockDiagram-VBNYF7ZC-dtsKGkp8.ts");
		return {
			id: Oo,
			diagram: e
		};
	}, "loader")
}, Ao = "treeView", jo = {
	id: Ao,
	detector: /* @__PURE__ */ y((e) => /^\s*treeView-beta/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./diagram-7IWD3JNH-COXLr14y.ts");
		return {
			id: Ao,
			diagram: e
		};
	}, "loader")
}, Mo = "architecture", No = {
	id: Mo,
	detector: /* @__PURE__ */ y((e) => /^\s*architecture/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./architectureDiagram-T3A2C74G-BC8J7itJ.ts");
		return {
			id: Mo,
			diagram: e
		};
	}, "loader")
}, Po = "eventmodeling", Fo = {
	id: Po,
	detector: /* @__PURE__ */ y((e) => /^\s*eventmodeling/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./diagram-B4RE2ZJO-CHHHNbOc.ts");
		return {
			id: Po,
			diagram: e
		};
	}, "loader")
}, Io = "ishikawa", Lo = {
	id: Io,
	detector: /* @__PURE__ */ y((e) => /^\s*ishikawa(-beta)?\b/i.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./ishikawaDiagram-WSZJBQD7-DisqcYKX.ts");
		return {
			id: Io,
			diagram: e
		};
	}, "loader")
}, Ro = "venn", zo = {
	id: Ro,
	detector: /* @__PURE__ */ y((e) => /^\s*venn-beta/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./vennDiagram-T6HMQDX7-UpS9Zg-0.ts");
		return {
			id: Ro,
			diagram: e
		};
	}, "loader")
}, Bo = "treemap", Vo = {
	id: Bo,
	detector: /* @__PURE__ */ y((e) => /^\s*treemap/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./diagram-Q27KOJAE-DJqsdSSm.ts");
		return {
			id: Bo,
			diagram: e
		};
	}, "loader")
}, Ho = "wardley", Uo = {
	id: Ho,
	detector: /* @__PURE__ */ y((e) => /^\s*wardley-beta/i.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./wardleyDiagram-T6FBY63Y-B-PIEy9l.ts");
		return {
			id: Ho,
			diagram: e
		};
	}, "loader")
}, Wo = "cynefin", Go = {
	id: Wo,
	detector: /* @__PURE__ */ y((e) => /^\s*cynefin-beta(?:[\s:]|$)/.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./cynefinDiagram-MW4NZA55-C2MI-Pm-.ts");
		return {
			id: Wo,
			diagram: e
		};
	}, "loader")
}, Ko = "railroad", qo = {
	id: Ko,
	detector: /* @__PURE__ */ y((e) => /^\s*railroad-beta/i.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./railroadDiagram-AXF67PYL-DK8hqh1K.ts");
		return {
			id: Ko,
			diagram: e
		};
	}, "loader")
}, Jo = "railroadEbnf", Yo = {
	id: Jo,
	detector: /* @__PURE__ */ y((e) => /^\s*railroad-ebnf-beta/i.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./ebnfDiagram-BXEA7PRR-CO5nruLx.ts");
		return {
			id: Jo,
			diagram: e
		};
	}, "loader")
}, Xo = "railroadAbnf", Zo = {
	id: Xo,
	detector: /* @__PURE__ */ y((e) => /^\s*railroad-abnf-beta/i.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./abnfDiagram-N423BO3Z-Du7M4prD.ts");
		return {
			id: Xo,
			diagram: e
		};
	}, "loader")
}, Qo = "railroadPeg", $o = {
	id: Qo,
	detector: /* @__PURE__ */ y((e) => /^\s*railroad-peg-beta/i.test(e), "detector"),
	loader: /* @__PURE__ */ y(async () => {
		let { diagram: e } = await import("./pegDiagram-VL7TDLO6-CuUgzQWA.ts");
		return {
			id: Qo,
			diagram: e
		};
	}, "loader")
}, es = !1, ts = /* @__PURE__ */ y(() => {
	es || (es = !0, te("error", po, (e) => e.toLowerCase().trim() === "error"), te("---", {
		db: { clear: /* @__PURE__ */ y(() => {}, "clear") },
		styles: {},
		renderer: { draw: /* @__PURE__ */ y(() => {}, "draw") },
		parser: { parse: /* @__PURE__ */ y(() => {
			throw Error("Diagrams beginning with --- are not valid. If you were trying to use a YAML front-matter, please ensure that you've correctly opened and closed the YAML front-matter with un-indented `---` blocks");
		}, "parse") },
		init: /* @__PURE__ */ y(() => null, "init")
	}, (e) => e.toLowerCase().trimStart().startsWith("---")), ne(ho, yo, No), ne(ka, xo, ro, to, La, Va, Ua, Ga, Za, $a, Fa, Na, ja, _o, za, so, ao, lo, qa, Co, To, Ya, ko, Fo, jo, Do, Lo, Vo, qo, Yo, Zo, $o, zo, Uo, Go));
}, "addDiagrams"), ns = /* @__PURE__ */ y(async () => {
	u.debug("Loading registered diagrams");
	let e = (await Promise.allSettled(Object.entries(me).map(async ([e, { detector: t, loader: n }]) => {
		if (n) try {
			ie(e);
		} catch {
			try {
				let { diagram: e, id: r } = await n();
				te(r, e, t);
			} catch (t) {
				throw u.error(`Failed to load external diagram with key ${e}. Removing from detectors.`), delete me[e], t;
			}
		}
	}))).filter((e) => e.status === "rejected");
	if (e.length > 0) {
		u.error(`Failed to load ${e.length} external diagrams`);
		for (let t of e) u.error(t);
		throw Error(`Failed to load ${e.length} external diagrams`);
	}
}, "loadRegisteredDiagrams"), rs = "graphics-document document";
function is(e, t) {
	e.attr("role", rs), t !== "" && e.attr("aria-roledescription", t);
}
y(is, "setA11yDiagramInfo");
function as(e, t, n, r) {
	if (e.insert !== void 0) {
		if (n) {
			let t = `chart-desc-${r}`;
			e.attr("aria-describedby", t), e.insert("desc", ":first-child").attr("id", t).text(n);
		}
		if (t) {
			let n = `chart-title-${r}`;
			e.attr("aria-labelledby", n), e.insert("title", ":first-child").attr("id", n).text(t);
		}
	}
}
y(as, "addSVGa11yTitleDescription");
var os = class e {
	constructor(e, t, n, r, i) {
		this.type = e, this.text = t, this.db = n, this.parser = r, this.renderer = i;
	}
	static {
		y(this, "Diagram");
	}
	static async fromText(t, n = {}) {
		let r = ue(), i = ge(t, r);
		t = s(t) + "\n";
		try {
			ie(i);
		} catch {
			let e = ee(i);
			if (!e) throw new be(`Diagram ${i} not found.`);
			let { id: t, diagram: n } = await e();
			te(t, n);
		}
		let { db: a, parser: o, renderer: c, init: l } = ie(i);
		return o.parser && (o.parser.yy = a), a.clear?.(), l?.(r), n.title && a.setDiagramTitle?.(n.title), await o.parse(t), new e(i, t, a, o, c);
	}
	async render(e, t) {
		await this.renderer.draw(this.text, e, t, this);
	}
	getParser() {
		return this.parser;
	}
	getType() {
		return this.type;
	}
}, ss = [], cs = /* @__PURE__ */ y(() => {
	ss.forEach((e) => {
		e();
	}), ss = [];
}, "attachFunctions"), ls = /* @__PURE__ */ y((e) => e.replace(/^\s*%%(?!{)[^\n]+\n?/gm, "").trimStart(), "cleanupComments");
function us(e) {
	let t = e.match(le);
	if (!t) return {
		text: e,
		metadata: {}
	};
	let n = t[1], r = bi(n ? t[2].split("\n").map((e) => e.startsWith(n) ? e.slice(n.length) : e).join("\n") : t[2], { schema: yi }) ?? {};
	r = typeof r == "object" && !Array.isArray(r) ? r : {};
	let i = {};
	return r.displayMode && (i.displayMode = r.displayMode.toString()), r.title && (i.title = r.title.toString()), r.config && (i.config = r.config), {
		text: e.slice(t[0].length),
		metadata: i
	};
}
y(us, "extractFrontMatter");
var ds = /* @__PURE__ */ y((e) => e.replace(/\r\n?/g, "\n").replace(/<(\w+)([^>]*)>/g, (e, t, n) => "<" + t + n.replace(/="([^"]*)"/g, "='$1'") + ">"), "cleanupText"), fs = /* @__PURE__ */ y((e) => {
	let { text: t, metadata: n } = us(e), { displayMode: r, title: i, config: a = {} } = n;
	return r && (a.gantt ||= {}, a.gantt.displayMode = r), {
		title: i,
		config: a,
		text: t
	};
}, "processFrontmatter"), ps = /* @__PURE__ */ y((e) => {
	let t = i.detectInit(e) ?? {}, n = i.detectDirective(e, "wrap");
	return Array.isArray(n) ? t.wrap = n.some(({ type: e }) => e === "wrap") : n?.type === "wrap" && (t.wrap = !0), {
		text: a(e),
		directive: t
	};
}, "processDirectives");
function ms(e) {
	let t = fs(ds(e)), n = ps(t.text), r = o(t.config, n.directive);
	return e = ls(n.text), {
		code: e,
		title: t.title,
		config: r
	};
}
y(ms, "preprocessDiagram");
function hs(e) {
	let t = new TextEncoder().encode(e), n = Array.from(t, (e) => String.fromCodePoint(e)).join("");
	return btoa(n);
}
y(hs, "toBase64");
var gs = 5e4, _s = "graph TB;a[Maximum text size in diagram exceeded];style a fill:#faa", vs = "sandbox", ys = "loose", bs = "http://www.w3.org/2000/svg", xs = "http://www.w3.org/1999/xlink", Ss = "http://www.w3.org/1999/xhtml", Cs = "100%", ws = "100%", Ts = "border:0;margin:0;", Es = "margin:0", Ds = "allow-top-navigation-by-user-activation allow-popups", Os = "The \"iframe\" tag is not supported by your browser.", ks = ["foreignobject"], As = ["dominant-baseline"];
function js(e) {
	let t = ms(e);
	return S(), he(t.config ?? {}), t;
}
y(js, "processAndSetConfigs");
async function Ms(e, t) {
	ts();
	try {
		let { code: t, config: n } = js(e);
		return {
			diagramType: (await Ws(t)).type,
			config: n
		};
	} catch (e) {
		if (t?.suppressErrors) return !1;
		throw e;
	}
}
y(Ms, "parse");
var Ns = /* @__PURE__ */ y((e, t, n = []) => `.${e} ${t} ${C(`{ ${n.join(" !important; ")} !important; }`)}`, "cssImportantStyles"), Ps = /* @__PURE__ */ y((e, t = /* @__PURE__ */ new Map()) => {
	let n = new CSSStyleSheet();
	if (e.fontFamily !== void 0 && n.insertRule(`:root { --mermaid-font-family: ${e.fontFamily}}`, n.cssRules.length), e.altFontFamily !== void 0 && n.insertRule(`:root { --mermaid-alt-font-family: ${e.altFontFamily}}`, n.cssRules.length), t instanceof Map) {
		let r = ae(e) ? ["> *", "span"] : [
			"rect",
			"polygon",
			"ellipse",
			"circle",
			"path"
		];
		t.forEach((e) => {
			Ke(e.styles) || r.forEach((t) => {
				n.insertRule(Ns(e.id, t, e.styles), n.cssRules.length);
			}), Ke(e.textStyles) || n.insertRule(Ns(e.id, "tspan", (e?.textStyles || []).map((e) => e.replace("color", "fill"))), n.cssRules.length);
		});
	}
	let r = "";
	if (e.themeCSS !== void 0) {
		if (typeof n.replaceSync == "function") {
			let t = new CSSStyleSheet();
			t.replaceSync(e.themeCSS), r = pe(t) + "\n";
		} else r += `${e.themeCSS}
`;
	}
	return r + pe(n);
}, "createCssStyles"), Fs = /* @__PURE__ */ y((e, t) => Ta(ba(`${e}{${t}}`), Da([/* @__PURE__ */ y(function(t, n, r, i) {
	if (t.type === "rule" && Array.isArray(t.props)) {
		if (t.parent && t.parent.type === "@keyframes") return;
		t.props = t.props.map((n) => n === e && Array.isArray(t.children) && t.children.every((e) => e.type === "decl" && (/* @__PURE__ */ new Set([
			"font-family",
			"font-size",
			"fill"
		])).has(e.props)) ? n : !n.startsWith(`${e} `) && !n.startsWith(`${e}>`) || n.startsWith(`${e} ||`) ? `${e} ${n}` : n);
	} else t.type.startsWith("@") && ([
		"@media",
		"@supports",
		"@layer",
		"@scope",
		"@container",
		"@starting-style",
		"@keyframes"
	].includes(t.type) || (u.warn(`Removing unsupported at-rule ${t.type} from CSS`), t.type = Vi));
}, "addNamespace"), Ea])), "compileCSS"), Is = /* @__PURE__ */ y((e, t, n, r) => {
	let i = Ps(e, n);
	return Fs(r, se(t, i, {
		...e.themeVariables,
		theme: e.theme,
		look: e.look
	}, r));
}, "createUserStyles"), Ls = /* @__PURE__ */ y((e = "", n, r) => {
	let i = e;
	return !r && !n && (i = i.replace(/marker-end="url\([\d+./:=?A-Za-z-]*?#/g, "marker-end=\"url(#")), i = t(i), i = i.replace(/<br>/g, "<br/>"), i;
}, "cleanUpSvgCode"), Rs = /* @__PURE__ */ y((e = "", t) => `<iframe style="width:${Cs};height:${t?.viewBox?.baseVal?.height ? t.viewBox.baseVal.height + "px" : ws};${Ts}" src="data:text/html;charset=UTF-8;base64,${hs(`<body style="${Es}">${e}</body>`)}" sandbox="${Ds}">
  ${Os}
</iframe>`, "putIntoIFrame"), zs = /* @__PURE__ */ y((e, t, n, r, i) => {
	let a = e.append("div");
	a.attr("id", n), r && a.attr("style", r);
	let o = a.append("svg").attr("id", t).attr("width", "100%").attr("xmlns", bs);
	return i && o.attr("xmlns:xlink", i), o.append("g"), e;
}, "appendDivSvgG");
function Bs(e, t) {
	return e.append("iframe").attr("id", t).attr("style", "width: 100%; height: 100%;").attr("sandbox", "");
}
y(Bs, "sandboxedIframe");
var Vs = /* @__PURE__ */ y((e, t, n, r) => {
	e.getElementById(t)?.remove(), e.getElementById(n)?.remove(), e.getElementById(r)?.remove();
}, "removeExistingElements"), Hs = /* @__PURE__ */ y(async function(e, t, n) {
	ts();
	let r = js(t);
	t = r.code;
	let i = ue();
	u.debug(i), t.length > (i?.maxTextSize ?? gs) && (t = _s);
	let a = `#${e}`, o = "i" + e, s = "#" + o, c = "d" + e, l = "#" + c, d = /* @__PURE__ */ y(() => {
		let e = f(m ? s : l).node();
		e && "remove" in e && e.remove();
	}, "removeTempElements"), p = f(document.body), m = i.securityLevel === vs, h = i.securityLevel === ys, g = i.fontFamily;
	if (n !== void 0) {
		if (n && (n.innerHTML = ""), m) {
			let e = Bs(f(n), o);
			p = f(e.nodes()[0].contentDocument.body), p.node().style.margin = "0";
		} else p = f(n);
		zs(p, e, c, `font-family: ${g}`, xs);
	} else {
		if (Vs(document, e, c, o), m) {
			let e = Bs(f(document.body), o);
			p = f(e.nodes()[0].contentDocument.body), p.node().style.margin = "0";
		} else p = f("body");
		zs(p, e, c);
	}
	let _, v;
	try {
		_ = await os.fromText(t, { title: r.title });
	} catch (e) {
		if (i.suppressErrorRendering) throw d(), e;
		_ = await os.fromText("error"), v = e;
	}
	let ee = p.select(l).node(), x = _.type, S = ee.firstChild, C = S.firstChild, te = _.renderer.getClasses?.(t, _), ne = Is(i, x, te, a), re = document.createElement("style");
	re.innerHTML = ne, S.insertBefore(re, C);
	try {
		await _.renderer.draw(t, e, "11.16.1", _);
	} catch (n) {
		throw i.suppressErrorRendering ? d() : fo.draw(t, e, "11.16.1"), n;
	}
	let ie = p.select(`${l} svg`), ae = _.db.getAccTitle?.(), oe = _.db.getAccDescription?.();
	Gs(x, ie, ae, oe), p.select(`[id="${e}"]`).selectAll("foreignobject > *").attr("xmlns", Ss);
	let w = p.select(l).node().innerHTML;
	if (u.debug("config.arrowMarkerAbsolute", i.arrowMarkerAbsolute), w = Ls(w, m, fe(i.arrowMarkerAbsolute)), m) {
		let e = p.select(l + " svg").node();
		w = Rs(w, e);
	} else h || (w = b.sanitize(w, {
		ADD_TAGS: ks,
		ADD_ATTR: As,
		HTML_INTEGRATION_POINTS: { foreignobject: !0 }
	}));
	if (cs(), v) throw v;
	return d(), {
		diagramType: x,
		svg: w,
		bindFunctions: _.db.bindFunctions
	};
}, "render");
function Us(e = {}) {
	let t = ve({}, e);
	t?.fontFamily && !t.themeVariables?.fontFamily && (t.themeVariables ||= {}, t.themeVariables.fontFamily = t.fontFamily), oe(t), t?.theme && t.theme in ce ? t.themeVariables = ce[t.theme].getThemeVariables(t.themeVariables) : t && (t.themeVariables = ce.default.getThemeVariables(t.themeVariables));
	let n = typeof t == "object" ? _e(t) : x();
	d(n.logLevel), ts();
}
y(Us, "initialize");
var Ws = /* @__PURE__ */ y((e, t = {}) => {
	let { code: n } = ms(e);
	return os.fromText(n, t);
}, "getDiagramFromText");
function Gs(e, t, n, r) {
	is(t, e), as(t, n, r, t.attr("id"));
}
y(Gs, "addA11yInfo");
var Q = Object.freeze({
	render: Hs,
	parse: Ms,
	getDiagramFromText: Ws,
	initialize: Us,
	getConfig: ue,
	setConfig: w,
	getSiteConfig: x,
	updateSiteConfig: re,
	reset: /* @__PURE__ */ y(() => {
		S();
	}, "reset"),
	globalReset: /* @__PURE__ */ y(() => {
		S(xe);
	}, "globalReset"),
	defaultConfig: xe
});
d(ue().logLevel), S(ue());
var Ks = /* @__PURE__ */ y((e, t, n) => {
	u.warn(e), r(e) ? (n && n(e.str, e.hash), t.push({
		...e,
		message: e.str,
		error: e
	})) : (n && n(e), e instanceof Error && t.push({
		str: e.message,
		message: e.message,
		hash: e.name,
		error: e
	}));
}, "handleError"), qs = /* @__PURE__ */ y(async function(e = { querySelector: ".mermaid" }) {
	try {
		await Js(e);
	} catch (t) {
		if (r(t) && u.error(t.str), $.parseError && $.parseError(t), !e.suppressErrors) throw u.error("Use the suppressErrors option to suppress these errors"), t;
	}
}, "run"), Js = /* @__PURE__ */ y(async function({ postRenderCallback: e, querySelector: t, nodes: n } = { querySelector: ".mermaid" }) {
	let r = Q.getConfig();
	u.debug(`${e ? "" : "No "}Callback function found`);
	let a;
	if (n) a = n;
	else if (t) a = document.querySelectorAll(t);
	else throw Error("Nodes and querySelector are both undefined");
	u.debug(`Found ${a.length} diagrams`), r?.startOnLoad !== void 0 && (u.debug("Start On Load: " + r?.startOnLoad), Q.updateSiteConfig({ startOnLoad: r?.startOnLoad }));
	let o = new i.InitIDGenerator(r.deterministicIds, r.deterministicIDSeed), s, c = [];
	for (let t of Array.from(a)) {
		if (u.info("Rendering diagram: " + t.id), t.getAttribute("data-processed")) continue;
		t.setAttribute("data-processed", "true");
		let n = `mermaid-${o.next()}`;
		s = t.innerHTML, s = we(i.entityDecode(s)).trim().replace(/<br\s*\/?>/gi, "<br/>");
		let r = i.detectInit(s);
		r && u.debug("Detected early reinit: ", r);
		try {
			let { svg: r, bindFunctions: i } = await ic(n, s, t);
			t.innerHTML = r, e && await e(n), i && i(t);
		} catch (e) {
			Ks(e, c, $.parseError);
		}
	}
	if (c.length > 0) throw c[0];
}, "runThrowsErrors"), Ys = /* @__PURE__ */ y(function(e) {
	Q.initialize(e);
}, "initialize"), Xs = /* @__PURE__ */ y(async function(e, t, n) {
	u.warn("mermaid.init is deprecated. Please use run instead."), e && Ys(e);
	let r = {
		postRenderCallback: n,
		querySelector: ".mermaid"
	};
	typeof t == "string" ? r.querySelector = t : t && (r.nodes = t instanceof HTMLElement ? [t] : t), await qs(r);
}, "init"), Zs = /* @__PURE__ */ y(async (e, { lazyLoad: t = !0 } = {}) => {
	ts(), ne(...e), t === !1 && await ns();
}, "registerExternalDiagrams"), Qs = /* @__PURE__ */ y(function() {
	if ($.startOnLoad) {
		let { startOnLoad: e } = Q.getConfig();
		e && $.run().catch((e) => u.error("Mermaid failed to initialize", e));
	}
}, "contentLoaded");
typeof document < "u" && window.addEventListener("load", Qs, !1);
var $s = /* @__PURE__ */ y(function(e) {
	$.parseError = e;
}, "setParseErrorHandler"), ec = [], tc = !1, nc = /* @__PURE__ */ y(async () => {
	if (!tc) {
		for (tc = !0; ec.length > 0;) {
			let e = ec.shift();
			if (e) try {
				await e();
			} catch (e) {
				u.error("Error executing queue", e);
			}
		}
		tc = !1;
	}
}, "executeQueue"), rc = /* @__PURE__ */ y(async (e, t) => new Promise((n, r) => {
	let i = /* @__PURE__ */ y(() => new Promise((i, a) => {
		Q.parse(e, t).then((e) => {
			i(e), n(e);
		}, (e) => {
			u.error("Error parsing", e), $.parseError?.(e), a(e), r(e);
		});
	}), "performCall");
	ec.push(i), nc().catch(r);
}), "parse"), ic = /* @__PURE__ */ y((e, t, n) => new Promise((r, i) => {
	let a = /* @__PURE__ */ y(() => new Promise((a, o) => {
		Q.render(e, t, n).then((e) => {
			a(e), r(e);
		}, (e) => {
			u.error("Error parsing", e), $.parseError?.(e), o(e), i(e);
		});
	}), "performCall");
	ec.push(a), nc().catch(i);
}), "render"), $ = {
	startOnLoad: !0,
	mermaidAPI: Q,
	parse: rc,
	render: ic,
	init: Xs,
	run: qs,
	registerExternalDiagrams: Zs,
	registerLayoutLoaders: Ye,
	initialize: Ys,
	parseError: void 0,
	contentLoaded: Qs,
	setParseErrorHandler: $s,
	detectType: ge,
	registerIconPacks: Ce,
	getRegisteredDiagramsMetadata: /* @__PURE__ */ y(() => Object.keys(me).map((e) => ({ id: e })), "getRegisteredDiagramsMetadata")
}, ac = $, oc = null, sc = 0, cc = Promise.resolve(), lc = (e) => e === "dark" ? "dark" : "default", uc = (e) => {
	oc !== e && (ac.initialize({
		startOnLoad: !1,
		htmlLabels: !0,
		flowchart: { htmlLabels: !0 },
		securityLevel: "antiscript",
		theme: lc(e)
	}), oc = e);
}, dc = () => (sc += 1, `mermaid-${sc}`), fc = (e, t) => {
	let n = async () => (uc(e), ac.render(dc(), t)), r = cc.then(n, n);
	return cc = r.then(() => void 0, () => void 0), r;
}, pc = (e) => {
	if (!(e instanceof Error)) return "Failed to render Mermaid diagram.";
	let t = e.message.trim();
	return t ? t.split("\n").filter(Boolean).slice(0, 3).join("\n") : "Failed to render Mermaid diagram.";
}, mc = (e) => {
	let { themePreference: t, themePreferences: n } = Pe(), r = Fe(t, n), [i, a] = T(""), [o, s] = T(""), [c, l] = T(!1);
	return Ie(() => {
		let t = !1;
		return (async () => {
			l(!0), s("");
			try {
				let n = await fc(r, e);
				if (t) return;
				a(n.svg);
			} catch (e) {
				if (t) return;
				a(""), s(pc(e));
			} finally {
				t || l(!1);
			}
		})(), () => {
			t = !0;
		};
	}, [e, r]), {
		svg: i,
		error: o,
		isRendering: c
	};
}, hc = (e) => {
	let { allowPanAtDefaultZoom: t, code: n, error: r, isRendering: i, maxHeight: a, minHeight: o, overlayActions: s, svg: c, zoom: l, onZoomChange: u } = e;
	return i ? /* @__PURE__ */ k(E, {
		position: "relative",
		minHeight: o ?? "220px",
		maxHeight: a,
		overflow: "hidden",
		children: [/* @__PURE__ */ O(Ue, {
			color: "fg.muted",
			textStyle: "paragraph/S/regular",
			children: "Rendering diagram..."
		}), s]
	}) : r ? /* @__PURE__ */ k(E, {
		position: "relative",
		minHeight: o ?? "220px",
		maxHeight: a,
		overflow: "hidden",
		children: [/* @__PURE__ */ O(Ii, {
			code: n,
			error: r
		}), s]
	}) : /* @__PURE__ */ O(Bi, {
		allowPanAtDefaultZoom: t,
		maxHeight: a,
		minHeight: o,
		overlayActions: s,
		svg: c,
		zoom: l,
		onZoomChange: u
	}, c);
}, gc = (e) => {
	let { code: t, initialFullscreenOpen: n = !1, initialZoom: r = 1, isEditable: i = !1, onRequestEdit: a } = e, { svg: o, error: s, isRendering: c } = mc(t), [l, u] = T(r), [d, f] = T(1), [p, m] = T(n), h = Le({
		code: t,
		initialZoom: r
	}), g = !!o && !s && !c;
	return Ie(() => {
		let e = h.current;
		(e.code !== t || e.initialZoom !== r) && (h.current = {
			code: t,
			initialZoom: r
		}, u(r), f(1));
	}, [t, r]), /* @__PURE__ */ k(E, {
		width: "100%",
		children: [/* @__PURE__ */ O(hc, {
			code: t,
			error: s,
			isRendering: c,
			overlayActions: /* @__PURE__ */ O(Ri, {
				isEditable: i,
				onRequestEdit: a,
				onOpenFullscreen: () => {
					f(1), m(!0);
				}
			}),
			svg: o,
			zoom: l,
			onZoomChange: u
		}), /* @__PURE__ */ O(Li, {
			open: p,
			canDownload: g,
			onClose: () => m(!1),
			onDownload: () => Fi({
				svg: o,
				zoom: d
			}),
			children: /* @__PURE__ */ O(hc, {
				allowPanAtDefaultZoom: !0,
				code: t,
				error: s,
				isRendering: c,
				maxHeight: "100%",
				minHeight: "100%",
				svg: o,
				zoom: d,
				onZoomChange: f
			})
		})]
	});
};
export { Xe as a, Ze as i, yi as n, We as o, bi as r, gc as t };
