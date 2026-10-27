// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createContext as e, useContext as t, useState as n } from "react";
import { jsx as r } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/timeline-presentation.tsx
var i = {
	collapsedTracks: [],
	collapsedMilestones: []
}, a = (e, t) => {
	let n = e?.getItem(t), r = n ? JSON.parse(n) : {};
	return {
		...i,
		...r
	};
}, o = e({
	value: i,
	update: (e) => {},
	toggle: (e, t) => {}
});
function s(e) {
	let { projectId: t, storage: i, children: s } = e, c = `pstdio.pstdio-planner.timeline-presentation:${t}`, [l, u] = n(() => a(i, c)), d = (e) => {
		let t = {
			...l,
			...e
		};
		u(t), i?.setItem(c, JSON.stringify(t));
	};
	return /* @__PURE__ */ r(o, {
		value: {
			value: l,
			update: d,
			toggle: (e, t) => {
				let n = l[e];
				d({ [e]: n.includes(t) ? n.filter((e) => e !== t) : [...n, t] });
			}
		},
		children: s
	});
}
var c = () => t(o);
export { c as n, s as t };
