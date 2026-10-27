// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-N58OeDyx.ts";
import { t } from "./icon-D3uE7jD-.ts";
import { t as n } from "./workbench-story-B6F8bQqu.ts";
import { jsx as r } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/data-table-renderer/module.tsx
var i = "data-table-renderer.story.health", a = (e, t) => ({
	light: e,
	dark: t
}), o = (e) => e >= 80 ? "healthy" : e >= 55 ? "degraded" : "critical", s = Array.from({ length: 24 }, (e, t) => {
	let n = 35 + t * 17 % 66, r = o(n);
	return {
		id: `service-${t + 1}`,
		values: {
			service: `Service ${t + 1}`,
			status: r,
			score: n,
			latency: 40 + t * 37 % 460,
			details: {
				region: t % 2 == 0 ? "eu-north" : "us-east",
				replicas: 2 + t % 4
			}
		}
	};
}), c = (e = !1) => ({
	id: "data-table-renderer.story",
	activate(n) {
		n.views.registerView({
			id: i,
			title: "Service health",
			body: {
				kind: "dataTable",
				toolbarActions: [{
					id: "run",
					label: "Run experiment",
					icon: "Play",
					presentation: "primary",
					params: { name: {
						type: "text",
						required: !0,
						label: "Name"
					} },
					submitLabel: "Start",
					run: async () => {
						n.notifications.show({
							title: "Experiment started",
							level: "info"
						});
					}
				}],
				initialPageSize: 10,
				pageSizeOptions: [
					5,
					10,
					20
				],
				selectionMode: "multiple",
				columns: [
					{
						id: "service",
						label: "Service",
						icon: /* @__PURE__ */ r(t, {
							name: "Server",
							size: 14
						})
					},
					{
						id: "status",
						label: "Status",
						stat: {
							type: "top-values",
							limit: 3
						},
						renderer: {
							type: "categorical-color",
							categories: [
								{
									value: "healthy",
									color: a("green.100", "green.900")
								},
								{
									value: "degraded",
									color: a("orange.100", "orange.900")
								},
								{
									value: "critical",
									color: a("red.100", "red.900")
								}
							]
						}
					},
					{
						id: "score",
						label: "Health",
						description: "Composite service health score",
						stat: {
							type: "histogram",
							bins: 8
						},
						renderer: {
							type: "color-scale",
							stops: [
								{
									value: 0,
									color: a("red.300", "red.700")
								},
								{
									value: 60,
									color: a("orange.300", "orange.700")
								},
								{
									value: 100,
									color: a("green.300", "green.700")
								}
							]
						}
					},
					{
						id: "latency",
						label: "Latency (ms)",
						stat: { type: "unique" }
					},
					{
						id: "details",
						label: "Details",
						renderer: { type: "json" }
					}
				],
				executeQuery: () => ({ rows: e ? [] : s }),
				onRowActivate: (e) => {
					n.notifications.show({
						title: `Opened ${e.values.service}`,
						level: "info"
					});
				},
				selectionActions: [{
					id: "restart",
					label: "Restart selected",
					icon: /* @__PURE__ */ r(t, {
						name: "RotateCcw",
						size: 16
					}),
					run: (e) => {
						n.notifications.show({
							title: `Restarting ${e.length} services`,
							level: "info"
						});
					}
				}],
				rowActions: [{
					id: "inspect",
					label: "Inspect service",
					icon: /* @__PURE__ */ r(t, {
						name: "Search",
						size: 16
					}),
					run: (e) => {
						n.notifications.show({
							title: `Inspecting ${e.values.service}`,
							level: "info"
						});
					}
				}]
			}
		}), n.shellPlacements.registerPlacement({
			id: i,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: i
				}
			},
			region: "main"
		});
	}
}), l = "import type { WorkbenchModuleContribution } from \"../../core\";\nimport { WorkbenchIcon } from \"../../react\";\n\nconst rendererId = \"data-table-renderer.story.health\";\nconst themeColor = (light: string, dark: string) => ({ light, dark });\nconst healthStatus = (score: number) => {\n  if (score >= 80) return \"healthy\";\n  return score >= 55 ? \"degraded\" : \"critical\";\n};\nconst rows = Array.from({ length: 24 }, (_, index) => {\n  const score = 35 + ((index * 17) % 66);\n  const status = healthStatus(score);\n  return {\n    id: `service-${index + 1}`,\n    values: {\n      service: `Service ${index + 1}`,\n      status,\n      score,\n      latency: 40 + ((index * 37) % 460),\n      details: { region: index % 2 === 0 ? \"eu-north\" : \"us-east\", replicas: 2 + (index % 4) },\n    },\n  };\n});\nexport const createDataTableRendererStoryModule = (empty = false): WorkbenchModuleContribution => ({\n  id: \"data-table-renderer.story\",\n  activate(ctx) {\n    ctx.views.registerView({\n      id: rendererId,\n      title: \"Service health\",\n      body: {\n        kind: \"dataTable\",\n        toolbarActions: [\n          {\n            id: \"run\",\n            label: \"Run experiment\",\n            icon: \"Play\",\n            presentation: \"primary\",\n            params: { name: { type: \"text\", required: true, label: \"Name\" } },\n            submitLabel: \"Start\",\n            run: async () => {\n              ctx.notifications.show({ title: \"Experiment started\", level: \"info\" });\n            },\n          },\n        ],\n        initialPageSize: 10,\n        pageSizeOptions: [5, 10, 20],\n        selectionMode: \"multiple\",\n        columns: [\n          { id: \"service\", label: \"Service\", icon: <WorkbenchIcon name=\"Server\" size={14} /> },\n          {\n            id: \"status\",\n            label: \"Status\",\n            stat: { type: \"top-values\", limit: 3 },\n            renderer: {\n              type: \"categorical-color\",\n              categories: [\n                { value: \"healthy\", color: themeColor(\"green.100\", \"green.900\") },\n                { value: \"degraded\", color: themeColor(\"orange.100\", \"orange.900\") },\n                { value: \"critical\", color: themeColor(\"red.100\", \"red.900\") },\n              ],\n            },\n          },\n          {\n            id: \"score\",\n            label: \"Health\",\n            description: \"Composite service health score\",\n            stat: { type: \"histogram\", bins: 8 },\n            renderer: {\n              type: \"color-scale\",\n              stops: [\n                { value: 0, color: themeColor(\"red.300\", \"red.700\") },\n                { value: 60, color: themeColor(\"orange.300\", \"orange.700\") },\n                { value: 100, color: themeColor(\"green.300\", \"green.700\") },\n              ],\n            },\n          },\n          { id: \"latency\", label: \"Latency (ms)\", stat: { type: \"unique\" } },\n          { id: \"details\", label: \"Details\", renderer: { type: \"json\" } },\n        ],\n        executeQuery: () => ({ rows: empty ? [] : rows }),\n        onRowActivate: (row) => {\n          ctx.notifications.show({ title: `Opened ${row.values.service}`, level: \"info\" });\n        },\n        selectionActions: [\n          {\n            id: \"restart\",\n            label: \"Restart selected\",\n            icon: <WorkbenchIcon name=\"RotateCcw\" size={16} />,\n            run: (selectedRows) => {\n              ctx.notifications.show({ title: `Restarting ${selectedRows.length} services`, level: \"info\" });\n            },\n          },\n        ],\n        rowActions: [\n          {\n            id: \"inspect\",\n            label: \"Inspect service\",\n            icon: <WorkbenchIcon name=\"Search\" size={16} />,\n            run: (row) => {\n              ctx.notifications.show({ title: `Inspecting ${row.values.service}`, level: \"info\" });\n            },\n          },\n        ],\n      },\n    });\n    ctx.shellPlacements.registerPlacement({\n      id: rendererId,\n      item: {\n        kind: \"view\",\n        presence: \"fixed\",\n        view: {\n          kind: \"view\",\n          id: rendererId,\n        },\n      },\n      region: \"main\",\n    });\n  },\n});\n", u = (e) => ({
	id: "paged-table.story",
	activate(t) {
		let n = "paged-table.story.table", r = [{
			id: "title",
			label: "Title",
			type: "string"
		}, {
			id: "status",
			label: "Status",
			type: "string",
			groupable: !0
		}], i = [{
			id: "one",
			values: {
				title: "First task",
				status: "todo"
			}
		}, {
			id: "two",
			values: {
				title: "Second task",
				status: "done"
			}
		}];
		t.views.registerView({
			id: n,
			title: "Paged tasks",
			body: {
				kind: "dataTable",
				queryMode: "paged",
				columns: e ? void 0 : r,
				defaultSettings: {
					showStats: !1,
					grouping: e ? "none" : "status"
				},
				executeQuery: ({ page: e }) => {
					let t = i.filter((t) => !e?.collapsedGroups?.includes(t.values.status));
					return {
						columns: r,
						rows: t.map((t) => ({
							...t,
							values: Object.fromEntries(Object.entries(t.values).filter(([t]) => e?.fields.includes(t)))
						})),
						page: {
							revision: "story-1",
							cursor: null,
							total: i.length,
							filteredTotal: t.length,
							groups: i.map((e) => ({
								field: "status",
								value: e.values.status,
								count: 1
							}))
						}
					};
				}
			}
		}), t.shellPlacements.registerPlacement({
			id: n,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: n
				}
			},
			region: "main"
		});
	}
}), d = e();
d.registerModule(c());
var f = {
	title: "pstdio-workbench/Reference/Core API/Native data table",
	component: n,
	tags: ["autodocs"],
	args: { workbench: d },
	argTypes: { workbench: { table: { disable: !0 } } },
	parameters: {
		controls: { disable: !0 },
		docs: { description: { component: "The Core API registration used by the host adapter for the native data table. Extension authors declare the dataTable view body shown in Extension onboarding." } },
		layout: "fullscreen"
	}
}, p = {
	name: "Multiple selection",
	parameters: { docs: {
		description: { story: "Select services and run the contribution's bulk restart action from the selection toolbar." },
		source: {
			code: l,
			language: "tsx",
			type: "code"
		}
	} }
}, m = e();
m.registerModule(c(!0));
var h = {
	name: "Empty table with primary action",
	args: { workbench: m }
}, g = e();
g.registerModule(u(!0));
var _ = {
	name: "Paged table with discovered columns",
	args: { workbench: g }
}, v = e();
v.registerModule(u(!1));
var y = {
	name: "Paged groups retain expand controls",
	args: { workbench: v }
};
export { y as CollapsiblePageGroups, _ as DiscoveredPageColumns, h as EmptyWithAction, p as MultipleSelection, f as default };
