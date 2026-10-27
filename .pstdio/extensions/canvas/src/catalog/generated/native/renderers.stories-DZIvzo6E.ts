// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { t } from "./extension-preview-CoFgn7XM.ts";
import { t as n } from "./workbench-core-kaLFKJEn.ts";
import { t as r } from "./views-IEbq4d_M.ts";
import { t as i } from "./onboarding-frame-Ba7jPTby.ts";
import { t as a } from "./onboarding-sources-D_wLzQ74.ts";
import { t as o } from "./views-pBNdu9p-.ts";
import { n as s, t as c } from "./module-Bi1MEnCK.ts";
import { jsx as l } from "react/jsx-runtime";
import { defineExtension as u, defineNavigationItem as d, definePage as f, defineView as p, workbenchModes as m } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/examples/onboarding/extensions/controls-extension.ts
var h = {
	environment: "staging",
	replicas: 2,
	releaseNotes: "Check the worker queue after deployment."
}, g = [{
	id: "deployment",
	title: "Deployment",
	description: "Values returned by the extension, rendered with shared workbench controls.",
	params: [
		{
			id: "environment",
			name: "Environment",
			type: "selection",
			defaultValue: "staging",
			options: [{
				id: "staging",
				name: "Staging"
			}, {
				id: "production",
				name: "Production"
			}]
		},
		{
			id: "replicas",
			name: "Replicas",
			type: "number",
			defaultValue: 2,
			min: 1,
			max: 10,
			step: 1
		},
		{
			id: "releaseNotes",
			name: "Release notes",
			type: "text",
			defaultValue: "",
			singleLine: !1
		}
	]
}], _ = p({
	id: "deployment-settings",
	title: "Deployment settings",
	body: {
		kind: "controls",
		query: async () => ({
			groups: g,
			values: h
		}),
		onValueChange: async (e, t) => {
			h = {
				...h,
				[t.controlId]: t.value
			};
		}
	}
}), v = f({
	id: "deployment-settings",
	title: "Deployment settings",
	path: "deployment-settings",
	mode: m.project,
	main: {
		kind: "view",
		view: _.ref,
		cardinality: "one"
	},
	slots: []
}), y = u({
	views: [_],
	pages: [v]
}), b = "import {\n  type ControlGroup,\n  type ControlValueMap,\n  defineExtension,\n  definePage,\n  defineView,\n  workbenchModes,\n} from \"@pstdio/sdk/extensions\";\n\nlet values: ControlValueMap = {\n  environment: \"staging\",\n  replicas: 2,\n  releaseNotes: \"Check the worker queue after deployment.\",\n};\nconst deploymentGroups: ControlGroup[] = [\n  {\n    id: \"deployment\",\n    title: \"Deployment\",\n    description: \"Values returned by the extension, rendered with shared workbench controls.\",\n    params: [\n      {\n        id: \"environment\",\n        name: \"Environment\",\n        type: \"selection\",\n        defaultValue: \"staging\",\n        options: [\n          { id: \"staging\", name: \"Staging\" },\n          { id: \"production\", name: \"Production\" },\n        ],\n      },\n      { id: \"replicas\", name: \"Replicas\", type: \"number\", defaultValue: 2, min: 1, max: 10, step: 1 },\n      { id: \"releaseNotes\", name: \"Release notes\", type: \"text\", defaultValue: \"\", singleLine: false },\n    ],\n  },\n];\nconst deploymentSettings = defineView({\n  id: \"deployment-settings\",\n  title: \"Deployment settings\",\n  body: {\n    kind: \"controls\",\n    query: async () => ({\n      groups: deploymentGroups,\n      values,\n    }),\n    onValueChange: async (_ctx, input) => {\n      values = { ...values, [input.controlId]: input.value };\n    },\n  },\n});\nexport const deploymentSettingsPage = definePage({\n  id: \"deployment-settings\",\n  title: \"Deployment settings\",\n  path: \"deployment-settings\",\n  mode: workbenchModes.project,\n  main: {\n    kind: \"view\",\n    view: deploymentSettings.ref,\n    cardinality: \"one\",\n  },\n  slots: [],\n});\nexport default defineExtension({\n  views: [deploymentSettings],\n  pages: [deploymentSettingsPage],\n});\n", x = p({
	id: "services",
	title: "Services",
	body: {
		kind: "dataTable",
		selectionMode: "multiple",
		columns: [
			{
				id: "name",
				label: "Name"
			},
			{
				id: "status",
				label: "Status",
				renderer: {
					type: "categorical-color",
					categories: [{
						value: "healthy",
						color: {
							light: "green.100",
							dark: "green.900"
						}
					}, {
						value: "degraded",
						color: {
							light: "orange.100",
							dark: "orange.900"
						}
					}]
				}
			},
			{
				id: "latency",
				label: "Latency (ms)"
			}
		],
		query: async () => ({ rows: [
			{
				id: "api",
				values: {
					name: "API",
					status: "healthy",
					latency: 42
				}
			},
			{
				id: "worker",
				values: {
					name: "Worker",
					status: "degraded",
					latency: 180
				}
			},
			{
				id: "web",
				values: {
					name: "Web",
					status: "healthy",
					latency: 61
				}
			}
		] })
	}
}), S = f({
	id: "services",
	title: "Services",
	path: "services",
	mode: m.project,
	main: {
		kind: "view",
		view: x.ref,
		cardinality: "one"
	},
	slots: []
}), C = u({
	views: [x],
	pages: [S]
}), w = "import { defineExtension, definePage, defineView, workbenchModes } from \"@pstdio/sdk/extensions\";\n\nconst services = defineView({\n  id: \"services\",\n  title: \"Services\",\n  body: {\n    kind: \"dataTable\",\n    selectionMode: \"multiple\",\n    columns: [\n      { id: \"name\", label: \"Name\" },\n      {\n        id: \"status\",\n        label: \"Status\",\n        renderer: {\n          type: \"categorical-color\",\n          categories: [\n            { value: \"healthy\", color: { light: \"green.100\", dark: \"green.900\" } },\n            { value: \"degraded\", color: { light: \"orange.100\", dark: \"orange.900\" } },\n          ],\n        },\n      },\n      { id: \"latency\", label: \"Latency (ms)\" },\n    ],\n    query: async () => ({\n      rows: [\n        { id: \"api\", values: { name: \"API\", status: \"healthy\", latency: 42 } },\n        { id: \"worker\", values: { name: \"Worker\", status: \"degraded\", latency: 180 } },\n        { id: \"web\", values: { name: \"Web\", status: \"healthy\", latency: 61 } },\n      ],\n    }),\n  },\n});\nexport const servicesPage = definePage({\n  id: \"services\",\n  title: \"Services\",\n  path: \"services\",\n  mode: workbenchModes.project,\n  main: {\n    kind: \"view\",\n    view: services.ref,\n    cardinality: \"one\",\n  },\n  slots: [],\n});\nexport default defineExtension({\n  views: [services],\n  pages: [servicesPage],\n});\n", T = "# Extension file view\n\nThe extension supplies file content. Prompt Studio supplies the editor.", E = p({
	id: "notes",
	title: "notes.md",
	body: {
		kind: "file",
		load: async () => ({
			fileName: "notes.md",
			content: T
		}),
		save: async (e, t) => {
			T = t.content;
		}
	}
}), D = f({
	id: "notes",
	title: "Notes",
	path: "notes",
	mode: m.project,
	main: {
		kind: "view",
		view: E.ref,
		cardinality: "one"
	},
	slots: []
}), O = u({
	views: [E],
	pages: [D]
}), k = "import { defineExtension, definePage, defineView, workbenchModes } from \"@pstdio/sdk/extensions\";\n\nlet content = [\n  \"# Extension file view\",\n  \"\",\n  \"The extension supplies file content. Prompt Studio supplies the editor.\",\n].join(\"\\n\");\nconst notes = defineView({\n  id: \"notes\",\n  title: \"notes.md\",\n  body: {\n    kind: \"file\",\n    load: async () => ({ fileName: \"notes.md\", content }),\n    save: async (_ctx, input) => {\n      content = input.content;\n    },\n  },\n});\nexport const notesPage = definePage({\n  id: \"notes\",\n  title: \"Notes\",\n  path: \"notes\",\n  mode: workbenchModes.project,\n  main: {\n    kind: \"view\",\n    view: notes.ref,\n    cardinality: \"one\",\n  },\n  slots: [],\n});\nexport default defineExtension({\n  views: [notes],\n  pages: [notesPage],\n});\n", A = p({
	id: "tickets",
	title: "Tickets",
	body: {
		kind: "kanban",
		attributes: [{
			id: "status",
			label: "Status",
			type: {
				kind: "enum",
				options: [
					{
						value: "todo",
						label: "To do",
						color: "gray"
					},
					{
						value: "doing",
						label: "Doing",
						color: "blue"
					},
					{
						value: "done",
						label: "Done",
						color: "green"
					}
				]
			},
			groupable: !0,
			displayable: !0
		}],
		defaultSettings: {
			viewMode: "board",
			columnGrouping: "status",
			rowGrouping: "none",
			displayProperties: []
		},
		defaultSorts: [{
			attributeId: "status",
			direction: "asc"
		}],
		query: async () => ({ rows: [
			{
				id: "one",
				title: "Write the guide",
				attributes: { status: "doing" }
			},
			{
				id: "two",
				title: "Review the example",
				attributes: { status: "todo" }
			},
			{
				id: "three",
				title: "Publish the docs",
				attributes: { status: "done" }
			}
		] })
	}
}), j = f({
	id: "tickets",
	title: "Tickets",
	path: "tickets",
	mode: m.project,
	main: {
		kind: "view",
		view: A.ref,
		cardinality: "one"
	},
	slots: []
}), M = u({
	views: [A],
	pages: [j]
}), N = "import { defineExtension, definePage, defineView, workbenchModes } from \"@pstdio/sdk/extensions\";\n\nconst tickets = defineView({\n  id: \"tickets\",\n  title: \"Tickets\",\n  body: {\n    kind: \"kanban\",\n    attributes: [\n      {\n        id: \"status\",\n        label: \"Status\",\n        type: {\n          kind: \"enum\",\n          options: [\n            { value: \"todo\", label: \"To do\", color: \"gray\" },\n            { value: \"doing\", label: \"Doing\", color: \"blue\" },\n            { value: \"done\", label: \"Done\", color: \"green\" },\n          ],\n        },\n        groupable: true,\n        displayable: true,\n      },\n    ],\n    defaultSettings: {\n      viewMode: \"board\",\n      columnGrouping: \"status\",\n      rowGrouping: \"none\",\n      displayProperties: [],\n    },\n    defaultSorts: [{ attributeId: \"status\", direction: \"asc\" }],\n    query: async () => ({\n      rows: [\n        { id: \"one\", title: \"Write the guide\", attributes: { status: \"doing\" } },\n        { id: \"two\", title: \"Review the example\", attributes: { status: \"todo\" } },\n        { id: \"three\", title: \"Publish the docs\", attributes: { status: \"done\" } },\n      ],\n    }),\n  },\n});\nexport const ticketsPage = definePage({\n  id: \"tickets\",\n  title: \"Tickets\",\n  path: \"tickets\",\n  mode: workbenchModes.project,\n  main: {\n    kind: \"view\",\n    view: tickets.ref,\n    cardinality: \"one\",\n  },\n  slots: [],\n});\nexport default defineExtension({\n  views: [tickets],\n  pages: [ticketsPage],\n});\n", P = p({
	id: "guide-tree",
	title: "Guide",
	body: {
		kind: "tree",
		defaultExpandedSectionIds: ["learn"],
		body: async () => [{
			id: "learn",
			label: "Learn Prompt Studio",
			nodes: [
				{
					id: "start",
					label: "Getting started",
					icon: "BookOpen",
					selected: !0
				},
				{
					id: "pages",
					label: "Pages",
					icon: "PanelsTopLeft"
				},
				{
					id: "views",
					label: "Views",
					icon: "LayoutPanelTop"
				}
			]
		}]
	}
}), F = f({
	id: "guide",
	title: "Guide",
	path: "guide",
	mode: m.project,
	main: {
		kind: "view",
		view: P.ref,
		cardinality: "one"
	},
	slots: []
}), I = d({
	id: "guide",
	owner: m.project,
	slot: "content",
	group: "Learn",
	label: "Guide",
	icon: "BookOpen",
	action: {
		kind: "page",
		page: F.ref
	}
}), L = u({
	views: [P],
	pages: [F],
	navigationItems: [I]
}), R = "import { defineExtension, defineNavigationItem, definePage, defineView, workbenchModes } from \"@pstdio/sdk/extensions\";\nexport const guideTree = defineView({\n  id: \"guide-tree\",\n  title: \"Guide\",\n  body: {\n    kind: \"tree\",\n    defaultExpandedSectionIds: [\"learn\"],\n    body: async () => [\n      {\n        id: \"learn\",\n        label: \"Learn Prompt Studio\",\n        nodes: [\n          { id: \"start\", label: \"Getting started\", icon: \"BookOpen\", selected: true },\n          { id: \"pages\", label: \"Pages\", icon: \"PanelsTopLeft\" },\n          { id: \"views\", label: \"Views\", icon: \"LayoutPanelTop\" },\n        ],\n      },\n    ],\n  },\n});\nexport const guidePage = definePage({\n  id: \"guide\",\n  title: \"Guide\",\n  path: \"guide\",\n  mode: workbenchModes.project,\n  main: {\n    kind: \"view\",\n    view: guideTree.ref,\n    cardinality: \"one\",\n  },\n  slots: [],\n});\nconst guideNavigation = defineNavigationItem({\n  id: \"guide\",\n  owner: workbenchModes.project,\n  slot: \"content\",\n  group: \"Learn\",\n  label: \"Guide\",\n  icon: \"BookOpen\",\n  action: { kind: \"page\", page: guidePage.ref },\n});\nexport default defineExtension({\n  views: [guideTree],\n  pages: [guidePage],\n  navigationItems: [guideNavigation],\n});\n", z = /* @__PURE__ */ e({
	ChooseRenderer: () => U,
	Controls: () => K,
	DataTable: () => q,
	File: () => Y,
	Kanban: () => J,
	ReactView: () => W,
	Tree: () => G,
	Webview: () => X,
	default: () => B
}), B = {
	title: "pstdio-workbench/Guides/Renderers",
	tags: ["!dev"],
	parameters: { layout: "padded" }
}, V = (e, t) => ({ docs: {
	description: { story: e },
	source: {
		code: t,
		language: "tsx",
		type: "code"
	}
} }), H = () => {
	let e = n();
	return e.registerModule(c({ createBridgeDocument: s })), e;
}, U = {
	name: "0. Choose a renderer",
	parameters: V("Compare every supported View body before choosing one for a host feature or extension.", o),
	render: () => /* @__PURE__ */ l(i, { createWorkbench: r })
}, W = {
	name: "1. React view",
	parameters: V("Trusted hosts can render React directly. Extensions cannot use this body kind.", o),
	render: () => /* @__PURE__ */ l(i, { createWorkbench: r })
}, G = {
	name: "2. Tree",
	parameters: V("The extension returns sections and nodes. The workbench owns tree interaction.", R),
	render: () => /* @__PURE__ */ l(i, { createWorkbench: () => t(L, F.id) })
}, K = {
	name: "3. Controls",
	parameters: V("The extension returns form declarations and values. The workbench renders and validates them.", b),
	render: () => /* @__PURE__ */ l(i, { createWorkbench: () => t(y, v.id) })
}, q = {
	name: "4. Data table",
	parameters: V("The extension returns columns and rows. The workbench owns table behavior.", w),
	render: () => /* @__PURE__ */ l(i, { createWorkbench: () => t(C, S.id) })
}, J = {
	name: "5. Kanban",
	parameters: V("The extension returns attributes and rows. The workbench groups them into a board.", N),
	render: () => /* @__PURE__ */ l(i, { createWorkbench: () => t(M, j.id) })
}, Y = {
	name: "6. File",
	parameters: V("The extension loads content. The workbench picks the editor or preview from the file name.", k),
	render: () => /* @__PURE__ */ l(i, { createWorkbench: () => t(O, D.id) })
}, X = {
	name: "7. Webview",
	parameters: V("A packaged UI runs in an isolated frame with declared host capabilities.", a.webviewCapabilities),
	render: () => /* @__PURE__ */ l(i, { createWorkbench: H })
};
export { U as ChooseRenderer, K as Controls, q as DataTable, Y as File, J as Kanban, W as ReactView, G as Tree, X as Webview, B as default, z as t };
