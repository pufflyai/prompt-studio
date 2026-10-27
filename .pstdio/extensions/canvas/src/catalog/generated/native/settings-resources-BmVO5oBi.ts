// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/pstdio-workbench/src/react/settings/settings-resources.ts
var e = "workbench-settings", t = "workbench.settings.open", n = (t) => ({
	type: e,
	id: t.id,
	label: t.title,
	icon: t.icon,
	metadata: { panelId: t.id }
}), r = (t, n) => ({
	type: e,
	id: `${t}::${n.id}`,
	label: n.label,
	icon: n.icon,
	metadata: {
		panelId: t,
		itemId: n.id
	}
}), i = (e, t) => (e ?? "project") !== "project" || t;
export { n as i, i as n, r, t };
