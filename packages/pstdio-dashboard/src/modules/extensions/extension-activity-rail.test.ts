import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { registerDashboardActivityRail } from "./extension-activity-rail";
import { metadataWithLabMode } from "./module-test-fixtures";

describe("registerDashboardActivityRail", () => {
  test("keeps activity navigation after the active page applies its layout", () => {
    const workbench = createWorkbench();
    const modeId = "pstdio.extension-lab.mode.lab";
    const metadata = {
      ...metadataWithLabMode,
      activityItems: [
        {
          id: "pstdio.extension-lab.activity-item.home",
          extensionId: "pstdio.extension-lab",
          title: "Home",
          icon: "house",
          modes: [{ extensionId: "pstdio.extension-lab", kind: "mode" as const, id: "lab" }],
          command: { extensionId: "pstdio.extension-lab", kind: "command" as const, id: "go-home" },
        },
      ],
    };

    workbench.modes.registerMode({ id: modeId, label: "Lab", activate: () => undefined });
    workbench.views.registerView({
      id: "lab-view",
      title: "Lab",
      body: { kind: "react", render: () => null },
    });
    workbench.views.registerView({
      id: "artifacts-view",
      title: "Artifacts",
      body: { kind: "react", render: () => null },
    });
    workbench.modePlacements.registerPlacement({
      id: "lab-artifacts",
      ref: { extensionId: "pstdio.extension-lab", kind: "placement", id: "lab-artifacts" },
      modeId,
      item: { kind: "view", viewId: "artifacts-view", presence: "open" },
      region: "main",
    });
    const labPage = { extensionId: "pstdio.extension-lab", kind: "page" as const, id: "lab-mode" };
    workbench.pages.registerPage({
      id: "pstdio.extension-lab.page.lab-mode",
      ref: labPage,
      title: "Lab mode",
      path: "lab-mode",
      modeId,
      slots: [{ id: "content", role: "primary", region: "main", viewId: "lab-view" }],
    });
    const activityRail = registerDashboardActivityRail(workbench, () => metadata);

    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: labPage });

    expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([]);
    expect(workbench.layout.getLayout().regions.activity.widgets).toEqual([
      expect.objectContaining({ viewId: "dashboard-workbench.activity-rail" }),
    ]);
    expect(workbench.layout.getActivePanel("main")?.viewId).toBe("lab-view");
    expect(workbench.getPrimaryResource()).toBeUndefined();

    activityRail.dispose();
  });
});
