// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./use-workbench-store-BMaFgEbb.ts";
import { t as n } from "./icon-D3uE7jD-.ts";
import { t as r } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useEffect as i, useState as a } from "react";
import { Box as o, Stack as s } from "@chakra-ui/react";
import { TagSettingsPanel as c } from "@pstdio/ui";
import { jsx as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/statuses/workflow-status-settings-model.ts
var u = (e) => ({
	id: e.id,
	name: e.label,
	color: e.color,
	icon: e.icon,
	sortOrder: e.sortOrder,
	isDefault: e.isDefault,
	actions: [...e.actions ?? []]
}), d = (e, t) => [...e ?? []].sort().join("|") === [...t ?? []].sort().join("|"), f = (e, t) => e.label !== t.name || e.color !== t.color || e.icon !== t.icon || e.isDefault !== t.isDefault || !d(e.actions, t.actions), p = (e) => ({
	id: e.id,
	label: e.name,
	color: e.color,
	icon: e.icon,
	sortOrder: e.sortOrder,
	isDefault: e.isDefault,
	actions: [...e.actions ?? []]
}), m = (e) => {
	let { statusSet: t, workbench: r } = e, [o, s] = a(() => {
		let e = r.statuses.getStatuses(t.id);
		return e ? [...e] : void 0;
	}), [d, m] = a();
	return i(() => {
		let e = !0, n = r.statuses.getStatuses(t.id);
		return s(n ? [...n] : void 0), m(void 0), r.statuses.load(t.id).then((t) => {
			e && s([...t]);
		}, (t) => {
			e && m(t);
		}), () => {
			e = !1;
		};
	}, [t.id, r]), /* @__PURE__ */ l(c, {
		values: o,
		loadError: d,
		onSave: async (e) => {
			let n = e.drafts.map(p);
			s([...await r.statuses.save(t.id, n)]);
		},
		toEditorValue: u,
		valueNeedsUpdate: f,
		readOnly: !t.save,
		title: t.title,
		description: t.save ? void 0 : "This status set is read-only.",
		actionOptions: t.actions?.map((e) => ({
			value: e.id,
			label: e.label,
			icon: e.icon ? /* @__PURE__ */ l(n, {
				name: e.icon,
				size: 13
			}) : void 0
		})),
		actionsLabel: "Commands",
		framed: !0,
		showColumnHeaders: !0,
		valueColumnLabel: "State",
		showDefault: !0,
		errorTitle: `Unable to update ${t.title}`,
		addLabel: "Add state",
		addName: "New status",
		resetLabel: "Reset",
		saveLabel: "Save",
		deleteHeadline: "Delete status?",
		deleteNotificationText: (e) => `This will delete the "${e.name}" status.`,
		deleteButtonText: "Delete status"
	});
}, h = (e) => {
	let { workbench: n } = e;
	t(n.statuses.store, (e) => e.statusSets);
	let r = n.statuses.listStatusSets();
	return /* @__PURE__ */ l(s, {
		gap: "none",
		minH: "full",
		bg: "bg",
		children: r.map((e) => /* @__PURE__ */ l(s, {
			"data-testid": `workflow-status-set-${e.id}`,
			gap: "none",
			children: /* @__PURE__ */ l(m, {
				workbench: n,
				statusSet: e
			})
		}, e.id))
	});
}, g = [{
	id: "backlog",
	label: "Backlog",
	color: "gray",
	sortOrder: 100,
	isDefault: !0
}, {
	id: "done",
	label: "Done",
	color: "green",
	sortOrder: 200
}], _ = g.map((e) => e.id === "done" ? {
	...e,
	actions: ["archive_all"]
} : e), v = e();
v.statuses.registerStatusSet({
	id: "planner.ticket",
	title: "Ticket statuses",
	actions: [{
		id: "archive_all",
		label: "Archive all",
		icon: "archive"
	}],
	query: async () => _,
	save: async (e) => e
}), v.statuses.registerStatusSet({
	id: "deploy.release",
	title: "Release statuses",
	query: async () => [{
		id: "ready",
		label: "Ready",
		color: "blue",
		sortOrder: 100
	}]
});
var y = e();
y.statuses.registerStatusSet({
	id: "slow",
	title: "Loading provider",
	query: () => new Promise(() => {})
});
var b = e();
b.statuses.registerStatusSet({
	id: "cached",
	title: "Already loaded provider",
	query: async () => g,
	save: async (e) => e
});
var x = e();
x.statuses.registerStatusSet({
	id: "failing",
	title: "Save failure",
	query: async () => g,
	save: async () => {
		throw Error("The provider rejected this status order.");
	}
});
var S = e();
S.statuses.registerStatusSet({
	id: "broken",
	title: "Unavailable provider",
	query: async () => {
		throw Error("This provider is unavailable.");
	}
});
var C = (e) => `import { Box } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import {
  WorkbenchThemeProvider,
  WorkflowStatusSettings,
} from "@pstdio/workbench/react";

const workbench = createWorkbench();
${e}

export const App = () => (
  <WorkbenchThemeProvider>
    <Box minH="100dvh" bg="bg">
      <WorkflowStatusSettings workbench={workbench} />
    </Box>
  </WorkbenchThemeProvider>
);`, w = (e) => ({ docs: { source: {
	code: C(e),
	language: "tsx",
	type: "code"
} } });
S.statuses.registerStatusSet({
	id: "healthy",
	title: "Healthy provider",
	query: async () => g,
	save: async (e) => e
});
var T = {
	title: "pstdio-workbench/Reference/Core API/Workflow status editor",
	tags: ["autodocs"],
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "A workflow status set owns its query, optional save operation, and optional actions. Providers load and fail independently so one extension cannot break another provider's settings." } }
	}
}, E = (e) => {
	let { workbench: t } = e;
	return /* @__PURE__ */ l(r, { children: /* @__PURE__ */ l(o, {
		minH: "100dvh",
		bg: "bg",
		children: /* @__PURE__ */ l(h, { workbench: t })
	}) });
}, D = {
	parameters: w("workbench.statuses.registerStatusSet({\n  id: \"planner.ticket\",\n  title: \"Ticket statuses\",\n  actions: [{ id: \"archive_all\", label: \"Archive all\", icon: \"archive\" }],\n  query: async () => [\n    { id: \"backlog\", label: \"Backlog\", color: \"gray\", sortOrder: 100, isDefault: true },\n    { id: \"done\", label: \"Done\", color: \"green\", sortOrder: 200, actions: [\"archive_all\"] },\n  ],\n  save: async (statuses) => statuses,\n});\nworkbench.statuses.registerStatusSet({\n  id: \"deploy.release\",\n  title: \"Release statuses\",\n  query: async () => [\n    { id: \"ready\", label: \"Ready\", color: \"blue\", sortOrder: 100 },\n  ],\n});"),
	render: () => /* @__PURE__ */ l(E, { workbench: v })
}, O = {
	parameters: w("workbench.statuses.registerStatusSet({\n  id: \"slow\",\n  title: \"Loading provider\",\n  query: () => new Promise(() => {}),\n});"),
	render: () => /* @__PURE__ */ l(E, { workbench: y })
}, k = {
	parameters: w("workbench.statuses.registerStatusSet({\n  id: \"cached\",\n  title: \"Already loaded provider\",\n  query: async () => [\n    { id: \"backlog\", label: \"Backlog\", color: \"gray\", sortOrder: 100, isDefault: true },\n    { id: \"done\", label: \"Done\", color: \"green\", sortOrder: 200 },\n  ],\n  save: async (statuses) => statuses,\n});\nawait workbench.statuses.load(\"cached\");"),
	loaders: [async () => await b.statuses.load("cached")],
	render: () => /* @__PURE__ */ l(E, { workbench: b })
}, A = {
	parameters: w("workbench.statuses.registerStatusSet({\n  id: \"failing\",\n  title: \"Save failure\",\n  query: async () => [\n    { id: \"backlog\", label: \"Backlog\", color: \"gray\", sortOrder: 100, isDefault: true },\n    { id: \"done\", label: \"Done\", color: \"green\", sortOrder: 200 },\n  ],\n  save: async () => {\n    throw new Error(\"The provider rejected this status order.\");\n  },\n});"),
	render: () => /* @__PURE__ */ l(E, { workbench: x })
}, j = {
	parameters: w("workbench.statuses.registerStatusSet({\n  id: \"broken\",\n  title: \"Unavailable provider\",\n  query: async () => {\n    throw new Error(\"This provider is unavailable.\");\n  },\n});\nworkbench.statuses.registerStatusSet({\n  id: \"healthy\",\n  title: \"Healthy provider\",\n  query: async () => [\n    { id: \"backlog\", label: \"Backlog\", color: \"gray\", sortOrder: 100, isDefault: true },\n    { id: \"done\", label: \"Done\", color: \"green\", sortOrder: 200 },\n  ],\n  save: async (statuses) => statuses,\n});"),
	render: () => /* @__PURE__ */ l(E, { workbench: S })
};
export { k as AlreadyLoaded, O as Loading, j as ProviderIsolation, A as SaveFailure, D as SeveralProvidersAndReadOnly, T as default };
