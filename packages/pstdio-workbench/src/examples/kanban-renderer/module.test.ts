import { describe, expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { kanbanRendererStoryRendererId, kanbanRendererStoryWidgetId } from "./mock-data";
import { createKanbanRendererStoryModule } from "./module";

describe("createKanbanRendererStoryModule", () => {
  test("registers and opens the kanban renderer story widget", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createKanbanRendererStoryModule());

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer(kanbanRendererStoryRendererId);
    const rows = await Promise.resolve(
      renderer?.executeQuery(
        {
          settings: {
            viewMode: "board",
            columnGrouping: "status",
            rowGrouping: "none",
            displayProperties: ["status"],
          },
          filter: { conjunction: "and", rules: [] },
          sorts: [{ attributeId: "updated", direction: "desc" }],
        },
        new AbortController().signal,
      ) ?? [],
    );

    expect(renderer?.title).toBe("Rows");
    expect(workbench.layout.getActivePanel("main")?.viewId).toBe(kanbanRendererStoryWidgetId);
    expect(rows.length).toBeGreaterThan(0);
  });

  test("persists story board attribute changes and manual reorder", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createKanbanRendererStoryModule());

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer(kanbanRendererStoryRendererId)!;
    renderer.onAttributeChange?.("DR-8", "status", "review");
    renderer.onReorder?.("DR-8", "DR-2");

    const rows = await Promise.resolve(
      renderer.executeQuery(
        {
          settings: {
            viewMode: "board",
            columnGrouping: "status",
            rowGrouping: "none",
            displayProperties: ["status"],
          },
          filter: { conjunction: "and", rules: [] },
          sorts: [],
        },
        new AbortController().signal,
      ),
    );

    expect(rows.map((row) => row.id).slice(0, 3)).toEqual(["DR-1", "DR-8", "DR-2"]);
    expect(rows.find((row) => row.id === "DR-8")?.attributes.status).toBe("review");
  });
});
