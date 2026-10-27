// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { $ as e, $n as t, A as n, An as r, Bn as i, Ct as a, Dt as o, E as s, En as c, F as l, Gn as u, Hn as d, Ht as f, In as p, J as m, Jn as h, Kn as g, L as _, Ln as v, Lt as y, Mn as b, Nn as x, Nt as S, On as C, Ot as ee, P as te, Pt as w, Qt as T, R as ne, Sn as E, Tn as D, Tt as re, Ut as O, V as ie, Wn as ae, Xt as oe, Y as se, Yn as ce, Z as le, Zt as k, _n as ue, an as de, bn as A, bt as fe, cn as pe, d as me, er as he, f as ge, ft as _e, gn as ve, gt as ye, h as be, hn as xe, in as Se, j as Ce, jn as we, jt as j, kt as M, lt as Te, mn as Ee, mt as De, nn as N, nr as Oe, on as ke, ot as Ae, pn as je, q as Me, qn as P, qt as F, rt as Ne, st as Pe, tn as Fe, tr as Ie, u as Le, un as Re, ut as ze, vt as I, yn as Be, zn as Ve, zt as He } from "./rich-text-theme-C7PhYVHR.ts";
import { t as Ue } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import * as We from "react";
import { forwardRef as Ge, useCallback as Ke, useEffect as qe, useLayoutEffect as Je, useMemo as Ye, useRef as Xe, useState as L } from "react";
import { Box as Ze } from "@chakra-ui/react";
import { jsx as R, jsxs as Qe } from "react/jsx-runtime";
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalOnChangePlugin.prod.mjs
var $e = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0 ? Je : qe;
function et({ ignoreHistoryMergeTagChange: e = !0, ignoreSelectionChange: t = !1, onChange: n }) {
	let [r] = Ue();
	return $e(() => {
		if (n) return r.registerUpdateListener(({ editorState: i, dirtyElements: a, dirtyLeaves: o, prevEditorState: s, tags: c }) => {
			t && a.size === 0 && o.size === 0 || e && c.has("history-merge") || s.isEmpty() || n(i, r, c);
		});
	}, [
		r,
		e,
		t,
		n
	]), null;
}
// packages/ui/src/components/rich-text/shared/plugins/ToggleEditablePlugin.tsx
function tt({ isEditable: e }) {
	let [t] = Ue();
	return Je(() => {
		t.setEditable(e);
	}, [e, t]), null;
}
// node_modules/.bun/@lexical+mark@0.40.0/node_modules/@lexical/mark/LexicalMark.prod.mjs
var nt = [], rt = class e extends _e {
	__ids;
	static getType() {
		return "mark";
	}
	static clone(t) {
		return new e(t.__ids, t.__key);
	}
	static importDOM() {
		return null;
	}
	static importJSON(e) {
		return it().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setIDs(e.ids);
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			ids: this.getIDs()
		};
	}
	constructor(e = nt, t) {
		super(t), this.__ids = e;
	}
	createDOM(e) {
		let t = document.createElement("mark");
		return I(t, e.theme.mark), this.__ids.length > 1 && I(t, e.theme.markOverlap), t;
	}
	updateDOM(e, t, n) {
		let r = e.__ids, i = this.__ids, a = r.length, o = i.length, s = n.theme.markOverlap;
		return a !== o && (a === 1 ? o === 2 && I(t, s) : o === 1 && k(t, s)), !1;
	}
	hasID(e) {
		return this.getIDs().includes(e);
	}
	getIDs() {
		return Array.from(this.getLatest().__ids);
	}
	setIDs(e) {
		let t = this.getWritable();
		return t.__ids = e, t;
	}
	addID(e) {
		let t = this.getWritable();
		return t.__ids.includes(e) ? t : t.setIDs([...t.__ids, e]);
	}
	deleteID(e) {
		let t = this.getWritable(), n = t.__ids.indexOf(e);
		if (n === -1) return t;
		let r = Array.from(t.__ids);
		return r.splice(n, 1), t.setIDs(r);
	}
	insertNewAfter(e, t = !0) {
		let n = it(this.__ids);
		return this.insertAfter(n, t), n;
	}
	canInsertTextBefore() {
		return !1;
	}
	canInsertTextAfter() {
		return !1;
	}
	canBeEmpty() {
		return !1;
	}
	isInline() {
		return !0;
	}
	extractWithChild(e, t, n) {
		if (!j(t) || n === "html") return !1;
		let r = t.anchor, i = t.focus, a = r.getNode(), o = i.getNode(), s = t.isBackward() ? r.offset - i.offset : i.offset - r.offset;
		return this.isParentOf(a) && this.isParentOf(o) && this.getTextContent().length === s;
	}
	excludeFromCopy(e) {
		return e !== "clone";
	}
};
function it(e = nt) {
	return r(new rt(e));
}
function at(e) {
	return e instanceof rt;
}
se({
	name: "@lexical/mark",
	nodes: () => [rt]
});
// node_modules/.bun/@lexical+table@0.40.0/node_modules/@lexical/table/LexicalTable.prod.mjs
var ot = /^(\d+(?:\.\d+)?)px$/, z = {
	BOTH: 3,
	COLUMN: 2,
	NO_STATUS: 0,
	ROW: 1
}, B = class e extends _e {
	__colSpan;
	__rowSpan;
	__headerState;
	__width;
	__backgroundColor;
	__verticalAlign;
	static getType() {
		return "tablecell";
	}
	static clone(t) {
		return new e(t.__headerState, t.__colSpan, t.__width, t.__key);
	}
	afterCloneFrom(e) {
		super.afterCloneFrom(e), this.__rowSpan = e.__rowSpan, this.__backgroundColor = e.__backgroundColor, this.__verticalAlign = e.__verticalAlign;
	}
	static importDOM() {
		return {
			td: (e) => ({
				conversion: ct,
				priority: 0
			}),
			th: (e) => ({
				conversion: ct,
				priority: 0
			})
		};
	}
	static importJSON(e) {
		return V().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setHeaderStyles(e.headerState).setColSpan(e.colSpan || 1).setRowSpan(e.rowSpan || 1).setWidth(e.width || void 0).setBackgroundColor(e.backgroundColor || null).setVerticalAlign(e.verticalAlign || void 0);
	}
	constructor(e = z.NO_STATUS, t = 1, n, r) {
		super(r), this.__colSpan = t, this.__rowSpan = 1, this.__headerState = e, this.__width = n, this.__backgroundColor = null, this.__verticalAlign = void 0;
	}
	createDOM(e) {
		let t = document.createElement(this.getTag());
		return this.__width && (t.style.width = `${this.__width}px`), this.__colSpan > 1 && (t.colSpan = this.__colSpan), this.__rowSpan > 1 && (t.rowSpan = this.__rowSpan), this.__backgroundColor !== null && (t.style.backgroundColor = this.__backgroundColor), st(this.__verticalAlign) && (t.style.verticalAlign = this.__verticalAlign), I(t, e.theme.tableCell, this.hasHeader() && e.theme.tableCellHeader), t;
	}
	exportDOM(e) {
		let t = super.exportDOM(e);
		if (ce(t.element)) {
			let e = t.element;
			e.setAttribute("data-temporary-table-cell-lexical-key", this.getKey()), e.style.border = "1px solid black", this.__colSpan > 1 && (e.colSpan = this.__colSpan), this.__rowSpan > 1 && (e.rowSpan = this.__rowSpan), e.style.width = `${this.getWidth() || 75}px`, e.style.verticalAlign = this.getVerticalAlign() || "top", e.style.textAlign = "start", this.__backgroundColor === null && this.hasHeader() && (e.style.backgroundColor = "#f2f3f5");
		}
		return t;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			...st(this.__verticalAlign) && { verticalAlign: this.__verticalAlign },
			backgroundColor: this.getBackgroundColor(),
			colSpan: this.__colSpan,
			headerState: this.__headerState,
			rowSpan: this.__rowSpan,
			width: this.getWidth()
		};
	}
	getColSpan() {
		return this.getLatest().__colSpan;
	}
	setColSpan(e) {
		let t = this.getWritable();
		return t.__colSpan = e, t;
	}
	getRowSpan() {
		return this.getLatest().__rowSpan;
	}
	setRowSpan(e) {
		let t = this.getWritable();
		return t.__rowSpan = e, t;
	}
	getTag() {
		return this.hasHeader() ? "th" : "td";
	}
	setHeaderStyles(e, t = z.BOTH) {
		let n = this.getWritable();
		return n.__headerState = e & t | n.__headerState & ~t, n;
	}
	getHeaderStyles() {
		return this.getLatest().__headerState;
	}
	setWidth(e) {
		let t = this.getWritable();
		return t.__width = e, t;
	}
	getWidth() {
		return this.getLatest().__width;
	}
	getBackgroundColor() {
		return this.getLatest().__backgroundColor;
	}
	setBackgroundColor(e) {
		let t = this.getWritable();
		return t.__backgroundColor = e, t;
	}
	getVerticalAlign() {
		return this.getLatest().__verticalAlign;
	}
	setVerticalAlign(e) {
		let t = this.getWritable();
		return t.__verticalAlign = e || void 0, t;
	}
	toggleHeaderStyle(e) {
		let t = this.getWritable();
		return (t.__headerState & e) === e ? t.__headerState -= e : t.__headerState += e, t;
	}
	hasHeaderState(e) {
		return (this.getHeaderStyles() & e) === e;
	}
	hasHeader() {
		return this.getLatest().__headerState !== z.NO_STATUS;
	}
	updateDOM(e) {
		return e.__headerState !== this.__headerState || e.__width !== this.__width || e.__colSpan !== this.__colSpan || e.__rowSpan !== this.__rowSpan || e.__backgroundColor !== this.__backgroundColor || e.__verticalAlign !== this.__verticalAlign;
	}
	isShadowRoot() {
		return !0;
	}
	collapseAtStart() {
		return !0;
	}
	canBeEmpty() {
		return !1;
	}
	canIndent() {
		return !1;
	}
};
function st(e) {
	return e === "middle" || e === "bottom";
}
function ct(e) {
	let t = e, n = e.nodeName.toLowerCase(), r;
	ot.test(t.style.width) && (r = parseFloat(t.style.width));
	let i = V(n === "th" ? z.ROW : z.NO_STATUS, t.colSpan, r);
	i.__rowSpan = t.rowSpan;
	let a = t.style.backgroundColor;
	a !== "" && (i.__backgroundColor = a);
	let o = t.style.verticalAlign;
	st(o) && (i.__verticalAlign = o);
	let s = t.style, c = (s && s.textDecoration || "").split(" "), l = s.fontWeight === "700" || s.fontWeight === "bold", u = c.includes("line-through"), d = s.fontStyle === "italic", f = c.includes("underline");
	return {
		after: (e) => {
			let t = [], n = null, r = () => {
				if (n) {
					let e = n.getFirstChild();
					T(e) && n.getChildrenSize() === 1 && e.remove();
				}
			};
			for (let i of e) Ee(i) || N(i) || T(i) ? (N(i) && (l && i.toggleFormat("bold"), u && i.toggleFormat("strikethrough"), d && i.toggleFormat("italic"), f && i.toggleFormat("underline")), n ? n.append(i) : (n = A().append(i), t.push(n))) : (t.push(i), r(), n = null);
			return r(), t.length === 0 && t.push(A()), t;
		},
		node: i
	};
}
function V(e = z.NO_STATUS, t = 1, n) {
	return r(new B(e, t, n));
}
function H(e) {
	return e instanceof B;
}
var lt = we("INSERT_TABLE_COMMAND");
function U(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
var ut = class e extends _e {
	__height;
	static getType() {
		return "tablerow";
	}
	static clone(t) {
		return new e(t.__height, t.__key);
	}
	static importDOM() {
		return { tr: (e) => ({
			conversion: dt,
			priority: 0
		}) };
	}
	static importJSON(e) {
		return ft().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setHeight(e.height);
	}
	constructor(e, t) {
		super(t), this.__height = e;
	}
	exportJSON() {
		let e = this.getHeight();
		return {
			...super.exportJSON(),
			...e === void 0 ? void 0 : { height: e }
		};
	}
	createDOM(e) {
		let t = document.createElement("tr");
		return this.__height && (t.style.height = `${this.__height}px`), I(t, e.theme.tableRow), t;
	}
	extractWithChild(e, t, n) {
		return n === "html";
	}
	isShadowRoot() {
		return !0;
	}
	setHeight(e) {
		let t = this.getWritable();
		return t.__height = e, t;
	}
	getHeight() {
		return this.getLatest().__height;
	}
	updateDOM(e) {
		return e.__height !== this.__height;
	}
	canBeEmpty() {
		return !1;
	}
	canIndent() {
		return !1;
	}
};
function dt(e) {
	let t = e, n;
	return ot.test(t.style.height) && (n = parseFloat(t.style.height)), {
		after: (e) => l(e, H),
		node: ft(n)
	};
}
function ft(e) {
	return r(new ut(e));
}
function W(e) {
	return e instanceof ut;
}
var pt = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, mt = pt && "documentMode" in document ? document.documentMode : null, ht = pt && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);
function gt(e, t, n = !0) {
	let r = bn();
	for (let i = 0; i < e; i++) {
		let e = ft();
		for (let r = 0; r < t; r++) {
			let t = z.NO_STATUS;
			typeof n == "object" ? (i === 0 && n.rows && (t |= z.ROW), r === 0 && n.columns && (t |= z.COLUMN)) : n && (i === 0 && (t |= z.ROW), r === 0 && (t |= z.COLUMN));
			let a = V(t), o = A();
			o.append(je()), a.append(o), e.append(a);
		}
		r.append(e);
	}
	return r;
}
function _t(e) {
	let t = F(e, (e) => Q(e));
	if (Q(t)) return t;
	throw Error("Expected table cell to be inside of table.");
}
pt && "InputEvent" in window && !mt && new window.InputEvent("input");
var vt = (e, t) => e === z.BOTH || e === t ? t : z.NO_STATUS;
function yt(e, t = !0) {
	let [, , n] = q(e), [r, i] = G(n, e, e), a = r[0].length, { startRow: o } = i, s = null;
	if (t) {
		let t = o + e.__rowSpan - 1, i = r[t], c = ft();
		for (let e = 0; e < a; e++) {
			let { cell: n, startRow: r } = i[e];
			if (r + n.__rowSpan - 1 <= t) {
				let t = i[e].cell.__headerState, n = vt(t, z.COLUMN);
				c.append(V(n).append(A()));
			} else n.setRowSpan(n.__rowSpan + 1);
		}
		let l = n.getChildAtIndex(t);
		W(l) || U(256), l.insertAfter(c), s = c;
	} else {
		let e = o, t = r[e], i = ft();
		for (let n = 0; n < a; n++) {
			let { cell: r, startRow: a } = t[n];
			if (a === e) {
				let e = t[n].cell.__headerState, r = vt(e, z.COLUMN);
				i.append(V(r).append(A()));
			} else r.setRowSpan(r.__rowSpan + 1);
		}
		let c = n.getChildAtIndex(e);
		W(c) || U(257), c.insertBefore(i), s = i;
	}
	return s;
}
function bt(e, t = !0, n = !0) {
	let [, , r] = q(e), [i, a] = G(r, e, e), o = i.length, { startColumn: s } = a, c = t ? s + e.__colSpan - 1 : s - 1, l = r.getFirstChild();
	W(l) || U(120);
	let u = null;
	function d(e = z.NO_STATUS) {
		let t = V(e).append(A());
		return u === null && (u = t), t;
	}
	let f = l;
	e: for (let e = 0; e < o; e++) {
		if (e !== 0) {
			let e = f.getNextSibling();
			W(e) || U(121), f = e;
		}
		let t = i[e], n = t[c < 0 ? 0 : c].cell.__headerState, r = vt(n, z.ROW);
		if (c < 0) {
			St(f, d(r));
			continue;
		}
		let { cell: a, startColumn: o, startRow: s } = t[c];
		if (o + a.__colSpan - 1 <= c) {
			let n = a, i = s, o = c;
			for (; i !== e && n.__rowSpan > 1;) {
				if (o -= a.__colSpan, !(o >= 0)) {
					f.append(d(r));
					continue e;
				}
				{
					let { cell: e, startRow: r } = t[o];
					n = e, i = r;
				}
			}
			n.insertAfter(d(r));
		} else a.setColSpan(a.__colSpan + 1);
	}
	u !== null && n && xt(u);
	let p = r.getColWidths();
	if (p) {
		let e = [...p], t = c < 0 ? 0 : c, n = e[t];
		e.splice(t, 0, n), r.setColWidths(e);
	}
	return u;
}
function xt(e) {
	let t = e.getFirstDescendant();
	t == null ? e.selectStart() : t.getParentOrThrow().selectStart();
}
function St(e, t) {
	let n = e.getFirstChild();
	n === null ? e.append(t) : n.insertBefore(t);
}
function Ct(e) {
	if (e.length === 0) return null;
	let [t] = K(_t(e[0]), null, null), n = 1 / 0, r = -1 / 0, i = 1 / 0, a = -1 / 0, o = /* @__PURE__ */ new Set();
	for (let s of t) for (let t of s) {
		if (!t || !t.cell) continue;
		let s = t.cell.getKey();
		if (!o.has(s) && e.some((e) => e.is(t.cell))) {
			o.add(s);
			let e = t.startRow, c = t.startColumn, l = t.cell.__rowSpan || 1, u = t.cell.__colSpan || 1;
			n = Math.min(n, e), r = Math.max(r, e + l - 1), i = Math.min(i, c), a = Math.max(a, c + u - 1);
		}
	}
	if (n === 1 / 0 || i === 1 / 0) return null;
	let s = r - n + 1, c = a - i + 1, l = t[n][i];
	if (!l.cell) return null;
	let u = l.cell;
	u.setColSpan(c), u.setRowSpan(s);
	let d = /* @__PURE__ */ new Set([u.getKey()]);
	for (let e = n; e <= r; e++) for (let n = i; n <= a; n++) {
		let r = t[e][n];
		if (!r.cell) continue;
		let i = r.cell, a = i.getKey();
		d.has(a) || (d.add(a), wt(i) || u.append(...i.getChildren()), i.remove());
	}
	return u.getChildrenSize() === 0 && u.append(A()), u;
}
function wt(e) {
	if (e.getChildrenSize() !== 1) return !1;
	let t = e.getFirstChildOrThrow();
	return !(!m(t) || !t.isEmpty());
}
function Tt(e) {
	let [t, n, r] = q(e), i = t.__colSpan, a = t.__rowSpan;
	if (i === 1 && a === 1) return;
	let [o, s] = G(r, t, t), { startColumn: c, startRow: l } = s, u = t.__headerState & z.COLUMN, d = Array.from({ length: i }, (e, t) => {
		let n = u;
		for (let e = 0; n !== 0 && e < o.length; e++) n &= o[e][t + c].cell.__headerState;
		return n;
	}), f = t.__headerState & z.ROW, p = Array.from({ length: a }, (e, t) => {
		let n = f;
		for (let e = 0; n !== 0 && e < o[0].length; e++) n &= o[t + l][e].cell.__headerState;
		return n;
	});
	if (i > 1) {
		for (let e = 1; e < i; e++) t.insertAfter(V(d[e] | p[0]).append(A()));
		t.setColSpan(1);
	}
	if (a > 1) {
		let e;
		for (let t = 1; t < a; t++) {
			let r = l + t, a = o[r];
			e = (e || n).getNextSibling(), W(e) || U(125);
			let s = null;
			for (let e = 0; e < c; e++) {
				let t = a[e], n = t.cell;
				t.startRow === r && (s = n), n.__colSpan > 1 && (e += n.__colSpan - 1);
			}
			if (s === null) for (let n = i - 1; n >= 0; n--) St(e, V(d[n] | p[t]).append(A()));
			else for (let e = i - 1; e >= 0; e--) s.insertAfter(V(d[e] | p[t]).append(A()));
		}
		t.setRowSpan(1);
	}
}
function G(e, t, n) {
	let [r, i, a] = K(e, t, n);
	return i === null && U(207), a === null && U(208), [
		r,
		i,
		a
	];
}
function K(e, t, n) {
	let r = [], i = null, a = null;
	function o(e) {
		let t = r[e];
		return t === void 0 && (r[e] = t = []), t;
	}
	let s = e.getChildren();
	for (let e = 0; e < s.length; e++) {
		let r = s[e];
		W(r) || U(209);
		let c = o(e);
		for (let l = r.getFirstChild(), u = 0; l != null; l = l.getNextSibling()) {
			for (H(l) || U(147); c[u] !== void 0;) u++;
			let r = {
				cell: l,
				startColumn: u,
				startRow: e
			}, { __rowSpan: d, __colSpan: f } = l;
			for (let t = 0; t < d && !(e + t >= s.length); t++) {
				let n = o(e + t);
				for (let e = 0; e < f; e++) n[u + e] = r;
			}
			t !== null && i === null && t.is(l) && (i = r), n !== null && a === null && n.is(l) && (a = r);
		}
	}
	return [
		r,
		i,
		a
	];
}
function q(e) {
	let t;
	if (e instanceof B) t = e;
	else if ("__type" in e) {
		let n = F(e, H);
		H(n) || U(148), t = n;
	} else {
		let n = F(e.getNode(), H);
		H(n) || U(148), t = n;
	}
	let n = t.getParent();
	W(n) || U(149);
	let r = n.getParent();
	return Q(r) || U(210), [
		t,
		n,
		r
	];
}
function Et(e, t, n) {
	let r, i = Math.min(t.startColumn, n.startColumn), a = Math.min(t.startRow, n.startRow), o = Math.max(t.startColumn + t.cell.__colSpan - 1, n.startColumn + n.cell.__colSpan - 1), s = Math.max(t.startRow + t.cell.__rowSpan - 1, n.startRow + n.cell.__rowSpan - 1);
	do {
		r = !1;
		for (let t = 0; t < e.length; t++) for (let n = 0; n < e[0].length; n++) {
			let c = e[t][n];
			if (!c) continue;
			let l = c.startColumn + c.cell.__colSpan - 1, u = c.startRow + c.cell.__rowSpan - 1, d = c.startColumn <= o && l >= i, f = c.startRow <= s && u >= a;
			if (d && f) {
				let e = Math.min(i, c.startColumn), t = Math.max(o, l), n = Math.min(a, c.startRow), d = Math.max(s, u);
				e === i && t === o && n === a && d === s || (i = e, o = t, a = n, s = d, r = !0);
			}
		}
	} while (r);
	return {
		maxColumn: o,
		maxRow: s,
		minColumn: i,
		minRow: a
	};
}
function Dt(e) {
	let [t, , n] = q(e), r = n.getChildren(), i = r.length, a = r[0].getChildren().length, o = Array(i);
	for (let e = 0; e < i; e++) o[e] = Array(a);
	for (let e = 0; e < i; e++) {
		let n = r[e].getChildren(), i = 0;
		for (let r = 0; r < n.length; r++) {
			for (; o[e][i];) i++;
			let a = n[r], s = a.__rowSpan || 1, c = a.__colSpan || 1;
			for (let t = 0; t < s; t++) for (let n = 0; n < c; n++) o[e + t][i + n] = a;
			if (t === a) return {
				colSpan: c,
				columnIndex: i,
				rowIndex: e,
				rowSpan: s
			};
			i += c;
		}
	}
	return null;
}
function Ot(e) {
	let [[t, n, r, i], [a, o, s, c]] = ["anchor", "focus"].map((t) => {
		let n = e[t].getNode(), r = F(n, H);
		H(r) || U(238, t, n.getKey(), n.getType());
		let i = r.getParent();
		W(i) || U(239, t);
		let a = i.getParent();
		return Q(a) || U(240, t), [
			n,
			r,
			i,
			a
		];
	});
	return i.is(c) || U(241), {
		anchorCell: n,
		anchorNode: t,
		anchorRow: r,
		anchorTable: i,
		focusCell: o,
		focusNode: a,
		focusRow: s,
		focusTable: c
	};
}
var kt = class e {
	tableKey;
	anchor;
	focus;
	_cachedNodes;
	dirty;
	constructor(e, t, n) {
		this.anchor = t, this.focus = n, t._selection = this, n._selection = this, this._cachedNodes = null, this.dirty = !1, this.tableKey = e;
	}
	getStartEndPoints() {
		return [this.anchor, this.focus];
	}
	isValid() {
		if (this.tableKey === "root" || this.anchor.key === "root" || this.anchor.type !== "element" || this.focus.key === "root" || this.focus.type !== "element") return !1;
		let e = P(this.tableKey), t = P(this.anchor.key), n = P(this.focus.key);
		return e !== null && t !== null && n !== null;
	}
	isBackward() {
		return this.focus.isBefore(this.anchor);
	}
	getCachedNodes() {
		return this._cachedNodes;
	}
	setCachedNodes(e) {
		this._cachedNodes = e;
	}
	is(e) {
		return J(e) && this.tableKey === e.tableKey && this.anchor.is(e.anchor) && this.focus.is(e.focus);
	}
	set(e, t, n) {
		this.dirty = this.dirty || e !== this.tableKey || t !== this.anchor.key || n !== this.focus.key, this.tableKey = e, this.anchor.key = t, this.focus.key = n, this._cachedNodes = null;
	}
	clone() {
		return new e(this.tableKey, f(this.anchor.key, this.anchor.offset, this.anchor.type), f(this.focus.key, this.focus.offset, this.focus.type));
	}
	isCollapsed() {
		return !1;
	}
	extract() {
		return this.getNodes();
	}
	insertRawText(e) {}
	insertText() {}
	hasFormat(e) {
		let t = 0;
		this.getNodes().filter(H).forEach((e) => {
			let n = e.getFirstChild();
			m(n) && (t |= n.getTextFormat());
		});
		let n = Ie[e];
		return (t & n) !== 0;
	}
	insertNodes(e) {
		let t = this.focus.getNode();
		S(t) || U(151), Ae(t.select(0, t.getChildrenSize())).insertNodes(e);
	}
	getShape() {
		let { anchorCell: e, focusCell: t } = Ot(this), n = Dt(e);
		n === null && U(153);
		let r = Dt(t);
		r === null && U(155);
		let i = Math.min(n.columnIndex, r.columnIndex), a = Math.max(n.columnIndex + n.colSpan - 1, r.columnIndex + r.colSpan - 1), o = Math.min(n.rowIndex, r.rowIndex), s = Math.max(n.rowIndex + n.rowSpan - 1, r.rowIndex + r.rowSpan - 1);
		return {
			fromX: Math.min(i, a),
			fromY: Math.min(o, s),
			toX: Math.max(i, a),
			toY: Math.max(o, s)
		};
	}
	getNodes() {
		if (!this.isValid()) return [];
		let e = this._cachedNodes;
		if (e !== null) return e;
		let { anchorTable: t, anchorCell: n, focusCell: r } = Ot(this), i = r.getParents()[1];
		if (i !== t) {
			if (t.isParentOf(r)) {
				let e = i.getParent();
				e ?? U(159), this.set(this.tableKey, r.getKey(), e.getKey());
			} else {
				let e = t.getParent();
				e ?? U(158), this.set(this.tableKey, e.getKey(), r.getKey());
			}
			return this.getNodes();
		}
		let [a, o, s] = G(t, n, r), { minColumn: c, maxColumn: l, minRow: u, maxRow: d } = Et(a, o, s), f = /* @__PURE__ */ new Map([[t.getKey(), t]]), p = null;
		for (let e = u; e <= d; e++) for (let t = c; t <= l; t++) {
			let { cell: n } = a[e][t], r = n.getParent();
			W(r) || U(160), r !== p && (f.set(r.getKey(), r), p = r), f.has(n.getKey()) || Mt(n, (e) => {
				f.set(e.getKey(), e);
			});
		}
		let m = Array.from(f.values());
		return ke() || (this._cachedNodes = m), m;
	}
	getTextContent() {
		let e = this.getNodes().filter((e) => H(e)), t = "";
		for (let n = 0; n < e.length; n++) {
			let r = e[n], i = r.__parent, a = (e[n + 1] || {}).__parent;
			t += r.getTextContent() + (a === i ? "	" : "\n");
		}
		return t;
	}
};
function J(e) {
	return e instanceof kt;
}
function At() {
	return new kt("root", f("root", 0, "element"), f("root", 0, "element"));
}
function jt(e, t, n) {
	e.getKey(), t.getKey(), n.getKey();
	let r = E(), i = J(r) ? r.clone() : At();
	return i.set(e.getKey(), t.getKey(), n.getKey()), i;
}
function Mt(e, t) {
	let n = [[e]];
	for (let e = n.at(-1); e !== void 0 && n.length > 0; e = n.at(-1)) {
		let r = e.pop();
		r === void 0 ? n.pop() : !1 !== t(r) && S(r) && n.push(r.getChildren());
	}
}
function Nt(e, t = ze()) {
	let n = P(e);
	Q(n) || U(231, e);
	let r = Y(n, t.getElementByKey(e));
	return r === null && U(232, e), {
		tableElement: r,
		tableNode: n
	};
}
var Pt = class {
	focusX;
	focusY;
	listenersToRemove;
	table;
	isHighlightingCells;
	anchorX;
	anchorY;
	tableNodeKey;
	anchorCell;
	focusCell;
	anchorCellNodeKey;
	focusCellNodeKey;
	editor;
	tableSelection;
	hasHijackedSelectionStyles;
	isSelecting;
	pointerType;
	shouldCheckSelection;
	abortController;
	listenerOptions;
	nextFocus;
	constructor(e, t) {
		this.isHighlightingCells = !1, this.anchorX = -1, this.anchorY = -1, this.focusX = -1, this.focusY = -1, this.listenersToRemove = /* @__PURE__ */ new Set(), this.tableNodeKey = t, this.editor = e, this.table = {
			columns: 0,
			domRows: [],
			rows: 0
		}, this.tableSelection = null, this.anchorCellNodeKey = null, this.focusCellNodeKey = null, this.anchorCell = null, this.focusCell = null, this.hasHijackedSelectionStyles = !1, this.isSelecting = !1, this.pointerType = null, this.shouldCheckSelection = !1, this.abortController = new AbortController(), this.listenerOptions = { signal: this.abortController.signal }, this.nextFocus = null, this.trackTable();
	}
	getTable() {
		return this.table;
	}
	removeListeners() {
		this.abortController.abort("removeListeners"), Array.from(this.listenersToRemove).forEach((e) => e()), this.listenersToRemove.clear();
	}
	$lookup() {
		return Nt(this.tableNodeKey, this.editor);
	}
	trackTable() {
		let e = new MutationObserver((e) => {
			this.editor.getEditorState().read(() => {
				let t = !1;
				for (let n = 0; n < e.length; n++) {
					let r = e[n].target.nodeName;
					if (r === "TABLE" || r === "TBODY" || r === "THEAD" || r === "TR") {
						t = !0;
						break;
					}
				}
				if (!t) return;
				let { tableNode: n, tableElement: r } = this.$lookup();
				this.table = Kt(n, r);
			}, { editor: this.editor });
		});
		this.editor.getEditorState().read(() => {
			let { tableNode: t, tableElement: n } = this.$lookup();
			this.table = Kt(t, n), e.observe(n, {
				attributes: !0,
				childList: !0,
				subtree: !0
			});
		}, { editor: this.editor });
	}
	$clearHighlight() {
		let e = this.editor;
		this.isHighlightingCells = !1, this.anchorX = -1, this.anchorY = -1, this.focusX = -1, this.focusY = -1, this.tableSelection = null, this.anchorCellNodeKey = null, this.focusCellNodeKey = null, this.anchorCell = null, this.focusCell = null, this.hasHijackedSelectionStyles = !1, this.$enableHighlightStyle();
		let { tableNode: t, tableElement: n } = this.$lookup();
		qt(e, Kt(t, n), null), E() !== null && (o(null), e.dispatchCommand(Ve, void 0));
	}
	$enableHighlightStyle() {
		let e = this.editor, { tableElement: t } = this.$lookup();
		k(t, e._config.theme.tableSelection), t.classList.remove("disable-selection"), this.hasHijackedSelectionStyles = !1;
	}
	$disableHighlightStyle() {
		let { tableElement: e } = this.$lookup();
		I(e, this.editor._config.theme.tableSelection), this.hasHijackedSelectionStyles = !0;
	}
	$updateTableTableSelection(e) {
		if (e !== null) {
			e.tableKey !== this.tableNodeKey && U(233, e.tableKey, this.tableNodeKey);
			let t = this.editor;
			this.tableSelection = e, this.isHighlightingCells = !0, this.$disableHighlightStyle(), this.updateDOMSelection(), qt(t, this.table, this.tableSelection);
		} else this.$clearHighlight();
	}
	setShouldCheckSelection() {
		this.shouldCheckSelection = !0;
	}
	getAndClearShouldCheckSelection() {
		return !!this.shouldCheckSelection && (this.shouldCheckSelection = !1, !0);
	}
	setNextFocus(e) {
		this.nextFocus = e;
	}
	getAndClearNextFocus() {
		let { nextFocus: e } = this;
		return e !== null && (this.nextFocus = null), e;
	}
	updateDOMSelection() {
		if (this.anchorCell !== null && this.focusCell !== null) {
			let e = D(this.editor._window);
			e && e.rangeCount > 0 && e.removeAllRanges();
		}
	}
	$setFocusCellForSelection(e, t = !1) {
		let n = this.editor, { tableNode: r } = this.$lookup(), i = e.x, a = e.y;
		if (this.focusCell = e, !this.isHighlightingCells && (t || this.anchorX !== i || this.anchorY !== a || this.tableSelection != null && this.anchorCellNodeKey != null) && (this.isHighlightingCells = !0, this.$disableHighlightStyle()), this.focusX !== -1 && this.focusY !== -1 && i === this.focusX && a === this.focusY) return !1;
		if (this.focusX = i, this.focusY = a, this.isHighlightingCells) {
			let s = fn(r, e.elem);
			if (this.tableSelection != null && this.anchorCellNodeKey != null) {
				let e = s;
				if (e === null && t && (e = r.getCellNodeFromCords(i, a, this.table)), e !== null) {
					let t = this.$getAnchorTableCellOrThrow();
					return this.focusCellNodeKey = e.getKey(), this.tableSelection = jt(r, t, e), o(this.tableSelection), n.dispatchCommand(Ve, void 0), qt(n, this.table, this.tableSelection), !0;
				}
			}
		}
		return !1;
	}
	$getAnchorTableCell() {
		return this.anchorCellNodeKey ? P(this.anchorCellNodeKey) : null;
	}
	$getAnchorTableCellOrThrow() {
		let e = this.$getAnchorTableCell();
		return e === null && U(234), e;
	}
	$getFocusTableCell() {
		return this.focusCellNodeKey ? P(this.focusCellNodeKey) : null;
	}
	$getFocusTableCellOrThrow() {
		let e = this.$getFocusTableCell();
		return e === null && U(235), e;
	}
	$setAnchorCellForSelection(e) {
		this.isHighlightingCells = !1, this.anchorCell = e, this.anchorX = e.x, this.anchorY = e.y, this.focusX = -1, this.focusY = -1, this.focusCell = null, this.focusCellNodeKey = null;
		let { tableNode: t } = this.$lookup(), n = fn(t, e.elem);
		if (n !== null) {
			let e = n.getKey();
			this.tableSelection == null ? this.tableSelection = jt(t, n, n) : (this.tableSelection = this.tableSelection.clone(), this.tableSelection.set(t.getKey(), e, e)), this.anchorCellNodeKey = e;
		}
	}
	$formatCells(e) {
		let t = E();
		J(t) || U(236);
		let n = He(), r = n.anchor, i = n.focus, a = t.getNodes().filter(H);
		a.length > 0 || U(237);
		let s = a[0].getFirstChild(), c = m(s) ? s.getFormatFlags(e, null) : null;
		a.forEach((t) => {
			r.set(t.getKey(), 0, "element"), i.set(t.getKey(), t.getChildrenSize(), "element"), n.formatText(e, c);
		}), o(t), this.editor.dispatchCommand(Ve, void 0);
	}
	$clearText() {
		let { editor: e } = this, t = P(this.tableNodeKey);
		if (!Q(t)) throw Error("Expected TableNode.");
		let n = E();
		J(n) || U(253);
		let r = n.getNodes().filter(H), i = t.getFirstChild(), a = t.getLastChild();
		if (r.length > 0 && i !== null && a !== null && W(i) && W(a) && r[0] === i.getFirstChild() && r[r.length - 1] === a.getLastChild()) {
			t.selectPrevious();
			let n = t.getParent();
			t.remove(), ye(n) && n.isEmpty() && e.dispatchCommand(pe, void 0);
		} else r.forEach((e) => {
			if (S(e)) {
				let t = A(), n = je();
				t.append(n), e.append(t), e.getChildren().forEach((e) => {
					e !== t && e.remove();
				});
			}
		}), qt(e, this.table, null), o(null), e.dispatchCommand(Ve, void 0);
	}
}, Ft = "__lexicalTableSelection";
function It(e) {
	return ce(e) && e.nodeName === "TABLE";
}
function Y(e, t) {
	if (!t) return t;
	let n = It(t) ? t : e.getDOMSlot(t).element;
	return n.nodeName !== "TABLE" && U(245, t.nodeName), n;
}
function Lt(e) {
	return e._window;
}
function Rt(e, t) {
	for (let n = t, r = null; n !== null; n = n.getParent()) {
		if (e.is(n)) return r;
		H(n) && (r = n);
	}
	return null;
}
var zt = [
	[u, "down"],
	[Se, "up"],
	[O, "backward"],
	[ae, "forward"]
], Bt = [
	p,
	t,
	d
], Vt = [ee, w];
function Ht(n, r, i, a) {
	let s = i.getRootElement(), c = Lt(i);
	s !== null && c !== null || U(246);
	let l = new Pt(i, n.getKey()), u = Y(n, r);
	(function(e, t) {
		Ut(e) !== null && U(205), e[Ft] = t;
	})(u, l), l.listenersToRemove.add(() => function(e, t) {
		Ut(e) === t && delete e[Ft];
	}(u, l));
	let d = (e) => {
		if (l.pointerType = e.pointerType, e.button !== 0 || !De(e.target) || !c) return;
		let t = Wt(e.target);
		t !== null && i.update(() => {
			let r = le();
			if (ht && e.shiftKey && X(r, n) && (j(r) || J(r))) {
				let i = r.anchor.getNode(), a = Rt(n, r.anchor.getNode());
				a ? (l.$setAnchorCellForSelection(dn(l, a)), l.$setFocusCellForSelection(t), Z(e)) : (n.isBefore(i) ? n.selectStart() : n.selectEnd()).anchor.set(r.anchor.key, r.anchor.offset, r.anchor.type);
			} else e.pointerType !== "touch" && l.$setAnchorCellForSelection(t);
		}), ((e) => {
			if (l.isSelecting) return;
			l.isSelecting = !0, e !== null && l.anchorCell === null && i.update(() => {
				l.$setAnchorCellForSelection(e);
			});
			let t = () => {
				l.isSelecting = !1, c.removeEventListener("pointerup", t), c.removeEventListener("pointermove", n);
			}, n = (e) => {
				if (1 & ~e.buttons && l.isSelecting) return l.isSelecting = !1, c.removeEventListener("pointerup", t), void c.removeEventListener("pointermove", n);
				if (!De(e.target)) return;
				let r = null, a = !(ht || u.contains(e.target));
				if (a) r = Gt(u, e.target);
				else for (let t of document.elementsFromPoint(e.clientX, e.clientY)) if (r = Gt(u, t), r) break;
				if (r) {
					let e = r;
					l.anchorCell === null && i.update(() => {
						l.$setAnchorCellForSelection(e);
					}), l.focusCell !== null && r.elem === l.focusCell.elem || (l.setNextFocus({
						focusCell: r,
						override: a
					}), i.dispatchCommand(Ve, void 0));
				}
			};
			c.addEventListener("pointerup", t, l.listenerOptions), c.addEventListener("pointermove", n, l.listenerOptions);
		})(t);
	};
	u.addEventListener("pointerdown", d, l.listenerOptions), l.listenersToRemove.add(() => {
		u.removeEventListener("pointerdown", d);
	});
	let f = (e) => {
		e.detail >= 3 && De(e.target) && Wt(e.target) !== null && e.preventDefault();
	};
	u.addEventListener("mousedown", f, l.listenerOptions), l.listenersToRemove.add(() => {
		u.removeEventListener("mousedown", f);
	});
	let p = (e) => {
		let t = e.target;
		e.button === 0 && De(t) && i.update(() => {
			let e = E();
			J(e) && e.tableKey === l.tableNodeKey && s.contains(t) && l.$clearHighlight();
		});
	};
	c.addEventListener("pointerdown", p, l.listenerOptions), l.listenersToRemove.add(() => {
		c.removeEventListener("pointerdown", p);
	});
	for (let [e, t] of zt) l.listenersToRemove.add(i.registerCommand(e, (e) => cn(i, e, t, n, l), 3));
	l.listenersToRemove.add(i.registerCommand(e, (e) => {
		let t = E();
		if (J(t)) {
			let r = Rt(n, t.focus.getNode());
			if (r !== null) return Z(e), r.selectEnd(), !0;
		}
		return !1;
	}, 3));
	let m = (e) => () => {
		let r = E();
		if (!X(r, n)) return !1;
		if (J(r)) return l.$clearText(), !0;
		if (j(r)) {
			if (!H(Rt(n, r.anchor.getNode()))) return !1;
			let i = r.anchor.getNode(), a = r.focus.getNode(), o = n.isParentOf(i), s = n.isParentOf(a);
			if (o && !s || s && !o) return l.$clearText(), !0;
			let c = F(r.anchor.getNode(), (e) => S(e)), u = c && F(c, (e) => S(e) && H(e.getParent()));
			if (!S(u) || !S(c)) return !1;
			if (e === t && u.getPreviousSibling() === null) return !0;
		}
		return !1;
	};
	for (let e of Bt) l.listenersToRemove.add(i.registerCommand(e, m(e), 3));
	let h = (e) => {
		let t = E();
		if (!J(t) && !j(t)) return !1;
		let r = n.isParentOf(t.anchor.getNode());
		if (r !== n.isParentOf(t.focus.getNode())) {
			let e = r ? "anchor" : "focus", i = r ? "focus" : "anchor", { key: a, offset: o, type: s } = t[i];
			return n[t[e].isBefore(t[i]) ? "selectPrevious" : "selectNext"]()[i].set(a, o, s), !1;
		}
		return !!X(t, n) && !!J(t) && (e && (e.preventDefault(), e.stopPropagation()), l.$clearText(), !0);
	};
	for (let e of Vt) l.listenersToRemove.add(i.registerCommand(e, h, 3));
	return l.listenersToRemove.add(i.registerCommand(Be, (e) => {
		let t = E();
		if (t) {
			if (!J(t) && !j(t)) return !1;
			Le(i, te(e, ClipboardEvent) ? e : null, me(t));
			let n = h(e);
			return j(t) ? (t.removeText(), !0) : n;
		}
		return !1;
	}, 3)), l.listenersToRemove.add(i.registerCommand(C, (e) => {
		let t = E();
		return X(t, n) ? J(t) ? (l.$formatCells(e), !0) : (j(t) && H(F(t.anchor.getNode(), (e) => H(e))), !1) : !1;
	}, 3)), l.listenersToRemove.add(i.registerCommand(Oe, (e) => {
		let t = E();
		if (!J(t) || !X(t, n)) return !1;
		let r = t.anchor.getNode(), i = t.focus.getNode();
		if (!H(r) || !H(i)) return !1;
		if (function(e, t) {
			if (J(e)) {
				let n = e.anchor.getNode(), r = e.focus.getNode();
				if (t && n && r) {
					let [e] = G(t, n, r);
					return n.getKey() === e[0][0].cell.getKey() && r.getKey() === e[e.length - 1].at(-1).cell.getKey();
				}
			}
			return !1;
		}(t, n)) return n.setFormat(e), !0;
		let [a, o, s] = G(n, r, i), c = Math.max(o.startRow + o.cell.__rowSpan - 1, s.startRow + s.cell.__rowSpan - 1), l = Math.max(o.startColumn + o.cell.__colSpan - 1, s.startColumn + s.cell.__colSpan - 1), u = Math.min(o.startRow, s.startRow), d = Math.min(o.startColumn, s.startColumn), f = /* @__PURE__ */ new Set();
		for (let t = u; t <= c; t++) for (let n = d; n <= l; n++) {
			let r = a[t][n].cell;
			if (f.has(r)) continue;
			f.add(r), r.setFormat(e);
			let i = r.getChildren();
			for (let t = 0; t < i.length; t++) {
				let n = i[t];
				S(n) && !n.isInline() && n.setFormat(e);
			}
		}
		return !0;
	}, 3)), l.listenersToRemove.add(i.registerCommand(xe, (e) => {
		let t = E();
		if (!X(t, n)) return !1;
		if (J(t)) return l.$clearHighlight(), !1;
		if (j(t)) {
			if (!H(F(t.anchor.getNode(), (e) => H(e)))) return !1;
			if (typeof e == "string") {
				let r = un(i, t, n);
				if (r) return ln(r, n, [je(e)]), !0;
			}
		}
		return !1;
	}, 3)), a && l.listenersToRemove.add(i.registerCommand(Pe, (e) => {
		let t = E();
		if (!j(t) || !t.isCollapsed() || !X(t, n)) return !1;
		let r = an(t.anchor.getNode());
		return !(r === null || !n.is(on(r))) && (Z(e), function(e, t) {
			let n = t === "next" ? "getNextSibling" : "getPreviousSibling", r = t === "next" ? "getFirstChild" : "getLastChild", i = e[n]();
			if (S(i)) return i.selectEnd();
			let a = F(e, W);
			a === null && U(247);
			for (let e = a[n](); W(e); e = e[n]()) {
				let t = e[r]();
				if (S(t)) return t.selectEnd();
			}
			let o = F(a, Q);
			o === null && U(248), t === "next" ? o.selectNext() : o.selectPrevious();
		}(r, e.shiftKey ? "previous" : "next"), !0);
	}, 3)), l.listenersToRemove.add(i.registerCommand(fe, (e) => n.isSelected(), 3)), l.listenersToRemove.add(i.registerCommand(Ve, () => {
		let e = E(), t = le(), r = l.getAndClearNextFocus();
		if (r !== null) {
			let { focusCell: t } = r;
			if (J(e) && e.tableKey === l.tableNodeKey) return (t.x !== l.focusX || t.y !== l.focusY) && (l.$setFocusCellForSelection(t), !0);
			if (t !== l.anchorCell && l.anchorCell !== null && l.anchorCellNodeKey !== null && l.tableSelection !== null) return l.$setFocusCellForSelection(t, !0), !0;
		}
		if (l.getAndClearShouldCheckSelection() && j(t) && j(e) && e.isCollapsed()) {
			let t = e.anchor.getNode(), r = n.getFirstChild(), i = an(t);
			if (i !== null && W(r)) {
				let e = r.getFirstChild();
				if (H(e) && n.is(F(i, (t) => t.is(n) || t.is(e)))) return e.selectStart(), !0;
			}
		}
		if (j(e)) {
			let { anchor: r, focus: a } = e, s = r.getNode(), c = a.getNode(), u = an(s), d = an(c), f = !(!u || !n.is(on(u))), p = !(!d || !n.is(on(d))), m = f !== p, h = f && p, g = e.isBackward();
			if (m) {
				let t = e.clone();
				if (p) {
					let [e] = G(n, d, d), r = e[0][0].cell, i = e[e.length - 1].at(-1).cell;
					t.focus.set(g ? r.getKey() : i.getKey(), g ? 0 : i.getChildrenSize(), "element");
				} else if (f) {
					let [e] = G(n, u, u), r = e[0][0].cell, i = e[e.length - 1].at(-1).cell;
					t.anchor.set(g ? i.getKey() : r.getKey(), g ? i.getChildrenSize() : 0, "element");
				}
				o(t), Yt(i, l);
			} else if (h && (u.is(d) || (l.$setAnchorCellForSelection(dn(l, u)), l.$setFocusCellForSelection(dn(l, d), !0)), l.pointerType === "touch" && l.isSelecting && e.isCollapsed() && j(t) && t.isCollapsed())) {
				let e = an(t.anchor.getNode());
				e && !e.is(d) && (l.$setAnchorCellForSelection(dn(l, e)), l.$setFocusCellForSelection(dn(l, d), !0), l.pointerType = null);
			}
		} else if (e && J(e) && e.is(t) && e.tableKey === n.getKey()) {
			let t = D(c);
			if (t && t.anchorNode && t.focusNode) {
				let r = M(t.focusNode), a = r && !n.isParentOf(r), s = M(t.anchorNode), c = s && n.isParentOf(s);
				if (a && c && t.rangeCount > 0) {
					let r = oe(t, i);
					r && (r.anchor.set(n.getKey(), e.isBackward() ? n.getChildrenSize() : 0, "element"), t.removeAllRanges(), o(r));
				}
			}
		}
		return e && !e.is(t) && (J(e) || J(t)) && l.tableSelection && !l.tableSelection.is(t) ? (J(e) && e.tableKey === l.tableNodeKey ? l.$updateTableTableSelection(e) : !J(e) && J(t) && t.tableKey === l.tableNodeKey && l.$updateTableTableSelection(null), !1) : (l.hasHijackedSelectionStyles && !n.isSelected() ? function(e, t) {
			t.$enableHighlightStyle(), Jt(t.table, (t) => {
				let n = t.elem;
				t.highlighted = !1, rn(e, t), n.getAttribute("style") || n.removeAttribute("style");
			});
		}(i, l) : !l.hasHijackedSelectionStyles && n.isSelected() && Yt(i, l), !1);
	}, 3)), l.listenersToRemove.add(i.registerCommand(pe, () => {
		let e = E();
		if (!j(e) || !e.isCollapsed() || !X(e, n)) return !1;
		let t = un(i, e, n);
		return !!t && (ln(t, n), !0);
	}, 3)), l;
}
function Ut(e) {
	return e[Ft] || null;
}
function Wt(e) {
	let t = e;
	for (; t != null;) {
		let e = t.nodeName;
		if (e === "TD" || e === "TH") {
			let e = t._cell;
			return e === void 0 ? null : e;
		}
		t = t.parentNode;
	}
	return null;
}
function Gt(e, t) {
	if (!e.contains(t)) return null;
	let n = null;
	for (let r = t; r != null; r = r.parentNode) {
		if (r === e) return n;
		let t = r.nodeName;
		t !== "TD" && t !== "TH" || (n = r._cell || null);
	}
	return null;
}
function Kt(e, t) {
	let n = [], r = {
		columns: 0,
		domRows: n,
		rows: 0
	}, i = Y(e, t).querySelector("tr"), a = 0, o = 0;
	for (n.length = 0; i != null;) {
		let e = i.nodeName;
		if (e === "TD" || e === "TH") {
			let e = {
				elem: i,
				hasBackgroundColor: i.style.backgroundColor !== "",
				highlighted: !1,
				x: a,
				y: o
			};
			i._cell = e;
			let t = n[o];
			t === void 0 && (t = n[o] = []), t[a] = e;
		} else {
			let e = i.firstChild;
			if (e != null) {
				i = e;
				continue;
			}
		}
		let t = i.nextSibling;
		if (t != null) {
			a++, i = t;
			continue;
		}
		let r = i.parentNode;
		if (r != null) {
			let e = r.nextSibling;
			if (e == null) break;
			o++, a = 0, i = e;
		}
	}
	return r.columns = a + 1, r.rows = o + 1, r;
}
function qt(e, t, n) {
	let r = new Set(n ? n.getNodes() : []);
	Jt(t, (t, n) => {
		let i = t.elem;
		r.has(n) ? (t.highlighted = !0, nn(e, t)) : (t.highlighted = !1, rn(e, t), i.getAttribute("style") || i.removeAttribute("style"));
	});
}
function Jt(e, t) {
	let { domRows: n } = e;
	for (let e = 0; e < n.length; e++) {
		let r = n[e];
		if (r) for (let n = 0; n < r.length; n++) {
			let i = r[n];
			if (!i) continue;
			let a = M(i.elem);
			a !== null && t(i, a, {
				x: n,
				y: e
			});
		}
	}
}
function Yt(e, t) {
	t.$disableHighlightStyle(), Jt(t.table, (t) => {
		t.highlighted = !0, nn(e, t);
	});
}
var Xt = (e, t, n, r, i) => {
	let a = i === "forward";
	switch (i) {
		case "backward":
		case "forward": return n === (a ? e.table.columns - 1 : 0) ? r === (a ? e.table.rows - 1 : 0) ? a ? t.selectNext() : t.selectPrevious() : tn(t.getCellNodeFromCordsOrThrow(a ? 0 : e.table.columns - 1, r + (a ? 1 : -1), e.table), a) : tn(t.getCellNodeFromCordsOrThrow(n + (a ? 1 : -1), r, e.table), a), !0;
		case "up": return r === 0 ? t.selectPrevious() : tn(t.getCellNodeFromCordsOrThrow(n, r - 1, e.table), !1), !0;
		case "down": return r === e.table.rows - 1 ? t.selectNext() : tn(t.getCellNodeFromCordsOrThrow(n, r + 1, e.table), !0), !0;
		default: return !1;
	}
};
function Zt(e, t) {
	let n, r;
	if (t.startColumn === e.minColumn) n = "minColumn";
	else {
		if (t.startColumn + t.cell.__colSpan - 1 !== e.maxColumn) return null;
		n = "maxColumn";
	}
	if (t.startRow === e.minRow) r = "minRow";
	else {
		if (t.startRow + t.cell.__rowSpan - 1 !== e.maxRow) return null;
		r = "maxRow";
	}
	return [n, r];
}
function Qt([e, t]) {
	return [e === "minColumn" ? "maxColumn" : "minColumn", t === "minRow" ? "maxRow" : "minRow"];
}
function $t(e, t, [n, r]) {
	let i = t[r], a = e[i];
	a === void 0 && U(250, r, String(i));
	let o = t[n], s = a[o];
	return s === void 0 && U(250, n, String(o)), s;
}
function en(e, t, n, r, i) {
	let a = Et(t, n, r), { topSpan: o, leftSpan: s, bottomSpan: c, rightSpan: l } = function(e, t) {
		let { minColumn: n, maxColumn: r, minRow: i, maxRow: a } = t, o = 1, s = 1, c = 1, l = 1, u = e[i], d = e[a];
		for (let e = n; e <= r; e++) o = Math.max(o, u[e].cell.__rowSpan), l = Math.max(l, d[e].cell.__rowSpan);
		for (let t = i; t <= a; t++) s = Math.max(s, e[t][n].cell.__colSpan), c = Math.max(c, e[t][r].cell.__colSpan);
		return {
			bottomSpan: l,
			leftSpan: s,
			rightSpan: c,
			topSpan: o
		};
	}(t, a), [u, d] = Qt(function(e, t) {
		let n = Zt(e, t);
		return n === null && U(249, t.cell.getKey()), n;
	}(a, n)), f = a[u], p = a[d];
	i === "forward" ? f += u === "maxColumn" ? 1 : s : i === "backward" ? f -= u === "minColumn" ? 1 : l : i === "down" ? p += d === "maxRow" ? 1 : o : i === "up" && (p -= d === "minRow" ? 1 : c);
	let m = t[p];
	if (m === void 0) return !1;
	let h = m[f];
	if (h === void 0) return !1;
	let [g, _] = function(e, t, n) {
		let r = Et(e, t, n), i = Zt(r, t);
		if (i) return [$t(e, r, i), $t(e, r, Qt(i))];
		let a = Zt(r, n);
		if (a) return [$t(e, r, Qt(a)), $t(e, r, a)];
		let o = ["minColumn", "minRow"];
		return [$t(e, r, o), $t(e, r, Qt(o))];
	}(t, n, h), v = dn(e, g.cell), y = dn(e, _.cell);
	return e.$setAnchorCellForSelection(v), e.$setFocusCellForSelection(y, !0), !0;
}
function X(e, t) {
	if (j(e) || J(e)) {
		let n = t.isParentOf(e.anchor.getNode()), r = t.isParentOf(e.focus.getNode());
		return n && r;
	}
	return !1;
}
function tn(e, t) {
	t ? e.selectStart() : e.selectEnd();
}
function nn(e, t) {
	let n = t.elem, r = e._config.theme;
	H(M(n)) || U(131), I(n, r.tableCellSelected);
}
function rn(e, t) {
	let n = t.elem;
	H(M(n)) || U(131);
	let r = e._config.theme;
	k(n, r.tableCellSelected);
}
function an(e) {
	let t = F(e, H);
	return H(t) ? t : null;
}
function on(e) {
	let t = F(e, Q);
	return Q(t) ? t : null;
}
function sn(e, t, n, r, o, s, l) {
	let u = de(n.focus, o ? "previous" : "next");
	if (a(u)) return !1;
	let d = u;
	for (let e of he(u).iterNodeCarets("shadowRoot")) {
		if (!b(e) || !S(e.origin)) return !1;
		d = e;
	}
	let f = d.getParentAtCaret();
	if (!H(f)) return !1;
	let p = f, m = function(e) {
		for (let t of he(e).iterNodeCarets("root")) {
			let { origin: n } = t;
			if (H(n)) {
				if (i(t)) return Re(n, e.direction);
			} else if (!W(n)) break;
		}
		return null;
	}(c(p, d.direction)), h = F(p, Q);
	if (!h || !h.is(s)) return !1;
	let _ = e.getElementByKey(p.getKey()), v = Wt(_);
	if (!_ || !v) return !1;
	if (l.table = vn(e, h), m) {
		if (r === "extend") {
			let t = Wt(e.getElementByKey(m.origin.getKey()));
			if (!t) return !1;
			l.$setAnchorCellForSelection(v), l.$setFocusCellForSelection(t, !0);
		} else {
			let e = re(m);
			g(n.anchor, e), g(n.focus, e);
		}
	} else if (r === "extend") l.$setAnchorCellForSelection(v), l.$setFocusCellForSelection(v, !0);
	else {
		let e = function(e) {
			let t = ve(e);
			return i(t) ? re(t) : e;
		}(c(h, u.direction));
		g(n.anchor, e), g(n.focus, e);
	}
	return Z(t), !0;
}
function cn(e, t, n, r, i) {
	if ((n === "up" || n === "down") && function(e) {
		let t = e.getRootElement();
		return t ? t.hasAttribute("aria-controls") && t.getAttribute("aria-controls") === "typeahead-menu" : !1;
	}(e)) return !1;
	let a = E();
	if (!X(a, r)) {
		if (j(a)) {
			if (n === "backward") {
				if (a.focus.offset > 0) return !1;
				let e = function(e) {
					for (let t = e, n = e; n !== null; t = n, n = n.getParent()) if (S(n)) {
						if (n !== t && n.getFirstChild() !== t) return null;
						if (!n.isInline()) return n;
					}
					return null;
				}(a.focus.getNode());
				if (!e) return !1;
				let n = e.getPreviousSibling();
				return !!Q(n) && (Z(t), t.shiftKey ? a.focus.set(n.getParentOrThrow().getKey(), n.getIndexWithinParent(), "element") : n.selectEnd(), !0);
			}
			if (t.shiftKey && (n === "up" || n === "down")) {
				let e = a.focus.getNode();
				if (!a.isCollapsed() && (n === "up" && !a.isBackward() || n === "down" && a.isBackward())) {
					let i = F(e, (e) => Q(e));
					if (H(i) && (i = F(i, Q)), i !== r || !i) return !1;
					let s = n === "down" ? i.getNextSibling() : i.getPreviousSibling();
					if (!s) return !1;
					let c = 0;
					n === "up" && S(s) && (c = s.getChildrenSize());
					let l = s;
					n === "up" && S(s) && (l = s.getLastChild() || s, c = N(l) ? l.getTextContentSize() : 0);
					let u = a.clone();
					return u.focus.set(l.getKey(), c, N(l) ? "text" : "element"), o(u), Z(t), !0;
				}
				if (v(e)) {
					let e = n === "up" ? a.getNodes()[a.getNodes().length - 1] : a.getNodes()[0];
					if (e && Rt(r, e) !== null) {
						let e = r.getFirstDescendant(), t = r.getLastDescendant();
						if (!e || !t) return !1;
						let [n] = q(e), [a] = q(t), o = r.getCordsFromCellNode(n, i.table), s = r.getCordsFromCellNode(a, i.table), c = r.getDOMCellFromCordsOrThrow(o.x, o.y, i.table), l = r.getDOMCellFromCordsOrThrow(s.x, s.y, i.table);
						return i.$setAnchorCellForSelection(c), i.$setFocusCellForSelection(l, !0), !0;
					}
					return !1;
				}
				{
					let r = F(e, (e) => S(e) && !e.isInline());
					if (H(r) && (r = F(r, Q)), !r) return !1;
					let s = n === "down" ? r.getNextSibling() : r.getPreviousSibling();
					if (Q(s) && i.tableNodeKey === s.getKey()) {
						let e = s.getFirstDescendant(), r = s.getLastDescendant();
						if (!e || !r) return !1;
						let [i] = q(e), [c] = q(r), l = a.clone();
						return l.focus.set((n === "up" ? i : c).getKey(), n === "up" ? 0 : c.getChildrenSize(), "element"), Z(t), o(l), !0;
					}
				}
			}
		}
		return n === "down" && hn(e) && i.setShouldCheckSelection(), !1;
	}
	if (j(a)) {
		if (n === "backward" || n === "forward") return sn(e, t, a, t.shiftKey ? "extend" : "move", n === "backward", r, i);
		if (a.isCollapsed()) {
			let { anchor: o, focus: s } = a, c = F(o.getNode(), H), l = F(s.getNode(), H);
			if (!H(c) || !c.is(l)) return !1;
			let u = on(c);
			if (u !== r && u != null) {
				let r = Y(u, e.getElementByKey(u.getKey()));
				if (r != null) return i.table = Kt(u, r), cn(e, t, n, u, i);
			}
			let d = e.getElementByKey(c.__key), f = e.getElementByKey(o.key);
			if (f == null || d == null) return !1;
			let p;
			if (o.type === "element") p = f.getBoundingClientRect();
			else {
				let t = D(Lt(e));
				if (t === null || t.rangeCount === 0) return !1;
				p = t.getRangeAt(0).getBoundingClientRect();
			}
			let m = n === "up" ? c.getFirstChild() : c.getLastChild();
			if (m == null) return !1;
			let h = e.getElementByKey(m.__key);
			if (h == null) return !1;
			let g = h.getBoundingClientRect();
			if (n === "up" ? g.top > p.top - p.height : p.bottom + p.height > g.bottom) {
				Z(t);
				let e = r.getCordsFromCellNode(c, i.table);
				if (!t.shiftKey) return Xt(i, r, e.x, e.y, n);
				{
					let t = r.getDOMCellFromCordsOrThrow(e.x, e.y, i.table);
					i.$setAnchorCellForSelection(t), i.$setFocusCellForSelection(t, !0);
				}
				return !0;
			}
		}
	} else if (J(a)) {
		let { anchor: o, focus: s } = a, c = F(o.getNode(), H), l = F(s.getNode(), H), [u] = a.getNodes();
		Q(u) || U(251);
		let d = Y(u, e.getElementByKey(u.getKey()));
		if (!H(c) || !H(l) || !Q(u) || d == null) return !1;
		i.$updateTableTableSelection(a);
		let f = Kt(u, d), p = r.getCordsFromCellNode(c, f), m = r.getDOMCellFromCordsOrThrow(p.x, p.y, f);
		if (i.$setAnchorCellForSelection(m), Z(t), t.shiftKey) {
			let [e, t, a] = G(r, c, l);
			return en(i, e, t, a, n);
		}
		return l.selectEnd(), !0;
	}
	return !1;
}
function Z(e) {
	e.preventDefault(), e.stopImmediatePropagation(), e.stopPropagation();
}
function ln(e, t, n) {
	let r = A();
	e === "first" ? t.insertBefore(r) : t.insertAfter(r), r.append(...n || []), r.selectEnd();
}
function un(e, t, n) {
	let r = n.getParent();
	if (!r) return;
	let i = D(Lt(e));
	if (!i) return;
	let a = i.anchorNode, o = e.getElementByKey(r.getKey()), s = Y(n, e.getElementByKey(n.getKey()));
	if (!a || !o || !s || !o.contains(a) || s.contains(a)) return;
	let c = F(t.anchor.getNode(), (e) => H(e));
	if (!c) return;
	let l = F(c, (e) => Q(e));
	if (!Q(l) || !l.is(n)) return;
	let [u, d] = G(n, c, c), f = u[0][0], p = u[u.length - 1][u[0].length - 1], { startRow: m, startColumn: h } = d, g = m === f.startRow && h === f.startColumn, _ = m === p.startRow && h === p.startColumn;
	return g ? "first" : _ ? "last" : void 0;
}
function dn(e, t) {
	let { tableNode: n } = e.$lookup(), r = n.getCordsFromCellNode(t, e.table);
	return n.getDOMCellFromCordsOrThrow(r.x, r.y, e.table);
}
function fn(e, t, n) {
	return Rt(e, M(t, n));
}
function pn(e, t, n) {
	if (!t.theme.tableAlignment) return;
	let r = [], i = [];
	for (let e of ["center", "right"]) {
		let a = t.theme.tableAlignment[e];
		a && (e === n ? i : r).push(a);
	}
	k(e, ...r), I(e, ...i);
}
var mn = /* @__PURE__ */ new WeakSet();
function hn(e = ze()) {
	return mn.has(e);
}
function gn(e, t) {
	t ? mn.add(e) : mn.delete(e);
}
var _n = class e extends _e {
	__rowStriping;
	__frozenColumnCount;
	__frozenRowCount;
	__colWidths;
	static getType() {
		return "table";
	}
	getColWidths() {
		return this.getLatest().__colWidths;
	}
	setColWidths(e) {
		let t = this.getWritable();
		return t.__colWidths = e, t;
	}
	static clone(t) {
		return new e(t.__key);
	}
	afterCloneFrom(e) {
		super.afterCloneFrom(e), this.__colWidths = e.__colWidths, this.__rowStriping = e.__rowStriping, this.__frozenColumnCount = e.__frozenColumnCount, this.__frozenRowCount = e.__frozenRowCount;
	}
	static importDOM() {
		return { table: (e) => ({
			conversion: yn,
			priority: 1
		}) };
	}
	static importJSON(e) {
		return bn().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setRowStriping(e.rowStriping || !1).setFrozenColumns(e.frozenColumnCount || 0).setFrozenRows(e.frozenRowCount || 0).setColWidths(e.colWidths);
	}
	constructor(e) {
		super(e), this.__rowStriping = !1, this.__frozenColumnCount = 0, this.__frozenRowCount = 0, this.__colWidths = void 0;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			colWidths: this.getColWidths(),
			frozenColumnCount: this.__frozenColumnCount ? this.__frozenColumnCount : void 0,
			frozenRowCount: this.__frozenRowCount ? this.__frozenRowCount : void 0,
			rowStriping: this.__rowStriping ? this.__rowStriping : void 0
		};
	}
	extractWithChild(e, t, n) {
		return n === "html";
	}
	getDOMSlot(e) {
		let t = It(e) ? e : e.querySelector("table");
		return It(t) || U(229), super.getDOMSlot(e).withElement(t).withAfter(t.querySelector("colgroup"));
	}
	createDOM(e, t) {
		let n = document.createElement("table");
		this.__style && (n.style.cssText = this.__style);
		let r = document.createElement("colgroup");
		if (n.appendChild(r), Ne(r), I(n, e.theme.table), this.updateTableElement(null, n, e), hn(t)) {
			let t = document.createElement("div"), r = e.theme.tableScrollableWrapper;
			return r ? I(t, r) : t.style.cssText = "overflow-x: auto;", t.appendChild(n), this.updateTableWrapper(null, t, n, e), t;
		}
		return n;
	}
	updateTableWrapper(e, t, n, r) {
		this.__frozenColumnCount !== (e ? e.__frozenColumnCount : 0) && function(e, t, n, r) {
			r > 0 ? (I(e, n.theme.tableFrozenColumn), t.setAttribute("data-lexical-frozen-column", "true")) : (k(e, n.theme.tableFrozenColumn), t.removeAttribute("data-lexical-frozen-column"));
		}(t, n, r, this.__frozenColumnCount), this.__frozenRowCount !== (e ? e.__frozenRowCount : 0) && function(e, t, n, r) {
			r > 0 ? (I(e, n.theme.tableFrozenRow), t.setAttribute("data-lexical-frozen-row", "true")) : (k(e, n.theme.tableFrozenRow), t.removeAttribute("data-lexical-frozen-row"));
		}(t, n, r, this.__frozenRowCount);
	}
	updateTableElement(e, t, n) {
		this.__style !== (e ? e.__style : "") && (t.style.cssText = this.__style), this.__rowStriping !== (!!e && e.__rowStriping) && function(e, t, n) {
			n ? (I(e, t.theme.tableRowStriping), e.setAttribute("data-lexical-row-striping", "true")) : (k(e, t.theme.tableRowStriping), e.removeAttribute("data-lexical-row-striping"));
		}(t, n, this.__rowStriping), function(e, t, n, r) {
			let i = e.querySelector("colgroup");
			if (!i) return;
			let a = [];
			for (let e = 0; e < n; e++) {
				let t = document.createElement("col"), n = r && r[e];
				n && (t.style.width = `${n}px`), a.push(t);
			}
			i.replaceChildren(...a);
		}(t, 0, this.getColumnCount(), this.getColWidths()), pn(t, n, this.getFormatType());
	}
	updateDOM(e, t, n) {
		let r = this.getDOMSlot(t).element;
		return t === r === hn() || (ce(i = t) && i.nodeName === "DIV" && this.updateTableWrapper(e, t, r, n), this.updateTableElement(e, r, n), !1);
		var i;
	}
	exportDOM(e) {
		let t = super.exportDOM(e), { element: n } = t;
		return {
			after: (n) => {
				if (t.after && (n = t.after(n)), !It(n) && ce(n) && (n = n.querySelector("table")), !It(n)) return null;
				pn(n, e._config, this.getFormatType());
				let [r] = K(this, null, null), i = /* @__PURE__ */ new Map();
				for (let e of r) for (let t of e) {
					let e = t.cell.getKey();
					i.has(e) || i.set(e, {
						colSpan: t.cell.getColSpan(),
						startColumn: t.startColumn
					});
				}
				let a = /* @__PURE__ */ new Set();
				for (let e of n.querySelectorAll(":scope > tr > [data-temporary-table-cell-lexical-key]")) {
					let t = e.getAttribute("data-temporary-table-cell-lexical-key");
					if (t) {
						let n = i.get(t);
						if (e.removeAttribute("data-temporary-table-cell-lexical-key"), n) {
							i.delete(t);
							for (let e = 0; e < n.colSpan; e++) a.add(e + n.startColumn);
						}
					}
				}
				let o = n.querySelector(":scope > colgroup");
				if (o) {
					let e = Array.from(n.querySelectorAll(":scope > colgroup > col")).filter((e, t) => a.has(t));
					o.replaceChildren(...e);
				}
				let s = n.querySelectorAll(":scope > tr");
				if (s.length > 0) {
					let e = document.createElement("tbody");
					for (let t of s) e.appendChild(t);
					n.append(e);
				}
				return n;
			},
			element: !It(n) && ce(n) ? n.querySelector("table") : n
		};
	}
	canBeEmpty() {
		return !1;
	}
	isShadowRoot() {
		return !0;
	}
	getCordsFromCellNode(e, t) {
		let { rows: n, domRows: r } = t;
		for (let t = 0; t < n; t++) {
			let n = r[t];
			if (n != null) for (let r = 0; r < n.length; r++) {
				let i = n[r];
				if (i == null) continue;
				let { elem: a } = i, o = fn(this, a);
				if (o !== null && e.is(o)) return {
					x: r,
					y: t
				};
			}
		}
		throw Error("Cell not found in table.");
	}
	getDOMCellFromCords(e, t, n) {
		let { domRows: r } = n, i = r[t];
		return i == null ? null : i[e < i.length ? e : i.length - 1] ?? null;
	}
	getDOMCellFromCordsOrThrow(e, t, n) {
		let r = this.getDOMCellFromCords(e, t, n);
		if (!r) throw Error("Cell not found at cords.");
		return r;
	}
	getCellNodeFromCords(e, t, n) {
		let r = this.getDOMCellFromCords(e, t, n);
		if (r == null) return null;
		let i = M(r.elem);
		return H(i) ? i : null;
	}
	getCellNodeFromCordsOrThrow(e, t, n) {
		let r = this.getCellNodeFromCords(e, t, n);
		if (!r) throw Error("Node at cords not TableCellNode.");
		return r;
	}
	getRowStriping() {
		return !!this.getLatest().__rowStriping;
	}
	setRowStriping(e) {
		let t = this.getWritable();
		return t.__rowStriping = e, t;
	}
	setFrozenColumns(e) {
		let t = this.getWritable();
		return t.__frozenColumnCount = e, t;
	}
	getFrozenColumns() {
		return this.getLatest().__frozenColumnCount;
	}
	setFrozenRows(e) {
		let t = this.getWritable();
		return t.__frozenRowCount = e, t;
	}
	getFrozenRows() {
		return this.getLatest().__frozenRowCount;
	}
	canSelectBefore() {
		return !0;
	}
	canIndent() {
		return !1;
	}
	getColumnCount() {
		let e = this.getFirstChild();
		if (!e) return 0;
		let t = 0;
		return e.getChildren().forEach((e) => {
			H(e) && (t += e.getColSpan());
		}), t;
	}
};
function vn(e, t) {
	let n = e.getElementByKey(t.getKey());
	return n === null && U(230), Kt(t, n);
}
function yn(e) {
	let t = bn();
	e.hasAttribute("data-lexical-row-striping") && t.setRowStriping(!0), e.hasAttribute("data-lexical-frozen-column") && t.setFrozenColumns(1), e.hasAttribute("data-lexical-frozen-row") && t.setFrozenRows(1);
	let n = e.querySelector(":scope > colgroup");
	if (n) {
		let e = [];
		for (let t of n.querySelectorAll(":scope > col")) {
			let n = t.style.width || "";
			if (!ot.test(n) && (n = t.getAttribute("width") || "", !/^\d+$/.test(n))) {
				e = void 0;
				break;
			}
			e.push(parseFloat(n));
		}
		e && t.setColWidths(e);
	}
	return {
		after: (e) => l(e, W),
		node: t
	};
}
function bn() {
	return r(new _n());
}
function Q(e) {
	return e instanceof _n;
}
function xn(e) {
	W(e.getParent()) ? e.isEmpty() && e.append(A()) : e.remove();
}
function Sn(e) {
	Q(e.getParent()) ? ne(e, H) : e.remove();
}
function Cn(e) {
	ne(e, W);
	let [t] = K(e, null, null), n = t.reduce((e, t) => Math.max(e, t.length), 0), r = e.getChildren();
	for (let e = 0; e < t.length; ++e) {
		let i = r[e];
		if (!i) continue;
		W(i) || U(254, i.constructor.name, i.getType());
		let a = t[e].reduce((e, t) => t ? 1 + e : e, 0);
		if (a !== n) for (let e = a; e < n; ++e) {
			let e = V();
			e.append(A()), i.append(e);
		}
	}
	let i = e.getColWidths(), a = e.getColumnCount();
	if (i && i.length !== a) {
		let t;
		if (a < i.length) t = i.slice(0, a);
		else if (i.length > 0) {
			let e = i[i.length - 1];
			t = [...i, ...Array(a - i.length).fill(e)];
		}
		e.setColWidths(t);
	}
}
function wn(e) {
	if (e.detail < 3 || !De(e.target)) return !1;
	let t = M(e.target);
	if (t === null) return !1;
	let n = F(t, (e) => S(e) && !e.isInline());
	return n !== null && !!H(n.getParent()) && (n.select(0), !0);
}
function Tn() {
	let e = E();
	if (!j(e)) return !1;
	let t = on(e.anchor.getNode());
	if (t === null) return !1;
	let n = Te();
	if (!n.is(t.getParent()) || n.getChildrenSize() !== 1) return !1;
	let [r] = K(t, null, null);
	if (r.length === 0 || r[0].length === 0) return !1;
	let i = r[0][0];
	if (!i || !i.cell) return !1;
	let a = r[r.length - 1], s = a[a.length - 1];
	if (!s || !s.cell) return !1;
	let c = jt(t, i.cell, s.cell);
	return o(c), !0;
}
function En(e) {
	return e.registerNodeTransform(B, (e) => {
		if (e.getColSpan() > 1 || e.getRowSpan() > 1) {
			let [, , t] = q(e), [n] = G(t, e, e), r = n.length, i = n[0].length, a = t.getFirstChild();
			W(a) || U(175);
			let o = [];
			for (let e = 0; e < r; e++) {
				e !== 0 && (a = a.getNextSibling(), W(a) || U(175));
				let t = null;
				for (let r = 0; r < i; r++) {
					let i = n[e][r], s = i.cell;
					if (i.startRow === e && i.startColumn === r) t = s, o.push(s);
					else if (s.getColSpan() > 1 || s.getRowSpan() > 1) {
						H(s) || U(176);
						let e = V(s.__headerState);
						t === null ? _(a, e) : t.insertAfter(e);
					}
				}
			}
			for (let e of o) e.setColSpan(1), e.setRowSpan(1);
		}
	});
}
function Dn(e, t = !0) {
	let n = /* @__PURE__ */ new Map(), r = (r, i, a) => {
		let o = Y(r, a), s = Ht(r, o, e, t);
		n.set(i, [s, o]);
	}, i = e.registerMutationListener(_n, (t) => {
		e.getEditorState().read(() => {
			for (let [e, i] of t) {
				let t = n.get(e);
				if (i === "created" || i === "updated") {
					let { tableNode: i, tableElement: a } = Nt(e);
					t === void 0 ? r(i, e, a) : a !== t[1] && (t[0].removeListeners(), n.delete(e), r(i, e, a));
				} else i === "destroyed" && t !== void 0 && (t[0].removeListeners(), n.delete(e));
			}
		}, { editor: e });
	}, { skipInitialization: !1 });
	return () => {
		i();
		for (let [, [e]] of n) e.removeListeners();
	};
}
function On(e, t) {
	e.hasNodes([_n]) || U(255);
	let { hasNestedTables: n = s(!1) } = t ?? {};
	return y(e.registerCommand(lt, (e) => function({ rows: e, columns: t, includeHeaders: n }, r) {
		let i = E() || le();
		if (!i || !j(i) || !r && on(i.anchor.getNode())) return !1;
		let a = gt(Number(e), Number(t), n);
		ie(a);
		let o = a.getFirstDescendant();
		return N(o) && o.select(), !0;
	}(e, n.peek()), 0), e.registerCommand(ue, (t, r) => {
		if (e !== r) return !1;
		if (function(e) {
			let { nodes: t, selection: n } = e, r = n.getStartEndPoints(), i = J(n), a = j(n) && F(n.anchor.getNode(), (e) => H(e)) !== null && F(n.focus.getNode(), (e) => H(e)) !== null || i;
			if (t.length !== 1 || !Q(t[0]) || !a || r === null) return !1;
			let [o, s] = r, [c, l, u] = q(o), d = F(s.getNode(), (e) => H(e));
			if (!(H(c) && H(d) && W(l) && Q(u))) return !1;
			let f = t[0], [p, m, h] = G(u, c, d), [g] = K(f, null, null), _ = p.length, v = _ > 0 ? p[0].length : 0, y = m.startRow, b = m.startColumn, x = g.length, S = x > 0 ? g[0].length : 0;
			if (i) {
				let e = Et(p, m, h), t = e.maxRow - e.minRow + 1, n = e.maxColumn - e.minColumn + 1;
				y = e.minRow, b = e.minColumn, x = Math.min(x, t), S = Math.min(S, n);
			}
			let C = !1, ee = Math.min(_, y + x) - 1, te = Math.min(v, b + S) - 1, w = /* @__PURE__ */ new Set();
			for (let e = y; e <= ee; e++) for (let t = b; t <= te; t++) {
				let n = p[e][t];
				w.has(n.cell.getKey()) || n.cell.__rowSpan === 1 && n.cell.__colSpan === 1 || (Tt(n.cell), w.add(n.cell.getKey()), C = !0);
			}
			let [T] = K(u.getWritable(), null, null), ne = x - _ + y;
			for (let e = 0; e < ne; e++) yt(T[_ - 1][0].cell);
			let E = S - v + b;
			for (let e = 0; e < E; e++) bt(T[0][v - 1].cell, !0, !1);
			[T] = K(u.getWritable(), null, null);
			for (let e = y; e < y + x; e++) for (let t = b; t < b + S; t++) {
				let n = e - y, r = t - b, i = g[n][r];
				if (i.startRow !== n || i.startColumn !== r) continue;
				let a = i.cell;
				if (a.__rowSpan !== 1 || a.__colSpan !== 1) {
					let n = [], r = Math.min(e + a.__rowSpan, y + x) - 1, i = Math.min(t + a.__colSpan, b + S) - 1;
					for (let a = e; a <= r; a++) for (let e = t; e <= i; e++) {
						let t = T[a][e];
						n.push(t.cell);
					}
					Ct(n), C = !0;
				}
				let { cell: o } = T[e][t], s = o.getChildren();
				a.getChildren().forEach((e) => {
					N(e) && A().append(e), o.append(e);
				}), s.forEach((e) => e.remove());
			}
			if (i && C) {
				let [e] = K(u.getWritable(), null, null);
				e[m.startRow][m.startColumn].cell.selectEnd();
			}
			return !0;
		}(t)) return !0;
		let { selection: i, nodes: a } = t;
		return n.peek() || e !== r || !j(i) ? !1 : on(i.anchor.getNode()) !== null && a.some(Q);
	}, 0), e.registerCommand(Me, Tn, 1), e.registerCommand(x, wn, 0), e.registerNodeTransform(_n, Cn), e.registerNodeTransform(ut, Sn), e.registerNodeTransform(B, xn));
}
se({
	build: (e, t, n) => Ce(t),
	config: Fe({
		hasCellBackgroundColor: !0,
		hasCellMerge: !0,
		hasHorizontalScroll: !0,
		hasNestedTables: !1,
		hasTabHandler: !0
	}),
	name: "@lexical/table/Table",
	nodes: () => [
		_n,
		ut,
		B
	],
	register(e, t, r) {
		let i = r.getOutput(), { hasNestedTables: a } = i;
		return y(n(() => {
			let t = i.hasHorizontalScroll.value;
			hn(e) !== t && (gn(e, t), e.registerNodeTransform(_n, () => {})());
		}), On(e, { hasNestedTables: a }), n(() => Dn(e, i.hasTabHandler.value)), n(() => i.hasCellMerge.value ? void 0 : En(e)), n(() => i.hasCellBackgroundColor.value ? void 0 : e.registerNodeTransform(B, (e) => {
			e.getBackgroundColor() !== null && e.setBackgroundColor(null);
		})));
	}
});
// node_modules/.bun/@lexical+devtools-core@0.40.0+bf16f8eded5e12ee/node_modules/@lexical/devtools-core/LexicalDevtoolsCore.prod.mjs
var kn = Object.freeze({
	"	": "\\t",
	"\n": "\\n"
}), An = new RegExp(Object.keys(kn).join("|"), "g"), $ = Object.freeze({
	ancestorHasNextSibling: "|",
	ancestorIsLastChild: " ",
	hasNextSibling: "├",
	isLastChild: "└",
	selectedChar: "^",
	selectedLine: ">"
}), jn = [
	(e) => e.hasFormat("bold") && "Bold",
	(e) => e.hasFormat("code") && "Code",
	(e) => e.hasFormat("italic") && "Italic",
	(e) => e.hasFormat("strikethrough") && "Strikethrough",
	(e) => e.hasFormat("subscript") && "Subscript",
	(e) => e.hasFormat("superscript") && "Superscript",
	(e) => e.hasFormat("underline") && "Underline",
	(e) => e.hasFormat("highlight") && "Highlight"
], Mn = [
	(e) => e.hasTextFormat("bold") && "Bold",
	(e) => e.hasTextFormat("code") && "Code",
	(e) => e.hasTextFormat("italic") && "Italic",
	(e) => e.hasTextFormat("strikethrough") && "Strikethrough",
	(e) => e.hasTextFormat("subscript") && "Subscript",
	(e) => e.hasTextFormat("superscript") && "Superscript",
	(e) => e.hasTextFormat("underline") && "Underline",
	(e) => e.hasTextFormat("highlight") && "Highlight"
], Nn = [(e) => e.isDirectionless() && "Directionless", (e) => e.isUnmergeable() && "Unmergeable"], Pn = [(e) => e.isToken() && "Token", (e) => e.isSegmented() && "Segmented"];
function Fn(e, t, n, r, i = !1) {
	let a = e.getEditorState(), o = e._config, s = e._compositionKey, c = e._editable;
	if (n) {
		let t = "";
		return a.read(() => {
			t = function(e) {
				let t = document.createElement("div");
				return t.innerHTML = e.trim(), Gn(t, 0).innerHTML;
			}(ge(e));
		}), t;
	}
	let l = " root\n", u = a.read(() => {
		let e = E();
		return In(Te(), (t, n) => {
			let a = `(${t.getKey()})`, o = t.getType() || "", s = t.isSelected();
			l += `${s ? $.selectedLine : " "} ${n.join(" ")} ${a} ${o} ${function(e, t, n = !1) {
				let r = t ? t(e, n) : void 0;
				if (r !== void 0 && r.length > 0) return r;
				if (N(e)) {
					let t = e.getTextContent(), r = t.length === 0 ? "(empty)" : `"${Ln(t, n)}"`, i = function(e) {
						return [
							Bn(e),
							Rn(e),
							zn(e),
							Wn(e)
						].filter(Boolean).join(", ");
					}(e);
					return [r, i.length === 0 ? null : `{ ${i} }`].filter(Boolean).join(" ").trim();
				}
				if (be(e)) {
					let t = e.getURL(), r = t.length === 0 ? "(empty)" : `"${Ln(t, n)}"`, i = function(e) {
						return [
							Vn(e),
							Hn(e),
							Un(e),
							Wn(e)
						].filter(Boolean).join(", ");
					}(e);
					return [r, i.length === 0 ? null : `{ ${i} }`].filter(Boolean).join(" ").trim();
				}
				if (at(e)) return `ids: [ ${e.getIDs().join(", ")} ]`;
				if (m(e)) {
					let t = function(e) {
						let t = Mn.map((t) => t(e)).filter(Boolean).join(", ").toLocaleLowerCase();
						return t !== "" && (t = "format: " + t), t;
					}(e), n = t === "" ? "" : `{ ${t} }`;
					return n += e.__style ? `(${e.__style})` : "", n;
				}
				return "";
			}(t, r, i)}\n`, l += function({ indent: e, isSelected: t, node: n, nodeKeyDisplay: r, selection: i, typeDisplay: a }) {
				if (!N(n) || !j(i) || !t || S(n)) return "";
				let o = i.anchor, s = i.focus;
				if (n.getTextContent() === "" || o.getNode() === i.focus.getNode() && o.offset === s.offset) return "";
				let [c, l] = function(e, t) {
					let n = t.getStartEndPoints();
					if (h(t) || n === null) return [-1, -1];
					let [r, i] = n, a = e.getTextContent(), o = a.length, s = -1, c = -1;
					if (r.type === "text" && i.type === "text") {
						let t = r.getNode(), n = i.getNode();
						t === n && e === t && r.offset !== i.offset ? [s, c] = r.offset < i.offset ? [r.offset, i.offset] : [i.offset, r.offset] : [s, c] = e === t ? t.isBefore(n) ? [r.offset, o] : [0, r.offset] : e === n ? n.isBefore(t) ? [i.offset, o] : [0, i.offset] : [0, o];
					}
					let l = (a.slice(0, s).match(An) || []).length, u = (a.slice(s, c).match(An) || []).length;
					return [s + l, c + l + u];
				}(n, i);
				if (c === l) return "";
				let u = e[e.length - 1] === $.hasNextSibling ? $.ancestorHasNextSibling : $.ancestorIsLastChild, d = [...e.slice(0, e.length - 1), u], f = Array(c + 1).fill(" "), p = Array(l - c).fill($.selectedChar), m = a.length + 2, g = Array(r.length + m).fill(" ");
				return [
					$.selectedLine,
					d.join(" "),
					[
						...g,
						...f,
						...p
					].join("")
				].join(" ") + "\n";
			}({
				indent: n,
				isSelected: s,
				node: t,
				nodeKeyDisplay: a,
				selection: e,
				typeDisplay: o
			});
		}), e === null ? ": null" : j(e) ? function(e) {
			let t = "", n = Bn(e);
			t += `: range ${n === "" ? "" : `{ ${n} }`} ${e.style === "" ? "" : `{ style: ${e.style} } `}`;
			let r = e.anchor, i = e.focus, a = r.offset, o = i.offset;
			return t += `\n  ├ anchor { key: ${r.key}, offset: ${a === null ? "null" : a}, type: ${r.type} }`, t += `\n  └ focus { key: ${i.key}, offset: ${o === null ? "null" : o}, type: ${i.type} }`, t;
		}(e) : J(e) ? function(e) {
			return `: table\n  └ { table: ${e.tableKey}, anchorCell: ${e.anchor.key}, focusCell: ${e.focus.key} }`;
		}(e) : function(e) {
			return h(e) ? `: node\n  └ [${Array.from(e._nodes).join(", ")}]` : "";
		}(e);
	});
	if (l += "\n selection" + u, l += "\n\n commands:", t.length) for (let { index: e, type: n, payload: r } of t) l += `\n  └ ${e}. { type: ${n}, payload: ${r instanceof Event ? r.constructor.name : r} }`;
	else l += "\n  └ None dispatched.";
	let { version: d } = e.constructor;
	return l += `\n\n editor${d ? ` (v${d})` : ""}:`, l += `\n  └ namespace ${o.namespace}`, s !== null && (l += `\n  └ compositionKey ${s}`), l += `\n  └ editable ${String(c)}`, l;
}
function In(e, t, n = []) {
	let r = e.getChildren(), i = r.length;
	r.forEach((e, r) => {
		t(e, n.concat(r === i - 1 ? $.isLastChild : $.hasNextSibling)), S(e) && In(e, t, n.concat(r === i - 1 ? $.ancestorIsLastChild : $.ancestorHasNextSibling));
	});
}
function Ln(e, t = !1) {
	let n = Object.entries(kn).reduce((e, [t, n]) => e.replace(new RegExp(t, "g"), String(n)), e);
	return t ? n.replace(/[^\s]/g, "*") : n;
}
function Rn(e) {
	let t = Nn.map((t) => t(e)).filter(Boolean).join(", ").toLocaleLowerCase();
	return t !== "" && (t = "detail: " + t), t;
}
function zn(e) {
	let t = Pn.map((t) => t(e)).filter(Boolean).join(", ").toLocaleLowerCase();
	return t !== "" && (t = "mode: " + t), t;
}
function Bn(e) {
	let t = jn.map((t) => t(e)).filter(Boolean).join(", ").toLocaleLowerCase();
	return t !== "" && (t = "format: " + t), t;
}
function Vn(e) {
	let t = e.getTarget();
	return t != null && (t = "target: " + t), t;
}
function Hn(e) {
	let t = e.getRel();
	return t != null && (t = "rel: " + t), t;
}
function Un(e) {
	let t = e.getTitle();
	return t != null && (t = "title: " + t), t;
}
function Wn(e) {
	if (!e.__state) return !1;
	let t = [];
	for (let [n, r] of e.__state.knownState.entries()) {
		if (n.isEqual(r, n.defaultValue)) continue;
		let e = JSON.stringify(n.unparse(r));
		t.push(`[${n.key}: ${e}]`);
	}
	let n = t.join(",");
	return n !== "" && (n = "state: " + n), n;
}
function Gn(e, t) {
	let n = Array(1 + t++).join("  "), r = Array(t - 1).join("  "), i;
	for (let a = 0; a < e.children.length; a++) i = document.createTextNode("\n" + n), e.insertBefore(i, e.children[a]), Gn(e.children[a], t), e.lastElementChild === e.children[a] && (i = document.createTextNode("\n" + r), e.appendChild(i));
	return e;
}
var Kn = Ge(function({ treeTypeButtonClassName: e, timeTravelButtonClassName: t, timeTravelPanelSliderClassName: n, timeTravelPanelButtonClassName: r, viewClassName: i, timeTravelPanelClassName: a, editorState: o, setEditorState: s, setEditorReadOnly: c, generateContent: l, commandsLog: u = [] }, d) {
	let [f, p] = L([]), [m, h] = L(""), [g, _] = L(!1), [v, y] = L(!1), b = Xe(0), x = Xe(null), [S, C] = L(!1), [ee, te] = L(!1), [w, T] = L(!1), ne = Xe(null), E = Xe([]), D = Xe(0), re = Ke((e) => {
		let t = ++D.current;
		l(e).then((e) => {
			t === D.current && h(e);
		}).catch((e) => {
			t === D.current && h(`Error rendering tree: ${e.message}\n\nStack:\n${e.stack}`);
		});
	}, [l]);
	qe(() => {
		if (!(!w && o._nodeMap.size > 1e3 && (te(!0), !w)) && (ne.current !== o || E.current !== u)) {
			let e = ne.current !== o;
			ne.current = o, E.current = u, re(v), !g && e && p((e) => [...e, [Date.now(), o]]);
		}
	}, [
		o,
		re,
		v,
		w,
		g,
		u
	]);
	let O = f.length;
	return qe(() => {
		if (S) {
			let e, t = () => {
				let n = b.current;
				if (n === O - 1) return void C(!1);
				let r = f[n][0], i = f[n + 1][0];
				e = setTimeout(() => {
					b.current++;
					let e = b.current, n = x.current;
					n !== null && (n.value = String(e)), s(f[e][1]), t();
				}, i - r);
			};
			return t(), () => {
				clearTimeout(e);
			};
		}
	}, [
		f,
		S,
		O,
		s
	]), Qe("div", {
		className: i,
		children: [
			!w && ee ? Qe("div", {
				style: { padding: 20 },
				children: [R("span", {
					style: { marginRight: 20 },
					children: "Detected large EditorState, this can impact debugging performance."
				}), R("button", {
					onClick: () => {
						T(!0);
					},
					style: {
						background: "transparent",
						border: "1px solid white",
						color: "white",
						cursor: "pointer",
						padding: 5
					},
					children: "Show full tree"
				})]
			}) : null,
			w ? null : R("button", {
				onClick: () => (re(!v), void y(!v)),
				className: e,
				type: "button",
				children: v ? "Tree" : "Export DOM"
			}),
			!g && (w || !ee) && O > 2 && R("button", {
				onClick: () => {
					c(!0), b.current = O - 1, _(!0);
				},
				className: t,
				type: "button",
				children: "Time Travel"
			}),
			(w || !ee) && R("pre", {
				ref: d,
				children: m
			}),
			g && (w || !ee) && Qe("div", {
				className: a,
				children: [
					R("button", {
						className: r,
						onClick: () => {
							b.current === O - 1 && (b.current = 1), C(!S);
						},
						type: "button",
						children: S ? "Pause" : "Play"
					}),
					R("input", {
						className: n,
						ref: x,
						onChange: (e) => {
							let t = Number(e.target.value), n = f[t];
							n && (b.current = t, s(n[1]));
						},
						type: "range",
						min: "1",
						max: O - 1
					}),
					R("button", {
						className: r,
						onClick: () => {
							c(!1);
							let e = f.length - 1, t = f[e];
							s(t[1]);
							let n = x.current;
							n !== null && (n.value = String(e)), _(!1), C(!1);
						},
						type: "button",
						children: "Exit"
					})
				]
			})
		]
	});
});
function qn(e, t) {
	let n = /* @__PURE__ */ new Set(), r = 0;
	for (let [i] of e._commands) n.add(e.registerCommand(i, (e) => (t((t) => {
		r += 1;
		let n = [...t];
		return n.push({
			index: r,
			payload: e,
			type: i.type ? i.type : "UNKNOWN"
		}), n.length > 10 && n.shift(), n;
	}), !1), 4));
	return () => n.forEach((e) => e());
}
function Jn(e) {
	let [t, n] = L([]);
	return qe(() => qn(e, n), [e]), Ye(() => t, [t]);
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalTreeView.prod.mjs
function Yn({ treeTypeButtonClassName: e, timeTravelButtonClassName: t, timeTravelPanelSliderClassName: n, timeTravelPanelButtonClassName: r, timeTravelPanelClassName: i, viewClassName: a, editor: o, customPrintNode: s }) {
	let c = We.createRef(), [l, u] = L(o.getEditorState()), d = Jn(o);
	return qe(() => y(o.registerUpdateListener(({ editorState: e }) => {
		u(e);
	}), o.registerEditableListener(() => {
		u(o.getEditorState());
	})), [o]), qe(() => {
		let e = c.current;
		if (e !== null) return e.__lexicalEditor = o, () => {
			e.__lexicalEditor = null;
		};
	}, [o, c]), R(Kn, {
		treeTypeButtonClassName: e,
		timeTravelButtonClassName: t,
		timeTravelPanelSliderClassName: n,
		timeTravelPanelButtonClassName: r,
		viewClassName: a,
		timeTravelPanelClassName: i,
		setEditorReadOnly: (e) => {
			let t = o.getRootElement();
			t != null && (t.contentEditable = e ? "false" : "true");
		},
		editorState: l,
		setEditorState: (e) => o.setEditorState(e),
		generateContent: async function(e) {
			return Fn(o, d, e, s);
		},
		ref: c,
		commandsLog: d
	});
}
// packages/ui/src/components/rich-text/shared/plugins/TreeViewPlugin/TreeViewPlugin.tsx
function Xn() {
	let [e] = Ue();
	return /* @__PURE__ */ R(Ze, {
		fontSize: "xs",
		color: "fg.muted",
		padding: "4",
		children: /* @__PURE__ */ R(Yn, {
			treeTypeButtonClassName: "debug-treetype-button",
			timeTravelButtonClassName: "debug-timetravel-button",
			timeTravelPanelButtonClassName: "debug-timetravel-button",
			timeTravelPanelClassName: "debug-timetravel-panel",
			timeTravelPanelSliderClassName: "debug-timetravel-slider",
			viewClassName: "tree-view-output",
			editor: e
		})
	});
}
export { et as i, rt as n, tt as r, Xn as t };
