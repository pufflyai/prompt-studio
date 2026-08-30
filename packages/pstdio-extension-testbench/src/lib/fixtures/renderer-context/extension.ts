import { defineExtension, definePage, defineResourceKind, defineView } from "@pstdio/sdk/extensions";

const fixtureItem = defineResourceKind({ id: "fixture-item" });
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

const itemsPage = definePage({
  id: "items-page",
  title: "Items",
  slots: [{ id: "item", region: "main", cardinality: "one" }],
  bindings: [{ resourceKind: fixtureItem.ref, view: items.ref, slot: "item" }],
});

export default defineExtension({
  resourceKinds: [fixtureItem],
  views: [items],
  pages: [itemsPage],
});
