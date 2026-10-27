// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { D as e, G as t, I as n, L as r, R as i, W as a, a as o, d as s, h as c, i as l, m as u, n as ee, nt as d, r as f, t as p, tt as te, ut as m, v as h, x as ne, z as g } from "./list-marker-width-plugin-BDROuhXk.ts";
import { a as _, c as v, i as y, o as b, r as x } from "./chat-link-anchor-kdoOkLgc.ts";
import { M as re, N as S, Nt as C, Pn as w, S as T, et as ie, j as E, lt as D, n as O, nn as k, r as ae, rn as A } from "./rich-text-theme-C7PhYVHR.ts";
import { t as j } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { i as oe, r as se, t as M } from "./TreeViewPlugin-CkVdbwL2.ts";
import { i as N, n as P, r as F, t as I } from "./markdown-C92hFHal.ts";
import { useEffect as L, useRef as R } from "react";
import { Flex as z, useRecipe as B } from "@chakra-ui/react";
import { jsx as V, jsxs as H } from "react/jsx-runtime";
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalClickableLinkPlugin.prod.mjs
function U({ newTab: e = !0, disabled: t = !1 }) {
	let [n] = j();
	return L(() => T(n, E({
		disabled: t,
		newTab: e
	})), [
		n,
		e,
		t
	]), null;
}
// packages/ui/src/components/chat-ui/links/chat-code-link-node.ts
var W = class e extends w {
	__href;
	__description;
	__animateArrival;
	static getType() {
		return "chat-code-link";
	}
	static clone(t) {
		return new e(t.__text, t.__href, t.__description, t.__key, t.__animateArrival);
	}
	constructor(e, t, n, r, i = !1) {
		super(e, r), this.__href = t, this.__description = n, this.__animateArrival = i;
	}
	static importJSON(t) {
		return new e(t.text, null).updateFromJSON(t);
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			type: "chat-code-link"
		};
	}
	createDOM(e) {
		let t = document.createElement("a");
		return this.__animateArrival && t.classList.add("streaming-text-chunk"), this.__href ? t.href = this.__href : (t.setAttribute("role", "button"), t.tabIndex = 0), t.dataset.chatSource = this.__text, t.dataset.chatOrigin = "inline-code", t.title = this.__description ?? `Open file: ${this.__text}`, t.append(super.createDOM(e)), t;
	}
	updateDOM(e) {
		return e.__text !== this.__text || e.__format !== this.__format || e.__href !== this.__href;
	}
}, G = class e extends ie {
	__candidate;
	__label;
	__format;
	static getType() {
		return "chat-resource-link";
	}
	static clone(t) {
		return new e(t.__candidate, t.__label, t.__format, t.__key);
	}
	constructor(e, t, n = 0, r) {
		super(r), this.__candidate = e, this.__label = t, this.__format = n;
	}
	static importJSON(t) {
		return new e(t.candidate, t.label, t.format);
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			type: this.getType(),
			version: 1,
			candidate: this.__candidate,
			label: this.__label,
			format: this.__format
		};
	}
	createDOM() {
		return document.createElement("span");
	}
	static importDOM() {
		return null;
	}
	exportDOM() {
		let e = document.createTextNode(this.__label);
		for (let [t, n] of i.toReversed()) {
			if (!g(this.__format, t)) continue;
			let r = document.createElement(n);
			r.append(e), e = r;
		}
		let t = this.__candidate.origin === "markdown" && m(this.__candidate.source, "link");
		if (!t) return { element: e };
		let n = document.createElement("a");
		return n.setAttribute("href", t), n.append(e), { element: n };
	}
	updateDOM() {
		return !1;
	}
	isInline() {
		return !0;
	}
	getTextContent() {
		return this.__label;
	}
	matchesSource(e) {
		return this.__candidate.origin === "markdown" ? e instanceof h && e.getSource() === this.__candidate.source && e.getTextContent() === this.__label : k(e) && e.getFormat() === this.__format && e.getTextContent() === this.__candidate.source;
	}
	decorate() {
		return /* @__PURE__ */ V(r, {
			candidate: this.__candidate,
			label: this.__label,
			format: this.__format
		});
	}
}, K = (e, t, n, r = !1) => {
	if (e instanceof W || !e.hasFormat("code")) return;
	let i = e.getParent();
	if (!i || i.getType() === "code" || i.getType().includes("link")) return;
	let a = {
		source: e.getTextContent(),
		origin: "inline-code"
	}, o = v(a, n);
	if (!o || o.kind === "external") return;
	if (r) {
		e.replace(new G(a, a.source, e.getFormat()));
		return;
	}
	let s = new W(a.source, t.resolveHref(a), t.describe?.(a), void 0, e instanceof c);
	s.setFormat(e.getFormat()), e.replace(s);
}, ce = {
	"(": ")",
	"[": "]",
	"{": "}"
}, le = (e) => {
	let t = 0, n = e.replace(/[.,;:!?]+$/, "").length, r = [], i = /* @__PURE__ */ new Map();
	for (let t = 0; t < n; t++) {
		let a = e[t], o = ce[a];
		if (o) r.push({
			close: o,
			index: t
		});
		else if (")]}".includes(a)) {
			let o = r.pop();
			if (o?.close === a) i.set(o.index, t);
			else if (!o && /^[)\]}]+$/.test(e.slice(t, n))) {
				n = t;
				break;
			} else return;
		}
	}
	if (!r.length) {
		for (; t < n && i.get(t) === n - 1;) t += 1, --n;
		return {
			source: e.slice(t, n),
			offset: t
		};
	}
}, q = (e) => {
	let t = [];
	for (let n of e.matchAll(/[^\s`"'<>]+/g)) {
		let e = le(n[0]);
		if (!e) continue;
		let { source: r, offset: i } = e, a = v({
			source: r,
			origin: "text"
		});
		if (a?.kind !== "file") continue;
		let o = /^(?:\.\.?[/\\]|\/|[a-z]:[/\\]|file:|\$PROJECT\/)/i.test(r), s = /(?:^|[/\\])[^/\\]+\.[a-z][\w-]*$/i.test(a.path);
		if (!o && (!s || /^(?:@|v\d|e\.g$|i\.e$)/i.test(r))) continue;
		let c = n.index + i;
		t.push({
			source: r,
			start: c,
			end: c + r.length
		});
	}
	return t;
}, J = (e) => {
	if (!k(e) || e.hasFormat("code")) return [e];
	let t = e.getParent();
	if (!t || t.getType() === "code" || t.getType().includes("link")) return [e];
	let n = e.getTextContentSize(), r = [...new Set(q(e.getTextContent()).flatMap(({ start: e, end: t }) => [e, t]))].filter((e) => e > 0 && e < n).sort((e, t) => e - t);
	return r.length ? e.splitText(...r) : [e];
}, ue = (e) => {
	if (e.hasFormat("code")) return;
	let t = e.getParent();
	if (t && t.getType() !== "code" && !t.getType().includes("link")) for (let t of J(e)) {
		let e = t.getTextContent(), n = q(e)[0];
		k(t) && n?.start === 0 && n.end === e.length && t.replace(new G({
			source: e,
			origin: "text"
		}, e, t.getFormat()));
	}
}, Y = class e extends G {
	static getType() {
		return "chat-web-link";
	}
	static clone(t) {
		return new e(t.__candidate, t.__label, t.__format, t.__key);
	}
	static importJSON(t) {
		return new e(t.candidate, t.label, t.format);
	}
	decorate() {
		return /* @__PURE__ */ V(n, {
			source: this.__candidate.source,
			label: this.__label
		});
	}
}, de = (e) => e instanceof MouseEvent && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey), fe = (e, t) => {
	if (t instanceof KeyboardEvent && t.key !== "Enter") return;
	let n = t.target;
	if (!(n instanceof Element)) return;
	let r = n.closest("a");
	if (!r || !r.dataset.chatSource) return;
	let i = {
		source: r.dataset.chatSource,
		origin: r.dataset.chatOrigin === "markdown" ? "markdown" : "inline-code"
	}, a = v(i, window.location.origin);
	if (!a) return;
	let o = e.resolveHref(i);
	a.kind === "external" && !o || o && de(t) || (t.preventDefault(), t.stopImmediatePropagation(), e.open(i));
}, pe = () => {
	let [e] = j(), t = _();
	return L(() => {
		if (!t) return;
		let n = e.registerNodeTransform(h, (n) => {
			let r = {
				source: n.getSource(),
				origin: "markdown"
			};
			if (!e.isEditable() && n.getChildren().every(k) && b(t, r)) {
				n.replace(new Y(r, n.getTextContent()));
				return;
			}
			let i = v(r, window.location.origin);
			if (i && (i.kind !== "external" || t.resolveHref(r))) {
				if (!e.isEditable()) {
					n.replace(new G(r, n.getTextContent()));
					return;
				}
				n.setResolvedURL(t.resolveHref(r) ?? "#");
			}
		}), r = e.registerMutationListener(h, (n) => {
			for (let [r, i] of n) {
				if (i === "destroyed") continue;
				let n = e.getElementByKey(r), a = n?.dataset.chatSource;
				if (!n || !a) continue;
				let o = {
					source: a,
					origin: "markdown"
				}, s = v(o, window.location.origin);
				s && (s.kind !== "external" || t.resolveHref(o)) && (n.title = t.describe?.(o) ?? `Open file or document: ${a}`);
			}
		}), i = (n) => {
			K(n, t, window.location.origin, !e.isEditable()), !e.isEditable() && n.isAttached() && ue(n);
		}, a = e.registerNodeTransform(w, i), o = e.registerNodeTransform(c, i), s = (e) => fe(t, e), l = e.registerRootListener((e, t) => {
			t?.removeEventListener("click", s, !0), t?.removeEventListener("keydown", s, !0), e?.addEventListener("click", s, !0), e?.addEventListener("keydown", s, !0), e && (e.dataset.chatLinks = "true");
		});
		return () => {
			n(), a(), o(), r(), l();
		};
	}, [e, t]), null;
}, me = (e, t) => {
	let n = (e) => {
		let { children: t, ...n } = e.exportJSON();
		return e instanceof W ? JSON.stringify({
			...n,
			href: e.__href,
			description: e.__description
		}) : JSON.stringify(n);
	};
	return n(e) === n(t);
}, he = (e, t) => e.getFormat() === t.getFormat() && e.getStyle() === t.getStyle(), X = (e) => !!(e && k(e) && ["text", "streaming-text"].includes(e.getType())), Z = (e, t) => u(t).setFormat(e.getFormat()).setStyle(e.getStyle()), ge = (e, t) => {
	if (!t) return e;
	if (X(e)) return Z(e, e.getTextContent());
	let n = [e];
	for (; n.length;) {
		let e = n.pop();
		if (C(e)) for (let t of e.getChildren()) X(t) ? t.replace(Z(t, t.getTextContent())) : n.push(t);
	}
	return e;
}, _e = (e, t, n, r) => {
	let i = [], a = n, o = t[a], s = e.getTextContent();
	for (; k(o) && he(o, e) && o.getTextContent().length > 0 && s.startsWith(o.getTextContent()) && (s.length === o.getTextContentSize() || X(o));) s = s.slice(o.getTextContentSize()), i.push(o), o = t[++a];
	return s && X(o) ? (o.setTextContent(s).setFormat(e.getFormat()).setStyle(e.getStyle()), i.push(o), a += 1) : s && i.push(r ? Z(e, s) : e.setTextContent(s).toggleUnmergeable()), {
		nodes: i,
		cursor: a
	};
}, Q = (e, t, n) => {
	let r = e.getChildren(), i = [], a = 0;
	for (let e of t.flatMap(J)) {
		let t = r[a];
		if (t instanceof G && t.matchesSource(e)) i.push(t), a += 1;
		else if (X(e)) {
			let t = _e(e, r, a, n);
			i.push(...t.nodes), a = t.cursor;
		} else t && me(t, e) ? (C(t) && C(e) && Q(t, e.getChildren(), n), i.push(t), a += 1) : (i.push(ge(e, n && !t)), t && (a += 1));
	}
	(i.length !== r.length || i.some((e, t) => e.getKey() !== r[t]?.getKey())) && e.splice(0, e.getChildrenSize(), i);
}, ve = (e, t, n = !0) => {
	Q(D(), F(e, t), n);
}, $ = "markdown-source-import";
function ye(e) {
	let { body: t, resolver: n, isEditable: r, streaming: i, loadedRef: a, sourceDocumentRef: o } = e, [s] = j();
	return L(() => {
		let e = a.current;
		(e.body !== t || e.resolver !== n || r && !o.current) && s.update(() => {
			if (A($), r) {
				let e = P(t, n);
				o.current = e, e.importToLexical();
			} else o.current = null, ve(t, n, i && t.startsWith(e.body));
			a.current = {
				body: t,
				resolver: n
			};
		}, { tag: "history-merge" });
	}, [
		t,
		n,
		r,
		i,
		s,
		a,
		o
	]), null;
}
// packages/ui/src/components/rich-text/rich-message/rich-message.tsx
var be = {
	rowNumbers: !1,
	wrapRows: !0
};
function xe(e) {
	let t = _();
	return /* @__PURE__ */ V(x, {
		handler: e.linkHandler ?? t,
		children: /* @__PURE__ */ V(y, {
			value: e.streaming ?? !1,
			children: /* @__PURE__ */ V(Se, { ...e })
		})
	});
}
function Se(n) {
	let { debug: r = !1, defaultState: i = "", fullWidth: c = !1, isEditable: u = !1, streaming: m = !1, resolveMarkdownUrl: h, onChange: g } = n, { frontmatter: _, body: v } = I(i), y = u && !!g, b = B({ key: "streamingText" }), x = R({
		body: v,
		resolver: h
	}), C = R(null), w = {
		namespace: "RICH_MESSAGE",
		nodes: [
			...l,
			W,
			G,
			Y
		],
		editorState: () => {
			if (A($), u) {
				let e = P(v, h);
				C.current = e, e.importToLexical();
			} else N(v, h);
		},
		onError: (e) => console.error(e),
		editable: u,
		theme: o
	};
	return /* @__PURE__ */ V(z, {
		className: "rich-text",
		"data-rich-message": "true",
		css: b(),
		justifyContent: "space-between",
		width: "100%",
		maxWidth: "100%",
		height: "100%",
		position: "relative",
		direction: "column",
		overflow: "hidden",
		children: /* @__PURE__ */ V(e, {
			resolver: h,
			children: /* @__PURE__ */ V(ne, {
				value: be,
				children: /* @__PURE__ */ H(S, {
					initialConfig: w,
					children: [
						/* @__PURE__ */ V(ye, {
							body: v,
							resolver: h,
							isEditable: u,
							streaming: m,
							loadedRef: x,
							sourceDocumentRef: C
						}),
						u ? /* @__PURE__ */ V(te, {}) : null,
						/* @__PURE__ */ V(pe, {}),
						/* @__PURE__ */ V(U, { newTab: !0 }),
						u ? /* @__PURE__ */ V(t, {}) : null,
						/* @__PURE__ */ V(p, {}),
						u ? /* @__PURE__ */ V(a, { maxIndent: 7 }) : null,
						u ? /* @__PURE__ */ V(d, {}) : null,
						m ? null : /* @__PURE__ */ V(ee, {}),
						u ? /* @__PURE__ */ V(f, {}) : null,
						/* @__PURE__ */ V(s, {}),
						/* @__PURE__ */ V(ae, {
							contentEditable: /* @__PURE__ */ V(O, {
								fullWidth: c,
								isRichMessage: !0
							}),
							ErrorBoundary: re
						}),
						y ? /* @__PURE__ */ V(oe, {
							ignoreSelectionChange: !0,
							ignoreHistoryMergeTagChange: !1,
							onChange: (e, t, n) => {
								n.has("markdown-source-import") || e.read(() => {
									let e = D(), t = C.current?.exportFromLexical(e) ?? "";
									g?.(_ + t);
								});
							}
						}) : null,
						/* @__PURE__ */ V(se, { isEditable: u }),
						r && /* @__PURE__ */ V(M, {})
					]
				})
			})
		})
	});
}
export { xe as t };
