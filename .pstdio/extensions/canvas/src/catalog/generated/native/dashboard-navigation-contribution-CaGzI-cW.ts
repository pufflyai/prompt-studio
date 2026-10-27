// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/pstdio-dashboard/src/shared/workbench/dashboard-navigation-contribution.ts
var e = {
	header: ["dashboard.sidenav.search"],
	content: [
		"dashboard.notifications.sidenav-nav",
		"dashboard.start.project-nav",
		"dashboard.sessions.project-nav",
		"dashboard.workspaces.project-nav",
		"dashboard.sessions.list"
	],
	footer: ["dashboard.help.footer", "dashboard.settings.footer"]
}, t = {
	header: {
		id: "navigation.header",
		menuLabel: "Header"
	},
	root: {
		id: "navigation.root",
		menuLabel: "Navigation"
	},
	footer: {
		id: "navigation.footer",
		menuLabel: "Footer"
	}
}, n = (t, n) => {
	let r = n.slot ?? "content", i = e[r].indexOf(n.id), a = n.resolveResource;
	return n.modes.map((o) => t.navigationTrees.registerContribution({
		id: `${n.id}.${o}`,
		owner: {
			kind: "mode",
			id: o,
			extensionId: "pstdio"
		},
		sourceExtensionId: "pstdio",
		declarationIndex: i < 0 ? e[r].length : i,
		slot: r,
		defaultExpandedSectionIds: n.defaultExpandedSectionIds,
		resolveResource: (e) => a?.({
			modeId: o,
			resource: e
		}),
		getStructure: n.getStructure,
		getSections: ({ resource: e }) => n.getSections(t, {
			modeId: o,
			resource: e
		})
	}));
};
export { n, t };
