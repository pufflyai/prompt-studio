// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./collection-view-builtins-CQzYQ2MW.ts";
import { i as t, n } from "./widget-ids-CvvbLhYP.ts";
import { c as r, o as i } from "./collections-W65OWXaL.ts";
// packages/pstdio-dashboard/src/modules/workspaces/collections/workspace-views-story.ts
var a = (a) => {
	let { views: o } = e({ defaultSettings: t }), s = "2026-06-24T09:00:00Z";
	i("board_views")?.truncateAndWrite(o.map((e, t) => ({
		id: `workspace-view-${t}`,
		project_id: a,
		extension_instance_id: null,
		board_id: n,
		title: e.title,
		settings: e.settings,
		filter: e.filter,
		sorts: e.sorts,
		sort_order: t,
		created_at: s,
		updated_at: s
	}))), i("board_default_views")?.truncateAndWrite([]), r();
};
export { a as t };
