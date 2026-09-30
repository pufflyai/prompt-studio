import { describe, expect, test } from "bun:test";
import type { KanbanRendererAttributeDescriptor } from "./extension-kernel";
import { extensionKanbanRendererRecordSchema } from "./extensions";

describe("extension kanban renderer contracts", () => {
  test("preserves fixed list columns and text or link displays", () => {
    const attributes: KanbanRendererAttributeDescriptor[] = [
      {
        id: "site",
        label: "Site",
        type: { kind: "string" },
        display: { kind: "text" },
        listColumn: { placement: "start", size: "sm" },
      },
      {
        id: "url",
        label: "Open source",
        type: { kind: "string" },
        display: { kind: "link" },
        listColumn: { placement: "end", size: "xs", align: "end" },
      },
    ];
    const record = extensionKanbanRendererRecordSchema.parse({
      id: "threads",
      extensionId: "example.radar",
      title: "Threads",
      queryHandlerId: "threads.query",
      attributes,
    });
    expect(record.attributes).toEqual(attributes);
  });

  test("rejects an unsupported fixed column size", () => {
    expect(
      extensionKanbanRendererRecordSchema.safeParse({
        id: "threads",
        extensionId: "example.radar",
        title: "Threads",
        queryHandlerId: "threads.query",
        attributes: [
          {
            id: "site",
            label: "Site",
            type: { kind: "string" },
            listColumn: { placement: "start", size: "arbitrary" },
          },
        ],
      }).success,
    ).toBe(false);
  });

  test("preserves extension-declared default saved views", () => {
    const record = extensionKanbanRendererRecordSchema.parse({
      id: "planner.tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      queryHandlerId: "planner.tickets.query",
      rowActivationHandlerId: "planner.tickets.onRowActivate",
      defaultViews: [
        {
          id: "all",
          title: "All tickets",
          settings: {
            viewMode: "board",
            columnGrouping: "status",
            rowGrouping: "none",
            ordering: { attributeId: "manual", direction: "asc" },
            displayProperties: ["priority"],
          },
          filters: {},
        },
      ],
      defaultActiveViewId: "all",
    });

    expect(record.defaultViews).toEqual([
      {
        id: "all",
        title: "All tickets",
        settings: {
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "manual", direction: "asc" },
          displayProperties: ["priority"],
        },
        filters: {},
      },
    ]);
    expect(record.defaultActiveViewId).toBe("all");
    expect(record.rowActivationHandlerId).toBe("planner.tickets.onRowActivate");
  });

  test("accepts badge list display metadata on attributes", () => {
    const record = extensionKanbanRendererRecordSchema.parse({
      id: "planner.tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      queryHandlerId: "planner.tickets.query",
      attributes: [
        {
          id: "workspace",
          label: "Workspace",
          type: { kind: "string" },
          displayable: true,
          display: { kind: "badge-list", itemsAttributeId: "contributorItems" },
        },
      ],
    });

    expect(record.attributes?.[0]).toMatchObject({
      id: "workspace",
      display: { kind: "badge-list", itemsAttributeId: "contributorItems" },
    });
  });

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
