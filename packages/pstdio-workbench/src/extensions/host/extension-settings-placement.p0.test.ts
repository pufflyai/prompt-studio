import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { workbenchSlots } from "@pstdio/sdk/extensions";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const metadataForSlot = (slot: { id: string }): WorkbenchExtensionMetadata => {
  const extensionId = "pstdio.lab";
  const viewId = `${extensionId}.view.workflow`;
  return {
    extensions: [{ id: extensionId, name: "lab", displayName: "Lab", sourcePath: "/lab" }],
    views: [
      {
        id: viewId,
        localId: "workflow",
        extensionId,
        title: "Workflow",
        body: {
          kind: "webview",
          webview: {
            entry: { kind: "package-asset", path: "./workflow.tsx", baseUrl: "file:///lab/" },
            runtimeUrl: "/runtime.html",
            moduleUrl: "/workflow.js",
          },
        },
      },
    ],
    settingsPanels: [
      {
        id: `${extensionId}.settings-panel.workflow`,
        extensionId,
        view: { extensionId, kind: "view", id: "workflow" },
        slot,
      },
    ],
    commands: [],
    menuContributions: [],
    commandPaletteContributions: [],
    modes: [],
    pages: [],
    placements: [],
    resourceKinds: [],
    navigationItems: [],
    navigationTrees: [],
    statusBarItems: [],
    viewMenus: [],
    diagnostics: [],
  };
};

test("extension detail settings stay out of project settings navigation", () => {
  const workbench = createWorkbench();
  const metadata = metadataForSlot(workbenchSlots.extensionSettings);
  registerWorkbenchExtensionContributions({
    metadata,
    workbench,
    projectId: "project-1",
    executeCommand: () => undefined,
  });
  expect(workbench.settings.getPanel("pstdio.lab.settings-panel.workflow")).toBeUndefined();
  expect(getWorkbenchRenderers(workbench).getRenderer("pstdio.lab.view.workflow")).toBeDefined();
});

for (const projectId of ["project-1", "project-2"]) {
  test(`app-wide settings are global in ${projectId}`, () => {
    const workbench = createWorkbench();
    registerWorkbenchExtensionContributions({
      metadata: metadataForSlot(workbenchSlots.globalSettings),
      workbench,
      projectId,
      executeCommand: () => undefined,
    });
    expect(workbench.settings.getPanel("pstdio.lab.settings-panel.workflow")).toMatchObject({
      scope: "global",
      kind: "view",
    });
  });
}
