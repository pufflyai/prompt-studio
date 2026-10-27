// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/pstdio-api-contracts/src/workspace-collection.ts
var e = "dashboard-workbench.workspaces", t = [
	{
		id: "name",
		label: "Name",
		type: "string"
	},
	{
		id: "type",
		label: "Type",
		type: "string",
		groupable: !0
	},
	{
		id: "location",
		label: "Location",
		type: "string"
	},
	{
		id: "created",
		label: "Created at",
		type: "date"
	},
	{
		id: "diff",
		label: "Diff",
		type: "number",
		filterable: !1
	},
	{
		id: "attempt",
		label: "Attempt",
		type: "string"
	},
	{
		id: "provider",
		label: "Provider",
		type: "string"
	},
	{
		id: "state",
		label: "State",
		type: "string",
		groupable: !0
	},
	{
		id: "error",
		label: "Provider error",
		type: "string"
	},
	{
		id: "branch",
		label: "Branch",
		type: "string"
	},
	{
		id: "updated",
		label: "Updated at",
		type: "date"
	}
], n = {
	showStats: !1,
	hiddenColumns: [
		"attempt",
		"provider",
		"state",
		"error",
		"branch",
		"updated"
	]
}, r = {
	projectHeader: "dashboard-workbench.project-header",
	start: "dashboard-workbench.start",
	workspaces: e,
	workspaceSummary: "dashboard-workbench.workspace.summary",
	workspaceFiles: "dashboard-workbench.workspace.files",
	workspaceDiffs: "dashboard-workbench.workspace.diffs",
	workspaceFileTree: "dashboard-workbench.workspace.file-tree",
	deleteWorkspaceEntry: "dashboard-workbench.delete-workspace-entry",
	createWorkspace: "dashboard-workbench.create-workspace",
	renameWorkspace: "dashboard-workbench.rename-workspace",
	dashboardSidenav: "dashboard-workbench.sidenav",
	extensionPanelRenderer: "dashboard-workbench.extension-panel-renderer",
	activityRail: "dashboard-workbench.activity-rail",
	settings: "dashboard-workbench.settings",
	session: "dashboard-workbench.session",
	notificationsModal: "dashboard-workbench.notifications-modal",
	shortcutHelp: "dashboard-workbench.shortcut-help",
	projectPicker: "dashboard-workbench.project-picker",
	createProject: "dashboard-workbench.create-project",
	projectFolder: "dashboard-workbench.project-folder",
	sessionBubble: "dashboard-workbench.session-bubble",
	performance: "dashboard-workbench.performance"
};
export { n as i, e as n, t as r, r as t };
