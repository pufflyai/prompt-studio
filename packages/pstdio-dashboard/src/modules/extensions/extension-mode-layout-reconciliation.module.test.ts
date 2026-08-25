import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadataWithLabMode } from "./module-test-fixtures";

// Harvested from PS-259: a missing required extension panel must be recoverable by
// reselecting the active mode, without resetting the remaining tab order.
describe("extension mode layout reconciliation", () => {
  test("restores a missing required main panel without changing the remaining tab order", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const extensionsDisposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));
    const notesDisposable = workbench.layout.registerWidget({
      id: "project.notes",
      title: "Notes",
      region: "main",
      rendererId: "project.notes",
    });
    const overviewId = "extension-lab.labOverview";

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");
      workbench.layout.openWidget("project.notes");

      const overview = workbench.layout
        .getLayout()
        .regions.main.widgets.find((panel) => panel.contributionId === overviewId)!;
      // A required placement is not closable, so only a stale layout can lose it.
      expect(overview.closable).toBe(false);
      workbench.layout.removeWidgetPlacement(overview.widgetId);

      expect(workbench.layout.getLayout().regions.main.widgets.map((panel) => panel.contributionId)).toEqual([
        "project.notes",
      ]);

      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      expect(workbench.layout.getLayout().regions.main.widgets.map((panel) => panel.contributionId)).toEqual([
        "project.notes",
        overviewId,
      ]);
    } finally {
      notesDisposable.dispose();
      extensionsDisposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
