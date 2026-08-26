import {
  defineExtension,
  defineResourceKind,
  defineResourceView,
  defineView,
  resourceSlotRef,
} from "@pstdio/sdk/extensions";

const fixtureItem = defineResourceKind({
  id: "fixture-item",
  surface: "primary",
  slots: [{ id: "primary", cardinality: "one", access: "owner" }],
});
const primary = resourceSlotRef(fixtureItem.ref, "primary");
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

export default defineExtension({
  resourceKinds: [fixtureItem],
  views: [items],
  resourceViews: [defineResourceView({ id: "items", resourceKind: fixtureItem.ref, slot: primary, view: items.ref })],
});
