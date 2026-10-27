// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./kanban-renderer-contributions-Cws4IFXO.ts";
import { t as n } from "./workbench-story-BezxAS71.ts";
import { jsx as r } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/generic-collection-renderer/module.tsx
var i = [{
	id: "status",
	label: "Status",
	type: {
		kind: "enum",
		options: [{
			value: "draft",
			label: "Draft",
			color: "orange"
		}, {
			value: "published",
			label: "Published",
			color: "green"
		}]
	},
	groupable: !0
}, {
	id: "contributors",
	label: "Contributors",
	type: { kind: "string" },
	displayable: !0,
	display: {
		kind: "badge-list",
		itemsAttributeId: "contributorItems"
	}
}], a = [{
	id: "soup",
	title: "Roasted tomato soup",
	attributes: {
		status: "draft",
		season: "Summer",
		contributors: "ada",
		contributorItems: [{
			id: "ada",
			label: "Ada",
			icon: "UserRound",
			resource: {
				type: "contributor",
				id: "ada",
				label: "Ada"
			}
		}]
	}
}, {
	id: "bread",
	title: "Seeded rye bread",
	attributes: {
		status: "published",
		season: "Winter",
		contributors: "sam",
		contributorItems: [{
			id: "sam",
			label: "Sam",
			icon: "ChefHat"
		}, {
			id: "lee",
			label: "Lee",
			icon: "ChefHat"
		}]
	}
}], o = {
	viewMode: "board",
	columnGrouping: "status",
	rowGrouping: "none",
	displayProperties: ["contributors"]
}, s = {
	id: "recipes-configured",
	extensionId: "example.recipes",
	title: "Recipe rules supplied by the extension",
	queryHandlerId: "recipes.configured.query",
	attributes: [...i, {
		id: "season",
		label: "Season",
		type: { kind: "string" },
		displayable: !0,
		display: {
			kind: "portrait-stack",
			itemsAttributeId: "seasonItems"
		}
	}],
	defaultSettings: {
		...o,
		displayProperties: ["contributors", "season"]
	}
}, c = {
	id: "recipes-fallback",
	extensionId: "example.recipes",
	title: "Status colors with no board rules",
	queryHandlerId: "recipes.fallback.query",
	attributes: i,
	defaultSettings: o
}, l = () => ({
	id: "generic-collection-renderer.story",
	activate(e) {
		t({
			projectId: "story-project",
			workbench: e,
			executeCommand: (e) => ({
				rows: a,
				...e === s.queryHandlerId ? { boardColumnConfigs: {
					draft: {
						color: "yellow",
						canCreate: !0
					},
					published: {
						color: "teal",
						canCreate: !1
					}
				} } : {}
			})
		}, [s, c]), e.shellPlacements.registerPlacement({
			id: "recipes-configured-panel",
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: s.id
				}
			},
			region: "main"
		}), e.shellPlacements.registerPlacement({
			id: "recipes-fallback-panel",
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: c.id
				}
			},
			region: "secondary"
		});
	}
}), u = "import type { WorkbenchExtensionKanbanRendererRecord } from \"pstdio-api-contracts\";\nimport type { WorkbenchModuleContribution } from \"../../core\";\nimport { registerWorkbenchExtensionKanbanRenderers } from \"../../extensions\";\n\nconst attributes = [\n  {\n    id: \"status\",\n    label: \"Status\",\n    type: {\n      kind: \"enum\" as const,\n      options: [\n        { value: \"draft\", label: \"Draft\", color: \"orange\" },\n        { value: \"published\", label: \"Published\", color: \"green\" },\n      ],\n    },\n    groupable: true,\n  },\n  {\n    id: \"contributors\",\n    label: \"Contributors\",\n    type: { kind: \"string\" as const },\n    displayable: true,\n    display: { kind: \"badge-list\" as const, itemsAttributeId: \"contributorItems\" },\n  },\n];\nconst rows = [\n  {\n    id: \"soup\",\n    title: \"Roasted tomato soup\",\n    attributes: {\n      status: \"draft\",\n      season: \"Summer\",\n      contributors: \"ada\",\n      contributorItems: [\n        {\n          id: \"ada\",\n          label: \"Ada\",\n          icon: \"UserRound\",\n          resource: { type: \"contributor\", id: \"ada\", label: \"Ada\" },\n        },\n      ],\n    },\n  },\n  {\n    id: \"bread\",\n    title: \"Seeded rye bread\",\n    attributes: {\n      status: \"published\",\n      season: \"Winter\",\n      contributors: \"sam\",\n      contributorItems: [\n        { id: \"sam\", label: \"Sam\", icon: \"ChefHat\" },\n        { id: \"lee\", label: \"Lee\", icon: \"ChefHat\" },\n      ],\n    },\n  },\n];\nconst defaultSettings = {\n  viewMode: \"board\" as const,\n  columnGrouping: \"status\",\n  rowGrouping: \"none\",\n  displayProperties: [\"contributors\"],\n};\nconst configuredRecord = {\n  id: \"recipes-configured\",\n  extensionId: \"example.recipes\",\n  title: \"Recipe rules supplied by the extension\",\n  queryHandlerId: \"recipes.configured.query\",\n  attributes: [\n    ...attributes,\n    {\n      id: \"season\",\n      label: \"Season\",\n      type: { kind: \"string\" as const },\n      displayable: true,\n      display: { kind: \"portrait-stack\", itemsAttributeId: \"seasonItems\" },\n    },\n  ],\n  defaultSettings: { ...defaultSettings, displayProperties: [\"contributors\", \"season\"] },\n} satisfies WorkbenchExtensionKanbanRendererRecord;\nconst fallbackRecord = {\n  id: \"recipes-fallback\",\n  extensionId: \"example.recipes\",\n  title: \"Status colors with no board rules\",\n  queryHandlerId: \"recipes.fallback.query\",\n  attributes,\n  defaultSettings,\n} satisfies WorkbenchExtensionKanbanRendererRecord;\nexport const createGenericCollectionRendererModule = (): WorkbenchModuleContribution => ({\n  id: \"generic-collection-renderer.story\",\n  activate(ctx) {\n    registerWorkbenchExtensionKanbanRenderers(\n      {\n        projectId: \"story-project\",\n        workbench: ctx,\n        executeCommand: (commandId) => ({\n          rows,\n          ...(commandId === configuredRecord.queryHandlerId\n            ? {\n                boardColumnConfigs: {\n                  draft: { color: \"yellow\", canCreate: true },\n                  published: { color: \"teal\", canCreate: false },\n                },\n              }\n            : {}),\n        }),\n      },\n      [configuredRecord, fallbackRecord],\n    );\n    ctx.shellPlacements.registerPlacement({\n      id: \"recipes-configured-panel\",\n      item: {\n        kind: \"view\",\n        presence: \"fixed\",\n        view: {\n          kind: \"view\",\n          id: configuredRecord.id,\n        },\n      },\n      region: \"main\",\n    });\n    ctx.shellPlacements.registerPlacement({\n      id: \"recipes-fallback-panel\",\n      item: {\n        kind: \"view\",\n        presence: \"fixed\",\n        view: {\n          kind: \"view\",\n          id: fallbackRecord.id,\n        },\n      },\n      region: \"secondary\",\n    });\n  },\n});\n", d = {
	title: "pstdio-workbench/Reference/Core API/Extension adapter",
	tags: ["autodocs"],
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "The host adapter turns checked extension metadata into native renderer registrations. Extension authors use @pstdio/sdk/extensions instead of this API." } }
	}
}, f = e();
f.registerModule(l());
var p = {
	parameters: { docs: { source: {
		code: u,
		language: "tsx",
		type: "code"
	} } },
	render: () => /* @__PURE__ */ r(n, { workbench: f })
};
export { p as ExtensionOwnedRules, d as default };
