// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import "./rolldown-runtime-CwxnZyOB.ts";
import { t as e } from "./globe-CC58dLi6.ts";
import "./default-DW7wlMJ9.ts";
import { _ as t, a as n, b as r, c as i, d as a, f as o, g as s, h as c, i as l, l as u, m as d, n as f, o as p, p as m, r as h, s as g, t as ee, u as _, v, x as y, y as te } from "./lib-B4PjEPpe.ts";
import { t as b } from "./katex-DhNjlQSb.ts";
import { t as ne } from "./prism-DZpbz-dA.ts";
import { a as re, c as ie, i as ae, n as oe, o as x, s as se, t as ce } from "./chat-link-anchor-kdoOkLgc.ts";
import { t as le } from "./get-file-type-icon-Bq5BxZ4Y.ts";
import { n as ue } from "./resource-badge-Cd8iYFfh.ts";
import { $ as de, $t as fe, A as pe, An as S, At as C, B as me, Cn as he, Dn as ge, Dt as _e, En as ve, Et as ye, Fn as be, Gn as xe, Ht as Se, I as w, J as Ce, Jn as T, K as we, Kn as E, Ln as Te, Lt as Ee, Mt as De, Nn as Oe, Nt as ke, O as Ae, Pn as je, Q as Me, Qn as D, Qt as O, Sn as k, St as Ne, T as Pe, Tt as Fe, Ut as Ie, V as Le, Vn as Re, Vt as ze, Xn as Be, Y as Ve, Yn as He, Zn as Ue, Zt as We, _ as Ge, a as Ke, b as qe, bn as Je, c as Ye, cn as Xe, dn as Ze, et as Qe, fn as A, ft as j, h as $e, ht as et, i as tt, in as nt, it as rt, j as it, jn as at, jt as M, k as ot, kn as st, kt as N, l as ct, m as lt, nn as ut, nt as dt, o as ft, pn as P, pt, qn as mt, qt as ht, rr as gt, s as _t, sn as vt, st as yt, t as bt, tn as xt, tr as St, tt as Ct, un as wt, v as Tt, vn as Et, vt as F, wt as I, x as Dt, xt as L, y as Ot, yt as kt, z as At, zt as jt } from "./rich-text-theme-C7PhYVHR.ts";
import { t as Mt } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { t as Nt } from "./resolve-icon-component-Ve9WSQ1O.ts";
import { t as Pt } from "./host-storage-CRtYziQh.ts";
import { t as Ft } from "./edit-mode-data-table-CsRA94e-.ts";
import { t as It } from "./lazy-markdown-editor-EV8pc3Pw.ts";
import * as Lt from "react";
import { Fragment as Rt, Suspense as zt, createContext as Bt, lazy as Vt, useCallback as Ht, useContext as Ut, useEffect as R, useRef as Wt, useState as Gt } from "react";
import { Box as Kt, Code as qt, Icon as Jt, Image as Yt, Link as Xt, Text as Zt } from "@chakra-ui/react";
import { jsx as z } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/shared/markdown-url.ts
var Qt = /* @__PURE__ */ new Set([
	"http:",
	"https:",
	"mailto:",
	"sms:",
	"tel:"
]), $t = /^data:image\/(?:png|gif|jpeg|webp);base64,[a-z0-9+/=]+$/i, en = /^[a-z][a-z\d+.-]*:/i, tn = (e) => {
	if (e.startsWith("#") || e.startsWith("/") || e.startsWith("./") || e.startsWith("../") || !en.test(e)) return !0;
	try {
		return Qt.has(new URL(e).protocol);
	} catch {
		return !1;
	}
}, nn = (e) => e.startsWith("https://") ? !0 : $t.test(e), rn = (e, t, n) => {
	let r = n ? n(e, t) : e;
	return r === null ? null : t === "image" ? !en.test(e) && !n ? null : nn(r) ? r : null : tn(r) ? r : null;
};
ne();
var an = /* @__PURE__ */ new Map(), on = /* @__PURE__ */ new WeakMap(), sn = (e, t) => {
	let n = ie({
		source: e,
		origin: "markdown"
	});
	if (n?.kind === "file") return t?.resolveHref({
		source: e,
		origin: "markdown"
	}) ?? n.path;
}, cn = (e, t, n) => {
	if (t.type !== "tool" || !Array.isArray(t.state?.output)) return e;
	let r;
	for (let i of t.state.output) {
		if (i?.type !== "image" || typeof i.source != "string" || typeof i.src != "string") continue;
		let t = sn(i.source, n), a = rn(i.src, "image");
		t && a && (r ??= new Map(e), r.set(t, a));
	}
	return r ?? e;
}, ln = (e, t) => {
	let n, r = an;
	for (let i of e) for (let e of i.parts) r = cn(r, e, t), r.size !== 0 && (n ??= /* @__PURE__ */ new WeakMap(), n.set(e, r));
	return n ?? on;
}, un = (e, t, n) => {
	let r = sn(t, n);
	return r ? e.get(r) : void 0;
}, dn = Bt(on), fn = () => Ut(dn), pn = Bt(an), mn = () => Ut(pn);
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/useLexicalNodeSelection.prod.mjs
function hn(e, t) {
	return e.getEditorState().read(() => {
		let e = mt(t);
		return e !== null && e.isSelected();
	});
}
function gn(e) {
	let [t] = Mt(), [n, r] = Gt(() => hn(t, e));
	return R(() => {
		let n = !0, i = t.registerUpdateListener(() => {
			n && r(hn(t, e));
		});
		return () => {
			n = !1, i();
		};
	}, [t, e]), [
		n,
		Ht((n) => {
			t.update(() => {
				let t = k();
				T(t) || (t = dt(), _e(t)), T(t) && (n ? t.add(e) : t.delete(e));
			});
		}, [t, e]),
		Ht(() => {
			t.update(() => {
				let e = k();
				T(e) && e.clear();
			});
		}, [t])
	];
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalHorizontalRuleNode.prod.mjs
function _n({ nodeKey: e }) {
	let [t] = Mt(), [n, r, i] = gn(e);
	return R(() => Ee(t.registerCommand(Oe, (a) => {
		let o = t.getElementByKey(e);
		return a.target === o && (a.shiftKey || i(), r(!n), !0);
	}, 1)), [
		i,
		t,
		n,
		e,
		r
	]), R(() => {
		let r = t.getElementByKey(e), i = t._config.theme.hrSelected ?? "selected";
		r !== null && (n ? F(r, i) : We(r, i));
	}, [
		t,
		n,
		e
	]), null;
}
var vn = class e extends Pe {
	static getType() {
		return "horizontalrule";
	}
	static clone(t) {
		return new e(t.__key);
	}
	static importJSON(e) {
		return bn().updateFromJSON(e);
	}
	static importDOM() {
		return { hr: () => ({
			conversion: yn,
			priority: 0
		}) };
	}
	decorate() {
		return z(_n, { nodeKey: this.__key });
	}
};
function yn() {
	return { node: bn() };
}
function bn() {
	return S(new vn());
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalHorizontalRulePlugin.prod.mjs
function xn() {
	let [e] = Mt();
	return R(() => e.registerCommand(ot, (e) => {
		let t = k();
		if (!M(t)) return !1;
		if (t.focus.getNode() !== null) {
			let e = bn();
			Le(e);
		}
		return !0;
	}, 0), [e]), null;
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalLinkPlugin.prod.mjs
function Sn({ validateUrl: e, attributes: t }) {
	let [n] = Mt();
	return R(() => {
		if (!n.hasNodes([Ot])) throw Error("LinkPlugin: LinkNode not registered on editor");
	}), R(() => Tt(n, it({
		attributes: t,
		validateUrl: e
	})), [
		n,
		e,
		t
	]), null;
}
// node_modules/.bun/@lexical+list@0.40.0/node_modules/@lexical/list/LexicalList.prod.mjs
function Cn(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
function wn(e) {
	let t = 1, n = e.getParent();
	for (; n != null;) {
		if (V(n)) {
			let e = n.getParent();
			if (U(e)) {
				t++, n = e.getParent();
				continue;
			}
			Cn(40);
		}
		return t;
	}
	return t;
}
function Tn(e) {
	let t = e.getParent();
	U(t) || Cn(40);
	let n = t;
	for (; n !== null;) n = n.getParent(), U(n) && (t = n);
	return t;
}
function En(e) {
	let t = [], n = e.getChildren().filter(V);
	for (let e = 0; e < n.length; e++) {
		let r = n[e], i = r.getFirstChild();
		U(i) ? t = t.concat(En(i)) : t.push(r);
	}
	return t;
}
function Dn(e) {
	return V(e) && U(e.getFirstChild());
}
function On(e) {
	return B().append(e);
}
function kn(e, t) {
	return V(e) && (t.length === 0 || t.length === 1 && e.is(t[0]) && e.getChildrenSize() === 0);
}
function An(e) {
	let t = k();
	if (t !== null) {
		let n = t.getNodes();
		if (M(t)) {
			let r = t.getStartEndPoints();
			r === null && Cn(143);
			let [i] = r, a = i.getNode(), o = a.getParent();
			if (Te(a)) {
				let e = a.getFirstChild();
				if (e) n = e.selectStart().getNodes();
				else {
					let e = Je();
					a.append(e), n = e.select().getNodes();
				}
			} else if (kn(a, n)) {
				let t = H(e);
				if (Te(o)) {
					a.replace(t);
					let e = B();
					ke(a) && (e.setFormat(a.getFormatType()), e.setIndent(a.getIndent())), t.append(e);
				} else if (V(a)) {
					let e = a.getParentOrThrow();
					jn(t, e.getChildren()), e.replace(t);
				}
				return;
			}
		}
		let r = /* @__PURE__ */ new Set();
		for (let t = 0; t < n.length; t++) {
			let i = n[t];
			if (ke(i) && i.isEmpty() && !V(i) && !r.has(i.getKey())) {
				Mn(i, e);
				continue;
			}
			let a = ze(i) ? i.getParent() : V(i) && i.isEmpty() ? i : null;
			for (; a != null;) {
				let t = a.getKey();
				if (U(a)) {
					if (!r.has(t)) {
						let n = H(e);
						jn(n, a.getChildren()), a.replace(n), r.add(t);
					}
					break;
				}
				{
					let n = a.getParent();
					if (Te(n) && !r.has(t)) {
						r.add(t), Mn(a, e);
						break;
					}
					a = n;
				}
			}
		}
	}
}
function jn(e, t) {
	e.splice(e.getChildrenSize(), 0, t);
}
function Mn(e, t) {
	if (U(e)) return e;
	let n = e.getPreviousSibling(), r = e.getNextSibling(), i = B(), a;
	if (jn(i, e.getChildren()), U(n) && t === n.getListType()) n.append(i), U(r) && t === r.getListType() && (jn(n, r.getChildren()), r.remove()), a = n;
	else if (U(r) && t === r.getListType()) r.getFirstChildOrThrow().insertBefore(i), a = r;
	else {
		let n = H(t);
		n.append(i), e.replace(n), a = n;
	}
	i.setFormat(e.getFormatType()), i.setIndent(e.getIndent());
	let o = k();
	return M(o) && (a.getKey() === o.anchor.key && o.anchor.set(i.getKey(), o.anchor.offset, "element"), a.getKey() === o.focus.key && o.focus.set(i.getKey(), o.focus.offset, "element")), e.remove(), a;
}
function Nn(e, t) {
	let n = e.getLastChild(), r = t.getFirstChild();
	n && r && Dn(n) && Dn(r) && (Nn(n.getFirstChild(), r.getFirstChild()), r.remove());
	let i = t.getChildren();
	i.length > 0 && e.append(...i), t.remove();
}
function Pn() {
	let e = k();
	if (M(e)) {
		let t = /* @__PURE__ */ new Set(), n = e.getNodes(), r = e.anchor.getNode();
		if (kn(r, n)) t.add(Tn(r));
		else for (let e = 0; e < n.length; e++) {
			let r = n[e];
			if (ze(r)) {
				let e = me(r, zn);
				e != null && t.add(Tn(e));
			}
		}
		for (let n of t) {
			let t = n, r = En(n);
			for (let n of r) {
				let r = Je().setTextStyle(e.style).setTextFormat(e.format);
				jn(r, n.getChildren()), t.insertAfter(r), t = r, n.__key === e.anchor.key && E(e.anchor, Fe(wt(r, "next"))), n.__key === e.focus.key && E(e.focus, Fe(wt(r, "next"))), n.remove();
			}
			n.remove();
		}
	}
}
function Fn(e) {
	let t = e.getListType() !== "check", n = e.getStart();
	for (let r of e.getChildren()) V(r) && (r.getValue() !== n && r.setValue(n), t && r.getLatest().__checked != null && r.setChecked(void 0), U(r.getFirstChild()) || n++);
}
function In(e) {
	let t = /* @__PURE__ */ new Set();
	if (Dn(e) || t.has(e.getKey())) return;
	let n = e.getParent(), r = e.getNextSibling(), i = e.getPreviousSibling();
	if (Dn(r) && Dn(i)) {
		let n = i.getFirstChild();
		if (U(n)) {
			n.append(e);
			let i = r.getFirstChild();
			U(i) && (jn(n, i.getChildren()), r.remove(), t.add(r.getKey()));
		}
	} else if (Dn(r)) {
		let t = r.getFirstChild();
		if (U(t)) {
			let n = t.getFirstChild();
			n !== null && n.insertBefore(e);
		}
	} else if (Dn(i)) {
		let t = i.getFirstChild();
		U(t) && t.append(e);
	} else if (U(n)) {
		let t = B().setTextFormat(e.getTextFormat()).setTextStyle(e.getTextStyle()), a = H(n.getListType()).setTextFormat(n.getTextFormat()).setTextStyle(n.getTextStyle());
		t.append(a), a.append(e), i ? i.insertAfter(t) : r ? r.insertBefore(t) : n.append(t);
	}
}
function Ln(e) {
	if (Dn(e)) return;
	let t = e.getParent(), n = t ? t.getParent() : void 0;
	if (U(n ? n.getParent() : void 0) && V(n) && U(t)) {
		let r = t ? t.getFirstChild() : void 0, i = t ? t.getLastChild() : void 0;
		if (e.is(r)) n.insertBefore(e), t.isEmpty() && n.remove();
		else if (e.is(i)) n.insertAfter(e), t.isEmpty() && n.remove();
		else {
			let r = t.getListType(), i = B(), a = H(r);
			i.append(a), e.getPreviousSiblings().forEach((e) => a.append(e));
			let o = B(), s = H(r);
			o.append(s), jn(s, e.getNextSiblings()), n.insertBefore(i), n.insertAfter(o), n.replace(e);
		}
	}
}
function Rn() {
	let e = k();
	if (!M(e) || !e.isCollapsed()) return !1;
	let t = e.anchor.getNode(), n = null;
	if (V(t) && t.getChildrenSize() === 0) n = t;
	else if (ut(t)) {
		let e = t.getParent();
		V(e) && e.getChildren().every((e) => ut(e) && e.getTextContent().trim() === "") && (n = e);
	}
	if (n === null) return !1;
	let r = Tn(n), i = n.getParent();
	U(i) || Cn(40);
	let a = i.getParent(), o;
	if (Te(a)) o = Je(), r.insertAfter(o);
	else {
		if (!V(a)) return !1;
		o = B(), a.insertAfter(o);
	}
	o.setTextStyle(e.style).setTextFormat(e.format).select();
	let s = n.getNextSiblings();
	if (s.length > 0) {
		let e = H(i.getListType());
		if (V(o)) {
			let t = B();
			t.append(e), o.insertAfter(t);
		} else o.insertAfter(e);
		e.append(...s);
	}
	return function(e) {
		let t = e;
		for (; t.getNextSibling() == null && t.getPreviousSibling() == null;) {
			let e = t.getParent();
			if (e == null || !V(e) && !U(e)) break;
			t = e;
		}
		t.remove();
	}(n), !0;
}
var zn = class extends j {
	__value;
	__checked;
	$config() {
		return this.config("listitem", {
			$transform: (e) => {
				if (e.__checked == null) return;
				let t = e.getParent();
				U(t) && t.getListType() !== "check" && e.getChecked() != null && e.setChecked(void 0);
			},
			extends: j,
			importDOM: ye({ li: () => ({
				conversion: Bn,
				priority: 0
			}) })
		});
	}
	constructor(e = 1, t = void 0, n) {
		super(n), this.__value = e === void 0 ? 1 : e, this.__checked = t;
	}
	afterCloneFrom(e) {
		super.afterCloneFrom(e), this.__value = e.__value, this.__checked = e.__checked;
	}
	createDOM(e) {
		let t = document.createElement("li");
		return this.updateListItemDOM(null, t, e), t;
	}
	updateListItemDOM(e, t, n) {
		(function(e, t, n) {
			let r = t.getParent();
			!U(r) || r.getListType() !== "check" || U(t.getFirstChild()) ? (e.removeAttribute("role"), e.removeAttribute("tabIndex"), e.removeAttribute("aria-checked")) : (e.setAttribute("role", "checkbox"), e.setAttribute("tabIndex", "-1"), n && t.__checked === n.__checked || e.setAttribute("aria-checked", t.getChecked() ? "true" : "false"));
		})(t, this, e), t.value = this.__value, function(e, t, n) {
			let r = [], i = [], a = t.list, o = a ? a.listitem : void 0, s;
			if (a && a.nested && (s = a.nested.listitem), o !== void 0 && r.push(...L(o)), a) {
				let e = n.getParent(), t = U(e) && e.getListType() === "check", o = n.getChecked();
				t && !o || i.push(a.listitemUnchecked), t && o || i.push(a.listitemChecked), t && r.push(o ? a.listitemChecked : a.listitemUnchecked);
			}
			if (s !== void 0) {
				let e = L(s);
				n.getChildren().some((e) => U(e)) ? r.push(...e) : i.push(...e);
			}
			i.length > 0 && We(e, ...i), r.length > 0 && F(e, ...r);
		}(t, n.theme, this);
		let r = e ? e.__style : "", i = this.__style;
		r !== i && (i === "" ? t.removeAttribute("style") : t.style.cssText = i), function(e, t, n) {
			let r = we(t.__textStyle);
			for (let t in r) e.style.setProperty(`--listitem-marker-${t}`, r[t]);
			if (n) for (let t in we(n.__textStyle)) t in r || e.style.removeProperty(`--listitem-marker-${t}`);
		}(t, this, e);
	}
	updateDOM(e, t, n) {
		let r = t;
		return this.updateListItemDOM(e, r, n), !1;
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setValue(e.value).setChecked(e.checked);
	}
	exportDOM(e) {
		let t = this.createDOM(e._config), n = this.getFormatType();
		n && (t.style.textAlign = n);
		let r = this.getDirection();
		return r && (t.dir = r), { element: t };
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			checked: this.getChecked(),
			value: this.getValue()
		};
	}
	append(...e) {
		for (let t = 0; t < e.length; t++) {
			let n = e[t];
			if (ke(n) && this.canMergeWith(n)) {
				let e = n.getChildren();
				this.append(...e), n.remove();
			} else super.append(n);
		}
		return this;
	}
	replace(e, t) {
		if (V(e)) return super.replace(e);
		this.setIndent(0);
		let n = this.getParentOrThrow();
		if (!U(n)) return e;
		if (n.__first === this.getKey()) n.insertBefore(e);
		else if (n.__last === this.getKey()) n.insertAfter(e);
		else {
			let t = H(n.getListType()), r = this.getNextSibling();
			for (; r;) {
				let e = r;
				r = r.getNextSibling(), t.append(e);
			}
			n.insertAfter(e), e.insertAfter(t);
		}
		return t && (ke(e) || Cn(139), this.getChildren().forEach((t) => {
			e.append(t);
		})), this.remove(), n.getChildrenSize() === 0 && n.remove(), e;
	}
	insertAfter(e, t = !0) {
		let n = this.getParentOrThrow();
		if (U(n) || Cn(39), V(e)) return super.insertAfter(e, t);
		let r = this.getNextSiblings();
		if (n.insertAfter(e, t), r.length !== 0) {
			let i = H(n.getListType());
			r.forEach((e) => i.append(e)), e.insertAfter(i, t);
		}
		return e;
	}
	remove(e) {
		let t = this.getPreviousSibling(), n = this.getNextSibling();
		super.remove(e), t && n && Dn(t) && Dn(n) && (Nn(t.getFirstChild(), n.getFirstChild()), n.remove());
	}
	insertNewAfter(e, t = !0) {
		let n = B().updateFromJSON(this.exportJSON()).setChecked(!this.getChecked() && void 0);
		return this.insertAfter(n, t), n;
	}
	collapseAtStart(e) {
		let t = Je();
		this.getChildren().forEach((e) => t.append(e));
		let n = this.getParentOrThrow(), r = n.getParentOrThrow(), i = V(r);
		if (n.getChildrenSize() === 1) {
			if (i) n.remove(), r.select();
			else {
				n.insertBefore(t), n.remove();
				let r = e.anchor, i = e.focus, a = t.getKey();
				r.type === "element" && r.getNode().is(this) && r.set(a, r.offset, "element"), i.type === "element" && i.getNode().is(this) && i.set(a, i.offset, "element");
			}
		} else n.insertBefore(t), this.remove();
		return !0;
	}
	getValue() {
		return this.getLatest().__value;
	}
	setValue(e) {
		let t = this.getWritable();
		return t.__value = e, t;
	}
	getChecked() {
		let e = this.getLatest(), t, n = this.getParent();
		return U(n) && (t = n.getListType()), t === "check" ? !!e.__checked : void 0;
	}
	setChecked(e) {
		let t = this.getWritable();
		return t.__checked = e, t;
	}
	toggleChecked() {
		let e = this.getWritable();
		return e.setChecked(!e.__checked);
	}
	getIndent() {
		let e = this.getParent();
		if (e === null || !this.isAttached()) return this.getLatest().__indent;
		let t = e.getParentOrThrow(), n = 0;
		for (; V(t);) t = t.getParentOrThrow().getParentOrThrow(), n++;
		return n;
	}
	setIndent(e) {
		typeof e != "number" && Cn(117), (e = Math.floor(e)) >= 0 || Cn(199);
		let t = this.getIndent();
		for (; t !== e;) t < e ? (In(this), t++) : (Ln(this), t--);
		return this;
	}
	canInsertAfter(e) {
		return V(e);
	}
	canReplaceWith(e) {
		return V(e);
	}
	canMergeWith(e) {
		return V(e) || Ce(e);
	}
	extractWithChild(e, t) {
		if (!M(t)) return !1;
		let n = t.anchor.getNode(), r = t.focus.getNode();
		return this.isParentOf(n) && this.isParentOf(r) && this.getTextContent().length === t.getTextContent().length;
	}
	isParentRequired() {
		return !0;
	}
	createParentElementNode() {
		return H("bullet");
	}
	canMergeWhenEmpty() {
		return !0;
	}
};
function Bn(e) {
	if (e.classList.contains("task-list-item")) {
		for (let t of e.children) if (t.tagName === "INPUT") return Vn(t);
	}
	if (e.classList.contains("joplin-checkbox")) {
		for (let t of e.children) if (t.classList.contains("checkbox-wrapper") && t.children.length > 0 && t.children[0].tagName === "INPUT") return Vn(t.children[0]);
	}
	let t = e.getAttribute("aria-checked");
	return { node: B(t === "true" || t !== "false" && void 0) };
}
function Vn(e) {
	return e.getAttribute("type") === "checkbox" ? { node: B(e.hasAttribute("checked")) } : { node: null };
}
function B(e) {
	return S(new zn(void 0, e));
}
function V(e) {
	return e instanceof zn;
}
var Hn = class extends j {
	__tag;
	__start;
	__listType;
	$config() {
		return this.config("list", {
			$transform: (e) => {
				(function(e) {
					let t = e.getNextSibling();
					U(t) && e.getListType() === t.getListType() && Nn(e, t);
				})(e), Fn(e);
			},
			extends: j,
			importDOM: ye({
				ol: () => ({
					conversion: Gn,
					priority: 0
				}),
				ul: () => ({
					conversion: Gn,
					priority: 0
				})
			})
		});
	}
	constructor(e = "number", t = 1, n) {
		super(n);
		let r = Kn[e] || e;
		this.__listType = r, this.__tag = r === "number" ? "ol" : "ul", this.__start = t;
	}
	afterCloneFrom(e) {
		super.afterCloneFrom(e), this.__listType = e.__listType, this.__tag = e.__tag, this.__start = e.__start;
	}
	getTag() {
		return this.getLatest().__tag;
	}
	setListType(e) {
		let t = this.getWritable();
		return t.__listType = e, t.__tag = e === "number" ? "ol" : "ul", t;
	}
	getListType() {
		return this.getLatest().__listType;
	}
	getStart() {
		return this.getLatest().__start;
	}
	setStart(e) {
		let t = this.getWritable();
		return t.__start = e, t;
	}
	createDOM(e, t) {
		let n = this.__tag, r = document.createElement(n);
		return this.__start !== 1 && r.setAttribute("start", String(this.__start)), r.__lexicalListType = this.__listType, Un(r, e.theme, this), r;
	}
	updateDOM(e, t, n) {
		return e.__tag !== this.__tag || e.__listType !== this.__listType || (Un(t, n.theme, this), !1);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setListType(e.listType).setStart(e.start);
	}
	exportDOM(e) {
		let t = this.createDOM(e._config, e);
		return He(t) && (this.__start !== 1 && t.setAttribute("start", String(this.__start)), this.__listType === "check" && t.setAttribute("__lexicalListType", "check")), { element: t };
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			listType: this.getListType(),
			start: this.getStart(),
			tag: this.getTag()
		};
	}
	canBeEmpty() {
		return !1;
	}
	canIndent() {
		return !1;
	}
	splice(e, t, n) {
		let r = n;
		for (let e = 0; e < n.length; e++) {
			let t = n[e];
			V(t) || (r === n && (r = [...n]), r[e] = B().append(!ke(t) || U(t) || t.isInline() ? t : P(t.getTextContent())));
		}
		return super.splice(e, t, r);
	}
	extractWithChild(e) {
		return V(e);
	}
};
function Un(e, t, n) {
	let r = [], i = [], a = t.list;
	if (a !== void 0) {
		let e = a[`${n.__tag}Depth`] || [], t = wn(n) - 1, o = t % e.length, s = e[o], c = a[n.__tag], l, u = a.nested, d = a.checklist;
		if (u !== void 0 && u.list && (l = u.list), c !== void 0 && r.push(c), d !== void 0 && n.__listType === "check" && r.push(d), s !== void 0) {
			r.push(...L(s));
			for (let t = 0; t < e.length; t++) t !== o && i.push(n.__tag + t);
		}
		if (l !== void 0) {
			let e = L(l);
			t > 1 ? r.push(...e) : i.push(...e);
		}
	}
	i.length > 0 && We(e, ...i), r.length > 0 && F(e, ...r);
}
function Wn(e) {
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		if (V(r)) {
			t.push(r);
			let e = r.getChildren();
			e.length > 1 && e.forEach((e) => {
				U(e) && t.push(On(e));
			});
		} else t.push(On(r));
	}
	return t;
}
function Gn(e) {
	let t = e.nodeName.toLowerCase(), n = null;
	return t === "ol" ? n = H("number", e.start) : t === "ul" && (n = function(e) {
		if (e.getAttribute("__lexicallisttype") === "check" || e.classList.contains("contains-task-list") || e.getAttribute("data-is-checklist") === "1") return !0;
		for (let t of e.childNodes) if (He(t) && t.hasAttribute("aria-checked")) return !0;
		return !1;
	}(e) ? H("check") : H("bullet")), {
		after: Wn,
		node: n
	};
}
var Kn = {
	ol: "number",
	ul: "bullet"
};
function H(e = "number", t = 1) {
	return S(new Hn(e, t));
}
function U(e) {
	return e instanceof Hn;
}
var qn = at("INSERT_CHECK_LIST_COMMAND");
function Jn(e) {
	return Ee(e.registerCommand(qn, () => (An("check"), !0), 1), e.registerCommand(xe, (t) => $n(t, e, !1), 1), e.registerCommand(nt, (t) => $n(t, e, !0), 1), e.registerCommand(de, () => Qn() != null && (e.getRootElement()?.focus(), !0), 1), e.registerCommand(De, (t) => {
		let n = Qn();
		return !(n == null || !e.isEditable()) && (e.update(() => {
			let e = N(n);
			V(e) && (t.preventDefault(), e.toggleChecked());
		}), !0);
	}, 1), e.registerCommand(Ie, (t) => e.getEditorState().read(() => {
		let n = k();
		if (M(n) && n.isCollapsed()) {
			let { anchor: r } = n, i = r.type === "element";
			if (i || r.offset === 0) {
				let n = r.getNode(), a = ht(n, (e) => ke(e) && !e.isInline());
				if (V(a)) {
					let r = a.getParent();
					if (U(r) && r.getListType() === "check" && (i || a.getFirstDescendant() === n)) {
						let n = e.getElementByKey(a.__key);
						if (n != null && document.activeElement !== n) return n.focus(), t.preventDefault(), !0;
					}
				}
			}
		}
		return !1;
	}), 1), e.registerRootListener((e, t) => {
		e !== null && (e.addEventListener("click", Xn), e.addEventListener("pointerdown", Zn)), t !== null && (t.removeEventListener("click", Xn), t.removeEventListener("pointerdown", Zn));
	}));
}
function Yn(e, t) {
	let n = e.target;
	if (!He(n)) return;
	let r = n.firstChild;
	if (He(r) && (r.tagName === "UL" || r.tagName === "OL")) return;
	let i = n.parentNode;
	if (!i || i.__lexicalListType !== "check") return;
	let a = n.getBoundingClientRect(), o = w(n), s = e.clientX / o, c = window.getComputedStyle ? window.getComputedStyle(n, "::before") : { width: "0px" }, l = parseFloat(c.width), u = e.pointerType === "touch" ? 32 : 0;
	(n.dir === "rtl" ? s < a.right + u && s > a.right - l - u : s > a.left - u && s < a.left + l + u) && t();
}
function Xn(e) {
	Yn(e, () => {
		if (He(e.target)) {
			let t = e.target, n = Ze(t);
			n != null && n.isEditable() && n.update(() => {
				let e = N(t);
				V(e) && (t.focus(), e.toggleChecked());
			});
		}
	});
}
function Zn(e) {
	Yn(e, () => {
		e.preventDefault();
	});
}
function Qn() {
	let e = document.activeElement;
	return He(e) && e.tagName === "LI" && e.parentNode != null && e.parentNode.__lexicalListType === "check" ? e : null;
}
function $n(e, t, n) {
	let r = Qn();
	return r != null && t.update(() => {
		let i = N(r);
		if (!V(i)) return;
		let a = function(e, t) {
			let n = t ? e.getPreviousSibling() : e.getNextSibling(), r = e;
			for (; n == null && V(r);) r = r.getParentOrThrow().getParent(), r != null && (n = t ? r.getPreviousSibling() : r.getNextSibling());
			for (; V(n);) {
				let e = t ? n.getLastChild() : n.getFirstChild();
				if (!U(e)) return n;
				n = t ? e.getLastChild() : e.getFirstChild();
			}
			return null;
		}(i, n);
		if (a != null) {
			a.selectStart();
			let n = t.getElementByKey(a.__key);
			n != null && (e.preventDefault(), setTimeout(() => {
				n.focus();
			}, 0));
		}
	}), !1;
}
var er = at("UPDATE_LIST_START_COMMAND"), tr = at("INSERT_UNORDERED_LIST_COMMAND"), nr = at("INSERT_ORDERED_LIST_COMMAND"), rr = at("REMOVE_LIST_COMMAND");
function ir(e) {
	return Ee(e.registerCommand(nr, () => (An("number"), !0), 1), e.registerCommand(er, (e) => {
		let { listNodeKey: t, newStart: n } = e, r = mt(t);
		return !!U(r) && (r.getListType() === "number" && (r.setStart(n), Fn(r)), !0);
	}, 1), e.registerCommand(tr, () => (An("bullet"), !0), 1), e.registerCommand(rr, () => (Pn(), !0), 1), e.registerCommand(Xe, () => Rn(), 1), e.registerNodeTransform(zn, (e) => {
		let t = e.getFirstChild();
		if (t) {
			if (ut(t)) {
				let n = t.getStyle(), r = t.getFormat();
				e.getTextStyle() !== n && e.setTextStyle(n), e.getTextFormat() !== r && e.setTextFormat(r);
			}
		} else {
			let t = k();
			M(t) && (t.style !== e.getTextStyle() || t.format !== e.getTextFormat()) && t.isCollapsed() && e.is(t.anchor.getNode()) && e.setTextStyle(t.style).setTextFormat(t.format);
		}
	}), e.registerNodeTransform(je, (e) => {
		let t = e.getParent();
		if (V(t) && e.is(t.getFirstChild())) {
			let n = e.getStyle(), r = e.getFormat();
			n === t.getTextStyle() && r === t.getTextFormat() || t.setTextStyle(n).setTextFormat(r);
		}
	}));
}
function ar(e) {
	let t = (e) => {
		let t = e.getParent();
		if (U(e.getFirstChild()) || !U(t)) return;
		let n = ht(e, (e) => V(e) && U(e.getParent()) && V(e.getPreviousSibling()));
		if (n === null && e.getIndent() > 0) e.setIndent(0);
		else if (V(n)) {
			let r = n.getPreviousSibling();
			if (V(r)) {
				let n = function(e) {
					let t = e, n = t.getFirstChild();
					for (; U(n);) {
						let e = n.getLastChild();
						if (!V(e)) break;
						t = e, n = t.getFirstChild();
					}
					return t;
				}(r).getParent();
				if (U(n)) {
					let r = wn(n);
					r + 1 < wn(t) && e.setIndent(r);
				}
			}
		}
	};
	return e.registerNodeTransform(Hn, (e) => {
		let n = [e];
		for (; n.length > 0;) {
			let e = n.shift();
			if (U(e)) {
				for (let r of e.getChildren()) if (V(r)) {
					t(r);
					let e = r.getFirstChild();
					U(e) && n.push(e);
				}
			}
		}
	});
}
var or = Ve({
	build: (e, t, n) => it(t),
	config: xt({ hasStrictIndent: !1 }),
	name: "@lexical/list/List",
	nodes: () => [Hn, zn],
	register(e, t, n) {
		let r = n.getOutput();
		return Ee(ir(e), pe(() => r.hasStrictIndent.value ? ar(e) : void 0));
	}
});
Ve({
	dependencies: [or],
	name: "@lexical/list/CheckList",
	register: Jn
});
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalListPlugin.prod.mjs
function sr({ hasStrictIndent: e = !1 }) {
	let [t] = Mt();
	return R(() => {
		if (!t.hasNodes([Hn, zn])) throw Error("ListPlugin: ListNode and/or ListItemNode not registered on editor");
	}, [t]), R(() => {
		if (e) return ar(t);
	}, [t, e]), function(e) {
		R(() => ir(e), [e]);
	}(t), null;
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalTabIndentationPlugin.prod.mjs
function cr({ maxIndent: e }) {
	let [t] = Mt();
	return R(() => Ae(t, e), [t, e]), null;
}
// node_modules/.bun/prismjs@1.30.0/node_modules/prismjs/components/prism-cpp.js
Prism.languages.clike = {
	comment: [{
		pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
		lookbehind: !0,
		greedy: !0
	}, {
		pattern: /(^|[^\\:])\/\/.*/,
		lookbehind: !0,
		greedy: !0
	}],
	string: {
		pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: !0
	},
	"class-name": {
		pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
		lookbehind: !0,
		inside: { punctuation: /[.\\]/ }
	},
	keyword: /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
	boolean: /\b(?:false|true)\b/,
	function: /\b\w+(?=\()/,
	number: /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
	operator: /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
	punctuation: /[{}[\];(),.:]/
}, Prism.languages.javascript = Prism.languages.extend("clike", {
	"class-name": [Prism.languages.clike["class-name"], {
		pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
		lookbehind: !0
	}],
	keyword: [{
		pattern: /((?:^|\})\s*)catch\b/,
		lookbehind: !0
	}, {
		pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
		lookbehind: !0
	}],
	function: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
	number: {
		pattern: RegExp("(^|[^\\w$])(?:NaN|Infinity|0[bB][01]+(?:_[01]+)*n?|0[oO][0-7]+(?:_[0-7]+)*n?|0[xX][\\dA-Fa-f]+(?:_[\\dA-Fa-f]+)*n?|\\d+(?:_\\d+)*n|(?:\\d+(?:_\\d+)*(?:\\.(?:\\d+(?:_\\d+)*)?)?|\\.\\d+(?:_\\d+)*)(?:[Ee][+-]?\\d+(?:_\\d+)*)?)(?![\\w$])"),
		lookbehind: !0
	},
	operator: /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
}), Prism.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/, Prism.languages.insertBefore("javascript", "keyword", {
	regex: {
		pattern: RegExp("((?:^|[^$\\w\\xA0-\\uFFFF.\"'\\])\\s]|\\b(?:return|yield))\\s*)\\/(?:(?:\\[(?:[^\\]\\\\\\r\\n]|\\\\.)*\\]|\\\\.|[^/\\\\\\[\\r\\n])+\\/[dgimyus]{0,7}|(?:\\[(?:[^[\\]\\\\\\r\\n]|\\\\.|\\[(?:[^[\\]\\\\\\r\\n]|\\\\.|\\[(?:[^[\\]\\\\\\r\\n]|\\\\.)*\\])*\\])*\\]|\\\\.|[^/\\\\\\[\\r\\n])+\\/[dgimyus]{0,7}v[dgimyus]{0,7})(?=(?:\\s|\\/\\*(?:[^*]|\\*(?!\\/))*\\*\\/)*(?:$|[\\r\\n,.;:})\\]]|\\/\\/))"),
		lookbehind: !0,
		greedy: !0,
		inside: {
			"regex-source": {
				pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
				lookbehind: !0,
				alias: "language-regex",
				inside: Prism.languages.regex
			},
			"regex-delimiter": /^\/|\/$/,
			"regex-flags": /^[a-z]+$/
		}
	},
	"function-variable": {
		pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
		alias: "function"
	},
	parameter: [
		{
			pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
			lookbehind: !0,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
			lookbehind: !0,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
			lookbehind: !0,
			inside: Prism.languages.javascript
		},
		{
			pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
			lookbehind: !0,
			inside: Prism.languages.javascript
		}
	],
	constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/
}), Prism.languages.insertBefore("javascript", "string", {
	hashbang: {
		pattern: /^#!.*/,
		greedy: !0,
		alias: "comment"
	},
	"template-string": {
		pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
		greedy: !0,
		inside: {
			"template-punctuation": {
				pattern: /^`|`$/,
				alias: "string"
			},
			interpolation: {
				pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
				lookbehind: !0,
				inside: {
					"interpolation-punctuation": {
						pattern: /^\$\{|\}$/,
						alias: "punctuation"
					},
					rest: Prism.languages.javascript
				}
			},
			string: /[\s\S]+/
		}
	},
	"string-property": {
		pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
		lookbehind: !0,
		greedy: !0,
		alias: "property"
	}
}), Prism.languages.insertBefore("javascript", "operator", { "literal-property": {
	pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
	lookbehind: !0,
	alias: "property"
} }), Prism.languages.markup && (Prism.languages.markup.tag.addInlined("script", "javascript"), Prism.languages.markup.tag.addAttribute("on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)", "javascript")), Prism.languages.js = Prism.languages.javascript, Prism.languages.markup = {
	comment: {
		pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
		greedy: !0
	},
	prolog: {
		pattern: /<\?[\s\S]+?\?>/,
		greedy: !0
	},
	doctype: {
		pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
		greedy: !0,
		inside: {
			"internal-subset": {
				pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
				lookbehind: !0,
				greedy: !0,
				inside: null
			},
			string: {
				pattern: /"[^"]*"|'[^']*'/,
				greedy: !0
			},
			punctuation: /^<!|>$|[[\]]/,
			"doctype-tag": /^DOCTYPE/i,
			name: /[^\s<>'"]+/
		}
	},
	cdata: {
		pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
		greedy: !0
	},
	tag: {
		pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
		greedy: !0,
		inside: {
			tag: {
				pattern: /^<\/?[^\s>\/]+/,
				inside: {
					punctuation: /^<\/?/,
					namespace: /^[^\s>\/:]+:/
				}
			},
			"special-attr": [],
			"attr-value": {
				pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
				inside: { punctuation: [{
					pattern: /^=/,
					alias: "attr-equals"
				}, {
					pattern: /^(\s*)["']|["']$/,
					lookbehind: !0
				}] }
			},
			punctuation: /\/?>/,
			"attr-name": {
				pattern: /[^\s>\/]+/,
				inside: { namespace: /^[^\s>\/:]+:/ }
			}
		}
	},
	entity: [{
		pattern: /&[\da-z]{1,8};/i,
		alias: "named-entity"
	}, /&#x?[\da-f]{1,8};/i]
}, Prism.languages.markup.tag.inside["attr-value"].inside.entity = Prism.languages.markup.entity, Prism.languages.markup.doctype.inside["internal-subset"].inside = Prism.languages.markup, Prism.hooks.add("wrap", function(e) {
	e.type === "entity" && (e.attributes.title = e.content.replace(/&amp;/, "&"));
}), Object.defineProperty(Prism.languages.markup.tag, "addInlined", { value: function(e, t) {
	var n = {};
	n["language-" + t] = {
		pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
		lookbehind: !0,
		inside: Prism.languages[t]
	}, n.cdata = /^<!\[CDATA\[|\]\]>$/i;
	var r = { "included-cdata": {
		pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
		inside: n
	} };
	r["language-" + t] = {
		pattern: /[\s\S]+/,
		inside: Prism.languages[t]
	};
	var i = {};
	i[e] = {
		pattern: RegExp("(<__[^>]*>)(?:<!\\[CDATA\\[(?:[^\\]]|\\](?!\\]>))*\\]\\]>|(?!<!\\[CDATA\\[)[\\s\\S])*?(?=<\\/__>)".replace(/__/g, function() {
			return e;
		}), "i"),
		lookbehind: !0,
		greedy: !0,
		inside: r
	}, Prism.languages.insertBefore("markup", "cdata", i);
} }), Object.defineProperty(Prism.languages.markup.tag, "addAttribute", { value: function(e, t) {
	Prism.languages.markup.tag.inside["special-attr"].push({
		pattern: RegExp("(^|[\"'\\s])(?:" + e + ")\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s'\">=]+(?=[\\s>]))", "i"),
		lookbehind: !0,
		inside: {
			"attr-name": /^[^\s=]+/,
			"attr-value": {
				pattern: /=[\s\S]+/,
				inside: {
					value: {
						pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
						lookbehind: !0,
						alias: [t, "language-" + t],
						inside: Prism.languages[t]
					},
					punctuation: [{
						pattern: /^=/,
						alias: "attr-equals"
					}, /"|'/]
				}
			}
		}
	});
} }), Prism.languages.html = Prism.languages.markup, Prism.languages.mathml = Prism.languages.markup, Prism.languages.svg = Prism.languages.markup, Prism.languages.xml = Prism.languages.extend("markup", {}), Prism.languages.ssml = Prism.languages.xml, Prism.languages.atom = Prism.languages.xml, Prism.languages.rss = Prism.languages.xml, (function(e) {
	function t(e) {
		return e = e.replace(/<inner>/g, function() {
			return "(?:\\\\.|[^\\\\\\n\\r]|(?:\\n|\\r\\n?)(?![\\r\\n]))";
		}), RegExp("((?:^|[^\\\\])(?:\\\\{2})*)(?:" + e + ")");
	}
	var n = "(?:\\\\.|``(?:[^`\\r\\n]|`(?!`))+``|`[^`\\r\\n]+`|[^\\\\|\\r\\n`])+", r = "\\|?__(?:\\|__)+\\|?(?:(?:\\n|\\r\\n?)|(?![\\s\\S]))".replace(/__/g, function() {
		return n;
	}), i = "\\|?[ \\t]*:?-{3,}:?[ \\t]*(?:\\|[ \\t]*:?-{3,}:?[ \\t]*)+\\|?(?:\\n|\\r\\n?)";
	e.languages.markdown = e.languages.extend("markup", {}), e.languages.insertBefore("markdown", "prolog", {
		"front-matter-block": {
			pattern: /(^(?:\s*[\r\n])?)---(?!.)[\s\S]*?[\r\n]---(?!.)/,
			lookbehind: !0,
			greedy: !0,
			inside: {
				punctuation: /^---|---$/,
				"front-matter": {
					pattern: /\S+(?:\s+\S+)*/,
					alias: ["yaml", "language-yaml"],
					inside: e.languages.yaml
				}
			}
		},
		blockquote: {
			pattern: /^>(?:[\t ]*>)*/m,
			alias: "punctuation"
		},
		table: {
			pattern: RegExp("^" + r + i + "(?:" + r + ")*", "m"),
			inside: {
				"table-data-rows": {
					pattern: RegExp("^(" + r + i + ")(?:" + r + ")*$"),
					lookbehind: !0,
					inside: {
						"table-data": {
							pattern: RegExp(n),
							inside: e.languages.markdown
						},
						punctuation: /\|/
					}
				},
				"table-line": {
					pattern: RegExp("^(" + r + ")" + i + "$"),
					lookbehind: !0,
					inside: { punctuation: /\||:?-{3,}:?/ }
				},
				"table-header-row": {
					pattern: RegExp("^" + r + "$"),
					inside: {
						"table-header": {
							pattern: RegExp(n),
							alias: "important",
							inside: e.languages.markdown
						},
						punctuation: /\|/
					}
				}
			}
		},
		code: [{
			pattern: /((?:^|\n)[ \t]*\n|(?:^|\r\n?)[ \t]*\r\n?)(?: {4}|\t).+(?:(?:\n|\r\n?)(?: {4}|\t).+)*/,
			lookbehind: !0,
			alias: "keyword"
		}, {
			pattern: /^```[\s\S]*?^```$/m,
			greedy: !0,
			inside: {
				"code-block": {
					pattern: /^(```.*(?:\n|\r\n?))[\s\S]+?(?=(?:\n|\r\n?)^```$)/m,
					lookbehind: !0
				},
				"code-language": {
					pattern: /^(```).+/,
					lookbehind: !0
				},
				punctuation: /```/
			}
		}],
		title: [{
			pattern: /\S.*(?:\n|\r\n?)(?:==+|--+)(?=[ \t]*$)/m,
			alias: "important",
			inside: { punctuation: /==+$|--+$/ }
		}, {
			pattern: /(^\s*)#.+/m,
			lookbehind: !0,
			alias: "important",
			inside: { punctuation: /^#+|#+$/ }
		}],
		hr: {
			pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
			lookbehind: !0,
			alias: "punctuation"
		},
		list: {
			pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
			lookbehind: !0,
			alias: "punctuation"
		},
		"url-reference": {
			pattern: /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
			inside: {
				variable: {
					pattern: /^(!?\[)[^\]]+/,
					lookbehind: !0
				},
				string: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
				punctuation: /^[\[\]!:]|[<>]/
			},
			alias: "url"
		},
		bold: {
			pattern: t("\\b__(?:(?!_)<inner>|_(?:(?!_)<inner>)+_)+__\\b|\\*\\*(?:(?!\\*)<inner>|\\*(?:(?!\\*)<inner>)+\\*)+\\*\\*"),
			lookbehind: !0,
			greedy: !0,
			inside: {
				content: {
					pattern: /(^..)[\s\S]+(?=..$)/,
					lookbehind: !0,
					inside: {}
				},
				punctuation: /\*\*|__/
			}
		},
		italic: {
			pattern: t("\\b_(?:(?!_)<inner>|__(?:(?!_)<inner>)+__)+_\\b|\\*(?:(?!\\*)<inner>|\\*\\*(?:(?!\\*)<inner>)+\\*\\*)+\\*"),
			lookbehind: !0,
			greedy: !0,
			inside: {
				content: {
					pattern: /(^.)[\s\S]+(?=.$)/,
					lookbehind: !0,
					inside: {}
				},
				punctuation: /[*_]/
			}
		},
		strike: {
			pattern: t("(~~?)(?:(?!~)<inner>)+\\2"),
			lookbehind: !0,
			greedy: !0,
			inside: {
				content: {
					pattern: /(^~~?)[\s\S]+(?=\1$)/,
					lookbehind: !0,
					inside: {}
				},
				punctuation: /~~?/
			}
		},
		"code-snippet": {
			pattern: /(^|[^\\`])(?:``[^`\r\n]+(?:`[^`\r\n]+)*``(?!`)|`[^`\r\n]+`(?!`))/,
			lookbehind: !0,
			greedy: !0,
			alias: ["code", "keyword"]
		},
		url: {
			pattern: t("!?\\[(?:(?!\\])<inner>)+\\](?:\\([^\\s)]+(?:[\\t ]+\"(?:\\\\.|[^\"\\\\])*\")?\\)|[ \\t]?\\[(?:(?!\\])<inner>)+\\])"),
			lookbehind: !0,
			greedy: !0,
			inside: {
				operator: /^!/,
				content: {
					pattern: /(^\[)[^\]]+(?=\])/,
					lookbehind: !0,
					inside: {}
				},
				variable: {
					pattern: /(^\][ \t]?\[)[^\]]+(?=\]$)/,
					lookbehind: !0
				},
				url: {
					pattern: /(^\]\()[^\s)]+/,
					lookbehind: !0
				},
				string: {
					pattern: /(^[ \t]+)"(?:\\.|[^"\\])*"(?=\)$)/,
					lookbehind: !0
				}
			}
		}
	}), [
		"url",
		"bold",
		"italic",
		"strike"
	].forEach(function(t) {
		[
			"url",
			"bold",
			"italic",
			"strike",
			"code-snippet"
		].forEach(function(n) {
			t !== n && (e.languages.markdown[t].inside.content.inside[n] = e.languages.markdown[n]);
		});
	}), e.hooks.add("after-tokenize", function(e) {
		if (e.language !== "markdown" && e.language !== "md") return;
		function t(e) {
			if (e && typeof e != "string") for (var n = 0, r = e.length; n < r; n++) {
				var i = e[n];
				if (i.type !== "code") t(i.content);
				else {
					var a = i.content[1], o = i.content[3];
					if (a && o && a.type === "code-language" && o.type === "code-block" && typeof a.content == "string") {
						var s = a.content.replace(/\b#/g, "sharp").replace(/\b\+\+/g, "pp");
						s = (/[a-z][\w-]*/i.exec(s) || [""])[0].toLowerCase();
						var c = "language-" + s;
						o.alias ? typeof o.alias == "string" ? o.alias = [o.alias, c] : o.alias.push(c) : o.alias = [c];
					}
				}
			}
		}
		t(e.tokens);
	}), e.hooks.add("wrap", function(t) {
		if (t.type === "code-block") {
			for (var n = "", r = 0, i = t.classes.length; r < i; r++) {
				var a = t.classes[r], o = /language-(.+)/.exec(a);
				if (o) {
					n = o[1];
					break;
				}
			}
			var s = e.languages[n];
			if (s) t.content = e.highlight(c(t.content), s, n);
			else if (n && n !== "none" && e.plugins.autoloader) {
				var l = "md-" + (/* @__PURE__ */ new Date()).valueOf() + "-" + Math.floor(Math.random() * 0x2386f26fc10000);
				t.attributes.id = l, e.plugins.autoloader.loadLanguages(n, function() {
					var t = document.getElementById(l);
					t && (t.innerHTML = e.highlight(t.textContent, e.languages[n], n));
				});
			}
		}
	});
	var a = RegExp(e.languages.markup.tag.pattern.source, "gi"), o = {
		amp: "&",
		lt: "<",
		gt: ">",
		quot: "\""
	}, s = String.fromCodePoint || String.fromCharCode;
	function c(e) {
		var t = e.replace(a, "");
		return t = t.replace(/&(\w{1,8}|#x?[\da-f]{1,8});/gi, function(e, t) {
			return t = t.toLowerCase(), t[0] === "#" ? s(t[1] === "x" ? parseInt(t.slice(2), 16) : Number(t.slice(1))) : o[t] || e;
		}), t;
	}
	e.languages.md = e.languages.markdown;
})(Prism), Prism.languages.c = Prism.languages.extend("clike", {
	comment: {
		pattern: /\/\/(?:[^\r\n\\]|\\(?:\r\n?|\n|(?![\r\n])))*|\/\*[\s\S]*?(?:\*\/|$)/,
		greedy: !0
	},
	string: {
		pattern: /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
		greedy: !0
	},
	"class-name": {
		pattern: /(\b(?:enum|struct)\s+(?:__attribute__\s*\(\([\s\S]*?\)\)\s*)?)\w+|\b[a-z]\w*_t\b/,
		lookbehind: !0
	},
	keyword: /\b(?:_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local|__attribute__|asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|typeof|union|unsigned|void|volatile|while)\b/,
	function: /\b[a-z_]\w*(?=\s*\()/i,
	number: /(?:\b0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?)[ful]{0,4}/i,
	operator: />>=?|<<=?|->|([-+&|:])\1|[?:~]|[-+*/%&|^!=<>]=?/
}), Prism.languages.insertBefore("c", "string", { char: {
	pattern: /'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n]){0,32}'/,
	greedy: !0
} }), Prism.languages.insertBefore("c", "string", { macro: {
	pattern: /(^[\t ]*)#\s*[a-z](?:[^\r\n\\/]|\/(?!\*)|\/\*(?:[^*]|\*(?!\/))*\*\/|\\(?:\r\n|[\s\S]))*/im,
	lookbehind: !0,
	greedy: !0,
	alias: "property",
	inside: {
		string: [{
			pattern: /^(#\s*include\s*)<[^>]+>/,
			lookbehind: !0
		}, Prism.languages.c.string],
		char: Prism.languages.c.char,
		comment: Prism.languages.c.comment,
		"macro-name": [{
			pattern: /(^#\s*define\s+)\w+\b(?!\()/i,
			lookbehind: !0
		}, {
			pattern: /(^#\s*define\s+)\w+\b(?=\()/i,
			lookbehind: !0,
			alias: "function"
		}],
		directive: {
			pattern: /^(#\s*)[a-z]+/,
			lookbehind: !0,
			alias: "keyword"
		},
		"directive-hash": /^#/,
		punctuation: /##|\\(?=[\r\n])/,
		expression: {
			pattern: /\S[\s\S]*/,
			inside: Prism.languages.c
		}
	}
} }), Prism.languages.insertBefore("c", "function", { constant: /\b(?:EOF|NULL|SEEK_CUR|SEEK_END|SEEK_SET|__DATE__|__FILE__|__LINE__|__TIMESTAMP__|__TIME__|__func__|stderr|stdin|stdout)\b/ }), delete Prism.languages.c.boolean, (function(e) {
	var t = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
	e.languages.css = {
		comment: /\/\*[\s\S]*?\*\//,
		atrule: {
			pattern: RegExp("@[\\w-](?:[^;{\\s\"']|\\s+(?!\\s)|" + t.source + ")*?(?:;|(?=\\s*\\{))"),
			inside: {
				rule: /^@[\w-]+/,
				"selector-function-argument": {
					pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
					lookbehind: !0,
					alias: "selector"
				},
				keyword: {
					pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
					lookbehind: !0
				}
			}
		},
		url: {
			pattern: RegExp("\\burl\\((?:" + t.source + "|(?:[^\\\\\\r\\n()\"']|\\\\[\\s\\S])*)\\)", "i"),
			greedy: !0,
			inside: {
				function: /^url/i,
				punctuation: /^\(|\)$/,
				string: {
					pattern: RegExp("^" + t.source + "$"),
					alias: "url"
				}
			}
		},
		selector: {
			pattern: RegExp("(^|[{}\\s])[^{}\\s](?:[^{};\"'\\s]|\\s+(?![\\s{])|" + t.source + ")*(?=\\s*\\{)"),
			lookbehind: !0
		},
		string: {
			pattern: t,
			greedy: !0
		},
		property: {
			pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
			lookbehind: !0
		},
		important: /!important\b/i,
		function: {
			pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
			lookbehind: !0
		},
		punctuation: /[(){};:,]/
	}, e.languages.css.atrule.inside.rest = e.languages.css;
	var n = e.languages.markup;
	n && (n.tag.addInlined("style", "css"), n.tag.addAttribute("style", "css"));
})(Prism), Prism.languages.objectivec = Prism.languages.extend("c", {
	string: {
		pattern: /@?"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
		greedy: !0
	},
	keyword: /\b(?:asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|in|inline|int|long|register|return|self|short|signed|sizeof|static|struct|super|switch|typedef|typeof|union|unsigned|void|volatile|while)\b|(?:@interface|@end|@implementation|@protocol|@class|@public|@protected|@private|@property|@try|@catch|@finally|@throw|@synthesize|@dynamic|@selector)\b/,
	operator: /-[->]?|\+\+?|!=?|<<?=?|>>?=?|==?|&&?|\|\|?|[~^%?*\/@]/
}), delete Prism.languages.objectivec["class-name"], Prism.languages.objc = Prism.languages.objectivec, Prism.languages.sql = {
	comment: {
		pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
		lookbehind: !0
	},
	variable: [{
		pattern: /@(["'`])(?:\\[\s\S]|(?!\1)[^\\])+\1/,
		greedy: !0
	}, /@[\w.$]+/],
	string: {
		pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
		greedy: !0,
		lookbehind: !0
	},
	identifier: {
		pattern: /(^|[^@\\])`(?:\\[\s\S]|[^`\\]|``)*`/,
		greedy: !0,
		lookbehind: !0,
		inside: { punctuation: /^`|`$/ }
	},
	function: /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i,
	keyword: /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?: EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:COL|_INSERT)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MIDDLEINT|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTI(?:LINESTRING|POINT|POLYGON)|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREPARE|PREV|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESIGNAL|RESTORE|RESTRICT|RETURN(?:ING|S)?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SCHEMA|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNLOCK|UNPIVOT|UNSIGNED|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VAR(?:BINARY|CHAR|CHARACTER|YING)|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH(?: ROLLUP|IN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
	boolean: /\b(?:FALSE|NULL|TRUE)\b/i,
	number: /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?|\B\.\d+\b/i,
	operator: /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|DIV|ILIKE|IN|IS|LIKE|NOT|OR|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
	punctuation: /[;[\]()`,.]/
}, (function(e) {
	var t = e.languages.powershell = {
		comment: [{
			pattern: /(^|[^`])<#[\s\S]*?#>/,
			lookbehind: !0
		}, {
			pattern: /(^|[^`])#.*/,
			lookbehind: !0
		}],
		string: [{
			pattern: /"(?:`[\s\S]|[^`"])*"/,
			greedy: !0,
			inside: null
		}, {
			pattern: /'(?:[^']|'')*'/,
			greedy: !0
		}],
		namespace: /\[[a-z](?:\[(?:\[[^\]]*\]|[^\[\]])*\]|[^\[\]])*\]/i,
		boolean: /\$(?:false|true)\b/i,
		variable: /\$\w+\b/,
		function: [/\b(?:Add|Approve|Assert|Backup|Block|Checkpoint|Clear|Close|Compare|Complete|Compress|Confirm|Connect|Convert|ConvertFrom|ConvertTo|Copy|Debug|Deny|Disable|Disconnect|Dismount|Edit|Enable|Enter|Exit|Expand|Export|Find|ForEach|Format|Get|Grant|Group|Hide|Import|Initialize|Install|Invoke|Join|Limit|Lock|Measure|Merge|Move|New|Open|Optimize|Out|Ping|Pop|Protect|Publish|Push|Read|Receive|Redo|Register|Remove|Rename|Repair|Request|Reset|Resize|Resolve|Restart|Restore|Resume|Revoke|Save|Search|Select|Send|Set|Show|Skip|Sort|Split|Start|Step|Stop|Submit|Suspend|Switch|Sync|Tee|Test|Trace|Unblock|Undo|Uninstall|Unlock|Unprotect|Unpublish|Unregister|Update|Use|Wait|Watch|Where|Write)-[a-z]+\b/i, /\b(?:ac|cat|chdir|clc|cli|clp|clv|compare|copy|cp|cpi|cpp|cvpa|dbp|del|diff|dir|ebp|echo|epal|epcsv|epsn|erase|fc|fl|ft|fw|gal|gbp|gc|gci|gcs|gdr|gi|gl|gm|gp|gps|group|gsv|gu|gv|gwmi|iex|ii|ipal|ipcsv|ipsn|irm|iwmi|iwr|kill|lp|ls|measure|mi|mount|move|mp|mv|nal|ndr|ni|nv|ogv|popd|ps|pushd|pwd|rbp|rd|rdr|ren|ri|rm|rmdir|rni|rnp|rp|rv|rvpa|rwmi|sal|saps|sasv|sbp|sc|select|set|shcm|si|sl|sleep|sls|sort|sp|spps|spsv|start|sv|swmi|tee|trcm|type|write)\b/i],
		keyword: /\b(?:Begin|Break|Catch|Class|Continue|Data|Define|Do|DynamicParam|Else|ElseIf|End|Exit|Filter|Finally|For|ForEach|From|Function|If|InlineScript|Parallel|Param|Process|Return|Sequence|Switch|Throw|Trap|Try|Until|Using|Var|While|Workflow)\b/i,
		operator: {
			pattern: /(^|\W)(?:!|-(?:b?(?:and|x?or)|as|(?:Not)?(?:Contains|In|Like|Match)|eq|ge|gt|is(?:Not)?|Join|le|lt|ne|not|Replace|sh[lr])\b|-[-=]?|\+[+=]?|[*\/%]=?)/i,
			lookbehind: !0
		},
		punctuation: /[|{}[\];(),.]/
	};
	t.string[0].inside = {
		function: {
			pattern: /(^|[^`])\$\((?:\$\([^\r\n()]*\)|(?!\$\()[^\r\n)])*\)/,
			lookbehind: !0,
			inside: t
		},
		boolean: t.boolean,
		variable: t.variable
	};
})(Prism), Prism.languages.python = {
	comment: {
		pattern: /(^|[^\\])#.*/,
		lookbehind: !0,
		greedy: !0
	},
	"string-interpolation": {
		pattern: /(?:f|fr|rf)(?:("""|''')[\s\S]*?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2)/i,
		greedy: !0,
		inside: {
			interpolation: {
				pattern: /((?:^|[^{])(?:\{\{)*)\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}])+\})+\})+\}/,
				lookbehind: !0,
				inside: {
					"format-spec": {
						pattern: /(:)[^:(){}]+(?=\}$)/,
						lookbehind: !0
					},
					"conversion-option": {
						pattern: /![sra](?=[:}]$)/,
						alias: "punctuation"
					},
					rest: null
				}
			},
			string: /[\s\S]+/
		}
	},
	"triple-quoted-string": {
		pattern: /(?:[rub]|br|rb)?("""|''')[\s\S]*?\1/i,
		greedy: !0,
		alias: "string"
	},
	string: {
		pattern: /(?:[rub]|br|rb)?("|')(?:\\.|(?!\1)[^\\\r\n])*\1/i,
		greedy: !0
	},
	function: {
		pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
		lookbehind: !0
	},
	"class-name": {
		pattern: /(\bclass\s+)\w+/i,
		lookbehind: !0
	},
	decorator: {
		pattern: /(^[\t ]*)@\w+(?:\.\w+)*/m,
		lookbehind: !0,
		alias: ["annotation", "punctuation"],
		inside: { punctuation: /\./ }
	},
	keyword: /\b(?:_(?=\s*:)|and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
	builtin: /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
	boolean: /\b(?:False|None|True)\b/,
	number: /\b0(?:b(?:_?[01])+|o(?:_?[0-7])+|x(?:_?[a-f0-9])+)\b|(?:\b\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\B\.\d+(?:_\d+)*)(?:e[+-]?\d+(?:_\d+)*)?j?(?!\w)/i,
	operator: /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
	punctuation: /[{}[\];(),.:]/
}, Prism.languages.python["string-interpolation"].inside.interpolation.inside.rest = Prism.languages.python, Prism.languages.py = Prism.languages.python, (function(e) {
	for (var t = "\\/\\*(?:[^*/]|\\*(?!\\/)|\\/(?!\\*)|<self>)*\\*\\/", n = 0; n < 2; n++) t = t.replace(/<self>/g, function() {
		return t;
	});
	t = t.replace(/<self>/g, function() {
		return "[^\\s\\S]";
	}), e.languages.rust = {
		comment: [{
			pattern: RegExp("(^|[^\\\\])" + t),
			lookbehind: !0,
			greedy: !0
		}, {
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: !0,
			greedy: !0
		}],
		string: {
			pattern: /b?"(?:\\[\s\S]|[^\\"])*"|b?r(#*)"(?:[^"]|"(?!\1))*"\1/,
			greedy: !0
		},
		char: {
			pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u\{(?:[\da-fA-F]_*){1,6}\}|.)|[^\\\r\n\t'])'/,
			greedy: !0
		},
		attribute: {
			pattern: /#!?\[(?:[^\[\]"]|"(?:\\[\s\S]|[^\\"])*")*\]/,
			greedy: !0,
			alias: "attr-name",
			inside: { string: null }
		},
		"closure-params": {
			pattern: /([=(,:]\s*|\bmove\s*)\|[^|]*\||\|[^|]*\|(?=\s*(?:\{|->))/,
			lookbehind: !0,
			greedy: !0,
			inside: {
				"closure-punctuation": {
					pattern: /^\||\|$/,
					alias: "punctuation"
				},
				rest: null
			}
		},
		"lifetime-annotation": {
			pattern: /'\w+/,
			alias: "symbol"
		},
		"fragment-specifier": {
			pattern: /(\$\w+:)[a-z]+/,
			lookbehind: !0,
			alias: "punctuation"
		},
		variable: /\$\w+/,
		"function-definition": {
			pattern: /(\bfn\s+)\w+/,
			lookbehind: !0,
			alias: "function"
		},
		"type-definition": {
			pattern: /(\b(?:enum|struct|trait|type|union)\s+)\w+/,
			lookbehind: !0,
			alias: "class-name"
		},
		"module-declaration": [{
			pattern: /(\b(?:crate|mod)\s+)[a-z][a-z_\d]*/,
			lookbehind: !0,
			alias: "namespace"
		}, {
			pattern: /(\b(?:crate|self|super)\s*)::\s*[a-z][a-z_\d]*\b(?:\s*::(?:\s*[a-z][a-z_\d]*\s*::)*)?/,
			lookbehind: !0,
			alias: "namespace",
			inside: { punctuation: /::/ }
		}],
		keyword: [/\b(?:Self|abstract|as|async|await|become|box|break|const|continue|crate|do|dyn|else|enum|extern|final|fn|for|if|impl|in|let|loop|macro|match|mod|move|mut|override|priv|pub|ref|return|self|static|struct|super|trait|try|type|typeof|union|unsafe|unsized|use|virtual|where|while|yield)\b/, /\b(?:bool|char|f(?:32|64)|[ui](?:8|16|32|64|128|size)|str)\b/],
		function: /\b[a-z_]\w*(?=\s*(?:::\s*<|\())/,
		macro: {
			pattern: /\b\w+!/,
			alias: "property"
		},
		constant: /\b[A-Z_][A-Z_\d]+\b/,
		"class-name": /\b[A-Z]\w*\b/,
		namespace: {
			pattern: /(?:\b[a-z][a-z_\d]*\s*::\s*)*\b[a-z][a-z_\d]*\s*::(?!\s*<)/,
			inside: { punctuation: /::/ }
		},
		number: /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(?:(?:\d(?:_?\d)*)?\.)?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:f32|f64|[iu](?:8|16|32|64|size)?))?\b/,
		boolean: /\b(?:false|true)\b/,
		punctuation: /->|\.\.=|\.{1,3}|::|[{}[\];(),:]/,
		operator: /[-+*\/%!^]=?|=[=>]?|&[&=]?|\|[|=]?|<<?=?|>>?=?|[@?]/
	}, e.languages.rust["closure-params"].inside.rest = e.languages.rust, e.languages.rust.attribute.inside.string = e.languages.rust.string;
})(Prism), Prism.languages.swift = {
	comment: {
		pattern: /(^|[^\\:])(?:\/\/.*|\/\*(?:[^/*]|\/(?!\*)|\*(?!\/)|\/\*(?:[^*]|\*(?!\/))*\*\/)*\*\/)/,
		lookbehind: !0,
		greedy: !0
	},
	"string-literal": [{
		pattern: RegExp("(^|[^\"#])(?:\"(?:\\\\(?:\\((?:[^()]|\\([^()]*\\))*\\)|\\r\\n|[^(])|[^\\\\\\r\\n\"])*\"|\"\"\"(?:\\\\(?:\\((?:[^()]|\\([^()]*\\))*\\)|[^(])|[^\\\\\"]|\"(?!\"\"))*\"\"\")(?![\"#])"),
		lookbehind: !0,
		greedy: !0,
		inside: {
			interpolation: {
				pattern: /(\\\()(?:[^()]|\([^()]*\))*(?=\))/,
				lookbehind: !0,
				inside: null
			},
			"interpolation-punctuation": {
				pattern: /^\)|\\\($/,
				alias: "punctuation"
			},
			punctuation: /\\(?=[\r\n])/,
			string: /[\s\S]+/
		}
	}, {
		pattern: RegExp("(^|[^\"#])(#+)(?:\"(?:\\\\(?:#+\\((?:[^()]|\\([^()]*\\))*\\)|\\r\\n|[^#])|[^\\\\\\r\\n])*?\"|\"\"\"(?:\\\\(?:#+\\((?:[^()]|\\([^()]*\\))*\\)|[^#])|[^\\\\])*?\"\"\")\\2"),
		lookbehind: !0,
		greedy: !0,
		inside: {
			interpolation: {
				pattern: /(\\#+\()(?:[^()]|\([^()]*\))*(?=\))/,
				lookbehind: !0,
				inside: null
			},
			"interpolation-punctuation": {
				pattern: /^\)|\\#+\($/,
				alias: "punctuation"
			},
			string: /[\s\S]+/
		}
	}],
	directive: {
		pattern: RegExp("#(?:(?:elseif|if)\\b(?:[ 	]*(?:![ \\t]*)?(?:\\b\\w+\\b(?:[ \\t]*\\((?:[^()]|\\([^()]*\\))*\\))?|\\((?:[^()]|\\([^()]*\\))*\\))(?:[ \\t]*(?:&&|\\|\\|))?)+|(?:else|endif)\\b)"),
		alias: "property",
		inside: {
			"directive-name": /^#\w+/,
			boolean: /\b(?:false|true)\b/,
			number: /\b\d+(?:\.\d+)*\b/,
			operator: /!|&&|\|\||[<>]=?/,
			punctuation: /[(),]/
		}
	},
	literal: {
		pattern: /#(?:colorLiteral|column|dsohandle|file(?:ID|Literal|Path)?|function|imageLiteral|line)\b/,
		alias: "constant"
	},
	"other-directive": {
		pattern: /#\w+\b/,
		alias: "property"
	},
	attribute: {
		pattern: /@\w+/,
		alias: "atrule"
	},
	"function-definition": {
		pattern: /(\bfunc\s+)\w+/,
		lookbehind: !0,
		alias: "function"
	},
	label: {
		pattern: /\b(break|continue)\s+\w+|\b[a-zA-Z_]\w*(?=\s*:\s*(?:for|repeat|while)\b)/,
		lookbehind: !0,
		alias: "important"
	},
	keyword: /\b(?:Any|Protocol|Self|Type|actor|as|assignment|associatedtype|associativity|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic|else|enum|extension|fallthrough|fileprivate|final|for|func|get|guard|higherThan|if|import|in|indirect|infix|init|inout|internal|is|isolated|lazy|left|let|lowerThan|mutating|none|nonisolated|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|right|safe|self|set|some|static|struct|subscript|super|switch|throw|throws|try|typealias|unowned|unsafe|var|weak|where|while|willSet)\b/,
	boolean: /\b(?:false|true)\b/,
	nil: {
		pattern: /\bnil\b/,
		alias: "constant"
	},
	"short-argument": /\$\d+\b/,
	omit: {
		pattern: /\b_\b/,
		alias: "keyword"
	},
	number: /\b(?:[\d_]+(?:\.[\de_]+)?|0x[a-f0-9_]+(?:\.[a-f0-9p_]+)?|0b[01_]+|0o[0-7_]+)\b/i,
	"class-name": /\b[A-Z](?:[A-Z_\d]*[a-z]\w*)?\b/,
	function: /\b[a-z_]\w*(?=\s*\()/i,
	constant: /\b(?:[A-Z_]{2,}|k[A-Z][A-Za-z_]+)\b/,
	operator: /[-+*/%=!<>&|^~?]+|\.[.\-+*/%=!<>&|^~?]+/,
	punctuation: /[{}[\]();,.:\\]/
}, Prism.languages.swift["string-literal"].forEach(function(e) {
	e.inside.interpolation.inside = Prism.languages.swift;
}), (function(e) {
	e.languages.typescript = e.languages.extend("javascript", {
		"class-name": {
			pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
			lookbehind: !0,
			greedy: !0,
			inside: null
		},
		builtin: /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
	}), e.languages.typescript.keyword.push(/\b(?:abstract|declare|is|keyof|readonly|require)\b/, /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/, /\btype\b(?=\s*(?:[\{*]|$))/), delete e.languages.typescript.parameter, delete e.languages.typescript["literal-property"];
	var t = e.languages.extend("typescript", {});
	delete t["class-name"], e.languages.typescript["class-name"].inside = t, e.languages.insertBefore("typescript", "function", {
		decorator: {
			pattern: /@[$\w\xA0-\uFFFF]+/,
			inside: {
				at: {
					pattern: /^@/,
					alias: "operator"
				},
				function: /^[\s\S]+/
			}
		},
		"generic-function": {
			pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
			greedy: !0,
			inside: {
				function: /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
				generic: {
					pattern: /<[\s\S]+/,
					alias: "class-name",
					inside: t
				}
			}
		}
	}), e.languages.ts = e.languages.typescript;
})(Prism), (function(e) {
	var t = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|exports|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|module|native|new|non-sealed|null|open|opens|package|permits|private|protected|provides|public|record(?!\s*[(){}[\]<>=%~.:,;?+\-*/&|^])|requires|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|to|transient|transitive|try|uses|var|void|volatile|while|with|yield)\b/, n = "(?:[a-z]\\w*\\s*\\.\\s*)*(?:[A-Z]\\w*\\s*\\.\\s*)*", r = {
		pattern: RegExp("(^|[^\\w.])" + n + "[A-Z](?:[\\d_A-Z]*[a-z]\\w*)?\\b"),
		lookbehind: !0,
		inside: {
			namespace: {
				pattern: /^[a-z]\w*(?:\s*\.\s*[a-z]\w*)*(?:\s*\.)?/,
				inside: { punctuation: /\./ }
			},
			punctuation: /\./
		}
	};
	e.languages.java = e.languages.extend("clike", {
		string: {
			pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"/,
			lookbehind: !0,
			greedy: !0
		},
		"class-name": [
			r,
			{
				pattern: RegExp("(^|[^\\w.])" + n + "[A-Z]\\w*(?=\\s+\\w+\\s*[;,=()]|\\s*(?:\\[[\\s,]*\\]\\s*)?::\\s*new\\b)"),
				lookbehind: !0,
				inside: r.inside
			},
			{
				pattern: RegExp("(\\b(?:class|enum|extends|implements|instanceof|interface|new|record|throws)\\s+)" + n + "[A-Z]\\w*\\b"),
				lookbehind: !0,
				inside: r.inside
			}
		],
		keyword: t,
		function: [e.languages.clike.function, {
			pattern: /(::\s*)[a-z_]\w*/,
			lookbehind: !0
		}],
		number: /\b0b[01][01_]*L?\b|\b0x(?:\.[\da-f_p+-]+|[\da-f_]+(?:\.[\da-f_p+-]+)?)\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?\d[\d_]*)?[dfl]?/i,
		operator: {
			pattern: /(^|[^.])(?:<<=?|>>>?=?|->|--|\+\+|&&|\|\||::|[?:~]|[-+*/%&|^!=<>]=?)/m,
			lookbehind: !0
		},
		constant: /\b[A-Z][A-Z_\d]+\b/
	}), e.languages.insertBefore("java", "string", {
		"triple-quoted-string": {
			pattern: /"""[ \t]*[\r\n](?:(?:"|"")?(?:\\.|[^"\\]))*"""/,
			greedy: !0,
			alias: "string"
		},
		char: {
			pattern: /'(?:\\.|[^'\\\r\n]){1,6}'/,
			greedy: !0
		}
	}), e.languages.insertBefore("java", "class-name", {
		annotation: {
			pattern: /(^|[^.])@\w+(?:\s*\.\s*\w+)*/,
			lookbehind: !0,
			alias: "punctuation"
		},
		generics: {
			pattern: /<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&))*>)*>)*>)*>/,
			inside: {
				"class-name": r,
				keyword: t,
				punctuation: /[<>(),.:]/,
				operator: /[?&|]/
			}
		},
		import: [{
			pattern: RegExp("(\\bimport\\s+)" + n + "(?:[A-Z]\\w*|\\*)(?=\\s*;)"),
			lookbehind: !0,
			inside: {
				namespace: r.inside.namespace,
				punctuation: /\./,
				operator: /\*/,
				"class-name": /\w+/
			}
		}, {
			pattern: RegExp("(\\bimport\\s+static\\s+)" + n + "(?:\\w+|\\*)(?=\\s*;)"),
			lookbehind: !0,
			alias: "static",
			inside: {
				namespace: r.inside.namespace,
				static: /\b\w+$/,
				punctuation: /\./,
				operator: /\*/,
				"class-name": /\w+/
			}
		}],
		namespace: {
			pattern: RegExp("(\\b(?:exports|import(?:\\s+static)?|module|open|opens|package|provides|requires|to|transitive|uses|with)\\s+)(?!<keyword>)[a-z]\\w*(?:\\.[a-z]\\w*)*\\.?".replace(/<keyword>/g, function() {
				return t.source;
			})),
			lookbehind: !0,
			inside: { punctuation: /\./ }
		}
	});
})(Prism), (function(e) {
	var t = /\b(?:alignas|alignof|asm|auto|bool|break|case|catch|char|char16_t|char32_t|char8_t|class|co_await|co_return|co_yield|compl|concept|const|const_cast|consteval|constexpr|constinit|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|final|float|for|friend|goto|if|import|inline|int|int16_t|int32_t|int64_t|int8_t|long|module|mutable|namespace|new|noexcept|nullptr|operator|override|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|uint16_t|uint32_t|uint64_t|uint8_t|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/, n = "\\b(?!<keyword>)\\w+(?:\\s*\\.\\s*\\w+)*\\b".replace(/<keyword>/g, function() {
		return t.source;
	});
	e.languages.cpp = e.languages.extend("c", {
		"class-name": [
			{
				pattern: RegExp("(\\b(?:class|concept|enum|struct|typename)\\s+)(?!<keyword>)\\w+".replace(/<keyword>/g, function() {
					return t.source;
				})),
				lookbehind: !0
			},
			/\b[A-Z]\w*(?=\s*::\s*\w+\s*\()/,
			/\b[A-Z_]\w*(?=\s*::\s*~\w+\s*\()/i,
			/\b\w+(?=\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>\s*::\s*\w+\s*\()/
		],
		keyword: t,
		number: {
			pattern: /(?:\b0b[01']+|\b0x(?:[\da-f']+(?:\.[\da-f']*)?|\.[\da-f']+)(?:p[+-]?[\d']+)?|(?:\b[\d']+(?:\.[\d']*)?|\B\.[\d']+)(?:e[+-]?[\d']+)?)[ful]{0,4}/i,
			greedy: !0
		},
		operator: />>=?|<<=?|->|--|\+\+|&&|\|\||[?:~]|<=>|[-+*/%&|^!=<>]=?|\b(?:and|and_eq|bitand|bitor|not|not_eq|or|or_eq|xor|xor_eq)\b/,
		boolean: /\b(?:false|true)\b/
	}), e.languages.insertBefore("cpp", "string", {
		module: {
			pattern: RegExp("(\\b(?:import|module)\\s+)(?:\"(?:\\\\(?:\\r\\n|[\\s\\S])|[^\"\\\\\\r\\n])*\"|<[^<>\\r\\n]*>|" + "<mod-name>(?:\\s*:\\s*<mod-name>)?|:\\s*<mod-name>".replace(/<mod-name>/g, function() {
				return n;
			}) + ")"),
			lookbehind: !0,
			greedy: !0,
			inside: {
				string: /^[<"][\s\S]+/,
				operator: /:/,
				punctuation: /\./
			}
		},
		"raw-string": {
			pattern: /R"([^()\\ ]{0,16})\([\s\S]*?\)\1"/,
			alias: "string",
			greedy: !0
		}
	}), e.languages.insertBefore("cpp", "keyword", { "generic-function": {
		pattern: /\b(?!operator\b)[a-z_]\w*\s*<(?:[^<>]|<[^<>]*>)*>(?=\s*\()/i,
		inside: {
			function: /^\w+/,
			generic: {
				pattern: /<[\s\S]+/,
				alias: "class-name",
				inside: e.languages.cpp
			}
		}
	} }), e.languages.insertBefore("cpp", "operator", { "double-colon": {
		pattern: /::/,
		alias: "punctuation"
	} }), e.languages.insertBefore("cpp", "class-name", { "base-clause": {
		pattern: /(\b(?:class|struct)\s+\w+\s*:\s*)[^;{}"'\s]+(?:\s+[^;{}"'\s]+)*(?=\s*[;{])/,
		lookbehind: !0,
		greedy: !0,
		inside: e.languages.extend("cpp", {})
	} }), e.languages.insertBefore("inside", "double-colon", { "class-name": /\b[a-z_]\w*\b(?!\s*::)/i }, e.languages.cpp["base-clause"]);
})(Prism);
// node_modules/.bun/@lexical+code@0.40.0/node_modules/@lexical/code/LexicalCode.prod.mjs
function lr(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
var ur = "javascript";
function dr(e, t) {
	for (let n of e.childNodes) {
		if (He(n) && n.tagName === t) return !0;
		dr(n, t);
	}
	return !1;
}
var fr = "data-language", pr = "data-highlight-language", mr = "data-theme", hr = class e extends j {
	__language;
	__theme;
	__isSyntaxHighlightSupported;
	static getType() {
		return "code";
	}
	static clone(t) {
		return new e(t.__language, t.__key);
	}
	constructor(e, t) {
		super(t), this.__language = e || void 0, this.__isSyntaxHighlightSupported = !1, this.__theme = void 0;
	}
	afterCloneFrom(e) {
		super.afterCloneFrom(e), this.__language = e.__language, this.__theme = e.__theme, this.__isSyntaxHighlightSupported = e.__isSyntaxHighlightSupported;
	}
	createDOM(e) {
		let t = document.createElement("code");
		F(t, e.theme.code), t.setAttribute("spellcheck", "false");
		let n = this.getLanguage();
		n && (t.setAttribute(fr, n), this.getIsSyntaxHighlightSupported() && t.setAttribute(pr, n));
		let r = this.getTheme();
		r && t.setAttribute(mr, r);
		let i = this.getStyle();
		return i && t.setAttribute("style", i), t;
	}
	updateDOM(e, t, n) {
		let r = this.__language, i = e.__language;
		r ? r !== i && t.setAttribute(fr, r) : i && t.removeAttribute(fr);
		let a = this.__isSyntaxHighlightSupported;
		e.__isSyntaxHighlightSupported && i ? a && r ? r !== i && t.setAttribute(pr, r) : t.removeAttribute(pr) : a && r && t.setAttribute(pr, r);
		let o = this.__theme, s = e.__theme;
		o ? o !== s && t.setAttribute(mr, o) : s && t.removeAttribute(mr);
		let c = this.__style, l = e.__style;
		return c ? c !== l && t.setAttribute("style", c) : l && t.removeAttribute("style"), !1;
	}
	exportDOM(e) {
		let t = document.createElement("pre");
		F(t, e._config.theme.code), t.setAttribute("spellcheck", "false");
		let n = this.getLanguage();
		n && (t.setAttribute(fr, n), this.getIsSyntaxHighlightSupported() && t.setAttribute(pr, n));
		let r = this.getTheme();
		r && t.setAttribute(mr, r);
		let i = this.getStyle();
		return i && t.setAttribute("style", i), { element: t };
	}
	static importDOM() {
		return {
			code: (e) => e.textContent != null && (/\r?\n/.test(e.textContent) || dr(e, "BR")) ? {
				conversion: _r,
				priority: 1
			} : null,
			div: () => ({
				conversion: vr,
				priority: 1
			}),
			pre: () => ({
				conversion: _r,
				priority: 0
			}),
			table: (e) => Sr(e) ? {
				conversion: yr,
				priority: 3
			} : null,
			td: (e) => {
				let t = e, n = t.closest("table");
				return t.classList.contains("js-file-line") || n && Sr(n) ? {
					conversion: br,
					priority: 3
				} : null;
			},
			tr: (e) => {
				let t = e.closest("table");
				return t && Sr(t) ? {
					conversion: br,
					priority: 3
				} : null;
			}
		};
	}
	static importJSON(e) {
		return gr().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setLanguage(e.language).setTheme(e.theme);
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			language: this.getLanguage(),
			theme: this.getTheme()
		};
	}
	insertNewAfter(e, t = !0) {
		let n = this.getChildren(), r = n.length;
		if (r >= 2 && n[r - 1].getTextContent() === "\n" && n[r - 2].getTextContent() === "\n" && e.isCollapsed() && e.anchor.key === this.__key && e.anchor.offset === r) {
			n[r - 1].remove(), n[r - 2].remove();
			let e = Je();
			return this.insertAfter(e, t), e;
		}
		let { anchor: i, focus: a } = e, o = (i.isBefore(a) ? i : a).getNode();
		if (ut(o)) {
			let e = Dr(o), t = [];
			for (;;) if (D(e)) t.push(st()), e = e.getNextSibling();
			else {
				if (!G(e)) break;
				{
					let n = 0, r = e.getTextContent(), i = e.getTextContentSize();
					for (; n < i && r[n] === " ";) n++;
					if (n !== 0 && t.push(Tr(" ".repeat(n))), n !== i) break;
					e = e.getNextSibling();
				}
			}
			let n = o.splitText(i.offset)[0], r = i.offset === 0 ? 0 : 1, a = n.getIndexWithinParent() + r, s = o.getParentOrThrow(), c = [kt(), ...t];
			s.splice(a, 0, c);
			let l = t[t.length - 1];
			l ? l.select() : i.offset === 0 ? n.selectPrevious() : n.getNextSibling().selectNext(0, 0);
		}
		if (W(o)) {
			let { offset: t } = e.anchor;
			o.splice(t, 0, [kt()]), o.select(t + 1, t + 1);
		}
		return null;
	}
	canIndent() {
		return !1;
	}
	collapseAtStart() {
		let e = Je();
		return this.getChildren().forEach((t) => e.append(t)), this.replace(e), !0;
	}
	setLanguage(e) {
		let t = this.getWritable();
		return t.__language = e || void 0, t;
	}
	getLanguage() {
		return this.getLatest().__language;
	}
	setIsSyntaxHighlightSupported(e) {
		let t = this.getWritable();
		return t.__isSyntaxHighlightSupported = e, t;
	}
	getIsSyntaxHighlightSupported() {
		return this.getLatest().__isSyntaxHighlightSupported;
	}
	setTheme(e) {
		let t = this.getWritable();
		return t.__theme = e || void 0, t;
	}
	getTheme() {
		return this.getLatest().__theme;
	}
};
function gr(e, t) {
	return Me(hr).setLanguage(e).setTheme(t);
}
function W(e) {
	return e instanceof hr;
}
function _r(e) {
	return { node: gr(e.getAttribute(fr)) };
}
function vr(e) {
	let t = e, n = xr(t);
	return n || function(e) {
		let t = e.parentElement;
		for (; t !== null;) {
			if (xr(t)) return !0;
			t = t.parentElement;
		}
		return !1;
	}(t) ? { node: n ? gr() : null } : { node: null };
}
function yr() {
	return { node: gr() };
}
function br() {
	return { node: null };
}
function xr(e) {
	return e.style.fontFamily.match("monospace") !== null;
}
function Sr(e) {
	return e.classList.contains("js-file-line-container");
}
var Cr = class e extends je {
	__highlightType;
	constructor(e = "", t, n) {
		super(e, n), this.__highlightType = t;
	}
	static getType() {
		return "code-highlight";
	}
	static clone(t) {
		return new e(t.__text, t.__highlightType || void 0, t.__key);
	}
	getHighlightType() {
		return this.getLatest().__highlightType;
	}
	setHighlightType(e) {
		let t = this.getWritable();
		return t.__highlightType = e || void 0, t;
	}
	canHaveFormat() {
		return !1;
	}
	createDOM(e) {
		let t = super.createDOM(e), n = wr(e.theme, this.__highlightType);
		return F(t, n), t;
	}
	updateDOM(e, t, n) {
		let r = super.updateDOM(e, t, n), i = wr(n.theme, e.__highlightType), a = wr(n.theme, this.__highlightType);
		return i !== a && (i && We(t, i), a && F(t, a)), r;
	}
	static importJSON(e) {
		return Tr().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setHighlightType(e.highlightType);
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			highlightType: this.getHighlightType()
		};
	}
	setFormat(e) {
		return this;
	}
	isParentRequired() {
		return !0;
	}
	createParentElementNode() {
		return gr();
	}
};
function wr(e, t) {
	return t && e && e.codeHighlight && e.codeHighlight[t];
}
function Tr(e = "", t) {
	return S(new Cr(e, t));
}
function G(e) {
	return e instanceof Cr;
}
function Er(e, t) {
	let n = e;
	for (let r = ve(e, t); r && (G(r.origin) || D(r.origin)); r = At(r)) n = r.origin;
	return n;
}
function Dr(e) {
	return Er(e, "previous");
}
function Or(e) {
	return Er(e, "next");
}
function kr(e) {
	let t = Dr(e), n = Or(e), r = t;
	for (; r !== null;) {
		if (G(r)) {
			let e = A(r.getTextContent());
			if (e !== null) return e;
		}
		if (r === n) break;
		r = r.getNextSibling();
	}
	let i = t.getParent();
	if (ke(i)) {
		let e = i.getDirection();
		if (e === "ltr" || e === "rtl") return e;
	}
	return null;
}
function Ar(e, t) {
	let n = null, r = null, i = e, a = t, o = e.getTextContent();
	for (;;) {
		if (a === 0) {
			if (i = i.getPreviousSibling(), i === null) break;
			if (G(i) || D(i) || O(i) || lr(167), O(i)) {
				n = {
					node: i,
					offset: 1
				};
				break;
			}
			a = Math.max(0, i.getTextContentSize() - 1), o = i.getTextContent();
		} else a--;
		let e = o[a];
		G(i) && e !== " " && (r = {
			node: i,
			offset: a
		});
	}
	if (r !== null) return r;
	let s = null;
	if (t < e.getTextContentSize()) G(e) && (s = e.getTextContent()[t]);
	else {
		let t = e.getNextSibling();
		G(t) && (s = t.getTextContent()[0]);
	}
	if (s !== null && s !== " ") return n;
	{
		let r = function(e, t) {
			let n = e, r = t, i = e.getTextContent(), a = e.getTextContentSize();
			for (;;) {
				if (!G(n) || r === a) {
					if (n = n.getNextSibling(), n === null || O(n)) return null;
					G(n) && (r = 0, i = n.getTextContent(), a = n.getTextContentSize());
				}
				if (G(n)) {
					if (i[r] !== " ") return {
						node: n,
						offset: r
					};
					r++;
				}
			}
		}(e, t);
		return r === null ? n : r;
	}
}
function jr(e) {
	let t = Or(e);
	return O(t) && lr(168), t;
}
Ve({
	name: "@lexical/code",
	nodes: () => [hr, Cr]
}), (function(e) {
	e.languages.diff = { coord: [
		/^(?:\*{3}|-{3}|\+{3}).*$/m,
		/^@@.*@@$/m,
		/^\d.*$/m
	] };
	var t = {
		"deleted-sign": "-",
		"deleted-arrow": "<",
		"inserted-sign": "+",
		"inserted-arrow": ">",
		unchanged: " ",
		diff: "!"
	};
	Object.keys(t).forEach(function(n) {
		var r = t[n], i = [];
		/^\w+$/.test(n) || i.push(/\w+/.exec(n)[0]), n === "diff" && i.push("bold"), e.languages.diff[n] = {
			pattern: RegExp("^(?:[" + r + "].*(?:\r\n?|\n|(?![\\s\\S])))+", "m"),
			alias: i,
			inside: {
				line: {
					pattern: /(.)(?=[\s\S]).*(?:\r\n?|\n)?/,
					lookbehind: !0
				},
				prefix: {
					pattern: /[\s\S]/,
					alias: /\w+/.exec(n)[0]
				}
			}
		};
	}), Object.defineProperty(e.languages.diff, "PREFIXES", { value: t });
})(Prism);
var Mr = globalThis.Prism || window.Prism;
function Nr(e) {
	return typeof e == "string" ? e : Array.isArray(e) ? e.map(Nr).join("") : Nr(e.content);
}
function Pr(e, t) {
	let n = /^diff-([\w-]+)/i.exec(t), r = e.getTextContent(), i = Mr.tokenize(r, Mr.languages[n ? "diff" : t]);
	return n && (i = function(e, t) {
		let n = t, r = Mr.languages[n], i = { tokens: e }, a = Mr.languages.diff.PREFIXES;
		for (let e of i.tokens) {
			if (typeof e == "string" || !(e.type in a) || !Array.isArray(e.content)) continue;
			let t = e.type, n = 0, i = () => (n++, new Mr.Token("prefix", a[t], t.replace(/^(\w+).*/, "$1"))), o = e.content.filter((e) => typeof e == "string" || e.type !== "prefix"), s = e.content.length - o.length, c = Mr.tokenize(Nr(o), r);
			c.unshift(i());
			let l = /\r\n|\n/g, u = (e) => {
				let t = [];
				l.lastIndex = 0;
				let r, a = 0;
				for (; n < s && (r = l.exec(e));) {
					let n = r.index + r[0].length;
					t.push(e.slice(a, n)), a = n, t.push(i());
				}
				if (t.length !== 0) return a < e.length && t.push(e.slice(a)), t;
			}, d = (e) => {
				for (let t = 0; t < e.length && n < s; t++) {
					let n = e[t];
					if (typeof n == "string") {
						let r = u(n);
						r && (e.splice(t, 1, ...r), t += r.length - 1);
					} else if (typeof n.content == "string") {
						let e = u(n.content);
						e && (n.content = e);
					} else Array.isArray(n.content) ? d(n.content) : d([n.content]);
				}
			};
			d(c), n < s && c.push(i()), e.content = c;
		}
		return i.tokens;
	}(i, n[1])), Fr(i);
}
function Fr(e, t) {
	let n = [];
	for (let r of e) if (typeof r == "string") {
		let e = r.split(/(\n|\t)/), i = e.length;
		for (let r = 0; r < i; r++) {
			let i = e[r];
			i === "\n" || i === "\r\n" ? n.push(kt()) : i === "	" ? n.push(st()) : i.length > 0 && n.push(Tr(i, t));
		}
	} else {
		let { content: e, alias: t } = r;
		typeof e == "string" ? n.push(...Fr([e], r.type === "prefix" && typeof t == "string" ? t : r.type)) : Array.isArray(e) && n.push(...Fr(e, r.type === "unchanged" ? void 0 : r.type));
	}
	return n;
}
var Ir = {
	$tokenize(e, t) {
		return Pr(e, t || this.defaultLanguage);
	},
	defaultLanguage: ur,
	tokenize(e, t) {
		return Mr.tokenize(e, Mr.languages[t || ""] || Mr.languages[this.defaultLanguage]);
	}
};
function Lr(e, t, n) {
	let r = e.getParent();
	W(r) ? Br(r, t, n) : G(e) && e.replace(P(e.__text));
}
function Rr(e, t) {
	let n = t.getElementByKey(e.getKey());
	if (n === null) return;
	let r = e.getChildren(), i = r.length;
	if (i === n.__cachedChildrenLength) return;
	n.__cachedChildrenLength = i;
	let a = "1", o = 1;
	for (let e = 0; e < i; e++) O(r[e]) && (a += "\n" + ++o);
	n.setAttribute("data-gutter", a);
}
var zr = /* @__PURE__ */ new Set();
function Br(e, t, n) {
	let r = e.getKey(), i = t.getKey() + "/" + r;
	if (e.getLanguage() === void 0 && e.setLanguage(n.defaultLanguage), !function(e) {
		let t = function(e) {
			let t = /^diff-([\w-]+)/i.exec(e);
			return t ? t[1] : null;
		}(e) || e;
		try {
			return !!t && Mr.languages.hasOwnProperty(t);
		} catch {
			return !1;
		}
	}(e.getLanguage() || n.defaultLanguage)) return e.getIsSyntaxHighlightSupported() && e.setIsSyntaxHighlightSupported(!1), void async function() {}();
	e.getIsSyntaxHighlightSupported() || e.setIsSyntaxHighlightSupported(!0), zr.has(i) || (zr.add(i), t.update(() => {
		(function(e, t) {
			let n = mt(e);
			if (!W(n) || !n.isAttached()) return;
			let r = k();
			if (!M(r)) return void t();
			let i = r.anchor, a = i.offset, o = i.type === "element" && O(n.getChildAtIndex(i.offset - 1)), s = 0;
			if (o || (s = a + i.getNode().getPreviousSiblings().reduce((e, t) => e + t.getTextContentSize(), 0)), t()) {
				if (o) return void i.getNode().select(a, a);
				n.getChildren().some((e) => {
					let t = ut(e);
					if (t || O(e)) {
						let n = e.getTextContentSize();
						if (t && n >= s) return e.select(s, s), !0;
						s -= n;
					}
					return !1;
				});
			}
		})(r, () => {
			let t = mt(r);
			if (!W(t) || !t.isAttached()) return !1;
			let i = t.getLanguage() || n.defaultLanguage, a = n.$tokenize(t, i), { from: o, to: s, nodesForReplacement: c } = function(e, t) {
				let n = 0;
				for (; n < e.length && Vr(e[n], t[n]);) n++;
				let r = e.length, i = t.length, a = Math.min(r, i) - n, o = 0;
				for (; o < a;) if (o++, !Vr(e[r - o], t[i - o])) {
					o--;
					break;
				}
				let s = n, c = r - o;
				return {
					from: s,
					nodesForReplacement: t.slice(n, i - o),
					to: c
				};
			}(t.getChildren(), a);
			return !(o === s && !c.length) && (e.splice(o, s - o, c), !0);
		});
	}, {
		onUpdate: () => {
			zr.delete(i);
		},
		skipTransforms: !0
	}));
}
function Vr(e, t) {
	return G(e) && G(t) && e.__text === t.__text && e.__highlightType === t.__highlightType || D(e) && D(t) || O(e) && O(t);
}
function Hr(e) {
	if (!M(e)) return !1;
	let t = e.anchor.getNode(), n = W(t) ? t : t.getParent(), r = e.focus.getNode(), i = W(r) ? r : r.getParent();
	return W(n) && n.is(i);
}
function Ur(e) {
	let t = e.getNodes(), n = [];
	if (t.length === 1 && W(t[0])) return n;
	let r = [];
	for (let e = 0; e < t.length; e++) {
		let i = t[e];
		G(i) || D(i) || O(i) || lr(169), O(i) ? r.length > 0 && (n.push(r), r = []) : r.push(i);
	}
	if (r.length > 0) {
		let t = e.isBackward() ? e.anchor : e.focus, i = Se(r[0].getKey(), 0, "text");
		t.is(i) || n.push(r);
	}
	return n;
}
function Wr(e) {
	let t = k();
	if (!M(t) || !Hr(t)) return !1;
	let n = Ur(t), r = n.length;
	if (r === 0 && t.isCollapsed()) return e === I && t.insertNodes([st()]), !0;
	if (r === 0 && e === I && t.getTextContent() === "\n") {
		let e = st(), n = kt(), r = t.isBackward() ? "previous" : "next";
		return t.insertNodes([e, n]), pt(gt(Ue(vt(e, "next", 0), Fe(ve(n, "next"))), r)), !0;
	}
	for (let i = 0; i < r; i++) {
		let r = n[i];
		if (r.length > 0) {
			let n = r[0];
			if (i === 0 && (n = Dr(n)), e === I) {
				let e = st();
				if (n.insertBefore(e), i === 0) {
					let r = t.isBackward() ? "focus" : "anchor", i = Se(n.getKey(), 0, "text");
					t[r].is(i) && t[r].set(e.getKey(), 0, "text");
				}
			} else D(n) && n.remove();
		}
	}
	return !0;
}
function Gr(e, t) {
	let n = k();
	if (!M(n)) return !1;
	let { anchor: r, focus: i } = n, a = r.offset, o = i.offset, s = r.getNode(), c = i.getNode(), l = e === nt;
	if (!Hr(n) || !G(s) && !D(s) || !G(c) && !D(c)) return !1;
	if (!t.altKey) {
		if (n.isCollapsed()) {
			let e = s.getParentOrThrow();
			if (l && a === 0 && s.getPreviousSibling() === null) {
				if (e.getPreviousSibling() === null) return e.selectPrevious(), t.preventDefault(), !0;
			} else if (!l && a === s.getTextContentSize() && s.getNextSibling() === null && e.getNextSibling() === null) return e.selectNext(), t.preventDefault(), !0;
		}
		return !1;
	}
	let u, d;
	if (s.isBefore(c) ? (u = Dr(s), d = Or(c)) : (u = Dr(c), d = Or(s)), u == null || d == null) return !1;
	let f = u.getNodesBetween(d);
	for (let e = 0; e < f.length; e++) {
		let t = f[e];
		if (!G(t) && !D(t) && !O(t)) return !1;
	}
	t.preventDefault(), t.stopPropagation();
	let p = l ? u.getPreviousSibling() : d.getNextSibling();
	if (!O(p)) return !0;
	let m = l ? p.getPreviousSibling() : p.getNextSibling();
	if (m == null) return !0;
	let h = (G(m) || D(m) || O(m) ? l ? Dr(m) : Or(m) : null) ?? m;
	return p.remove(), f.forEach((e) => e.remove()), e === nt ? (f.forEach((e) => h.insertBefore(e)), h.insertBefore(p)) : (h.insertAfter(p), h = p, f.forEach((e) => {
		h.insertAfter(e), h = e;
	})), n.setTextNodeRange(s, a, c, o), !0;
}
function Kr(e, t) {
	let n = k();
	if (!M(n)) return !1;
	let { anchor: r, focus: i } = n, a = r.getNode(), o = i.getNode(), s = e === C;
	if (!Hr(n) || !G(a) && !D(a) || !G(o) && !D(o)) return !1;
	let c = o;
	if (kr(c) === "rtl" ? !s : s) {
		let e = Ar(c, i.offset);
		if (e !== null) {
			let { node: t, offset: r } = e;
			O(t) ? t.selectNext(0, 0) : n.setTextNodeRange(t, r, t, r);
		} else c.getParentOrThrow().selectStart();
	} else jr(c).select();
	return t.preventDefault(), t.stopPropagation(), !0;
}
function qr(e, t) {
	if (!e.hasNodes([hr, Cr])) throw Error("CodeHighlightPlugin: CodeNode or CodeHighlightNode not registered on editor");
	t ??= Ir;
	let n = [];
	return !0 !== e._headless && n.push(e.registerMutationListener(hr, (t) => {
		e.getEditorState().read(() => {
			for (let [n, r] of t) if (r !== "destroyed") {
				let t = mt(n);
				t !== null && Rr(t, e);
			}
		});
	}, { skipInitialization: !1 })), n.push(e.registerNodeTransform(hr, (n) => Br(n, e, t)), e.registerNodeTransform(je, (n) => Lr(n, e, t)), e.registerNodeTransform(Cr, (n) => Lr(n, e, t)), e.registerCommand(yt, (t) => {
		let n = function(e) {
			let t = k();
			if (!M(t) || !Hr(t)) return null;
			let n = e ? Ne : I, r = e ? Ne : et, i = t.anchor, a = t.focus;
			if (i.is(a)) return r;
			let o = Ur(t);
			if (o.length !== 1) return n;
			let s = o[0], c, l;
			s.length === 0 && lr(285), t.isBackward() ? (c = a, l = i) : (c = i, l = a);
			let u = Dr(s[0]), d = Or(s[0]), f = Se(u.getKey(), 0, "text"), p = Se(d.getKey(), d.getTextContentSize(), "text");
			return c.isBefore(f) || p.isBefore(l) ? n : f.isBefore(c) || l.isBefore(p) ? r : n;
		}(t.shiftKey);
		return n !== null && (t.preventDefault(), e.dispatchCommand(n, void 0), !0);
	}, 1), e.registerCommand(et, () => !!Hr(k()) && (fe([st()]), !0), 1), e.registerCommand(I, (e) => Wr(I), 1), e.registerCommand(Ne, (e) => Wr(Ne), 1), e.registerCommand(nt, (e) => {
		let t = k();
		if (!M(t)) return !1;
		let { anchor: n } = t, r = n.getNode();
		return !!Hr(t) && (t.isCollapsed() && n.offset === 0 && r.getPreviousSibling() === null && W(r.getParentOrThrow()) ? (e.preventDefault(), !0) : Gr(nt, e));
	}, 1), e.registerCommand(xe, (e) => {
		let t = k();
		if (!M(t)) return !1;
		let { anchor: n } = t, r = n.getNode();
		return !!Hr(t) && (t.isCollapsed() && n.offset === r.getTextContentSize() && r.getNextSibling() === null && W(r.getParentOrThrow()) ? (e.preventDefault(), !0) : Gr(xe, e));
	}, 1), e.registerCommand(C, (e) => Kr(C, e), 1), e.registerCommand(he, (e) => Kr(he, e), 1)), Ee(...n);
}
// node_modules/.bun/@lexical+markdown@0.40.0/node_modules/@lexical/markdown/LexicalMarkdown.prod.mjs
function Jr(e, t) {
	let n = {};
	for (let r of e) {
		let e = t(r);
		e && (n[e] ? n[e].push(r) : n[e] = [r]);
	}
	return n;
}
function Yr(e) {
	let t = Jr(e, (e) => e.type);
	return {
		element: t.element || [],
		multilineElement: t["multiline-element"] || [],
		textFormat: t["text-format"] || [],
		textMatch: t["text-match"] || []
	};
}
var Xr = /[!-/:-@[-`{-~\s]/;
function Zr(e) {
	return ut(e) && !e.hasFormat("code");
}
function Qr(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
var $r = /^(\s*)(\d{1,})\.\s/, ei = /^(\s*)[-*+]\s/, ti = /^(\s*)(?:[-*+]\s)?\s?(\[(\s|x)?\])\s/i, ni = /^(#{1,6})\s/, ri = /^>\s/, ii = /^[ \t]*```([\w-]+)?/, ai = /[ \t]*```$/, oi = Et("mdListMarker", { parse: (e) => typeof e == "string" && /^[-*+]$/.test(e) ? e : "-" }), si = (e) => (t, n, r, i) => {
	let a = e(r);
	a.append(...n), t.replace(a), i || a.select(0, 0);
}, ci = (e) => (t, n, r, i) => {
	let a = t.getPreviousSibling(), o = t.getNextSibling(), s = B(e === "check" ? r[3] === "x" : void 0), c = r[0].trim()[0], l = e !== "bullet" && e !== "check" || c !== oi.parse(c) ? void 0 : c;
	if (U(o) && o.getListType() === e) {
		l && ge(o, oi, l);
		let e = o.getFirstChild();
		e === null ? o.append(s) : e.insertBefore(s), t.remove();
	} else if (U(a) && a.getListType() === e) l && ge(a, oi, l), a.append(s), t.remove();
	else {
		let n = H(e, e === "number" ? Number(r[2]) : void 0);
		l && ge(n, oi, l), n.append(s), t.replace(n);
	}
	s.append(...n), i || s.select(0, 0);
	let u = function(e) {
		let t = e.match(/\t/g), n = e.match(/ /g), r = 0;
		return t && (r += t.length), n && (r += Math.floor(n.length / 4)), r;
	}(r[1]);
	u && s.setIndent(u);
}, li = (e, t, n) => {
	let r = [], i = e.getChildren(), a = 0;
	for (let o of i) if (V(o)) {
		if (o.getChildrenSize() === 1) {
			let e = o.getFirstChild();
			if (U(e)) {
				r.push(li(e, t, n + 1));
				continue;
			}
		}
		let i = " ".repeat(4 * n), s = e.getListType(), c = be(e, oi), l = s === "number" ? `${e.getStart() + a}. ` : s === "check" ? `${c} [${o.getChecked() ? "x" : " "}] ` : c + " ";
		r.push(i + l + t(o)), a++;
	}
	return r.join("\n");
}, ui = {
	dependencies: [_t],
	export: (e, t) => {
		if (!Ke(e)) return null;
		let n = Number(e.getTag().slice(1));
		return "#".repeat(n) + " " + t(e);
	},
	regExp: ni,
	replace: si((e) => {
		let t = "h" + e[1].length;
		return Ye(t);
	}),
	type: "element"
}, di = {
	dependencies: [tt],
	export: (e, t) => {
		if (!ft(e)) return null;
		let n = t(e).split("\n"), r = [];
		for (let e of n) r.push("> " + e);
		return r.join("\n");
	},
	regExp: ri,
	replace: (e, t, n, r) => {
		if (r) {
			let n = e.getPreviousSibling();
			if (ft(n)) return n.splice(n.getChildrenSize(), 0, [kt(), ...t]), void e.remove();
		}
		let i = ct();
		i.append(...t), e.replace(i), r || i.select(0, 0);
	},
	type: "element"
}, fi = {
	dependencies: [hr],
	export: (e) => {
		if (!W(e)) return null;
		let t = e.getTextContent();
		return "```" + (e.getLanguage() || "") + (t ? "\n" + t : "") + "\n```";
	},
	regExpEnd: {
		optional: !0,
		regExp: ai
	},
	regExpStart: ii,
	replace: (e, t, n, r, i, a) => {
		let o, s;
		if (!t && i) {
			if (i.length === 1) r ? (o = gr(), s = n[1] + i[0]) : (o = gr(n[1]), s = i[0].startsWith(" ") ? i[0].slice(1) : i[0]);
			else {
				if (o = gr(n[1]), i[0].trim().length === 0) for (; i.length > 0 && !i[0].length;) i.shift();
				else i[0] = i[0].startsWith(" ") ? i[0].slice(1) : i[0];
				for (; i.length > 0 && !i[i.length - 1].length;) i.pop();
				s = i.join("\n");
			}
			let t = P(s);
			o.append(t), e.append(o);
		} else t && si((e) => gr(e ? e[1] : void 0))(e, t, n, a);
	},
	type: "multiline-element"
}, pi = {
	dependencies: [Hn, zn],
	export: (e, t) => U(e) ? li(e, t, 0) : null,
	regExp: ei,
	replace: ci("bullet"),
	type: "element"
}, mi = {
	dependencies: [Hn, zn],
	export: (e, t) => U(e) ? li(e, t, 0) : null,
	regExp: ti,
	replace: ci("check"),
	type: "element"
}, hi = {
	dependencies: [Hn, zn],
	export: (e, t) => U(e) ? li(e, t, 0) : null,
	regExp: $r,
	replace: ci("number"),
	type: "element"
}, gi = {
	format: ["code"],
	tag: "`",
	type: "text-format"
}, _i = {
	format: ["highlight"],
	tag: "==",
	type: "text-format"
}, vi = {
	format: ["bold", "italic"],
	tag: "***",
	type: "text-format"
}, yi = {
	format: ["bold", "italic"],
	intraword: !1,
	tag: "___",
	type: "text-format"
}, bi = {
	format: ["bold"],
	tag: "**",
	type: "text-format"
}, xi = {
	format: ["bold"],
	intraword: !1,
	tag: "__",
	type: "text-format"
}, Si = {
	format: ["strikethrough"],
	tag: "~~",
	type: "text-format"
}, Ci = {
	format: ["italic"],
	tag: "*",
	type: "text-format"
}, wi = {
	format: ["italic"],
	intraword: !1,
	tag: "_",
	type: "text-format"
}, Ti = {
	dependencies: [Ot],
	export: (e, t, n) => {
		if (!$e(e) || lt(e)) return null;
		let r = e.getTitle(), i = t(e);
		return r ? `[${i}](${e.getURL()} "${r}")` : `[${i}](${e.getURL()})`;
	},
	importRegExp: /(?:\[(.+?)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))/,
	regExp: /(?:\[(.+?)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))$/,
	replace: (e, t) => {
		let [, n, r, i] = t, a = qe(r, { title: i }), o = n.split("[").length - 1, s = n.split("]").length - 1, c = n, l = "";
		if (o < s) return;
		if (o > s) {
			let e = n.split("[");
			l = "[" + e[0], c = e.slice(1).join("[");
		}
		let u = P(c);
		return u.setFormat(e.getFormat()), a.append(u), e.replace(a), l && a.insertBefore(P(l)), u;
	},
	trigger: ")",
	type: "text-match"
}, Ei = [
	ui,
	di,
	pi,
	hi
], Di = [fi], Oi = [
	gi,
	vi,
	yi,
	bi,
	xi,
	_i,
	Ci,
	wi,
	Si
], ki = [Ti], Ai = [
	...Ei,
	...Di,
	...Oi,
	...ki
];
function ji(e, t, n) {
	let r = n.length;
	for (let i = t; i >= r; i--) {
		let t = i - r;
		if (Mi(e, t, n, 0, r) && e[t + r] !== " ") return t;
	}
	return -1;
}
function Mi(e, t, n, r, i) {
	for (let a = 0; a < i; a++) if (e[t + a] !== n[r + a]) return !1;
	return !0;
}
function Ni(e, t = Ai) {
	let n = Yr(t), r = Jr(n.textFormat, ({ tag: e }) => e[e.length - 1]), i = Jr(n.textMatch, ({ trigger: e }) => e);
	for (let n of t) {
		let t = n.type;
		if (t === "element" || t === "text-match" || t === "multiline-element") {
			let t = n.dependencies;
			for (let n of t) e.hasNode(n) || Qr(173, n.getType());
		}
	}
	let a = (e, t, a) => {
		(function(e, t, n, r) {
			let i = e.getParent();
			if (!Te(i) || e.getFirstChild() !== t) return !1;
			let a = t.getTextContent();
			if (a[n - 1] !== " ") return !1;
			for (let { regExp: i, replace: o } of r) {
				let r = a.match(i);
				if (r && r[0].length === (r[0].endsWith(" ") ? n : n - 1)) {
					let i = t.getNextSiblings(), [a, s] = t.splitText(n);
					if (!1 !== o(e, s ? [s, ...i] : i, r, !1)) return a.remove(), !0;
				}
			}
			return !1;
		})(e, t, a, n.element) || function(e, t, n, r) {
			let i = e.getParent();
			if (!Te(i) || e.getFirstChild() !== t) return !1;
			let a = t.getTextContent();
			if (a[n - 1] !== " ") return !1;
			for (let { regExpStart: i, replace: o, regExpEnd: s } of r) {
				if (s && !("optional" in s) || s && "optional" in s && !s.optional) continue;
				let r = a.match(i);
				if (r && r[0].length === (r[0].endsWith(" ") ? n : n - 1)) {
					let i = t.getNextSiblings(), [a, s] = t.splitText(n);
					if (!1 !== o(e, s ? [s, ...i] : i, r, null, null, !1)) return a.remove(), !0;
				}
			}
			return !1;
		}(e, t, a, n.multilineElement) || function(e, t, n) {
			let r = e.getTextContent(), i = n[r[t - 1]];
			if (i == null) return !1;
			t < r.length && (r = r.slice(0, t));
			for (let t of i) {
				if (!t.replace || !t.regExp) continue;
				let n = r.match(t.regExp);
				if (n === null) continue;
				let i = n.index || 0, a = i + n[0].length, o;
				return i === 0 ? [o] = e.splitText(a) : [, o] = e.splitText(i, a), o.selectNext(0, 0), t.replace(o, n), !0;
			}
			return !1;
		}(t, a, i) || function(e, t, n) {
			let r = e.getTextContent(), i = t - 1, a = r[i], o = n[a];
			if (!o) return !1;
			for (let t of o) {
				let { tag: n } = t, o = n.length, s = i - o + 1;
				if (o > 1 && !Mi(r, s, n, 0, o) || r[s - 1] === " ") continue;
				let c = r[i + 1];
				if (!1 === t.intraword && c && !Xr.test(c)) continue;
				let l = e, u = l, d = ji(r, s, n), f = u;
				for (; d < 0 && (f = f.getPreviousSibling()) && !O(f);) if (ut(f)) {
					if (f.hasFormat("code")) continue;
					let e = f.getTextContent();
					u = f, d = ji(e, e.length, n);
				}
				if (d < 0 || u === l && d + o === s) continue;
				let p = u.getTextContent();
				if (d > 0 && p[d - 1] === a) continue;
				let m = p[d - 1];
				if (!1 === t.intraword && m && !Xr.test(m)) continue;
				let h = l.getTextContent(), g = h.slice(0, s) + h.slice(i + 1);
				l.setTextContent(g);
				let ee = u === l ? g : p;
				u.setTextContent(ee.slice(0, d) + ee.slice(d + o));
				let _ = k(), v = jt();
				_e(v);
				let y = i - o * (u === l ? 2 : 1) + 1;
				v.anchor.set(u.__key, d, "text"), v.focus.set(l.__key, y, "text");
				for (let e of t.format) v.hasFormat(e) || v.formatText(e);
				v.anchor.set(v.focus.key, v.focus.offset, v.focus.type);
				for (let e of t.format) v.hasFormat(e) && v.toggleFormat(e);
				return M(_) && (v.format = _.format), !0;
			}
		}(t, a, r);
	};
	return e.registerUpdateListener(({ tags: t, dirtyLeaves: n, editorState: r, prevEditorState: i }) => {
		if (t.has("collaboration") || t.has("historic") || e.isComposing()) return;
		let o = r.read(k), s = i.read(k);
		if (!M(s) || !M(o) || !o.isCollapsed() || o.is(s)) return;
		let c = o.anchor.key, l = o.anchor.offset, u = r._nodeMap.get(c);
		!ut(u) || !n.has(c) || l !== 1 && l > s.anchor.offset + 1 || e.update(() => {
			if (!Zr(u)) return;
			let e = u.getParent();
			e === null || W(e) || a(e, u, o.anchor.offset);
		});
	});
}
// packages/ui/src/components/chat-ui/links/chat-guess-text.tsx
var Pi = [
	["code", "code"],
	["bold", "strong"],
	["italic", "em"],
	["strikethrough", "s"],
	["underline", "u"]
], Fi = (e, t) => (e & St[t]) !== 0, Ii = (e) => {
	let { text: t, format: n } = e;
	return Pi.reduceRight((e, [t, r]) => Fi(n, t) ? /* @__PURE__ */ z(r, {
		className: bt.text?.[t],
		children: e
	}, t) : e, t);
}, Li = (e) => {
	let { candidate: t, label: n, format: r = 0 } = e, i = re(), a = oe(t);
	if (!a && se(t)) return /* @__PURE__ */ z(Ii, {
		text: n,
		format: r
	});
	let o = ie(t), s = (a?.icon ? Nt(a.icon) : void 0) ?? le(o?.kind === "file" ? o.path : n);
	return /* @__PURE__ */ z(Kt, {
		as: "span",
		display: "inline-block",
		verticalAlign: "middle",
		maxW: "full",
		children: /* @__PURE__ */ z(ce, {
			candidate: t,
			resolvedHref: a ? a.href : i?.resolveHref(t) ?? null,
			children: /* @__PURE__ */ z(ue, {
				fileName: a?.label ?? n,
				icon: /* @__PURE__ */ z(Jt, {
					as: s,
					boxSize: "3",
					"aria-hidden": !0
				}),
				tooltip: !1,
				size: "sm",
				cursor: "pointer"
			})
		})
	});
}, Ri = (t) => {
	let { href: n } = t, r = re(), i = Ut(ae), [a, o] = Gt(), [s, c] = Gt();
	R(() => {
		if (i) return;
		let e = !0, t = (t) => {
			e && o({
				href: n,
				src: t
			});
		};
		return r?.resolveIcon?.(n).then(t, () => t(null)), () => {
			e = !1;
		};
	}, [
		r,
		n,
		i
	]);
	let l = a?.href === n ? a.src : null;
	return !l || l === s ? /* @__PURE__ */ z(Jt, {
		as: e,
		boxSize: "3",
		"aria-hidden": !0
	}) : /* @__PURE__ */ z(Yt, {
		src: l,
		alt: "",
		boxSize: "3",
		onError: () => c(l)
	});
}, zi = (e) => {
	let { source: t, label: n } = e, r = rn(t, "link");
	return r ? /* @__PURE__ */ z(Kt, {
		as: "span",
		display: "inline-block",
		verticalAlign: "middle",
		maxW: "full",
		children: /* @__PURE__ */ z(Xt, {
			variant: "resource",
			href: r,
			target: "_blank",
			rel: "noopener noreferrer",
			children: /* @__PURE__ */ z(ue, {
				fileName: n,
				icon: /* @__PURE__ */ z(Ri, { href: r }),
				tooltip: !1,
				size: "sm",
				cursor: "pointer"
			})
		})
	}) : n;
}, Bi = (e) => {
	let { href: t, target: n } = e, r = re(), i = {
		source: n,
		origin: "reference"
	}, a = n.split("/").pop() || "unknown";
	if (x(r, i)) return /* @__PURE__ */ z(zi, {
		source: n,
		label: a
	});
	let o = ie(i, typeof window > "u" ? void 0 : window.location.origin);
	return o?.kind === "external" ? /* @__PURE__ */ z(Xt, {
		href: o.href,
		variant: "resource",
		target: /^https?:/i.test(o.href) ? "_blank" : void 0,
		rel: "noopener noreferrer",
		children: /* @__PURE__ */ z(ue, {
			fileName: a,
			size: "sm",
			tooltip: !1,
			cursor: "pointer"
		})
	}) : r ? /* @__PURE__ */ z(Li, {
		candidate: i,
		label: a
	}) : /* @__PURE__ */ z(Kt, {
		width: "fit-content",
		display: "inline-block",
		children: /* @__PURE__ */ z(ce, {
			candidate: i,
			children: /* @__PURE__ */ z(ue, {
				fileName: a,
				tooltip: !1,
				onSelect: () => {
					/^https?:\/\//i.test(t) ? window.open(t, "_blank", "noopener,noreferrer") : /^#?\$PROJECT\//i.test(t) ? window.dispatchEvent(new CustomEvent("ui:open-project-file", { detail: t.replace(/^#?\$PROJECT\//i, "") })) : window.location.assign(t);
				}
			})
		})
	});
}, Vi = class e extends Qe {
	__href;
	__label;
	static getType() {
		return "reference-link";
	}
	static clone(t) {
		return new e(t.__href, t.__label, t.__key);
	}
	constructor(e, t, n) {
		super(n), this.__href = e, this.__label = t;
	}
	createDOM(e, t) {
		return document.createElement("span");
	}
	updateDOM(e, t, n) {
		return !1;
	}
	getTextContent() {
		return `{{link('${this.__label ?? this.__href}')}}`;
	}
	static importDOM() {
		return null;
	}
	exportDOM() {
		return { element: document.createTextNode(this.getTextContent()) };
	}
	exportJSON() {
		return {
			type: e.getType(),
			version: 1,
			href: this.__href,
			label: this.__label
		};
	}
	static importJSON(e) {
		return Hi(e.href, e.label);
	}
	decorate(e, t) {
		return /* @__PURE__ */ z(Bi, {
			href: this.__href,
			target: this.__label ?? this.__href
		});
	}
};
function Hi(e, t) {
	return new Vi(e, t);
}
function Ui(e) {
	return e instanceof Vi;
}
// packages/ui/src/components/rich-text/markdown-editor/plugins/ReferenceLinkPlugin/ReferenceLinkTransformer.ts
var Wi = /\{\{\s*link\((['"])([^'"\s]+)\1\)\s*\}\}/, Gi = {
	dependencies: [Vi],
	export: (e) => {
		if (Ui(e)) {
			let t = e.__href, n = e.__label ?? t;
			return n ? `{{link('${n}')}}` : `{{link('${t}')}}`;
		}
		return null;
	},
	regExp: Wi,
	importRegExp: Wi,
	replace: (e, t) => {
		let n = t[2], r = /^(https?:\/\/|\/)/i.test(n) ? n : `#${n}`, i = n;
		e.replace(Hi(r, i));
	},
	type: "text-match"
};
// node_modules/.bun/ccount@2.0.1/node_modules/ccount/index.js
function Ki(e, t) {
	let n = String(e);
	if (typeof t != "string") throw TypeError("Expected character");
	let r = 0, i = n.indexOf(t);
	for (; i !== -1;) r++, i = n.indexOf(t, i + t.length);
	return r;
}
// node_modules/.bun/escape-string-regexp@5.0.0/node_modules/escape-string-regexp/index.js
function qi(e) {
	if (typeof e != "string") throw TypeError("Expected a string");
	return e.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}
// node_modules/.bun/mdast-util-find-and-replace@3.0.2/node_modules/mdast-util-find-and-replace/lib/index.js
function Ji(e, t, n) {
	let r = h((n || {}).ignore || []), i = Yi(t), a = -1;
	for (; ++a < i.length;) f(e, "text", o);
	function o(e, t) {
		let n = -1, i;
		for (; ++n < t.length;) {
			let e = t[n], a = i ? i.children : void 0;
			if (r(e, a ? a.indexOf(e) : void 0, i)) return;
			i = e;
		}
		if (i) return s(e, t);
	}
	function s(e, t) {
		let n = t[t.length - 1], r = i[a][0], o = i[a][1], s = 0, c = n.children.indexOf(e), l = !1, u = [];
		r.lastIndex = 0;
		let d = r.exec(e.value);
		for (; d;) {
			let n = d.index, i = {
				index: d.index,
				input: d.input,
				stack: [...t, e]
			}, a = o(...d, i);
			if (typeof a == "string" && (a = a.length > 0 ? {
				type: "text",
				value: a
			} : void 0), a === !1 ? r.lastIndex = n + 1 : (s !== n && u.push({
				type: "text",
				value: e.value.slice(s, n)
			}), Array.isArray(a) ? u.push(...a) : a && u.push(a), s = n + d[0].length, l = !0), !r.global) break;
			d = r.exec(e.value);
		}
		return l ? (s < e.value.length && u.push({
			type: "text",
			value: e.value.slice(s)
		}), n.children.splice(c, 1, ...u)) : u = [e], c + u.length;
	}
}
function Yi(e) {
	let t = [];
	if (!Array.isArray(e)) throw TypeError("Expected find and replace tuple or list of tuples");
	let n = !e[0] || Array.isArray(e[0]) ? e : [e], r = -1;
	for (; ++r < n.length;) {
		let e = n[r];
		t.push([Xi(e[0]), Zi(e[1])]);
	}
	return t;
}
function Xi(e) {
	return typeof e == "string" ? new RegExp(qi(e), "g") : e;
}
function Zi(e) {
	return typeof e == "function" ? e : function() {
		return e;
	};
}
// node_modules/.bun/mdast-util-gfm-autolink-literal@2.0.1/node_modules/mdast-util-gfm-autolink-literal/lib/index.js
var Qi = "phrasing", $i = [
	"autolink",
	"link",
	"image",
	"label"
];
function ea() {
	return {
		transforms: [ca],
		enter: {
			literalAutolink: na,
			literalAutolinkEmail: ra,
			literalAutolinkHttp: ra,
			literalAutolinkWww: ra
		},
		exit: {
			literalAutolink: sa,
			literalAutolinkEmail: oa,
			literalAutolinkHttp: ia,
			literalAutolinkWww: aa
		}
	};
}
function ta() {
	return { unsafe: [
		{
			character: "@",
			before: "[+\\-.\\w]",
			after: "[\\-.\\w]",
			inConstruct: Qi,
			notInConstruct: $i
		},
		{
			character: ".",
			before: "[Ww]",
			after: "[\\-.\\w]",
			inConstruct: Qi,
			notInConstruct: $i
		},
		{
			character: ":",
			before: "[ps]",
			after: "\\/",
			inConstruct: Qi,
			notInConstruct: $i
		}
	] };
}
function na(e) {
	this.enter({
		type: "link",
		title: null,
		url: "",
		children: []
	}, e);
}
function ra(e) {
	this.config.enter.autolinkProtocol.call(this, e);
}
function ia(e) {
	this.config.exit.autolinkProtocol.call(this, e);
}
function aa(e) {
	this.config.exit.data.call(this, e);
	let t = this.stack[this.stack.length - 1];
	t.type, t.url = "http://" + this.sliceSerialize(e);
}
function oa(e) {
	this.config.exit.autolinkEmail.call(this, e);
}
function sa(e) {
	this.exit(e);
}
function ca(e) {
	Ji(e, [[/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, la], [/(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)/gu, ua]], { ignore: ["link", "linkReference"] });
}
function la(e, t, n, r, i) {
	let a = "";
	if (!pa(i) || (/^w/i.test(t) && (n = t + n, t = "", a = "http://"), !da(n))) return !1;
	let o = fa(n + r);
	if (!o[0]) return !1;
	let s = {
		type: "link",
		title: null,
		url: a + t + o[0],
		children: [{
			type: "text",
			value: t + o[0]
		}]
	};
	return o[1] ? [s, {
		type: "text",
		value: o[1]
	}] : s;
}
function ua(e, t, n, r) {
	return !pa(r, !0) || /[-\d_]$/.test(n) ? !1 : {
		type: "link",
		title: null,
		url: "mailto:" + t + "@" + n,
		children: [{
			type: "text",
			value: t + "@" + n
		}]
	};
}
function da(e) {
	let t = e.split(".");
	return !(t.length < 2 || t[t.length - 1] && (/_/.test(t[t.length - 1]) || !/[a-zA-Z\d]/.test(t[t.length - 1])) || t[t.length - 2] && (/_/.test(t[t.length - 2]) || !/[a-zA-Z\d]/.test(t[t.length - 2])));
}
function fa(e) {
	let t = /[!"&'),.:;<>?\]}]+$/.exec(e);
	if (!t) return [e, void 0];
	e = e.slice(0, t.index);
	let n = t[0], r = n.indexOf(")"), i = Ki(e, "("), a = Ki(e, ")");
	for (; r !== -1 && i > a;) e += n.slice(0, r + 1), n = n.slice(r + 1), r = n.indexOf(")"), a++;
	return [e, n];
}
function pa(e, n) {
	let r = e.input.charCodeAt(e.index - 1);
	return (e.index === 0 || t(r) || s(r)) && (!n || r !== 47);
}
// node_modules/.bun/mdast-util-gfm-footnote@2.1.0/node_modules/mdast-util-gfm-footnote/lib/index.js
Ca.peek = Sa;
function ma() {
	this.buffer();
}
function ha(e) {
	this.enter({
		type: "footnoteReference",
		identifier: "",
		label: ""
	}, e);
}
function ga() {
	this.buffer();
}
function _a(e) {
	this.enter({
		type: "footnoteDefinition",
		identifier: "",
		label: "",
		children: []
	}, e);
}
function va(e) {
	let t = this.resume(), n = this.stack[this.stack.length - 1];
	n.type, n.identifier = v(this.sliceSerialize(e)).toLowerCase(), n.label = t;
}
function ya(e) {
	this.exit(e);
}
function ba(e) {
	let t = this.resume(), n = this.stack[this.stack.length - 1];
	n.type, n.identifier = v(this.sliceSerialize(e)).toLowerCase(), n.label = t;
}
function xa(e) {
	this.exit(e);
}
function Sa() {
	return "[";
}
function Ca(e, t, n, r) {
	let i = n.createTracker(r), a = i.move("[^"), o = n.enter("footnoteReference"), s = n.enter("reference");
	return a += i.move(n.safe(n.associationId(e), {
		after: "]",
		before: a
	})), s(), o(), a += i.move("]"), a;
}
function wa() {
	return {
		enter: {
			gfmFootnoteCallString: ma,
			gfmFootnoteCall: ha,
			gfmFootnoteDefinitionLabelString: ga,
			gfmFootnoteDefinition: _a
		},
		exit: {
			gfmFootnoteCallString: va,
			gfmFootnoteCall: ya,
			gfmFootnoteDefinitionLabelString: ba,
			gfmFootnoteDefinition: xa
		}
	};
}
function Ta(e) {
	let t = !1;
	return e && e.firstLineBlank && (t = !0), {
		handlers: {
			footnoteDefinition: n,
			footnoteReference: Ca
		},
		unsafe: [{
			character: "[",
			inConstruct: [
				"label",
				"phrasing",
				"reference"
			]
		}]
	};
	function n(e, n, r, i) {
		let a = r.createTracker(i), o = a.move("[^"), s = r.enter("footnoteDefinition"), c = r.enter("label");
		return o += a.move(r.safe(r.associationId(e), {
			before: o,
			after: "]"
		})), c(), o += a.move("]:"), e.children && e.children.length > 0 && (a.shift(4), o += a.move((t ? "\n" : " ") + r.indentLines(r.containerFlow(e, a.current()), t ? Da : Ea))), s(), o;
	}
}
function Ea(e, t, n) {
	return t === 0 ? e : Da(e, t, n);
}
function Da(e, t, n) {
	return (n ? "" : "    ") + e;
}
// node_modules/.bun/mdast-util-gfm-strikethrough@2.0.0/node_modules/mdast-util-gfm-strikethrough/lib/index.js
var Oa = [
	"autolink",
	"destinationLiteral",
	"destinationRaw",
	"reference",
	"titleQuote",
	"titleApostrophe"
];
Na.peek = Pa;
function ka() {
	return {
		canContainEols: ["delete"],
		enter: { strikethrough: ja },
		exit: { strikethrough: Ma }
	};
}
function Aa() {
	return {
		unsafe: [{
			character: "~",
			inConstruct: "phrasing",
			notInConstruct: Oa
		}],
		handlers: { delete: Na }
	};
}
function ja(e) {
	this.enter({
		type: "delete",
		children: []
	}, e);
}
function Ma(e) {
	this.exit(e);
}
function Na(e, t, n, r) {
	let i = n.createTracker(r), a = n.enter("strikethrough"), o = i.move("~~");
	return o += n.containerPhrasing(e, {
		...i.current(),
		before: o,
		after: "~"
	}), o += i.move("~~"), a(), o;
}
function Pa() {
	return "~";
}
// node_modules/.bun/markdown-table@3.0.4/node_modules/markdown-table/index.js
function Fa(e) {
	return e.length;
}
function Ia(e, t) {
	let n = t || {}, r = (n.align || []).concat(), i = n.stringLength || Fa, a = [], o = [], s = [], c = [], l = 0, u = -1;
	for (; ++u < e.length;) {
		let t = [], r = [], a = -1;
		for (e[u].length > l && (l = e[u].length); ++a < e[u].length;) {
			let o = La(e[u][a]);
			if (n.alignDelimiters !== !1) {
				let e = i(o);
				r[a] = e, (c[a] === void 0 || e > c[a]) && (c[a] = e);
			}
			t.push(o);
		}
		o[u] = t, s[u] = r;
	}
	let d = -1;
	if (typeof r == "object" && "length" in r) for (; ++d < l;) a[d] = Ra(r[d]);
	else {
		let e = Ra(r);
		for (; ++d < l;) a[d] = e;
	}
	d = -1;
	let f = [], p = [];
	for (; ++d < l;) {
		let e = a[d], t = "", r = "";
		e === 99 ? (t = ":", r = ":") : e === 108 ? t = ":" : e === 114 && (r = ":");
		let i = n.alignDelimiters === !1 ? 1 : Math.max(1, c[d] - t.length - r.length), o = t + "-".repeat(i) + r;
		n.alignDelimiters !== !1 && (i = t.length + i + r.length, i > c[d] && (c[d] = i), p[d] = i), f[d] = o;
	}
	o.splice(1, 0, f), s.splice(1, 0, p), u = -1;
	let m = [];
	for (; ++u < o.length;) {
		let e = o[u], t = s[u];
		d = -1;
		let r = [];
		for (; ++d < l;) {
			let i = e[d] || "", o = "", s = "";
			if (n.alignDelimiters !== !1) {
				let e = c[d] - (t[d] || 0), n = a[d];
				n === 114 ? o = " ".repeat(e) : n === 99 ? e % 2 ? (o = " ".repeat(e / 2 + .5), s = " ".repeat(e / 2 - .5)) : (o = " ".repeat(e / 2), s = o) : s = " ".repeat(e);
			}
			n.delimiterStart !== !1 && !d && r.push("|"), n.padding === !1 || n.alignDelimiters === !1 && i === "" || n.delimiterStart === !1 && !d || r.push(" "), n.alignDelimiters !== !1 && r.push(o), r.push(i), n.alignDelimiters !== !1 && r.push(s), n.padding !== !1 && r.push(" "), (n.delimiterEnd !== !1 || d !== l - 1) && r.push("|");
		}
		m.push(n.delimiterEnd === !1 ? r.join("").replace(/ +$/, "") : r.join(""));
	}
	return m.join("\n");
}
function La(e) {
	return e == null ? "" : String(e);
}
function Ra(e) {
	let t = typeof e == "string" ? e.codePointAt(0) : 0;
	return t === 67 || t === 99 ? 99 : t === 76 || t === 108 ? 108 : t === 82 || t === 114 ? 114 : 0;
}
// node_modules/.bun/zwitch@2.0.4/node_modules/zwitch/index.js
var za = {}.hasOwnProperty;
function Ba(e, t) {
	let n = t || {};
	function r(t, ...n) {
		let i = r.invalid, a = r.handlers;
		if (t && za.call(t, e)) {
			let n = String(t[e]);
			i = za.call(a, n) ? a[n] : r.unknown;
		}
		if (i) return i.call(this, t, ...n);
	}
	return r.handlers = n.handlers || {}, r.invalid = n.invalid, r.unknown = n.unknown, r;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/configure.js
var Va = {}.hasOwnProperty;
function Ha(e, t) {
	let n = -1, r;
	if (t.extensions) for (; ++n < t.extensions.length;) Ha(e, t.extensions[n]);
	for (r in t) if (Va.call(t, r)) switch (r) {
		case "extensions": break;
		/* c8 ignore next 4 */
		case "unsafe":
			Ua(e[r], t[r]);
			break;
		case "join":
			Ua(e[r], t[r]);
			break;
		case "handlers":
			Wa(e[r], t[r]);
			break;
		default: e.options[r] = t[r];
	}
	return e;
}
function Ua(e, t) {
	t && e.push(...t);
}
function Wa(e, t) {
	t && Object.assign(e, t);
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/blockquote.js
function Ga(e, t, n, r) {
	let i = n.enter("blockquote"), a = n.createTracker(r);
	a.move("> "), a.shift(2);
	let o = n.indentLines(n.containerFlow(e, a.current()), Ka);
	return i(), o;
}
function Ka(e, t, n) {
	return ">" + (n ? "" : " ") + e;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/pattern-in-scope.js
function qa(e, t) {
	return Ja(e, t.inConstruct, !0) && !Ja(e, t.notInConstruct, !1);
}
function Ja(e, t, n) {
	if (typeof t == "string" && (t = [t]), !t || t.length === 0) return n;
	let r = -1;
	for (; ++r < t.length;) if (e.includes(t[r])) return !0;
	return !1;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/break.js
function Ya(e, t, n, r) {
	let i = -1;
	for (; ++i < n.unsafe.length;) if (n.unsafe[i].character === "\n" && qa(n.stack, n.unsafe[i])) return /[ \t]/.test(r.before) ? "" : " ";
	return "\\\n";
}
// node_modules/.bun/longest-streak@3.1.0/node_modules/longest-streak/index.js
function Xa(e, t) {
	let n = String(e), r = n.indexOf(t), i = r, a = 0, o = 0;
	if (typeof t != "string") throw TypeError("Expected substring");
	for (; r !== -1;) r === i ? ++a > o && (o = a) : a = 1, i = r + t.length, r = n.indexOf(t, i);
	return o;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-code-as-indented.js
function Za(e, t) {
	return !(t.options.fences !== !1 || !e.value || e.lang || !/[^ \r\n]/.test(e.value) || /^[\t ]*(?:[\r\n]|$)|(?:^|[\r\n])[\t ]*$/.test(e.value));
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-fence.js
function Qa(e) {
	let t = e.options.fence || "`";
	if (t !== "`" && t !== "~") throw Error("Cannot serialize code with `" + t + "` for `options.fence`, expected `` ` `` or `~`");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/code.js
function $a(e, t, n, r) {
	let i = Qa(n), a = e.value || "", o = i === "`" ? "GraveAccent" : "Tilde";
	if (Za(e, n)) {
		let e = n.enter("codeIndented"), t = n.indentLines(a, eo);
		return e(), t;
	}
	let s = n.createTracker(r), c = i.repeat(Math.max(Xa(a, i) + 1, 3)), l = n.enter("codeFenced"), u = s.move(c);
	if (e.lang) {
		let t = n.enter(`codeFencedLang${o}`);
		u += s.move(n.safe(e.lang, {
			before: u,
			after: " ",
			encode: ["`"],
			...s.current()
		})), t();
	}
	if (e.lang && e.meta) {
		let t = n.enter(`codeFencedMeta${o}`);
		u += s.move(" "), u += s.move(n.safe(e.meta, {
			before: u,
			after: "\n",
			encode: ["`"],
			...s.current()
		})), t();
	}
	return u += s.move("\n"), a && (u += s.move(a + "\n")), u += s.move(c), l(), u;
}
function eo(e, t, n) {
	return (n ? "" : "    ") + e;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-quote.js
function to(e) {
	let t = e.options.quote || "\"";
	if (t !== "\"" && t !== "'") throw Error("Cannot serialize title with `" + t + "` for `options.quote`, expected `\"`, or `'`");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/definition.js
function no(e, t, n, r) {
	let i = to(n), a = i === "\"" ? "Quote" : "Apostrophe", o = n.enter("definition"), s = n.enter("label"), c = n.createTracker(r), l = c.move("[");
	return l += c.move(n.safe(n.associationId(e), {
		before: l,
		after: "]",
		...c.current()
	})), l += c.move("]: "), s(), !e.url || /[\0- \u007F]/.test(e.url) ? (s = n.enter("destinationLiteral"), l += c.move("<"), l += c.move(n.safe(e.url, {
		before: l,
		after: ">",
		...c.current()
	})), l += c.move(">")) : (s = n.enter("destinationRaw"), l += c.move(n.safe(e.url, {
		before: l,
		after: e.title ? " " : "\n",
		...c.current()
	}))), s(), e.title && (s = n.enter(`title${a}`), l += c.move(" " + i), l += c.move(n.safe(e.title, {
		before: l,
		after: i,
		...c.current()
	})), l += c.move(i), s()), o(), l;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-emphasis.js
function ro(e) {
	let t = e.options.emphasis || "*";
	if (t !== "*" && t !== "_") throw Error("Cannot serialize emphasis with `" + t + "` for `options.emphasis`, expected `*`, or `_`");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/encode-character-reference.js
function io(e) {
	return "&#x" + e.toString(16).toUpperCase() + ";";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/encode-info.js
function ao(e, t, n) {
	let r = i(e), a = i(t);
	return r === void 0 ? a === void 0 ? n === "_" ? {
		inside: !0,
		outside: !0
	} : {
		inside: !1,
		outside: !1
	} : a === 1 ? {
		inside: !0,
		outside: !0
	} : {
		inside: !1,
		outside: !0
	} : r === 1 ? a === void 0 ? {
		inside: !1,
		outside: !1
	} : a === 1 ? {
		inside: !0,
		outside: !0
	} : {
		inside: !1,
		outside: !1
	} : a === void 0 ? {
		inside: !1,
		outside: !1
	} : a === 1 ? {
		inside: !0,
		outside: !1
	} : {
		inside: !1,
		outside: !1
	};
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/emphasis.js
oo.peek = so;
function oo(e, t, n, r) {
	let i = ro(n), a = n.enter("emphasis"), o = n.createTracker(r), s = o.move(i), c = o.move(n.containerPhrasing(e, {
		after: i,
		before: s,
		...o.current()
	})), l = c.charCodeAt(0), u = ao(r.before.charCodeAt(r.before.length - 1), l, i);
	u.inside && (c = io(l) + c.slice(1));
	let d = c.charCodeAt(c.length - 1), f = ao(r.after.charCodeAt(0), d, i);
	f.inside && (c = c.slice(0, -1) + io(d));
	let p = o.move(i);
	return a(), n.attentionEncodeSurroundingInfo = {
		after: f.outside,
		before: u.outside
	}, s + c + p;
}
function so(e, t, n) {
	return n.options.emphasis || "*";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-heading-as-setext.js
function co(e, t) {
	let n = !1;
	return ee(e, function(e) {
		if ("value" in e && /\r?\n|\r/.test(e.value) || e.type === "break") return n = !0, !1;
	}), !!((!e.depth || e.depth < 3) && y(e) && (t.options.setext || n));
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/heading.js
function lo(e, t, n, r) {
	let i = Math.max(Math.min(6, e.depth || 1), 1), a = n.createTracker(r);
	if (co(e, n)) {
		let t = n.enter("headingSetext"), r = n.enter("phrasing"), o = n.containerPhrasing(e, {
			...a.current(),
			before: "\n",
			after: "\n"
		});
		return r(), t(), o + "\n" + (i === 1 ? "=" : "-").repeat(o.length - (Math.max(o.lastIndexOf("\r"), o.lastIndexOf("\n")) + 1));
	}
	let o = "#".repeat(i), s = n.enter("headingAtx"), c = n.enter("phrasing");
	a.move(o + " ");
	let l = n.containerPhrasing(e, {
		before: "# ",
		after: "\n",
		...a.current()
	});
	return /^[\t ]/.test(l) && (l = io(l.charCodeAt(0)) + l.slice(1)), l = l ? o + " " + l : o, n.options.closeAtx && (l += " " + o), c(), s(), l;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/html.js
uo.peek = fo;
function uo(e) {
	return e.value || "";
}
function fo() {
	return "<";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/image.js
po.peek = mo;
function po(e, t, n, r) {
	let i = to(n), a = i === "\"" ? "Quote" : "Apostrophe", o = n.enter("image"), s = n.enter("label"), c = n.createTracker(r), l = c.move("![");
	return l += c.move(n.safe(e.alt, {
		before: l,
		after: "]",
		...c.current()
	})), l += c.move("]("), s(), !e.url && e.title || /[\0- \u007F]/.test(e.url) ? (s = n.enter("destinationLiteral"), l += c.move("<"), l += c.move(n.safe(e.url, {
		before: l,
		after: ">",
		...c.current()
	})), l += c.move(">")) : (s = n.enter("destinationRaw"), l += c.move(n.safe(e.url, {
		before: l,
		after: e.title ? " " : ")",
		...c.current()
	}))), s(), e.title && (s = n.enter(`title${a}`), l += c.move(" " + i), l += c.move(n.safe(e.title, {
		before: l,
		after: i,
		...c.current()
	})), l += c.move(i), s()), l += c.move(")"), o(), l;
}
function mo() {
	return "!";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/image-reference.js
ho.peek = go;
function ho(e, t, n, r) {
	let i = e.referenceType, a = n.enter("imageReference"), o = n.enter("label"), s = n.createTracker(r), c = s.move("!["), l = n.safe(e.alt, {
		before: c,
		after: "]",
		...s.current()
	});
	c += s.move(l + "]["), o();
	let u = n.stack;
	n.stack = [], o = n.enter("reference");
	let d = n.safe(n.associationId(e), {
		before: c,
		after: "]",
		...s.current()
	});
	return o(), n.stack = u, a(), i === "full" || !l || l !== d ? c += s.move(d + "]") : i === "shortcut" ? c = c.slice(0, -1) : c += s.move("]"), c;
}
function go() {
	return "!";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/inline-code.js
_o.peek = vo;
function _o(e, t, n) {
	let r = e.value || "", i = "`", a = -1;
	for (; RegExp("(^|[^`])" + i + "([^`]|$)").test(r);) i += "`";
	for (/[^ \r\n]/.test(r) && (/^[ \r\n]/.test(r) && /[ \r\n]$/.test(r) || /^`|`$/.test(r)) && (r = " " + r + " "); ++a < n.unsafe.length;) {
		let e = n.unsafe[a], t = n.compilePattern(e), i;
		if (e.atBreak) for (; i = t.exec(r);) {
			let e = i.index;
			r.charCodeAt(e) === 10 && r.charCodeAt(e - 1) === 13 && e--, r = r.slice(0, e) + " " + r.slice(i.index + 1);
		}
	}
	return i + r + i;
}
function vo() {
	return "`";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-link-as-autolink.js
function yo(e, t) {
	let n = y(e);
	return !(t.options.resourceLink || !e.url || e.title || !e.children || e.children.length !== 1 || e.children[0].type !== "text" || n !== e.url && "mailto:" + n !== e.url || !/^[a-z][a-z+.-]+:/i.test(e.url) || /[\0- <>\u007F]/.test(e.url));
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/link.js
bo.peek = xo;
function bo(e, t, n, r) {
	let i = to(n), a = i === "\"" ? "Quote" : "Apostrophe", o = n.createTracker(r), s, c;
	if (yo(e, n)) {
		let t = n.stack;
		n.stack = [], s = n.enter("autolink");
		let r = o.move("<");
		return r += o.move(n.containerPhrasing(e, {
			before: r,
			after: ">",
			...o.current()
		})), r += o.move(">"), s(), n.stack = t, r;
	}
	s = n.enter("link"), c = n.enter("label");
	let l = o.move("[");
	return l += o.move(n.containerPhrasing(e, {
		before: l,
		after: "](",
		...o.current()
	})), l += o.move("]("), c(), !e.url && e.title || /[\0- \u007F]/.test(e.url) ? (c = n.enter("destinationLiteral"), l += o.move("<"), l += o.move(n.safe(e.url, {
		before: l,
		after: ">",
		...o.current()
	})), l += o.move(">")) : (c = n.enter("destinationRaw"), l += o.move(n.safe(e.url, {
		before: l,
		after: e.title ? " " : ")",
		...o.current()
	}))), c(), e.title && (c = n.enter(`title${a}`), l += o.move(" " + i), l += o.move(n.safe(e.title, {
		before: l,
		after: i,
		...o.current()
	})), l += o.move(i), c()), l += o.move(")"), s(), l;
}
function xo(e, t, n) {
	return yo(e, n) ? "<" : "[";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/link-reference.js
So.peek = Co;
function So(e, t, n, r) {
	let i = e.referenceType, a = n.enter("linkReference"), o = n.enter("label"), s = n.createTracker(r), c = s.move("["), l = n.containerPhrasing(e, {
		before: c,
		after: "]",
		...s.current()
	});
	c += s.move(l + "]["), o();
	let u = n.stack;
	n.stack = [], o = n.enter("reference");
	let d = n.safe(n.associationId(e), {
		before: c,
		after: "]",
		...s.current()
	});
	return o(), n.stack = u, a(), i === "full" || !l || l !== d ? c += s.move(d + "]") : i === "shortcut" ? c = c.slice(0, -1) : c += s.move("]"), c;
}
function Co() {
	return "[";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet.js
function wo(e) {
	let t = e.options.bullet || "*";
	if (t !== "*" && t !== "+" && t !== "-") throw Error("Cannot serialize items with `" + t + "` for `options.bullet`, expected `*`, `+`, or `-`");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet-other.js
function To(e) {
	let t = wo(e), n = e.options.bulletOther;
	if (!n) return t === "*" ? "-" : "*";
	if (n !== "*" && n !== "+" && n !== "-") throw Error("Cannot serialize items with `" + n + "` for `options.bulletOther`, expected `*`, `+`, or `-`");
	if (n === t) throw Error("Expected `bullet` (`" + t + "`) and `bulletOther` (`" + n + "`) to be different");
	return n;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet-ordered.js
function Eo(e) {
	let t = e.options.bulletOrdered || ".";
	if (t !== "." && t !== ")") throw Error("Cannot serialize items with `" + t + "` for `options.bulletOrdered`, expected `.` or `)`");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-rule.js
function Do(e) {
	let t = e.options.rule || "*";
	if (t !== "*" && t !== "-" && t !== "_") throw Error("Cannot serialize rules with `" + t + "` for `options.rule`, expected `*`, `-`, or `_`");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/list.js
function Oo(e, t, n, r) {
	let i = n.enter("list"), a = n.bulletCurrent, o = e.ordered ? Eo(n) : wo(n), s = e.ordered ? o === "." ? ")" : "." : To(n), c = t && n.bulletLastUsed ? o === n.bulletLastUsed : !1;
	if (!e.ordered) {
		let t = e.children ? e.children[0] : void 0;
		if (o !== "*" && o !== "-" || !t || t.children && t.children[0] || n.stack[n.stack.length - 1] !== "list" || n.stack[n.stack.length - 2] !== "listItem" || n.stack[n.stack.length - 3] !== "list" || n.stack[n.stack.length - 4] !== "listItem" || n.indexStack[n.indexStack.length - 1] !== 0 || n.indexStack[n.indexStack.length - 2] !== 0 || n.indexStack[n.indexStack.length - 3] !== 0 || (c = !0), Do(n) === o && t) {
			let t = -1;
			for (; ++t < e.children.length;) {
				let n = e.children[t];
				if (n && n.type === "listItem" && n.children && n.children[0] && n.children[0].type === "thematicBreak") {
					c = !0;
					break;
				}
			}
		}
	}
	c && (o = s), n.bulletCurrent = o;
	let l = n.containerFlow(e, r);
	return n.bulletLastUsed = o, n.bulletCurrent = a, i(), l;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-list-item-indent.js
function ko(e) {
	let t = e.options.listItemIndent || "one";
	if (t !== "tab" && t !== "one" && t !== "mixed") throw Error("Cannot serialize items with `" + t + "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/list-item.js
function Ao(e, t, n, r) {
	let i = ko(n), a = n.bulletCurrent || wo(n);
	t && t.type === "list" && t.ordered && (a = (typeof t.start == "number" && t.start > -1 ? t.start : 1) + (n.options.incrementListMarker === !1 ? 0 : t.children.indexOf(e)) + a);
	let o = a.length + 1;
	(i === "tab" || i === "mixed" && (t && t.type === "list" && t.spread || e.spread)) && (o = Math.ceil(o / 4) * 4);
	let s = n.createTracker(r);
	s.move(a + " ".repeat(o - a.length)), s.shift(o);
	let c = n.enter("listItem"), l = n.indentLines(n.containerFlow(e, s.current()), u);
	return c(), l;
	function u(e, t, n) {
		return t ? (n ? "" : " ".repeat(o)) + e : (n ? a : a + " ".repeat(o - a.length)) + e;
	}
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/paragraph.js
function jo(e, t, n, r) {
	let i = n.enter("paragraph"), a = n.enter("phrasing"), o = n.containerPhrasing(e, r);
	return a(), i(), o;
}
// node_modules/.bun/mdast-util-phrasing@4.1.0/node_modules/mdast-util-phrasing/lib/index.js
var Mo = h([
	"break",
	"delete",
	"emphasis",
	"footnote",
	"footnoteReference",
	"image",
	"imageReference",
	"inlineCode",
	"inlineMath",
	"link",
	"linkReference",
	"mdxJsxTextElement",
	"mdxTextExpression",
	"strong",
	"text",
	"textDirective"
]);
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/root.js
function No(e, t, n, r) {
	return (e.children.some(function(e) {
		return Mo(e);
	}) ? n.containerPhrasing : n.containerFlow).call(n, e, r);
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-strong.js
function Po(e) {
	let t = e.options.strong || "*";
	if (t !== "*" && t !== "_") throw Error("Cannot serialize strong with `" + t + "` for `options.strong`, expected `*`, or `_`");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/strong.js
Fo.peek = Io;
function Fo(e, t, n, r) {
	let i = Po(n), a = n.enter("strong"), o = n.createTracker(r), s = o.move(i + i), c = o.move(n.containerPhrasing(e, {
		after: i,
		before: s,
		...o.current()
	})), l = c.charCodeAt(0), u = ao(r.before.charCodeAt(r.before.length - 1), l, i);
	u.inside && (c = io(l) + c.slice(1));
	let d = c.charCodeAt(c.length - 1), f = ao(r.after.charCodeAt(0), d, i);
	f.inside && (c = c.slice(0, -1) + io(d));
	let p = o.move(i + i);
	return a(), n.attentionEncodeSurroundingInfo = {
		after: f.outside,
		before: u.outside
	}, s + c + p;
}
function Io(e, t, n) {
	return n.options.strong || "*";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/text.js
function Lo(e, t, n, r) {
	return n.safe(e.value, r);
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-rule-repetition.js
function Ro(e) {
	let t = e.options.ruleRepetition || 3;
	if (t < 3) throw Error("Cannot serialize rules with repetition `" + t + "` for `options.ruleRepetition`, expected `3` or more");
	return t;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/thematic-break.js
function zo(e, t, n) {
	let r = (Do(n) + (n.options.ruleSpaces ? " " : "")).repeat(Ro(n));
	return n.options.ruleSpaces ? r.slice(0, -1) : r;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/index.js
var Bo = {
	blockquote: Ga,
	break: Ya,
	code: $a,
	definition: no,
	emphasis: oo,
	hardBreak: Ya,
	heading: lo,
	html: uo,
	image: po,
	imageReference: ho,
	inlineCode: _o,
	link: bo,
	linkReference: So,
	list: Oo,
	listItem: Ao,
	paragraph: jo,
	root: No,
	strong: Fo,
	text: Lo,
	thematicBreak: zo
}, Vo = [Ho];
function Ho(e, t, n, r) {
	if (t.type === "code" && Za(t, r) && (e.type === "list" || e.type === t.type && Za(e, r))) return !1;
	if ("spread" in n && typeof n.spread == "boolean") return e.type === "paragraph" && (e.type === t.type || t.type === "definition" || t.type === "heading" && co(t, r)) ? void 0 : +!!n.spread;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/unsafe.js
var Uo = [
	"autolink",
	"destinationLiteral",
	"destinationRaw",
	"reference",
	"titleQuote",
	"titleApostrophe"
], Wo = [
	{
		character: "	",
		after: "[\\r\\n]",
		inConstruct: "phrasing"
	},
	{
		character: "	",
		before: "[\\r\\n]",
		inConstruct: "phrasing"
	},
	{
		character: "	",
		inConstruct: ["codeFencedLangGraveAccent", "codeFencedLangTilde"]
	},
	{
		character: "\r",
		inConstruct: [
			"codeFencedLangGraveAccent",
			"codeFencedLangTilde",
			"codeFencedMetaGraveAccent",
			"codeFencedMetaTilde",
			"destinationLiteral",
			"headingAtx"
		]
	},
	{
		character: "\n",
		inConstruct: [
			"codeFencedLangGraveAccent",
			"codeFencedLangTilde",
			"codeFencedMetaGraveAccent",
			"codeFencedMetaTilde",
			"destinationLiteral",
			"headingAtx"
		]
	},
	{
		character: " ",
		after: "[\\r\\n]",
		inConstruct: "phrasing"
	},
	{
		character: " ",
		before: "[\\r\\n]",
		inConstruct: "phrasing"
	},
	{
		character: " ",
		inConstruct: ["codeFencedLangGraveAccent", "codeFencedLangTilde"]
	},
	{
		character: "!",
		after: "\\[",
		inConstruct: "phrasing",
		notInConstruct: Uo
	},
	{
		character: "\"",
		inConstruct: "titleQuote"
	},
	{
		atBreak: !0,
		character: "#"
	},
	{
		character: "#",
		inConstruct: "headingAtx",
		after: "(?:[\r\n]|$)"
	},
	{
		character: "&",
		after: "[#A-Za-z]",
		inConstruct: "phrasing"
	},
	{
		character: "'",
		inConstruct: "titleApostrophe"
	},
	{
		character: "(",
		inConstruct: "destinationRaw"
	},
	{
		before: "\\]",
		character: "(",
		inConstruct: "phrasing",
		notInConstruct: Uo
	},
	{
		atBreak: !0,
		before: "\\d+",
		character: ")"
	},
	{
		character: ")",
		inConstruct: "destinationRaw"
	},
	{
		atBreak: !0,
		character: "*",
		after: "(?:[ 	\r\n*])"
	},
	{
		character: "*",
		inConstruct: "phrasing",
		notInConstruct: Uo
	},
	{
		atBreak: !0,
		character: "+",
		after: "(?:[ 	\r\n])"
	},
	{
		atBreak: !0,
		character: "-",
		after: "(?:[ 	\r\n-])"
	},
	{
		atBreak: !0,
		before: "\\d+",
		character: ".",
		after: "(?:[ 	\r\n]|$)"
	},
	{
		atBreak: !0,
		character: "<",
		after: "[!/?A-Za-z]"
	},
	{
		character: "<",
		after: "[!/?A-Za-z]",
		inConstruct: "phrasing",
		notInConstruct: Uo
	},
	{
		character: "<",
		inConstruct: "destinationLiteral"
	},
	{
		atBreak: !0,
		character: "="
	},
	{
		atBreak: !0,
		character: ">"
	},
	{
		character: ">",
		inConstruct: "destinationLiteral"
	},
	{
		atBreak: !0,
		character: "["
	},
	{
		character: "[",
		inConstruct: "phrasing",
		notInConstruct: Uo
	},
	{
		character: "[",
		inConstruct: ["label", "reference"]
	},
	{
		character: "\\",
		after: "[\\r\\n]",
		inConstruct: "phrasing"
	},
	{
		character: "]",
		inConstruct: ["label", "reference"]
	},
	{
		atBreak: !0,
		character: "_"
	},
	{
		character: "_",
		inConstruct: "phrasing",
		notInConstruct: Uo
	},
	{
		atBreak: !0,
		character: "`"
	},
	{
		character: "`",
		inConstruct: ["codeFencedLangGraveAccent", "codeFencedMetaGraveAccent"]
	},
	{
		character: "`",
		inConstruct: "phrasing",
		notInConstruct: Uo
	},
	{
		atBreak: !0,
		character: "~"
	}
];
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/association.js
function Go(e) {
	return e.label || !e.identifier ? e.label || "" : n(e.identifier);
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/compile-pattern.js
function Ko(e) {
	if (!e._compiled) {
		let t = (e.atBreak ? "[\\r\\n][\\t ]*" : "") + (e.before ? "(?:" + e.before + ")" : "");
		e._compiled = RegExp((t ? "(" + t + ")" : "") + (/[|\\{}()[\]^$+*?.-]/.test(e.character) ? "\\" : "") + e.character + (e.after ? "(?:" + e.after + ")" : ""), "g");
	}
	return e._compiled;
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/container-phrasing.js
function qo(e, t, n) {
	let r = t.indexStack, i = e.children || [], a = [], o = -1, s = n.before, c;
	r.push(-1);
	let l = t.createTracker(n);
	for (; ++o < i.length;) {
		let u = i[o], d;
		if (r[r.length - 1] = o, o + 1 < i.length) {
			let n = t.handle.handlers[i[o + 1].type];
			n && n.peek && (n = n.peek), d = n ? n(i[o + 1], e, t, {
				before: "",
				after: "",
				...l.current()
			}).charAt(0) : "";
		} else d = n.after;
		a.length > 0 && (s === "\r" || s === "\n") && u.type === "html" && (a[a.length - 1] = a[a.length - 1].replace(/(\r?\n|\r)$/, " "), s = " ", l = t.createTracker(n), l.move(a.join("")));
		let f = t.handle(u, e, t, {
			...l.current(),
			after: d,
			before: s
		});
		c && c === f.slice(0, 1) && (f = io(c.charCodeAt(0)) + f.slice(1));
		let p = t.attentionEncodeSurroundingInfo;
		t.attentionEncodeSurroundingInfo = void 0, c = void 0, p && (a.length > 0 && p.before && s === a[a.length - 1].slice(-1) && (a[a.length - 1] = a[a.length - 1].slice(0, -1) + io(s.charCodeAt(0))), p.after && (c = d)), l.move(f), a.push(f), s = f.slice(-1);
	}
	return r.pop(), a.join("");
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/container-flow.js
function Jo(e, t, n) {
	let r = t.indexStack, i = e.children || [], a = t.createTracker(n), o = [], s = -1;
	for (r.push(-1); ++s < i.length;) {
		let n = i[s];
		r[r.length - 1] = s, o.push(a.move(t.handle(n, e, t, {
			before: "\n",
			after: "\n",
			...a.current()
		}))), n.type !== "list" && (t.bulletLastUsed = void 0), s < i.length - 1 && o.push(a.move(Yo(n, i[s + 1], e, t)));
	}
	return r.pop(), o.join("");
}
function Yo(e, t, n, r) {
	let i = r.join.length;
	for (; i--;) {
		let a = r.join[i](e, t, n, r);
		if (a === !0 || a === 1) break;
		if (typeof a == "number") return "\n".repeat(1 + a);
		if (a === !1) return "\n\n<!---->\n\n";
	}
	return "\n\n";
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/indent-lines.js
var Xo = /\r?\n|\r/g;
function Zo(e, t) {
	let n = [], r = 0, i = 0, a;
	for (; a = Xo.exec(e);) o(e.slice(r, a.index)), n.push(a[0]), r = a.index + a[0].length, i++;
	return o(e.slice(r)), n.join("");
	function o(e) {
		n.push(t(e, i, !e));
	}
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/safe.js
function Qo(e, t, n) {
	let r = (n.before || "") + (t || "") + (n.after || ""), i = [], a = [], o = {}, s = -1;
	for (; ++s < e.unsafe.length;) {
		let t = e.unsafe[s];
		if (!qa(e.stack, t)) continue;
		let n = e.compilePattern(t), a;
		for (; a = n.exec(r);) {
			let e = "before" in t || !!t.atBreak, n = "after" in t, r = a.index + (e ? a[1].length : 0);
			i.includes(r) ? (o[r].before && !e && (o[r].before = !1), o[r].after && !n && (o[r].after = !1)) : (i.push(r), o[r] = {
				before: e,
				after: n
			});
		}
	}
	i.sort($o);
	let c = n.before ? n.before.length : 0, l = r.length - (n.after ? n.after.length : 0);
	for (s = -1; ++s < i.length;) {
		let e = i[s];
		e < c || e >= l || e + 1 < l && i[s + 1] === e + 1 && o[e].after && !o[e + 1].before && !o[e + 1].after || i[s - 1] === e - 1 && o[e].before && !o[e - 1].before && !o[e - 1].after || (c !== e && a.push(es(r.slice(c, e), "\\")), c = e, /[!-/:-@[-`{-~]/.test(r.charAt(e)) && (!n.encode || !n.encode.includes(r.charAt(e))) ? a.push("\\") : (a.push(io(r.charCodeAt(e))), c++));
	}
	return a.push(es(r.slice(c, l), n.after)), a.join("");
}
function $o(e, t) {
	return e - t;
}
function es(e, t) {
	let n = /\\(?=[!-/:-@[-`{-~])/g, r = [], i = [], a = e + t, o = -1, s = 0, c;
	for (; c = n.exec(a);) r.push(c.index);
	for (; ++o < r.length;) s !== r[o] && i.push(e.slice(s, r[o])), i.push("\\"), s = r[o];
	return i.push(e.slice(s)), i.join("");
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/track.js
function ts(e) {
	/* c8 ignore next 5 */
	let t = e || {}, n = t.now || {}, r = t.lineShift || 0, i = n.line || 1, a = n.column || 1;
	return {
		move: c,
		current: o,
		shift: s
	};
	function o() {
		return {
			now: {
				line: i,
				column: a
			},
			lineShift: r
		};
	}
	function s(e) {
		r += e;
	}
	function c(e) {
		let t = e || "", n = t.split(/\r?\n|\r/g), o = n[n.length - 1];
		return i += n.length - 1, a = n.length === 1 ? a + o.length : 1 + o.length + r, t;
	}
}
// node_modules/.bun/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/index.js
function ns(e, t) {
	let n = t || {}, r = {
		associationId: Go,
		containerPhrasing: os,
		containerFlow: ss,
		createTracker: ts,
		compilePattern: Ko,
		enter: a,
		handlers: { ...Bo },
		handle: void 0,
		indentLines: Zo,
		indexStack: [],
		join: [...Vo],
		options: {},
		safe: cs,
		stack: [],
		unsafe: [...Wo]
	};
	Ha(r, n), r.options.tightDefinitions && r.join.push(as), r.handle = Ba("type", {
		invalid: rs,
		unknown: is,
		handlers: r.handlers
	});
	let i = r.handle(e, void 0, r, {
		before: "\n",
		after: "\n",
		now: {
			line: 1,
			column: 1
		},
		lineShift: 0
	});
	return i && i.charCodeAt(i.length - 1) !== 10 && i.charCodeAt(i.length - 1) !== 13 && (i += "\n"), i;
	function a(e) {
		return r.stack.push(e), t;
		function t() {
			r.stack.pop();
		}
	}
}
function rs(e) {
	throw Error("Cannot handle value `" + e + "`, expected node");
}
function is(e) {
	throw Error("Cannot handle unknown node `" + e.type + "`");
}
function as(e, t) {
	if (e.type === "definition" && e.type === t.type) return 0;
}
function os(e, t) {
	return qo(e, this, t);
}
function ss(e, t) {
	return Jo(e, this, t);
}
function cs(e, t) {
	return Qo(this, e, t);
}
// node_modules/.bun/mdast-util-gfm-table@2.0.0/node_modules/mdast-util-gfm-table/lib/index.js
function ls() {
	return {
		enter: {
			table: us,
			tableData: ms,
			tableHeader: ms,
			tableRow: fs
		},
		exit: {
			codeText: hs,
			table: ds,
			tableData: ps,
			tableHeader: ps,
			tableRow: ps
		}
	};
}
function us(e) {
	let t = e._align;
	this.enter({
		type: "table",
		align: t.map(function(e) {
			return e === "none" ? null : e;
		}),
		children: []
	}, e), this.data.inTable = !0;
}
function ds(e) {
	this.exit(e), this.data.inTable = void 0;
}
function fs(e) {
	this.enter({
		type: "tableRow",
		children: []
	}, e);
}
function ps(e) {
	this.exit(e);
}
function ms(e) {
	this.enter({
		type: "tableCell",
		children: []
	}, e);
}
function hs(e) {
	let t = this.resume();
	this.data.inTable && (t = t.replace(/\\([\\|])/g, gs));
	let n = this.stack[this.stack.length - 1];
	n.type, n.value = t, this.exit(e);
}
function gs(e, t) {
	return t === "|" ? t : e;
}
function _s(e) {
	let t = e || {}, n = t.tableCellPadding, r = t.tablePipeAlign, i = t.stringLength, a = n ? " " : "|";
	return {
		unsafe: [
			{
				character: "\r",
				inConstruct: "tableCell"
			},
			{
				character: "\n",
				inConstruct: "tableCell"
			},
			{
				atBreak: !0,
				character: "|",
				after: "[	 :-]"
			},
			{
				character: "|",
				inConstruct: "tableCell"
			},
			{
				atBreak: !0,
				character: ":",
				after: "-"
			},
			{
				atBreak: !0,
				character: "-",
				after: "[:|-]"
			}
		],
		handlers: {
			inlineCode: f,
			table: o,
			tableCell: c,
			tableRow: s
		}
	};
	function o(e, t, n, r) {
		return l(u(e, n, r), e.align);
	}
	function s(e, t, n, r) {
		let i = l([d(e, n, r)]);
		return i.slice(0, i.indexOf("\n"));
	}
	function c(e, t, n, r) {
		let i = n.enter("tableCell"), o = n.enter("phrasing"), s = n.containerPhrasing(e, {
			...r,
			before: a,
			after: a
		});
		return o(), i(), s;
	}
	function l(e, t) {
		return Ia(e, {
			align: t,
			alignDelimiters: r,
			padding: n,
			stringLength: i
		});
	}
	function u(e, t, n) {
		let r = e.children, i = -1, a = [], o = t.enter("table");
		for (; ++i < r.length;) a[i] = d(r[i], t, n);
		return o(), a;
	}
	function d(e, t, n) {
		let r = e.children, i = -1, a = [], o = t.enter("tableRow");
		for (; ++i < r.length;) a[i] = c(r[i], e, t, n);
		return o(), a;
	}
	function f(e, t, n) {
		let r = Bo.inlineCode(e, t, n);
		return n.stack.includes("tableCell") && (r = r.replace(/\|/g, "\\$&")), r;
	}
}
// node_modules/.bun/mdast-util-gfm-task-list-item@2.0.0/node_modules/mdast-util-gfm-task-list-item/lib/index.js
function vs() {
	return { exit: {
		taskListCheckValueChecked: bs,
		taskListCheckValueUnchecked: bs,
		paragraph: xs
	} };
}
function ys() {
	return {
		unsafe: [{
			atBreak: !0,
			character: "-",
			after: "[:|-]"
		}],
		handlers: { listItem: Ss }
	};
}
function bs(e) {
	let t = this.stack[this.stack.length - 2];
	t.type, t.checked = e.type === "taskListCheckValueChecked";
}
function xs(e) {
	let t = this.stack[this.stack.length - 2];
	if (t && t.type === "listItem" && typeof t.checked == "boolean") {
		let e = this.stack[this.stack.length - 1];
		e.type;
		let n = e.children[0];
		if (n && n.type === "text") {
			let r = t.children, i = -1, a;
			for (; ++i < r.length;) {
				let e = r[i];
				if (e.type === "paragraph") {
					a = e;
					break;
				}
			}
			a === e && (n.value = n.value.slice(1), n.value.length === 0 ? e.children.shift() : e.position && n.position && typeof n.position.start.offset == "number" && (n.position.start.column++, n.position.start.offset++, e.position.start = Object.assign({}, n.position.start)));
		}
	}
	this.exit(e);
}
function Ss(e, t, n, r) {
	let i = e.children[0], a = typeof e.checked == "boolean" && i && i.type === "paragraph", o = "[" + (e.checked ? "x" : " ") + "] ", s = n.createTracker(r);
	a && s.move(o);
	let c = Bo.listItem(e, t, n, {
		...r,
		...s.current()
	});
	return a && (c = c.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, l)), c;
	function l(e) {
		return e + o;
	}
}
// node_modules/.bun/mdast-util-gfm@3.1.0/node_modules/mdast-util-gfm/lib/index.js
function Cs() {
	return [
		ea(),
		wa(),
		ka(),
		ls(),
		vs()
	];
}
function ws(e) {
	return { extensions: [
		ta(),
		Ta(e),
		Aa(),
		_s(e),
		ys()
	] };
}
// node_modules/.bun/mdast-util-math@3.0.0/node_modules/mdast-util-math/lib/index.js
function Ts() {
	return {
		enter: {
			mathFlow: e,
			mathFlowFenceMeta: t,
			mathText: a
		},
		exit: {
			mathFlow: i,
			mathFlowFence: r,
			mathFlowFenceMeta: n,
			mathFlowValue: s,
			mathText: o,
			mathTextData: s
		}
	};
	function e(e) {
		this.enter({
			type: "math",
			meta: null,
			value: "",
			data: {
				hName: "pre",
				hChildren: [{
					type: "element",
					tagName: "code",
					properties: { className: ["language-math", "math-display"] },
					children: []
				}]
			}
		}, e);
	}
	function t() {
		this.buffer();
	}
	function n() {
		let e = this.resume(), t = this.stack[this.stack.length - 1];
		t.type, t.meta = e;
	}
	function r() {
		this.data.mathFlowInside || (this.buffer(), this.data.mathFlowInside = !0);
	}
	function i(e) {
		let t = this.resume().replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, ""), n = this.stack[this.stack.length - 1];
		n.type, this.exit(e), n.value = t;
		let r = n.data.hChildren[0];
		r.type, r.tagName, r.children.push({
			type: "text",
			value: t
		}), this.data.mathFlowInside = void 0;
	}
	function a(e) {
		this.enter({
			type: "inlineMath",
			value: "",
			data: {
				hName: "code",
				hProperties: { className: ["language-math", "math-inline"] },
				hChildren: []
			}
		}, e), this.buffer();
	}
	function o(e) {
		let t = this.resume(), n = this.stack[this.stack.length - 1];
		n.type, this.exit(e), n.value = t, n.data.hChildren.push({
			type: "text",
			value: t
		});
	}
	function s(e) {
		this.config.enter.data.call(this, e), this.config.exit.data.call(this, e);
	}
}
function Es(e) {
	let t = (e || {}).singleDollarTextMath;
	return t ??= !0, r.peek = i, {
		unsafe: [
			{
				character: "\r",
				inConstruct: "mathFlowMeta"
			},
			{
				character: "\n",
				inConstruct: "mathFlowMeta"
			},
			{
				character: "$",
				after: t ? void 0 : "\\$",
				inConstruct: "phrasing"
			},
			{
				character: "$",
				inConstruct: "mathFlowMeta"
			},
			{
				atBreak: !0,
				character: "$",
				after: "\\$"
			}
		],
		handlers: {
			math: n,
			inlineMath: r
		}
	};
	function n(e, t, n, r) {
		let i = e.value || "", a = n.createTracker(r), o = "$".repeat(Math.max(Xa(i, "$") + 1, 2)), s = n.enter("mathFlow"), c = a.move(o);
		if (e.meta) {
			let t = n.enter("mathFlowMeta");
			c += a.move(n.safe(e.meta, {
				after: "\n",
				before: c,
				encode: ["$"],
				...a.current()
			})), t();
		}
		return c += a.move("\n"), i && (c += a.move(i + "\n")), c += a.move(o), s(), c;
	}
	function r(e, n, r) {
		let i = e.value || "", a = 1;
		for (t || a++; RegExp("(^|[^$])" + "\\$".repeat(a) + "([^$]|$)").test(i);) a++;
		let o = "$".repeat(a);
		/[^ \r\n]/.test(i) && (/^[ \r\n]/.test(i) && /[ \r\n]$/.test(i) || /^\$|\$$/.test(i)) && (i = " " + i + " ");
		let s = -1;
		for (; ++s < r.unsafe.length;) {
			let e = r.unsafe[s];
			if (!e.atBreak) continue;
			let t = r.compilePattern(e), n;
			for (; n = t.exec(i);) {
				let e = n.index;
				i.codePointAt(e) === 10 && i.codePointAt(e - 1) === 13 && e--, i = i.slice(0, e) + " " + i.slice(n.index + 1);
			}
		}
		return o + i + o;
	}
	function i() {
		return "$";
	}
}
// node_modules/.bun/micromark-extension-gfm-autolink-literal@2.1.0/node_modules/micromark-extension-gfm-autolink-literal/lib/syntax.js
var Ds = {
	tokenize: Vs,
	partial: !0
}, Os = {
	tokenize: Hs,
	partial: !0
}, ks = {
	tokenize: Us,
	partial: !0
}, As = {
	tokenize: Ws,
	partial: !0
}, js = {
	tokenize: Gs,
	partial: !0
}, Ms = {
	name: "wwwAutolink",
	tokenize: zs,
	previous: Ks
}, Ns = {
	name: "protocolAutolink",
	tokenize: Bs,
	previous: qs
}, Ps = {
	name: "emailAutolink",
	tokenize: Rs,
	previous: Js
}, Fs = {};
function Is() {
	return { text: Fs };
}
for (var Ls = 48; Ls < 123;) Fs[Ls] = Ps, Ls++, Ls === 58 ? Ls = 65 : Ls === 91 && (Ls = 97);
Fs[43] = Ps, Fs[45] = Ps, Fs[46] = Ps, Fs[95] = Ps, Fs[72] = [Ps, Ns], Fs[104] = [Ps, Ns], Fs[87] = [Ps, Ms], Fs[119] = [Ps, Ms];
function Rs(e, t, n) {
	let r = this, i, o;
	return s;
	function s(t) {
		return !Ys(t) || !Js.call(r, r.previous) || Xs(r.events) ? n(t) : (e.enter("literalAutolink"), e.enter("literalAutolinkEmail"), c(t));
	}
	function c(t) {
		return Ys(t) ? (e.consume(t), c) : t === 64 ? (e.consume(t), l) : n(t);
	}
	function l(t) {
		return t === 46 ? e.check(js, d, u)(t) : t === 45 || t === 95 || a(t) ? (o = !0, e.consume(t), l) : d(t);
	}
	function u(t) {
		return e.consume(t), i = !0, l;
	}
	function d(a) {
		return o && i && _(r.previous) ? (e.exit("literalAutolinkEmail"), e.exit("literalAutolink"), t(a)) : n(a);
	}
}
function zs(e, t, n) {
	let r = this;
	return i;
	function i(t) {
		return t !== 87 && t !== 119 || !Ks.call(r, r.previous) || Xs(r.events) ? n(t) : (e.enter("literalAutolink"), e.enter("literalAutolinkWww"), e.check(Ds, e.attempt(Os, e.attempt(ks, a), n), n)(t));
	}
	function a(n) {
		return e.exit("literalAutolinkWww"), e.exit("literalAutolink"), t(n);
	}
}
function Bs(e, n, r) {
	let i = this, a = "", c = !1;
	return l;
	function l(t) {
		return (t === 72 || t === 104) && qs.call(i, i.previous) && !Xs(i.events) ? (e.enter("literalAutolink"), e.enter("literalAutolinkHttp"), a += String.fromCodePoint(t), e.consume(t), u) : r(t);
	}
	function u(t) {
		if (_(t) && a.length < 5) return a += String.fromCodePoint(t), e.consume(t), u;
		if (t === 58) {
			let n = a.toLowerCase();
			if (n === "http" || n === "https") return e.consume(t), f;
		}
		return r(t);
	}
	function f(t) {
		return t === 47 ? (e.consume(t), c ? p : (c = !0, f)) : r(t);
	}
	function p(n) {
		return n === null || o(n) || d(n) || t(n) || s(n) ? r(n) : e.attempt(Os, e.attempt(ks, m), r)(n);
	}
	function m(t) {
		return e.exit("literalAutolinkHttp"), e.exit("literalAutolink"), n(t);
	}
}
function Vs(e, t, n) {
	let r = 0;
	return i;
	function i(t) {
		return (t === 87 || t === 119) && r < 3 ? (r++, e.consume(t), i) : t === 46 && r === 3 ? (e.consume(t), a) : n(t);
	}
	function a(e) {
		return e === null ? n(e) : t(e);
	}
}
function Hs(e, n, r) {
	let i, a, o;
	return c;
	function c(n) {
		return n === 46 || n === 95 ? e.check(As, u, l)(n) : n === null || d(n) || t(n) || n !== 45 && s(n) ? u(n) : (o = !0, e.consume(n), c);
	}
	function l(t) {
		return t === 95 ? i = !0 : (a = i, i = void 0), e.consume(t), c;
	}
	function u(e) {
		return a || i || !o ? r(e) : n(e);
	}
}
function Us(e, n) {
	let r = 0, i = 0;
	return a;
	function a(s) {
		return s === 40 ? (r++, e.consume(s), a) : s === 41 && i < r ? o(s) : s === 33 || s === 34 || s === 38 || s === 39 || s === 41 || s === 42 || s === 44 || s === 46 || s === 58 || s === 59 || s === 60 || s === 63 || s === 93 || s === 95 || s === 126 ? e.check(As, n, o)(s) : s === null || d(s) || t(s) ? n(s) : (e.consume(s), a);
	}
	function o(t) {
		return t === 41 && i++, e.consume(t), a;
	}
}
function Ws(e, n, r) {
	return i;
	function i(s) {
		return s === 33 || s === 34 || s === 39 || s === 41 || s === 42 || s === 44 || s === 46 || s === 58 || s === 59 || s === 63 || s === 95 || s === 126 ? (e.consume(s), i) : s === 38 ? (e.consume(s), o) : s === 93 ? (e.consume(s), a) : s === 60 || s === null || d(s) || t(s) ? n(s) : r(s);
	}
	function a(e) {
		return e === null || e === 40 || e === 91 || d(e) || t(e) ? n(e) : i(e);
	}
	function o(e) {
		return _(e) ? s(e) : r(e);
	}
	function s(t) {
		return t === 59 ? (e.consume(t), i) : _(t) ? (e.consume(t), s) : r(t);
	}
}
function Gs(e, t, n) {
	return r;
	function r(t) {
		return e.consume(t), i;
	}
	function i(e) {
		return a(e) ? n(e) : t(e);
	}
}
function Ks(e) {
	return e === null || e === 40 || e === 42 || e === 95 || e === 91 || e === 93 || e === 126 || d(e);
}
function qs(e) {
	return !_(e);
}
function Js(e) {
	return !(e === 47 || Ys(e));
}
function Ys(e) {
	return e === 43 || e === 45 || e === 46 || e === 95 || a(e);
}
function Xs(e) {
	let t = e.length, n = !1;
	for (; t--;) {
		let r = e[t][1];
		if ((r.type === "labelLink" || r.type === "labelImage") && !r._balanced) {
			n = !0;
			break;
		}
		if (r._gfmAutolinkLiteralWalkedInto) {
			n = !1;
			break;
		}
	}
	return e.length > 0 && !n && (e[e.length - 1][1]._gfmAutolinkLiteralWalkedInto = !0), n;
}
// node_modules/.bun/micromark-extension-gfm-footnote@2.1.0/node_modules/micromark-extension-gfm-footnote/lib/syntax.js
var Zs = {
	tokenize: ac,
	partial: !0
};
function Qs() {
	return {
		document: { 91: {
			name: "gfmFootnoteDefinition",
			tokenize: nc,
			continuation: { tokenize: rc },
			exit: ic
		} },
		text: {
			91: {
				name: "gfmFootnoteCall",
				tokenize: tc
			},
			93: {
				name: "gfmPotentialFootnoteCall",
				add: "after",
				tokenize: $s,
				resolveTo: ec
			}
		}
	};
}
function $s(e, t, n) {
	let r = this, i = r.events.length, a = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []), o;
	for (; i--;) {
		let e = r.events[i][1];
		if (e.type === "labelImage") {
			o = e;
			break;
		}
		if (e.type === "gfmFootnoteCall" || e.type === "labelLink" || e.type === "label" || e.type === "image" || e.type === "link") break;
	}
	return s;
	function s(i) {
		if (!o || !o._balanced) return n(i);
		let s = v(r.sliceSerialize({
			start: o.end,
			end: r.now()
		}));
		return s.codePointAt(0) !== 94 || !a.includes(s.slice(1)) ? n(i) : (e.enter("gfmFootnoteCallLabelMarker"), e.consume(i), e.exit("gfmFootnoteCallLabelMarker"), t(i));
	}
}
function ec(e, t) {
	let n = e.length;
	for (; n--;) if (e[n][1].type === "labelImage" && e[n][0] === "enter") {
		e[n][1];
		break;
	}
	e[n + 1][1].type = "data", e[n + 3][1].type = "gfmFootnoteCallLabelMarker";
	let r = {
		type: "gfmFootnoteCall",
		start: Object.assign({}, e[n + 3][1].start),
		end: Object.assign({}, e[e.length - 1][1].end)
	}, i = {
		type: "gfmFootnoteCallMarker",
		start: Object.assign({}, e[n + 3][1].end),
		end: Object.assign({}, e[n + 3][1].end)
	};
	i.end.column++, i.end.offset++, i.end._bufferIndex++;
	let a = {
		type: "gfmFootnoteCallString",
		start: Object.assign({}, i.end),
		end: Object.assign({}, e[e.length - 1][1].start)
	}, o = {
		type: "chunkString",
		contentType: "string",
		start: Object.assign({}, a.start),
		end: Object.assign({}, a.end)
	}, s = [
		e[n + 1],
		e[n + 2],
		[
			"enter",
			r,
			t
		],
		e[n + 3],
		e[n + 4],
		[
			"enter",
			i,
			t
		],
		[
			"exit",
			i,
			t
		],
		[
			"enter",
			a,
			t
		],
		[
			"enter",
			o,
			t
		],
		[
			"exit",
			o,
			t
		],
		[
			"exit",
			a,
			t
		],
		e[e.length - 2],
		e[e.length - 1],
		[
			"exit",
			r,
			t
		]
	];
	return e.splice(n, e.length - n + 1, ...s), e;
}
function tc(e, t, n) {
	let r = this, i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []), a = 0, o;
	return s;
	function s(t) {
		return e.enter("gfmFootnoteCall"), e.enter("gfmFootnoteCallLabelMarker"), e.consume(t), e.exit("gfmFootnoteCallLabelMarker"), c;
	}
	function c(t) {
		return t === 94 ? (e.enter("gfmFootnoteCallMarker"), e.consume(t), e.exit("gfmFootnoteCallMarker"), e.enter("gfmFootnoteCallString"), e.enter("chunkString").contentType = "string", l) : n(t);
	}
	function l(s) {
		if (a > 999 || s === 93 && !o || s === null || s === 91 || d(s)) return n(s);
		if (s === 93) {
			e.exit("chunkString");
			let a = e.exit("gfmFootnoteCallString");
			return i.includes(v(r.sliceSerialize(a))) ? (e.enter("gfmFootnoteCallLabelMarker"), e.consume(s), e.exit("gfmFootnoteCallLabelMarker"), e.exit("gfmFootnoteCall"), t) : n(s);
		}
		return d(s) || (o = !0), a++, e.consume(s), s === 92 ? u : l;
	}
	function u(t) {
		return t === 91 || t === 92 || t === 93 ? (e.consume(t), a++, l) : l(t);
	}
}
function nc(e, t, n) {
	let r = this, i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []), a, o = 0, s;
	return c;
	function c(t) {
		return e.enter("gfmFootnoteDefinition")._container = !0, e.enter("gfmFootnoteDefinitionLabel"), e.enter("gfmFootnoteDefinitionLabelMarker"), e.consume(t), e.exit("gfmFootnoteDefinitionLabelMarker"), l;
	}
	function l(t) {
		return t === 94 ? (e.enter("gfmFootnoteDefinitionMarker"), e.consume(t), e.exit("gfmFootnoteDefinitionMarker"), e.enter("gfmFootnoteDefinitionLabelString"), e.enter("chunkString").contentType = "string", f) : n(t);
	}
	function f(t) {
		if (o > 999 || t === 93 && !s || t === null || t === 91 || d(t)) return n(t);
		if (t === 93) {
			e.exit("chunkString");
			let n = e.exit("gfmFootnoteDefinitionLabelString");
			return a = v(r.sliceSerialize(n)), e.enter("gfmFootnoteDefinitionLabelMarker"), e.consume(t), e.exit("gfmFootnoteDefinitionLabelMarker"), e.exit("gfmFootnoteDefinitionLabel"), m;
		}
		return d(t) || (s = !0), o++, e.consume(t), t === 92 ? p : f;
	}
	function p(t) {
		return t === 91 || t === 92 || t === 93 ? (e.consume(t), o++, f) : f(t);
	}
	function m(t) {
		return t === 58 ? (e.enter("definitionMarker"), e.consume(t), e.exit("definitionMarker"), i.includes(a) || i.push(a), u(e, h, "gfmFootnoteDefinitionWhitespace")) : n(t);
	}
	function h(e) {
		return t(e);
	}
}
function rc(e, t, n) {
	return e.check(p, t, e.attempt(Zs, t, n));
}
function ic(e) {
	e.exit("gfmFootnoteDefinition");
}
function ac(e, t, n) {
	let r = this;
	return u(e, i, "gfmFootnoteDefinitionIndent", 5);
	function i(e) {
		let i = r.events[r.events.length - 1];
		return i && i[1].type === "gfmFootnoteDefinitionIndent" && i[2].sliceSerialize(i[1], !0).length === 4 ? t(e) : n(e);
	}
}
// node_modules/.bun/micromark-extension-gfm-strikethrough@2.1.0/node_modules/micromark-extension-gfm-strikethrough/lib/syntax.js
function oc(e) {
	let t = (e || {}).singleTilde, n = {
		name: "strikethrough",
		tokenize: o,
		resolveAll: a
	};
	return t ??= !0, {
		text: { 126: n },
		insideSpan: { null: [n] },
		attentionMarkers: { null: [126] }
	};
	function a(e, t) {
		let n = -1;
		for (; ++n < e.length;) if (e[n][0] === "enter" && e[n][1].type === "strikethroughSequenceTemporary" && e[n][1]._close) {
			let i = n;
			for (; i--;) if (e[i][0] === "exit" && e[i][1].type === "strikethroughSequenceTemporary" && e[i][1]._open && e[n][1].end.offset - e[n][1].start.offset === e[i][1].end.offset - e[i][1].start.offset) {
				e[n][1].type = "strikethroughSequence", e[i][1].type = "strikethroughSequence";
				let a = {
					type: "strikethrough",
					start: Object.assign({}, e[i][1].start),
					end: Object.assign({}, e[n][1].end)
				}, o = {
					type: "strikethroughText",
					start: Object.assign({}, e[i][1].end),
					end: Object.assign({}, e[n][1].start)
				}, s = [
					[
						"enter",
						a,
						t
					],
					[
						"enter",
						e[i][1],
						t
					],
					[
						"exit",
						e[i][1],
						t
					],
					[
						"enter",
						o,
						t
					]
				], c = t.parser.constructs.insideSpan.null;
				c && r(s, s.length, 0, g(c, e.slice(i + 1, n), t)), r(s, s.length, 0, [
					[
						"exit",
						o,
						t
					],
					[
						"enter",
						e[n][1],
						t
					],
					[
						"exit",
						e[n][1],
						t
					],
					[
						"exit",
						a,
						t
					]
				]), r(e, i - 1, n - i + 3, s), n = i + s.length - 2;
				break;
			}
		}
		for (n = -1; ++n < e.length;) e[n][1].type === "strikethroughSequenceTemporary" && (e[n][1].type = "data");
		return e;
	}
	function o(e, n, r) {
		let a = this.previous, o = this.events, s = 0;
		return c;
		function c(t) {
			return a === 126 && o[o.length - 1][1].type !== "characterEscape" ? r(t) : (e.enter("strikethroughSequenceTemporary"), l(t));
		}
		function l(o) {
			let c = i(a);
			if (o === 126) return s > 1 ? r(o) : (e.consume(o), s++, l);
			if (s < 2 && !t) return r(o);
			let u = e.exit("strikethroughSequenceTemporary"), d = i(o);
			return u._open = !d || d === 2 && !!c, u._close = !c || c === 2 && !!d, n(o);
		}
	}
}
// node_modules/.bun/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/edit-map.js
var sc = class {
	constructor() {
		this.map = [];
	}
	add(e, t, n) {
		cc(this, e, t, n);
	}
	consume(e) {
		/* c8 ignore next 3 -- `resolve` is never called without tables, so without edits. */
		if (this.map.sort(function(e, t) {
			return e[0] - t[0];
		}), this.map.length === 0) return;
		let t = this.map.length, n = [];
		for (; t > 0;) --t, n.push(e.slice(this.map[t][0] + this.map[t][1]), this.map[t][2]), e.length = this.map[t][0];
		n.push(e.slice()), e.length = 0;
		let r = n.pop();
		for (; r;) {
			for (let t of r) e.push(t);
			r = n.pop();
		}
		this.map.length = 0;
	}
};
function cc(e, t, n, r) {
	let i = 0;
	/* c8 ignore next 3 -- `resolve` is never called without tables, so without edits. */
	if (n !== 0 || r.length !== 0) {
		for (; i < e.map.length;) {
			if (e.map[i][0] === t) {
				e.map[i][1] += n, e.map[i][2].push(...r);
				return;
			}
			i += 1;
		}
		e.map.push([
			t,
			n,
			r
		]);
	}
}
// node_modules/.bun/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/infer.js
function lc(e, t) {
	let n = !1, r = [];
	for (; t < e.length;) {
		let i = e[t];
		if (n) {
			if (i[0] === "enter") i[1].type === "tableContent" && r.push(e[t + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
			else if (i[1].type === "tableContent") {
				if (e[t - 1][1].type === "tableDelimiterMarker") {
					let e = r.length - 1;
					r[e] = r[e] === "left" ? "center" : "right";
				}
			} else if (i[1].type === "tableDelimiterRow") break;
		} else i[0] === "enter" && i[1].type === "tableDelimiterRow" && (n = !0);
		t += 1;
	}
	return r;
}
// node_modules/.bun/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/syntax.js
function uc() {
	return { flow: { null: {
		name: "table",
		tokenize: dc,
		resolveAll: fc
	} } };
}
function dc(e, t, n) {
	let r = this, i = 0, a = 0, o;
	return s;
	function s(e) {
		let t = r.events.length - 1;
		for (; t > -1;) {
			let e = r.events[t][1].type;
			if (e === "lineEnding" || e === "linePrefix") t--;
			else break;
		}
		let i = t > -1 ? r.events[t][1].type : null, a = i === "tableHead" || i === "tableRow" ? ae : l;
		return a === ae && r.parser.lazy[r.now().line] ? n(e) : a(e);
	}
	function l(t) {
		return e.enter("tableHead"), e.enter("tableRow"), f(t);
	}
	function f(e) {
		return e === 124 || (o = !0, a += 1), p(e);
	}
	function p(t) {
		return t === null ? n(t) : m(t) ? a > 1 ? (a = 0, r.interrupt = !0, e.exit("tableRow"), e.enter("lineEnding"), e.consume(t), e.exit("lineEnding"), ee) : n(t) : c(t) ? u(e, p, "whitespace")(t) : (a += 1, o && (o = !1, i += 1), t === 124 ? (e.enter("tableCellDivider"), e.consume(t), e.exit("tableCellDivider"), o = !0, p) : (e.enter("data"), h(t)));
	}
	function h(t) {
		return t === null || t === 124 || d(t) ? (e.exit("data"), p(t)) : (e.consume(t), t === 92 ? g : h);
	}
	function g(t) {
		return t === 92 || t === 124 ? (e.consume(t), h) : h(t);
	}
	function ee(t) {
		return r.interrupt = !1, r.parser.lazy[r.now().line] ? n(t) : (e.enter("tableDelimiterRow"), o = !1, c(t) ? u(e, _, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(t) : _(t));
	}
	function _(t) {
		return t === 45 || t === 58 ? y(t) : t === 124 ? (o = !0, e.enter("tableCellDivider"), e.consume(t), e.exit("tableCellDivider"), v) : ie(t);
	}
	function v(t) {
		return c(t) ? u(e, y, "whitespace")(t) : y(t);
	}
	function y(t) {
		return t === 58 ? (a += 1, o = !0, e.enter("tableDelimiterMarker"), e.consume(t), e.exit("tableDelimiterMarker"), te) : t === 45 ? (a += 1, te(t)) : t === null || m(t) ? re(t) : ie(t);
	}
	function te(t) {
		return t === 45 ? (e.enter("tableDelimiterFiller"), b(t)) : ie(t);
	}
	function b(t) {
		return t === 45 ? (e.consume(t), b) : t === 58 ? (o = !0, e.exit("tableDelimiterFiller"), e.enter("tableDelimiterMarker"), e.consume(t), e.exit("tableDelimiterMarker"), ne) : (e.exit("tableDelimiterFiller"), ne(t));
	}
	function ne(t) {
		return c(t) ? u(e, re, "whitespace")(t) : re(t);
	}
	function re(n) {
		return n === 124 ? _(n) : n === null || m(n) ? !o || i !== a ? ie(n) : (e.exit("tableDelimiterRow"), e.exit("tableHead"), t(n)) : ie(n);
	}
	function ie(e) {
		return n(e);
	}
	function ae(t) {
		return e.enter("tableRow"), oe(t);
	}
	function oe(n) {
		return n === 124 ? (e.enter("tableCellDivider"), e.consume(n), e.exit("tableCellDivider"), oe) : n === null || m(n) ? (e.exit("tableRow"), t(n)) : c(n) ? u(e, oe, "whitespace")(n) : (e.enter("data"), x(n));
	}
	function x(t) {
		return t === null || t === 124 || d(t) ? (e.exit("data"), oe(t)) : (e.consume(t), t === 92 ? se : x);
	}
	function se(t) {
		return t === 92 || t === 124 ? (e.consume(t), x) : x(t);
	}
}
function fc(e, t) {
	let n = -1, r = !0, i = 0, a = [
		0,
		0,
		0,
		0
	], o = [
		0,
		0,
		0,
		0
	], s = !1, c = 0, l, u, d, f = new sc();
	for (; ++n < e.length;) {
		let p = e[n], m = p[1];
		p[0] === "enter" ? m.type === "tableHead" ? (s = !1, c !== 0 && (mc(f, t, c, l, u), u = void 0, c = 0), l = {
			type: "table",
			start: Object.assign({}, m.start),
			end: Object.assign({}, m.end)
		}, f.add(n, 0, [[
			"enter",
			l,
			t
		]])) : m.type === "tableRow" || m.type === "tableDelimiterRow" ? (r = !0, d = void 0, a = [
			0,
			0,
			0,
			0
		], o = [
			0,
			n + 1,
			0,
			0
		], s && (s = !1, u = {
			type: "tableBody",
			start: Object.assign({}, m.start),
			end: Object.assign({}, m.end)
		}, f.add(n, 0, [[
			"enter",
			u,
			t
		]])), i = m.type === "tableDelimiterRow" ? 2 : u ? 3 : 1) : i && (m.type === "data" || m.type === "tableDelimiterMarker" || m.type === "tableDelimiterFiller") ? (r = !1, o[2] === 0 && (a[1] !== 0 && (o[0] = o[1], d = pc(f, t, a, i, void 0, d), a = [
			0,
			0,
			0,
			0
		]), o[2] = n)) : m.type === "tableCellDivider" && (r ? r = !1 : (a[1] !== 0 && (o[0] = o[1], d = pc(f, t, a, i, void 0, d)), a = o, o = [
			a[1],
			n,
			0,
			0
		])) : m.type === "tableHead" ? (s = !0, c = n) : m.type === "tableRow" || m.type === "tableDelimiterRow" ? (c = n, a[1] === 0 ? o[1] !== 0 && (d = pc(f, t, o, i, n, d)) : (o[0] = o[1], d = pc(f, t, a, i, n, d)), i = 0) : i && (m.type === "data" || m.type === "tableDelimiterMarker" || m.type === "tableDelimiterFiller") && (o[3] = n);
	}
	for (c !== 0 && mc(f, t, c, l, u), f.consume(t.events), n = -1; ++n < t.events.length;) {
		let e = t.events[n];
		e[0] === "enter" && e[1].type === "table" && (e[1]._align = lc(t.events, n));
	}
	return e;
}
function pc(e, t, n, r, i, a) {
	let o = r === 1 ? "tableHeader" : r === 2 ? "tableDelimiter" : "tableData";
	n[0] !== 0 && (a.end = Object.assign({}, hc(t.events, n[0])), e.add(n[0], 0, [[
		"exit",
		a,
		t
	]]));
	let s = hc(t.events, n[1]);
	if (a = {
		type: o,
		start: Object.assign({}, s),
		end: Object.assign({}, s)
	}, e.add(n[1], 0, [[
		"enter",
		a,
		t
	]]), n[2] !== 0) {
		let i = hc(t.events, n[2]), a = hc(t.events, n[3]), o = {
			type: "tableContent",
			start: Object.assign({}, i),
			end: Object.assign({}, a)
		};
		if (e.add(n[2], 0, [[
			"enter",
			o,
			t
		]]), r !== 2) {
			let r = t.events[n[2]], i = t.events[n[3]];
			if (r[1].end = Object.assign({}, i[1].end), r[1].type = "chunkText", r[1].contentType = "text", n[3] > n[2] + 1) {
				let t = n[2] + 1, r = n[3] - n[2] - 1;
				e.add(t, r, []);
			}
		}
		e.add(n[3] + 1, 0, [[
			"exit",
			o,
			t
		]]);
	}
	return i !== void 0 && (a.end = Object.assign({}, hc(t.events, i)), e.add(i, 0, [[
		"exit",
		a,
		t
	]]), a = void 0), a;
}
function mc(e, t, n, r, i) {
	let a = [], o = hc(t.events, n);
	i && (i.end = Object.assign({}, o), a.push([
		"exit",
		i,
		t
	])), r.end = Object.assign({}, o), a.push([
		"exit",
		r,
		t
	]), e.add(n + 1, 0, a);
}
function hc(e, t) {
	let n = e[t], r = n[0] === "enter" ? "start" : "end";
	return n[1][r];
}
// node_modules/.bun/micromark-extension-gfm-task-list-item@2.1.0/node_modules/micromark-extension-gfm-task-list-item/lib/syntax.js
var gc = {
	name: "tasklistCheck",
	tokenize: vc
};
function _c() {
	return { text: { 91: gc } };
}
function vc(e, t, n) {
	let r = this;
	return i;
	function i(t) {
		return r.previous !== null || !r._gfmTasklistFirstContentOfListItem ? n(t) : (e.enter("taskListCheck"), e.enter("taskListCheckMarker"), e.consume(t), e.exit("taskListCheckMarker"), a);
	}
	function a(t) {
		return d(t) ? (e.enter("taskListCheckValueUnchecked"), e.consume(t), e.exit("taskListCheckValueUnchecked"), o) : t === 88 || t === 120 ? (e.enter("taskListCheckValueChecked"), e.consume(t), e.exit("taskListCheckValueChecked"), o) : n(t);
	}
	function o(t) {
		return t === 93 ? (e.enter("taskListCheckMarker"), e.consume(t), e.exit("taskListCheckMarker"), e.exit("taskListCheck"), s) : n(t);
	}
	function s(r) {
		return m(r) ? t(r) : c(r) ? e.check({ tokenize: yc }, t, n)(r) : n(r);
	}
}
function yc(e, t, n) {
	return u(e, r, "whitespace");
	function r(e) {
		return e === null ? n(e) : t(e);
	}
}
// node_modules/.bun/micromark-extension-gfm@3.0.0/node_modules/micromark-extension-gfm/index.js
function bc(e) {
	return te([
		Is(),
		Qs(),
		oc(e),
		uc(),
		_c()
	]);
}
// node_modules/.bun/micromark-extension-math@3.1.0/node_modules/micromark-extension-math/lib/math-flow.js
var xc = {
	tokenize: Cc,
	concrete: !0,
	name: "mathFlow"
}, Sc = {
	tokenize: wc,
	partial: !0
};
function Cc(e, t, n) {
	let r = this, i = r.events[r.events.length - 1], a = i && i[1].type === "linePrefix" ? i[2].sliceSerialize(i[1], !0).length : 0, o = 0;
	return s;
	function s(t) {
		return e.enter("mathFlow"), e.enter("mathFlowFence"), e.enter("mathFlowFenceSequence"), c(t);
	}
	function c(t) {
		return t === 36 ? (e.consume(t), o++, c) : o < 2 ? n(t) : (e.exit("mathFlowFenceSequence"), u(e, l, "whitespace")(t));
	}
	function l(t) {
		return t === null || m(t) ? f(t) : (e.enter("mathFlowFenceMeta"), e.enter("chunkString", { contentType: "string" }), d(t));
	}
	function d(t) {
		return t === null || m(t) ? (e.exit("chunkString"), e.exit("mathFlowFenceMeta"), f(t)) : t === 36 ? n(t) : (e.consume(t), d);
	}
	function f(n) {
		return e.exit("mathFlowFence"), r.interrupt ? t(n) : e.attempt(Sc, p, _)(n);
	}
	function p(t) {
		return e.attempt({
			tokenize: v,
			partial: !0
		}, _, h)(t);
	}
	function h(t) {
		return (a ? u(e, g, "linePrefix", a + 1) : g)(t);
	}
	function g(t) {
		return t === null ? _(t) : m(t) ? e.attempt(Sc, p, _)(t) : (e.enter("mathFlowValue"), ee(t));
	}
	function ee(t) {
		return t === null || m(t) ? (e.exit("mathFlowValue"), g(t)) : (e.consume(t), ee);
	}
	function _(n) {
		return e.exit("mathFlow"), t(n);
	}
	function v(e, t, n) {
		let i = 0;
		return u(e, a, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
		function a(t) {
			return e.enter("mathFlowFence"), e.enter("mathFlowFenceSequence"), s(t);
		}
		function s(t) {
			return t === 36 ? (i++, e.consume(t), s) : i < o ? n(t) : (e.exit("mathFlowFenceSequence"), u(e, c, "whitespace")(t));
		}
		function c(r) {
			return r === null || m(r) ? (e.exit("mathFlowFence"), t(r)) : n(r);
		}
	}
}
function wc(e, t, n) {
	let r = this;
	return i;
	function i(n) {
		return n === null ? t(n) : (e.enter("lineEnding"), e.consume(n), e.exit("lineEnding"), a);
	}
	function a(e) {
		return r.parser.lazy[r.now().line] ? n(e) : t(e);
	}
}
// node_modules/.bun/micromark-extension-math@3.1.0/node_modules/micromark-extension-math/lib/math-text.js
function Tc(e) {
	let t = (e || {}).singleDollarTextMath;
	return t ??= !0, {
		tokenize: n,
		resolve: Ec,
		previous: Dc,
		name: "mathText"
	};
	function n(e, n, r) {
		let i = 0, a, o;
		return s;
		function s(t) {
			return e.enter("mathText"), e.enter("mathTextSequence"), c(t);
		}
		function c(n) {
			return n === 36 ? (e.consume(n), i++, c) : i < 2 && !t ? r(n) : (e.exit("mathTextSequence"), l(n));
		}
		function l(t) {
			return t === null ? r(t) : t === 36 ? (o = e.enter("mathTextSequence"), a = 0, d(t)) : t === 32 ? (e.enter("space"), e.consume(t), e.exit("space"), l) : m(t) ? (e.enter("lineEnding"), e.consume(t), e.exit("lineEnding"), l) : (e.enter("mathTextData"), u(t));
		}
		function u(t) {
			return t === null || t === 32 || t === 36 || m(t) ? (e.exit("mathTextData"), l(t)) : (e.consume(t), u);
		}
		function d(t) {
			return t === 36 ? (e.consume(t), a++, d) : a === i ? (e.exit("mathTextSequence"), e.exit("mathText"), n(t)) : (o.type = "mathTextData", u(t));
		}
	}
}
function Ec(e) {
	let t = e.length - 4, n = 3, r, i;
	if ((e[n][1].type === "lineEnding" || e[n][1].type === "space") && (e[t][1].type === "lineEnding" || e[t][1].type === "space")) {
		for (r = n; ++r < t;) if (e[r][1].type === "mathTextData") {
			e[t][1].type = "mathTextPadding", e[n][1].type = "mathTextPadding", n += 2, t -= 2;
			break;
		}
	}
	for (r = n - 1, t++; ++r <= t;) i === void 0 ? r !== t && e[r][1].type !== "lineEnding" && (i = r) : (r === t || e[r][1].type === "lineEnding") && (e[i][1].type = "mathTextData", r !== i + 2 && (e[i][1].end = e[r - 1][1].end, e.splice(i + 2, r - i - 2), t -= r - i - 2, r = i + 2), i = void 0);
	return e;
}
function Dc(e) {
	return e !== 36 || this.events[this.events.length - 1][1].type === "characterEscape";
}
// node_modules/.bun/micromark-extension-math@3.1.0/node_modules/micromark-extension-math/lib/syntax.js
function Oc(e) {
	return {
		flow: { 36: xc },
		text: { 36: Tc(e) }
	};
}
// packages/ui/src/components/rich-text/shared/markdown-ast.ts
var kc = {
	extensions: [bc(), Oc()],
	mdastExtensions: [Cs(), Ts()]
}, Ac = {
	bullet: "-",
	emphasis: "*",
	extensions: [ws(), Es()],
	fence: "`",
	fences: !0,
	listItemIndent: "one",
	rule: "-",
	strong: "*"
}, jc = (e) => e.match(/^ {0,3}(`{3,}|~{3,})/), Mc = (e) => {
	let t = null, n = "";
	for (let r = 0; r < e.length;) {
		if (e[r] === "`") {
			let i = r;
			for (; e[i] === "`";) i += 1;
			let a = i - r;
			t === null ? t = a : t === a && (t = null), n += e.slice(r, i), r = i;
			continue;
		}
		let i = e.slice(r, r + 2);
		t === null && (i === "\\(" || i === "\\)") ? (n += "$", r += 2) : t === null && (i === "\\[" || i === "\\]") ? (n += "$$", r += 2) : (n += e[r], r += 1);
	}
	return n;
}, Nc = (e) => {
	let t = null, n = [];
	for (let r of e.split("\n")) {
		if (t) {
			n.push(r);
			let e = r.match(/^ {0,3}(`+|~+)[ \t]*$/)?.[1];
			e?.[0] === t.character && e.length >= t.length && (t = null);
			continue;
		}
		let e = jc(r)?.[1];
		if (e) {
			t = {
				character: e[0] ?? "`",
				length: e.length
			}, n.push(r);
			continue;
		}
		let i = r.match(/^( {0,3})\\\[\s*(.*?)\s*\\\][ \t]*$/);
		if (i) {
			let e = i[1] ?? "";
			n.push(`${e}$$`, i[2] ?? "", `${e}$$`);
		} else /^ {0,3}\\\[[ \t]*$/.test(r) ? n.push(r.replace("\\[", () => "$$")) : /^ {0,3}\\\][ \t]*$/.test(r) ? n.push(r.replace("\\]", () => "$$")) : n.push(Mc(r));
	}
	return n.join("\n");
}, Pc = (e) => l(Nc(e), kc), Fc = (e) => l(e, kc), Ic = (e) => ns(e, Ac).trimEnd(), Lc = (e) => Ic({
	type: "root",
	children: [e]
}), Rc = (e) => Lc({
	type: "paragraph",
	children: e
}), zc = (e) => {
	let t = Pc(e).children[0];
	return t?.type === "paragraph" || t?.type === "heading" ? t.children : [];
}, Bc = Bt(void 0), Vc = (e) => {
	let { children: t, resolver: n } = e;
	return /* @__PURE__ */ z(Bc.Provider, {
		value: n,
		children: t
	});
}, Hc = () => Ut(Bc), Uc = (e) => {
	let { source: t, alt: n, title: r, onLoad: i } = e, a = Hc(), o = re(), s = un(mn(), t, o), [c, l] = Gt(), u = s ?? rn(t, "image", a), d = u ?? (c?.source === t && c.handler === o && c.value ? rn(c.value, "image") : null);
	return R(() => {
		if (u || !o?.resolveImageSource) return;
		let e = !0;
		return o.resolveImageSource(t).catch(() => null).then((n) => {
			e && l({
				source: t,
				handler: o,
				value: n
			});
		}), () => {
			e = !1;
		};
	}, [
		u,
		t,
		o
	]), d ? /* @__PURE__ */ z(Yt, {
		src: d,
		alt: n,
		title: r ?? void 0,
		loading: "lazy",
		referrerPolicy: "no-referrer",
		onLoad: i
	}) : /* @__PURE__ */ z(Kt, {
		as: "span",
		display: "inline-block",
		paddingX: "xs",
		paddingY: "2xs",
		background: "bg.muted",
		borderRadius: "sm",
		children: /* @__PURE__ */ z(Zt, {
			as: "span",
			textStyle: "label/S/regular",
			color: "fg.muted",
			children: n || "Image"
		})
	});
}, Wc = class e extends Qe {
	__source;
	__alt;
	__title;
	static getType() {
		return "markdown-image";
	}
	static clone(t) {
		return new e(t.__source, t.__alt, t.__title, t.__key);
	}
	constructor(e, t, n = null, r) {
		super(r), this.__source = e, this.__alt = t, this.__title = n;
	}
	createDOM() {
		return document.createElement("span");
	}
	updateDOM() {
		return !1;
	}
	isInline() {
		return !0;
	}
	getSource() {
		return this.__source;
	}
	getAlt() {
		return this.__alt;
	}
	getTitle() {
		return this.__title;
	}
	getTextContent() {
		return this.__alt;
	}
	exportJSON() {
		return {
			type: "markdown-image",
			version: 1,
			source: this.__source,
			alt: this.__alt,
			title: this.__title
		};
	}
	static importJSON(e) {
		return Gc(e.source, e.alt, e.title);
	}
	decorate(e) {
		return /* @__PURE__ */ z(Uc, {
			source: this.__source,
			alt: this.__alt,
			title: this.__title,
			onLoad: () => {
				if (!e.isEditable()) return;
				let t = null;
				e.getEditorState().read(() => {
					let e = k(), n = mt(this.getKey());
					if (!M(e) || !e.isCollapsed() || !n) return;
					let r = (n.getTopLevelElement()?.getNextSibling())?.getKey(), i = e.anchor.getNode().getTopLevelElement();
					r && r === i?.getKey() && (t = r);
				});
				let n = t;
				n && requestAnimationFrame(() => {
					e.getElementByKey(n)?.scrollIntoView({ block: "end" });
				});
			}
		});
	}
}, Gc = (e, t, n = null) => S(new Wc(e, t, n)), Kc = (e) => e instanceof Wc;
// node_modules/.bun/dompurify@3.4.13/node_modules/dompurify/dist/purify.es.mjs
function qc(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Jc(e) {
	if (Array.isArray(e)) return e;
}
function Yc(e, t) {
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
function Xc() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Zc(e, t) {
	return Jc(e) || Yc(e, t) || Qc(e, t) || Xc();
}
function Qc(e, t) {
	if (e) {
		if (typeof e == "string") return qc(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? qc(e, t) : void 0;
	}
}
var $c = Object.entries, el = Object.setPrototypeOf, tl = Object.isFrozen, nl = Object.getPrototypeOf, rl = Object.getOwnPropertyDescriptor, K = Object.freeze, q = Object.seal, il = Object.create, al = typeof Reflect < "u" && Reflect, ol = al.apply, sl = al.construct;
K ||= function(e) {
	return e;
}, q ||= function(e) {
	return e;
}, ol ||= function(e, t) {
	var n = [...arguments].slice(2);
	return e.apply(t, n);
}, sl ||= function(e) {
	return new e(...[...arguments].slice(1));
};
var cl = X(Array.prototype.forEach), ll = X(Array.prototype.lastIndexOf), ul = X(Array.prototype.pop), dl = X(Array.prototype.push), fl = X(Array.prototype.splice), pl = Array.isArray, ml = X(String.prototype.toLowerCase), hl = X(String.prototype.toString), gl = X(String.prototype.match), _l = X(String.prototype.replace), vl = X(String.prototype.indexOf), yl = X(String.prototype.trim), bl = X(Number.prototype.toString), xl = X(Boolean.prototype.toString), Sl = typeof BigInt > "u" ? null : X(BigInt.prototype.toString), Cl = typeof Symbol > "u" ? null : X(Symbol.prototype.toString), J = X(Object.prototype.hasOwnProperty), wl = X(Object.prototype.toString), Y = X(RegExp.prototype.test), Tl = El(TypeError);
function X(e) {
	return function(t) {
		t instanceof RegExp && (t.lastIndex = 0);
		var n = [...arguments].slice(1);
		return ol(e, t, n);
	};
}
function El(e) {
	return function() {
		return sl(e, [...arguments]);
	};
}
function Z(e, t) {
	let n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : ml;
	if (el && el(e, null), !pl(t)) return e;
	let r = t.length;
	for (; r--;) {
		let i = t[r];
		if (typeof i == "string") {
			let e = n(i);
			e !== i && (tl(t) || (t[r] = e), i = e);
		}
		e[i] = !0;
	}
	return e;
}
function Dl(e) {
	for (let t = 0; t < e.length; t++) J(e, t) || (e[t] = null);
	return e;
}
function Q(e) {
	let t = il(null);
	for (let r of $c(e)) {
		var n = Zc(r, 2);
		let i = n[0], a = n[1];
		J(e, i) && (t[i] = pl(a) ? Dl(a) : a && typeof a == "object" && a.constructor === Object ? Q(a) : a);
	}
	return t;
}
function Ol(e) {
	switch (typeof e) {
		case "string": return e;
		case "number": return bl(e);
		case "boolean": return xl(e);
		case "bigint": return Sl ? Sl(e) : "0";
		case "symbol": return Cl ? Cl(e) : "Symbol()";
		case "undefined": return wl(e);
		case "function":
		case "object": {
			if (e === null) return wl(e);
			let t = e, n = kl(t, "toString");
			if (typeof n == "function") {
				let e = n(t);
				return typeof e == "string" ? e : wl(e);
			}
			return wl(e);
		}
		default: return wl(e);
	}
}
function kl(e, t) {
	for (; e !== null;) {
		let n = rl(e, t);
		if (n) {
			if (n.get) return X(n.get);
			if (typeof n.value == "function") return X(n.value);
		}
		e = nl(e);
	}
	function n() {
		return null;
	}
	return n;
}
function Al(e) {
	try {
		return Y(e, ""), !0;
	} catch {
		return !1;
	}
}
var jl = K(/* @__PURE__ */ "a.abbr.acronym.address.area.article.aside.audio.b.bdi.bdo.big.blink.blockquote.body.br.button.canvas.caption.center.cite.code.col.colgroup.content.data.datalist.dd.decorator.del.details.dfn.dialog.dir.div.dl.dt.element.em.fieldset.figcaption.figure.font.footer.form.h1.h2.h3.h4.h5.h6.head.header.hgroup.hr.html.i.img.input.ins.kbd.label.legend.li.main.map.mark.marquee.menu.menuitem.meter.nav.nobr.ol.optgroup.option.output.p.picture.pre.progress.q.rp.rt.ruby.s.samp.search.section.select.shadow.slot.small.source.spacer.span.strike.strong.style.sub.summary.sup.table.tbody.td.template.textarea.tfoot.th.thead.time.tr.track.tt.u.ul.var.video.wbr".split(".")), Ml = K(/* @__PURE__ */ "svg.a.altglyph.altglyphdef.altglyphitem.animatecolor.animatemotion.animatetransform.circle.clippath.defs.desc.ellipse.enterkeyhint.exportparts.filter.font.g.glyph.glyphref.hkern.image.inputmode.line.lineargradient.marker.mask.metadata.mpath.part.path.pattern.polygon.polyline.radialgradient.rect.stop.style.switch.symbol.text.textpath.title.tref.tspan.view.vkern".split(".")), Nl = K([
	"feBlend",
	"feColorMatrix",
	"feComponentTransfer",
	"feComposite",
	"feConvolveMatrix",
	"feDiffuseLighting",
	"feDisplacementMap",
	"feDistantLight",
	"feDropShadow",
	"feFlood",
	"feFuncA",
	"feFuncB",
	"feFuncG",
	"feFuncR",
	"feGaussianBlur",
	"feImage",
	"feMerge",
	"feMergeNode",
	"feMorphology",
	"feOffset",
	"fePointLight",
	"feSpecularLighting",
	"feSpotLight",
	"feTile",
	"feTurbulence"
]), Pl = K([
	"animate",
	"color-profile",
	"cursor",
	"discard",
	"font-face",
	"font-face-format",
	"font-face-name",
	"font-face-src",
	"font-face-uri",
	"foreignobject",
	"hatch",
	"hatchpath",
	"mesh",
	"meshgradient",
	"meshpatch",
	"meshrow",
	"missing-glyph",
	"script",
	"set",
	"solidcolor",
	"unknown",
	"use"
]), Fl = K(/* @__PURE__ */ "math.menclose.merror.mfenced.mfrac.mglyph.mi.mlabeledtr.mmultiscripts.mn.mo.mover.mpadded.mphantom.mroot.mrow.ms.mspace.msqrt.mstyle.msub.msup.msubsup.mtable.mtd.mtext.mtr.munder.munderover.mprescripts".split(".")), Il = K([
	"maction",
	"maligngroup",
	"malignmark",
	"mlongdiv",
	"mscarries",
	"mscarry",
	"msgroup",
	"mstack",
	"msline",
	"msrow",
	"semantics",
	"annotation",
	"annotation-xml",
	"mprescripts",
	"none"
]), Ll = K(["#text"]), Rl = K(/* @__PURE__ */ "accept.action.align.alt.autocapitalize.autocomplete.autopictureinpicture.autoplay.background.bgcolor.border.capture.cellpadding.cellspacing.checked.cite.class.clear.color.cols.colspan.command.commandfor.controls.controlslist.coords.crossorigin.datetime.decoding.default.dir.disabled.disablepictureinpicture.disableremoteplayback.download.draggable.enctype.enterkeyhint.exportparts.face.for.headers.height.hidden.high.href.hreflang.id.inert.inputmode.integrity.ismap.kind.label.lang.list.loading.loop.low.max.maxlength.media.method.min.minlength.multiple.muted.name.nonce.noshade.novalidate.nowrap.open.optimum.part.pattern.placeholder.playsinline.popover.popovertarget.popovertargetaction.poster.preload.pubdate.radiogroup.readonly.rel.required.rev.reversed.role.rows.rowspan.spellcheck.scope.selected.shape.size.sizes.slot.span.srclang.start.src.srcset.step.style.summary.tabindex.title.translate.type.usemap.valign.value.width.wrap.xmlns".split(".")), zl = K(/* @__PURE__ */ "accent-height.accumulate.additive.alignment-baseline.amplitude.ascent.attributename.attributetype.azimuth.basefrequency.baseline-shift.begin.bias.by.class.clip.clippathunits.clip-path.clip-rule.color.color-interpolation.color-interpolation-filters.color-profile.color-rendering.cx.cy.d.dx.dy.diffuseconstant.direction.display.divisor.dominant-baseline.dur.edgemode.elevation.end.exponent.fill.fill-opacity.fill-rule.filter.filterunits.flood-color.flood-opacity.font-family.font-size.font-size-adjust.font-stretch.font-style.font-variant.font-weight.fx.fy.g1.g2.glyph-name.glyphref.gradientunits.gradienttransform.height.href.id.image-rendering.in.in2.intercept.k.k1.k2.k3.k4.kerning.keypoints.keysplines.keytimes.lang.lengthadjust.letter-spacing.kernelmatrix.kernelunitlength.lighting-color.local.marker-end.marker-mid.marker-start.markerheight.markerunits.markerwidth.maskcontentunits.maskunits.max.mask.mask-type.media.method.mode.min.name.numoctaves.offset.operator.opacity.order.orient.orientation.origin.overflow.paint-order.path.pathlength.patterncontentunits.patterntransform.patternunits.points.preservealpha.preserveaspectratio.primitiveunits.r.rx.ry.radius.refx.refy.repeatcount.repeatdur.restart.result.rotate.scale.seed.shape-rendering.slope.specularconstant.specularexponent.spreadmethod.startoffset.stddeviation.stitchtiles.stop-color.stop-opacity.stroke-dasharray.stroke-dashoffset.stroke-linecap.stroke-linejoin.stroke-miterlimit.stroke-opacity.stroke.stroke-width.style.surfacescale.systemlanguage.tabindex.tablevalues.targetx.targety.transform.transform-origin.text-anchor.text-decoration.text-orientation.text-rendering.textlength.type.u1.u2.unicode.values.viewbox.visibility.version.vert-adv-y.vert-origin-x.vert-origin-y.width.word-spacing.wrap.writing-mode.xchannelselector.ychannelselector.x.x1.x2.xmlns.y.y1.y2.z.zoomandpan".split(".")), Bl = K(/* @__PURE__ */ "accent.accentunder.align.bevelled.close.columnalign.columnlines.columnspacing.columnspan.denomalign.depth.dir.display.displaystyle.encoding.fence.frame.height.href.id.largeop.length.linethickness.lquote.lspace.mathbackground.mathcolor.mathsize.mathvariant.maxsize.minsize.movablelimits.notation.numalign.open.rowalign.rowlines.rowspacing.rowspan.rspace.rquote.scriptlevel.scriptminsize.scriptsizemultiplier.selection.separator.separators.stretchy.subscriptshift.supscriptshift.symmetric.voffset.width.xmlns".split(".")), Vl = K([
	"xlink:href",
	"xml:id",
	"xlink:title",
	"xml:space",
	"xmlns:xlink"
]), Hl = q(/{{[\w\W]*|^[\w\W]*}}/g), Ul = q(/<%[\w\W]*|^[\w\W]*%>/g), Wl = q(/\${[\w\W]*/g), Gl = q(/^data-[\-\w.\u00B7-\uFFFF]+$/), Kl = q(/^aria-[\-\w]+$/), ql = q(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i), Jl = q(/^(?:\w+script|data):/i), Yl = q(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g), Xl = q(/^html$/i), Zl = q(/^[a-z][.\w]*(-[.\w]+)+$/i), Ql = q(/<[/\w!]/g), $l = q(/<[/\w]/g), eu = q(/<\/no(script|embed|frames)/i), tu = q(/\/>/i), $ = {
	element: 1,
	attribute: 2,
	text: 3,
	cdataSection: 4,
	entityReference: 5,
	entityNode: 6,
	processingInstruction: 7,
	comment: 8,
	document: 9,
	documentType: 10,
	documentFragment: 11,
	notation: 12
}, nu = function() {
	return typeof window > "u" ? null : window;
}, ru = function(e, t) {
	if (typeof e != "object" || typeof e.createPolicy != "function") return null;
	let n = null, r = "data-tt-policy-suffix";
	t && t.hasAttribute(r) && (n = t.getAttribute(r));
	let i = "dompurify" + (n ? "#" + n : "");
	try {
		return e.createPolicy(i, {
			createHTML(e) {
				return e;
			},
			createScriptURL(e) {
				return e;
			}
		});
	} catch {
		return console.warn("TrustedTypes policy " + i + " could not be created."), null;
	}
}, iu = function() {
	return {
		afterSanitizeAttributes: [],
		afterSanitizeElements: [],
		afterSanitizeShadowDOM: [],
		beforeSanitizeAttributes: [],
		beforeSanitizeElements: [],
		beforeSanitizeShadowDOM: [],
		uponSanitizeAttribute: [],
		uponSanitizeElement: [],
		uponSanitizeShadowNode: []
	};
}, au = function(e, t, n, r) {
	return J(e, t) && pl(e[t]) ? Z(r.base ? Q(r.base) : {}, e[t], r.transform) : n;
};
function ou() {
	let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : nu(), t = (e) => ou(e);
	if (t.version = "3.4.13", t.removed = [], !e || !e.document || e.document.nodeType !== $.document || !e.Element) return t.isSupported = !1, t;
	let n = e.document, r = n, i = r.currentScript;
	e.DocumentFragment;
	let a = e.HTMLTemplateElement, o = e.Node, s = e.Element, c = e.NodeFilter;
	e.NamedNodeMap === void 0 && (e.NamedNodeMap || e.MozNamedAttrMap), e.HTMLFormElement;
	let l = e.DOMParser, u = e.trustedTypes, d = s.prototype, f = kl(d, "cloneNode"), p = kl(d, "remove"), m = kl(d, "nextSibling"), h = kl(d, "childNodes"), g = kl(d, "parentNode"), ee = kl(d, "shadowRoot"), _ = kl(d, "attributes"), v = o && o.prototype ? kl(o.prototype, "nodeType") : null, y = o && o.prototype ? kl(o.prototype, "nodeName") : null, te = o && o.prototype ? kl(o.prototype, "ownerDocument") : null;
	if (typeof a == "function") {
		let e = n.createElement("template");
		e.content && e.content.ownerDocument && (n = e.content.ownerDocument);
	}
	let b, ne = "", re, ie = !1, ae = 0, oe = function() {
		if (ae > 0) throw Tl("A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the \"DOMPurify and Trusted Types\" section of the README.");
	}, x = function(e) {
		oe(), ae++;
		try {
			return b.createHTML(e);
		} finally {
			ae--;
		}
	}, se = function(e) {
		oe(), ae++;
		try {
			return b.createScriptURL(e);
		} finally {
			ae--;
		}
	}, ce = function() {
		return ie ||= (re = ru(u, i), !0), re;
	}, le = n, ue = le.implementation, de = le.createNodeIterator, fe = le.createDocumentFragment, pe = le.getElementsByTagName, S = r.importNode, C = iu();
	t.isSupported = typeof $c == "function" && typeof g == "function" && ue && ue.createHTMLDocument !== void 0;
	let me = Hl, he = Ul, ge = Wl, _e = Gl, ve = Kl, ye = Jl, be = Yl, xe = Zl, Se = ql, w = null, Ce = Z({}, [
		...jl,
		...Ml,
		...Nl,
		...Fl,
		...Ll
	]), T = null, we = Z({}, [
		...Rl,
		...zl,
		...Bl,
		...Vl
	]), E = Object.seal(il(null, {
		tagNameCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		attributeNameCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		allowCustomizedBuiltInElements: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: !1
		}
	})), Te = null, Ee = null, De = Object.seal(il(null, {
		tagCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		attributeCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		}
	})), Oe = !0, ke = !0, Ae = !1, je = !0, Me = !1, D = !0, O = !1, k = !1, Ne = null, Pe = null, Fe = !1, Ie = !1, Le = !1, Re = !1, ze = !0, Be = !1, Ve = "user-content-", He = !0, Ue = !1, We = {}, Ge = null, Ke = Z({}, /* @__PURE__ */ "annotation-xml.audio.colgroup.desc.foreignobject.head.iframe.math.mi.mn.mo.ms.mtext.noembed.noframes.noscript.plaintext.script.selectedcontent.style.svg.template.thead.title.video.xmp".split(".")), qe = null, Je = Z({}, [
		"audio",
		"video",
		"img",
		"source",
		"image",
		"track"
	]), Ye = null, Xe = Z({}, [
		"alt",
		"class",
		"for",
		"id",
		"label",
		"name",
		"pattern",
		"placeholder",
		"role",
		"summary",
		"title",
		"value",
		"style",
		"xmlns"
	]), Ze = "http://www.w3.org/1998/Math/MathML", Qe = "http://www.w3.org/2000/svg", A = "http://www.w3.org/1999/xhtml", j = A, $e = !1, et = null, tt = Z({}, [
		Ze,
		Qe,
		A
	], hl), nt = K([
		"mi",
		"mo",
		"mn",
		"ms",
		"mtext"
	]), rt = Z({}, nt), it = K(["annotation-xml"]), at = Z({}, it), M = Z({}, [
		"title",
		"style",
		"font",
		"a",
		"script"
	]), ot = null, st = ["application/xhtml+xml", "text/html"], N = null, ct = null, lt = n.createElement("form"), ut = function(e) {
		return e instanceof RegExp || e instanceof Function;
	}, dt = function() {
		let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
		if (ct && ct === e) return;
		e && typeof e == "object" || (e = {}), e = Q(e), ot = st.indexOf(e.PARSER_MEDIA_TYPE) === -1 ? "text/html" : e.PARSER_MEDIA_TYPE, N = ot === "application/xhtml+xml" ? hl : ml, w = au(e, "ALLOWED_TAGS", Ce, { transform: N }), T = au(e, "ALLOWED_ATTR", we, { transform: N }), et = au(e, "ALLOWED_NAMESPACES", tt, { transform: hl }), Ye = au(e, "ADD_URI_SAFE_ATTR", Xe, {
			transform: N,
			base: Xe
		}), qe = au(e, "ADD_DATA_URI_TAGS", Je, {
			transform: N,
			base: Je
		}), Ge = au(e, "FORBID_CONTENTS", Ke, { transform: N }), Te = au(e, "FORBID_TAGS", Q({}), { transform: N }), Ee = au(e, "FORBID_ATTR", Q({}), { transform: N }), We = J(e, "USE_PROFILES") ? e.USE_PROFILES && typeof e.USE_PROFILES == "object" ? Q(e.USE_PROFILES) : e.USE_PROFILES : !1, Oe = e.ALLOW_ARIA_ATTR !== !1, ke = e.ALLOW_DATA_ATTR !== !1, Ae = e.ALLOW_UNKNOWN_PROTOCOLS || !1, je = e.ALLOW_SELF_CLOSE_IN_ATTR !== !1, Me = e.SAFE_FOR_TEMPLATES || !1, D = e.SAFE_FOR_XML !== !1, O = e.WHOLE_DOCUMENT || !1, Ie = e.RETURN_DOM || !1, Le = e.RETURN_DOM_FRAGMENT || !1, Re = e.RETURN_TRUSTED_TYPE || !1, Fe = e.FORCE_BODY || !1, ze = e.SANITIZE_DOM !== !1, Be = e.SANITIZE_NAMED_PROPS || !1, He = e.KEEP_CONTENT !== !1, Ue = e.IN_PLACE || !1, Se = Al(e.ALLOWED_URI_REGEXP) ? e.ALLOWED_URI_REGEXP : ql, j = typeof e.NAMESPACE == "string" ? e.NAMESPACE : A, rt = J(e, "MATHML_TEXT_INTEGRATION_POINTS") && e.MATHML_TEXT_INTEGRATION_POINTS && typeof e.MATHML_TEXT_INTEGRATION_POINTS == "object" ? Q(e.MATHML_TEXT_INTEGRATION_POINTS) : Z({}, nt), at = J(e, "HTML_INTEGRATION_POINTS") && e.HTML_INTEGRATION_POINTS && typeof e.HTML_INTEGRATION_POINTS == "object" ? Q(e.HTML_INTEGRATION_POINTS) : Z({}, it);
		let t = J(e, "CUSTOM_ELEMENT_HANDLING") && e.CUSTOM_ELEMENT_HANDLING && typeof e.CUSTOM_ELEMENT_HANDLING == "object" ? Q(e.CUSTOM_ELEMENT_HANDLING) : il(null);
		if (E = il(null), J(t, "tagNameCheck") && ut(t.tagNameCheck) && (E.tagNameCheck = t.tagNameCheck), J(t, "attributeNameCheck") && ut(t.attributeNameCheck) && (E.attributeNameCheck = t.attributeNameCheck), J(t, "allowCustomizedBuiltInElements") && typeof t.allowCustomizedBuiltInElements == "boolean" && (E.allowCustomizedBuiltInElements = t.allowCustomizedBuiltInElements), q(E), Me && (ke = !1), Le && (Ie = !0), We && (w = Z({}, Ll), T = il(null), We.html === !0 && (Z(w, jl), Z(T, Rl)), We.svg === !0 && (Z(w, Ml), Z(T, zl), Z(T, Vl)), We.svgFilters === !0 && (Z(w, Nl), Z(T, zl), Z(T, Vl)), We.mathMl === !0 && (Z(w, Fl), Z(T, Bl), Z(T, Vl))), De.tagCheck = null, De.attributeCheck = null, J(e, "ADD_TAGS") && (typeof e.ADD_TAGS == "function" ? De.tagCheck = e.ADD_TAGS : pl(e.ADD_TAGS) && (w === Ce && (w = Q(w)), Z(w, e.ADD_TAGS, N))), J(e, "ADD_ATTR") && (typeof e.ADD_ATTR == "function" ? De.attributeCheck = e.ADD_ATTR : pl(e.ADD_ATTR) && (T === we && (T = Q(T)), Z(T, e.ADD_ATTR, N))), J(e, "ADD_URI_SAFE_ATTR") && pl(e.ADD_URI_SAFE_ATTR) && Z(Ye, e.ADD_URI_SAFE_ATTR, N), J(e, "FORBID_CONTENTS") && pl(e.FORBID_CONTENTS) && (Ge === Ke && (Ge = Q(Ge)), Z(Ge, e.FORBID_CONTENTS, N)), J(e, "ADD_FORBID_CONTENTS") && pl(e.ADD_FORBID_CONTENTS) && (Ge === Ke && (Ge = Q(Ge)), Z(Ge, e.ADD_FORBID_CONTENTS, N)), He && (w["#text"] = !0), O && Z(w, [
			"html",
			"head",
			"body"
		]), w.table && (Z(w, ["tbody"]), delete Te.tbody), e.TRUSTED_TYPES_POLICY) {
			if (typeof e.TRUSTED_TYPES_POLICY.createHTML != "function") throw Tl("TRUSTED_TYPES_POLICY configuration option must provide a \"createHTML\" hook.");
			if (typeof e.TRUSTED_TYPES_POLICY.createScriptURL != "function") throw Tl("TRUSTED_TYPES_POLICY configuration option must provide a \"createScriptURL\" hook.");
			let t = b;
			b = e.TRUSTED_TYPES_POLICY;
			try {
				ne = x("");
			} catch (e) {
				throw b = t, e;
			}
		} else e.TRUSTED_TYPES_POLICY === null ? (b = void 0, ne = "") : (b === void 0 && (b = ce()), b && typeof ne == "string" && (ne = x("")));
		K && K(e), ct = e;
	}, ft = Z({}, [
		...Ml,
		...Nl,
		...Pl
	]), P = Z({}, [...Fl, ...Il]), pt = function(e, t, n) {
		return t.namespaceURI === A ? e === "svg" : t.namespaceURI === Ze ? e === "svg" && (n === "annotation-xml" || rt[n]) : !!ft[e];
	}, mt = function(e, t, n) {
		return t.namespaceURI === A ? e === "math" : t.namespaceURI === Qe ? e === "math" && at[n] : !!P[e];
	}, ht = function(e, t, n) {
		return t.namespaceURI === Qe && !at[n] || t.namespaceURI === Ze && !rt[n] ? !1 : !P[e] && (M[e] || !ft[e]);
	}, gt = function(e) {
		let t = g(e);
		t && t.tagName || (t = {
			namespaceURI: j,
			tagName: "template"
		});
		let n = ml(e.tagName), r = ml(t.tagName);
		return et[e.namespaceURI] ? e.namespaceURI === Qe ? pt(n, t, r) : e.namespaceURI === Ze ? mt(n, t, r) : e.namespaceURI === A ? ht(n, t, r) : !!(ot === "application/xhtml+xml" && et[e.namespaceURI]) : !1;
	}, _t = function(e) {
		dl(t.removed, { element: e });
		try {
			g(e).removeChild(e);
		} catch {
			if (p(e), !g(e)) throw Tl("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
		}
	}, vt = function(e) {
		xt(e);
		let t = h(e);
		if (t) {
			let e = [];
			cl(t, (t) => {
				dl(e, t);
			}), cl(e, (e) => {
				try {
					p(e);
				} catch {}
			});
		}
		let n = _(e);
		if (n) for (let t = n.length - 1; t >= 0; --t) {
			let r = n[t], i = r && r.name;
			if (typeof i == "string") try {
				e.removeAttribute(i);
			} catch {}
		}
	}, yt = function(e, n) {
		try {
			dl(t.removed, {
				attribute: n.getAttributeNode(e),
				from: n
			});
		} catch {
			dl(t.removed, {
				attribute: null,
				from: n
			});
		}
		if (n.removeAttribute(e), e === "is") {
			if (Ie || Le) try {
				_t(n);
			} catch {}
			else try {
				n.setAttribute(e, "");
			} catch {}
		}
	}, bt = function(e) {
		let t = _(e);
		if (t) for (let n = t.length - 1; n >= 0; --n) {
			let r = t[n], i = r && r.name;
			if (!(typeof i != "string" || T[N(i)])) try {
				e.removeAttribute(i);
			} catch {}
		}
	}, xt = function(e) {
		let t = [e];
		for (; t.length > 0;) {
			let e = t.pop();
			(v ? v(e) : e.nodeType) === $.element && bt(e);
			let n = h(e);
			if (n) for (let e = n.length - 1; e >= 0; --e) t.push(n[e]);
		}
	}, St = function(e) {
		if (!D) return;
		let t = [e];
		for (; t.length > 0;) {
			let e = t.pop(), n = v ? v(e) : e.nodeType;
			if (n === $.processingInstruction || n === $.comment && Y($l, e.data)) {
				try {
					p(e);
				} catch {}
				continue;
			}
			if (n === $.element) {
				let t = e, n = N(y ? y(e) : e.nodeName);
				try {
					t.hasAttribute && t.hasAttribute("patchsrc") && t.removeAttribute("patchsrc"), t.hasAttribute && t.hasAttribute("for") && n !== "label" && n !== "output" && t.removeAttribute("for");
				} catch {}
			}
			let r = h(e);
			if (r) for (let e = r.length - 1; e >= 0; --e) t.push(r[e]);
		}
	}, Ct = function(e) {
		let t = null, r = null;
		if (Fe) e = "<remove></remove>" + e;
		else {
			let t = gl(e, /^[\r\n\t ]+/);
			r = t && t[0];
		}
		ot === "application/xhtml+xml" && j === A && (e = "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head></head><body>" + e + "</body></html>");
		let i = b ? x(e) : e;
		if (j === A) try {
			t = new l().parseFromString(i, ot);
		} catch {}
		if (!t || !t.documentElement) {
			t = ue.createDocument(j, "template", null);
			try {
				t.documentElement.innerHTML = $e ? ne : i;
			} catch {}
		}
		let a = t.body || t.documentElement;
		return e && r && a.insertBefore(n.createTextNode(r), a.childNodes[0] || null), j === A ? pe.call(t, O ? "html" : "body")[0] : O ? t.documentElement : a;
	}, wt = function(e) {
		let t = te ? te(e) : e.ownerDocument;
		return de.call(t || e, e, c.SHOW_ELEMENT | c.SHOW_COMMENT | c.SHOW_TEXT | c.SHOW_PROCESSING_INSTRUCTION | c.SHOW_CDATA_SECTION, null);
	}, Tt = function(e) {
		return e = _l(e, me, " "), e = _l(e, he, " "), e = _l(e, ge, " "), e;
	}, Et = function(e) {
		e.normalize();
		let t = te ? te(e) : e.ownerDocument, n = de.call(t || e, e, c.SHOW_TEXT | c.SHOW_COMMENT | c.SHOW_CDATA_SECTION | c.SHOW_PROCESSING_INSTRUCTION, null), r = n.nextNode();
		for (; r;) r.data = Tt(r.data), r = n.nextNode();
		let i = e.querySelectorAll?.call(e, "template");
		i && cl(i, (e) => {
			I(e.content) && Et(e.content);
		});
	}, F = function(e) {
		let t = y ? y(e) : null;
		return typeof t != "string" || N(t) !== "form" ? !1 : typeof e.nodeName != "string" || typeof e.textContent != "string" || typeof e.removeChild != "function" || e.attributes !== _(e) || typeof e.removeAttribute != "function" || typeof e.setAttribute != "function" || typeof e.namespaceURI != "string" || typeof e.insertBefore != "function" || typeof e.hasChildNodes != "function" || e.nodeType !== v(e) || e.childNodes !== h(e);
	}, I = function(e) {
		if (!v || typeof e != "object" || !e) return !1;
		try {
			return v(e) === $.documentFragment;
		} catch {
			return !1;
		}
	}, Dt = function(e) {
		if (!v || typeof e != "object" || !e) return !1;
		try {
			return typeof v(e) == "number";
		} catch {
			return !1;
		}
	};
	function L(e, n, r) {
		e.length !== 0 && cl(e, (e) => {
			e.call(t, n, r, ct);
		});
	}
	let Ot = function(e, t) {
		return !!(D && e.hasChildNodes() && !Dt(e.firstElementChild) && Y(Ql, e.textContent) && Y(Ql, e.innerHTML) || D && e.namespaceURI === A && t === "style" && Dt(e.firstElementChild) || e.nodeType === $.processingInstruction || D && e.nodeType === $.comment && Y($l, e.data));
	}, kt = function(e, t, n) {
		if (!Te[t] && Pt(t) && (E.tagNameCheck instanceof RegExp && Y(E.tagNameCheck, t) || E.tagNameCheck instanceof Function && E.tagNameCheck(t))) return !1;
		if (He && !Ge[t]) {
			let t = g(e), r = h(e);
			if (r && t) {
				let i = r.length;
				for (let a = i - 1; a >= 0; --a) {
					let i = e === n ? f(r[a], !0) : r[a];
					t.insertBefore(i, m(e));
				}
			}
		}
		return _t(e), !0;
	}, At = function(e, t, n, r) {
		return e.length === 0 ? t : t === n || t === r ? Q(t) : t;
	}, jt = function(e, n) {
		if (L(C.beforeSanitizeElements, e, null), e !== n && g(e) === null) return Ue && xt(e), !0;
		if (F(e)) return _t(e), !0;
		let r = N(y ? y(e) : e.nodeName);
		if (w = At(C.uponSanitizeElement, w, Ce, Ne), L(C.uponSanitizeElement, e, {
			tagName: r,
			allowedTags: w
		}), e !== n && g(e) === null) return Ue && xt(e), !0;
		if (Ot(e, r)) return _t(e), !0;
		if (Te[r] || !(De.tagCheck instanceof Function && De.tagCheck(r)) && !w[r]) {
			let t = kt(e, r, n);
			return t === !1 && L(C.afterSanitizeElements, e, null), t;
		}
		if ((v ? v(e) : e.nodeType) === $.element && !gt(e) || (r === "noscript" || r === "noembed" || r === "noframes") && Y(eu, e.innerHTML)) return _t(e), !0;
		if (Me && e.nodeType === $.text) {
			let n = Tt(e.textContent);
			e.textContent !== n && (dl(t.removed, { element: e.cloneNode() }), e.textContent = n);
		}
		return L(C.afterSanitizeElements, e, null), !1;
	}, Mt = function(e, t, r) {
		if (Ee[t] || D && t === "patchsrc" || D && t === "for" && e !== "label" && e !== "output" || ze && (t === "id" || t === "name") && (r in n || r in lt)) return !1;
		let i = T[t] || De.attributeCheck instanceof Function && De.attributeCheck(t, e);
		if (!(ke && Y(_e, t)) && !(Oe && Y(ve, t))) {
			if (!i) {
				if (!(Pt(e) && (E.tagNameCheck instanceof RegExp && Y(E.tagNameCheck, e) || E.tagNameCheck instanceof Function && E.tagNameCheck(e)) && (E.attributeNameCheck instanceof RegExp && Y(E.attributeNameCheck, t) || E.attributeNameCheck instanceof Function && E.attributeNameCheck(t, e)) || t === "is" && E.allowCustomizedBuiltInElements && (E.tagNameCheck instanceof RegExp && Y(E.tagNameCheck, r) || E.tagNameCheck instanceof Function && E.tagNameCheck(r)))) return !1;
			} else if (!Ye[t] && !Y(Se, _l(r, be, "")) && (t !== "src" && t !== "xlink:href" && t !== "href" || e === "script" || vl(r, "data:") !== 0 || !qe[e]) && (!Ae || Y(ye, _l(r, be, ""))) && r) return !1;
		}
		return !0;
	}, Nt = Z({}, [
		"annotation-xml",
		"color-profile",
		"font-face",
		"font-face-format",
		"font-face-name",
		"font-face-src",
		"font-face-uri",
		"missing-glyph"
	]), Pt = function(e) {
		return !Nt[ml(e)] && Y(xe, e);
	}, Ft = function(e, t, n, r) {
		if (b && typeof u == "object" && typeof u.getAttributeType == "function" && !n) switch (u.getAttributeType(e, t)) {
			case "TrustedHTML": return x(r);
			case "TrustedScriptURL": return se(r);
		}
		return r;
	}, It = function(e, n, r, i) {
		try {
			r ? e.setAttributeNS(r, n, i) : e.setAttribute(n, i), F(e) ? _t(e) : ul(t.removed);
		} catch {
			yt(n, e);
		}
	}, Lt = function(e) {
		L(C.beforeSanitizeAttributes, e, null);
		let t = e.attributes;
		if (!t || F(e)) return;
		T = At(C.uponSanitizeAttribute, T, we, Pe);
		let n = {
			attrName: "",
			attrValue: "",
			keepAttr: !0,
			allowedAttributes: T,
			forceKeepAttr: void 0
		}, r = t.length, i = N(e.nodeName);
		for (; r--;) {
			let a = t[r], o = a.name, s = a.namespaceURI, c = a.value, l = N(o), u = c, d = o === "value" ? u : yl(u);
			n.attrName = l, n.attrValue = d, n.keepAttr = !0, n.forceKeepAttr = void 0, L(C.uponSanitizeAttribute, e, n), d = n.attrValue, Be && (l === "id" || l === "name") && vl(d, Ve) !== 0 && (yt(o, e), d = Ve + d), D && Y(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, d) || l === "attributename" && gl(d, "href") ? yt(o, e) : n.forceKeepAttr || (n.keepAttr ? !je && Y(tu, d) ? yt(o, e) : (Me && (d = Tt(d)), Mt(i, l, d) ? (d = Ft(i, l, s, d), d !== u && It(e, o, s, d)) : yt(o, e)) : yt(o, e));
		}
		L(C.afterSanitizeAttributes, e, null);
	}, Rt = function(e) {
		let t = null, n = wt(e);
		for (L(C.beforeSanitizeShadowDOM, e, null); t = n.nextNode();) if (L(C.uponSanitizeShadowNode, t, null), jt(t, e), Lt(t), I(t.content) && Rt(t.content), (v ? v(t) : t.nodeType) === $.element) {
			let e = ee(t);
			I(e) && (zt(e), Rt(e));
		}
		L(C.afterSanitizeShadowDOM, e, null);
	}, zt = function(e) {
		let t = [{
			node: e,
			shadow: null
		}];
		for (; t.length > 0;) {
			let e = t.pop();
			if (e.shadow) {
				Rt(e.shadow);
				continue;
			}
			let n = e.node, r = (v ? v(n) : n.nodeType) === $.element, i = h(n);
			if (i) for (let e = i.length - 1; e >= 0; --e) t.push({
				node: i[e],
				shadow: null
			});
			if (r) {
				let e = y ? y(n) : null;
				if (typeof e == "string" && N(e) === "template") {
					let e = n.content;
					I(e) && t.push({
						node: e,
						shadow: null
					});
				}
			}
			if (r) {
				let e = ee(n);
				I(e) && t.push({
					node: null,
					shadow: e
				}, {
					node: e,
					shadow: null
				});
			}
		}
	};
	return t.sanitize = function(e) {
		let n = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, i = null, a = null, o = null, s = null;
		if ($e = !e, $e && (e = "<!-->"), typeof e != "string" && !Dt(e) && (e = Ol(e), typeof e != "string")) throw Tl("dirty is not a string, aborting");
		if (!t.isSupported) return e;
		k ? (w = Ne, T = Pe) : dt(n), (C.uponSanitizeElement.length > 0 || C.uponSanitizeAttribute.length > 0) && (w = Q(w)), C.uponSanitizeAttribute.length > 0 && (T = Q(T)), t.removed = [];
		let c = Ue && typeof e != "string" && Dt(e);
		if (c) {
			St(e);
			let t = y ? y(e) : e.nodeName;
			if (typeof t == "string") {
				let n = N(t);
				if (!w[n] || Te[n]) throw vt(e), Tl("root node is forbidden and cannot be sanitized in-place");
			}
			if (F(e)) throw vt(e), Tl("root node is clobbered and cannot be sanitized in-place");
			try {
				zt(e);
			} catch (t) {
				throw vt(e), t;
			}
		} else if (Dt(e)) i = Ct("<!---->"), a = i.ownerDocument.importNode(e, !0), a.nodeType === $.element && a.nodeName === "BODY" || a.nodeName === "HTML" ? i = a : i.appendChild(a), zt(a);
		else {
			if (!Ie && !Me && !O && e.indexOf("<") === -1) return b && Re ? x(e) : e;
			if (i = Ct(e), !i) return Ie ? null : Re ? ne : "";
		}
		i && Fe && _t(i.firstChild);
		let l = c ? e : i;
		try {
			let e = wt(l);
			for (; o = e.nextNode();) jt(o, l), Lt(o), I(o.content) && Rt(o.content);
		} catch (n) {
			throw c && (vt(e), cl(t.removed, (e) => {
				e.element && xt(e.element);
			})), n;
		}
		if (c) return cl(t.removed, (e) => {
			e.element && xt(e.element);
		}), Me && Et(e), e;
		if (Ie) {
			if (Me && Et(i), Le) for (s = fe.call(i.ownerDocument); i.firstChild;) s.appendChild(i.firstChild);
			else s = i;
			return (T.shadowroot || T.shadowrootmode) && (s = S.call(r, s, !0)), s;
		}
		let u = O ? i.outerHTML : i.innerHTML;
		return O && w["!doctype"] && i.ownerDocument && i.ownerDocument.doctype && i.ownerDocument.doctype.name && Y(Xl, i.ownerDocument.doctype.name) && (u = "<!DOCTYPE " + i.ownerDocument.doctype.name + ">\n" + u), Me && (u = Tt(u)), b && Re ? x(u) : u;
	}, t.setConfig = function() {
		let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
		dt(e), k = !0, Ne = w, Pe = T;
	}, t.clearConfig = function() {
		ct = null, k = !1, Ne = null, Pe = null, b = re, ne = "";
	}, t.isValidAttribute = function(e, t, n) {
		ct || dt({});
		let r = N(e), i = N(t);
		return Mt(r, i, n);
	}, t.addHook = function(e, t) {
		typeof t == "function" && J(C, e) && dl(C[e], t);
	}, t.removeHook = function(e, t) {
		if (J(C, e)) {
			if (t !== void 0) {
				let n = ll(C[e], t);
				return n === -1 ? void 0 : fl(C[e], n, 1)[0];
			}
			return ul(C[e]);
		}
	}, t.removeHooks = function(e) {
		J(C, e) && (C[e] = []);
	}, t.removeAllHooks = function() {
		C = iu();
	}, t;
}
var su = ou(), cu = (e) => /^<!--[\s\S]*-->$/.test(e.trim()), lu = (e, t) => {
	if (typeof document > "u") return null;
	let n = su.sanitize(e, { FORBID_TAGS: [
		"script",
		"style",
		"iframe",
		"object",
		"embed",
		"form",
		"input",
		"button",
		"textarea",
		"select"
	] }), r = document.createElement("template");
	r.innerHTML = n;
	for (let e of r.content.querySelectorAll("[href], [src]")) {
		let n = e.hasAttribute("href") ? "href" : "src", r = n === "href" ? "link" : "image", i = rn(e.getAttribute(n) ?? "", r, t);
		i ? e.setAttribute(n, i) : e.removeAttribute(n);
	}
	return r.content;
}, uu = (e) => {
	let { source: t, display: n } = e, r = Hc(), i = Wt(null);
	return R(() => {
		let e = lu(t, r), n = i.current;
		n && n.replaceChildren(e ? e.cloneNode(!0) : document.createTextNode(""));
	}, [r, t]), cu(t) ? null : z(n === "inline" ? "span" : "div", { ref: (e) => {
		i.current = e;
	} });
}, du = class e extends Qe {
	__source;
	__display;
	static getType() {
		return "raw-html";
	}
	static clone(t) {
		return new e(t.__source, t.__display, t.__key);
	}
	constructor(e, t, n) {
		super(n), this.__source = e, this.__display = t;
	}
	createDOM() {
		return document.createElement(this.__display === "inline" ? "span" : "div");
	}
	updateDOM(e) {
		return e.__display !== this.__display;
	}
	isInline() {
		return this.__display === "inline";
	}
	getSource() {
		return this.__source;
	}
	getDisplay() {
		return this.__display;
	}
	getTextContent() {
		return cu(this.__source) ? "" : this.__source;
	}
	exportJSON() {
		return {
			type: "raw-html",
			version: 1,
			source: this.__source,
			display: this.__display
		};
	}
	static importJSON(e) {
		return fu(e.source, e.display);
	}
	decorate() {
		return /* @__PURE__ */ z(uu, {
			source: this.__source,
			display: this.__display
		});
	}
}, fu = (e, t) => S(new du(e, t)), pu = (e) => e instanceof du, mu = (e) => e.map((e) => "children" in e ? mu(e.children) : "value" in e ? e.value : "").join(""), hu = (e) => {
	let { nodes: t } = e, n = Hc(), r = re();
	return t.map((e, t) => {
		let i = `${e.type}-${t}`;
		switch (e.type) {
			case "text": return /* @__PURE__ */ z(Rt, { children: e.value }, i);
			case "strong": return /* @__PURE__ */ z(Zt, {
				as: "strong",
				fontWeight: "semibold",
				children: /* @__PURE__ */ z(hu, { nodes: e.children })
			}, i);
			case "emphasis": return /* @__PURE__ */ z(Kt, {
				as: "em",
				children: /* @__PURE__ */ z(hu, { nodes: e.children })
			}, i);
			case "delete": return /* @__PURE__ */ z(Kt, {
				as: "del",
				children: /* @__PURE__ */ z(hu, { nodes: e.children })
			}, i);
			case "inlineCode": return /* @__PURE__ */ z(ce, {
				candidate: {
					source: e.value,
					origin: "inline-code"
				},
				children: /* @__PURE__ */ z(qt, { children: e.value })
			}, i);
			case "break": return /* @__PURE__ */ z("br", {}, i);
			case "link": {
				let t = {
					source: e.url,
					origin: "markdown"
				};
				if (e.children.every((e) => e.type !== "image") && x(r, t)) return /* @__PURE__ */ z(zi, {
					source: e.url,
					label: mu(e.children)
				}, i);
				let a = ie(t, typeof window > "u" ? void 0 : window.location.origin);
				if (r && a && (a.kind !== "external" || r.resolveHref(t))) return /* @__PURE__ */ z(ce, {
					candidate: t,
					children: /* @__PURE__ */ z(hu, { nodes: e.children })
				}, i);
				let o = rn(e.url, "link", n);
				return o ? /* @__PURE__ */ z(Xt, {
					href: o,
					title: e.title ?? void 0,
					target: "_blank",
					rel: "noopener noreferrer",
					children: /* @__PURE__ */ z(hu, { nodes: e.children })
				}, i) : /* @__PURE__ */ z(hu, { nodes: e.children }, i);
			}
			case "image": return /* @__PURE__ */ z(Uc, {
				source: e.url,
				alt: e.alt ?? "",
				title: e.title ?? null
			}, i);
			case "html": return /* @__PURE__ */ z(uu, {
				source: e.value,
				display: "inline"
			}, i);
			case "inlineMath": return /* @__PURE__ */ z(qt, { children: e.value }, i);
			default: return null;
		}
	});
}, gu = (e) => {
	let { value: t } = e;
	return /* @__PURE__ */ z(hu, { nodes: zc(t) });
}, _u = Bt(void 0), vu = (e) => e.rows.map((e) => ({
	id: e.id,
	...e.cells
})), yu = (e) => e.columns, bu = (e) => {
	let { editor: t, nodeKey: n, table: r } = e, i = Ut(_u), [a] = Gt(() => ({
		getItem: () => null,
		setItem: () => void 0
	})), [o, s] = Gt(!1), c = Wt(null), l = () => {
		setTimeout(() => c.current?.focus(), 0);
	}, u = (e) => {
		t.update(() => {
			let t = mt(n);
			Cu(t) && t.setTable(e(t.getTable()));
		}, { tag: Ct }), l();
	}, d = (e) => {
		u((t) => ({
			columns: e,
			rows: t.rows.map((t) => ({
				...t,
				cells: Object.fromEntries(e.map((e) => [e.id, t.cells[e.id] ?? ""]))
			}))
		}));
	}, f = (e) => {
		u((t) => ({
			...t,
			rows: e.map((e, n) => ({
				id: String(e.id ?? t.rows[n]?.id ?? `row-${n + 1}`),
				cells: Object.fromEntries(t.columns.map((t) => [t.id, String(e[t.id] ?? "")]))
			}))
		}));
	}, p = () => {
		t.update(() => {
			let e = mt(n);
			if (Cu(e)) {
				let t = Je();
				e.replace(t), t.select();
			}
		}, { tag: Ct }), setTimeout(() => t.focus(), 0);
	};
	return /* @__PURE__ */ z(Kt, {
		ref: c,
		"data-testid": "markdown-table-node",
		"data-selected": String(o),
		"aria-label": "Markdown table",
		"aria-selected": o,
		tabIndex: 0,
		outline: o ? "2px solid" : "none",
		outlineColor: "border.accent-light",
		outlineOffset: "2px",
		borderRadius: "sm",
		onFocus: () => s(!0),
		onBlur: (e) => {
			e.currentTarget.contains(e.relatedTarget) || s(!1);
		},
		onClick: (e) => {
			let t = e.target;
			e.currentTarget.contains(t) && (t.closest("button, input, textarea, [contenteditable='true'], [role='menuitem']") || (e.preventDefault(), c.current?.focus()));
		},
		onKeyDownCapture: (e) => {
			let n = e.target, r = n.matches("input, textarea") || n.isContentEditable;
			(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !r ? (e.preventDefault(), e.stopPropagation(), t.dispatchCommand(e.shiftKey ? rt : Be, void 0)) : r || o && (e.key === "Delete" || e.key === "Backspace") && (e.preventDefault(), e.stopPropagation(), p());
		},
		children: /* @__PURE__ */ z(Pt, {
			storage: a,
			children: /* @__PURE__ */ z(Ft, {
				data: vu(r),
				defaultSettings: i,
				editMode: {
					columns: yu(r),
					onColumnsChange: d,
					onDataChange: f,
					renderHeader: (e) => /* @__PURE__ */ z(gu, { value: e.label }),
					renderCell: (e) => /* @__PURE__ */ z(gu, { value: String(e.value ?? "") }),
					renderCellEditor: ({ value: e, onChange: t }) => /* @__PURE__ */ z(It, {
						autoFocus: !0,
						defaultState: e,
						fullWidth: !0,
						isEditable: !0,
						padding: "xs",
						scrollable: !1,
						onChange: t
					})
				},
				fullWidth: !0,
				getRowId: (e) => String(e.id),
				initialPageSize: 30,
				isReadOnly: !t.isEditable()
			})
		})
	});
}, xu = class e extends Qe {
	__table;
	static getType() {
		return "data_table";
	}
	static clone(t) {
		return new e(t.__table, t.__key);
	}
	constructor(e, t) {
		super(t), this.__table = e;
	}
	getTable() {
		return this.getLatest().__table;
	}
	setTable(e) {
		let t = this.getWritable();
		t.__table = e;
	}
	createDOM() {
		return document.createElement("div");
	}
	updateDOM() {
		return !1;
	}
	decorate(e) {
		return /* @__PURE__ */ z(bu, {
			editor: e,
			nodeKey: this.__key,
			table: this.__table
		});
	}
	exportJSON() {
		return {
			type: "data_table",
			version: 2,
			table: this.__table
		};
	}
	static importJSON(e) {
		return Su(e.table);
	}
	getTextContent() {
		return [
			this.__table.columns.map((e) => e.label).join(" | "),
			this.__table.columns.map(() => "---").join(" | "),
			...this.__table.rows.map((e) => this.__table.columns.map((t) => e.cells[t.id] ?? "").join(" | "))
		].join("\n");
	}
}, Su = (e) => S(new xu(e)), Cu = (e) => e instanceof xu, wu = (e, t) => rn(e, "link", t) ?? "about:blank", Tu = class e extends Ot {
	__source;
	static getType() {
		return "markdown-link";
	}
	static clone(t) {
		return new e(t.__source, t.__url, {
			rel: t.__rel,
			target: t.__target,
			title: t.__title
		}, t.__key);
	}
	constructor(e = "", t, n, r) {
		super(t ?? wu(e), n, r), this.__source = e;
	}
	createDOM(e) {
		let t = super.createDOM(e);
		return t.dataset.chatSource = this.__source, t.dataset.chatOrigin = "markdown", t;
	}
	updateDOM(e, t, n) {
		let r = super.updateDOM(e, t, n);
		return t.dataset.chatSource = this.__source, r;
	}
	getSource() {
		return this.__source;
	}
	setResolvedURL(e) {
		return this.getURL() !== e && (this.getWritable().__url = e), this;
	}
	setURL(e) {
		let t = this.getWritable();
		return t.__source = e, t.__url = wu(e), t;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			source: this.__source,
			type: "markdown-link",
			version: 1
		};
	}
	static importJSON(e) {
		return Eu(e.source, void 0, {
			rel: e.rel,
			target: e.target,
			title: e.title
		});
	}
}, Eu = (e, t, n) => S(new Tu(e, wu(e, t), n)), Du = (e) => e instanceof Tu, Ou = class e extends je {
	static getType() {
		return "streaming-text";
	}
	static clone(t) {
		return new e(t.__text, t.__key);
	}
	static importJSON(e) {
		return ku(e.text).updateFromJSON(e);
	}
	createDOM(e) {
		let t = super.createDOM(e);
		return t.classList.add("streaming-text-chunk"), t;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			type: "streaming-text"
		};
	}
}, ku = (e) => S(new Ou(e)), Au = Lt.lazy(() => import("./EquationComponent-DlKY8f2h.ts"));
function ju(e) {
	let t = e.getAttribute("data-lexical-equation"), n = e.getAttribute("data-lexical-inline") === "true";
	return t = atob(t || ""), t ? { node: Nu(t, n) } : null;
}
var Mu = class e extends Qe {
	__equation;
	__inline;
	static getType() {
		return "equation";
	}
	static clone(t) {
		return new e(t.__equation, t.__inline, t.__key);
	}
	constructor(e, t, n) {
		super(n), this.__equation = e, this.__inline = t ?? !1;
	}
	static importJSON(e) {
		return Nu(e.equation, e.inline);
	}
	exportJSON() {
		return {
			equation: this.getEquation(),
			inline: this.__inline,
			type: "equation",
			version: 1
		};
	}
	createDOM(e) {
		let t = document.createElement(this.__inline ? "span" : "div");
		return t.className = "editor-equation", t;
	}
	exportDOM() {
		let e = document.createElement(this.__inline ? "span" : "div"), t = btoa(this.__equation);
		return e.setAttribute("data-lexical-equation", t), e.setAttribute("data-lexical-inline", `${this.__inline}`), b.render(this.__equation, e, {
			displayMode: !this.__inline,
			errorColor: "#cc0000",
			output: "html",
			strict: "warn",
			throwOnError: !1,
			trust: !1
		}), { element: e };
	}
	static importDOM() {
		return {
			div: (e) => e.hasAttribute("data-lexical-equation") ? {
				conversion: ju,
				priority: 2
			} : null,
			span: (e) => e.hasAttribute("data-lexical-equation") ? {
				conversion: ju,
				priority: 1
			} : null
		};
	}
	updateDOM(e) {
		return this.__inline !== e.__inline;
	}
	getTextContent() {
		return this.__equation;
	}
	getEquation() {
		return this.__equation;
	}
	setEquation(e) {
		let t = this.getWritable();
		t.__equation = e;
	}
	isInline() {
		return this.__inline;
	}
	decorate() {
		return /* @__PURE__ */ z(zt, {
			fallback: null,
			children: /* @__PURE__ */ z(Au, {
				equation: this.__equation,
				inline: this.__inline
			})
		});
	}
};
function Nu(e = "", t = !1) {
	let n = new Mu(e, t);
	return S(n);
}
function Pu(e) {
	return e instanceof Mu;
}
// packages/ui/src/components/rich-text/shared/plugins/EquationPlugin/EquationPlugin.tsx
var Fu = {
	dependencies: [Mu],
	export: (e) => Pu(e) && e.isInline() ? `\\( ${e.getEquation().trim()} \\)` : null,
	importRegExp: /\\\((.*?)\\\)/,
	regExp: /\\\((.*?)\\\)/,
	replace: (e, t) => {
		let n = Nu(t[1].trim(), !0);
		e.replace(n);
	},
	type: "text-match"
}, Iu = {
	dependencies: [Mu],
	regExpStart: /\\\[/,
	regExpEnd: /\\]/,
	export: (e) => Pu(e) && !e.isInline() ? `\\[ ${e.getEquation().trim()} \\]` : null,
	replace: (e, t, n, r, i) => i ? (e.append(Nu(i.join(" "), !1)), !0) : !1,
	type: "multiline-element"
};
function Lu() {
	return null;
}
// packages/ui/src/components/rich-text/shared/plugins/HorizontalRulePlugin/HorizontalRuleNode.ts
var Ru = class e extends j {
	static getType() {
		return "hr";
	}
	static clone(t) {
		return new e(t?.__key);
	}
	static importJSON(e) {
		return zu();
	}
	exportJSON() {
		return { ...super.exportJSON() };
	}
	createDOM(e, t) {
		let n = document.createElement("hr");
		return n.style = "margin: 2rem 0;", n;
	}
	updateDOM(e, t, n) {
		return !1;
	}
	decorate(e) {
		return null;
	}
};
function zu() {
	return new Ru();
}
function Bu(e) {
	return e instanceof Ru;
}
// packages/ui/src/components/rich-text/shared/plugins/MermaidPlugin/MermaidNode.tsx
var Vu = Vt(() => import("./MermaidComponent-CMGZVYUJ.ts")), Hu = class e extends Qe {
	__code;
	static getType() {
		return "mermaid";
	}
	static clone(t) {
		return new e(t.__code, t.__key);
	}
	constructor(e, t) {
		super(t), this.__code = e;
	}
	createDOM() {
		return document.createElement("div");
	}
	updateDOM() {
		return !1;
	}
	static importJSON(t) {
		return new e(t.code);
	}
	exportJSON() {
		return {
			type: "mermaid",
			code: this.__code,
			version: 1
		};
	}
	getTextContent() {
		return `\`\`\`mermaid\n${this.__code}\n\`\`\``;
	}
	getCode() {
		return this.__code;
	}
	setCode(e) {
		let t = this.getWritable();
		t.__code = e;
	}
	decorate() {
		return /* @__PURE__ */ z(zt, {
			fallback: null,
			children: /* @__PURE__ */ z(Vu, {
				code: this.__code,
				nodeKey: this.__key
			})
		});
	}
};
function Uu(e) {
	return e instanceof Hu;
}
function Wu(e) {
	return S(new Hu(e));
}
// packages/ui/src/components/rich-text/shared/plugins/HorizontalRulePlugin/horizontalRule.ts
var Gu = {
	dependencies: [Ru],
	export: (e) => Bu(e) ? "***" : null,
	regExp: /^(---|\*\*\*|___)\s?$/,
	replace: (e) => {
		let t = zu();
		e.replace(t);
	},
	type: "element"
}, Ku = {
	dependencies: [je],
	export: (e, t) => {
		if (e instanceof je) {
			let t = e.getTextContent();
			if (e.hasFormat("bold")) t = `**${t}**`;
			else if (e.hasFormat("italic")) t = `*${t}*`;
			else if (e.hasFormat("underline")) t = `<ins>${t}</ins>`;
			else return null;
			return t;
		}
		return null;
	},
	regExp: /<ins>(.*)<\/ins>/,
	importRegExp: /<ins>(.*)<\/ins>/,
	replace: (e, t) => {
		let n = P(t[1]);
		n.toggleFormat("underline"), e.replace(n);
	},
	type: "text-match"
}, qu = {
	dependencies: [je],
	export: (e, t) => null,
	regExp: /<u>(.*)<\/u>/,
	importRegExp: /<u>(.*)<\/u>/,
	replace: (e, t) => {
		let n = P(t[1]);
		n.toggleFormat("underline"), e.replace(n);
	},
	type: "text-match"
}, Ju = /https?:\/\/[^\s<>"']*[^\s<>"'.,:;"')\]}]/, Yu = (e) => e.replace(/\\([*_`~\\])/g, "$1"), Xu = (e) => e.replace(/\\/g, "\\\\").replace(/"/g, "\\\""), Zu = (e) => e?.replace(/\\(["\\])/g, "$1"), Qu = (e, t, n) => {
	if (e !== t) return n;
	let r = t.replace(/([*_`~\\])/g, "\\$1");
	return n.replace(r, t);
}, $u = [
	Gu,
	Ku,
	qu,
	{
		dependencies: [Ot],
		export: (e, t) => {
			if (!$e(e) || lt(e)) return null;
			let n = e.getTitle(), r = Yu(e.getURL()), i = Qu(e.getTextContent(), r, t(e));
			return n == null ? `[${i}](${r})` : `[${i}](${r} "${Xu(n)}")`;
		},
		importRegExp: /(?:\[(.+?)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))/,
		regExp: /(?:\[(.+?)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))$/,
		replace: (e, t) => {
			let [, n, r, i] = t, a = Yu(r), o = qe(a, { title: Zu(i) }), s = n.split("[").length - 1, c = n.split("]").length - 1, l = n, u = "";
			if (s < c) return;
			if (s > c) {
				let e = n.split("[");
				u = `[${e[0]}`, l = e.slice(1).join("[");
			}
			let d = Yu(l), f = P(d === a ? a : d);
			return f.setFormat(e.getFormat()), o.append(f), e.replace(o), u && o.insertBefore(P(u)), f;
		},
		trigger: ")",
		type: "text-match"
	},
	{
		dependencies: [Dt],
		export: (e, t) => {
			if (!lt(e)) return null;
			let n = Yu(e.getURL());
			return Qu(e.getTextContent(), n, t(e));
		},
		regExp: Ju,
		importRegExp: Ju,
		replace: (e, t) => {
			let n = Yu(t[0]), r = Ge(n), i = P(n);
			i.setFormat(e.getFormat()), r.append(i), e.replace(r);
		},
		type: "text-match"
	}
], ed = [
	Ou,
	tt,
	Ot,
	Dt,
	Tu,
	Wc,
	du,
	xu,
	_t,
	Hn,
	zn,
	hr,
	Cr,
	Hu,
	Mu,
	Ru,
	Vi
], td = [
	mi,
	...Ai.filter((e) => e !== Ti),
	...$u,
	Fu,
	Iu,
	Gi
], nd = bt;
// packages/ui/src/components/rich-text/shared/plugins/CodePlugin/CodeBlockPlugin.tsx
function rd(e) {
	return e.trim().toLowerCase() === "mermaid";
}
function id(e) {
	return rd(e.getLanguage() ?? "plaintext") ? (e.replace(new Hu(e.getTextContent())), !0) : !1;
}
function ad() {
	let [e] = Mt();
	return R(() => {
		e.update(() => {
			let e = Re(hr);
			for (let t of e) id(t);
		});
	}, [e]), null;
}
// packages/ui/src/components/rich-text/shared/plugins/CodePlugin/CodeHighlightingPlugin.tsx
function od() {
	let [e] = Mt();
	return R(() => qr(e), [e]), null;
}
// packages/ui/src/components/rich-text/shared/plugins/list-marker-width-plugin.tsx
function sd() {
	let [e] = Mt();
	return R(() => e.registerMutationListener(Hn, (t) => {
		for (let [n, r] of t) {
			if (r === "destroyed") continue;
			let t = e.getElementByKey(n);
			if (!(t instanceof HTMLOListElement)) continue;
			let i = [...t.children].flatMap((e) => e instanceof HTMLLIElement ? [e.value] : []);
			t.style.setProperty("--rich-text-list-digits", String(Math.max(t.start, ...i)).length.toString());
		}
	}), [e]), null;
}
export { B as $, Fc as A, Ai as B, fu as C, Vc as D, Kc as E, Ui as F, sr as G, gr as H, zi as I, qn as J, tr as K, Li as L, Lc as M, Rc as N, Pc as O, Hi as P, Jn as Q, Pi as R, gu as S, Gc as T, W as U, Ni as V, cr as W, rr as X, H as Y, V as Z, Du as _, nd as a, dn as at, Cu as b, Uu as c, ln as ct, Lu as d, nr as et, Nu as f, Eu as g, Ou as h, ed as i, vn as it, Ic as j, zc as k, zu as l, fn as lt, ku as m, od as n, xn as nt, td as o, pn as ot, Pu as p, U as q, ad as r, bn as rt, Wu as s, an as st, sd as t, Sn as tt, Bu as u, rn as ut, Tu as v, pu as w, _u as x, Su as y, Fi as z };
