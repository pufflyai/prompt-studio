// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./list-filter-BPOkFpgD.ts";
import { t } from "./empty-state-C7gtd4pd.ts";
import { t as n } from "./icon-options-BaFkbkcp.ts";
import { _ as r, a as i, f as a, g as o, h as s, i as c, o as l, u, v as d } from "./collection-view-fields-D15M65ck.ts";
import { n as f, t as p } from "./collection-view-filter-C1-8HUTj.ts";
import { n as m, r as h, t as g } from "./collection-view-bar-DZiXTxjX.ts";
import { n as _ } from "./highlighted-text-CaWxQuWj.ts";
import { i as v, r as y } from "./collection-view-grouping-B8HGb2BH.ts";
import { t as b } from "./collection-page-Kq8b-Cu2.ts";
import { a as x, c as S, i as C, n as w, r as T, s as E, t as D } from "./kanban-renderer-helpers-CvTscXNQ.ts";
import { t as O } from "./display-menu-DgqSpRfh.ts";
import { t as k } from "./display-sort-control-DHtzd27a.ts";
import { t as A } from "./collection-view-empty-state-BI6CP-yJ.ts";
import { t as j } from "./kanban-renderer-board-Cn-_gg0W.ts";
import { t as M } from "./kanban-renderer-list-CSW5NN27.ts";
import { t as ee } from "./kanban-renderer-create-dialog-C9n04h3-.ts";
import { useDeferredValue as te, useEffect as N, useReducer as P, useState as ne } from "react";
import { Box as F, Button as I, Icon as L, Stack as re } from "@chakra-ui/react";
import { Fragment as R, jsx as z, jsxs as B } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-action.ts
var V = async (e, t, n) => {
	try {
		await t();
	} catch (t) {
		if (!n) throw t;
		n(t, e);
	}
}, H = (e, t) => {
	let { attributes: n, columnGrouping: i, rowGrouping: a, knownColumnKeys: o, structureRows: s = e } = t, c = r(n, i), l = r(n, a), u = c ? y(s, c) : [];
	return (c ? y(e, c, o ?? u.map((e) => e.key)) : [{
		key: "all",
		label: "All",
		rows: e
	}]).map((e) => {
		let t = c ? u.find((t) => t.key === e.key)?.rows ?? [] : s, n = l ? y(t, l).map((e) => e.key) : [];
		return {
			...e,
			subgroups: l ? y(e.rows, l, n) : []
		};
	});
}, U = (e, t, n) => {
	let i = {}, a = r(n, t);
	if (!a) return i;
	for (let t of e) for (let e of l(t, a)) i[e] = (i[e] ?? 0) + 1;
	return i;
}, W = (e) => {
	let t = e.attributes.id;
	return typeof t == "string" && t ? t : e.id;
}, ie = (e) => {
	let { rows: t, filter: n, fields: r, attributes: a, settings: s, search: l } = e;
	if (e.providerFiltered) return {
		filteredRows: t,
		visibleRows: t,
		columnTotals: /* @__PURE__ */ new Map()
	};
	let u = s.displayProperties.filter((e) => e !== "id"), d = s.displayProperties.includes("id"), p = (e) => s.viewMode === "list" ? typeof e.attributes.id == "string" ? [e.attributes.id] : [] : d ? [W(e)] : [], m = (e) => [
		e.title,
		...p(e),
		...u.flatMap((t) => {
			let n = c(a, t);
			return n ? i(e, n) : [];
		})
	], h = f(t, n, r), g = _(h, l, m), v = H(h, {
		attributes: a,
		columnGrouping: s.columnGrouping,
		rowGrouping: o
	});
	return {
		filteredRows: h,
		visibleRows: g,
		columnTotals: new Map(v.map((e) => [e.key, e.rows.length]))
	};
}, ae = (e) => {
	let { grouped: t, settings: n, sorts: i, fields: o, attributes: s, search: c, columnTotals: l } = e, { getBoardColumnConfig: u, getRowContextMenuActions: d, onAttributeChange: f, onActionError: p, onRowClick: m } = e, h = n.displayProperties.filter((e) => e !== "id"), g = n.displayProperties.includes("id"), _ = r(s, n.columnGrouping), y = (t) => (e.presorted ? t : v(t, i, o)).map((e) => ({
		id: e.id,
		get contextMenuActions() {
			return d?.(e);
		},
		get cardProps() {
			return {
				eyebrow: g ? W(e) : void 0,
				title: e.title,
				highlight: c,
				badges: C(e, s, h),
				customSlots: x(e, s, h),
				onBadgeChange: f ? (t, n) => V("Update attribute", () => f(e.id, t, n), p) : void 0,
				onClick: () => m?.(e)
			};
		}
	}));
	return t.map((e) => {
		let t = u?.(e.key) ?? {}, n = _ ? a(_.type, e.key) : void 0, r = e.subgroups.length > 0 ? e.subgroups.map((e) => ({
			key: e.key,
			label: e.label,
			count: e.count,
			items: y(e.rows)
		})) : void 0;
		return {
			id: e.key,
			count: e.count,
			label: e.label,
			color: t.color ?? n?.color,
			icon: n?.icon ?? "circle",
			canCreate: t.canCreate ?? !1,
			actions: t.actions ?? [],
			items: r ? [...new Map(r.flatMap((e) => e.items).map((e) => [e.id, e])).values()] : y(e.rows),
			groups: r,
			totalCount: l?.get(e.key)
		};
	});
}, G = (n) => {
	let { ruleCount: r, hiddenCount: i, onEditFilter: a } = n;
	return /* @__PURE__ */ z(t, {
		role: "status",
		size: "sm",
		flexShrink: "0",
		icon: /* @__PURE__ */ z(L, { as: e }),
		title: "Nothing matches this view",
		description: `${r} filter ${r === 1 ? "rule hides" : "rules hide"} all ${i} ${i === 1 ? "item" : "items"}.`,
		children: a ? /* @__PURE__ */ B(I, {
			size: "2xs",
			variant: "outline",
			onClick: a,
			children: [/* @__PURE__ */ z(e, {}), " Edit filter"]
		}) : null
	});
}, K = (e) => {
	let { emptyState: n, title: r, description: i, height: a } = e;
	return n === void 0 ? /* @__PURE__ */ z(t, {
		title: r,
		description: i,
		height: a
	}) : a ? /* @__PURE__ */ z(F, {
		height: a,
		children: n
	}) : n;
}, oe = (e) => {
	let { contentPlaceholder: t, sourceCount: n, filteredCount: r, visibleCount: i, search: a, ruleCount: o, onClearSearch: s, onEditFilter: c, viewMode: l, boardColumns: u, listItems: d, listExpandedGroups: f, selectedRowId: p, emptyState: m, emptyTitle: h, emptyDescription: g, onBoardMoveItem: _, onBoardMoveToGroup: v, onCreateRow: y, onColumnAction: b, onListExpandedGroupChange: x, listKey: S } = e;
	if (t !== void 0) return t;
	if (n > 0 && i === 0 && a.trim()) return /* @__PURE__ */ z(A, {
		search: a,
		onClearSearch: s
	});
	let C = n > 0 && r === 0, w = l === "board" ? u.length > 0 : d.length > 0, T = C && !w ? /* @__PURE__ */ z(G, {
		ruleCount: o,
		hiddenCount: n,
		onEditFilter: c
	}) : null;
	return l === "board" ? /* @__PURE__ */ B(R, { children: [T, /* @__PURE__ */ B(F, {
		flex: "1",
		minH: "0",
		children: [u.length > 0 ? /* @__PURE__ */ z(j, {
			onLoadMore: e.onLoadMore,
			loadingMore: e.loadingMore,
			columns: u,
			selectedItemId: p,
			onMoveItem: _,
			onMoveToGroup: v,
			onCreateStart: y,
			onColumnAction: b
		}) : null, u.length === 0 && !C ? /* @__PURE__ */ z(K, {
			emptyState: m,
			title: h,
			description: g,
			height: "100%"
		}) : null]
	})] }) : d.length > 0 ? /* @__PURE__ */ B(R, { children: [T, /* @__PURE__ */ z(M, {
		onLoadMore: e.onLoadMore,
		loadingMore: e.loadingMore,
		items: d,
		selectedItemId: p,
		expandedGroups: f,
		onExpandedGroupChange: x
	}, S)] }) : C ? T : /* @__PURE__ */ z(K, {
		emptyState: m,
		title: h,
		description: g
	});
}, q = (e) => {
	let { rowId: t, columnGrouping: n, rowGrouping: r, targetColumnId: i, targetGroupKey: a, beforeRowId: o, sorts: s } = e, c = {}, l = (e, t) => {
		e && e !== "none" && t !== void 0 && (c[e] = t);
	};
	return l(n, i), l(r, a), {
		rowId: t,
		attributes: c,
		...s.length === 0 ? { order: { beforeRowId: o } } : {}
	};
}, se = (e) => {
	let { settings: t, sorts: i, search: o, visibleRows: s, grouped: c, attributes: l, onRowClick: d, onActionError: f, onAttributeChange: p, onReorder: m, onMove: h, getRowContextMenuActions: g } = e, _ = i.length === 0, y = u(l), b = (t) => e.presorted ? t : v(t, i, y), w = t.displayProperties.filter((e) => e !== "id"), T = (e, t) => {
		let i = r(l, e), o = i ? a(i.type, t) : void 0;
		return {
			statusColorPalette: o?.color,
			statusIcon: n(o?.icon)
		};
	}, E = (e) => {
		let t = e.attributes.status;
		return typeof t == "string" ? T("status", t) : {};
	}, D = (e, n) => {
		let r = typeof e.attributes.id == "string" ? e.attributes.id : void 0;
		return {
			id: e.id,
			eyebrow: r && r !== e.title ? r : void 0,
			title: e.title,
			highlight: o,
			...E(e),
			badges: C(e, l, w),
			customSlots: x(e, l, w),
			contextMenuActions: g?.(e),
			onClick: () => d?.(e),
			onBadgeChange: p ? (t, n) => V("Update attribute", () => p(e.id, t, n), f) : void 0,
			draggable: !!(h || p || m),
			onDropRow: _ && (h || p || m) ? (r) => V("Move row", async () => {
				let a = S(t.columnGrouping, n);
				if (h) return h(q({
					rowId: r,
					...t,
					sorts: i,
					targetColumnId: a,
					targetGroupKey: n?.rowKey,
					beforeRowId: e.id
				}));
				a && t.columnGrouping !== "none" && p && await p(r, t.columnGrouping, a), t.rowGrouping !== "none" && n?.rowKey && p && await p(r, t.rowGrouping, n.rowKey), await m?.(r, e.id);
			}, f) : void 0
		};
	}, O = (e, n) => {
		let r = n ? t.rowGrouping : t.columnGrouping;
		return {
			id: n ? `group::${n.columnKey}::${e.key}` : `group::${e.key}`,
			title: e.label,
			isGroup: !0,
			countBadge: e.count ?? e.rows.length,
			...T(r, e.key),
			onDropRow: (h || p) && t.columnGrouping !== "none" ? (r) => V("Move row", async () => {
				let a = n?.columnKey ?? e.key;
				if (h) {
					let o = q({
						rowId: r,
						...t,
						sorts: i,
						targetColumnId: a,
						targetGroupKey: n ? e.key : void 0
					});
					return h({
						rowId: o.rowId,
						attributes: o.attributes
					});
				}
				await p(r, t.columnGrouping, a), t.rowGrouping !== "none" && n && await p(r, t.rowGrouping, e.key);
			}, f) : void 0,
			children: b(e.rows).map((t) => D(t, {
				columnKey: n?.columnKey ?? e.key,
				rowKey: n ? e.key : void 0
			}))
		};
	};
	return t.columnGrouping === "none" ? b(s).map((e) => D(e)) : c.map((e) => e.subgroups.length > 0 ? {
		id: `group::${e.key}`,
		title: e.label,
		isGroup: !0,
		countBadge: e.count ?? e.rows.length,
		...T(t.columnGrouping, e.key),
		onDropRow: h || p ? (n) => V("Move row", () => h ? h({
			rowId: n,
			attributes: q({
				rowId: n,
				...t,
				sorts: i,
				targetColumnId: e.key
			}).attributes
		}) : p(n, t.columnGrouping, e.key), f) : void 0,
		children: e.subgroups.map((t) => O(t, { columnKey: e.key }))
	} : O(e));
}, J = async (e) => {
	let { settings: t, sorts: n, rowId: r, targetColumnId: i, targetGroupKey: a, beforeItemId: o, onAttributeChange: s, onReorder: c } = e;
	t.columnGrouping !== "none" && s && await s(r, t.columnGrouping, i), t.rowGrouping !== "none" && a && s && await s(r, t.rowGrouping, a), n.length === 0 && await c?.(r, o);
}, ce = async (e) => {
	let { settings: t, sorts: n, rowId: r, targetGroupKey: i, beforeItemId: a, onAttributeChange: o, onReorder: s } = e;
	t.rowGrouping !== "none" && o && (await o(r, t.rowGrouping, i), n.length === 0 && await s?.(r, a));
}, le = (e) => {
	let { settings: t, sorts: n, onMove: r, onActionError: i, onAttributeChange: a, onReorder: o } = e;
	return {
		handleBoardMoveItem: async (e, s, c) => {
			await V("Move row", () => r ? r(q({
				rowId: e,
				...t,
				sorts: n,
				targetColumnId: s,
				targetGroupKey: c?.targetGroupKey,
				beforeRowId: c?.beforeItemId
			})) : J({
				settings: t,
				sorts: n,
				rowId: e,
				targetColumnId: s,
				targetGroupKey: c?.targetGroupKey,
				beforeItemId: c?.beforeItemId,
				onAttributeChange: a,
				onReorder: o
			}), i);
		},
		handleBoardMoveToGroup: async (e, s, c) => {
			await V("Move row", () => r ? r(q({
				rowId: e,
				rowGrouping: t.rowGrouping,
				sorts: n,
				targetGroupKey: s,
				beforeRowId: c?.beforeItemId
			})) : ce({
				settings: t,
				sorts: n,
				rowId: e,
				targetGroupKey: s,
				beforeItemId: c?.beforeItemId,
				onAttributeChange: a,
				onReorder: o
			}), i);
		}
	};
}, ue = (e, t, n, i, a) => {
	let o = r(n, i.columnGrouping), s = r(n, i.rowGrouping);
	return t ? o ? b(e, t, o).map((n) => ({
		...n,
		subgroups: s ? b(e.find((e) => e.key === n.key)?.subgroups ?? [], t, s, {
			field: o,
			key: n.key
		}) : []
	})) : e.map((e) => ({
		...e,
		count: a,
		subgroups: s ? b(e.subgroups, t, s) : []
	})) : e;
}, Y = (e, t) => e ?? t.length, X = (e) => ({
	settings: {
		...s,
		...e?.settings
	},
	filter: e?.filter,
	sorts: e?.sorts
}), Z = (e, t, n) => h(e, X(n), t), de = (e) => {
	let t = [];
	for (let n of e) (n.type.kind === "enum" || n.type.kind === "enum-multi") && d(n.type.options) && t.push(n.type.options);
	return t;
}, fe = (e) => e.map((e) => e.type.kind !== "enum" && e.type.kind !== "enum-multi" || !d(e.type.options) ? e : {
	...e,
	type: {
		...e.type,
		options: e.type.options.getSnapshot()
	}
}), pe = (e) => {
	let [, t] = P((e) => e + 1, 0);
	return N(() => {
		let n = de(e);
		if (n.length === 0) return;
		let r = () => t(), i = n.map((e) => e.subscribe(r));
		return () => {
			for (let e of i) e();
		};
	}, [e]), fe(e);
}, Q = (e, t) => e.includes(t) ? e.filter((e) => e !== t) : [...e, t], me = (e) => {
	let { rows: t, storageKey: n, attributes: r, defaultSettings: i, defaultFilter: a, defaultSorts: o } = e, { search: s, onSearchChange: c, searchResultLabel: l, leading: d, actions: f } = e, p = X({
		settings: i,
		filter: a,
		sorts: o
	}), h = pe(r), _ = m({
		...e,
		initialState: p,
		fields: h
	}), { settings: v, setSettings: y, sorts: b, setSorts: x } = Z(n, (e) => e, p), S = w(h, t);
	return /* @__PURE__ */ z(g, {
		itemLabel: e.itemLabel,
		storageKey: n,
		initialState: p,
		views: _.views,
		viewsSource: e.viewsSource,
		fields: u(h),
		optionsFor: (e) => {
			let n = U(t, e.id, h);
			return (S.find((t) => t.id === e.id)?.options ?? []).map((e) => ({
				...e,
				count: n[e.value] ?? 0
			}));
		},
		search: s,
		onSearchChange: c,
		searchResultLabel: l,
		leading: d,
		actions: f,
		displayControl: /* @__PURE__ */ z(O, {
			settings: v,
			sortControl: /* @__PURE__ */ z(k, {
				fields: u(h),
				sorts: b,
				onSortsChange: x
			}),
			groupingOptions: T(h),
			displayPropertyOptions: D(h),
			onViewModeChange: (e) => y({ viewMode: e }),
			onColumnGroupingChange: (e) => y({ columnGrouping: e }),
			onRowGroupingChange: (e) => y({ rowGrouping: e }),
			onDisplayPropertyToggle: (e) => y({ displayProperties: Q(v.displayProperties, e) })
		})
	});
}, $ = (e) => {
	let { rows: t, storageKey: n, attributes: r, selectedRowId: i = null, emptyState: a, emptyTitle: o = "No rows found", emptyDescription: s = "Try changing filters or display settings.", contentPlaceholder: c, defaultSettings: l, defaultFilter: d, defaultSorts: f, viewsSource: h, defaultViews: g, defaultActiveViewId: _, onRowClick: v, onActionError: y, onAttributeChange: b, onReorder: x, onMove: S, createRow: C, onCreateRow: w, onColumnAction: T, getBoardColumnConfig: D, getRowContextMenuActions: O, hideToolbar: k = !1, toolbarActions: A, toolbarLeading: j } = e, M = X({
		settings: l,
		filter: d,
		sorts: f
	}), N = pe(r), P = u(N);
	m({
		...e,
		initialState: M,
		fields: P
	});
	let [F, I] = ne(null), [L, R] = ne(""), V = e.page?.request.search ?? L, U = e.page?.onSearchChange ?? R, W = te(V), G = Z(n, (e) => e.settings, M), K = Z(n, (e) => e.filter, M), q = Z(n, (e) => e.activeViewId, M), J = Z(n, (e) => e.sorts, M), ce = Z(n, (e) => e.expandedGroups, M), de = Z(n, (e) => e.setExpandedGroup, M), fe = Z(n, (e) => e.setOpenMenu, M), { filteredRows: Q, visibleRows: $, columnTotals: he } = ie({
		rows: t,
		providerFiltered: !!e.page,
		filter: K,
		fields: P,
		attributes: N,
		settings: G,
		search: W
	}), ge = W.trim() !== "", _e = ue(H($, {
		attributes: N,
		columnGrouping: G.columnGrouping,
		rowGrouping: G.rowGrouping,
		knownColumnKeys: E(G.columnGrouping, N, K, t),
		structureRows: t
	}), e.page?.result?.groups, N, G, e.page?.result?.filteredTotal), ve = G.viewMode === "list" ? se({
		settings: G,
		sorts: J,
		presorted: !!e.page,
		search: W,
		visibleRows: $,
		grouped: _e,
		attributes: N,
		onRowClick: v,
		onActionError: y,
		onAttributeChange: b,
		onReorder: x,
		onMove: S,
		getRowContextMenuActions: O
	}) : [], ye = G.viewMode === "board" ? ae({
		grouped: _e,
		settings: G,
		sorts: J,
		presorted: !!e.page,
		fields: P,
		attributes: N,
		search: W,
		columnTotals: ge ? he : void 0,
		getBoardColumnConfig: D,
		getRowContextMenuActions: O,
		onAttributeChange: b,
		onActionError: y,
		onRowClick: v
	}) : [], { handleBoardMoveItem: be, handleBoardMoveToGroup: xe } = le({
		settings: G,
		sorts: J,
		onMove: S,
		onActionError: y,
		onAttributeChange: b,
		onReorder: x
	});
	return /* @__PURE__ */ B(re, {
		"data-testid": "kanban-renderer",
		height: "100%",
		minH: "0",
		gap: "0",
		background: "bg",
		overflow: "hidden",
		children: [
			k ? null : /* @__PURE__ */ z(me, {
				itemLabel: e.itemLabel,
				rows: t,
				storageKey: n,
				attributes: N,
				defaultSettings: l,
				defaultFilter: d,
				defaultSorts: f,
				search: V,
				onSearchChange: U,
				searchResultLabel: ge ? `${e.page?.result?.filteredTotal ?? $.length} of ${Y(e.page?.result?.total, Q)}` : void 0,
				viewsSource: h,
				defaultViews: g,
				defaultActiveViewId: _,
				leading: j,
				actions: A
			}),
			/* @__PURE__ */ z(oe, {
				contentPlaceholder: c,
				sourceCount: Y(e.page?.result?.total, t),
				filteredCount: Y(e.page?.result?.total, Q),
				visibleCount: $.length,
				search: W,
				ruleCount: p(K),
				onClearSearch: () => U(""),
				onEditFilter: k ? void 0 : () => fe("filter"),
				viewMode: G.viewMode,
				boardColumns: ye,
				listItems: ve,
				listExpandedGroups: ce,
				selectedRowId: i,
				emptyState: a,
				emptyTitle: o,
				emptyDescription: s,
				onBoardMoveItem: be,
				onBoardMoveToGroup: xe,
				onCreateRow: C && w ? I : void 0,
				onColumnAction: T,
				onListExpandedGroupChange: de,
				listKey: `${G.columnGrouping}:${G.rowGrouping}`,
				onLoadMore: e.page?.result?.cursor ? e.page.onLoadMore : void 0,
				loadingMore: e.page?.loading
			}),
			C && w && F ? /* @__PURE__ */ z(ee, {
				open: !0,
				columnId: F,
				columnAttributeId: G.columnGrouping === "none" ? void 0 : G.columnGrouping,
				attributes: N,
				config: C,
				draftKey: JSON.stringify([
					n,
					q,
					K
				]),
				filter: K,
				onClose: () => I(null),
				onSubmit: w
			}) : null
		]
	});
};
export { Z as n, $ as t };
