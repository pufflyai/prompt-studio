import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import type { WorkbenchModuleContribution } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "../../extensions";

const attributes = [
  {
    id: "status",
    label: "Status",
    type: { kind: "status" as const, statuses: { kind: "status" as const, id: "workflow" } },
    groupable: true,
  },
  {
    id: "contributors",
    label: "Contributors",
    type: { kind: "string" as const },
    displayable: true,
    display: { kind: "badge-list" as const, itemsAttributeId: "contributorItems" },
  },
];

const rows = [
  {
    id: "soup",
    title: "Roasted tomato soup",
    attributes: {
      status: "draft",
      season: "Summer",
      contributors: "ada",
      contributorItems: [
        {
          id: "ada",
          label: "Ada",
          icon: "UserRound",
          resource: { type: "contributor", id: "ada", label: "Ada" },
        },
      ],
    },
  },
  {
    id: "bread",
    title: "Seeded rye bread",
    attributes: {
      status: "published",
      season: "Winter",
      contributors: "sam",
      contributorItems: [
        { id: "sam", label: "Sam", icon: "ChefHat" },
        { id: "lee", label: "Lee", icon: "ChefHat" },
      ],
    },
  },
];

const defaultSettings = {
  viewMode: "board" as const,
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "manual", direction: "asc" as const },
  displayProperties: ["contributors"],
};

const configuredRecord = {
  id: "recipes-configured",
  extensionId: "example.recipes",
  title: "Recipe rules supplied by the extension",
  queryHandlerId: "recipes.configured.query",
  attributes: [
    ...attributes,
    {
      id: "season",
      label: "Season",
      type: { kind: "string" as const },
      displayable: true,
      display: { kind: "portrait-stack", itemsAttributeId: "seasonItems" },
    },
  ],
  defaultSettings: { ...defaultSettings, displayProperties: ["contributors", "season"] },
} satisfies WorkbenchExtensionKanbanRendererRecord;

const fallbackRecord = {
  id: "recipes-fallback",
  extensionId: "example.recipes",
  title: "Status colors with no board rules",
  queryHandlerId: "recipes.fallback.query",
  attributes,
  defaultSettings,
} satisfies WorkbenchExtensionKanbanRendererRecord;

export const createGenericCollectionRendererModule = (): WorkbenchModuleContribution => ({
  id: "generic-collection-renderer.story",
  activate(ctx) {
    ctx.statuses.registerStatusSet({
      id: "example.recipes.status.workflow",
      title: "Recipe workflow",
      query: () => [
        { id: "draft", label: "Draft", color: "orange", sortOrder: 0 },
        { id: "published", label: "Published", color: "green", sortOrder: 1 },
      ],
    });

    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "story-project",
        workbench: ctx,
        executeCommand: (commandId) => ({
          rows,
          ...(commandId === configuredRecord.queryHandlerId
            ? {
                boardColumnConfigs: {
                  draft: { color: "yellow", canCreate: true, canDragIn: true, canDragOut: true },
                  published: { color: "teal", canCreate: false, canDragIn: true, canDragOut: false },
                },
              }
            : {}),
        }),
      },
      [configuredRecord, fallbackRecord],
    );

    ctx.layout.registerPanel({
      id: "recipes-configured-panel",
      title: configuredRecord.title,
      region: "main",
      rendererId: configuredRecord.id,
      singleton: true,
    });
    ctx.layout.registerPanel({
      id: "recipes-fallback-panel",
      title: fallbackRecord.title,
      region: "secondary",
      rendererId: fallbackRecord.id,
      singleton: true,
    });
    ctx.layout.openPanel("recipes-configured-panel");
    ctx.layout.openPanel("recipes-fallback-panel");
  },
});
