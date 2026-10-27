// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, f as t, g as n, h as r, n as i, o as a, p as o, v as s } from "./schemas-D84h_Ad-.ts";
// packages/pstdio-api-contracts/src/extension-kernel/types/collection-view.ts
var c = [
	"is-any-of",
	"is-none-of",
	"is-empty",
	"is-not-empty"
], l = {
	boolean: [
		"is",
		"is-not",
		"is-empty",
		"is-not-empty"
	],
	string: [
		"contains",
		"does-not-contain",
		"is",
		"is-not",
		"is-empty",
		"is-not-empty"
	],
	number: [
		"is",
		"is-not",
		"gt",
		"gte",
		"lt",
		"lte",
		"is-empty",
		"is-not-empty"
	],
	date: [
		"is",
		"is-before",
		"is-after",
		"is-on-or-before",
		"is-on-or-after",
		"is-empty",
		"is-not-empty"
	],
	enum: c,
	status: c,
	user: c,
	"enum-multi": [
		"has-any-of",
		"has-all-of",
		"has-none-of",
		"is-empty",
		"is-not-empty"
	]
}, u = {
	conjunction: "and",
	rules: []
}, d = [...new Set(Object.values(l).flat())], f = i(d), p = o({
	attributeId: n().min(1),
	condition: f,
	value: s([
		a(),
		n(),
		t(),
		e(n())
	]).optional()
}), m = r({
	conjunction: i(["and", "or"]),
	rules: e(p)
});
m.extend({ groups: e(m).optional() }).refine((e) => !e.groups?.length || e.conjunction === "and", { message: "Normal rules and advanced groups combine using AND" });
var h = o({
	attributeId: n().min(1),
	direction: i(["asc", "desc"])
});
e(h).max(1, "A view allows only one sort");
// packages/pstdio-api-contracts/src/extension-kernel/types/data-table-renderer.ts
var g = {
	grouping: "none",
	rowNumbers: !0,
	wrapRows: !1,
	showStats: !0,
	hiddenColumns: [],
	columnOrder: []
}, _ = {
	viewMode: "board",
	columnGrouping: "none",
	rowGrouping: "none",
	displayProperties: []
}, v = (e, t) => {
	let n = {
		...e,
		...t.defaultSettings
	};
	return t.defaultViews?.length ? {
		settings: n,
		views: t.defaultViews.map((e) => ({
			...e,
			settings: {
				...n,
				...e.settings
			},
			filter: e.filter ?? u,
			sorts: e.sorts ?? [],
			builtIn: !0
		}))
	} : {
		settings: n,
		views: [{
			id: "default",
			title: "All",
			settings: n,
			filter: t.defaultFilter ?? u,
			sorts: t.defaultSorts ?? [],
			builtIn: !0
		}]
	};
}, y = (e) => v(_, e), b = (e) => v(g, e);
export { y as n, b as t };
