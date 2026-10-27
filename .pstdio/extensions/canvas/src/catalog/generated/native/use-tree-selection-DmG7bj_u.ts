// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./resource-registry-CVuZngrt.ts";
import { n as t } from "./workbench-core-kaLFKJEn.ts";
import { n, t as r } from "./tree-list-selection-Dfhqy5p1.ts";
import { useEffect as i, useRef as a } from "react";
// packages/pstdio-workbench/src/react/renderers/tree/tree-selection-ancestors.ts
var o = (e, t, n) => {
	let r = new Set(n), i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), o = (e, n, s) => {
		for (let c of e) {
			if (r.has(c.id)) {
				for (let e of n) i.add(e);
				a.add(s);
			}
			o([...c.children ?? [], ...t[c.id] ?? []], [...n, c.id], s);
		}
	};
	for (let t of e) o(t.nodes, [], t.id);
	if (a.size) return {
		nodes: [...i],
		sections: [...a]
	};
}, s = (s, c, l) => {
	let { sections: u, childrenByNodeId: d } = l, f = r(l), p = typeof f == "string" ? [f] : f ?? [], m = JSON.stringify([
		c,
		l.activeNodeId,
		l.activeResource ? e(l.activeResource) : l.activeLocation,
		l.activeResource || l.activeLocation ? void 0 : p
	]), h = JSON.stringify(p), g = n(l), _ = a({
		context: m,
		intent: void 0,
		selections: /* @__PURE__ */ new Set()
	});
	return i(() => {
		if (_.current.context !== m && (_.current = {
			context: m,
			intent: void 0,
			selections: /* @__PURE__ */ new Set()
		}), g && _.current.intent !== g && (_.current = {
			context: m,
			intent: g,
			selections: /* @__PURE__ */ new Set()
		}), !p.length || _.current.selections.has(h)) return;
		let e = o(u, d, p);
		if (!e) return;
		_.current.selections.add(h);
		let n = t(s);
		for (let t of e.nodes) n.setNodeExpanded(c, t, !0);
		for (let t of e.sections) n.setSectionExpanded(c, t, !0);
	}, [
		s,
		c,
		m,
		h,
		g,
		p,
		u,
		d
	]), f;
};
export { s as t };
