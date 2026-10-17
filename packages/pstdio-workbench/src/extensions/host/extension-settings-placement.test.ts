import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

test("extension detail settings stay out of project settings navigation", () => {
  const extensionId = "pstdio.lab";
  const viewId = `${extensionId}.view.workflow`;
  const workbench = createWorkbench();
  const metadata: WorkbenchExtensionMetadata = {
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
        slot: { id: "extension.settings" },
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
  registerWorkbenchExtensionContributions({
    metadata,
    workbench,
    projectId: "project-1",
    executeCommand: () => undefined,
  });
  expect(workbench.settings.getPanel(`${extensionId}.settings-panel.workflow`)).toBeUndefined();
  expect(getWorkbenchRenderers(workbench).getRenderer(viewId)).toBeDefined();
});
