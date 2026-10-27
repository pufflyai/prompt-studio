// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./scroll-area-I7hjn89T.ts";
import { n as t, r as n, t as r } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { Component as i, Suspense as a, createContext as o, createElement as s, forwardRef as c, useCallback as l, useEffect as u, useLayoutEffect as d, useMemo as f, useRef as p, useState as m } from "react";
import { Box as ee, chakra as h } from "@chakra-ui/react";
import { Fragment as g, jsx as _, jsxs as te } from "react/jsx-runtime";
import { createPortal as v, flushSync as ne } from "react-dom";
// node_modules/.bun/lexical@0.40.0/node_modules/lexical/Lexical.prod.mjs
function y(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
function re(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	n.search = r.toString(), console.warn(`Minified Lexical warning #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
var b = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, ie = b && "documentMode" in document ? document.documentMode : null, x = b && /Mac|iPod|iPhone|iPad/.test(navigator.platform), S = b && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent), ae = !(!b || !("InputEvent" in window) || ie) && "getTargetRanges" in new window.InputEvent("input"), oe = b && /Version\/[\d.]+.*Safari/.test(navigator.userAgent), se = b && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream, ce = b && /Android/.test(navigator.userAgent), le = b && /^(?=.*Chrome).*/i.test(navigator.userAgent), ue = b && ce && le, de = b && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && x && !le, fe = 0, pe = 1, me = 2, he = 1, ge = 2, _e = 3, ve = 4, ye = 5, be = 6, xe = oe || se || de ? "\xA0" : "​", Se = "\n\n", Ce = S ? "\xA0" : xe, we = "֑-߿יִ-﷽ﹰ-ﻼ", Te = "A-Za-zÀ-ÖØ-öø-ʸ̀-֐ࠀ-῿‎Ⰰ-﬜︀-﹯﻽-￿", Ee = RegExp("^[^" + Te + "]*[" + we + "]"), De = RegExp("^[^" + we + "]*[" + Te + "]"), C = {
	bold: 1,
	capitalize: 1024,
	code: 16,
	highlight: 128,
	italic: 2,
	lowercase: 256,
	strikethrough: 4,
	subscript: 32,
	superscript: 64,
	underline: 8,
	uppercase: 512
}, Oe = {
	directionless: 1,
	unmergeable: 2
}, ke = {
	center: 2,
	end: 6,
	justify: 4,
	left: 1,
	right: 3,
	start: 5
}, Ae = {
	[ge]: "center",
	[be]: "end",
	[ve]: "justify",
	[he]: "left",
	[_e]: "right",
	[ye]: "start"
}, je = {
	normal: 0,
	segmented: 2,
	token: 1
}, Me = {
	[fe]: "normal",
	[me]: "segmented",
	[pe]: "token"
}, Ne = "$config";
function Pe(e, t, n, r, i, a) {
	let o = e.getFirstChild();
	for (; o !== null;) {
		let e = o.__key;
		o.__parent === t && (L(o) && Pe(o, e, n, r, i, a), n.has(e) || a.delete(e), i.push(e)), o = o.getNextSibling();
	}
}
var Fe = !1, Ie = 0;
function Le(e) {
	Ie = e.timeStamp;
}
function Re(e, t, n) {
	let r = e.nodeName === "BR", i = t.__lexicalLineBreak;
	return i && (e === i || r && e.previousSibling === i) || r && za(e, n) !== void 0;
}
function ze(e, t, n) {
	let r = ko(yo(n)), i = null, a = null;
	r !== null && r.anchorNode === e && (i = r.anchorOffset, a = r.focusOffset);
	let o = e.nodeValue;
	o !== null && Xa(t, o, i, a, !1);
}
function Be(e, t, n) {
	if (k(e)) {
		let t = e.anchor.getNode();
		if (t.is(n) && e.format !== t.getFormat()) return !1;
	}
	return ka(t) && n.isAttached();
}
function Ve(e, t, n, r) {
	for (let i = e; i && !Go(i); i = po(i)) {
		let e = za(i, t);
		if (e !== void 0) {
			let t = H(e, n);
			if (t) return R(t) || !q(i) ? void 0 : [i, t];
		} else if (i === r) return [r, Ua(n)];
	}
}
function He(e, t, n) {
	Fe = !0;
	let r = performance.now() - Ie > 100;
	try {
		Ji(e, () => {
			let i = j() || function(e) {
				return e.getEditorState().read(() => {
					let e = j();
					return e === null ? null : e.clone();
				});
			}(e), a = /* @__PURE__ */ new Map(), o = e.getRootElement(), s = e._editorState, c = e._blockCursorElement, l = !1, u = "";
			for (let n = 0; n < t.length; n++) {
				let d = t[n], f = d.type, p = d.target, m = Ve(p, e, s, o);
				if (!m) continue;
				let [ee, h] = m;
				if (f === "characterData") r && O(h) && ka(p) && Be(i, p, h) && ze(p, h, e);
				else if (f === "childList") {
					l = !0;
					let t = d.addedNodes;
					for (let n = 0; n < t.length; n++) {
						let r = t[n], i = Ra(r), a = r.parentNode;
						if (a != null && r !== c && i === null && !Re(r, a, e)) {
							if (S) {
								let e = (q(r) ? r.innerText : null) || r.nodeValue;
								e && (u += e);
							}
							a.removeChild(r);
						}
					}
					let n = d.removedNodes, r = n.length;
					if (r > 0) {
						let t = 0;
						for (let i = 0; i < r; i++) {
							let r = n[i];
							(Re(r, p, e) || c === r) && (p.appendChild(r), t++);
						}
						r !== t && a.set(ee, h);
					}
				}
			}
			if (a.size > 0) for (let [t, n] of a) n.reconcileObservedMutation(t, e);
			let d = n.takeRecords();
			if (d.length > 0) {
				for (let t = 0; t < d.length; t++) {
					let n = d[t], r = n.addedNodes, i = n.target;
					for (let t = 0; t < r.length; t++) {
						let n = r[t], a = n.parentNode;
						a == null || n.nodeName !== "BR" || Re(n, i, e) || a.removeChild(n);
					}
				}
				n.takeRecords();
			}
			i !== null && (l && W(i), S && uo(e) && i.insertRawText(u));
		});
	} finally {
		Fe = !1;
	}
}
function Ue(e) {
	let t = e._observer;
	t !== null && He(e, t.takeRecords(), t);
}
function We(e) {
	(function(e) {
		Ie === 0 && yo(e).addEventListener("textInput", Le, !0);
	})(e), e._observer = new MutationObserver((t, n) => {
		He(e, t, n);
	});
}
var Ge = class {
	key;
	parse;
	unparse;
	isEqual;
	defaultValue;
	constructor(e, t) {
		this.key = e, this.parse = t.parse.bind(t), this.unparse = (t.unparse || et).bind(t), this.isEqual = (t.isEqual || Object.is).bind(t), this.defaultValue = this.parse(void 0);
	}
};
function Ke(e, t) {
	return new Ge(e, t);
}
function qe(e, t, n = "latest") {
	let r = (n === "latest" ? e.getLatest() : e).__state;
	return r ? r.getValue(t) : t.defaultValue;
}
function Je(e, t, n) {
	let r;
	if (F(), typeof n == "function") {
		let i = e.getLatest(), a = qe(i, t);
		if (r = n(a), t.isEqual(a, r)) return i;
	} else r = n;
	let i = e.getWritable();
	return Ze(i).updateFromKnown(t, r), i;
}
function Ye(e) {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set();
	for (let r = typeof e == "function" ? e : e.replace; r.prototype && r.prototype.getType !== void 0; r = Object.getPrototypeOf(r)) {
		let { ownNodeConfig: e } = qo(r);
		if (e && e.stateConfigs) for (let r of e.stateConfigs) {
			let e;
			"stateConfig" in r ? (e = r.stateConfig, r.flat && n.add(e.key)) : e = r, t.set(e.key, e);
		}
	}
	return {
		flatKeys: n,
		sharedConfigMap: t
	};
}
var Xe = class e {
	node;
	knownState;
	unknownState;
	sharedNodeState;
	size;
	constructor(e, t, n = void 0, r = /* @__PURE__ */ new Map(), i = void 0) {
		this.node = e, this.sharedNodeState = t, this.unknownState = n, this.knownState = r;
		let { sharedConfigMap: a } = this.sharedNodeState, o = i === void 0 ? function(e, t, n) {
			let r = n.size;
			if (t) for (let i in t) {
				let t = e.get(i);
				t && n.has(t) || r++;
			}
			return r;
		}(a, n, r) : i;
		this.size = o;
	}
	getValue(e) {
		let t = this.knownState.get(e);
		if (t !== void 0) return t;
		this.sharedNodeState.sharedConfigMap.set(e.key, e);
		let n = e.defaultValue;
		if (this.unknownState && e.key in this.unknownState) {
			let t = this.unknownState[e.key];
			t !== void 0 && (n = e.parse(t)), this.updateFromKnown(e, n);
		}
		return n;
	}
	getInternalState() {
		return [this.unknownState, this.knownState];
	}
	toJSON() {
		let e = { ...this.unknownState }, t = {};
		for (let [t, n] of this.knownState) t.isEqual(n, t.defaultValue) ? delete e[t.key] : e[t.key] = t.unparse(n);
		for (let n of this.sharedNodeState.flatKeys) n in e && (t[n] = e[n], delete e[n]);
		return $e(e) && (t.$ = e), t;
	}
	getWritable(t) {
		if (this.node === t) return this;
		let { sharedNodeState: n, unknownState: r } = this, i = new Map(this.knownState);
		return new e(t, n, function(e, t, n) {
			let r;
			if (n) for (let [i, a] of Object.entries(n)) {
				let n = e.get(i);
				n ? t.has(n) || t.set(n, n.parse(a)) : (r ||= {}, r[i] = a);
			}
			return r;
		}(n.sharedConfigMap, i, r), i, this.size);
	}
	updateFromKnown(e, t) {
		let n = e.key;
		this.sharedNodeState.sharedConfigMap.set(n, e);
		let { knownState: r, unknownState: i } = this;
		r.has(e) || i && n in i || (i && (delete i[n], this.unknownState = $e(i)), this.size++), r.set(e, t);
	}
	updateFromUnknown(e, t) {
		let n = this.sharedNodeState.sharedConfigMap.get(e);
		n ? this.updateFromKnown(n, n.parse(t)) : (this.unknownState = this.unknownState || {}, e in this.unknownState || this.size++, this.unknownState[e] = t);
	}
	updateFromJSON(e) {
		let { knownState: t } = this;
		for (let e of t.keys()) t.set(e, e.defaultValue);
		if (this.size = t.size, this.unknownState = void 0, e) for (let [t, n] of Object.entries(e)) this.updateFromUnknown(t, n);
	}
};
function Ze(e) {
	let t = e.getWritable(), n = t.__state ? t.__state.getWritable(t) : new Xe(t, Qe(t));
	return t.__state = n, n;
}
function Qe(e) {
	return e.__state ? e.__state.sharedNodeState : _a(Lo(), e.getType()).sharedNodeState;
}
function $e(e) {
	if (e) for (let t in e) return e;
}
function et(e) {
	return e;
}
function tt(e, t, n) {
	for (let [r, i] of t.knownState) {
		if (e.has(r.key)) continue;
		e.add(r.key);
		let t = n ? n.getValue(r) : r.defaultValue;
		if (t !== i && !r.isEqual(t, i)) return !0;
	}
	return !1;
}
function nt(e, t, n) {
	let { unknownState: r } = t, i = n ? n.unknownState : void 0;
	if (r) {
		for (let [t, n] of Object.entries(r)) if (!e.has(t) && (e.add(t), n !== (i ? i[t] : void 0))) return !0;
	}
	return !1;
}
function rt(e, t) {
	let n = e.__state;
	return n && n.node === e ? n.getWritable(t) : n;
}
function it(e, t) {
	let n = e.__mode, r = e.__format, i = e.__style, a = t.__mode, o = t.__format, s = t.__style, c = e.__state, l = t.__state;
	return (n === null || n === a) && (r === null || r === o) && (i === null || i === s) && (e.__state === null || c === l || function(e, t) {
		if (e === t) return !0;
		if (e && t && e.size !== t.size) return !1;
		let n = /* @__PURE__ */ new Set();
		return !(e && tt(n, e, t) || t && tt(n, t, e) || e && nt(n, e, t) || t && nt(n, t, e));
	}(c, l));
}
function at(e, t) {
	let n = e.mergeWithSibling(t), r = I()._normalizedNodes;
	return r.add(e.__key), r.add(t.__key), n;
}
function ot(e) {
	let t, n, r = e;
	if (r.__text !== "" || !r.isSimpleText() || r.isUnmergeable()) {
		for (; (t = r.getPreviousSibling()) !== null && O(t) && t.isSimpleText() && !t.isUnmergeable();) {
			if (t.__text !== "") {
				if (it(t, r)) {
					r = at(t, r);
					break;
				}
				break;
			}
			t.remove();
		}
		for (; (n = r.getNextSibling()) !== null && O(n) && n.isSimpleText() && !n.isUnmergeable();) {
			if (n.__text !== "") {
				if (it(r, n)) {
					r = at(r, n);
					break;
				}
				break;
			}
			n.remove();
		}
	} else r.remove();
}
function st(e) {
	return ct(e.anchor), ct(e.focus), e;
}
function ct(e) {
	for (; e.type === "element";) {
		let t = e.getNode(), n = e.offset, r, i;
		if (n === t.getChildrenSize() ? (r = t.getChildAtIndex(n - 1), i = !0) : (r = t.getChildAtIndex(n), i = !1), O(r)) {
			e.set(r.__key, i ? r.getTextContentSize() : 0, "text", !0);
			break;
		}
		if (!L(r)) break;
		e.set(r.__key, i ? r.getChildrenSize() : 0, "element", !0);
	}
}
var lt, w, ut, dt, ft, pt, mt, ht, gt, _t, T = "", vt = null, yt = null, bt = !1, xt = !1;
function St(e, t) {
	let n = mt.get(e);
	if (t !== null) {
		let n = Bt(e);
		n.parentNode === t && t.removeChild(n);
	}
	if (ht.has(e) || w._keyToDOMMap.delete(e), L(n)) {
		let e = Pt(n, mt);
		Ct(e, 0, e.length - 1, null);
	}
	n !== void 0 && oo(_t, ut, dt, n, "destroyed");
}
function Ct(e, t, n, r) {
	for (let i = t; i <= n; ++i) {
		let t = e[i];
		t !== void 0 && St(t, r);
	}
}
function wt(e, t) {
	e.setProperty("text-align", t);
}
var Tt = "40px";
function Et(e, t) {
	let n = lt.theme.indent;
	if (typeof n == "string") {
		let r = e.classList.contains(n);
		t > 0 && !r ? e.classList.add(n) : t < 1 && r && e.classList.remove(n);
	}
	let r = getComputedStyle(e).getPropertyValue("--lexical-indent-base-value") || Tt;
	e.style.setProperty("padding-inline-start", t === 0 ? "" : `calc(${t} * ${r})`);
}
function Dt(e, t) {
	let n = e.style;
	t === 0 ? wt(n, "") : t === 1 ? wt(n, "left") : t === 2 ? wt(n, "center") : t === 3 ? wt(n, "right") : t === 4 ? wt(n, "justify") : t === 5 ? wt(n, "start") : t === 6 && wt(n, "end");
}
function Ot(e, t) {
	let n = function(e) {
		let t = e.__dir;
		if (t !== null) return t;
		if (z(e)) return null;
		let n = e.getParentOrThrow();
		return z(n) && n.__dir === null ? "auto" : null;
	}(t);
	n === null ? e.removeAttribute("dir") : e.dir = n;
}
function kt(e, t) {
	let n = ht.get(e);
	n === void 0 && y(60);
	let r = n.createDOM(lt, w);
	if (function(e, t, n) {
		let r = n._keyToDOMMap;
		(function(e, t, n) {
			let r = `__lexicalKey_${t._key}`;
			e[r] = n;
		})(t, n, e), r.set(e, t);
	}(e, r, w), O(n) ? r.setAttribute("data-lexical-text", "true") : R(n) && r.setAttribute("data-lexical-decorator", "true"), L(n)) {
		let e = n.__indent, t = n.__size;
		if (Ot(r, n), e !== 0 && Et(r, e), t !== 0) {
			let e = t - 1;
			At(Pt(n, ht), n, 0, e, n.getDOMSlot(r));
		}
		let i = n.__format;
		i !== 0 && Dt(r, i), n.isInline() || Mt(null, n, r);
	} else {
		let t = n.getTextContent();
		if (R(n)) {
			let t = n.decorate(w, lt);
			t !== null && It(e, t), r.contentEditable = "false";
		}
		T += t;
	}
	return t !== null && t.insertChild(r), oo(_t, ut, dt, n, "created"), r;
}
function At(e, t, n, r, i) {
	let a = T;
	T = "";
	let o = n;
	for (; o <= r; ++o) {
		kt(e[o], i);
		let t = ht.get(e[o]);
		t !== null && O(t) ? vt === null && (vt = t.getFormat(), yt = t.getStyle()) : L(t) && o < r && !t.isInline() && (T += Se);
	}
	i.element.__lexicalTextContent = T, T = a + T;
}
function jt(e, t) {
	if (e) {
		let n = e.__last;
		if (n) {
			let e = t.get(n);
			if (e) return jr(e) ? "line-break" : R(e) && e.isInline() ? "decorator" : null;
		}
		return "empty";
	}
	return null;
}
function Mt(e, t, n) {
	let r = jt(e, mt), i = jt(t, ht);
	r !== i && t.getDOMSlot(n).setManagedLineBreak(i);
}
function Nt(e, t, n) {
	var r;
	vt = null, yt = null, function(e, t, n) {
		let r = T, i = e.__size, a = t.__size;
		T = "";
		let o = n.element;
		if (i === 1 && a === 1) {
			let n = e.__first, r = t.__first;
			if (n === r) Ft(n, o);
			else {
				let e = Bt(n), t = kt(r, null);
				try {
					o.replaceChild(t, e);
				} catch (i) {
					if (typeof i == "object" && i) {
						let a = `${i.toString()} Parent: ${o.tagName}, new child: {tag: ${t.tagName} key: ${r}}, old child: {tag: ${e.tagName}, key: ${n}}.`;
						throw Error(a);
					}
					throw i;
				}
				St(n, null);
			}
			let i = ht.get(r);
			O(i) && vt === null && (vt = i.getFormat(), yt = i.getStyle());
		} else {
			let r = Pt(e, mt), s = Pt(t, ht);
			if (r.length !== i && y(227), s.length !== a && y(228), i === 0) a !== 0 && At(s, 0, 0, a - 1, n);
			else if (a === 0) {
				if (i !== 0) {
					let e = n.after == null && n.before == null && n.element.__lexicalLineBreak == null;
					Ct(r, 0, i - 1, e ? null : o), e && (o.textContent = "");
				}
			} else (function(e, t, n, r, i, a) {
				let o = r - 1, s = i - 1, c, l, u = a.getFirstChild(), d = 0, f = 0;
				for (; d <= o && f <= s;) {
					let e = t[d], r = n[f];
					if (e === r) u = Lt(Ft(r, a.element)), d++, f++;
					else {
						if (l === void 0 && (l = Rt(n, f)), c === void 0) c = Rt(t, d);
						else if (!c.has(e)) {
							d++;
							continue;
						}
						if (!l.has(e)) {
							u = Lt(Bt(e)), St(e, a.element), d++, c.delete(e);
							continue;
						}
						if (c.has(r)) {
							let e = fo(w, r);
							e !== u && a.withBefore(u).insertChild(e), u = Lt(Ft(r, a.element)), d++, f++;
						} else kt(r, a.withBefore(u)), f++;
					}
					let i = ht.get(r);
					i !== null && O(i) ? vt === null && (vt = i.getFormat(), yt = i.getStyle()) : L(i) && f <= s && !i.isInline() && (T += Se);
				}
				let p = d > o, m = f > s;
				if (p && !m) {
					let e = n[s + 1], t = e === void 0 ? null : w.getElementByKey(e);
					At(n, 0, f, s, a.withBefore(t));
				} else m && !p && Ct(t, d, o, a.element);
			})(0, r, s, i, a, n);
		}
		o.__lexicalTextContent = T, T = r + T;
	}(e, t, t.getDOMSlot(n)), r = t, vt == null || vt === r.__textFormat || xt || r.setTextFormat(vt), function(e) {
		yt == null || yt === e.__textStyle || xt || e.setTextStyle(yt);
	}(t);
}
function Pt(e, t) {
	let n = [], r = e.__first;
	for (; r !== null;) {
		let e = t.get(r);
		e === void 0 && y(101), n.push(r), r = e.__next;
	}
	return n;
}
function Ft(e, t) {
	let n = mt.get(e), r = ht.get(e);
	n !== void 0 && r !== void 0 || y(61);
	let i = bt || pt.has(e) || ft.has(e), a = fo(w, e);
	if (n === r && !i) {
		let e;
		if (L(n)) {
			let t = a.__lexicalTextContent;
			typeof t == "string" ? e = t : (e = n.getTextContent(), a.__lexicalTextContent = e);
		} else e = n.getTextContent();
		return T += e, a;
	}
	if (n !== r && i && oo(_t, ut, dt, r, "updated"), r.updateDOM(n, a, lt)) {
		let n = kt(e, null);
		return t === null && y(62), t.replaceChild(n, a), St(e, null), n;
	}
	if (L(n)) {
		L(r) || y(334, e);
		let t = r.__indent;
		(bt || t !== n.__indent) && Et(a, t);
		let o = r.__format;
		if ((bt || o !== n.__format) && Dt(a, o), i) Nt(n, r, a), z(r) || r.isInline() || Mt(n, r, a);
		else {
			let e = a.__lexicalTextContent, t;
			typeof e == "string" ? t = e : (t = n.getTextContent(), a.__lexicalTextContent = t), T += t;
		}
		if ((bt || r.__dir !== n.__dir) && (Ot(a, r), z(r) && !bt)) for (let e of r.getChildren()) L(e) && Ot(fo(w, e.getKey()), e);
	} else {
		let t = r.getTextContent();
		if (R(r)) {
			let t = r.decorate(w, lt);
			t !== null && It(e, t);
		}
		T += t;
	}
	if (!xt && z(r) && r.__cachedText !== T) {
		let e = r.getWritable();
		e.__cachedText = T, r = e;
	}
	return a;
}
function It(e, t) {
	let n = w._pendingDecorators, r = w._decorators;
	if (n === null) {
		if (r[e] === t) return;
		n = Va(w);
	}
	n[e] = t;
}
function Lt(e) {
	let t = e.nextSibling;
	return t !== null && t === w._blockCursorElement && (t = t.nextSibling), t;
}
function Rt(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let r = t; r < e.length; r++) n.add(e[r]);
	return n;
}
function zt(e, t, n, r, i, a) {
	T = "", bt = r === 2, w = n, lt = n._config, ut = n._nodes, dt = w._listeners.mutation, ft = i, pt = a, mt = e._nodeMap, ht = t._nodeMap, xt = t._readOnly, gt = new Map(n._keyToDOMMap);
	let o = /* @__PURE__ */ new Map();
	return _t = o, Ft("root", null), w = void 0, ut = void 0, ft = void 0, pt = void 0, mt = void 0, ht = void 0, lt = void 0, gt = void 0, _t = void 0, o;
}
function Bt(e) {
	let t = gt.get(e);
	return t === void 0 && y(75, e), t;
}
function E(e) {
	return { type: e };
}
var Vt = E("SELECTION_CHANGE_COMMAND"), Ht = E("SELECTION_INSERT_CLIPBOARD_NODES_COMMAND"), Ut = E("CLICK_COMMAND"), Wt = E("BEFORE_INPUT_COMMAND"), Gt = E("INPUT_COMMAND"), Kt = E("COMPOSITION_START_COMMAND"), qt = E("COMPOSITION_END_COMMAND"), Jt = E("DELETE_CHARACTER_COMMAND"), Yt = E("INSERT_LINE_BREAK_COMMAND"), Xt = E("INSERT_PARAGRAPH_COMMAND"), Zt = E("CONTROLLED_TEXT_INSERTION_COMMAND"), Qt = E("PASTE_COMMAND"), $t = E("REMOVE_TEXT_COMMAND"), en = E("DELETE_WORD_COMMAND"), tn = E("DELETE_LINE_COMMAND"), nn = E("FORMAT_TEXT_COMMAND"), rn = E("UNDO_COMMAND"), an = E("REDO_COMMAND"), on = E("KEYDOWN_COMMAND"), sn = E("KEY_ARROW_RIGHT_COMMAND"), cn = E("MOVE_TO_END"), ln = E("KEY_ARROW_LEFT_COMMAND"), un = E("MOVE_TO_START"), dn = E("KEY_ARROW_UP_COMMAND"), fn = E("KEY_ARROW_DOWN_COMMAND"), pn = E("KEY_ENTER_COMMAND"), mn = E("KEY_SPACE_COMMAND"), hn = E("KEY_BACKSPACE_COMMAND"), gn = E("KEY_ESCAPE_COMMAND"), _n = E("KEY_DELETE_COMMAND"), vn = E("KEY_TAB_COMMAND"), yn = E("INSERT_TAB_COMMAND"), bn = E("INDENT_CONTENT_COMMAND"), xn = E("OUTDENT_CONTENT_COMMAND"), Sn = E("DROP_COMMAND"), Cn = E("FORMAT_ELEMENT_COMMAND"), wn = E("DRAGSTART_COMMAND"), Tn = E("DRAGOVER_COMMAND"), En = E("DRAGEND_COMMAND"), Dn = E("COPY_COMMAND"), On = E("CUT_COMMAND"), kn = E("SELECT_ALL_COMMAND"), An = E("CLEAR_EDITOR_COMMAND"), jn = E("CLEAR_HISTORY_COMMAND"), Mn = E("CAN_REDO_COMMAND"), Nn = E("CAN_UNDO_COMMAND"), Pn = E("FOCUS_COMMAND"), Fn = E("BLUR_COMMAND"), In = E("KEY_MODIFIER_COMMAND"), Ln = Object.freeze({}), Rn = [
	["keydown", function(e, t) {
		zn = e.timeStamp, Bn = e.key, !t.isComposing() && K(t, on, e);
	}],
	["pointerdown", function(e, t) {
		let n = e.target, r = e.pointerType;
		Mo(n) && r !== "touch" && r !== "pen" && e.button === 0 && Ji(t, () => {
			ba(n) || (Kn = !0);
		});
	}],
	["compositionstart", function(e, t) {
		K(t, Kt, e);
	}],
	["compositionend", function(e, t) {
		S ? Jn = !0 : se || !oe && !de ? K(t, qt, e) : (Yn = !0, Xn = e.data);
	}],
	["input", function(e, t) {
		e.stopPropagation(), Ji(t, () => {
			t.dispatchCommand(Gt, e);
		}, { event: e }), Hn = null;
	}],
	["click", function(e, t) {
		Ji(t, () => {
			let n = j(), r = ko(yo(t)), i = yi();
			if (r) {
				if (k(n)) {
					let t = n.anchor, a = t.getNode();
					if (t.type === "element" && t.offset === 0 && n.isCollapsed() && !z(a) && U().getChildrenSize() === 1 && a.getTopLevelElementOrThrow().isEmpty() && i !== null && n.is(i)) r.removeAllRanges(), n.dirty = !0;
					else if (e.detail === 3 && !n.isCollapsed() && a !== n.focus.getNode()) {
						let e = J(a, (e) => L(e) && !e.isInline());
						L(e) && e.select(0);
					}
				} else if (e.pointerType === "touch" || e.pointerType === "pen") {
					let n = r.anchorNode;
					(q(n) || ka(n)) && W(vi(i, r, t, e));
				}
			}
			K(t, Ut, e);
		});
	}],
	["cut", Ln],
	["copy", Ln],
	["dragstart", Ln],
	["dragover", Ln],
	["dragend", Ln],
	["paste", Ln],
	["focus", Ln],
	["blur", Ln],
	["drop", Ln]
];
ae && Rn.push(["beforeinput", (e, t) => function(e, t) {
	let n = e.inputType;
	n === "deleteCompositionText" || S && uo(t) || n !== "insertCompositionText" && K(t, Wt, e);
}(e, t)]);
var zn = 0, Bn = null, Vn = 0, Hn = null, Un = /* @__PURE__ */ new WeakMap(), Wn = /* @__PURE__ */ new WeakMap(), Gn = !1, Kn = !1, qn = !1, Jn = !1, Yn = !1, Xn = "", Zn = null, Qn = [
	0,
	"",
	0,
	"root",
	0
];
function $n(e, t, n, r, i) {
	let a = e.anchor, o = e.focus, s = a.getNode(), c = I(), l = ko(yo(c)), u = l === null ? null : l.anchorNode, d = a.key, f = c.getElementByKey(d), p = n.length;
	return d !== o.key || !O(s) || (!i && (!ae || Vn < r + 50) || s.isDirty() && p < 2 || Ga(n)) && a.offset !== o.offset && !s.isComposing() || Oa(s) || s.isDirty() && p > 1 || (i || !ae) && f !== null && !s.isComposing() && u !== ja(f) || l !== null && t !== null && (!t.collapsed || t.startContainer !== l.anchorNode || t.startOffset !== l.anchorOffset) || s.getFormat() !== e.format || s.getStyle() !== e.style || function(e, t) {
		if (t.isSegmented()) return !0;
		if (!e.isCollapsed()) return !1;
		let n = e.anchor.offset, r = t.getParentOrThrow(), i = Da(t);
		return n === 0 ? !t.canInsertTextBefore() || !r.canInsertTextBefore() && !t.isComposing() || i || function(e) {
			let t = e.getPreviousSibling();
			return (O(t) || L(t) && t.isInline()) && !t.canInsertTextAfter();
		}(t) : n === t.getTextContentSize() && (!t.canInsertTextAfter() || !r.canInsertTextAfter() && !t.isComposing() || i);
	}(e, s);
}
function er(e, t) {
	return ka(e) && e.nodeValue !== null && t !== 0 && t !== e.nodeValue.length;
}
function tr(e, t, n) {
	let { anchorNode: r, anchorOffset: i, focusNode: a, focusOffset: o } = e;
	Gn && (Gn = !1, er(r, i) && er(a, o) && !Zn) || Ji(t, () => {
		if (!n) return void W(null);
		if (!Sa(t, r, a)) return;
		let s = j();
		if (Zn && k(s) && s.isCollapsed()) {
			let e = s.anchor, t = Zn.anchor;
			(e.key === t.key && e.offset === t.offset + 1 || e.offset === 1 && t.getNode().is(e.getNode().getPreviousSibling())) && (s = Zn.clone(), W(s));
		}
		if (Zn = null, k(s)) {
			let n = s.anchor, r = n.getNode();
			if (s.isCollapsed()) {
				e.type === "Range" && e.anchorNode === e.focusNode && (s.dirty = !0);
				let i = yo(t).event, a = i ? i.timeStamp : performance.now(), [o, c, l, u, d] = Qn, f = U(), p = !1 === t.isComposing() && f.getTextContent() === "";
				if (a < d + 200 && n.offset === l && n.key === u) nr(s, o, c);
				else if (n.type === "text") O(r) || y(141), rr(s, r);
				else if (n.type === "element" && !p) {
					L(r) || y(259);
					let e = n.getNode();
					e.isEmpty() ? function(e, t) {
						nr(e, t.getTextFormat(), t.getTextStyle());
					}(s, e) : nr(s, 0, "");
				}
			} else {
				let e = n.key, t = s.focus.key, r = s.getNodes(), a = r.length, c = s.isBackward(), l = c ? o : i, u = c ? i : o, d = c ? t : e, f = c ? e : t, p = 2047, m = !1;
				for (let e = 0; e < a; e++) {
					let t = r[e], n = t.getTextContentSize();
					if (O(t) && n !== 0 && !(e === 0 && t.__key === d && l === n || e === a - 1 && t.__key === f && u === 0) && (m = !0, p &= t.getFormat(), p === 0)) break;
				}
				s.format = m ? p : 0;
			}
		}
		K(t, Vt, void 0);
	});
}
function nr(e, t, n) {
	e.format === t && e.style === n || (e.format = t, e.style = n, e.dirty = !0);
}
function rr(e, t) {
	nr(e, t.getFormat(), t.getStyle());
}
function ir(e) {
	if (!e.getTargetRanges) return null;
	let t = e.getTargetRanges();
	return t.length === 0 ? null : t[0];
}
function ar(e) {
	let t = e.inputType, n = ir(e), r = I(), i = j();
	if (t === "deleteContentBackward") {
		if (i === null) {
			let e = yi();
			if (!k(e)) return !0;
			W(e.clone());
		}
		if (k(i)) {
			let t = i.anchor.key === i.focus.key;
			if (a = e.timeStamp, Bn === "MediaLast" && a < zn + 30 && r.isComposing() && t) {
				if (V(null), zn = 0, setTimeout(() => {
					Ji(r, () => {
						V(null);
					});
				}, 30), k(i)) {
					let e = i.anchor.getNode();
					e.markDirty(), O(e) || y(142), rr(i, e);
				}
			} else {
				V(null), e.preventDefault();
				let n = i.anchor.getNode(), a = n.getTextContent(), o = n.canInsertTextAfter(), s = i.anchor.offset === 0 && i.focus.offset === a.length, c = ue && t && !s && o;
				if (c && i.isCollapsed() && (c = !R(lo(i.anchor, !0))), !c) {
					K(r, Jt, !0);
					let e = j();
					ue && k(e) && e.isCollapsed() && (Zn = e, setTimeout(() => Zn = null));
				}
			}
			return !0;
		}
	}
	var a;
	if (!k(i)) return !0;
	let o = e.data;
	Hn !== null && Ya(!1, r, Hn), i.dirty && Hn === null || !i.isCollapsed() || z(i.anchor.getNode()) || n === null || i.applyDOMRange(n), Hn = null;
	let s = i.anchor, c = i.focus, l = s.getNode(), u = c.getNode();
	if (t === "insertText" || t === "insertTranspose") {
		if (o === "\n") e.preventDefault(), K(r, Yt, !1);
		else if (o === Se) e.preventDefault(), K(r, Xt, void 0);
		else if (o == null && e.dataTransfer) {
			let t = e.dataTransfer.getData("text/plain");
			e.preventDefault(), i.insertRawText(t);
		} else o != null && $n(i, n, o, e.timeStamp, !0) ? (e.preventDefault(), K(r, Zt, o)) : Hn = o;
		return Vn = e.timeStamp, !0;
	}
	switch (e.preventDefault(), t) {
		case "insertFromYank":
		case "insertFromDrop":
		case "insertReplacementText":
			K(r, Zt, e);
			break;
		case "insertFromComposition":
			V(null), K(r, Zt, e);
			break;
		case "insertLineBreak":
			V(null), K(r, Yt, !1);
			break;
		case "insertParagraph":
			V(null), qn && !se ? (qn = !1, K(r, Yt, !1)) : K(r, Xt, void 0);
			break;
		case "insertFromPaste":
		case "insertFromPasteAsQuotation":
			K(r, Qt, e);
			break;
		case "deleteByComposition":
			(function(e, t) {
				return e !== t || L(e) || L(t) || !Da(e) || !Da(t);
			})(l, u) && K(r, $t, e);
			break;
		case "deleteByDrag":
		case "deleteByCut":
			K(r, $t, e);
			break;
		case "deleteContent":
			K(r, Jt, !1);
			break;
		case "deleteWordBackward":
			K(r, en, !0);
			break;
		case "deleteWordForward":
			K(r, en, !1);
			break;
		case "deleteHardLineBackward":
		case "deleteSoftLineBackward":
			K(r, tn, !0);
			break;
		case "deleteContentForward":
		case "deleteHardLineForward":
		case "deleteSoftLineForward":
			K(r, tn, !1);
			break;
		case "formatStrikeThrough":
			K(r, nn, "strikethrough");
			break;
		case "formatBold":
			K(r, nn, "bold");
			break;
		case "formatItalic":
			K(r, nn, "italic");
			break;
		case "formatUnderline":
			K(r, nn, "underline");
			break;
		case "historyUndo":
			K(r, rn, void 0);
			break;
		case "historyRedo": K(r, an, void 0);
	}
	return !0;
}
function or(e) {
	if (q(e.target) && ba(e.target)) return !0;
	let t = I(), n = j(), r = e.data, i = ir(e);
	if (r != null && k(n) && $n(n, i, r, e.timeStamp, !1)) {
		Jn &&= (lr(t, r), !1);
		let i = n.anchor.getNode(), a = ko(yo(t));
		if (a === null) return !0;
		let o = n.isBackward(), s = o ? n.anchor.offset : n.focus.offset, c = o ? n.focus.offset : n.anchor.offset;
		ae && !n.isCollapsed() && O(i) && a.anchorNode !== null && i.getTextContent().slice(0, s) + r + i.getTextContent().slice(s + c) === Ja(a.anchorNode) || K(t, Zt, r);
		let l = r.length;
		S && l > 1 && e.inputType === "insertCompositionText" && !t.isComposing() && (n.anchor.offset -= l), oe || se || de || !t.isComposing() || (zn = 0, V(null));
	} else Ya(!1, t, r === null ? void 0 : r), Jn &&= (lr(t, r || void 0), !1);
	return function() {
		F(), Ue(I());
	}(), !0;
}
function sr(e) {
	let t = I(), n = j();
	if (k(n) && !t.isComposing()) {
		let r = n.anchor, i = n.anchor.getNode();
		V(r.key), (e.timeStamp < zn + 30 || r.type === "element" || !n.isCollapsed() || i.getFormat() !== n.format || O(i) && i.getStyle() !== n.style) && K(t, Zt, Ce);
	}
	return !0;
}
function cr(e) {
	return lr(I(), e.data), !0;
}
function lr(e, t) {
	let n = e._compositionKey;
	if (V(null), n !== null && t != null) {
		if (t === "") {
			let t = H(n), r = ja(e.getElementByKey(n));
			r !== null && r.nodeValue !== null && O(t) && Xa(t, r.nodeValue, null, null, !0);
			return;
		}
		if (t[t.length - 1] === "\n") {
			let t = j();
			if (k(t)) {
				let n = t.focus;
				t.anchor.set(n.key, n.offset, n.type), K(e, pn, null);
				return;
			}
		}
	}
	Ya(!0, e, t);
}
function ur(e) {
	let t = I();
	if (e.key == null) return !0;
	if (Yn && no(e)) return Ji(t, () => {
		lr(t, Xn);
	}), Yn = !1, Xn = "", !0;
	if (function(e) {
		return G(e, "ArrowRight", { shiftKey: "any" });
	}(e)) K(t, sn, e);
	else if (function(e) {
		return G(e, "ArrowRight", eo);
	}(e)) K(t, cn, e);
	else if (function(e) {
		return G(e, "ArrowLeft", { shiftKey: "any" });
	}(e)) K(t, ln, e);
	else if (function(e) {
		return G(e, "ArrowLeft", eo);
	}(e)) K(t, un, e);
	else if (function(e) {
		return G(e, "ArrowUp", {
			altKey: "any",
			shiftKey: "any"
		});
	}(e)) K(t, dn, e);
	else if (function(e) {
		return G(e, "ArrowDown", {
			altKey: "any",
			shiftKey: "any"
		});
	}(e)) K(t, fn, e);
	else if (function(e) {
		return G(e, "Enter", {
			altKey: "any",
			ctrlKey: "any",
			metaKey: "any",
			shiftKey: !0
		});
	}(e)) qn = !0, K(t, pn, e);
	else if (function(e) {
		return e.key === " ";
	}(e)) K(t, mn, e);
	else if (function(e) {
		return x && G(e, "o", { ctrlKey: !0 });
	}(e)) e.preventDefault(), qn = !0, K(t, Yt, !0);
	else if (function(e) {
		return G(e, "Enter", {
			altKey: "any",
			ctrlKey: "any",
			metaKey: "any"
		});
	}(e)) qn = !1, K(t, pn, e);
	else if (function(e) {
		return G(e, "Backspace", { shiftKey: "any" }) || x && G(e, "h", { ctrlKey: !0 });
	}(e)) no(e) ? K(t, hn, e) : (e.preventDefault(), K(t, Jt, !0));
	else if (function(e) {
		return e.key === "Escape";
	}(e)) K(t, gn, e);
	else if (function(e) {
		return G(e, "Delete", {}) || x && G(e, "d", { ctrlKey: !0 });
	}(e)) (function(e) {
		return e.key === "Delete";
	})(e) ? K(t, _n, e) : (e.preventDefault(), K(t, Jt, !1));
	else if (function(e) {
		return G(e, "Backspace", to);
	}(e)) e.preventDefault(), K(t, en, !0);
	else if (function(e) {
		return G(e, "Delete", to);
	}(e)) e.preventDefault(), K(t, en, !1);
	else if (function(e) {
		return x && G(e, "Backspace", { metaKey: !0 });
	}(e)) e.preventDefault(), K(t, tn, !0);
	else if (function(e) {
		return x && (G(e, "Delete", { metaKey: !0 }) || G(e, "k", { ctrlKey: !0 }));
	}(e)) e.preventDefault(), K(t, tn, !1);
	else if (function(e) {
		return G(e, "b", eo);
	}(e)) e.preventDefault(), K(t, nn, "bold");
	else if (function(e) {
		return G(e, "u", eo);
	}(e)) e.preventDefault(), K(t, nn, "underline");
	else if (function(e) {
		return G(e, "i", eo);
	}(e)) e.preventDefault(), K(t, nn, "italic");
	else if (function(e) {
		return G(e, "Tab", { shiftKey: "any" });
	}(e)) K(t, vn, e);
	else if (function(e) {
		return G(e, "z", eo);
	}(e)) e.preventDefault(), K(t, rn, void 0);
	else if (function(e) {
		return x ? G(e, "z", {
			metaKey: !0,
			shiftKey: !0
		}) : G(e, "y", { ctrlKey: !0 }) || G(e, "z", {
			ctrlKey: !0,
			shiftKey: !0
		});
	}(e)) e.preventDefault(), K(t, an, void 0);
	else {
		let n = t._editorState._selection;
		n === null || k(n) ? ro(e) && (e.preventDefault(), K(t, kn, e)) : function(e) {
			return G(e, "c", eo);
		}(e) ? (e.preventDefault(), K(t, Dn, e)) : function(e) {
			return G(e, "x", eo);
		}(e) ? (e.preventDefault(), K(t, On, e)) : ro(e) && (e.preventDefault(), K(t, kn, e));
	}
	return function(e) {
		return e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;
	}(e) && t.dispatchCommand(In, e), !0;
}
function dr(e) {
	let t = e.__lexicalEventHandles;
	return t === void 0 && (t = [], e.__lexicalEventHandles = t), t;
}
var fr = /* @__PURE__ */ new Map();
function pr(e) {
	let t = Ao(e.target);
	if (t === null) return;
	let n = wa(t.anchorNode);
	if (n === null) return;
	Kn && (Kn = !1, Ji(n, () => {
		let r = yi(), i = t.anchorNode;
		(q(i) || ka(i)) && W(vi(r, t, n, e));
	}));
	let r = Ka(n), i = r[r.length - 1], a = i._key, o = fr.get(a), s = o || i;
	s !== n && tr(t, s, !1), tr(t, n, !0), n === i ? o && fr.delete(a) : fr.set(a, n);
}
function mr(e) {
	e._lexicalHandled = !0;
}
function hr(e) {
	return !0 === e._lexicalHandled;
}
function gr(e) {
	let t = Un.get(e);
	if (t === void 0) return;
	let n = Wn.get(t);
	if (n === void 0) return;
	let r = n - 1;
	r >= 0 || y(164), Un.delete(e), Wn.set(t, r), r === 0 && t.removeEventListener("selectionchange", pr);
	let i = Ta(e);
	Ca(i) ? (function(e) {
		if (e._parentEditor !== null) {
			let t = Ka(e), n = t[t.length - 1]._key;
			fr.get(n) === e && fr.delete(n);
		} else fr.delete(e._key);
	}(i), e.__lexicalEditor = null) : i && y(198);
	let a = dr(e);
	for (let e = 0; e < a.length; e++) a[e]();
	e.__lexicalEventHandles = [];
}
function _r(e, t, n) {
	F();
	let r = e.__key, i = e.getParent();
	if (i === null) return;
	let a = function(e) {
		let t = j();
		if (!k(t) || !L(e)) return t;
		let { anchor: n, focus: r } = t, i = n.getNode(), a = r.getNode();
		return _o(i, e) && n.set(e.__key, 0, "element"), _o(a, e) && r.set(e.__key, 0, "element"), t;
	}(e), o = !1;
	if (k(a) && t) {
		let t = a.anchor, n = a.focus;
		t.key === r && (Si(t, e, i, e.getPreviousSibling(), e.getNextSibling()), o = !0), n.key === r && (Si(n, e, i, e.getPreviousSibling(), e.getNextSibling()), o = !0);
	} else A(a) && t && e.isSelected() && e.selectPrevious();
	if (k(a) && t && !o) {
		let t = e.getIndexWithinParent();
		Fa(e), bi(a, i, t, -1);
	} else Fa(e);
	n || So(i) || i.canBeEmpty() || !i.isEmpty() || _r(i, t), t && a && z(i) && i.isEmpty() && i.selectEnd();
}
function vr(e) {
	return e;
}
var yr = Symbol.for("ephemeral");
function br(e) {
	return e[yr] || !1;
}
var xr = class {
	__type;
	__key;
	__parent;
	__prev;
	__next;
	__state;
	static getType() {
		let { ownNodeType: e } = qo(this);
		return e === void 0 && y(64, this.name), e;
	}
	static clone(e) {
		y(65, this.name);
	}
	$config() {
		return {};
	}
	config(e, t) {
		let n = t.extends || Object.getPrototypeOf(this.constructor);
		return Object.assign(t, {
			extends: n,
			type: e
		}), { [e]: t };
	}
	afterCloneFrom(e) {
		this.__key === e.__key ? (this.__parent = e.__parent, this.__next = e.__next, this.__prev = e.__prev, this.__state = e.__state) : e.__state && (this.__state = e.__state.getWritable(this));
	}
	static importDOM;
	constructor(e) {
		this.__type = this.constructor.getType(), this.__parent = null, this.__prev = null, this.__next = null, Object.defineProperty(this, "__state", {
			configurable: !0,
			enumerable: !1,
			value: void 0,
			writable: !0
		}), Pa(this, e);
	}
	getType() {
		return this.__type;
	}
	isInline() {
		y(137, this.constructor.name);
	}
	isAttached() {
		let e = this.__key;
		for (; e !== null;) {
			if (e === "root") return !0;
			let t = H(e);
			if (t === null) break;
			e = t.__parent;
		}
		return !1;
	}
	isSelected(e) {
		let t = e || j();
		if (t == null) return !1;
		let n = t.getNodes().some((e) => e.__key === this.__key);
		if (O(this)) return n;
		if (k(t) && t.anchor.type === "element" && t.focus.type === "element") {
			if (t.isCollapsed()) return !1;
			let e = this.getParent();
			if (R(this) && this.isInline() && e) {
				let n = t.isBackward() ? t.focus : t.anchor;
				if (e.is(n.getNode()) && n.offset === e.getChildrenSize() && this.is(e.getLastChild())) return !1;
			}
		}
		return n;
	}
	getKey() {
		return this.__key;
	}
	getIndexWithinParent() {
		let e = this.getParent();
		if (e === null) return -1;
		let t = e.getFirstChild(), n = 0;
		for (; t !== null;) {
			if (this.is(t)) return n;
			n++, t = t.getNextSibling();
		}
		return -1;
	}
	getParent() {
		let e = this.getLatest().__parent;
		return e === null ? null : H(e);
	}
	getParentOrThrow() {
		let e = this.getParent();
		return e === null && y(66, this.__key), e;
	}
	getTopLevelElement() {
		let e = this;
		for (; e !== null;) {
			let t = e.getParent();
			if (So(t)) return L(e) || e === this && R(e) || y(194), e;
			e = t;
		}
		return null;
	}
	getTopLevelElementOrThrow() {
		let e = this.getTopLevelElement();
		return e === null && y(67, this.__key), e;
	}
	getParents() {
		let e = [], t = this.getParent();
		for (; t !== null;) e.push(t), t = t.getParent();
		return e;
	}
	getParentKeys() {
		let e = [], t = this.getParent();
		for (; t !== null;) e.push(t.__key), t = t.getParent();
		return e;
	}
	getPreviousSibling() {
		let e = this.getLatest().__prev;
		return e === null ? null : H(e);
	}
	getPreviousSiblings() {
		let e = [], t = this.getParent();
		if (t === null) return e;
		let n = t.getFirstChild();
		for (; n !== null && !n.is(this);) e.push(n), n = n.getNextSibling();
		return e;
	}
	getNextSibling() {
		let e = this.getLatest().__next;
		return e === null ? null : H(e);
	}
	getNextSiblings() {
		let e = [], t = this.getNextSibling();
		for (; t !== null;) e.push(t), t = t.getNextSibling();
		return e;
	}
	getCommonAncestor(e) {
		let t = L(this) ? this : this.getParent(), n = L(e) ? e : e.getParent(), r = t && n ? ws(t, n) : null;
		return r ? r.commonAncestor : null;
	}
	is(e) {
		return e != null && this.__key === e.__key;
	}
	isBefore(e) {
		let t = ws(this, e);
		return t !== null && (t.type === "descendant" || (t.type === "branch" ? xs(t) === -1 : (t.type !== "same" && t.type !== "ancestor" && y(279), !1)));
	}
	isParentOf(e) {
		let t = ws(this, e);
		return t !== null && t.type === "ancestor";
	}
	getNodesBetween(e) {
		let t = this.isBefore(e), n = [], r = /* @__PURE__ */ new Set(), i = this;
		for (; i !== null;) {
			let a = i.__key;
			if (r.has(a) || (r.add(a), n.push(i)), i === e) break;
			let o = L(i) ? t ? i.getFirstChild() : i.getLastChild() : null;
			if (o !== null) {
				i = o;
				continue;
			}
			let s = t ? i.getNextSibling() : i.getPreviousSibling();
			if (s !== null) {
				i = s;
				continue;
			}
			let c = i.getParentOrThrow();
			if (r.has(c.__key) || n.push(c), c === e) break;
			let l = null, u = c;
			do {
				if (u === null && y(68), l = t ? u.getNextSibling() : u.getPreviousSibling(), u = u.getParent(), u === null) break;
				l !== null || r.has(u.__key) || n.push(u);
			} while (l === null);
			i = l;
		}
		return t || n.reverse(), n;
	}
	isDirty() {
		let e = I()._dirtyLeaves;
		return e !== null && e.has(this.__key);
	}
	getLatest() {
		if (br(this)) return this;
		let e = H(this.__key);
		return e === null && y(113), e;
	}
	getWritable() {
		if (br(this)) return this;
		F();
		let e = Fi(), t = I(), n = e._nodeMap, r = this.__key, i = this.getLatest(), a = t._cloneNotNeeded, o = j();
		if (o !== null && o.setCachedNodes(null), a.has(r)) return Ia(i), i;
		let s = Vo(i);
		return a.add(r), Ia(s), n.set(r, s), s;
	}
	getTextContent() {
		return "";
	}
	getTextContentSize() {
		return this.getTextContent().length;
	}
	createDOM(e, t) {
		y(70);
	}
	updateDOM(e, t, n) {
		y(71);
	}
	exportDOM(e) {
		return { element: this.createDOM(e._config, e) };
	}
	exportJSON() {
		let e = this.__state ? this.__state.toJSON() : void 0;
		return {
			type: this.__type,
			version: 1,
			...e
		};
	}
	static importJSON(e) {
		y(18, this.name);
	}
	updateFromJSON(e) {
		return function(e, t) {
			let n = e.getWritable(), r = t.$, i = r;
			for (let e of Qe(n).flatKeys) e in t && (i !== void 0 && i !== r || (i = { ...r }), i[e] = t[e]);
			return (n.__state || i) && Ze(e).updateFromJSON(i), n;
		}(this, e);
	}
	static transform() {
		return null;
	}
	remove(e) {
		_r(this, !0, e);
	}
	replace(e, t) {
		F();
		let n = j();
		n !== null && (n = n.clone()), To(this, e);
		let r = this.getLatest(), i = this.__key, a = e.__key, o = e.getWritable(), s = this.getParentOrThrow().getWritable(), c = s.__size;
		Fa(o);
		let l = r.getPreviousSibling(), u = r.getNextSibling(), d = r.__prev, f = r.__next, p = r.__parent;
		if (_r(r, !1, !0), l === null ? s.__first = a : l.getWritable().__next = a, o.__prev = d, u === null ? s.__last = a : u.getWritable().__prev = a, o.__next = f, o.__parent = p, s.__size = c, t && (L(this) && L(o) || y(139), this.getChildren().forEach((e) => {
			o.append(e);
		})), k(n)) {
			W(n);
			let e = n.anchor, t = n.focus;
			e.key === i && ti(e, o), t.key === i && ti(t, o);
		}
		return La() === i && V(a), o;
	}
	insertAfter(e, t = !0) {
		F(), To(this, e);
		let n = this.getWritable(), r = e.getWritable(), i = r.getParent(), a = j(), o = !1, s = !1;
		if (i !== null) {
			let t = e.getIndexWithinParent();
			if (Fa(r), k(a)) {
				let e = i.__key, n = a.anchor, r = a.focus;
				o = n.type === "element" && n.key === e && n.offset === t + 1, s = r.type === "element" && r.key === e && r.offset === t + 1;
			}
		}
		let c = this.getNextSibling(), l = this.getParentOrThrow().getWritable(), u = r.__key, d = n.__next;
		if (c === null ? l.__last = u : c.getWritable().__prev = u, l.__size++, n.__next = u, r.__next = d, r.__prev = n.__key, r.__parent = n.__parent, t && k(a)) {
			let e = this.getIndexWithinParent();
			bi(a, l, e + 1);
			let t = l.__key;
			o && a.anchor.set(t, e + 2, "element"), s && a.focus.set(t, e + 2, "element");
		}
		return e;
	}
	insertBefore(e, t = !0) {
		F(), To(this, e);
		let n = this.getWritable(), r = e.getWritable(), i = r.__key;
		Fa(r);
		let a = this.getPreviousSibling(), o = this.getParentOrThrow().getWritable(), s = n.__prev, c = this.getIndexWithinParent();
		a === null ? o.__first = i : a.getWritable().__next = i, o.__size++, n.__prev = i, r.__prev = s, r.__next = n.__key, r.__parent = n.__parent;
		let l = j();
		return t && k(l) && bi(l, this.getParentOrThrow(), c), e;
	}
	isParentRequired() {
		return !1;
	}
	createParentElementNode() {
		return B();
	}
	selectStart() {
		return this.selectPrevious();
	}
	selectEnd() {
		return this.selectNext(0, 0);
	}
	selectPrevious(e, t) {
		F();
		let n = this.getPreviousSibling(), r = this.getParentOrThrow();
		if (n === null) return r.select(0, 0);
		if (L(n)) return n.select();
		if (!O(n)) {
			let e = n.getIndexWithinParent() + 1;
			return r.select(e, e);
		}
		return n.select(e, t);
	}
	selectNext(e, t) {
		F();
		let n = this.getNextSibling(), r = this.getParentOrThrow();
		if (n === null) return r.select();
		if (L(n)) return n.select(0, 0);
		if (!O(n)) {
			let e = n.getIndexWithinParent();
			return r.select(e, e);
		}
		return n.select(e, t);
	}
	markDirty() {
		this.getWritable();
	}
	reconcileObservedMutation(e, t) {
		this.markDirty();
	}
}, Sr = "historic", Cr = "history-push", wr = "history-merge", Tr = "collaboration", Er = "skip-collab", Dr = "skip-scroll-into-view", Or = class e extends xr {
	static getType() {
		return "linebreak";
	}
	static clone(t) {
		return new e(t.__key);
	}
	constructor(e) {
		super(e);
	}
	getTextContent() {
		return "\n";
	}
	createDOM() {
		return document.createElement("br");
	}
	updateDOM() {
		return !1;
	}
	isInline() {
		return !0;
	}
	static importDOM() {
		return { br: (e) => function(e) {
			let t = e.parentElement;
			if (t !== null && Fo(t)) {
				let n = t.firstChild;
				if (n === e || n.nextSibling === e && Mr(n)) {
					let n = t.lastChild;
					if (n === e || n.previousSibling === e && Mr(n)) return !0;
				}
			}
			return !1;
		}(e) || function(e) {
			let t = e.parentElement;
			if (t !== null && Fo(t)) {
				let n = t.firstChild;
				if (n === e || n.nextSibling === e && Mr(n)) return !1;
				let r = t.lastChild;
				if (r === e || r.previousSibling === e && Mr(r)) return !0;
			}
			return !1;
		}(e) ? null : {
			conversion: kr,
			priority: 0
		} };
	}
	static importJSON(e) {
		return Ar().updateFromJSON(e);
	}
};
function kr(e) {
	return { node: Ar() };
}
function Ar() {
	return wo(new Or());
}
function jr(e) {
	return e instanceof Or;
}
function Mr(e) {
	return ka(e) && /^( |\t|\r?\n)+$/.test(e.textContent || "");
}
function Nr(e, t) {
	return 16 & t ? "code" : t & 128 ? "mark" : 32 & t ? "sub" : 64 & t ? "sup" : null;
}
function Pr(e, t) {
	return 1 & t ? "strong" : 2 & t ? "em" : "span";
}
function Fr(e, t, n, r, i) {
	let a = r.classList, o = ao(i, "base");
	o !== void 0 && a.add(...o), o = ao(i, "underlineStrikethrough");
	let s = !1, c = 8 & t && 4 & t;
	o !== void 0 && (8 & n && 4 & n ? (s = !0, c || a.add(...o)) : c && a.remove(...o));
	for (let e in C) {
		let r = C[e];
		if (o = ao(i, e), o !== void 0) {
			if (n & r) {
				if (s && (e === "underline" || e === "strikethrough")) {
					t & r && a.remove(...o);
					continue;
				}
				((t & r) === 0 || c && e === "underline" || e === "strikethrough") && a.add(...o);
			} else t & r && a.remove(...o);
		}
	}
}
function Ir(e, t, n) {
	let r = t.firstChild, i = n.isComposing(), a = e + (i ? xe : "");
	if (r == null) t.textContent = a;
	else {
		let e = r.nodeValue;
		if (e !== a) {
			if (i || S) {
				let [t, n, i] = function(e, t) {
					let n = e.length, r = t.length, i = 0, a = 0;
					for (; i < n && i < r && e[i] === t[i];) i++;
					for (; a + i < n && a + i < r && e[n - a - 1] === t[r - a - 1];) a++;
					return [
						i,
						n - i - a,
						t.slice(i, r - a)
					];
				}(e, a);
				n !== 0 && r.deleteData(t, n), r.insertData(t, i);
			} else r.nodeValue = a;
		}
	}
}
function Lr(e, t, n, r, i, a) {
	Ir(i, e, t);
	let o = a.theme.text;
	o !== void 0 && Fr(0, 0, r, e, o);
}
function Rr(e, t) {
	let n = document.createElement(t);
	return n.appendChild(e), n;
}
var zr = class e extends xr {
	__text;
	__format;
	__style;
	__mode;
	__detail;
	static getType() {
		return "text";
	}
	static clone(t) {
		return new e(t.__text, t.__key);
	}
	afterCloneFrom(e) {
		super.afterCloneFrom(e), this.__text = e.__text, this.__format = e.__format, this.__style = e.__style, this.__mode = e.__mode, this.__detail = e.__detail;
	}
	constructor(e = "", t) {
		super(t), this.__text = e, this.__format = 0, this.__style = "", this.__mode = 0, this.__detail = 0;
	}
	getFormat() {
		return this.getLatest().__format;
	}
	getDetail() {
		return this.getLatest().__detail;
	}
	getMode() {
		return Me[this.getLatest().__mode];
	}
	getStyle() {
		return this.getLatest().__style;
	}
	isToken() {
		return this.getLatest().__mode === 1;
	}
	isComposing() {
		return this.__key === La();
	}
	isSegmented() {
		return this.getLatest().__mode === 2;
	}
	isDirectionless() {
		return !!(1 & this.getLatest().__detail);
	}
	isUnmergeable() {
		return !!(2 & this.getLatest().__detail);
	}
	hasFormat(e) {
		let t = C[e];
		return (this.getFormat() & t) !== 0;
	}
	isSimpleText() {
		return this.__type === "text" && this.__mode === 0;
	}
	getTextContent() {
		return this.getLatest().__text;
	}
	getFormatFlags(e, t) {
		return Ma(this.getLatest().__format, e, t);
	}
	canHaveFormat() {
		return !0;
	}
	isInline() {
		return !0;
	}
	createDOM(e, t) {
		let n = this.__format, r = Nr(0, n), i = Pr(0, n), a = r === null ? i : r, o = document.createElement(a), s = o;
		this.hasFormat("code") && o.setAttribute("spellcheck", "false"), r !== null && (s = document.createElement(i), o.appendChild(s)), Lr(s, this, 0, n, this.__text, e);
		let c = this.__style;
		return c !== "" && (o.style.cssText = c), o;
	}
	updateDOM(e, t, n) {
		let r = this.__text, i = e.__format, a = this.__format, o = Nr(0, i), s = Nr(0, a), c = Pr(0, i), l = Pr(0, a);
		if ((o === null ? c : o) !== (s === null ? l : s)) return !0;
		if (o === s && c !== l) {
			let e = t.firstChild;
			e ?? y(48);
			let i = document.createElement(l);
			return Lr(i, this, 0, a, r, n), t.replaceChild(i, e), !1;
		}
		let u = t;
		s !== null && o !== null && (u = t.firstChild, u ?? y(49)), Ir(r, u, this);
		let d = n.theme.text;
		d !== void 0 && i !== a && Fr(0, i, a, u, d);
		let f = e.__style, p = this.__style;
		return f !== p && (t.style.cssText = p), !1;
	}
	static importDOM() {
		return {
			"#text": () => ({
				conversion: Wr,
				priority: 0
			}),
			b: () => ({
				conversion: Vr,
				priority: 0
			}),
			code: () => ({
				conversion: qr,
				priority: 0
			}),
			em: () => ({
				conversion: qr,
				priority: 0
			}),
			i: () => ({
				conversion: qr,
				priority: 0
			}),
			mark: () => ({
				conversion: qr,
				priority: 0
			}),
			s: () => ({
				conversion: qr,
				priority: 0
			}),
			span: () => ({
				conversion: Br,
				priority: 0
			}),
			strong: () => ({
				conversion: qr,
				priority: 0
			}),
			sub: () => ({
				conversion: qr,
				priority: 0
			}),
			sup: () => ({
				conversion: qr,
				priority: 0
			}),
			u: () => ({
				conversion: qr,
				priority: 0
			})
		};
	}
	static importJSON(e) {
		return D().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setTextContent(e.text).setFormat(e.format).setDetail(e.detail).setMode(e.mode).setStyle(e.style);
	}
	exportDOM(e) {
		let { element: t } = super.exportDOM(e);
		return q(t) || y(132), t.style.whiteSpace = "pre-wrap", this.hasFormat("lowercase") ? t.style.textTransform = "lowercase" : this.hasFormat("uppercase") ? t.style.textTransform = "uppercase" : this.hasFormat("capitalize") && (t.style.textTransform = "capitalize"), this.hasFormat("bold") && (t = Rr(t, "b")), this.hasFormat("italic") && (t = Rr(t, "i")), this.hasFormat("strikethrough") && (t = Rr(t, "s")), this.hasFormat("underline") && (t = Rr(t, "u")), { element: t };
	}
	exportJSON() {
		return {
			detail: this.getDetail(),
			format: this.getFormat(),
			mode: this.getMode(),
			style: this.getStyle(),
			text: this.getTextContent(),
			...super.exportJSON()
		};
	}
	selectionTransform(e, t) {}
	setFormat(e) {
		let t = this.getWritable();
		return t.__format = typeof e == "string" ? C[e] : e, t;
	}
	setDetail(e) {
		let t = this.getWritable();
		return t.__detail = typeof e == "string" ? Oe[e] : e, t;
	}
	setStyle(e) {
		let t = this.getWritable();
		return t.__style = e, t;
	}
	toggleFormat(e) {
		let t = Ma(this.getFormat(), e, null);
		return this.setFormat(t);
	}
	toggleDirectionless() {
		let e = this.getWritable();
		return e.__detail ^= 1, e;
	}
	toggleUnmergeable() {
		let e = this.getWritable();
		return e.__detail ^= 2, e;
	}
	setMode(e) {
		let t = je[e];
		if (this.__mode === t) return this;
		let n = this.getWritable();
		return n.__mode = t, n;
	}
	setTextContent(e) {
		if (this.__text === e) return this;
		let t = this.getWritable();
		return t.__text = e, t;
	}
	select(e, t) {
		F();
		let n = e, r = t, i = j(), a = this.getTextContent(), o = this.__key;
		if (typeof a == "string") {
			let e = a.length;
			n === void 0 && (n = e), r === void 0 && (r = e);
		} else n = 0, r = 0;
		if (!k(i)) return mi(o, n, o, r, "text", "text");
		{
			let e = La();
			e !== i.anchor.key && e !== i.focus.key || V(o), i.setTextNodeRange(this, n, this, r);
		}
		return i;
	}
	selectStart() {
		return this.select(0, 0);
	}
	selectEnd() {
		let e = this.getTextContentSize();
		return this.select(e, e);
	}
	spliceText(e, t, n, r) {
		let i = this.getWritable(), a = i.__text, o = n.length, s = e;
		s < 0 && (s = o + s, s < 0 && (s = 0));
		let c = j();
		if (r && k(c)) {
			let t = e + o;
			c.setTextNodeRange(i, t, i, t);
		}
		return i.__text = a.slice(0, s) + n + a.slice(s + t), i;
	}
	canInsertTextBefore() {
		return !0;
	}
	canInsertTextAfter() {
		return !0;
	}
	splitText(...e) {
		F();
		let t = this.getLatest(), n = t.getTextContent();
		if (n === "") return [];
		let r = t.__key, i = La(), a = n.length;
		e.sort((e, t) => e - t), e.push(a);
		let o = [], s = e.length;
		for (let t = 0, r = 0; t < a && r <= s; r++) {
			let i = e[r];
			i > t && (o.push(n.slice(t, i)), t = i);
		}
		let c = o.length;
		if (c === 1) return [t];
		let l = o[0], u = t.getParent(), d, f = t.getFormat(), p = t.getStyle(), m = t.__detail, ee = !1, h = null, g = null, _ = j();
		if (k(_)) {
			let [e, t] = _.isBackward() ? [_.focus, _.anchor] : [_.anchor, _.focus];
			e.type === "text" && e.key === r && (h = e), t.type === "text" && t.key === r && (g = t);
		}
		t.isSegmented() ? (d = D(l), d.__format = f, d.__style = p, d.__detail = m, d.__state = rt(t, d), ee = !0) : d = t.setTextContent(l);
		let te = [d];
		for (let e = 1; e < c; e++) {
			let n = D(o[e]);
			n.__format = f, n.__style = p, n.__detail = m, n.__state = rt(t, n);
			let a = n.__key;
			i === r && V(a), te.push(n);
		}
		let v = h ? h.offset : null, ne = g ? g.offset : null, y = 0;
		for (let e of te) {
			if (!h && !g) break;
			let t = y + e.getTextContentSize();
			if (h !== null && v !== null && v <= t && v >= y && (h.set(e.getKey(), v - y, "text"), v < t && (h = null)), g !== null && ne !== null && ne <= t && ne >= y) {
				g.set(e.getKey(), ne - y, "text");
				break;
			}
			y = t;
		}
		if (u !== null) {
			(function(e) {
				let t = e.getPreviousSibling(), n = e.getNextSibling();
				t !== null && Ia(t), n !== null && Ia(n);
			})(this);
			let e = u.getWritable(), t = this.getIndexWithinParent();
			ee ? (e.splice(t, 0, te), this.remove()) : e.splice(t, 1, te), k(_) && bi(_, u, t, c - 1);
		}
		return te;
	}
	mergeWithSibling(e) {
		let t = e === this.getPreviousSibling();
		t || e === this.getNextSibling() || y(50);
		let n = this.__key, r = e.__key, i = this.__text, a = i.length;
		La() === r && V(n);
		let o = j();
		if (k(o)) {
			let i = o.anchor, s = o.focus;
			i !== null && i.key === r && Ci(i, t, n, e, a), s !== null && s.key === r && Ci(s, t, n, e, a);
		}
		let s = e.__text, c = t ? s + i : i + s;
		this.setTextContent(c);
		let l = this.getWritable();
		return e.remove(), l;
	}
	isTextEntity() {
		return !1;
	}
};
function Br(e) {
	return {
		forChild: Jr(e.style),
		node: null
	};
}
function Vr(e) {
	let t = e, n = t.style.fontWeight === "normal";
	return {
		forChild: Jr(t.style, n ? void 0 : "bold"),
		node: null
	};
}
var Hr = /* @__PURE__ */ new WeakMap();
function Ur(e) {
	if (!q(e)) return !1;
	if (e.nodeName === "PRE") return !0;
	let t = e.style.whiteSpace;
	return typeof t == "string" && t.startsWith("pre");
}
function Wr(e) {
	let t = e;
	e.parentElement === null && y(129);
	let n = t.textContent || "";
	if (function(e) {
		let t, n = e.parentNode, r = [e];
		for (; n !== null && (t = Hr.get(n)) === void 0 && !Ur(n);) r.push(n), n = n.parentNode;
		let i = t === void 0 ? n : t;
		for (let e = 0; e < r.length; e++) Hr.set(r[e], i);
		return i;
	}(t) !== null) {
		let e = n.split(/(\r?\n|\t)/), t = [], r = e.length;
		for (let n = 0; n < r; n++) {
			let r = e[n];
			r === "\n" || r === "\r\n" ? t.push(Ar()) : r === "	" ? t.push(Xr()) : r !== "" && t.push(D(r));
		}
		return { node: t };
	}
	if (n = n.replace(/\r/g, "").replace(/[ \t\n]+/g, " "), n === "") return { node: null };
	if (n[0] === " ") {
		let e = t, r = !0;
		for (; e !== null && (e = Gr(e, !1)) !== null;) {
			let t = e.textContent || "";
			if (t.length > 0) {
				/[ \t\n]$/.test(t) && (n = n.slice(1)), r = !1;
				break;
			}
		}
		r && (n = n.slice(1));
	}
	if (n[n.length - 1] === " ") {
		let e = t, r = !0;
		for (; e !== null && (e = Gr(e, !0)) !== null;) if ((e.textContent || "").replace(/^( |\t|\r?\n)+/, "").length > 0) {
			r = !1;
			break;
		}
		r && (n = n.slice(0, n.length - 1));
	}
	return n === "" ? { node: null } : { node: D(n) };
}
function Gr(e, t) {
	let n = e;
	for (;;) {
		let e;
		for (; (e = t ? n.nextSibling : n.previousSibling) === null;) {
			let e = n.parentElement;
			if (e === null) return null;
			n = e;
		}
		if (n = e, q(n)) {
			let e = n.style.display;
			if (e === "" && !Po(n) || e !== "" && !e.startsWith("inline")) return null;
		}
		let r = n;
		for (; (r = t ? n.firstChild : n.lastChild) !== null;) n = r;
		if (ka(n)) return n;
		if (n.nodeName === "BR") return null;
	}
}
var Kr = {
	code: "code",
	em: "italic",
	i: "italic",
	mark: "highlight",
	s: "strikethrough",
	strong: "bold",
	sub: "subscript",
	sup: "superscript",
	u: "underline"
};
function qr(e) {
	let t = Kr[e.nodeName.toLowerCase()];
	return t === void 0 ? { node: null } : {
		forChild: Jr(e.style, t),
		node: null
	};
}
function D(e = "") {
	return wo(new zr(e));
}
function O(e) {
	return e instanceof zr;
}
function Jr(e, t) {
	let n = e.fontWeight, r = e.textDecoration.split(" "), i = n === "700" || n === "bold", a = r.includes("line-through"), o = e.fontStyle === "italic", s = r.includes("underline"), c = e.verticalAlign;
	return (e) => (O(e) && (i && !e.hasFormat("bold") && e.toggleFormat("bold"), a && !e.hasFormat("strikethrough") && e.toggleFormat("strikethrough"), o && !e.hasFormat("italic") && e.toggleFormat("italic"), s && !e.hasFormat("underline") && e.toggleFormat("underline"), c !== "sub" || e.hasFormat("subscript") || e.toggleFormat("subscript"), c !== "super" || e.hasFormat("superscript") || e.toggleFormat("superscript"), t && !e.hasFormat(t) && e.toggleFormat(t)), e);
}
var Yr = class e extends zr {
	static getType() {
		return "tab";
	}
	static clone(t) {
		return new e(t.__key);
	}
	constructor(e) {
		super("	", e), this.__detail = 2;
	}
	static importDOM() {
		return null;
	}
	createDOM(e) {
		let t = super.createDOM(e), n = ao(e.theme, "tab");
		return n !== void 0 && t.classList.add(...n), t;
	}
	static importJSON(e) {
		return Xr().updateFromJSON(e);
	}
	setTextContent(e) {
		return e !== "	" && e !== "" && re(126), super.setTextContent("	");
	}
	spliceText(e, t, n, r) {
		return n === "" && t === 0 || n === "	" && t === 1 || y(286), this;
	}
	setDetail(e) {
		return e !== 2 && y(127), this;
	}
	setMode(e) {
		return e !== "normal" && y(128), this;
	}
	canInsertTextBefore() {
		return !1;
	}
	canInsertTextAfter() {
		return !1;
	}
};
function Xr() {
	return wo(new Yr());
}
function Zr(e) {
	return e instanceof Yr;
}
var Qr = class {
	key;
	offset;
	type;
	_selection;
	constructor(e, t, n) {
		this._selection = null, this.key = e, this.offset = t, this.type = n;
	}
	is(e) {
		return this.key === e.key && this.offset === e.offset && this.type === e.type;
	}
	isBefore(e) {
		return this.key === e.key ? this.offset < e.offset : bs(Ps(Ts(this, "next")), Ps(Ts(e, "next"))) < 0;
	}
	getNode() {
		let e = H(this.key);
		return e === null && y(20), e;
	}
	set(e, t, n, r) {
		let i = this._selection, a = this.key;
		r && this.key === e && this.offset === t && this.type === n || (this.key = e, this.offset = t, this.type = n, Ni() || (La() === a && V(e), i !== null && (i.setCachedNodes(null), i.dirty = !0)));
	}
};
function $r(e, t, n) {
	return new Qr(e, t, n);
}
function ei(e, t) {
	let n = t.__key, r = e.offset, i = "element";
	if (O(t)) {
		i = "text";
		let e = t.getTextContentSize();
		r > e && (r = e);
	} else if (!L(t)) {
		let e = t.getNextSibling();
		if (O(e)) n = e.__key, r = 0, i = "text";
		else {
			let e = t.getParent();
			e && (n = e.__key, r = t.getIndexWithinParent() + 1);
		}
	}
	e.set(n, r, i);
}
function ti(e, t) {
	if (L(t)) {
		let n = t.getLastDescendant();
		L(n) || O(n) ? ei(e, n) : ei(e, t);
	} else ei(e, t);
}
var ni = class e {
	_nodes;
	_cachedNodes;
	dirty;
	constructor(e) {
		this._cachedNodes = null, this._nodes = e, this.dirty = !1;
	}
	getCachedNodes() {
		return this._cachedNodes;
	}
	setCachedNodes(e) {
		this._cachedNodes = e;
	}
	is(e) {
		if (!A(e)) return !1;
		let t = this._nodes, n = e._nodes;
		return t.size === n.size && Array.from(t).every((e) => n.has(e));
	}
	isCollapsed() {
		return !1;
	}
	isBackward() {
		return !1;
	}
	getStartEndPoints() {
		return null;
	}
	add(e) {
		this.dirty = !0, this._nodes.add(e), this._cachedNodes = null;
	}
	delete(e) {
		this.dirty = !0, this._nodes.delete(e), this._cachedNodes = null;
	}
	clear() {
		this.dirty = !0, this._nodes.clear(), this._cachedNodes = null;
	}
	has(e) {
		return this._nodes.has(e);
	}
	clone() {
		return new e(new Set(this._nodes));
	}
	extract() {
		return this.getNodes();
	}
	insertRawText(e) {}
	insertText() {}
	insertNodes(e) {
		let t = this.getNodes(), n = t.length, r = t[n - 1], i;
		if (O(r)) i = r.select();
		else {
			let e = r.getIndexWithinParent() + 1;
			i = r.getParentOrThrow().select(e, e);
		}
		i.insertNodes(e);
		for (let e = 0; e < n; e++) t[e].remove();
	}
	getNodes() {
		let e = this._cachedNodes;
		if (e !== null) return e;
		let t = this._nodes, n = [];
		for (let e of t) {
			let t = H(e);
			t !== null && n.push(t);
		}
		return Ni() || (this._cachedNodes = n), n;
	}
	getTextContent() {
		let e = this.getNodes(), t = "";
		for (let n = 0; n < e.length; n++) t += e[n].getTextContent();
		return t;
	}
	deleteNodes() {
		let e = this.getNodes();
		if ((j() || yi()) === this && e[0]) {
			let t = X(e[0], "next");
			Ds(vs(t, t));
		}
		for (let t of e) t.remove();
	}
};
function k(e) {
	return e instanceof ri;
}
var ri = class e {
	format;
	style;
	anchor;
	focus;
	_cachedNodes;
	dirty;
	constructor(e, t, n, r) {
		this.anchor = e, this.focus = t, e._selection = this, t._selection = this, this._cachedNodes = null, this.format = n, this.style = r, this.dirty = !1;
	}
	getCachedNodes() {
		return this._cachedNodes;
	}
	setCachedNodes(e) {
		this._cachedNodes = e;
	}
	is(e) {
		return !!k(e) && this.anchor.is(e.anchor) && this.focus.is(e.focus) && this.format === e.format && this.style === e.style;
	}
	isCollapsed() {
		return this.anchor.is(this.focus);
	}
	getNodes() {
		let e = this._cachedNodes;
		if (e !== null) return e;
		let t = function(e) {
			let t = [], [n, r] = e.getTextSlices();
			n && t.push(n.caret.origin);
			let i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set();
			for (let n of e) if (Y(n)) {
				let { origin: e } = n;
				t.length === 0 ? i.add(e) : (a.add(e), t.push(e));
			} else {
				let { origin: e } = n;
				L(e) && a.has(e) || t.push(e);
			}
			if (r && t.push(r.caret.origin), is(e.focus) && L(e.focus.origin) && e.focus.getNodeAtCaret() === null) for (let n = ds(e.focus.origin, "previous"); Y(n) && i.has(n.origin) && !n.origin.isEmpty() && n.origin.is(t[t.length - 1]); n = ps(n)) i.delete(n.origin), t.pop();
			for (; t.length > 1;) {
				let e = t[t.length - 1];
				if (!L(e) || a.has(e) || e.isEmpty() || i.has(e)) break;
				t.pop();
			}
			if (t.length === 0 && e.isCollapsed()) {
				let n = Ps(e.anchor), r = Ps(e.anchor.getFlipped()), i = (e) => rs(e) ? e.origin : e.getNodeAtCaret(), a = i(n) || i(r) || (e.anchor.getNodeAtCaret() ? n.origin : r.origin);
				t.push(a);
			}
			return t;
		}(Ls(ks(this), "next"));
		return Ni() || (this._cachedNodes = t), t;
	}
	setTextNodeRange(e, t, n, r) {
		this.anchor.set(e.__key, t, "text"), this.focus.set(n.__key, r, "text");
	}
	getTextContent() {
		let e = this.getNodes();
		if (e.length === 0) return "";
		let t = e[0], n = e[e.length - 1], r = this.anchor, i = this.focus, a = r.isBefore(i), [o, s] = ai(this), c = "", l = !0;
		for (let u = 0; u < e.length; u++) {
			let d = e[u];
			if (L(d) && !d.isInline()) l || (c += "\n"), l = !d.isEmpty();
			else if (l = !1, O(d)) {
				let e = d.getTextContent();
				d === t ? d === n ? r.type === "element" && i.type === "element" && i.offset !== r.offset || (e = o < s ? e.slice(o, s) : e.slice(s, o)) : e = a ? e.slice(o) : e.slice(s) : d === n && (e = a ? e.slice(0, s) : e.slice(0, o)), c += e;
			} else !R(d) && !jr(d) || d === n && this.isCollapsed() || (c += d.getTextContent());
		}
		return c;
	}
	applyDOMRange(e) {
		let t = I(), n = t.getEditorState()._selection, r = fi(e.startContainer, e.startOffset, e.endContainer, e.endOffset, t, n);
		if (r === null) return;
		let [i, a] = r;
		this.anchor.set(i.key, i.offset, i.type, !0), this.focus.set(a.key, a.offset, a.type, !0), st(this);
	}
	clone() {
		let t = this.anchor, n = this.focus;
		return new e($r(t.key, t.offset, t.type), $r(n.key, n.offset, n.type), this.format, this.style);
	}
	toggleFormat(e) {
		this.format = Ma(this.format, e, null), this.dirty = !0;
	}
	setFormat(e) {
		this.format = e, this.dirty = !0;
	}
	setStyle(e) {
		this.style = e, this.dirty = !0;
	}
	hasFormat(e) {
		let t = C[e];
		return (this.format & t) !== 0;
	}
	insertRawText(e) {
		let t = e.split(/(\r?\n|\t)/), n = [], r = t.length;
		for (let e = 0; e < r; e++) {
			let r = t[e];
			r === "\n" || r === "\r\n" ? n.push(Ar()) : r === "	" ? n.push(Xr()) : n.push(D(r));
		}
		this.insertNodes(n);
	}
	insertText(e) {
		let t = this.anchor, n = this.focus, r = this.format, i = this.style, a = t, o = n;
		!this.isCollapsed() && n.isBefore(t) && (a = n, o = t), a.type === "element" && function(e, t, n, r) {
			let i = e.getNode(), a = i.getChildAtIndex(e.offset), o = D();
			if (o.setFormat(n), o.setStyle(r), la(a)) a.splice(0, 0, [o]);
			else {
				let e = z(i) ? B().append(o) : o;
				a === null ? i.append(e) : a.insertBefore(e);
			}
			e.is(t) && t.set(o.__key, 0, "text"), e.set(o.__key, 0, "text");
		}(a, o, r, i), o.type === "element" && Es(o, Ps(Ts(o, "next")));
		let s = a.offset, c = o.offset, l = this.getNodes(), u = l.length, d = l[0];
		O(d) || y(26);
		let f = d.getTextContent().length, p = d.getParentOrThrow(), m = l[u - 1];
		if (u === 1 && o.type === "element" && (c = f, o.set(a.key, c, "text")), this.isCollapsed() && s === f && (Oa(d) || !d.canInsertTextAfter() || !p.canInsertTextAfter() && d.getNextSibling() === null)) {
			let t = d.getNextSibling();
			if (O(t) && t.canInsertTextBefore() && !Oa(t) || (t = D(), t.setFormat(r), t.setStyle(i), p.canInsertTextAfter() ? d.insertAfter(t) : p.insertAfter(t)), t.select(0, 0), d = t, e !== "") return void this.insertText(e);
		} else if (this.isCollapsed() && s === 0 && (Oa(d) || !d.canInsertTextBefore() || !p.canInsertTextBefore() && d.getPreviousSibling() === null)) {
			let t = d.getPreviousSibling();
			if (O(t) && !Oa(t) || (t = D(), t.setFormat(r), p.canInsertTextBefore() ? d.insertBefore(t) : p.insertBefore(t)), t.select(), d = t, e !== "") return void this.insertText(e);
		} else if (d.isSegmented() && s !== f) {
			let e = D(d.getTextContent());
			e.setFormat(r), d.replace(e), d = e;
		} else if (!this.isCollapsed() && e !== "") {
			let t = m.getParent();
			if (!p.canInsertTextBefore() || !p.canInsertTextAfter() || L(t) && (!t.canInsertTextBefore() || !t.canInsertTextAfter())) return this.insertText(""), di(this.anchor, this.focus, null), void this.insertText(e);
		}
		if (u === 1) {
			if (Da(d)) {
				let t = D(e);
				t.select(), d.replace(t);
				return;
			}
			let t = d.getFormat(), n = d.getStyle();
			if (s !== c || t === r && n === i) {
				if (Zr(d)) {
					let t = D(e);
					t.setFormat(r), t.setStyle(i), t.select(), d.replace(t);
					return;
				}
			} else {
				if (d.getTextContent() !== "") {
					let t = D(e);
					if (t.setFormat(r), t.setStyle(i), t.select(), s === 0) d.insertBefore(t, !1);
					else {
						let [e] = d.splitText(s);
						e.insertAfter(t, !1);
					}
					t.isComposing() && this.anchor.type === "text" && (this.anchor.offset -= e.length);
					return;
				}
				d.setFormat(r), d.setStyle(i);
			}
			let a = c - s;
			d = d.spliceText(s, a, e, !0), d.getTextContent() === "" ? d.remove() : this.anchor.type === "text" && (d.isComposing() ? this.anchor.offset -= e.length : (this.format = t, this.style = n));
		} else {
			let t = /* @__PURE__ */ new Set([...d.getParentKeys(), ...m.getParentKeys()]), n = L(d) ? d : d.getParentOrThrow(), r = L(m) ? m : m.getParentOrThrow(), i = m;
			if (!n.is(r) && r.isInline()) do
				i = r, r = r.getParentOrThrow();
			while (r.isInline());
			if (o.type === "text" && (c !== 0 || m.getTextContent() === "") || o.type === "element" && m.getIndexWithinParent() < c) {
				if (O(m) && !Da(m) && c !== m.getTextContentSize()) {
					if (m.isSegmented()) {
						let e = D(m.getTextContent());
						m.replace(e), m = e;
					}
					z(o.getNode()) || o.type !== "text" || (m = m.spliceText(0, c, "")), t.add(m.__key);
				} else {
					let e = m.getParentOrThrow();
					e.canBeEmpty() || e.getChildrenSize() !== 1 ? m.remove() : e.remove();
				}
			} else t.add(m.__key);
			let a = r.getChildren(), p = new Set(l), ee = n.is(r), h = n.isInline() && d.getNextSibling() === null ? n : d;
			for (let e = a.length - 1; e >= 0; e--) {
				let t = a[e];
				if (t.is(d) || L(t) && t.isParentOf(d)) break;
				t.isAttached() && (!p.has(t) || t.is(i) ? ee || h.insertAfter(t, !1) : t.remove());
			}
			if (!ee) {
				let e = r, n = null;
				for (; e !== null;) {
					let r = e.getChildren(), i = r.length;
					(i === 0 || r[i - 1].is(n)) && (t.delete(e.__key), n = e), e = e.getParent();
				}
			}
			if (Da(d)) {
				if (s === f) d.select();
				else {
					let t = D(e);
					t.select(), d.replace(t);
				}
			} else d = d.spliceText(s, f - s, e, !0), d.getTextContent() === "" ? d.remove() : this.anchor.type === "text" && (d.isComposing() ? this.anchor.offset -= e.length : (this.format = d.getFormat(), this.style = d.getStyle()));
			for (let e = 1; e < u; e++) {
				let n = l[e], r = n.__key;
				t.has(r) || n.remove();
			}
		}
	}
	removeText() {
		let e = j() === this;
		Os(this, Ns(ks(this))), e && j() !== this && W(this);
	}
	formatText(e, t = null) {
		if (this.isCollapsed()) return this.toggleFormat(e), void V(null);
		let n = this.getNodes(), r = [];
		for (let e of n) O(e) && r.push(e);
		let i = (t) => {
			n.forEach((n) => {
				if (L(n)) {
					let r = n.getFormatFlags(e, t);
					n.setTextFormat(r);
				}
			});
		}, a = r.length;
		if (a === 0) return this.toggleFormat(e), V(null), void i(t);
		let o = this.anchor, s = this.focus, c = this.isBackward(), l = c ? s : o, u = c ? o : s, d = 0, f = r[0], p = l.type === "element" ? 0 : l.offset;
		if (l.type === "text" && p === f.getTextContentSize() && (d = 1, f = r[1], p = 0), f == null) return;
		let m = f.getFormatFlags(e, t);
		i(m);
		let ee = a - 1, h = r[ee], g = u.type === "text" ? u.offset : h.getTextContentSize();
		if (f.is(h)) {
			if (p === g) return;
			if (Oa(f) || p === 0 && g === f.getTextContentSize()) f.setFormat(m);
			else {
				let e = f.splitText(p, g), t = p === 0 ? e[0] : e[1];
				t.setFormat(m), l.type === "text" && l.set(t.__key, 0, "text"), u.type === "text" && u.set(t.__key, g - p, "text");
			}
			this.format = m;
			return;
		}
		p === 0 || Oa(f) || ([, f] = f.splitText(p), p = 0), f.setFormat(m);
		let _ = h.getFormatFlags(e, m);
		g > 0 && (g === h.getTextContentSize() || Oa(h) || ([h] = h.splitText(g)), h.setFormat(_));
		for (let t = d + 1; t < ee; t++) {
			let n = r[t], i = n.getFormatFlags(e, _);
			n.setFormat(i);
		}
		l.type === "text" && l.set(f.__key, p, "text"), u.type === "text" && u.set(h.__key, g, "text"), this.format = m | _;
	}
	insertNodes(e) {
		if (e.length === 0) return;
		if (this.isCollapsed() || this.removeText(), this.anchor.key === "root") {
			this.insertParagraph();
			let t = j();
			return k(t) || y(134), t.insertNodes(e);
		}
		let t = (this.isBackward() ? this.focus : this.anchor).getNode(), n = J(t, Io), r = e[e.length - 1];
		if (L(n) && "__language" in n) {
			if ("__language" in e[0]) this.insertText(e[0].getTextContent());
			else {
				let t = Di(this);
				n.splice(t, 0, e), r.selectEnd();
			}
			return;
		}
		if (!e.some((e) => (L(e) || R(e)) && !e.isInline())) {
			L(n) || y(211, t.constructor.name, t.getType());
			let i = Di(this);
			n.splice(i, 0, e), r.selectEnd();
			return;
		}
		let i = function(e) {
			let t = B(), n = null;
			for (let r = 0; r < e.length; r++) {
				let i = e[r], a = jr(i);
				if (a || R(i) && i.isInline() || L(i) && i.isInline() || O(i) || i.isParentRequired()) {
					if (n === null && (n = i.createParentElementNode(), t.append(n), a)) continue;
					n !== null && n.append(i);
				} else t.append(i), n = null;
			}
			return t;
		}(e), a = i.getLastDescendant(), o = i.getChildren(), s = !L(n) || !n.isEmpty() ? this.insertParagraph() : null, c = o[o.length - 1], l = o[0];
		var u;
		L(u = l) && Io(u) && !u.isEmpty() && L(n) && (!n.isEmpty() || n.canMergeWhenEmpty()) && (L(n) || y(211, t.constructor.name, t.getType()), n.append(...l.getChildren()), l = o[1]), l && (n === null && y(212, t.constructor.name, t.getType()), function(e, t) {
			let n = t.getParentOrThrow().getLastChild(), r = t, i = [t];
			for (; r !== n;) r.getNextSibling() || y(140), r = r.getNextSibling(), i.push(r);
			let a = e;
			for (let e of i) a = a.insertAfter(e);
		}(n, l));
		let d = J(a, Io);
		s && L(d) && (s.canMergeWhenEmpty() || Io(c)) && (d.append(...s.getChildren()), s.remove()), L(n) && n.isEmpty() && n.remove(), a.selectEnd();
		let f = L(n) ? n.getLastChild() : null;
		jr(f) && d !== n && f.remove();
	}
	insertParagraph() {
		if (this.anchor.key === "root") {
			let e = B();
			return U().splice(this.anchor.offset, 0, [e]), e.select(), e;
		}
		let e = Di(this), t = J(this.anchor.getNode(), Io);
		L(t) || y(213);
		let n = t.getChildAtIndex(e), r = n ? [n, ...n.getNextSiblings()] : [], i = t.insertNewAfter(this, !1);
		return i ? (i.append(...r), i.selectStart(), i) : null;
	}
	insertLineBreak(e) {
		let t = Ar();
		if (this.insertNodes([t]), e) {
			let e = t.getParentOrThrow(), n = t.getIndexWithinParent();
			e.select(n, n);
		}
	}
	extract() {
		let e = [...this.getNodes()], t = e.length, n = e[0], r = e[t - 1], [i, a] = ai(this), o = this.isBackward(), [s, c] = o ? [this.focus, this.anchor] : [this.anchor, this.focus], [l, u] = o ? [a, i] : [i, a];
		if (t === 0) return [];
		if (t === 1) {
			if (O(n) && !this.isCollapsed()) {
				let e = n.splitText(l, u), t = l === 0 ? e[0] : e[1];
				return t ? (s.set(t.getKey(), 0, "text"), c.set(t.getKey(), t.getTextContentSize(), "text"), [t]) : [];
			}
			return [n];
		}
		if (O(n) && (l === n.getTextContentSize() ? e.shift() : l !== 0 && ([, n] = n.splitText(l), e[0] = n, s.set(n.getKey(), 0, "text"))), O(r)) {
			let t = r.getTextContent().length;
			u === 0 ? e.pop() : u !== t && ([r] = r.splitText(u), e[e.length - 1] = r, c.set(r.getKey(), r.getTextContentSize(), "text"));
		}
		return e;
	}
	modify(e, t, n) {
		if (ki(this, e, t, n)) return;
		let r = e === "move", i = I(), a = ko(yo(i));
		if (!a) return;
		let o = i._blockCursorElement, s = i._rootElement, c = this.focus.getNode();
		if (s === null || o === null || !L(c) || c.isInline() || c.canBeEmpty() || Oo(o, i, s), this.dirty) {
			let e = fo(i, this.anchor.key), t = fo(i, this.focus.key);
			this.anchor.type === "text" && (e = ja(e)), this.focus.type === "text" && (t = ja(t)), e && t && wi(a, e, this.anchor.offset, t, this.focus.offset);
		}
		if (function(e, t, n, r) {
			e.modify(t, n, r);
		}(a, e, t ? "backward" : "forward", n), a.rangeCount > 0) {
			let e = a.getRangeAt(0), n = this.anchor.getNode(), i = z(n) ? n : xo(n);
			if (this.applyDOMRange(e), this.dirty = !0, !r) {
				let n = this.getNodes(), r = [], o = !1;
				for (let e = 0; e < n.length; e++) {
					let t = n[e];
					_o(t, i) ? r.push(t) : o = !0;
				}
				if (o && r.length > 0) {
					if (t) {
						let e = r[0];
						L(e) ? e.selectStart() : e.getParentOrThrow().selectStart();
					} else {
						let e = r[r.length - 1];
						L(e) ? e.selectEnd() : e.getParentOrThrow().selectEnd();
					}
				}
				a.anchorNode === e.startContainer && a.anchorOffset === e.startOffset || function(e) {
					let t = e.focus, n = e.anchor, r = n.key, i = n.offset, a = n.type;
					n.set(t.key, t.offset, t.type, !0), t.set(r, i, a, !0);
				}(this);
			}
		}
		n === "lineboundary" && ki(this, e, t, n, "decorators");
	}
	forwardDeletion(e, t, n) {
		if (!n && (e.type === "element" && L(t) && e.offset === t.getChildrenSize() || e.type === "text" && e.offset === t.getTextContentSize())) {
			let e = t.getParent(), n = t.getNextSibling() || (e === null ? null : e.getNextSibling());
			if (L(n) && n.isShadowRoot()) return !0;
		}
		return !1;
	}
	deleteCharacter(e) {
		let t = this.isCollapsed();
		if (this.isCollapsed()) {
			let t = this.anchor, n = t.getNode();
			if (this.forwardDeletion(t, n, e)) return;
			let r = gs(Ts(t, e ? "previous" : "next"));
			if (r.getTextSlices().every((e) => e === null || e.distance === 0)) {
				let e = { type: "initial" };
				for (let t of r.iterNodeCarets("shadowRoot")) if (Y(t)) {
					if (!t.origin.isInline()) {
						if (t.origin.isShadowRoot()) {
							if (e.type === "merge-block") break;
							if (L(r.anchor.origin) && r.anchor.origin.isEmpty()) {
								let e = Ps(t);
								Os(this, vs(e, e)), r.anchor.origin.remove();
							}
							return;
						}
						e.type !== "merge-next-block" && e.type !== "merge-block" || (e = {
							block: e.block,
							caret: t,
							type: "merge-block"
						});
					}
				} else {
					if (e.type === "merge-block") break;
					if (is(t)) {
						if (L(t.origin)) {
							if (t.origin.isInline()) {
								if (!t.origin.isParentOf(r.anchor.origin)) break;
							} else e = {
								block: t.origin,
								type: "merge-next-block"
							};
							continue;
						}
						if (R(t.origin)) {
							if (!t.origin.isIsolated()) {
								if (e.type === "merge-next-block" && (t.origin.isKeyboardSelectable() || !t.origin.isInline()) && L(r.anchor.origin) && r.anchor.origin.isEmpty()) {
									r.anchor.origin.remove();
									let e = gi();
									e.add(t.origin.getKey()), W(e);
								} else t.origin.remove();
							}
							return;
						}
						break;
					}
				}
				if (e.type === "merge-block") {
					let { caret: t, block: n } = e;
					return Os(this, vs(!t.origin.isEmpty() && n.isEmpty() ? As(X(n, t.direction)) : r.anchor, t)), this.removeText();
				}
			}
			let i = this.focus;
			if (this.modify("extend", e, "character"), this.isCollapsed()) {
				if (e && t.offset === 0 && oi(this, t.getNode())) return;
			} else {
				let r = i.type === "text" ? i.getNode() : null;
				if (n = t.type === "text" ? t.getNode() : null, r !== null && r.isSegmented()) {
					let t = i.offset, a = r.getTextContentSize();
					if (r.is(n) || e && t !== a || !e && t !== 0) return void ci(r, e, t);
				} else if (n !== null && n.isSegmented()) {
					let i = t.offset, a = n.getTextContentSize();
					if (n.is(r) || e && i !== 0 || !e && i !== a) return void ci(n, e, i);
				}
				(function(e, t) {
					let n = e.anchor, r = e.focus, i = n.getNode();
					if (i === r.getNode() && n.type === "text" && r.type === "text") {
						let e = n.offset, a = r.offset, o = e < a, s = o ? e : a, c = o ? a : e, l = c - 1;
						s !== l && (function(e) {
							return !(Ga(e) || si(e));
						})(i.getTextContent().slice(s, c)) && (t ? r.set(r.key, l, r.type) : n.set(n.key, l, n.type));
					}
				})(this, e);
			}
		}
		if (this.removeText(), e && !t && this.isCollapsed() && this.anchor.type === "element" && this.anchor.offset === 0) {
			let e = this.anchor.getNode();
			e.isEmpty() && z(e.getParent()) && e.getPreviousSibling() === null && oi(this, e);
		}
	}
	deleteLine(e) {
		this.isCollapsed() && this.modify("extend", e, "lineboundary"), this.isCollapsed() ? this.deleteCharacter(e) : this.removeText();
	}
	deleteWord(e) {
		if (this.isCollapsed()) {
			let t = this.anchor, n = t.getNode();
			if (this.forwardDeletion(t, n, e)) return;
			this.modify("extend", e, "word");
		}
		this.removeText();
	}
	isBackward() {
		return this.focus.isBefore(this.anchor);
	}
	getStartEndPoints() {
		return [this.anchor, this.focus];
	}
};
function A(e) {
	return e instanceof ni;
}
function ii(e) {
	let t = e.offset;
	if (e.type === "text") return t;
	let n = e.getNode();
	return t === n.getChildrenSize() ? n.getTextContent().length : 0;
}
function ai(e) {
	let t = e.getStartEndPoints();
	if (t === null) return [0, 0];
	let [n, r] = t;
	return n.type === "element" && r.type === "element" && n.key === r.key && n.offset === r.offset ? [0, 0] : [ii(n), ii(r)];
}
function oi(e, t) {
	for (let n = t; n; n = n.getParent()) {
		if (L(n)) {
			if (n.collapseAtStart(e)) return !0;
			if (So(n)) break;
		}
		if (n.getPreviousSibling()) break;
	}
	return !1;
}
var si = (() => {
	try {
		let e = /* @__PURE__ */ RegExp("\\p{Emoji}", "u"), t = e.test.bind(e);
		if (t("❤️") && t("#️⃣") && t("👍")) return t;
	} catch {}
	return () => !1;
})();
function ci(e, t, n) {
	let r = e, i = r.getTextContent().split(/(?=\s)/g), a = i.length, o = 0, s = 0;
	for (let e = 0; e < a; e++) {
		let r = e === a - 1;
		if (s = o, o += i[e].length, t && o === n || o > n || r) {
			i.splice(e, 1), r && (s = void 0);
			break;
		}
	}
	let c = i.join("").trim();
	c === "" ? r.remove() : (r.setTextContent(c), r.select(s, s));
}
function li(e, t, n, r) {
	let i, a = t;
	if (q(e)) {
		let o = !1, s = e.childNodes, c = s.length, l = r._blockCursorElement;
		a === c && (o = !0, a = c - 1);
		let u = s[a], d = !1;
		if (u === l) u = s[a + 1], d = !0;
		else if (l !== null) {
			let n = l.parentNode;
			e === n && t > Array.prototype.indexOf.call(n.children, l) && a--;
		}
		if (i = Wa(u), O(i)) a = ls(i, o ? "next" : "previous");
		else {
			let s = Wa(e);
			if (s === null) return null;
			if (L(s)) {
				let c = r.getElementByKey(s.getKey());
				c === null && y(214);
				let l = s.getDOMSlot(c);
				[s, a] = l.resolveChildIndex(s, c, e, t), L(s) || y(215), o && a >= s.getChildrenSize() && (a = Math.max(0, s.getChildrenSize() - 1));
				let u = s.getChildAtIndex(a);
				if (L(u) && function(e, t, n) {
					let r = e.getParent();
					return n === null || r === null || !r.canBeEmpty() || r !== n.getNode();
				}(u, 0, n)) {
					let e = o ? u.getLastDescendant() : u.getFirstDescendant();
					e === null ? s = u : (u = e, s = L(u) ? u : u.getParentOrThrow()), a = 0;
				}
				O(u) ? (i = u, s = null, a = ls(u, o ? "next" : "previous")) : u !== s && o && !d && (L(s) || y(216), a = Math.min(s.getChildrenSize(), a + 1));
			} else {
				let n = s.getIndexWithinParent();
				a = t === 0 && R(s) && Wa(e) === s ? n : n + 1, s = s.getParentOrThrow();
			}
			if (L(s)) return $r(s.__key, a, "element");
		}
	} else i = Wa(e);
	return O(i) ? $r(i.__key, ls(i, a, "clamp"), "text") : null;
}
function ui(e, t, n) {
	let r = e.offset, i = e.getNode();
	if (r === 0) {
		let r = i.getPreviousSibling(), a = i.getParent();
		if (t) {
			if ((n || !t) && r === null && L(a) && a.isInline()) {
				let t = a.getPreviousSibling();
				O(t) && e.set(t.__key, t.getTextContent().length, "text");
			}
		} else L(r) && !n && r.isInline() ? e.set(r.__key, r.getChildrenSize(), "element") : O(r) && e.set(r.__key, r.getTextContent().length, "text");
	} else if (r === i.getTextContent().length) {
		let r = i.getNextSibling(), a = i.getParent();
		if (t && L(r) && r.isInline()) e.set(r.__key, 0, "element");
		else if ((n || t) && r === null && L(a) && a.isInline() && !a.canInsertTextAfter()) {
			let t = a.getNextSibling();
			O(t) && e.set(t.__key, 0, "text");
		}
	}
}
function di(e, t, n) {
	if (e.type === "text" && t.type === "text") {
		let r = e.isBefore(t), i = e.is(t);
		ui(e, r, i), ui(t, !r, i), i && t.set(e.key, e.offset, e.type);
		let a = I();
		if (a.isComposing() && a._compositionKey !== e.key && k(n)) {
			let r = n.anchor, i = n.focus;
			e.set(r.key, r.offset, r.type, !0), t.set(i.key, i.offset, i.type, !0);
		}
	}
}
function fi(e, t, n, r, i, a) {
	if (e === null || n === null || !Sa(i, e, n)) return null;
	let o = li(e, t, k(a) ? a.anchor : null, i);
	if (o === null) return null;
	let s = li(n, r, k(a) ? a.focus : null, i);
	if (s === null) return null;
	if (o.type === "element" && s.type === "element") {
		let t = Wa(e), r = Wa(n);
		if (R(t) && R(r)) return null;
	}
	return di(o, s, a), [o, s];
}
function pi(e) {
	return L(e) && !e.isInline();
}
function mi(e, t, n, r, i, a) {
	let o = Fi(), s = new ri($r(e, t, i), $r(n, r, a), 0, "");
	return s.dirty = !0, o._selection = s, s;
}
function hi() {
	return new ri($r("root", 0, "element"), $r("root", 0, "element"), 0, "");
}
function gi() {
	return new ni(/* @__PURE__ */ new Set());
}
function _i(e, t) {
	return vi(null, e, t, null);
}
function vi(e, t, n, r) {
	let i = n._window;
	if (i === null) return null;
	let a = r || i.event, o = a ? a.type : void 0, s = o === "selectionchange", c = !Fe && (s || o === "beforeinput" || o === "compositionstart" || o === "compositionend" || o === "click" && a && a.detail === 3 || o === "drop" || o === void 0), l, u, d, f;
	if (k(e) && !c) return e.clone();
	if (t === null) return null;
	if (l = t.anchorNode, u = t.focusNode, d = t.anchorOffset, f = t.focusOffset, (s || o === void 0) && k(e) && !Sa(n, l, u)) return e.clone();
	let p = fi(l, d, u, f, n, e);
	if (p === null) return null;
	let [m, ee] = p;
	return new ri(m, ee, k(e) ? e.format : 0, k(e) ? e.style : "");
}
function j() {
	return Fi()._selection;
}
function yi() {
	return I()._editorState._selection;
}
function bi(e, t, n, r = 1) {
	let i = e.anchor, a = e.focus, o = i.getNode(), s = a.getNode();
	if (!t.is(o) && !t.is(s)) return;
	let c = t.__key;
	if (e.isCollapsed()) {
		let t = i.offset;
		if (n <= t && r > 0 || n < t && r < 0) {
			let n = Math.max(0, t + r);
			i.set(c, n, "element"), a.set(c, n, "element"), xi(e);
		}
	} else {
		let o = e.isBackward(), s = o ? a : i, l = s.getNode(), u = o ? i : a, d = u.getNode();
		if (t.is(l)) {
			let e = s.offset;
			(n <= e && r > 0 || n < e && r < 0) && s.set(c, Math.max(0, e + r), "element");
		}
		if (t.is(d)) {
			let e = u.offset;
			(n <= e && r > 0 || n < e && r < 0) && u.set(c, Math.max(0, e + r), "element");
		}
	}
	xi(e);
}
function xi(e) {
	let t = e.anchor, n = t.offset, r = e.focus, i = r.offset, a = t.getNode(), o = r.getNode();
	if (e.isCollapsed()) {
		if (!L(a)) return;
		let e = a.getChildrenSize(), i = n >= e, o = i ? a.getChildAtIndex(e - 1) : a.getChildAtIndex(n);
		if (O(o)) {
			let e = 0;
			i && (e = o.getTextContentSize()), t.set(o.__key, e, "text"), r.set(o.__key, e, "text");
		}
	} else {
		if (L(a)) {
			let e = a.getChildrenSize(), r = n >= e, i = r ? a.getChildAtIndex(e - 1) : a.getChildAtIndex(n);
			if (O(i)) {
				let e = 0;
				r && (e = i.getTextContentSize()), t.set(i.__key, e, "text");
			}
		}
		if (L(o)) {
			let e = o.getChildrenSize(), t = i >= e, n = t ? o.getChildAtIndex(e - 1) : o.getChildAtIndex(i);
			if (O(n)) {
				let e = 0;
				t && (e = n.getTextContentSize()), r.set(n.__key, e, "text");
			}
		}
	}
}
function Si(e, t, n, r, i) {
	let a = null, o = 0, s = null;
	r === null ? i !== null && (a = i.__key, O(i) ? s = "text" : L(i) && (s = "element")) : (a = r.__key, O(r) ? (o = r.getTextContentSize(), s = "text") : L(r) && (o = r.getChildrenSize(), s = "element")), a !== null && s !== null ? e.set(a, o, s) : (o = t.getIndexWithinParent(), o === -1 && (o = n.getChildrenSize()), e.set(n.__key, o, "element"));
}
function Ci(e, t, n, r, i) {
	e.type === "text" ? e.set(n, e.offset + (t ? 0 : i), "text") : e.offset > r.getIndexWithinParent() && e.set(e.key, e.offset - 1, "element");
}
function wi(e, t, n, r, i) {
	try {
		e.setBaseAndExtent(t, n, r, i);
	} catch {}
}
function Ti(e, t, n, r, i, a, o) {
	let s = r.anchorNode, c = r.focusNode, l = r.anchorOffset, u = r.focusOffset, d = document.activeElement;
	if (i.has("collaboration") && d !== a || d !== null && xa(d)) return;
	if (!k(t)) return void (e !== null && Sa(n, s, c) && r.removeAllRanges());
	let f = t.anchor, p = t.focus, m = f.key, ee = p.key, h = fo(n, m), g = fo(n, ee), _ = f.offset, te = p.offset, v = t.format, ne = t.style, y = t.isCollapsed(), re = h, b = g, ie = !1;
	if (f.type === "text") {
		re = ja(h);
		let e = f.getNode();
		ie = e.getFormat() !== v || e.getStyle() !== ne;
	} else k(e) && e.anchor.type === "text" && (ie = !0);
	var x, ae, oe, se, ce;
	if (p.type === "text" && (b = ja(g)), re !== null && b !== null && (y && (e === null || ie || k(e) && (e.format !== v || e.style !== ne)) && (x = v, ae = ne, oe = _, se = m, ce = performance.now(), Qn = [
		x,
		ae,
		oe,
		se,
		ce
	]), l !== _ || u !== te || s !== re || c !== b || r.type === "Range" && y || (d !== null && a.contains(d) || i.has("skip-selection-focus") || a.focus({ preventScroll: !0 }), f.type === "element"))) {
		if (wi(r, re, _, b, te), !S || !t.isCollapsed() || a === null || i.has("skip-selection-focus") || document.activeElement !== null && a.contains(document.activeElement) || a.focus({ preventScroll: !0 }), !i.has("skip-scroll-into-view") && t.isCollapsed() && a !== null && a === document.activeElement) {
			let e = k(t) && t.anchor.type === "element" ? re.childNodes[_] || null : r.rangeCount > 0 ? r.getRangeAt(0) : null;
			if (e !== null) {
				let t;
				if (e instanceof Text) {
					let n = document.createRange();
					n.selectNode(e), t = n.getBoundingClientRect();
				} else t = e.getBoundingClientRect();
				(function(e, t, n) {
					let r = mo(n), i = vo(r);
					if (r === null || i === null) return;
					let { top: a, bottom: o } = t, s = 0, c = 0, l = n;
					for (; l !== null;) {
						let t = l === r.body;
						if (t) s = 0, c = yo(e).innerHeight;
						else {
							let e = l.getBoundingClientRect();
							s = e.top, c = e.bottom;
						}
						let n = 0;
						if (a < s ? n = -(s - a) : o > c && (n = o - c), n !== 0) {
							if (t) i.scrollBy(0, n);
							else {
								let e = l.scrollTop;
								l.scrollTop += n;
								let t = l.scrollTop - e;
								a -= t, o -= t;
							}
						}
						if (t) break;
						l = po(l);
					}
				})(n, t, a);
			}
		}
		Gn = !0;
	}
}
function Ei(e) {
	let t = j() || yi();
	t === null && (t = U().selectEnd()), t.insertNodes(e);
}
function Di(e) {
	let t = e;
	e.isCollapsed() || t.removeText();
	let n = j();
	k(n) && (t = n), k(t) || y(161);
	let r = t.anchor, i = r.getNode(), a = r.offset;
	for (; !Io(i);) {
		let e = i;
		if ([i, a] = Oi(i, a), e.is(i)) break;
	}
	return a;
}
function Oi(e, t) {
	let n = e.getParent();
	if (!n) {
		let e = B();
		return U().append(e), e.select(), [U(), 0];
	}
	if (O(e)) {
		let r = e.splitText(t);
		if (r.length === 0) return [n, e.getIndexWithinParent()];
		let i = t === 0 ? 0 : 1;
		return [n, r[0].getIndexWithinParent() + i];
	}
	if (!L(e) || t === 0) return [n, e.getIndexWithinParent()];
	let r = e.getChildAtIndex(t);
	if (r) {
		let n = new ri($r(e.__key, t, "element"), $r(e.__key, t, "element"), 0, ""), i = e.insertNewAfter(n);
		i && i.append(r, ...r.getNextSiblings());
	}
	return [n, e.getIndexWithinParent() + 1];
}
function ki(e, t, n, r, i = "decorators-and-blocks") {
	if (t === "move" && r === "character" && !e.isCollapsed()) {
		let [t, r] = n === e.isBackward() ? [e.focus, e.anchor] : [e.anchor, e.focus];
		return r.set(t.key, t.offset, t.type), !0;
	}
	let a = Ts(e.focus, n ? "previous" : "next"), o = r === "lineboundary", s = t === "move", c = a, l = i === "decorators-and-blocks";
	if (!Fs(c)) {
		for (let e of c) {
			l = !1;
			let { origin: t } = e;
			if (!R(t) || t.isIsolated() || (c = e, !o || !t.isInline())) break;
		}
		if (l) for (let e of gs(a).iterNodeCarets(t === "extend" ? "shadowRoot" : "root")) {
			if (Y(e)) e.origin.isInline() || (c = e);
			else {
				if (L(e.origin)) continue;
				R(e.origin) && !e.origin.isInline() && (c = e);
			}
			break;
		}
	}
	if (c === a) return !1;
	if (s && !o && R(c.origin) && c.origin.isKeyboardSelectable()) {
		let e = gi();
		return e.add(c.origin.getKey()), W(e), !0;
	}
	return c = Ps(c), s && Es(e.anchor, c), Es(e.focus, c), l || !o;
}
var M = null, N = null, P = !1, Ai = !1, ji = 0, Mi = {
	characterData: !0,
	childList: !0,
	subtree: !0
};
function Ni() {
	return P || M !== null && M._readOnly;
}
function F() {
	P && y(13);
}
function Pi() {
	ji > 99 && y(14);
}
function Fi() {
	return M === null && y(195, Ii()), M;
}
function I() {
	return N === null && y(196, Ii()), N;
}
function Ii() {
	let e = 0, t = /* @__PURE__ */ new Set(), n = pa.version;
	if (typeof window < "u") for (let r of document.querySelectorAll("[contenteditable]")) {
		let i = Ta(r);
		if (Ca(i)) e++;
		else if (i) {
			let e = String(i.constructor.version || "<0.17.1");
			e === n && (e += " (separately built, likely a bundler configuration issue)"), t.add(e);
		}
	}
	let r = ` Detected on the page: ${e} compatible editor(s) with version ${n}`;
	return t.size && (r += ` and incompatible editors with versions ${Array.from(t).join(", ")}`), r;
}
function Li() {
	return N;
}
function Ri(e, t, n) {
	let r = t.__type, i = _a(e, r), a = n.get(r);
	a === void 0 && (a = Array.from(i.transforms), n.set(r, a));
	let o = a.length;
	for (let e = 0; e < o && (a[e](t), t.isAttached()); e++);
}
function zi(e, t) {
	return e !== void 0 && e.__key !== t && e.isAttached();
}
function Bi(e, t) {
	if (!t) return;
	let n = e._updateTags, r = t;
	Array.isArray(t) || (r = [t]);
	for (let e of r) n.add(e);
}
function Vi(e) {
	return Hi(e, I()._nodes);
}
function Hi(e, t) {
	let n = e.type, r = t.get(n);
	r === void 0 && y(17, n);
	let i = r.klass;
	e.type !== i.getType() && y(18, i.name);
	let a = i.importJSON(e), o = e.children;
	if (L(a) && Array.isArray(o)) for (let e = 0; e < o.length; e++) {
		let n = Hi(o[e], t);
		a.append(n);
	}
	return a;
}
function Ui(e, t, n) {
	let r = M, i = P, a = N;
	M = t, P = !0, N = e;
	try {
		return n();
	} finally {
		M = r, P = i, N = a;
	}
}
function Wi(e, t) {
	let n = e._pendingEditorState, r = e._rootElement, i = e._headless || r === null;
	if (n === null) return;
	let a = e._editorState, o = a._selection, s = n._selection, c = e._dirtyType !== 0, l = M, u = P, d = N, f = e._updating, p = e._observer, m = null;
	if (e._pendingEditorState = null, e._editorState = n, !i && c && p !== null) {
		N = e, M = n, P = !1, e._updating = !0;
		try {
			let t = e._dirtyType, r = e._dirtyElements, i = e._dirtyLeaves;
			p.disconnect(), m = zt(a, n, e, t, r, i);
		} catch (t) {
			if (t instanceof Error && e._onError(t), Ai) throw t;
			ua(e, null, r, n), We(e), e._dirtyType = 2, Ai = !0, Wi(e, a), Ai = !1;
			return;
		} finally {
			p.observe(r, Mi), e._updating = f, M = l, P = u, N = d;
		}
	}
	n._readOnly ||= !0;
	let ee = e._dirtyLeaves, h = e._dirtyElements, g = e._normalizedNodes, _ = e._updateTags, te = e._deferred;
	c && (e._dirtyType = 0, e._cloneNotNeeded.clear(), e._dirtyLeaves = /* @__PURE__ */ new Set(), e._dirtyElements = /* @__PURE__ */ new Map(), e._normalizedNodes = /* @__PURE__ */ new Set(), e._updateTags = /* @__PURE__ */ new Set()), function(e, t) {
		let n = e._decorators, r = e._pendingDecorators || n, i = t._nodeMap, a;
		for (a in r) i.has(a) || (r === n && (r = Va(e)), delete r[a]);
	}(e, n);
	let v = i ? null : ko(yo(e));
	if (e._editable && v !== null && (c || s === null || s.dirty || !s.is(o)) && r !== null && !_.has("skip-dom-selection")) {
		N = e, M = n;
		try {
			if (p !== null && p.disconnect(), c || s === null || s.dirty) {
				let t = e._blockCursorElement;
				t !== null && Oo(t, e, r), Ti(o, s, e, v, _, r);
			}
			(function(e, t, n) {
				let r = e._blockCursorElement;
				if (k(n) && n.isCollapsed() && n.anchor.type === "element" && t.contains(document.activeElement)) {
					let i = n.anchor, a = i.getNode(), o = i.offset, s = !1, c = null;
					if (o === a.getChildrenSize()) Do(a.getChildAtIndex(o - 1)) && (s = !0);
					else {
						let t = a.getChildAtIndex(o);
						if (t !== null && Do(t)) {
							let n = t.getPreviousSibling();
							(n === null || Do(n)) && (s = !0, c = e.getElementByKey(t.__key));
						}
					}
					if (s) {
						let n = e.getElementByKey(a.__key);
						r === null && (e._blockCursorElement = r = function(e) {
							let t = e.theme, n = document.createElement("div");
							n.contentEditable = "false", n.setAttribute("data-lexical-cursor", "true");
							let r = t.blockCursor;
							return r !== void 0 && (typeof r == "string" && (r = t.blockCursor = Ks(r)), r !== void 0 && n.classList.add(...r)), n;
						}(e._config)), t.style.caretColor = "transparent", c === null ? n.appendChild(r) : n.insertBefore(r, c);
						return;
					}
				}
				r !== null && Oo(r, e, t);
			})(e, r, s);
		} finally {
			p !== null && p.observe(r, Mi), N = d, M = l;
		}
	}
	m !== null && function(e, t, n, r, i) {
		let a = Array.from(e._listeners.mutation), o = a.length;
		for (let e = 0; e < o; e++) {
			let [o, s] = a[e];
			for (let e of s) {
				let a = t.get(e);
				a !== void 0 && o(a, {
					dirtyLeaves: r,
					prevEditorState: i,
					updateTags: n
				});
			}
		}
	}(e, m, _, ee, a), k(s) || s === null || o !== null && o.is(s) || e.dispatchCommand(Vt, void 0);
	let ne = e._pendingDecorators;
	ne !== null && (e._decorators = ne, e._pendingDecorators = null, Gi("decorator", e, !0, ne)), function(e, t, n) {
		let r = Ha(t), i = Ha(n);
		r !== i && Gi("textcontent", e, !0, i);
	}(e, t || a, n), Gi("update", e, !0, {
		dirtyElements: h,
		dirtyLeaves: ee,
		editorState: n,
		mutatedNodes: m,
		normalizedNodes: g,
		prevEditorState: t || a,
		tags: _
	}), function(e, t) {
		if (e._deferred = [], t.length !== 0) {
			let n = e._updating;
			e._updating = !0;
			try {
				for (let e = 0; e < t.length; e++) t[e]();
			} finally {
				e._updating = n;
			}
		}
	}(e, te), function(e) {
		let t = e._updates;
		if (t.length !== 0) {
			let n = t.shift();
			if (n) {
				let [t, r] = n;
				qi(e, t, r);
			}
		}
	}(e);
}
function Gi(e, t, n, ...r) {
	let i = t._updating;
	t._updating = n;
	try {
		let n = Array.from(t._listeners[e]);
		for (let e = 0; e < n.length; e++) n[e].apply(null, r);
	} finally {
		t._updating = i;
	}
}
function Ki(e, t) {
	let n = e._updates, r = t || !1;
	for (; n.length !== 0;) {
		let t = n.shift();
		if (t) {
			let [n, i] = t, a = e._pendingEditorState, o;
			i !== void 0 && (o = i.onUpdate, i.skipTransforms && (r = !0), i.discrete && (a === null && y(191), a._flushSync = !0), o && e._deferred.push(o), Bi(e, i.tag)), a == null ? qi(e, n, i) : n();
		}
	}
	return r;
}
function qi(e, t, n) {
	let r = e._updateTags, i, a = !1, o = !1;
	n !== void 0 && (i = n.onUpdate, Bi(e, n.tag), a = n.skipTransforms || !1, o = n.discrete || !1), i && e._deferred.push(i);
	let s = e._editorState, c = e._pendingEditorState, l = !1;
	(c === null || c._readOnly) && (c = e._pendingEditorState = ta(c || s), l = !0), c._flushSync = o;
	let u = M, d = P, f = N, p = e._updating;
	M = c, P = !1, e._updating = !0, N = e;
	let m = e._headless || e.getRootElement() === null;
	ha(null);
	try {
		l && (m ? s._selection !== null && (c._selection = s._selection.clone()) : c._selection = function(e, t) {
			let n = e.getEditorState()._selection, r = ko(yo(e));
			return k(n) || n == null ? vi(n, r, e, t) : n.clone();
		}(e, n && n.event || null));
		let r = e._compositionKey;
		t(), a = Ki(e, a), function(e, t) {
			let n = t.getEditorState()._selection, r = e._selection;
			if (k(r)) {
				let e = r.anchor, t = r.focus, i;
				if (e.type === "text" && (i = e.getNode(), i.selectionTransform(n, r)), t.type === "text") {
					let e = t.getNode();
					i !== e && e.selectionTransform(n, r);
				}
			}
		}(c, e), e._dirtyType !== 0 && (a ? function(e, t) {
			let n = t._dirtyLeaves, r = e._nodeMap;
			for (let e of n) {
				let t = r.get(e);
				O(t) && t.isAttached() && t.isSimpleText() && !t.isUnmergeable() && ot(t);
			}
		}(c, e) : function(e, t) {
			let n = t._dirtyLeaves, r = t._dirtyElements, i = e._nodeMap, a = La(), o = /* @__PURE__ */ new Map(), s = n, c = s.size, l = r, u = l.size;
			for (; c > 0 || u > 0;) {
				if (c > 0) {
					t._dirtyLeaves = /* @__PURE__ */ new Set();
					for (let e of s) {
						let r = i.get(e);
						O(r) && r.isAttached() && r.isSimpleText() && !r.isUnmergeable() && ot(r), r !== void 0 && zi(r, a) && Ri(t, r, o), n.add(e);
					}
					if (s = t._dirtyLeaves, c = s.size, c > 0) {
						ji++;
						continue;
					}
				}
				t._dirtyLeaves = /* @__PURE__ */ new Set(), t._dirtyElements = /* @__PURE__ */ new Map(), l.delete("root") && l.set("root", !0);
				for (let e of l) {
					let n = e[0], s = e[1];
					if (r.set(n, s), !s) continue;
					let c = i.get(n);
					c !== void 0 && zi(c, a) && Ri(t, c, o);
				}
				s = t._dirtyLeaves, c = s.size, l = t._dirtyElements, u = l.size, ji++;
			}
			t._dirtyLeaves = n, t._dirtyElements = r;
		}(c, e), Ki(e), function(e, t, n, r) {
			let i = e._nodeMap, a = t._nodeMap, o = [];
			for (let [e] of r) {
				let t = a.get(e);
				t !== void 0 && (t.isAttached() || (L(t) && Pe(t, e, i, a, o, r), i.has(e) || r.delete(e), o.push(e)));
			}
			for (let e of o) a.delete(e);
			for (let e of n) {
				let t = a.get(e);
				t === void 0 || t.isAttached() || (i.has(e) || n.delete(e), a.delete(e));
			}
		}(s, c, e._dirtyLeaves, e._dirtyElements)), r !== e._compositionKey && (c._flushSync = !0);
		let i = c._selection;
		if (k(i)) {
			let e = c._nodeMap, t = i.anchor.key, n = i.focus.key;
			e.get(t) !== void 0 && e.get(n) !== void 0 || y(19);
		} else A(i) && i._nodes.size === 0 && (c._selection = null);
	} catch (t) {
		t instanceof Error && e._onError(t), e._pendingEditorState = s, e._dirtyType = 2, e._cloneNotNeeded.clear(), e._dirtyLeaves = /* @__PURE__ */ new Set(), e._dirtyElements.clear(), Wi(e);
		return;
	} finally {
		M = u, P = d, N = f, e._updating = p, ji = 0;
	}
	e._dirtyType !== 0 || e._deferred.length > 0 || function(e, t) {
		let n = t.getEditorState()._selection, r = e._selection;
		if (r !== null) {
			if (r.dirty || !r.is(n)) return !0;
		} else if (n !== null) return !0;
		return !1;
	}(c, e) ? c._flushSync ? (c._flushSync = !1, Wi(e)) : l && ya(() => {
		Wi(e);
	}) : (c._flushSync = !1, l && (r.clear(), e._deferred = [], e._pendingEditorState = null));
}
function Ji(e, t, n) {
	N === e && n === void 0 ? t() : qi(e, t, n);
}
var Yi = class e {
	element;
	before;
	after;
	constructor(e, t, n) {
		this.element = e, this.before = t || null, this.after = n || null;
	}
	withBefore(t) {
		return new e(this.element, t, this.after);
	}
	withAfter(t) {
		return new e(this.element, this.before, t);
	}
	withElement(t) {
		return this.element === t ? this : new e(t, this.before, this.after);
	}
	insertChild(e) {
		let t = this.before || this.getManagedLineBreak();
		return t !== null && t.parentElement !== this.element && y(222), this.element.insertBefore(e, t), this;
	}
	removeChild(e) {
		return e.parentElement !== this.element && y(223), this.element.removeChild(e), this;
	}
	replaceChild(e, t) {
		return t.parentElement !== this.element && y(224), this.element.replaceChild(e, t), this;
	}
	getFirstChild() {
		let e = this.after ? this.after.nextSibling : this.element.firstChild;
		return e === this.before || e === this.getManagedLineBreak() ? null : e;
	}
	getManagedLineBreak() {
		return this.element.__lexicalLineBreak || null;
	}
	setManagedLineBreak(e) {
		if (e === null) this.removeManagedLineBreak();
		else {
			let t = e === "decorator" && (de || se || oe);
			this.insertManagedLineBreak(t);
		}
	}
	removeManagedLineBreak() {
		let e = this.getManagedLineBreak();
		if (e) {
			let t = this.element, n = e.nodeName === "IMG" ? e.nextSibling : null;
			n && t.removeChild(n), t.removeChild(e), t.__lexicalLineBreak = void 0;
		}
	}
	insertManagedLineBreak(e) {
		let t = this.getManagedLineBreak();
		if (t) {
			if (e === (t.nodeName === "IMG")) return;
			this.removeManagedLineBreak();
		}
		let n = this.element, r = this.before, i = document.createElement("br");
		if (n.insertBefore(i, r), e) {
			let e = document.createElement("img");
			e.setAttribute("data-lexical-linebreak", "true"), e.style.cssText = "display: inline !important; border: 0px !important; margin: 0px !important;", e.alt = "", n.insertBefore(e, i), n.__lexicalLineBreak = e;
		} else n.__lexicalLineBreak = i;
	}
	getFirstChildOffset() {
		let e = 0;
		for (let t = this.after; t !== null; t = t.previousSibling) e++;
		return e;
	}
	resolveChildIndex(e, t, n, r) {
		if (n === this.element) {
			let t = this.getFirstChildOffset();
			return [e, Math.min(t + e.getChildrenSize(), Math.max(t, r))];
		}
		let i = Xi(t, n);
		i.push(r);
		let a = Xi(t, this.element), o = e.getIndexWithinParent();
		for (let e = 0; e < a.length; e++) {
			let t = i[e], n = a[e];
			if (t === void 0 || t < n) break;
			if (t > n) {
				o += 1;
				break;
			}
		}
		return [e.getParentOrThrow(), o];
	}
};
function Xi(e, t) {
	let n = [], r = t;
	for (; r !== e && r !== null; r = r.parentNode) {
		let e = 0;
		for (let t = r.previousSibling; t !== null; t = t.previousSibling) e++;
		n.push(e);
	}
	return r !== e && y(225), n.reverse();
}
var Zi = class extends xr {
	__first;
	__last;
	__size;
	__format;
	__style;
	__indent;
	__dir;
	__textFormat;
	__textStyle;
	constructor(e) {
		super(e), this.__first = null, this.__last = null, this.__size = 0, this.__format = 0, this.__style = "", this.__indent = 0, this.__dir = null, this.__textFormat = 0, this.__textStyle = "";
	}
	afterCloneFrom(e) {
		super.afterCloneFrom(e), this.__key === e.__key && (this.__first = e.__first, this.__last = e.__last, this.__size = e.__size), this.__indent = e.__indent, this.__format = e.__format, this.__style = e.__style, this.__dir = e.__dir, this.__textFormat = e.__textFormat, this.__textStyle = e.__textStyle;
	}
	getFormat() {
		return this.getLatest().__format;
	}
	getFormatType() {
		return Ae[this.getFormat()] || "";
	}
	getStyle() {
		return this.getLatest().__style;
	}
	getIndent() {
		return this.getLatest().__indent;
	}
	getChildren() {
		let e = [], t = this.getFirstChild();
		for (; t !== null;) e.push(t), t = t.getNextSibling();
		return e;
	}
	getChildrenKeys() {
		let e = [], t = this.getFirstChild();
		for (; t !== null;) e.push(t.__key), t = t.getNextSibling();
		return e;
	}
	getChildrenSize() {
		return this.getLatest().__size;
	}
	isEmpty() {
		return this.getChildrenSize() === 0;
	}
	isDirty() {
		let e = I()._dirtyElements;
		return e !== null && e.has(this.__key);
	}
	isLastChild() {
		let e = this.getLatest(), t = this.getParentOrThrow().getLastChild();
		return t !== null && t.is(e);
	}
	getAllTextNodes() {
		let e = [], t = this.getFirstChild();
		for (; t !== null;) {
			if (O(t) && e.push(t), L(t)) {
				let n = t.getAllTextNodes();
				e.push(...n);
			}
			t = t.getNextSibling();
		}
		return e;
	}
	getFirstDescendant() {
		let e = this.getFirstChild();
		for (; L(e);) {
			let t = e.getFirstChild();
			if (t === null) break;
			e = t;
		}
		return e;
	}
	getLastDescendant() {
		let e = this.getLastChild();
		for (; L(e);) {
			let t = e.getLastChild();
			if (t === null) break;
			e = t;
		}
		return e;
	}
	getDescendantByIndex(e) {
		let t = this.getChildren(), n = t.length;
		if (e >= n) {
			let e = t[n - 1];
			return L(e) && e.getLastDescendant() || e || null;
		}
		let r = t[e];
		return L(r) && r.getFirstDescendant() || r || null;
	}
	getFirstChild() {
		let e = this.getLatest().__first;
		return e === null ? null : H(e);
	}
	getFirstChildOrThrow() {
		let e = this.getFirstChild();
		return e === null && y(45, this.__key), e;
	}
	getLastChild() {
		let e = this.getLatest().__last;
		return e === null ? null : H(e);
	}
	getLastChildOrThrow() {
		let e = this.getLastChild();
		return e === null && y(96, this.__key), e;
	}
	getChildAtIndex(e) {
		let t = this.getChildrenSize(), n, r;
		if (e < t / 2) {
			for (n = this.getFirstChild(), r = 0; n !== null && r <= e;) {
				if (r === e) return n;
				n = n.getNextSibling(), r++;
			}
			return null;
		}
		for (n = this.getLastChild(), r = t - 1; n !== null && r >= e;) {
			if (r === e) return n;
			n = n.getPreviousSibling(), r--;
		}
		return null;
	}
	getTextContent() {
		let e = "", t = this.getChildren(), n = t.length;
		for (let r = 0; r < n; r++) {
			let i = t[r];
			e += i.getTextContent(), L(i) && r !== n - 1 && !i.isInline() && (e += Se);
		}
		return e;
	}
	getTextContentSize() {
		let e = 0, t = this.getChildren(), n = t.length;
		for (let r = 0; r < n; r++) {
			let i = t[r];
			e += i.getTextContentSize(), L(i) && r !== n - 1 && !i.isInline() && (e += 2);
		}
		return e;
	}
	getDirection() {
		return this.getLatest().__dir;
	}
	getTextFormat() {
		return this.getLatest().__textFormat;
	}
	hasFormat(e) {
		if (e !== "") {
			let t = ke[e];
			return (this.getFormat() & t) !== 0;
		}
		return !1;
	}
	hasTextFormat(e) {
		let t = C[e];
		return (this.getTextFormat() & t) !== 0;
	}
	getFormatFlags(e, t) {
		return Ma(this.getLatest().__textFormat, e, t);
	}
	getTextStyle() {
		return this.getLatest().__textStyle;
	}
	select(e, t) {
		F();
		let n = j(), r = e, i = t, a = this.getChildrenSize();
		if (!this.canBeEmpty()) {
			if (e === 0 && t === 0) {
				let e = this.getFirstChild();
				if (O(e) || L(e)) return e.select(0, 0);
			} else if (!(e !== void 0 && e !== a || t !== void 0 && t !== a)) {
				let e = this.getLastChild();
				if (O(e) || L(e)) return e.select();
			}
		}
		r === void 0 && (r = a), i === void 0 && (i = a);
		let o = this.__key;
		return k(n) ? (n.anchor.set(o, r, "element"), n.focus.set(o, i, "element"), n.dirty = !0, n) : mi(o, r, o, i, "element", "element");
	}
	selectStart() {
		let e = this.getFirstDescendant();
		return e ? e.selectStart() : this.select();
	}
	selectEnd() {
		let e = this.getLastDescendant();
		return e ? e.selectEnd() : this.select();
	}
	clear() {
		let e = this.getWritable();
		return this.getChildren().forEach((e) => e.remove()), e;
	}
	append(...e) {
		return this.splice(this.getChildrenSize(), 0, e);
	}
	setDirection(e) {
		let t = this.getWritable();
		return t.__dir = e, t;
	}
	setFormat(e) {
		return this.getWritable().__format = e === "" ? 0 : ke[e], this;
	}
	setStyle(e) {
		return this.getWritable().__style = e || "", this;
	}
	setTextFormat(e) {
		let t = this.getWritable();
		return t.__textFormat = e, t;
	}
	setTextStyle(e) {
		let t = this.getWritable();
		return t.__textStyle = e, t;
	}
	setIndent(e) {
		return this.getWritable().__indent = e, this;
	}
	splice(e, t, n) {
		br(this) && y(324, this.__key, this.__type);
		let r = this.getChildrenSize(), i = this.getWritable();
		e + t <= r || y(226, String(e), String(t), String(r));
		let a = i.__key, o = [], s = [], c = this.getChildAtIndex(e + t), l = null, u = r - t + n.length;
		if (e !== 0) {
			if (e === r) l = this.getLastChild();
			else {
				let t = this.getChildAtIndex(e);
				t !== null && (l = t.getPreviousSibling());
			}
		}
		if (t > 0) {
			let e = l === null ? this.getFirstChild() : l.getNextSibling();
			for (let n = 0; n < t; n++) {
				e === null && y(100);
				let t = e.getNextSibling(), n = e.__key;
				Fa(e.getWritable()), s.push(n), e = t;
			}
		}
		let d = l;
		for (let e of n) {
			d !== null && e.is(d) && (l = d = d.getPreviousSibling());
			let t = e.getWritable();
			t.__parent === a && u--, Fa(t);
			let n = e.__key;
			if (d === null) i.__first = n, t.__prev = null;
			else {
				let e = d.getWritable();
				e.__next = n, t.__prev = e.__key;
			}
			e.__key === a && y(76), t.__parent = a, o.push(n), d = e;
		}
		if (e + t === r) d !== null && (d.getWritable().__next = null, i.__last = d.__key);
		else if (c !== null) {
			let e = c.getWritable();
			if (d !== null) {
				let t = d.getWritable();
				e.__prev = d.__key, t.__next = c.__key;
			} else e.__prev = null;
		}
		if (i.__size = u, s.length) {
			let e = j();
			if (k(e)) {
				let t = new Set(s), n = new Set(o), { anchor: r, focus: i } = e;
				Qi(r, t, n) && Si(r, r.getNode(), this, l, c), Qi(i, t, n) && Si(i, i.getNode(), this, l, c), u !== 0 || this.canBeEmpty() || So(this) || this.remove();
			}
		}
		return i;
	}
	getDOMSlot(e) {
		return new Yi(e);
	}
	exportDOM(e) {
		let { element: t } = super.exportDOM(e);
		if (q(t)) {
			let e = this.getIndent();
			e > 0 && (t.style.paddingInlineStart = 40 * e + "px");
			let n = this.getDirection();
			n && (t.dir = n);
		}
		return { element: t };
	}
	exportJSON() {
		let e = {
			children: [],
			direction: this.getDirection(),
			format: this.getFormatType(),
			indent: this.getIndent(),
			...super.exportJSON()
		}, t = this.getTextFormat(), n = this.getTextStyle();
		return t === 0 && n === "" || So(this) || this.getChildren().some(O) || (t !== 0 && (e.textFormat = t), n !== "" && (e.textStyle = n)), e;
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setFormat(e.format).setIndent(e.indent).setDirection(e.direction).setTextFormat(e.textFormat || 0).setTextStyle(e.textStyle || "");
	}
	insertNewAfter(e, t) {
		return null;
	}
	canIndent() {
		return !0;
	}
	collapseAtStart(e) {
		return !1;
	}
	excludeFromCopy(e) {
		return !1;
	}
	canReplaceWith(e) {
		return !0;
	}
	canInsertAfter(e) {
		return !0;
	}
	canBeEmpty() {
		return !0;
	}
	canInsertTextBefore() {
		return !0;
	}
	canInsertTextAfter() {
		return !0;
	}
	isInline() {
		return !1;
	}
	isShadowRoot() {
		return !1;
	}
	canMergeWith(e) {
		return !1;
	}
	extractWithChild(e, t, n) {
		return !1;
	}
	canMergeWhenEmpty() {
		return !1;
	}
	reconcileObservedMutation(e, t) {
		let n = this.getDOMSlot(e), r = n.getFirstChild();
		for (let e = this.getFirstChild(); e; e = e.getNextSibling()) {
			let i = t.getElementByKey(e.getKey());
			i !== null && (r == null ? (n.insertChild(i), r = i) : r !== i && n.replaceChild(i, r), r = r.nextSibling);
		}
	}
};
function L(e) {
	return e instanceof Zi;
}
function Qi(e, t, n) {
	let r = e.getNode();
	for (; r;) {
		let e = r.__key;
		if (t.has(e) && !n.has(e)) return !0;
		r = r.getParent();
	}
	return !1;
}
var $i = class extends xr {
	decorate(e, t) {
		return null;
	}
	isIsolated() {
		return !1;
	}
	isInline() {
		return !0;
	}
	isKeyboardSelectable() {
		return !0;
	}
};
function R(e) {
	return e instanceof $i;
}
var ea = class e extends Zi {
	__cachedText;
	static getType() {
		return "root";
	}
	static clone() {
		return new e();
	}
	constructor() {
		super("root"), this.__cachedText = null;
	}
	getTopLevelElementOrThrow() {
		y(51);
	}
	getTextContent() {
		let e = this.__cachedText;
		return !Ni() && I()._dirtyType !== 0 || e === null ? super.getTextContent() : e;
	}
	remove() {
		y(52);
	}
	replace(e) {
		y(53);
	}
	insertBefore(e) {
		y(54);
	}
	insertAfter(e) {
		y(55);
	}
	updateDOM(e, t) {
		return !1;
	}
	splice(e, t, n) {
		for (let e of n) L(e) || R(e) || y(282);
		return super.splice(e, t, n);
	}
	static importJSON(e) {
		return U().updateFromJSON(e);
	}
	collapseAtStart() {
		return !0;
	}
};
function z(e) {
	return e instanceof ea;
}
function ta(e) {
	return new aa(new Map(e._nodeMap));
}
function na() {
	return new aa(/* @__PURE__ */ new Map([["root", new ea()]]));
}
function ra(e) {
	let t = e.exportJSON(), n = e.constructor;
	if (t.type !== n.getType() && y(130, n.name), L(e)) {
		let r = t.children;
		Array.isArray(r) || y(59, n.name);
		let i = e.getChildren();
		for (let e = 0; e < i.length; e++) {
			let t = ra(i[e]);
			r.push(t);
		}
	}
	return t;
}
function ia(e) {
	return e instanceof aa;
}
var aa = class e {
	_nodeMap;
	_selection;
	_flushSync;
	_readOnly;
	constructor(e, t) {
		this._nodeMap = e, this._selection = t || null, this._flushSync = !1, this._readOnly = !1;
	}
	isEmpty() {
		return this._nodeMap.size === 1 && this._selection === null;
	}
	read(e, t) {
		return Ui(t && t.editor || null, this, e);
	}
	clone(t) {
		let n = new e(this._nodeMap, t === void 0 ? this._selection : t);
		return n._readOnly = !0, n;
	}
	toJSON() {
		return Ui(null, this, () => ({ root: ra(U()) }));
	}
}, oa = class extends Zi {
	static getType() {
		return "artificial";
	}
	createDOM(e) {
		return document.createElement("div");
	}
}, sa = class e extends Zi {
	static getType() {
		return "paragraph";
	}
	static clone(t) {
		return new e(t.__key);
	}
	createDOM(e) {
		let t = document.createElement("p"), n = ao(e.theme, "paragraph");
		return n !== void 0 && t.classList.add(...n), t;
	}
	updateDOM(e, t, n) {
		return !1;
	}
	static importDOM() {
		return { p: (e) => ({
			conversion: ca,
			priority: 0
		}) };
	}
	exportDOM(e) {
		let { element: t } = super.exportDOM(e);
		if (q(t)) {
			this.isEmpty() && t.append(document.createElement("br"));
			let e = this.getFormatType();
			e && (t.style.textAlign = e);
		}
		return { element: t };
	}
	static importJSON(e) {
		return B().updateFromJSON(e);
	}
	exportJSON() {
		let e = super.exportJSON();
		if (e.textFormat === void 0 || e.textStyle === void 0) {
			let t = this.getChildren().find(O);
			t ? (e.textFormat = t.getFormat(), e.textStyle = t.getStyle()) : (e.textFormat = this.getTextFormat(), e.textStyle = this.getTextStyle());
		}
		return e;
	}
	insertNewAfter(e, t) {
		let n = B();
		n.setTextFormat(e.format), n.setTextStyle(e.style);
		let r = this.getDirection();
		return n.setDirection(r), n.setFormat(this.getFormatType()), n.setStyle(this.getStyle()), this.insertAfter(n, t), n;
	}
	collapseAtStart() {
		let e = this.getChildren();
		if (e.length === 0 || O(e[0]) && e[0].getTextContent().trim() === "") {
			if (this.getNextSibling() !== null) return this.selectNext(), this.remove(), !0;
			if (this.getPreviousSibling() !== null) return this.selectPrevious(), this.remove(), !0;
		}
		return !1;
	}
};
function ca(e) {
	let t = B();
	return e.style && (t.setFormat(e.style.textAlign), Uo(e, t)), { node: t };
}
function B() {
	return wo(new sa());
}
function la(e) {
	return e instanceof sa;
}
function ua(e, t, n, r) {
	let i = e._keyToDOMMap;
	i.clear(), e._editorState = na(), e._pendingEditorState = r, e._compositionKey = null, e._dirtyType = 0, e._cloneNotNeeded.clear(), e._dirtyLeaves = /* @__PURE__ */ new Set(), e._dirtyElements.clear(), e._normalizedNodes = /* @__PURE__ */ new Set(), e._updateTags = /* @__PURE__ */ new Set(), e._updates = [], e._blockCursorElement = null;
	let a = e._observer;
	a !== null && (a.disconnect(), e._observer = null), t !== null && (t.textContent = ""), n !== null && (n.textContent = "", i.set("root", n));
}
function da(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = e;
	for (; r;) {
		let { ownNodeConfig: e } = qo(r), i = r.transform;
		if (!n.has(i)) {
			n.add(i);
			let e = r.transform();
			e && t.add(e);
		}
		if (e) {
			let n = e.$transform;
			n && t.add(n), r = e.extends;
		} else {
			let e = Object.getPrototypeOf(r);
			r = e.prototype instanceof xr && e !== xr ? e : void 0;
		}
	}
	return t;
}
function fa(e) {
	let t = e || {}, n = Li(), r = t.theme || {}, i = e === void 0 ? n : t.parentEditor || null, a = t.disableEvents || !1, o = na(), s = t.namespace || (i === null ? qa() : i._config.namespace), c = t.editorState, l = [
		ea,
		zr,
		Or,
		Yr,
		sa,
		oa,
		...t.nodes || []
	], { onError: u, html: d } = t, f = t.editable === void 0 || t.editable, p;
	if (e === void 0 && n !== null) p = n._nodes;
	else {
		p = /* @__PURE__ */ new Map();
		for (let e = 0; e < l.length; e++) {
			let t = l[e], n = null, r = null;
			if (typeof t != "function") {
				let e = t;
				t = e.replace, n = e.with, r = e.withKlass || null;
			}
			qo(t);
			let i = t.getType(), a = da(t);
			p.set(i, {
				exportDOM: d && d.export ? d.export.get(t) : void 0,
				klass: t,
				replace: n,
				replaceWithKlass: r,
				sharedNodeState: Ye(l[e]),
				transforms: a
			});
		}
	}
	let m = new pa(o, i, p, {
		disableEvents: a,
		namespace: s,
		theme: r
	}, u || console.error, function(e, t) {
		let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set(), i = (e) => {
			Object.keys(e).forEach((t) => {
				let r = n.get(t);
				r === void 0 && (r = [], n.set(t, r)), r.push(e[t]);
			});
		};
		return e.forEach((e) => {
			let t = e.klass.importDOM;
			if (t == null || r.has(t)) return;
			r.add(t);
			let n = t.call(e.klass);
			n !== null && i(n);
		}), t && i(t), n;
	}(p, d ? d.import : void 0), f, e);
	return c !== void 0 && (m._pendingEditorState = c, m._dirtyType = 2), function(e) {
		e.registerCommand(Wt, ar, 0), e.registerCommand(Gt, or, 0), e.registerCommand(Kt, sr, 0), e.registerCommand(qt, cr, 0), e.registerCommand(on, ur, 0);
	}(m), m;
}
var pa = class {
	static version;
	_headless;
	_parentEditor;
	_rootElement;
	_editorState;
	_pendingEditorState;
	_compositionKey;
	_deferred;
	_keyToDOMMap;
	_updates;
	_updating;
	_listeners;
	_commands;
	_nodes;
	_decorators;
	_pendingDecorators;
	_config;
	_dirtyType;
	_cloneNotNeeded;
	_dirtyLeaves;
	_dirtyElements;
	_normalizedNodes;
	_updateTags;
	_observer;
	_key;
	_onError;
	_htmlConversions;
	_window;
	_editable;
	_blockCursorElement;
	_createEditorArgs;
	constructor(e, t, n, r, i, a, o, s) {
		this._createEditorArgs = s, this._parentEditor = t, this._rootElement = null, this._editorState = e, this._pendingEditorState = null, this._compositionKey = null, this._deferred = [], this._keyToDOMMap = /* @__PURE__ */ new Map(), this._updates = [], this._updating = !1, this._listeners = {
			decorator: /* @__PURE__ */ new Set(),
			editable: /* @__PURE__ */ new Set(),
			mutation: /* @__PURE__ */ new Map(),
			root: /* @__PURE__ */ new Set(),
			textcontent: /* @__PURE__ */ new Set(),
			update: /* @__PURE__ */ new Set()
		}, this._commands = /* @__PURE__ */ new Map(), this._config = r, this._nodes = n, this._decorators = {}, this._pendingDecorators = null, this._dirtyType = 0, this._cloneNotNeeded = /* @__PURE__ */ new Set(), this._dirtyLeaves = /* @__PURE__ */ new Set(), this._dirtyElements = /* @__PURE__ */ new Map(), this._normalizedNodes = /* @__PURE__ */ new Set(), this._updateTags = /* @__PURE__ */ new Set(), this._observer = null, this._key = qa(), this._onError = i, this._htmlConversions = a, this._editable = o, this._headless = t !== null && t._headless, this._window = null, this._blockCursorElement = null;
	}
	isComposing() {
		return this._compositionKey != null;
	}
	registerUpdateListener(e) {
		let t = this._listeners.update;
		return t.add(e), () => {
			t.delete(e);
		};
	}
	registerEditableListener(e) {
		let t = this._listeners.editable;
		return t.add(e), () => {
			t.delete(e);
		};
	}
	registerDecoratorListener(e) {
		let t = this._listeners.decorator;
		return t.add(e), () => {
			t.delete(e);
		};
	}
	registerTextContentListener(e) {
		let t = this._listeners.textcontent;
		return t.add(e), () => {
			t.delete(e);
		};
	}
	registerRootListener(e) {
		let t = this._listeners.root;
		return e(this._rootElement, null), t.add(e), () => {
			e(null, this._rootElement), t.delete(e);
		};
	}
	registerCommand(e, t, n) {
		n === void 0 && y(35);
		let r = this._commands;
		r.has(e) || r.set(e, [
			/* @__PURE__ */ new Set(),
			/* @__PURE__ */ new Set(),
			/* @__PURE__ */ new Set(),
			/* @__PURE__ */ new Set(),
			/* @__PURE__ */ new Set()
		]);
		let i = r.get(e);
		i === void 0 && y(36, String(e));
		let a = i[n];
		return a.add(t), () => {
			a.delete(t), i.every((e) => e.size === 0) && r.delete(e);
		};
	}
	registerMutationListener(e, t, n) {
		let r = this.resolveRegisteredNodeAfterReplacements(this.getRegisteredNode(e)).klass, i = this._listeners.mutation, a = i.get(t);
		a === void 0 && (a = /* @__PURE__ */ new Set(), i.set(t, a)), a.add(r);
		let o = n && n.skipInitialization;
		return o !== void 0 && o || this.initializeMutationListener(t, r), () => {
			a.delete(r), a.size === 0 && i.delete(t);
		};
	}
	getRegisteredNode(e) {
		let t = this._nodes.get(e.getType());
		return t === void 0 && y(37, e.name), t;
	}
	resolveRegisteredNodeAfterReplacements(e) {
		for (; e.replaceWithKlass;) e = this.getRegisteredNode(e.replaceWithKlass);
		return e;
	}
	initializeMutationListener(e, t) {
		let n = this._editorState, r = Bo(n).get(t.getType());
		if (!r) return;
		let i = /* @__PURE__ */ new Map();
		for (let e of r.keys()) i.set(e, "created");
		i.size > 0 && e(i, {
			dirtyLeaves: /* @__PURE__ */ new Set(),
			prevEditorState: n,
			updateTags: /* @__PURE__ */ new Set(["registerMutationListener"])
		});
	}
	registerNodeTransformToKlass(e, t) {
		let n = this.getRegisteredNode(e);
		return n.transforms.add(t), n;
	}
	registerNodeTransform(e, t) {
		let n = this.registerNodeTransformToKlass(e, t), r = [n], i = n.replaceWithKlass;
		if (i != null) {
			let e = this.registerNodeTransformToKlass(i, t);
			r.push(e);
		}
		return function(e, t) {
			let n = Bo(e.getEditorState()), r = [];
			for (let e of t) {
				let t = n.get(e);
				t && r.push(t);
			}
			r.length !== 0 && e.update(() => {
				for (let e of r) for (let t of e.keys()) {
					let e = H(t);
					e && e.markDirty();
				}
			}, e._pendingEditorState === null ? { tag: wr } : void 0);
		}(this, r.map((e) => e.klass.getType())), () => {
			r.forEach((e) => e.transforms.delete(t));
		};
	}
	hasNode(e) {
		return this._nodes.has(e.getType());
	}
	hasNodes(e) {
		return e.every(this.hasNode.bind(this));
	}
	dispatchCommand(e, t) {
		return K(this, e, t);
	}
	getDecorators() {
		return this._decorators;
	}
	getRootElement() {
		return this._rootElement;
	}
	getKey() {
		return this._key;
	}
	setRootElement(e) {
		let t = this._rootElement;
		if (e !== t) {
			let n = ao(this._config.theme, "root"), r = this._pendingEditorState || this._editorState;
			if (this._rootElement = e, ua(this, t, e, r), t !== null && (this._config.disableEvents || gr(t), n != null && t.classList.remove(...n)), e !== null) {
				let t = vo(e), r = e.style;
				r.userSelect = "text", r.whiteSpace = "pre-wrap", r.wordBreak = "break-word", e.setAttribute("data-lexical-editor", "true"), this._window = t, this._dirtyType = 2, We(this), this._updateTags.add(wr), Wi(this), this._config.disableEvents || function(e, t) {
					let n = e.ownerDocument;
					Un.set(e, n);
					let r = Wn.get(n) ?? 0;
					r < 1 && n.addEventListener("selectionchange", pr), Wn.set(n, r + 1), e.__lexicalEditor = t;
					let i = dr(e);
					for (let n = 0; n < Rn.length; n++) {
						let [r, a] = Rn[n], o = typeof a == "function" ? (e) => {
							hr(e) || (mr(e), (t.isEditable() || r === "click") && a(e, t));
						} : (e) => {
							if (hr(e)) return;
							mr(e);
							let n = t.isEditable();
							switch (r) {
								case "cut": return n && K(t, On, e);
								case "copy": return K(t, Dn, e);
								case "paste": return n && K(t, Qt, e);
								case "dragstart": return n && K(t, wn, e);
								case "dragover": return n && K(t, Tn, e);
								case "dragend": return n && K(t, En, e);
								case "focus": return n && K(t, Pn, e);
								case "blur": return n && K(t, Fn, e);
								case "drop": return n && K(t, Sn, e);
							}
						};
						e.addEventListener(r, o), i.push(() => {
							e.removeEventListener(r, o);
						});
					}
				}(e, this), n != null && e.classList.add(...n);
			} else this._window = null, this._updateTags.add(wr), Wi(this);
			Gi("root", this, !1, e, t);
		}
	}
	getElementByKey(e) {
		return this._keyToDOMMap.get(e) || null;
	}
	getEditorState() {
		return this._editorState;
	}
	setEditorState(e, t) {
		e.isEmpty() && y(38);
		let n = e;
		n._readOnly && (n = ta(e), n._selection = e._selection ? e._selection.clone() : null), Ue(this);
		let r = this._pendingEditorState, i = this._updateTags, a = t === void 0 ? null : t.tag;
		r === null || r.isEmpty() || (a != null && i.add(a), Wi(this)), this._pendingEditorState = n, this._dirtyType = 2, this._dirtyElements.set("root", !1), this._compositionKey = null, a != null && i.add(a), this._updating || Wi(this);
	}
	parseEditorState(e, t) {
		return function(e, t, n) {
			let r = na(), i = M, a = P, o = N, s = t._dirtyElements, c = t._dirtyLeaves, l = t._cloneNotNeeded, u = t._dirtyType;
			t._dirtyElements = /* @__PURE__ */ new Map(), t._dirtyLeaves = /* @__PURE__ */ new Set(), t._cloneNotNeeded = /* @__PURE__ */ new Set(), t._dirtyType = 0, M = r, P = !1, N = t, ha(null);
			try {
				let i = t._nodes;
				Hi(e.root, i), n && n(), r._readOnly = !0;
			} catch (e) {
				e instanceof Error && t._onError(e);
			} finally {
				t._dirtyElements = s, t._dirtyLeaves = c, t._cloneNotNeeded = l, t._dirtyType = u, M = i, P = a, N = o;
			}
			return r;
		}(typeof e == "string" ? JSON.parse(e) : e, this, t);
	}
	read(e) {
		return Wi(this), this.getEditorState().read(e, { editor: this });
	}
	update(e, t) {
		(function(e, t, n) {
			e._updating ? e._updates.push([t, n]) : qi(e, t, n);
		})(this, e, t);
	}
	focus(e, t = {}) {
		let n = this._rootElement;
		n !== null && (n.setAttribute("autocapitalize", "off"), Ji(this, () => {
			let r = j(), i = U();
			r === null ? i.getChildrenSize() !== 0 && (t.defaultSelection === "rootStart" ? i.selectStart() : i.selectEnd()) : r.dirty || W(r.clone()), ho("focus"), go(() => {
				n.removeAttribute("autocapitalize"), e && e();
			});
		}), this._pendingEditorState === null && n.removeAttribute("autocapitalize"));
	}
	blur() {
		let e = this._rootElement;
		e !== null && e.blur();
		let t = ko(this._window);
		t !== null && t.removeAllRanges();
	}
	isEditable() {
		return this._editable;
	}
	setEditable(e) {
		this._editable !== e && (this._editable = e, Gi("editable", this, !0, e));
	}
	toJSON() {
		return { editorState: this._editorState.toJSON() };
	}
};
pa.version = "0.40.0+prod.esm";
var ma = null;
function ha(e) {
	ma = e;
}
var ga = 1;
function _a(e, t) {
	let n = va(e, t);
	return n === void 0 && y(30, t), n;
}
function va(e, t) {
	return e._nodes.get(t);
}
var ya = typeof queueMicrotask == "function" ? queueMicrotask : (e) => {
	Promise.resolve().then(e);
};
function ba(e) {
	return R(Ba(e));
}
function xa(e) {
	let t = document.activeElement;
	if (!q(t)) return !1;
	let n = t.nodeName;
	return R(Ba(e)) && (n === "INPUT" || n === "TEXTAREA" || t.contentEditable === "true" && Ta(t) == null);
}
function Sa(e, t, n) {
	let r = e.getRootElement();
	try {
		return r !== null && r.contains(t) && r.contains(n) && t !== null && !xa(t) && wa(t) === e;
	} catch {
		return !1;
	}
}
function Ca(e) {
	return e instanceof pa;
}
function wa(e) {
	let t = e;
	for (; t != null;) {
		let e = Ta(t);
		if (Ca(e)) return e;
		t = po(t);
	}
	return null;
}
function Ta(e) {
	return e ? e.__lexicalEditor : null;
}
function Ea(e) {
	return Ee.test(e) ? "rtl" : De.test(e) ? "ltr" : null;
}
function Da(e) {
	return Zr(e) || e.isToken();
}
function Oa(e) {
	return Da(e) || e.isSegmented();
}
function ka(e) {
	return Mo(e) && e.nodeType === 3;
}
function Aa(e) {
	return Mo(e) && e.nodeType === 9;
}
function ja(e) {
	let t = e;
	for (; t != null;) {
		if (ka(t)) return t;
		t = t.firstChild;
	}
	return null;
}
function Ma(e, t, n) {
	let r = C[t];
	if (n !== null && (e & r) === (n & r)) return e;
	let i = e ^ r;
	return t === "subscript" ? i &= ~C.superscript : t === "superscript" ? i &= ~C.subscript : t === "lowercase" ? (i &= ~C.uppercase, i &= ~C.capitalize) : t === "uppercase" ? (i &= ~C.lowercase, i &= ~C.capitalize) : t === "capitalize" && (i &= ~C.lowercase, i &= ~C.uppercase), i;
}
function Na(e) {
	return O(e) || jr(e) || R(e);
}
function Pa(e, t) {
	let n = function() {
		let e = ma;
		return ma = null, e;
	}();
	if ((t ||= n && n.__key) != null) return void (e.__key = t);
	F(), Pi();
	let r = I(), i = Fi(), a = "" + ga++;
	i._nodeMap.set(a, e), L(e) ? r._dirtyElements.set(a, !0) : r._dirtyLeaves.add(a), r._cloneNotNeeded.add(a), r._dirtyType = 1, e.__key = a;
}
function Fa(e) {
	let t = e.getParent();
	if (t !== null) {
		let n = e.getWritable(), r = t.getWritable(), i = e.getPreviousSibling(), a = e.getNextSibling(), o = a === null ? null : a.__key, s = i === null ? null : i.__key, c = i === null ? null : i.getWritable(), l = a === null ? null : a.getWritable();
		i === null && (r.__first = o), a === null && (r.__last = s), c !== null && (c.__next = o), l !== null && (l.__prev = s), n.__prev = null, n.__next = null, n.__parent = null, r.__size--;
	}
}
function Ia(e) {
	Pi(), br(e) && y(323, e.__key, e.__type);
	let t = e.getLatest(), n = t.__parent, r = Fi(), i = I(), a = r._nodeMap, o = i._dirtyElements;
	n !== null && function(e, t, n) {
		let r = e;
		for (; r !== null;) {
			if (n.has(r)) return;
			let e = t.get(r);
			if (e === void 0) break;
			n.set(r, !1), r = e.__parent;
		}
	}(n, a, o);
	let s = t.__key;
	i._dirtyType = 1, L(e) ? o.set(s, !0) : i._dirtyLeaves.add(s);
}
function V(e) {
	F();
	let t = I(), n = t._compositionKey;
	if (e !== n) {
		if (t._compositionKey = e, n !== null) {
			let e = H(n);
			e !== null && e.getWritable();
		}
		if (e !== null) {
			let t = H(e);
			t !== null && t.getWritable();
		}
	}
}
function La() {
	return Ni() ? null : I()._compositionKey;
}
function H(e, t) {
	let n = (t || Fi())._nodeMap.get(e);
	return n === void 0 ? null : n;
}
function Ra(e, t) {
	let n = za(e, I());
	return n === void 0 ? null : H(n, t);
}
function za(e, t) {
	return e[`__lexicalKey_${t._key}`];
}
function Ba(e, t) {
	let n = e;
	for (; n != null;) {
		let e = Ra(n, t);
		if (e !== null) return e;
		n = po(n);
	}
	return null;
}
function Va(e) {
	let t = e._decorators, n = Object.assign({}, t);
	return e._pendingDecorators = n, n;
}
function Ha(e) {
	return e.read(() => U().getTextContent());
}
function U() {
	return Ua(Fi());
}
function Ua(e) {
	return e._nodeMap.get("root");
}
function W(e) {
	F();
	let t = Fi();
	e !== null && (e.dirty = !0, e.setCachedNodes(null)), t._selection = e;
}
function Wa(e) {
	let t = I(), n = function(e, t) {
		let n = e;
		for (; n != null;) {
			let e = za(n, t);
			if (e !== void 0) return e;
			n = po(n);
		}
		return null;
	}(e, t);
	return n === null ? e === t.getRootElement() ? H("root") : null : H(n);
}
function Ga(e) {
	return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(e);
}
function Ka(e) {
	let t = [], n = e;
	for (; n !== null;) t.push(n), n = n._parentEditor;
	return t;
}
function qa() {
	return Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 5);
}
function Ja(e) {
	return ka(e) ? e.nodeValue : null;
}
function Ya(e, t, n) {
	let r = ko(yo(t));
	if (r === null) return;
	let i = r.anchorNode, { anchorOffset: a, focusOffset: o } = r;
	if (i !== null) {
		let t = Ja(i), r = Ba(i);
		if (t !== null && O(r)) {
			if (t === xe && n) {
				let e = n.length;
				t = n, a = e, o = e;
			}
			t !== null && Xa(r, t, a, o, e);
		}
	}
}
function Xa(e, t, n, r, i) {
	let a = e;
	if (a.isAttached() && (i || !a.isDirty())) {
		let o = a.isComposing(), s = t;
		(o || i) && t[t.length - 1] === xe && (s = t.slice(0, -1));
		let c = a.getTextContent();
		if (i || s !== c) {
			if (s === "") {
				if (V(null), oe || se || de) a.remove();
				else {
					let e = I();
					setTimeout(() => {
						e.update(() => {
							a.isAttached() && a.remove();
						});
					}, 20);
				}
				return;
			}
			let t = a.getParent(), i = yi(), c = a.getTextContentSize(), l = La(), u = a.getKey();
			if (a.isToken() || l !== null && u === l && !o || k(i) && (t !== null && !t.canInsertTextBefore() && i.anchor.offset === 0 || i.anchor.key === e.__key && i.anchor.offset === 0 && !a.canInsertTextBefore() && !o || i.focus.key === e.__key && i.focus.offset === c && !a.canInsertTextAfter() && !o)) return void a.markDirty();
			let d = j();
			if (!k(d) || n === null || r === null) return void Za(a, s, d);
			if (d.setTextNodeRange(a, n, a, r), a.isSegmented()) {
				let e = D(a.getTextContent());
				a.replace(e), a = e;
			}
			Za(a, s, d);
		}
	}
}
function Za(e, t, n) {
	if (e.setTextContent(t), k(n)) {
		let t = e.getKey();
		for (let r of ["anchor", "focus"]) {
			let i = n[r];
			i.type === "text" && i.key === t && (i.offset = ls(e, i.offset, "clamp"));
		}
	}
}
function Qa(e, t, n) {
	let r = t[n] || !1;
	return r === "any" || r === e[n];
}
function $a(e, t) {
	return Qa(e, t, "altKey") && Qa(e, t, "ctrlKey") && Qa(e, t, "shiftKey") && Qa(e, t, "metaKey");
}
function G(e, t, n) {
	return $a(e, n) && e.key.toLowerCase() === t.toLowerCase();
}
var eo = {
	ctrlKey: !x,
	metaKey: x
}, to = {
	altKey: x,
	ctrlKey: !x
};
function no(e) {
	return e.key === "Backspace";
}
function ro(e) {
	return G(e, "a", eo);
}
function io(e) {
	let t = U();
	if (k(e)) {
		let t = e.anchor, n = e.focus, r = t.getNode().getTopLevelElementOrThrow().getParentOrThrow();
		return t.set(r.getKey(), 0, "element"), n.set(r.getKey(), r.getChildrenSize(), "element"), st(e), e;
	}
	{
		let e = t.select(0, t.getChildrenSize());
		return W(st(e)), e;
	}
}
function ao(e, t) {
	e.__lexicalClassNameCache === void 0 && (e.__lexicalClassNameCache = {});
	let n = e.__lexicalClassNameCache, r = n[t];
	if (r !== void 0) return r;
	let i = e[t];
	if (typeof i == "string") {
		let e = Ks(i);
		return n[t] = e, e;
	}
	return i;
}
function oo(e, t, n, r, i) {
	if (n.size === 0) return;
	let a = r.__type, o = r.__key, s = t.get(a);
	s === void 0 && y(33, a);
	let c = s.klass, l = e.get(c);
	l === void 0 && (l = /* @__PURE__ */ new Map(), e.set(c, l));
	let u = l.get(o), d = u === "destroyed" && i === "created";
	(u === void 0 || d) && l.set(o, d ? "updated" : i);
}
function so(e) {
	let t = e.getType(), n = Fi();
	if (n._readOnly) {
		let e = Bo(n).get(t);
		return e ? Array.from(e.values()) : [];
	}
	let r = n._nodeMap, i = [];
	for (let [, n] of r) n instanceof e && n.__type === t && n.isAttached() && i.push(n);
	return i;
}
function co(e, t, n) {
	let r = e.getParent(), i = n, a = e;
	return r !== null && (t && n === 0 ? (i = a.getIndexWithinParent(), a = r) : t || n !== a.getChildrenSize() || (i = a.getIndexWithinParent() + 1, a = r)), a.getChildAtIndex(t ? i - 1 : i);
}
function lo(e, t) {
	let n = e.offset;
	if (e.type === "element") return co(e.getNode(), t, n);
	{
		let r = e.getNode();
		if (t && n === 0 || !t && n === r.getTextContentSize()) {
			let e = t ? r.getPreviousSibling() : r.getNextSibling();
			return e === null ? co(r.getParentOrThrow(), t, r.getIndexWithinParent() + +!t) : e;
		}
	}
	return null;
}
function uo(e) {
	let t = yo(e).event, n = t && t.inputType;
	return n === "insertFromPaste" || n === "insertFromPasteAsQuotation";
}
function K(e, t, n) {
	return function(e, t, n) {
		let r = Ka(e);
		for (let i = 4; i >= 0; i--) for (let a = 0; a < r.length; a++) {
			let o = r[a], s = o._commands.get(t);
			if (s !== void 0) {
				let t = s[i];
				if (t !== void 0) {
					let r = Array.from(t), i = r.length, a = !1;
					if (Ji(o, () => {
						for (let t = 0; t < i; t++) if (r[t](n, e)) return void (a = !0);
					}), a) return a;
				}
			}
		}
		return !1;
	}(e, t, n);
}
function fo(e, t) {
	let n = e._keyToDOMMap.get(t);
	return n === void 0 && y(75, t), n;
}
function po(e) {
	let t = e.assignedSlot || e.parentElement;
	return No(t) ? t.host : t;
}
function mo(e) {
	return Aa(e) ? e : q(e) ? e.ownerDocument : null;
}
function ho(e) {
	F(), I()._updateTags.add(e);
}
function go(e) {
	F(), I()._deferred.push(e);
}
function _o(e, t) {
	let n = e.getParent();
	for (; n !== null;) {
		if (n.is(t)) return !0;
		n = n.getParent();
	}
	return !1;
}
function vo(e) {
	let t = mo(e);
	return t ? t.defaultView : null;
}
function yo(e) {
	let t = e._window;
	return t === null && y(78), t;
}
function bo(e) {
	return L(e) && e.isInline() || R(e) && e.isInline();
}
function xo(e) {
	let t = e.getParentOrThrow();
	for (; t !== null;) {
		if (So(t)) return t;
		t = t.getParentOrThrow();
	}
	return t;
}
function So(e) {
	return z(e) || L(e) && e.isShadowRoot();
}
function Co(e) {
	let t = e.constructor.clone(e);
	return Pa(t, null), t.afterCloneFrom(e), t;
}
function wo(e) {
	let t = I(), n = e.getType(), r = va(t, n);
	r === void 0 && y(200, e.constructor.name, n);
	let { replace: i, replaceWithKlass: a } = r;
	if (i !== null) {
		let t = i(e), r = t.constructor;
		return a === null ? t instanceof e.constructor && r !== e.constructor || y(202, r.name, r.getType(), e.constructor.name, n) : t instanceof a || y(201, a.name, a.getType(), r.name, r.getType(), e.constructor.name, n), t.__key === e.__key && y(203, e.constructor.name, n, r.name, r.getType()), t;
	}
	return e;
}
function To(e, t) {
	!z(e.getParent()) || L(t) || R(t) || y(99);
}
function Eo(e) {
	let t = H(e);
	return t === null && y(63, e), t;
}
function Do(e) {
	return (R(e) || L(e) && !e.canBeEmpty()) && !e.isInline();
}
function Oo(e, t, n) {
	n.style.removeProperty("caret-color"), t._blockCursorElement = null;
	let r = e.parentElement;
	r !== null && r.removeChild(e);
}
function ko(e) {
	return b ? (e || window).getSelection() : null;
}
function Ao(e) {
	let t = vo(e);
	return t ? t.getSelection() : null;
}
function jo(e) {
	return q(e) && e.tagName === "A";
}
function q(e) {
	return Mo(e) && e.nodeType === 1;
}
function Mo(e) {
	return typeof e == "object" && !!e && "nodeType" in e && typeof e.nodeType == "number";
}
function No(e) {
	return Mo(e) && e.nodeType === 11;
}
function Po(e) {
	let t = /* @__PURE__ */ new RegExp(/^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|mark|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/, "i");
	return e.nodeName.match(t) !== null;
}
function Fo(e) {
	let t = /* @__PURE__ */ new RegExp(/^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/, "i");
	return e.nodeName.match(t) !== null;
}
function Io(e) {
	if (R(e) && !e.isInline()) return !0;
	if (!L(e) || So(e)) return !1;
	let t = e.getFirstChild(), n = t === null || jr(t) || O(t) || t.isInline();
	return !e.isInline() && !1 !== e.canBeEmpty() && n;
}
function Lo() {
	return I();
}
var Ro = /* @__PURE__ */ new WeakMap(), zo = /* @__PURE__ */ new Map();
function Bo(e) {
	if (!e._readOnly && e.isEmpty()) return zo;
	e._readOnly || y(192);
	let t = Ro.get(e);
	return t || (t = function(e) {
		let t = /* @__PURE__ */ new Map();
		for (let [n, r] of e._nodeMap) {
			let e = r.__type, i = t.get(e);
			i || (i = /* @__PURE__ */ new Map(), t.set(e, i)), i.set(n, r);
		}
		return t;
	}(e), Ro.set(e, t)), t;
}
function Vo(e) {
	let t = e.constructor.clone(e);
	return t.afterCloneFrom(e), t;
}
function Ho(e) {
	return (t = Vo(e))[yr] = !0, t;
	var t;
}
function Uo(e, t) {
	let n = parseInt(e.style.paddingInlineStart, 10) || 0, r = Math.round(n / 40);
	t.setIndent(r);
}
function Wo(e) {
	e.__lexicalUnmanaged = !0;
}
function Go(e) {
	return !0 === e.__lexicalUnmanaged;
}
function Ko(e, t) {
	return function(e, t) {
		return Object.prototype.hasOwnProperty.call(e, t);
	}(e, t) && e[t] !== xr[t];
}
function qo(e) {
	let t = Ne in e.prototype ? e.prototype[Ne]() : void 0, n = function(e) {
		if (!(e === xr || e.prototype instanceof xr)) {
			let t = "<unknown>", n = "<unknown>";
			try {
				t = e.getType();
			} catch {}
			try {
				pa.version && (n = JSON.parse(pa.version));
			} catch {}
			y(290, e.name, t, n);
		}
		return e === $i || e === Zi || e === xr;
	}(e), r = !n && Ko(e, "getType") ? e.getType() : void 0, i, a = r;
	if (t) {
		if (r) i = t[r];
		else for (let [e, n] of Object.entries(t)) a = e, i = n;
	}
	if (!n && a && (Ko(e, "getType") || (e.getType = () => a), Ko(e, "clone") || (e.clone = (t) => (ha(t), new e())), Ko(e, "importJSON") || (e.importJSON = i && i.$importJSON || ((t) => new e().updateFromJSON(t))), !Ko(e, "importDOM") && i)) {
		let { importDOM: t } = i;
		t && (e.importDOM = () => t);
	}
	return {
		ownNodeConfig: i,
		ownNodeType: a
	};
}
function Jo(e) {
	let t = Lo();
	return F(), new (t.resolveRegisteredNodeAfterReplacements(t.getRegisteredNode(e))).klass();
}
var J = (e, t) => {
	let n = e;
	for (; n != null && !z(n);) {
		if (t(n)) return n;
		n = n.getParent();
	}
	return null;
}, Yo = {
	next: "previous",
	previous: "next"
}, Xo = class {
	origin;
	constructor(e) {
		this.origin = e;
	}
	[Symbol.iterator]() {
		return ys({
			hasNext: is,
			initial: this.getAdjacentCaret(),
			map: (e) => e,
			step: (e) => e.getAdjacentCaret()
		});
	}
	getAdjacentCaret() {
		return X(this.getNodeAtCaret(), this.direction);
	}
	getSiblingCaret() {
		return X(this.origin, this.direction);
	}
	remove() {
		let e = this.getNodeAtCaret();
		return e && e.remove(), this;
	}
	replaceOrInsert(e, t) {
		let n = this.getNodeAtCaret();
		return e.is(this.origin) || e.is(n) || (n === null ? this.insert(e) : n.replace(e, t)), this;
	}
	splice(e, t, n = "next") {
		let r = n === this.direction ? t : Array.from(t).reverse(), i = this, a = this.getParentAtCaret(), o = /* @__PURE__ */ new Map();
		for (let t = i.getAdjacentCaret(); t !== null && o.size < e; t = t.getAdjacentCaret()) {
			let e = t.origin.getWritable();
			o.set(e.getKey(), e);
		}
		for (let e of r) {
			if (o.size > 0) {
				let t = i.getNodeAtCaret();
				if (t) {
					if (o.delete(t.getKey()), o.delete(e.getKey()), !(t.is(e) || i.origin.is(e))) {
						let n = e.getParent();
						n && n.is(a) && e.remove(), t.replace(e);
					}
				} else t === null && y(263, Array.from(o).join(" "));
			} else i.insert(e);
			i = X(e, this.direction);
		}
		for (let e of o.values()) e.remove();
		return this;
	}
}, Zo = class e extends Xo {
	type = "child";
	getLatest() {
		let e = this.origin.getLatest();
		return e === this.origin ? this : ds(e, this.direction);
	}
	getParentCaret(e = "root") {
		return X(es(this.getParentAtCaret(), e), this.direction);
	}
	getFlipped() {
		let e = $o(this.direction);
		return X(this.getNodeAtCaret(), e) || ds(this.origin, e);
	}
	getParentAtCaret() {
		return this.origin;
	}
	getChildCaret() {
		return this;
	}
	isSameNodeCaret(t) {
		return t instanceof e && this.direction === t.direction && this.origin.is(t.origin);
	}
	isSamePointCaret(e) {
		return this.isSameNodeCaret(e);
	}
}, Qo = {
	root: z,
	shadowRoot: So
};
function $o(e) {
	return Yo[e];
}
function es(e, t = "root") {
	return Qo[t](e) ? null : e;
}
var ts = class e extends Xo {
	type = "sibling";
	getLatest() {
		let e = this.origin.getLatest();
		return e === this.origin ? this : X(e, this.direction);
	}
	getSiblingCaret() {
		return this;
	}
	getParentAtCaret() {
		return this.origin.getParent();
	}
	getChildCaret() {
		return L(this.origin) ? ds(this.origin, this.direction) : null;
	}
	getParentCaret(e = "root") {
		return X(es(this.getParentAtCaret(), e), this.direction);
	}
	getFlipped() {
		let e = $o(this.direction);
		return X(this.getNodeAtCaret(), e) || ds(this.origin.getParentOrThrow(), e);
	}
	isSamePointCaret(t) {
		return t instanceof e && this.direction === t.direction && this.origin.is(t.origin);
	}
	isSameNodeCaret(t) {
		return (t instanceof e || t instanceof ns) && this.direction === t.direction && this.origin.is(t.origin);
	}
}, ns = class e extends Xo {
	type = "text";
	offset;
	constructor(e, t) {
		super(e), this.offset = t;
	}
	getLatest() {
		let e = this.origin.getLatest();
		return e === this.origin ? this : cs(e, this.direction, this.offset);
	}
	getParentAtCaret() {
		return this.origin.getParent();
	}
	getChildCaret() {
		return null;
	}
	getParentCaret(e = "root") {
		return X(es(this.getParentAtCaret(), e), this.direction);
	}
	getFlipped() {
		return cs(this.origin, $o(this.direction), this.offset);
	}
	isSamePointCaret(t) {
		return t instanceof e && this.direction === t.direction && this.origin.is(t.origin) && this.offset === t.offset;
	}
	isSameNodeCaret(t) {
		return (t instanceof ts || t instanceof e) && this.direction === t.direction && this.origin.is(t.origin);
	}
	getSiblingCaret() {
		return X(this.origin, this.direction);
	}
};
function rs(e) {
	return e instanceof ns;
}
function is(e) {
	return e instanceof ts;
}
function Y(e) {
	return e instanceof Zo;
}
var as = {
	next: class extends ns {
		direction = "next";
		getNodeAtCaret() {
			return this.origin.getNextSibling();
		}
		insert(e) {
			return this.origin.insertAfter(e), this;
		}
	},
	previous: class extends ns {
		direction = "previous";
		getNodeAtCaret() {
			return this.origin.getPreviousSibling();
		}
		insert(e) {
			return this.origin.insertBefore(e), this;
		}
	}
}, os = {
	next: class extends ts {
		direction = "next";
		getNodeAtCaret() {
			return this.origin.getNextSibling();
		}
		insert(e) {
			return this.origin.insertAfter(e), this;
		}
	},
	previous: class extends ts {
		direction = "previous";
		getNodeAtCaret() {
			return this.origin.getPreviousSibling();
		}
		insert(e) {
			return this.origin.insertBefore(e), this;
		}
	}
}, ss = {
	next: class extends Zo {
		direction = "next";
		getNodeAtCaret() {
			return this.origin.getFirstChild();
		}
		insert(e) {
			return this.origin.splice(0, 0, [e]), this;
		}
	},
	previous: class extends Zo {
		direction = "previous";
		getNodeAtCaret() {
			return this.origin.getLastChild();
		}
		insert(e) {
			return this.origin.splice(this.origin.getChildrenSize(), 0, [e]), this;
		}
	}
};
function X(e, t) {
	return e ? new os[t](e) : null;
}
function cs(e, t, n) {
	return e ? new as[t](e, ls(e, n)) : null;
}
function ls(e, t, n = "error") {
	let r = e.getTextContentSize(), i = t === "next" ? r : t === "previous" ? 0 : t;
	return (i < 0 || i > r) && (n !== "clamp" && re(284, String(t), String(r), e.getKey()), i = i < 0 ? 0 : r), i;
}
function us(e, t) {
	return new hs(e, t);
}
function ds(e, t) {
	return L(e) ? new ss[t](e) : null;
}
function fs(e) {
	return e && e.getChildCaret() || e;
}
function ps(e) {
	return e && fs(e.getAdjacentCaret());
}
var ms = class e {
	type = "node-caret-range";
	direction;
	anchor;
	focus;
	constructor(e, t, n) {
		this.anchor = e, this.focus = t, this.direction = n;
	}
	getLatest() {
		let t = this.anchor.getLatest(), n = this.focus.getLatest();
		return t === this.anchor && n === this.focus ? this : new e(t, n, this.direction);
	}
	isCollapsed() {
		return this.anchor.isSamePointCaret(this.focus);
	}
	getTextSlices() {
		let e = (e) => {
			let t = this[e].getLatest();
			return rs(t) ? function(e, t) {
				let { direction: n, origin: r } = e;
				return us(e, ls(r, t === "focus" ? $o(n) : n) - e.offset);
			}(t, e) : null;
		}, t = e("anchor"), n = e("focus");
		if (t && n) {
			let { caret: e } = t, { caret: r } = n;
			if (e.isSameNodeCaret(r)) return [us(e, r.offset - e.offset), null];
		}
		return [t, n];
	}
	iterNodeCarets(e = "root") {
		let t = rs(this.anchor) ? this.anchor.getSiblingCaret() : this.anchor.getLatest(), n = this.focus.getLatest(), r = rs(n), i = (t) => t.isSameNodeCaret(n) ? null : ps(t) || t.getParentCaret(e);
		return ys({
			hasNext: (e) => e !== null && !(r && n.isSameNodeCaret(e)),
			initial: t.isSameNodeCaret(n) ? null : i(t),
			map: (e) => e,
			step: i
		});
	}
	[Symbol.iterator]() {
		return this.iterNodeCarets("root");
	}
}, hs = class {
	type = "slice";
	caret;
	distance;
	constructor(e, t) {
		this.caret = e, this.distance = t;
	}
	getSliceIndices() {
		let { distance: e, caret: { offset: t } } = this, n = t + e;
		return n < t ? [n, t] : [t, n];
	}
	getTextContent() {
		let [e, t] = this.getSliceIndices();
		return this.caret.origin.getTextContent().slice(e, t);
	}
	getTextContentSize() {
		return Math.abs(this.distance);
	}
	removeTextSlice() {
		let { caret: { origin: e, direction: t } } = this, [n, r] = this.getSliceIndices(), i = e.getTextContent();
		return cs(e.setTextContent(i.slice(0, n) + i.slice(r)), t, n);
	}
};
function gs(e) {
	return vs(e, X(U(), e.direction));
}
function _s(e) {
	return vs(e, e);
}
function vs(e, t) {
	return e.direction !== t.direction && y(265), new ms(e, t, e.direction);
}
function ys(e) {
	let { initial: t, hasNext: n, step: r, map: i } = e, a = t;
	return {
		[Symbol.iterator]() {
			return this;
		},
		next() {
			if (!n(a)) return {
				done: !0,
				value: void 0
			};
			let e = {
				done: !1,
				value: i(a)
			};
			return a = r(a), e;
		}
	};
}
function bs(e, t) {
	let n = ws(e.origin, t.origin);
	switch (n === null && y(275, e.origin.getKey(), t.origin.getKey()), n.type) {
		case "same": {
			let n = e.type === "text", r = t.type === "text";
			return n && r ? function(e, t) {
				return Math.sign(e - t);
			}(e.offset, t.offset) : e.type === t.type ? 0 : n ? -1 : r ? 1 : e.type === "child" ? -1 : 1;
		}
		case "ancestor": return e.type === "child" ? -1 : 1;
		case "descendant": return t.type === "child" ? 1 : -1;
		case "branch": return xs(n);
	}
}
function xs(e) {
	let { a: t, b: n } = e, r = t.__key, i = n.__key, a = t, o = n;
	for (; a && o; a = a.getNextSibling(), o = o.getNextSibling()) {
		if (a.__key === i) return -1;
		if (o.__key === r) return 1;
	}
	return a === null ? 1 : -1;
}
function Ss(e, t) {
	return t.is(e);
}
function Cs(e) {
	return L(e) ? [e.getLatest(), null] : [e.getParent(), e.getLatest()];
}
function ws(e, t) {
	if (e.is(t)) return {
		commonAncestor: e,
		type: "same"
	};
	let n = /* @__PURE__ */ new Map();
	for (let [t, r] = Cs(e); t; r = t, t = t.getParent()) n.set(t, r);
	for (let [r, i] = Cs(t); r; i = r, r = r.getParent()) {
		let a = n.get(r);
		if (a !== void 0) return a === null ? (Ss(e, r) || y(276), {
			commonAncestor: r,
			type: "ancestor"
		}) : i === null ? (Ss(t, r) || y(277), {
			commonAncestor: r,
			type: "descendant"
		}) : ((L(a) || Ss(e, a)) && (L(i) || Ss(t, i)) && r.is(a.getParent()) && r.is(i.getParent()) || y(278), {
			a,
			b: i,
			commonAncestor: r,
			type: "branch"
		});
	}
	return null;
}
function Ts(e, t) {
	let { type: n, key: r, offset: i } = e, a = Eo(e.key);
	return n === "text" ? (O(a) || y(266, a.getType(), r), cs(a, t, i)) : (L(a) || y(267, a.getType(), r), Rs(a, e.offset, t));
}
function Es(e, t) {
	let { origin: n, direction: r } = t, i = r === "next";
	rs(t) ? e.set(n.getKey(), t.offset, "text") : is(t) ? O(n) ? e.set(n.getKey(), ls(n, r), "text") : e.set(n.getParentOrThrow().getKey(), n.getIndexWithinParent() + +!!i, "element") : (Y(t) && L(n) || y(268), e.set(n.getKey(), i ? 0 : n.getChildrenSize(), "element"));
}
function Ds(e) {
	let t = j(), n = k(t) ? t : hi();
	return Os(n, e), W(n), n;
}
function Os(e, t) {
	Es(e.anchor, t.anchor), Es(e.focus, t.focus);
}
function ks(e) {
	let { anchor: t, focus: n } = e, r = Ts(t, "next"), i = Ts(n, "next"), a = bs(r, i) <= 0 ? "next" : "previous";
	return vs(Is(r, a), Is(i, a));
}
function As(e) {
	let { direction: t, origin: n } = e, r = X(n, $o(t)).getNodeAtCaret();
	return r ? X(r, t) : ds(n.getParentOrThrow(), t);
}
function js(e, t = "root") {
	let n = [e];
	for (let r = Y(e) ? e.getParentCaret(t) : e.getSiblingCaret(); r !== null; r = r.getParentCaret(t)) n.push(As(r));
	return n;
}
function Ms(e) {
	return !!e && e.origin.isAttached();
}
function Ns(e, t = "removeEmptySlices") {
	if (e.isCollapsed()) return e;
	let n = "root", r = "next", i = t, a = Ls(e, r), o = js(a.anchor, n), s = js(a.focus.getFlipped(), n), c = /* @__PURE__ */ new Set(), l = [];
	for (let e of a.iterNodeCarets(n)) if (Y(e)) c.add(e.origin.getKey());
	else if (is(e)) {
		let { origin: t } = e;
		L(t) && !c.has(t.getKey()) || l.push(t);
	}
	for (let e of l) e.remove();
	for (let e of a.getTextSlices()) {
		if (!e) continue;
		let { origin: t } = e.caret, n = t.getTextContentSize(), a = As(X(t, r)), c = t.getMode();
		if (Math.abs(e.distance) === n && i === "removeEmptySlices" || c === "token" && e.distance !== 0) a.remove();
		else if (e.distance !== 0) {
			i = "removeEmptySlices";
			let t = e.removeTextSlice(), n = e.caret.origin;
			if (c === "segmented") {
				let e = t.origin, n = D(e.getTextContent()).setStyle(e.getStyle()).setFormat(e.getFormat());
				a.replaceOrInsert(n), t = cs(n, r, t.offset);
			}
			n.is(o[0].origin) && (o[0] = t), n.is(s[0].origin) && (s[0] = t.getFlipped());
		}
	}
	let u, d;
	for (let e of o) if (Ms(e)) {
		u = Ps(e);
		break;
	}
	for (let e of s) if (Ms(e)) {
		d = Ps(e);
		break;
	}
	let f = function(e, t, n) {
		if (!e || !t) return null;
		let r = e.getParentAtCaret(), i = t.getParentAtCaret();
		if (!r || !i) return null;
		let a = r.getParents().reverse();
		a.push(r);
		let o = i.getParents().reverse();
		o.push(i);
		let s = Math.min(a.length, o.length), c = 0;
		for (; c < s && a[c] === o[c]; c++);
		let l = (e, t) => {
			let n;
			for (let r = c; r < e.length; r++) {
				let i = e[r];
				if (So(i)) return;
				!n && t(i) && (n = i);
			}
			return n;
		}, u = l(a, Io), d = u && l(o, (e) => n.has(e.getKey()) && Io(e));
		return u && d ? [u, d] : null;
	}(u, d, c);
	if (f) {
		let [e, t] = f;
		ds(e, "previous").splice(0, t.getChildren()), t.remove();
	}
	let p = [
		u,
		d,
		...o,
		...s
	].find(Ms);
	if (p) return _s(Is(Ps(p), e.direction));
	y(269, JSON.stringify(o.map((e) => e.origin.__key)));
}
function Ps(e) {
	let t = function(e) {
		let t = e;
		for (; Y(t);) {
			let e = ps(t);
			if (!Y(e)) break;
			t = e;
		}
		return t;
	}(e.getLatest()), { direction: n } = t;
	if (O(t.origin)) return rs(t) ? t : cs(t.origin, n, n);
	let r = t.getAdjacentCaret();
	return is(r) && O(r.origin) ? cs(r.origin, n, $o(n)) : t;
}
function Fs(e) {
	return rs(e) && e.offset !== ls(e.origin, e.direction);
}
function Is(e, t) {
	return e.direction === t ? e : e.getFlipped();
}
function Ls(e, t) {
	return e.direction === t ? e : vs(Is(e.focus, t), Is(e.anchor, t));
}
function Rs(e, t, n) {
	let r = ds(e, "next");
	for (let e = 0; e < t; e++) {
		let e = r.getAdjacentCaret();
		if (e === null) break;
		r = e;
	}
	return Is(r, n);
}
function zs(e) {
	let { origin: t, offset: n, direction: r } = e;
	if (n === ls(t, r)) return e.getSiblingCaret();
	if (n === ls(t, $o(r))) return As(e.getSiblingCaret());
	let [i] = t.splitText(n);
	return O(i) || y(281), Is(X(i, "next"), r);
}
function Bs(e, t) {
	return !0;
}
function Vs(e, { $copyElementNode: t = Co, $splitTextPointCaretNext: n = zs, rootMode: r = "shadowRoot", $shouldSplit: i = Bs } = {}) {
	if (rs(e)) return n(e);
	let a = e.getParentCaret(r);
	if (a) {
		let { origin: n } = a;
		if (Y(e) && (!n.canBeEmpty() || !i(n, "first"))) return As(a);
		let r = function(e) {
			let t = [];
			for (let n = e.getAdjacentCaret(); n; n = n.getAdjacentCaret()) t.push(n.origin);
			return t;
		}(e);
		(r.length > 0 || n.canBeEmpty() && i(n, "last")) && a.insert(t(n).splice(0, 0, r));
	}
	return a;
}
function Hs(e) {
	return e;
}
function Us(...e) {
	return e;
}
function Ws(e) {
	return e;
}
function Gs(e, t) {
	if (!t || e === t) return e;
	for (let n in t) if (e[n] !== t[n]) return {
		...e,
		...t
	};
	return e;
}
function Ks(...e) {
	let t = [];
	for (let n of e) if (n && typeof n == "string") for (let [e] of n.matchAll(/\S+/g)) t.push(e);
	return t;
}
function qs(e, ...t) {
	let n = Ks(...t);
	n.length > 0 && e.classList.add(...n);
}
function Js(e, ...t) {
	let n = Ks(...t);
	n.length > 0 && e.classList.remove(...n);
}
function Ys(...e) {
	return () => {
		for (let t = e.length - 1; t >= 0; t--) e[t]();
		e.length = 0;
	};
}
// node_modules/.bun/@lexical+selection@0.40.0/node_modules/@lexical/selection/LexicalSelection.prod.mjs
function Xs(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
var Zs = /* @__PURE__ */ new Map();
function Qs(e) {
	let t = e;
	for (; t != null;) {
		if (t.nodeType === Node.TEXT_NODE) return t;
		t = t.firstChild;
	}
	return null;
}
function $s(e) {
	let t = e.parentNode;
	if (t == null) throw Error("Should never happen");
	return [t, Array.from(t.childNodes).indexOf(e)];
}
function ec(e, t, n, r, i) {
	let a = t.getKey(), o = r.getKey(), s = document.createRange(), c = e.getElementByKey(a), l = e.getElementByKey(o), u = n, d = i;
	if (O(t) && (c = Qs(c)), O(r) && (l = Qs(l)), t === void 0 || r === void 0 || c === null || l === null) return null;
	c.nodeName === "BR" && ([c, u] = $s(c)), l.nodeName === "BR" && ([l, d] = $s(l));
	let f = c.firstChild;
	c === l && f != null && f.nodeName === "BR" && u === 0 && d === 0 && (d = 1);
	try {
		s.setStart(c, u), s.setEnd(l, d);
	} catch {
		return null;
	}
	return !s.collapsed || u === d && a === o || (s.setStart(l, d), s.setEnd(c, u)), s;
}
function tc(e, t) {
	let n = e.getRootElement();
	if (n === null) return [];
	let r = n.getBoundingClientRect(), i = getComputedStyle(n), a = parseFloat(i.paddingLeft) + parseFloat(i.paddingRight), o = Array.from(t.getClientRects()), s, c = o.length;
	o.sort((e, t) => {
		let n = e.top - t.top;
		return Math.abs(n) <= 3 ? e.left - t.left : n;
	});
	for (let e = 0; e < c; e++) {
		let t = o[e], n = s && s.top <= t.top && s.top + s.height > t.top && s.left + s.width > t.left, i = t.width + a === r.width;
		n || i ? (o.splice(e--, 1), c--) : s = t;
	}
	return o;
}
function nc(e) {
	let t = {};
	if (!e) return t;
	let n = e.split(";");
	for (let e of n) if (e !== "") {
		let [n, r] = e.split(/:([^]+)/);
		n && r && (t[n.trim()] = r.trim());
	}
	return t;
}
function rc(e) {
	let t = Zs.get(e);
	return t === void 0 && (t = nc(e), Zs.set(e, t)), t;
}
function ic(e) {
	let t = Lo().getElementByKey(e.getKey());
	if (t === null) return null;
	let n = t.ownerDocument.defaultView;
	return n === null ? null : n.getComputedStyle(t);
}
function ac(e) {
	return ic(z(e) ? e : e.getParentOrThrow());
}
function oc(e) {
	let t = ac(e);
	return t !== null && t.direction === "rtl";
}
function sc(e, t, n = "self") {
	let r = e.getStartEndPoints();
	if (t.isSelected(e) && !Oa(t) && r !== null) {
		let [i, a] = r, o = e.isBackward(), s = i.getNode(), c = a.getNode(), l = t.is(s), u = t.is(c);
		if (l || u) {
			let [r, i] = ai(e), a = s.is(c), l = t.is(o ? c : s), u = t.is(o ? s : c), d, f = 0;
			a ? (f = r > i ? i : r, d = r > i ? r : i) : l ? (f = o ? i : r, d = void 0) : u && (f = 0, d = o ? r : i);
			let p = t.__text.slice(f, d);
			p !== t.__text && (n === "clone" && (t = Ho(t)), t.__text = p);
		}
	}
	return t;
}
function cc(e) {
	if (e.type === "text") return e.offset === e.getNode().getTextContentSize();
	let t = e.getNode();
	return L(t) || Xs(177), e.offset === t.getChildrenSize();
}
function lc(e) {
	let t = e.getStyle(), n = nc(t);
	Zs.set(t, n);
}
function uc(e, t) {
	let n = e.getFormatType(), r = e.getIndent();
	n !== t.getFormatType() && t.setFormat(n), r !== t.getIndent() && t.setIndent(r);
}
function dc(e, t, n = uc) {
	if (e === null) return;
	let r = e.getStartEndPoints(), i = /* @__PURE__ */ new Map(), a = null;
	if (r) {
		let [e, t] = r;
		a = hi(), a.anchor.set(e.key, e.offset, e.type), a.focus.set(t.key, t.offset, t.type);
		let n = J(e.getNode(), Io), o = J(t.getNode(), Io);
		L(n) && i.set(n.getKey(), n), L(o) && i.set(o.getKey(), o);
	}
	for (let t of e.getNodes()) if (L(t) && Io(t)) i.set(t.getKey(), t);
	else if (r === null) {
		let e = J(t, Io);
		L(e) && i.set(e.getKey(), e);
	}
	for (let [e, r] of i) {
		let i = t();
		n(r, i), r.replace(i, !0), a && (e === a.anchor.key && a.anchor.set(i.getKey(), a.anchor.offset, a.anchor.type), e === a.focus.key && a.focus.set(i.getKey(), a.focus.offset, a.focus.type));
	}
	a && e.is(j()) && W(a);
}
function fc(e) {
	let t = pc(e);
	return t !== null && t.writingMode === "vertical-rl";
}
function pc(e) {
	let t = e.anchor.getNode();
	return L(t) ? ic(t) : ac(t);
}
function mc(e, t) {
	let n = fc(e) ? !t : t;
	gc(e) && (n = !n);
	let r = Ts(e.focus, n ? "previous" : "next");
	if (Fs(r)) return !1;
	for (let e of gs(r)) {
		if (Y(e)) return !e.origin.isInline();
		if (!L(e.origin)) {
			if (R(e.origin)) return !0;
			break;
		}
	}
	return !1;
}
function hc(e, t, n, r) {
	e.modify(t ? "extend" : "move", n, r);
}
function gc(e) {
	let t = pc(e);
	return t !== null && t.direction === "rtl";
}
function _c(e, t, n) {
	let r = gc(e), i;
	i = fc(e) || r ? !n : n, hc(e, t, i, "character");
}
// node_modules/.bun/@lexical+utils@0.40.0/node_modules/@lexical/utils/LexicalUtils.prod.mjs
function vc(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
var yc = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, bc = yc && "documentMode" in document ? document.documentMode : null;
yc && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
var xc = yc && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);
yc && "InputEvent" in window && !bc && "getTargetRanges" in new window.InputEvent("input"), yc && /Version\/[\d.]+.*Safari/.test(navigator.userAgent), yc && /iPad|iPhone|iPod/.test(navigator.userAgent) && window.MSStream, yc && /Android/.test(navigator.userAgent), yc && /^(?=.*Chrome).*/i.test(navigator.userAgent), yc && /AppleWebKit\/[\d.]+/.test(navigator.userAgent);
var Sc = yc, Cc = xc;
function wc(e) {
	return e ? e.getAdjacentCaret() : null;
}
function Tc(e, t) {
	let n = e;
	for (; n != null;) {
		if (n instanceof t) return n;
		n = n.getParent();
	}
	return null;
}
function Ec(e) {
	let t = J(e, (e) => L(e) && !e.isInline());
	return L(t) || vc(4, e.__key), t;
}
function Dc(e) {
	let t = j() || yi(), n;
	if (k(t)) n = Ts(t.focus, "next");
	else {
		if (t != null) {
			let e = t.getNodes(), r = e[e.length - 1];
			r && (n = X(r, "next"));
		}
		n ||= ds(U(), "previous").getFlipped().insert(B());
	}
	let r = Oc(e, n), i = ps(r);
	return Ds(_s(Y(i) ? Ps(i) : r)), e.getLatest();
}
function Oc(e, t, n) {
	let r = Is(t, "next");
	for (let e = r; e; e = Vs(e, n)) r = e;
	return rs(r) && vc(283), r.insert(e.isInline() ? B().append(e) : e), Is(X(e.getLatest(), "next"), t.direction);
}
function kc(e, t) {
	return e !== null && Object.getPrototypeOf(e).constructor.name === t.name;
}
function Ac(e, t) {
	ds(e, "next").insert(t);
}
var jc = !(Cc || !Sc) && void 0;
function Mc(e, t = !1) {
	let n = 1;
	if (function() {
		if (jc === void 0) {
			let e = document.createElement("div");
			e.style.cssText = "position: absolute; opacity: 0; width: 100px; left: -1000px;", document.body.appendChild(e);
			let t = e.getBoundingClientRect();
			e.style.setProperty("zoom", "2"), jc = e.getBoundingClientRect().width === t.width, document.body.removeChild(e);
		}
		return jc;
	}() || t) for (; e;) n *= Number(window.getComputedStyle(e).getPropertyValue("zoom")), e = e.parentElement;
	return n;
}
function Nc(e, t) {
	return Pc(e, t, null);
}
function Pc(e, t, n) {
	let r = !1;
	for (let i of Ic(e)) t(i) ? n !== null && n(i) : (r = !0, L(i) && Pc(i, t, n || ((e) => i.insertAfter(e))), i.remove());
	return r;
}
function Fc(e, t) {
	let n = [], r = Array.from(e).reverse();
	for (let e = r.pop(); e !== void 0; e = r.pop()) if (t(e)) n.push(e);
	else if (L(e)) for (let t of Ic(e)) r.push(t);
	return n;
}
function Ic(e) {
	return Lc(ds(e, "previous"));
}
function Lc(e) {
	return ys({
		hasNext: is,
		initial: e.getAdjacentCaret(),
		map: (e) => e.origin.getLatest(),
		step: (e) => e.getAdjacentCaret()
	});
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalComposer.prod.mjs
var Rc = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, zc = Rc ? d : u, Bc = { tag: wr };
function Vc({ initialConfig: e, children: r }) {
	let i = f(() => {
		let { theme: t, namespace: r, nodes: i, onError: a, editorState: o, html: s } = e, c = n(null, t), l = fa({
			editable: e.editable,
			html: s,
			namespace: r,
			nodes: i,
			onError: (e) => a(e, l),
			theme: t
		});
		return function(e, t) {
			if (t !== null) {
				if (t === void 0) e.update(() => {
					let t = U();
					if (t.isEmpty()) {
						let n = B();
						t.append(n);
						let r = Rc ? document.activeElement : null;
						(j() !== null || r !== null && r === e.getRootElement()) && n.select();
					}
				}, Bc);
				else if (t !== null) switch (typeof t) {
					case "string": {
						let n = e.parseEditorState(t);
						e.setEditorState(n, Bc);
						break;
					}
					case "object":
						e.setEditorState(t, Bc);
						break;
					case "function": e.update(() => {
						U().isEmpty() && t(e);
					}, Bc);
				}
			}
		}(l, o), [l, c];
	}, []);
	return zc(() => {
		let t = e.editable, [n] = i;
		n.setEditable(t === void 0 || t);
	}, []), _(t.Provider, {
		value: i,
		children: r
	});
}
// node_modules/.bun/react-error-boundary@6.1.1+b1ab299f0a400331/node_modules/react-error-boundary/dist/react-error-boundary.js
var Hc = o(null), Uc = {
	didCatch: !1,
	error: null
}, Wc = class extends i {
	constructor(e) {
		super(e), this.resetErrorBoundary = this.resetErrorBoundary.bind(this), this.state = Uc;
	}
	static getDerivedStateFromError(e) {
		return {
			didCatch: !0,
			error: e
		};
	}
	resetErrorBoundary(...e) {
		let { error: t } = this.state;
		t !== null && (this.props.onReset?.({
			args: e,
			reason: "imperative-api"
		}), this.setState(Uc));
	}
	componentDidCatch(e, t) {
		this.props.onError?.(e, t);
	}
	componentDidUpdate(e, t) {
		let { didCatch: n } = this.state, { resetKeys: r } = this.props;
		n && t.error !== null && Gc(e.resetKeys, r) && (this.props.onReset?.({
			next: r,
			prev: e.resetKeys,
			reason: "keys"
		}), this.setState(Uc));
	}
	render() {
		let { children: e, fallbackRender: t, FallbackComponent: n, fallback: r } = this.props, { didCatch: i, error: a } = this.state, o = e;
		if (i) {
			let e = {
				error: a,
				resetErrorBoundary: this.resetErrorBoundary
			};
			if (typeof t == "function") o = t(e);
			else if (n) o = s(n, e);
			else if (r !== void 0) o = r;
			else throw a;
		}
		return s(Hc.Provider, { value: {
			didCatch: i,
			error: a,
			resetErrorBoundary: this.resetErrorBoundary
		} }, o);
	}
};
function Gc(e = [], t = []) {
	return e.length !== t.length || e.some((e, n) => !Object.is(e, t[n]));
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalErrorBoundary.prod.mjs
function Kc({ children: e, onError: t }) {
	return _(Wc, {
		fallback: _("div", {
			style: {
				border: "1px solid #f00",
				color: "#f00",
				padding: "8px"
			},
			children: "An error was thrown."
		}),
		onError: t,
		children: e
	});
}
// node_modules/.bun/@lexical+extension@0.40.0/node_modules/@lexical/extension/LexicalExtension.prod.mjs
var qc = Symbol.for("preact-signals");
function Jc() {
	if (Qc > 1) return void Qc--;
	let e, t = !1;
	for (; Xc !== void 0;) {
		let n = Xc;
		for (Xc = void 0, $c++; n !== void 0;) {
			let r = n.o;
			if (n.o = void 0, n.f &= -3, !(8 & n.f) && rl(n)) try {
				n.c();
			} catch (n) {
				t ||= (e = n, !0);
			}
			n = r;
		}
	}
	if ($c = 0, Qc--, t) throw e;
}
function Yc(e) {
	if (Qc > 0) return e();
	Qc++;
	try {
		return e();
	} finally {
		Jc();
	}
}
var Z, Xc;
function Zc(e) {
	let t = Z;
	Z = void 0;
	try {
		return e();
	} finally {
		Z = t;
	}
}
var Qc = 0, $c = 0, el = 0;
function tl(e) {
	if (Z === void 0) return;
	let t = e.n;
	return t === void 0 || t.t !== Z ? (t = {
		i: 0,
		S: e,
		p: Z.s,
		n: void 0,
		t: Z,
		e: void 0,
		x: void 0,
		r: t
	}, Z.s !== void 0 && (Z.s.n = t), Z.s = t, e.n = t, 32 & Z.f && e.S(t), t) : t.i === -1 ? (t.i = 0, t.n !== void 0 && (t.n.p = t.p, t.p !== void 0 && (t.p.n = t.n), t.p = Z.s, t.n = void 0, Z.s.n = t, Z.s = t), t) : void 0;
}
function Q(e, t) {
	this.v = e, this.i = 0, this.n = void 0, this.t = void 0, this.W = t?.watched, this.Z = t?.unwatched, this.name = t?.name;
}
function nl(e, t) {
	return new Q(e, t);
}
function rl(e) {
	for (let t = e.s; t !== void 0; t = t.n) if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0;
	return !1;
}
function il(e) {
	for (let t = e.s; t !== void 0; t = t.n) {
		let n = t.S.n;
		if (n !== void 0 && (t.r = n), t.S.n = t, t.i = -1, t.n === void 0) {
			e.s = t;
			break;
		}
	}
}
function al(e) {
	let t, n = e.s;
	for (; n !== void 0;) {
		let e = n.p;
		n.i === -1 ? (n.S.U(n), e !== void 0 && (e.n = n.n), n.n !== void 0 && (n.n.p = e)) : t = n, n.S.n = n.r, n.r !== void 0 && (n.r = void 0), n = e;
	}
	e.s = t;
}
function ol(e, t) {
	Q.call(this, void 0), this.x = e, this.s = void 0, this.g = el - 1, this.f = 4, this.W = t?.watched, this.Z = t?.unwatched, this.name = t?.name;
}
function sl(e) {
	let t = e.u;
	if (e.u = void 0, typeof t == "function") {
		Qc++;
		let n = Z;
		Z = void 0;
		try {
			t();
		} catch (t) {
			throw e.f &= -2, e.f |= 8, cl(e), t;
		} finally {
			Z = n, Jc();
		}
	}
}
function cl(e) {
	for (let t = e.s; t !== void 0; t = t.n) t.S.U(t);
	e.x = void 0, e.s = void 0, sl(e);
}
function ll(e) {
	if (Z !== this) throw Error("Out-of-order effect");
	al(this), Z = e, this.f &= -2, 8 & this.f && cl(this), Jc();
}
function ul(e, t) {
	this.x = e, this.u = void 0, this.s = void 0, this.o = void 0, this.f = 32, this.name = t?.name;
}
function dl(e, t) {
	let n = new ul(e, t);
	try {
		n.c();
	} catch (e) {
		throw n.d(), e;
	}
	let r = n.d.bind(n);
	return r[Symbol.dispose] = r, r;
}
function fl(e, t = {}) {
	let n = {};
	for (let r in e) {
		let i = t[r];
		n[r] = nl(i === void 0 ? e[r] : i);
	}
	return n;
}
Q.prototype.brand = qc, Q.prototype.h = function() {
	return !0;
}, Q.prototype.S = function(e) {
	let t = this.t;
	t !== e && e.e === void 0 && (e.x = t, this.t = e, t === void 0 ? Zc(() => {
		var e;
		(e = this.W) == null || e.call(this);
	}) : t.e = e);
}, Q.prototype.U = function(e) {
	if (this.t !== void 0) {
		let t = e.e, n = e.x;
		t !== void 0 && (t.x = n, e.e = void 0), n !== void 0 && (n.e = t, e.x = void 0), e === this.t && (this.t = n, n === void 0 && Zc(() => {
			var e;
			(e = this.Z) == null || e.call(this);
		}));
	}
}, Q.prototype.subscribe = function(e) {
	return dl(() => {
		let t = this.value, n = Z;
		Z = void 0;
		try {
			e(t);
		} finally {
			Z = n;
		}
	}, { name: "sub" });
}, Q.prototype.valueOf = function() {
	return this.value;
}, Q.prototype.toString = function() {
	return this.value + "";
}, Q.prototype.toJSON = function() {
	return this.value;
}, Q.prototype.peek = function() {
	let e = Z;
	Z = void 0;
	try {
		return this.value;
	} finally {
		Z = e;
	}
}, Object.defineProperty(Q.prototype, "value", {
	get() {
		let e = tl(this);
		return e !== void 0 && (e.i = this.i), this.v;
	},
	set(e) {
		if (e !== this.v) {
			if ($c > 100) throw Error("Cycle detected");
			this.v = e, this.i++, el++, Qc++;
			try {
				for (let e = this.t; e !== void 0; e = e.x) e.t.N();
			} finally {
				Jc();
			}
		}
	}
}), ol.prototype = new Q(), ol.prototype.h = function() {
	if (this.f &= -3, 1 & this.f) return !1;
	if ((36 & this.f) == 32 || (this.f &= -5, this.g === el)) return !0;
	if (this.g = el, this.f |= 1, this.i > 0 && !rl(this)) return this.f &= -2, !0;
	let e = Z;
	try {
		il(this), Z = this;
		let e = this.x();
		(16 & this.f || this.v !== e || this.i === 0) && (this.v = e, this.f &= -17, this.i++);
	} catch (e) {
		this.v = e, this.f |= 16, this.i++;
	}
	return Z = e, al(this), this.f &= -2, !0;
}, ol.prototype.S = function(e) {
	if (this.t === void 0) {
		this.f |= 36;
		for (let e = this.s; e !== void 0; e = e.n) e.S.S(e);
	}
	Q.prototype.S.call(this, e);
}, ol.prototype.U = function(e) {
	if (this.t !== void 0 && (Q.prototype.U.call(this, e), this.t === void 0)) {
		this.f &= -33;
		for (let e = this.s; e !== void 0; e = e.n) e.S.U(e);
	}
}, ol.prototype.N = function() {
	if (!(2 & this.f)) {
		this.f |= 6;
		for (let e = this.t; e !== void 0; e = e.x) e.t.N();
	}
}, Object.defineProperty(ol.prototype, "value", { get() {
	if (1 & this.f) throw Error("Cycle detected");
	let e = tl(this);
	if (this.h(), e !== void 0 && (e.i = this.i), 16 & this.f) throw this.v;
	return this.v;
} }), ul.prototype.c = function() {
	let e = this.S();
	try {
		if (8 & this.f || this.x === void 0) return;
		let e = this.x();
		typeof e == "function" && (this.u = e);
	} finally {
		e();
	}
}, ul.prototype.S = function() {
	if (1 & this.f) throw Error("Cycle detected");
	this.f |= 1, this.f &= -9, sl(this), il(this), Qc++;
	let e = Z;
	return Z = this, ll.bind(this, e);
}, ul.prototype.N = function() {
	2 & this.f || (this.f |= 2, this.o = Xc, Xc = this);
}, ul.prototype.d = function() {
	this.f |= 8, 1 & this.f || cl(this);
}, ul.prototype.dispose = function() {
	this.d();
};
function pl(e) {
	return (typeof e.nodes == "function" ? e.nodes() : e.nodes) || [];
}
function $(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
function ml(e, t) {
	if (e && t && !Array.isArray(t) && typeof e == "object" && typeof t == "object") {
		let n = e, r = t;
		for (let e in r) n[e] = ml(n[e], r[e]);
		return e;
	}
	return t;
}
var hl = 0, gl = 1, _l = 2, vl = 3, yl = 4, bl = 5, xl = 6, Sl = 7;
function Cl(e) {
	return e.id === hl;
}
function wl(e) {
	return e.id === _l;
}
function Tl(e) {
	return function(e) {
		return e.id === gl;
	}(e) || $(305, String(e.id), String(gl)), Object.assign(e, { id: _l });
}
var El = /* @__PURE__ */ new Set(), Dl = class {
	builder;
	configs;
	_dependency;
	_peerNameSet;
	extension;
	state;
	_signal;
	constructor(e, t) {
		this.builder = e, this.extension = t, this.configs = /* @__PURE__ */ new Set(), this.state = { id: hl };
	}
	mergeConfigs() {
		let e = this.extension.config || {}, t = this.extension.mergeConfig ? this.extension.mergeConfig.bind(this.extension) : Gs;
		for (let n of this.configs) e = t(e, n);
		return e;
	}
	init(e) {
		let t = this.state;
		wl(t) || $(306, String(t.id));
		let n = {
			getDependency: this.getInitDependency.bind(this),
			getDirectDependentNames: this.getDirectDependentNames.bind(this),
			getPeer: this.getInitPeer.bind(this),
			getPeerNameSet: this.getPeerNameSet.bind(this)
		}, r = {
			...n,
			getDependency: this.getDependency.bind(this),
			getInitResult: this.getInitResult.bind(this),
			getPeer: this.getPeer.bind(this)
		}, i = function(e, t, n) {
			return Object.assign(e, {
				config: t,
				id: vl,
				registerState: n
			});
		}(t, this.mergeConfigs(), n), a;
		this.state = i, this.extension.init && (a = this.extension.init(e, i.config, n)), this.state = function(e, t, n) {
			return Object.assign(e, {
				id: yl,
				initResult: t,
				registerState: n
			});
		}(i, a, r);
	}
	build(e) {
		let t = this.state, n;
		t.id !== yl && $(307, String(t.id), String(bl)), this.extension.build && (n = this.extension.build(e, t.config, t.registerState));
		let r = {
			...t.registerState,
			getOutput: () => n,
			getSignal: this.getSignal.bind(this)
		};
		this.state = function(e, t, n) {
			return Object.assign(e, {
				id: bl,
				output: t,
				registerState: n
			});
		}(t, n, r);
	}
	register(e, t) {
		this._signal = t;
		let n = this.state;
		n.id !== bl && $(308, String(n.id), String(bl));
		let r = this.extension.register && this.extension.register(e, n.config, n.registerState);
		return this.state = function(e) {
			return Object.assign(e, { id: xl });
		}(n), () => {
			let e = this.state;
			e.id !== Sl && $(309, String(n.id), String(Sl)), this.state = function(e) {
				return Object.assign(e, { id: bl });
			}(e), r && r();
		};
	}
	afterRegistration(e) {
		let t = this.state, n;
		return t.id !== xl && $(310, String(t.id), String(xl)), this.extension.afterRegistration && (n = this.extension.afterRegistration(e, t.config, t.registerState)), this.state = function(e) {
			return Object.assign(e, { id: Sl });
		}(t), n;
	}
	getSignal() {
		return this._signal === void 0 && $(311), this._signal;
	}
	getInitResult() {
		this.extension.init === void 0 && $(312, this.extension.name);
		let e = this.state;
		return function(e) {
			return e.id >= yl;
		}(e) || $(313, String(e.id), String(yl)), e.initResult;
	}
	getInitPeer(e) {
		let t = this.builder.extensionNameMap.get(e);
		return t ? t.getExtensionInitDependency() : void 0;
	}
	getExtensionInitDependency() {
		let e = this.state;
		return function(e) {
			return e.id >= vl;
		}(e) || $(314, String(e.id), String(vl)), { config: e.config };
	}
	getPeer(e) {
		let t = this.builder.extensionNameMap.get(e);
		return t ? t.getExtensionDependency() : void 0;
	}
	getInitDependency(e) {
		let t = this.builder.getExtensionRep(e);
		return t === void 0 && $(315, this.extension.name, e.name), t.getExtensionInitDependency();
	}
	getDependency(e) {
		let t = this.builder.getExtensionRep(e);
		return t === void 0 && $(315, this.extension.name, e.name), t.getExtensionDependency();
	}
	getState() {
		let e = this.state;
		return function(e) {
			return e.id >= Sl;
		}(e) || $(316, String(e.id), String(Sl)), e;
	}
	getDirectDependentNames() {
		return this.builder.incomingEdges.get(this.extension.name) || El;
	}
	getPeerNameSet() {
		let e = this._peerNameSet;
		return e || (e = new Set((this.extension.peerDependencies || []).map(([e]) => e)), this._peerNameSet = e), e;
	}
	getExtensionDependency() {
		if (!this._dependency) {
			let e = this.state;
			(function(e) {
				return e.id >= bl;
			})(e) || $(317, this.extension.name), this._dependency = {
				config: e.config,
				init: e.initResult,
				output: e.output
			};
		}
		return this._dependency;
	}
}, Ol = { tag: wr };
function kl() {
	let e = U();
	e.isEmpty() && e.append(B());
}
var Al = Hs({
	config: Ws({
		setOptions: Ol,
		updateOptions: Ol
	}),
	init: ({ $initialEditorState: e = kl }) => ({
		$initialEditorState: e,
		initialized: !1
	}),
	afterRegistration(e, { updateOptions: t, setOptions: n }, r) {
		let i = r.getInitResult();
		if (!i.initialized) {
			i.initialized = !0;
			let { $initialEditorState: r } = i;
			if (ia(r)) e.setEditorState(r, n);
			else if (typeof r == "function") e.update(() => {
				r(e);
			}, t);
			else if (r && (typeof r == "string" || typeof r == "object")) {
				let t = e.parseEditorState(r);
				e.setEditorState(t, n);
			}
		}
		return () => {};
	},
	name: "@lexical/extension/InitialState",
	nodes: [
		ea,
		zr,
		Or,
		Yr,
		sa
	]
}), jl = Symbol.for("@lexical/extension/LexicalBuilder");
function Ml() {}
function Nl(e) {
	throw e;
}
function Pl(e) {
	return Array.isArray(e) ? e : [e];
}
var Fl = "0.40.0+prod.esm", Il = class e {
	roots;
	extensionNameMap;
	outgoingConfigEdges;
	incomingEdges;
	conflicts;
	_sortedExtensionReps;
	PACKAGE_VERSION;
	constructor(e) {
		this.outgoingConfigEdges = /* @__PURE__ */ new Map(), this.incomingEdges = /* @__PURE__ */ new Map(), this.extensionNameMap = /* @__PURE__ */ new Map(), this.conflicts = /* @__PURE__ */ new Map(), this.PACKAGE_VERSION = Fl, this.roots = e;
		for (let t of e) this.addExtension(t);
	}
	static fromExtensions(t) {
		let n = [Pl(Al)];
		for (let e of t) n.push(Pl(e));
		return new e(n);
	}
	static maybeFromEditor(t) {
		let n = t[jl];
		return n && (n.PACKAGE_VERSION !== Fl && $(292, n.PACKAGE_VERSION, Fl), n instanceof e || $(293)), n;
	}
	static fromEditor(t) {
		let n = e.maybeFromEditor(t);
		return n === void 0 && $(294), n;
	}
	constructEditor() {
		let { $initialEditorState: e, onError: t, ...n } = this.buildCreateEditorArgs(), r = Object.assign(fa({
			...n,
			...t ? { onError: (e) => {
				t(e, r);
			} } : {}
		}), { [jl]: this });
		for (let e of this.sortedExtensionReps()) e.build(r);
		return r;
	}
	buildEditor() {
		let e = Ml;
		function t() {
			try {
				e();
			} finally {
				e = Ml;
			}
		}
		let n = Object.assign(this.constructEditor(), {
			dispose: t,
			[Symbol.dispose]: t
		});
		return e = Ys(this.registerEditor(n), () => n.setRootElement(null)), n;
	}
	hasExtensionByName(e) {
		return this.extensionNameMap.has(e);
	}
	getExtensionRep(e) {
		let t = this.extensionNameMap.get(e.name);
		if (t) return t.extension !== e && $(295, e.name), t;
	}
	addEdge(e, t, n) {
		let r = this.outgoingConfigEdges.get(e);
		r ? r.set(t, n) : this.outgoingConfigEdges.set(e, /* @__PURE__ */ new Map([[t, n]]));
		let i = this.incomingEdges.get(t);
		i ? i.add(e) : this.incomingEdges.set(t, /* @__PURE__ */ new Set([e]));
	}
	addExtension(e) {
		this._sortedExtensionReps !== void 0 && $(296);
		let [t] = Pl(e);
		typeof t.name != "string" && $(297, typeof t.name);
		let n = this.extensionNameMap.get(t.name);
		if (n !== void 0 && n.extension !== t && $(298, t.name), !n) {
			n = new Dl(this, t), this.extensionNameMap.set(t.name, n);
			let e = this.conflicts.get(t.name);
			typeof e == "string" && $(299, t.name, e);
			for (let e of t.conflictsWith || []) this.extensionNameMap.has(e) && $(299, t.name, e), this.conflicts.set(e, t.name);
			for (let e of t.dependencies || []) {
				let n = Pl(e);
				this.addEdge(t.name, n[0].name, n.slice(1)), this.addExtension(n);
			}
			for (let [e, n] of t.peerDependencies || []) this.addEdge(t.name, e, n ? [n] : []);
		}
	}
	sortedExtensionReps() {
		if (this._sortedExtensionReps) return this._sortedExtensionReps;
		let e = [], t = (n, r) => {
			let i = n.state;
			if (wl(i)) return;
			let a = n.extension.name;
			var o;
			Cl(i) || $(300, a, r || "[unknown]"), Cl(o = i) || $(304, String(o.id), String(hl)), i = Object.assign(o, { id: gl }), n.state = i;
			let s = this.outgoingConfigEdges.get(a);
			if (s) for (let e of s.keys()) {
				let n = this.extensionNameMap.get(e);
				n && t(n, a);
			}
			i = Tl(i), n.state = i, e.push(n);
		};
		for (let e of this.extensionNameMap.values()) Cl(e.state) && t(e);
		for (let t of e) for (let [e, n] of this.outgoingConfigEdges.get(t.extension.name) || []) if (n.length > 0) {
			let t = this.extensionNameMap.get(e);
			if (t) for (let e of n) t.configs.add(e);
		}
		for (let [e, ...t] of this.roots) if (t.length > 0) {
			let n = this.extensionNameMap.get(e.name);
			n === void 0 && $(301, e.name);
			for (let e of t) n.configs.add(e);
		}
		return this._sortedExtensionReps = e, this._sortedExtensionReps;
	}
	registerEditor(e) {
		let t = this.sortedExtensionReps(), n = new AbortController(), r = [() => n.abort()], i = n.signal;
		for (let n of t) {
			let t = n.register(e, i);
			t && r.push(t);
		}
		for (let n of t) {
			let t = n.afterRegistration(e);
			t && r.push(t);
		}
		return Ys(...r);
	}
	buildCreateEditorArgs() {
		let e = {}, t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = {}, a = {}, o = this.sortedExtensionReps();
		for (let s of o) {
			let { extension: o } = s;
			if (o.onError !== void 0 && (e.onError = o.onError), o.disableEvents !== void 0 && (e.disableEvents = o.disableEvents), o.parentEditor !== void 0 && (e.parentEditor = o.parentEditor), o.editable !== void 0 && (e.editable = o.editable), o.namespace !== void 0 && (e.namespace = o.namespace), o.$initialEditorState !== void 0 && (e.$initialEditorState = o.$initialEditorState), o.nodes) for (let e of pl(o)) {
				if (typeof e != "function") {
					let t = n.get(e.replace);
					t && $(302, o.name, e.replace.name, t.extension.name), n.set(e.replace, s);
				}
				t.add(e);
			}
			if (o.html) {
				if (o.html.export) for (let [e, t] of o.html.export.entries()) r.set(e, t);
				o.html.import && Object.assign(i, o.html.import);
			}
			o.theme && ml(a, o.theme);
		}
		Object.keys(a).length > 0 && (e.theme = a), t.size && (e.nodes = [...t]);
		let s = Object.keys(i).length > 0, c = r.size > 0;
		(s || c) && (e.html = {}, s && (e.html.import = i), c && (e.html.export = r));
		for (let t of o) t.init(e);
		return e.onError ||= Nl, e;
	}
};
function Ll(e, t) {
	let n = Il.fromEditor(e).extensionNameMap.get(t);
	return n ? n.getExtensionDependency() : void 0;
}
var Rl = E("INSERT_HORIZONTAL_RULE_COMMAND"), zl = class e extends $i {
	static getType() {
		return "horizontalrule";
	}
	static clone(t) {
		return new e(t.__key);
	}
	static importJSON(e) {
		return Vl().updateFromJSON(e);
	}
	static importDOM() {
		return { hr: () => ({
			conversion: Bl,
			priority: 0
		}) };
	}
	exportDOM() {
		return { element: document.createElement("hr") };
	}
	createDOM(e) {
		let t = document.createElement("hr");
		return qs(t, e.theme.hr), t;
	}
	getTextContent() {
		return "\n";
	}
	isInline() {
		return !1;
	}
	updateDOM() {
		return !1;
	}
};
function Bl() {
	return { node: Vl() };
}
function Vl() {
	return Jo(zl);
}
function Hl(e) {
	return e instanceof zl;
}
function Ul(e, t) {
	return Ys(e.registerCommand(vn, (t) => {
		let n = j();
		if (!k(n)) return !1;
		t.preventDefault();
		let r = function(e) {
			if (e.getNodes().filter((e) => pi(e) && e.canIndent()).length > 0) return !0;
			let t = e.anchor, n = e.focus, r = n.isBefore(t) ? n : t, i = Ec(r.getNode());
			if (i.canIndent()) {
				let e = i.getKey(), t = hi();
				if (t.anchor.set(e, 0, "element"), t.focus.set(e, 0, "element"), t = st(t), t.anchor.is(r)) return !0;
			}
			return !1;
		}(n) ? t.shiftKey ? xn : bn : yn;
		return e.dispatchCommand(r, void 0);
	}, 0), e.registerCommand(bn, () => {
		let e = typeof t == "number" ? t : t ? t.peek() : null;
		if (e == null) return !1;
		let n = j();
		if (!k(n)) return !1;
		let r = n.getNodes().map((e) => Ec(e).getIndent());
		return Math.max(...r) + 1 >= e;
	}, 4));
}
// node_modules/.bun/@lexical+link@0.40.0/node_modules/@lexical/link/LexicalLink.prod.mjs
var Wl = /* @__PURE__ */ new Set([
	"http:",
	"https:",
	"mailto:",
	"sms:",
	"tel:"
]), Gl = class e extends Zi {
	__url;
	__target;
	__rel;
	__title;
	static getType() {
		return "link";
	}
	static clone(t) {
		return new e(t.__url, {
			rel: t.__rel,
			target: t.__target,
			title: t.__title
		}, t.__key);
	}
	constructor(e = "", t = {}, n) {
		super(n);
		let { target: r = null, rel: i = null, title: a = null } = t;
		this.__url = e, this.__target = r, this.__rel = i, this.__title = a;
	}
	createDOM(e) {
		let t = document.createElement("a");
		return this.updateLinkDOM(null, t, e), qs(t, e.theme.link), t;
	}
	updateLinkDOM(e, t, n) {
		if (jo(t)) {
			e && e.__url === this.__url || (t.href = this.sanitizeUrl(this.__url));
			for (let n of [
				"target",
				"rel",
				"title"
			]) {
				let r = `__${n}`, i = this[r];
				e && e[r] === i || (i ? t[n] = i : t.removeAttribute(n));
			}
		}
	}
	updateDOM(e, t, n) {
		return this.updateLinkDOM(e, t, n), !1;
	}
	static importDOM() {
		return { a: (e) => ({
			conversion: Kl,
			priority: 1
		}) };
	}
	static importJSON(e) {
		return ql().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setURL(e.url).setRel(e.rel || null).setTarget(e.target || null).setTitle(e.title || null);
	}
	sanitizeUrl(e) {
		e = nu(e);
		try {
			let t = new URL(nu(e));
			if (!Wl.has(t.protocol)) return "about:blank";
		} catch {
			return e;
		}
		return e;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			rel: this.getRel(),
			target: this.getTarget(),
			title: this.getTitle(),
			url: this.getURL()
		};
	}
	getURL() {
		return this.getLatest().__url;
	}
	setURL(e) {
		let t = this.getWritable();
		return t.__url = e, t;
	}
	getTarget() {
		return this.getLatest().__target;
	}
	setTarget(e) {
		let t = this.getWritable();
		return t.__target = e, t;
	}
	getRel() {
		return this.getLatest().__rel;
	}
	setRel(e) {
		let t = this.getWritable();
		return t.__rel = e, t;
	}
	getTitle() {
		return this.getLatest().__title;
	}
	setTitle(e) {
		let t = this.getWritable();
		return t.__title = e, t;
	}
	insertNewAfter(e, t = !0) {
		let n = ql(this.__url, {
			rel: this.__rel,
			target: this.__target,
			title: this.__title
		});
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
		if (!k(t)) return !1;
		let r = t.anchor.getNode(), i = t.focus.getNode();
		return this.isParentOf(r) && this.isParentOf(i) && t.getTextContent().length > 0;
	}
	isEmailURI() {
		return this.__url.startsWith("mailto:");
	}
	isWebSiteURI() {
		return this.__url.startsWith("https://") || this.__url.startsWith("http://");
	}
};
function Kl(e) {
	let t = null;
	if (jo(e)) {
		let n = e.textContent;
		(n !== null && n !== "" || e.children.length > 0) && (t = ql(e.getAttribute("href") || "", {
			rel: e.getAttribute("rel"),
			target: e.getAttribute("target"),
			title: e.getAttribute("title")
		}));
	}
	return { node: t };
}
function ql(e = "", t) {
	return wo(new Gl(e, t));
}
function Jl(e) {
	return e instanceof Gl;
}
var Yl = class e extends Gl {
	__isUnlinked;
	constructor(e = "", t = {}, n) {
		super(e, t, n), this.__isUnlinked = t.isUnlinked !== void 0 && t.isUnlinked !== null && t.isUnlinked;
	}
	static getType() {
		return "autolink";
	}
	static clone(t) {
		return new e(t.__url, {
			isUnlinked: t.__isUnlinked,
			rel: t.__rel,
			target: t.__target,
			title: t.__title
		}, t.__key);
	}
	getIsUnlinked() {
		return this.__isUnlinked;
	}
	setIsUnlinked(e) {
		let t = this.getWritable();
		return t.__isUnlinked = e, t;
	}
	createDOM(e) {
		return this.__isUnlinked ? document.createElement("span") : super.createDOM(e);
	}
	updateDOM(e, t, n) {
		return super.updateDOM(e, t, n) || e.__isUnlinked !== this.__isUnlinked;
	}
	static importJSON(e) {
		return Xl().updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setIsUnlinked(e.isUnlinked || !1);
	}
	static importDOM() {
		return null;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			isUnlinked: this.__isUnlinked
		};
	}
	insertNewAfter(e, t = !0) {
		let n = this.getParentOrThrow().insertNewAfter(e, t);
		if (L(n)) {
			let e = Xl(this.__url, {
				isUnlinked: this.__isUnlinked,
				rel: this.__rel,
				target: this.__target,
				title: this.__title
			});
			return n.append(e), e;
		}
		return null;
	}
};
function Xl(e = "", t) {
	return wo(new Yl(e, t));
}
function Zl(e) {
	return e instanceof Yl;
}
var Ql = E("TOGGLE_LINK_COMMAND");
function $l(e, t) {
	if (e.type === "element") {
		let n = e.getNode();
		return L(n) || function(e, ...t) {
			let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
			r.append("code", e);
			for (let e of t) r.append("v", e);
			throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}(252), n.getChildren()[e.offset + t] || null;
	}
	return null;
}
function eu(e, t = {}) {
	let n;
	if (e && typeof e == "object") {
		let { url: r, ...i } = e;
		n = r, t = {
			...i,
			...t
		};
	} else n = e;
	let { target: r, title: i } = t, a = t.rel === void 0 ? "noreferrer" : t.rel, o = j();
	if (o === null || !k(o) && !A(o)) return;
	if (A(o)) {
		let e = o.getNodes();
		if (e.length === 0) return;
		e.forEach((e) => {
			if (n === null) {
				let t = J(e, (e) => !Zl(e) && Jl(e));
				t && (t.insertBefore(e), t.getChildren().length === 0 && t.remove());
			} else {
				let t = J(e, (e) => !Zl(e) && Jl(e));
				if (t) t.setURL(n), r !== void 0 && t.setTarget(r), a !== void 0 && t.setRel(a);
				else {
					let t = ql(n, {
						rel: a,
						target: r
					});
					e.insertBefore(t), t.append(e);
				}
			}
		});
		return;
	}
	let s = o.extract();
	if (n === null) {
		let e = /* @__PURE__ */ new Set();
		s.forEach((t) => {
			let n = J(t, (e) => !Zl(e) && Jl(e));
			if (n !== null) {
				let t = n.getKey();
				if (e.has(t)) return;
				(function(e, t) {
					let n = new Set(t.filter((t) => e.isParentOf(t)).map((e) => e.getKey())), r = e.getChildren(), i = (r) => n.has(r.getKey()) || L(r) && t.some((t) => e.isParentOf(t) && r.isParentOf(t)), a = r.filter(i);
					if (a.length === r.length) return r.forEach((t) => e.insertBefore(t)), void e.remove();
					let o = r.findIndex(i), s = r.findLastIndex(i), c = o === 0, l = s === r.length - 1;
					if (c) a.forEach((t) => e.insertBefore(t));
					else if (l) for (let t = a.length - 1; t >= 0; t--) e.insertAfter(a[t]);
					else {
						for (let t = a.length - 1; t >= 0; t--) e.insertAfter(a[t]);
						let t = r.slice(s + 1);
						if (t.length > 0) {
							let n = ql(e.getURL(), {
								rel: e.getRel(),
								target: e.getTarget(),
								title: e.getTitle()
							});
							a[a.length - 1].insertAfter(n), t.forEach((e) => n.append(e));
						}
					}
				})(n, s), e.add(t);
			}
		});
		return;
	}
	let c = /* @__PURE__ */ new Set(), l = (e) => {
		c.has(e.getKey()) || (c.add(e.getKey()), e.setURL(n), r !== void 0 && e.setTarget(r), a !== void 0 && e.setRel(a), i !== void 0 && e.setTitle(i));
	};
	if (s.length === 1) {
		let e = s[0], t = J(e, Jl);
		if (t !== null) return l(t);
	}
	(function(e) {
		let t = j();
		if (!k(t)) return e();
		let n = st(t), r = n.isBackward(), i = $l(n.anchor, r ? -1 : 0), a = $l(n.focus, r ? 0 : -1);
		if (e(), i || a) {
			let e = j();
			if (k(e)) {
				let t = e.clone();
				if (i) {
					let e = i.getParent();
					e && t.anchor.set(e.getKey(), i.getIndexWithinParent() + +!!r, "element");
				}
				if (a) {
					let e = a.getParent();
					e && t.focus.set(e.getKey(), a.getIndexWithinParent() + +!r, "element");
				}
				W(st(t));
			}
		}
	})(() => {
		let e = null;
		for (let t of s) {
			if (!t.isAttached()) continue;
			let o = J(t, Jl);
			if (o) {
				l(o);
				continue;
			}
			if (L(t)) {
				if (!t.isInline()) continue;
				if (Jl(t)) {
					if (!(Zl(t) || e !== null && e.getParentOrThrow().isParentOf(t))) {
						l(t), e = t;
						continue;
					}
					for (let e of t.getChildren()) t.insertBefore(e);
					t.remove();
					continue;
				}
			}
			let s = t.getPreviousSibling();
			Jl(s) && s.is(e) ? s.append(t) : (e = ql(n, {
				rel: a,
				target: r,
				title: i
			}), t.insertAfter(e), e.append(t));
		}
	});
}
var tu = /^\+?[0-9\s()-]{5,}$/;
function nu(e) {
	return e.match(/^[a-z][a-z0-9+.-]*:/i) || e.match(/^[/#.]/) ? e : e.includes("@") ? `mailto:${e}` : tu.test(e) ? `tel:${e}` : `https://${e}`;
}
function ru(e, t) {
	return Ys(dl(() => e.registerCommand(Ql, (e) => {
		let n = t.validateUrl.peek(), r = t.attributes.peek();
		if (e === null) return eu(null), !0;
		if (typeof e == "string") return !(n !== void 0 && !n(e)) && (eu(e, r), !0);
		{
			let { url: t, target: n, rel: i, title: a } = e;
			return eu(t, {
				...r,
				rel: i,
				target: n,
				title: a
			}), !0;
		}
	}, 1)), dl(() => {
		let n = t.validateUrl.value;
		if (!n) return;
		let r = t.attributes.value;
		return e.registerCommand(Qt, (t) => {
			let i = j();
			if (!k(i) || i.isCollapsed() || !kc(t, ClipboardEvent) || t.clipboardData === null) return !1;
			let a = t.clipboardData.getData("text");
			return !!n(a) && !i.getNodes().some((e) => L(e)) && (e.dispatchCommand(Ql, {
				...r,
				url: a
			}), t.preventDefault(), !0);
		}, 1);
	}));
}
function iu(e, t, n = {}) {
	let r = (n) => {
		let r = n.target;
		if (!Mo(r)) return;
		let i = wa(r);
		if (i === null) return;
		let a = null, o = null;
		if (i.update(() => {
			let e = Ba(r);
			if (e !== null) {
				let n = J(e, L);
				if (!t.disabled.peek()) {
					if (Jl(n)) a = n.sanitizeUrl(n.getURL()), o = n.getTarget();
					else {
						let e = function(e, t) {
							let n = e;
							for (; n != null;) {
								if (t(n)) return n;
								n = n.parentNode;
							}
							return null;
						}(r, jo);
						e !== null && (a = e.href, o = e.target);
					}
				}
			}
		}), a === null || a === "") return;
		let s = e.getEditorState().read(j);
		if (k(s) && !s.isCollapsed()) return void n.preventDefault();
		let c = n.type === "auxclick" && n.button === 1;
		window.open(a, t.newTab.peek() || c || n.metaKey || n.ctrlKey || o === "_blank" ? "_blank" : "_self"), n.preventDefault();
	}, i = (e) => {
		e.button === 1 && r(e);
	};
	return e.registerRootListener((e, t) => {
		t !== null && (t.removeEventListener("click", r), t.removeEventListener("mouseup", i)), e !== null && (e.addEventListener("click", r, n), e.addEventListener("mouseup", i, n));
	});
}
var au = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0 ? d : u;
function ou(e) {
	return {
		initialValueFn: () => e.isEditable(),
		subscribe: (t) => e.registerEditableListener(t)
	};
}
function su() {
	return function(e) {
		let [t] = r(), n = f(() => e(t), [t, e]), [i, a] = m(() => n.initialValueFn()), o = p(i);
		return au(() => {
			let { initialValueFn: e, subscribe: t } = n, r = e();
			return o.current !== r && (o.current = r, a(r)), t((e) => {
				o.current = e, a(e);
			});
		}, [n, e]), i;
	}(ou);
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalReactProviderExtension.prod.mjs
var cu = Hs({ name: "@lexical/react/ReactProvider" });
// node_modules/.bun/@lexical+text@0.40.0/node_modules/@lexical/text/LexicalText.prod.mjs
function lu() {
	return U().getTextContent();
}
function uu(e, t = !0) {
	if (e) return !1;
	let n = lu();
	return t && (n = n.trim()), n === "";
}
function du(e) {
	if (!uu(e, !1)) return !1;
	let t = U().getChildren(), n = t.length;
	if (n > 1) return !1;
	for (let e = 0; e < n; e++) {
		let n = t[e];
		if (R(n)) return !1;
		if (L(n)) {
			if (!la(n) || n.__indent !== 0) return !1;
			let t = n.getChildren(), r = t.length;
			for (let n = 0; n < r; n++) {
				let n = t[e];
				if (!O(n)) return !1;
			}
		}
	}
	return !0;
}
function fu(e) {
	return () => du(e);
}
// node_modules/.bun/@lexical+dragon@0.40.0/node_modules/@lexical/dragon/LexicalDragon.prod.mjs
function pu(e) {
	let t = window.location.origin, n = (n) => {
		if (n.origin !== t) return;
		let r = e.getRootElement();
		if (document.activeElement !== r) return;
		let i = n.data;
		if (typeof i == "string") {
			let t;
			try {
				t = JSON.parse(i);
			} catch {
				return;
			}
			if (t && t.protocol === "nuanria_messaging" && t.type === "request") {
				let r = t.payload;
				if (r && r.functionId === "makeChanges") {
					let t = r.args;
					if (t) {
						let [r, i, a, o, s] = t;
						e.update(() => {
							let e = j();
							if (k(e)) {
								let t = e.anchor, c = t.getNode(), l = 0, u = 0;
								if (O(c) && r >= 0 && i >= 0 && (l = r, u = r + i, e.setTextNodeRange(c, l, c, u)), l === u && a === "" || (e.insertRawText(a), c = t.getNode()), O(c)) {
									l = o, u = o + s;
									let t = c.getTextContentSize();
									l = l > t ? t : l, u = u > t ? t : u, e.setTextNodeRange(c, l, c, u);
								}
								n.stopImmediatePropagation();
							}
						});
					}
				}
			}
		}
	};
	return window.addEventListener("message", n, !0), () => {
		window.removeEventListener("message", n, !0);
	};
}
// node_modules/.bun/@lexical+html@0.40.0/node_modules/@lexical/html/LexicalHtml.prod.mjs
function mu(e, t) {
	let n = Aa(t) ? t.body.childNodes : t.childNodes, r = [], i = [];
	for (let t of n) if (!_u.has(t.nodeName)) {
		let n = vu(t, e, i, !1);
		n !== null && (r = r.concat(n));
	}
	return function(e) {
		for (let t of e) t.getNextSibling() instanceof oa && t.insertAfter(Ar());
		for (let t of e) {
			let e = t.getChildren();
			for (let n of e) t.insertBefore(n);
			t.remove();
		}
	}(i), r;
}
function hu(e, t) {
	if (typeof document > "u" || typeof window > "u" && globalThis.window === void 0) throw Error("To use $generateHtmlFromNodes in headless mode please initialize a headless browser implementation such as JSDom before calling this function.");
	let n = document.createElement("div"), r = U().getChildren();
	for (let i = 0; i < r.length; i++) gu(e, r[i], n, t);
	return n.innerHTML;
}
function gu(e, t, n, r = null) {
	let i = r === null || t.isSelected(r), a = L(t) && t.excludeFromCopy("html"), o = t;
	r !== null && O(t) && (o = sc(r, t, "clone"));
	let s = L(o) ? o.getChildren() : [], c = va(e, o.getType()), l;
	l = c && c.exportDOM !== void 0 ? c.exportDOM(e, o) : o.exportDOM(e);
	let { element: u, after: d } = l;
	if (!u) return !1;
	let f = document.createDocumentFragment();
	for (let n = 0; n < s.length; n++) {
		let a = s[n], o = gu(e, a, f, r);
		!i && L(t) && o && t.extractWithChild(a, r, "html") && (i = !0);
	}
	if (i && !a) {
		if ((q(u) || No(u)) && u.append(f), n.append(u), d) {
			let e = d.call(o, u);
			e && (No(u) ? u.replaceChildren(e) : u.replaceWith(e));
		}
	} else n.append(f);
	return i;
}
var _u = /* @__PURE__ */ new Set(["STYLE", "SCRIPT"]);
function vu(e, t, n, r, i = /* @__PURE__ */ new Map(), a) {
	let o = [];
	if (_u.has(e.nodeName)) return o;
	let s = null, c = function(e, t) {
		let { nodeName: n } = e, r = t._htmlConversions.get(n.toLowerCase()), i = null;
		if (r !== void 0) for (let t of r) {
			let n = t(e);
			n !== null && (i === null || (i.priority || 0) <= (n.priority || 0)) && (i = n);
		}
		return i === null ? null : i.conversion;
	}(e, t), l = c ? c(e) : null, u = null;
	if (l !== null) {
		u = l.after;
		let t = l.node;
		if (s = Array.isArray(t) ? t[t.length - 1] : t, s !== null) {
			for (let [, e] of i) if (s = e(s, a), !s) break;
			s && o.push(...Array.isArray(t) ? t : [s]);
		}
		l.forChild != null && i.set(e.nodeName, l.forChild);
	}
	let d = e.childNodes, f = [], p = (s == null || !So(s)) && (s != null && pi(s) || r);
	for (let e = 0; e < d.length; e++) f.push(...vu(d[e], t, n, p, new Map(i), s));
	return u != null && (f = u(f)), Fo(e) && (f = yu(e, f, p ? () => {
		let e = new oa();
		return n.push(e), e;
	} : B)), s == null ? f.length > 0 ? o = o.concat(f) : Fo(e) && function(e) {
		return e.nextSibling == null || e.previousSibling == null ? !1 : Po(e.nextSibling) && Po(e.previousSibling);
	}(e) && (o = o.concat(Ar())) : L(s) && s.append(...f), o;
}
function yu(e, t, n) {
	let r = e.style.textAlign, i = [], a = [];
	for (let e = 0; e < t.length; e++) {
		let o = t[e];
		if (pi(o)) r && !o.getFormat() && o.setFormat(r), i.push(o);
		else if (a.push(o), e === t.length - 1 || e < t.length - 1 && pi(t[e + 1])) {
			let e = n();
			e.setFormat(r), e.append(...a), i.push(e), a = [];
		}
	}
	return i;
}
// node_modules/.bun/@lexical+clipboard@0.40.0/node_modules/@lexical/clipboard/LexicalClipboard.prod.mjs
function bu(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
function xu(e, t = j()) {
	return t ?? bu(166), k(t) && t.isCollapsed() || t.getNodes().length === 0 ? "" : hu(e, t);
}
function Su(e, t = j()) {
	return t ?? bu(166), k(t) && t.isCollapsed() || t.getNodes().length === 0 ? null : JSON.stringify(Eu(e, t));
}
function Cu(e, t, n) {
	let r = e.getData("application/x-lexical-editor");
	if (r) try {
		let e = JSON.parse(r);
		if (e.namespace === n._config.namespace && Array.isArray(e.nodes)) return wu(n, Du(e.nodes), t);
	} catch (e) {
		console.error(e);
	}
	let i = e.getData("text/html"), a = e.getData("text/plain");
	if (i && a !== i) try {
		return wu(n, mu(n, new DOMParser().parseFromString(function(e) {
			return window.trustedTypes && window.trustedTypes.createPolicy ? window.trustedTypes.createPolicy("lexical", { createHTML: (e) => e }).createHTML(e) : e;
		}(i), "text/html")), t);
	} catch (e) {
		console.error(e);
	}
	let o = a || e.getData("text/uri-list");
	if (o != null) {
		if (k(t)) {
			let e = o.split(/(\r?\n|\t)/);
			e[e.length - 1] === "" && e.pop();
			for (let t = 0; t < e.length; t++) {
				let n = j();
				if (k(n)) {
					let r = e[t];
					r === "\n" || r === "\r\n" ? n.insertParagraph() : r === "	" ? n.insertNodes([Xr()]) : n.insertText(r);
				}
			}
		} else t.insertRawText(o);
	}
}
function wu(e, t, n) {
	e.dispatchCommand(Ht, {
		nodes: t,
		selection: n
	}) || (n.insertNodes(t), function(e) {
		if (k(e) && e.isCollapsed()) {
			let t = e.anchor, n = null, r = Ts(t, "previous");
			if (r) {
				if (rs(r)) n = r.origin;
				else {
					let e = vs(r, ds(U(), "next").getFlipped());
					for (let t of e) {
						if (O(t.origin)) {
							n = t.origin;
							break;
						}
						if (L(t.origin) && !t.origin.isInline()) break;
					}
				}
			}
			if (n && O(n)) {
				let t = n.getFormat(), r = n.getStyle();
				e.format === t && e.style === r || (e.format = t, e.style = r, e.dirty = !0);
			}
		}
	}(n));
}
function Tu(e, t, n, r = []) {
	let i = t === null || n.isSelected(t), a = L(n) && n.excludeFromCopy("html"), o = n;
	t !== null && O(o) && (o = sc(t, o, "clone"));
	let s = L(o) ? o.getChildren() : [], c = function(e) {
		let t = e.exportJSON(), n = e.constructor;
		if (t.type !== n.getType() && bu(58, n.name), L(e)) {
			let e = t.children;
			Array.isArray(e) || bu(59, n.name);
		}
		return t;
	}(o);
	O(o) && o.getTextContentSize() === 0 && (i = !1);
	for (let r = 0; r < s.length; r++) {
		let a = s[r], o = Tu(e, t, a, c.children);
		!i && L(n) && o && n.extractWithChild(a, t, "clone") && (i = !0);
	}
	if (i && !a) r.push(c);
	else if (Array.isArray(c.children)) for (let e = 0; e < c.children.length; e++) {
		let t = c.children[e];
		r.push(t);
	}
	return i;
}
function Eu(e, t) {
	let n = [], r = U().getChildren();
	for (let i = 0; i < r.length; i++) Tu(e, t, r[i], n);
	return {
		namespace: e._config.namespace,
		nodes: n
	};
}
function Du(e) {
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let r = e[n], i = Vi(r);
		O(i) && lc(i), t.push(i);
	}
	return t;
}
var Ou = null;
async function ku(e, t, n) {
	if (Ou !== null) return !1;
	if (t !== null) return new Promise((r, i) => {
		e.update(() => {
			r(Au(e, t, n));
		});
	});
	let r = e.getRootElement(), i = e._window || window, a = i.document, o = ko(i);
	if (r === null || o === null) return !1;
	let s = a.createElement("span");
	s.style.cssText = "position: fixed; top: -1000px;", s.append(a.createTextNode("#")), r.append(s);
	let c = new Range();
	return c.setStart(s, 0), c.setEnd(s, 1), o.removeAllRanges(), o.addRange(c), new Promise((t, r) => {
		let o = e.registerCommand(Dn, (r) => (kc(r, ClipboardEvent) && (o(), Ou !== null && (i.clearTimeout(Ou), Ou = null), t(Au(e, r, n))), !0), 4);
		Ou = i.setTimeout(() => {
			o(), Ou = null, t(!1);
		}, 50), a.execCommand("copy"), s.remove();
	});
}
function Au(e, t, n) {
	if (n === void 0) {
		let t = ko(e._window), r = j();
		if (!r || r.isCollapsed() || !t) return !1;
		let i = t.anchorNode, a = t.focusNode;
		if (i !== null && a !== null && !Sa(e, i, a)) return !1;
		n = Mu(r);
	}
	t.preventDefault();
	let r = t.clipboardData;
	return r !== null && (Nu(r, n), !0);
}
var ju = [["text/html", xu], ["application/x-lexical-editor", Su]];
function Mu(e = j()) {
	let t = { "text/plain": e ? e.getTextContent() : "" };
	if (e) {
		let n = Lo();
		for (let [r, i] of ju) {
			let a = i(n, e);
			a !== null && (t[r] = a);
		}
	}
	return t;
}
function Nu(e, t) {
	for (let [n] of ju) t[n] === void 0 && e.setData(n, "");
	for (let n in t) {
		let r = t[n];
		r !== void 0 && e.setData(n, r);
	}
}
// node_modules/.bun/@lexical+rich-text@0.40.0/node_modules/@lexical/rich-text/LexicalRichText.prod.mjs
function Pu(e, t) {
	if (document.caretRangeFromPoint !== void 0) {
		let n = document.caretRangeFromPoint(e, t);
		return n === null ? null : {
			node: n.startContainer,
			offset: n.startOffset
		};
	}
	if (document.caretPositionFromPoint !== "undefined") {
		let n = document.caretPositionFromPoint(e, t);
		return n === null ? null : {
			node: n.offsetNode,
			offset: n.offset
		};
	}
	return null;
}
var Fu = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, Iu = Fu && "documentMode" in document ? document.documentMode : null, Lu = Fu && /Mac|iPod|iPhone|iPad/.test(navigator.platform), Ru = !(!Fu || !("InputEvent" in window) || Iu) && "getTargetRanges" in new window.InputEvent("input"), zu = Fu && /Version\/[\d.]+.*Safari/.test(navigator.userAgent), Bu = Fu && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream, Vu = Fu && /^(?=.*Chrome).*/i.test(navigator.userAgent), Hu = Fu && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && Lu && !Vu, Uu = E("DRAG_DROP_PASTE_FILE"), Wu = class e extends Zi {
	static getType() {
		return "quote";
	}
	static clone(t) {
		return new e(t.__key);
	}
	createDOM(e) {
		let t = document.createElement("blockquote");
		return qs(t, e.theme.quote), t;
	}
	updateDOM(e, t) {
		return !1;
	}
	static importDOM() {
		return { blockquote: (e) => ({
			conversion: Xu,
			priority: 0
		}) };
	}
	exportDOM(e) {
		let { element: t } = super.exportDOM(e);
		if (q(t)) {
			this.isEmpty() && t.append(document.createElement("br"));
			let e = this.getFormatType();
			e && (t.style.textAlign = e);
			let n = this.getDirection();
			n && (t.dir = n);
		}
		return { element: t };
	}
	static importJSON(e) {
		return Gu().updateFromJSON(e);
	}
	insertNewAfter(e, t) {
		let n = B(), r = this.getDirection();
		return n.setDirection(r), this.insertAfter(n, t), n;
	}
	collapseAtStart() {
		let e = B();
		return this.getChildren().forEach((t) => e.append(t)), this.replace(e), !0;
	}
	canMergeWhenEmpty() {
		return !0;
	}
};
function Gu() {
	return wo(new Wu());
}
function Ku(e) {
	return e instanceof Wu;
}
var qu = class e extends Zi {
	__tag;
	static getType() {
		return "heading";
	}
	static clone(t) {
		return new e(t.__tag, t.__key);
	}
	constructor(e, t) {
		super(t), this.__tag = e;
	}
	getTag() {
		return this.__tag;
	}
	setTag(e) {
		let t = this.getWritable();
		return this.__tag = e, t;
	}
	createDOM(e) {
		let t = this.__tag, n = document.createElement(t), r = e.theme.heading;
		if (r !== void 0) {
			let e = r[t];
			qs(n, e);
		}
		return n;
	}
	updateDOM(e, t, n) {
		return e.__tag !== this.__tag;
	}
	static importDOM() {
		return {
			h1: (e) => ({
				conversion: Yu,
				priority: 0
			}),
			h2: (e) => ({
				conversion: Yu,
				priority: 0
			}),
			h3: (e) => ({
				conversion: Yu,
				priority: 0
			}),
			h4: (e) => ({
				conversion: Yu,
				priority: 0
			}),
			h5: (e) => ({
				conversion: Yu,
				priority: 0
			}),
			h6: (e) => ({
				conversion: Yu,
				priority: 0
			}),
			p: (e) => {
				let t = e.firstChild;
				return t !== null && Ju(t) ? {
					conversion: () => ({ node: null }),
					priority: 3
				} : null;
			},
			span: (e) => Ju(e) ? {
				conversion: (e) => ({ node: Zu("h1") }),
				priority: 3
			} : null
		};
	}
	exportDOM(e) {
		let { element: t } = super.exportDOM(e);
		if (q(t)) {
			this.isEmpty() && t.append(document.createElement("br"));
			let e = this.getFormatType();
			e && (t.style.textAlign = e);
			let n = this.getDirection();
			n && (t.dir = n);
		}
		return { element: t };
	}
	static importJSON(e) {
		return Zu(e.tag).updateFromJSON(e);
	}
	updateFromJSON(e) {
		return super.updateFromJSON(e).setTag(e.tag);
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			tag: this.getTag()
		};
	}
	insertNewAfter(e, t = !0) {
		let n = e ? e.anchor.offset : 0, r = this.getLastDescendant(), i = !r || e && e.anchor.key === r.getKey() && n === r.getTextContentSize() || !e ? B() : Zu(this.getTag()), a = this.getDirection();
		if (i.setDirection(a), this.insertAfter(i, t), n === 0 && !this.isEmpty() && e) {
			let e = B();
			e.select(), this.replace(e, !0);
		}
		return i;
	}
	collapseAtStart() {
		let e = this.isEmpty() ? B() : Zu(this.getTag());
		return this.getChildren().forEach((t) => e.append(t)), this.replace(e), !0;
	}
	extractWithChild() {
		return !0;
	}
};
function Ju(e) {
	return e.nodeName.toLowerCase() === "span" && e.style.fontSize === "26pt";
}
function Yu(e) {
	let t = e.nodeName.toLowerCase(), n = null;
	return t !== "h1" && t !== "h2" && t !== "h3" && t !== "h4" && t !== "h5" && t !== "h6" || (n = Zu(t), e.style !== null && (Uo(e, n), n.setFormat(e.style.textAlign))), { node: n };
}
function Xu(e) {
	let t = Gu();
	return e.style !== null && (t.setFormat(e.style.textAlign), Uo(e, t)), { node: t };
}
function Zu(e = "h1") {
	return wo(new qu(e));
}
function Qu(e) {
	return e instanceof qu;
}
function $u(e) {
	let t = null;
	if (kc(e, DragEvent) ? t = e.dataTransfer : kc(e, ClipboardEvent) && (t = e.clipboardData), t === null) return [
		!1,
		[],
		!1
	];
	let n = t.types, r = n.includes("Files"), i = n.includes("text/html") || n.includes("text/plain");
	return [
		r,
		Array.from(t.files),
		i
	];
}
function ed(e) {
	let t = j();
	if (!k(t)) return !1;
	let n = /* @__PURE__ */ new Set(), r = t.getNodes();
	for (let t = 0; t < r.length; t++) {
		let i = r[t], a = i.getKey();
		if (n.has(a)) continue;
		let o = J(i, (e) => L(e) && !e.isInline());
		if (o === null) continue;
		let s = o.getKey();
		o.canIndent() && !n.has(s) && (n.add(s), e(o));
	}
	return n.size > 0;
}
function td(e) {
	return R(Ba(e));
}
function nd(e) {
	for (let t of [
		"lowercase",
		"uppercase",
		"capitalize"
	]) e.hasFormat(t) && e.toggleFormat(t);
}
function rd(e) {
	return Ys(e.registerCommand(Ut, (e) => {
		let t = j();
		return !!A(t) && (t.clear(), !0);
	}, 0), e.registerCommand(Jt, (e) => {
		let t = j();
		return k(t) ? (t.deleteCharacter(e), !0) : !!A(t) && (t.deleteNodes(), !0);
	}, 0), e.registerCommand(en, (e) => {
		let t = j();
		return !!k(t) && (t.deleteWord(e), !0);
	}, 0), e.registerCommand(tn, (e) => {
		let t = j();
		return !!k(t) && (t.deleteLine(e), !0);
	}, 0), e.registerCommand(Zt, (t) => {
		let n = j();
		if (typeof t == "string") n !== null && n.insertText(t);
		else {
			if (n === null) return !1;
			let r = t.dataTransfer;
			if (r != null) Cu(r, n, e);
			else if (k(n)) {
				let e = t.data;
				return e && n.insertText(e), !0;
			}
		}
		return !0;
	}, 0), e.registerCommand($t, () => {
		let e = j();
		return !!k(e) && (e.removeText(), !0);
	}, 0), e.registerCommand(nn, (e) => {
		let t = j();
		return !!k(t) && (t.formatText(e), !0);
	}, 0), e.registerCommand(Cn, (e) => {
		let t = j();
		if (!k(t) && !A(t)) return !1;
		let n = t.getNodes();
		for (let t of n) {
			let n = J(t, (e) => L(e) && !e.isInline());
			n !== null && n.setFormat(e);
		}
		return !0;
	}, 0), e.registerCommand(Yt, (e) => {
		let t = j();
		return !!k(t) && (t.insertLineBreak(e), !0);
	}, 0), e.registerCommand(Xt, () => {
		let e = j();
		return !!k(e) && (e.insertParagraph(), !0);
	}, 0), e.registerCommand(yn, () => (Ei([Xr()]), !0), 0), e.registerCommand(bn, () => ed((e) => {
		let t = e.getIndent();
		e.setIndent(t + 1);
	}), 0), e.registerCommand(xn, () => ed((e) => {
		let t = e.getIndent();
		t > 0 && e.setIndent(Math.max(0, t - 1));
	}), 0), e.registerCommand(dn, (e) => {
		let t = j();
		if (A(t)) {
			let n = t.getNodes();
			if (n.length > 0) return e.preventDefault(), n[0].selectPrevious(), !0;
		} else if (k(t)) {
			let n = lo(t.focus, !0);
			if (!e.shiftKey && R(n) && !n.isIsolated() && !n.isInline()) return n.selectPrevious(), e.preventDefault(), !0;
		}
		return !1;
	}, 0), e.registerCommand(fn, (e) => {
		let t = j();
		if (A(t)) {
			let n = t.getNodes();
			if (n.length > 0) return e.preventDefault(), n[0].selectNext(0, 0), !0;
		} else if (k(t)) {
			if (function(e) {
				let t = e.focus;
				return t.key === "root" && t.offset === U().getChildrenSize();
			}(t)) return e.preventDefault(), !0;
			let n = lo(t.focus, !1);
			if (!e.shiftKey && R(n) && !n.isIsolated() && !n.isInline()) return n.selectNext(), e.preventDefault(), !0;
		}
		return !1;
	}, 0), e.registerCommand(ln, (e) => {
		let t = j();
		if (A(t)) {
			let n = t.getNodes();
			if (n.length > 0) return e.preventDefault(), oc(n[0]) ? n[0].selectNext(0, 0) : n[0].selectPrevious(), !0;
		}
		if (!k(t)) return !1;
		if (mc(t, !0)) {
			let n = e.shiftKey;
			return e.preventDefault(), _c(t, n, !0), !0;
		}
		return !1;
	}, 0), e.registerCommand(sn, (e) => {
		let t = j();
		if (A(t)) {
			let n = t.getNodes();
			if (n.length > 0) return e.preventDefault(), oc(n[0]) ? n[0].selectPrevious() : n[0].selectNext(0, 0), !0;
		}
		if (!k(t)) return !1;
		let n = e.shiftKey;
		return !!mc(t, !1) && (e.preventDefault(), _c(t, n, !1), !0);
	}, 0), e.registerCommand(hn, (t) => {
		if (td(t.target)) return !1;
		let n = j();
		if (k(n)) {
			if (function(e) {
				if (!e.isCollapsed()) return !1;
				let { anchor: t } = e;
				if (t.offset !== 0) return !1;
				let n = t.getNode();
				if (z(n)) return !1;
				let r = Ec(n);
				return r.getIndent() > 0 && (r.is(n) || n.is(r.getFirstDescendant()));
			}(n)) return t.preventDefault(), e.dispatchCommand(xn, void 0);
			if (Bu && navigator.language === "ko-KR") return !1;
		} else if (!A(n)) return !1;
		return t.preventDefault(), e.dispatchCommand(Jt, !0);
	}, 0), e.registerCommand(_n, (t) => {
		if (td(t.target)) return !1;
		let n = j();
		return !(!k(n) && !A(n)) && (t.preventDefault(), e.dispatchCommand(Jt, !1));
	}, 0), e.registerCommand(pn, (t) => {
		let n = j();
		if (!k(n)) return !1;
		if (nd(n), t !== null) {
			if ((Bu || zu || Hu) && Ru) return !1;
			if (t.preventDefault(), t.shiftKey) return e.dispatchCommand(Yt, !1);
		}
		return e.dispatchCommand(Xt, void 0);
	}, 0), e.registerCommand(gn, () => !!k(j()) && (e.blur(), !0), 0), e.registerCommand(Sn, (t) => {
		let [, n] = $u(t);
		if (n.length > 0) {
			let r = Pu(t.clientX, t.clientY);
			if (r !== null) {
				let { offset: t, node: i } = r, a = Ba(i);
				if (a !== null) {
					let e = hi();
					if (O(a)) e.anchor.set(a.getKey(), t, "text"), e.focus.set(a.getKey(), t, "text");
					else {
						let t = a.getParentOrThrow().getKey(), n = a.getIndexWithinParent() + 1;
						e.anchor.set(t, n, "element"), e.focus.set(t, n, "element");
					}
					W(st(e));
				}
				e.dispatchCommand(Uu, n);
			}
			return t.preventDefault(), !0;
		}
		return !!k(j());
	}, 0), e.registerCommand(wn, (e) => {
		let [t] = $u(e), n = j();
		return !(t && !k(n));
	}, 0), e.registerCommand(Tn, (e) => {
		let [t] = $u(e), n = j();
		if (t && !k(n)) return !1;
		let r = Pu(e.clientX, e.clientY);
		return r !== null && R(Ba(r.node)) && e.preventDefault(), !0;
	}, 0), e.registerCommand(kn, () => (io(), !0), 0), e.registerCommand(Dn, (t) => (ku(e, kc(t, ClipboardEvent) ? t : null), !0), 0), e.registerCommand(On, (t) => (async function(e, t) {
		await ku(t, kc(e, ClipboardEvent) ? e : null), t.update(() => {
			let e = j();
			k(e) ? e.removeText() : A(e) && e.getNodes().forEach((e) => e.remove());
		});
	}(t, e), !0), 0), e.registerCommand(Qt, (t) => {
		let [, n, r] = $u(t);
		return n.length > 0 && !r ? (e.dispatchCommand(Uu, n), !0) : Mo(t.target) && xa(t.target) ? !1 : j() !== null && (function(e, t) {
			e.preventDefault(), t.update(() => {
				let n = j(), r = kc(e, InputEvent) || kc(e, KeyboardEvent) ? null : e.clipboardData;
				r != null && n !== null && Cu(r, n, t);
			}, { tag: "paste" });
		}(t, e), !0);
	}, 0), e.registerCommand(mn, (e) => {
		let t = j();
		return k(t) && nd(t), !1;
	}, 0), e.registerCommand(vn, (e) => {
		let t = j();
		return k(t) && nd(t), !1;
	}, 0));
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalRichTextPlugin.prod.mjs
function id(e, ...t) {
	let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
	r.append("code", e);
	for (let e of t) r.append("v", e);
	throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
}
var ad = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0 ? d : u;
function od({ editor: e, ErrorBoundary: t }) {
	return function(e, t) {
		let [n, r] = m(() => e.getDecorators());
		return ad(() => e.registerDecoratorListener((e) => {
			ne(() => {
				r(e);
			});
		}), [e]), u(() => {
			r(e.getDecorators());
		}, [e]), f(() => {
			let r = [], i = Object.keys(n);
			for (let o = 0; o < i.length; o++) {
				let s = i[o], c = _(t, {
					onError: (t) => e._onError(t),
					children: _(a, {
						fallback: null,
						children: n[s]
					})
				}), l = e.getElementByKey(s);
				l !== null && r.push(v(c, l, s));
			}
			return r;
		}, [
			t,
			n,
			e
		]);
	}(e, t);
}
function sd({ editor: e, ErrorBoundary: t }) {
	return function(e) {
		let t = Il.maybeFromEditor(e);
		if (t && t.hasExtensionByName(cu.name)) {
			for (let e of ["@lexical/plain-text", "@lexical/rich-text"]) t.hasExtensionByName(e) && id(320, e);
			return !0;
		}
		return !1;
	}(e) ? null : _(od, {
		editor: e,
		ErrorBoundary: t
	});
}
function cd(e) {
	return e.getEditorState().read(fu(e.isComposing()));
}
function ld({ contentEditable: e, placeholder: t = null, ErrorBoundary: n }) {
	let [i] = r();
	return function(e) {
		ad(() => Ys(rd(e), pu(e)), [e]);
	}(i), te(g, { children: [
		e,
		_(ud, { content: t }),
		_(sd, {
			editor: i,
			ErrorBoundary: n
		})
	] });
}
function ud({ content: e }) {
	let [t] = r(), n = function(e) {
		let [t, n] = m(() => cd(e));
		return ad(() => {
			function t() {
				let t = cd(e);
				n(t);
			}
			return t(), Ys(e.registerUpdateListener(() => {
				t();
			}), e.registerEditableListener(() => {
				t();
			}));
		}, [e]), t;
	}(t), i = su();
	return n ? typeof e == "function" ? e(i) : e : null;
}
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalContentEditable.prod.mjs
var dd = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0 ? d : u;
function fd({ editor: e, ariaActiveDescendant: t, ariaAutoComplete: n, ariaControls: r, ariaDescribedBy: i, ariaErrorMessage: a, ariaExpanded: o, ariaInvalid: s, ariaLabel: c, ariaLabelledBy: u, ariaMultiline: d, ariaOwns: p, ariaRequired: ee, autoCapitalize: h, className: g, id: te, role: v = "textbox", spellCheck: ne = !0, style: y, tabIndex: re, "data-testid": b, ...ie }, x) {
	let [S, ae] = m(e.isEditable()), oe = l((t) => {
		t && t.ownerDocument && t.ownerDocument.defaultView ? e.setRootElement(t) : e.setRootElement(null);
	}, [e]), se = f(() => function(...e) {
		return (t) => {
			for (let n of e) typeof n == "function" ? n(t) : n != null && (n.current = t);
		};
	}(x, oe), [oe, x]);
	return dd(() => (ae(e.isEditable()), e.registerEditableListener((e) => {
		ae(e);
	})), [e]), _("div", {
		"aria-activedescendant": S ? t : void 0,
		"aria-autocomplete": S ? n : "none",
		"aria-controls": S ? r : void 0,
		"aria-describedby": i,
		...a == null ? {} : { "aria-errormessage": a },
		"aria-expanded": S && v === "combobox" ? !!o : void 0,
		...s == null ? {} : { "aria-invalid": s },
		"aria-label": c,
		"aria-labelledby": u,
		"aria-multiline": d,
		"aria-owns": S ? p : void 0,
		"aria-readonly": !S || void 0,
		"aria-required": ee,
		autoCapitalize: h,
		className: g,
		contentEditable: S,
		"data-testid": b,
		id: te,
		ref: se,
		role: v,
		spellCheck: ne,
		style: y,
		tabIndex: re,
		...ie
	});
}
var pd = c(fd);
function md(e) {
	return e.getEditorState().read(fu(e.isComposing()));
}
var hd = c(gd);
function gd(e, t) {
	let { placeholder: n, ...i } = e, [a] = r();
	return te(g, { children: [_(pd, {
		editor: a,
		...i,
		ref: t
	}), n != null && _(_d, {
		editor: a,
		content: n
	})] });
}
function _d({ content: e, editor: t }) {
	let n = function(e) {
		let [t, n] = m(() => md(e));
		return dd(() => {
			function t() {
				let t = md(e);
				n(t);
			}
			return t(), Ys(e.registerUpdateListener(() => {
				t();
			}), e.registerEditableListener(() => {
				t();
			}));
		}, [e]), t;
	}(t), [r, i] = m(t.isEditable());
	if (d(() => (i(t.isEditable()), t.registerEditableListener((e) => {
		i(e);
	})), [t]), !n) return null;
	let a = null;
	return typeof e == "function" ? a = e(r) : e !== null && (a = e), a === null ? null : _("div", {
		"aria-hidden": !0,
		children: a
	});
}
// packages/ui/src/components/rich-text/shared/components/content-editable.tsx
var vd = h(hd);
function yd({ onRef: t, fullWidth: n = !1, padding: r, layerStyle: i, isRichMessage: a = !1, scrollable: o = !0 }) {
	let s = /* @__PURE__ */ _(ee, {
		ref: t,
		width: "100%",
		minH: "100%",
		layerStyle: i,
		padding: r,
		children: /* @__PURE__ */ _(vd, {
			"data-testid": "content-editable",
			height: "fit-content",
			minH: "100%",
			width: "100%",
			maxWidth: n ? "100%" : "45rem",
			marginInline: n ? "0" : "auto",
			textStyle: "paragraph/M/regular",
			fontSize: "calc(var(--chakra-font-sizes-md) * var(--rich-text-font-scale))",
			position: "relative",
			outline: "none"
		})
	});
	return o ? /* @__PURE__ */ _(e, {
		className: "rich-text",
		"data-rich-message": a ? "true" : void 0,
		height: "100%",
		minH: "0",
		position: "relative",
		contentProps: {
			width: "100%",
			minH: "100%"
		},
		children: s
	}) : s;
}
// packages/ui/src/components/rich-text/theme/rich-text-theme.tsx
var bd = {
	code: "rich-text__code",
	codeHighlight: {
		atrule: "rich-text__tokenAttr",
		attr: "rich-text__tokenAttr",
		boolean: "rich-text__tokenProperty",
		builtin: "rich-text__tokenSelector",
		cdata: "rich-text__tokenComment",
		char: "rich-text__tokenSelector",
		class: "rich-text__tokenFunction",
		"class-name": "rich-text__tokenFunction",
		comment: "rich-text__tokenComment",
		constant: "rich-text__tokenProperty",
		deleted: "rich-text__tokenProperty",
		doctype: "rich-text__tokenComment",
		entity: "rich-text__tokenOperator",
		function: "rich-text__tokenFunction",
		important: "rich-text__tokenVariable",
		inserted: "rich-text__tokenSelector",
		keyword: "rich-text__tokenAttr",
		namespace: "rich-text__tokenVariable",
		number: "rich-text__tokenProperty",
		operator: "rich-text__tokenOperator",
		prolog: "rich-text__tokenComment",
		property: "rich-text__tokenProperty",
		punctuation: "rich-text__tokenPunctuation",
		regex: "rich-text__tokenVariable",
		selector: "rich-text__tokenSelector",
		string: "rich-text__tokenSelector",
		symbol: "rich-text__tokenProperty",
		tag: "rich-text__tokenProperty",
		url: "rich-text__tokenOperator",
		variable: "rich-text__tokenVariable"
	},
	embedBlock: {
		base: "rich-text__embedBlock",
		focus: "rich-text__embedBlockFocus"
	},
	list: {
		checklist: "rich-text__checklist",
		listitem: "rich-text__listItem",
		listitemChecked: "rich-text__listItemChecked",
		listitemUnchecked: "rich-text__listItemUnchecked",
		nested: { listitem: "rich-text__nestedListItem" },
		olDepth: [
			"rich-text__ol1",
			"rich-text__ol2",
			"rich-text__ol3",
			"rich-text__ol4",
			"rich-text__ol5"
		],
		ol: "rich-text__ol",
		ul: "rich-text__ul"
	},
	heading: {
		h1: "rich-text__h1",
		h2: "rich-text__h2",
		h3: "rich-text__h3"
	},
	paragraph: "rich-text__p",
	text: {
		underline: "rich-text__textUnderline",
		italic: "rich-text__textItalic",
		code: "rich-text__textCode"
	},
	link: "rich-text__link",
	quote: "rich-text__quote",
	reference: "rich-text__reference",
	table: "rich-text__table",
	tableCell: "rich-text__tableCell",
	tableRow: "rich-text__tableRow",
	tableCellHeader: "rich-text__tableCellHeader",
	layoutContainer: "rich-text__layoutContainer",
	layoutItem: "rich-text__layoutItem",
	draggableBlockDemo: {
		row: "rich-text__row",
		content: "rich-text__content"
	}
};
export { gn as $, tn as $n, Ei as $t, dl as A, wo as An, un as At, Tc as B, Y as Bn, on as Bt, Yc as C, cn as Cn, Fs as Ct, Hl as D, Je as Dn, W as Dt, nl as E, X as En, vr as Et, Fc as F, qe as Fn, R as Ft, cc as G, fn as Gn, Us as Gt, tc as H, Jt as Hn, $r as Ht, Mc as I, en as In, fa as It, la as J, A as Jn, jn as Jt, rc as K, Es as Kn, Dr as Kt, Ac as L, So as Ln, Ys as Lt, Kc as M, is as Mn, mn as Mt, Vc as N, Ut as Nn, L as Nt, Ul as O, nn as On, hn as Ot, kc as P, zr as Pn, _n as Pt, Jo as Q, Zr as Qn, jr as Qt, Nc as R, Nn as Rn, Sr as Rt, iu as S, j as Sn, xn as St, zl as T, ko as Tn, Ps as Tt, ec as U, Ze as Un, ln as Ut, Dc as V, so as Vn, Na as Vt, dc as W, sn as Wn, An as Wt, Er as X, rn as Xn, _i as Xt, Hs as Y, q as Yn, wr as Yt, yi as Z, vs as Zn, Js as Zt, Xl as _, Ht as _n, Fn as _t, Qu as a, Ts as an, Eo as at, ql as b, B as bn, Pn as bt, Zu as c, Xt as cn, ea as ct, Mu as d, wa as dn, pn as dt, Mn as en, gs as er, $i as et, hu as f, Ea as fn, Zi as ft, Ql as g, ps as gn, z as gt, Jl as h, Zt as hn, yn as ht, Wu as i, dn as in, an as it, fl as j, E as jn, k as jt, Rl as k, Xr as kn, Ba as kt, Gu as l, Yt as ln, U as lt, Zl as m, bo as mn, Mo as mt, yd as n, O as nn, Cn as nr, gi as nt, Ku as o, Ni as on, st as ot, su as p, D as pn, Ds as pt, kn as q, H as qn, J as qt, ld as r, ho as rn, Ls as rr, Wo as rt, qu as s, cs as sn, vn as st, bd as t, Ws as tn, C as tr, Cr as tt, ku as u, ds as un, Lo as ut, ru as v, Ke as vn, qs as vt, Ll as w, Fa as wn, bn as wt, Yl as x, Tr as xn, Ks as xt, Gl as y, On as yn, Ar as yt, wc as z, Vt as zn, hi as zt };
