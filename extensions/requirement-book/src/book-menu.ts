import type { PlacementTabPresentation } from "@pstdio/sdk/extensions";
import { readBook } from "./read";
import { resourceSelection } from "./resource-catalog";

export const bookMenu: PlacementTabPresentation = {
  async query(ctx, { renderer }) {
    const data = renderer.resource ? await readBook(ctx) : undefined;
    const { chapter } = resourceSelection(data, renderer.resource, renderer.pageParams ?? {});
    return {
      menu: [
        {
          id: "create",
          rows: [
            { id: "rule", label: "New rule", icon: "plus" },
            { id: "chapter", label: "New chapter", icon: "plus" },
            { id: "finding", label: "New finding", icon: "plus" },
            { id: "observation", label: "Record observation", icon: "plus" },
          ].map((item) => ({
            ...item,
            action: {
              kind: "page" as const,
              page: { kind: "page" as const, id: "book" },
              params: { chapter, review: String(renderer.pageParams?.review ?? ""), form: item.id },
            },
          })),
        },
      ],
    };
  },
};
