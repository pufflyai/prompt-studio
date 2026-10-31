import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "../bridge/webview-host-capabilities";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

test("extension settings retain their owners and warn on deprecated cross-extension access", async () => {
  const workbench = createWorkbench();
  const metadata = {
    extensions: [],
    commands: [],
    menuContributions: [],
    commandPaletteContributions: [],
    modes: [],
    pages: [],
    views: [
      {
        id: "acme.a.view.status",
        localId: "status",
        extensionId: "acme.a",
        title: "Status",
        body: {
          kind: "webview",
          webview: {
            entry: { kind: "package-asset", path: "./status.tsx", baseUrl: "file:///fixture/" },
            runtimeUrl: "/runtime.html",
            moduleUrl: "/status.js",
          },
        },
      },
    ],
    viewMenus: [],
    placements: [],
    resourceKinds: [],
    navigationItems: [],
    navigationTrees: [],
    statusBarItems: [
      {
        id: "acme.a.status-bar-item.status",
        extensionId: "acme.a",
        view: { extensionId: "acme.a", kind: "view", id: "status" },
        slot: { id: "status-bar.trailing" },
        visibilitySetting: "status.enabled",
      },
    ],
    settingsPanels: [],
    diagnostics: [],
    settingsDefinitions: [
      { extensionId: "acme.a", key: "status.enabled", type: "boolean", scope: "global", default: true },
      { extensionId: "acme.a", key: "shared", type: "string", scope: "global", default: "first" },
      { extensionId: "acme.a", key: "a.setting", type: "string", scope: "global", default: "a" },
      { extensionId: "acme.b", key: "shared", type: "string", scope: "global", default: "last" },
    ],
  } satisfies WorkbenchExtensionMetadata;
  const registration = registerWorkbenchExtensionContributions({
    workbench,
    metadata,
    projectId: "project",
    executeCommand: () => undefined,
  });
  expect(workbench.preferences.getSchema("a.setting")?.ownerId).toBe("acme.a");
  expect(workbench.preferences.getSchema("shared")?.ownerId).toBe("acme.b");
  expect(workbench.preferences.getValue("shared")).toBe("last");
  expect(workbench.statusBar.listVisibleItems()).toHaveLength(1);
  let visibilityUpdates = 0;
  const stop = workbench.statusBar.store.subscribe(() => {
    visibilityUpdates++;
  });
  await workbench.preferences.setValue("status.enabled", false, { scope: "user" });
  expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
  expect(visibilityUpdates).toBeGreaterThan(0);
  await workbench.preferences.setValue("status.enabled", true, { scope: "user" });
  expect(workbench.statusBar.listVisibleItems()).toHaveLength(1);
  stop();
  const warnings: string[] = [];
  const caller = createWorkbenchWebviewHostCapabilities({
    workbench,
    extensionId: "acme.b",
    warn: (message) => warnings.push(message),
  });
  await caller["preferences.set"]({ name: "a.setting", value: "legacy" });
  expect(workbench.preferences.getValue("a.setting")).toBe("legacy");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("deprecated");
  registration.dispose();
  expect(workbench.preferences.getSchema("a.setting")).toBeUndefined();
  expect(workbench.preferences.getSchema("shared")).toBeUndefined();
});
