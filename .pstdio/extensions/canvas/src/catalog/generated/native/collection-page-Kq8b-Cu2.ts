// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t } from "./collection-view-grouping-B8HGb2BH.ts";
// packages/ui/src/components/collection-view/collection-page.ts
var n = (n, r, i, a) => {
	let o = (t, n) => e({
		id: "",
		title: "",
		attributes: { [n.id]: t }
	}, n), s = /* @__PURE__ */ new Map();
	for (let e of r) {
		if (e.field !== i.id) continue;
		if (a) {
			if (e.parent?.field !== a.field.id || o(e.parent.value, a.field) !== a.key) continue;
		} else if (e.parent) continue;
		let t = o(e.value, i);
		s.set(t, (s.get(t) ?? 0) + e.count);
	}
	let c = new Map(n.map((e) => [e.key, e.rows]));
	return t([], i, [.../* @__PURE__ */ new Set([...s.keys(), ...c.keys()])]).map((e) => ({
		...e,
		rows: c.get(e.key) ?? [],
		count: s.get(e.key) ?? 0
	}));
};
export { n as t };
