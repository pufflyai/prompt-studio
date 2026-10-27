// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./api-D3Fkqs7r.ts";
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/ir.js
var t = class {}, n = class extends t {
	constructor(e, t) {
		super(), this.collection = e, this.alias = t, this.type = "collectionRef";
	}
}, r = class extends t {
	constructor(e, t) {
		super(), this.query = e, this.alias = t, this.type = "queryRef";
	}
}, i = class extends t {
	constructor(e) {
		super(), this.path = e, this.type = "ref";
	}
}, a = class extends t {
	constructor(e) {
		super(), this.value = e, this.type = "val";
	}
}, o = class extends t {
	constructor(e, t) {
		super(), this.name = e, this.args = t, this.type = "func";
	}
}, s = class extends t {
	constructor(e, t) {
		super(), this.name = e, this.args = t, this.type = "agg";
	}
};
function c(e) {
	return e instanceof s || e instanceof o || e instanceof i || e instanceof a;
}
function l(e) {
	return typeof e == "object" && "expression" in e ? e.expression : e;
}
function u(e) {
	return typeof e == "object" && "expression" in e ? e.expression : e;
}
function d(e) {
	return typeof e == "object" && "expression" in e && e.residual === !0;
}
function f(e) {
	return {
		expression: e,
		residual: !0
	};
}
function p(e, t) {
	if (e.from.alias === t) return e.from;
	for (let n of e.join || []) if (n.from.alias === t) return n.from;
}
function m(e, t, n) {
	if (t.path.length !== 0) {
		if (t.path.length === 1) {
			let r = t.path[0];
			if (e.select) {
				let t = e.select[r];
				if (t && t.type === "ref") return m(e, t, n);
			}
			return {
				collection: n,
				path: [r]
			};
		}
		if (t.path.length > 1) {
			let [r, ...a] = t.path, o = p(e, r);
			return o ? o.type === "queryRef" ? m(o.query, new i(a), n) : {
				collection: o.collection,
				path: a
			} : void 0;
		}
	}
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/errors.js
var h = class extends Error {
	constructor(e) {
		super(e), this.name = "TanStackDBError";
	}
}, g = class extends h {
	constructor(e, t, n) {
		let r = `${e === "insert" ? "Insert" : "Update"} validation failed: ${t.map((e) => `
- ${e.message} - path: ${e.path}`).join("")}`;
		super(n || r), this.name = "SchemaValidationError", this.type = e, this.issues = t;
	}
}, _ = class extends h {
	constructor(e) {
		super(e), this.name = "CollectionConfigurationError";
	}
}, v = class extends _ {
	constructor() {
		super("Collection requires a config");
	}
}, y = class extends _ {
	constructor() {
		super("Collection requires a sync config");
	}
}, ee = class extends _ {
	constructor() {
		super("Schema must implement the standard-schema interface");
	}
}, te = class extends _ {
	constructor() {
		super("Schema validation must be synchronous");
	}
}, b = class extends h {
	constructor(e) {
		super(e), this.name = "CollectionStateError";
	}
}, ne = class extends b {
	constructor(e, t) {
		super(`Cannot perform ${e} on collection "${t}" - collection is in error state. Try calling cleanup() and restarting the collection.`);
	}
}, re = class extends b {
	constructor(e, t, n) {
		super(`Invalid collection status transition from "${e}" to "${t}" for collection "${n}"`);
	}
}, ie = class extends b {
	constructor() {
		super("Collection is in error state");
	}
}, ae = class extends b {
	constructor() {
		super("Active subscribers count is negative - this should never happen");
	}
}, x = class extends h {
	constructor(e) {
		super(e), this.name = "CollectionOperationError";
	}
}, oe = class extends x {
	constructor(e) {
		super(`An object was created without a defined key: ${JSON.stringify(e)}`);
	}
}, se = class extends x {
	constructor(e, t) {
		super(`getKey returned an invalid key type. Expected string or number, but got ${e === null ? "null" : typeof e}: ${JSON.stringify(e)}. Item: ${JSON.stringify(t)}`);
	}
}, ce = class extends x {
	constructor(e) {
		super(`Cannot insert document with ID "${e}" because it already exists in the collection`);
	}
}, le = class extends x {
	constructor(e, t, n) {
		let r = `Cannot insert document with key "${e}" from sync because it already exists in the collection "${t}"`;
		n?.hasCustomGetKey && n.hasDistinct ? super(`${r}. This collection uses a custom getKey with .distinct(). The .distinct() operator deduplicates by the ENTIRE selected object (standard SQL behavior), but your custom getKey extracts only a subset of fields. This causes multiple distinct rows (with different values in non-key fields) to receive the same key. To fix this, either: (1) ensure your SELECT only includes fields that uniquely identify each row, (2) use .groupBy() with min()/max() aggregates to select one value per group, or (3) remove the custom getKey to use the default key behavior.`) : n?.hasCustomGetKey && n.hasJoins ? super(`${r}. This collection uses a custom getKey with joined queries. Joined queries can produce multiple rows with the same key when relationships are not 1:1. Consider: (1) using a composite key in your getKey function (e.g., \`\${item.key1}-\${item.key2}\`), (2) ensuring your join produces unique rows per key, or (3) removing the custom getKey to use the default composite key behavior.`) : super(r);
	}
}, ue = class extends x {
	constructor() {
		super("The first argument to update is missing");
	}
}, de = class extends x {
	constructor() {
		super("No keys were passed to update");
	}
}, fe = class extends x {
	constructor(e) {
		super(`The key "${e}" was passed to update but an object for this key was not found in the collection`);
	}
}, pe = class extends x {
	constructor(e, t) {
		super(`Updating the key of an item is not allowed. Original key: "${e}", Attempted new key: "${t}". Please delete the old item and create a new one if a key change is necessary.`);
	}
}, me = class extends x {
	constructor() {
		super("No keys were passed to delete");
	}
}, he = class extends x {
	constructor(e) {
		super(`Collection.delete was called with key '${e}' but there is no item in the collection with this key`);
	}
}, ge = class extends h {
	constructor(e) {
		super(e), this.name = "MissingHandlerError";
	}
}, _e = class extends ge {
	constructor() {
		super("Collection.insert called directly (not within an explicit transaction) but no 'onInsert' handler is configured.");
	}
}, ve = class extends ge {
	constructor() {
		super("Collection.update called directly (not within an explicit transaction) but no 'onUpdate' handler is configured.");
	}
}, ye = class extends ge {
	constructor() {
		super("Collection.delete called directly (not within an explicit transaction) but no 'onDelete' handler is configured.");
	}
}, S = class extends h {
	constructor(e) {
		super(e), this.name = "TransactionError";
	}
}, be = class extends S {
	constructor() {
		super("mutationFn is required when creating a transaction");
	}
}, xe = class extends S {
	constructor() {
		super("You can no longer call .mutate() as the transaction is no longer pending");
	}
}, Se = class extends S {
	constructor() {
		super("You can no longer call .rollback() as the transaction is already completed");
	}
}, Ce = class extends S {
	constructor() {
		super("You can no longer call .commit() as the transaction is no longer pending");
	}
}, we = class extends S {
	constructor() {
		super("No pending sync transaction to write to");
	}
}, Te = class extends S {
	constructor() {
		super("The pending sync transaction is already committed, you can't still write to it.");
	}
}, Ee = class extends S {
	constructor() {
		super("No pending sync transaction to commit");
	}
}, De = class extends S {
	constructor() {
		super("The pending sync transaction is already committed, you can't commit it again.");
	}
}, C = class extends h {
	constructor(e) {
		super(e), this.name = "QueryBuilderError";
	}
}, Oe = class extends C {
	constructor(e) {
		super(`Only one source is allowed in the ${e}`);
	}
}, ke = class extends C {
	constructor(e) {
		super(`A sub query passed to a ${e} must have a from clause itself`);
	}
}, Ae = class extends C {
	constructor(e) {
		super(`Invalid source for live query: The value provided for alias "${e}" is not a Collection or subquery. Live queries only accept Collection instances or subqueries. Please ensure you're passing a valid Collection or QueryBuilder, not a plain array or other data type.`);
	}
}, je = class extends C {
	constructor(e, t) {
		super(`Invalid source for ${e}: Expected an object with a single key-value pair like { alias: collection }. For example: .from({ todos: todosCollection }). Got: ${t}`);
	}
}, Me = class extends C {
	constructor() {
		super("Join condition must be an equality expression");
	}
}, Ne = class extends C {
	constructor() {
		super("Query must have a from clause");
	}
}, Pe = class extends C {
	constructor(e) {
		super(`Invalid where() expression: Expected a query expression, but received a ${e}. This usually happens when using JavaScript's comparison operators (===, !==, <, >, etc.) directly. Instead, use the query builder functions:

  ❌ .where(({ user }) => user.id === 'abc')
  ✅ .where(({ user }) => eq(user.id, 'abc'))

Available comparison functions: eq, gt, gte, lt, lte, and, or, not, like, ilike, isNull, isUndefined`);
	}
}, w = class extends h {
	constructor(e) {
		super(e), this.name = "QueryCompilationError";
	}
}, Fe = class extends w {
	constructor() {
		super("DISTINCT requires a SELECT clause.");
	}
}, Ie = class extends w {
	constructor() {
		super("fn.select() cannot be used with groupBy(). groupBy requires the compiler to statically analyze aggregate functions (count, sum, max, etc.) in the SELECT clause, which is not possible with fn.select() since it is an opaque function. Use .select() instead of .fn.select() when combining with groupBy().");
	}
}, Le = class extends w {
	constructor() {
		super("HAVING clause requires GROUP BY clause");
	}
}, Re = class extends w {
	constructor() {
		super("LIMIT and OFFSET require an ORDER BY clause to ensure deterministic results");
	}
}, ze = class extends w {
	constructor(e, t, n) {
		let r = t ? `alias "${e}" (collection "${t}")` : `collection "${e}"`, i = n?.length ? `. Available keys: ${n.join(", ")}` : "";
		super(`Input for ${r} not found in inputs map${i}`);
	}
}, Be = class extends w {
	constructor(e, t) {
		super(`Subquery uses alias "${e}" which is already used in the parent query. Each alias must be unique across parent and subquery contexts. Parent query aliases: ${t.join(", ")}. Please rename "${e}" in either the parent query or subquery to avoid conflicts.`);
	}
}, Ve = class extends w {
	constructor(e) {
		super(`Unsupported FROM type: ${e}`);
	}
}, He = class extends w {
	constructor(e) {
		super(`Unknown expression type: ${e}`);
	}
}, Ue = class extends w {
	constructor() {
		super("Reference path cannot be empty");
	}
}, We = class extends w {
	constructor(e) {
		super(`Unknown function: ${e}`);
	}
}, Ge = class extends w {
	constructor(e) {
		super(`Collection "${e}" not found during compilation of join`);
	}
}, T = class extends h {
	constructor(e) {
		super(e), this.name = "JoinError";
	}
}, Ke = class extends T {
	constructor(e) {
		super(`Unsupported join type: ${e}`);
	}
}, qe = class extends T {
	constructor(e) {
		super(`Invalid join condition: both expressions refer to the same source "${e}"`);
	}
}, Je = class extends T {
	constructor() {
		super("Invalid join condition: expressions must reference source aliases");
	}
}, Ye = class extends T {
	constructor(e) {
		super(`Invalid join condition: left expression refers to an unavailable source "${e}"`);
	}
}, Xe = class extends T {
	constructor(e) {
		super(`Invalid join condition: right expression does not refer to the joined source "${e}"`);
	}
}, Ze = class extends T {
	constructor() {
		super("Invalid join condition");
	}
}, Qe = class extends T {
	constructor(e) {
		super(`Unsupported join source type: ${e}`);
	}
}, $e = class extends h {
	constructor(e) {
		super(e), this.name = "GroupByError";
	}
}, et = class extends $e {
	constructor(e) {
		super(`Non-aggregate expression '${e}' in SELECT must also appear in GROUP BY clause`);
	}
}, tt = class extends $e {
	constructor(e) {
		super(`Unsupported aggregate function: ${e}`);
	}
}, nt = class extends $e {
	constructor(e) {
		super(`Aggregate function in HAVING clause must also be in SELECT clause: ${e}`);
	}
}, rt = class extends $e {
	constructor(e) {
		super(`Unknown expression type in HAVING clause: ${e}`);
	}
}, it = class extends h {
	constructor(e, t) {
		let n = t instanceof Error ? t.message : String(t);
		super(`Collection "${e}" sync cleanup function threw an error: ${n}`), this.name = "SyncCleanupError";
	}
}, at = class extends h {
	constructor(e) {
		super(e), this.name = "QueryOptimizerError";
	}
}, ot = class extends at {
	constructor() {
		super("Cannot combine empty expression list");
	}
}, st = class extends w {
	constructor(e, t, n, r) {
		super(`Internal error: subscription for alias '${e}' (remapped from '${t}', collection '${n}') is missing in join pipeline. Available aliases: ${r.join(", ")}. This indicates a bug in alias tracking.`);
	}
}, ct = class extends w {
	constructor(e) {
		super(`Internal error: compiler returned aliases without inputs: ${e.join(", ")}. This indicates a bug in query compilation. Please report this issue.`);
	}
}, lt = class extends w {
	constructor() {
		super("setWindow() can only be called on collections with an ORDER BY clause. Add .orderBy() to your query to enable window movement.");
	}
}, ut = /* @__PURE__ */ new WeakMap(), dt = 1;
function ft(e) {
	if (ut.has(e)) return ut.get(e);
	let t = dt++;
	return ut.set(e, t), t;
}
var pt = (e, t, n) => {
	let { nulls: r } = n;
	if (e == null && t == null) return 0;
	if (e == null) return r === "first" ? -1 : 1;
	if (t == null) return r === "first" ? 1 : -1;
	if (typeof e == "string" && typeof t == "string" && n.stringSort === "locale") return e.localeCompare(t, n.locale, n.localeOptions);
	if (Array.isArray(e) && Array.isArray(t)) {
		for (let r = 0; r < Math.min(e.length, t.length); r++) {
			let i = pt(e[r], t[r], n);
			if (i !== 0) return i;
		}
		return e.length - t.length;
	}
	if (e instanceof Date && t instanceof Date) return e.getTime() - t.getTime();
	let i = typeof e == "object", a = typeof t == "object";
	if (i || a) {
		if (i && a) return ft(e) - ft(t);
		if (i) return 1;
		if (a) return -1;
	}
	return e < t ? -1 : +(e > t);
}, mt = (e, t, n) => pt(t, e, {
	...n,
	nulls: n.nulls === "first" ? "last" : "first"
});
function ht(e) {
	return (t, n) => e.direction === "asc" ? pt(t, n, e) : mt(t, n, e);
}
var gt = ht({
	direction: "asc",
	nulls: "first",
	stringSort: "locale"
});
function _t(e, t) {
	if (e.byteLength !== t.byteLength) return !1;
	for (let n = 0; n < e.byteLength; n++) if (e[n] !== t[n]) return !1;
	return !0;
}
var vt = 128, yt = "__TS_DB_BTREE_UNDEFINED_VALUE__";
function E(e) {
	return e instanceof Date ? e.getTime() : (typeof Buffer < "u" && e instanceof Buffer || e instanceof Uint8Array) && e.byteLength <= vt ? `__u8__${Array.from(e).join(",")}` : e;
}
function D(e) {
	return e === void 0 ? yt : E(e);
}
function O(e) {
	if (e !== "__TS_DB_BTREE_UNDEFINED_VALUE__") return e;
}
function bt(e, t) {
	if (e === t) return !0;
	let n = typeof Buffer < "u" && e instanceof Buffer || e instanceof Uint8Array, r = typeof Buffer < "u" && t instanceof Buffer || t instanceof Uint8Array;
	return n && r ? _t(e, t) : !1;
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/compiler/evaluators.js
function k(e) {
	return e == null;
}
function xt(e) {
	return e === !0;
}
function A(e, t = !1) {
	return Ct(e, t);
}
function St(e) {
	return Ct(e, !0);
}
function Ct(e, t) {
	switch (e.type) {
		case "val": {
			let t = e.value;
			return () => t;
		}
		case "ref": return t ? Tt(e) : wt(e);
		case "func": return Et(e, t);
		default: throw new He(e.type);
	}
}
function wt(e) {
	let [t, ...n] = e.path;
	if (!t) throw new Ue();
	if (t === "$selected") {
		if (n.length === 0) return (e) => e.$selected;
		if (n.length === 1) {
			let e = n[0];
			return (t) => t.$selected?.[e];
		}
		return (e) => {
			let t = e.$selected;
			if (t === void 0) return;
			let r = t;
			for (let e of n) {
				if (r == null) return r;
				r = r[e];
			}
			return r;
		};
	}
	let r = t;
	if (n.length === 0) return (e) => e[r];
	if (n.length === 1) {
		let e = n[0];
		return (t) => t[r]?.[e];
	}
	return (e) => {
		let t = e[r];
		if (t === void 0) return;
		let i = t;
		for (let e of n) {
			if (i == null) return i;
			i = i[e];
		}
		return i;
	};
}
function Tt(e) {
	let t = e.path;
	return (e) => {
		let n = e;
		for (let e of t) {
			if (n == null) return n;
			n = n[e];
		}
		return n;
	};
}
function Et(e, t) {
	let n = e.args.map((e) => Ct(e, t));
	switch (e.name) {
		case "eq": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = E(e(n)), i = E(t(n));
				return k(r) || k(i) ? null : bt(r, i);
			};
		}
		case "gt": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return k(r) || k(i) ? null : r > i;
			};
		}
		case "gte": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return k(r) || k(i) ? null : r >= i;
			};
		}
		case "lt": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return k(r) || k(i) ? null : r < i;
			};
		}
		case "lte": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return k(r) || k(i) ? null : r <= i;
			};
		}
		case "and": return (e) => {
			let t = !1;
			for (let r of n) {
				let n = r(e);
				if (n === !1) return !1;
				k(n) && (t = !0);
			}
			return !t || null;
		};
		case "or": return (e) => {
			let t = !1;
			for (let r of n) {
				let n = r(e);
				if (n === !0) return !0;
				k(n) && (t = !0);
			}
			return t ? null : !1;
		};
		case "not": {
			let e = n[0];
			return (t) => {
				let n = e(t);
				return k(n) ? null : !n;
			};
		}
		case "in": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = E(e(n)), i = t(n);
				return k(r) ? null : Array.isArray(i) ? i.some((e) => E(e) === r) : !1;
			};
		}
		case "like": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return k(r) || k(i) ? null : Dt(r, i, !1);
			};
		}
		case "ilike": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return k(r) || k(i) ? null : Dt(r, i, !0);
			};
		}
		case "upper": {
			let e = n[0];
			return (t) => {
				let n = e(t);
				return typeof n == "string" ? n.toUpperCase() : n;
			};
		}
		case "lower": {
			let e = n[0];
			return (t) => {
				let n = e(t);
				return typeof n == "string" ? n.toLowerCase() : n;
			};
		}
		case "length": {
			let e = n[0];
			return (t) => {
				let n = e(t);
				return typeof n == "string" || Array.isArray(n) ? n.length : 0;
			};
		}
		case "concat": return (e) => n.map((t) => {
			let n = t(e);
			try {
				return String(n ?? "");
			} catch {
				try {
					return JSON.stringify(n) || "";
				} catch {
					return "[object]";
				}
			}
		}).join("");
		case "coalesce": return (e) => {
			for (let t of n) {
				let n = t(e);
				if (n != null) return n;
			}
			return null;
		};
		case "add": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return (r ?? 0) + (i ?? 0);
			};
		}
		case "subtract": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return (r ?? 0) - (i ?? 0);
			};
		}
		case "multiply": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n);
				return (r ?? 0) * (i ?? 0);
			};
		}
		case "divide": {
			let e = n[0], t = n[1];
			return (n) => {
				let r = e(n), i = t(n) ?? 0;
				return i === 0 ? null : (r ?? 0) / i;
			};
		}
		case "isUndefined": {
			let e = n[0];
			return (t) => e(t) === void 0;
		}
		case "isNull": {
			let e = n[0];
			return (t) => e(t) === null;
		}
		default: throw new We(e.name);
	}
}
function Dt(e, t, n) {
	if (typeof e != "string" || typeof t != "string") return !1;
	let r = n ? e.toLowerCase() : e, i = (n ? t.toLowerCase() : t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return i = i.replace(/%/g, ".*"), i = i.replace(/_/g, "."), RegExp(`^${i}$`, "s").test(r);
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/utils.js
function j(e, t) {
	return Ot(e, t, /* @__PURE__ */ new Map());
}
function Ot(e, t, n) {
	if (e === t) return !0;
	if (e == null || t == null || typeof e != typeof t) return !1;
	if (e instanceof Date) return t instanceof Date && e.getTime() === t.getTime();
	if (t instanceof Date) return !1;
	if (e instanceof RegExp) return t instanceof RegExp && e.source === t.source && e.flags === t.flags;
	if (t instanceof RegExp) return !1;
	if (e instanceof Map) {
		if (!(t instanceof Map) || e.size !== t.size) return !1;
		if (n.has(e)) return n.get(e) === t;
		n.set(e, t);
		let r = Array.from(e.entries()).every(([e, r]) => t.has(e) && Ot(r, t.get(e), n));
		return n.delete(e), r;
	}
	if (t instanceof Map) return !1;
	if (e instanceof Set) {
		if (!(t instanceof Set) || e.size !== t.size) return !1;
		if (n.has(e)) return n.get(e) === t;
		n.set(e, t);
		let r = Array.from(e), i = Array.from(t);
		if (r.every((e) => typeof e != "object")) return n.delete(e), r.every((e) => t.has(e));
		let a = r.length === i.length;
		return n.delete(e), a;
	}
	if (t instanceof Set) return !1;
	if (ArrayBuffer.isView(e) && ArrayBuffer.isView(t) && !(e instanceof DataView) && !(t instanceof DataView)) {
		let n = e, r = t;
		if (n.length !== r.length) return !1;
		for (let e = 0; e < n.length; e++) if (n[e] !== r[e]) return !1;
		return !0;
	}
	if (ArrayBuffer.isView(t) && !(t instanceof DataView) && !ArrayBuffer.isView(e)) return !1;
	if (M(e) && M(t)) return At(e) === At(t) ? typeof e.equals == "function" ? e.equals(t) : e.toString() === t.toString() : !1;
	if (M(t)) return !1;
	if (Array.isArray(e)) {
		if (!Array.isArray(t) || e.length !== t.length) return !1;
		if (n.has(e)) return n.get(e) === t;
		n.set(e, t);
		let r = e.every((e, r) => Ot(e, t[r], n));
		return n.delete(e), r;
	}
	if (Array.isArray(t)) return !1;
	if (typeof e == "object") {
		if (n.has(e)) return n.get(e) === t;
		n.set(e, t);
		let r = Object.keys(e), i = Object.keys(t);
		if (r.length !== i.length) return n.delete(e), !1;
		let a = r.every((r) => r in t && Ot(e[r], t[r], n));
		return n.delete(e), a;
	}
	return !1;
}
var kt = [
	"Temporal.Duration",
	"Temporal.Instant",
	"Temporal.PlainDate",
	"Temporal.PlainDateTime",
	"Temporal.PlainMonthDay",
	"Temporal.PlainTime",
	"Temporal.PlainYearMonth",
	"Temporal.ZonedDateTime"
];
function At(e) {
	return e[Symbol.toStringTag];
}
function M(e) {
	let t = At(e);
	return typeof t == "string" && kt.includes(t);
}
var jt = {
	direction: "asc",
	nulls: "first",
	stringSort: "locale"
}, Mt = class {
	constructor(e) {
		this.originalIndex = e;
	}
	lookup(e, t) {
		let n = e === "gt" ? "lt" : e === "gte" ? "lte" : e === "lt" ? "gt" : e === "lte" ? "gte" : e;
		return this.originalIndex.lookup(n, t);
	}
	rangeQuery(e = {}) {
		return this.originalIndex.rangeQueryReversed(e);
	}
	rangeQueryReversed(e = {}) {
		return this.originalIndex.rangeQuery(e);
	}
	take(e, t, n) {
		return this.originalIndex.takeReversed(e, t, n);
	}
	takeFromStart(e, t) {
		return this.originalIndex.takeReversedFromEnd(e, t);
	}
	takeReversed(e, t, n) {
		return this.originalIndex.take(e, t, n);
	}
	takeReversedFromEnd(e, t) {
		return this.originalIndex.takeFromStart(e, t);
	}
	get orderedEntriesArray() {
		return this.originalIndex.orderedEntriesArrayReversed;
	}
	get orderedEntriesArrayReversed() {
		return this.originalIndex.orderedEntriesArray;
	}
	supports(e) {
		return this.originalIndex.supports(e);
	}
	matchesField(e) {
		return this.originalIndex.matchesField(e);
	}
	matchesCompareOptions(e) {
		return this.originalIndex.matchesCompareOptions(e);
	}
	matchesDirection(e) {
		return this.originalIndex.matchesDirection(e);
	}
	getStats() {
		return this.originalIndex.getStats();
	}
	add(e, t) {
		this.originalIndex.add(e, t);
	}
	remove(e, t) {
		this.originalIndex.remove(e, t);
	}
	update(e, t, n) {
		this.originalIndex.update(e, t, n);
	}
	build(e) {
		this.originalIndex.build(e);
	}
	clear() {
		this.originalIndex.clear();
	}
	get keyCount() {
		return this.originalIndex.keyCount;
	}
	equalityLookup(e) {
		return this.originalIndex.equalityLookup(e);
	}
	inArrayLookup(e) {
		return this.originalIndex.inArrayLookup(e);
	}
	get indexedKeysSet() {
		return this.originalIndex.indexedKeysSet;
	}
	get valueMapData() {
		return this.originalIndex.valueMapData;
	}
};
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/utils/index-optimization.js
function Nt(e, t, n) {
	let r = n ?? {
		...jt,
		...e.compareOptions
	};
	for (let n of e.indexes.values()) if (n.matchesField(t) && n.matchesCompareOptions(r)) return n.matchesDirection(r.direction) ? n : new Mt(n);
}
function Pt(e) {
	if (e.length === 0) return /* @__PURE__ */ new Set();
	if (e.length === 1) return new Set(e[0]);
	let t = new Set(e[0]);
	for (let n = 1; n < e.length; n++) {
		let r = /* @__PURE__ */ new Set();
		for (let i of t) e[n].has(i) && r.add(i);
		t = r;
	}
	return t;
}
function Ft(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e) for (let e of n) t.add(e);
	return t;
}
function It(e, t) {
	return Lt(e, t);
}
function Lt(e, t) {
	if (e.type === "func") switch (e.name) {
		case "eq":
		case "gt":
		case "gte":
		case "lt":
		case "lte": return zt(e, t);
		case "and": return Bt(e, t);
		case "or": return Vt(e, t);
		case "in": return Ht(e, t);
	}
	return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
}
function Rt(e, t) {
	if (e.type !== "func" || e.args.length < 2) return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
	let n = /* @__PURE__ */ new Map();
	for (let t of e.args) if (t.type === "func" && [
		"gt",
		"gte",
		"lt",
		"lte"
	].includes(t.name)) {
		let e = t;
		if (e.args.length === 2) {
			let t = e.args[0], r = e.args[1], i = null, a = null, o = e.name;
			if (t.type === "ref" && r.type === "val") i = t, a = r;
			else if (t.type === "val" && r.type === "ref") switch (i = r, a = t, o) {
				case "gt":
					o = "lt";
					break;
				case "gte":
					o = "lte";
					break;
				case "lt":
					o = "gt";
					break;
				case "lte": o = "gte";
			}
			if (i && a) {
				let e = i.path.join("."), t = a.value;
				n.has(e) || n.set(e, []), n.get(e).push({
					operation: o,
					value: t
				});
			}
		}
	}
	for (let [e, r] of n) if (r.length >= 2) {
		let n = Nt(t, e.split("."));
		if (n && n.supports("gt") && n.supports("lt")) {
			let e, t, i = !0, a = !0;
			for (let { operation: n, value: o } of r) switch (n) {
				case "gt":
					(e === void 0 || o > e) && (e = o, i = !1);
					break;
				case "gte":
					(e === void 0 || o > e) && (e = o, i = !0);
					break;
				case "lt":
					(t === void 0 || o < t) && (t = o, a = !1);
					break;
				case "lte": (t === void 0 || o < t) && (t = o, a = !0);
			}
			return {
				canOptimize: !0,
				matchingKeys: n.rangeQuery({
					from: e,
					to: t,
					fromInclusive: i,
					toInclusive: a
				})
			};
		}
	}
	return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
}
function zt(e, t) {
	if (e.type !== "func" || e.args.length !== 2) return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
	let n = e.args[0], r = e.args[1], i = null, a = null, o = e.name;
	if (n.type === "ref" && r.type === "val") i = n, a = r;
	else if (n.type === "val" && r.type === "ref") switch (i = r, a = n, o) {
		case "gt":
			o = "lt";
			break;
		case "gte":
			o = "lte";
			break;
		case "lt":
			o = "gt";
			break;
		case "lte": o = "gte";
	}
	if (i && a) {
		let e = i.path, n = Nt(t, e);
		if (n) {
			let e = a.value, t = o;
			return n.supports(t) ? {
				canOptimize: !0,
				matchingKeys: n.lookup(t, e)
			} : {
				canOptimize: !1,
				matchingKeys: /* @__PURE__ */ new Set()
			};
		}
	}
	return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
}
function Bt(e, t) {
	if (e.type !== "func" || e.args.length < 2) return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
	let n = Rt(e, t);
	if (n.canOptimize) return n;
	let r = [];
	for (let n of e.args) {
		let e = Lt(n, t);
		e.canOptimize && r.push(e);
	}
	return r.length > 0 ? {
		canOptimize: !0,
		matchingKeys: Pt(r.map((e) => e.matchingKeys))
	} : {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
}
function Vt(e, t) {
	if (e.type !== "func" || e.args.length < 2) return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
	let n = [];
	for (let r of e.args) {
		let e = Lt(r, t);
		e.canOptimize && n.push(e);
	}
	return n.length > 0 ? {
		canOptimize: !0,
		matchingKeys: Ft(n.map((e) => e.matchingKeys))
	} : {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
}
function Ht(e, t) {
	if (e.type !== "func" || e.args.length !== 2) return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
	let n = e.args[0], r = e.args[1];
	if (n.type === "ref" && r.type === "val" && Array.isArray(r.value)) {
		let e = n.path, i = r.value, a = Nt(t, e);
		if (a) {
			if (a.supports("in")) return {
				canOptimize: !0,
				matchingKeys: a.lookup("in", i)
			};
			if (a.supports("eq")) {
				let e = /* @__PURE__ */ new Set();
				for (let t of i) {
					let n = a.lookup("eq", t);
					for (let t of n) e.add(t);
				}
				return {
					canOptimize: !0,
					matchingKeys: e
				};
			}
		}
	}
	return {
		canOptimize: !1,
		matchingKeys: /* @__PURE__ */ new Set()
	};
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/utils.js
var Ut = class extends Map {
	constructor(e, t) {
		super(t), this.defaultValue = e;
	}
	get(e) {
		return this.has(e) ? super.get(e) : this.defaultValue();
	}
	update(e, t) {
		let n = t(this.get(e));
		return this.set(e, n), n;
	}
}, Wt = 3e4;
function Gt(e, t) {
	if (t.length <= Wt) e.push(...t);
	else for (let n = 0; n < t.length; n += Wt) {
		let r = t.slice(n, n + Wt);
		e.push(...r);
	}
}
function Kt(e, t, n) {
	let r = 0, i = e.length;
	for (; r < i;) {
		let a = Math.floor((r + i) / 2), o = n(e[a], t);
		if (o < 0) r = a + 1;
		else if (o > 0) i = a;
		else return a;
	}
	return r;
}
var qt = new class {
	constructor() {
		this.objectIds = /* @__PURE__ */ new WeakMap(), this.nextId = 0;
	}
	getId(e) {
		if (typeof e != "object" || !e) {
			let t = String(e), n = 0;
			for (let e = 0; e < t.length; e++) {
				let r = t.charCodeAt(e);
				n = (n << 5) - n + r, n &= n;
			}
			return n;
		}
		return this.objectIds.has(e) || this.objectIds.set(e, this.nextId++), this.objectIds.get(e);
	}
	getStringId(e) {
		return e === null ? "null" : e === void 0 ? "undefined" : typeof e == "object" ? `obj_${this.getId(e)}` : `str_${String(e)}`;
	}
}();
function Jt(e, t) {
	let [n, r] = e, [i, a] = t;
	return {
		onlyInA: [...Yt(n, Math.min(r, i)), ...Yt(Math.max(n, a), r)],
		onlyInB: [...Yt(i, Math.min(a, n)), ...Yt(Math.max(i, r), a)]
	};
}
function Yt(e, t) {
	let n = [];
	for (let r = e; r < t; r++) n.push(r);
	return n;
}
function Xt(e, t) {
	return typeof e == typeof t ? e < t ? -1 : +(e > t) : typeof e == "string" ? -1 : 1;
}
function Zt(e) {
	return JSON.stringify(e, (e, t) => typeof t == "bigint" ? t.toString() : t instanceof Date ? t.toISOString() : t);
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/hashing/murmur.js
var Qt = N(), $t = N(), en = N(), tn = N(), nn = N();
function N() {
	return Math.random() * (2 ** 31 - 1) >>> 0;
}
var rn = /* @__PURE__ */ new ArrayBuffer(8), an = new DataView(rn), P = new Uint8Array(rn), on = class {
	constructor() {
		this.hash = Qt, this.length = 0, this.carry = 0, this.carryBytes = 0;
	}
	_mix(e) {
		e = Math.imul(e, 3432918353), e = e << 15 | e >>> 17, e = Math.imul(e, 461845907), this.hash ^= e, this.hash = this.hash << 13 | this.hash >>> 19, this.hash = Math.imul(this.hash, 5) + 3864292196;
	}
	writeByte(e) {
		this.carry |= (e & 255) << 8 * this.carryBytes, this.carryBytes++, this.length++, this.carryBytes === 4 && (this._mix(this.carry >>> 0), this.carry = 0, this.carryBytes = 0);
	}
	update(e) {
		switch (typeof e) {
			case "symbol": {
				this.update(nn);
				let t = e.description;
				if (!t) return;
				for (let e = 0; e < t.length; e++) {
					let n = t.charCodeAt(e);
					this.writeByte(n & 255), this.writeByte(n >>> 8 & 255);
				}
				return;
			}
			case "string":
				this.update($t);
				for (let t = 0; t < e.length; t++) {
					let n = e.charCodeAt(t);
					this.writeByte(n & 255), this.writeByte(n >>> 8 & 255);
				}
				return;
			case "number":
				an.setFloat64(0, e, !0), this.writeByte(P[0]), this.writeByte(P[1]), this.writeByte(P[2]), this.writeByte(P[3]), this.writeByte(P[4]), this.writeByte(P[5]), this.writeByte(P[6]), this.writeByte(P[7]);
				return;
			case "bigint": {
				let t = e;
				for (t < 0n ? (t = -t, this.update(tn)) : this.update(en); t > 0n;) this.writeByte(Number(t & 255n)), t >>= 8n;
				e === 0n && this.writeByte(0);
				return;
			}
			default: throw TypeError(`Unsupported input type: ${typeof e}`);
		}
	}
	digest() {
		if (this.carryBytes > 0) {
			let e = this.carry >>> 0;
			e = Math.imul(e, 3432918353), e = e << 15 | e >>> 17, e = Math.imul(e, 461845907), this.hash ^= e;
		}
		return this.hash ^= this.length, this.hash ^= this.hash >>> 16, this.hash = Math.imul(this.hash, 2246822507), this.hash ^= this.hash >>> 13, this.hash = Math.imul(this.hash, 3266489909), this.hash ^= this.hash >>> 16, this.hash >>> 0;
	}
}, sn = N(), cn = N(), ln = N(), un = N(), dn = N(), fn = N(), pn = N(), mn = N(), hn = N(), gn = N(), _n = N(), vn = N(), yn = 128, bn = /* @__PURE__ */ new WeakMap();
function F(e) {
	let t = new on();
	return Tn(t, e), t.digest();
}
function xn(e) {
	let t = bn.get(e);
	if (t !== void 0) return t;
	let n;
	if (e instanceof Date) n = Sn(e);
	else if (typeof Buffer < "u" && e instanceof Buffer || e instanceof Uint8Array) {
		if (e.byteLength <= yn) n = Cn(e);
		else return On(e);
	} else if (e instanceof File) return On(e);
	else {
		let t = e, r = mn;
		e instanceof Array && (r = hn), e instanceof Map && (r = gn, t = [...e.entries()]), e instanceof Set && (r = _n, t = [...e.entries()]), n = wn(t, r);
	}
	return bn.set(e, n), n;
}
function Sn(e) {
	let t = new on();
	return t.update(pn), t.update(e.getTime()), t.digest();
}
function Cn(e) {
	let t = new on();
	t.update(vn), t.update(e.byteLength);
	for (let n = 0; n < e.byteLength; n++) t.writeByte(e[n]);
	return t.digest();
}
function wn(e, t) {
	let n = new on();
	n.update(t);
	let r = Object.keys(e);
	r.sort(kn);
	for (let t of r) n.update(dn), n.update(t), Tn(n, e[t]);
	return n.digest();
}
function Tn(e, t) {
	if (t === null) e.update(ln);
	else switch (typeof t) {
		case "undefined":
			e.update(un);
			return;
		case "boolean":
			e.update(t ? sn : cn);
			return;
		case "number":
			e.update(isNaN(t) ? NaN : t === 0 ? 0 : t);
			return;
		case "bigint":
		case "string":
		case "symbol":
			e.update(t);
			return;
		case "object":
			e.update(En(t));
			return;
		case "function":
			e.update(On(t));
			return;
		default: console.warn(`Ignored input during hashing because it is of type ${typeof t} which is not supported`);
	}
}
function En(e) {
	let t = bn.get(e);
	return t === void 0 && (t = xn(e)), t;
}
var Dn = 1;
function On(e) {
	let t = bn.get(e);
	return t === void 0 && (t = Dn ^ fn, Dn++, bn.set(e, t)), t;
}
function kn(e, t) {
	return e.localeCompare(t);
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/multiset.js
var I = class e {
	#e;
	constructor(e = []) {
		this.#e = e;
	}
	toString(e = !1) {
		return `MultiSet(${JSON.stringify(this.#e, null, e ? 2 : void 0)})`;
	}
	toJSON() {
		return JSON.stringify(Array.from(this.getInner()));
	}
	static fromJSON(t) {
		return new e(JSON.parse(t));
	}
	map(t) {
		return new e(this.#e.map(([e, n]) => [t(e), n]));
	}
	filter(t) {
		return new e(this.#e.filter(([e, n]) => t(e)));
	}
	negate() {
		return new e(this.#e.map(([e, t]) => [e, -t]));
	}
	concat(t) {
		let n = [];
		return Gt(n, this.#e), Gt(n, t.getInner()), new e(n);
	}
	consolidate() {
		if (this.#e.length > 0) {
			let e = this.#e[0]?.[0];
			if (Array.isArray(e) && e.length === 2) return this.#t();
		}
		return this.#n();
	}
	#t() {
		let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = (e) => {
			if (e.length !== 2) throw Error("Expected tuple of length 2");
			let [t, n] = e;
			return `${qt.getStringId(t)}|${qt.getStringId(n)}`;
		};
		for (let [e, i] of this.#e) {
			if (!Array.isArray(e) || e.length !== 2) return this.#n();
			let [a, o] = e;
			if (typeof a != "string" && typeof a != "number") return this.#n();
			let s;
			s = Array.isArray(o) && o.length === 2 ? r(o) : qt.getStringId(o);
			let c = a + "|" + s;
			t.set(c, (t.get(c) || 0) + i), n.has(c) || n.set(c, e);
		}
		let i = [];
		for (let [e, r] of t) r !== 0 && i.push([n.get(e), r]);
		return new e(i);
	}
	#n() {
		let t = new Ut(() => 0), n = /* @__PURE__ */ new Map(), r = !1, i = !1, a = !1;
		for (let [e, t] of this.#e) if (typeof e == "string") r = !0;
		else if (typeof e == "number") i = !0;
		else {
			a = !0;
			break;
		}
		let o = a || r && i;
		for (let [e, r] of this.#e) {
			let i = o ? F(e) : e;
			o && !n.has(i) && n.set(i, e), t.update(i, (e) => e + r);
		}
		let s = [];
		for (let [e, r] of t.entries()) if (r !== 0) {
			let t = o ? n.get(e) : e;
			s.push([t, r]);
		}
		return new e(s);
	}
	extend(t) {
		let n = t instanceof e ? t.getInner() : t;
		Gt(this.#e, n);
	}
	add(e, t) {
		t !== 0 && this.#e.push([e, t]);
	}
	getInner() {
		return this.#e;
	}
}, An = class {
	#e;
	constructor(e) {
		this.#e = e;
	}
	drain() {
		let e = [...this.#e].reverse();
		return this.#e.length = 0, e;
	}
	isEmpty() {
		return this.#e.length === 0;
	}
}, L = class {
	#e = [];
	sendData(e) {
		e instanceof I || (e = new I(e));
		for (let t of this.#e) t.unshift(e);
	}
	newReader() {
		let e = [];
		return this.#e.push(e), new An(e);
	}
}, jn = class {
	constructor(e, t, n) {
		this.id = e, this.inputs = t, this.output = n;
	}
	hasPendingWork() {
		return this.inputs.some((e) => !e.isEmpty());
	}
}, R = class extends jn {
	constructor(e, t, n) {
		super(e, [t], n), this.id = e;
	}
	inputMessages() {
		return this.inputs[0].drain();
	}
}, Mn = class extends jn {
	constructor(e, t, n, r) {
		super(e, [t, n], r), this.id = e;
	}
	inputAMessages() {
		return this.inputs[0].drain();
	}
	inputBMessages() {
		return this.inputs[1].drain();
	}
}, Nn = class extends R {
	run() {
		for (let e of this.inputMessages()) this.output.sendData(this.inner(e));
	}
}, Pn = class {
	#e = [];
	#t = 0;
	#n = !1;
	constructor() {}
	#r() {
		if (this.#n) throw Error("Graph already finalized");
	}
	getNextOperatorId() {
		return this.#r(), this.#t++;
	}
	newInput() {
		this.#r();
		let e = new L();
		return new Fn(this, e);
	}
	addOperator(e) {
		this.#r(), this.#e.push(e);
	}
	finalize() {
		this.#r(), this.#n = !0;
	}
	step() {
		if (!this.#n) throw Error("Graph not finalized");
		for (let e of this.#e) e.run();
	}
	pendingWork() {
		return this.#e.some((e) => e.hasPendingWork());
	}
	run() {
		for (; this.pendingWork();) this.step();
	}
}, z = class {
	#e;
	#t;
	constructor(e, t) {
		this.#e = e, this.#t = t;
	}
	connectReader() {
		return this.#t.newReader();
	}
	get writer() {
		return this.#t;
	}
	get graph() {
		return this.#e;
	}
	pipe(...e) {
		return e.reduce((e, t) => t(e), this);
	}
}, Fn = class extends z {
	sendData(e) {
		this.writer.sendData(e);
	}
}, In = class extends Nn {
	#e;
	constructor(e, t, n, r) {
		super(e, t, n), this.#e = r;
	}
	inner(e) {
		return e.map(this.#e);
	}
};
function B(e) {
	return (t) => {
		let n = new z(t.graph, new L()), r = new In(t.graph.getNextOperatorId(), t.connectReader(), n.writer, e);
		return t.graph.addOperator(r), n;
	};
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/indexes.js
var V = /* @__PURE__ */ Symbol("NO_PREFIX"), Ln = class extends Map {
	addValue(e, t) {
		if (t === 0) return this.size === 0;
		let n = U(e), r = this.get(n);
		if (zn(r)) {
			let [i, a] = r;
			if (U(i) !== n) throw Error("Mismatching prefixes, this should never happen");
			if (i === e || F(i) === F(e)) {
				let r = a + t;
				r === 0 ? this.delete(n) : this.set(n, [e, r]);
			} else {
				let a = new H();
				a.set(F(i), r), a.set(F(e), [e, t]), this.set(n, a);
			}
		} else r === void 0 ? this.set(n, [e, t]) : r.addValue(e, t) && this.delete(n);
		return this.size === 0;
	}
}, H = class extends Map {
	addValue(e, t) {
		if (t === 0) return this.size === 0;
		let n = F(e), r = this.get(n);
		if (r) {
			let [, i] = r, a = i + t;
			a === 0 ? this.delete(n) : this.set(n, [e, a]);
		} else this.set(n, [e, t]);
		return this.size === 0;
	}
}, Rn = class e {
	#e;
	#t = /* @__PURE__ */ new Map();
	constructor() {
		this.#e = /* @__PURE__ */ new Map();
	}
	static fromMultiSets(t) {
		let n = new e();
		for (let e of t) for (let [t, r] of e.getInner()) {
			let [e, i] = t;
			n.addValue(e, [i, r]);
		}
		return n;
	}
	toString(e = !1) {
		return `Index(${JSON.stringify([...this.entries()], void 0, e ? 2 : void 0)})`;
	}
	get size() {
		return this.#e.size;
	}
	has(e) {
		return this.#e.has(e);
	}
	hasPresence(e) {
		return (this.#t.get(e) || 0) !== 0;
	}
	getConsolidatedMultiplicity(e) {
		return this.#t.get(e) || 0;
	}
	getPresenceKeys() {
		return this.#t.keys();
	}
	get(e) {
		return [...this.getIterator(e)];
	}
	*getIterator(e) {
		let t = this.#e.get(e);
		if (zn(t)) yield t;
		else if (t === void 0) return;
		else if (t instanceof H) for (let e of t.values()) yield e;
		else for (let e of t.values()) if (zn(e)) yield e;
		else for (let t of e.values()) yield t;
	}
	*entries() {
		for (let e of this.#e.keys()) for (let t of this.getIterator(e)) yield [e, t];
	}
	*entriesIterators() {
		for (let e of this.#e.keys()) yield [e, this.getIterator(e)];
	}
	addValue(e, t) {
		let [n, r] = t;
		if (r === 0) return;
		let i = (this.#t.get(e) || 0) + r;
		i === 0 ? this.#t.delete(e) : this.#t.set(e, i);
		let a = this.#e.get(e);
		if (a === void 0) this.#e.set(e, t);
		else if (zn(a)) this.#n(e, a, n, r);
		else if (a instanceof H) {
			let i = U(n);
			if (i !== V) {
				let n = new Ln();
				n.set(V, a), n.set(i, t), this.#e.set(e, n);
			} else a.addValue(n, r) && this.#e.delete(e);
		} else a.addValue(n, r) && this.#e.delete(e);
	}
	#n(e, t, n, r) {
		let [i, a] = t;
		if (i === n) {
			let t = a + r;
			t === 0 ? this.#e.delete(e) : this.#e.set(e, [n, t]);
			return;
		}
		let o = U(n), s = U(i);
		if (s === o && (i === n || F(i) === F(n))) {
			let t = a + r;
			t === 0 ? this.#e.delete(e) : this.#e.set(e, [n, t]);
		} else if (s === V && o === V) {
			let a = new H();
			a.set(F(i), t), a.set(F(n), [n, r]), this.#e.set(e, a);
		} else {
			let a = new Ln();
			if (s === o) {
				let e = new H();
				e.set(F(i), t), e.set(F(n), [n, r]), a.set(s, e);
			} else a.set(s, t), a.set(o, [n, r]);
			this.#e.set(e, a);
		}
	}
	append(e) {
		for (let [t, n] of e.entries()) this.addValue(t, n);
	}
	join(e) {
		let t = [];
		if (this.size <= e.size) for (let [n, r] of this.entriesIterators()) {
			if (!e.has(n)) continue;
			let i = e.get(n);
			for (let [e, a] of r) for (let [r, o] of i) a !== 0 && o !== 0 && t.push([[n, [e, r]], a * o]);
		}
		else for (let [n, r] of e.entriesIterators()) {
			if (!this.has(n)) continue;
			let e = this.get(n);
			for (let [i, a] of r) for (let [r, o] of e) o !== 0 && a !== 0 && t.push([[n, [r, i]], o * a]);
		}
		return new I(t);
	}
};
function U(e) {
	return Array.isArray(e) && (typeof e[0] == "string" || typeof e[0] == "number" || typeof e[0] == "bigint") ? e[0] : V;
}
function zn(e) {
	return Array.isArray(e);
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/reduce.js
var Bn = class extends R {
	#e = new Rn();
	#t = new Rn();
	#n;
	constructor(e, t, n, r) {
		super(e, t, n), this.#n = r;
	}
	run() {
		let e = /* @__PURE__ */ new Set();
		for (let t of this.inputMessages()) for (let [n, r] of t.getInner()) {
			let [t, i] = n;
			this.#e.addValue(t, [i, r]), e.add(t);
		}
		let t = [];
		for (let n of e) {
			let e = this.#e.get(n), r = this.#t.get(n), i = this.#n(e), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map();
			for (let [e, t] of i) {
				let n = a.get(e) ?? 0;
				a.set(e, n + t);
			}
			for (let [e, t] of r) {
				let n = o.get(e) ?? 0;
				o.set(e, n + t);
			}
			for (let [e, r] of o) a.has(e) || (t.push([[n, e], -r]), this.#t.addValue(n, [e, -r]));
			for (let [e, r] of a) o.has(e) || r !== 0 && (t.push([[n, e], r]), this.#t.addValue(n, [e, r]));
			for (let [e, r] of a) {
				let i = o.get(e);
				if (i !== void 0) {
					let a = r - i;
					a !== 0 && (t.push([[n, e], a]), this.#t.addValue(n, [e, a]));
				}
			}
		}
		t.length > 0 && this.output.sendData(new I(t));
	}
};
function Vn(e) {
	return (t) => {
		let n = new z(t.graph, new L()), r = new Bn(t.graph.getNextOperatorId(), t.connectReader(), n.writer, e);
		return t.graph.addOperator(r), n;
	};
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/groupBy.js
function Hn(e) {
	return "pipe" in e;
}
function Un(e, t = {}) {
	let n = Object.fromEntries(Object.entries(t).filter(([e, t]) => !Hn(t)));
	return Object.fromEntries(Object.entries(t).filter(([e, t]) => Hn(t))), (t) => {
		let r = "__original_key__";
		return t.pipe(B((t) => {
			let i = e(t), a = Zt(i), o = {};
			o[r] = i;
			for (let [e, r] of Object.entries(n)) o[e] = r.preMap(t);
			return [a, o];
		})).pipe(Vn((e) => {
			let t = 0;
			for (let [n, r] of e) t += r;
			if (t <= 0) return [];
			let i = {}, a = e[0]?.[0]?.[r];
			i[r] = a;
			for (let [t, r] of Object.entries(n)) {
				let n = e.map(([e, n]) => [e[t], n]);
				i[t] = r.reduce(n);
			}
			return [[i, 1]];
		})).pipe(B(([e, t]) => {
			let i = t[r], a = {};
			Object.assign(a, i);
			for (let [e, r] of Object.entries(n)) a[e] = r.postMap ? r.postMap(t[e]) : t[e];
			return [e, a];
		}));
	};
}
function Wn(e = (e) => e) {
	return {
		preMap: (t) => e(t),
		reduce: (e) => {
			let t = 0;
			for (let [n, r] of e) t += n * r;
			return t;
		}
	};
}
function Gn(e = (e) => e) {
	return {
		preMap: (t) => e(t) == null ? 0 : 1,
		reduce: (e) => {
			let t = 0;
			for (let [n, r] of e) t += n * r;
			return t;
		}
	};
}
function Kn(e = (e) => e) {
	return {
		preMap: (t) => ({
			sum: e(t),
			count: 0
		}),
		reduce: (e) => {
			let t = 0, n = 0;
			for (let [r, i] of e) t += r.sum * i, n += i;
			return {
				sum: t,
				count: n
			};
		},
		postMap: (e) => e.sum / e.count
	};
}
function qn(e) {
	let t = e ?? ((e) => e);
	return {
		preMap: (e) => t(e),
		reduce: (e) => {
			let t;
			for (let [n, r] of e) (!t || n && n < t) && (t = n);
			return t;
		}
	};
}
function Jn(e) {
	let t = e ?? ((e) => e);
	return {
		preMap: (e) => t(e),
		reduce: (e) => {
			let t;
			for (let [n, r] of e) (!t || n && n > t) && (t = n);
			return t;
		}
	};
}
function Yn(e = (e) => e) {
	return {
		preMap: (t) => [e(t)],
		reduce: (e) => {
			let t = [];
			for (let [n, r] of e) for (let e of n) for (let n = 0; n < r; n++) t.push(e);
			return t.length === 0 ? [] : (t.sort((e, t) => e - t), t);
		},
		postMap: (e) => {
			if (e.length === 0) return 0;
			let t = Math.floor(e.length / 2);
			return e.length % 2 == 0 ? (e[t - 1] + e[t]) / 2 : e[t];
		}
	};
}
function Xn(e = (e) => e) {
	return {
		preMap: (t) => {
			let n = e(t), r = /* @__PURE__ */ new Map();
			return r.set(n, 1), r;
		},
		reduce: (e) => {
			let t = /* @__PURE__ */ new Map();
			for (let [n, r] of e) for (let [e, i] of n.entries()) {
				let n = t.get(e) || 0;
				t.set(e, n + i * r);
			}
			return t;
		},
		postMap: (e) => {
			if (e.size === 0) return 0;
			let t = 0, n = 0;
			for (let [r, i] of e.entries()) i > n && (n = i, t = r);
			return t;
		}
	};
}
var Zn = {
	sum: Wn,
	count: Gn,
	avg: Kn,
	min: qn,
	max: Jn,
	median: Yn,
	mode: Xn
}, Qn = class extends Nn {
	#e;
	constructor(e, t, n, r) {
		super(e, t, n), this.#e = r;
	}
	inner(e) {
		return e.filter(this.#e);
	}
};
function W(e) {
	return (t) => {
		let n = new z(t.graph, new L()), r = new Qn(t.graph.getNextOperatorId(), t.connectReader(), n.writer, e);
		return t.graph.addOperator(r), n;
	};
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/consolidate.js
var $n = class extends R {
	run() {
		let e = this.inputMessages();
		if (e.length === 0) return;
		let t = new I();
		for (let n of e) t.extend(n);
		let n = t.consolidate();
		n.getInner().length > 0 && this.output.sendData(n);
	}
};
function er() {
	return (e) => {
		let t = new z(e.graph, new L()), n = new $n(e.graph.getNextOperatorId(), e.connectReader(), t.writer);
		return e.graph.addOperator(n), t;
	};
}
// node_modules/.bun/fractional-indexing@3.2.0/node_modules/fractional-indexing/src/index.js
var tr = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function G(e, t, n) {
	let r = n[0];
	if (t != null && e >= t) throw Error(e + " >= " + t);
	if (e.slice(-1) === r || t && t.slice(-1) === r) throw Error("trailing zero");
	if (t) {
		let i = 0;
		for (; (e[i] || r) === t[i];) i++;
		if (i > 0) return t.slice(0, i) + G(e.slice(i), t.slice(i), n);
	}
	let i = e ? n.indexOf(e[0]) : 0, a = t == null ? n.length : n.indexOf(t[0]);
	return a - i > 1 ? n[Math.round(.5 * (i + a))] : t && t.length > 1 ? t.slice(0, 1) : n[i] + G(e.slice(1), null, n);
}
function nr(e) {
	if (e.length !== rr(e[0])) throw Error("invalid integer part of order key: " + e);
}
function rr(e) {
	if (e >= "a" && e <= "z") return e.charCodeAt(0) - 97 + 2;
	if (e >= "A" && e <= "Z") return 90 - e.charCodeAt(0) + 2;
	throw Error("invalid order key head: " + e);
}
function K(e) {
	let t = rr(e[0]);
	if (t > e.length) throw Error("invalid order key: " + e);
	return e.slice(0, t);
}
function ir(e, t) {
	if (e === "A" + t[0].repeat(26)) throw Error("invalid order key: " + e);
	let n = K(e);
	if (e.slice(n.length).slice(-1) === t[0]) throw Error("invalid order key: " + e);
}
function ar(e, t) {
	nr(e);
	let [n, ...r] = e.split(""), i = !0;
	for (let e = r.length - 1; i && e >= 0; e--) {
		let n = t.indexOf(r[e]) + 1;
		n === t.length ? r[e] = t[0] : (r[e] = t[n], i = !1);
	}
	if (i) {
		if (n === "Z") return "a" + t[0];
		if (n === "z") return null;
		let e = String.fromCharCode(n.charCodeAt(0) + 1);
		return e > "a" ? r.push(t[0]) : r.pop(), e + r.join("");
	}
	return n + r.join("");
}
function or(e, t) {
	nr(e);
	let [n, ...r] = e.split(""), i = !0;
	for (let e = r.length - 1; i && e >= 0; e--) {
		let n = t.indexOf(r[e]) - 1;
		n === -1 ? r[e] = t.slice(-1) : (r[e] = t[n], i = !1);
	}
	if (i) {
		if (n === "a") return "Z" + t.slice(-1);
		if (n === "A") return null;
		let e = String.fromCharCode(n.charCodeAt(0) - 1);
		return e < "Z" ? r.push(t.slice(-1)) : r.pop(), e + r.join("");
	}
	return n + r.join("");
}
function sr(e, t, n = tr) {
	if (e != null && ir(e, n), t != null && ir(t, n), e != null && t != null && e >= t) throw Error(e + " >= " + t);
	if (e == null) {
		if (t == null) return "a" + n[0];
		let e = K(t), r = t.slice(e.length);
		if (e === "A" + n[0].repeat(26)) return e + G("", r, n);
		if (e < t) return e;
		let i = or(e, n);
		if (i == null) throw Error("cannot decrement any more");
		return i;
	}
	if (t == null) {
		let t = K(e), r = e.slice(t.length);
		return ar(t, n) ?? t + G(r, null, n);
	}
	let r = K(e), i = e.slice(r.length), a = K(t), o = t.slice(a.length);
	if (r === a) return r + G(i, o, n);
	let s = ar(r, n);
	if (s == null) throw Error("cannot increment any more");
	return s < t ? s : r + G(i, null, n);
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/topKArray.js
function cr(e, t) {
	return [e, t];
}
function lr(e) {
	return e[0];
}
function ur(e) {
	return e[1];
}
function dr(e) {
	return ([t, n], [r, i]) => {
		let a = e(n, i);
		return a === 0 ? Xt(t, r) : a;
	};
}
var fr = class {
	#e = [];
	#t;
	#n;
	#r;
	constructor(e, t, n) {
		this.#n = e, this.#r = e + t, this.#t = n;
	}
	get size() {
		let e = this.#n, t = this.#r - this.#n, n = this.#e.length - e;
		return Math.max(0, Math.min(t, n));
	}
	move({ offset: e, limit: t }) {
		let n = this.#n, r = this.#r - this.#n, i = [this.#n, this.#r === Infinity ? this.#n + this.size : this.#r];
		this.#n = e ?? n, this.#r = this.#n + (t ?? r);
		let { onlyInA: a, onlyInB: o } = Jt(i, [this.#n, this.#r === Infinity ? Math.max(this.#n + this.size, i[1]) : this.#r]), s = [];
		o.forEach((e) => {
			let t = this.#e[e];
			t && s.push(t);
		});
		let c = [];
		return a.forEach((e) => {
			let t = this.#e[e];
			t && c.push(t);
		}), {
			moveIns: s,
			moveOuts: c,
			changes: a.length + o.length > 0
		};
	}
	insert(e) {
		let t = {
			moveIn: null,
			moveOut: null
		}, n = this.#i(e), r = cr(e, sr(n === 0 ? null : ur(this.#e[n - 1]), n === this.#e.length ? null : ur(this.#e[n])));
		if (this.#e.splice(n, 0, r), n < this.#r) {
			let e = Math.max(n, this.#n);
			e < this.#e.length && (t.moveIn = this.#e[e], this.#r < this.#e.length && (t.moveOut = this.#e[this.#r]));
		}
		return t;
	}
	delete(e) {
		let t = {
			moveIn: null,
			moveOut: null
		}, n = this.#i(e), [r] = this.#e.splice(n, 1);
		if (n < this.#r) {
			if (t.moveOut = r, n < this.#n) {
				let e = this.#n - 1;
				t.moveOut = e < this.#e.length ? this.#e[e] : null;
			}
			let e = this.#r - 1;
			e < this.#e.length && (t.moveIn = this.#e[e]);
		}
		return t;
	}
	#i(e) {
		return Kt(this.#e, cr(e, ""), (e, t) => this.#t(lr(e), lr(t)));
	}
}, pr = class {
	#e = /* @__PURE__ */ new Map();
	#t;
	constructor(e) {
		this.#t = e;
	}
	get size() {
		return this.#t.size;
	}
	get isEmpty() {
		return this.#e.size === 0 && this.#t.size === 0;
	}
	processElement(e, t, n) {
		let { oldMultiplicity: r, newMultiplicity: i } = this.#n(e, n);
		return r <= 0 && i > 0 ? this.#t.insert([e, t]) : r > 0 && i <= 0 ? this.#t.delete([e, t]) : {
			moveIn: null,
			moveOut: null
		};
	}
	move(e) {
		if (!(this.#t instanceof fr)) throw Error("Cannot move B+-tree implementation of TopK with fractional index");
		return this.#t.move(e);
	}
	#n(e, t) {
		if (t === 0) {
			let t = this.#e.get(e) ?? 0;
			return {
				oldMultiplicity: t,
				newMultiplicity: t
			};
		}
		let n = this.#e.get(e) ?? 0, r = n + t;
		return r === 0 ? this.#e.delete(e) : this.#e.set(e, r), {
			oldMultiplicity: n,
			newMultiplicity: r
		};
	}
};
function mr(e, t) {
	if (e) {
		let [[n, r], i] = e;
		t.push([[n, [r, i]], 1]);
	}
}
function hr(e, t) {
	if (e) {
		let [[n, r], i] = e;
		t.push([[n, [r, i]], -1]);
	}
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/topKWithFractionalIndex.js
var gr = class extends R {
	#e;
	constructor(e, t, n, r, i) {
		super(e, t, n);
		let a = i.limit ?? Infinity, o = i.offset ?? 0, s = this.createTopK(o, a, dr(r));
		this.#e = new pr(s), i.setSizeCallback?.(() => this.#e.size), i.setWindowFn?.(this.moveTopK.bind(this));
	}
	createTopK(e, t, n) {
		return new fr(e, t, n);
	}
	moveTopK({ offset: e, limit: t }) {
		let n = [], r = this.#e.move({
			offset: e,
			limit: t
		});
		r.moveIns.forEach((e) => mr(e, n)), r.moveOuts.forEach((e) => hr(e, n)), r.changes && this.output.sendData(new I(n));
	}
	run() {
		let e = [];
		for (let t of this.inputMessages()) for (let [n, r] of t.getInner()) {
			let [t, i] = n;
			this.processElement(t, i, r, e);
		}
		e.length > 0 && this.output.sendData(new I(e));
	}
	processElement(e, t, n, r) {
		let i = this.#e.processElement(e, t, n);
		mr(i.moveIn, r), hr(i.moveOut, r);
	}
};
function _r(e, t) {
	let n = t || {};
	return (t) => {
		let r = new z(t.graph, new L()), i = new gr(t.graph.getNextOperatorId(), t.connectReader(), r.writer, e, n);
		return t.graph.addOperator(i), r;
	};
}
// node_modules/.bun/@tanstack+db-ivm@0.1.17+8e24a2f921b8d7be/node_modules/@tanstack/db-ivm/dist/esm/operators/orderBy.js
function vr(e, t, n) {
	let r = n?.limit ?? Infinity, i = n?.offset ?? 0, a = n?.setSizeCallback, o = n?.setWindowFn, s = n?.comparator ?? ((e, t) => e === t ? 0 : e < t ? -1 : 1);
	return (n) => n.pipe(e((e, n) => s(t(e), t(n)), {
		limit: r,
		offset: i,
		setSizeCallback: a,
		setWindowFn: o
	}), er());
}
function yr(e, t) {
	return vr(_r, e, t);
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/utils/btree.js
var br = class {
	constructor(e, t, n) {
		this._root = Tr, this._size = 0, this._maxNodeSize = n >= 4 ? Math.min(n, 256) : 32, this._compare = e, t && this.setPairs(t);
	}
	get size() {
		return this._size;
	}
	get length() {
		return this._size;
	}
	get isEmpty() {
		return this._size === 0;
	}
	clear() {
		this._root = Tr, this._size = 0;
	}
	get(e, t) {
		return this._root.get(e, t, this);
	}
	set(e, t, n) {
		this._root.isShared && (this._root = this._root.clone());
		let r = this._root.set(e, t, n, this);
		return r === !0 || r === !1 ? r : (this._root = new Sr([this._root, r]), !0);
	}
	has(e) {
		return this.forRange(e, e, !0, void 0) !== 0;
	}
	delete(e) {
		return this.editRange(e, e, !0, wr) !== 0;
	}
	get maxNodeSize() {
		return this._maxNodeSize;
	}
	minKey() {
		return this._root.minKey();
	}
	maxKey() {
		return this._root.maxKey();
	}
	keysArray() {
		let e = [];
		return this._root.forRange(this.minKey(), this.maxKey(), !0, !1, this, 0, (t, n) => {
			e.push(t);
		}), e;
	}
	nextHigherPair(e, t) {
		return t ||= [], e === void 0 ? this._root.minPair(t) : this._root.getPairOrNextHigher(e, this._compare, !1, t);
	}
	nextHigherKey(e) {
		let t = this.nextHigherPair(e, Er);
		return t && t[0];
	}
	nextLowerPair(e, t) {
		return t ||= [], e === void 0 ? this._root.maxPair(t) : this._root.getPairOrNextLower(e, this._compare, !1, t);
	}
	nextLowerKey(e) {
		let t = this.nextLowerPair(e, Er);
		return t && t[0];
	}
	setPairs(e, t) {
		let n = 0;
		for (let r of e) this.set(r[0], r[1], t) && n++;
		return n;
	}
	forRange(e, t, n, r, i) {
		let a = this._root.forRange(e, t, n, !1, this, i || 0, r);
		return typeof a == "number" ? a : a.break;
	}
	editRange(e, t, n, r, i) {
		let a = this._root;
		a.isShared && (this._root = a = a.clone());
		try {
			let o = a.forRange(e, t, n, !0, this, i || 0, r);
			return typeof o == "number" ? o : o.break;
		} finally {
			let e;
			for (; a.keys.length <= 1 && !a.isLeaf;) e ||= a.isShared, this._root = a = a.keys.length === 0 ? Tr : a.children[0];
			e && (a.isShared = !0);
		}
	}
}, xr = class e {
	get isLeaf() {
		return this.children === void 0;
	}
	constructor(e = [], t) {
		this.keys = e, this.values = t || q, this.isShared = void 0;
	}
	maxKey() {
		return this.keys[this.keys.length - 1];
	}
	indexOf(e, t, n) {
		let r = this.keys, i = 0, a = r.length, o = a >> 1;
		for (; i < a;) {
			let t = n(r[o], e);
			if (t < 0) i = o + 1;
			else if (t > 0) a = o;
			else if (t === 0) return o;
			else if (e === e) return r.length;
			else throw Error("BTree: NaN was used as a key");
			o = i + a >> 1;
		}
		return o ^ t;
	}
	minKey() {
		return this.keys[0];
	}
	minPair(e) {
		if (this.keys.length !== 0) return e[0] = this.keys[0], e[1] = this.values[0], e;
	}
	maxPair(e) {
		if (this.keys.length === 0) return;
		let t = this.keys.length - 1;
		return e[0] = this.keys[t], e[1] = this.values[t], e;
	}
	clone() {
		let t = this.values;
		return new e(this.keys.slice(0), t === q ? t : t.slice(0));
	}
	get(e, t, n) {
		let r = this.indexOf(e, -1, n._compare);
		return r < 0 ? t : this.values[r];
	}
	getPairOrNextLower(e, t, n, r) {
		let i = this.indexOf(e, -1, t), a = i < 0 ? ~i - 1 : n ? i : i - 1;
		if (a >= 0) return r[0] = this.keys[a], r[1] = this.values[a], r;
	}
	getPairOrNextHigher(e, t, n, r) {
		let i = this.indexOf(e, -1, t), a = i < 0 ? ~i : n ? i : i + 1, o = this.keys;
		if (a < o.length) return r[0] = o[a], r[1] = this.values[a], r;
	}
	set(e, t, n, r) {
		let i = this.indexOf(e, -1, r._compare);
		if (i < 0) {
			if (i = ~i, r._size++, this.keys.length < r._maxNodeSize) return this.insertInLeaf(i, e, t, r);
			{
				let n = this.splitOffRightSide(), a = this;
				return i > this.keys.length && (i -= this.keys.length, a = n), a.insertInLeaf(i, e, t, r), n;
			}
		}
		return n !== !1 && (t !== void 0 && this.reifyValues(), this.keys[i] = e, this.values[i] = t), !1;
	}
	reifyValues() {
		return this.values === q ? this.values = this.values.slice(0, this.keys.length) : this.values;
	}
	insertInLeaf(e, t, n, r) {
		if (this.keys.splice(e, 0, t), this.values === q) {
			for (; q.length < r._maxNodeSize;) q.push(void 0);
			if (n === void 0) return !0;
			this.values = q.slice(0, this.keys.length - 1);
		}
		return this.values.splice(e, 0, n), !0;
	}
	takeFromRight(e) {
		let t = this.values;
		e.values === q ? t !== q && t.push(void 0) : (t = this.reifyValues(), t.push(e.values.shift())), this.keys.push(e.keys.shift());
	}
	takeFromLeft(e) {
		let t = this.values;
		e.values === q ? t !== q && t.unshift(void 0) : (t = this.reifyValues(), t.unshift(e.values.pop())), this.keys.unshift(e.keys.pop());
	}
	splitOffRightSide() {
		let t = this.keys.length >> 1, n = this.keys.splice(t), r = this.values === q ? q : this.values.splice(t);
		return new e(n, r);
	}
	forRange(e, t, n, r, i, a, o) {
		let s = i._compare, c, l;
		if (t === e) {
			if (!n || (l = (c = this.indexOf(e, -1, s)) + 1, c < 0)) return a;
		} else c = this.indexOf(e, 0, s), l = this.indexOf(t, -1, s), l < 0 ? l = ~l : n === !0 && l++;
		let u = this.keys, d = this.values;
		if (o !== void 0) for (let e = c; e < l; e++) {
			let t = u[e], n = o(t, d[e], a++);
			if (n !== void 0) {
				if (r === !0) {
					if (t !== u[e] || this.isShared === !0) throw Error("BTree illegally changed or cloned in editRange");
					n.delete ? (this.keys.splice(e, 1), this.values !== q && this.values.splice(e, 1), i._size--, e--, l--) : n.hasOwnProperty("value") && (d[e] = n.value);
				}
				if (n.break !== void 0) return n;
			}
		}
		else a += l - c;
		return a;
	}
	mergeSibling(e, t) {
		if (this.keys.push.apply(this.keys, e.keys), this.values === q) {
			if (e.values === q) return;
			this.values = this.values.slice(0, this.keys.length);
		}
		this.values.push.apply(this.values, e.reifyValues());
	}
}, Sr = class e extends xr {
	constructor(e, t) {
		if (!t) {
			t = [];
			for (let n = 0; n < e.length; n++) t[n] = e[n].maxKey();
		}
		super(t), this.children = e;
	}
	minKey() {
		return this.children[0].minKey();
	}
	minPair(e) {
		return this.children[0].minPair(e);
	}
	maxPair(e) {
		return this.children[this.children.length - 1].maxPair(e);
	}
	get(e, t, n) {
		let r = this.indexOf(e, 0, n._compare), i = this.children;
		return r < i.length ? i[r].get(e, t, n) : void 0;
	}
	getPairOrNextLower(e, t, n, r) {
		let i = this.indexOf(e, 0, t), a = this.children;
		if (i >= a.length) return this.maxPair(r);
		let o = a[i].getPairOrNextLower(e, t, n, r);
		return o === void 0 && i > 0 ? a[i - 1].maxPair(r) : o;
	}
	getPairOrNextHigher(e, t, n, r) {
		let i = this.indexOf(e, 0, t), a = this.children, o = a.length;
		if (i >= o) return;
		let s = a[i].getPairOrNextHigher(e, t, n, r);
		return s === void 0 && i < o - 1 ? a[i + 1].minPair(r) : s;
	}
	set(e, t, n, r) {
		let i = this.children, a = r._maxNodeSize, o = r._compare, s = Math.min(this.indexOf(e, 0, o), i.length - 1), c = i[s];
		if (c.isShared && (i[s] = c = c.clone()), c.keys.length >= a) {
			let t;
			s > 0 && (t = i[s - 1]).keys.length < a && o(c.keys[0], e) < 0 ? (t.isShared && (i[s - 1] = t = t.clone()), t.takeFromRight(c), this.keys[s - 1] = t.maxKey()) : (t = i[s + 1]) !== void 0 && t.keys.length < a && o(c.maxKey(), e) < 0 && (t.isShared && (i[s + 1] = t = t.clone()), t.takeFromLeft(c), this.keys[s] = i[s].maxKey());
		}
		let l = c.set(e, t, n, r);
		if (l === !1) return !1;
		if (this.keys[s] = c.maxKey(), l === !0) return !0;
		if (this.keys.length < a) return this.insert(s + 1, l), !0;
		{
			let e = this.splitOffRightSide(), t = this;
			return o(l.maxKey(), this.maxKey()) > 0 && (t = e, s -= this.keys.length), t.insert(s + 1, l), e;
		}
	}
	insert(e, t) {
		this.children.splice(e, 0, t), this.keys.splice(e, 0, t.maxKey());
	}
	splitOffRightSide() {
		let t = this.children.length >> 1;
		return new e(this.children.splice(t), this.keys.splice(t));
	}
	takeFromRight(e) {
		this.keys.push(e.keys.shift()), this.children.push(e.children.shift());
	}
	takeFromLeft(e) {
		this.keys.unshift(e.keys.pop()), this.children.unshift(e.children.pop());
	}
	forRange(e, t, n, r, i, a, o) {
		let s = i._compare, c = this.keys, l = this.children, u = this.indexOf(e, 0, s), d = u, f = Math.min(t === e ? u : this.indexOf(t, 0, s), c.length - 1);
		if (!r) for (; d <= f; d++) {
			let s = l[d].forRange(e, t, n, r, i, a, o);
			if (typeof s != "number") return s;
			a = s;
		}
		else if (d <= f) try {
			for (; d <= f; d++) {
				l[d].isShared && (l[d] = l[d].clone());
				let s = l[d].forRange(e, t, n, r, i, a, o);
				if (c[d] = l[d].maxKey(), typeof s != "number") return s;
				a = s;
			}
		} finally {
			let e = i._maxNodeSize >> 1;
			for (u > 0 && u--, d = f; d >= u; d--) l[d].keys.length <= e && (l[d].keys.length === 0 ? (c.splice(d, 1), l.splice(d, 1)) : this.tryMerge(d, i._maxNodeSize));
			l.length !== 0 && l[0].keys.length === 0 && Dr(!1, "emptiness bug");
		}
		return a;
	}
	tryMerge(e, t) {
		let n = this.children;
		return e >= 0 && e + 1 < n.length && n[e].keys.length + n[e + 1].keys.length <= t && (n[e].isShared && (n[e] = n[e].clone()), n[e].mergeSibling(n[e + 1], t), n.splice(e + 1, 1), this.keys.splice(e + 1, 1), this.keys[e] = n[e].maxKey(), !0);
	}
	mergeSibling(e, t) {
		let n = this.keys.length;
		this.keys.push.apply(this.keys, e.keys);
		let r = e.children;
		if (this.children.push.apply(this.children, r), e.isShared && !this.isShared) for (let e of r) e.isShared = !0;
		this.tryMerge(n - 1, t);
	}
}, q = [], Cr = { delete: !0 }, wr = () => Cr, Tr = (function() {
	let e = new xr();
	return e.isShared = !0, e;
})(), Er = [];
function Dr(e, ...t) {
	throw t.unshift("B+ tree"), Error(t.join(" "));
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/builder/ref-proxy.js
function Or() {
	let e = /* @__PURE__ */ new Map();
	function t(n) {
		let r = n.join(".");
		if (e.has(r)) return e.get(r);
		let i = new Proxy({}, {
			get(e, r, i) {
				if (r === "__refProxy") return !0;
				if (r === "__path") return n;
				if (r !== "__type") return typeof r == "symbol" ? Reflect.get(e, r, i) : t([...n, String(r)]);
			},
			has(e, t) {
				return t === "__refProxy" || t === "__path" || t === "__type" || Reflect.has(e, t);
			},
			ownKeys(e) {
				return Reflect.ownKeys(e);
			},
			getOwnPropertyDescriptor(e, t) {
				return t === "__refProxy" || t === "__path" || t === "__type" ? {
					enumerable: !1,
					configurable: !0
				} : Reflect.getOwnPropertyDescriptor(e, t);
			}
		});
		return e.set(r, i), i;
	}
	return t([]);
}
function kr(e) {
	let t = /* @__PURE__ */ new Map(), n = 0;
	function r(e) {
		let i = e.join(".");
		if (t.has(i)) return t.get(i);
		let a = new Proxy({}, {
			get(t, n, i) {
				if (n === "__refProxy") return !0;
				if (n === "__path") return e;
				if (n !== "__type") return typeof n == "symbol" ? Reflect.get(t, n, i) : r([...e, String(n)]);
			},
			has(e, t) {
				return t === "__refProxy" || t === "__path" || t === "__type" || Reflect.has(e, t);
			},
			ownKeys(t) {
				let r = ++n, i = `__SPREAD_SENTINEL__${e.join(".")}__${r}`;
				return Object.prototype.hasOwnProperty.call(t, i) || Object.defineProperty(t, i, {
					enumerable: !0,
					configurable: !0,
					value: !0
				}), Reflect.ownKeys(t);
			},
			getOwnPropertyDescriptor(e, t) {
				return t === "__refProxy" || t === "__path" || t === "__type" ? {
					enumerable: !1,
					configurable: !0
				} : Reflect.getOwnPropertyDescriptor(e, t);
			}
		});
		return t.set(i, a), a;
	}
	return new Proxy({}, {
		get(t, n, i) {
			if (n === "__refProxy") return !0;
			if (n === "__path") return [];
			if (n === "__type") return;
			if (typeof n == "symbol") return Reflect.get(t, n, i);
			let a = String(n);
			if (e.includes(a)) return r([a]);
		},
		has(t, n) {
			return n === "__refProxy" || n === "__path" || n === "__type" || typeof n == "string" && e.includes(n) ? !0 : Reflect.has(t, n);
		},
		ownKeys(t) {
			return [
				...e,
				"__refProxy",
				"__path",
				"__type"
			];
		},
		getOwnPropertyDescriptor(t, n) {
			if (n === "__refProxy" || n === "__path" || n === "__type") return {
				enumerable: !1,
				configurable: !0
			};
			if (typeof n == "string" && e.includes(n)) return {
				enumerable: !0,
				configurable: !0
			};
		}
	});
}
function Ar(e) {
	let t = kr(e), n = /* @__PURE__ */ new Map();
	function r(e) {
		let t = e.join(".");
		if (n.has(t)) return n.get(t);
		let i = new Proxy({}, {
			get(t, n, i) {
				if (n === "__refProxy") return !0;
				if (n === "__path") return ["$selected", ...e];
				if (n !== "__type") return typeof n == "symbol" ? Reflect.get(t, n, i) : r([...e, String(n)]);
			},
			has(e, t) {
				return t === "__refProxy" || t === "__path" || t === "__type" || Reflect.has(e, t);
			},
			ownKeys(e) {
				return Reflect.ownKeys(e);
			},
			getOwnPropertyDescriptor(e, t) {
				return t === "__refProxy" || t === "__path" || t === "__type" ? {
					enumerable: !1,
					configurable: !0
				} : Reflect.getOwnPropertyDescriptor(e, t);
			}
		});
		return n.set(t, i), i;
	}
	let i = r([]);
	return new Proxy(t, {
		get(e, t, n) {
			return t === "$selected" ? i : Reflect.get(e, t, n);
		},
		has(e, t) {
			return t === "$selected" || Reflect.has(e, t);
		},
		ownKeys(e) {
			return [...Reflect.ownKeys(e), "$selected"];
		},
		getOwnPropertyDescriptor(e, t) {
			return t === "$selected" ? {
				enumerable: !0,
				configurable: !0,
				value: i
			} : Reflect.getOwnPropertyDescriptor(e, t);
		}
	});
}
function J(e) {
	return jr(e) ? new i(e.__path) : e && typeof e == "object" && "type" in e && (e.type === "func" || e.type === "ref" || e.type === "val" || e.type === "agg") ? e : new a(e);
}
function jr(e) {
	return e && typeof e == "object" && e.__refProxy === !0;
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/builder/functions.js
function Mr(e, t) {
	return new o("eq", [J(e), J(t)]);
}
function Nr(e, t) {
	return new o("gt", [J(e), J(t)]);
}
function Pr(e, t) {
	return new o("gte", [J(e), J(t)]);
}
function Fr(e, t) {
	return new o("lt", [J(e), J(t)]);
}
function Ir(e, t, ...n) {
	return new o("and", [
		e,
		t,
		...n
	].map((e) => J(e)));
}
function Lr(e, t, ...n) {
	return new o("or", [
		e,
		t,
		...n
	].map((e) => J(e)));
}
function Rr(e, t) {
	return new o("in", [J(e), J(t)]);
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/indexes/base-index.js
var zr = class {
	constructor(e, t, n, r) {
		this.lookupCount = 0, this.totalLookupTime = 0, this.lastUpdated = /* @__PURE__ */ new Date(), this.id = e, this.expression = t, this.compareOptions = jt, this.name = n, this.initialize(r);
	}
	supports(e) {
		return this.supportedOperations.has(e);
	}
	matchesField(e) {
		return this.expression.type === "ref" && this.expression.path.length === e.length && this.expression.path.every((t, n) => t === e[n]);
	}
	matchesCompareOptions(e) {
		return j({
			...this.compareOptions,
			direction: void 0
		}, {
			...e,
			direction: void 0
		});
	}
	matchesDirection(e) {
		return this.compareOptions.direction === e;
	}
	getStats() {
		return {
			entryCount: this.keyCount,
			lookupCount: this.lookupCount,
			averageLookupTime: this.lookupCount > 0 ? this.totalLookupTime / this.lookupCount : 0,
			lastUpdated: this.lastUpdated
		};
	}
	evaluateIndexExpression(e) {
		return St(this.expression)(e);
	}
	trackLookup(e) {
		let t = performance.now() - e;
		this.lookupCount++, this.totalLookupTime += t;
	}
	updateTimestamp() {
		this.lastUpdated = /* @__PURE__ */ new Date();
	}
}, Br = class extends zr {
	constructor(e, t, n, r) {
		super(e, t, n, r), this.supportedOperations = /* @__PURE__ */ new Set([
			"eq",
			"gt",
			"gte",
			"lt",
			"lte",
			"in"
		]), this.valueMap = /* @__PURE__ */ new Map(), this.indexedKeys = /* @__PURE__ */ new Set(), this.compareFn = gt;
		let i = r?.compareFn ?? gt;
		this.compareFn = (e, t) => i(O(e), O(t)), r?.compareOptions && (this.compareOptions = r.compareOptions), this.orderedEntries = new br(this.compareFn);
	}
	initialize(e) {}
	add(e, t) {
		let n;
		try {
			n = this.evaluateIndexExpression(t);
		} catch (t) {
			throw Error(`Failed to evaluate index expression for key ${e}: ${t}`);
		}
		let r = D(n);
		if (this.valueMap.has(r)) this.valueMap.get(r).add(e);
		else {
			let t = /* @__PURE__ */ new Set([e]);
			this.valueMap.set(r, t), this.orderedEntries.set(r, void 0);
		}
		this.indexedKeys.add(e), this.updateTimestamp();
	}
	remove(e, t) {
		let n;
		try {
			n = this.evaluateIndexExpression(t);
		} catch (t) {
			console.warn(`Failed to evaluate index expression for key ${e} during removal:`, t);
			return;
		}
		let r = D(n);
		if (this.valueMap.has(r)) {
			let t = this.valueMap.get(r);
			t.delete(e), t.size === 0 && (this.valueMap.delete(r), this.orderedEntries.delete(r));
		}
		this.indexedKeys.delete(e), this.updateTimestamp();
	}
	update(e, t, n) {
		this.remove(e, t), this.add(e, n);
	}
	build(e) {
		this.clear();
		for (let [t, n] of e) this.add(t, n);
	}
	clear() {
		this.orderedEntries.clear(), this.valueMap.clear(), this.indexedKeys.clear(), this.updateTimestamp();
	}
	lookup(e, t) {
		let n = performance.now(), r;
		switch (e) {
			case "eq":
				r = this.equalityLookup(t);
				break;
			case "gt":
				r = this.rangeQuery({
					from: t,
					fromInclusive: !1
				});
				break;
			case "gte":
				r = this.rangeQuery({
					from: t,
					fromInclusive: !0
				});
				break;
			case "lt":
				r = this.rangeQuery({
					to: t,
					toInclusive: !1
				});
				break;
			case "lte":
				r = this.rangeQuery({
					to: t,
					toInclusive: !0
				});
				break;
			case "in":
				r = this.inArrayLookup(t);
				break;
			default: throw Error(`Operation ${e} not supported by BTreeIndex`);
		}
		return this.trackLookup(n), r;
	}
	get keyCount() {
		return this.indexedKeys.size;
	}
	equalityLookup(e) {
		let t = D(e);
		return new Set(this.valueMap.get(t) ?? []);
	}
	rangeQuery(e = {}) {
		let { from: t, to: n, fromInclusive: r = !0, toInclusive: i = !0 } = e, a = /* @__PURE__ */ new Set(), o = "from" in e, s = "to" in e, c = o ? D(t) : this.orderedEntries.minKey(), l = s ? D(n) : this.orderedEntries.maxKey();
		return this.orderedEntries.forRange(c, l, i, (e, n) => {
			if (!r && this.compareFn(e, t) === 0) return;
			let i = this.valueMap.get(e);
			i && i.forEach((e) => a.add(e));
		}), a;
	}
	rangeQueryReversed(e = {}) {
		let { from: t, to: n, fromInclusive: r = !0, toInclusive: i = !0 } = e, a = "from" in e, o = "to" in e;
		return this.rangeQuery({
			from: o ? n : this.orderedEntries.maxKey(),
			to: a ? t : this.orderedEntries.minKey(),
			fromInclusive: i,
			toInclusive: r
		});
	}
	takeInternal(e, t, n, r, i = !1) {
		let a = /* @__PURE__ */ new Set(), o = [], s, c = n;
		for (; (s = t(c)) !== void 0 && o.length < e;) {
			c = s[0];
			let t = this.valueMap.get(c);
			if (t && t.size > 0) {
				let n = Array.from(t).sort(Xt);
				i && n.reverse();
				for (let t of n) {
					if (o.length >= e) break;
					!a.has(t) && (r?.(t) ?? !0) && (o.push(t), a.add(t));
				}
			}
		}
		return o;
	}
	take(e, t, n) {
		let r = (e) => this.orderedEntries.nextHigherPair(e), i = D(t);
		return this.takeInternal(e, r, i, n);
	}
	takeFromStart(e, t) {
		return this.takeInternal(e, (e) => this.orderedEntries.nextHigherPair(e), void 0, t);
	}
	takeReversed(e, t, n) {
		let r = (e) => this.orderedEntries.nextLowerPair(e), i = D(t);
		return this.takeInternal(e, r, i, n, !0);
	}
	takeReversedFromEnd(e, t) {
		return this.takeInternal(e, (e) => this.orderedEntries.nextLowerPair(e), void 0, t, !0);
	}
	inArrayLookup(e) {
		let t = /* @__PURE__ */ new Set();
		for (let n of e) {
			let e = D(n), r = this.valueMap.get(e);
			r && r.forEach((e) => t.add(e));
		}
		return t;
	}
	get indexedKeysSet() {
		return this.indexedKeys;
	}
	get orderedEntriesArray() {
		return this.orderedEntries.keysArray().map((e) => [O(e), this.valueMap.get(e) ?? /* @__PURE__ */ new Set()]);
	}
	get orderedEntriesArrayReversed() {
		return this.takeReversedFromEnd(this.orderedEntries.size).map((e) => [O(e), this.valueMap.get(e) ?? /* @__PURE__ */ new Set()]);
	}
	get valueMapData() {
		let e = /* @__PURE__ */ new Map();
		for (let [t, n] of this.valueMap) e.set(O(t), n);
		return e;
	}
};
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/indexes/auto-index.js
function Vr(e) {
	return e.config.autoIndex === "eager";
}
function Hr(e, t, n, r, i) {
	if (!Vr(n)) return;
	let a = r ?? {
		...jt,
		...n.compareOptions
	};
	if (!Array.from(n.indexes.values()).find((e) => e.matchesField(t) && e.matchesCompareOptions(a))) try {
		n.createIndex((e) => {
			let n = e;
			for (let e of t) n = n[e];
			return n;
		}, {
			name: `auto:${t.join(".")}`,
			indexType: Br,
			options: i ? {
				compareFn: i,
				compareOptions: a
			} : {}
		});
	} catch (e) {
		console.warn(`${n.id ? `[${n.id}] ` : ""}Failed to create auto-index for field path "${t.join(".")}":`, e);
	}
}
function Ur(e, t) {
	if (!Vr(t)) return;
	let n = Wr(e);
	for (let { fieldName: e, fieldPath: r } of n) Hr(e, r, t);
}
function Wr(e) {
	let t = [];
	function n(e) {
		if (e.type !== "func") return;
		let r = e;
		if (r.name === "and") {
			for (let e of r.args) n(e);
			return;
		}
		if (![
			"eq",
			"gt",
			"gte",
			"lt",
			"lte",
			"in"
		].includes(r.name) || r.args.length < 1 || r.args[0].type !== "ref") return;
		let i = r.args[0].path;
		if (i.length === 0) return;
		let a = i.join("_");
		t.push({
			fieldName: a,
			fieldPath: i
		});
	}
	return n(e), t;
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/compiler/group-by.js
var { sum: Gr, count: Kr, avg: qr, min: Jr, max: Yr } = Zn;
function Xr(e, t) {
	let n = /* @__PURE__ */ new Map(), r = [...e];
	if (!t) return {
		selectToGroupByIndex: n,
		groupByExpressions: r
	};
	for (let [e, i] of Object.entries(t)) {
		if (i.type === "agg" || Y(i)) continue;
		let t = r.findIndex((e) => Qr(i, e));
		if (t === -1) throw new et(e);
		n.set(e, t);
	}
	return {
		selectToGroupByIndex: n,
		groupByExpressions: r
	};
}
function Zr(e, t, n, r, i) {
	if (t.length === 0) {
		let t = {}, a = {}, o = { value: 0 };
		if (r) {
			for (let [e, n] of Object.entries(r)) if (n.type === "agg") t[e] = $r(n);
			else if (Y(n)) {
				let { transformed: r, extracted: i } = ni(n, o);
				for (let [e, n] of Object.entries(i)) t[e] = $r(n);
				a[e] = A(r);
			}
		}
		if (e = e.pipe(Un(() => ({ __singleGroup: !0 }), t)), e = e.pipe(B(([, e]) => {
			let t = { ...e.$selected || {} };
			if (r) {
				for (let [n, i] of Object.entries(r)) i.type === "agg" && (t[n] = e[n]);
				ti(t, e, a);
			}
			return ["single_group", {
				...e,
				$selected: t
			}];
		})), n && n.length > 0) for (let t of n) {
			let n = A(ei(u(t), r || {}, "$selected"));
			e = e.pipe(W(([, e]) => {
				let t = { $selected: e.$selected };
				return xt(n(t));
			}));
		}
		if (i && i.length > 0) for (let t of i) e = e.pipe(W(([, e]) => {
			let n = { $selected: e.$selected };
			return xt(t(n));
		}));
		return e;
	}
	let a = Xr(t, r), o = t.map((e) => A(e)), s = ([, e]) => {
		let n = { ...e };
		delete n.$selected;
		let r = {};
		for (let e = 0; e < t.length; e++) {
			let t = o[e], i = t(n);
			r[`__key_${e}`] = i;
		}
		return r;
	}, c = {}, l = {}, d = { value: 0 };
	if (r) {
		for (let [e, t] of Object.entries(r)) if (t.type === "agg") c[e] = $r(t);
		else if (Y(t)) {
			let { transformed: n, extracted: r } = ni(t, d);
			for (let [e, t] of Object.entries(r)) c[e] = $r(t);
			l[e] = A(n);
		}
	}
	if (e = e.pipe(Un(s, c)), e = e.pipe(B(([, e]) => {
		let n = e.$selected || {}, i = {};
		if (r) {
			for (let [t, o] of Object.entries(r)) if (o.type === "agg") i[t] = e[t];
			else if (!l[t]) {
				let r = a.selectToGroupByIndex.get(t);
				i[t] = r === void 0 ? n[t] : e[`__key_${r}`];
			}
			ti(i, e, l);
		} else for (let n = 0; n < t.length; n++) i[`__key_${n}`] = e[`__key_${n}`];
		let o;
		if (t.length === 1) o = e.__key_0;
		else {
			let n = [];
			for (let r = 0; r < t.length; r++) n.push(e[`__key_${r}`]);
			o = Zt(n);
		}
		return [o, {
			...e,
			$selected: i
		}];
	})), n && n.length > 0) for (let t of n) {
		let n = A(ei(u(t), r || {}));
		e = e.pipe(W(([, e]) => {
			let t = { $selected: e.$selected };
			return n(t);
		}));
	}
	if (i && i.length > 0) for (let t of i) e = e.pipe(W(([, e]) => {
		let n = { $selected: e.$selected };
		return xt(t(n));
	}));
	return e;
}
function Qr(e, t) {
	if (!e || !t || e.type !== t.type) return !1;
	switch (e.type) {
		case "ref": return !e.path || !t.path || e.path.length !== t.path.length ? !1 : e.path.every((e, n) => e === t.path[n]);
		case "val": return e.value === t.value;
		case "func": return e.name === t.name && e.args?.length === t.args?.length && (e.args || []).every((e, n) => Qr(e, t.args[n]));
		case "agg": return e.name === t.name && e.args?.length === t.args?.length && (e.args || []).every((e, n) => Qr(e, t.args[n]));
		default: return !1;
	}
}
function $r(e) {
	let t = A(e.args[0]), n = ([, e]) => {
		let n = t(e);
		return typeof n == "number" ? n : n == null ? 0 : Number(n);
	}, r = ([, e]) => {
		let n = t(e);
		return typeof n == "number" || typeof n == "string" || typeof n == "bigint" || n instanceof Date ? n : n == null ? 0 : Number(n);
	}, i = ([, e]) => t(e);
	switch (e.name.toLowerCase()) {
		case "sum": return Gr(n);
		case "count": return Kr(i);
		case "avg": return qr(n);
		case "min": return Jr(r);
		case "max": return Yr(r);
		default: throw new tt(e.name);
	}
}
function ei(e, t, n = "$selected") {
	switch (e.type) {
		case "agg": {
			let r = e;
			for (let [e, a] of Object.entries(t)) if (a.type === "agg" && ri(r, a)) return new i([n, e]);
			throw new nt(r.name);
		}
		case "func": {
			let n = e, r = n.args.map((e) => ei(e, t));
			return new o(n.name, r);
		}
		case "ref": return e;
		case "val": return e;
		default: throw new rt(e.type);
	}
}
function ti(e, t, n) {
	for (let n of Object.keys(t)) n.startsWith("__agg_") && (e[n] = t[n]);
	for (let [t, r] of Object.entries(n)) e[t] = r({ $selected: e });
	for (let t of Object.keys(e)) t.startsWith("__agg_") && delete e[t];
}
function Y(e) {
	return c(e) ? e.type === "agg" || e.type === "func" && e.args.some((e) => Y(e)) : !1;
}
function ni(e, t) {
	if (e.type === "agg") {
		let n = `__agg_${t.value++}`;
		return {
			transformed: new i(["$selected", n]),
			extracted: { [n]: e }
		};
	}
	if (e.type === "func") {
		let n = {}, r = e.args.map((e) => {
			let r = ni(e, t);
			return Object.assign(n, r.extracted), r.transformed;
		});
		return {
			transformed: new o(e.name, r),
			extracted: n
		};
	}
	return {
		transformed: e,
		extracted: {}
	};
}
function ri(e, t) {
	return e.name === t.name && e.args.length === t.args.length && e.args.every((e, n) => Qr(e, t.args[n]));
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/query/compiler/order-by.js
function ii(e, t, n, r, a, o, s, c, l) {
	let u = n.map((e) => ({
		compiledExpression: A(ei(e.expression, r, "$selected")),
		compareOptions: ai(e, a)
	})), d = (e) => {
		let t = e;
		return n.length > 1 ? u.map((e) => e.compiledExpression(t)) : n.length === 1 ? u[0].compiledExpression(t) : null;
	}, f = (e, t) => {
		if (n.length > 1) {
			let r = e, i = t;
			for (let e = 0; e < n.length; e++) {
				let t = u[e], n = ht(t.compareOptions)(r[e], i[e]);
				if (n !== 0) return n;
			}
			return r.length - i.length;
		}
		if (n.length === 1) {
			let n = u[0];
			return ht(n.compareOptions)(e, t);
		}
		return gt(e, t);
	}, p, h;
	if (c) {
		let t, r, s, u = e.from.alias, d = n[0], g = d.expression;
		if (g.type === "ref") {
			let n = m(e, g, a);
			if (n) {
				r = n.collection;
				let a = n.path[0], o = ai(d, r);
				a && Hr(a, n.path, r, o, f), s = A(new i(n.path), !0), t = Nt(r, n.path, o), t?.supports("gt") || (t = void 0), u = g.path.length > 1 ? String(g.path[0]) : e.from.alias;
			}
		}
		if (s) {
			let d = n.every((e) => e.expression.type === "ref") ? n.map((t) => {
				let n = t.expression, r = m(e, n, a);
				return A(r ? new i(r.path) : t.expression, !0);
			}) : void 0;
			h = {
				alias: u,
				offset: l ?? 0,
				limit: c,
				comparator: (e, t) => {
					if (n.length === 1) {
						let n = e && s(e), r = t && s(t);
						return f(n, r);
					}
					if (d) {
						let n = (e) => e && d.map((t) => t(e));
						return f(n(e), n(t));
					}
					return 0;
				},
				valueExtractorForRawRow: (e) => {
					if (n.length === 1) return s(e);
					if (d) return d.map((t) => t(e));
				},
				firstColumnValueExtractor: s,
				index: t,
				orderBy: n
			};
			let g = r?.id ?? a.id;
			o[g] = h, t && (p = (e) => {
				o[g].dataNeeded = () => {
					let t = e();
					return Math.max(0, h.limit - t);
				};
			});
		}
	}
	return t.pipe(yr(d, {
		limit: c,
		offset: l,
		comparator: f,
		setSizeCallback: p,
		setWindowFn: (e) => {
			s((t) => {
				e(t), h && (h.offset = t.offset ?? h.offset, h.limit = t.limit ?? h.limit);
			});
		}
	}));
}
function ai(e, t) {
	return e.compareOptions.stringSort === void 0 ? {
		...t.compareOptions,
		direction: e.compareOptions.direction,
		nulls: e.compareOptions.nulls
	} : e.compareOptions;
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/collection/change-events.js
function oi(e, t = {}) {
	let n = (t) => {
		let n = [];
		for (let [r, i] of e.entries()) (t?.(i) ?? !0) && n.push({
			type: "insert",
			key: r,
			value: i
		});
		return n;
	};
	if (t.limit !== void 0 && !t.orderBy) throw Error("limit cannot be used without orderBy");
	if (t.orderBy) {
		let n = t.where ? X(t.where) : void 0, r = ci(e, t.orderBy, t.limit, n, t.optimizedOnly);
		if (r === void 0) return;
		let i = [];
		for (let t of r) {
			let n = e.get(t);
			n !== void 0 && i.push({
				type: "insert",
				key: t,
				value: n
			});
		}
		return i;
	}
	if (!t.where) return n();
	try {
		let r = t.where, i = It(r, e);
		if (i.canOptimize) {
			let t = [];
			for (let n of i.matchingKeys) {
				let r = e.get(n);
				r !== void 0 && t.push({
					type: "insert",
					key: n,
					value: r
				});
			}
			return t;
		}
		return t.optimizedOnly ? void 0 : n(X(r));
	} catch (r) {
		console.warn(`${e.id ? `[${e.id}] ` : ""}Error processing where clause, falling back to full scan:`, r);
		let i = X(t.where);
		return t.optimizedOnly ? void 0 : n(i);
	}
}
function X(e) {
	let t = St(e);
	return (e) => {
		try {
			return xt(t(e));
		} catch {
			return !1;
		}
	};
}
function si(e, t) {
	let n = X(t.whereExpression);
	return (t) => {
		let r = [];
		for (let e of t) if (e.type === "insert") n(e.value) && r.push(e);
		else if (e.type === "update") {
			let t = n(e.value), i = e.previousValue ? n(e.previousValue) : !1;
			t && i ? r.push(e) : t && !i ? r.push({
				...e,
				type: "insert"
			}) : !t && i && r.push({
				...e,
				type: "delete",
				value: e.previousValue
			});
		} else n(e.value) && r.push(e);
		(r.length > 0 || t.length === 0) && e(r);
	};
}
function ci(e, t, n, r, i) {
	if (t.length === 1) {
		let i = t[0], a = i.expression;
		if (a.type === "ref") {
			let t = a.path, o = ai(i, e);
			Hr(t[0], t, e, o);
			let s = Nt(e, t, o);
			if (s && s.supports("gt")) return s.takeFromStart(n ?? s.keyCount, (t) => {
				let n = e.get(t);
				return n === void 0 ? !1 : r?.(n) ?? !0;
			});
		}
	}
	if (i) return;
	let a = [];
	for (let [t, n] of e.entries()) (r?.(n) ?? !0) && a.push({
		key: t,
		value: n
	});
	a.sort((e, n) => {
		for (let r of t) {
			let t = ht(r.compareOptions)(li(e.value, r.expression), li(n.value, r.expression));
			if (t !== 0) return t;
		}
		return 0;
	});
	let o = a.map((e) => e.key);
	return n === void 0 ? o : o.slice(0, n);
}
function li(e, t) {
	if (t.type === "ref") {
		let n = t, r = e;
		for (let e of n.path) r = r?.[e];
		return r;
	}
	return t.type === "val" ? t.value : St(t)(e);
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/SortedMap.js
var ui = class {
	constructor(e) {
		this.map = /* @__PURE__ */ new Map(), this.sortedKeys = [], this.comparator = e;
	}
	indexOf(e, t) {
		let n = 0, r = this.sortedKeys.length;
		if (!this.comparator) {
			for (; n < r;) {
				let t = Math.floor((n + r) / 2), i = this.sortedKeys[t], a = Xt(e, i);
				if (a < 0) r = t;
				else if (a > 0) n = t + 1;
				else return t;
			}
			return n;
		}
		for (; n < r;) {
			let i = Math.floor((n + r) / 2), a = this.sortedKeys[i], o = this.map.get(a), s = this.comparator(t, o);
			if (s < 0) r = i;
			else if (s > 0) n = i + 1;
			else {
				let t = Xt(e, a);
				if (t < 0) r = i;
				else if (t > 0) n = i + 1;
				else return i;
			}
		}
		return n;
	}
	set(e, t) {
		if (this.map.has(e)) {
			let t = this.map.get(e), n = this.indexOf(e, t);
			this.sortedKeys.splice(n, 1);
		}
		let n = this.indexOf(e, t);
		return this.sortedKeys.splice(n, 0, e), this.map.set(e, t), this;
	}
	get(e) {
		return this.map.get(e);
	}
	delete(e) {
		if (this.map.has(e)) {
			let t = this.map.get(e), n = this.indexOf(e, t);
			return this.sortedKeys.splice(n, 1), this.map.delete(e);
		}
		return !1;
	}
	has(e) {
		return this.map.has(e);
	}
	clear() {
		this.map.clear(), this.sortedKeys = [];
	}
	get size() {
		return this.map.size;
	}
	*[Symbol.iterator]() {
		for (let e of this.sortedKeys) yield [e, this.map.get(e)];
	}
	entries() {
		return this[Symbol.iterator]();
	}
	keys() {
		return this.sortedKeys[Symbol.iterator]();
	}
	values() {
		return (function* () {
			for (let e of this.sortedKeys) yield this.map.get(e);
		}).call(this);
	}
	forEach(e) {
		for (let t of this.sortedKeys) e(this.map.get(t), t, this.map);
	}
}, di = class {
	constructor(e) {
		this.pendingSyncedTransactions = [], this.syncedMetadata = /* @__PURE__ */ new Map(), this.optimisticUpserts = /* @__PURE__ */ new Map(), this.optimisticDeletes = /* @__PURE__ */ new Set(), this.size = 0, this.syncedKeys = /* @__PURE__ */ new Set(), this.preSyncVisibleState = /* @__PURE__ */ new Map(), this.recentlySyncedKeys = /* @__PURE__ */ new Set(), this.hasReceivedFirstCommit = !1, this.isCommittingSyncTransactions = !1, this.commitPendingTransactions = () => {
			let e = !1;
			for (let t of this.transactions.values()) if (t.state === "persisting") {
				e = !0;
				break;
			}
			let { committedSyncedTransactions: t, uncommittedSyncedTransactions: n, hasTruncateSync: r, hasImmediateSync: i } = this.pendingSyncedTransactions.reduce((e, t) => (t.committed ? (e.committedSyncedTransactions.push(t), t.truncate && (e.hasTruncateSync = !0), t.immediate && (e.hasImmediateSync = !0)) : e.uncommittedSyncedTransactions.push(t), e), {
				committedSyncedTransactions: [],
				uncommittedSyncedTransactions: [],
				hasTruncateSync: !1,
				hasImmediateSync: !1
			});
			if (!e || r || i) {
				this.isCommittingSyncTransactions = !0;
				let e = r ? t.find((e) => e.truncate)?.optimisticSnapshot : null, i = /* @__PURE__ */ new Set();
				for (let e of t) for (let t of e.operations) i.add(t.key);
				let a = this.preSyncVisibleState;
				if (a.size === 0) {
					a = /* @__PURE__ */ new Map();
					for (let e of i) {
						let t = this.get(e);
						t !== void 0 && a.set(e, t);
					}
				}
				let o = [], s = this.config.sync.rowUpdateMode || "partial";
				for (let n of t) {
					if (n.truncate) {
						let t = /* @__PURE__ */ new Set([...this.syncedData.keys(), ...e?.upserts.keys() || []]);
						for (let n of t) {
							if (e?.deletes.has(n)) continue;
							let t = e?.upserts.get(n) || this.syncedData.get(n);
							t !== void 0 && o.push({
								type: "delete",
								key: n,
								value: t
							});
						}
						this.syncedData.clear(), this.syncedMetadata.clear(), this.syncedKeys.clear();
						for (let e of i) a.delete(e);
						this._events.emit("truncate", {
							type: "truncate",
							collection: this.collection
						});
					}
					for (let e of n.operations) {
						let t = e.key;
						switch (this.syncedKeys.add(t), e.type) {
							case "insert":
								this.syncedMetadata.set(t, e.metadata);
								break;
							case "update":
								this.syncedMetadata.set(t, Object.assign({}, this.syncedMetadata.get(t), e.metadata));
								break;
							case "delete": this.syncedMetadata.delete(t);
						}
						switch (e.type) {
							case "insert":
								this.syncedData.set(t, e.value);
								break;
							case "update":
								if (s === "partial") {
									let n = Object.assign({}, this.syncedData.get(t), e.value);
									this.syncedData.set(t, n);
								} else this.syncedData.set(t, e.value);
								break;
							case "delete": this.syncedData.delete(t);
						}
					}
				}
				if (r) {
					let n = /* @__PURE__ */ new Set();
					for (let e of t) for (let t of e.operations) (t.type === "insert" || t.type === "update") && n.add(t.key);
					let r = new Map(e.upserts), i = new Set(e.deletes);
					for (let [e, t] of r) if (!i.has(e)) {
						if (n.has(e)) {
							let n = !1;
							for (let r = o.length - 1; r >= 0; r--) {
								let i = o[r];
								if (i.key === e && i.type === "insert") {
									i.value = t, n = !0;
									break;
								}
							}
							n || o.push({
								type: "insert",
								key: e,
								value: t
							});
						} else o.push({
							type: "insert",
							key: e,
							value: t
						});
					}
					if (o.length > 0 && i.size > 0) {
						let e = [];
						for (let t of o) t.type === "insert" && i.has(t.key) || e.push(t);
						o.length = 0, o.push(...e);
					}
					this.lifecycle.status !== "ready" && this.lifecycle.markReady();
				}
				if (this.optimisticUpserts.clear(), this.optimisticDeletes.clear(), this.isCommittingSyncTransactions = !1, r && e) {
					for (let [t, n] of e.upserts) this.optimisticUpserts.set(t, n);
					for (let t of e.deletes) this.optimisticDeletes.add(t);
				}
				for (let e of this.transactions.values()) if (!["completed", "failed"].includes(e.state)) {
					for (let t of e.mutations) if (this.isThisCollection(t.collection) && t.optimistic) switch (t.type) {
						case "insert":
						case "update":
							this.optimisticUpserts.set(t.key, t.modified), this.optimisticDeletes.delete(t.key);
							break;
						case "delete": this.optimisticUpserts.delete(t.key), this.optimisticDeletes.add(t.key);
					}
				}
				let c = /* @__PURE__ */ new Map();
				for (let e of this.transactions.values()) if (e.state === "completed") for (let t of e.mutations) t.optimistic && this.isThisCollection(t.collection) && i.has(t.key) && c.set(t.key, {
					type: t.type,
					value: t.modified
				});
				for (let e of i) {
					let t = a.get(e), n = this.get(e), r = c.get(e), i = !1;
					r && (r.type === "delete" && t !== void 0 && n === void 0 && j(r.value, t) || n !== void 0 && j(r.value, n)) && (i = !0), i || (t === void 0 && n !== void 0 ? o.push({
						type: "insert",
						key: e,
						value: n
					}) : t !== void 0 && n === void 0 ? o.push({
						type: "delete",
						key: e,
						value: t
					}) : t !== void 0 && n !== void 0 && !j(t, n) && o.push({
						type: "update",
						key: e,
						value: n,
						previousValue: t
					}));
				}
				this.size = this.calculateSize(), o.length > 0 && this.indexes.updateIndexes(o), this.changes.emitEvents(o, !0), this.pendingSyncedTransactions = n, this.preSyncVisibleState.clear(), Promise.resolve().then(() => {
					this.recentlySyncedKeys.clear();
				}), this.hasReceivedFirstCommit ||= !0;
			}
		}, this.config = e, this.transactions = new ui((e, t) => e.compareCreatedAt(t)), this.syncedData = new ui(e.compare);
	}
	setDeps(e) {
		this.collection = e.collection, this.lifecycle = e.lifecycle, this.changes = e.changes, this.indexes = e.indexes, this._events = e.events;
	}
	get(e) {
		let { optimisticDeletes: t, optimisticUpserts: n, syncedData: r } = this;
		if (!t.has(e)) return n.has(e) ? n.get(e) : r.get(e);
	}
	has(e) {
		let { optimisticDeletes: t, optimisticUpserts: n, syncedData: r } = this;
		return t.has(e) ? !1 : n.has(e) ? !0 : r.has(e);
	}
	*keys() {
		let { syncedData: e, optimisticDeletes: t, optimisticUpserts: n } = this;
		for (let n of e.keys()) t.has(n) || (yield n);
		for (let r of n.keys()) !e.has(r) && !t.has(r) && (yield r);
	}
	*values() {
		for (let e of this.keys()) {
			let t = this.get(e);
			t !== void 0 && (yield t);
		}
	}
	*entries() {
		for (let e of this.keys()) {
			let t = this.get(e);
			t !== void 0 && (yield [e, t]);
		}
	}
	*[Symbol.iterator]() {
		for (let [e, t] of this.entries()) yield [e, t];
	}
	forEach(e) {
		let t = 0;
		for (let [n, r] of this.entries()) e(r, n, t++);
	}
	map(e) {
		let t = [], n = 0;
		for (let [r, i] of this.entries()) t.push(e(i, r, n++));
		return t;
	}
	isThisCollection(e) {
		return e === this.collection;
	}
	recomputeOptimisticState(e = !1) {
		if (this.isCommittingSyncTransactions && !e) return;
		let t = new Map(this.optimisticUpserts), n = new Set(this.optimisticDeletes);
		this.optimisticUpserts.clear(), this.optimisticDeletes.clear();
		let r = [];
		for (let e of this.transactions.values()) ["completed", "failed"].includes(e.state) || r.push(e);
		for (let e of r) for (let t of e.mutations) if (this.isThisCollection(t.collection) && t.optimistic) switch (t.type) {
			case "insert":
			case "update":
				this.optimisticUpserts.set(t.key, t.modified), this.optimisticDeletes.delete(t.key);
				break;
			case "delete": this.optimisticUpserts.delete(t.key), this.optimisticDeletes.add(t.key);
		}
		this.size = this.calculateSize();
		let i = [];
		this.collectOptimisticChanges(t, n, i);
		let a = i.filter((t) => !(this.recentlySyncedKeys.has(t.key) && !e));
		if (this.pendingSyncedTransactions.length > 0 && !e) {
			let t = /* @__PURE__ */ new Set();
			for (let e of this.pendingSyncedTransactions) for (let n of e.operations) t.add(n.key);
			let n = a.filter((e) => !(e.type === "delete" && t.has(e.key) && !r.some((t) => t.mutations.some((t) => this.isThisCollection(t.collection) && t.key === e.key))));
			n.length > 0 && this.indexes.updateIndexes(n), this.changes.emitEvents(n, e);
		} else a.length > 0 && this.indexes.updateIndexes(a), this.changes.emitEvents(a, e);
	}
	calculateSize() {
		let e = this.syncedData.size, t = Array.from(this.optimisticDeletes).filter((e) => this.syncedData.has(e) && !this.optimisticUpserts.has(e)).length, n = Array.from(this.optimisticUpserts.keys()).filter((e) => !this.syncedData.has(e)).length;
		return e - t + n;
	}
	collectOptimisticChanges(e, t, n) {
		let r = /* @__PURE__ */ new Set([
			...e.keys(),
			...this.optimisticUpserts.keys(),
			...t,
			...this.optimisticDeletes
		]);
		for (let i of r) {
			let r = this.get(i), a = this.getPreviousValue(i, e, t);
			a !== void 0 && r === void 0 ? n.push({
				type: "delete",
				key: i,
				value: a
			}) : a === void 0 && r !== void 0 ? n.push({
				type: "insert",
				key: i,
				value: r
			}) : a !== void 0 && r !== void 0 && a !== r && n.push({
				type: "update",
				key: i,
				value: r,
				previousValue: a
			});
		}
	}
	getPreviousValue(e, t, n) {
		if (!n.has(e)) return t.has(e) ? t.get(e) : this.syncedData.get(e);
	}
	scheduleTransactionCleanup(e) {
		e.state === "completed" ? this.transactions.delete(e.id) : e.isPersisted.promise.then(() => {
			this.transactions.delete(e.id);
		}).catch(() => {});
	}
	capturePreSyncVisibleState() {
		if (this.pendingSyncedTransactions.length === 0) return;
		let e = /* @__PURE__ */ new Set();
		for (let t of this.pendingSyncedTransactions) for (let n of t.operations) e.add(n.key);
		for (let t of e) this.recentlySyncedKeys.add(t);
		for (let t of e) if (!this.preSyncVisibleState.has(t)) {
			let e = this.get(t);
			e !== void 0 && this.preSyncVisibleState.set(t, e);
		}
	}
	onTransactionStateChange() {
		this.changes.shouldBatchEvents = this.pendingSyncedTransactions.length > 0, this.capturePreSyncVisibleState(), this.recomputeOptimisticState(!1);
	}
	cleanup() {
		this.syncedData.clear(), this.syncedMetadata.clear(), this.optimisticUpserts.clear(), this.optimisticDeletes.clear(), this.size = 0, this.pendingSyncedTransactions = [], this.syncedKeys.clear(), this.hasReceivedFirstCommit = !1;
	}
}, fi = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Map();
	}
	on(e, t) {
		return this.listeners.has(e) || this.listeners.set(e, /* @__PURE__ */ new Set()), this.listeners.get(e).add(t), () => {
			this.listeners.get(e)?.delete(t);
		};
	}
	once(e, t) {
		let n = this.on(e, (e) => {
			t(e), n();
		});
		return n;
	}
	off(e, t) {
		this.listeners.get(e)?.delete(t);
	}
	waitFor(e, t) {
		return new Promise((n, r) => {
			let i, a = this.on(e, (e) => {
				i &&= (clearTimeout(i), void 0), n(e), a();
			});
			t && (i = setTimeout(() => {
				i = void 0, a(), r(/* @__PURE__ */ Error(`Timeout waiting for event ${String(e)}`));
			}, t));
		});
	}
	emitInner(e, t) {
		this.listeners.get(e)?.forEach((e) => {
			try {
				e(t);
			} catch (e) {
				queueMicrotask(() => {
					throw e;
				});
			}
		});
	}
	clearListeners() {
		this.listeners.clear();
	}
};
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/utils/cursor.js
function pi(e, t) {
	if (t.length === 0 || e.length === 0) return;
	if (e.length === 1) {
		let { expression: n, compareOptions: r } = e[0];
		return (r.direction === "asc" ? Nr : Fr)(n, new a(t[0]));
	}
	let n = [];
	for (let r = 0; r < e.length && r < t.length; r++) {
		let i = e[r], o = t[r], s = [];
		for (let n = 0; n < r; n++) {
			let r = e[n], i = t[n];
			s.push(Mr(r.expression, new a(i)));
		}
		let c = (i.compareOptions.direction === "asc" ? Nr : Fr)(i.expression, new a(o));
		if (s.length === 0) n.push(c);
		else {
			let e = [...s, c];
			n.push(e.reduce((e, t) => Ir(e, t)));
		}
	}
	return n.length === 1 ? n[0] : n.reduce((e, t) => Lr(e, t));
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/collection/subscription.js
var mi = class extends fi {
	constructor(e, t, n) {
		super(), this.collection = e, this.callback = t, this.options = n, this.loadedInitialState = !1, this.skipFiltering = !1, this.snapshotSent = !1, this.loadedSubsets = [], this.sentKeys = /* @__PURE__ */ new Set(), this.limitedSnapshotRowCount = 0, this._status = "ready", this.pendingLoadSubsetPromises = /* @__PURE__ */ new Set(), this.isBufferingForTruncate = !1, this.truncateBuffer = [], this.pendingTruncateRefetches = /* @__PURE__ */ new Set(), n.onUnsubscribe && this.on("unsubscribed", (e) => n.onUnsubscribe(e)), n.whereExpression && Ur(n.whereExpression, this.collection);
		let r = (e) => {
			t(e), this.trackSentKeys(e);
		};
		this.callback = r, this.filteredCallback = n.whereExpression ? si(this.callback, n) : this.callback, this.truncateCleanup = this.collection.on("truncate", () => {
			this.handleTruncate();
		});
	}
	get status() {
		return this._status;
	}
	handleTruncate() {
		let e = [...this.loadedSubsets], t = this.collection._sync.syncLoadSubsetFn !== null;
		e.length === 0 || !t ? (this.snapshotSent = !1, this.loadedInitialState = !1, this.limitedSnapshotRowCount = 0, this.lastSentKey = void 0, this.loadedSubsets = []) : (this.isBufferingForTruncate = !0, this.truncateBuffer = [], this.pendingTruncateRefetches.clear(), this.snapshotSent = !1, this.loadedInitialState = !1, this.limitedSnapshotRowCount = 0, this.lastSentKey = void 0, this.loadedSubsets = [], queueMicrotask(() => {
			if (this.isBufferingForTruncate) {
				for (let t of e) {
					let e = this.collection._sync.loadSubset(t);
					this.loadedSubsets.push(t), this.trackLoadSubsetPromise(e), e instanceof Promise && (this.pendingTruncateRefetches.add(e), e.catch(() => {}).finally(() => {
						this.pendingTruncateRefetches.delete(e), this.checkTruncateRefetchComplete();
					}));
				}
				this.pendingTruncateRefetches.size === 0 && this.flushTruncateBuffer();
			}
		}));
	}
	checkTruncateRefetchComplete() {
		this.pendingTruncateRefetches.size === 0 && this.isBufferingForTruncate && this.flushTruncateBuffer();
	}
	flushTruncateBuffer() {
		this.isBufferingForTruncate = !1;
		let e = this.truncateBuffer.flat();
		e.length > 0 && this.filteredCallback(e), this.truncateBuffer = [];
	}
	setOrderByIndex(e) {
		this.orderByIndex = e;
	}
	setStatus(e) {
		if (this._status === e) return;
		let t = this._status;
		this._status = e, this.emitInner("status:change", {
			type: "status:change",
			subscription: this,
			previousStatus: t,
			status: e
		});
		let n = `status:${e}`;
		this.emitInner(n, {
			type: n,
			subscription: this,
			previousStatus: t,
			status: e
		});
	}
	trackLoadSubsetPromise(e) {
		e instanceof Promise && (this.pendingLoadSubsetPromises.add(e), this.setStatus("loadingSubset"), e.finally(() => {
			this.pendingLoadSubsetPromises.delete(e), this.pendingLoadSubsetPromises.size === 0 && this.setStatus("ready");
		}));
	}
	hasLoadedInitialState() {
		return this.loadedInitialState;
	}
	hasSentAtLeastOneSnapshot() {
		return this.snapshotSent;
	}
	emitEvents(e) {
		let t = this.filterAndFlipChanges(e);
		this.isBufferingForTruncate ? t.length > 0 && this.truncateBuffer.push(t) : this.filteredCallback(t);
	}
	requestSnapshot(e) {
		if (this.loadedInitialState) return !1;
		let t = {
			where: this.options.whereExpression,
			optimizedOnly: e?.optimizedOnly ?? !1
		};
		if (e) {
			if ("where" in e) {
				let n = e.where;
				if (t.where) {
					let e = t.where;
					t.where = Ir(e, n);
				} else t.where = n;
			}
		} else this.loadedInitialState = !0;
		let n = {
			where: t.where,
			subscription: this,
			orderBy: e?.orderBy,
			limit: e?.limit
		}, r = this.collection._sync.loadSubset(n);
		e?.onLoadSubsetResult?.(r), this.loadedSubsets.push(n), (e?.trackLoadSubsetPromise ?? !0) && this.trackLoadSubsetPromise(r);
		let i = this.collection.currentStateAsChanges(t);
		if (i === void 0) return !1;
		let a = i.filter((e) => !this.sentKeys.has(e.key));
		for (let e of a) this.sentKeys.add(e.key);
		return this.snapshotSent = !0, this.callback(a), !0;
	}
	requestLimitedSnapshot({ orderBy: e, limit: t, minValues: n, offset: r, trackLoadSubsetPromise: o = !0, onLoadSubsetResult: s }) {
		if (!t) throw Error("limit is required");
		if (!this.orderByIndex) throw Error("Ordered snapshot was requested but no index was found. You have to call setOrderByIndex before requesting an ordered snapshot.");
		let c = n !== void 0 && n.length > 0, l = n?.[0], u = this.orderByIndex, d = this.options.whereExpression, f = d ? X(d) : void 0, p = (e) => {
			if (e !== void 0 && this.sentKeys.has(e)) return !1;
			let t = this.collection.get(e);
			return t === void 0 ? !1 : f?.(t) ?? !0;
		}, m = l, h = [], g = [];
		if (c) {
			let { expression: n } = e[0], r = this.collection.currentStateAsChanges({ where: Mr(n, new a(l)) });
			if (r) {
				let e = r.map((e) => e.key).filter((e) => !this.sentKeys.has(e) && p(e));
				g.push(...e);
				let n = u.take(t - g.length, l, p);
				g.push(...n);
			} else g = u.take(t, l, p);
		} else g = u.takeFromStart(t, p);
		let _ = () => Math.max(t - h.length, 0), v = () => g.length === 0, y = e[0].expression, ee = y.type === "ref" ? A(new i(y.path), !0) : null;
		for (; _() > 0 && !v();) {
			let e = /* @__PURE__ */ new Set();
			for (let t of g) {
				let n = this.collection.get(t);
				h.push({
					type: "insert",
					key: t,
					value: n
				}), m = ee ? ee(n) : n, e.add(t);
			}
			g = u.take(_(), m, p);
		}
		let te = this.limitedSnapshotRowCount;
		for (let e of h) this.sentKeys.add(e.key);
		this.callback(h), this.limitedSnapshotRowCount += h.length, h.length > 0 && (this.lastSentKey = h[h.length - 1].key);
		let b;
		if (n !== void 0 && n.length > 0) {
			let t = pi(e, n);
			if (t) {
				let { expression: r } = e[0], i = n[0], o;
				if (i instanceof Date) {
					let e = new Date(i.getTime() + 1);
					o = Ir(Pr(r, new a(i)), Fr(r, new a(e)));
				} else o = Mr(r, new a(i));
				b = {
					whereFrom: t,
					whereCurrent: o,
					lastKey: this.lastSentKey
				};
			}
		}
		let ne = {
			where: d,
			limit: t,
			orderBy: e,
			cursor: b,
			offset: r ?? te,
			subscription: this
		}, re = this.collection._sync.loadSubset(ne);
		s?.(re), this.loadedSubsets.push(ne), o && this.trackLoadSubsetPromise(re);
	}
	filterAndFlipChanges(e) {
		if (this.loadedInitialState || this.skipFiltering) return e;
		let t = this.isBufferingForTruncate, n = [];
		for (let r of e) {
			let e = r;
			if (!this.sentKeys.has(r.key)) {
				if (r.type === "update") e = {
					...r,
					type: "insert",
					previousValue: void 0
				};
				else if (r.type === "delete" && !t) continue;
				this.sentKeys.add(r.key);
			} else if (r.type === "insert") continue;
			else r.type === "delete" && this.sentKeys.delete(r.key);
			n.push(e);
		}
		return n;
	}
	trackSentKeys(e) {
		if (!(this.loadedInitialState || this.skipFiltering)) {
			for (let t of e) t.type === "delete" ? this.sentKeys.delete(t.key) : this.sentKeys.add(t.key);
			this.orderByIndex && (this.limitedSnapshotRowCount = Math.max(this.limitedSnapshotRowCount, this.sentKeys.size));
		}
	}
	markAllStateAsSeen() {
		this.skipFiltering = !0;
	}
	unsubscribe() {
		this.truncateCleanup?.(), this.truncateCleanup = void 0, this.isBufferingForTruncate = !1, this.truncateBuffer = [], this.pendingTruncateRefetches.clear();
		for (let e of this.loadedSubsets) this.collection._sync.unloadSubset(e);
		this.loadedSubsets = [], this.emitInner("unsubscribed", {
			type: "unsubscribed",
			subscription: this
		}), this.clearListeners();
	}
}, hi = class {
	constructor() {
		this.activeSubscribersCount = 0, this.changeSubscriptions = /* @__PURE__ */ new Set(), this.batchedEvents = [], this.shouldBatchEvents = !1;
	}
	setDeps(e) {
		this.lifecycle = e.lifecycle, this.sync = e.sync, this.events = e.events, this.collection = e.collection;
	}
	emitEmptyReadyEvent() {
		for (let e of this.changeSubscriptions) e.emitEvents([]);
	}
	emitEvents(e, t = !1) {
		if (this.shouldBatchEvents && !t) {
			this.batchedEvents.push(...e);
			return;
		}
		let n = e;
		if (t && (this.batchedEvents.length > 0 && (n = [...this.batchedEvents, ...e]), this.batchedEvents = [], this.shouldBatchEvents = !1), n.length !== 0) for (let e of this.changeSubscriptions) e.emitEvents(n);
	}
	subscribeChanges(e, t = {}) {
		if (this.addSubscriber(), t.where && t.whereExpression) throw Error("Cannot specify both 'where' and 'whereExpression' options. Use one or the other.");
		let { where: n, ...r } = t, i = r.whereExpression;
		n && (i = J(n(Or())));
		let a = new mi(this.collection, e, {
			...r,
			whereExpression: i,
			onUnsubscribe: () => {
				this.removeSubscriber(), this.changeSubscriptions.delete(a);
			}
		});
		return t.onStatusChange && a.on("status:change", t.onStatusChange), t.includeInitialState ? a.requestSnapshot({
			trackLoadSubsetPromise: !1,
			orderBy: t.orderBy,
			limit: t.limit,
			onLoadSubsetResult: t.onLoadSubsetResult
		}) : t.includeInitialState === !1 && a.markAllStateAsSeen(), this.changeSubscriptions.add(a), a;
	}
	addSubscriber() {
		let e = this.activeSubscribersCount;
		this.activeSubscribersCount++, this.lifecycle.cancelGCTimer(), (this.lifecycle.status === "cleaned-up" || this.lifecycle.status === "idle") && this.sync.startSync(), this.events.emitSubscribersChange(this.activeSubscribersCount, e);
	}
	removeSubscriber() {
		let e = this.activeSubscribersCount;
		if (this.activeSubscribersCount--, this.activeSubscribersCount === 0) this.lifecycle.startGCTimer();
		else if (this.activeSubscribersCount < 0) throw new ae();
		this.events.emitSubscribersChange(this.activeSubscribersCount, e);
	}
	cleanup() {
		this.batchedEvents = [], this.shouldBatchEvents = !1;
	}
}, gi = (e) => setTimeout(() => {
	e({
		didTimeout: !0,
		timeRemaining: () => 50
	});
}, 0), _i = (e) => {
	clearTimeout(e);
}, vi = typeof window < "u" && "requestIdleCallback" in window ? (e, t) => window.requestIdleCallback(e, t) : (e, t) => gi(e), yi = typeof window < "u" && "cancelIdleCallback" in window ? (e) => window.cancelIdleCallback(e) : _i, bi = class {
	constructor(e, t) {
		this.status = "idle", this.hasBeenReady = !1, this.hasReceivedFirstCommit = !1, this.onFirstReadyCallbacks = [], this.gcTimeoutId = null, this.idleCallbackId = null, this.config = e, this.id = t;
	}
	setDeps(e) {
		this.indexes = e.indexes, this.events = e.events, this.changes = e.changes, this.sync = e.sync, this.state = e.state;
	}
	validateStatusTransition(e, t) {
		if (e !== t && !{
			idle: [
				"loading",
				"error",
				"cleaned-up"
			],
			loading: [
				"ready",
				"error",
				"cleaned-up"
			],
			ready: ["cleaned-up", "error"],
			error: ["cleaned-up", "idle"],
			"cleaned-up": ["loading", "error"]
		}[e].includes(t)) throw new re(e, t, this.id);
	}
	setStatus(e, t = !1) {
		if (e === "ready" && !t) throw new b("You can't directly call \"setStatus('ready'). You must use markReady instead.");
		this.validateStatusTransition(this.status, e);
		let n = this.status;
		this.status = e, e === "ready" && !this.indexes.isIndexesResolved && this.indexes.resolveAllIndexes().catch((e) => {
			console.warn(`${this.config.id ? `[${this.config.id}] ` : ""}Failed to resolve indexes:`, e);
		}), this.events.emitStatusChange(e, n);
	}
	validateCollectionUsable(e) {
		switch (this.status) {
			case "error": throw new ne(e, this.id);
			case "cleaned-up": this.sync.startSync();
		}
	}
	markReady() {
		if (this.validateStatusTransition(this.status, "ready"), this.status === "loading") {
			if (this.setStatus("ready", !0), !this.hasBeenReady) {
				this.hasBeenReady = !0, this.hasReceivedFirstCommit ||= !0;
				let e = [...this.onFirstReadyCallbacks];
				this.onFirstReadyCallbacks = [], e.forEach((e) => e());
			}
			this.changes.changeSubscriptions.size > 0 && this.changes.emitEmptyReadyEvent();
		}
	}
	startGCTimer() {
		this.gcTimeoutId && clearTimeout(this.gcTimeoutId);
		let e = this.config.gcTime ?? 3e5;
		e <= 0 || !Number.isFinite(e) || (this.gcTimeoutId = setTimeout(() => {
			this.changes.activeSubscribersCount === 0 && this.scheduleIdleCleanup();
		}, e));
	}
	cancelGCTimer() {
		this.gcTimeoutId &&= (clearTimeout(this.gcTimeoutId), null), this.idleCallbackId !== null && (yi(this.idleCallbackId), this.idleCallbackId = null);
	}
	scheduleIdleCleanup() {
		this.idleCallbackId !== null && yi(this.idleCallbackId), this.idleCallbackId = vi((e) => {
			this.changes.activeSubscribersCount === 0 ? this.performCleanup(e) && (this.idleCallbackId = null) : this.idleCallbackId = null;
		}, { timeout: 1e3 });
	}
	performCleanup(e) {
		if (!e || e.timeRemaining() > 0 || e.didTimeout) {
			this.sync.cleanup(), this.state.cleanup(), this.changes.cleanup(), this.indexes.cleanup(), this.gcTimeoutId &&= (clearTimeout(this.gcTimeoutId), null), this.hasBeenReady = !1;
			let e = [...this.onFirstReadyCallbacks];
			return this.onFirstReadyCallbacks = [], e.forEach((e) => {
				try {
					e();
				} catch (e) {
					console.error(`${this.config.id ? `[${this.config.id}] ` : ""}Error in onFirstReady callback during cleanup:`, e);
				}
			}), this.setStatus("cleaned-up"), this.events.cleanup(), !0;
		}
		return this.scheduleIdleCleanup(), !1;
	}
	onFirstReady(e) {
		this.hasBeenReady ? e() : this.onFirstReadyCallbacks.push(e);
	}
	cleanup() {
		this.idleCallbackId !== null && (yi(this.idleCallbackId), this.idleCallbackId = null), this.performCleanup();
	}
}, xi = /* @__PURE__ */ Symbol("liveQueryInternal"), Si = class {
	constructor(e, t) {
		this.preloadPromise = null, this.syncCleanupFn = null, this.syncLoadSubsetFn = null, this.syncUnloadSubsetFn = null, this.pendingLoadSubsetPromises = /* @__PURE__ */ new Set(), this.config = e, this.id = t, this.syncMode = e.syncMode ?? "eager";
	}
	setDeps(e) {
		this.collection = e.collection, this.state = e.state, this.lifecycle = e.lifecycle, this._events = e.events;
	}
	startSync() {
		if (this.lifecycle.status === "idle" || this.lifecycle.status === "cleaned-up") {
			this.lifecycle.setStatus("loading");
			try {
				let e = Ci(this.config.sync.sync({
					collection: this.collection,
					begin: (e) => {
						this.state.pendingSyncedTransactions.push({
							committed: !1,
							operations: [],
							deletedKeys: /* @__PURE__ */ new Set(),
							immediate: e?.immediate
						});
					},
					write: (e) => {
						let t = this.state.pendingSyncedTransactions[this.state.pendingSyncedTransactions.length - 1];
						if (!t) throw new we();
						if (t.committed) throw new Te();
						let n;
						n = "key" in e ? e.key : this.config.getKey(e.value);
						let r = e.type;
						if (e.type === "insert") {
							let i = this.state.syncedData.has(n), a = t.deletedKeys.has(n), o = t.truncate === !0;
							if (i && !a && !o) {
								let t = this.state.syncedData.get(n);
								if (t !== void 0 && j(t, e.value)) r = "update";
								else {
									let e = this.config.utils[xi];
									throw new le(n, this.id, {
										hasCustomGetKey: e?.hasCustomGetKey ?? !1,
										hasJoins: e?.hasJoins ?? !1,
										hasDistinct: e?.hasDistinct ?? !1
									});
								}
							}
						}
						let i = {
							...e,
							type: r,
							key: n
						};
						t.operations.push(i), r === "delete" && t.deletedKeys.add(n);
					},
					commit: () => {
						let e = this.state.pendingSyncedTransactions[this.state.pendingSyncedTransactions.length - 1];
						if (!e) throw new Ee();
						if (e.committed) throw new De();
						e.committed = !0, this.state.commitPendingTransactions();
					},
					markReady: () => {
						this.lifecycle.markReady();
					},
					truncate: () => {
						let e = this.state.pendingSyncedTransactions[this.state.pendingSyncedTransactions.length - 1];
						if (!e) throw new we();
						if (e.committed) throw new Te();
						e.operations = [], e.deletedKeys.clear(), e.truncate = !0, e.optimisticSnapshot = {
							upserts: new Map(this.state.optimisticUpserts),
							deletes: new Set(this.state.optimisticDeletes)
						};
					}
				}));
				if (this.syncCleanupFn = e?.cleanup ?? null, this.syncLoadSubsetFn = e?.loadSubset ?? null, this.syncUnloadSubsetFn = e?.unloadSubset ?? null, this.syncMode === "on-demand" && !this.syncLoadSubsetFn) throw new _(`Collection "${this.id}" is configured with syncMode "on-demand" but the sync function did not return a loadSubset handler. Either provide a loadSubset handler or use syncMode "eager".`);
			} catch (e) {
				throw this.lifecycle.setStatus("error"), e;
			}
		}
	}
	preload() {
		return this.preloadPromise ||= (this.syncMode === "on-demand" && console.warn(`${this.id ? `[${this.id}] ` : ""}Calling .preload() on a collection with syncMode "on-demand" is a no-op. In on-demand mode, data is only loaded when queries request it. Instead, create a live query and call .preload() on that to load the specific data you need. See https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync for more details.`), new Promise((e, t) => {
			if (this.lifecycle.status === "ready") e();
			else if (this.lifecycle.status === "error") t(new ie());
			else if (this.lifecycle.onFirstReady(() => {
				e();
			}), this.lifecycle.status === "idle" || this.lifecycle.status === "cleaned-up") try {
				this.startSync();
			} catch (e) {
				t(e);
				return;
			}
		})), this.preloadPromise;
	}
	get isLoadingSubset() {
		return this.pendingLoadSubsetPromises.size > 0;
	}
	trackLoadPromise(e) {
		let t = !this.isLoadingSubset;
		this.pendingLoadSubsetPromises.add(e), t && this._events.emit("loadingSubset:change", {
			type: "loadingSubset:change",
			collection: this.collection,
			isLoadingSubset: !0,
			previousIsLoadingSubset: !1,
			loadingSubsetTransition: "start"
		}), e.finally(() => {
			let t = this.pendingLoadSubsetPromises.size === 1 && this.pendingLoadSubsetPromises.has(e);
			this.pendingLoadSubsetPromises.delete(e), t && this._events.emit("loadingSubset:change", {
				type: "loadingSubset:change",
				collection: this.collection,
				isLoadingSubset: !1,
				previousIsLoadingSubset: !0,
				loadingSubsetTransition: "end"
			});
		});
	}
	loadSubset(e) {
		if (this.syncMode === "eager") return !0;
		if (this.syncLoadSubsetFn) {
			let t = this.syncLoadSubsetFn(e);
			if (t instanceof Promise) return this.trackLoadPromise(t), t;
		}
		return !0;
	}
	unloadSubset(e) {
		this.syncUnloadSubsetFn && this.syncUnloadSubsetFn(e);
	}
	cleanup() {
		try {
			this.syncCleanupFn &&= (this.syncCleanupFn(), null);
		} catch (e) {
			queueMicrotask(() => {
				if (e instanceof Error) {
					let t = new it(this.id, e);
					throw t.cause = e, t.stack = e.stack, t;
				}
				throw new it(this.id, e);
			});
		}
		this.preloadPromise = null;
	}
};
function Ci(e) {
	if (typeof e == "function") return { cleanup: e };
	if (typeof e == "object") return e;
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/indexes/lazy-index.js
function wi(e) {
	return typeof e == "function" && e.prototype !== void 0 && e.prototype.constructor === e;
}
async function Ti(e) {
	return wi(e) ? e : await e();
}
var Ei = class {
	constructor(e, t, n, r, i, a) {
		this.id = e, this.expression = t, this.name = n, this.resolver = r, this.options = i, this.collectionEntries = a, this.indexPromise = null, this.resolvedIndex = null, wi(this.resolver) && (this.resolvedIndex = new this.resolver(this.id, this.expression, this.name, this.options), this.collectionEntries && this.resolvedIndex.build(this.collectionEntries));
	}
	async resolve() {
		return this.resolvedIndex ||= (this.indexPromise ||= this.createIndex(), await this.indexPromise), this.resolvedIndex;
	}
	isResolved() {
		return this.resolvedIndex !== null;
	}
	getResolved() {
		if (!this.resolvedIndex) throw Error(`Index ${this.id} has not been resolved yet. Ensure collection is synced.`);
		return this.resolvedIndex;
	}
	getId() {
		return this.id;
	}
	getName() {
		return this.name;
	}
	getExpression() {
		return this.expression;
	}
	async createIndex() {
		return new (await (Ti(this.resolver)))(this.id, this.expression, this.name, this.options);
	}
}, Di = class {
	constructor(e, t) {
		this.indexId = e, this.lazyIndex = t;
	}
	get index() {
		return this.lazyIndex.getResolved();
	}
	get isReady() {
		return this.lazyIndex.isResolved();
	}
	async whenReady() {
		return await this.lazyIndex.resolve();
	}
	get id() {
		return this.indexId;
	}
	get name() {
		return this.isReady ? this.index.name : this.lazyIndex.getName();
	}
	get expression() {
		return this.lazyIndex.getExpression();
	}
	supports(e) {
		return this.index.supports(e);
	}
	getStats() {
		return this.index.getStats();
	}
	matchesField(e) {
		let t = this.expression;
		return t.type === "ref" && t.path.length === e.length && t.path.every((t, n) => t === e[n]);
	}
	get keyCount() {
		return this.index.keyCount;
	}
	get indexedKeysSet() {
		return this.index.indexedKeysSet;
	}
	get orderedEntriesArray() {
		return this.index.orderedEntriesArray;
	}
	get valueMapData() {
		return this.index.valueMapData;
	}
	equalityLookup(e) {
		return this.index.equalityLookup?.(e) ?? /* @__PURE__ */ new Set();
	}
	rangeQuery(e) {
		return this.index.rangeQuery?.(e) ?? /* @__PURE__ */ new Set();
	}
	inArrayLookup(e) {
		return this.index.inArrayLookup?.(e) ?? /* @__PURE__ */ new Set();
	}
	_getLazyWrapper() {
		return this.lazyIndex;
	}
}, Oi = class {
	constructor() {
		this.lazyIndexes = /* @__PURE__ */ new Map(), this.resolvedIndexes = /* @__PURE__ */ new Map(), this.isIndexesResolved = !1, this.indexCounter = 0;
	}
	setDeps(e) {
		this.state = e.state, this.lifecycle = e.lifecycle;
	}
	createIndex(e, t = {}) {
		this.lifecycle.validateCollectionUsable("createIndex");
		let n = ++this.indexCounter, r = J(e(Or())), i = t.indexType ?? Br, a = new Ei(n, r, t.name, i, t.options, this.state.entries());
		if (this.lazyIndexes.set(n, a), i === Br) try {
			let e = a.getResolved();
			this.resolvedIndexes.set(n, e);
		} catch (e) {
			console.warn("Failed to resolve BTreeIndex:", e);
		}
		else if (typeof i == "function" && i.prototype) try {
			let e = a.getResolved();
			this.resolvedIndexes.set(n, e);
		} catch {
			this.resolveSingleIndex(n, a).catch((e) => {
				console.warn("Failed to resolve single index:", e);
			});
		}
		else this.isIndexesResolved && this.resolveSingleIndex(n, a).catch((e) => {
			console.warn("Failed to resolve single index:", e);
		});
		return new Di(n, a);
	}
	async resolveAllIndexes() {
		if (this.isIndexesResolved) return;
		let e = Array.from(this.lazyIndexes.entries()).map(async ([e, t]) => {
			let n = await t.resolve();
			return n.build(this.state.entries()), this.resolvedIndexes.set(e, n), {
				indexId: e,
				resolvedIndex: n
			};
		});
		await Promise.all(e), this.isIndexesResolved = !0;
	}
	async resolveSingleIndex(e, t) {
		let n = await t.resolve();
		return n.build(this.state.entries()), this.resolvedIndexes.set(e, n), n;
	}
	get indexes() {
		return this.resolvedIndexes;
	}
	updateIndexes(e) {
		for (let t of this.resolvedIndexes.values()) for (let n of e) switch (n.type) {
			case "insert":
				t.add(n.key, n.value);
				break;
			case "update":
				n.previousValue ? t.update(n.key, n.previousValue, n.value) : t.add(n.key, n.value);
				break;
			case "delete": t.remove(n.key, n.value);
		}
	}
	cleanup() {
		this.lazyIndexes.clear(), this.resolvedIndexes.clear();
	}
}, ki = /* @__PURE__ */ new Set([
	"find",
	"findLast",
	"findIndex",
	"findLastIndex",
	"filter",
	"map",
	"flatMap",
	"forEach",
	"some",
	"every",
	"reduce",
	"reduceRight"
]), Ai = /* @__PURE__ */ new Set([
	"pop",
	"push",
	"shift",
	"unshift",
	"splice",
	"sort",
	"reverse",
	"fill",
	"copyWithin"
]), ji = /* @__PURE__ */ new Set([
	"set",
	"delete",
	"clear",
	"add"
]), Mi = /* @__PURE__ */ new Set([
	"entries",
	"keys",
	"values",
	"forEach"
]);
function Ni(e) {
	return typeof e == "object" && !!e && !(e instanceof Date) && !(e instanceof RegExp) && !M(e);
}
function Pi(e, t, n, r) {
	if (ki.has(e)) return function(...i) {
		let a = i[0];
		if (typeof a != "function") return t.apply(n.copy_, i);
		let o = (e, t) => {
			if (Ni(e)) {
				let { proxy: i } = r(e, {
					tracker: n,
					prop: String(t)
				});
				return i;
			}
			return e;
		}, s = function(e, t, n) {
			let r = o(e, t);
			return a.call(this, r, t, n);
		};
		if (e === "reduce" || e === "reduceRight") return t.apply(n.copy_, [function(e, t, n, r) {
			let i = o(t, n);
			return a.call(this, e, i, n, r);
		}, ...i.slice(1)]);
		let c = t.apply(n.copy_, [s, ...i.slice(1)]);
		if ((e === "find" || e === "findLast") && c && typeof c == "object") {
			let e = n.copy_.indexOf(c);
			if (e !== -1) return o(c, e);
		}
		return e === "filter" && Array.isArray(c) ? c.map((e) => {
			let t = n.copy_.indexOf(e);
			return t === -1 ? e : o(e, t);
		}) : c;
	};
}
function Fi(e, t) {
	return function() {
		let n = e.copy_, r = 0;
		return {
			next() {
				if (r >= n.length) return {
					done: !0,
					value: void 0
				};
				let i = n[r], a = i;
				if (Ni(i)) {
					let { proxy: n } = t(i, {
						tracker: e,
						prop: String(r)
					});
					a = n;
				}
				return r++, {
					done: !1,
					value: a
				};
			},
			[Symbol.iterator]() {
				return this;
			}
		};
	};
}
function Ii(e, t, n) {
	return function(...r) {
		let i = e.apply(t.copy_, r);
		return n(t), i;
	};
}
function Li(e, t, n, r, i, a, o) {
	if (Mi.has(e) || t === Symbol.iterator) return function(...s) {
		let c = n.apply(i.copy_, s);
		if (e === "forEach") {
			let e = s[0];
			if (typeof e == "function") return n.apply(r, [function(t, n, r) {
				let a = e.call(this, t, n, r);
				return o(i), a;
			}, ...s.slice(1)]);
		}
		if (e === "entries" || e === "values" || e === Symbol.iterator.toString() || t === Symbol.iterator) {
			let n = c, o = /* @__PURE__ */ new Map();
			if (e === "values" && r instanceof Map) for (let [e, t] of i.copy_.entries()) o.set(t, e);
			let s = /* @__PURE__ */ new Map();
			if (r instanceof Set) for (let e of i.copy_.values()) s.set(e, e);
			return {
				next() {
					let c = n.next();
					if (!c.done && c.value && typeof c.value == "object") {
						if (e === "entries" && Array.isArray(c.value) && c.value.length === 2) {
							if (c.value[1] && typeof c.value[1] == "object") {
								let e = c.value[0], t = {
									tracker: i,
									prop: e,
									updateMap: (t) => {
										i.copy_ instanceof Map && i.copy_.set(e, t);
									}
								}, { proxy: n } = a(c.value[1], t);
								c.value[1] = n;
							}
						} else if (e === "values" || e === Symbol.iterator.toString() || t === Symbol.iterator) {
							if (e === "values" && r instanceof Map) {
								let e = o.get(c.value);
								if (e !== void 0) {
									let t = {
										tracker: i,
										prop: e,
										updateMap: (t) => {
											i.copy_ instanceof Map && i.copy_.set(e, t);
										}
									}, { proxy: n } = a(c.value, t);
									c.value = n;
								}
							} else if (r instanceof Set) {
								let e = c.value, t = {
									tracker: i,
									prop: e,
									updateSet: (t) => {
										i.copy_ instanceof Set && (i.copy_.delete(e), i.copy_.add(t), s.set(e, t));
									}
								}, { proxy: n } = a(c.value, t);
								c.value = n;
							} else {
								let e = /* @__PURE__ */ Symbol("iterator-value"), { proxy: t } = a(c.value, {
									tracker: i,
									prop: e
								});
								c.value = t;
							}
						}
					}
					return c;
				},
				[Symbol.iterator]() {
					return this;
				}
			};
		}
		return c;
	};
}
function Z(...e) {
	let t = typeof window < "u" && typeof localStorage < "u";
	(t && localStorage.getItem("DEBUG") === "true" || !t && typeof process < "u" && process.env.DEBUG === "true") && console.log("[proxy]", ...e);
}
function Q(e, t = /* @__PURE__ */ new WeakMap()) {
	if (typeof e != "object" || !e) return e;
	if (t.has(e)) return t.get(e);
	if (e instanceof Date) return new Date(e.getTime());
	if (e instanceof RegExp) return new RegExp(e.source, e.flags);
	if (Array.isArray(e)) {
		let n = [];
		return t.set(e, n), e.forEach((e, r) => {
			n[r] = Q(e, t);
		}), n;
	}
	if (ArrayBuffer.isView(e) && !(e instanceof DataView)) {
		let n = Object.getPrototypeOf(e).constructor, r = new n(e.length);
		t.set(e, r);
		for (let t = 0; t < e.length; t++) r[t] = e[t];
		return r;
	}
	if (e instanceof Map) {
		let n = /* @__PURE__ */ new Map();
		return t.set(e, n), e.forEach((e, r) => {
			n.set(r, Q(e, t));
		}), n;
	}
	if (e instanceof Set) {
		let n = /* @__PURE__ */ new Set();
		return t.set(e, n), e.forEach((e) => {
			n.add(Q(e, t));
		}), n;
	}
	if (M(e)) return e;
	let n = {};
	t.set(e, n);
	for (let r in e) Object.prototype.hasOwnProperty.call(e, r) && (n[r] = Q(e[r], t));
	let r = Object.getOwnPropertySymbols(e);
	for (let i of r) n[i] = Q(e[i], t);
	return n;
}
var Ri = 0;
function zi() {
	return Ri += 1, Ri;
}
function Bi(e, t) {
	let n = /* @__PURE__ */ new Map();
	function r(e, t) {
		if (Z("Object ID:", e.constructor.name), n.has(e)) return n.get(e);
		{
			let r = Bi(e, t);
			return n.set(e, r), r;
		}
	}
	let i = /* @__PURE__ */ new Map(), a = {
		copy_: Q(e),
		originalObject: Q(e),
		proxyCount: zi(),
		modified: !1,
		assigned_: {},
		parent: t,
		target: e
	};
	Z("createChangeProxy called for target", e, a.proxyCount);
	function o(e) {
		e.modified ||= !0, e.parent && (Z("propagating change to parent"), "updateMap" in e.parent ? e.parent.updateMap(e.copy_) : "updateSet" in e.parent ? e.parent.updateSet(e.copy_) : (e.parent.tracker.copy_[e.parent.prop] = e.copy_, e.parent.tracker.assigned_[e.parent.prop] = !0), o(e.parent.tracker));
	}
	function s(e) {
		if (Z("checkIfReverted called with assigned keys:", Object.keys(e.assigned_)), Object.keys(e.assigned_).length === 0 && Object.getOwnPropertySymbols(e.assigned_).length === 0) return Z("No assigned properties, returning true"), !0;
		for (let t in e.assigned_) if (e.assigned_[t] === !0) {
			let n = e.copy_[t], r = e.originalObject[t];
			if (Z(`Checking property ${String(t)}, current:`, n, "original:", r), !j(n, r)) return Z(`Property ${String(t)} is different, returning false`), !1;
		} else if (e.assigned_[t] === !1) return Z(`Property ${String(t)} was deleted, returning false`), !1;
		let t = Object.getOwnPropertySymbols(e.assigned_);
		for (let n of t) if (e.assigned_[n] === !0) {
			let t = e.copy_[n], r = e.originalObject[n];
			if (!j(t, r)) return Z("Symbol property is different, returning false"), !1;
		} else if (e.assigned_[n] === !1) return Z("Symbol property was deleted, returning false"), !1;
		return Z("All properties match original values, returning true"), !0;
	}
	function c(e, t) {
		Z("checkParentStatus called for child prop:", t);
		let n = s(e);
		Z("Parent checkIfReverted returned:", n), n && (Z("Parent is fully reverted, clearing tracking"), e.modified = !1, e.assigned_ = {}, e.parent && (Z("Continuing up the parent chain"), c(e.parent.tracker, e.parent.prop)));
	}
	function l(e) {
		if (Z("createObjectProxy", e), i.has(e)) return Z("proxyCache found match"), i.get(e);
		let n = new Proxy(e, {
			get(e, t) {
				Z("get", e, t);
				let n = a.copy_[t] ?? a.originalObject[t], s = a.originalObject[t];
				if (Z("value (at top of proxy get)", n), Object.getOwnPropertyDescriptor(e, t)?.get) return n;
				if (typeof n == "function") {
					if (Array.isArray(e)) {
						let e = t.toString();
						if (Ai.has(e)) return Ii(n, a, o);
						let i = Pi(e, n, a, r);
						if (i) return i;
						if (t === Symbol.iterator) return Fi(a, r);
					}
					if (e instanceof Map || e instanceof Set) {
						let i = t.toString();
						if (ji.has(i)) return Ii(n, a, o);
						let s = Li(i, t, n, e, a, r, o);
						if (s) return s;
					}
					return n.bind(e);
				}
				if (Ni(n)) {
					let { proxy: e } = r(s, {
						tracker: a,
						prop: String(t)
					});
					return i.set(n, e), e;
				}
				return n;
			},
			set(e, n, r) {
				let i = a.copy_[n];
				if (Z(`set called for property ${String(n)}, current:`, i, "new:", r), j(i, r)) Z("Value unchanged, not tracking");
				else {
					let e = a.originalObject[n], i = j(r, e);
					if (Z("value:", r, "original:", e, "isRevertToOriginal:", i), i) {
						Z(`Reverting property ${String(n)} to original value`), delete a.assigned_[n.toString()], Z(`Updating copy with original value for ${String(n)}`), a.copy_[n] = Q(e), Z("Checking if all properties reverted");
						let r = s(a);
						Z("All reverted:", r), r ? (Z("All properties reverted, clearing tracking"), a.modified = !1, a.assigned_ = {}, t && (Z("Updating parent for property:", t.prop), c(t.tracker, t.prop))) : (Z("Some properties still changed, keeping modified flag"), a.modified = !0);
					} else Z(`Setting new value for property ${String(n)}`), a.copy_[n] = r, a.assigned_[n.toString()] = !0, Z("Marking object and ancestors as modified", a), o(a);
				}
				return !0;
			},
			defineProperty(e, t, n) {
				let r = Reflect.defineProperty(e, t, n);
				return r && "value" in n && (a.copy_[t] = Q(n.value), a.assigned_[t.toString()] = !0, o(a)), r;
			},
			getOwnPropertyDescriptor(e, t) {
				return Reflect.getOwnPropertyDescriptor(e, t);
			},
			preventExtensions(e) {
				return Reflect.preventExtensions(e);
			},
			isExtensible(e) {
				return Reflect.isExtensible(e);
			},
			deleteProperty(e, t) {
				Z("deleteProperty", e, t);
				let n = typeof t == "symbol" ? t.toString() : t;
				if (n in e) {
					let r = n in a.originalObject, i = Reflect.deleteProperty(e, t);
					return i && (r ? (a.assigned_[n] = !1, o(a)) : (delete a.assigned_[n], Object.keys(a.assigned_).length === 0 && Object.getOwnPropertySymbols(a.assigned_).length === 0 ? a.modified = !1 : a.modified = !0)), i;
				}
				return !0;
			}
		});
		return i.set(e, n), n;
	}
	return {
		proxy: l(a.copy_),
		getChanges: () => {
			if (Z("getChanges called, modified:", a.modified), Z(a), !a.modified) return Z("Object not modified, returning empty object"), {};
			if (typeof a.copy_ != "object" || Array.isArray(a.copy_) || Object.keys(a.assigned_).length === 0) return a.copy_;
			let e = {};
			for (let t in a.copy_) a.assigned_[t] === !0 && t in a.copy_ && (e[t] = a.copy_[t]);
			return Z("Returning copy:", e), e;
		}
	};
}
function Vi(e) {
	let t = e.map((e) => Bi(e));
	return {
		proxies: t.map((e) => e.proxy),
		getChanges: () => t.map((e) => e.getChanges())
	};
}
function Hi(e, t) {
	let { proxy: n, getChanges: r } = Bi(e);
	return t(n), r();
}
function Ui(e, t) {
	let { proxies: n, getChanges: r } = Vi(e);
	return t(n), r();
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/deferred.js
function Wi() {
	let e, t, n = !0;
	return {
		promise: new Promise((r, i) => {
			e = (e) => {
				n = !1, r(e);
			}, t = (e) => {
				n = !1, i(e);
			};
		}),
		resolve: e,
		reject: t,
		isPending: () => n
	};
}
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/scheduler.js
function Gi(e) {
	return typeof e == "object" && !!e && typeof e.hasPendingGraphRun == "function";
}
var Ki = new class {
	constructor() {
		this.contexts = /* @__PURE__ */ new Map(), this.clearListeners = /* @__PURE__ */ new Set();
	}
	getOrCreateContext(e) {
		let t = this.contexts.get(e);
		return t || (t = {
			queue: [],
			jobs: /* @__PURE__ */ new Map(),
			dependencies: /* @__PURE__ */ new Map(),
			completed: /* @__PURE__ */ new Set()
		}, this.contexts.set(e, t)), t;
	}
	schedule({ contextId: e, jobId: t, dependencies: n, run: r }) {
		if (e === void 0) {
			r();
			return;
		}
		let i = this.getOrCreateContext(e);
		if (i.jobs.has(t) || i.queue.push(t), i.jobs.set(t, r), n) {
			let e = new Set(n);
			e.delete(t), i.dependencies.set(t, e);
		} else i.dependencies.has(t) || i.dependencies.set(t, /* @__PURE__ */ new Set());
		i.completed.delete(t);
	}
	flush(e) {
		let t = this.contexts.get(e);
		if (!t) return;
		let { queue: n, jobs: r, dependencies: i, completed: a } = t;
		for (; n.length > 0;) {
			let t = !1, o = n.length;
			for (let s = 0; s < o; s++) {
				let o = n.shift(), s = r.get(o);
				if (!s) {
					i.delete(o), a.delete(o);
					continue;
				}
				let c = i.get(o), l = !c;
				if (c) {
					l = !0;
					for (let t of c) {
						if (t === o) continue;
						let n = Gi(t) && t.hasPendingGraphRun(e);
						if (r.has(t) && !a.has(t) || !r.has(t) && n) {
							l = !1;
							break;
						}
					}
				}
				l ? (r.delete(o), i.delete(o), s(), a.add(o), t = !0) : n.push(o);
			}
			if (!t) throw Error(`Scheduler detected unresolved dependencies for context ${String(e)}.`);
		}
		this.contexts.delete(e);
	}
	flushAll() {
		for (let e of Array.from(this.contexts.keys())) this.flush(e);
	}
	clear(e) {
		this.contexts.delete(e), this.clearListeners.forEach((t) => t(e));
	}
	onClear(e) {
		return this.clearListeners.add(e), () => this.clearListeners.delete(e);
	}
	hasPendingJobs(e) {
		let t = this.contexts.get(e);
		return !!t && t.jobs.size > 0;
	}
	clearJob(e, t) {
		let n = this.contexts.get(e);
		n && (n.jobs.delete(t), n.dependencies.delete(t), n.completed.delete(t), n.queue = n.queue.filter((e) => e !== t), n.jobs.size === 0 && this.contexts.delete(e));
	}
}(), qi = [], Ji = [], Yi = 0;
function Xi(e, t) {
	switch (`${e.type}-${t.type}`) {
		case "insert-update": return {
			...e,
			type: "insert",
			original: {},
			modified: t.modified,
			changes: {
				...e.changes,
				...t.changes
			},
			key: e.key,
			globalKey: e.globalKey,
			metadata: t.metadata ?? e.metadata,
			syncMetadata: {
				...e.syncMetadata,
				...t.syncMetadata
			},
			mutationId: t.mutationId,
			updatedAt: t.updatedAt
		};
		case "insert-delete": return null;
		case "update-delete": return t;
		case "update-update": return {
			...t,
			original: e.original,
			changes: {
				...e.changes,
				...t.changes
			},
			metadata: t.metadata ?? e.metadata,
			syncMetadata: {
				...e.syncMetadata,
				...t.syncMetadata
			}
		};
		case "delete-delete":
		case "insert-insert": return t;
		default: {
			let n = `${e.type}-${t.type}`;
			throw Error(`Unhandled mutation combination: ${n}`);
		}
	}
}
function Zi(e) {
	let t = new na(e);
	return qi.push(t), t;
}
function Qi() {
	if (Ji.length > 0) return Ji.slice(-1)[0];
}
function $i(e) {
	Ki.clear(e.id), Ji.push(e);
}
function ea(e) {
	try {
		Ki.flush(e.id);
	} finally {
		Ji = Ji.filter((t) => t.id !== e.id);
	}
}
function ta(e) {
	let t = qi.findIndex((t) => t.id === e.id);
	t !== -1 && qi.splice(t, 1);
}
var na = class {
	constructor(e) {
		if (e.mutationFn === void 0) throw new be();
		this.id = e.id ?? crypto.randomUUID(), this.mutationFn = e.mutationFn, this.state = "pending", this.mutations = [], this.isPersisted = Wi(), this.autoCommit = e.autoCommit ?? !0, this.createdAt = /* @__PURE__ */ new Date(), this.sequenceNumber = Yi++, this.metadata = e.metadata ?? {};
	}
	setState(e) {
		this.state = e, (e === "completed" || e === "failed") && ta(this);
	}
	mutate(e) {
		if (this.state !== "pending") throw new xe();
		$i(this);
		try {
			e();
		} finally {
			ea(this);
		}
		return this.autoCommit && this.commit().catch(() => {}), this;
	}
	applyMutations(e) {
		for (let t of e) {
			let e = this.mutations.findIndex((e) => e.globalKey === t.globalKey);
			if (e >= 0) {
				let n = this.mutations[e], r = Xi(n, t);
				r === null ? this.mutations.splice(e, 1) : this.mutations[e] = r;
			} else this.mutations.push(t);
		}
	}
	rollback(e) {
		let t = e?.isSecondaryRollback ?? !1;
		if (this.state === "completed") throw new Se();
		if (this.setState("failed"), !t) {
			let e = /* @__PURE__ */ new Set();
			this.mutations.forEach((t) => e.add(t.globalKey));
			for (let t of qi) t.state === "pending" && t.mutations.some((t) => e.has(t.globalKey)) && t.rollback({ isSecondaryRollback: !0 });
		}
		return this.isPersisted.reject(this.error?.error), this.touchCollection(), this;
	}
	touchCollection() {
		let e = /* @__PURE__ */ new Set();
		for (let t of this.mutations) e.has(t.collection.id) || (t.collection._state.onTransactionStateChange(), t.collection._state.pendingSyncedTransactions.length > 0 && t.collection._state.commitPendingTransactions(), e.add(t.collection.id));
	}
	async commit() {
		if (this.state !== "pending") throw new Ce();
		if (this.setState("persisting"), this.mutations.length === 0) return this.setState("completed"), this.isPersisted.resolve(this), this;
		try {
			await this.mutationFn({ transaction: this }), this.setState("completed"), this.touchCollection(), this.isPersisted.resolve(this);
		} catch (e) {
			let t = e instanceof Error ? e : Error(String(e));
			throw this.error = {
				message: t.message,
				error: t
			}, this.rollback(), t;
		}
		return this;
	}
	compareCreatedAt(e) {
		let t = this.createdAt.getTime() - e.createdAt.getTime();
		return t === 0 ? this.sequenceNumber - e.sequenceNumber : t;
	}
}, ra = class {
	constructor(e, t) {
		this.insert = (e, t) => {
			this.lifecycle.validateCollectionUsable("insert");
			let n = this.state, r = Qi();
			if (!r && !this.config.onInsert) throw new _e();
			let i = Array.isArray(e) ? e : [e], a = [], o = /* @__PURE__ */ new Set();
			if (i.forEach((e) => {
				let n = this.validateData(e, "insert"), r = this.config.getKey(n);
				if (this.state.has(r) || o.has(r)) throw new ce(r);
				o.add(r);
				let i = this.generateGlobalKey(r, e), s = {
					mutationId: crypto.randomUUID(),
					original: {},
					modified: n,
					changes: Object.fromEntries(Object.keys(e).map((e) => [e, n[e]])),
					globalKey: i,
					key: r,
					metadata: t?.metadata,
					syncMetadata: this.config.sync.getSyncMetadata?.() || {},
					optimistic: t?.optimistic ?? !0,
					type: "insert",
					createdAt: /* @__PURE__ */ new Date(),
					updatedAt: /* @__PURE__ */ new Date(),
					collection: this.collection
				};
				a.push(s);
			}), r) return r.applyMutations(a), n.transactions.set(r.id, r), n.scheduleTransactionCleanup(r), n.recomputeOptimisticState(!0), r;
			{
				let e = Zi({ mutationFn: async (e) => await this.config.onInsert({
					transaction: e.transaction,
					collection: this.collection
				}) });
				return e.applyMutations(a), e.commit().catch(() => void 0), n.transactions.set(e.id, e), n.scheduleTransactionCleanup(e), n.recomputeOptimisticState(!0), e;
			}
		}, this.delete = (e, t) => {
			let n = this.state;
			this.lifecycle.validateCollectionUsable("delete");
			let r = Qi();
			if (!r && !this.config.onDelete) throw new ye();
			if (Array.isArray(e) && e.length === 0) throw new me();
			let i = Array.isArray(e) ? e : [e], a = [];
			for (let e of i) {
				if (!this.state.has(e)) throw new he(e);
				let r = this.generateGlobalKey(e, this.state.get(e)), i = {
					mutationId: crypto.randomUUID(),
					original: this.state.get(e),
					modified: this.state.get(e),
					changes: this.state.get(e),
					globalKey: r,
					key: e,
					metadata: t?.metadata,
					syncMetadata: n.syncedMetadata.get(e) || {},
					optimistic: t?.optimistic ?? !0,
					type: "delete",
					createdAt: /* @__PURE__ */ new Date(),
					updatedAt: /* @__PURE__ */ new Date(),
					collection: this.collection
				};
				a.push(i);
			}
			if (r) return r.applyMutations(a), n.transactions.set(r.id, r), n.scheduleTransactionCleanup(r), n.recomputeOptimisticState(!0), r;
			let o = Zi({
				autoCommit: !0,
				mutationFn: async (e) => this.config.onDelete({
					transaction: e.transaction,
					collection: this.collection
				})
			});
			return o.applyMutations(a), o.commit().catch(() => void 0), n.transactions.set(o.id, o), n.scheduleTransactionCleanup(o), n.recomputeOptimisticState(!0), o;
		}, this.id = t, this.config = e;
	}
	setDeps(e) {
		this.lifecycle = e.lifecycle, this.state = e.state, this.collection = e.collection;
	}
	ensureStandardSchema(e) {
		if (e && "~standard" in e) return e;
		throw new ee();
	}
	validateData(e, t, n) {
		if (!this.config.schema) return e;
		let r = this.ensureStandardSchema(this.config.schema);
		if (t === "update" && n) {
			let i = this.state.get(n);
			if (i && e && typeof e == "object" && typeof i == "object") {
				let n = Object.assign({}, i, e), a = r["~standard"].validate(n);
				if (a instanceof Promise) throw new te();
				if ("issues" in a && a.issues) throw new g(t, a.issues.map((e) => ({
					message: e.message,
					path: e.path?.map((e) => String(e))
				})));
				let o = a.value, s = Object.keys(e);
				return Object.fromEntries(s.map((e) => [e, o[e]]));
			}
		}
		let i = r["~standard"].validate(e);
		if (i instanceof Promise) throw new te();
		if ("issues" in i && i.issues) throw new g(t, i.issues.map((e) => ({
			message: e.message,
			path: e.path?.map((e) => String(e))
		})));
		return i.value;
	}
	generateGlobalKey(e, t) {
		if (typeof e != "string" && typeof e != "number") throw e === void 0 ? new oe(t) : new se(e, t);
		return `KEY::${this.id}/${e}`;
	}
	update(e, t, n) {
		if (e === void 0) throw new ue();
		let r = this.state;
		this.lifecycle.validateCollectionUsable("update");
		let i = Qi();
		if (!i && !this.config.onUpdate) throw new ve();
		let a = Array.isArray(e), o = a ? e : [e];
		if (a && o.length === 0) throw new de();
		let s = typeof t == "function" ? t : n, c = typeof t == "function" ? {} : t, l = o.map((e) => {
			let t = this.state.get(e);
			if (!t) throw new fe(e);
			return t;
		}), u;
		u = a ? Ui(l, s) : [Hi(l[0], s)];
		let d = o.map((e, t) => {
			let n = u[t];
			if (!n || Object.keys(n).length === 0) return null;
			let i = l[t], a = this.validateData(n, "update", e), o = Object.assign({}, i, a), s = this.config.getKey(i), d = this.config.getKey(o);
			if (s !== d) throw new pe(s, d);
			let f = this.generateGlobalKey(d, o);
			return {
				mutationId: crypto.randomUUID(),
				original: i,
				modified: o,
				changes: Object.fromEntries(Object.keys(n).map((e) => [e, o[e]])),
				globalKey: f,
				key: e,
				metadata: c.metadata,
				syncMetadata: r.syncedMetadata.get(e) || {},
				optimistic: c.optimistic ?? !0,
				type: "update",
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date(),
				collection: this.collection
			};
		}).filter(Boolean);
		if (d.length === 0) {
			let e = Zi({ mutationFn: async () => {} });
			return e.commit().catch(() => void 0), r.scheduleTransactionCleanup(e), e;
		}
		if (i) return i.applyMutations(d), r.transactions.set(i.id, i), r.scheduleTransactionCleanup(i), r.recomputeOptimisticState(!0), i;
		let f = Zi({ mutationFn: async (e) => this.config.onUpdate({
			transaction: e.transaction,
			collection: this.collection
		}) });
		return f.applyMutations(d), f.commit().catch(() => void 0), r.transactions.set(f.id, f), r.scheduleTransactionCleanup(f), r.recomputeOptimisticState(!0), f;
	}
}, ia = class extends fi {
	constructor() {
		super();
	}
	setDeps(e) {
		this.collection = e.collection;
	}
	emit(e, t) {
		this.emitInner(e, t);
	}
	emitStatusChange(e, t) {
		this.emit("status:change", {
			type: "status:change",
			collection: this.collection,
			previousStatus: t,
			status: e
		});
		let n = `status:${e}`;
		this.emit(n, {
			type: n,
			collection: this.collection,
			previousStatus: t,
			status: e
		});
	}
	emitSubscribersChange(e, t) {
		this.emit("subscribers:change", {
			type: "subscribers:change",
			collection: this.collection,
			previousSubscriberCount: t,
			subscriberCount: e
		});
	}
	cleanup() {
		this.clearListeners();
	}
};
// node_modules/.bun/@tanstack+db@0.5.32+8e24a2f921b8d7be/node_modules/@tanstack/db/dist/esm/collection/index.js
function aa(e) {
	let t = new oa(e);
	return t.utils = e.utils ? e.utils : {}, t;
}
var oa = class {
	constructor(e) {
		if (this.utils = {}, this.insert = (e, t) => this._mutations.insert(e, t), this.delete = (e, t) => this._mutations.delete(e, t), !e) throw new v();
		if (!e.sync) throw new y();
		this.id = e.id ? e.id : crypto.randomUUID(), this.config = {
			...e,
			autoIndex: e.autoIndex ?? "eager"
		}, this._changes = new hi(), this._events = new ia(), this._indexes = new Oi(), this._lifecycle = new bi(e, this.id), this._mutations = new ra(e, this.id), this._state = new di(e), this._sync = new Si(e, this.id), this.comparisonOpts = sa(e), this._changes.setDeps({
			collection: this,
			lifecycle: this._lifecycle,
			sync: this._sync,
			events: this._events
		}), this._events.setDeps({ collection: this }), this._indexes.setDeps({
			state: this._state,
			lifecycle: this._lifecycle
		}), this._lifecycle.setDeps({
			changes: this._changes,
			events: this._events,
			indexes: this._indexes,
			state: this._state,
			sync: this._sync
		}), this._mutations.setDeps({
			collection: this,
			lifecycle: this._lifecycle,
			state: this._state
		}), this._state.setDeps({
			collection: this,
			lifecycle: this._lifecycle,
			changes: this._changes,
			indexes: this._indexes,
			events: this._events
		}), this._sync.setDeps({
			collection: this,
			state: this._state,
			lifecycle: this._lifecycle,
			events: this._events
		}), e.startSync === !0 && this._sync.startSync();
	}
	get status() {
		return this._lifecycle.status;
	}
	get subscriberCount() {
		return this._changes.activeSubscribersCount;
	}
	onFirstReady(e) {
		return this._lifecycle.onFirstReady(e);
	}
	isReady() {
		return this._lifecycle.status === "ready";
	}
	get isLoadingSubset() {
		return this._sync.isLoadingSubset;
	}
	startSyncImmediate() {
		this._sync.startSync();
	}
	preload() {
		return this._sync.preload();
	}
	get(e) {
		return this._state.get(e);
	}
	has(e) {
		return this._state.has(e);
	}
	get size() {
		return this._state.size;
	}
	*keys() {
		yield* this._state.keys();
	}
	*values() {
		yield* this._state.values();
	}
	*entries() {
		yield* this._state.entries();
	}
	*[Symbol.iterator]() {
		yield* this._state[Symbol.iterator]();
	}
	forEach(e) {
		return this._state.forEach(e);
	}
	map(e) {
		return this._state.map(e);
	}
	getKeyFromItem(e) {
		return this.config.getKey(e);
	}
	createIndex(e, t = {}) {
		return this._indexes.createIndex(e, t);
	}
	get indexes() {
		return this._indexes.indexes;
	}
	validateData(e, t, n) {
		return this._mutations.validateData(e, t, n);
	}
	get compareOptions() {
		return { ...this.comparisonOpts };
	}
	update(e, t, n) {
		return this._mutations.update(e, t, n);
	}
	get state() {
		let e = /* @__PURE__ */ new Map();
		for (let [t, n] of this.entries()) e.set(t, n);
		return e;
	}
	stateWhenReady() {
		return this.size > 0 || this.isReady() ? Promise.resolve(this.state) : this.preload().then(() => this.state);
	}
	get toArray() {
		return Array.from(this.values());
	}
	toArrayWhenReady() {
		return this.size > 0 || this.isReady() ? Promise.resolve(this.toArray) : this.preload().then(() => this.toArray);
	}
	currentStateAsChanges(e = {}) {
		return oi(this, e);
	}
	subscribeChanges(e, t = {}) {
		return this._changes.subscribeChanges(e, t);
	}
	on(e, t) {
		return this._events.on(e, t);
	}
	once(e, t) {
		return this._events.once(e, t);
	}
	off(e, t) {
		this._events.off(e, t);
	}
	waitFor(e, t) {
		return this._events.waitFor(e, t);
	}
	async cleanup() {
		return this._lifecycle.cleanup(), Promise.resolve();
	}
};
function sa(e) {
	if (e.defaultStringCollation) {
		let t = e.defaultStringCollation;
		return {
			stringSort: t.stringSort ?? "locale",
			locale: t.stringSort === "locale" ? t.locale : void 0,
			localeOptions: t.stringSort === "locale" ? t.localeOptions : void 0
		};
	}
	return { stringSort: "locale" };
}
// packages/pstdio-dashboard/src/lib/sync/collection-indexes.ts
var ca = (e, t) => {
	for (let [n, r] of e ?? []) for (let e of t.changes) {
		let t = e.previousValue?.[n], i = r.get(t);
		if (i?.delete(e.key), i?.size === 0 && r.delete(t), !e.value) continue;
		let a = e.value[n], o = r.get(a) ?? /* @__PURE__ */ new Set();
		o.add(e.key), r.set(a, o);
	}
}, la = [
	"board_views",
	"board_default_views",
	"settings",
	"projects",
	"installed_extension_sources",
	"notifications",
	"extension_instances",
	"sessions",
	"workspaces",
	"files",
	"workspace_sessions"
], ua = 0, da = (t = e()) => {
	let n = ++ua, r = !1, i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), c = new Set(la), l = /* @__PURE__ */ new Map(), u = 0, d = /* @__PURE__ */ new Map(), f = !1, p = (e) => {
		e && (ca(l.get(e.table), e), d.set(e.table, (d.get(e.table) ?? 0) + 1)), u += 1;
		for (let t of s) t(e);
	}, m = () => u, h = () => f, g = () => {
		f || (f = !0, p());
	}, _ = (e) => (s.add(e), () => {
		s.delete(e);
	}), v = (e) => {
		let t = a.get(e);
		return t || (t = aa({
			id: `runtime-${n}:${e}`,
			getKey: (e) => e.id,
			gcTime: 0,
			sync: { sync: ({ begin: t, write: n, commit: i, markReady: s }) => {
				let c = /* @__PURE__ */ new Set();
				return o.set(e, {
					truncateAndWrite: (o) => {
						if (r) return;
						let s = new Map(o.map((e) => [e.id, e])), l = [...c].map((t) => ({
							key: t,
							previousValue: a.get(e)?.get(t),
							value: s.get(t)
						}));
						l.push(...o.filter((e) => !c.has(e.id)).map((e) => ({
							key: e.id,
							value: e
						}))), t();
						for (let e of c) n({
							type: "delete",
							key: e
						});
						c.clear();
						for (let e of o) n({
							type: "insert",
							value: e
						}), c.add(e.id);
						i(), p({
							type: "snapshot",
							table: e,
							changes: l
						});
					},
					upsert: (o) => {
						if (r) return;
						let s = a.get(e)?.get(o.id);
						t({ immediate: !0 }), n({
							type: c.has(o.id) ? "update" : "insert",
							value: o
						}), c.add(o.id), i(), p({
							type: "row",
							table: e,
							changes: [{
								key: o.id,
								previousValue: s,
								value: o
							}]
						});
					},
					remove: (o) => {
						if (r) return;
						let s = a.get(e)?.get(o);
						t({ immediate: !0 }), n({
							type: "delete",
							key: o
						}), c.delete(o), i(), p({
							type: "row",
							table: e,
							changes: [{
								key: o,
								previousValue: s
							}]
						});
					}
				}), s(), () => {
					o.delete(e);
				};
			} }
		}), a.set(e, t), t.preload(), t);
	}, y = (e) => v(e), ee = (e, t, n) => {
		let r = y(e), i = l.get(e);
		i || (i = /* @__PURE__ */ new Map(), l.set(e, i));
		let a = i.get(t);
		if (!a) {
			a = /* @__PURE__ */ new Map(), i.set(t, a);
			for (let e of r.values()) {
				let n = a.get(e[t]) ?? /* @__PURE__ */ new Set();
				n.add(e.id), a.set(e[t], n);
			}
		}
		return [...a.get(n) ?? []].flatMap((e) => {
			let t = r.get(e);
			return t ? [t] : [];
		});
	}, te = (e) => {
		if (!r && c.has(e)) return v(e), o.get(e);
	}, b = () => {
		for (let e of la) v(e);
		return a;
	}, ne = async () => {
		r = !0;
		for (let e of i) e();
		i.clear(), s.clear(), l.clear(), o.clear(), await Promise.all([...a.values()].map((e) => e.cleanup())), a.clear();
	};
	return {
		id: n,
		connection: { ...t },
		getCollection: y,
		getWriter: te,
		getAllCollections: b,
		getIndexedRows: ee,
		getCollectionsVersion: m,
		getCollectionVersion: (e) => d.get(e) ?? 0,
		isInitialCollectionsSyncComplete: h,
		markInitialCollectionsSyncComplete: g,
		subscribeCollections: _,
		dispose: ne,
		isDisposed: () => r,
		onDispose: (e) => (i.add(e), () => {
			i.delete(e);
		})
	};
}, fa = /* @__PURE__ */ new Map(), pa = (e) => {
	let t = JSON.stringify(e), n = fa.get(t);
	return n || (n = {
		collections: da(e),
		connections: 0
	}, fa.set(t, n)), n;
}, $ = (t = e()) => pa(t).collections, ma = (e) => $().getCollection(e), ha = (e) => $().getWriter(e), ga = (e, t, n) => $().getIndexedRows(e, t, n), _a = () => $().getCollectionsVersion(), va = () => $().isInitialCollectionsSyncComplete(), ya = () => $().markInitialCollectionsSyncComplete(), ba = (e) => $().subscribeCollections(e), xa = (e) => e;
export { je as $, Mn as A, E as B, jr as C, d as Ct, B as D, Rn as E, F, Ie as G, ze as H, Zt as I, Ye as J, Le as K, j as L, Nn as M, R as N, Pn as O, I as P, Ae as Q, A as R, Ar as S, c as St, W as T, Fe as U, ot as V, Be as W, qe as X, Xe as Y, Je as Z, Zr as _, r as _t, $ as a, Oe as at, Rr as b, m as bt, ya as c, ke as ct, aa as d, Qe as dt, Pe as et, Qi as f, Ke as ft, Y as g, i as gt, ii as h, o as ht, ga as i, ct as it, L as j, z as k, ba as l, st as lt, xi as m, n as mt, ma as n, Me as nt, ha as o, Ne as ot, Ki as p, s as pt, Ze as q, _a as r, Re as rt, va as s, lt as st, xa as t, Ge as tt, oa as u, Ve as ut, Hr as v, a as vt, J as w, kr as x, l as xt, Mr as y, f as yt, xt as z };
