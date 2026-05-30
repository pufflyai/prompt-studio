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
});
