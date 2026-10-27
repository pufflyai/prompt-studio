// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { $ as e, A as t, C as n, E as r, F as i, H as a, M as o, N as s, O as c, P as l, T as u, U as d, Y as f, Z as p, _ as m, b as ee, c as te, f as h, g, j as ne, k as re, l as ie, p as _, q as v, s as ae, u as oe, w as y, y as se } from "./list-marker-width-plugin-BDROuhXk.ts";
import { J as ce, Nt as le, Qt as ue, a as de, bn as b, c as fe, h as pe, l as me, lt as x, mn as he, nn as S, o as ge, pn as C, yt as _e } from "./rich-text-theme-C7PhYVHR.ts";
import { n as w } from "./libesm-BaE4KZ1I.ts";
// packages/ui/src/components/rich-text/shared/markdown-export.ts
var ve = (e) => {
	let t = e.hasFormat("code") ? {
		type: "inlineCode",
		value: e.getTextContent()
	} : {
		type: "text",
		value: e.getTextContent()
	};
	return e.hasFormat("code") || (e.hasFormat("bold") && (t = {
		type: "strong",
		children: [t]
	}), e.hasFormat("italic") && (t = {
		type: "emphasis",
		children: [t]
	}), e.hasFormat("strikethrough") && (t = {
		type: "delete",
		children: [t]
	})), e.hasFormat("underline") ? [
		{
			type: "html",
			value: "<ins>"
		},
		t,
		{
			type: "html",
			value: "</ins>"
		}
	] : [t];
}, T = (e) => {
	if (S(e)) return ve(e);
	if (ue(e)) return [{ type: "break" }];
	if (r(e)) return [{
		type: "image",
		url: e.getSource(),
		alt: e.getAlt(),
		title: e.getTitle()
	}];
	if (_(e) && e.isInline()) return [{
		type: "inlineMath",
		value: e.getEquation()
	}];
	if (y(e)) return [{
		type: "html",
		value: e.getSource()
	}];
	if (i(e)) return [{
		type: "text",
		value: e.getTextContent()
	}];
	if (pe(e)) return [{
		type: "link",
		url: m(e) ? e.getSource() : e.getURL(),
		title: e.getTitle(),
		children: E(e)
	}];
	if (le(e)) return E(e);
	let t = e.getTextContent();
	return t ? [{
		type: "text",
		value: t
	}] : [];
}, E = (e) => e.getChildren().flatMap(T), ye = (e) => {
	let t = [], n = [], r = () => {
		n.length && t.push({
			type: "paragraph",
			children: n.splice(0)
		});
	};
	for (let i of e.getChildren()) if (S(i) || ue(i) || he(i)) n.push(...T(i));
	else {
		r();
		let e = A(i);
		e && t.push(e);
	}
	return r(), t;
}, D = (e) => ({
	type: "paragraph",
	children: E(e)
}), be = (e) => {
	let t = [], n = [];
	for (let r of e.getChildren()) v(r) ? (n.length && t.push({
		type: "paragraph",
		children: n.splice(0)
	}), t.push(O(r))) : ce(r) ? (n.length && t.push({
		type: "paragraph",
		children: n.splice(0)
	}), t.push(D(r))) : n.push(...T(r));
	return (n.length || t.length === 0) && t.unshift({
		type: "paragraph",
		children: n
	}), {
		type: "listItem",
		checked: e.getChecked(),
		spread: !1,
		children: t
	};
}, O = (e) => ({
	type: "list",
	ordered: e.getListType() === "number",
	start: e.getListType() === "number" ? e.getStart() : null,
	spread: !1,
	children: e.getChildren().filter(p).map(be)
}), k = (e) => ({
	type: "tableCell",
	children: re(e)
}), xe = (e) => {
	let t = e.getTable();
	return {
		type: "table",
		align: t.columns.map((e) => e.alignment),
		children: [{
			type: "tableRow",
			children: t.columns.map((e) => k(e.label))
		}, ...t.rows.map((e) => ({
			type: "tableRow",
			children: t.columns.map((t) => k(e.cells[t.id] ?? ""))
		}))]
	};
}, A = (e) => {
	if (ce(e)) return D(e);
	if (de(e)) return {
		type: "heading",
		depth: Number(e.getTag().slice(1)),
		children: E(e)
	};
	if (ge(e)) return {
		type: "blockquote",
		children: ye(e)
	};
	if (v(e)) return O(e);
	if (d(e)) return {
		type: "code",
		lang: e.getLanguage() || null,
		meta: null,
		value: e.getTextContent()
	};
	if (te(e)) return {
		type: "code",
		lang: "mermaid",
		meta: null,
		value: e.getCode()
	};
	if (_(e)) return {
		type: "math",
		meta: null,
		value: e.getEquation()
	};
	if (oe(e)) return { type: "thematicBreak" };
	if (ee(e)) return xe(e);
	if (y(e)) return {
		type: "html",
		value: e.getSource()
	};
	if (le(e)) return D(e);
	let t = e.getTextContent();
	return t ? {
		type: "paragraph",
		children: [{
			type: "text",
			value: t
		}]
	} : null;
}, j = (e) => {
	let t = {
		type: "root",
		children: e.getChildren().map(A).filter((e) => e !== null)
	};
	return ne(t);
}, M = /\{\{\s*link\((['"])([^'"\s]+)\1\)\s*\}\}/g, Se = /\{\{\s*link\((['"])[^'"\s]*$/, Ce = RegExp(`^${M.source}`), we = (e) => {
	if (e.type !== "link" || !e.children.every((e) => e.type === "text")) return;
	let t = e.children.map((e) => e.type === "text" ? e.value : "").join(""), n = e.position?.start.offset, r = e.position?.end.offset;
	return n !== void 0 && r !== void 0 && r - n === t.length && e.url === t ? t : void 0;
}, Te = (e, t) => {
	let n = e[t];
	if (n?.type !== "text") return;
	let r = n.value.match(Se);
	if (!r || r.index === void 0) return;
	let i = n.value;
	for (let n = t + 1; n < e.length; n++) {
		let t = e[n], a = t.type === "text" ? t.value : we(t);
		if (a === void 0) return;
		if (i += a, Ce.test(i.slice(r.index))) return {
			value: i,
			end: n
		};
	}
}, N = (e, t) => {
	let n = C(e);
	for (let e of t) n.toggleFormat(e);
	return n;
}, P = (e, t) => {
	let n = [], r = 0;
	for (let i of e.matchAll(M)) {
		let a = i.index ?? 0;
		a > r && n.push(N(e.slice(r, a), t));
		let o = i[2] ?? "", s = /^(?:https?:\/\/|\/)/i.test(o) ? o : `#${o}`;
		n.push(l(s, o)), r = a + i[0].length;
	}
	return r < e.length && n.push(N(e.slice(r), t)), n;
}, F = (e, t) => t.definitions.get(e.identifier.toLowerCase());
function Ee(e, t, r) {
	switch (e.type) {
		case "text": return P(e.value, r);
		case "strong": return I(e.children, t, /* @__PURE__ */ new Set([...r, "bold"]));
		case "emphasis": return I(e.children, t, /* @__PURE__ */ new Set([...r, "italic"]));
		case "delete": return I(e.children, t, /* @__PURE__ */ new Set([...r, "strikethrough"]));
		case "inlineCode": return [N(e.value, /* @__PURE__ */ new Set([...r, "code"]))];
		case "break": return [_e()];
		case "link": {
			let n = g(e.url, t.resolver, { title: e.title });
			return n.append(...I(e.children, t, r)), [n];
		}
		case "linkReference": {
			let n = F(e, t);
			if (!n) return [N(s([e]), r)];
			let i = g(n.url, t.resolver, { title: n.title });
			return i.append(...I(e.children, t, r)), [i];
		}
		case "image": return [u(e.url, e.alt ?? "", e.title ?? null)];
		case "imageReference": {
			let n = F(e, t);
			return n ? [u(n.url, e.alt ?? "", n.title ?? null)] : [N(s([e]), r)];
		}
		case "inlineMath": return [h(e.value, !0)];
		case "html": return [n(e.value, "inline")];
		default: return [N(s([e]), r)];
	}
}
function I(e, t, n = /* @__PURE__ */ new Set()) {
	let r = [], i = 0;
	for (let a = 0; a < e.length; a++) {
		let o = e[a];
		if (o.type === "html" && /^<(?:ins|u)>$/i.test(o.value.trim())) {
			i += 1;
			continue;
		}
		if (o.type === "html" && /^<\/(?:ins|u)>$/i.test(o.value.trim())) {
			i = Math.max(i - 1, 0);
			continue;
		}
		let s = new Set(n);
		i > 0 && s.add("underline");
		let c = Te(e, a);
		c ? (r.push(...P(c.value, s)), a = c.end) : r.push(...Ee(o, t, s));
	}
	return r;
}
var De = (e, t) => {
	t.tableIndex += 1;
	let n = `table-${t.tableIndex}`, r = e.children[0], i = Math.max(r?.children.length ?? 0, 1), a = Array.from({ length: i }, (t, i) => ({
		id: `${n}-column-${i + 1}`,
		label: r?.children[i] ? s(r.children[i].children) : "",
		alignment: e.align?.[i] ?? null
	}));
	return {
		columns: a,
		rows: e.children.slice(1).map((e, t) => ({
			id: `${n}-row-${t + 1}`,
			cells: Object.fromEntries(a.map((t, n) => [t.id, e.children[n] ? s(e.children[n].children) : ""]))
		}))
	};
}, Oe = (t, n, r) => {
	if (n.type !== "listItem") return;
	let i = e(n.checked ?? void 0);
	t.append(i);
	for (let e of n.children) e.type === "paragraph" ? i.append(...I(e.children, r)) : e.type === "list" ? L(i, e, r) : i.append(N(o(e), /* @__PURE__ */ new Set()));
}, L = (e, t, r) => {
	switch (t.type) {
		case "paragraph": {
			let n = b();
			n.append(...I(t.children, r)), e.append(n);
			break;
		}
		case "heading": {
			let n = fe(`h${t.depth}`);
			n.append(...I(t.children, r)), e.append(n);
			break;
		}
		case "blockquote": {
			let n = me();
			e.append(n);
			for (let [e, i] of t.children.entries()) i.type === "paragraph" ? (t.children[e - 1]?.type === "paragraph" && n.append(C("\n\n")), n.append(...I(i.children, r))) : L(n, i, r);
			break;
		}
		case "list": {
			let n = t.children.some((e) => e.checked !== null && e.checked !== void 0), i = "bullet";
			t.ordered ? i = "number" : n && (i = "check");
			let a = f(i, t.start ?? 1);
			e.append(a);
			for (let e of t.children) Oe(a, e, r);
			break;
		}
		case "code":
			e.append(t.lang === "mermaid" ? ae(t.value) : a(t.lang ?? void 0).append(C(t.value)));
			break;
		case "math":
			e.append(h(t.value, !1));
			break;
		case "thematicBreak":
			e.append(ie());
			break;
		case "table":
			e.append(se(De(t, r)));
			break;
		case "html":
			e.append(n(t.value, "block"));
			break;
		case "definition": break;
		default: {
			let n = b();
			n.append(C(o(t))), e.append(n);
		}
	}
}, R = (e, t) => {
	let n = c(e), r = {
		definitions: new Map(n.children.filter((e) => e.type === "definition").map((e) => [e.identifier.toLowerCase(), e])),
		resolver: t,
		tableIndex: 0
	}, i = b();
	for (let e of n.children) L(i, e, r);
	return i.isEmpty() ? [b()] : i.getChildren();
}, z = (e, t) => {
	x().clear().append(...R(e, t));
}, B = (e) => {
	let t = e.position?.start.offset, n = e.position?.end.offset;
	return t === void 0 || n === void 0 ? null : {
		end: n,
		start: t
	};
}, V = (e) => typeof e == "object" && !!e && "children" in e && Array.isArray(e.children), ke = (e) => typeof e == "object" && !!e && "type" in e && (e.type === "link" || e.type === "linkReference"), H = (e) => {
	let t = [];
	if (!V(e)) return t;
	for (let n of e.children) ke(n) && t.push(n), V(n) && t.push(...H(n));
	return t;
}, U = (e) => t(e).children.flatMap((e) => e.type === "table" ? [] : H(e).map((t) => ({
	block: e,
	node: t
}))), Ae = (e, t, n, r, i, a) => {
	let o = B(r), s = B(a);
	if (!o || !s) return [];
	let c = i.map(B);
	if (c.some((e) => !e)) return [];
	let l = [], u = o.start;
	for (let t of c) {
		if (!t) return [];
		l.push(e.slice(u, t.start)), u = t.end;
	}
	l.push(e.slice(u, o.end));
	let d = t.slice(s.start, s.end), f = l[0] ?? "";
	if (!d.startsWith(f)) return [];
	let p = [], m = f.length;
	for (let e = 0; e < i.length; e += 1) {
		let t = l[e + 1] ?? "", n = e === i.length - 1 ? d.length - t.length : d.indexOf(t, m);
		if (n < m) return [];
		p.push({
			start: m,
			end: n,
			value: d.slice(m, n)
		}), m = n + t.length;
	}
	return m === d.length ? p.flatMap((t, r) => {
		if (U(t.value).length > 0) return [];
		let i = B(n[r]?.node ?? {}), a = c[r];
		return !i || !a ? [] : [{
			edit: {
				...i,
				replacement: t.value
			},
			normalization: {
				start: s.start + t.start,
				end: s.start + t.end,
				replacement: e.slice(a.start, a.end)
			}
		}];
	}) : [];
}, je = (e, t, n, r, i, a, o, s) => {
	let c = a.map((e, t) => t);
	c.sort((e, t) => Number(t === o) - Number(e === o));
	for (let o of c) {
		if (s.has(o)) continue;
		let c = a[o];
		if (!c) continue;
		let l = H(c);
		if (i.length <= l.length) continue;
		let u = Ae(t, n, e, r, i, c);
		if (u.length === i.length - l.length) return {
			currentBlockIndex: o,
			replacements: u
		};
	}
	return null;
}, Me = (e, n, r) => {
	let i = U(e);
	if (U(r).length >= U(n).length) return {
		edits: [],
		normalizedCurrent: r
	};
	let a = t(n), o = t(r), s = [], c = [], l = /* @__PURE__ */ new Set(), u = 0;
	for (let e = 0; e < a.children.length; e += 1) {
		let t = a.children[e];
		if (!t || t.type === "table") continue;
		let d = H(t), f = je(i.slice(u, u + d.length), n, r, t, d, o.children, e, l);
		if (f) {
			for (let e of f.replacements) s.push(e.edit), c.push(e.normalization);
			l.add(f.currentBlockIndex);
		}
		u += d.length;
	}
	let d = r;
	for (let e of c.sort((e, t) => t.start - e.start)) d = d.slice(0, e.start) + e.replacement + d.slice(e.end);
	return {
		edits: s,
		normalizedCurrent: d
	};
}, Ne = (e, n) => {
	let r = t(e).children, i = t(n).children.filter((e) => e.type !== "definition");
	return r.length === i.length && r.every((e, t) => e.type === i[t]?.type && e.position?.start.offset !== void 0 && i[t]?.position?.start.offset !== void 0 && e.position?.end.offset !== void 0 && i[t]?.position?.end.offset !== void 0) ? r.map((e, t) => ({
		canonical: e,
		source: i[t]
	})) : [];
};
function* Pe(e, t, n) {
	if (!n.length) {
		yield* w(e, t);
		return;
	}
	let r = 0, i = 0;
	for (let a of n) {
		let n = a.canonical.position.end.offset, o = a.source.position.end.offset;
		yield* w(e.slice(r, n), t.slice(i, o)), r = n, i = o;
	}
	yield* w(e.slice(r), t.slice(i));
}
var W = (e, t) => {
	let n = Array.from({ length: e.length + 1 }).fill(-1), r = Array.from({ length: e.length + 1 }).fill(-1), i = 0, a = 0, o = !1, s = Ne(e, t);
	n[0] = 0, r[0] = 0;
	for (let c of Pe(e, t, s)) {
		let e = c.value.length;
		if (c.added) r[i] = a, a += e, n[i] = a, o && (r[i] = a), o = !1;
		else if (c.removed) {
			for (let t = 0; t <= e; t += 1) n[i + t] = a, r[i + t] = a;
			i += e, o = !0;
		} else {
			for (let t = 0; t <= e; t += 1) {
				let e = i + t;
				n[e] = a + t, (r[e] === void 0 || r[e] < 0) && (r[e] = a + t);
			}
			i += e, a += e, o = !1;
		}
	}
	let c = /* @__PURE__ */ new Map();
	for (let e of s) {
		let t = e.canonical.position.start.offset, n = e.source.position.start.offset;
		c.set(t, n);
	}
	return {
		blockStarts: c,
		end: r,
		start: n
	};
}, G = (e, t, n) => {
	for (let r = t; r >= 0 && r < e.length; r += n) {
		let t = e[r];
		if (t !== void 0 && t >= 0) return t;
	}
	return n === -1 ? 0 : e.at(-1) ?? 0;
}, Fe = (e, t) => {
	let n = e.start[t];
	return n !== void 0 && n >= 0 ? n : G(e.start, t, -1);
}, K = (e, t) => {
	let n = e.end[t];
	return n !== void 0 && n >= 0 ? n : G(e.end, t, 1);
}, Ie = (e, t) => e.blockStarts.get(t) ?? K(e, t), Le = (e, t) => {
	let n = [], r = 0, i = null, a = () => {
		i &&= (n.push(i), null);
	};
	for (let n of w(e, t)) !n.added && !n.removed ? (a(), r += n.value.length) : (i ??= {
		start: r,
		end: r,
		replacement: ""
	}, n.added ? i.replacement += n.value : (r += n.value.length, i.end = r));
	return a(), n;
}, Re = (e) => e.includes("\r\n") ? "\r\n" : "\n", q = (e, t) => {
	let n = Re(t);
	return n === "\n" ? e : e.replaceAll("\n", n);
}, J = (e) => Array.isArray(e) ? e.map(J) : !e || typeof e != "object" ? e : Object.fromEntries(Object.entries(e).filter(([e]) => e !== "position").map(([e, t]) => [e, J(t)])), Y = (e, t) => JSON.stringify(J(e)) === JSON.stringify(J(t)), X = (e) => t(e).children.filter((e) => e.type === "table" && !!e.position), Z = (e) => e.children.flatMap((e) => e.children), ze = (e, t) => e.children.length === t.children.length && e.children.every((e, n) => e.children.length === t.children[n]?.children.length), Q = (e) => {
	let t = e.position?.start.offset, n = e.position?.end.offset;
	return t === void 0 || n === void 0 ? null : {
		end: n,
		start: t
	};
}, $ = (e, t) => {
	let n = t.children[0], r = t.children.at(-1), i = n?.position?.start.offset, a = r?.position?.end.offset;
	if (i !== void 0 && a !== void 0) return {
		start: i,
		end: a
	};
	let o = Q(t);
	if (!o) return null;
	let s = e.slice(o.start, o.end), c = s.indexOf("|"), l = s.endsWith("|") ? s.length - 1 : s.length, u = c < 0 ? 0 : c + 1, d = s.slice(u, l).match(/^\s*/)?.[0].length ?? 0, f = o.start + u + d;
	return {
		start: f,
		end: f
	};
}, Be = (e, t) => {
	let n = $(e, t);
	return n ? e.slice(n.start, n.end) : "";
}, Ve = (e, t, n, r, i) => {
	let a = Z(n), o = Z(r);
	return Z(i).flatMap((n, r) => {
		let i = a[r], s = o[r];
		if (!i || !s || Y(s, n)) return [];
		let c = $(e, i);
		return c ? [{
			...c,
			replacement: Be(t, n)
		}] : [];
	});
}, He = (e, t, n, r, i) => {
	if (Y(r, i)) return [];
	if (ze(r, i) && ze(n, r) && JSON.stringify(r.align) === JSON.stringify(i.align)) return Ve(e, t, n, r, i);
	let a = Q(n), o = Q(i);
	return !a || !o ? [] : [{
		start: a.start,
		end: a.end,
		replacement: t.slice(o.start, o.end)
	}];
}, Ue = (e, t, n) => {
	let r = X(e), i = X(t), a = X(n);
	if (r.length !== i.length || i.length !== a.length) return {
		edits: [],
		normalizedCurrent: n
	};
	let o = [], s = n;
	for (let c = a.length - 1; c >= 0; --c) {
		let l = r[c], u = i[c], d = a[c];
		if (!l || !u || !d) continue;
		let f = Q(u), p = Q(d);
		f && p && (s = s.slice(0, p.start) + t.slice(f.start, f.end) + s.slice(p.end), o.push(...He(e, n, l, u, d)));
	}
	return {
		edits: o,
		normalizedCurrent: s
	};
}, We = (e, t, n, r) => {
	if (n === r) return e;
	let i = Me(e, n, r), a = Ue(e, n, i.normalizedCurrent), o = Le(n, a.normalizedCurrent).map((n) => {
		let r = n.start === n.end ? Ie(t, n.start) : Fe(t, n.start);
		return {
			start: r,
			end: n.start === n.end ? r : K(t, n.end),
			replacement: q(n.replacement, e)
		};
	}).concat(i.edits.map((t) => ({
		...t,
		replacement: q(t.replacement, e)
	}))).concat(a.edits.map((t) => ({
		...t,
		replacement: q(t.replacement, e)
	}))).sort((e, t) => t.start - e.start), s = e;
	for (let e of o) s = s.slice(0, e.start) + e.replacement + s.slice(e.end);
	return s;
}, Ge = (e, t) => {
	let n = null, r = null;
	return {
		importToLexical() {
			z(e, t), n = j(x()), r = W(n, e);
		},
		exportFromLexical(t) {
			let i = j(t), a = n ?? i;
			return We(e, r ?? W(a, e), a, i);
		}
	};
}, Ke = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
function qe(e) {
	let t = e.match(Ke);
	return t ? {
		frontmatter: t[0],
		body: e.slice(t[0].length)
	} : {
		frontmatter: "",
		body: e
	};
}
export { z as i, Ge as n, R as r, qe as t };
