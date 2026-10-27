// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./seed-DSxmxcWD.ts";
import { t } from "./events-C3q9NYT-.ts";
import { n, r, t as i } from "./workflow-statuses-BkOMtUf-.ts";
import { t as a } from "./write-guard-Biqs4uSg.ts";
import { defineCommand as o, params as s } from "@pstdio/sdk/extensions";
import { ParamEditor as c } from "@pstdio/ui/param-editor";
// extensions/pstdio-planner/src/commands/workflow-statuses.ts
var l = (e, i) => a(e, "workflow-config", async () => {
	let a = n(i), o = await r(e), s = new Set(o.statuses.map(({ id: e }) => e));
	if ([
		...a.completedStatusIds,
		...a.blockedStatusIds,
		...a.activeStatusIds
	].some((e) => !s.has(e))) throw Error("Remove or replace missing status choices before saving.");
	return await e.settings.set("workflow.statuses", a), await e.events.emit(t, {}), r(e);
});
o({
	id: "workflow-statuses.read",
	title: "Read workflow status selections",
	cli: !0,
	async run(e) {
		return r(e);
	}
}), o({
	id: "workflow-statuses.save",
	title: "Save workflow status selections",
	cli: !0,
	mutating: !0,
	params: { selections: s.json() },
	async run(e, { selections: t }) {
		return l(e, t);
	}
});
// extensions/pstdio-planner/src/views/workflow-settings.ts
var u = (e) => {
	let { selections: t, statuses: n, missingStatusIds: r } = e, i = [...n.map(({ id: e, name: t, icon: n, color: r }) => ({
		id: e,
		name: t,
		icon: n ?? "circle",
		color: r ?? void 0
	})), ...r.map((e) => ({
		id: e,
		name: `Missing status: ${e}`
	}))], a = [
		{
			id: "completedStatusIds",
			name: "Completed statuses",
			description: "Use these statuses for dependency completion and Timeline completion."
		},
		{
			id: "blockedStatusIds",
			name: "Blocked statuses",
			description: "Use these statuses for blocked notifications and Timeline flags."
		},
		{
			id: "activeStatusIds",
			name: "Active statuses",
			description: "Use these statuses for Timeline progress. Running sessions determine execution capacity."
		}
	].map((e) => ({
		...e,
		type: "selection",
		defaultValue: t[e.id],
		options: i,
		multiSelect: !0,
		searchable: !0
	}));
	return a.push({
		id: "mergeTargetStatusId",
		name: "Status after merge",
		description: "Optional destination when Mark done on merge is enabled. Choose a completed status.",
		type: "selection",
		defaultValue: t.mergeTargetStatusId ?? "",
		options: i,
		clearable: !0,
		searchable: !0
	}), {
		groups: [{
			id: "workflow",
			title: "Planner workflow",
			description: "Choose the statuses each feature uses. Renaming a status preserves its selection.",
			params: a
		}],
		values: {
			...t,
			mergeTargetStatusId: t.mergeTargetStatusId ?? ""
		}
	};
}, d = u({
	selections: {
		...i(),
		completedStatusIds: ["shipped"],
		blockedStatusIds: ["waiting"],
		activeStatusIds: ["building"],
		mergeTargetStatusId: "shipped"
	},
	statuses: [
		{
			...e[5],
			id: "shipped",
			name: "Delivered",
			sortOrder: 2,
			icon: "status-done",
			color: "green"
		},
		{
			...e[3],
			id: "waiting",
			name: "Needs a decision",
			sortOrder: 1,
			icon: "status-canceled",
			color: "orange"
		},
		{
			...e[2],
			id: "building",
			name: "Building",
			sortOrder: 0,
			icon: "status-progress",
			color: "blue"
		}
	],
	missingStatusIds: []
}), f = {
	title: "Extensions/Planner/Workflow settings",
	component: c,
	args: {
		variant: "small",
		groups: d.groups,
		defaultValues: d.values
	}
}, p = {}, m = { args: {
	groups: u({
		selections: i(),
		statuses: [],
		missingStatusIds: []
	}).groups,
	defaultValues: {}
} };
export { p as CurrentStatuses, m as EmptyChoices, f as default };
