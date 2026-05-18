import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { dataRendererStoryProjectId, dataRendererStoryViewKind, storyDefaultDisplay } from "./mock-data";
import { createDataRendererStoryModule } from "./module";

describe("createDataRendererStoryModule", () => {
  test("accepts the display fields used by data renderer story saved views", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createDataRendererStoryModule());

    const view = await workbench.savedViews.create({
      name: "Current rows",
      resourceKind: dataRendererStoryViewKind,
      scope: "project",
      projectId: dataRendererStoryProjectId,
      filter: { field: "status", operator: "is", value: "review" },
      display: storyDefaultDisplay,
    });

    expect(view.invalid).toBeUndefined();
  });
});
