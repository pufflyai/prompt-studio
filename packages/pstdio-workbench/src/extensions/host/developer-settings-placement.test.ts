import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { workbenchSlots } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../core";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const metadata = (extensionId: string): WorkbenchExtensionMetadata => ({
  extensions: [{ id: extensionId, name: extensionId, displayName: extensionId, sourcePath: "/fixture" }],
  views: [
    {
      id: `${extensionId}.view.control`,
      localId: "control",
      extensionId,
      title: "Control",
      body: {
        kind: "webview",
        webview: {
          entry: { kind: "package-asset", path: "./control.tsx", baseUrl: "file:///fixture/" },
          runtimeUrl: "/runtime.html",
          moduleUrl: "/control.js",
        },
      },
    },
  ],
  settingsPanels: [
    {
      id: `${extensionId}.settings-panel.control`,
      extensionId,
      view: { extensionId, kind: "view", id: "control" },
      slot: workbenchSlots.developerSettings,
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
});

test("independent controls target Developer settings on this device and dispose independently", () => {
  const workbench = createWorkbench();
  workbench.views.registerView({
    id: "developer-view",
    title: "Developer",
    body: { kind: "react", render: () => null },
  });
  workbench.settings.registerPanel({
    id: "developer-tools",
    title: "Developer",
    kind: "view",
    viewId: "developer-view",
    scope: "global",
  });
  const first = registerWorkbenchExtensionContributions({
    metadata: metadata("first"),
    workbench,
    projectId: "project",
    executeCommand: () => undefined,
  });
  const second = registerWorkbenchExtensionContributions({
    metadata: metadata("second"),
    workbench,
    projectId: "project",
    executeCommand: () => undefined,
  });
  expect(workbench.settings.getPanel("first.settings-panel.control")).toMatchObject({
    scope: "global",
    parentPanelId: "developer-tools",
  });
  first.dispose();
  expect(workbench.settings.getPanel("first.settings-panel.control")).toBeUndefined();
  expect(workbench.settings.getPanel("second.settings-panel.control")).toBeDefined();
  expect(workbench.settings.getPanel("developer-tools")).toBeDefined();
  second.dispose();
});
