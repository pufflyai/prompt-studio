// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { D as e, E as t } from "./workbench-core-kaLFKJEn.ts";
// packages/pstdio-workbench/src/core/controllers/page-location/navigation-level-composition.ts
var n = (e) => e.filter((e) => e.nodes.length > 0).map((e) => ({
	...e,
	nodes: e.nodes.map((e) => ({
		...e,
		pinnedOnly: !0
	}))
})), r = (e) => {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = t.get(n.id);
		t.set(n.id, e ? {
			...e,
			nodes: [...e.nodes, ...n.nodes]
		} : n);
	}
	return [...t.values()];
}, i = (i) => {
	let a = () => {
		let e = i.modes.getActiveModeId();
		if (!e) return [];
		let n = i.pages.store.getState(), r = t({
			location: n.location,
			pages: Object.values(n.pages),
			navigationTrees: i.navigationTrees
		});
		return [{
			owner: i.navigationTrees.resolveOwner("mode", e) ?? {
				kind: "mode",
				id: e,
				extensionId: "pstdio"
			},
			resource: i.getPrimaryResource(),
			projectId: n.projectId
		}, ...r.map(({ owner: e, location: t }) => ({
			owner: e,
			resource: t.resource,
			projectId: n.projectId
		}))];
	}, o = (e) => e === "content" ? a().reverse() : a(), s = (e, t, r) => e === "content" && t > 0 ? n(r) : r, c = (e, t) => t.map(({ owner: t, resource: n, projectId: r }, a) => s(e, a, i.navigationTrees.getStructure(t, e, {
		resource: n,
		projectId: r
	})));
	return {
		getReadKey: () => JSON.stringify(a().map(({ owner: e, resource: t }) => i.navigationTrees.getReadKey(e, { resource: t }))),
		getStructure: (e) => r(c(e, o(e)).flat()),
		async getSections(t, n, a) {
			let l = o(t), u = c(t, l);
			return await e(l.map(({ owner: e, resource: n, projectId: o }, c) => async (l) => {
				let d = (e) => {
					l.throwIfAborted(), u[c] = s(t, c, e), a?.(r(u.flat()));
				};
				d(await i.navigationTrees.getSections(e, t, {
					resource: n,
					projectId: o,
					signal: l,
					onProgress: d
				}));
			}), n), n?.throwIfAborted(), r(u.flat());
		},
		getDefaultExpandedSectionIds: () => {
			let e = a();
			return e.flatMap(({ owner: t }, n) => (n === e.length - 1 ? [
				"header",
				"content",
				"footer"
			] : ["header", "footer"]).flatMap((e) => i.navigationTrees.getDefaultExpandedSectionIds(t, e)));
		}
	};
};
export { i as t };
