import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { registerDashboardActivityRail } from "./extension-activity-rail";
import { metadataWithLabMode } from "./module-test-fixtures";

describe("registerDashboardActivityRail", () => {
  test("clears the host sidenav when the active mode owns activity navigation", () => {
    const workbench = createWorkbenchCore();
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
          command: { extensionId: "pstdio", kind: "command" as const, id: "workbench.action.switchMode" },
        },
      ],
    };

    workbench.modes.registerMode({ id: modeId, label: "Lab", activate: () => undefined });
    workbench.renderers.registerRenderer({ id: "host.sidenav", render: () => null });
    workbench.layout.registerPanel({
      id: "host.sidenav",
      title: "Sidenav",
      region: "sidenav",
      rendererId: "host.sidenav",
    });
    workbench.layout.openPanel("host.sidenav");
    const activityRail = registerDashboardActivityRail(workbench, () => metadata);

    workbench.modes.setActiveMode(modeId);
    activityRail.sync();

    expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([]);
  });
});
