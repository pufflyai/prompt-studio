import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { dataRendererStoryRendererId, dataRendererStoryWidgetId } from "./mock-data";
import { createDataRendererStoryModule } from "./module";

describe("createDataRendererStoryModule", () => {
  test("registers and opens the data renderer story widget", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createDataRendererStoryModule());

    const renderer = workbench.renderers.getDataRenderer(dataRendererStoryRendererId);
    const rows = await Promise.resolve(
      renderer?.executeQuery({
        settings: {
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "updated", direction: "desc" },
          displayProperties: ["status"],
        },
        filters: {},
      }) ?? [],
    );

    expect(renderer?.title).toBe("Rows");
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dataRendererStoryWidgetId);
    expect(rows.length).toBeGreaterThan(0);
  });

  test("persists story board attribute changes and manual reorder", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createDataRendererStoryModule());

    const renderer = workbench.renderers.getDataRenderer(dataRendererStoryRendererId)!;
    renderer.onAttributeChange?.("DR-8", "status", "review");
    renderer.onReorder?.("DR-8", "DR-2");

    const rows = await Promise.resolve(
      renderer.executeQuery({
        settings: {
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "manual", direction: "asc" },
          displayProperties: ["status"],
        },
        filters: {},
      }),
    );

    expect(rows.map((row) => row.id).slice(0, 3)).toEqual(["DR-1", "DR-8", "DR-2"]);
    expect(rows.find((row) => row.id === "DR-8")?.attributes.status).toBe("review");
  });
});
