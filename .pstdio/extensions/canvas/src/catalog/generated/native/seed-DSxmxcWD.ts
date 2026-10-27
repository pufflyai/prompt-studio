// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./sort-C5A4Nn9L.ts";
// extensions/pstdio-planner/src/data/ticket-dependencies.ts
var t = (e) => (e ? [e].flat() : []).map((e) => e.trim()).filter((e) => e.length > 0 && e !== "[]"), n = (e, t) => [e.shorthand, ...e.aliases ?? []].some((e) => e.toLowerCase() === t.toLowerCase()), r = (e) => {
	let t = /^Complete (.+) before implementing this dependent contract\.$/.exec(e?.trim() ?? "");
	if (!t) return;
	let n = t[1].split(/,\s*(?:and\s+)?|\s+and\s+/);
	return n.every((e) => /^[A-Z][A-Z0-9]*-\d+$/.test(e)) ? n : void 0;
}, i = (e) => new Map(e.flatMap((e) => [[e.id.toLowerCase(), e], [e.shorthand.toLowerCase(), e]])), a = (e, i) => {
	let a = r(e.blockedReason);
	if (!a) return;
	let o = [...new Set(t(e.dependsOn).flatMap((e) => i.get(e.toLowerCase()) ?? []))], s = a.map((e) => o.filter((t) => n(t, e)));
	if (!s.some((e) => e.length !== 1)) return s.map(([e]) => e.id);
}, o = (e) => {
	let t = i(e);
	return e.map((e) => a(e, t) ? {
		...e,
		blockedReason: null
	} : e);
}, s = Symbol.for("pstdio.pstdio-planner.ticket-write-queues"), c = globalThis;
c[s] ??= /* @__PURE__ */ new Map(), c[s];
// extensions/pstdio-planner/src/data/collections.ts
var l = "ticket-statuses", u = (e) => e.collection(l), d = async (e, t) => (await u(e).put(t.id, t), t), f = /* @__PURE__ */ new WeakMap(), p = "__pstdio-planner:default-statuses-seeded", m = [
	{
		id: "backlog",
		name: "Backlog",
		color: "gray",
		icon: "status-backlog",
		sortOrder: 0,
		isDefault: !0,
		canCreate: !0,
		columnActions: []
	},
	{
		id: "ready",
		name: "Todo",
		color: "purple",
		icon: "status-todo",
		sortOrder: 1,
		isDefault: !1,
		canCreate: !1,
		columnActions: []
	},
	{
		id: "in-progress",
		name: "In Progress",
		color: "blue",
		icon: "status-progress",
		sortOrder: 2,
		isDefault: !1,
		canCreate: !1,
		columnActions: []
	},
	{
		id: "blocked",
		name: "Blocked",
		color: "red",
		icon: "status-canceled",
		sortOrder: 3,
		isDefault: !1,
		canCreate: !1,
		columnActions: []
	},
	{
		id: "in-review",
		name: "In Review",
		color: "yellow",
		icon: "status-review",
		sortOrder: 4,
		isDefault: !1,
		canCreate: !1,
		columnActions: []
	},
	{
		id: "done",
		name: "Done",
		color: "green",
		icon: "status-done",
		sortOrder: 5,
		isDefault: !1,
		canCreate: !1,
		columnActions: ["archive_all"]
	}
], h = new Set(m.map((e) => e.id)), g = (e) => e.every((e) => h.has(e.id)), _ = async (t) => {
	let n = f.get(t);
	if (n) return n;
	let r = (async () => {
		let [n, r] = await Promise.all([u(t).list(), t.get(p)]);
		return r || n.length > 0 && !g(n) ? (r || await t.set(p, !0), n) : (await Promise.all(m.map((e) => d(t, e))), await t.set(p, !0), e(await u(t).list()));
	})();
	f.set(t, r);
	try {
		return await r;
	} finally {
		f.delete(t);
	}
}, v = (e, t, n, r, i = null) => ({
	id: e,
	name: t,
	color: n,
	sortOrder: r,
	icon: i,
	description: null
}), y = [
	() => ({
		id: "default-priority",
		name: "Priority",
		type: "single_select",
		sortOrder: 0,
		options: [
			v("default-priority-low", "Low", "gray", 0, "level-low"),
			v("default-priority-medium", "Medium", "blue", 1, "level-mid"),
			v("default-priority-high", "High", "orange", 2, "level-high"),
			v("default-priority-urgent", "Urgent", "red", 3, "flame")
		]
	}),
	() => ({
		id: "default-type",
		name: "Type",
		type: "single_select",
		sortOrder: 1,
		options: [
			v("default-type-bug", "Bug", "red", 0, "bug"),
			v("default-type-feature", "Feature", "green", 1, "sparkles"),
			v("default-type-chore", "Chore", "gray", 2, "wrench")
		]
	}),
	() => ({
		id: "default-complexity",
		name: "Complexity",
		type: "single_select",
		sortOrder: 2,
		options: [
			v("default-complexity-simple", "Simple", "green", 0, "level-low"),
			v("default-complexity-moderate", "Moderate", "yellow", 1, "level-high"),
			v("default-complexity-complex", "Complex", "red", 2, "level-xhigh")
		]
	})
];
new Set(y.map((e) => e().id));
export { o as i, y as n, _ as r, m as t };
