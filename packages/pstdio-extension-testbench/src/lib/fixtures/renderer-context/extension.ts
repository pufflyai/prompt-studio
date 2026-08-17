import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  kanbanRenderers: {
    items: {
      title: "Items",
      resourceKind: "fixture-item",
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
  },
});
