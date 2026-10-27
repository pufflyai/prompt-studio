// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { v as e } from "./lucide-react-CiGXWUCb.ts";
import { t } from "./type-S9Ew_SX2.ts";
import { t as n } from "./circle-check-QpR5K4qp.ts";
import { n as r } from "./user-round-BbCM7Opj.ts";
import { t as i } from "./tooltip-BweQW627.ts";
import { t as a } from "./highlighted-text-CaWxQuWj.ts";
import { t as o } from "./param-editor-387PxPNF.ts";
import { isValidElement as s, useEffect as c, useState as l } from "react";
import { Icon as u, Text as d } from "@chakra-ui/react";
import { jsx as f } from "react/jsx-runtime";
// packages/pstdio-api-contracts/src/extension-kernel/data-table-values.ts
var p = (e, t) => typeof e != "object" || !e ? e : "display" in e ? "sortValue" in e ? e.sortValue : void 0 : t?.type === "diff" && "additions" in e && "deletions" in e && typeof e.additions == "number" && typeof e.deletions == "number" ? e.additions + e.deletions : e, m = (e, t = {}) => {
	if (t.type) return t.type;
	if (t.renderer?.type === "date") return "date";
	let n = e.map((e) => p(e, t.renderer)).filter((e) => e != null);
	return n.length > 0 && n.every((e) => typeof e == "number") ? "number" : "string";
}, h = (e) => typeof e == "object" && !!e && typeof e.additions == "number" && typeof e.deletions == "number", g = [
	{
		unit: "year",
		seconds: 31536e3
	},
	{
		unit: "month",
		seconds: 2592e3
	},
	{
		unit: "day",
		seconds: 86400
	},
	{
		unit: "hour",
		seconds: 3600
	},
	{
		unit: "minute",
		seconds: 60
	}
], ee = (e) => {
	if (typeof e != "string") return null;
	let t = Date.parse(e);
	return Number.isNaN(t) ? null : new Date(t);
}, _ = (e, t = /* @__PURE__ */ new Date(), n) => {
	let r = ee(e);
	if (!r) return null;
	let i = new Intl.RelativeTimeFormat(n, { numeric: "auto" }), a = (r.getTime() - t.getTime()) / 1e3, o = g.find((e) => Math.abs(a) >= e.seconds);
	return o ? i.format(Math.round(a / o.seconds), o.unit) : i.format(0, "second");
}, te = (e) => {
	let { value: t, search: n = "" } = e, [r, o] = l(() => /* @__PURE__ */ new Date());
	c(() => {
		let e = setInterval(() => o(/* @__PURE__ */ new Date()), 6e4);
		return () => clearInterval(e);
	}, []);
	let s = _(t, r), u = new Date(t).toLocaleString(void 0, {
		dateStyle: "medium",
		timeStyle: "short"
	});
	return /* @__PURE__ */ f(i, {
		content: u,
		children: /* @__PURE__ */ f(d, {
			as: "span",
			tabIndex: 0,
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			whiteSpace: "nowrap",
			children: /* @__PURE__ */ f(a, {
				text: s ?? "",
				query: n
			})
		})
	});
}, ne = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i, re = /(^|\s)(avatar|image|logo|photo|picture|thumbnail)(\s|$)/i, ie = (e) => {
	let t = e.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
	return t ? `${t[0]?.toUpperCase()}${t.slice(1)}` : "Details";
}, v = (e) => e.map((e) => /^\d+$/.test(e) ? e : ie(e)).join(" / "), ae = (e) => e.every((e) => typeof e != "object" || !e), y = (e, t, n) => {
	if (Array.isArray(e)) {
		if (e.length === 0 || ae(e)) {
			n.push({
				label: v(t),
				value: e
			});
			return;
		}
		e.forEach((e, r) => {
			y(e, [...t, String(r + 1)], n);
		});
	} else if (typeof e == "object" && e) {
		let r = Object.entries(e);
		if (r.length === 0) {
			n.push({
				label: v(t),
				value: null
			});
			return;
		}
		r.forEach(([e, r]) => {
			y(r, [...t, e], n);
		});
	} else n.push({
		label: v(t),
		value: e
	});
}, oe = (e) => {
	if (typeof e != "string") return e;
	try {
		return JSON.parse(e);
	} catch {
		return e;
	}
}, b = (e) => {
	let t = [];
	return y(oe(e), [], t), t.map((e) => ({
		...e,
		label: e.label || "Value"
	}));
}, x = (e, t) => {
	if (typeof e != "string") return !1;
	if (e.startsWith("data:image/")) return !0;
	try {
		let n = new URL(e);
		return n.protocol !== "http:" && n.protocol !== "https:" ? !1 : ne.test(n.pathname) || re.test(t);
	} catch {
		return !1;
	}
}, S = (e, t) => Array.isArray(e) && e.length > 0 && e.every((e) => x(e, t)), se = (e) => e == null || e === "" ? "Not provided" : typeof e == "boolean" ? e ? "Yes" : "No" : String(e), ce = (e) => Array.isArray(e) ? e.length === 0 ? "None" : e.map(se).join(", ") : se(e), le = (e) => {
	let t = oe(e);
	if (Array.isArray(t) && t.length === 0 || typeof t == "object" && t && Object.keys(t).length === 0) return "No details";
	let n = b(e).filter((e) => !x(e.value, e.label) && !S(e.value, e.label));
	if (n.length === 0) return "No details";
	let r = n.slice(0, 2).map((e) => ce(e.value)), i = n.length - r.length;
	return [...r, i > 0 ? `${i} more` : null].filter(Boolean).join(" · ");
}, ue = (e) => {
	let { label: t, value: n } = e;
	return x(n, t) ? {
		type: "image",
		src: String(n),
		alt: `${t} preview`
	} : Array.isArray(n) && S(n, t) ? {
		type: "image-gallery",
		images: n.map((e, n) => ({
			src: String(e),
			alt: `${t} ${n + 1} preview`
		}))
	} : Array.isArray(n) ? n : n === void 0 ? null : n;
}, de = (e) => b(e).map((e, t) => ({
	id: `friendly-json-${t}`,
	name: e.label,
	type: "readOnly",
	value: ue(e)
})), fe = (e) => {
	let { value: t } = e;
	return /* @__PURE__ */ f(o, {
		params: de(t),
		readOnly: !0,
		fullWidth: !0
	});
};
// node_modules/.bun/@tanstack+table-core@8.21.3/node_modules/@tanstack/table-core/build/lib/index.mjs
function pe() {
	return {
		accessor: (e, t) => typeof e == "function" ? {
			...t,
			accessorFn: e
		} : {
			...t,
			accessorKey: e
		},
		display: (e) => e,
		group: (e) => e
	};
}
function C(e, t) {
	return typeof e == "function" ? e(t) : e;
}
function w(e, t) {
	return (n) => {
		t.setState((t) => ({
			...t,
			[e]: C(n, t[e])
		}));
	};
}
function T(e) {
	return e instanceof Function;
}
function me(e) {
	return Array.isArray(e) && e.every((e) => typeof e == "number");
}
function he(e, t) {
	let n = [], r = (e) => {
		e.forEach((e) => {
			n.push(e);
			let i = t(e);
			i != null && i.length && r(i);
		});
	};
	return r(e), n;
}
function E(e, t, n) {
	let r = [], i;
	return (a) => {
		let o;
		n.key && n.debug && (o = Date.now());
		let s = e(a);
		if (!(s.length !== r.length || s.some((e, t) => r[t] !== e))) return i;
		r = s;
		let c;
		if (n.key && n.debug && (c = Date.now()), i = t(...s), n == null || n.onChange == null || n.onChange(i), n.key && n.debug && n != null && n.debug()) {
			let e = Math.round((Date.now() - o) * 100) / 100, t = Math.round((Date.now() - c) * 100) / 100, r = t / 16, i = (e, t) => {
				for (e = String(e); e.length < t;) e = " " + e;
				return e;
			};
			console.info(`%c⏱ ${i(t, 5)} /${i(e, 5)} ms`, `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(0, Math.min(120 - 120 * r, 120))}deg 100% 31%);`, n?.key);
		}
		return i;
	};
}
function D(e, t, n, r) {
	return {
		debug: () => e?.debugAll ?? e[t],
		key: !1,
		onChange: r
	};
}
function ge(e, t, n, r) {
	let i = {
		id: `${t.id}_${n.id}`,
		row: t,
		column: n,
		getValue: () => t.getValue(r),
		renderValue: () => i.getValue() ?? e.options.renderFallbackValue,
		getContext: E(() => [
			e,
			n,
			t,
			i
		], (e, t, n, r) => ({
			table: e,
			column: t,
			row: n,
			cell: r,
			getValue: r.getValue,
			renderValue: r.renderValue
		}), D(e.options, "debugCells", "cell.getContext"))
	};
	return e._features.forEach((r) => {
		r.createCell == null || r.createCell(i, n, t, e);
	}, {}), i;
}
function _e(e, t, n, r) {
	let i = {
		...e._getDefaultColumnDef(),
		...t
	}, a = i.accessorKey, o = i.id ?? (a ? typeof String.prototype.replaceAll == "function" ? a.replaceAll(".", "_") : a.replace(/\./g, "_") : void 0) ?? (typeof i.header == "string" ? i.header : void 0), s;
	if (i.accessorFn ? s = i.accessorFn : a && (s = a.includes(".") ? (e) => {
		let t = e;
		for (let e of a.split(".")) t = t?.[e];
		return t;
	} : (e) => e[i.accessorKey]), !o) throw Error();
	let c = {
		id: `${String(o)}`,
		accessorFn: s,
		parent: r,
		depth: n,
		columnDef: i,
		columns: [],
		getFlatColumns: E(() => [!0], () => [c, ...c.columns?.flatMap((e) => e.getFlatColumns())], D(e.options, "debugColumns", "column.getFlatColumns")),
		getLeafColumns: E(() => [e._getOrderColumnsFn()], (e) => {
			var t;
			return (t = c.columns) != null && t.length ? e(c.columns.flatMap((e) => e.getLeafColumns())) : [c];
		}, D(e.options, "debugColumns", "column.getLeafColumns"))
	};
	for (let t of e._features) t.createColumn == null || t.createColumn(c, e);
	return c;
}
var O = "debugHeaders";
function ve(e, t, n) {
	let r = {
		id: n.id ?? t.id,
		column: t,
		index: n.index,
		isPlaceholder: !!n.isPlaceholder,
		placeholderId: n.placeholderId,
		depth: n.depth,
		subHeaders: [],
		colSpan: 0,
		rowSpan: 0,
		headerGroup: null,
		getLeafHeaders: () => {
			let e = [], t = (n) => {
				n.subHeaders && n.subHeaders.length && n.subHeaders.map(t), e.push(n);
			};
			return t(r), e;
		},
		getContext: () => ({
			table: e,
			header: r,
			column: t
		})
	};
	return e._features.forEach((t) => {
		t.createHeader == null || t.createHeader(r, e);
	}), r;
}
var ye = { createTable: (e) => {
	e.getHeaderGroups = E(() => [
		e.getAllColumns(),
		e.getVisibleLeafColumns(),
		e.getState().columnPinning.left,
		e.getState().columnPinning.right
	], (t, n, r, i) => {
		let a = r?.map((e) => n.find((t) => t.id === e)).filter(Boolean) ?? [], o = i?.map((e) => n.find((t) => t.id === e)).filter(Boolean) ?? [], s = n.filter((e) => !(r != null && r.includes(e.id)) && !(i != null && i.includes(e.id)));
		return k(t, [
			...a,
			...s,
			...o
		], e);
	}, D(e.options, O, "getHeaderGroups")), e.getCenterHeaderGroups = E(() => [
		e.getAllColumns(),
		e.getVisibleLeafColumns(),
		e.getState().columnPinning.left,
		e.getState().columnPinning.right
	], (t, n, r, i) => (n = n.filter((e) => !(r != null && r.includes(e.id)) && !(i != null && i.includes(e.id))), k(t, n, e, "center")), D(e.options, O, "getCenterHeaderGroups")), e.getLeftHeaderGroups = E(() => [
		e.getAllColumns(),
		e.getVisibleLeafColumns(),
		e.getState().columnPinning.left
	], (t, n, r) => k(t, r?.map((e) => n.find((t) => t.id === e)).filter(Boolean) ?? [], e, "left"), D(e.options, O, "getLeftHeaderGroups")), e.getRightHeaderGroups = E(() => [
		e.getAllColumns(),
		e.getVisibleLeafColumns(),
		e.getState().columnPinning.right
	], (t, n, r) => k(t, r?.map((e) => n.find((t) => t.id === e)).filter(Boolean) ?? [], e, "right"), D(e.options, O, "getRightHeaderGroups")), e.getFooterGroups = E(() => [e.getHeaderGroups()], (e) => [...e].reverse(), D(e.options, O, "getFooterGroups")), e.getLeftFooterGroups = E(() => [e.getLeftHeaderGroups()], (e) => [...e].reverse(), D(e.options, O, "getLeftFooterGroups")), e.getCenterFooterGroups = E(() => [e.getCenterHeaderGroups()], (e) => [...e].reverse(), D(e.options, O, "getCenterFooterGroups")), e.getRightFooterGroups = E(() => [e.getRightHeaderGroups()], (e) => [...e].reverse(), D(e.options, O, "getRightFooterGroups")), e.getFlatHeaders = E(() => [e.getHeaderGroups()], (e) => e.map((e) => e.headers).flat(), D(e.options, O, "getFlatHeaders")), e.getLeftFlatHeaders = E(() => [e.getLeftHeaderGroups()], (e) => e.map((e) => e.headers).flat(), D(e.options, O, "getLeftFlatHeaders")), e.getCenterFlatHeaders = E(() => [e.getCenterHeaderGroups()], (e) => e.map((e) => e.headers).flat(), D(e.options, O, "getCenterFlatHeaders")), e.getRightFlatHeaders = E(() => [e.getRightHeaderGroups()], (e) => e.map((e) => e.headers).flat(), D(e.options, O, "getRightFlatHeaders")), e.getCenterLeafHeaders = E(() => [e.getCenterFlatHeaders()], (e) => e.filter((e) => {
		var t;
		return !((t = e.subHeaders) != null && t.length);
	}), D(e.options, O, "getCenterLeafHeaders")), e.getLeftLeafHeaders = E(() => [e.getLeftFlatHeaders()], (e) => e.filter((e) => {
		var t;
		return !((t = e.subHeaders) != null && t.length);
	}), D(e.options, O, "getLeftLeafHeaders")), e.getRightLeafHeaders = E(() => [e.getRightFlatHeaders()], (e) => e.filter((e) => {
		var t;
		return !((t = e.subHeaders) != null && t.length);
	}), D(e.options, O, "getRightLeafHeaders")), e.getLeafHeaders = E(() => [
		e.getLeftHeaderGroups(),
		e.getCenterHeaderGroups(),
		e.getRightHeaderGroups()
	], (e, t, n) => [
		...e[0]?.headers ?? [],
		...t[0]?.headers ?? [],
		...n[0]?.headers ?? []
	].map((e) => e.getLeafHeaders()).flat(), D(e.options, O, "getLeafHeaders"));
} };
function k(e, t, n, r) {
	let i = 0, a = function(e, t) {
		t === void 0 && (t = 1), i = Math.max(i, t), e.filter((e) => e.getIsVisible()).forEach((e) => {
			var n;
			(n = e.columns) != null && n.length && a(e.columns, t + 1);
		}, 0);
	};
	a(e);
	let o = [], s = (e, t) => {
		let i = {
			depth: t,
			id: [r, `${t}`].filter(Boolean).join("_"),
			headers: []
		}, a = [];
		e.forEach((e) => {
			let o = [...a].reverse()[0], s = e.column.depth === i.depth, c, l = !1;
			if (s && e.column.parent ? c = e.column.parent : (c = e.column, l = !0), o && o?.column === c) o.subHeaders.push(e);
			else {
				let i = ve(n, c, {
					id: [
						r,
						t,
						c.id,
						e?.id
					].filter(Boolean).join("_"),
					isPlaceholder: l,
					placeholderId: l ? `${a.filter((e) => e.column === c).length}` : void 0,
					depth: t,
					index: a.length
				});
				i.subHeaders.push(e), a.push(i);
			}
			i.headers.push(e), e.headerGroup = i;
		}), o.push(i), t > 0 && s(a, t - 1);
	};
	s(t.map((e, t) => ve(n, e, {
		depth: i,
		index: t
	})), i - 1), o.reverse();
	let c = (e) => e.filter((e) => e.column.getIsVisible()).map((e) => {
		let t = 0, n = 0, r = [0];
		e.subHeaders && e.subHeaders.length ? (r = [], c(e.subHeaders).forEach((e) => {
			let { colSpan: n, rowSpan: i } = e;
			t += n, r.push(i);
		})) : t = 1;
		let i = Math.min(...r);
		return n += i, e.colSpan = t, e.rowSpan = n, {
			colSpan: t,
			rowSpan: n
		};
	});
	return c(o[0]?.headers ?? []), o;
}
var be = (e, t, n, r, i, a, o) => {
	let s = {
		id: t,
		index: r,
		original: n,
		depth: i,
		parentId: o,
		_valuesCache: {},
		_uniqueValuesCache: {},
		getValue: (t) => {
			if (s._valuesCache.hasOwnProperty(t)) return s._valuesCache[t];
			let n = e.getColumn(t);
			if (n != null && n.accessorFn) return s._valuesCache[t] = n.accessorFn(s.original, r), s._valuesCache[t];
		},
		getUniqueValues: (t) => {
			if (s._uniqueValuesCache.hasOwnProperty(t)) return s._uniqueValuesCache[t];
			let n = e.getColumn(t);
			if (n != null && n.accessorFn) return n.columnDef.getUniqueValues ? (s._uniqueValuesCache[t] = n.columnDef.getUniqueValues(s.original, r), s._uniqueValuesCache[t]) : (s._uniqueValuesCache[t] = [s.getValue(t)], s._uniqueValuesCache[t]);
		},
		renderValue: (t) => s.getValue(t) ?? e.options.renderFallbackValue,
		subRows: a ?? [],
		getLeafRows: () => he(s.subRows, (e) => e.subRows),
		getParentRow: () => s.parentId ? e.getRow(s.parentId, !0) : void 0,
		getParentRows: () => {
			let e = [], t = s;
			for (;;) {
				let n = t.getParentRow();
				if (!n) break;
				e.push(n), t = n;
			}
			return e.reverse();
		},
		getAllCells: E(() => [e.getAllLeafColumns()], (t) => t.map((t) => ge(e, s, t, t.id)), D(e.options, "debugRows", "getAllCells")),
		_getAllCellsByColumnId: E(() => [s.getAllCells()], (e) => e.reduce((e, t) => (e[t.column.id] = t, e), {}), D(e.options, "debugRows", "getAllCellsByColumnId"))
	};
	for (let t = 0; t < e._features.length; t++) {
		let n = e._features[t];
		n == null || n.createRow == null || n.createRow(s, e);
	}
	return s;
}, xe = { createColumn: (e, t) => {
	e._getFacetedRowModel = t.options.getFacetedRowModel && t.options.getFacetedRowModel(t, e.id), e.getFacetedRowModel = () => e._getFacetedRowModel ? e._getFacetedRowModel() : t.getPreFilteredRowModel(), e._getFacetedUniqueValues = t.options.getFacetedUniqueValues && t.options.getFacetedUniqueValues(t, e.id), e.getFacetedUniqueValues = () => e._getFacetedUniqueValues ? e._getFacetedUniqueValues() : /* @__PURE__ */ new Map(), e._getFacetedMinMaxValues = t.options.getFacetedMinMaxValues && t.options.getFacetedMinMaxValues(t, e.id), e.getFacetedMinMaxValues = () => {
		if (e._getFacetedMinMaxValues) return e._getFacetedMinMaxValues();
	};
} }, Se = (e, t, n) => {
	var r, i;
	let a = n == null || (r = n.toString()) == null ? void 0 : r.toLowerCase();
	return !!((i = e.getValue(t)) != null && (i = i.toString()) != null && (i = i.toLowerCase()) != null && i.includes(a));
};
Se.autoRemove = (e) => M(e);
var Ce = (e, t, n) => {
	var r;
	return !!((r = e.getValue(t)) != null && (r = r.toString()) != null && r.includes(n));
};
Ce.autoRemove = (e) => M(e);
var we = (e, t, n) => {
	var r;
	return ((r = e.getValue(t)) == null || (r = r.toString()) == null ? void 0 : r.toLowerCase()) === n?.toLowerCase();
};
we.autoRemove = (e) => M(e);
var Te = (e, t, n) => e.getValue(t)?.includes(n);
Te.autoRemove = (e) => M(e);
var Ee = (e, t, n) => !n.some((n) => {
	var r;
	return !((r = e.getValue(t)) != null && r.includes(n));
});
Ee.autoRemove = (e) => M(e) || !(e != null && e.length);
var De = (e, t, n) => n.some((n) => e.getValue(t)?.includes(n));
De.autoRemove = (e) => M(e) || !(e != null && e.length);
var Oe = (e, t, n) => e.getValue(t) === n;
Oe.autoRemove = (e) => M(e);
var ke = (e, t, n) => e.getValue(t) == n;
ke.autoRemove = (e) => M(e);
var A = (e, t, n) => {
	let [r, i] = n, a = e.getValue(t);
	return a >= r && a <= i;
};
A.resolveFilterValue = (e) => {
	let [t, n] = e, r = typeof t == "number" ? t : parseFloat(t), i = typeof n == "number" ? n : parseFloat(n), a = t === null || Number.isNaN(r) ? -Infinity : r, o = n === null || Number.isNaN(i) ? Infinity : i;
	if (a > o) {
		let e = a;
		a = o, o = e;
	}
	return [a, o];
}, A.autoRemove = (e) => M(e) || M(e[0]) && M(e[1]);
var j = {
	includesString: Se,
	includesStringSensitive: Ce,
	equalsString: we,
	arrIncludes: Te,
	arrIncludesAll: Ee,
	arrIncludesSome: De,
	equals: Oe,
	weakEquals: ke,
	inNumberRange: A
};
function M(e) {
	return e == null || e === "";
}
var Ae = {
	getDefaultColumnDef: () => ({ filterFn: "auto" }),
	getInitialState: (e) => ({
		columnFilters: [],
		...e
	}),
	getDefaultOptions: (e) => ({
		onColumnFiltersChange: w("columnFilters", e),
		filterFromLeafRows: !1,
		maxLeafRowFilterDepth: 100
	}),
	createColumn: (e, t) => {
		e.getAutoFilterFn = () => {
			let n = t.getCoreRowModel().flatRows[0]?.getValue(e.id);
			return typeof n == "string" ? j.includesString : typeof n == "number" ? j.inNumberRange : typeof n == "boolean" || typeof n == "object" && n ? j.equals : Array.isArray(n) ? j.arrIncludes : j.weakEquals;
		}, e.getFilterFn = () => T(e.columnDef.filterFn) ? e.columnDef.filterFn : e.columnDef.filterFn === "auto" ? e.getAutoFilterFn() : t.options.filterFns?.[e.columnDef.filterFn] ?? j[e.columnDef.filterFn], e.getCanFilter = () => (e.columnDef.enableColumnFilter ?? !0) && (t.options.enableColumnFilters ?? !0) && (t.options.enableFilters ?? !0) && !!e.accessorFn, e.getIsFiltered = () => e.getFilterIndex() > -1, e.getFilterValue = () => {
			var n;
			return (n = t.getState().columnFilters) == null || (n = n.find((t) => t.id === e.id)) == null ? void 0 : n.value;
		}, e.getFilterIndex = () => t.getState().columnFilters?.findIndex((t) => t.id === e.id) ?? -1, e.setFilterValue = (n) => {
			t.setColumnFilters((t) => {
				let r = e.getFilterFn(), i = t?.find((t) => t.id === e.id), a = C(n, i ? i.value : void 0);
				if (je(r, a, e)) return t?.filter((t) => t.id !== e.id) ?? [];
				let o = {
					id: e.id,
					value: a
				};
				return i ? t?.map((t) => t.id === e.id ? o : t) ?? [] : t != null && t.length ? [...t, o] : [o];
			});
		};
	},
	createRow: (e, t) => {
		e.columnFilters = {}, e.columnFiltersMeta = {};
	},
	createTable: (e) => {
		e.setColumnFilters = (t) => {
			let n = e.getAllLeafColumns();
			e.options.onColumnFiltersChange == null || e.options.onColumnFiltersChange((e) => C(t, e)?.filter((e) => {
				let t = n.find((t) => t.id === e.id);
				return !(t && je(t.getFilterFn(), e.value, t));
			}));
		}, e.resetColumnFilters = (t) => {
			e.setColumnFilters(t ? [] : e.initialState?.columnFilters ?? []);
		}, e.getPreFilteredRowModel = () => e.getCoreRowModel(), e.getFilteredRowModel = () => (!e._getFilteredRowModel && e.options.getFilteredRowModel && (e._getFilteredRowModel = e.options.getFilteredRowModel(e)), e.options.manualFiltering || !e._getFilteredRowModel ? e.getPreFilteredRowModel() : e._getFilteredRowModel());
	}
};
function je(e, t, n) {
	return (e && e.autoRemove ? e.autoRemove(t, n) : !1) || t === void 0 || typeof t == "string" && !t;
}
var N = {
	sum: (e, t, n) => n.reduce((t, n) => {
		let r = n.getValue(e);
		return t + (typeof r == "number" ? r : 0);
	}, 0),
	min: (e, t, n) => {
		let r;
		return n.forEach((t) => {
			let n = t.getValue(e);
			n != null && (r > n || r === void 0 && n >= n) && (r = n);
		}), r;
	},
	max: (e, t, n) => {
		let r;
		return n.forEach((t) => {
			let n = t.getValue(e);
			n != null && (r < n || r === void 0 && n >= n) && (r = n);
		}), r;
	},
	extent: (e, t, n) => {
		let r, i;
		return n.forEach((t) => {
			let n = t.getValue(e);
			n != null && (r === void 0 ? n >= n && (r = i = n) : (r > n && (r = n), i < n && (i = n)));
		}), [r, i];
	},
	mean: (e, t) => {
		let n = 0, r = 0;
		if (t.forEach((t) => {
			let i = t.getValue(e);
			i != null && (i = +i) >= i && (++n, r += i);
		}), n) return r / n;
	},
	median: (e, t) => {
		if (!t.length) return;
		let n = t.map((t) => t.getValue(e));
		if (!me(n)) return;
		if (n.length === 1) return n[0];
		let r = Math.floor(n.length / 2), i = n.sort((e, t) => e - t);
		return n.length % 2 == 0 ? (i[r - 1] + i[r]) / 2 : i[r];
	},
	unique: (e, t) => Array.from(new Set(t.map((t) => t.getValue(e))).values()),
	uniqueCount: (e, t) => new Set(t.map((t) => t.getValue(e))).size,
	count: (e, t) => t.length
}, Me = {
	getDefaultColumnDef: () => ({
		aggregatedCell: (e) => {
			var t;
			return ((t = e.getValue()) == null || t.toString == null ? void 0 : t.toString()) ?? null;
		},
		aggregationFn: "auto"
	}),
	getInitialState: (e) => ({
		grouping: [],
		...e
	}),
	getDefaultOptions: (e) => ({
		onGroupingChange: w("grouping", e),
		groupedColumnMode: "reorder"
	}),
	createColumn: (e, t) => {
		e.toggleGrouping = () => {
			t.setGrouping((t) => t != null && t.includes(e.id) ? t.filter((t) => t !== e.id) : [...t ?? [], e.id]);
		}, e.getCanGroup = () => (e.columnDef.enableGrouping ?? !0) && (t.options.enableGrouping ?? !0) && (!!e.accessorFn || !!e.columnDef.getGroupingValue), e.getIsGrouped = () => t.getState().grouping?.includes(e.id), e.getGroupedIndex = () => t.getState().grouping?.indexOf(e.id), e.getToggleGroupingHandler = () => {
			let t = e.getCanGroup();
			return () => {
				t && e.toggleGrouping();
			};
		}, e.getAutoAggregationFn = () => {
			let n = t.getCoreRowModel().flatRows[0]?.getValue(e.id);
			if (typeof n == "number") return N.sum;
			if (Object.prototype.toString.call(n) === "[object Date]") return N.extent;
		}, e.getAggregationFn = () => {
			if (!e) throw Error();
			return T(e.columnDef.aggregationFn) ? e.columnDef.aggregationFn : e.columnDef.aggregationFn === "auto" ? e.getAutoAggregationFn() : t.options.aggregationFns?.[e.columnDef.aggregationFn] ?? N[e.columnDef.aggregationFn];
		};
	},
	createTable: (e) => {
		e.setGrouping = (t) => e.options.onGroupingChange == null ? void 0 : e.options.onGroupingChange(t), e.resetGrouping = (t) => {
			e.setGrouping(t ? [] : e.initialState?.grouping ?? []);
		}, e.getPreGroupedRowModel = () => e.getFilteredRowModel(), e.getGroupedRowModel = () => (!e._getGroupedRowModel && e.options.getGroupedRowModel && (e._getGroupedRowModel = e.options.getGroupedRowModel(e)), e.options.manualGrouping || !e._getGroupedRowModel ? e.getPreGroupedRowModel() : e._getGroupedRowModel());
	},
	createRow: (e, t) => {
		e.getIsGrouped = () => !!e.groupingColumnId, e.getGroupingValue = (n) => {
			if (e._groupingValuesCache.hasOwnProperty(n)) return e._groupingValuesCache[n];
			let r = t.getColumn(n);
			return r != null && r.columnDef.getGroupingValue ? (e._groupingValuesCache[n] = r.columnDef.getGroupingValue(e.original), e._groupingValuesCache[n]) : e.getValue(n);
		}, e._groupingValuesCache = {};
	},
	createCell: (e, t, n, r) => {
		e.getIsGrouped = () => t.getIsGrouped() && t.id === n.groupingColumnId, e.getIsPlaceholder = () => !e.getIsGrouped() && t.getIsGrouped(), e.getIsAggregated = () => {
			var t;
			return !e.getIsGrouped() && !e.getIsPlaceholder() && !!((t = n.subRows) != null && t.length);
		};
	}
};
function Ne(e, t, n) {
	if (!(t != null && t.length) || !n) return e;
	let r = e.filter((e) => !t.includes(e.id));
	return n === "remove" ? r : [...t.map((t) => e.find((e) => e.id === t)).filter(Boolean), ...r];
}
var Pe = {
	getInitialState: (e) => ({
		columnOrder: [],
		...e
	}),
	getDefaultOptions: (e) => ({ onColumnOrderChange: w("columnOrder", e) }),
	createColumn: (e, t) => {
		e.getIndex = E((e) => [z(t, e)], (t) => t.findIndex((t) => t.id === e.id), D(t.options, "debugColumns", "getIndex")), e.getIsFirstColumn = (n) => z(t, n)[0]?.id === e.id, e.getIsLastColumn = (n) => {
			let r = z(t, n);
			return r[r.length - 1]?.id === e.id;
		};
	},
	createTable: (e) => {
		e.setColumnOrder = (t) => e.options.onColumnOrderChange == null ? void 0 : e.options.onColumnOrderChange(t), e.resetColumnOrder = (t) => {
			e.setColumnOrder(t ? [] : e.initialState.columnOrder ?? []);
		}, e._getOrderColumnsFn = E(() => [
			e.getState().columnOrder,
			e.getState().grouping,
			e.options.groupedColumnMode
		], (e, t, n) => (r) => {
			let i = [];
			if (!(e != null && e.length)) i = r;
			else {
				let t = [...e], n = [...r];
				for (; n.length && t.length;) {
					let e = t.shift(), r = n.findIndex((t) => t.id === e);
					r > -1 && i.push(n.splice(r, 1)[0]);
				}
				i = [...i, ...n];
			}
			return Ne(i, t, n);
		}, D(e.options, "debugTable", "_getOrderColumnsFn"));
	}
}, P = () => ({
	left: [],
	right: []
}), Fe = {
	getInitialState: (e) => ({
		columnPinning: P(),
		...e
	}),
	getDefaultOptions: (e) => ({ onColumnPinningChange: w("columnPinning", e) }),
	createColumn: (e, t) => {
		e.pin = (n) => {
			let r = e.getLeafColumns().map((e) => e.id).filter(Boolean);
			t.setColumnPinning((e) => n === "right" ? {
				left: (e?.left ?? []).filter((e) => !(r != null && r.includes(e))),
				right: [...(e?.right ?? []).filter((e) => !(r != null && r.includes(e))), ...r]
			} : n === "left" ? {
				left: [...(e?.left ?? []).filter((e) => !(r != null && r.includes(e))), ...r],
				right: (e?.right ?? []).filter((e) => !(r != null && r.includes(e)))
			} : {
				left: (e?.left ?? []).filter((e) => !(r != null && r.includes(e))),
				right: (e?.right ?? []).filter((e) => !(r != null && r.includes(e)))
			});
		}, e.getCanPin = () => e.getLeafColumns().some((e) => (e.columnDef.enablePinning ?? !0) && (t.options.enableColumnPinning ?? t.options.enablePinning ?? !0)), e.getIsPinned = () => {
			let n = e.getLeafColumns().map((e) => e.id), { left: r, right: i } = t.getState().columnPinning, a = n.some((e) => r?.includes(e)), o = n.some((e) => i?.includes(e));
			return a ? "left" : o ? "right" : !1;
		}, e.getPinnedIndex = () => {
			var n;
			let r = e.getIsPinned();
			return r ? ((n = t.getState().columnPinning) == null || (n = n[r]) == null ? void 0 : n.indexOf(e.id)) ?? -1 : 0;
		};
	},
	createRow: (e, t) => {
		e.getCenterVisibleCells = E(() => [
			e._getAllVisibleCells(),
			t.getState().columnPinning.left,
			t.getState().columnPinning.right
		], (e, t, n) => {
			let r = [...t ?? [], ...n ?? []];
			return e.filter((e) => !r.includes(e.column.id));
		}, D(t.options, "debugRows", "getCenterVisibleCells")), e.getLeftVisibleCells = E(() => [e._getAllVisibleCells(), t.getState().columnPinning.left], (e, t) => (t ?? []).map((t) => e.find((e) => e.column.id === t)).filter(Boolean).map((e) => ({
			...e,
			position: "left"
		})), D(t.options, "debugRows", "getLeftVisibleCells")), e.getRightVisibleCells = E(() => [e._getAllVisibleCells(), t.getState().columnPinning.right], (e, t) => (t ?? []).map((t) => e.find((e) => e.column.id === t)).filter(Boolean).map((e) => ({
			...e,
			position: "right"
		})), D(t.options, "debugRows", "getRightVisibleCells"));
	},
	createTable: (e) => {
		e.setColumnPinning = (t) => e.options.onColumnPinningChange == null ? void 0 : e.options.onColumnPinningChange(t), e.resetColumnPinning = (t) => e.setColumnPinning(t ? P() : e.initialState?.columnPinning ?? P()), e.getIsSomeColumnsPinned = (t) => {
			let n = e.getState().columnPinning;
			return t ? !!n[t]?.length : !!(n.left?.length || n.right?.length);
		}, e.getLeftLeafColumns = E(() => [e.getAllLeafColumns(), e.getState().columnPinning.left], (e, t) => (t ?? []).map((t) => e.find((e) => e.id === t)).filter(Boolean), D(e.options, "debugColumns", "getLeftLeafColumns")), e.getRightLeafColumns = E(() => [e.getAllLeafColumns(), e.getState().columnPinning.right], (e, t) => (t ?? []).map((t) => e.find((e) => e.id === t)).filter(Boolean), D(e.options, "debugColumns", "getRightLeafColumns")), e.getCenterLeafColumns = E(() => [
			e.getAllLeafColumns(),
			e.getState().columnPinning.left,
			e.getState().columnPinning.right
		], (e, t, n) => {
			let r = [...t ?? [], ...n ?? []];
			return e.filter((e) => !r.includes(e.id));
		}, D(e.options, "debugColumns", "getCenterLeafColumns"));
	}
};
function Ie(e) {
	return e || (typeof document < "u" ? document : null);
}
var F = {
	size: 150,
	minSize: 20,
	maxSize: 2 ** 53 - 1
}, I = () => ({
	startOffset: null,
	startSize: null,
	deltaOffset: null,
	deltaPercentage: null,
	isResizingColumn: !1,
	columnSizingStart: []
}), Le = {
	getDefaultColumnDef: () => F,
	getInitialState: (e) => ({
		columnSizing: {},
		columnSizingInfo: I(),
		...e
	}),
	getDefaultOptions: (e) => ({
		columnResizeMode: "onEnd",
		columnResizeDirection: "ltr",
		onColumnSizingChange: w("columnSizing", e),
		onColumnSizingInfoChange: w("columnSizingInfo", e)
	}),
	createColumn: (e, t) => {
		e.getSize = () => {
			let n = t.getState().columnSizing[e.id];
			return Math.min(Math.max(e.columnDef.minSize ?? F.minSize, n ?? e.columnDef.size ?? F.size), e.columnDef.maxSize ?? F.maxSize);
		}, e.getStart = E((e) => [
			e,
			z(t, e),
			t.getState().columnSizing
		], (t, n) => n.slice(0, e.getIndex(t)).reduce((e, t) => e + t.getSize(), 0), D(t.options, "debugColumns", "getStart")), e.getAfter = E((e) => [
			e,
			z(t, e),
			t.getState().columnSizing
		], (t, n) => n.slice(e.getIndex(t) + 1).reduce((e, t) => e + t.getSize(), 0), D(t.options, "debugColumns", "getAfter")), e.resetSize = () => {
			t.setColumnSizing((t) => {
				let { [e.id]: n, ...r } = t;
				return r;
			});
		}, e.getCanResize = () => (e.columnDef.enableResizing ?? !0) && (t.options.enableColumnResizing ?? !0), e.getIsResizing = () => t.getState().columnSizingInfo.isResizingColumn === e.id;
	},
	createHeader: (e, t) => {
		e.getSize = () => {
			let t = 0, n = (e) => {
				e.subHeaders.length ? e.subHeaders.forEach(n) : t += e.column.getSize() ?? 0;
			};
			return n(e), t;
		}, e.getStart = () => {
			if (e.index > 0) {
				let t = e.headerGroup.headers[e.index - 1];
				return t.getStart() + t.getSize();
			}
			return 0;
		}, e.getResizeHandler = (n) => {
			let r = t.getColumn(e.column.id), i = r?.getCanResize();
			return (a) => {
				if (!r || !i || (a.persist == null || a.persist(), R(a) && a.touches && a.touches.length > 1)) return;
				let o = e.getSize(), s = e ? e.getLeafHeaders().map((e) => [e.column.id, e.column.getSize()]) : [[r.id, r.getSize()]], c = R(a) ? Math.round(a.touches[0].clientX) : a.clientX, l = {}, u = (e, n) => {
					typeof n == "number" && (t.setColumnSizingInfo((e) => {
						let r = t.options.columnResizeDirection === "rtl" ? -1 : 1, i = (n - (e?.startOffset ?? 0)) * r, a = Math.max(i / (e?.startSize ?? 0), -.999999);
						return e.columnSizingStart.forEach((e) => {
							let [t, n] = e;
							l[t] = Math.round(Math.max(n + n * a, 0) * 100) / 100;
						}), {
							...e,
							deltaOffset: i,
							deltaPercentage: a
						};
					}), (t.options.columnResizeMode === "onChange" || e === "end") && t.setColumnSizing((e) => ({
						...e,
						...l
					})));
				}, d = (e) => u("move", e), f = (e) => {
					u("end", e), t.setColumnSizingInfo((e) => ({
						...e,
						isResizingColumn: !1,
						startOffset: null,
						startSize: null,
						deltaOffset: null,
						deltaPercentage: null,
						columnSizingStart: []
					}));
				}, p = Ie(n), m = {
					moveHandler: (e) => d(e.clientX),
					upHandler: (e) => {
						p?.removeEventListener("mousemove", m.moveHandler), p?.removeEventListener("mouseup", m.upHandler), f(e.clientX);
					}
				}, h = {
					moveHandler: (e) => (e.cancelable && (e.preventDefault(), e.stopPropagation()), d(e.touches[0].clientX), !1),
					upHandler: (e) => {
						p?.removeEventListener("touchmove", h.moveHandler), p?.removeEventListener("touchend", h.upHandler), e.cancelable && (e.preventDefault(), e.stopPropagation()), f(e.touches[0]?.clientX);
					}
				}, g = Re() ? { passive: !1 } : !1;
				R(a) ? (p?.addEventListener("touchmove", h.moveHandler, g), p?.addEventListener("touchend", h.upHandler, g)) : (p?.addEventListener("mousemove", m.moveHandler, g), p?.addEventListener("mouseup", m.upHandler, g)), t.setColumnSizingInfo((e) => ({
					...e,
					startOffset: c,
					startSize: o,
					deltaOffset: 0,
					deltaPercentage: 0,
					columnSizingStart: s,
					isResizingColumn: r.id
				}));
			};
		};
	},
	createTable: (e) => {
		e.setColumnSizing = (t) => e.options.onColumnSizingChange == null ? void 0 : e.options.onColumnSizingChange(t), e.setColumnSizingInfo = (t) => e.options.onColumnSizingInfoChange == null ? void 0 : e.options.onColumnSizingInfoChange(t), e.resetColumnSizing = (t) => {
			e.setColumnSizing(t ? {} : e.initialState.columnSizing ?? {});
		}, e.resetHeaderSizeInfo = (t) => {
			e.setColumnSizingInfo(t ? I() : e.initialState.columnSizingInfo ?? I());
		}, e.getTotalSize = () => e.getHeaderGroups()[0]?.headers.reduce((e, t) => e + t.getSize(), 0) ?? 0, e.getLeftTotalSize = () => e.getLeftHeaderGroups()[0]?.headers.reduce((e, t) => e + t.getSize(), 0) ?? 0, e.getCenterTotalSize = () => e.getCenterHeaderGroups()[0]?.headers.reduce((e, t) => e + t.getSize(), 0) ?? 0, e.getRightTotalSize = () => e.getRightHeaderGroups()[0]?.headers.reduce((e, t) => e + t.getSize(), 0) ?? 0;
	}
}, L = null;
function Re() {
	if (typeof L == "boolean") return L;
	let e = !1;
	try {
		let t = { get passive() {
			return e = !0, !1;
		} }, n = () => {};
		window.addEventListener("test", n, t), window.removeEventListener("test", n);
	} catch {
		e = !1;
	}
	return L = e, L;
}
function R(e) {
	return e.type === "touchstart";
}
var ze = {
	getInitialState: (e) => ({
		columnVisibility: {},
		...e
	}),
	getDefaultOptions: (e) => ({ onColumnVisibilityChange: w("columnVisibility", e) }),
	createColumn: (e, t) => {
		e.toggleVisibility = (n) => {
			e.getCanHide() && t.setColumnVisibility((t) => ({
				...t,
				[e.id]: n ?? !e.getIsVisible()
			}));
		}, e.getIsVisible = () => {
			let n = e.columns;
			return (n.length ? n.some((e) => e.getIsVisible()) : t.getState().columnVisibility?.[e.id]) ?? !0;
		}, e.getCanHide = () => (e.columnDef.enableHiding ?? !0) && (t.options.enableHiding ?? !0), e.getToggleVisibilityHandler = () => (t) => {
			e.toggleVisibility == null || e.toggleVisibility(t.target.checked);
		};
	},
	createRow: (e, t) => {
		e._getAllVisibleCells = E(() => [e.getAllCells(), t.getState().columnVisibility], (e) => e.filter((e) => e.column.getIsVisible()), D(t.options, "debugRows", "_getAllVisibleCells")), e.getVisibleCells = E(() => [
			e.getLeftVisibleCells(),
			e.getCenterVisibleCells(),
			e.getRightVisibleCells()
		], (e, t, n) => [
			...e,
			...t,
			...n
		], D(t.options, "debugRows", "getVisibleCells"));
	},
	createTable: (e) => {
		let t = (t, n) => E(() => [n(), n().filter((e) => e.getIsVisible()).map((e) => e.id).join("_")], (e) => e.filter((e) => e.getIsVisible == null ? void 0 : e.getIsVisible()), D(e.options, "debugColumns", t));
		e.getVisibleFlatColumns = t("getVisibleFlatColumns", () => e.getAllFlatColumns()), e.getVisibleLeafColumns = t("getVisibleLeafColumns", () => e.getAllLeafColumns()), e.getLeftVisibleLeafColumns = t("getLeftVisibleLeafColumns", () => e.getLeftLeafColumns()), e.getRightVisibleLeafColumns = t("getRightVisibleLeafColumns", () => e.getRightLeafColumns()), e.getCenterVisibleLeafColumns = t("getCenterVisibleLeafColumns", () => e.getCenterLeafColumns()), e.setColumnVisibility = (t) => e.options.onColumnVisibilityChange == null ? void 0 : e.options.onColumnVisibilityChange(t), e.resetColumnVisibility = (t) => {
			e.setColumnVisibility(t ? {} : e.initialState.columnVisibility ?? {});
		}, e.toggleAllColumnsVisible = (t) => {
			t ??= !e.getIsAllColumnsVisible(), e.setColumnVisibility(e.getAllLeafColumns().reduce((e, n) => ({
				...e,
				[n.id]: t || !(n.getCanHide != null && n.getCanHide())
			}), {}));
		}, e.getIsAllColumnsVisible = () => !e.getAllLeafColumns().some((e) => !(e.getIsVisible != null && e.getIsVisible())), e.getIsSomeColumnsVisible = () => e.getAllLeafColumns().some((e) => e.getIsVisible == null ? void 0 : e.getIsVisible()), e.getToggleAllColumnsVisibilityHandler = () => (t) => {
			e.toggleAllColumnsVisible(t.target?.checked);
		};
	}
};
function z(e, t) {
	return t ? t === "center" ? e.getCenterVisibleLeafColumns() : t === "left" ? e.getLeftVisibleLeafColumns() : e.getRightVisibleLeafColumns() : e.getVisibleLeafColumns();
}
var Be = { createTable: (e) => {
	e._getGlobalFacetedRowModel = e.options.getFacetedRowModel && e.options.getFacetedRowModel(e, "__global__"), e.getGlobalFacetedRowModel = () => e.options.manualFiltering || !e._getGlobalFacetedRowModel ? e.getPreFilteredRowModel() : e._getGlobalFacetedRowModel(), e._getGlobalFacetedUniqueValues = e.options.getFacetedUniqueValues && e.options.getFacetedUniqueValues(e, "__global__"), e.getGlobalFacetedUniqueValues = () => e._getGlobalFacetedUniqueValues ? e._getGlobalFacetedUniqueValues() : /* @__PURE__ */ new Map(), e._getGlobalFacetedMinMaxValues = e.options.getFacetedMinMaxValues && e.options.getFacetedMinMaxValues(e, "__global__"), e.getGlobalFacetedMinMaxValues = () => {
		if (e._getGlobalFacetedMinMaxValues) return e._getGlobalFacetedMinMaxValues();
	};
} }, Ve = {
	getInitialState: (e) => ({
		globalFilter: void 0,
		...e
	}),
	getDefaultOptions: (e) => ({
		onGlobalFilterChange: w("globalFilter", e),
		globalFilterFn: "auto",
		getColumnCanGlobalFilter: (t) => {
			var n;
			let r = (n = e.getCoreRowModel().flatRows[0]) == null || (n = n._getAllCellsByColumnId()[t.id]) == null ? void 0 : n.getValue();
			return typeof r == "string" || typeof r == "number";
		}
	}),
	createColumn: (e, t) => {
		e.getCanGlobalFilter = () => (e.columnDef.enableGlobalFilter ?? !0) && (t.options.enableGlobalFilter ?? !0) && (t.options.enableFilters ?? !0) && ((t.options.getColumnCanGlobalFilter == null ? void 0 : t.options.getColumnCanGlobalFilter(e)) ?? !0) && !!e.accessorFn;
	},
	createTable: (e) => {
		e.getGlobalAutoFilterFn = () => j.includesString, e.getGlobalFilterFn = () => {
			let { globalFilterFn: t } = e.options;
			return T(t) ? t : t === "auto" ? e.getGlobalAutoFilterFn() : e.options.filterFns?.[t] ?? j[t];
		}, e.setGlobalFilter = (t) => {
			e.options.onGlobalFilterChange == null || e.options.onGlobalFilterChange(t);
		}, e.resetGlobalFilter = (t) => {
			e.setGlobalFilter(t ? void 0 : e.initialState.globalFilter);
		};
	}
}, He = {
	getInitialState: (e) => ({
		expanded: {},
		...e
	}),
	getDefaultOptions: (e) => ({
		onExpandedChange: w("expanded", e),
		paginateExpandedRows: !0
	}),
	createTable: (e) => {
		let t = !1, n = !1;
		e._autoResetExpanded = () => {
			if (!t) e._queue(() => {
				t = !0;
			});
			else if (e.options.autoResetAll ?? e.options.autoResetExpanded ?? !e.options.manualExpanding) {
				if (n) return;
				n = !0, e._queue(() => {
					e.resetExpanded(), n = !1;
				});
			}
		}, e.setExpanded = (t) => e.options.onExpandedChange == null ? void 0 : e.options.onExpandedChange(t), e.toggleAllRowsExpanded = (t) => {
			t ?? !e.getIsAllRowsExpanded() ? e.setExpanded(!0) : e.setExpanded({});
		}, e.resetExpanded = (t) => {
			e.setExpanded(t ? {} : e.initialState?.expanded ?? {});
		}, e.getCanSomeRowsExpand = () => e.getPrePaginationRowModel().flatRows.some((e) => e.getCanExpand()), e.getToggleAllRowsExpandedHandler = () => (t) => {
			t.persist == null || t.persist(), e.toggleAllRowsExpanded();
		}, e.getIsSomeRowsExpanded = () => {
			let t = e.getState().expanded;
			return t === !0 || Object.values(t).some(Boolean);
		}, e.getIsAllRowsExpanded = () => {
			let t = e.getState().expanded;
			return typeof t == "boolean" ? t === !0 : !(!Object.keys(t).length || e.getRowModel().flatRows.some((e) => !e.getIsExpanded()));
		}, e.getExpandedDepth = () => {
			let t = 0;
			return (e.getState().expanded === !0 ? Object.keys(e.getRowModel().rowsById) : Object.keys(e.getState().expanded)).forEach((e) => {
				let n = e.split(".");
				t = Math.max(t, n.length);
			}), t;
		}, e.getPreExpandedRowModel = () => e.getSortedRowModel(), e.getExpandedRowModel = () => (!e._getExpandedRowModel && e.options.getExpandedRowModel && (e._getExpandedRowModel = e.options.getExpandedRowModel(e)), e.options.manualExpanding || !e._getExpandedRowModel ? e.getPreExpandedRowModel() : e._getExpandedRowModel());
	},
	createRow: (e, t) => {
		e.toggleExpanded = (n) => {
			t.setExpanded((r) => {
				let i = r === !0 || !!(r != null && r[e.id]), a = {};
				if (r === !0 ? Object.keys(t.getRowModel().rowsById).forEach((e) => {
					a[e] = !0;
				}) : a = r, n ??= !i, !i && n) return {
					...a,
					[e.id]: !0
				};
				if (i && !n) {
					let { [e.id]: t, ...n } = a;
					return n;
				}
				return r;
			});
		}, e.getIsExpanded = () => {
			let n = t.getState().expanded;
			return !!((t.options.getIsRowExpanded == null ? void 0 : t.options.getIsRowExpanded(e)) ?? (n === !0 || n?.[e.id]));
		}, e.getCanExpand = () => {
			var n;
			return (t.options.getRowCanExpand == null ? void 0 : t.options.getRowCanExpand(e)) ?? ((t.options.enableExpanding ?? !0) && !!((n = e.subRows) != null && n.length));
		}, e.getIsAllParentsExpanded = () => {
			let n = !0, r = e;
			for (; n && r.parentId;) r = t.getRow(r.parentId, !0), n = r.getIsExpanded();
			return n;
		}, e.getToggleExpandedHandler = () => {
			let t = e.getCanExpand();
			return () => {
				t && e.toggleExpanded();
			};
		};
	}
}, B = 0, V = 10, H = () => ({
	pageIndex: B,
	pageSize: V
}), Ue = {
	getInitialState: (e) => ({
		...e,
		pagination: {
			...H(),
			...e?.pagination
		}
	}),
	getDefaultOptions: (e) => ({ onPaginationChange: w("pagination", e) }),
	createTable: (e) => {
		let t = !1, n = !1;
		e._autoResetPageIndex = () => {
			if (!t) e._queue(() => {
				t = !0;
			});
			else if (e.options.autoResetAll ?? e.options.autoResetPageIndex ?? !e.options.manualPagination) {
				if (n) return;
				n = !0, e._queue(() => {
					e.resetPageIndex(), n = !1;
				});
			}
		}, e.setPagination = (t) => e.options.onPaginationChange == null ? void 0 : e.options.onPaginationChange((e) => C(t, e)), e.resetPagination = (t) => {
			e.setPagination(t ? H() : e.initialState.pagination ?? H());
		}, e.setPageIndex = (t) => {
			e.setPagination((n) => {
				let r = C(t, n.pageIndex), i = e.options.pageCount === void 0 || e.options.pageCount === -1 ? 2 ** 53 - 1 : e.options.pageCount - 1;
				return r = Math.max(0, Math.min(r, i)), {
					...n,
					pageIndex: r
				};
			});
		}, e.resetPageIndex = (t) => {
			var n;
			e.setPageIndex(t ? B : ((n = e.initialState) == null || (n = n.pagination) == null ? void 0 : n.pageIndex) ?? B);
		}, e.resetPageSize = (t) => {
			var n;
			e.setPageSize(t ? V : ((n = e.initialState) == null || (n = n.pagination) == null ? void 0 : n.pageSize) ?? V);
		}, e.setPageSize = (t) => {
			e.setPagination((e) => {
				let n = Math.max(1, C(t, e.pageSize)), r = e.pageSize * e.pageIndex, i = Math.floor(r / n);
				return {
					...e,
					pageIndex: i,
					pageSize: n
				};
			});
		}, e.setPageCount = (t) => e.setPagination((n) => {
			let r = C(t, e.options.pageCount ?? -1);
			return typeof r == "number" && (r = Math.max(-1, r)), {
				...n,
				pageCount: r
			};
		}), e.getPageOptions = E(() => [e.getPageCount()], (e) => {
			let t = [];
			return e && e > 0 && (t = [...Array(e)].fill(null).map((e, t) => t)), t;
		}, D(e.options, "debugTable", "getPageOptions")), e.getCanPreviousPage = () => e.getState().pagination.pageIndex > 0, e.getCanNextPage = () => {
			let { pageIndex: t } = e.getState().pagination, n = e.getPageCount();
			return n === -1 || n !== 0 && t < n - 1;
		}, e.previousPage = () => e.setPageIndex((e) => e - 1), e.nextPage = () => e.setPageIndex((e) => e + 1), e.firstPage = () => e.setPageIndex(0), e.lastPage = () => e.setPageIndex(e.getPageCount() - 1), e.getPrePaginationRowModel = () => e.getExpandedRowModel(), e.getPaginationRowModel = () => (!e._getPaginationRowModel && e.options.getPaginationRowModel && (e._getPaginationRowModel = e.options.getPaginationRowModel(e)), e.options.manualPagination || !e._getPaginationRowModel ? e.getPrePaginationRowModel() : e._getPaginationRowModel()), e.getPageCount = () => e.options.pageCount ?? Math.ceil(e.getRowCount() / e.getState().pagination.pageSize), e.getRowCount = () => e.options.rowCount ?? e.getPrePaginationRowModel().rows.length;
	}
}, U = () => ({
	top: [],
	bottom: []
}), We = {
	getInitialState: (e) => ({
		rowPinning: U(),
		...e
	}),
	getDefaultOptions: (e) => ({ onRowPinningChange: w("rowPinning", e) }),
	createRow: (e, t) => {
		e.pin = (n, r, i) => {
			let a = r ? e.getLeafRows().map((e) => {
				let { id: t } = e;
				return t;
			}) : [], o = i ? e.getParentRows().map((e) => {
				let { id: t } = e;
				return t;
			}) : [], s = /* @__PURE__ */ new Set([
				...o,
				e.id,
				...a
			]);
			t.setRowPinning((e) => n === "bottom" ? {
				top: (e?.top ?? []).filter((e) => !(s != null && s.has(e))),
				bottom: [...(e?.bottom ?? []).filter((e) => !(s != null && s.has(e))), ...Array.from(s)]
			} : n === "top" ? {
				top: [...(e?.top ?? []).filter((e) => !(s != null && s.has(e))), ...Array.from(s)],
				bottom: (e?.bottom ?? []).filter((e) => !(s != null && s.has(e)))
			} : {
				top: (e?.top ?? []).filter((e) => !(s != null && s.has(e))),
				bottom: (e?.bottom ?? []).filter((e) => !(s != null && s.has(e)))
			});
		}, e.getCanPin = () => {
			let { enableRowPinning: n, enablePinning: r } = t.options;
			return typeof n == "function" ? n(e) : n ?? r ?? !0;
		}, e.getIsPinned = () => {
			let n = [e.id], { top: r, bottom: i } = t.getState().rowPinning, a = n.some((e) => r?.includes(e)), o = n.some((e) => i?.includes(e));
			return a ? "top" : o ? "bottom" : !1;
		}, e.getPinnedIndex = () => {
			let n = e.getIsPinned();
			return n ? ((n === "top" ? t.getTopRows() : t.getBottomRows())?.map((e) => {
				let { id: t } = e;
				return t;
			}))?.indexOf(e.id) ?? -1 : -1;
		};
	},
	createTable: (e) => {
		e.setRowPinning = (t) => e.options.onRowPinningChange == null ? void 0 : e.options.onRowPinningChange(t), e.resetRowPinning = (t) => e.setRowPinning(t ? U() : e.initialState?.rowPinning ?? U()), e.getIsSomeRowsPinned = (t) => {
			let n = e.getState().rowPinning;
			return t ? !!n[t]?.length : !!(n.top?.length || n.bottom?.length);
		}, e._getPinnedRows = (t, n, r) => (e.options.keepPinnedRows ?? !0 ? (n ?? []).map((t) => {
			let n = e.getRow(t, !0);
			return n.getIsAllParentsExpanded() ? n : null;
		}) : (n ?? []).map((e) => t.find((t) => t.id === e))).filter(Boolean).map((e) => ({
			...e,
			position: r
		})), e.getTopRows = E(() => [e.getRowModel().rows, e.getState().rowPinning.top], (t, n) => e._getPinnedRows(t, n, "top"), D(e.options, "debugRows", "getTopRows")), e.getBottomRows = E(() => [e.getRowModel().rows, e.getState().rowPinning.bottom], (t, n) => e._getPinnedRows(t, n, "bottom"), D(e.options, "debugRows", "getBottomRows")), e.getCenterRows = E(() => [
			e.getRowModel().rows,
			e.getState().rowPinning.top,
			e.getState().rowPinning.bottom
		], (e, t, n) => {
			let r = /* @__PURE__ */ new Set([...t ?? [], ...n ?? []]);
			return e.filter((e) => !r.has(e.id));
		}, D(e.options, "debugRows", "getCenterRows"));
	}
}, Ge = {
	getInitialState: (e) => ({
		rowSelection: {},
		...e
	}),
	getDefaultOptions: (e) => ({
		onRowSelectionChange: w("rowSelection", e),
		enableRowSelection: !0,
		enableMultiRowSelection: !0,
		enableSubRowSelection: !0
	}),
	createTable: (e) => {
		e.setRowSelection = (t) => e.options.onRowSelectionChange == null ? void 0 : e.options.onRowSelectionChange(t), e.resetRowSelection = (t) => e.setRowSelection(t ? {} : e.initialState.rowSelection ?? {}), e.toggleAllRowsSelected = (t) => {
			e.setRowSelection((n) => {
				t = t === void 0 ? !e.getIsAllRowsSelected() : t;
				let r = { ...n }, i = e.getPreGroupedRowModel().flatRows;
				return t ? i.forEach((e) => {
					e.getCanSelect() && (r[e.id] = !0);
				}) : i.forEach((e) => {
					delete r[e.id];
				}), r;
			});
		}, e.toggleAllPageRowsSelected = (t) => e.setRowSelection((n) => {
			let r = t === void 0 ? !e.getIsAllPageRowsSelected() : t, i = { ...n };
			return e.getRowModel().rows.forEach((t) => {
				W(i, t.id, r, !0, e);
			}), i;
		}), e.getPreSelectedRowModel = () => e.getCoreRowModel(), e.getSelectedRowModel = E(() => [e.getState().rowSelection, e.getCoreRowModel()], (t, n) => Object.keys(t).length ? G(e, n) : {
			rows: [],
			flatRows: [],
			rowsById: {}
		}, D(e.options, "debugTable", "getSelectedRowModel")), e.getFilteredSelectedRowModel = E(() => [e.getState().rowSelection, e.getFilteredRowModel()], (t, n) => Object.keys(t).length ? G(e, n) : {
			rows: [],
			flatRows: [],
			rowsById: {}
		}, D(e.options, "debugTable", "getFilteredSelectedRowModel")), e.getGroupedSelectedRowModel = E(() => [e.getState().rowSelection, e.getSortedRowModel()], (t, n) => Object.keys(t).length ? G(e, n) : {
			rows: [],
			flatRows: [],
			rowsById: {}
		}, D(e.options, "debugTable", "getGroupedSelectedRowModel")), e.getIsAllRowsSelected = () => {
			let t = e.getFilteredRowModel().flatRows, { rowSelection: n } = e.getState(), r = !!(t.length && Object.keys(n).length);
			return r && t.some((e) => e.getCanSelect() && !n[e.id]) && (r = !1), r;
		}, e.getIsAllPageRowsSelected = () => {
			let t = e.getPaginationRowModel().flatRows.filter((e) => e.getCanSelect()), { rowSelection: n } = e.getState(), r = !!t.length;
			return r && t.some((e) => !n[e.id]) && (r = !1), r;
		}, e.getIsSomeRowsSelected = () => {
			let t = Object.keys(e.getState().rowSelection ?? {}).length;
			return t > 0 && t < e.getFilteredRowModel().flatRows.length;
		}, e.getIsSomePageRowsSelected = () => {
			let t = e.getPaginationRowModel().flatRows;
			return !e.getIsAllPageRowsSelected() && t.filter((e) => e.getCanSelect()).some((e) => e.getIsSelected() || e.getIsSomeSelected());
		}, e.getToggleAllRowsSelectedHandler = () => (t) => {
			e.toggleAllRowsSelected(t.target.checked);
		}, e.getToggleAllPageRowsSelectedHandler = () => (t) => {
			e.toggleAllPageRowsSelected(t.target.checked);
		};
	},
	createRow: (e, t) => {
		e.toggleSelected = (n, r) => {
			let i = e.getIsSelected();
			t.setRowSelection((a) => {
				if (n = n === void 0 ? !i : n, e.getCanSelect() && i === n) return a;
				let o = { ...a };
				return W(o, e.id, n, r?.selectChildren ?? !0, t), o;
			});
		}, e.getIsSelected = () => {
			let { rowSelection: n } = t.getState();
			return K(e, n);
		}, e.getIsSomeSelected = () => {
			let { rowSelection: n } = t.getState();
			return q(e, n) === "some";
		}, e.getIsAllSubRowsSelected = () => {
			let { rowSelection: n } = t.getState();
			return q(e, n) === "all";
		}, e.getCanSelect = () => typeof t.options.enableRowSelection == "function" ? t.options.enableRowSelection(e) : t.options.enableRowSelection ?? !0, e.getCanSelectSubRows = () => typeof t.options.enableSubRowSelection == "function" ? t.options.enableSubRowSelection(e) : t.options.enableSubRowSelection ?? !0, e.getCanMultiSelect = () => typeof t.options.enableMultiRowSelection == "function" ? t.options.enableMultiRowSelection(e) : t.options.enableMultiRowSelection ?? !0, e.getToggleSelectedHandler = () => {
			let t = e.getCanSelect();
			return (n) => {
				t && e.toggleSelected(n.target?.checked);
			};
		};
	}
}, W = (e, t, n, r, i) => {
	var a;
	let o = i.getRow(t, !0);
	n ? (o.getCanMultiSelect() || Object.keys(e).forEach((t) => delete e[t]), o.getCanSelect() && (e[t] = !0)) : delete e[t], r && (a = o.subRows) != null && a.length && o.getCanSelectSubRows() && o.subRows.forEach((t) => W(e, t.id, n, r, i));
};
function G(e, t) {
	let n = e.getState().rowSelection, r = [], i = {}, a = function(e, t) {
		return e.map((e) => {
			var t;
			let o = K(e, n);
			if (o && (r.push(e), i[e.id] = e), (t = e.subRows) != null && t.length && (e = {
				...e,
				subRows: a(e.subRows)
			}), o) return e;
		}).filter(Boolean);
	};
	return {
		rows: a(t.rows),
		flatRows: r,
		rowsById: i
	};
}
function K(e, t) {
	return t[e.id] ?? !1;
}
function q(e, t, n) {
	var r;
	if (!((r = e.subRows) != null && r.length)) return !1;
	let i = !0, a = !1;
	return e.subRows.forEach((e) => {
		if ((!a || i) && (e.getCanSelect() && (K(e, t) ? a = !0 : i = !1), e.subRows && e.subRows.length)) {
			let n = q(e, t);
			n === "all" ? a = !0 : (n === "some" && (a = !0), i = !1);
		}
	}), i ? "all" : a ? "some" : !1;
}
var J = /([0-9]+)/gm, Ke = (e, t, n) => Qe(X(e.getValue(n)).toLowerCase(), X(t.getValue(n)).toLowerCase()), qe = (e, t, n) => Qe(X(e.getValue(n)), X(t.getValue(n))), Je = (e, t, n) => Y(X(e.getValue(n)).toLowerCase(), X(t.getValue(n)).toLowerCase()), Ye = (e, t, n) => Y(X(e.getValue(n)), X(t.getValue(n))), Xe = (e, t, n) => {
	let r = e.getValue(n), i = t.getValue(n);
	return r > i ? 1 : r < i ? -1 : 0;
}, Ze = (e, t, n) => Y(e.getValue(n), t.getValue(n));
function Y(e, t) {
	return e === t ? 0 : e > t ? 1 : -1;
}
function X(e) {
	return typeof e == "number" ? isNaN(e) || e === Infinity || e === -Infinity ? "" : String(e) : typeof e == "string" ? e : "";
}
function Qe(e, t) {
	let n = e.split(J).filter(Boolean), r = t.split(J).filter(Boolean);
	for (; n.length && r.length;) {
		let e = n.shift(), t = r.shift(), i = parseInt(e, 10), a = parseInt(t, 10), o = [i, a].sort();
		if (isNaN(o[0])) {
			if (e > t) return 1;
			if (t > e) return -1;
		} else {
			if (isNaN(o[1])) return isNaN(i) ? -1 : 1;
			if (i > a) return 1;
			if (a > i) return -1;
		}
	}
	return n.length - r.length;
}
var Z = {
	alphanumeric: Ke,
	alphanumericCaseSensitive: qe,
	text: Je,
	textCaseSensitive: Ye,
	datetime: Xe,
	basic: Ze
}, $e = [
	ye,
	ze,
	Pe,
	Fe,
	xe,
	Ae,
	Be,
	Ve,
	{
		getInitialState: (e) => ({
			sorting: [],
			...e
		}),
		getDefaultColumnDef: () => ({
			sortingFn: "auto",
			sortUndefined: 1
		}),
		getDefaultOptions: (e) => ({
			onSortingChange: w("sorting", e),
			isMultiSortEvent: (e) => e.shiftKey
		}),
		createColumn: (e, t) => {
			e.getAutoSortingFn = () => {
				let n = t.getFilteredRowModel().flatRows.slice(10), r = !1;
				for (let t of n) {
					let n = t?.getValue(e.id);
					if (Object.prototype.toString.call(n) === "[object Date]") return Z.datetime;
					if (typeof n == "string" && (r = !0, n.split(J).length > 1)) return Z.alphanumeric;
				}
				return r ? Z.text : Z.basic;
			}, e.getAutoSortDir = () => typeof t.getFilteredRowModel().flatRows[0]?.getValue(e.id) == "string" ? "asc" : "desc", e.getSortingFn = () => {
				if (!e) throw Error();
				return T(e.columnDef.sortingFn) ? e.columnDef.sortingFn : e.columnDef.sortingFn === "auto" ? e.getAutoSortingFn() : t.options.sortingFns?.[e.columnDef.sortingFn] ?? Z[e.columnDef.sortingFn];
			}, e.toggleSorting = (n, r) => {
				let i = e.getNextSortingOrder(), a = n != null;
				t.setSorting((o) => {
					let s = o?.find((t) => t.id === e.id), c = o?.findIndex((t) => t.id === e.id), l = [], u, d = a ? n : i === "desc";
					return u = o != null && o.length && e.getCanMultiSort() && r ? s ? "toggle" : "add" : o != null && o.length && c !== o.length - 1 ? "replace" : s ? "toggle" : "replace", u === "toggle" && (a || i || (u = "remove")), u === "add" ? (l = [...o, {
						id: e.id,
						desc: d
					}], l.splice(0, l.length - (t.options.maxMultiSortColCount ?? 2 ** 53 - 1))) : l = u === "toggle" ? o.map((t) => t.id === e.id ? {
						...t,
						desc: d
					} : t) : u === "remove" ? o.filter((t) => t.id !== e.id) : [{
						id: e.id,
						desc: d
					}], l;
				});
			}, e.getFirstSortDir = () => e.columnDef.sortDescFirst ?? t.options.sortDescFirst ?? e.getAutoSortDir() === "desc" ? "desc" : "asc", e.getNextSortingOrder = (n) => {
				let r = e.getFirstSortDir(), i = e.getIsSorted();
				return i ? i !== r && (t.options.enableSortingRemoval ?? !0) && (!n || (t.options.enableMultiRemove ?? !0)) ? !1 : i === "desc" ? "asc" : "desc" : r;
			}, e.getCanSort = () => (e.columnDef.enableSorting ?? !0) && (t.options.enableSorting ?? !0) && !!e.accessorFn, e.getCanMultiSort = () => e.columnDef.enableMultiSort ?? t.options.enableMultiSort ?? !!e.accessorFn, e.getIsSorted = () => {
				let n = t.getState().sorting?.find((t) => t.id === e.id);
				return n ? n.desc ? "desc" : "asc" : !1;
			}, e.getSortIndex = () => t.getState().sorting?.findIndex((t) => t.id === e.id) ?? -1, e.clearSorting = () => {
				t.setSorting((t) => t != null && t.length ? t.filter((t) => t.id !== e.id) : []);
			}, e.getToggleSortingHandler = () => {
				let n = e.getCanSort();
				return (r) => {
					n && (r.persist == null || r.persist(), e.toggleSorting == null || e.toggleSorting(void 0, e.getCanMultiSort() ? t.options.isMultiSortEvent == null ? void 0 : t.options.isMultiSortEvent(r) : !1));
				};
			};
		},
		createTable: (e) => {
			e.setSorting = (t) => e.options.onSortingChange == null ? void 0 : e.options.onSortingChange(t), e.resetSorting = (t) => {
				e.setSorting(t ? [] : e.initialState?.sorting ?? []);
			}, e.getPreSortedRowModel = () => e.getGroupedRowModel(), e.getSortedRowModel = () => (!e._getSortedRowModel && e.options.getSortedRowModel && (e._getSortedRowModel = e.options.getSortedRowModel(e)), e.options.manualSorting || !e._getSortedRowModel ? e.getPreSortedRowModel() : e._getSortedRowModel());
		}
	},
	Me,
	He,
	Ue,
	We,
	Ge,
	Le
];
function et(e) {
	let t = [...$e, ...e._features ?? []], n = { _features: t }, r = n._features.reduce((e, t) => Object.assign(e, t.getDefaultOptions == null ? void 0 : t.getDefaultOptions(n)), {}), i = (e) => n.options.mergeOptions ? n.options.mergeOptions(r, e) : {
		...r,
		...e
	}, a = { ...e.initialState ?? {} };
	n._features.forEach((e) => {
		a = (e.getInitialState == null ? void 0 : e.getInitialState(a)) ?? a;
	});
	let o = [], s = !1, c = {
		_features: t,
		options: {
			...r,
			...e
		},
		initialState: a,
		_queue: (e) => {
			o.push(e), s || (s = !0, Promise.resolve().then(() => {
				for (; o.length;) o.shift()();
				s = !1;
			}).catch((e) => setTimeout(() => {
				throw e;
			})));
		},
		reset: () => {
			n.setState(n.initialState);
		},
		setOptions: (e) => {
			let t = C(e, n.options);
			n.options = i(t);
		},
		getState: () => n.options.state,
		setState: (e) => {
			n.options.onStateChange == null || n.options.onStateChange(e);
		},
		_getRowId: (e, t, r) => (n.options.getRowId == null ? void 0 : n.options.getRowId(e, t, r)) ?? `${r ? [r.id, t].join(".") : t}`,
		getCoreRowModel: () => (n._getCoreRowModel ||= n.options.getCoreRowModel(n), n._getCoreRowModel()),
		getRowModel: () => n.getPaginationRowModel(),
		getRow: (e, t) => {
			let r = (t ? n.getPrePaginationRowModel() : n.getRowModel()).rowsById[e];
			if (!r && (r = n.getCoreRowModel().rowsById[e], !r)) throw Error();
			return r;
		},
		_getDefaultColumnDef: E(() => [n.options.defaultColumn], (e) => (e ??= {}, {
			header: (e) => {
				let t = e.header.column.columnDef;
				return t.accessorKey ? t.accessorKey : t.accessorFn ? t.id : null;
			},
			cell: (e) => {
				var t;
				return ((t = e.renderValue()) == null || t.toString == null ? void 0 : t.toString()) ?? null;
			},
			...n._features.reduce((e, t) => Object.assign(e, t.getDefaultColumnDef == null ? void 0 : t.getDefaultColumnDef()), {}),
			...e
		}), D(e, "debugColumns", "_getDefaultColumnDef")),
		_getColumnDefs: () => n.options.columns,
		getAllColumns: E(() => [n._getColumnDefs()], (e) => {
			let t = function(e, r, i) {
				return i === void 0 && (i = 0), e.map((e) => {
					let a = _e(n, e, i, r), o = e;
					return a.columns = o.columns ? t(o.columns, a, i + 1) : [], a;
				});
			};
			return t(e);
		}, D(e, "debugColumns", "getAllColumns")),
		getAllFlatColumns: E(() => [n.getAllColumns()], (e) => e.flatMap((e) => e.getFlatColumns()), D(e, "debugColumns", "getAllFlatColumns")),
		_getAllFlatColumnsById: E(() => [n.getAllFlatColumns()], (e) => e.reduce((e, t) => (e[t.id] = t, e), {}), D(e, "debugColumns", "getAllFlatColumnsById")),
		getAllLeafColumns: E(() => [n.getAllColumns(), n._getOrderColumnsFn()], (e, t) => t(e.flatMap((e) => e.getLeafColumns())), D(e, "debugColumns", "getAllLeafColumns")),
		getColumn: (e) => n._getAllFlatColumnsById()[e]
	};
	Object.assign(n, c);
	for (let e = 0; e < n._features.length; e++) {
		let t = n._features[e];
		t == null || t.createTable == null || t.createTable(n);
	}
	return n;
}
function tt() {
	return (e) => E(() => [e.options.data], (t) => {
		let n = {
			rows: [],
			flatRows: [],
			rowsById: {}
		}, r = function(t, i, a) {
			i === void 0 && (i = 0);
			let o = [];
			for (let c = 0; c < t.length; c++) {
				let l = be(e, e._getRowId(t[c], c, a), t[c], c, i, void 0, a?.id);
				if (n.flatRows.push(l), n.rowsById[l.id] = l, o.push(l), e.options.getSubRows) {
					var s;
					l.originalSubRows = e.options.getSubRows(t[c], c), (s = l.originalSubRows) != null && s.length && (l.subRows = r(l.originalSubRows, i + 1, l));
				}
			}
			return o;
		};
		return n.rows = r(t), n;
	}, D(e.options, "debugTable", "getRowModel", () => e._autoResetPageIndex()));
}
// packages/ui/src/components/data-table/helpers.tsx
var Q = (e) => typeof e == "object" && !!e && "display" in e, nt = (e) => typeof e == "string" || e instanceof String, rt = (e) => typeof e == "number" || e instanceof Number, it = (e) => typeof e == "boolean" || e instanceof Boolean, at = (e) => {
	let t = e.map((e) => Q(e) ? e.sortValue ?? null : e instanceof String || e instanceof Number || e instanceof Boolean ? e.valueOf() : s(e) ? null : e).filter((e) => e != null);
	return t.length === 0 ? "unknown" : t.every((e) => nt(e) && !Number.isNaN(Date.parse(e.toString()))) ? "date" : t.every((e) => rt(e)) ? "number" : t.every((e) => it(e)) ? "boolean" : t.every((e) => nt(e)) ? "string" : "unknown";
}, $ = {
	boxSize: "14px",
	marginRight: "2px"
}, ot = (i) => {
	let a = at(i);
	return a === "date" ? /* @__PURE__ */ f(u, {
		as: e,
		...$
	}) : a === "string" ? /* @__PURE__ */ f(u, {
		as: t,
		...$
	}) : a === "number" ? /* @__PURE__ */ f(u, {
		as: r,
		...$
	}) : a === "boolean" ? /* @__PURE__ */ f(u, {
		as: n,
		...$
	}) : null;
};
function st(e) {
	if (Q(e)) return e.display;
	if (s(e)) return e;
	switch ((e instanceof String || e instanceof Number || e instanceof Boolean) && (e = e.valueOf()), typeof e) {
		case "boolean": return e ? "TRUE" : "FALSE";
		case "number": return e;
		case "object": return e === null ? "-" : JSON.stringify(e);
		case "undefined": return "-";
		default: return e ? String(e) : "-";
	}
}
var ct = pe(), lt = (e, t, n) => n ? n(e, t) : typeof e.id == "string" ? e.id : String(t), ut = (e) => typeof e.initialPageSize == "number" && e.initialPageSize > 0 ? e.initialPageSize : 30, dt = (e) => e.map((e) => e.original), ft = (e) => {
	let t = [...e.selectionActions ?? []];
	return e.onCSVDownload && t.push({
		label: "Download CSV",
		onSelect: (t) => {
			e.onCSVDownload?.(t.map((t, n) => lt(t, n, e.getRowId)));
		}
	}), t;
}, pt = (e) => e.selectionMode === "multiple" || !!e.onCSVDownload || !!e.selectionActions?.length, mt = (e) => e.enableRowActivation === !0 && e.activeRowId === e.rowId, ht = (e, t) => p(e, t), gt = (e, t, n) => ({ kind: m(e.map((e) => e[t]), {
	type: n.columnTypes?.[t],
	renderer: n.columnRenderers?.[t]
}) }), _t = (e, t, n = {}) => t.map((t) => ({
	id: t,
	label: n.compactHeaders?.[t] ?? t,
	type: gt(e, t, n),
	filterable: n.filterableColumns?.includes(t) ?? !0,
	sortable: !0,
	groupable: n.groupableColumns?.includes(t) ?? !1,
	displayable: !0
})), vt = (e, t, n, r) => e.map((e, i) => {
	let a = Object.fromEntries(t.map((t) => [t, ht(e[t], r?.[t])])), o = lt(e, i, n), s = t.length > 0 ? a[t[0]] : o;
	return {
		id: o,
		title: String(s ?? o),
		attributes: a,
		sourceRow: e
	};
}), yt = (e, t) => {
	let n = new Set(e), r = t.filter((e) => n.has(e)), i = new Set(r), a = e.filter((e) => !i.has(e));
	return [...r, ...a];
}, bt = (e, t, n) => n ? e.filter((e) => e !== t) : [.../* @__PURE__ */ new Set([...e, t])], xt = (e) => typeof e == "string" || typeof e == "number" ? [String(e)] : Array.isArray(e) ? e.flatMap(xt) : s(e) ? xt(e.props.children) : [], St = (e, t, n = /* @__PURE__ */ new Date()) => {
	if (t?.type === "json") return [le(e)];
	if (t?.type === "badge" && [
		"string",
		"number",
		"boolean"
	].includes(typeof e)) return [String(e)];
	if (t?.type === "date") {
		let t = _(e, n);
		if (t) return [t];
	}
	return t?.type === "diff" && h(e) ? [`+${e.additions}`, `-${e.deletions}`] : xt(st(e));
}, Ct = (e, t, n) => {
	let r = e.indexOf(t), i = e.indexOf(n);
	if (r < 0 || i < 0 || r === i) return e;
	let a = [...e], [o] = a.splice(r, 1);
	return o ? (a.splice(i, 0, o), a) : e;
}, wt = (e) => e.toolbarStorageKey ?? `data-table:${e.columnKeys.join("|") || "empty"}`;
export { x as C, h as E, S, _ as T, et as _, Ct as a, b, ut as c, mt as d, bt as f, Q as g, ot as h, dt as i, ft as l, st as m, vt as n, yt as o, ct as p, St as r, wt as s, _t as t, pt as u, tt as v, te as w, le as x, fe as y };
