// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e } from "./workbench-extension-contributions-C_CIJIkp.ts";
import { i as t } from "./api-CEi0FXP5.ts";
// packages/pstdio-dashboard/src/modules/settings/data/template-provider-api.ts
var n = (t) => [...e(t)?.templateTypes ?? []].filter((e) => e.commands).sort((e, t) => (e.order ?? 0) - (t.order ?? 0) || e.id.localeCompare(t.id)), r = async (e) => {
	let r = n(e), i = /* @__PURE__ */ new Map();
	return (await Promise.all(r.map(async (n) => {
		let r = n.commands, a = i.get(r.list);
		return a || (a = t(e, r.list, {}), i.set(r.list, a)), (await a).filter((e) => e.type === n.localId).map((t) => ({
			id: `${n.id}:${t.name}`,
			projectId: e,
			name: t.name,
			title: t.title,
			templateType: n.id,
			localType: n.localId,
			groupLabel: n.label,
			groupOrder: n.order ?? 0,
			commands: r
		}));
	}))).flat();
}, i = (e) => t(e.projectId, e.commands.read, { name: e.name }), a = (e, n) => t(e.projectId, e.commands.save, {
	name: e.name,
	title: e.title,
	type: e.localType,
	content: n
}), o = (e) => t(e.projectId, e.commands.delete, { name: e.name });
export { n as a, a as i, i as n, r, o as t };
