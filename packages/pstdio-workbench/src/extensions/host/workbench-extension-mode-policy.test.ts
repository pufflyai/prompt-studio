import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

test("public mode metadata enforces the same floating and region policy as core modes", () => {
  const workbench = createWorkbench({ initialSidePanelMode: "floating" });
  const registration = registerWorkbenchExtensionContributions({
    executeCommand: () => undefined,
    projectId: "project",
    workbench,
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      modes: [
        {
          id: "example.lab.mode.kiln",
          localId: "kiln",
          extensionId: "example.lab",
          label: "Kiln",
          regions: ["main", "side", "secondary"],
          floatingPanels: "hidden",
          regionSettings: { side: { collapsible: false }, secondary: { collapsible: false, alwaysShowTabs: true } },
        },
      ],
    },
  });
  workbench.modes.setActiveMode("example.lab.mode.kiln");
  expect(workbench.sidePanel.canFloat()).toBe(false);
  expect(workbench.shell.getSidePanelPresentation()).toBe("attached");
  workbench.shell.setSidePanelPresentation("floating");
  expect(workbench.shell.getSidePanelPresentation()).toBe("attached");
  for (const region of ["side", "secondary"] as const) {
    expect(workbench.layout.getRegionCollapsible(region)).toBe(false);
    workbench.shell.setRegionOpen(region, false);
    expect(workbench.shell.getRegionState(region).open).toBe(false);
    workbench.shell.setRegionOpen(region, true);
    expect(workbench.shell.getRegionState(region).open).toBe(true);
  }
  expect(workbench.layout.getRegionSettings("secondary")?.alwaysShowTabs).toBe(true);
  registration.dispose();
});
