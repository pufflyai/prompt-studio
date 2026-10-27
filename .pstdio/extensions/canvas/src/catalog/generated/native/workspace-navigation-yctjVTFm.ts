// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { u as e } from "./useQuery-OeRqqLZF.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { r as n, t as r } from "./workspace-providers-OzFU0iXu.ts";
import { t as i } from "./widget-ids-CvvbLhYP.ts";
import { l as a } from "./collections-W65OWXaL.ts";
import { n as o } from "./runtime-state-Di93_TAk.ts";
import { i as s, s as c } from "./project-context-BR7AjHlE.ts";
import { n as l, t as u } from "./dashboard-navigation-contribution-CaGzI-cW.ts";
import { t as d } from "./commands-Bp5w85f4.ts";
import { r as f } from "./resources-CR_Z7fRd.ts";
import "./api-file-url-CTxskOjG.ts";
import { workbenchPages as p } from "@pstdio/sdk/extensions";
// packages/pstdio-dashboard/src/lib/query-client.ts
var m = o(() => {
	let e = new t();
	return e.getQueryCache().subscribe((e) => {
		let t = e.query.state.data;
		e.type === "removed" && e.query.queryKey[0] === "api-file-url" && typeof t == "string" && URL.revokeObjectURL(t);
	}), e;
}, (e) => e.clear()), h = (e) => ({
	id: f.workspaces.id,
	label: "Workspaces",
	icon: f.workspaces.icon,
	canHide: !0,
	hiddenByDefault: !0,
	commandId: d.openWorkspaces,
	target: {
		kind: "page",
		page: p.workspaces
	},
	actions: e.length ? [{
		id: "new-workspace",
		label: "New workspace",
		icon: "Plus",
		commandId: d.createWorkspace
	}] : []
}), g = (t) => {
	let o = m(), d = () => n(s(t)), f = new e(o, d()), p = () => {
		t.views.getView(i.dashboardSidenav) && t.views.refreshView(i.dashboardSidenav);
	}, g = f.subscribe(p), _ = l(t, {
		id: "dashboard.workspaces.project-nav",
		modes: ["project"],
		getSections: () => {
			let e = f.getCurrentResult();
			return [{
				...u.root,
				nodes: [h(e.isError ? [] : e.data ?? [])]
			}];
		}
	}), v = c(t, () => {
		f.setOptions(d()), p();
	}), y = a((e) => {
		let n = s(t);
		(e?.table === "workspaces" && e.changes.some(({ value: e, previousValue: t }) => [e, t].some((e) => e?.project_id === n && e?.is_default === !0)) || e?.table === "extension_instances" || e?.table === "installed_extension_sources") && r(o, n);
	});
	return { dispose() {
		y(), v(), g();
		for (let e of _) e.dispose();
	} };
};
export { h as n, m as r, g as t };
