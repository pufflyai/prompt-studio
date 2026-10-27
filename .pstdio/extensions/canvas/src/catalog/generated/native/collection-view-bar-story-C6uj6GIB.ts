// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./collection-view-types-69xG6kJd.ts";
import { n as t, r as n, t as r } from "./collection-view-bar-DZiXTxjX.ts";
import { r as i, t as a } from "./collection-view-story-fixtures-CeuFUuz2.ts";
import { t as o } from "./display-menu-C8io3MZj.ts";
import { t as s } from "./display-sort-control-DHtzd27a.ts";
import { useEffect as c, useState as l } from "react";
import { Box as u } from "@chakra-ui/react";
import { jsx as d } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-view-bar-story.tsx
var f = {
	displayProperties: [],
	viewMode: "board",
	columnGrouping: "none",
	rowGrouping: "none"
}, p = (p) => {
	let { storageKey: m, filter: h = e, sorts: g = [], editedSorts: _ } = p, [v, y] = l([{
		id: "all",
		title: "All tickets",
		settings: f,
		filter: h,
		sorts: g,
		builtIn: !1
	}, {
		id: "mine",
		title: "My work",
		settings: f,
		filter: e,
		sorts: [],
		builtIn: !1
	}]), [b, x] = l(""), S = { settings: f }, C = {
		views: v,
		defaultViewId: "all",
		onCreateView: async (e) => {
			let t = {
				...e,
				id: crypto.randomUUID(),
				builtIn: !1
			};
			return y((e) => [...e, t]), t;
		},
		onUpdateView: async (e, t) => y((n) => n.map((n) => n.id === e ? {
			...n,
			...t,
			sorts: t.sorts?.map((e) => ({
				direction: e.direction,
				attributeId: e.attributeId
			})) ?? n.sorts
		} : n)),
		onDeleteView: async (e) => y((t) => t.filter((t) => t.id !== e)),
		onSetDefaultView: async () => void 0
	}, w = t({
		storageKey: m,
		initialState: S,
		viewsSource: C
	}), T = n(m, S, (e) => e.reset), E = n(m, S, (e) => e.activateView), D = n(m, S, (e) => e.sorts), O = n(m, S, (e) => e.setSorts);
	return l(() => {
		T(), v[0] && E(v[0]);
	}), c(() => {
		_ && O(_);
	}, [_, O]), /* @__PURE__ */ d(u, {
		bg: "bg",
		children: /* @__PURE__ */ d(r, {
			itemLabel: "Ticket",
			storageKey: m,
			initialState: S,
			views: w.views,
			viewsSource: C,
			fields: a,
			optionsFor: i,
			search: b,
			onSearchChange: x,
			searchResultLabel: b ? "4 of 10" : void 0,
			displayControl: /* @__PURE__ */ d(o, {
				settings: f,
				groupingOptions: [],
				displayPropertyOptions: [],
				onViewModeChange: () => void 0,
				onColumnGroupingChange: () => void 0,
				onRowGroupingChange: () => void 0,
				onDisplayPropertyToggle: () => void 0,
				sortControl: /* @__PURE__ */ d(s, {
					fields: a,
					sorts: D,
					onSortsChange: O
				})
			})
		})
	});
};
export { p as t };
