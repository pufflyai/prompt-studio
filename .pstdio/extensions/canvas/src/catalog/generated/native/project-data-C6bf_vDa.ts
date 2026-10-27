// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./resource-icons-CZFS6OM4.ts";
import { n as t } from "./collections-W65OWXaL.ts";
import { t as n } from "./resources-CR_Z7fRd.ts";
// packages/pstdio-dashboard/src/modules/projects/data/project-data.ts
var r = (e) => Array.from(t(e).state.values()), i = (e) => !e.deleted_at, a = (t, r) => {
	let i = t.name;
	return {
		id: t.id,
		name: i,
		createdAt: t.created_at ?? "",
		updatedAt: t.updated_at ?? "",
		folderPath: r.get(t.id) || null,
		resource: n("project", t.id, i, e.project, t.id)
	};
}, o = () => ({
	projects: r("projects"),
	workspaces: r("workspaces")
}), s = (e) => {
	let t = new Map(e.workspaces.filter((e) => e.is_default && !e.deleted_at).map((e) => [e.project_id, e.root_path ?? e.display_path ?? ""]));
	return e.projects.filter(i).map((e) => a(e, t)).sort((e, t) => new Date(t.createdAt).getTime() - new Date(e.createdAt).getTime());
}, c = () => s(o()), l = (e) => c().find((t) => t.id === e);
export { l as n, c as t };
