// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./ticket-page-target-B06ixsvs.ts";
// extensions/pstdio-planner/src/data/review-request-summary.ts
var t = "message-circle-warning", n = "reviewRequestItems", r = (e) => {
	let t = e.requests.length + e.errors.length;
	if (t === 0) return null;
	let n = e.requests.filter((e) => e.state === "open").length + e.errors.length, r = n || t, i = r === 1 ? "item" : "items", a = `${r} ${i} ${r === 1 ? "needs" : "need"} attention`;
	return {
		count: r,
		color: n > 0 ? "orange" : "green",
		tooltip: n > 0 ? a : `${r} ${i} resolved`
	};
}, i = (n, i) => {
	let a = r(n);
	return a ? [{
		id: "review-requests",
		label: String(a.count),
		icon: t,
		color: a.color,
		tooltip: a.tooltip,
		target: e(i)
	}] : [];
};
export { r as i, n, i as r, t };
