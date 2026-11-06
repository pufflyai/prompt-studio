import type { PlacementTabPresentation } from "@pstdio/sdk/extensions";
import { readBook } from "./read";

export const bookMenu: PlacementTabPresentation = {
  async query(ctx, { renderer }) {
    const data = renderer.resource ? await readBook(ctx) : undefined;
    const chapter =
      data?.rules.find((rule) => rule.ref === renderer.resource?.id)?.chapter ??
      Number(renderer.pageParams?.chapter ?? 1);
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
