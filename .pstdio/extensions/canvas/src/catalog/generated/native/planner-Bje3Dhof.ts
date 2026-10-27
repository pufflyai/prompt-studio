// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./ticket-page-target-B06ixsvs.ts";
import "./events-C3q9NYT-.ts";
// extensions/pstdio-planner/src/timeline/planner.ts
var t = "pstdio.pstdio-planner", n = (n) => e({
	type: "ticket",
	id: n.id,
	shorthand: n.shorthand,
	label: `${n.shorthand} ${n.title}`,
	extensionId: t
}), r = (e) => (Array.isArray(e) ? e : [e ?? ""]).map((e) => e.trim()).filter((e) => e.length > 0 && e !== "[]");
export { n, r as t };
