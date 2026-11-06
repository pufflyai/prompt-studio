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
const rootPage = definePage({
  id: "root",
  title: "Renderer context",
  path: "root",
  mode: workbenchModes.project,
  main: { kind: "panels" },
  slots: [],
});
const itemPage = definePage({
  parent: rootPage.ref,
  id: "items",
  title: "Items",
  path: "items",
  mode: workbenchModes.project,
  resource: {
    kinds: [fixtureItem.ref],
  },
  main: {
    kind: "view",
    view: items.ref,
    cardinality: "one",
  },
  slots: [],
});
export default defineExtension({
  resourceKinds: [fixtureItem],
  views: [items],
  pages: [rootPage, itemPage],
});
