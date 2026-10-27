// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { $ as e, A as t, B as n, C as r, Ct as i, D as a, E as o, F as s, G as c, H as l, I as u, J as d, K as f, L as p, M as m, N as h, O as g, P as _, Q as v, R as y, S as b, St as x, T as S, U as C, V as w, W as T, X as E, Y as D, Z as O, _ as k, _t as A, at as j, b as ee, bt as te, ct as M, d as ne, dt as re, et as N, f as P, ft as ie, g as ae, gt as F, h as oe, ht as I, it as se, j as L, k as R, lt as ce, m as le, mt as z, n as ue, nt as de, ot as fe, p as pe, pt as me, q as he, rt as ge, st as _e, t as ve, tt as ye, u as be, ut as xe, v as Se, vt as B, w as V, x as H, xt as U, y as Ce, yt as we, z as Te } from "./collections-W65OWXaL.ts";
import { useRef as W, useSyncExternalStore as Ee } from "react";
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/tap.js
var De = class extends m {
	#e;
	constructor(e, t, n, r) {
		super(e, t, n), this.#e = r;
	}
	inner(e) {
		return this.#e(e), e;
	}
};
function Oe(e) {
	return (t) => {
		let n = new R(t.graph, new L()), r = new De(t.graph.getNextOperatorId(), t.connectReader(), n.writer, e);
		return t.graph.addOperator(r), n;
	};
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/output.js
var ke = class extends h {
	#e;
	constructor(e, t, n, r) {
		super(e, t, n), this.#e = r;
	}
	run() {
		for (let e of this.inputMessages()) this.#e(e), this.output.sendData(e);
	}
};
function Ae(e) {
	return (t) => {
		let n = new R(t.graph, new L()), r = new ke(t.graph.getNextOperatorId(), t.connectReader(), n.writer, e);
		return t.graph.addOperator(r), n;
	};
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/join.js
var je = class extends t {
	#e = new o();
	#t = new o();
	#n;
	constructor(e, t, n, r, i = "inner") {
		super(e, t, n, r), this.#n = i;
	}
	run() {
		let e = o.fromMultiSets(this.inputAMessages()), t = o.fromMultiSets(this.inputBMessages());
		if (e.size === 0 && t.size === 0) return;
		let n = new _();
		this.#n !== "anti" && this.emitInnerResults(e, t, n), (this.#n === "left" || this.#n === "full" || this.#n === "anti") && this.emitLeftOuterResults(e, t, n), (this.#n === "right" || this.#n === "full") && this.emitRightOuterResults(e, t, n), this.#e.append(e), this.#t.append(t), n.getInner().length > 0 && this.output.sendData(n);
	}
	emitInnerResults(e, t, n) {
		e.size > 0 && n.extend(e.join(this.#t)), t.size > 0 && n.extend(this.#e.join(t)), e.size > 0 && t.size > 0 && n.extend(e.join(t));
	}
	emitLeftOuterResults(e, t, n) {
		if (e.size > 0) {
			for (let [r, i] of e.entriesIterators()) if (this.#t.getConsolidatedMultiplicity(r) + t.getConsolidatedMultiplicity(r) === 0) for (let [e, t] of i) t !== 0 && n.add([r, [e, null]], t);
		}
		if (t.size > 0) for (let e of t.getPresenceKeys()) {
			let r = this.#t.getConsolidatedMultiplicity(e), i = t.getConsolidatedMultiplicity(e);
			if (i === 0) continue;
			let a = r + i;
			if (r === 0 == (a === 0)) continue;
			let o = r === 0;
			for (let [t, r] of this.#e.getIterator(e)) r !== 0 && n.add([e, [t, null]], o ? -r : +r);
		}
	}
	emitRightOuterResults(e, t, n) {
		if (t.size > 0) {
			for (let [r, i] of t.entriesIterators()) if (this.#e.getConsolidatedMultiplicity(r) + e.getConsolidatedMultiplicity(r) === 0) for (let [e, t] of i) t !== 0 && n.add([r, [null, e]], t);
		}
		if (e.size > 0) for (let t of e.getPresenceKeys()) {
			let r = this.#e.getConsolidatedMultiplicity(t), i = e.getConsolidatedMultiplicity(t);
			if (i === 0) continue;
			let a = r + i;
			if (r === 0 == (a === 0)) continue;
			let o = r === 0;
			for (let [e, r] of this.#t.getIterator(t)) r !== 0 && n.add([t, [null, e]], o ? -r : +r);
		}
	}
};
function Me(e, t = "inner") {
	return (n) => {
		if (n.graph !== e.graph) throw Error("Cannot join streams from different graphs");
		let r = new R(n.graph, new L()), i = new je(n.graph.getNextOperatorId(), n.connectReader(), e.connectReader(), r.writer, t);
		return n.graph.addOperator(i), r;
	};
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/distinct.js
var Ne = class extends h {
	#e;
	#t;
	constructor(e, t, n, r = (e) => e) {
		super(e, t, n), this.#e = r, this.#t = /* @__PURE__ */ new Map();
	}
	run() {
		let e = /* @__PURE__ */ new Map();
		for (let t of this.inputMessages()) for (let [n, r] of t.getInner()) {
			let t = s(this.#e(n)), i = (e.get(t)?.[0] ?? this.#t.get(t) ?? 0) + r;
			e.set(t, [i, n]);
		}
		let t = [];
		for (let [n, [r, i]] of e.entries()) {
			let e = this.#t.get(n) ?? 0;
			r === 0 ? this.#t.delete(n) : this.#t.set(n, r), e <= 0 && r > 0 ? t.push([[s(this.#e(i)), i[1]], 1]) : e > 0 && r <= 0 && t.push([[s(this.#e(i)), i[1]], -1]);
		}
		t.length > 0 && this.output.sendData(new _(t));
	}
};
function Pe(e = (e) => e) {
	return (t) => {
		let n = new R(t.graph, new L()), r = new Ne(t.graph.getNextOperatorId(), t.connectReader(), n.writer, e);
		return t.graph.addOperator(r), n;
	};
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/builder/index.js
var G = class t {
	constructor(e = {}) {
		this.query = {}, this.query = { ...e };
	}
	_createRefForSource(n, r) {
		let i;
		try {
			i = Object.keys(n);
		} catch {
			throw new e(r, n === null ? "null" : "undefined");
		}
		if (Array.isArray(n)) throw new e(r, "array");
		if (i.length !== 1) throw i.length === 0 ? new e(r, "empty object") : i.every((e) => !isNaN(Number(e))) ? new e(r, "string") : new j(r);
		let a = i[0], o = n[a], s;
		if (o instanceof be) s = new z(o, a);
		else if (o instanceof t) {
			let e = o._getQuery();
			if (!e.from) throw new M(r);
			s = new A(e, a);
		} else throw new v(a);
		return [a, s];
	}
	from(e) {
		let [, n] = this._createRefForSource(e, "from clause");
		return new t({
			...this.query,
			from: n
		});
	}
	join(e, n, r = "left") {
		let [i, a] = this._createRefForSource(e, "join clause"), o = [...this._getCurrentAliases(), i], s = n(H(o)), c, l;
		if (s.type === "func" && s.name === "eq" && s.args.length === 2) c = s.args[0], l = s.args[1];
		else throw new de();
		let u = {
			from: a,
			type: r,
			left: c,
			right: l
		}, d = this.query.join || [];
		return new t({
			...this.query,
			join: [...d, u]
		});
	}
	leftJoin(e, t) {
		return this.join(e, t, "left");
	}
	rightJoin(e, t) {
		return this.join(e, t, "right");
	}
	innerJoin(e, t) {
		return this.join(e, t, "inner");
	}
	fullJoin(e, t) {
		return this.join(e, t, "full");
	}
	where(e) {
		let n = this._getCurrentAliases(), i = e(H(n)), a = r(i) ? V(i) : i;
		if (!x(a)) throw new N(Fe(a));
		let o = this.query.where || [];
		return new t({
			...this.query,
			where: [...o, a]
		});
	}
	having(e) {
		let n = this._getCurrentAliases(), i = e(this.query.select || this.query.fnSelect ? b(n) : H(n)), a = r(i) ? V(i) : i;
		if (!x(a)) throw new N(Fe(a));
		let o = this.query.having || [];
		return new t({
			...this.query,
			having: [...o, a]
		});
	}
	select(e) {
		let n = this._getCurrentAliases(), r = Re(e(H(n)));
		return new t({
			...this.query,
			select: r,
			fnSelect: void 0
		});
	}
	orderBy(e, n = "asc") {
		let r = this._getCurrentAliases(), i = e(this.query.select || this.query.fnSelect ? b(r) : H(r)), a = typeof n == "string" ? {
			direction: n,
			nulls: "first"
		} : {
			direction: n.direction ?? "asc",
			nulls: n.nulls ?? "first",
			stringSort: n.stringSort,
			locale: n.stringSort === "locale" ? n.locale : void 0,
			localeOptions: n.stringSort === "locale" ? n.localeOptions : void 0
		}, o = (e) => ({
			expression: V(e),
			compareOptions: a
		}), s = Array.isArray(i) ? i.map((e) => o(e)) : [o(i)], c = this.query.orderBy || [];
		return new t({
			...this.query,
			orderBy: [...c, ...s]
		});
	}
	groupBy(e) {
		let n = this._getCurrentAliases(), r = e(H(n)), i = Array.isArray(r) ? r.map((e) => V(e)) : [V(r)], a = this.query.groupBy || [];
		return new t({
			...this.query,
			groupBy: [...a, ...i]
		});
	}
	limit(e) {
		return new t({
			...this.query,
			limit: e
		});
	}
	offset(e) {
		return new t({
			...this.query,
			offset: e
		});
	}
	distinct() {
		return new t({
			...this.query,
			distinct: !0
		});
	}
	findOne() {
		return new t({
			...this.query,
			singleResult: !0
		});
	}
	_getCurrentAliases() {
		let e = [];
		if (this.query.from && e.push(this.query.from.alias), this.query.join) for (let t of this.query.join) e.push(t.from.alias);
		return e;
	}
	get fn() {
		let e = this;
		return {
			select(n) {
				return new t({
					...e.query,
					select: void 0,
					fnSelect: n
				});
			},
			where(n) {
				return new t({
					...e.query,
					fnWhere: [...e.query.fnWhere || [], n]
				});
			},
			having(n) {
				return new t({
					...e.query,
					fnHaving: [...e.query.fnHaving || [], n]
				});
			}
		};
	}
	_getQuery() {
		if (!this.query.from) throw new fe();
		return this.query;
	}
};
function Fe(e) {
	return e === null ? "null" : e === void 0 ? "undefined" : typeof e == "object" ? "object" : typeof e;
}
function Ie(e) {
	return e === void 0 ? V(null) : e instanceof me || e instanceof I || e instanceof F || e instanceof B ? e : V(e);
}
function Le(e) {
	return typeof e == "object" && !!e && !x(e) && !e.__refProxy;
}
function Re(e) {
	if (!Le(e)) return Ie(e);
	let t = {};
	for (let [n, r] of Object.entries(e)) t[n] = typeof n == "string" && n.startsWith("__SPREAD_SENTINEL__") ? r : Re(r);
	return t;
}
function ze(e) {
	return Be(e(new G()));
}
function Be(e) {
	return e._getQuery();
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/optimizer.js
function Ve(e) {
	let t = He(e), n = e, r, i = 0;
	for (; i < 10 && !p(n, r);) r = n, n = K(n), i++;
	return {
		optimizedQuery: Ke(n),
		sourceWhereClauses: t
	};
}
function He(e) {
	let t = /* @__PURE__ */ new Map();
	if (!e.where || e.where.length === 0) return t;
	let n = Ye(J(e.where).map((e) => Je(e))), r = We(e);
	for (let [i, a] of n.singleSource) Ue(e, i) && !r.has(i) && t.set(i, a);
	return t;
}
function Ue(e, t) {
	if (e.from.alias === t) return e.from.type === "collectionRef";
	if (e.join) {
		for (let n of e.join) if (n.from.alias === t) return n.from.type === "collectionRef";
	}
	return !1;
}
function We(e) {
	let t = /* @__PURE__ */ new Set();
	if (e.join) {
		let n = e.from.alias;
		for (let r of e.join) {
			let e = r.from.alias;
			(r.type === "left" || r.type === "full") && t.add(e), (r.type === "right" || r.type === "full") && t.add(n);
		}
	}
	return t;
}
function K(e) {
	return Ge({
		...e,
		from: e.from.type === "queryRef" ? new A(K(e.from.query), e.from.alias) : e.from,
		join: e.join?.map((e) => ({
			...e,
			from: e.from.type === "queryRef" ? new A(K(e.from.query), e.from.alias) : e.from
		}))
	});
}
function Ge(e) {
	if (!e.where || e.where.length === 0) return e;
	if (!e.join || e.join.length === 0) {
		if (e.where.length > 1) {
			let t = Q(J(e.where));
			return {
				...e,
				where: [t]
			};
		}
		return e;
	}
	let t = Xe(e, Ye(J(e.where.filter((e) => !i(e))).map((e) => Je(e)))), n = e.where.filter((e) => i(e));
	return n.length > 0 && (t.where = [...t.where || [], ...n]), t;
}
function Ke(e) {
	return {
		...e,
		from: q(e.from),
		join: e.join?.map((e) => ({
			...e,
			from: q(e.from)
		}))
	};
}
function q(e) {
	if (e.type === "collectionRef") return e;
	let t = Ke(e.query);
	if (qe(t)) {
		let n = q(t.from);
		return n.type === "collectionRef" ? new z(n.collection, e.alias) : new A(n.query, e.alias);
	}
	return new A(t, e.alias);
}
function qe(e) {
	return (!e.where || e.where.length === 0) && !e.select && (!e.groupBy || e.groupBy.length === 0) && (!e.having || e.having.length === 0) && (!e.orderBy || e.orderBy.length === 0) && (!e.join || e.join.length === 0) && e.limit === void 0 && e.offset === void 0 && !e.fnSelect && (!e.fnWhere || e.fnWhere.length === 0) && (!e.fnHaving || e.fnHaving.length === 0);
}
function J(e) {
	let t = [];
	for (let n of e) {
		let e = U(n);
		t.push(...Y(e));
	}
	return t;
}
function Y(e) {
	if (e.type === "func" && e.name === "and") {
		let t = [];
		for (let n of e.args) t.push(...Y(n));
		return t;
	}
	return [e];
}
function Je(e) {
	let t = /* @__PURE__ */ new Set(), n = !1;
	function r(e) {
		switch (e.type) {
			case "ref":
				if (e.path && e.path.length > 0) {
					let r = e.path[0];
					r && (t.add(r), e.path.length === 1 && (n = !0));
				}
				break;
			case "func":
				e.args && e.args.forEach(r);
				break;
			case "val": break;
			case "agg": e.args && e.args.forEach(r);
		}
	}
	return r(e), {
		expression: e,
		touchedSources: t,
		hasNamespaceOnlyRef: n
	};
}
function Ye(e) {
	let t = /* @__PURE__ */ new Map(), n = [];
	for (let r of e) if (r.touchedSources.size === 1 && !r.hasNamespaceOnlyRef) {
		let e = Array.from(r.touchedSources)[0];
		t.has(e) || t.set(e, []), t.get(e).push(r.expression);
	} else (r.touchedSources.size > 1 || r.hasNamespaceOnlyRef) && n.push(r.expression);
	let r = /* @__PURE__ */ new Map();
	for (let [e, n] of t) r.set(e, Q(n));
	return {
		singleSource: r,
		multiSource: n.length > 0 ? Q(n) : void 0
	};
}
function Xe(e, t) {
	let n = /* @__PURE__ */ new Set(), r = We(e), i = /* @__PURE__ */ new Map();
	for (let [e, n] of t.singleSource) r.has(e) || i.set(e, n);
	let a = Ze(e.from, i, n), o = e.join ? e.join.map((e) => ({
		...e,
		from: Ze(e.from, i, n)
	})) : void 0, s = [];
	t.multiSource && s.push(t.multiSource);
	let c = r.size > 0;
	for (let [e, r] of t.singleSource) n.has(e) ? c && s.push(we(r)) : s.push(r);
	let l = s.length > 1 ? [Q(s.flatMap((e) => Y(U(e))))] : s;
	return {
		select: e.select,
		groupBy: e.groupBy ? [...e.groupBy] : void 0,
		having: e.having ? [...e.having] : void 0,
		orderBy: e.orderBy ? [...e.orderBy] : void 0,
		limit: e.limit,
		offset: e.offset,
		distinct: e.distinct,
		fnSelect: e.fnSelect,
		fnWhere: e.fnWhere ? [...e.fnWhere] : void 0,
		fnHaving: e.fnHaving ? [...e.fnHaving] : void 0,
		from: a,
		join: o,
		where: l.length > 0 ? l : []
	};
}
function X(e) {
	return {
		from: e.from.type === "collectionRef" ? new z(e.from.collection, e.from.alias) : new A(X(e.from.query), e.from.alias),
		select: e.select,
		join: e.join ? e.join.map((e) => ({
			type: e.type,
			left: e.left,
			right: e.right,
			from: e.from.type === "collectionRef" ? new z(e.from.collection, e.from.alias) : new A(X(e.from.query), e.from.alias)
		})) : void 0,
		where: e.where ? [...e.where] : void 0,
		groupBy: e.groupBy ? [...e.groupBy] : void 0,
		having: e.having ? [...e.having] : void 0,
		orderBy: e.orderBy ? [...e.orderBy] : void 0,
		limit: e.limit,
		offset: e.offset,
		fnSelect: e.fnSelect,
		fnWhere: e.fnWhere ? [...e.fnWhere] : void 0,
		fnHaving: e.fnHaving ? [...e.fnHaving] : void 0
	};
}
function Ze(e, t, n) {
	let r = t.get(e.alias);
	if (!r) return e.type === "collectionRef" ? new z(e.collection, e.alias) : new A(X(e.query), e.alias);
	if (e.type === "collectionRef") {
		let t = {
			from: new z(e.collection, e.alias),
			where: [r]
		};
		return n.add(e.alias), new A(t, e.alias);
	}
	if (!rt(e.query, r, e.alias) || ot(e.query, r, e.alias)) return new A(X(e.query), e.alias);
	let i = e.query.where || [], a = {
		...X(e.query),
		where: [...i, r]
	};
	return n.add(e.alias), new A(a, e.alias);
}
function Qe(e, t, n) {
	return e.select ? it(e.select) || at(e.select, t, n) : !1;
}
function $e(e) {
	return e.groupBy && e.groupBy.length > 0;
}
function et(e) {
	return e.having && e.having.length > 0;
}
function tt(e) {
	return e.orderBy && e.orderBy.length > 0 && (e.limit !== void 0 || e.offset !== void 0);
}
function nt(e) {
	return e.fnSelect || e.fnWhere && e.fnWhere.length > 0 || e.fnHaving && e.fnHaving.length > 0;
}
function rt(e, t, n) {
	return !(Qe(e, t, n) || $e(e) || et(e) || tt(e) || nt(e));
}
function it(e) {
	for (let t of Object.values(e)) if (typeof t == "object") {
		let e = t;
		if (e.type === "agg" || !("type" in e) && it(e)) return !0;
	}
	return !1;
}
function Z(e) {
	let t = [];
	if (typeof e != "object" || !e) return t;
	switch (e.type) {
		case "ref":
			t.push(e);
			break;
		case "func":
		case "agg": for (let n of e.args ?? []) t.push(...Z(n));
	}
	return t;
}
function at(e, t, n) {
	let r = /* @__PURE__ */ new Set();
	for (let [t, n] of Object.entries(e)) t.startsWith("__SPREAD_SENTINEL__") || n instanceof F || r.add(t);
	let i = Z(t);
	for (let e of i) {
		let t = e.path;
		if (!Array.isArray(t) || t.length < 2) continue;
		let i = t[0], a = t[1];
		if (i === n && r.has(a)) return !0;
	}
	return !1;
}
function ot(e, t, n) {
	let r = Z(t);
	if (r.every((e) => e.path[0] !== n)) return !1;
	if (e.fnSelect) return !0;
	let i = e.select;
	if (!i) return !1;
	for (let t of r) {
		let r = t.path;
		if (r.length < 2 || r[0] !== n) continue;
		let a = i[r[1]];
		if (!a) continue;
		if (!(a instanceof F) || a.path.length < 2) return !0;
		let [o, s] = a.path;
		if (o !== n && o !== e.from.alias || s !== r[1]) return !0;
	}
	return !1;
}
function Q(e) {
	if (e.length === 0) throw new w();
	return e.length === 1 ? e[0] : new I("and", e);
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/compiler/joins.js
function st(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h, g, _, v) {
	let y = e;
	for (let e of t) y = ct(y, e, n, r, i, a, o, s, c, l, u, d, f, p, m, h, g, _, v);
	return y;
}
function ct(e, t, r, i, o, s, c, l, u, d, f, p, m, h, g, _, v, b, x) {
	let S = t.from.type === "collectionRef", { alias: C, input: w, collectionId: T } = dt(t.from, s, u, d, f, p, m, h, c, l, _, v, b, x);
	r[C] = w, S && (v[C] = T);
	let E = u[i], D = u[T];
	if (!E) throw new ye(i);
	if (!D) throw new ye(T);
	let { activeSource: O, lazySource: k } = pt(t.type, E, D), A = Object.keys(r), { mainExpr: j, joinedExpr: M } = lt(t.left, t.right, A, C), ne = y(j), re = y(M), N = e.pipe(a(([e, t]) => [n(ne(t)), [e, t]])), P = w.pipe(a(([e, t]) => {
		let r = { [C]: t };
		return [n(re(r)), [e, r]];
	}));
	if (![
		"inner",
		"left",
		"right",
		"full"
	].includes(t.type)) throw new ie(t.type);
	if (O) {
		let e = O === "main" ? t.from : g.from, n = e.type === "queryRef" && (e.query.limit || e.query.offset), r = j.type === "func" || M.type === "func";
		if (!n && !r) {
			let e = O === "main" ? C : o;
			p.add(e);
			let t = O === "main" ? N : P, n = te(g, O === "main" ? M : j, k), r = n.collection, i = n.path[0];
			i && Se(i, n.path, r);
			let a = t.pipe(Oe((t) => {
				let r = b[e] || e, i = d[r];
				if (!i) throw new ce(r, e, k.id, Object.keys(d));
				if (i.hasLoadedInitialState()) return;
				let a = t.getInner().map(([[e]]) => e), o = new F(n.path);
				i.requestSnapshot({
					where: ee(o, a),
					optimizedOnly: !0
				}) || i.requestSnapshot();
			}));
			O === "main" ? N = a : P = a;
		}
	}
	return N.pipe(Me(P, t.type), ft(t.type));
}
function lt(e, t, n, r) {
	let i = n.filter((e) => e !== r), a = ut(e), o = ut(t);
	if (a && i.includes(a) && o === r) return {
		mainExpr: e,
		joinedExpr: t
	};
	if (a === r && o && i.includes(o)) return {
		mainExpr: t,
		joinedExpr: e
	};
	throw !a || !o ? new O() : a === o ? new E(a) : i.includes(a) ? o === r ? new he() : new D(r) : new d(a);
}
function ut(e) {
	switch (e.type) {
		case "ref": return e.path[0] || null;
		case "func": {
			let t = /* @__PURE__ */ new Set();
			for (let n of e.args) {
				let e = ut(n);
				e && t.add(e);
			}
			return t.size === 1 ? Array.from(t)[0] : null;
		}
		default: return null;
	}
}
function dt(e, t, n, r, i, o, s, c, u, d, f, p, m, h) {
	switch (e.type) {
		case "collectionRef": {
			let n = t[e.alias];
			if (!n) throw new l(e.alias, e.collection.id, Object.keys(t));
			return p[e.alias] = e.collection.id, {
				alias: e.alias,
				input: n,
				collectionId: e.collection.id
			};
		}
		case "queryRef": {
			let l = f(d.get(e.query) || e.query, t, n, r, i, o, s, c, u, d);
			Object.assign(p, l.aliasToCollectionId), Object.assign(m, l.aliasRemapping);
			let g = d.has(e.query), _ = e.query.from.alias;
			if (g || e.alias !== _) for (let [e, t] of l.sourceWhereClauses) h.set(e, t);
			let v = Object.keys(l.aliasToCollectionId).find((e) => l.aliasToCollectionId[e] === l.collectionId);
			v && v !== e.alias && (m[e.alias] = v);
			let y = l.pipeline.pipe(a((e) => {
				let [t, [n, r]] = e;
				return [t, n];
			}));
			return {
				alias: e.alias,
				input: y,
				collectionId: l.collectionId
			};
		}
		default: throw new re(e.type);
	}
}
function ft(e) {
	return function(t) {
		return t.pipe(S((t) => {
			let [n, [r, i]] = t, a = r?.[1], o = i?.[1];
			return e === "inner" ? !!(a && o) : e === "left" ? !!a : e !== "right" || !!o;
		}), a((e) => {
			let [t, [n, r]] = e, i = n?.[0], a = n?.[1], o = r?.[0], s = r?.[1], c = {};
			return a && Object.assign(c, a), s && Object.assign(c, s), [`[${i},${o}]`, c];
		}));
	};
}
function pt(e, t, n) {
	switch (e) {
		case "left": return {
			activeSource: "main",
			lazySource: n
		};
		case "right": return {
			activeSource: "joined",
			lazySource: t
		};
		case "inner": return t.size < n.size ? {
			activeSource: "main",
			lazySource: n
		} : {
			activeSource: "joined",
			lazySource: t
		};
		default: return {
			activeSource: void 0,
			lazySource: void 0
		};
	}
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/compiler/select.js
function mt(e) {
	return e instanceof B ? e.value : e;
}
function ht(e, t, n) {
	let r = e.source(t);
	if (r && typeof r == "object") {
		let t = n, i = e.targetPath;
		if (i.length === 0) for (let [e, t] of Object.entries(r)) n[e] = mt(t);
		else for (let e = 0; e < i.length; e++) {
			let n = i[e];
			if (e === i.length - 1) {
				let e = t[n] ??= {};
				if (typeof e == "object") for (let [t, n] of Object.entries(r)) e[t] = mt(n);
			} else {
				let e = t[n];
				typeof e == "object" && e || (t[n] = {}), t = t[n];
			}
		}
	}
}
function gt(e, t, n) {
	let r = e.alias.split(".");
	if (r.length === 1) n[e.alias] = e.compiled(t);
	else {
		let i = n;
		for (let e = 0; e < r.length - 1; e++) {
			let t = r[e], n = i[t];
			typeof n == "object" && n || (i[t] = {}), i = i[t];
		}
		i[r[r.length - 1]] = mt(e.compiled(t));
	}
}
function _t([e, t], n) {
	let r = {};
	for (let e of n) e.kind === "merge" ? ht(e, t, r) : gt(e, t, r);
	return [e, {
		...t,
		$selected: r
	}];
}
function vt(e, t, n) {
	let r = [];
	return xt([], t, r), e.pipe(a((e) => _t(e, r)));
}
function yt(e) {
	return e.type === "agg";
}
function bt(e) {
	return e && typeof e == "object" && !x(e);
}
function xt(e, t, n) {
	for (let [r, i] of Object.entries(t)) {
		if (r.startsWith("__SPREAD_SENTINEL__")) {
			let t = r.slice(19), a = t.lastIndexOf("__"), o = a >= 0 ? t.slice(0, a) : t, s = i && typeof i == "object" && "type" in i && i.type === "ref";
			if (o.includes(".") || s) {
				let t = [...e], r = s ? i : new F(o.split(".")), a = y(r);
				n.push({
					kind: "merge",
					targetPath: t,
					source: a
				});
			} else {
				let t = o, r = [...e];
				n.push({
					kind: "merge",
					targetPath: r,
					source: (e) => e[t]
				});
			}
			continue;
		}
		let t = i;
		if (bt(t)) xt([...e, r], t, n);
		else if (yt(t) || ae(t)) n.push({
			kind: "field",
			alias: [...e, r].join("."),
			compiled: () => null
		});
		else {
			if (t === void 0 || !x(t)) {
				n.push({
					kind: "field",
					alias: [...e, r].join("."),
					compiled: () => t
				});
				continue;
			}
			if (t instanceof B) {
				let i = t.value;
				n.push({
					kind: "field",
					alias: [...e, r].join("."),
					compiled: () => i
				});
			} else n.push({
				kind: "field",
				alias: [...e, r].join("."),
				compiled: y(t)
			});
		}
	}
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/compiler/index.js
function St(e, t, n, r, i, o, s, l, u = /* @__PURE__ */ new WeakMap(), d = /* @__PURE__ */ new WeakMap()) {
	let p = u.get(e);
	if (p) return p;
	wt(e);
	let { optimizedQuery: m, sourceWhereClauses: h } = Ve(e);
	d.set(m, e), Ot(m, e, d);
	let g = { ...t }, _ = {}, v = {}, b = {}, { alias: x, input: w, collectionId: T } = Tt(m.from, g, n, r, i, o, s, l, u, d, _, v, h);
	b[x] = w;
	let E = w.pipe(a(([e, t]) => [e, { [x]: t }]));
	if (m.join && m.join.length > 0 && (E = st(E, m.join, b, T, x, g, u, d, n, r, i, o, s, l, e, St, _, v, h)), m.where && m.where.length > 0) for (let e of m.where) {
		let t = U(e), n = y(t);
		E = E.pipe(S(([e, t]) => Te(n(t))));
	}
	if (m.fnWhere && m.fnWhere.length > 0) for (let e of m.fnWhere) E = E.pipe(S(([t, n]) => Te(e(n))));
	if (m.distinct && !m.fnSelect && !m.select) throw new C();
	if (m.fnSelect && m.groupBy && m.groupBy.length > 0) throw new c();
	if (E = m.fnSelect ? E.pipe(a(([e, t]) => {
		let n = m.fnSelect(t);
		return [e, {
			...t,
			$selected: n
		}];
	})) : m.select ? vt(E, m.select) : E.pipe(a(([e, t]) => {
		let n = !m.join && !m.groupBy ? t[x] : t;
		return [e, {
			...t,
			$selected: n
		}];
	})), m.groupBy && m.groupBy.length > 0 ? E = k(E, m.groupBy, m.having, m.select, m.fnHaving) : m.select && Object.values(m.select).some((e) => e.type === "agg" || ae(e)) && (E = k(E, [], m.having, m.select, m.fnHaving)), m.having && (!m.groupBy || m.groupBy.length === 0) && !(m.select && Object.values(m.select).some((e) => e.type === "agg"))) throw new f();
	if (m.fnHaving && m.fnHaving.length > 0 && (!m.groupBy || m.groupBy.length === 0)) for (let e of m.fnHaving) E = E.pipe(S(([t, n]) => e(n)));
	if (m.distinct && (E = E.pipe(Pe(([e, t]) => t.$selected))), m.orderBy && m.orderBy.length > 0) {
		let t = {
			collectionId: T,
			pipeline: oe(e, E, m.orderBy, m.select || {}, n[T], s, l, m.limit, m.offset).pipe(a(([e, [t, n]]) => {
				let r = t.$selected;
				return [e, [Dt(r), n]];
			})),
			sourceWhereClauses: h,
			aliasToCollectionId: _,
			aliasRemapping: v
		};
		return u.set(e, t), t;
	}
	if (m.limit !== void 0 || m.offset !== void 0) throw new ge();
	let D = {
		collectionId: T,
		pipeline: E.pipe(a(([e, t]) => {
			let n = t.$selected;
			return [e, [Dt(n), void 0]];
		})),
		sourceWhereClauses: h,
		aliasToCollectionId: _,
		aliasRemapping: v
	};
	return u.set(e, D), D;
}
function Ct(e) {
	let t = /* @__PURE__ */ new Set();
	if (e.from.type === "collectionRef" && t.add(e.from.alias), e.join) for (let n of e.join) n.from.type === "collectionRef" && t.add(n.from.alias);
	return t;
}
function wt(e, t = /* @__PURE__ */ new Set()) {
	let n = Ct(e);
	for (let e of n) if (t.has(e)) throw new T(e, Array.from(t));
	let r = /* @__PURE__ */ new Set([...t, ...n]);
	if (e.from.type === "queryRef" && wt(e.from.query, r), e.join) for (let t of e.join) t.from.type === "queryRef" && wt(t.from.query, r);
}
function Tt(e, t, n, r, i, o, s, c, u, d, f, p, m) {
	switch (e.type) {
		case "collectionRef": {
			let n = t[e.alias];
			if (!n) throw new l(e.alias, e.collection.id, Object.keys(t));
			return f[e.alias] = e.collection.id, {
				alias: e.alias,
				input: n,
				collectionId: e.collection.id
			};
		}
		case "queryRef": {
			let l = St(d.get(e.query) || e.query, t, n, r, i, o, s, c, u, d);
			Object.assign(f, l.aliasToCollectionId), Object.assign(p, l.aliasRemapping);
			let h = d.has(e.query), g = e.query.from.alias;
			if (h || e.alias !== g) for (let [e, t] of l.sourceWhereClauses) m.set(e, t);
			let _ = Object.keys(l.aliasToCollectionId).find((e) => l.aliasToCollectionId[e] === l.collectionId);
			_ && _ !== e.alias && (p[e.alias] = _);
			let v = l.pipeline.pipe(a((e) => {
				let [t, [n, r]] = e;
				return [t, Dt(n)];
			}));
			return {
				alias: e.alias,
				input: v,
				collectionId: l.collectionId
			};
		}
		default: throw new xe(e.type);
	}
}
function Et(e) {
	return e instanceof B || e && typeof e == "object" && "type" in e && e.type === "val";
}
function Dt(e) {
	return Et(e) ? e.value : e;
}
function Ot(e, t, n) {
	if (e.from.type === "queryRef" && t.from.type === "queryRef" && (n.set(e.from.query, t.from.query), Ot(e.from.query, t.from.query, n)), e.join && t.join) for (let r = 0; r < e.join.length && r < t.join.length; r++) {
		let i = e.join[r], a = t.join[r];
		i.from.type === "queryRef" && a.from.type === "queryRef" && (n.set(i.from.query, a.from.query), Ot(i.from.query, a.from.query, n));
	}
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/compiler/expressions.js
function kt(e, t) {
	let n = e.type;
	if (n === "val") return new B(e.value);
	if (n === "ref") {
		let n = e.path;
		if (Array.isArray(n)) {
			if (n[0] === t && n.length > 1) return new F(n.slice(1));
			if (n.length === 1 && n[0] !== void 0) return new F([n[0]]);
		}
		return new F(Array.isArray(n) ? n : [String(n)]);
	}
	{
		let n = [];
		for (let r of e.args) {
			let e = kt(r, t);
			n.push(e);
		}
		return new I(e.name, n);
	}
}
function At(e, t) {
	return e.map((e) => {
		let n = kt(e.expression, t);
		return {
			...e,
			expression: n
		};
	});
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/live/collection-subscriber.js
var jt = /* @__PURE__ */ Symbol.for("@tanstack/db.collection-config-builder"), Mt = class {
	constructor(e, t, n, r) {
		this.alias = e, this.collectionId = t, this.collection = n, this.collectionConfigBuilder = r, this.biggest = void 0, this.subscriptionLoadingPromises = /* @__PURE__ */ new Map(), this.sentToD2Keys = /* @__PURE__ */ new Set();
	}
	subscribe() {
		let e = this.getWhereClauseForAlias();
		if (e) {
			let t = kt(e, this.alias);
			return this.subscribeToChanges(t);
		}
		return this.subscribeToChanges();
	}
	subscribeToChanges(e) {
		let t = this.getOrderByInfo(), n = (e) => {
			e instanceof Promise && this.collectionConfigBuilder.liveQueryCollection._sync.trackLoadPromise(e);
		}, r = (e) => {
			let t = e.subscription;
			if (e.status === "loadingSubset") this.ensureLoadingPromise(t);
			else {
				let e = this.subscriptionLoadingPromises.get(t);
				e && (this.subscriptionLoadingPromises.delete(t), e.resolve());
			}
		}, i;
		if (t) i = this.subscribeToOrderedChanges(e, t, r, n);
		else {
			let t = !this.collectionConfigBuilder.isLazyAlias(this.alias);
			i = this.subscribeToMatchingChanges(e, t, r);
		}
		return i.status === "loadingSubset" && this.ensureLoadingPromise(i), this.collectionConfigBuilder.currentSyncState.unsubscribeCallbacks.add(() => {
			let e = this.subscriptionLoadingPromises.get(i);
			e && (this.subscriptionLoadingPromises.delete(i), e.resolve()), i.unsubscribe();
		}), i;
	}
	sendChangesToPipeline(e, t) {
		let n = Array.isArray(e) ? e : [...e], r = [];
		for (let e of n) {
			if (e.type === "insert") {
				if (this.sentToD2Keys.has(e.key)) continue;
				this.sentToD2Keys.add(e.key);
			} else e.type === "delete" && this.sentToD2Keys.delete(e.key);
			r.push(e);
		}
		let i = this.collectionConfigBuilder.currentSyncState.inputs[this.alias], a = Nt(i, r, this.collection.config.getKey) > 0 ? t : void 0;
		this.collectionConfigBuilder.scheduleGraphRun(a, { alias: this.alias });
	}
	subscribeToMatchingChanges(e, t, n) {
		let r = (e) => {
			this.sendChangesToPipeline(e);
		}, { orderBy: i, limit: a, offset: o } = this.collectionConfigBuilder.query, s = a !== void 0 && o !== void 0 ? a + o : a, c = i ? At(i, this.alias) : void 0, l = c?.every((e) => {
			let t = e.expression;
			if (t.type !== "ref") return !1;
			let n = t.path;
			return Array.isArray(n) && n.length === 1;
		}) ?? !1, u = l ? c : void 0, d = l ? s : void 0, f = t ? (e) => {
			e instanceof Promise && this.collectionConfigBuilder.liveQueryCollection._sync.trackLoadPromise(e);
		} : void 0;
		return this.collection.subscribeChanges(r, {
			...t && { includeInitialState: t },
			whereExpression: e,
			onStatusChange: n,
			orderBy: u,
			limit: d,
			onLoadSubsetResult: f
		});
	}
	subscribeToOrderedChanges(e, t, n, r) {
		let { orderBy: i, offset: a, limit: o, index: s } = t, c = (e) => {
			e instanceof Promise && (this.pendingOrderedLoadPromise = e, e.finally(() => {
				this.pendingOrderedLoadPromise === e && (this.pendingOrderedLoadPromise = void 0);
			})), r(e);
		};
		this.orderedLoadSubsetResult = c;
		let l = {}, u = this.collection.subscribeChanges((e) => {
			let n = Array.isArray(e) ? e : [...e];
			this.trackSentValues(n, t.comparator);
			let r = Pt(n);
			this.sendChangesToPipelineWithTracking(r, l.current);
		}, {
			whereExpression: e,
			onStatusChange: n
		});
		l.current = u;
		let d = this.collection.on("truncate", () => {
			this.biggest = void 0, this.lastLoadRequestKey = void 0, this.pendingOrderedLoadPromise = void 0, this.sentToD2Keys.clear();
		});
		u.on("unsubscribed", () => {
			d();
		});
		let f = At(i, this.alias);
		return s ? (u.setOrderByIndex(s), u.requestLimitedSnapshot({
			limit: a + o,
			orderBy: f,
			trackLoadSubsetPromise: !1,
			onLoadSubsetResult: c
		})) : u.requestSnapshot({
			orderBy: f,
			limit: a + o,
			trackLoadSubsetPromise: !1,
			onLoadSubsetResult: c
		}), u;
	}
	loadMoreIfNeeded(e) {
		let t = this.getOrderByInfo();
		if (!t) return !0;
		let { dataNeeded: n } = t;
		if (!n || this.pendingOrderedLoadPromise) return !0;
		let r = n();
		return r > 0 && this.loadNextItems(r, e), !0;
	}
	sendChangesToPipelineWithTracking(e, t) {
		if (!this.getOrderByInfo()) {
			this.sendChangesToPipeline(e);
			return;
		}
		let n = t;
		n[jt] ??= this.loadMoreIfNeeded.bind(this, t), this.sendChangesToPipeline(e, n[jt]);
	}
	loadNextItems(e, t) {
		let n = this.getOrderByInfo();
		if (!n) return;
		let { orderBy: r, valueExtractorForRawRow: i, offset: a } = n, o = this.biggest, s = o ? i(o) : void 0, c;
		s !== void 0 && (c = Array.isArray(s) ? s : [s]);
		let l = this.getLoadRequestKey({
			minValues: c,
			offset: a,
			limit: e
		});
		if (this.lastLoadRequestKey === l) return;
		let u = At(r, this.alias);
		t.requestLimitedSnapshot({
			orderBy: u,
			limit: e,
			minValues: c,
			trackLoadSubsetPromise: !1,
			onLoadSubsetResult: this.orderedLoadSubsetResult
		}), this.lastLoadRequestKey = l;
	}
	getWhereClauseForAlias() {
		let e = this.collectionConfigBuilder.sourceWhereClausesCache;
		if (e) return e.get(this.alias);
	}
	getOrderByInfo() {
		let e = this.collectionConfigBuilder.optimizableOrderByCollections[this.collectionId];
		if (e && e.alias === this.alias) return e;
	}
	trackSentValues(e, t) {
		for (let n of e) {
			if (n.type === "delete") continue;
			let e = !this.sentToD2Keys.has(n.key);
			this.biggest ? t(this.biggest, n.value) < 0 ? (this.biggest = n.value, this.lastLoadRequestKey = void 0) : e && (this.lastLoadRequestKey = void 0) : (this.biggest = n.value, this.lastLoadRequestKey = void 0);
		}
	}
	ensureLoadingPromise(e) {
		if (this.subscriptionLoadingPromises.has(e)) return;
		let t, n = new Promise((e) => {
			t = e;
		});
		this.subscriptionLoadingPromises.set(e, { resolve: t }), this.collectionConfigBuilder.liveQueryCollection._sync.trackLoadPromise(n);
	}
	getLoadRequestKey(e) {
		return u({
			minValues: e.minValues ?? null,
			offset: e.offset,
			limit: e.limit
		});
	}
};
function Nt(e, t, n) {
	let r = [];
	for (let e of t) {
		let t = n(e.value);
		e.type === "insert" ? r.push([[t, e.value], 1]) : e.type === "update" ? (r.push([[t, e.previousValue], -1]), r.push([[t, e.value], 1])) : r.push([[t, e.value], -1]);
	}
	return r.length !== 0 && e.sendData(new _(r)), r.length;
}
function* Pt(e) {
	for (let t of e) t.type === "update" ? (yield {
		type: "delete",
		key: t.key,
		value: t.previousValue
	}, yield {
		type: "insert",
		key: t.key,
		value: t.value
	}) : yield t;
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/live/collection-registry.js
var Ft = /* @__PURE__ */ new WeakMap();
function It(e) {
	return e.utils?.[le]?.getBuilder?.();
}
function Lt(e, t) {
	Ft.set(e, t);
}
function Rt(e) {
	return Ft.get(e);
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/live/collection-config-builder.js
var zt = 0, Bt = class {
	constructor(e) {
		this.config = e, this.compiledAliasToCollectionId = {}, this.resultKeys = /* @__PURE__ */ new WeakMap(), this.orderByIndices = /* @__PURE__ */ new WeakMap(), this.isGraphRunning = !1, this.runCount = 0, this.isInErrorState = !1, this.aliasDependencies = {}, this.builderDependencies = /* @__PURE__ */ new Set(), this.pendingGraphRuns = /* @__PURE__ */ new Map(), this.subscriptions = {}, this.lazySourcesCallbacks = {}, this.lazySources = /* @__PURE__ */ new Set(), this.optimizableOrderByCollections = {}, this.id = e.id || `live-query-${++zt}`, this.query = Vt(e), this.collections = Ut(this.query);
		let t = Gt(this.query);
		this.collectionByAlias = {};
		for (let [e, n] of t.entries()) {
			let t = this.collections[e];
			if (t) for (let e of n) this.collectionByAlias[e] = t;
		}
		this.query.orderBy && this.query.orderBy.length > 0 && (this.compare = Ht(this.orderByIndices)), this.compareOptions = this.config.defaultStringCollation ?? Wt(this.query).compareOptions, this.compileBasePipeline();
	}
	hasJoins(e) {
		return !!(e.join && e.join.length > 0 || e.from.type === "queryRef" && this.hasJoins(e.from.query));
	}
	getConfig() {
		return {
			id: this.id,
			getKey: this.config.getKey || ((e) => this.resultKeys.get(e)),
			sync: this.getSyncConfig(),
			compare: this.compare,
			defaultStringCollation: this.compareOptions,
			gcTime: this.config.gcTime || 5e3,
			schema: this.config.schema,
			onInsert: this.config.onInsert,
			onUpdate: this.config.onUpdate,
			onDelete: this.config.onDelete,
			startSync: this.config.startSync,
			singleResult: this.query.singleResult,
			utils: {
				getRunCount: this.getRunCount.bind(this),
				setWindow: this.setWindow.bind(this),
				getWindow: this.getWindow.bind(this),
				[le]: {
					getBuilder: () => this,
					hasCustomGetKey: !!this.config.getKey,
					hasJoins: this.hasJoins(this.query),
					hasDistinct: !!this.query.distinct
				}
			}
		};
	}
	setWindow(e) {
		if (!this.windowFn) throw new _e();
		return this.currentWindow = e, this.windowFn(e), this.maybeRunGraphFn?.(), !this.liveQueryCollection?.isLoadingSubset || new Promise((e) => {
			let t = this.liveQueryCollection.on("loadingSubset:change", (n) => {
				n.isLoadingSubset || (t(), e());
			});
		});
	}
	getWindow() {
		if (this.windowFn && this.currentWindow) return {
			offset: this.currentWindow.offset ?? 0,
			limit: this.currentWindow.limit ?? 0
		};
	}
	getCollectionIdForAlias(e) {
		let t = this.compiledAliasToCollectionId[e];
		if (t) return t;
		let n = this.collectionByAlias[e];
		if (n) return n.id;
		throw Error(`Unknown source alias "${e}"`);
	}
	isLazyAlias(e) {
		return this.lazySources.has(e);
	}
	maybeRunGraph(e) {
		if (!this.isGraphRunning) {
			if (!this.currentSyncConfig || !this.currentSyncState) throw Error("maybeRunGraph called without active sync session. This should not happen.");
			this.isGraphRunning = !0;
			try {
				let { begin: t, commit: n } = this.currentSyncConfig, r = this.currentSyncState;
				if (this.isInErrorState) return;
				if (r.subscribedToAllCollections) {
					let i = !1;
					for (; r.graph.pendingWork();) r.graph.run(), r.flushPendingChanges?.(), e?.(), i = !0;
					i || e?.(), r.messagesCount === 0 && (t(), n()), this.updateLiveQueryStatus(this.currentSyncConfig);
				}
			} finally {
				this.isGraphRunning = !1;
			}
		}
	}
	scheduleGraphRun(e, t) {
		let n = t?.contextId ?? P()?.id, r = t?.jobId ?? this, i = (() => {
			if (t?.dependencies) return t.dependencies;
			let e = new Set(this.builderDependencies);
			if (t?.alias) {
				let n = this.aliasDependencies[t.alias];
				if (n) for (let t of n) e.add(t);
			}
			return e.delete(this), Array.from(e);
		})();
		if (n) for (let e of i) typeof e.scheduleGraphRun == "function" && e.scheduleGraphRun(void 0, { contextId: n });
		if (!this.currentSyncConfig || !this.currentSyncState) throw Error("scheduleGraphRun called without active sync session. This should not happen.");
		let a = n ? this.pendingGraphRuns.get(n) : void 0;
		a || (a = { loadCallbacks: /* @__PURE__ */ new Set() }, n && this.pendingGraphRuns.set(n, a)), e && a.loadCallbacks.add(e);
		let o = n ? void 0 : a;
		pe.schedule({
			contextId: n,
			jobId: r,
			dependencies: i,
			run: () => this.executeGraphRun(n, o)
		});
	}
	clearPendingGraphRun(e) {
		this.pendingGraphRuns.delete(e);
	}
	hasPendingGraphRun(e) {
		return this.pendingGraphRuns.has(e);
	}
	executeGraphRun(e, t) {
		let n = t ?? (e ? this.pendingGraphRuns.get(e) : void 0);
		e && this.pendingGraphRuns.delete(e), n && this.currentSyncConfig && this.currentSyncState && (this.incrementRunCount(), this.maybeRunGraph(() => {
			let e = !0, t;
			if (n.loadCallbacks.forEach((n) => {
				try {
					e = n() && e;
				} catch (n) {
					e = !1, t ??= n;
				}
			}), t) throw t;
			return e;
		}));
	}
	getSyncConfig() {
		return {
			rowUpdateMode: "full",
			sync: this.syncFn.bind(this)
		};
	}
	incrementRunCount() {
		this.runCount++;
	}
	getRunCount() {
		return this.runCount;
	}
	syncFn(e) {
		this.liveQueryCollection = e.collection, this.currentSyncConfig = e;
		let t = {
			messagesCount: 0,
			subscribedToAllCollections: !1,
			unsubscribeCallbacks: /* @__PURE__ */ new Set()
		}, n = this.extendPipelineWithChangeProcessing(e, t);
		this.currentSyncState = n, this.unsubscribeFromSchedulerClears = pe.onClear((e) => {
			this.clearPendingGraphRun(e);
		});
		let r = e.collection.on("loadingSubset:change", (t) => {
			t.isLoadingSubset || this.updateLiveQueryStatus(e);
		});
		t.unsubscribeCallbacks.add(r);
		let i = this.subscribeToAllCollections(e, n);
		return this.maybeRunGraphFn = () => this.scheduleGraphRun(i), this.scheduleGraphRun(i), () => {
			t.unsubscribeCallbacks.forEach((e) => e()), this.currentSyncConfig = void 0, this.currentSyncState = void 0, this.pendingGraphRuns.clear(), this.graphCache = void 0, this.inputsCache = void 0, this.pipelineCache = void 0, this.sourceWhereClausesCache = void 0, this.lazySources.clear(), this.optimizableOrderByCollections = {}, this.lazySourcesCallbacks = {}, Object.keys(this.subscriptions).forEach((e) => delete this.subscriptions[e]), this.compiledAliasToCollectionId = {}, this.unsubscribeFromSchedulerClears?.(), this.unsubscribeFromSchedulerClears = void 0;
		};
	}
	compileBasePipeline() {
		this.graphCache = new g(), this.inputsCache = Object.fromEntries(Object.keys(this.collectionByAlias).map((e) => [e, this.graphCache.newInput()]));
		let e = St(this.query, this.inputsCache, this.collections, this.subscriptions, this.lazySourcesCallbacks, this.lazySources, this.optimizableOrderByCollections, (e) => {
			this.windowFn = e;
		});
		this.pipelineCache = e.pipeline, this.sourceWhereClausesCache = e.sourceWhereClauses, this.compiledAliasToCollectionId = e.aliasToCollectionId;
		let t = Object.keys(this.compiledAliasToCollectionId).filter((e) => !Object.hasOwn(this.inputsCache, e));
		if (t.length > 0) throw new se(t);
	}
	maybeCompileBasePipeline() {
		return this.graphCache && this.inputsCache && this.pipelineCache || this.compileBasePipeline(), {
			graph: this.graphCache,
			inputs: this.inputsCache,
			pipeline: this.pipelineCache
		};
	}
	extendPipelineWithChangeProcessing(e, t) {
		let { begin: n, commit: r } = e, { graph: i, inputs: a, pipeline: o } = this.maybeCompileBasePipeline(), s = /* @__PURE__ */ new Map();
		return o.pipe(Ae((e) => {
			let n = e.getInner();
			t.messagesCount += n.length, n.reduce(Kt, s);
		})), t.flushPendingChanges = () => {
			if (s.size === 0) return;
			let t = s;
			if (this.config.getKey) {
				let e = /* @__PURE__ */ new Map();
				for (let [, t] of s) {
					let n = this.config.getKey(t.value), r = e.get(n);
					r ? (r.inserts += t.inserts, r.deletes += t.deletes, t.inserts > 0 && (r.value = t.value, t.orderByIndex !== void 0 && (r.orderByIndex = t.orderByIndex))) : e.set(n, { ...t });
				}
				t = e;
			}
			n(), t.forEach(this.applyChanges.bind(this, e)), r(), s = /* @__PURE__ */ new Map();
		}, i.finalize(), t.graph = i, t.inputs = a, t.pipeline = o, t;
	}
	applyChanges(e, t, n) {
		let { write: r, collection: i } = e, { deletes: a, inserts: o, value: s, orderByIndex: c } = t;
		if (this.resultKeys.set(s, n), c !== void 0 && this.orderByIndices.set(s, c), o && a === 0) r({
			value: s,
			type: "insert"
		});
		else if (o > a || o === a && i.has(i.getKeyFromItem(s))) r({
			value: s,
			type: "update"
		});
		else if (a > 0) r({
			value: s,
			type: "delete"
		});
		else throw Error(`Could not apply changes: ${JSON.stringify(t)}. This should never happen.`);
	}
	handleSourceStatusChange(e, t, n) {
		let { status: r } = n;
		r === "error" ? this.transitionToError(`Source collection '${t}' entered error state`) : r === "cleaned-up" ? this.transitionToError(`Source collection '${t}' was manually cleaned up while live query '${this.id}' depends on it. Live queries prevent automatic GC, so this was likely a manual cleanup() call.`) : this.updateLiveQueryStatus(e);
	}
	updateLiveQueryStatus(e) {
		let { markReady: t } = e;
		if (this.isInErrorState) return;
		let n = this.currentSyncState?.subscribedToAllCollections, r = this.allCollectionsReady(), i = this.liveQueryCollection?.isLoadingSubset;
		n && r && !i && t();
	}
	transitionToError(e) {
		this.isInErrorState = !0, console.error(`[Live Query Error] ${e}`), this.liveQueryCollection?._lifecycle.setStatus("error");
	}
	allCollectionsReady() {
		return Object.values(this.collections).every((e) => e.isReady());
	}
	subscribeToAllCollections(e, t) {
		let n = Object.entries(this.compiledAliasToCollectionId);
		if (n.length === 0) throw Error(`Compiler returned no alias metadata for query '${this.id}'. This should not happen; please report.`);
		let r = n.map(([n, r]) => {
			let i = this.collectionByAlias[n] ?? this.collections[r], a = Rt(i);
			a && a !== this ? (this.aliasDependencies[n] = [a], this.builderDependencies.add(a)) : this.aliasDependencies[n] = [];
			let o = new Mt(n, r, i, this), s = i.on("status:change", (t) => {
				this.handleSourceStatusChange(e, r, t);
			});
			t.unsubscribeCallbacks.add(s);
			let c = o.subscribe();
			return this.subscriptions[n] = c, o.loadMoreIfNeeded.bind(o, c);
		});
		return t.subscribedToAllCollections = !0, () => (r.map((e) => e()), !0);
	}
};
function Vt(e) {
	return typeof e.query == "function" ? ze(e.query) : Be(e.query);
}
function Ht(e) {
	return (t, n) => {
		let r = e.get(t), i = e.get(n);
		return r && i ? r < i ? -1 : +(r > i) : 0;
	};
}
function Ut(e) {
	let t = {};
	function n(e) {
		e.type === "collectionRef" ? t[e.collection.id] = e.collection : e.type === "queryRef" && r(e.query);
	}
	function r(e) {
		if (e.from && n(e.from), e.join && Array.isArray(e.join)) for (let t of e.join) t.from && n(t.from);
	}
	return r(e), t;
}
function Wt(e) {
	let t = e.from;
	if (t.type === "collectionRef") return t.collection;
	if (t.type === "queryRef") return Wt(t.query);
	throw Error(`Failed to extract collection. Invalid FROM clause: ${JSON.stringify(e)}`);
}
function Gt(e) {
	let t = /* @__PURE__ */ new Map();
	function n(e) {
		if (e) {
			if (e.type === "collectionRef") {
				let { id: n } = e.collection, r = t.get(n);
				r ? r.add(e.alias) : t.set(n, /* @__PURE__ */ new Set([e.alias]));
			} else e.type === "queryRef" && r(e.query);
		}
	}
	function r(e) {
		if (e && (n(e.from), e.join)) for (let t of e.join) n(t.from);
	}
	return r(e), t;
}
function Kt(e, [[t, n], r]) {
	let [i, a] = n, o = e.get(t) || {
		deletes: 0,
		inserts: 0,
		value: i,
		orderByIndex: a
	};
	return r < 0 ? o.deletes += Math.abs(r) : r > 0 && (o.inserts += r, o.value = i, a !== void 0 && (o.orderByIndex = a)), e.set(t, o), e;
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/live-query-collection.js
function qt(e) {
	return new Bt(e).getConfig();
}
function Jt(e) {
	if (typeof e == "function") return Yt(qt({ query: e }));
	{
		let t = e, n = qt(t);
		return t.utils && (n.utils = {
			...n.utils,
			...t.utils
		}), Yt(n);
	}
}
function Yt(e) {
	let t = ne(e), n = It(e);
	return n && Lt(t, n), t;
}
// node_modules/.bun/@tanstack+react-db@0.1.76+3426087f8fb19ed8/node_modules/@tanstack/react-db/dist/esm/useLiveQuery.js
var $ = 1;
function Xt(e, t = []) {
	let n = e && typeof e == "object" && typeof e.subscribeChanges == "function" && typeof e.startSyncImmediate == "function" && typeof e.id == "string", r = W(null), i = W(null), a = W(null), o = W(0), s = W(null), c = !r.current || n && a.current !== e || !n && (i.current === null || i.current.length !== t.length || i.current.some((e, n) => e !== t[n]));
	if (c) {
		if (n) e.config?.syncMode === "on-demand" && console.warn("[useLiveQuery] Warning: Passing a collection with syncMode \"on-demand\" directly to useLiveQuery will not load any data. In on-demand mode, data is only loaded when queries with predicates request it.\n\nInstead, use a query builder function:\n  const { data } = useLiveQuery((q) => q.from({ c: myCollection }).select(({ c }) => c))\n\nOr switch to syncMode \"eager\" if you want all data to sync automatically."), e.startSyncImmediate(), r.current = e, a.current = e;
		else if (typeof e == "function") {
			let n = e(new G());
			if (n == null) r.current = null;
			else if (n instanceof be) n.startSyncImmediate(), r.current = n;
			else if (n instanceof G) r.current = Jt({
				query: e,
				startSync: !0,
				gcTime: $
			});
			else if (n && typeof n == "object") r.current = Jt({
				startSync: !0,
				gcTime: $,
				...n
			});
			else throw Error(`useLiveQuery callback must return a QueryBuilder, LiveQueryCollectionConfig, Collection, undefined, or null. Got: ${typeof n}`);
			i.current = [...t];
		} else r.current = Jt({
			startSync: !0,
			gcTime: $,
			...e
		}), i.current = [...t];
	}
	c && (o.current = 0, s.current = null);
	let l = W(null);
	(!l.current || c) && (l.current = (e) => {
		if (!r.current) return () => {};
		let t = r.current.subscribeChanges(() => {
			o.current += 1, e();
		});
		return r.current.status === "ready" && (o.current += 1, e()), () => {
			t.unsubscribe();
		};
	});
	let u = W(null);
	(!u.current || c) && (u.current = () => {
		let e = o.current, t = r.current;
		return s.current && s.current.version === e && s.current.collection === t || (s.current = {
			collection: t,
			version: e
		}), s.current;
	});
	let d = Ee(l.current, u.current), f = W(null), p = W(null);
	if (!f.current || f.current.version !== d.version || f.current.collection !== d.collection) {
		if (!d.collection) p.current = {
			state: void 0,
			data: void 0,
			collection: void 0,
			status: "disabled",
			isLoading: !1,
			isReady: !0,
			isIdle: !1,
			isError: !1,
			isCleanedUp: !1,
			isEnabled: !1
		};
		else {
			let e = Array.from(d.collection.entries()), t = d.collection.config.singleResult, n = null, r = null;
			p.current = {
				get state() {
					return n ||= new Map(e), n;
				},
				get data() {
					return r ||= e.map(([, e]) => e), t ? r[0] : r;
				},
				collection: d.collection,
				status: d.collection.status,
				isLoading: d.collection.status === "loading",
				isReady: d.collection.status === "ready",
				isIdle: d.collection.status === "idle",
				isError: d.collection.status === "error",
				isCleanedUp: d.collection.status === "cleaned-up",
				isEnabled: !0
			};
		}
		f.current = d;
	}
	return p.current;
}
// packages/pstdio-dashboard/src/shared/projects/project-query-loading-state.ts
var Zt = (e) => {
	let { projectId: t, rawProject: n, isProjectLoading: r } = e;
	return r ? !0 : t ? n === void 0 : !1;
}, Qt = (e) => {
	let { data: t, isLoading: n } = Xt((t) => e ? t.from({ p: ue("projects") }).where(({ p: t }) => Ce(t.id, e)).select(({ p: e }) => ({ ...e })) : void 0, [e]), r = ve(t), i = Zt({
		projectId: e,
		rawProject: t,
		isProjectLoading: n
	}), a = r?.[0];
	return !e || !a ? {
		data: void 0,
		isLoading: i
	} : {
		data: {
			id: a.id,
			name: a.name,
			shorthand: a.shorthand,
			default_agent_id: a.default_agent_id ?? null,
			default_agent_model: a.default_agent_model ?? null,
			startup_script: a.startup_script ?? null,
			created_at: a.created_at,
			updated_at: a.updated_at,
			deleted_at: a.deleted_at ?? null
		},
		isLoading: i
	};
};
export { Xt as n, Qt as t };
