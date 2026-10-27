// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./api-D3Fkqs7r.ts";
// packages/pstdio-dashboard/src/shared/extensions/api.ts
var t = (t) => e().extensions.metadata(t), n = (t, n) => e().extensions.contributions(t, n), r = (t, n) => e().extensions.marketplaceContributions(t, n), i = (t, n, r, i) => e().extensions.execute(n, {
	...r,
	projectId: t
}, { signal: i }), a = async (e, t, n, r) => {
	let a = await i(e, t, { params: n }, r);
	if (!a.outcome.ok) throw Error(a.outcome.error?.message ?? a.outcome.reason ?? `Command failed: ${t}`);
	return a.outcome.value;
}, o = (t) => e().extensions.listProject(t), s = (t, n, r = !1) => e().extensions.install(t, {
	source: {
		kind: "catalog",
		name: n
	},
	force: r
}), c = (t, n) => {
	let r = new FormData();
	r.append("kind", "upload"), n.force && r.append("force", "true"), r.append("folderName", n.name), r.append("installName", n.name);
	for (let e of n.files) r.append("files", e, e.name);
	return e().extensions.install(t, { upload: r });
}, l = (t, n, r) => e().extensions.setEnabled(t, n, r), u = (t, n, r, i) => e().extensions.setAutomationEnabled(t, n, r, i), d = (t, n) => e().extensions.reload(t, n), f = (t, n) => e().extensions.upgradeProject(t, n), p = (t, n, r = !1) => e().extensions.uninstall(t, n, r), m = (t, n) => e().extensions.projectSettings.all(t, n), h = (t, n, r, i) => e().extensions.projectSettings.set(t, n, r, i), g = (t, n, r) => e().extensions.projectSettings.delete(t, n, r);
export { n as a, s as c, d, u as f, f as g, h, a as i, m as l, p as m, g as n, r as o, l as p, i as r, t as s, c as t, o as u };
