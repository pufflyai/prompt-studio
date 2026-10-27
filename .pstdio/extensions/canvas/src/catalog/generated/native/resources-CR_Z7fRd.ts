// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./resource-icons-CZFS6OM4.ts";
// packages/pstdio-dashboard/src/shared/app/resources.ts
var t = "dashboard-project", n = (e, n, r, i, a = t, o = {}) => ({
	type: e,
	id: n,
	label: r,
	icon: i,
	metadata: {
		...o,
		favoriteScope: {
			scope: "project",
			projectId: a
		}
	}
}), r = (e, t, r, i = {}) => ({
	...n("session", e, t, "MessageCircle", r, i),
	extensionId: "pstdio",
	projectId: r
}), i = {
	start: {
		id: "start",
		label: "Start",
		icon: "House"
	},
	workspaces: {
		id: "workspaces",
		label: "Workspaces",
		icon: e.workspace
	},
	sessions: {
		id: "sessions",
		label: "Sessions",
		icon: "messages-circle"
	}
};
export { r as n, i as r, n as t };
