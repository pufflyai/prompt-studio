import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadataWithLabMode } from "./module-test-fixtures";

// Harvested from PS-259: closing a structural extension panel must be recoverable by
// reselecting the active mode, without resetting the remaining tab order.
describe("extension mode layout reconciliation", () => {
  test("reopens a closed main panel without changing the remaining tab order", async () => {
    const recoverableLabMetadata = {
      ...metadataWithLabMode,
      panels: metadataWithLabMode.panels.map((panel) =>
        panel.id === "extension-lab.labOverview" ? { ...panel, closable: true } : panel,
      ),
    };
    const loadMetadata = mock(async () => recoverableLabMetadata);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const extensionsDisposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));
    const notesDisposable = workbench.layout.registerWidget({
      id: "project.notes",
      title: "Notes",
      region: "main",
      rendererId: "project.notes",
    });

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");
      workbench.layout.openWidget("project.notes");
      workbench.layout.closePanel("dashboard-workbench.extension-view.extension-lab.labOverview");

      expect(workbench.layout.getLayout().regions.main.widgets.map((panel) => panel.contributionId)).toEqual([
        "project.notes",
      ]);

      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      expect(workbench.layout.getLayout().regions.main.widgets.map((panel) => panel.contributionId)).toEqual([
        "project.notes",
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      ]);
    } finally {
      notesDisposable.dispose();
      extensionsDisposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
