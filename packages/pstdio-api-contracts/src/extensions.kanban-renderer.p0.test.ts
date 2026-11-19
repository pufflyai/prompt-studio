import { describe, expect, test } from "bun:test";
import { extensionKanbanRendererRecordSchema } from "./extensions";

describe("extension kanban renderer contracts", () => {
  test("preserves unknown display metadata so the host can report it", () => {
    const record = extensionKanbanRendererRecordSchema.parse({
      id: "recipes",
      extensionId: "example.recipes",
      title: "Recipes",
      queryHandlerId: "recipes.query",
      attributes: [
        {
          id: "contributors",
          label: "Contributors",
          type: { kind: "string" },
          display: { kind: "portrait-stack", itemsAttributeId: "contributorItems" },
        },
      ],
    });

    expect(record.attributes?.[0]?.display).toEqual({
      kind: "portrait-stack",
      itemsAttributeId: "contributorItems",
    });
  });

  test("rejects a badge list without its items attribute", () => {
    const result = extensionKanbanRendererRecordSchema.safeParse({
      id: "recipes",
      extensionId: "example.recipes",
      title: "Recipes",
      queryHandlerId: "recipes.query",
      attributes: [
        {
          id: "contributors",
          label: "Contributors",
          type: { kind: "string" },
          display: { kind: "badge-list" },
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
