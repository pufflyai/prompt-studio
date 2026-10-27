// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e, n as t, s as n } from "./workbench-core-N58OeDyx.ts";
import { t as r } from "./renderer-read-key-WONjLXkB.ts";
import { r as i } from "./resource-actions-B6hNjsqI.ts";
import { n as a } from "./use-page-params-BMVjuYZ6.ts";
import { t as o } from "./renderer-read-notice-Ceo0RX8O.ts";
import { t as s } from "./use-renderer-read-CxbGovUR.ts";
import { t as c } from "./view-toolbar-actions-7QQU--AT.ts";
import { useRef as l, useState as u, useSyncExternalStore as d } from "react";
import { Box as f, Stack as p } from "@chakra-ui/react";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
import { KanbanRenderer as g, KanbanRendererSkeleton as _, applyKanbanMove as v, isAttributesSource as y, useKanbanRendererStore as b } from "@pstdio/ui/kanban-renderer";
// packages/pstdio-workbench/src/react/renderers/renderer-page-fields.ts
var x = (e, t) => e.filter((e) => e.id === t.grouping || !e.hidden && !t.hiddenColumns.includes(e.id)).map((e) => e.id), S = (e, t) => {
	let n = /* @__PURE__ */ new Set([
		"title",
		...t.displayProperties,
		t.columnGrouping,
		t.rowGrouping
	]);
	n.delete("none"), t.viewMode === "list" && n.add("id");
	for (let t of e) n.has(t.id) && t.display?.kind === "badge-list" && n.add(t.display.itemsAttributeId);
	return [...n];
}, C = (e) => JSON.stringify(e, (e, t) => !t || typeof t != "object" || Array.isArray(t) ? t : Object.fromEntries(Object.keys(t).sort().map((e) => [e, t[e]]))), w = (e, t, n, r) => ({
	identity: e,
	offset: t,
	revision: r.page.revision,
	cursor: t === r.offset + n ? r.page.cursor ?? void 0 : void 0
}), T = (e) => {
	let [t, n] = u(0), [r, i] = u(""), [a, o] = u({
		scope: e.scope,
		groups: []
	}), s = a.scope === e.scope ? a.groups : [], c = (t) => o({
		scope: e.scope,
		groups: t
	}), [d, f] = u(Math.max(1, Math.min(100, e.initialPageSize ?? 100))), p = JSON.stringify([
		e.identity,
		e.fields,
		r,
		s,
		d,
		t
	]), [m, h] = u({
		identity: p,
		offset: 0
	}), g = m.identity === p ? m : {
		identity: p,
		offset: 0
	};
	m.identity !== p && h(g);
	let _ = l(void 0), v = {
		limit: d,
		offset: g.offset,
		cursor: g.cursor,
		revision: g.revision,
		fields: e.fields,
		search: r,
		collapsedGroups: s
	}, y = () => (_.current = void 0, n((e) => e + 1), !0), b = (t) => {
		let n = _.current;
		n?.identity !== p || e.append && n.offset !== g.offset || h(w(p, t * d, d, n));
	};
	return {
		key: p,
		request: v,
		search: r,
		setSearch: i,
		collapsedGroups: s,
		setCollapsedGroups: c,
		pageIndex: Math.floor(g.offset / d),
		setLimit: f,
		reset: y,
		go: b,
		controls: (e, t, n, r) => n ? {
			request: v,
			result: e,
			displayed: r,
			loading: t,
			onSearchChange: i,
			onPageSizeChange: (e) => f(Math.max(1, Math.min(100, e))),
			onCollapsedGroupsChange: c,
			onPageChange: (t) => {
				e && b(t);
			},
			onLoadMore: () => {
				e?.cursor && b(Math.floor(g.offset / d) + 1);
			}
		} : void 0,
		accept: (t, n) => {
			let r = _.current, i = e.append && g.offset > 0 && r?.identity === p && r.page.revision === t.page.revision ? [...r.rows.slice(0, g.offset), ...t.rows] : t.rows;
			return n.aborted || (_.current = {
				identity: p,
				offset: g.offset,
				rows: i,
				page: t.page
			}), {
				...t,
				rows: i,
				position: v
			};
		}
	};
}, E = (e, t) => {
	let { onMove: n, onAttributeChange: r, onReorder: i } = e;
	if (n) return {
		move: t,
		save: () => n(t)
	};
	let a = {
		rowId: t.rowId,
		attributes: r ? t.attributes : {},
		order: i ? t.order : void 0
	};
	return {
		move: a,
		save: async () => {
			for (let [e, n] of Object.entries(a.attributes)) await r(t.rowId, e, n);
			a.order && await i(t.rowId, a.order.beforeRowId);
		}
	};
}, D = (e) => e, O = (e, t) => {
	let n = e.resource?.metadata, r = e.resource?.projectId ?? n?.projectId;
	if (typeof r == "string") return r;
	let i = n?.favoriteScope;
	if (!i || typeof i != "object" || Array.isArray(i)) return t;
	let a = i;
	return a.scope === "project" && typeof a.projectId == "string" ? a.projectId : void 0;
}, k = (e, t, n) => {
	let r = `pstdio:workbench:kanbanRenderer:${e}:${t.instanceId}`, i = O(t, n);
	return i ? `${r}:project:${i}` : r;
}, A = (e) => {
	let { children: t } = e;
	return /* @__PURE__ */ m(p, {
		h: "full",
		minH: "0",
		gap: "0",
		bg: "bg",
		overflow: "hidden",
		position: "relative",
		children: /* @__PURE__ */ m(f, {
			position: "absolute",
			inset: "0",
			minH: "0",
			minW: "0",
			overflow: "hidden",
			display: "flex",
			flexDirection: "column",
			children: t
		})
	});
}, j = () => () => {}, M = (e) => !!(e && typeof e == "object" && "type" in e && typeof e.type == "string" && "id" in e && typeof e.id == "string"), N = (e) => {
	let t = y(e) ? e : void 0, n = t ? void 0 : e, r = t ? t.subscribe : j, i = t ? t.getSnapshot : () => n;
	return d(r, i, i);
}, P = (e, t) => {
	let n = new Set(e.map((e) => e.key)), r = new Set(e.flatMap((e) => e.commandId ? [e.commandId] : []));
	return [...e, ...t.filter((e) => !n.has(e.key) && (!e.commandId || !r.has(e.commandId)))];
}, F = (l) => {
	let { workbench: u, placement: f } = l, p = a(u, f), y = D(l.contribution), x = i(u), w = N(y.attributes), O = k(y.id, f, y.storageScope), F = y.viewsProvider, I = d(F?.subscribe ?? j, F?.getSnapshot ?? (() => void 0), F?.getSnapshot ?? (() => void 0)), L = {
		settings: y.defaultSettings,
		filter: y.defaultFilter,
		sorts: y.defaultSorts
	}, R = b(O, (e) => e.settings, L), z = b(O, (e) => e.filter, L), B = b(O, (e) => e.sorts, L), V = T({
		identity: C([
			O,
			R,
			z,
			B,
			p
		]),
		scope: O,
		fields: S(w, R),
		append: !0
	}), H = !!y.executePage, U = s({
		workbench: u,
		ownerKey: r(f),
		queryKey: JSON.stringify([y.id, O]),
		refreshKey: C([
			R,
			z,
			B,
			p,
			...H ? [V.request, V.key] : []
		]),
		load: async (e) => {
			let t = {
				settings: R,
				filter: z,
				sorts: B,
				pageParams: p
			};
			return y.executePage ? V.accept(await y.executePage({
				...t,
				page: V.request
			}, e), e) : {
				rows: await y.executeQuery(t, e),
				page: void 0,
				position: void 0
			};
		},
		subscribe: (e) => {
			let n = () => {
				H && V.reset() || e();
			}, r = y.subscribe?.(n), i = t(u).onDidRefreshKanbanRenderer((e) => {
				e.kanbanRendererId === y.id && n();
			});
			return () => {
				typeof r == "function" ? r() : r?.dispose(), i.dispose();
			};
		}
	}), W = U.value?.rows ?? [], G = (...e) => U.mutate(...e).finally(() => {
		H && V.reset();
	}), K = (t) => {
		t.target ? e(u, "Open row", () => u.navigation.openTarget(t.target)) : y.onRowActivate && e(u, "Open row", () => y.onRowActivate(t));
	}, q = (t) => P(M(t.resource) ? x(t.resource) : [], (y.getRowContextMenuActions?.(t) ?? []).map((t) => ({
		...t,
		onClick: () => e(u, t.label, () => t.onClick?.())
	})));
	if (F && !I || !U.value && !U.error) return /* @__PURE__ */ m(A, { children: /* @__PURE__ */ m(_, { viewMode: R.viewMode }) });
	let J = U.error ? /* @__PURE__ */ m(o, {
		error: U.error,
		retry: () => {
			H && V.reset() || U.retry();
		}
	}) : null;
	return /* @__PURE__ */ h(A, { children: [U.value ? J : null, /* @__PURE__ */ m(g, {
		page: V.controls(U.value?.page, U.loading, H, U.value?.position),
		itemLabel: y.resourceKind ? u.resources.getKind(y.resourceKind)?.label : void 0,
		viewsSource: I,
		rows: W,
		contentPlaceholder: U.value ? void 0 : J,
		storageKey: O,
		attributes: w,
		defaultSettings: y.defaultSettings,
		defaultFilter: y.defaultFilter,
		defaultSorts: y.defaultSorts,
		defaultViews: y.defaultViews,
		defaultActiveViewId: y.defaultActiveViewId,
		emptyTitle: y.emptyTitle,
		emptyDescription: y.emptyDescription,
		getBoardColumnConfig: y.getBoardColumnConfig,
		hideToolbar: y.hideToolbar,
		onRowClick: y.onRowActivate || W.some((e) => e.target) ? K : void 0,
		onActionError: (e, t) => n(u, t, e),
		onAttributeChange: y.onAttributeChange ? (e, t, n) => G((r) => ({
			...r,
			rows: v(r.rows, {
				rowId: e,
				attributes: { [t]: n }
			})
		}), () => y.onAttributeChange(e, t, n)) : void 0,
		onMove: y.onMove || y.onAttributeChange ? (e) => {
			let t = E(y, e);
			return G((e) => ({
				...e,
				rows: v(e.rows, t.move)
			}), t.save);
		} : void 0,
		onReorder: y.onReorder ? (e, t) => G((n) => ({
			...n,
			rows: v(n.rows, {
				rowId: e,
				attributes: {},
				order: { beforeRowId: t }
			})
		}), () => y.onReorder(e, t)) : void 0,
		createRow: y.createRow,
		onCreateRow: y.onCreateRow,
		onColumnAction: y.onColumnAction ? (...t) => e(u, "Column action", () => y.onColumnAction(...t)) : void 0,
		getRowContextMenuActions: q,
		toolbarActions: /* @__PURE__ */ m(c, {
			workbench: u,
			actions: y.toolbarActions,
			context: { resource: f.resource },
			renderParamField: l.renderParamField
		})
	})] });
};
export { x as i, T as n, C as r, F as t };
