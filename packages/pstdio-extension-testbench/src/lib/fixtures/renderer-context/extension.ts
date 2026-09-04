import { defineExtension, definePage, defineResourceKind, defineView, workbenchModes } from "@pstdio/sdk/extensions";

const fixtureItem = defineResourceKind({
  id: "fixture-item",
});
const items = defineView({
  id: "items",
  title: "Items",
  body: {
    kind: "kanban",
    attributes: [],
    query: (_ctx, input) => ({
      rows: [
        {
          id: input.renderer.rendererId,
          title: "Renderer context",
          resource: {
            type: "fixture-item",
            id: input.renderer.rendererId,
            label: input.renderer.projectId,
          },
          attributes: {},
        },
      ],
    }),
  },
});
const itemPage = definePage({
  id: "items",
  title: "Items",
  path: "items",
  mode: workbenchModes.project,
  slots: [
    {
      id: "content",
      role: "primary",
      region: "main",
      binding: { kind: fixtureItem.ref, view: items.ref, cardinality: "one" },
    },
  ],
});

export default defineExtension({
  resourceKinds: [fixtureItem],
  views: [items],
  pages: [itemPage],
});
