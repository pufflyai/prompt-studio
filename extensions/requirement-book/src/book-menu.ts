import type { PlacementTabPresentation } from "@pstdio/sdk/extensions";
import { readIndex } from "./read-index";
import { resourceEntries, resourceSelection, resourceSpecs } from "./resource-catalog";

export const bookMenu: PlacementTabPresentation = {
  async query(ctx, { renderer }) {
    const data = renderer.resource ? await readIndex(ctx) : undefined;
    const { chapter } = resourceSelection(data, renderer.resource, renderer.pageParams ?? {});
    const spec = resourceSpecs.find((item) => item.id === renderer.resource?.type);
    const entry =
      data && spec ? resourceEntries(data, spec.id).find((item) => item.id === renderer.resource?.id) : undefined;
    let label = renderer.resource?.label ?? "Requirement book";
    if (entry) label = spec?.id === "requirement" ? `${entry.id} ${entry.label}` : entry.label;
    return {
      label,
      menu: [
        {
          id: "create",
          rows: [
            { id: "rule", label: "New rule", icon: "plus" },
            { id: "chapter", label: "New chapter", icon: "plus" },
            { id: "finding", label: "New finding", icon: "plus" },
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
