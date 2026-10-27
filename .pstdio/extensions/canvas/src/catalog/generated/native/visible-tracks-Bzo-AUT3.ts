// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./mappers-07bJ6k9J.ts";
import { i as t, n, r, t as i } from "./tracks-EnwyuZ-9.ts";
import { filterRowsByView as a } from "@pstdio/ui/collection-view";
// extensions/pstdio-planner/src/timeline/view/visible-tracks.ts
var o = (e, t) => {
	let n = t.find(({ id: t }) => t === e.attributeId);
	return !n || n.filterable === !1 ? !1 : e.condition === "is-empty" || e.condition === "is-not-empty" || e.value !== void 0 && e.value !== "" && !(Array.isArray(e.value) && e.value.length === 0);
}, s = (e, t, n) => e.rules.some((e) => e.attributeId === t && o(e, n)) || (e.groups ?? []).some((e) => s(e, t, n)), c = (e, t, n, r) => {
	if (!o(e, r)) return null;
	if (e.attributeId === t) return a([{
		id: "track",
		title: "",
		attributes: { [t]: n }
	}], {
		conjunction: "and",
		rules: [e]
	}, r).length > 0;
}, l = (e, t, n, r) => {
	let i = [...e.rules.map((e) => c(e, t, n, r)), ...(e.groups ?? []).map((e) => l(e, t, n, r))].filter((e) => e !== null);
	if (i.length === 0) return null;
	let a = e.conjunction === "or";
	if (i.includes(a)) return a;
	if (i.every((e) => e === !a)) return !a;
};
function u(a, o, c) {
	let u = a?.trackProperty, d = i(u, a?.sections.flatMap(({ rows: e }) => e) ?? []);
	if (!u) return d;
	let f = e(u);
	return s(o, f, c) ? n([...r(u), t].filter((e) => {
		let n = e.id === t.id ? "" : e.id;
		return l(o, f, n, c) !== !1;
	})) : d;
}
export { u as t };
