// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t } from "./tracks-EnwyuZ-9.ts";
import { useState as n } from "react";
// extensions/pstdio-planner/src/timeline/model/review.ts
var r = (e) => e.filter(({ flags: e }) => e.includes("human-needed")).map(({ id: e }) => e);
function i(e, t, n) {
	let r = e.indexOf(t);
	return r < 0 ? e[0] : e[(r + n + e.length) % e.length];
}
// extensions/pstdio-planner/src/timeline/view/use-plan-actions.ts
function a({ host: i, client: a, plan: o, sections: s, tracks: c, toggle: l }) {
	let [u, d] = n(), [f, p] = n(), [m, h] = n(), g = t(a), _ = o?.sections.flatMap(({ rows: e }) => e).find(({ id: e }) => e === u), v = e(_, o), y = (e) => void i.call("navigation.open", { target: e }), [b, x] = n(), S = b ? r(s.find(({ section: e }) => (e.deadline?.id ?? null) === b.id)?.rows ?? []) : void 0;
	return {
		viewProps: {
			sections: s,
			tracks: c,
			relations: v,
			selectedId: u,
			dragId: g.dragId,
			dropTarget: g.dropTarget,
			onSelect: d,
			onDragStart: g.setDragId,
			onDragTarget: g.setDropTarget,
			onDrop: () => void g.drop(),
			onToggle: l,
			onRenameDeadline: (e, t) => a.commands["timeline.deadline.update"]({
				deadline: e,
				name: t || "none"
			}),
			onRedate: (e, t) => a.commands["timeline.deadline.update"]({
				deadline: e,
				date: t
			}),
			onRenameTrack: (e, t) => a.commands["timeline.track.rename"]({
				track: e,
				name: t
			}),
			onReview: (e) => {
				let t = r(s.find(({ section: t }) => (t.deadline?.id ?? null) === e)?.rows ?? []);
				x({ id: e }), d(t[0]);
			},
			onDelete: (e) => {
				a.commands["timeline.deadline.delete"]({ deadline: e }).catch(() => {});
			},
			onContext: h,
			onNewTrack: () => p({ kind: "track" }),
			onCreateDeadline: (e) => p({
				kind: "deadline",
				date: e
			})
		},
		selected: _,
		open: y,
		review: S,
		editor: f,
		context: m,
		setSelectedId: d,
		setContext: h,
		setEditor: p,
		done: (e) => {
			p(void 0), e && d(e);
		}
	};
}
export { i as n, a as t };
