// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./timeline-display-menu-BwCkJQKU.ts";
import { useEffect as n } from "react";
import { jsx as r } from "react/jsx-runtime";
import { buildFilterCategories as i, getAttributeStringValues as a } from "@pstdio/ui/kanban-renderer";
import { CollectionViewBar as o, useCollectionViewStore as s, useCollectionViews as c } from "@pstdio/ui/collection-view";
// extensions/pstdio-planner/src/timeline/view/plan-header.tsx
function l(l) {
	let { data: u, viewsSource: d, search: f, onSearchChange: p, resultLabel: m, actions: h } = l, { settings: g, setSettings: _ } = s(u.storageKey, e, (e) => e);
	n(() => {
		let e = new Set(u.attributes.filter((e) => e.displayable).map(({ id: e }) => e)), t = g.displayProperties.filter((t) => e.has(t));
		t.length !== g.displayProperties.length && _({ displayProperties: t });
	}, [
		u.attributes,
		g.displayProperties,
		_
	]);
	let { views: v } = c({
		storageKey: u.storageKey,
		fields: u.attributes,
		initialState: e,
		viewsSource: d
	}), y = i(u.attributes, u.rows);
	return /* @__PURE__ */ r(o, {
		itemLabel: "Ticket",
		storageKey: u.storageKey,
		initialState: e,
		views: v,
		viewsSource: d,
		fields: u.attributes,
		optionsFor: (e) => {
			let t = /* @__PURE__ */ new Map();
			for (let n of u.rows) for (let r of new Set(a(n, e))) t.set(r, (t.get(r) ?? 0) + 1);
			return (y.find(({ id: t }) => t === e.id)?.options ?? []).map((e) => ({
				...e,
				count: t.get(e.value) ?? 0
			}));
		},
		search: f,
		onSearchChange: p,
		searchResultLabel: m,
		displayControl: /* @__PURE__ */ r(t, {
			storageKey: u.storageKey,
			attributes: u.attributes
		}),
		actions: h
	});
}
export { l as t };
